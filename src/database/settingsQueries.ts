import type { SQLiteDatabase } from 'expo-sqlite';

export async function getSetting(
    db: SQLiteDatabase,
    key: string,
) {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? null;
}

export async function setSetting(
    db: SQLiteDatabase,
    key: string,
    value: string | null,
) {
    if (value === null) {
        await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
        return;
    }
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}
