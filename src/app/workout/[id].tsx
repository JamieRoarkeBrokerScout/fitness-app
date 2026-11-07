import { AppText, Button, Divider, Panel, Stat } from '@/components/ui/primitives';
import { workoutTitle } from '@/components/workout-row';
import { Display, MaxContentWidth, Plate, Spacing } from '@/constants/theme';
import { isCardio } from '@/database/exerciseQueries';
import { getOverlappingWhoopWorkout } from '@/database/healthQueries';
import { deleteWorkout, getWorkout, getWorkoutEntries } from '@/database/workoutQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { formatHoursMinutes } from '@/lib/dates';
import { formatNumber, formatVolume, kgToDisplay, weightLabel } from '@/lib/units';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

export default function WorkoutDetailScreen() {
  const db = useSQLiteContext();
  const { units } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data } = useFocusQuery(async (database) => {
    const workout = await getWorkout(database, id);
    if (!workout) {
      return null;
    }
    const entries = await getWorkoutEntries(database, id);
    const whoop = workout.ended_at ? await getOverlappingWhoopWorkout(database, workout.started_at, workout.ended_at) : null;
    return { workout, entries, whoop };
  }, [id]);

  if (!data) {
    return <View style={styles.flex} />;
  }

  const { workout, entries, whoop } = data;
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
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '' }} />
      <View>
        <AppText variant="caption" color="textSecondary">
          {started.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })},{' '}
          {started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </AppText>
        <AppText variant="title">{workoutTitle(workout)}</AppText>
      </View>

      <View style={styles.row}>
        <Stat value={formatHoursMinutes(minutes)} label="duration" />
        <Stat value={String(sets.length)} label="sets" />
        <Stat value={formatVolume(volume, units)} unit={weightLabel(units)} label="volume" />
      </View>

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

      {workout.notes && <AppText color="textSecondary">{workout.notes}</AppText>}

      {entries.map((entry) => {
        const cardio = isCardio(entry.category);
        return (
          <View key={entry.id} style={styles.entry}>
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
            <Divider />
          </View>
        );
      })}

      <Button kind="danger" label="Delete workout" onPress={handleDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  entry: {
    gap: Spacing.one,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  setLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
    paddingVertical: 2,
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
