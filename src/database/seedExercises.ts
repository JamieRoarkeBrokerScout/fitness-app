import type { SQLiteDatabase } from 'expo-sqlite';
import exercises from '../../assets/data/exercises.json';

// seed the database with exercises from the JSON file
// wrapped in a transaction to ensure atomicity
export async function seedExercises(db: SQLiteDatabase) {
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    });
}