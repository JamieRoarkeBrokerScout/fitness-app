/**
 * WHOOP 4.0 packet decoder.
 *
 * Protocol facts are based on the public interoperability work in
 * andyguzmaneth/whoop4-ble (MIT) and OpenStrap/research (MIT). This is an
 * independent TypeScript implementation; uncertain fields are intentionally
 * left undecoded.
 */

export interface Whoop4Packet {
  type: number;
  sequence: number;
  command: number;
  data: number[];
}

export interface Whoop4Sample {
  timestamp: number;
  timestampMs: number;
  heartRate: number;
  rrIntervalsMs: number[];
  acceleration: [number, number, number] | null;
}

export class Whoop4FrameBuffer {
  private buffer: number[] = [];

  push(chunk: number[]) {
    this.buffer.push(...chunk);
    const packets: Whoop4Packet[] = [];
    while (this.buffer.length >= 4) {
      const start = this.buffer.indexOf(START_BYTE);
      if (start < 0) {
        this.buffer = [];
        break;
      }
      if (start > 0) this.buffer.splice(0, start);
      if (this.buffer.length < 4) break;
      const packetLength = 4 + readU16(this.buffer, 1);
      if (packetLength < 11 || packetLength > 4096) {
        this.buffer.shift();
        continue;
      }
      if (this.buffer.length < packetLength) break;
      const packet = parseWhoop4Frame(this.buffer.slice(0, packetLength));
      this.buffer.splice(0, packetLength);
      if (packet) packets.push(packet);
    }
    return packets;
  }
}

const START_BYTE = 0xaa;
const PACKET_HISTORICAL_DATA = 0x2f;
const crc8Table = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  return crc;
});

const crc32Table = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});

function crc8(bytes: number[]) {
  let crc = 0;
  for (const byte of bytes) crc = crc8Table[crc ^ byte];
  return crc;
}

function crc32(bytes: number[]) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function readU16(bytes: number[], offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: number[], offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

/** Parses and validates one WHOOP 4 frame, including both frame checksums. */
export function parseWhoop4Frame(bytes: number[]): Whoop4Packet | null {
  if (bytes.length < 11 || bytes[0] !== START_BYTE) return null;
  const payloadAndCrcLength = readU16(bytes, 1);
  if (payloadAndCrcLength < 7 || bytes.length !== 4 + payloadAndCrcLength) return null;
  if (crc8(bytes.slice(1, 3)) !== bytes[3]) return null;

  const payload = bytes.slice(4, 4 + payloadAndCrcLength - 4);
  const expectedCrc = readU32(bytes, 4 + payloadAndCrcLength - 4);
  if (crc32(payload) !== expectedCrc || payload.length < 3) return null;
  return { type: payload[0], sequence: payload[1], command: payload[2], data: payload.slice(3) };
}

/** Builds a WHOOP 4 command frame for the vendor command characteristic. */
export function buildWhoop4Command(command: number, data: number[] = [], sequence = 0) {
  const payload = [0x23, sequence & 0xff, command & 0xff, ...data];
  const length = payload.length + 4;
  const header = [length & 0xff, (length >>> 8) & 0xff];
  const checksum = crc32(payload);
  return [START_BYTE, ...header, crc8(header), ...payload, checksum & 0xff, (checksum >>> 8) & 0xff, (checksum >>> 16) & 0xff, (checksum >>> 24) & 0xff];
}

/** Decodes only fields with public, cross-checked layouts from a history record. */
export function parseWhoop4HistoricalSample(data: number[]): Whoop4Sample | null {
  if (data.length < 16) return null;
  const timestamp = readU32(data, 4);
  const subsecond = readU16(data, 8);
  const heartRate = data[14];
  if (timestamp < 1_577_836_800 || timestamp > 4_102_444_800 || heartRate < 1 || heartRate > 220) return null;

  const rrCount = data[15];
  const rrIntervalsMs = rrCount > 0 && rrCount <= 4 && data.length >= 16 + rrCount * 2
    ? Array.from({ length: rrCount }, (_, index) => readU16(data, 16 + index * 2)).filter((rr) => rr >= 200 && rr <= 2500)
    : [];

  let acceleration: [number, number, number] | null = null;
  if (data.length >= 45) {
    const view = new DataView(new Uint8Array(data).buffer);
    const values = [view.getFloat32(33, true), view.getFloat32(37, true), view.getFloat32(41, true)];
    if (values.every((value) => Number.isFinite(value) && value > -100 && value < 100)) {
      acceleration = values as [number, number, number];
    }
  }
  return { timestamp, timestampMs: timestamp * 1000 + subsecond, heartRate, rrIntervalsMs, acceleration };
}

export function historicalSampleFromWhoop4Packet(packet: Whoop4Packet): Whoop4Sample | null {
  return packet.type === PACKET_HISTORICAL_DATA ? parseWhoop4HistoricalSample(packet.data) : null;
}
