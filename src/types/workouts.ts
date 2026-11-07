export interface Workouts {
    id: string,
    started_at: string,
    ended_at: string | null,
    status: 'active' | 'completed',
    notes: string | null,
    name: string | null,
};

export interface WorkoutSet {
    id: string,
    workout_exercise_id: string,
    set_number: number,
    reps: number | null,
    // stored in kg; converted for display
    weight: number | null,
    duration_seconds: number | null,
    distance_meters: number | null,
    completed: number,
};

// An exercise as it appears inside a workout, with its sets.
export interface WorkoutExerciseEntry {
    id: string,
    exercise_id: string,
    name: string,
    category: string,
    equipment: string,
    target: string,
    position: number,
    sets: WorkoutSet[],
};

export interface WorkoutSummary extends Workouts {
    exercise_count: number,
    set_count: number,
    volume_kg: number,
    exercise_names: string | null,
};
