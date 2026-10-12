
import type { SQLiteDatabase } from 'expo-sqlite';
import { seedExercises } from './seedExercises';

export async function initializeDatabase(db: SQLiteDatabase) {
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        body_part TEXT NOT NULL,
        equipment TEXT NOT NULL,
        instructions TEXT NOT NULL,
        instruction_steps TEXT NOT NULL,
        muscle_group TEXT NOT NULL,
        secondary_muscles TEXT NOT NULL,
        target TEXT NOT NULL,
        image TEXT NOT NULL,
        gif_url TEXT NOT NULL, 
        media_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attribution TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        status TEXT NOT NULL,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
        id TEXT PRIMARY KEY,
        workout_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        FOREIGN KEY (workout_id) REFERENCES workouts(id),
        FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
        id TEXT PRIMARY KEY,
        workout_exercise_id TEXT NOT NULL,
        set_number INTEGER NOT NULL,
        reps INTEGER,
        weight REAL,
        duration_seconds INTEGER,
        distance_meters REAL,
        FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id)
    );
`);
    // seed the database with exercises from the JSON file
    await seedExercises(db);
}