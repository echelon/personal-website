import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserModule } from '../../../../frontend/tools/test-support.ts';

const { amplifyDifference } = await loadBrowserModule(new URL('../image-watermark-reveal.ts', import.meta.url)) as {
  amplifyDifference(original: Uint8ClampedArray, marked: Uint8ClampedArray, gain: number, showPhoto: boolean): Uint8ClampedArray;
};

test('photo reveal amplifies only actual changes, clamps channels, and never modifies source pixels', () => {
  const original = new Uint8ClampedArray([80, 120, 40, 255, 200, 80, 60, 255, 15, 90, 30, 255]);
  const marked = new Uint8ClampedArray([80, 122, 40, 255, 200, 78, 60, 255, 15, 90, 30, 255]);
  const before = [original.slice(), marked.slice()];
  assert.deepEqual(amplifyDifference(original, marked, 1, true), marked);
  assert.deepEqual([...amplifyDifference(original, marked, 64, true)], [80, 248, 40, 255, 200, 0, 60, 255, 15, 90, 30, 255]);
  assert.deepEqual([...amplifyDifference(original, marked, 128, true)], [80, 255, 40, 255, 200, 0, 60, 255, 15, 90, 30, 255]);
  assert.deepEqual([original, marked], before);
});

test('isolated signal shows signed green differences around neutral gray, independent of photo brightness', () => {
  const original = new Uint8ClampedArray([80, 120, 40, 255, 200, 80, 60, 255, 15, 90, 30, 255]);
  const marked = new Uint8ClampedArray([80, 122, 40, 255, 200, 78, 60, 255, 15, 90, 30, 255]);
  assert.deepEqual([...amplifyDifference(original, marked, 32, false)], [192, 192, 192, 255, 64, 64, 64, 255, 128, 128, 128, 255]);
  assert.throws(() => amplifyDifference(original, marked.subarray(4), 32, true));
  for (const gain of [0, 129, NaN, Infinity]) assert.throws(() => amplifyDifference(original, marked, gain, true));
});
