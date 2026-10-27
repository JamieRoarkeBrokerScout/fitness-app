import { Exercise } from '@/types/exercises';
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

// Function to add an exercise to a specific workout.
export async function addExerciseToWorkout(
    db: SQLiteDatabase,
    workoutId: string,
    exerciseId: string,
) {
    const id: string = Crypto.randomUUID();
    await db.runAsync(
        'INSERT INTO workout_exercises (id, workout_id, exercise_id) VALUES (?, ?, ?)',
        [id, workoutId, exerciseId]
    );
    return id;
}


// Function to get workout exercises
export async function getWorkoutExercises(
    db: SQLiteDatabase,
    workoutId: string,
) {
    const exercises = await db.getAllAsync<Exercise>(
        'SELECT exercises.* FROM workout_exercises JOIN exercises ON workout_exercises.exercise_id = exercises.id  WHERE workout_exercises.workout_id = ?',
        [workoutId]
    );
    return exercises;
}
