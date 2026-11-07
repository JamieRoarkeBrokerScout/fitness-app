import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

// Loads data whenever the screen comes into focus (so edits made on another screen show up
// on return) and whenever `deps` change. `reload` re-runs it on demand.
export function useFocusQuery<T>(load: (db: SQLiteDatabase) => Promise<T>, deps: unknown[] = []) {
    const db = useSQLiteContext();
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const loadRef = useRef(load);
    useEffect(() => {
        loadRef.current = load;
    });

    const reload = useCallback(async () => {
        try {
            const result = await loadRef.current(db);
            setData(result);
            setError(null);
        } catch (loadError) {
            console.error('Failed to load screen data:', loadError);
            setError(loadError instanceof Error ? loadError.message : 'Unknown error');
        }
    }, [db]);

    useFocusEffect(
        useCallback(() => {
            void reload();
        }, [reload])
    );

    useEffect(() => {
        void reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { data, error, reload };
}
