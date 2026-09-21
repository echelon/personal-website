import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserModule } from '../../../../frontend/tools/test-support.ts';

const { makeExifSample } = await loadBrowserModule(new URL('../exif-sample.ts', import.meta.url)) as {
  makeExifSample(values: readonly string[]): {
    bytes: Uint8Array;
    fields: Array<{ key: string; start: number; end: number; explanation: string }>;
  };
};

test('EXIF sample has a big-endian APP1 length and little-endian TIFF directory with inline ASCII values', () => {
  const { bytes } = makeExifSample(['A', 'B', 'C']);
  const expected = Buffer.from(
    'ffe1003a45786966000049492a00080000000300' +
    '0f0102000200000041000000' +
    '100102000200000042000000' +
    '3b0102000200000043000000' +
    '00000000', 'hex');
  assert.deepEqual(Buffer.from(bytes), expected);
});

test('variable-length EXIF strings use TIFF-relative aligned offsets and correctly switch between inline and external storage', () => {
  for (const values of [['', 'ABC', 'ABCD'], ['Shire Camera Co.', 'Bag End 35', 'Frodo Baggins'], ['X'.repeat(60), 'X', '']]) {
    const { bytes, fields } = makeExifSample(values);
    const view = new DataView(bytes.buffer);
    assert.equal(view.getUint16(2, false), bytes.length - 2);
    assert.equal(view.getUint32(14, true), 8);
    assert.equal(view.getUint16(18, true), 3);
    values.forEach((text, i) => {
      const entry = 20 + 12 * i;
      assert.equal(view.getUint16(entry, true), [0x010f, 0x0110, 0x013b][i]);
      assert.equal(view.getUint16(entry + 2, true), 2);
      assert.equal(view.getUint32(entry + 4, true), text.length + 1);
      const at = text.length < 4 ? entry + 8 : 10 + view.getUint32(entry + 8, true);
      if (text.length >= 4) assert.equal((at - 10) % 2, 0);
      assert.equal(new TextDecoder().decode(bytes.subarray(at, at + text.length + 1)), text + '\0');
    });
    let next = 0;
    for (const field of fields) {
      assert.equal(field.start, next);
      assert.ok(field.end > field.start);
      assert.ok(field.explanation.length > 0);
      next = field.end;
    }
    assert.equal(next, bytes.length);
  }
});

test('ASCII sample rejects Unicode, embedded terminators and oversized APP1 payloads', () => {
  for (const value of ['Café', '水', 'a\0b', 'a\nb']) assert.throws(() => makeExifSample([value, '', '']), /ASCII/);
  assert.throws(() => makeExifSample(['x'.repeat(65535), '', '']), /too large/);
});
