import { recoveryColor, RecoveryPlate } from '@/components/ui/charts';
import { AppText, Button, Divider, Icon, IconButton, Icons, Panel, SectionHeader, Stat } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { WorkoutRow, workoutTitle } from '@/components/workout-row';
import { Display, Plate, Radius, Spacing } from '@/constants/theme';
import { getLatestWhoopDay, getNutritionDays, getWhoopDays } from '@/database/healthQueries';
import { getActiveWorkout, getWorkoutSummaries, startWorkout } from '@/database/workoutQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { useWhoop } from '@/hooks/use-whoop';
import { addDays, dateKey, daysIn, formatDuration, formatHoursMinutes, periodContaining } from '@/lib/dates';
import { formatVolume, weightLabel } from '@/lib/units';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { units } = useSettings();
  const whoop = useWhoop({ autoSync: true });
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);

  const { data, reload } = useFocusQuery(async (database) => {
    const week = periodContaining('week', new Date());
    const [active, weekWorkouts, recent, latestWhoop, weekWhoop, nutrition] = await Promise.all([
      getActiveWorkout(database),
      getWorkoutSummaries(database, { from: week.start.toISOString(), to: week.end.toISOString() }),
      getWorkoutSummaries(database, { limit: 3 }),
      getLatestWhoopDay(database),
      getWhoopDays(database, dateKey(week.start), dateKey(week.end)),
      getNutritionDays(database, dateKey(addDays(new Date(), -1)), dateKey(addDays(new Date(), 1))),
    ]);
    return { week, active, weekWorkouts, recent, latestWhoop, weekWhoop, nutrition };
  });

  // re-read once a sync lands so new WHOOP numbers show without leaving the screen
  useEffect(() => {
    if (!whoop.syncing) {
      void reload();
    }
  }, [whoop.syncing, reload]);

  // Function to handle starting a new workout
  const handleStartWorkout = async () => {
    setWorkoutError(null);
    if (data?.active || isStartingWorkout) {
      router.push('/workout/active');
      return;
    }
    try {
      setIsStartingWorkout(true);
      await startWorkout(db);
      router.push('/workout/active');
    } catch (error) {
      console.error('Failed to start workout:', error);
      setWorkoutError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsStartingWorkout(false);
    }
  };

  const today = new Date();
  const whoopDay = data?.latestWhoop;
  const isTodaysWhoop = whoopDay?.date === dateKey(today);
  const weekWorkouts = data?.weekWorkouts ?? [];
  const weekMinutes = weekWorkouts.reduce(
    (total, workout) => total + (workout.ended_at ? (new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) / 60000 : 0),
    0
  );
  const weekVolume = weekWorkouts.reduce((total, workout) => total + workout.volume_kg, 0);
  const nutrition = data?.nutrition.find((day) => day.date === dateKey(today)) ?? data?.nutrition.find((day) => day.date === dateKey(addDays(today, -1)));

  return (
    <Screen
      title="Today"
      subtitle={today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      action={<IconButton icon={Icons.settings} label="Settings" onPress={() => router.push('/settings')} />}
      onRefresh={async () => {
        if (whoop.connected) {
          await whoop.sync();
        }
        await reload();
      }}>

      {whoop.connected && whoopDay ? (
        <View style={styles.readiness}>
          <RecoveryPlate score={whoopDay.recovery_score} />
          <View style={styles.readinessStats}>
            <Stat
              value={whoopDay.strain !== null ? whoopDay.strain.toFixed(1) : '–'}
              label="Day strain"
              tone={Plate.blue}
            />
            <Stat
              value={whoopDay.sleep_ms !== null ? formatHoursMinutes(whoopDay.sleep_ms / 60000) : '–'}
              label={whoopDay.sleep_performance_pct !== null ? `Sleep, ${Math.round(whoopDay.sleep_performance_pct)}% of need` : 'Sleep'}
              tone={Plate.violet}
            />
            <View style={styles.pair}>
              <Stat value={whoopDay.hrv_ms !== null ? String(Math.round(whoopDay.hrv_ms)) : '–'} unit="ms" label="HRV" />
              <Stat value={whoopDay.resting_heart_rate !== null ? String(Math.round(whoopDay.resting_heart_rate)) : '–'} unit="bpm" label="Resting HR" />
            </View>
          </View>
        </View>
      ) : null}
      {whoop.connected && whoopDay && !isTodaysWhoop && (
        <AppText variant="caption" color="textSecondary">
          Showing WHOOP data from {new Date(`${whoopDay.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}. Today’s recovery appears once WHOOP scores your sleep.
        </AppText>
      )}
      {whoop.connected && !whoopDay && (
        <AppText color="textSecondary">{whoop.syncing ? 'Pulling your WHOOP data…' : 'WHOOP is connected. Pull down to sync.'}</AppText>
      )}
      {whoop.connected === false && (
        <Pressable onPress={() => router.push('/settings')}>
          <Panel style={styles.connect}>
            <Icon name={Icons.heart} color={Plate.red} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Connect WHOOP</AppText>
              <AppText variant="caption" color="textSecondary">See recovery, strain and sleep next to your training.</AppText>
            </View>
            <Icon name={Icons.chevronRight} size={16} color={theme.textSecondary} />
          </Panel>
        </Pressable>
      )}
      {whoop.error && <AppText variant="caption" color="danger">{whoop.error}</AppText>}

      {data?.active ? (
        <Pressable onPress={() => router.push('/workout/active')}>
          <View style={[styles.activeBanner, { backgroundColor: theme.action }]}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color="actionText">In progress</AppText>
              <AppText variant="heading" color="actionText">{workoutTitle(data.active)}</AppText>
            </View>
            <ElapsedClock since={data.active.started_at} color={theme.actionText} />
          </View>
        </Pressable>
      ) : (
        <Button label="Start workout" icon={Icons.play} onPress={handleStartWorkout} loading={isStartingWorkout} />
      )}
      {workoutError && <AppText color="danger">{workoutError}</AppText>}

      <SectionHeader title="This week" />
      <WeekStrip
        days={data ? daysIn(data.week) : []}
        trainedDays={new Set(weekWorkouts.map((workout) => dateKey(new Date(workout.started_at))))}
        recovery={new Map((data?.weekWhoop ?? []).map((day) => [day.date, day.recovery_score]))}
      />
      <View style={styles.pair}>
        <Stat value={String(weekWorkouts.length)} label={weekWorkouts.length === 1 ? 'workout' : 'workouts'} />
        <Stat value={formatHoursMinutes(weekMinutes)} label="training time" />
        <Stat value={formatVolume(weekVolume, units)} unit={weightLabel(units)} label="volume" />
      </View>

      {nutrition && (
        <>
          <SectionHeader title={nutrition.date === dateKey(today) ? 'Eaten today' : 'Eaten yesterday'} />
          <View style={styles.pair}>
            <Stat value={nutrition.calories !== null ? Math.round(nutrition.calories).toLocaleString() : '–'} unit="kcal" label="calories" />
            <Stat value={nutrition.protein_g !== null ? String(Math.round(nutrition.protein_g)) : '–'} unit="g" label="protein" />
            <Stat value={nutrition.carbs_g !== null ? String(Math.round(nutrition.carbs_g)) : '–'} unit="g" label="carbs" />
          </View>
        </>
      )}

      <SectionHeader
        title="Recent workouts"
        action={(data?.recent.length ?? 0) > 0 ? <Button kind="quiet" label="See all" onPress={() => router.push('/history')} style={styles.inlineButton} /> : undefined}
      />
      {data?.recent.length === 0 && (
        <AppText color="textSecondary">Workouts you finish show up here.</AppText>
      )}
      {data?.recent.map((workout, index) => (
        <View key={workout.id}>
          {index > 0 && <Divider />}
          <WorkoutRow workout={workout} />
        </View>
      ))}
    </Screen>
  );
}

function ElapsedClock({ since, color }: { since: string, color: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <AppText style={{ fontFamily: Display.semibold, fontSize: 28, color, fontVariant: ['tabular-nums'] }}>
      {formatDuration((now - new Date(since).getTime()) / 1000)}
    </AppText>
  );
}

// Seven days, Monday first. A filled square means you trained; the underline is that
// morning's recovery colour.
function WeekStrip({ days, trainedDays, recovery }: { days: Date[], trainedDays: Set<string>, recovery: Map<string, number | null> }) {
  const theme = useTheme();
  const todayKey = dateKey(new Date());
  return (
    <View style={styles.week}>
      {days.map((day) => {
        const key = dateKey(day);
        const trained = trainedDays.has(key);
        const score = recovery.get(key);
        return (
          <View key={key} style={styles.weekDay}>
            <AppText variant="caption" color={key === todayKey ? 'text' : 'textSecondary'} style={key === todayKey && { fontWeight: '700' }}>
              {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </AppText>
            <View
              style={[
                styles.weekCell,
                { backgroundColor: trained ? theme.text : theme.backgroundElement },
              ]}>
              <AppText variant="caption" style={{ color: trained ? theme.background : theme.textSecondary, fontWeight: '600' }}>
                {day.getDate()}
              </AppText>
            </View>
            <View
              style={[
                styles.weekRecovery,
                { backgroundColor: score === null || score === undefined ? 'transparent' : recoveryColor(score) },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  readiness: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.two,
  },
  readinessStats: {
    flex: 1,
    gap: Spacing.three,
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  weekCell: {
    width: 38,
    height: 38,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRecovery: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  inlineButton: {
    minHeight: 32,
    paddingHorizontal: 0,
  },
});
