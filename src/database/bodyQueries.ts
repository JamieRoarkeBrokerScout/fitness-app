import { BodyMeasurement, PhotoPose, ProgressPhoto } from '@/types/body';
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export type NewMeasurement = Omit<BodyMeasurement, 'id'>;

export async function addMeasurement(
    db: SQLiteDatabase,
    measurement: NewMeasurement,
) {
    const id: string = Crypto.randomUUID();
    await db.runAsync(
        `INSERT INTO body_measurements
            (id, measured_at, weight_kg, body_fat_pct, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm, neck_cm, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            measurement.measured_at,
            measurement.weight_kg,
            measurement.body_fat_pct,
            measurement.waist_cm,
            measurement.chest_cm,
            measurement.hips_cm,
            measurement.arm_cm,
            measurement.thigh_cm,
            measurement.neck_cm,
            measurement.notes,
        ]
    );
    return id;
}

export async function getMeasurements(
    db: SQLiteDatabase,
    options: { from?: string, to?: string } = {},
) {
    return db.getAllAsync<BodyMeasurement>(
        'SELECT * FROM body_measurements WHERE measured_at >= ? AND measured_at < ? ORDER BY measured_at DESC',
        [options.from ?? '0000', options.to ?? '9999']
    );
}

export async function deleteMeasurement(
    db: SQLiteDatabase,
    id: string,
) {
    await db.runAsync('DELETE FROM body_measurements WHERE id = ?', [id]);
}

// Bodyweight imported from MyFitnessPal lands here too, one entry per day.
export async function upsertDailyWeight(
    db: SQLiteDatabase,
    date: string,
    weightKg: number,
) {
    const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM body_measurements WHERE substr(measured_at, 1, 10) = ? AND notes = ?',
        [date, 'MyFitnessPal']
    );
    if (existing) {
        await db.runAsync('UPDATE body_measurements SET weight_kg = ? WHERE id = ?', [weightKg, existing.id]);
        return;
    }
    await addMeasurement(db, {
        measured_at: `${date}T12:00:00`,
        weight_kg: weightKg,
        body_fat_pct: null,
        waist_cm: null,
        chest_cm: null,
        hips_cm: null,
        arm_cm: null,
        thigh_cm: null,
        neck_cm: null,
        notes: 'MyFitnessPal',
    });
}

export async function addPhoto(
    db: SQLiteDatabase,
    fileName: string,
    pose: PhotoPose,
    takenAt: string,
) {
    const id: string = Crypto.randomUUID();
    await db.runAsync(
        'INSERT INTO progress_photos (id, taken_at, file_name, pose, notes) VALUES (?, ?, ?, ?, ?)',
        [id, takenAt, fileName, pose, null]
    );
    return id;
}

export async function getPhotos(
    db: SQLiteDatabase,
) {
    return db.getAllAsync<ProgressPhoto>('SELECT * FROM progress_photos ORDER BY taken_at DESC');
}

export async function getPhoto(
    db: SQLiteDatabase,
    id: string,
) {
    return db.getFirstAsync<ProgressPhoto>('SELECT * FROM progress_photos WHERE id = ?', [id]);
}

export async function deletePhotoRow(
    db: SQLiteDatabase,
    id: string,
) {
    await db.runAsync('DELETE FROM progress_photos WHERE id = ?', [id]);
}
