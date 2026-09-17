import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { loadBrowserModule } from '../../../../frontend/tools/test-support.ts';

const { decodeWatermark } = await loadBrowserModule(new URL('../image-watermark-codec.ts', import.meta.url)) as {
  decodeWatermark(pixels: Uint8ClampedArray, width: number, height: number): { id: number; packetHex: string; agreement: number } | null;
};
const fixture = JSON.parse(await readFile(new URL('./fixtures/image-watermarks.json', import.meta.url), 'utf8')) as {
  width: number; height: number;
  samples: Array<{ id: number; packetHex: string; greenDeflateBase64: string }>;
};
function pixels(sample: typeof fixture.samples[number]) {
  const green = inflateSync(Buffer.from(sample.greenDeflateBase64, 'base64'));
  return Uint8ClampedArray.from({ length: fixture.width * fixture.height * 4 }, (_, i) =>
    i % 4 === 1 ? green[Math.floor(i / 4)] : i % 4 === 3 ? 255 : 128);
}

test('browser decoder recovers independent Python packets, including unsigned 32-bit boundaries', () => {
  for (const sample of fixture.samples) {
    const decoded = decodeWatermark(pixels(sample), fixture.width, fixture.height);
    assert.ok(decoded);
    assert.equal(decoded.id, sample.id);
    assert.equal(decoded.packetHex.replaceAll(' ', ''), sample.packetHex);
    assert.equal(decoded.agreement, 1);
  }
});

test('repetition tolerates two lost copies but does not invent an ID after three are lost', () => {
  const sample = fixture.samples[1];
  for (const copies of [2, 3]) {
    const damaged = pixels(sample);
    // This minimum-size fixture has one carrier per block, 64 blocks per copy.
    for (let block = 0; block < copies * 64; block++) {
      const row = Math.floor(block / 20) * 8, col = (block % 20) * 8;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) damaged[((row + y) * fixture.width + col + x) * 4 + 1] = 128;
    }
    const decoded = decodeWatermark(damaged, fixture.width, fixture.height);
    if (copies === 2) assert.equal(decoded?.id, sample.id);
    else assert.equal(decoded, null);
  }
});

test('a valid signature with a modified ID fails the checksum; blank and malformed inputs fail', () => {
  const damaged = pixels(fixture.samples[1]);
  // Erase bit 47 (ID 173's low bit) in all copies while retaining SM and the original CRC.
  for (let copy = 0; copy < 5; copy++) {
    const block = copy * 64 + 47;
    const row = Math.floor(block / 20) * 8, col = (block % 20) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) damaged[((row + y) * fixture.width + col + x) * 4 + 1] = 128;
  }
  assert.equal(decodeWatermark(damaged, fixture.width, fixture.height), null);
  assert.equal(decodeWatermark(new Uint8ClampedArray(fixture.width * fixture.height * 4).fill(128), fixture.width, fixture.height), null);
  assert.equal(decodeWatermark(damaged, fixture.width - 1, fixture.height), null);
  assert.equal(decodeWatermark(new Uint8ClampedArray(8 * 8 * 4), 8, 8), null);
});

test('all three published photo PNGs contain only image data, with no ancillary metadata', async () => {
  for (const name of ['original', 'spymarked', 'difference']) {
    const png = await readFile(new URL(`../media/image-watermarks/mochi-${name}.png`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    let offset = 8;
    const chunks = [];
    while (offset < png.length) {
      assert.ok(offset + 12 <= png.length);
      const size = png.readUInt32BE(offset);
      chunks.push(png.toString('ascii', offset + 4, offset + 8));
      offset += size + 12;
      assert.ok(offset <= png.length);
    }
    assert.equal(offset, png.length);
    // This excludes EXIF/GPS, text, dates, ICC profiles, and all other ancillary chunks.
    assert.deepEqual([...new Set(chunks)], ['IHDR', 'IDAT', 'IEND']);
  }
});
