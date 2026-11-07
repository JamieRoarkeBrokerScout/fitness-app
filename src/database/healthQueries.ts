import { NutritionDay, WhoopDay, WhoopWorkout } from '@/types/health';
import type { SQLiteDatabase } from 'expo-sqlite';

export async function upsertWhoopDay(
    db: SQLiteDatabase,
    day: WhoopDay,
) {
    await db.runAsync(
        `INSERT OR REPLACE INTO whoop_days (
            date, cycle_id, strain, kilojoule, average_heart_rate, max_heart_rate, recovery_score, hrv_ms,
            resting_heart_rate, spo2_pct, skin_temp_c, sleep_performance_pct, sleep_efficiency_pct, sleep_ms,
            respiratory_rate, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            day.date,
            day.cycle_id,
            day.strain,
            day.kilojoule,
            day.average_heart_rate,
            day.max_heart_rate,
            day.recovery_score,
            day.hrv_ms,
            day.resting_heart_rate,
            day.spo2_pct,
            day.skin_temp_c,
            day.sleep_performance_pct,
            day.sleep_efficiency_pct,
            day.sleep_ms,
            day.respiratory_rate,
            day.updated_at,
        ]
    );
}

export async function upsertWhoopWorkout(
    db: SQLiteDatabase,
    workout: WhoopWorkout,
) {
    await db.runAsync(
        `INSERT OR REPLACE INTO whoop_workouts
            (id, start, end, sport_name, strain, average_heart_rate, max_heart_rate, kilojoule)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            workout.id,
            workout.start,
            workout.end,
            workout.sport_name,
            workout.strain,
            workout.average_heart_rate,
            workout.max_heart_rate,
            workout.kilojoule,
        ]
    );
}

// Date keys are YYYY-MM-DD; `to` is exclusive.
export async function getWhoopDays(
    db: SQLiteDatabase,
    from: string,
    to: string,
) {
    return db.getAllAsync<WhoopDay>(
        'SELECT * FROM whoop_days WHERE date >= ? AND date < ? ORDER BY date',
        [from, to]
    );
}

export async function getLatestWhoopDay(
    db: SQLiteDatabase,
) {
    return db.getFirstAsync<WhoopDay>('SELECT * FROM whoop_days ORDER BY date DESC LIMIT 1');
}

// The WHOOP activity that overlaps a logged workout the most, if any.
export async function getOverlappingWhoopWorkout(
    db: SQLiteDatabase,
    start: string,
    end: string,
) {
    return db.getFirstAsync<WhoopWorkout>(
        `SELECT * FROM whoop_workouts
         WHERE start < ? AND end > ?
         ORDER BY (MIN(julianday(end), julianday(?)) - MAX(julianday(start), julianday(?))) DESC
         LIMIT 1`,
        [end, start, end, start]
    );
}

export async function upsertNutritionDay(
    db: SQLiteDatabase,
    day: NutritionDay,
) {
    await db.runAsync(
        `INSERT OR REPLACE INTO nutrition_days (date, calories, protein_g, carbs_g, fat_g, source, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [day.date, day.calories, day.protein_g, day.carbs_g, day.fat_g, day.source, day.updated_at]
    );
}

export async function getNutritionDays(
    db: SQLiteDatabase,
    from: string,
    to: string,
) {
    return db.getAllAsync<NutritionDay>(
        'SELECT * FROM nutrition_days WHERE date >= ? AND date < ? ORDER BY date',
        [from, to]
    );
}

export async function getNutritionStats(
    db: SQLiteDatabase,
) {
    return db.getFirstAsync<{ days: number, first: string | null, last: string | null }>(
        'SELECT COUNT(*) AS days, MIN(date) AS first, MAX(date) AS last FROM nutrition_days'
    );
}

export async function clearWhoopData(
    db: SQLiteDatabase,
) {
    await db.execAsync('DELETE FROM whoop_days; DELETE FROM whoop_workouts;');
}
