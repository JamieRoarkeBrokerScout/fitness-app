import type { SQLiteDatabase } from 'expo-sqlite';
import exercises from '../../assets/data/exercises.json';

// Increment when the bundled catalog changes so existing installs reconcile once.
const EXERCISE_CATALOG_VERSION = '2';

// seed the database with exercises from the JSON file
// wrapped in a transaction to ensure atomicity
export async function seedExercises(db: SQLiteDatabase) {
    const seededVersion = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'exercise_catalog_version'"
    );
    if (seededVersion?.value === EXERCISE_CATALOG_VERSION) return;

    await db.withTransactionAsync(async () => {
        for (const exercise of exercises) {
            await db.runAsync(
                `INSERT OR IGNORE INTO exercises (
        id, 
        name, 
        category, 
        body_part, 
        equipment, 
        instructions, 
        instruction_steps, 
        muscle_group, 
        secondary_muscles, 
        target, 
        image, 
        gif_url, 
        media_id, 
        created_at, 
        attribution
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            body_part = excluded.body_part,
            equipment = excluded.equipment,
            instructions = excluded.instructions,
            instruction_steps = excluded.instruction_steps,
            muscle_group = excluded.muscle_group,
            secondary_muscles = excluded.secondary_muscles,
            target = excluded.target,
            image = excluded.image,
            gif_url = excluded.gif_url,
            media_id = excluded.media_id,
            created_at = excluded.created_at,
            attribution = excluded.attribution`,
                [
                    exercise.id,
                    exercise.name,
                    exercise.category,
                    exercise.body_part,
                    exercise.equipment,
                    exercise.instructions,
                    JSON.stringify(exercise.instruction_steps),
                    exercise.muscle_group,
                    JSON.stringify(exercise.secondary_muscles),
                    exercise.target,
                    exercise.image,
                    exercise.gif_url,
                    exercise.media_id,
                    exercise.created_at,
                    exercise.attribution
                ]
            );
        }
        await db.runAsync(
            "INSERT INTO settings (key, value) VALUES ('exercise_catalog_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [EXERCISE_CATALOG_VERSION]
        );
    });
}
