/** A small, valid ID3v2.4 tag, without an MPEG audio stream.
 * https://id3.org/id3v2.4.0-structure
 * https://id3.org/id3v2.4.0-frames
 */
export const textFrames = [
  { id: 'TIT2', label: 'Title', initial: 'You Only Live Once' },
  { id: 'TPE1', label: 'Artist', initial: 'The Strokes' },
  { id: 'TALB', label: 'Album', initial: 'First Impressions of Earth' },
] as const;

export interface ByteField {
  key: string;
  label: string;
  explanation: string;
  start: number;
  end: number; // Exclusive.
  frame: string;
}

export interface SampleTag {
  bytes: Uint8Array;
  fields: ByteField[];
}

/** ID3v2.4 sizes use seven bits per byte, most significant byte first. */
function synchsafe(size: number): number[] {
  return [(size >>> 21) & 127, (size >>> 14) & 127, (size >>> 7) & 127, size & 127];
}

export function makeSample(values: readonly string[]): SampleTag {
  const data: number[] = [];
  const fields: ByteField[] = [];
  const encoder = new TextEncoder();
  function append(key: string, label: string, explanation: string, bytes: Iterable<number>, frame = 'ID3') {
    const start = data.length;
    data.push(...bytes);
    fields.push({ key, label, explanation, start, end: data.length, frame });
  }
  append('signature', 'ID3 signature', '49 44 33 spells “ID3”: the metadata tag starts here.', encoder.encode('ID3'));
  append('version', 'Tag version', '04 00 identifies ID3v2.4.0.', [4, 0]);
  append('flags', 'Tag flags', '00: no unsynchronisation, extended header, experimental flag, or footer.', [0]);
  append('tag-size', 'Tag size', '', [0, 0, 0, 0]);
  textFrames.forEach(({ id, label }, index) => {
    const value = values[index] ?? '';
    const text = encoder.encode(value);
    const size = text.length + 1;
    append(`${id}-id`, `${id} · ${label}`, `These four ASCII bytes identify the ${label.toLowerCase()} frame.`, encoder.encode(id), id);
    append(`${id}-size`, `${id} · Frame size`, `${size} payload bytes, excluding this frame’s 10-byte header. The four size bytes each use seven bits.`, synchsafe(size), id);
    append(`${id}-flags`, `${id} · Frame flags`, '00 00: no frame flags are set.', [0, 0], id);
    append(`${id}-encoding`, `${id} · Text encoding`, '03 selects UTF-8 for the text that follows.', [3], id);
    if (text.length) append(`${id}-text`, `${id} · ${label} text`, `UTF-8 text: “${value}”.`, text, id);
  });
  const bytes = Uint8Array.from(data);
  bytes.set(synchsafe(bytes.length - 10), 6);
  fields.find(field => field.key === 'tag-size')!.explanation =
    `${bytes.length - 10} bytes after the 10-byte tag header. Each size byte uses seven bits (a “synchsafe” integer).`;
  return { bytes, fields };
}
