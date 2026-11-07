import { Display, Spacing } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { formatHoursMinutes } from '@/lib/dates';
import { formatVolume, weightLabel } from '@/lib/units';
import { WorkoutSummary } from '@/types/workouts';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './ui/primitives';

export function workoutTitle(workout: { name: string | null, started_at: string }) {
    if (workout.name) {
        return workout.name;
    }
    const hour = new Date(workout.started_at).getHours();
    if (hour < 11) {
        return 'Morning workout';
    }
    if (hour < 17) {
        return 'Afternoon workout';
    }
    return 'Evening workout';
}

// History row: a date block on the left like a logbook margin, details on the right.
export function WorkoutRow({ workout }: { workout: WorkoutSummary }) {
    const theme = useTheme();
    const { units } = useSettings();
    const started = new Date(workout.started_at);
    const minutes = workout.ended_at ? (new Date(workout.ended_at).getTime() - started.getTime()) / 60000 : 0;

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
            <View style={[styles.date, { borderColor: theme.border }]}>
                <AppText variant="caption" color="textSecondary">
                    {started.toLocaleDateString(undefined, { weekday: 'short' })}
                </AppText>
                <AppText style={{ fontFamily: Display.bold, fontSize: 26, lineHeight: 28 }}>{started.getDate()}</AppText>
            </View>
            <View style={styles.body}>
                <AppText variant="bodyStrong" numberOfLines={1}>{workoutTitle(workout)}</AppText>
                {workout.exercise_names && (
                    <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                        {workout.exercise_names}
                    </AppText>
                )}
                <AppText variant="caption" color="textSecondary">
                    {formatHoursMinutes(minutes)}, {workout.set_count} sets
                    {workout.volume_kg > 0 ? `, ${formatVolume(workout.volume_kg, units)} ${weightLabel(units)}` : ''}
                </AppText>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: Spacing.three,
        paddingVertical: Spacing.two + 2,
        alignItems: 'center',
    },
    date: {
        width: 48,
        alignItems: 'center',
        borderRightWidth: StyleSheet.hairlineWidth,
        paddingRight: Spacing.two,
    },
    body: {
        flex: 1,
        gap: 2,
    },
});
