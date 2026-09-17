import type { EmbedMount } from '@brand/embeds';
import { decodeWatermark } from './image-watermark-codec';
import { watermarkRecords } from './watermark-records';
import './image-watermarks.css';

const asset = (name: string) => new URL(`../media/image-watermarks/${name}`, import.meta.url).href;
const modes = [
  { name: 'Original', file: 'mochi-original.png', alt: 'The original resized photo of two dogs, with glasses held in front of Mochi.' },
  { name: 'Spymarked', file: 'mochi-spymarked.png', alt: 'The same photo with a toy identifier embedded in its pixel values.' },
  { name: 'Difference ×32', file: 'mochi-difference.png', alt: 'Actual green-channel changes amplified 32 times: light and dark ripples on a neutral gray background.' },
] as const;

const mount: EmbedMount = (root) => {
  const events = new AbortController();
  const { signal } = events;
  root.classList.add('image-watermarks');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Real image watermark: compare and decode');
  root.innerHTML = `
    <div class="iw-modes" role="group" aria-label="Image view">${modes.map((mode, i) =>
      `<button type="button" data-mode="${i}" aria-pressed="${i === 1}">${mode.name}</button>`).join('')}</div>
    <div class="iw-body">
      <div class="iw-visual"><div class="iw-picture"><span class="iw-loading">Loading image…</span></div>
        <p class="iw-view-note"></p></div>
      <div class="iw-inspection">
        <p class="iw-intro">A real ID, hidden in the pixels.</p>
        <p class="iw-explanation">Compare the images, then read the embedded number. The difference view magnifies the changes.</p>
        <button class="iw-decode" type="button" disabled>Decode spymarked PNG</button>
        <div class="iw-result">
          <p class="iw-status" role="status">Ready to read the pixels.</p>
          <div class="iw-payload"><span>Recovered payload</span><code>—</code></div>
          <div class="iw-record-heading">Fictional database lookup</div>
          <dl><div><dt>Database ID</dt><dd data-field="id">—</dd></div><div><dt>Author name</dt><dd data-field="author">—</dd></div>
            <div><dt>Date</dt><dd data-field="date">—</dd></div><div><dt>Time</dt><dd data-field="time">—</dd></div></dl>
        </div>
        <p class="iw-note">The ID is really encoded. The name and timestamp are fictional lookup data. This is our own toy, not SynthID.</p>
      </div>
    </div>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const controls = [...root.querySelectorAll<HTMLButtonElement>('.iw-modes button')];
  const picture = find<HTMLElement>('.iw-picture');
  const loading = find<HTMLElement>('.iw-loading');
  const viewNote = find<HTMLElement>('.iw-view-note');
  const decode = find<HTMLButtonElement>('.iw-decode');
  const status = find<HTMLElement>('.iw-status');
  const payload = find<HTMLElement>('.iw-payload code');
  const result = find<HTMLElement>('.iw-result');
  const fields = ['id', 'author', 'date', 'time'] as const;
  const values = fields.map(field => find<HTMLElement>(`[data-field="${field}"]`));
  const images = new Map<number, HTMLImageElement>();
  let selected = 1;
  let request = 0;
  let ready = false;

  function resetResult() {
    result.classList.remove('iw-found');
    payload.textContent = '—';
    values.forEach(value => { value.textContent = '—'; });
  }

  async function select(index: number) {
    const currentRequest = ++request;
    selected = index;
    root.dataset.mode = String(index);
    ready = false;
    decode.disabled = true;
    decode.textContent = index === 0 ? 'Decode original PNG' : 'Decode spymarked PNG';
    decode.hidden = index === 2;
    controls.forEach((control, i) => control.setAttribute('aria-pressed', String(i === index)));
    resetResult();
    status.textContent = index === 2 ? 'Difference view — switch to a photo to decode.' : 'Ready to read the pixels.';
    viewNote.textContent = index === 2
      ? 'Green-channel difference ×32. Gray = unchanged; light / dark = increased / decreased.'
      : '360 × 478 pixels · lossless PNG';
    images.forEach(image => { image.hidden = true; });
    loading.textContent = 'Loading image…';
    loading.hidden = false;
    picture.setAttribute('aria-busy', 'true');
    try {
      let image = images.get(index);
      if (!image) {
        image = new Image(360, 478);
        image.decoding = 'async';
        image.alt = modes[index].alt;
        image.hidden = true;
        image.src = asset(modes[index].file);
        images.set(index, image);
        picture.append(image);
      }
      await image.decode();
      if (signal.aborted || currentRequest !== request) return;
      image.hidden = false;
      ready = true;
      loading.hidden = true;
      decode.disabled = index === 2;
    } catch {
      if (signal.aborted || currentRequest !== request) return;
      images.get(index)?.remove();
      images.delete(index);
      loading.textContent = 'Image unavailable. Select a view to retry.';
    } finally {
      if (!signal.aborted && currentRequest === request) picture.removeAttribute('aria-busy');
    }
  }

  controls.forEach((control, index) => control.addEventListener('click', () => { void select(index); }, { signal }));
  decode.addEventListener('click', () => {
    if (!ready || selected === 2) return;
    resetResult();
    const image = images.get(selected)!;
    // One read on an explicit click. No frames, polling, or background computation.
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    try {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = decodeWatermark(pixels.data, pixels.width, pixels.height);
      if (!decoded) {
        status.textContent = 'No valid demo mark found: signature or checksum failed.';
        return;
      }
      payload.textContent = decoded.packetHex;
      const record = watermarkRecords.find(record => record.id === decoded.id);
      values[0].textContent = String(decoded.id);
      values[1].textContent = record?.author ?? 'No matching record';
      values[2].textContent = record?.date ?? '—';
      values[3].textContent = record?.time ?? '—';
      result.classList.add('iw-found');
      status.textContent = `ID ${decoded.id} recovered · checksum valid${record ? ` · ${record.author}` : ''}.`;
    } catch {
      status.textContent = 'This browser could not read the pixels. Please try another browser.';
    } finally {
      canvas.width = canvas.height = 0;
    }
  }, { signal });
  void select(1);
  return () => { events.abort(); request++; };
};

export default mount;
