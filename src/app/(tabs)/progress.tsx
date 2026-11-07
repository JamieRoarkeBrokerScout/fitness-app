import { BarChart, LineChart, recoveryColor } from '@/components/ui/charts';
import { AppText, Divider, IconButton, Icons, Panel, Segmented, Stat } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Plate, Radius, Spacing } from '@/constants/theme';
import { getMeasurements } from '@/database/bodyQueries';
import { getNutritionDays, getWhoopDays } from '@/database/healthQueries';
import { getCompletedSets, getWorkoutSummaries } from '@/database/workoutQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { dateKey, daysIn, formatHoursMinutes, formatPeriod, periodContaining, PeriodKind, shiftPeriod } from '@/lib/dates';
import { estimateOneRepMax, formatNumber, formatVolume, kgToDisplay, weightLabel } from '@/lib/units';
import { WorkoutSummary } from '@/types/workouts';
import { ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

function totalMinutes(workouts: WorkoutSummary[]) {
  return workouts.reduce(
    (total, workout) => total + (workout.ended_at ? (new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) / 60000 : 0),
    0
  );
}

function average(values: (number | null)[]) {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0) / present.length;
}

export default function ProgressScreen() {
  const theme = useTheme();
  const { units } = useSettings();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState(0);

  const period = shiftPeriod(periodContaining(kind, new Date()), offset);
  const previous = shiftPeriod(period, -1);
  const days = daysIn(period);

  const { data } = useFocusQuery(async (database) => {
    const [workouts, previousWorkouts, sets, whoop, nutrition, measurements] = await Promise.all([
      getWorkoutSummaries(database, { from: period.start.toISOString(), to: period.end.toISOString() }),
      getWorkoutSummaries(database, { from: previous.start.toISOString(), to: previous.end.toISOString() }),
      getCompletedSets(database, period.end.toISOString()),
      getWhoopDays(database, dateKey(period.start), dateKey(period.end)),
      getNutritionDays(database, dateKey(period.start), dateKey(period.end)),
      getMeasurements(database, { from: period.start.toISOString(), to: period.end.toISOString() }),
    ]);
    return { workouts, previousWorkouts, sets, whoop, nutrition, measurements };
  }, [kind, offset]);

  const labels = days.map((day) =>
    kind === 'week' ? day.toLocaleDateString(undefined, { weekday: 'narrow' }) : String(day.getDate())
  );
  const keys = days.map(dateKey);
  const periodStartIso = period.start.toISOString();

  const workouts = data?.workouts ?? [];
  const previousWorkouts = data?.previousWorkouts ?? [];
  const volume = workouts.reduce((total, workout) => total + workout.volume_kg, 0);
  const previousVolume = previousWorkouts.reduce((total, workout) => total + workout.volume_kg, 0);

  // daily training volume
  const volumeByDay = new Map<string, number>();
  for (const workout of workouts) {
    const key = dateKey(new Date(workout.started_at));
    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + workout.volume_kg);
  }

  // personal records: best estimated 1RM this period beating everything before it
  const before = new Map<string, number>();
  const during = new Map<string, { name: string, e1rm: number, weight: number, reps: number }>();
  const setsByCategory = new Map<string, number>();
  for (const set of data?.sets ?? []) {
    const inPeriod = set.started_at >= periodStartIso;
    if (inPeriod) {
      setsByCategory.set(set.category, (setsByCategory.get(set.category) ?? 0) + 1);
    }
    if (!set.weight || !set.reps) {
      continue;
    }
    const e1rm = estimateOneRepMax(set.weight, set.reps);
    if (inPeriod) {
      const best = during.get(set.exercise_id);
      if (!best || e1rm > best.e1rm) {
        during.set(set.exercise_id, { name: set.exercise_name, e1rm, weight: set.weight, reps: set.reps });
      }
    } else {
      before.set(set.exercise_id, Math.max(before.get(set.exercise_id) ?? 0, e1rm));
    }
  }
  const records = [...during.entries()]
    .filter(([exerciseId, best]) => before.has(exerciseId) && best.e1rm > before.get(exerciseId)!)
    .map(([, best]) => best)
    .sort((a, b) => b.e1rm - a.e1rm);
  const categories = [...setsByCategory.entries()].sort((a, b) => b[1] - a[1]);
  const maxCategory = categories[0]?.[1] ?? 0;

  const whoopByDay = new Map((data?.whoop ?? []).map((day) => [day.date, day]));
  const recovery = keys.map((key) => whoopByDay.get(key)?.recovery_score ?? null);
  const strain = keys.map((key) => whoopByDay.get(key)?.strain ?? null);
  const sleepHours = keys.map((key) => {
    const ms = whoopByDay.get(key)?.sleep_ms;
    return ms ? ms / 3_600_000 : null;
  });
  const hasWhoop = (data?.whoop.length ?? 0) > 0;

  const nutritionByDay = new Map((data?.nutrition ?? []).map((day) => [day.date, day]));
  const calories = keys.map((key) => nutritionByDay.get(key)?.calories ?? null);
  const protein = keys.map((key) => nutritionByDay.get(key)?.protein_g ?? null);
  const hasNutrition = (data?.nutrition.length ?? 0) > 0;

  // last weigh-in of each day
  const weightByDay = new Map<string, number>();
  for (const measurement of [...(data?.measurements ?? [])].reverse()) {
    if (measurement.weight_kg !== null) {
      weightByDay.set(dateKey(new Date(measurement.measured_at)), kgToDisplay(measurement.weight_kg, units));
    }
  }
  const weights = keys.map((key) => weightByDay.get(key) ?? null);
  const weightValues = weights.filter((value): value is number => value !== null);

  const periodWord = kind === 'week' ? 'week' : 'month';
  const delta = (current: number, past: number, format: (value: number) => string) => {
    const diff = current - past;
    if (diff === 0) {
      return `same as last ${periodWord}`;
    }
    return `${diff > 0 ? '+' : '−'}${format(Math.abs(diff))} vs last ${periodWord}`;
  };

  return (
    <Screen title="Progress">
      <Segmented
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setOffset(0);
        }}
      />
      <View style={styles.periodNav}>
        <IconButton icon={Icons.chevronLeft} label={`Previous ${periodWord}`} onPress={() => setOffset(offset - 1)} />
        <AppText variant="heading">{offset === 0 ? `This ${periodWord}` : formatPeriod(period)}</AppText>
        <IconButton
          icon={Icons.chevronRight}
          label={`Next ${periodWord}`}
          onPress={() => setOffset(offset + 1)}
          disabled={offset >= 0}
          color={offset >= 0 ? theme.backgroundSelected : undefined}
        />
      </View>
      {offset === 0 && <AppText variant="caption" color="textSecondary" style={styles.centered}>{formatPeriod(period)}</AppText>}

      <View style={styles.row}>
        <Stat value={String(workouts.length)} label={delta(workouts.length, previousWorkouts.length, String)} />
        <Stat
          value={formatHoursMinutes(totalMinutes(workouts))}
          label={delta(totalMinutes(workouts), totalMinutes(previousWorkouts), formatHoursMinutes)}
        />
      </View>
      <View style={styles.row}>
        <Stat
          value={formatVolume(volume, units)}
          unit={weightLabel(units)}
          label={`volume, ${delta(volume, previousVolume, (value) => formatVolume(value, units))}`}
        />
      </View>

      <ChartCard title="Training volume" detail={weightLabel(units)}>
        <BarChart
          values={keys.map((key) => (volumeByDay.has(key) ? kgToDisplay(volumeByDay.get(key)!, units) : null))}
          labels={labels}
          color={theme.text}
          format={(value) => Math.round(value).toLocaleString()}
        />
      </ChartCard>

      {categories.length > 0 && (
        <ChartCard title="Sets by body area">
          <View style={styles.categories}>
            {categories.map(([category, count]) => (
              <View key={category} style={styles.categoryRow}>
                <AppText variant="caption" style={styles.categoryLabel}>{category}</AppText>
                <View style={[styles.categoryTrack, { backgroundColor: theme.backgroundSelected }]}>
                  <View style={[styles.categoryBar, { backgroundColor: theme.text, width: `${(count / maxCategory) * 100}%` }]} />
                </View>
                <AppText variant="caption" color="textSecondary" style={styles.categoryCount}>{count}</AppText>
              </View>
            ))}
          </View>
        </ChartCard>
      )}

      {records.length > 0 && (
        <ChartCard title="Personal records" detail="by estimated one-rep max">
          {records.slice(0, 6).map((record, index) => (
            <View key={record.name}>
              {index > 0 && <Divider />}
              <View style={styles.recordRow}>
                <AppText variant="bodyStrong" style={[styles.capitalize, { flex: 1 }]} numberOfLines={1}>{record.name}</AppText>
                <AppText color="textSecondary">
                  {formatNumber(kgToDisplay(record.weight, units))} × {record.reps}
                </AppText>
              </View>
            </View>
          ))}
        </ChartCard>
      )}

      {hasWhoop ? (
        <>
          <ChartCard title="Recovery" detail={summary(average(recovery), (value) => `${Math.round(value)}% average`)}>
            <BarChart
              values={recovery}
              labels={labels}
              color={Plate.green}
              colors={recovery.map((value) => (value === null ? null : recoveryColor(value)))}
              format={(value) => `${Math.round(value)}%`}
            />
          </ChartCard>
          <ChartCard title="Day strain" detail={summary(average(strain), (value) => `${value.toFixed(1)} average`)}>
            <BarChart values={strain} labels={labels} color={Plate.blue} format={(value) => value.toFixed(1)} />
          </ChartCard>
          <ChartCard title="Sleep" detail={summary(average(sleepHours), (value) => `${formatHoursMinutes(value * 60)} average`)}>
            <BarChart values={sleepHours} labels={labels} color={Plate.violet} format={(value) => `${formatNumber(value)}h`} />
          </ChartCard>
        </>
      ) : (
        <AppText variant="caption" color="textSecondary">Connect WHOOP in Settings to see recovery, strain and sleep here.</AppText>
      )}

      {weightValues.length > 0 && (
        <ChartCard
          title="Bodyweight"
          detail={
            weightValues.length > 1
              ? `${weightValues[weightValues.length - 1] - weightValues[0] >= 0 ? '+' : '−'}${formatNumber(Math.abs(weightValues[weightValues.length - 1] - weightValues[0]))} ${weightLabel(units)} over the ${periodWord}`
              : `${formatNumber(weightValues[0])} ${weightLabel(units)}`
          }>
          <LineChart values={weights} labels={labels} color={theme.text} format={(value) => formatNumber(value)} />
        </ChartCard>
      )}

      {hasNutrition && (
        <ChartCard
          title="Calories"
          detail={[
            summary(average(calories), (value) => `${Math.round(value).toLocaleString()} kcal`),
            summary(average(protein), (value) => `${Math.round(value)} g protein a day`),
          ].filter(Boolean).join(', ')}>
          <BarChart values={calories} labels={labels} color={Plate.yellow} format={(value) => Math.round(value).toLocaleString()} />
        </ChartCard>
      )}
    </Screen>
  );
}

function summary(value: number | null, format: (value: number) => string) {
  return value === null ? '' : format(value);
}

function ChartCard({ title, detail, children }: { title: string, detail?: string, children: ReactNode }) {
  return (
    <Panel style={styles.card}>
      <View style={styles.cardHeader}>
        <AppText variant="heading">{title}</AppText>
        {detail ? <AppText variant="caption" color="textSecondary">{detail}</AppText> : null}
      </View>
      {children}
    </Panel>
  );
}

const styles = StyleSheet.create({
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -Spacing.one,
  },
  centered: {
    textAlign: 'center',
    marginTop: -Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.three,
  },
  cardHeader: {
    gap: 2,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  categories: {
    gap: Spacing.two,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryLabel: {
    width: 84,
    textTransform: 'capitalize',
  },
  categoryTrack: {
    flex: 1,
    height: 8,
    borderRadius: Radius.small,
    overflow: 'hidden',
  },
  categoryBar: {
    height: 8,
    borderRadius: Radius.small,
  },
  categoryCount: {
    width: 28,
    textAlign: 'right',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
