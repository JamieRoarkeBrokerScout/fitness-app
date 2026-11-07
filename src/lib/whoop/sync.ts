import { upsertWhoopDay, upsertWhoopWorkout } from '@/database/healthQueries';
import { getSetting, setSetting } from '@/database/settingsQueries';
import { dateKey } from '@/lib/dates';
import { WhoopDay } from '@/types/health';
import type { SQLiteDatabase } from 'expo-sqlite';
import { whoopGetAll } from './client';

// Response shapes from the WHOOP v2 API, trimmed to the fields we use.
interface Scored<S> {
    score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE',
    score?: S,
}

interface Cycle extends Scored<{ strain: number, kilojoule: number, average_heart_rate: number, max_heart_rate: number }> {
    id: number,
    start: string,
    end?: string | null,
}

interface Recovery extends Scored<{
    recovery_score: number,
    resting_heart_rate: number,
    hrv_rmssd_milli: number,
    spo2_percentage?: number,
    skin_temp_celsius?: number,
}> {
    cycle_id: number,
    sleep_id: string,
}

interface Sleep extends Scored<{
    stage_summary: {
        total_light_sleep_time_milli: number,
        total_slow_wave_sleep_time_milli: number,
        total_rem_sleep_time_milli: number,
    },
    respiratory_rate?: number,
    sleep_performance_percentage?: number,
    sleep_efficiency_percentage?: number,
}> {
    id: string,
    start: string,
    end: string,
    nap: boolean,
}

interface Workout extends Scored<{ strain: number, average_heart_rate: number, max_heart_rate: number, kilojoule: number }> {
    id: string,
    start: string,
    end: string,
    sport_name?: string,
}

const LAST_SYNC_KEY = 'whoop_last_sync';
const FIRST_SYNC_DAYS = 90;
// re-fetch a few days back each time, since recent cycles get re-scored
const OVERLAP_DAYS = 3;

export async function getLastWhoopSync(db: SQLiteDatabase) {
    return getSetting(db, LAST_SYNC_KEY);
}

export async function syncWhoop(db: SQLiteDatabase) {
    const last = await getLastWhoopSync(db);
    const since = new Date(last ?? Date.now());
    since.setDate(since.getDate() - (last ? OVERLAP_DAYS : FIRST_SYNC_DAYS));
    const start = since.toISOString();

    const [cycles, recoveries, sleeps, workouts] = await Promise.all([
        whoopGetAll<Cycle>('/v2/cycle', start),
        whoopGetAll<Recovery>('/v2/recovery', start),
        whoopGetAll<Sleep>('/v2/activity/sleep', start),
        whoopGetAll<Workout>('/v2/activity/workout', start),
    ]);

    const recoveryByCycle = new Map(recoveries.map((recovery) => [recovery.cycle_id, recovery]));
    const sleepById = new Map(sleeps.map((sleep) => [sleep.id, sleep]));
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
        for (const cycle of cycles) {
            const recovery = recoveryByCycle.get(cycle.id);
            const sleep = recovery ? sleepById.get(recovery.sleep_id) : undefined;
            const cycleScore = cycle.score_state === 'SCORED' ? cycle.score : undefined;
            const recoveryScore = recovery?.score_state === 'SCORED' ? recovery.score : undefined;
            const sleepScore = sleep?.score_state === 'SCORED' ? sleep.score : undefined;
            const stages = sleepScore?.stage_summary;

            const day: WhoopDay = {
                date: dayForCycle(cycle, sleep),
                cycle_id: cycle.id,
                strain: cycleScore?.strain ?? null,
                kilojoule: cycleScore?.kilojoule ?? null,
                average_heart_rate: cycleScore?.average_heart_rate ?? null,
                max_heart_rate: cycleScore?.max_heart_rate ?? null,
                recovery_score: recoveryScore?.recovery_score ?? null,
                hrv_ms: recoveryScore?.hrv_rmssd_milli ?? null,
                resting_heart_rate: recoveryScore?.resting_heart_rate ?? null,
                spo2_pct: recoveryScore?.spo2_percentage ?? null,
                skin_temp_c: recoveryScore?.skin_temp_celsius ?? null,
                sleep_performance_pct: sleepScore?.sleep_performance_percentage ?? null,
                sleep_efficiency_pct: sleepScore?.sleep_efficiency_percentage ?? null,
                sleep_ms: stages
                    ? stages.total_light_sleep_time_milli + stages.total_slow_wave_sleep_time_milli + stages.total_rem_sleep_time_milli
                    : null,
                respiratory_rate: sleepScore?.respiratory_rate ?? null,
                updated_at: now,
            };
            await upsertWhoopDay(db, day);
        }

        for (const workout of workouts) {
            const score = workout.score_state === 'SCORED' ? workout.score : undefined;
            await upsertWhoopWorkout(db, {
                id: workout.id,
                start: workout.start,
                end: workout.end,
                sport_name: workout.sport_name ?? null,
                strain: score?.strain ?? null,
                average_heart_rate: score?.average_heart_rate ?? null,
                max_heart_rate: score?.max_heart_rate ?? null,
                kilojoule: score?.kilojoule ?? null,
            });
        }
    });

    await setSetting(db, LAST_SYNC_KEY, now);
    return { days: cycles.length, workouts: workouts.length };
}

// A WHOOP cycle starts when you fall asleep, usually the evening before. We file it under
// the day you woke up, which is how the WHOOP app labels it.
function dayForCycle(cycle: Cycle, sleep: Sleep | undefined) {
    if (sleep) {
        return dateKey(new Date(sleep.end));
    }
    return dateKey(new Date(new Date(cycle.start).getTime() + 12 * 60 * 60 * 1000));
}
