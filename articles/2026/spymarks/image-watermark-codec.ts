// Public toy format shared with image-watermark.py.
// Decode actual RGB pixels; no original image, metadata, or expected ID needed.
const packetBits = 64;
const repeats = 5;
const step = 24;
const basis = Float64Array.from({ length: 64 }, (_, i) =>
  .25 * Math.cos((2 * Math.floor(i / 8) + 1) * 2 * Math.PI / 16)
    * Math.cos((2 * (i % 8) + 1) * 3 * Math.PI / 16));

export interface DecodedWatermark {
  id: number;
  packetHex: string;
  agreement: number;
}

export function decodeWatermark(rgba: Uint8ClampedArray, width: number, height: number): DecodedWatermark | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 8 || height < 8
    || rgba.length !== width * height * 4) return null;
  const columns = Math.floor(width / 8);
  const total = columns * Math.floor(height / 8);
  const count = packetBits * repeats;
  if (total < count) return null;
  const votes = new Uint8Array(packetBits);
  for (let i = 0; i < count; i++) {
    const block = Math.floor((2 * i + 1) * total / (2 * count));
    const row = Math.floor(block / columns) * 8;
    const col = (block % columns) * 8;
    let coefficient = 0;
    for (let j = 0; j < 64; j++) {
      const pixel = ((row + Math.floor(j / 8)) * width + col + j % 8) * 4;
      coefficient += rgba[pixel + 1] * basis[j];
    }
    votes[i % packetBits] += Math.floor(coefficient / step + .5) & 1;
  }
  const packet = new Uint8Array(packetBits / 8);
  votes.forEach((vote, i) => { packet[Math.floor(i / 8)] |= Number(vote > repeats / 2) << (7 - i % 8); });
  let crc = 0xffff;
  for (const byte of packet.subarray(0, 6)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  if (packet[0] !== 0x53 || packet[1] !== 0x4d || crc !== packet[6] * 256 + packet[7]) return null;
  return {
    id: new DataView(packet.buffer).getUint32(2, false),
    packetHex: [...packet].map(byte => byte.toString(16).padStart(2, '0')).join(' '),
    agreement: votes.reduce((sum, v) => sum + Math.max(v, repeats - v), 0) / count,
  };
}
