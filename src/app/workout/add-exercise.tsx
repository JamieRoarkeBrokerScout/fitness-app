import { DashboardSurface } from '@/components/ui/dashboard-surface';
import { AppText, Button, Chip, Divider, Icons } from '@/components/ui/primitives';
import { Plate, Radius, Spacing, Layout } from '@/constants/theme';
import { getExerciseCategories, getExercises } from '@/database/exerciseQueries';
import exerciseImages from '@/database/exerciseImages';
import { addExerciseToWorkout, getRecentExercises } from '@/database/workoutQueries';
import { useTheme } from '@/hooks/use-theme';
import { Exercise } from '@/types/exercises';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddExerciseScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recent, setRecent] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // keeps the tap order so exercises land in the workout in the order you picked them
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getExerciseCategories(db).then(setCategories).catch((loadError) => console.error('Failed to load categories:', loadError));
    getRecentExercises(db).then(setRecent).catch((loadError) => console.error('Failed to load recent exercises:', loadError));
  }, [db]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  // loading is derived: results are stale until they match the current search + filter
  const queryKey = `${debouncedSearch}|${category ?? ''}`;
  const loading = loadedKey !== queryKey;

  useEffect(() => {
    let cancelled = false;
    async function loadExercises() {
      try {
        const results = await getExercises(db, debouncedSearch, category);
        if (!cancelled) {
          setExercises(results);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unknown error');
        }
        console.error('Failed to load exercises:', loadError);
      } finally {
        if (!cancelled) {
          setLoadedKey(`${debouncedSearch}|${category ?? ''}`);
        }
      }
    }
    void loadExercises();
    return () => {
      cancelled = true;
    };
  }, [db, debouncedSearch, category]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const leavePicker = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/workout/active');
  };

  const handleAdd = async () => {
    if (!workoutId || selected.length === 0) {
      return;
    }
    setAdding(true);
    try {
      for (const exerciseId of selected) {
        await addExerciseToWorkout(db, workoutId, exerciseId);
      }
      leavePicker();
    } catch (addError) {
      console.error('Failed to add exercise to workout:', addError);
      setError(addError instanceof Error ? addError.message : 'Unknown error');
      setAdding(false);
    }
  };

  const showRecent = debouncedSearch === '' && category === null && recent.length > 0;
  const list = showRecent
    ? [...recent, ...exercises.filter((exercise) => !recent.some((r) => r.id === exercise.id))]
    : exercises;

  return (
    <DashboardSurface><SafeAreaView style={styles.flex}>
      <View style={styles.top}>
        <AppText variant="heading">Add exercise</AppText>
        <TextInput
          placeholder="Search exercises"
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller} contentContainerStyle={styles.chips}>
          <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
          {categories.map((value) => (
            <Chip key={value} label={value} selected={category === value} onPress={() => setCategory(category === value ? null : value)} />
          ))}
        </ScrollView>
      </View>

      {error && <AppText color="danger" style={styles.message}>{error}</AppText>}
      {loading && exercises.length === 0 && <ActivityIndicator style={styles.message} color={theme.textSecondary} />}

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={showRecent ? <AppText variant="caption" color="textSecondary" style={styles.listHeader}>Recently done first</AppText> : undefined}
        ListEmptyComponent={!loading ? <AppText color="textSecondary" style={styles.message}>No exercises match “{debouncedSearch}”.</AppText> : undefined}
        renderItem={({ item }) => {
          const index = selected.indexOf(item.id);
          const isSelected = index !== -1;
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
              {!!item.image && <Image
                source={exerciseImages[item.image.split('/').pop()?.replace(/\.jpg$/i, '') ?? '']}
                contentFit="cover"
                cachePolicy="memory-disk"
                style={[styles.exerciseImage, { backgroundColor: theme.backgroundElement }]}
                accessibilityLabel={`${item.name} exercise demonstration`}
              />}
              <View style={styles.flex}>
                <AppText variant="bodyStrong" style={styles.capitalize}>{item.name}</AppText>
                <AppText variant="caption" color="textSecondary" style={styles.capitalize}>
                  {item.target}, {item.equipment}
                </AppText>
              </View>
              <View
                style={[
                  styles.marker,
                  { borderColor: isSelected ? Plate.green : theme.border, backgroundColor: isSelected ? Plate.green : 'transparent' },
                ]}>
                {isSelected && <AppText variant="caption" style={styles.markerText}>{index + 1}</AppText>}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Button kind="secondary" label="Cancel" disabled={adding} onPress={leavePicker} />
        {selected.length > 0 && (
          <Button
            label={selected.length === 1 ? 'Add 1 exercise' : `Add ${selected.length} exercises`}
            icon={Icons.add}
            loading={adding}
            onPress={handleAdd}
          />
        )}
      </View>
    </SafeAreaView></DashboardSurface>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  top: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    gap: 12,
  },
  search: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  // runs edge to edge so chips scroll off the screen rather than clipping at the gutter
  chipScroller: {
    flexGrow: 0,
    marginHorizontal: -Layout.gutter,
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.one,
  },
  list: {
    backgroundColor: 'rgba(26,29,29,0.92)',
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.three,
  },
  exerciseImage: {
    width: 58,
    height: 58,
    borderRadius: Radius.small,
  },
  listHeader: {
    paddingBottom: Spacing.one,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  message: {
    padding: Spacing.three,
  },
  footer: {
    backgroundColor: '#222624',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
