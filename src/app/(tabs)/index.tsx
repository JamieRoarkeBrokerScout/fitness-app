import { useDashboardGlass } from '@/components/ui/dashboard-surface';
import { ActiveWorkoutCard } from '@/components/active-workout-card';
import { AppText, IconButton, Icons } from '@/components/ui/primitives';
import { workoutTitle } from '@/components/workout-row';
import { BottomTabInset, Display } from '@/constants/theme';
import { getLatestWhoopDay, getNutritionDays, getRecentWhoopSamples } from '@/database/healthQueries';
import { getActiveWorkout, getWorkoutSummaries } from '@/database/workoutQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { useWorkoutActions } from '@/hooks/use-workout-actions';
import { addDays, dateKey, daysIn, formatHoursMinutes, periodContaining } from '@/lib/dates';
import { formatVolume, weightLabel } from '@/lib/units';
import { GlassView } from 'expo-glass-effect';
import { router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';

const ink = '#F8F5EF',
  muted = '#C4C6C5',
  amber = '#FFC064';


function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText color={muted} variant="caption">
        {label}
      </AppText>
      <AppText color={ink} style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

function Card({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <AppText color={ink} variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {detail && (
          <AppText color={muted} variant="caption">
            {detail}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <AppText color={amber} variant="bodyStrong">
        {label} ›
      </AppText>
    </Pressable>
  );
}

export default function TodayScreen() {
  const pathname = usePathname();
  const { units } = useSettings(),
    actions = useWorkoutActions();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 780 && fontScale < 1.6;
  const [refreshing, setRefreshing] = useState(false);
  const { data, error, reload } = useFocusQuery(async (db) => {
    const now = new Date(),
      week = periodContaining('week', now);
    const [active, workouts, recent, day, samples, nutrition] = await Promise.all([
      getActiveWorkout(db),
      getWorkoutSummaries(db, { from: week.start.toISOString(), to: week.end.toISOString() }),
      getWorkoutSummaries(db, { limit: 3 }),
      getLatestWhoopDay(db),
      getRecentWhoopSamples(db, 48),
      getNutritionDays(db, dateKey(now), dateKey(addDays(now, 1))),
    ]);
    return { active, workouts, recent, day, samples, nutrition: nutrition[0], week };
  });
  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };
  const today = new Date(),
    day = data?.day,
    sample = data?.samples[0];
  const week = data?.week ?? periodContaining('week', today);
  const workouts = data?.workouts ?? [];
  const minutes = workouts.reduce(
    (sum, w) => sum + (w.ended_at ? (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000 : 0),
    0,
  );
  const volume = workouts.reduce((sum, w) => sum + w.volume_kg, 0);
  const counts = daysIn(week).map(
    (d) => workouts.filter((w) => dateKey(new Date(w.started_at)) === dateKey(d)).length,
  );
  const signal = (data?.samples ?? [])
    .filter((s) => sample && sample.timestamp_ms - s.timestamp_ms <= 300000)
    .slice()
    .reverse();
  const low = Math.min(...signal.map((s) => s.heart_rate)),
    high = Math.max(...signal.map((s) => s.heart_rate));
  const points = signal
    .map((s) => {
      const x =
        ((s.timestamp_ms - signal[0].timestamp_ms) /
          Math.max(1, signal[signal.length - 1].timestamp_ms - signal[0].timestamp_ms)) *
        180;
      return x + ',' + (high === low ? 17 : 30 - ((s.heart_rate - low) / (high - low)) * 26);
    })
    .join(' ');
  const glass = useDashboardGlass();
  const settings = (
    <IconButton icon={Icons.settings} label="Settings" color={ink} onPress={() => router.push('/settings')} />
  );
  return (
    <ImageBackground
      source={require('../../../assets/images/training-floor.jpg')}
      resizeMode="cover"
      style={styles.background}
    >
      <View style={styles.shade} />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.fill}>
        {pathname === '/' && <StatusBar style="light" />}
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={ink} />}
          contentContainerStyle={styles.page}
        >
          <View style={styles.header}>
            <View>
              <AppText color={ink} variant="caption">
                {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </AppText>
              <AppText accessibilityRole="header" color={ink} style={styles.title}>
                Today
              </AppText>
            </View>
            {glass ? (
              <GlassView colorScheme="dark" isInteractive style={styles.round}>
                {settings}
              </GlassView>
            ) : (
              <View style={[styles.round, styles.solid]}>{settings}</View>
            )}
          </View>
          <View style={[styles.group, wide && styles.columns]}>
            <View style={[styles.session, wide && styles.column]}>
              {data?.active ? (
                <ActiveWorkoutCard workout={data.active} onChanged={reload} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={actions.busy}
                  onPress={() => actions.start()}
                  style={({ pressed }) => [
                    styles.start,
                    glass && { backgroundColor: 'transparent' },
                    pressed && styles.pressed,
                  ]}
                >
                  {glass && (
                    <GlassView
                      pointerEvents="none"
                      isInteractive
                      colorScheme="light"
                      tintColor={amber}
                      style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                    />
                  )}
                  <AppText color="#20180D" variant="bodyStrong">
                    {actions.busy ? 'Starting…' : 'Start workout'} →
                  </AppText>
                </Pressable>
              )}
              {(error || actions.error) && (
                <AppText color={ink} style={styles.solid}>
                  {error || actions.error}
                </AppText>
              )}
            </View>
            <View style={wide && styles.column}>
              <Card title="WHOOP overview" detail={day?.date}>
                <View style={styles.pulse}>
                  <View style={styles.fill}>
                    <AppText color={muted} variant="caption">
                      Last heart rate
                    </AppText>
                    <AppText color={amber} style={styles.pulseValue}>
                      {sample ? sample.heart_rate : '—'}{' '}
                      <AppText color={muted} variant="caption">
                        bpm
                      </AppText>
                    </AppText>
                  </View>
                  {signal.length > 1 && (
                    <Svg width="45%" height={36} viewBox="0 0 180 36">
                      <Polyline points={points} fill="none" stroke={amber} strokeWidth={2.5} />
                    </Svg>
                  )}
                </View>
                {sample && (
                  <AppText color={muted} variant="caption">
                    {new Date(sample.timestamp_ms).toLocaleString()}
                  </AppText>
                )}
                <View style={styles.tiles}>
                  <Metric
                    label="Recovery"
                    value={day?.recovery_score != null ? Math.round(day.recovery_score) + '%' : '—'}
                  />
                  <Metric label="Strain" value={day?.strain?.toFixed(1) ?? '—'} />
                  <Metric
                    label="Sleep"
                    value={day?.sleep_ms != null ? formatHoursMinutes(day.sleep_ms / 60000) : '—'}
                  />
                </View>
                <Action label="Connect WHOOP" onPress={() => router.push('/settings')} />
              </Card>
            </View>
          </View>
          <View style={[styles.group, wide && styles.columns]}>
            <View style={wide && styles.column}>
              <Card title="Training this week">
                <View style={styles.tiles}>
                  <Metric label="Workouts" value={data ? String(workouts.length) : '—'} />
                  <Metric label="Time" value={data ? formatHoursMinutes(minutes) : '—'} />
                  <Metric
                    label={'Volume · ' + weightLabel(units)}
                    value={data ? formatVolume(volume, units) : '—'}
                  />
                </View>
                <View style={styles.chart}>
                  {daysIn(week).map((d, i) => (
                    <View
                      key={dateKey(d)}
                      accessible
                      accessibilityLabel={d.toLocaleDateString() + ', ' + counts[i] + ' workouts'}
                      style={styles.barCell}
                    >
                      <View
                        style={[
                          styles.bar,
                          {
                            height: counts[i] ? 8 + (32 * counts[i]) / Math.max(...counts, 1) : 2,
                            backgroundColor: counts[i] ? amber : '#676965',
                          },
                        ]}
                      />
                      <AppText color={dateKey(d) === dateKey(today) ? amber : muted} variant="caption">
                        {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                      </AppText>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
            <View style={wide && styles.column}>
              <Card title="Recent workouts">
                {data?.recent.length === 0 && (
                  <AppText color={muted}>Your finished workouts will appear here.</AppText>
                )}
                {data?.recent.map((w) => (
                  <Pressable
                    key={w.id}
                    accessibilityRole="button"
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                  >
                    <View style={styles.fill}>
                      <AppText color={ink} variant="bodyStrong">
                        {workoutTitle(w)}
                      </AppText>
                      <AppText color={muted} variant="caption">
                        {new Date(w.started_at).toLocaleDateString()} · {w.set_count} sets
                      </AppText>
                    </View>
                    <AppText color={amber}>›</AppText>
                  </Pressable>
                ))}
                <Action label="Workout history" onPress={() => router.push('/history')} />
              </Card>
            </View>
          </View>
          {data?.nutrition && (
            <Card title="Nutrition today">
              <View style={styles.tiles}>
                <Metric label="Calories" value={data.nutrition.calories?.toFixed(0) ?? '—'} />
                <Metric label="Protein · g" value={data.nutrition.protein_g?.toFixed(0) ?? '—'} />
                <Metric label="Carbs · g" value={data.nutrition.carbs_g?.toFixed(0) ?? '—'} />
              </View>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}
const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#171A19' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,15,14,.53)' },
  fill: { flex: 1 },
  page: {
    width: '100%',
    maxWidth: 1060,
    alignSelf: 'center',
    padding: 18,
    gap: 14,
    paddingBottom: BottomTabInset + 28,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: Display.bold, fontSize: 48, lineHeight: 52 },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  solid: { backgroundColor: '#282B29' },
  group: { gap: 14 },
  columns: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flex: 1, minWidth: 0 },
  session: { minHeight: 92, justifyContent: 'flex-end', alignItems: 'stretch', gap: 8 },
  start: {
    alignSelf: 'flex-start',
    backgroundColor: amber,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  card: {
    backgroundColor: 'rgba(26,29,29,.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#62645F',
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  pulse: { flexDirection: 'row', alignItems: 'center' },
  pulseValue: { fontFamily: Display.semibold, fontSize: 38, lineHeight: 42 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metric: {
    flexGrow: 1,
    flexBasis: 80,
    minWidth: 0,
    padding: 10,
    backgroundColor: '#353937',
    borderRadius: 12,
    gap: 4,
  },
  value: { fontFamily: Display.semibold, fontSize: 26, lineHeight: 30 },
  chart: { height: 68, flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'center', gap: 5 },
  bar: { width: '40%', maxWidth: 24, borderRadius: 5 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#545852',
  },
});
