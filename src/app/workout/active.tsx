import { AppText, Button, Divider, EmptyState, Icon, IconButton, Icons } from '@/components/ui/primitives';
import { workoutTitle } from '@/components/workout-row';
import { Display, MaxContentWidth, Plate, Radius, Spacing } from '@/constants/theme';
import { isCardio } from '@/database/exerciseQueries';
import {
  addSet,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getPreviousSets,
  getWorkoutEntries,
  removeExerciseFromWorkout,
  renameWorkout,
  startWorkout,
  updateSet,
  updateWorkoutNotes,
} from '@/database/workoutQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/dates';
import { displayToKg, formatNumber, kgToDisplay, parseDecimal, UnitSystem, weightLabel } from '@/lib/units';
import { WorkoutExerciseEntry, WorkoutSet } from '@/types/workouts';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DEFAULT_REST_SECONDS = 90;

export default function ActiveWorkoutScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { units } = useSettings();
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);

  const { data, reload } = useFocusQuery(async (database) => {
    const workout = await getActiveWorkout(database);
    if (!workout) {
      return { workout: null, entries: [], previous: new Map<string, WorkoutSet[]>() };
    }
    const entries = await getWorkoutEntries(database, workout.id);
    const previous = new Map<string, WorkoutSet[]>();
    for (const entry of entries) {
      previous.set(entry.id, await getPreviousSets(database, entry.exercise_id, workout.id));
    }
    return { workout, entries, previous };
  });

  const workout = data?.workout;
  const entries = data?.entries ?? [];

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      console.error('Workout update failed:', error);
      Alert.alert('That change did not save', error instanceof Error ? error.message : 'Unknown error');
    }
    await reload();
  };

  const handleSetCompleted = (completed: boolean) => {
    if (completed) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestEndsAt(Date.now() + DEFAULT_REST_SECONDS * 1000);
    }
  };

  const handleFinish = () => {
    if (!workout) {
      return;
    }
    const allSets = entries.flatMap((entry) => entry.sets);
    const done = allSets.filter((set) => set.completed === 1).length;
    const unfinished = allSets.length - done;

    if (done === 0) {
      Alert.alert('No sets ticked off', 'Tick off the sets you did before finishing, or discard this workout.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard workout', style: 'destructive', onPress: handleDiscardConfirmed },
      ]);
      return;
    }

    const finish = async () => {
      setFinishing(true);
      try {
        await finishWorkout(db, workout.id, workout.name);
        router.replace({ pathname: '/workout/[id]', params: { id: workout.id } });
      } catch (error) {
        console.error('Failed to finish workout:', error);
        Alert.alert('Could not finish the workout', error instanceof Error ? error.message : 'Unknown error');
        setFinishing(false);
      }
    };

    if (unfinished > 0) {
      Alert.alert(
        'Finish workout?',
        `${unfinished} ${unfinished === 1 ? 'set isn’t' : 'sets aren’t'} ticked off and will be removed.`,
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'Finish', onPress: finish },
        ]
      );
      return;
    }
    void finish();
  };

  const handleDiscardConfirmed = async () => {
    if (!workout) {
      return;
    }
    await deleteWorkout(db, workout.id);
    router.back();
  };

  const handleDiscard = () => {
    Alert.alert('Discard this workout?', 'Everything logged in it will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: handleDiscardConfirmed },
    ]);
  };

  if (data && !workout) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
        <View style={styles.topBar}>
          <IconButton icon={Icons.close} label="Close" onPress={() => router.back()} />
        </View>
        <EmptyState
          title="No workout in progress"
          body="Start one and add exercises as you go."
          action={
            <Button
              label="Start workout"
              icon={Icons.play}
              onPress={() => run(() => startWorkout(db))}
            />
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
      <View style={styles.topBar}>
        <IconButton icon={Icons.chevronLeft} label="Minimise workout" onPress={() => router.back()} />
        {workout && <Elapsed since={workout.started_at} />}
        <Button label="Finish" onPress={handleFinish} loading={finishing} style={styles.finishButton} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {workout && (
            <TextInput
              key={workout.id}
              defaultValue={workout.name ?? ''}
              placeholder={workoutTitle({ name: null, started_at: workout.started_at })}
              placeholderTextColor={theme.textSecondary}
              onEndEditing={(event) => run(() => renameWorkout(db, workout.id, event.nativeEvent.text.trim() || null))}
              style={[styles.nameInput, { color: theme.text }]}
              accessibilityLabel="Workout name"
            />
          )}

          {entries.length === 0 && (
            <AppText color="textSecondary">Add your first exercise to start logging sets.</AppText>
          )}

          {entries.map((entry) => (
            <ExerciseBlock
              key={entry.id}
              entry={entry}
              previous={data?.previous.get(entry.id) ?? []}
              units={units}
              onChange={reload}
              onSetCompleted={handleSetCompleted}
              onRemove={() =>
                Alert.alert(`Remove ${entry.name}?`, 'Its sets in this workout will be deleted.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => run(() => removeExerciseFromWorkout(db, entry.id)) },
                ])
              }
            />
          ))}

          {workout && (
            <Button
              kind="secondary"
              label="Add exercise"
              icon={Icons.add}
              onPress={() => router.push({ pathname: '/workout/add-exercise', params: { workoutId: workout.id } })}
            />
          )}

          {workout && (
            <TextInput
              key={`${workout.id}-notes`}
              defaultValue={workout.notes ?? ''}
              placeholder="Notes for this session"
              placeholderTextColor={theme.textSecondary}
              multiline
              onEndEditing={(event) => run(() => updateWorkoutNotes(db, workout.id, event.nativeEvent.text.trim() || null))}
              style={[styles.notes, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          )}

          <Button kind="danger" label="Discard workout" onPress={handleDiscard} />
        </ScrollView>
      </KeyboardAvoidingView>

      {restEndsAt !== null && <RestTimer endsAt={restEndsAt} onChange={setRestEndsAt} />}
    </SafeAreaView>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <AppText style={styles.elapsed} accessibilityLabel="Elapsed time">
      {formatDuration((now - new Date(since).getTime()) / 1000)}
    </AppText>
  );
}

function ExerciseBlock({
  entry,
  previous,
  units,
  onChange,
  onSetCompleted,
  onRemove,
}: {
  entry: WorkoutExerciseEntry,
  previous: WorkoutSet[],
  units: UnitSystem,
  onChange: () => Promise<void>,
  onSetCompleted: (completed: boolean) => void,
  onRemove: () => void,
}) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const cardio = isCardio(entry.category);
  const distanceUnit = units === 'lb' ? 'mi' : 'km';

  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <View style={styles.flex}>
          <AppText variant="heading" style={{ textTransform: 'capitalize' }}>{entry.name}</AppText>
          <AppText variant="caption" color="textSecondary" style={{ textTransform: 'capitalize' }}>
            {entry.target}, {entry.equipment}
          </AppText>
        </View>
        <IconButton icon={Icons.more} label={`Options for ${entry.name}`} color={theme.textSecondary} onPress={onRemove} />
      </View>

      <View style={styles.setHeader}>
        <AppText variant="caption" color="textSecondary" style={styles.colSet}>Set</AppText>
        <AppText variant="caption" color="textSecondary" style={styles.colPrevious}>Last time</AppText>
        <AppText variant="caption" color="textSecondary" style={styles.colInput}>{cardio ? 'Min' : weightLabel(units)}</AppText>
        <AppText variant="caption" color="textSecondary" style={styles.colInput}>{cardio ? distanceUnit : 'Reps'}</AppText>
        <View style={styles.colCheck} />
      </View>

      {entry.sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          previous={previous.find((p) => p.set_number === set.set_number)}
          cardio={cardio}
          units={units}
          onSaved={onChange}
          onCompleted={onSetCompleted}
          onDelete={async () => {
            await deleteSet(db, set);
            await onChange();
          }}
        />
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          await addSet(db, entry.id);
          await onChange();
        }}
        style={({ pressed }) => [styles.addSet, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]}>
        <Icon name={Icons.add} size={14} color={theme.textSecondary} />
        <AppText variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>Add set</AppText>
      </Pressable>
      <Divider />
    </View>
  );
}

// Inputs keep their own text while typing and write to the database when editing ends or
// the set is ticked, so the keyboard never fights a re-render.
function SetRow({
  set,
  previous,
  cardio,
  units,
  onSaved,
  onCompleted,
  onDelete,
}: {
  set: WorkoutSet,
  previous: WorkoutSet | undefined,
  cardio: boolean,
  units: UnitSystem,
  onSaved: () => Promise<void>,
  onCompleted: (completed: boolean) => void,
  onDelete: () => void,
}) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const kmPerUnit = units === 'lb' ? 1.609344 : 1;

  const initialFirst = cardio
    ? set.duration_seconds !== null ? formatNumber(set.duration_seconds / 60) : ''
    : set.weight !== null ? formatNumber(kgToDisplay(set.weight, units), 2) : '';
  const initialSecond = cardio
    ? set.distance_meters !== null ? formatNumber(set.distance_meters / 1000 / kmPerUnit, 2) : ''
    : set.reps !== null ? String(set.reps) : '';

  const [first, setFirst] = useState(initialFirst);
  const [second, setSecond] = useState(initialSecond);
  const completed = set.completed === 1;

  const fields = (firstText = first, secondText = second) => {
    const a = parseDecimal(firstText);
    const b = parseDecimal(secondText);
    if (cardio) {
      return {
        duration_seconds: a === null ? null : Math.round(a * 60),
        distance_meters: b === null ? null : b * kmPerUnit * 1000,
      };
    }
    return {
      weight: a === null ? null : displayToKg(a, units),
      reps: b === null ? null : Math.round(b),
    };
  };

  const save = async (extra: { completed?: number } = {}) => {
    await updateSet(db, set.id, { ...fields(), ...extra });
    await onSaved();
  };

  // write every keystroke (no reload) so "Add set" always copies what's on screen
  const persist = (firstText: string, secondText: string) => {
    updateSet(db, set.id, fields(firstText, secondText)).catch((error) => console.error('Failed to save set:', error));
  };

  const toggleCompleted = async () => {
    const next = !completed;
    // ticking a blank set fills it from last time, which is what you usually repeated
    if (next && first === '' && second === '' && previous) {
      setFirst(cardio
        ? previous.duration_seconds !== null ? formatNumber(previous.duration_seconds / 60) : ''
        : previous.weight !== null ? formatNumber(kgToDisplay(previous.weight, units), 2) : '');
      setSecond(cardio
        ? previous.distance_meters !== null ? formatNumber(previous.distance_meters / 1000 / kmPerUnit, 2) : ''
        : previous.reps !== null ? String(previous.reps) : '');
      await updateSet(db, set.id, {
        weight: previous.weight,
        reps: previous.reps,
        duration_seconds: previous.duration_seconds,
        distance_meters: previous.distance_meters,
        completed: 1,
      });
      await onSaved();
    } else {
      await save({ completed: next ? 1 : 0 });
    }
    onCompleted(next);
  };

  const previousLabel = !previous
    ? '–'
    : cardio
      ? `${previous.duration_seconds !== null ? formatNumber(previous.duration_seconds / 60) : '–'} min`
      : `${previous.weight !== null ? formatNumber(kgToDisplay(previous.weight, units)) : '–'} × ${previous.reps ?? '–'}`;

  const inputStyle = [
    styles.setInput,
    { color: theme.text, backgroundColor: completed ? 'transparent' : theme.backgroundElement },
  ];

  return (
    <View style={[styles.setRow, completed && { backgroundColor: `${Plate.green}26` }]}>
      <Pressable
        onLongPress={() =>
          Alert.alert(`Delete set ${set.set_number}?`, undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ])
        }
        accessibilityHint="Long press to delete this set"
        style={styles.colSet}>
        <AppText style={styles.setNumber}>{set.set_number}</AppText>
      </Pressable>
      <AppText variant="caption" color="textSecondary" style={styles.colPrevious} numberOfLines={1}>
        {previousLabel}
      </AppText>
      <TextInput
        value={first}
        onChangeText={(text) => {
          setFirst(text);
          persist(text, second);
        }}
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder={previous && !cardio && previous.weight !== null ? formatNumber(kgToDisplay(previous.weight, units)) : ''}
        placeholderTextColor={theme.textSecondary}
        style={[inputStyle, styles.colInput]}
        accessibilityLabel={cardio ? `Set ${set.set_number} minutes` : `Set ${set.set_number} weight`}
      />
      <TextInput
        value={second}
        onChangeText={(text) => {
          setSecond(text);
          persist(first, text);
        }}
        keyboardType={cardio ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
        placeholder={previous && !cardio && previous.reps !== null ? String(previous.reps) : ''}
        placeholderTextColor={theme.textSecondary}
        style={[inputStyle, styles.colInput]}
        accessibilityLabel={cardio ? `Set ${set.set_number} distance` : `Set ${set.set_number} reps`}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={`Mark set ${set.set_number} done`}
        onPress={toggleCompleted}
        hitSlop={6}
        style={[styles.colCheck, styles.check, { backgroundColor: completed ? Plate.green : theme.backgroundSelected }]}>
        <Icon name={Icons.check} size={16} color={completed ? '#FFFFFF' : theme.textSecondary} />
      </Pressable>
    </View>
  );
}

function RestTimer({ endsAt, onChange }: { endsAt: number, onChange: (endsAt: number | null) => void }) {
  const theme = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining === 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onChange(null);
    }
  }, [remaining, onChange]);

  return (
    <View style={[styles.rest, { backgroundColor: theme.backgroundSelected }]}>
      <Icon name={Icons.timer} size={18} color={theme.textSecondary} />
      <AppText style={styles.restClock}>{formatDuration(remaining)}</AppText>
      <View style={styles.flex} />
      <Button kind="quiet" label="−15s" onPress={() => onChange(endsAt - 15000)} style={styles.restButton} />
      <Button kind="quiet" label="+15s" onPress={() => onChange(endsAt + 15000)} style={styles.restButton} />
      <Button kind="secondary" label="Skip" onPress={() => onChange(null)} style={styles.restButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  elapsed: {
    fontFamily: Display.semibold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  finishButton: {
    minHeight: 38,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: 120,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  nameInput: {
    fontFamily: Display.bold,
    fontSize: 32,
    paddingVertical: Spacing.one,
  },
  block: {
    gap: Spacing.two,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.small,
  },
  colSet: {
    width: 30,
    alignItems: 'center',
    textAlign: 'center',
  },
  colPrevious: {
    flex: 1,
  },
  colInput: {
    width: 72,
    textAlign: 'center',
  },
  colCheck: {
    width: 40,
  },
  setNumber: {
    fontFamily: Display.semibold,
    fontSize: 20,
  },
  setInput: {
    height: 40,
    borderRadius: Radius.small,
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  check: {
    height: 40,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: 10,
    borderRadius: Radius.small,
    marginBottom: Spacing.two,
  },
  notes: {
    minHeight: 80,
    borderRadius: Radius.small,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  rest: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
  },
  restClock: {
    fontFamily: Display.semibold,
    fontSize: 26,
    fontVariant: ['tabular-nums'],
  },
  restButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.two + 4,
  },
});
