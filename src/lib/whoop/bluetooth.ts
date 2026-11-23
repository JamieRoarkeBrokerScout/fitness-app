import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { buildWhoop4Command, historicalSampleFromWhoop4Packet, Whoop4FrameBuffer, Whoop4Sample } from './whoop4-protocol';

export const WHOOP_SERVICE_UUIDS = [
  '61080001-8d6d-82b8-614a-1c8cb0f8dcc6', // WHOOP 4
  'fd4b0001-cce1-4033-93ce-002d5875f58a', // WHOOP 5 / MG
  '0000180d-0000-1000-8000-00805f9b34fb', // standard live heart rate
];

const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
const BATTERY_LEVEL = '00002a19-0000-1000-8000-00805f9b34fb';
const WHOOP4_COMMAND_SERVICE = '61080001-8d6d-82b8-614a-1c8cb0f8dcc6';
const WHOOP4_COMMAND_WRITE = '61080002-8d6d-82b8-614a-1c8cb0f8dcc6';
const WHOOP4_COMMAND_NOTIFY = '61080003-8d6d-82b8-614a-1c8cb0f8dcc6';
const WHOOP4_DATA_NOTIFY = '61080005-8d6d-82b8-614a-1c8cb0f8dcc6';

export const whoopBleManager = new BleManager();

export interface BandCandidate {
  id: string;
  name: string;
  rssi: number | null;
  family: 'WHOOP 4' | 'WHOOP 5 / MG' | 'WHOOP / unknown';
}

export async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') return true;
  const permissions = Number(Platform.Version) >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export async function scanForWhoopBands(
  onBand: (band: BandCandidate) => void,
  onError: (message: string) => void,
) {
  const granted = await requestBluetoothPermissions();
  if (!granted) throw new Error('Bluetooth permission is required to scan for your band.');

  await whoopBleManager.startDeviceScan(WHOOP_SERVICE_UUIDS.slice(0, 2), { allowDuplicates: false }, (error, device) => {
    if (error) {
      onError(error.message);
      return;
    }
    if (!device) return;

    const serviceIds = (device.serviceUUIDs ?? []).map((id) => id.toLowerCase());
    const name = device.localName || device.name || '';
    const family = serviceIds.includes(WHOOP_SERVICE_UUIDS[0])
      ? 'WHOOP 4'
      : serviceIds.includes(WHOOP_SERVICE_UUIDS[1])
        ? 'WHOOP 5 / MG'
        : 'WHOOP / unknown';
    onBand({ id: device.id, name: name || 'WHOOP band', rssi: device.rssi, family });
  });
}

export function stopWhoopScan() {
  whoopBleManager.stopDeviceScan();
}

export async function connectToWhoopBand(
  id: string,
  onHeartRate: (bpm: number, rrIntervalsMs: number[]) => void,
  onBattery: (percent: number) => void,
  family: BandCandidate['family'],
  onHistoricalSample: (sample: Whoop4Sample) => Promise<void>,
  onSyncStatus: (status: string) => void,
): Promise<{ device: Device, subscriptions: Subscription[] }> {
  const device = await whoopBleManager.connectToDevice(id, { timeout: 15_000 });
  await device.discoverAllServicesAndCharacteristics();

  try {
    const battery = await whoopBleManager.readCharacteristicForDevice(device.id, BATTERY_SERVICE, BATTERY_LEVEL);
    const value = firstByte(battery.value);
    if (value !== null) onBattery(value);
  } catch {
    // The WHOOP vendor service may connect even when the optional standard battery service is hidden.
  }

  const subscriptions: Subscription[] = [];
  try {
    const heartRateSubscription = whoopBleManager.monitorCharacteristicForDevice(
      device.id,
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const sample = parseHeartRate(characteristic.value);
        if (sample) onHeartRate(sample.bpm, sample.rrIntervalsMs);
      },
    );
    subscriptions.push(heartRateSubscription);
  } catch {
    // History, recovery and sleep use OpenStrap's proprietary stream and are separate from BLE HR.
  }

  if (family === 'WHOOP 4') {
    try {
      const frameBuffer = new Whoop4FrameBuffer();
      // Serialize packet handling so each batch is persisted before its trim ACK is sent.
      let processing = Promise.resolve();
      const handleNotification = (value: string | null) => {
        if (!value) return;
        const packets = frameBuffer.push(fromBase64(value));
        for (const packet of packets) {
          processing = processing.then(async () => {
            const sample = historicalSampleFromWhoop4Packet(packet);
            if (sample) {
              await onHistoricalSample(sample);
              return;
            }
            if (packet.type === 0x31 && packet.command === 3) {
              onSyncStatus('WHOOP 4 history sync complete');
            } else if (packet.type === 0x31 && packet.command === 2 && packet.data.length >= 14) {
              const trimOffset = readUint32LE(packet.data, 10);
              const ack = buildWhoop4Command(0x17, [1, ...uint32LE(trimOffset), 0]);
              await whoopBleManager.writeCharacteristicWithResponseForDevice(
                device.id,
                WHOOP4_COMMAND_SERVICE,
                WHOOP4_COMMAND_WRITE,
                toBase64(ack),
              );
            }
          }).catch((error: unknown) => {
            onSyncStatus(error instanceof Error ? `History sync paused: ${error.message}` : 'History sync paused');
          });
        }
      };

      subscriptions.push(whoopBleManager.monitorCharacteristicForDevice(
        device.id, WHOOP4_COMMAND_SERVICE, WHOOP4_COMMAND_NOTIFY,
        (error, characteristic) => error ? onSyncStatus(`Band response error: ${error.message}`) : handleNotification(characteristic?.value ?? null),
      ));
      subscriptions.push(whoopBleManager.monitorCharacteristicForDevice(
        device.id, WHOOP4_COMMAND_SERVICE, WHOOP4_DATA_NOTIFY,
        (error, characteristic) => error ? onSyncStatus(`Band data error: ${error.message}`) : handleNotification(characteristic?.value ?? null),
      ));

      // The WHOOP 4 reference client sets the strap RTC before requesting history.
      // Its historical records are then saved locally before each batch is acknowledged.
      const now = Math.floor(Date.now() / 1000);
      await whoopBleManager.writeCharacteristicWithResponseForDevice(
        device.id,
        WHOOP4_COMMAND_SERVICE,
        WHOOP4_COMMAND_WRITE,
        toBase64(buildWhoop4Command(0x0a, [...uint32LE(now), 1])),
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      onSyncStatus('Downloading WHOOP 4 history…');
      await whoopBleManager.writeCharacteristicWithResponseForDevice(
        device.id,
        WHOOP4_COMMAND_SERVICE,
        WHOOP4_COMMAND_WRITE,
        toBase64(buildWhoop4Command(0x16, [0])),
      );
    } catch (error) {
      onSyncStatus(error instanceof Error ? `History sync unavailable: ${error.message}` : 'History sync unavailable');
    }
  } else {
    onSyncStatus('This band generation currently provides live heart rate only.');
  }

  return { device, subscriptions };
}

export async function disconnectWhoopBand(id: string, subscriptions: Subscription[] = []) {
  subscriptions.forEach((subscription) => subscription.remove());
  await whoopBleManager.cancelDeviceConnection(id).catch(() => undefined);
}

function firstByte(value: string | null) {
  if (!value) return null;
  const bytes = fromBase64(value);
  return bytes[0] ?? null;
}

function parseHeartRate(value: string) {
  const bytes = fromBase64(value);
  if (bytes.length < 2) return null;
  const flags = bytes[0];
  const wide = (flags & 0x01) !== 0;
  if (wide && bytes.length < 3) return null;
  const bpm = wide ? bytes[1] | (bytes[2] << 8) : bytes[1];
  let offset = wide ? 3 : 2;
  if ((flags & 0x08) !== 0) offset += 2;
  const rrIntervalsMs: number[] = [];
  if ((flags & 0x10) !== 0) {
    for (; offset + 1 < bytes.length; offset += 2) {
      const rr = Math.round(((bytes[offset] | (bytes[offset + 1] << 8)) * 1000) / 1024);
      if (rr >= 200 && rr <= 2500) rrIntervalsMs.push(rr);
    }
  }
  return { bpm, rrIntervalsMs };
}

function fromBase64(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of value) {
    if (char === '=') break;
    const digit = alphabet.indexOf(char);
    if (digit < 0) continue;
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function toBase64(bytes: number[]) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    result += alphabet[a >> 2];
    result += alphabet[((a & 3) << 4) | (b >> 4)];
    result += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : '=';
    result += hasC ? alphabet[c & 63] : '=';
  }
  return result;
}

function uint32LE(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function readUint32LE(bytes: number[], offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}
