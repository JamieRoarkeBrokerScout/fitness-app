import { AppText, Button, Divider, EmptyState, Icons, SectionHeader } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { WorkoutRow } from '@/components/workout-row';
import { getActiveWorkout, getWorkoutSummaries, startWorkout } from '@/database/workoutQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { WorkoutSummary } from '@/types/workouts';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { View } from 'react-native';

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { data, reload } = useFocusQuery(async (database) => {
    const [active, workouts] = await Promise.all([getActiveWorkout(database), getWorkoutSummaries(database)]);
    return { active, workouts };
  });

  const handleStart = async () => {
    if (!data?.active) {
      await startWorkout(db);
    }
    router.push('/workout/active');
  };

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
      <Button
        label={data?.active ? 'Resume workout' : 'Start workout'}
        icon={Icons.play}
        onPress={handleStart}
      />

      {data && data.workouts.length === 0 && (
        <EmptyState
          title="No workouts yet"
          body="Start a workout, add exercises, and tick off sets as you go. Finished workouts are kept here."
        />
      )}

      {months.map((month) => (
        <View key={month.label}>
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
