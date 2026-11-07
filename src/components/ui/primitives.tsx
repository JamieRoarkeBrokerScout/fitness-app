import { Display, Radius, Spacing, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { ReactNode } from 'react';
import {
    ActivityIndicator,
    Pressable,
    type PressableProps,
    StyleSheet,
    Text,
    type TextProps,
    TextInput,
    type TextInputProps,
    View,
    type ViewProps,
} from 'react-native';

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'number';

export function AppText({
    variant = 'body',
    color = 'text',
    style,
    ...rest
}: TextProps & { variant?: TextVariant, color?: ThemeColor | (string & {}) }) {
    const theme = useTheme();
    const resolved = color in theme ? theme[color as ThemeColor] : color;
    return <Text style={[textStyles[variant], { color: resolved }, style]} {...rest} />;
}

const textStyles = StyleSheet.create({
    // condensed face for anything that is a number or a screen title
    display: { fontFamily: Display.bold, fontSize: 56, lineHeight: 58, letterSpacing: -0.5 },
    title: { fontFamily: Display.bold, fontSize: 34, lineHeight: 38 },
    number: { fontFamily: Display.semibold, fontSize: 28, lineHeight: 30, fontVariant: ['tabular-nums'] },
    heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
    body: { fontSize: 15, lineHeight: 21 },
    bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
    caption: { fontSize: 13, lineHeight: 17 },
});

export interface IconName {
    ios: SFSymbol,
    android: AndroidSymbol,
}

export function Icon({ name, size = 20, color }: { name: IconName, size?: number, color?: string }) {
    const theme = useTheme();
    return <SymbolView name={{ ios: name.ios, android: name.android, web: name.android }} size={size} tintColor={color ?? theme.text} />;
}

export function Panel({ style, ...rest }: ViewProps) {
    const theme = useTheme();
    return <View style={[styles.panel, { backgroundColor: theme.backgroundElement }, style]} {...rest} />;
}

export function Divider() {
    const theme = useTheme();
    return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'quiet';

export function Button({
    label,
    kind = 'primary',
    icon,
    loading,
    disabled,
    style,
    ...rest
}: Omit<PressableProps, 'children'> & { label: string, kind?: ButtonKind, icon?: IconName, loading?: boolean }) {
    const theme = useTheme();
    const background = {
        primary: theme.action,
        secondary: theme.backgroundSelected,
        danger: 'transparent',
        quiet: 'transparent',
    }[kind];
    const foreground = {
        primary: theme.actionText,
        secondary: theme.text,
        danger: theme.danger,
        quiet: theme.textSecondary,
    }[kind];

    return (
        <Pressable
            accessibilityRole="button"
            disabled={disabled || loading}
            style={(state) => [
                styles.button,
                { backgroundColor: background, opacity: disabled ? 0.4 : state.pressed ? 0.75 : 1 },
                kind === 'danger' && { borderWidth: 1, borderColor: theme.danger },
                typeof style === 'function' ? style(state) : style,
            ]}
            {...rest}>
            {loading ? (
                <ActivityIndicator color={foreground} />
            ) : (
                <>
                    {icon && <Icon name={icon} size={18} color={foreground} />}
                    <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
                </>
            )}
        </Pressable>
    );
}

export function IconButton({
    icon,
    label,
    color,
    ...rest
}: Omit<PressableProps, 'children'> & { icon: IconName, label: string, color?: string }) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={10}
            style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
            {...rest}>
            <Icon name={icon} size={22} color={color} />
        </Pressable>
    );
}

export function Segmented<T extends string>({
    options,
    value,
    onChange,
}: { options: { value: T, label: string }[], value: T, onChange: (value: T) => void }) {
    const theme = useTheme();
    return (
        <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <Pressable
                        key={option.value}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        onPress={() => onChange(option.value)}
                        style={[styles.segment, selected && { backgroundColor: theme.backgroundSelected }]}>
                        <Text style={[styles.segmentLabel, { color: selected ? theme.text : theme.textSecondary }]}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

export function Chip({ label, selected, onPress }: { label: string, selected: boolean, onPress: () => void }) {
    const theme = useTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={onPress}
            style={[
                styles.chip,
                { borderColor: selected ? theme.text : theme.border, backgroundColor: selected ? theme.text : 'transparent' },
            ]}>
            <Text style={[styles.chipLabel, { color: selected ? theme.background : theme.textSecondary }]}>{label}</Text>
        </Pressable>
    );
}

export function Field({ label, suffix, style, ...rest }: TextInputProps & { label: string, suffix?: string }) {
    const theme = useTheme();
    return (
        <View style={styles.field}>
            <AppText variant="caption" color="textSecondary">{label}</AppText>
            <View style={[styles.fieldBox, { backgroundColor: theme.backgroundElement }]}>
                <TextInput
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.fieldInput, { color: theme.text }, style]}
                    {...rest}
                />
                {suffix && <AppText color="textSecondary">{suffix}</AppText>}
            </View>
        </View>
    );
}

// A label/value pair for stat rows. `tone` colours the value with a data colour.
export function Stat({ value, label, tone, unit }: { value: string, label: string, tone?: string, unit?: string }) {
    return (
        <View style={styles.stat}>
            <View style={styles.statValueRow}>
                <AppText variant="number" color={tone ?? 'text'}>{value}</AppText>
                {unit && <AppText variant="caption" color="textSecondary">{unit}</AppText>}
            </View>
            <AppText variant="caption" color="textSecondary">{label}</AppText>
        </View>
    );
}

export function SectionHeader({ title, action }: { title: string, action?: ReactNode }) {
    return (
        <View style={styles.sectionHeader}>
            <AppText variant="heading">{title}</AppText>
            {action}
        </View>
    );
}

export function EmptyState({ title, body, action }: { title: string, body: string, action?: ReactNode }) {
    return (
        <View style={styles.empty}>
            <AppText variant="bodyStrong">{title}</AppText>
            <AppText color="textSecondary" style={{ textAlign: 'center' }}>{body}</AppText>
            {action}
        </View>
    );
}

export const Icons = {
    add: { ios: 'plus', android: 'add' },
    check: { ios: 'checkmark', android: 'check' },
    close: { ios: 'xmark', android: 'close' },
    settings: { ios: 'gearshape', android: 'settings' },
    chevronLeft: { ios: 'chevron.left', android: 'chevron_left' },
    chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
    trash: { ios: 'trash', android: 'delete' },
    timer: { ios: 'timer', android: 'timer' },
    camera: { ios: 'camera', android: 'photo_camera' },
    photo: { ios: 'photo.on.rectangle', android: 'photo_library' },
    more: { ios: 'ellipsis', android: 'more_horiz' },
    sync: { ios: 'arrow.clockwise', android: 'refresh' },
    play: { ios: 'play.fill', android: 'play_arrow' },
    heart: { ios: 'heart.fill', android: 'favorite' },
    bolt: { ios: 'bolt.fill', android: 'bolt' },
    moon: { ios: 'moon.fill', android: 'bedtime' },
    fork: { ios: 'fork.knife', android: 'restaurant' },
    ruler: { ios: 'ruler', android: 'straighten' },
} satisfies Record<string, IconName>;

const styles = StyleSheet.create({
    panel: {
        borderRadius: Radius.medium,
        padding: Spacing.three,
    },
    button: {
        minHeight: 52,
        borderRadius: Radius.medium,
        paddingHorizontal: Spacing.four,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.two,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    iconButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmented: {
        flexDirection: 'row',
        borderRadius: Radius.small + 2,
        padding: 3,
    },
    segment: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: Radius.small,
        alignItems: 'center',
    },
    segmentLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    chip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    chipLabel: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    field: {
        gap: Spacing.one,
        flex: 1,
    },
    fieldBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: Radius.small,
        paddingHorizontal: 12,
        minHeight: 46,
        gap: Spacing.two,
    },
    fieldInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 10,
    },
    stat: {
        flex: 1,
        gap: 2,
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.two,
    },
    empty: {
        alignItems: 'center',
        gap: Spacing.two,
        paddingVertical: Spacing.five,
        paddingHorizontal: Spacing.four,
    },
});
