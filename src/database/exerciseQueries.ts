import { Exercise } from '@/types/exercises';
import type { SQLiteDatabase } from 'expo-sqlite';

// Function to fetch exercises from the database with an optional search query.
export async function getExercises(
    db: SQLiteDatabase,
    search: string = ''
): Promise<Exercise[]> {
    const results = await db.getAllAsync<Exercise>(
        'SELECT * FROM exercises WHERE name LIKE ? LIMIT 20',
        [`%${search}%`]
    );
    return results;
}