import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

// Article modules are compiled as browser ESM; test that emitted representation
// without requiring articles to adopt the Node tools' package configuration.
const source = await readFile(new URL('../../articles/2026/spymarks/id3-sample.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const { makeSample } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as {
  makeSample(values: readonly string[]): {
    bytes: Uint8Array;
    fields: Array<{ key: string; start: number; end: number; explanation: string }>;
  };
};

test('ID3 example emits the specified v2.4 header and UTF-8 text frames', () => {
  const { bytes } = makeSample(['A', 'B', 'C']);
  // Header: ID3, 4.0, no flags, 36 bytes of frames. Each frame has
  // a 10-byte header and a two-byte payload (UTF-8 marker + one letter).
  const expected = Buffer.from(
    '49443304000000000024' +
    '544954320000000200000341' +
    '545045310000000200000342' +
    '54414c420000000200000343', 'hex');
  assert.deepEqual(Buffer.from(bytes), expected);
});

test('Unicode lengths count bytes and use synchsafe sizes across the 127-byte boundary', () => {
  const title = '水'.repeat(60);
  const { bytes, fields } = makeSample([title, '', '']);
  assert.equal(bytes.length, 223);
  assert.deepEqual([...bytes.slice(6, 10)], [0, 0, 1, 85]); // 213-byte tag body.
  assert.deepEqual([...bytes.slice(14, 18)], [0, 0, 1, 53]); // 181-byte title payload.
  const text = fields.find(field => field.key === 'TIT2-text')!;
  assert.equal(text.end - text.start, 180);
  assert.equal(new TextDecoder().decode(bytes.slice(text.start, text.end)), title);
  assert.deepEqual([...bytes.slice(-11)], [0x54, 0x41, 0x4c, 0x42, 0, 0, 0, 1, 0, 0, 3]);
});

test('every displayed byte has exactly one explanation, including empty text values', () => {
  for (const values of [['', '', ''], ['Café', '音楽 🎵', '<script>']]) {
    const { bytes, fields } = makeSample(values);
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
