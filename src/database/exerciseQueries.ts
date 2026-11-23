import { Exercise } from '@/types/exercises';
import type { SQLiteDatabase } from 'expo-sqlite';

// Function to fetch exercises from the database with an optional search query
// and body-area filter (the `category` column, e.g. "chest", "upper legs").
export async function getExercises(
    db: SQLiteDatabase,
    search: string = '',
    category: string | null = null,
): Promise<Exercise[]> {
    const results = await db.getAllAsync<Exercise>(
        `SELECT * FROM exercises
         WHERE (? IS NULL OR category = ?)
           AND (? = '' OR name LIKE ? OR equipment LIKE ? OR target LIKE ? OR muscle_group LIKE ? OR body_part LIKE ?)
         ORDER BY name`,
        [category, category, search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    return results;
}

export async function getExerciseCategories(
    db: SQLiteDatabase,
) {
    const rows = await db.getAllAsync<{ category: string }>(
        'SELECT category FROM exercises GROUP BY category ORDER BY COUNT(*) DESC'
    );
    return rows.map((row) => row.category);
}

// Cardio movements are logged as time and distance; everything else as weight × reps.
export function isCardio(category: string) {
    return category === 'cardio';
}
