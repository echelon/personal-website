import type { ByteField, SampleTag } from './id3-sample';

// A metadata-only JPEG APP1 segment containing selected TIFF/EXIF ASCII tags.
// No JPEG image stream, GPS directory, camera serial number, or real photo data.
// Tag reference: https://exiftool.org/TagNames/EXIF.html
export const exifFields = [
  { id: 'Make', tag: 0x010f, label: 'Maker', initial: 'Shire Camera Co.' },
  { id: 'Model', tag: 0x0110, label: 'Camera', initial: 'Bag End 35' },
  { id: 'Artist', tag: 0x013b, label: 'Author', initial: 'Frodo Baggins' },
] as const;

export function makeExifSample(values: readonly string[]): SampleTag {
  const encoder = new TextEncoder();
  const texts = exifFields.map((_, i) => {
    const value = values[i] ?? '';
    if (!/^[\x20-\x7e]*$/.test(value)) throw new Error('This EXIF sample uses printable ASCII.');
    return encoder.encode(`${value}\0`);
  });
  // TIFF offsets start after the APP1 marker/length (4) and Exif signature (6).
  const tiffStart = 10;
  const ifdStart = 8;
  const dataStart = ifdStart + 2 + 12 * exifFields.length + 4;
  let next = dataStart;
  const offsets = texts.map(text => {
    if (text.length <= 4) return 0; // Short values occupy the entry's four-byte slot.
    const offset = next;
    next += text.length;
    if (next % 2) next++; // TIFF values begin on word boundaries.
    return offset;
  });
  if (next + 8 > 0xffff) throw new Error('EXIF APP1 segment is too large.');
  const bytes = new Uint8Array(tiffStart + next);
  const view = new DataView(bytes.buffer);
  const fields: ByteField[] = [];
  function field(key: string, label: string, explanation: string, start: number, end: number, frame = 'EXIF') {
    fields.push({ key, label, explanation, start, end, frame });
  }
  bytes.set([0xff, 0xe1]);
  field('marker', 'JPEG APP1 marker', 'FF E1 starts a JPEG application segment. EXIF metadata commonly lives here.', 0, 2);
  view.setUint16(2, bytes.length - 2, false);
  field('segment-size', 'APP1 segment size', `${bytes.length - 2} bytes including this length field, but excluding the FF E1 marker. JPEG lengths are big-endian.`, 2, 4);
  bytes.set(encoder.encode('Exif\0\0'), 4);
  field('signature', 'EXIF signature', '45 78 69 66 spells “Exif”, followed by two zero bytes.', 4, 10);
  bytes.set([0x49, 0x49, 0x2a, 0], tiffStart);
  field('byte-order', 'TIFF byte order', '49 49 spells “II”: TIFF integers in this sample use little-endian byte order.', 10, 12);
  field('tiff-magic', 'TIFF identifier', '2A 00 is the little-endian integer 42, the TIFF identifier.', 12, 14);
  view.setUint32(14, ifdStart, true);
  field('ifd-offset', 'Directory offset', 'The first image file directory starts 8 bytes from the TIFF header, at sample offset 0x0012.', 14, 18);
  view.setUint16(18, exifFields.length, true);
  field('entry-count', 'Directory entry count', '03 00: this sample has three directory entries.', 18, 20);

  exifFields.forEach(({ id, tag, label }, i) => {
    const entry = 20 + 12 * i;
    const text = texts[i];
    view.setUint16(entry, tag, true);
    field(`${id}-id`, `${id} · ${label}`, `Tag 0x${tag.toString(16).toUpperCase().padStart(4, '0')} identifies the ${id} field.`, entry, entry + 2, id);
    view.setUint16(entry + 2, 2, true);
    field(`${id}-type`, `${id} · Field type`, '02 00: TIFF type 2 is ASCII text, terminated by a zero byte.', entry + 2, entry + 4, id);
    view.setUint32(entry + 4, text.length, true);
    field(`${id}-count`, `${id} · Byte count`, `${text.length} ASCII bytes, including the terminating zero.`, entry + 4, entry + 8, id);
    const at = text.length <= 4 ? entry + 8 : tiffStart + offsets[i];
    if (text.length > 4) {
      view.setUint32(entry + 8, offsets[i], true);
      field(`${id}-offset`, `${id} · Value offset`, `Text starts ${offsets[i]} bytes from the TIFF header, at sample offset 0x${at.toString(16).toUpperCase().padStart(4, '0')}.`, entry + 8, entry + 12, id);
    }
    bytes.set(text, at);
    if (text.length > 1) field(`${id}-text`, `${id} · ${label} text`, `ASCII text: “${values[i]}”.`, at, at + text.length - 1, id);
    field(`${id}-terminator`, `${id} · Text terminator`, '00 terminates the ASCII string.', at + text.length - 1, at + text.length, id);
    const padding = text.length <= 4 ? 4 - text.length : text.length % 2;
    if (padding) field(`${id}-padding`, `${id} · Padding`, text.length <= 4 ? 'Unused bytes in the inline four-byte value slot.' : 'One zero byte keeps the next value on a two-byte boundary.', at + text.length, at + text.length + padding, id);
  });
  field('next-ifd', 'Next directory', '00 00 00 00: no next directory or thumbnail.', 56, 60);
  fields.sort((a, b) => a.start - b.start);
  return { bytes, fields };
}
