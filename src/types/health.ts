// One row per WHOOP physiological cycle, keyed by the local date you woke up on.
export interface WhoopDay {
    date: string,
    cycle_id: number,
    strain: number | null,
    kilojoule: number | null,
    average_heart_rate: number | null,
    max_heart_rate: number | null,
    recovery_score: number | null,
    hrv_ms: number | null,
    resting_heart_rate: number | null,
    spo2_pct: number | null,
    skin_temp_c: number | null,
    sleep_performance_pct: number | null,
    sleep_efficiency_pct: number | null,
    sleep_ms: number | null,
    respiratory_rate: number | null,
    updated_at: string,
};

export interface WhoopWorkout {
    id: string,
    start: string,
    end: string,
    sport_name: string | null,
    strain: number | null,
    average_heart_rate: number | null,
    max_heart_rate: number | null,
    kilojoule: number | null,
};

export interface NutritionDay {
    date: string,
    calories: number | null,
    protein_g: number | null,
    carbs_g: number | null,
    fat_g: number | null,
    source: string,
    updated_at: string,
};
