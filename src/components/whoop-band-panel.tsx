import { AppText, Button, Panel } from '@/components/ui/primitives';
import { getWhoopSampleCount, upsertWhoopSample } from '@/database/healthQueries';
import { BandCandidate, connectToWhoopBand, disconnectWhoopBand, scanForWhoopBands, stopWhoopScan } from '@/lib/whoop/bluetooth';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Device, Subscription } from 'react-native-ble-plx';

export function WhoopBandPanel() {
  const db = useSQLiteContext();
  const [bands, setBands] = useState<BandCandidate[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connected, setConnected] = useState<BandCandidate | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [sampleCount, setSampleCount] = useState(0);
  const activeRef = useRef<{ device: Device, subscriptions: Subscription[] } | null>(null);

  useEffect(() => {
    let active = true;
    void getWhoopSampleCount(db).then((summary) => {
      if (active) setSampleCount(summary?.count ?? 0);
    });
    return () => { active = false; };
  }, [db]);

  const scan = async () => {
    setBands([]);
    setError(null);
    setScanning(true);
    try {
      await scanForWhoopBands((band) => {
        setBands((previous) => previous.some((item) => item.id === band.id) ? previous : [...previous, band]);
      }, setError);
      setTimeout(() => {
        stopWhoopScan();
        setScanning(false);
      }, 12_000);
    } catch (scanError) {
      setScanning(false);
      setError(scanError instanceof Error ? scanError.message : 'Could not scan for WHOOP bands.');
    }
  };

  const connect = async (band: BandCandidate) => {
    setError(null);
    stopWhoopScan();
    setScanning(false);
    try {
      setSyncStatus('');
      const result = await connectToWhoopBand(
        band.id,
        (bpm, rrIntervalsMs) => {
          setHeartRate(bpm);
          const now = Date.now();
          void upsertWhoopSample(db, {
            timestamp: Math.floor(now / 1000),
            timestampMs: now,
            heartRate: bpm,
            rrIntervalsMs,
            acceleration: null,
          }).then(() => setSampleCount((count) => count + 1));
        },
        setBattery,
        band.family,
        async (sample) => {
          await upsertWhoopSample(db, sample);
          setSampleCount((count) => count + 1);
        },
        setSyncStatus,
      );
      activeRef.current = result;
      setConnected(band);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not connect to the band.');
    }
  };

  const disconnect = async () => {
    const active = activeRef.current;
    activeRef.current = null;
    setConnected(null);
    setHeartRate(null);
    setBattery(null);
    if (active) await disconnectWhoopBand(active.device.id, active.subscriptions);
  };

  useEffect(() => () => {
    stopWhoopScan();
    const active = activeRef.current;
    if (active) void disconnectWhoopBand(active.device.id, active.subscriptions);
  }, []);

  return (
    <View style={styles.content}>
      <AppText color="textSecondary">
        Pair directly to your band over Bluetooth. No WHOOP account or subscription is used.
      </AppText>
      {connected ? (
        <Panel style={styles.content}>
          <AppText variant="bodyStrong">Connected · {connected.family}</AppText>
          <View style={styles.stats}>
            <AppText>{heartRate === null ? 'No live heart-rate data' : `${heartRate} bpm`}</AppText>
            {battery !== null && <AppText color="textSecondary">Battery {battery}%</AppText>}
          </View>
          {syncStatus ? <AppText color="textSecondary">{syncStatus}</AppText> : null}
          <AppText color="textSecondary">{sampleCount.toLocaleString()} WHOOP 4 sensor samples saved on this device</AppText>
          <AppText variant="caption" color="textSecondary">
            WHOOP 4 downloads historical heart-rate, R-R interval, and movement samples over its direct Bluetooth protocol. WHOOP 5/MG currently provides live heart rate only here. Sleep stages, recovery, strain, and step totals need local analytics that are not implemented yet.
          </AppText>
          <Button kind="secondary" label="Disconnect" onPress={disconnect} />
        </Panel>
      ) : (
        <>
          <Button label={scanning ? 'Scanning…' : 'Find WHOOP band'} loading={scanning} onPress={scan} />
          {bands.map((band) => (
            <Button
              key={band.id}
              kind="secondary"
              label={`${band.name} · ${band.family}${band.rssi === null ? '' : ` · ${band.rssi} dBm`}`}
              onPress={() => void connect(band)}
            />
          ))}
          {!scanning && bands.length === 0 && <AppText variant="caption" color="textSecondary">Keep the band nearby and disconnect it from other apps before scanning.</AppText>}
        </>
      )}
      {error && <AppText color="danger">{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  stats: { flexDirection: 'row', gap: 18 },
});
