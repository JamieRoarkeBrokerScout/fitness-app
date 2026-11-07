import { isWhoopConnected, WhoopAuthError } from '@/lib/whoop/client';
import { getLastWhoopSync, syncWhoop } from '@/lib/whoop/sync';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

const AUTO_SYNC_AFTER_MS = 30 * 60 * 1000;

// Connection state plus a sync that only one screen at a time can run.
let syncInFlight: Promise<unknown> | null = null;

export function useWhoop({ autoSync = false }: { autoSync?: boolean } = {}) {
    const db = useSQLiteContext();
    const [connected, setConnected] = useState<boolean | null>(null);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sync = useCallback(async () => {
        setSyncing(true);
        setError(null);
        try {
            syncInFlight ??= syncWhoop(db).finally(() => {
                syncInFlight = null;
            });
            await syncInFlight;
            setLastSync(await getLastWhoopSync(db));
        } catch (syncError) {
            console.error('WHOOP sync failed:', syncError);
            setError(syncError instanceof WhoopAuthError || syncError instanceof Error ? syncError.message : 'WHOOP sync failed');
        } finally {
            setSyncing(false);
        }
    }, [db]);

    const refreshStatus = useCallback(async () => {
        const [isConnected, last] = await Promise.all([isWhoopConnected(), getLastWhoopSync(db)]);
        setConnected(isConnected);
        setLastSync(last);
        return { isConnected, last };
    }, [db]);

    useFocusEffect(
        useCallback(() => {
            void refreshStatus().then(({ isConnected, last }) => {
                const stale = !last || Date.now() - new Date(last).getTime() > AUTO_SYNC_AFTER_MS;
                if (autoSync && isConnected && stale) {
                    void sync();
                }
            });
        }, [refreshStatus, sync, autoSync])
    );

    return { connected, lastSync, syncing, error, sync, refreshStatus };
}
