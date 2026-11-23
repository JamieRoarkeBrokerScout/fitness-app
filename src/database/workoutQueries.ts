import { Exercise } from '@/types/exercises';
import { WorkoutExerciseEntry, Workouts, WorkoutSet, WorkoutSummary } from '@/types/workouts';
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

export async function getWorkout(
    db: SQLiteDatabase,
    workoutId: string,
) {
    return db.getFirstAsync<Workouts>('SELECT * FROM workouts WHERE id = ?', [workoutId]);
}

// Function to add an exercise to a specific workout.
// The first set is pre-filled from the last time this exercise was done.
export async function addExerciseToWorkout(
    db: SQLiteDatabase,
    workoutId: string,
    exerciseId: string,
) {
    const id: string = Crypto.randomUUID();
    const previous = await getPreviousSets(db, exerciseId, workoutId);
    await db.withTransactionAsync(async () => {
        const last = await db.getFirstAsync<{ position: number | null }>(
            'SELECT MAX(position) AS position FROM workout_exercises WHERE workout_id = ?',
            [workoutId]
        );
        await db.runAsync(
            'INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, ?)',
            [id, workoutId, exerciseId, (last?.position ?? -1) + 1]
        );
        const template = previous[0];
        await db.runAsync(
            `INSERT INTO workout_sets (id, workout_exercise_id, set_number, reps, weight, duration_seconds, distance_meters, completed)
             VALUES (?, ?, 1, ?, ?, ?, ?, 0)`,
            [
                Crypto.randomUUID(),
                id,
                template?.reps ?? null,
                template?.weight ?? null,
                template?.duration_seconds ?? null,
                template?.distance_meters ?? null,
            ]
        );
    });
    return id;
}

export async function removeExerciseFromWorkout(
    db: SQLiteDatabase,
    workoutExerciseId: string,
) {
    await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM workout_sets WHERE workout_exercise_id = ?', [workoutExerciseId]);
        await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', [workoutExerciseId]);
    });
}

// Function to get a workout's exercises, in order, with their sets.
export async function getWorkoutEntries(
    db: SQLiteDatabase,
    workoutId: string,
): Promise<WorkoutExerciseEntry[]> {
    const exercises = await db.getAllAsync<Omit<WorkoutExerciseEntry, 'sets'>>(
        `SELECT workout_exercises.id, workout_exercises.exercise_id, workout_exercises.position,
                exercises.name, exercises.category, exercises.equipment, exercises.target
         FROM workout_exercises
         JOIN exercises ON workout_exercises.exercise_id = exercises.id
         WHERE workout_exercises.workout_id = ?
         ORDER BY workout_exercises.position, workout_exercises.rowid`,
        [workoutId]
    );
    const sets = await db.getAllAsync<WorkoutSet>(
        `SELECT workout_sets.* FROM workout_sets
         JOIN workout_exercises ON workout_sets.workout_exercise_id = workout_exercises.id
         WHERE workout_exercises.workout_id = ?
         ORDER BY workout_sets.set_number`,
        [workoutId]
    );
    return exercises.map((exercise) => ({
        ...exercise,
        sets: sets.filter((set) => set.workout_exercise_id === exercise.id),
    }));
}

// Sets from the most recent finished workout that included this exercise.
export async function getPreviousSets(
    db: SQLiteDatabase,
    exerciseId: string,
    excludeWorkoutId: string,
) {
    return db.getAllAsync<WorkoutSet>(
        `SELECT workout_sets.* FROM workout_sets
         WHERE workout_sets.workout_exercise_id = (
            SELECT workout_exercises.id FROM workout_exercises
            JOIN workouts ON workout_exercises.workout_id = workouts.id
            WHERE workout_exercises.exercise_id = ? AND workouts.id != ? AND workouts.status = 'completed'
            ORDER BY workouts.started_at DESC
            LIMIT 1
         )
         ORDER BY workout_sets.set_number`,
        [exerciseId, excludeWorkoutId]
    );
}

// New set copies the values of the set before it, which is what you usually repeat.
export async function addSet(
    db: SQLiteDatabase,
    workoutExerciseId: string,
) {
    const last = await db.getFirstAsync<WorkoutSet>(
        'SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY set_number DESC LIMIT 1',
        [workoutExerciseId]
    );
    await db.runAsync(
        `INSERT INTO workout_sets (id, workout_exercise_id, set_number, reps, weight, duration_seconds, distance_meters, completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
            Crypto.randomUUID(),
            workoutExerciseId,
            (last?.set_number ?? 0) + 1,
            last?.reps ?? null,
            last?.weight ?? null,
            last?.duration_seconds ?? null,
            last?.distance_meters ?? null,
        ]
    );
}

type SetFields = Partial<Pick<WorkoutSet, 'reps' | 'weight' | 'duration_seconds' | 'distance_meters' | 'completed'>>;

export async function updateSet(
    db: SQLiteDatabase,
    setId: string,
    fields: SetFields,
) {
    const entries = Object.entries(fields);
    if (entries.length === 0) {
        return;
    }
    // column names come from the SetFields keys above, never from user input
    const assignments = entries.map(([column]) => `${column} = ?`).join(', ');
    await db.runAsync(
        `UPDATE workout_sets SET ${assignments} WHERE id = ?`,
        [...entries.map(([, value]) => value ?? null), setId]
    );
}

export async function deleteSet(
    db: SQLiteDatabase,
    set: WorkoutSet,
) {
    await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM workout_sets WHERE id = ?', [set.id]);
        await db.runAsync(
            'UPDATE workout_sets SET set_number = set_number - 1 WHERE workout_exercise_id = ? AND set_number > ?',
            [set.workout_exercise_id, set.set_number]
        );
    });
}

// Unticked sets are dropped, and exercises left with no sets go with them.
export async function finishWorkout(
    db: SQLiteDatabase,
    workoutId: string,
    name: string | null,
) {
    await db.withTransactionAsync(async () => {
        await db.runAsync(
            `DELETE FROM workout_sets WHERE completed = 0 AND workout_exercise_id IN (
                SELECT id FROM workout_exercises WHERE workout_id = ?
            )`,
            [workoutId]
        );
        await db.runAsync(
            `DELETE FROM workout_exercises WHERE workout_id = ? AND id NOT IN (
                SELECT workout_exercise_id FROM workout_sets
            )`,
            [workoutId]
        );
        await db.runAsync(
            "UPDATE workouts SET status = 'completed', ended_at = ?, name = ? WHERE id = ?",
            [new Date().toISOString(), name, workoutId]
        );
    });
}

export async function renameWorkout(
    db: SQLiteDatabase,
    workoutId: string,
    name: string | null,
) {
    await db.runAsync('UPDATE workouts SET name = ? WHERE id = ?', [name, workoutId]);
}

export async function updateWorkoutNotes(
    db: SQLiteDatabase,
    workoutId: string,
    notes: string | null,
) {
    await db.runAsync('UPDATE workouts SET notes = ? WHERE id = ?', [notes, workoutId]);
}

// Used both to discard an active workout and to delete one from history.
export async function deleteWorkout(
    db: SQLiteDatabase,
    workoutId: string,
) {
    await db.withTransactionAsync(async () => {
        await db.runAsync(
            'DELETE FROM workout_sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)',
            [workoutId]
        );
        await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', [workoutId]);
        await db.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);
    });
}

// Completed workouts with totals, newest first. Bounds are ISO timestamps; `to` is exclusive.
export async function getWorkoutSummaries(
    db: SQLiteDatabase,
    options: { from?: string, to?: string, limit?: number } = {},
) {
    return db.getAllAsync<WorkoutSummary>(
        `SELECT workouts.*,
            (SELECT COUNT(*) FROM workout_exercises WHERE workout_id = workouts.id) AS exercise_count,
            (SELECT COUNT(*) FROM workout_sets
                JOIN workout_exercises ON workout_sets.workout_exercise_id = workout_exercises.id
                WHERE workout_exercises.workout_id = workouts.id) AS set_count,
            (SELECT COALESCE(SUM(workout_sets.weight * workout_sets.reps), 0) FROM workout_sets
                JOIN workout_exercises ON workout_sets.workout_exercise_id = workout_exercises.id
                WHERE workout_exercises.workout_id = workouts.id) AS volume_kg,
            (SELECT GROUP_CONCAT(name, ', ') FROM (
                SELECT exercises.name FROM workout_exercises
                JOIN exercises ON workout_exercises.exercise_id = exercises.id
                WHERE workout_exercises.workout_id = workouts.id
                ORDER BY workout_exercises.position LIMIT 4
            )) AS exercise_names
         FROM workouts
         WHERE status = 'completed' AND started_at >= ? AND started_at < ?
         ORDER BY started_at DESC
         LIMIT ?`,
        [options.from ?? '0000', options.to ?? '9999', options.limit ?? -1]
    );
}

export interface CompletedSetRow {
    workout_id: string,
    started_at: string,
    exercise_id: string,
    exercise_name: string,
    category: string,
    reps: number | null,
    weight: number | null,
}

// Every logged set before `to`, for progress maths (volume per day, personal records).
export async function getCompletedSets(
    db: SQLiteDatabase,
    to: string,
) {
    return db.getAllAsync<CompletedSetRow>(
        `SELECT workouts.id AS workout_id, workouts.started_at, exercises.id AS exercise_id,
                exercises.name AS exercise_name, exercises.category, workout_sets.reps, workout_sets.weight
         FROM workout_sets
         JOIN workout_exercises ON workout_sets.workout_exercise_id = workout_exercises.id
         JOIN workouts ON workout_exercises.workout_id = workouts.id
         JOIN exercises ON workout_exercises.exercise_id = exercises.id
         WHERE workouts.status = 'completed' AND workouts.started_at < ?
         ORDER BY workouts.started_at`,
        [to]
    );
}

// Exercises used recently, most recent first, so the picker can surface them.
export async function getRecentExercises(
    db: SQLiteDatabase,
    limit = 8,
) {
    return db.getAllAsync<Exercise>(
        `SELECT exercises.* FROM exercises
         JOIN (
            SELECT workout_exercises.exercise_id, MAX(workouts.started_at) AS last_used
            FROM workout_exercises JOIN workouts ON workout_exercises.workout_id = workouts.id
            GROUP BY workout_exercises.exercise_id
         ) recent ON recent.exercise_id = exercises.id
         ORDER BY recent.last_used DESC
         LIMIT ?`,
        [limit]
    );
}
