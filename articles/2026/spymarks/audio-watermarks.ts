import type { EmbedMount } from '@brand/embeds';
import './audio-watermarks.css';

// Original LJ spectrograms: https://sokaudiowm.github.io/
// Clean originals are verified against the authors' embedded PNGs; see media/audio-watermarks/SOURCES.txt.
// Annotated copies remain in media/audio-watermarks/ if needed again.
// Entries compile to _embeds/, alongside the article's copied media directory.
const asset = (name: string) => new URL(`../media/audio-watermarks/clean/${name}`, import.meta.url).href;
const examples = [
  ['unwatermarked', 'Unwatermarked'],
  ['timbre', 'Timbre'],
  ['audioseal', 'AudioSeal'],
  ['wavmark', 'WavMark'],
  ['fsvc', 'FSVC'],
  ['patchwork', 'Patchwork'],
  ['norm-space', 'Norm-Space'],
] as const;

// Exact rectangle positions from the annotated PNGs' diagrams.net metadata.
// Coordinates use the original 775 × 308 image grid; see SOURCES.txt.
type SignalRegion = readonly [x: number, y: number, width: number, height: number];
const signalRegions: Record<typeof examples[number][0], readonly SignalRegion[]> = {
  unwatermarked: [],
  timbre: [[7.5, 42, 760, 190]],
  audioseal: [[7.5, 184, 760, 40]],
  wavmark: [[250, 12, 60, 290], [470, 152, 60, 150], [80, 122, 60, 150]],
  fsvc: [[3, 130, 760, 40]],
  patchwork: [[10, 62, 760, 110]],
  'norm-space': [[460, 3, 50, 100], [250, 192, 60, 110]],
};

const mount: EmbedMount = (root, { reducedMotion }) => {
  const events = new AbortController();
  const { signal } = events;
  const hoverCapable = window.matchMedia('(any-hover: hover)');
  root.classList.add('audio-watermarks');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Audio watermark spectrograms');
  // The selected method is the visible heading; retain the caption for no-JS fallback.
  const caption = root.closest('figure')?.querySelector('figcaption');
  if (caption) caption.hidden = true;
  root.innerHTML = `
    <div class="aw-heading"><div><strong class="aw-name"></strong><span class="aw-subtitle"></span></div><span class="aw-count"></span></div>
    <div class="aw-plot"><svg class="aw-highlights" viewBox="0 0 775 308" aria-hidden="true" focusable="false" hidden></svg></div>
    <p class="aw-axes">Frequency ↑ <span>Time → · 6.5 seconds</span></p>
    <div class="aw-slider">
      <div class="aw-scale" aria-hidden="true">${examples.map(([, label], index) =>
        `<span class="aw-tick" style="--tick: ${index / (examples.length - 1) * 100}%"><span>${label}</span></span>`).join('')}</div>
      <input class="aw-range" type="range" min="0" max="${examples.length - 1}" step="1" value="0" aria-label="Watermark method">
    </div>
    <div class="aw-controls">
      <label class="aw-highlight-toggle"><input type="checkbox" checked><span>Highlight signal</span></label>
      <button class="aw-cycle" type="button"></button>
    </div>
    <p class="aw-hint">Hover or drag to compare. Highlights follow the authors’ annotations.</p>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const name = find<HTMLElement>('.aw-name');
  const subtitle = find<HTMLElement>('.aw-subtitle');
  const count = find<HTMLElement>('.aw-count');
  const plot = find<HTMLElement>('.aw-plot');
  const slider = find<HTMLInputElement>('.aw-range');
  const scale = find<HTMLElement>('.aw-scale');
  const cycle = find<HTMLButtonElement>('.aw-cycle');
  const highlightToggle = find<HTMLInputElement>('.aw-highlight-toggle input');
  const highlights = find<SVGSVGElement>('.aw-highlights');
  const ticks = [...root.querySelectorAll<HTMLElement>('.aw-tick')];
  const images = examples.map(([, label]) => {
    const image = new Image(775, 308);
    image.alt = `${label}: spectrogram of the same LJ Speech excerpt.`;
    image.decoding = 'async';
    image.hidden = true;
    plot.append(image);
    return image;
  });
  let selected = 0;
  let rotating = !reducedMotion.matches;
  let hovering = false;
  let visible = false;
  let pageActive = true;
  let timer: number | undefined;
  const active = () => visible && pageActive && !document.hidden && !signal.aborted;

  function loadImage(index: number) {
    if (!images[index].hasAttribute('src')) images[index].src = asset(`${examples[index][0]}.png`);
  }

  function updateHighlights() {
    const method = examples[selected][0];
    const regions = signalRegions[method];
    highlights.dataset.method = method;
    highlights.toggleAttribute('hidden', !highlightToggle.checked || regions.length === 0);
    // Static SVG overlays scale with the image. No bitmap changes, rendering
    // loops, extra downloads or annotations on the unwatermarked reference.
    highlights.innerHTML = regions.map(([x, y, width, height]) => {
      const geometry = `x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.min(width, height) * .2}"`;
      return `<rect class="aw-highlight-edge" ${geometry} /><rect class="aw-highlight-region" ${geometry} />`;
    }).join('');
  }

  function select(index: number) {
    selected = index;
    loadImage(index);
    images.forEach((image, i) => { image.hidden = i !== index; });
    ticks.forEach((tick, i) => tick.classList.toggle('aw-current', i === index));
    name.textContent = examples[index][1];
    subtitle.textContent = index === 0 ? 'audio file from the LJSpeech data set' : 'spymarked audio';
    count.textContent = `${index + 1} / ${examples.length}`;
    slider.value = String(index);
    slider.setAttribute('aria-valuetext', examples[index][1]);
    updateHighlights();
    if (active() && rotating) loadImage((index + 1) % examples.length);
  }

  function schedule() {
    window.clearTimeout(timer);
    cycle.textContent = rotating ? 'Pause cycle' : 'Auto cycle';
    cycle.setAttribute('aria-pressed', String(rotating));
    if (active() && rotating && !hovering) {
      timer = window.setTimeout(() => {
        select((selected + 1) % examples.length);
        schedule();
      }, 2000);
    }
  }

  highlightToggle.addEventListener('change', updateHighlights, { signal });
  slider.addEventListener('input', () => {
    rotating = false;
    select(slider.valueAsNumber);
    schedule();
  }, { signal });
  slider.addEventListener('focus', () => { rotating = false; schedule(); }, { signal });
  // Hover anywhere along the track or its labels to choose the nearest tick.
  find<HTMLElement>('.aw-slider').addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !hoverCapable.matches || event.buttons) return;
    const tick = (event.target as Element).closest<HTMLElement>('.aw-tick');
    if (tick) { select(ticks.indexOf(tick)); return; }
    const bounds = scale.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    select(Math.round(fraction * (examples.length - 1)));
  }, { signal });
  cycle.addEventListener('click', () => { rotating = !rotating; schedule(); }, { signal });
  root.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && hoverCapable.matches) { hovering = true; schedule(); }
  }, { signal });
  root.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') { hovering = false; schedule(); }
  }, { signal });
  root.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') { hovering = false; schedule(); }
  }, { signal });
  hoverCapable.addEventListener('change', () => {
    if (!hoverCapable.matches) { hovering = false; schedule(); }
  }, { signal });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) rotating = false;
    schedule();
  }, { signal });
  document.addEventListener('visibilitychange', schedule, { signal });
  window.addEventListener('pagehide', () => { pageActive = false; schedule(); }, { signal });
  window.addEventListener('pageshow', () => { pageActive = true; schedule(); }, { signal });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
    if (active() && rotating) loadImage((selected + 1) % examples.length);
    schedule();
  }, { threshold: [0, 0.15] });
  observer.observe(root);
  select(0);
  schedule();

  return () => {
    events.abort();
    observer.disconnect();
    window.clearTimeout(timer);
  };
};

export default mount;
