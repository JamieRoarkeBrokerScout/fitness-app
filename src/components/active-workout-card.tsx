import { AppText, Button, Icons, Panel } from '@/components/ui/primitives';
import { workoutTitle } from '@/components/workout-row';
import { Display, Layout, Spacing } from '@/constants/theme';
import { useWorkoutActions } from '@/hooks/use-workout-actions';
import { formatDuration } from '@/lib/dates';
import { Workouts } from '@/types/workouts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export function ElapsedClock({ since, size = 28 }: { since: string, size?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <AppText accessibilityLabel="Elapsed time" style={{ fontFamily: Display.semibold, fontSize: size, lineHeight: Math.ceil(size * 1.3), fontVariant: ['tabular-nums'] }}>
      {formatDuration((now - new Date(since).getTime()) / 1000)}
    </AppText>
  );
}

// The workout in progress, with every way out of it, wherever the app offers starting one.
export function ActiveWorkoutCard({ workout, onChanged }: { workout: Workouts, onChanged: () => Promise<unknown> }) {
  const { busy, error, end, startNew } = useWorkoutActions({ onChanged });

  return (
    <Panel style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Resume ${workoutTitle(workout)}`}
        onPress={() => router.push('/workout/active')}
        style={styles.summary}>
        <View style={styles.title}>
          <AppText variant="heading" numberOfLines={1}>{workoutTitle(workout)}</AppText>
          <AppText variant="caption" color="textSecondary">In progress</AppText>
        </View>
        <ElapsedClock since={workout.started_at} />
      </Pressable>
      <View style={styles.controls}>
        <View style={styles.actions}>
          <Button label="Resume" icon={Icons.play} onPress={() => router.push('/workout/active')} style={styles.action} />
          <Button kind="secondary" label="End workout" onPress={end} disabled={busy} style={styles.action} />
        </View>
        <Button kind="quiet" label="Start a new workout" icon={Icons.add} onPress={startNew} disabled={busy} style={styles.startNew} />
      </View>
      {error && <AppText variant="caption" color="danger">{error}</AppText>}
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    gap: 2,
  },
  controls: {
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  startNew: {
    minHeight: Layout.touch,
  },
});
