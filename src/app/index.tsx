import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getExercises } from '@/database/exerciseQueries';
import { addExerciseToWorkout, getActiveWorkout, getWorkoutExercises, startWorkout } from '@/database/workoutQueries';
import { Exercise } from '@/types/exercises';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);

  const [workoutExercises, setWorkoutExercises] = useState<Exercise[]>([]);

  const loadWorkoutExercises = async (workoutId: string) => {
    if (!workoutId) {
      setWorkoutError('No active workout');
      return;
    }
    try {
      const exercises = await getWorkoutExercises(db, workoutId);
      setWorkoutExercises(exercises);
    } catch (error) {
      console.error('Failed to get workout exercises:', error);
      setWorkoutError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    async function loadExercises() {
      try {
        const results = await getExercises(db, debouncedSearch);

        if (!cancelled) {
          setExercises(results);
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : 'Unknown error');
        }
        console.error('Failed to load exercises:', error);
      }
      finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadExercises();
    return () => {
      cancelled = true;
    };
  }, [db, debouncedSearch]);

  // Function to handle starting a new workout
  const handleStartWorkout = async () => {
    setWorkoutError(null);
    if (workoutId !== null || isStartingWorkout) {
      return;
    }
    try {
      setIsStartingWorkout(true);
      const workout = await startWorkout(db);
      setWorkoutId(workout);
      await loadWorkoutExercises(workout);
    } catch (error) {
      console.error('Failed to start workout:', error);
      setWorkoutError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsStartingWorkout(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function checkActiveWorkout() {
      try {
        const activeWorkout = await getActiveWorkout(db);
        if (activeWorkout && !cancelled) {
          setWorkoutId(activeWorkout.id);
        }
        const workoutId = activeWorkout?.id;
        await loadWorkoutExercises(workoutId ?? '');
      } catch (error) {
        console.error('Failed to check active workout:', error);
      }
    }
    void checkActiveWorkout();
    return () => {
      cancelled = true;
    };
  }, [db]);



  useEffect(() => {
    const timer = setTimeout(() => {
      // Update debouncedSearch here
      setDebouncedSearch(search);
    }, 700);

    return () => {
      // Clear the previous timer here
      clearTimeout(timer);
    };
  }, [search]);

  const handleAddExerciseToWorkout = async (exerciseId: string) => {
    if (!workoutId) {
      setWorkoutError('No active workout');
      return;
    }
    try {
      await addExerciseToWorkout(db, workoutId, exerciseId);
      await loadWorkoutExercises(workoutId);
    } catch (error) {
      console.error('Failed to add exercise to workout:', error);
      setWorkoutError(error instanceof Error ? error.message : 'Unknown error');
    }
  };


  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.heroSection}>
          <Text style={styles.title}>
            Fitness App
          </Text>
          <Text style={styles.subtitle}>
            Welcome back
          </Text>
          {workoutId == null ? (
            <Text style={styles.subtitle}>
              No workout active
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Workout in progress
            </Text>
          )}

        </View>
        <View style={{ flex: 1, width: '100%' }}>
          {loading && <ActivityIndicator size="large" />}
          {error && <Text style={{ color: 'red' }}>{error}</Text>}
          <TextInput
            placeholder="Search exercises..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          <FlatList
            data={exercises}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Text
                style={styles.subtitle}
                onPress={() => handleAddExerciseToWorkout(item.id)}
              >{item.name}</Text>
            )}
          />
        </View>

        <View>
          {workoutError && <Text style={{ color: 'red' }}>{workoutError}</Text>}
          <Pressable
            style={styles.startworkoutbutton}
            onPress={handleStartWorkout}
            disabled={workoutId !== null || isStartingWorkout}
          >
            <Text style={[styles.code, { color: 'white' }]}>[Start Workout]</Text>
          </Pressable>
        </View>
        <View style={styles.stepContainer}>
          <HintRow
            title="WHOOP"
            hint={<ThemedText type="code">Not connected</ThemedText>}
          />
        </View>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView >
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  searchInput: {
    width: '100%',
    padding: 12,
    backgroundColor: '#333',
    color: 'white',
    borderRadius: 8,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    fontSize: 34,
    textAlign: 'center',
    color: 'white',
  },
  subtitle: {
    fontSize: 24,
    textAlign: 'center',
    color: 'white',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  startworkoutbutton: {
    backgroundColor: 'grey',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
