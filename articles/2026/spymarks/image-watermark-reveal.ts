/** Build a display-only frame from the actual pixel residual, never a guessed mask. */
export function amplifyDifference(original: Uint8ClampedArray, marked: Uint8ClampedArray, gain: number, showPhoto: boolean): Uint8ClampedArray {
  if (original.length !== marked.length || original.length % 4 !== 0 || !Number.isFinite(gain) || gain < 1 || gain > 128) {
    throw new Error('Invalid image pair or amplification.');
  }
  const output = new Uint8ClampedArray(original.length);
  for (let i = 0; i < original.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      // The encoder changes green only. In isolated mode, show that signed
      // residual as grayscale: neutral gray is zero; light/dark are +/−.
      const source = showPhoto ? i + channel : i + 1;
      output[i + channel] = Math.max(0, Math.min(255, Math.round(
        (showPhoto ? original[source] : 128) + gain * (marked[source] - original[source]),
      )));
    }
    output[i + 3] = 255;
  }
  return output;
}
