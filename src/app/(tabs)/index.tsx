import { ActiveWorkoutCard } from '@/components/active-workout-card';
import { AppText, Button, Divider, IconButton, Icons, Panel, SectionHeader, Stat } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { WorkoutRow } from '@/components/workout-row';
import { Radius, Spacing } from '@/constants/theme';
import { getNutritionDays } from '@/database/healthQueries';
import { getActiveWorkout, getWorkoutSummaries } from '@/database/workoutQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { useWorkoutActions } from '@/hooks/use-workout-actions';
import { addDays, dateKey, daysIn, formatHoursMinutes, periodContaining } from '@/lib/dates';
import { formatVolume, weightLabel } from '@/lib/units';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

export default function TodayScreen() {
  const { units } = useSettings();
  const workoutActions = useWorkoutActions();

  const { data, reload } = useFocusQuery(async (database) => {
    const week = periodContaining('week', new Date());
    const [active, weekWorkouts, recent, nutrition] = await Promise.all([
      getActiveWorkout(database),
      getWorkoutSummaries(database, { from: week.start.toISOString(), to: week.end.toISOString() }),
      getWorkoutSummaries(database, { limit: 3 }),
      getNutritionDays(database, dateKey(addDays(new Date(), -1)), dateKey(addDays(new Date(), 1))),
    ]);
    return { week, active, weekWorkouts, recent, nutrition };
  });

  const today = new Date();
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
      onRefresh={reload}>

      <Pressable onPress={() => router.push('/settings')}>
        <Panel style={styles.connect}>
          <AppText variant="bodyStrong">Connect WHOOP band</AppText>
          <AppText variant="caption" color="textSecondary">Direct Bluetooth connection · no subscription</AppText>
          <AppText variant="bodyStrong">Connect ›</AppText>
        </Panel>
      </Pressable>

      {data?.active ? (
        <ActiveWorkoutCard workout={data.active} onChanged={reload} />
      ) : (
        <Button label="Start workout" icon={Icons.play} onPress={() => workoutActions.start()} loading={workoutActions.busy} />
      )}
      {workoutActions.error && <AppText color="danger">{workoutActions.error}</AppText>}

      <SectionHeader title="This week" />
      <WeekStrip
        days={data ? daysIn(data.week) : []}
        trainedDays={new Set(weekWorkouts.map((workout) => dateKey(new Date(workout.started_at))))}
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

// Seven days, Monday first. A filled square means you trained.
function WeekStrip({ days, trainedDays }: { days: Date[], trainedDays: Set<string> }) {
  const theme = useTheme();
  const todayKey = dateKey(new Date());
  return (
    <View style={styles.week}>
      {days.map((day) => {
        const key = dateKey(day);
        const trained = trainedDays.has(key);
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
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pair: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
  inlineButton: {
    minHeight: 44,
    paddingHorizontal: 0,
  },
});
