import {
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getWorkout,
  getWorkoutEntries,
  startWorkout,
} from '@/database/workoutQueries';
import { Choice, choose } from '@/lib/choose';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';

function countSets(count: number) {
  return `${count} ${count === 1 ? 'set' : 'sets'}`;
}

// Starting, ending and replacing a workout, shared by every screen that offers them. Each
// action re-reads the database so it can't act on what a screen loaded a while ago.
export function useWorkoutActions({
  insideActiveScreen = false,
  onChanged,
}: { insideActiveScreen?: boolean, onChanged?: () => Promise<unknown> } = {}) {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const perform = async (action: () => Promise<void>) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      console.error('Workout action failed:', actionError);
      setError(actionError instanceof Error ? actionError.message : 'Unknown error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // Read at save time, because a name edited just before ending saves as the keyboard closes.
  const save = async (workoutId: string) => {
    const workout = await getWorkout(db, workoutId);
    await finishWorkout(db, workoutId, workout?.name ?? null);
  };

  const confirmDiscard = (onConfirmed: () => void) => {
    choose('Discard this workout?', 'Everything logged in it will be deleted.', [
      { label: 'Keep it', style: 'cancel' },
      { label: 'Discard', style: 'destructive', onSelect: onConfirmed },
    ]);
  };

  const readProgress = async () => {
    const workout = await getActiveWorkout(db);
    if (!workout) {
      return null;
    }
    const sets = (await getWorkoutEntries(db, workout.id)).flatMap((entry) => entry.sets);
    const done = sets.filter((set) => set.completed === 1).length;
    return { workout, done, unticked: sets.length - done };
  };

  // Opens the workout in progress if there is one, so there is never more than one running.
  const start = (options: { replace?: boolean } = {}) =>
    perform(async () => {
      if (!(await getActiveWorkout(db))) {
        await startWorkout(db);
      }
      if (options.replace) {
        router.replace('/workout/active');
      } else {
        router.push('/workout/active');
      }
    });

  const end = () =>
    perform(async () => {
      Keyboard.dismiss();
      const progress = await readProgress();
      if (!progress) {
        await onChanged?.();
        return;
      }
      const { workout, done, unticked } = progress;

      const discard = () =>
        confirmDiscard(() =>
          void perform(async () => {
            await deleteWorkout(db, workout.id);
            if (insideActiveScreen) {
              router.back();
            } else {
              await onChanged?.();
            }
          })
        );

      if (done === 0) {
        choose('Nothing to save yet', 'No sets are ticked off, so ending now would discard this workout.', [
          { label: 'Discard workout', style: 'destructive', onSelect: discard },
          { label: 'Keep going', style: 'cancel' },
        ]);
        return;
      }

      const saveAndOpen = () =>
        void perform(async () => {
          await save(workout.id);
          const destination = { pathname: '/workout/[id]', params: { id: workout.id, finished: '1' } } as const;
          if (insideActiveScreen) {
            router.replace(destination);
          } else {
            router.push(destination);
          }
        });

      const removed = unticked > 0 ? ` ${countSets(unticked)} not ticked off will be removed.` : '';
      choose('End this workout?', `${countSets(done)} will be saved.${removed}`, [
        { label: 'Save workout', onSelect: saveAndOpen },
        { label: 'Discard workout', style: 'destructive', onSelect: discard },
        { label: 'Keep going', style: 'cancel' },
      ]);
    });

  // Replaces the workout in progress with a new one, after deciding what happens to it.
  const startNew = () =>
    perform(async () => {
      const progress = await readProgress();
      const open = async () => {
        await startWorkout(db);
        await onChanged?.();
        router.push('/workout/active');
      };
      if (!progress) {
        await open();
        return;
      }
      const { workout, done } = progress;

      const discardAndStart = () =>
        confirmDiscard(() =>
          void perform(async () => {
            await deleteWorkout(db, workout.id);
            await open();
          })
        );

      const choices: Choice[] = [
        { label: 'Discard it and start new', style: 'destructive', onSelect: discardAndStart },
        { label: 'Keep going', style: 'cancel' },
      ];
      if (done > 0) {
        choices.unshift({
          label: 'Save it and start new',
          onSelect: () =>
            void perform(async () => {
              await save(workout.id);
              await open();
            }),
        });
      }
      choose(
        'A workout is in progress',
        done > 0 ? `It has ${countSets(done)} ticked off. What should happen to it?` : 'It has no sets ticked off yet, so it can’t be saved.',
        choices
      );
    });

  return { busy, error, start, end, startNew };
}
