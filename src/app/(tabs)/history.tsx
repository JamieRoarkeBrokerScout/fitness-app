import { ActiveWorkoutCard } from '@/components/active-workout-card';
import { AppText, Button, Divider, EmptyState, Icons, SectionHeader } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { WorkoutRow } from '@/components/workout-row';
import { getActiveWorkout, getWorkoutSummaries } from '@/database/workoutQueries';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useWorkoutActions } from '@/hooks/use-workout-actions';
import { WorkoutSummary } from '@/types/workouts';
import { StyleSheet, View } from 'react-native';

export default function HistoryScreen() {
  const actions = useWorkoutActions();
  const { data, reload } = useFocusQuery(async (database) => {
    const [active, workouts] = await Promise.all([getActiveWorkout(database), getWorkoutSummaries(database)]);
    return { active, workouts };
  });

  // group by month for the logbook feel
  const months: { label: string, workouts: WorkoutSummary[] }[] = [];
  for (const workout of data?.workouts ?? []) {
    const label = new Date(workout.started_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const last = months[months.length - 1];
    if (last?.label === label) {
      last.workouts.push(workout);
    } else {
      months.push({ label, workouts: [workout] });
    }
  }

  return (
    <Screen title="Workouts" onRefresh={reload}>
      {data?.active ? (
        <ActiveWorkoutCard workout={data.active} onChanged={reload} />
      ) : (
        <Button label="Start workout" icon={Icons.play} onPress={() => actions.start()} loading={actions.busy} />
      )}
      {actions.error && <AppText color="danger">{actions.error}</AppText>}

      {data && data.workouts.length === 0 && (
        <EmptyState
          title="No workouts yet"
          body="Start a workout, add exercises, and tick off sets as you go. Finished workouts are kept here."
        />
      )}

      {months.map((month) => (
        <View key={month.label} style={styles.month}>
          <SectionHeader
            title={month.label}
            action={<AppText variant="caption" color="textSecondary">{month.workouts.length} {month.workouts.length === 1 ? 'workout' : 'workouts'}</AppText>}
          />
          {month.workouts.map((workout, index) => (
            <View key={workout.id}>
              {index > 0 && <Divider />}
              <WorkoutRow workout={workout} />
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  month: {
    gap: Spacing.one,
  },
});
