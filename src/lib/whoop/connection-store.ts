import { upsertWhoopSample } from '@/database/healthQueries';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Device, Subscription } from 'react-native-ble-plx';
import { BandCandidate, connectToWhoopBand, disconnectWhoopBand } from './bluetooth';
import { getWhoopState, recordWhoopBattery, setWhoopState } from './connection-state';

export { setWhoopError, useWhoopConnection } from './connection-state';

/**
 * Bluetooth actions for the app-wide WHOOP connection. Lives at module scope so
 * the link (live heart rate, history sync, battery polling) survives navigating
 * away from Settings.
 */
const BATTERY_POLL_MS = 5 * 60_000;

let active: { device: Device, subscriptions: Subscription[], requestBattery: () => Promise<void> } | null = null;
let batteryTimer: ReturnType<typeof setInterval> | null = null;

function clearConnection(error: string | null = null) {
  active = null;
  if (batteryTimer) clearInterval(batteryTimer);
  batteryTimer = null;
  // Battery stays as the last known reading.
  setWhoopState({ band: null, connecting: false, heartRate: null, syncStatus: '', error });
}

export async function connectWhoop(db: SQLiteDatabase, band: BandCandidate) {
  if (getWhoopState().connecting) return;
  if (active) await disconnectWhoop();
  setWhoopState({ connecting: true, error: null, syncStatus: '' });
  const recordSaved = () => setWhoopState({ savedSamples: getWhoopState().savedSamples + 1 });

  try {
    const result = await connectToWhoopBand(
      band.id,
      (bpm, rrIntervalsMs) => {
        setWhoopState({ heartRate: bpm });
        const now = Date.now();
        void upsertWhoopSample(db, {
          timestamp: Math.floor(now / 1000),
          timestampMs: now,
          heartRate: bpm,
          rrIntervalsMs,
          acceleration: null,
        }).then(recordSaved);
      },
      (percent) => recordWhoopBattery(db, percent),
      band.family,
      async (sample) => {
        await upsertWhoopSample(db, sample);
        recordSaved();
      },
      (syncStatus) => setWhoopState({ syncStatus }),
    );
    active = result;
    // Reflect real link loss (out of range, band asleep, turned off) rather than screen changes.
    const disconnectSubscription = result.device.onDisconnected(() => {
      if (active?.device.id !== result.device.id) return;
      result.subscriptions.forEach((subscription) => subscription.remove());
      clearConnection('The band disconnected. Bring it nearby and reconnect.');
    });
    result.subscriptions.push(disconnectSubscription);
    batteryTimer = setInterval(() => { void active?.requestBattery(); }, BATTERY_POLL_MS);
    setWhoopState({ band, connecting: false });
  } catch (connectError) {
    clearConnection(connectError instanceof Error ? connectError.message : 'Could not connect to the band.');
  }
}

export async function refreshWhoopBattery() {
  await active?.requestBattery();
}

export async function disconnectWhoop() {
  const current = active;
  clearConnection();
  if (current) await disconnectWhoopBand(current.device.id, current.subscriptions);
}
