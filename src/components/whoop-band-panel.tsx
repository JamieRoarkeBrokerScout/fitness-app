import { AppText, Button, Panel } from '@/components/ui/primitives';
import { getWhoopSampleCount } from '@/database/healthQueries';
import { BandCandidate, hasWhoopBluetooth, scanForWhoopBands, stopWhoopScan } from '@/lib/whoop/bluetooth';
import { formatReadingAge, loadLastWhoopBattery } from '@/lib/whoop/connection-state';
import { connectWhoop, disconnectWhoop, setWhoopError, useWhoopConnection } from '@/lib/whoop/connection-store';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export function WhoopBandPanel() {
  if (!hasWhoopBluetooth) {
    return <AppText color="textSecondary">To connect your band, install a development build of this app that includes Bluetooth support.</AppText>;
  }
  return <BluetoothBandPanel />;
}

function BluetoothBandPanel() {
  const db = useSQLiteContext();
  const { band: connected, connecting, heartRate, battery, batteryAt, syncStatus, error, savedSamples } = useWhoopConnection();
  const [bands, setBands] = useState<BandCandidate[]>([]);
  const [scanning, setScanning] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { void loadLastWhoopBattery(db); }, [db]);

  // Re-read the stored count whenever the shared connection saves new samples.
  useEffect(() => {
    let active = true;
    void getWhoopSampleCount(db).then((summary) => {
      if (active) setSampleCount(summary?.count ?? 0);
    });
    return () => { active = false; };
  }, [db, savedSamples]);

  const endScan = () => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = null;
    stopWhoopScan();
    setScanning(false);
  };

  const scan = async () => {
    setBands([]);
    setWhoopError(null);
    setScanning(true);
    try {
      await scanForWhoopBands((band) => {
        setBands((previous) => previous.some((item) => item.id === band.id) ? previous : [...previous, band]);
      }, setWhoopError);
      scanTimer.current = setTimeout(endScan, 12_000);
    } catch (scanError) {
      setScanning(false);
      setWhoopError(scanError instanceof Error ? scanError.message : 'Could not scan for WHOOP bands.');
    }
  };

  const connect = (band: BandCandidate) => {
    endScan();
    void connectWhoop(db, band);
  };

  // Leaving Settings only stops scanning — the band connection is app-wide and stays up.
  useEffect(() => () => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    stopWhoopScan();
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
            <AppText color={battery !== null && battery <= 20 ? 'danger' : 'textSecondary'}>
              {battery === null ? 'Battery reading…' : `Battery ${battery}%`}
            </AppText>
          </View>
          {syncStatus ? <AppText color="textSecondary">{syncStatus}</AppText> : null}
          <AppText color="textSecondary">{sampleCount.toLocaleString()} WHOOP 4 sensor samples saved on this device</AppText>
          <AppText variant="caption" color="textSecondary">
            WHOOP 4 downloads historical heart-rate, R-R interval, and movement samples over its direct Bluetooth protocol. WHOOP 5/MG currently provides live heart rate only here. Sleep stages, recovery, strain, and step totals need local analytics that are not implemented yet.
          </AppText>
          <Button kind="secondary" label="Disconnect" onPress={() => void disconnectWhoop()} />
        </Panel>
      ) : (
        <>
          <Button label={connecting ? 'Connecting…' : scanning ? 'Scanning…' : 'Find WHOOP band'} loading={scanning || connecting} onPress={scan} />
          {bands.map((band) => (
            <Button
              key={band.id}
              kind="secondary"
              label={`${band.name} · ${band.family}${band.rssi === null ? '' : ` · ${band.rssi} dBm`}`}
              onPress={() => connect(band)}
            />
          ))}
          {battery !== null && batteryAt !== null && (
            <AppText variant="caption" color="textSecondary">Last known battery {battery}% · {formatReadingAge(batteryAt)}</AppText>
          )}
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
