import { getSetting, setSetting } from '@/database/settingsQueries';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import type { BandCandidate } from './bluetooth';

/**
 * App-wide WHOOP connection state. Deliberately free of any native Bluetooth
 * import so any screen (including web builds) can read it. The actions that
 * drive it live in `connection-store.ts`.
 */
export interface WhoopConnectionState {
  band: BandCandidate | null;
  connecting: boolean;
  heartRate: number | null;
  /** Latest battery percent; kept after disconnect as the last known value. */
  battery: number | null;
  /** When `battery` was read (ms epoch). */
  batteryAt: number | null;
  syncStatus: string;
  error: string | null;
  /** Incremented each time a sample is saved, so screens can refresh counts. */
  savedSamples: number;
}

const BATTERY_SETTING = 'whoop_last_battery';

let state: WhoopConnectionState = {
  band: null,
  connecting: false,
  heartRate: null,
  battery: null,
  batteryAt: null,
  syncStatus: '',
  error: null,
  savedSamples: 0,
};
const listeners = new Set<() => void>();
let batteryLoaded = false;

export function getWhoopState() {
  return state;
}

export function setWhoopState(patch: Partial<WhoopConnectionState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useWhoopConnection() {
  return useSyncExternalStore(subscribe, getWhoopState);
}

export function setWhoopError(error: string | null) {
  setWhoopState({ error });
}

/** Records a battery reading and persists it so it survives app restarts. */
export function recordWhoopBattery(db: SQLiteDatabase, percent: number) {
  const batteryAt = Date.now();
  setWhoopState({ battery: percent, batteryAt });
  void setSetting(db, BATTERY_SETTING, JSON.stringify({ percent, at: batteryAt })).catch(() => undefined);
}

/** Loads the last saved battery reading once, if nothing newer is in memory. */
export async function loadLastWhoopBattery(db: SQLiteDatabase) {
  if (batteryLoaded) return;
  batteryLoaded = true;
  try {
    const raw = await getSetting(db, BATTERY_SETTING);
    if (!raw || state.battery !== null) return;
    const saved = JSON.parse(raw) as { percent?: unknown, at?: unknown };
    if (typeof saved.percent === 'number' && typeof saved.at === 'number') {
      setWhoopState({ battery: saved.percent, batteryAt: saved.at });
    }
  } catch {
    // A missing or corrupt saved reading just means no last-known battery.
  }
}

/** "now", "5 min ago", "3 h ago", "2 d ago". */
export function formatReadingAge(at: number, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
