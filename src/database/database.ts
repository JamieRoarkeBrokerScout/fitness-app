
import type { SQLiteDatabase } from 'expo-sqlite';
import { seedExercises } from './seedExercises';

// Each entry upgrades the schema by one version. PRAGMA user_version records how far a
// device has got, so existing installs only run the steps they're missing.
// Never edit a migration that has shipped; add a new one instead.
const migrations: ((db: SQLiteDatabase) => Promise<void>)[] = [
    // 1: original schema
    async (db) => {
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
    },
    // 2: set logging, body tracking, WHOOP + nutrition caches, settings
    async (db) => {
        await db.execAsync(`
        ALTER TABLE workouts ADD COLUMN name TEXT;
        ALTER TABLE workout_exercises ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE workout_sets ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;

        CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workout_id);
        CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise ON workout_exercises(exercise_id);
        CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(workout_exercise_id);
        CREATE INDEX IF NOT EXISTS idx_workouts_started ON workouts(started_at);

        CREATE TABLE IF NOT EXISTS body_measurements (
            id TEXT PRIMARY KEY,
            measured_at TEXT NOT NULL,
            weight_kg REAL,
            body_fat_pct REAL,
            waist_cm REAL,
            chest_cm REAL,
            hips_cm REAL,
            arm_cm REAL,
            thigh_cm REAL,
            neck_cm REAL,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS progress_photos (
            id TEXT PRIMARY KEY,
            taken_at TEXT NOT NULL,
            file_name TEXT NOT NULL,
            pose TEXT NOT NULL,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS whoop_days (
            date TEXT PRIMARY KEY,
            cycle_id INTEGER NOT NULL,
            strain REAL,
            kilojoule REAL,
            average_heart_rate INTEGER,
            max_heart_rate INTEGER,
            recovery_score REAL,
            hrv_ms REAL,
            resting_heart_rate REAL,
            spo2_pct REAL,
            skin_temp_c REAL,
            sleep_performance_pct REAL,
            sleep_efficiency_pct REAL,
            sleep_ms INTEGER,
            respiratory_rate REAL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS whoop_workouts (
            id TEXT PRIMARY KEY,
            start TEXT NOT NULL,
            end TEXT NOT NULL,
            sport_name TEXT,
            strain REAL,
            average_heart_rate INTEGER,
            max_heart_rate INTEGER,
            kilojoule REAL
        );

        CREATE TABLE IF NOT EXISTS nutrition_days (
            date TEXT PRIMARY KEY,
            calories REAL,
            protein_g REAL,
            carbs_g REAL,
            fat_g REAL,
            source TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        `);
    },
];

export async function initializeDatabase(db: SQLiteDatabase) {
    await db.execAsync('PRAGMA journal_mode = WAL;');
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let version = row?.user_version ?? 0;

    while (version < migrations.length) {
        const migrate = migrations[version];
        await db.withTransactionAsync(async () => {
            await migrate(db);
        });
        version += 1;
        // PRAGMA doesn't accept bound parameters; version is our own integer.
        await db.execAsync(`PRAGMA user_version = ${version}`);
    }

    // seed the database with exercises from the JSON file
    await seedExercises(db);
}
