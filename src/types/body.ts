export interface BodyMeasurement {
    id: string,
    measured_at: string,
    weight_kg: number | null,
    body_fat_pct: number | null,
    waist_cm: number | null,
    chest_cm: number | null,
    hips_cm: number | null,
    arm_cm: number | null,
    thigh_cm: number | null,
    neck_cm: number | null,
    notes: string | null,
};

export type CircumferenceKey = 'waist_cm' | 'chest_cm' | 'hips_cm' | 'arm_cm' | 'thigh_cm' | 'neck_cm';

export type PhotoPose = 'front' | 'side' | 'back';

export interface ProgressPhoto {
    id: string,
    taken_at: string,
    file_name: string,
    pose: PhotoPose,
    notes: string | null,
};
