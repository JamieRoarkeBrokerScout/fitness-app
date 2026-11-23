import { DashboardSurface } from '@/components/ui/dashboard-surface';
import { AppText, Button, Divider, Icons, Panel, Stat } from '@/components/ui/primitives';
import { workoutTitle } from '@/components/workout-row';
import { Display, Layout, MaxContentWidth, Plate, Spacing } from '@/constants/theme';
import { isCardio } from '@/database/exerciseQueries';
import { getOverlappingWhoopWorkout } from '@/database/healthQueries';
import { deleteWorkout, getActiveWorkout, getWorkout, getWorkoutEntries } from '@/database/workoutQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { useWorkoutActions } from '@/hooks/use-workout-actions';
import { formatHoursMinutes } from '@/lib/dates';
import { formatNumber, formatVolume, kgToDisplay, weightLabel } from '@/lib/units';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

export default function WorkoutDetailScreen() {
  const db = useSQLiteContext();
  const { units } = useSettings();
  const { id, finished } = useLocalSearchParams<{ id: string, finished?: string }>();
  const actions = useWorkoutActions();

  const { data } = useFocusQuery(async (database) => {
    const workout = await getWorkout(database, id);
    if (!workout) {
      return null;
    }
    const entries = await getWorkoutEntries(database, id);
    const whoop = workout.ended_at ? await getOverlappingWhoopWorkout(database, workout.started_at, workout.ended_at) : null;
    const hasActive = (await getActiveWorkout(database)) !== null;
    return { workout, entries, whoop, hasActive };
  }, [id]);

  if (!data) {
    return <View style={styles.flex} />;
  }

  const { workout, entries, whoop, hasActive } = data;
  const justFinished = finished === '1';
  const started = new Date(workout.started_at);
  const minutes = workout.ended_at ? (new Date(workout.ended_at).getTime() - started.getTime()) / 60000 : 0;
  const sets = entries.flatMap((entry) => entry.sets);
  const volume = sets.reduce((total, set) => total + (set.weight ?? 0) * (set.reps ?? 0), 0);
  const distanceUnit = units === 'lb' ? 'mi' : 'km';
  const kmPerUnit = units === 'lb' ? 1.609344 : 1;

  const handleDelete = () => {
    Alert.alert('Delete this workout?', 'It will be removed from your history and progress.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, workout.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <DashboardSurface><ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: justFinished ? 'Workout saved' : '' }} />
      <View>
        <AppText variant="caption" color="textSecondary">
          {started.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })},{' '}
          {started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </AppText>
        <AppText variant="title">{workoutTitle(workout)}</AppText>
      </View>

      <Panel style={styles.row}>
        <Stat value={formatHoursMinutes(minutes)} label="duration" />
        <Stat value={String(sets.length)} label={sets.length === 1 ? 'set' : 'sets'} />
        <Stat value={formatVolume(volume, units)} unit={weightLabel(units)} label="volume" />
      </Panel>

      {whoop && (
        <Panel style={styles.row}>
          <Stat value={whoop.strain !== null ? whoop.strain.toFixed(1) : '–'} label="WHOOP strain" tone={Plate.blue} />
          <Stat value={whoop.average_heart_rate !== null ? String(whoop.average_heart_rate) : '–'} unit="bpm" label="avg heart rate" />
          <Stat
            value={whoop.kilojoule !== null ? String(Math.round(whoop.kilojoule / 4.184)) : '–'}
            unit="kcal"
            label="burned"
          />
        </Panel>
      )}

      {justFinished && (
        <View style={styles.nextSteps}>
          {!hasActive && (
            <Button label="Start new workout" icon={Icons.play} onPress={() => actions.start({ replace: true })} loading={actions.busy} />
          )}
          <Button kind="secondary" label="Done" onPress={() => router.back()} />
          {actions.error && <AppText color="danger">{actions.error}</AppText>}
        </View>
      )}

      {workout.notes && <AppText color="textSecondary">{workout.notes}</AppText>}

      {entries.map((entry) => {
        const cardio = isCardio(entry.category);
        return (
          <Panel key={entry.id} style={styles.entry}>
            <AppText variant="heading" style={styles.capitalize}>{entry.name}</AppText>
            {entry.sets.map((set) => (
              <View key={set.id} style={styles.setLine}>
                <AppText style={styles.setNumber} color="textSecondary">{set.set_number}</AppText>
                <AppText style={styles.setValue}>
                  {cardio
                    ? `${set.duration_seconds !== null ? formatNumber(set.duration_seconds / 60) : '–'} min${
                        set.distance_meters !== null ? `, ${formatNumber(set.distance_meters / 1000 / kmPerUnit, 2)} ${distanceUnit}` : ''
                      }`
                    : `${set.weight !== null ? formatNumber(kgToDisplay(set.weight, units)) : '–'} ${weightLabel(units)} × ${set.reps ?? '–'}`}
                </AppText>
              </View>
            ))}
            <View style={styles.entryDivider}>
              <Divider />
            </View>
          </Panel>
        );
      })}

      <Button kind="danger" label="Delete workout" onPress={handleDelete} />
    </ScrollView></DashboardSurface>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  nextSteps: {
    gap: Spacing.two,
  },
  entry: {
    gap: Spacing.one,
  },
  entryDivider: {
    marginTop: Spacing.three,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  setLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  setNumber: {
    fontFamily: Display.semibold,
    fontSize: 18,
    width: 20,
  },
  setValue: {
    fontFamily: Display.medium,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
});
