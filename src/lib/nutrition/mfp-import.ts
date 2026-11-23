// MyFitnessPal has no public API for new developers, but its "Export data" feature emails a
// zip of CSVs. We read two of them:
//   Nutrition-Summary-*.csv   one row per meal: Date, Meal, Calories, Fat (g), Carbohydrates (g), Protein (g), ...
//   Measurement-Summary-*.csv one row per weigh-in: Date, Weight
import { upsertDailyWeight } from '@/database/bodyQueries';
import { upsertNutritionDay } from '@/database/healthQueries';
import { displayToKg, UnitSystem } from '@/lib/units';
import type { SQLiteDatabase } from 'expo-sqlite';

export type ImportResult =
    | { kind: 'nutrition', days: number, first: string, last: string }
    | { kind: 'weight', days: number, first: string, last: string };

export class ImportError extends Error {}

export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                quoted = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') {
                i++;
            }
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Accepts 2026-10-28 and 10/28/2026.
function normalizeDate(value: string): string | null {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
    }
    const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) {
        return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
    }
    return null;
}

function toNumber(value: string | undefined) {
    if (value === undefined) {
        return 0;
    }
    const number = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(number) ? number : 0;
}

export async function importMyFitnessPalCsv(
    db: SQLiteDatabase,
    text: string,
    units: UnitSystem,
): Promise<ImportResult> {
    const rows = parseCsv(text.replace(/^﻿/, ''));
    if (rows.length < 2) {
        throw new ImportError('That file is empty.');
    }
    const header = rows[0].map((cell) => cell.trim().toLowerCase());
    const column = (match: (name: string) => boolean) => header.findIndex(match);

    const dateCol = column((name) => name === 'date');
    if (dateCol === -1) {
        throw new ImportError('No Date column found. Pick a CSV from the MyFitnessPal export.');
    }

    const caloriesCol = column((name) => name === 'calories');
    const weightCol = column((name) => name === 'weight' || name.startsWith('weight ('));

    if (caloriesCol !== -1) {
        return importNutrition(db, rows.slice(1), {
            date: dateCol,
            calories: caloriesCol,
            protein: column((name) => name.startsWith('protein')),
            carbs: column((name) => name.startsWith('carbohydrates')),
            fat: column((name) => name === 'fat (g)' || name === 'fat'),
        });
    }
    if (weightCol !== -1) {
        return importWeights(db, rows.slice(1), dateCol, weightCol, units);
    }
    throw new ImportError('This file has neither nutrition nor weight data. Use Nutrition-Summary or Measurement-Summary.');
}

async function importNutrition(
    db: SQLiteDatabase,
    rows: string[][],
    cols: { date: number, calories: number, protein: number, carbs: number, fat: number },
): Promise<ImportResult> {
    // rows are per meal; add them up into days
    const days = new Map<string, { calories: number, protein: number, carbs: number, fat: number }>();
    for (const row of rows) {
        const date = normalizeDate(row[cols.date] ?? '');
        if (!date) {
            continue;
        }
        const day = days.get(date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
        day.calories += toNumber(row[cols.calories]);
        day.protein += cols.protein === -1 ? 0 : toNumber(row[cols.protein]);
        day.carbs += cols.carbs === -1 ? 0 : toNumber(row[cols.carbs]);
        day.fat += cols.fat === -1 ? 0 : toNumber(row[cols.fat]);
        days.set(date, day);
    }
    if (days.size === 0) {
        throw new ImportError('No dated rows found in that file.');
    }

    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
        for (const [date, day] of days) {
            await upsertNutritionDay(db, {
                date,
                calories: day.calories,
                protein_g: cols.protein === -1 ? null : day.protein,
                carbs_g: cols.carbs === -1 ? null : day.carbs,
                fat_g: cols.fat === -1 ? null : day.fat,
                source: 'myfitnesspal',
                updated_at: now,
            });
        }
    });
    const dates = [...days.keys()].sort();
    return { kind: 'nutrition', days: dates.length, first: dates[0], last: dates[dates.length - 1] };
}

async function importWeights(
    db: SQLiteDatabase,
    rows: string[][],
    dateCol: number,
    weightCol: number,
    units: UnitSystem,
): Promise<ImportResult> {
    const weights = new Map<string, number>();
    for (const row of rows) {
        const date = normalizeDate(row[dateCol] ?? '');
        const weight = toNumber(row[weightCol]);
        if (date && weight > 0) {
            weights.set(date, weight);
        }
    }
    if (weights.size === 0) {
        throw new ImportError('No weigh-ins found in that file.');
    }
    // MFP exports in whatever unit the account uses; we assume it matches this app's setting
    await db.withTransactionAsync(async () => {
        for (const [date, weight] of weights) {
            await upsertDailyWeight(db, date, displayToKg(weight, units));
        }
    });
    const dates = [...weights.keys()].sort();
    return { kind: 'weight', days: dates.length, first: dates[0], last: dates[dates.length - 1] };
}
