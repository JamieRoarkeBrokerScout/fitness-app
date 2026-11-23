// Weights are stored in kg and lengths in cm; these convert for display and input.

export type UnitSystem = 'lb' | 'kg';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToDisplay(kg: number, units: UnitSystem): number {
    return units === 'lb' ? kg / KG_PER_LB : kg;
}

export function displayToKg(value: number, units: UnitSystem): number {
    return units === 'lb' ? value * KG_PER_LB : value;
}

export function cmToDisplay(cm: number, units: UnitSystem): number {
    return units === 'lb' ? cm / CM_PER_IN : cm;
}

export function displayToCm(value: number, units: UnitSystem): number {
    return units === 'lb' ? value * CM_PER_IN : value;
}

export function weightLabel(units: UnitSystem): string {
    return units === 'lb' ? 'lb' : 'kg';
}

export function lengthLabel(units: UnitSystem): string {
    return units === 'lb' ? 'in' : 'cm';
}

// Trim trailing zeros: 135 -> "135", 62.5 -> "62.5".
export function formatNumber(value: number, maxDecimals = 1): string {
    const factor = 10 ** maxDecimals;
    return String(Math.round(value * factor) / factor);
}

export function formatWeight(kg: number, units: UnitSystem): string {
    return formatNumber(kgToDisplay(kg, units));
}

// Large volume totals read better without decimals and with separators.
export function formatVolume(kg: number, units: UnitSystem): string {
    return Math.round(kgToDisplay(kg, units)).toLocaleString();
}

// Parses user input like "62,5" or " 135 " and returns null for empty/invalid input.
export function parseDecimal(text: string): number | null {
    const cleaned = text.trim().replace(',', '.');
    if (cleaned === '') {
        return null;
    }
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : null;
}

// Epley estimate, used to compare lifts across rep ranges.
export function estimateOneRepMax(weightKg: number, reps: number): number {
    if (reps <= 1) {
        return weightKg;
    }
    return weightKg * (1 + reps / 30);
}
