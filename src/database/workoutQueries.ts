import { Workouts } from '@/types/workouts';
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

// Functions to manage workouts in the database.
export async function startWorkout(
    db: SQLiteDatabase,
) {
    const id: string = Crypto.randomUUID();
    const startedAt: string = new Date().toISOString();
    await db.runAsync(
        'INSERT INTO workouts (id, started_at, ended_at, status, notes) VALUES (?, ?, ?, ?, ?)',
        [id, startedAt, null, 'active', null]
    );
    return id;
}

// Function to get the currently active workout from the database.
export async function getActiveWorkout(
    db: SQLiteDatabase,
) {
    const activeWorkout = await db.getFirstAsync<Workouts>(
        'SELECT * FROM workouts WHERE status = ?',
        ['active']
    );
    return activeWorkout;
}

export async function addExerciseToWorkout(
    db: SQLiteDatabase
) {

}

