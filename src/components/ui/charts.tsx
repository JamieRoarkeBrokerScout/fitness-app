import { Display, Plate } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { AppText } from './primitives';

// WHOOP's own recovery bands.
export function recoveryColor(score: number) {
    if (score >= 67) {
        return Plate.green;
    }
    if (score >= 34) {
        return Plate.yellow;
    }
    return Plate.red;
}

function useWidth() {
    const [width, setWidth] = useState(0);
    const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
    return { width, onLayout };
}

// Show at most ~8 axis labels so a month of days stays readable.
function labelStep(count: number) {
    return Math.max(1, Math.ceil(count / 8));
}

export function BarChart({
    values,
    labels,
    color,
    colors,
    height = 120,
    format = (value) => String(Math.round(value)),
}: {
    values: (number | null)[],
    labels: string[],
    color: string,
    colors?: (string | null)[],
    height?: number,
    format?: (value: number) => string,
}) {
    const theme = useTheme();
    const { width, onLayout } = useWidth();
    const max = Math.max(0, ...values.map((value) => value ?? 0));
    const chartHeight = height - 18;
    const slot = values.length > 0 ? width / values.length : 0;
    const barWidth = Math.max(2, Math.min(28, slot * 0.62));
    const step = labelStep(values.length);

    return (
        <View onLayout={onLayout} style={{ height }}>
            {width > 0 && (
                <Svg width={width} height={height}>
                    <Line x1={0} x2={width} y1={chartHeight} y2={chartHeight} stroke={theme.border} strokeWidth={1} />
                    {values.map((value, index) => {
                        const x = index * slot + (slot - barWidth) / 2;
                        if (value === null || max === 0) {
                            return null;
                        }
                        const barHeight = Math.max(2, (value / max) * (chartHeight - 14));
                        return (
                            <Rect
                                key={index}
                                x={x}
                                y={chartHeight - barHeight}
                                width={barWidth}
                                height={barHeight}
                                rx={Math.min(4, barWidth / 2)}
                                fill={colors?.[index] ?? color}
                            />
                        );
                    })}
                    {max > 0 && (
                        <SvgText x={width} y={10} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                            {format(max)}
                        </SvgText>
                    )}
                    {labels.map((label, index) =>
                        index % step === 0 ? (
                            <SvgText
                                key={index}
                                x={index * slot + slot / 2}
                                y={height - 2}
                                fontSize={11}
                                fill={theme.textSecondary}
                                textAnchor="middle">
                                {label}
                            </SvgText>
                        ) : null
                    )}
                </Svg>
            )}
        </View>
    );
}

// Connects the points that have values; gaps (null) are bridged so sparse data like weekly
// weigh-ins still reads as a trend.
export function LineChart({
    values,
    labels,
    color,
    height = 120,
    format = (value) => String(Math.round(value)),
}: {
    values: (number | null)[],
    labels: string[],
    color: string,
    height?: number,
    format?: (value: number) => string,
}) {
    const theme = useTheme();
    const { width, onLayout } = useWidth();
    const present = values.filter((value): value is number => value !== null);
    const chartHeight = height - 18;
    const step = labelStep(values.length);

    if (present.length === 0) {
        return <View style={{ height }} onLayout={onLayout} />;
    }

    const min = Math.min(...present);
    const max = Math.max(...present);
    const range = max - min || 1;
    const slot = values.length > 0 ? width / values.length : 0;
    const x = (index: number) => index * slot + slot / 2;
    const y = (value: number) => 12 + (1 - (value - min) / range) * (chartHeight - 24);

    const points = values
        .map((value, index) => (value === null ? null : { x: x(index), y: y(value) }))
        .filter((point): point is { x: number, y: number } => point !== null);
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');

    return (
        <View onLayout={onLayout} style={{ height }}>
            {width > 0 && (
                <Svg width={width} height={height}>
                    <Line x1={0} x2={width} y1={chartHeight} y2={chartHeight} stroke={theme.border} strokeWidth={1} />
                    <Path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    {points.map((point, index) => (
                        <Circle key={index} cx={point.x} cy={point.y} r={points.length > 20 ? 2 : 3.5} fill={color} />
                    ))}
                    <SvgText x={width} y={10} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                        {format(max)}
                    </SvgText>
                    {max !== min && (
                        <SvgText x={width} y={chartHeight - 4} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                            {format(min)}
                        </SvgText>
                    )}
                    {labels.map((label, index) =>
                        index % step === 0 ? (
                            <SvgText
                                key={index}
                                x={x(index)}
                                y={height - 2}
                                fontSize={11}
                                fill={theme.textSecondary}
                                textAnchor="middle">
                                {label}
                            </SvgText>
                        ) : null
                    )}
                </Svg>
            )}
        </View>
    );
}

// The recovery score drawn as a bumper plate: a thick disc, the score as a coloured arc
// round the rim, and the collar hole in the middle.
export function RecoveryPlate({ score, size = 176 }: { score: number | null, size?: number }) {
    const theme = useTheme();
    const stroke = size * 0.11;
    const radius = size / 2 - stroke / 2 - 4;
    const circumference = 2 * Math.PI * radius;
    const progress = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
    const color = score === null ? theme.textSecondary : recoveryColor(score);
    const center = size / 2;

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                <Circle cx={center} cy={center} r={size / 2} fill={theme.backgroundElement} />
                <Circle cx={center} cy={center} r={radius} stroke={theme.backgroundSelected} strokeWidth={stroke} fill="none" />
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={`${circumference * progress} ${circumference}`}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(-90 ${center} ${center})`}
                />
                <Circle cx={center} cy={center} r={size * 0.075} fill={theme.background} />
            </Svg>
            {/* number sits above the collar hole, its label below */}
            <View style={[styles.plateLabel, { top: size * 0.17, height: size * 0.25 }]}>
                <AppText style={{ fontFamily: Display.bold, fontSize: size * 0.24, lineHeight: size * 0.25, color }}>
                    {score === null ? '–' : `${Math.round(score)}%`}
                </AppText>
            </View>
            <View style={[styles.plateLabel, { top: size * 0.62 }]}>
                <AppText variant="caption" color="textSecondary">Recovery</AppText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    plateLabel: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
