import type { EmbedMount } from '@brand/embeds';
import { decodeWatermark } from './image-watermark-codec';
import { amplifyDifference } from './image-watermark-reveal';
import { imageWatermarkRecords as watermarkRecords } from './watermark-records';
import './image-watermarks.css';

const asset = (name: string) => new URL(`../media/image-watermarks/${name}`, import.meta.url).href;
const modes = [
  { name: 'Original', file: 'mochi-original.png', alt: 'The original resized photo of two dogs, with glasses held in front of Mochi.' },
  { name: 'Spymarked', file: 'mochi-spymarked.png', alt: 'The same photo with a toy identifier embedded in its pixel values.' },
  { name: 'Difference', file: 'mochi-difference.png', alt: 'Actual green-channel changes amplified 32 times: light and dark ripples on a neutral gray background.' },
] as const;

const mount: EmbedMount = (root, { reducedMotion }) => {
  const events = new AbortController();
  const { signal } = events;
  root.classList.add('image-watermarks');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Real image watermark: compare and decode');
  root.innerHTML = `
    <div class="iw-modes" role="group" aria-label="Image view">${modes.map((mode, i) =>
      `<button type="button" data-mode="${i}" aria-pressed="${i === 1}">${mode.name}</button>`).join('')}</div>
    <div class="iw-body">
      <div class="iw-visual"><div class="iw-picture"><span class="iw-loading">Loading image…</span>
        <canvas class="iw-reveal-frame" width="360" height="478" role="img" aria-label="Amplified pixel differences on the photo" hidden></canvas></div>
        <p class="iw-caption"></p></div>
      <div class="iw-inspection">
        <p class="iw-explanation" hidden>Visualize pixel values encoding hidden data.</p>
        <div class="iw-reveal-controls" hidden>
          <label class="iw-gain"><span>Amplify changes <output>64×</output></span>
            <input type="range" min="0" max="7" step="1" value="6" aria-label="Difference amplification" aria-valuetext="64 times">
            <span class="iw-gain-scale" aria-hidden="true"><span>1×</span><span>128×</span></span></label>
          <label class="iw-photo-toggle"><input type="checkbox" checked> Show photo</label>
        </div>
        <button class="iw-decode" type="button" disabled>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          <span>Decode spymarked PNG</span>
        </button>
        <div class="iw-result">
          <p class="iw-status" role="status">Ready to read the pixels.</p>
          <div class="iw-payload"><span>Recovered payload</span><code>—</code></div>
          <div class="iw-lookup" hidden>
            <div class="iw-record-heading">Fictional database lookup</div>
            <dl><div><dt>Database ID</dt><dd data-field="id">—</dd></div><div><dt>Author name</dt><dd data-field="author">—</dd></div>
              <div><dt>Date</dt><dd data-field="date">—</dd></div><div><dt>Time</dt><dd data-field="time">—</dd></div>
              <div class="iw-history" hidden><dt>Internet history</dt><dd><ul></ul></dd></div></dl>
          </div>
        </div>
        <p class="iw-note">Toy example; not SynthID.</p>
      </div>
    </div>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const controls = [...root.querySelectorAll<HTMLButtonElement>('.iw-modes button')];
  const picture = find<HTMLElement>('.iw-picture');
  const loading = find<HTMLElement>('.iw-loading');
  const caption = find<HTMLElement>('.iw-caption');
  const decode = find<HTMLButtonElement>('.iw-decode');
  const decodeLabel = find<HTMLElement>('.iw-decode span');
  const status = find<HTMLElement>('.iw-status');
  const payload = find<HTMLElement>('.iw-payload code');
  const result = find<HTMLElement>('.iw-result');
  const lookup = find<HTMLElement>('.iw-lookup');
  const history = find<HTMLElement>('.iw-history');
  const historyList = find<HTMLUListElement>('.iw-history ul');
  const explanation = find<HTMLElement>('.iw-explanation');
  const note = find<HTMLElement>('.iw-note');
  const revealFrame = find<HTMLCanvasElement>('.iw-reveal-frame');
  const revealControls = find<HTMLElement>('.iw-reveal-controls');
  const gain = find<HTMLInputElement>('.iw-gain input');
  const gainLabel = find<HTMLOutputElement>('.iw-gain output');
  const showPhoto = find<HTMLInputElement>('.iw-photo-toggle input');
  const fields = ['id', 'author', 'date', 'time'] as const;
  const values = fields.map(field => find<HTMLElement>(`[data-field="${field}"]`));
  const images = new Map<number, HTMLImageElement>();
  let selected = 1;
  let request = 0;
  let ready = false;
  let pixels: { original: ImageData; marked: ImageData } | undefined;
  let revealReady = false;
  let visible = false;
  let pageActive = true;
  let userPaused = reducedMotion.matches;
  let phase = reducedMotion.matches ? 3000 : 0;
  let animation: Animation | undefined;
  const printing = window.matchMedia('print');

  function freezeReveal() {
    if (!animation) return;
    phase = Number(animation.currentTime ?? 0) % 6000;
    revealFrame.style.opacity = getComputedStyle(revealFrame).opacity;
    animation.cancel();
    animation = undefined;
  }

  function syncReveal() {
    const canPlay = selected === 2 && revealReady && visible && pageActive && !document.hidden
      && !userPaused && !reducedMotion.matches && !printing.matches && !signal.aborted;
    if (!canPlay) { freezeReveal(); return; }
    if (animation) return;
    // Composite two cached frames. No per-frame JS, pixel reads, drawing, or timers.
    animation = revealFrame.animate([
      { opacity: 0, offset: 0 }, { opacity: 0, offset: .1 },
      { opacity: 1, offset: .45 }, { opacity: 1, offset: .65 }, { opacity: 0, offset: 1 },
    ], { duration: 6000, iterations: Infinity, easing: 'ease-in-out' });
    animation.currentTime = phase;
  }

  function readPixels(image: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    try {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    } finally {
      canvas.width = canvas.height = 0;
    }
  }

  async function loadImage(index: number) {
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
    try { await image.decode(); return image; }
    catch (error) {
      image.remove();
      images.delete(index);
      throw error;
    }
  }

  function renderReveal() {
    if (!pixels) return;
    const context = revealFrame.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    const amplification = 2 ** gain.valueAsNumber;
    const frame = context.createImageData(pixels.original.width, pixels.original.height);
    frame.data.set(amplifyDifference(pixels.original.data, pixels.marked.data, amplification, showPhoto.checked));
    context.putImageData(frame, 0, 0);
    images.forEach((image, index) => { image.hidden = !showPhoto.checked || index !== 0; });
    picture.style.background = showPhoto.checked ? '' : '#808080';
    gainLabel.value = `${amplification}×`;
    gain.setAttribute('aria-valuetext', `${amplification} times`);
    revealFrame.setAttribute('aria-label', showPhoto.checked
      ? `Actual pixel changes amplified ${amplification} times on the photo`
      : `Actual green-channel changes amplified ${amplification} times; gray is unchanged, light and dark show increases and decreases`);
    revealFrame.hidden = false;
    revealControls.hidden = false;
    revealReady = true;
  }

  function resetResult() {
    result.classList.remove('iw-found');
    lookup.hidden = true;
    history.hidden = true;
    historyList.replaceChildren();
    payload.textContent = '—';
    values.forEach(value => { value.textContent = '—'; });
  }

  async function select(index: number) {
    const currentRequest = ++request;
    freezeReveal();
    revealReady = false;
    revealFrame.hidden = true;
    revealControls.hidden = true;
    picture.style.background = '';
    selected = index;
    root.dataset.mode = String(index);
    ready = false;
    decode.disabled = true;
    decodeLabel.textContent = index === 0 ? 'Decode original PNG' : 'Decode spymarked PNG';
    decode.hidden = index === 2;
    result.hidden = index === 2;
    caption.textContent = index === 0
      ? 'This is the original, non-spymarked image.'
      : index === 1
        ? 'Spymarked copy of the original image.'
        : 'Amplified differences between the original and spymarked image.';
    explanation.hidden = index !== 2;
    note.hidden = index === 2;
    controls.forEach((control, i) => control.setAttribute('aria-pressed', String(i === index)));
    resetResult();
    status.textContent = index === 2 ? 'Difference view — switch to a photo to decode.' : 'Ready to read the pixels.';
    images.forEach(image => { image.hidden = true; });
    loading.textContent = 'Loading image…';
    loading.hidden = false;
    picture.setAttribute('aria-busy', 'true');
    try {
      if (index === 2) {
        const [original, marked] = await Promise.all([loadImage(0), loadImage(1)]);
        if (signal.aborted || currentRequest !== request) return;
        try {
          pixels ??= { original: readPixels(original), marked: readPixels(marked) };
          renderReveal();
          if (!revealFrame.style.opacity) revealFrame.style.opacity = userPaused ? '1' : '0';
        } catch {
          // Keep the previous static view available when canvas is unavailable.
          const image = await loadImage(2);
          if (signal.aborted || currentRequest !== request) return;
          images.forEach(other => { other.hidden = other !== image; });
        }
      } else {
        const image = await loadImage(index);
        if (signal.aborted || currentRequest !== request) return;
        image.hidden = false;
      }
      ready = true;
      loading.hidden = true;
      decode.disabled = index === 2;
      syncReveal();
    } catch {
      if (signal.aborted || currentRequest !== request) return;
      loading.textContent = 'Image unavailable. Select a view to retry.';
    } finally {
      if (!signal.aborted && currentRequest === request) picture.removeAttribute('aria-busy');
    }
  }

  controls.forEach((control, index) => control.addEventListener('click', () => { void select(index); }, { signal }));
  function inspectStrength() {
    userPaused = true;
    freezeReveal();
    phase = 3000; // Resume from the held, fully amplified frame.
    revealFrame.style.opacity = '1';
    renderReveal();
    syncReveal();
  }
  gain.addEventListener('input', inspectStrength, { signal });
  showPhoto.addEventListener('change', inspectStrength, { signal });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      userPaused = true;
      freezeReveal();
      phase = 3000;
      revealFrame.style.opacity = '1';
    }
    syncReveal();
  }, { signal });
  document.addEventListener('visibilitychange', syncReveal, { signal });
  printing.addEventListener('change', syncReveal, { signal });
  window.addEventListener('pagehide', () => { pageActive = false; syncReveal(); }, { signal });
  window.addEventListener('pageshow', () => { pageActive = true; syncReveal(); }, { signal });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= .15;
    syncReveal();
  }, { threshold: [0, .15] });
  observer.observe(root);
  decode.addEventListener('click', () => {
    if (!ready || selected === 2) return;
    resetResult();
    const image = images.get(selected)!;
    try {
      // Always decode the actual PNG, never the amplified display frame.
      const pixels = readPixels(image);
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
      const entries = record?.internetHistory ?? [];
      historyList.replaceChildren(...entries.map(entry => {
        const item = document.createElement('li');
        item.textContent = entry;
        return item;
      }));
      history.hidden = entries.length === 0;
      lookup.hidden = selected !== 1;
      result.classList.add('iw-found');
      status.textContent = `ID ${decoded.id} recovered · checksum valid`;
    } catch {
      status.textContent = 'This browser could not read the pixels. Please try another browser.';
    }
  }, { signal });
  void select(1);
  return () => { events.abort(); request++; freezeReveal(); observer.disconnect(); pixels = undefined; };
};

export default mount;
