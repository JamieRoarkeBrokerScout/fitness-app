// Local-calendar helpers. Dates are keyed as YYYY-MM-DD in the device's timezone,
// timestamps are stored as ISO strings.

export function dateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

// Weeks start on Monday.
export function startOfWeek(date: Date): Date {
    const day = startOfDay(date);
    const offset = (day.getDay() + 6) % 7;
    return addDays(day, -offset);
}

export function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export type PeriodKind = 'week' | 'month';

export interface Period {
    kind: PeriodKind,
    start: Date,
    // exclusive
    end: Date,
}

export function periodContaining(kind: PeriodKind, date: Date): Period {
    if (kind === 'week') {
        const start = startOfWeek(date);
        return { kind, start, end: addDays(start, 7) };
    }
    const start = startOfMonth(date);
    return { kind, start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
}

export function shiftPeriod(period: Period, steps: number): Period {
    if (period.kind === 'week') {
        return periodContaining('week', addDays(period.start, steps * 7));
    }
    return periodContaining('month', new Date(period.start.getFullYear(), period.start.getMonth() + steps, 1));
}

export function daysIn(period: Period): Date[] {
    const days: Date[] = [];
    for (let d = period.start; d < period.end; d = addDays(d, 1)) {
        days.push(d);
    }
    return days;
}

export function formatPeriod(period: Period): string {
    if (period.kind === 'month') {
        return period.start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const last = addDays(period.end, -1);
    const sameMonth = last.getMonth() === period.start.getMonth();
    const first = period.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const second = last.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
    return `${first} – ${second}`;
}

export function formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

// "1h 12m" style, for summaries rather than running clocks.
export function formatHoursMinutes(totalMinutes: number): string {
    const minutes = Math.round(totalMinutes);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) {
        return `${m}m`;
    }
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatShortDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
