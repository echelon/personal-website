import type { EmbedMount } from '@brand/embeds';
import { watermarkRecords as samples } from './watermark-records';
import './text-watermarks.css';

// A deliberately simple, one-bit-per-choice illustration, NOT a SynthID decoder.
// The identifier is encoded in the words; all other fields live in this fictional lookup.
const choices = [
  ['dawn', 'sunrise'], ['quiet', 'silent'], ['traveler', 'wanderer'],
  ['winding', 'curving'], ['old', 'ancient'], ['harbor', 'port'],
  ['small', 'little'], ['journey', 'trip'],
] as const;
const fragments = ['At ', ', a ', ' ', ' followed a ', ' path toward the ', ' ',
  ', carrying a ', ' notebook to record the ', '.'];
const stages = ['Word choices', 'Binary digits', 'Database identifier', 'Database record'] as const;

const mount: EmbedMount = (root, { reducedMotion }) => {
  const events = new AbortController();
  const { signal } = events;
  root.classList.add('text-watermarks');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Text watermark: word choices to a database record');
  root.innerHTML = `
    <div class="tw-toolbar">
      <label class="tw-sample-label">Passage <select class="tw-sample" aria-label="Example passage">
        <option value="0">A</option><option value="1">B</option><option value="2">C</option>
      </select></label>
    </div>
    <p class="tw-passage">${fragments.map((fragment, i) => fragment + (i < choices.length
      ? `<button type="button" class="tw-word" data-index="${i}" aria-pressed="false"></button>` : '')).join('')}</p>
    <p class="tw-inspector">Tap a highlighted word to inspect its code.</p>
    <div class="tw-bit-heading"><span>Eight choices → eight bits</span><span class="tw-legend"><span data-bit="0">0</span> / <span data-bit="1">1</span></span></div>
    <div class="tw-bits" role="group" aria-label="Encoded bits, left to right">${choices.map((_, i) =>
      `<span class="tw-bit" data-index="${i}"><span class="tw-digit" aria-hidden="true"></span></span>`).join('')}</div>
    <p class="tw-equation"></p>
    <div class="tw-record">
      <div class="tw-record-heading">Example database <span class="tw-record-status">Awaiting key</span></div>
      <dl><div><dt>Database ID</dt><dd data-field="id">—</dd></div><div><dt>Author name</dt><dd data-field="author">—</dd></div>
        <div><dt>Date</dt><dd data-field="date">—</dd></div><div><dt>Time</dt><dd data-field="time">—</dd></div></dl>
    </div>
    <div class="tw-controls">
      <label class="tw-scrubber"><span class="tw-step-labels" aria-hidden="true"><span>Words</span><span>Bits</span><span>ID</span><span>Record</span></span>
        <input class="tw-progress" type="range" min="0" max="3" step="1" value="0" aria-label="Trace the watermark">
      </label>
      <button class="tw-play" type="button">Pause</button>
    </div>
    <p class="tw-note">One bit per chosen word in this demo. The author and timestamp come from the fictional database record. This is just a toy, okay?</p>
    <span class="tw-announcement sr-only" role="status"></span>`;

  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const words = [...root.querySelectorAll<HTMLButtonElement>('.tw-word')];
  const bits = [...root.querySelectorAll<HTMLElement>('.tw-bit')];
  const digits = [...root.querySelectorAll<HTMLElement>('.tw-digit')];
  const labels = [...root.querySelectorAll<HTMLElement>('.tw-step-labels span')];
  const sample = find<HTMLSelectElement>('.tw-sample');
  const inspector = find<HTMLElement>('.tw-inspector');
  const equation = find<HTMLElement>('.tw-equation');
  const record = find<HTMLElement>('.tw-record');
  const recordStatus = find<HTMLElement>('.tw-record-status');
  const progress = find<HTMLInputElement>('.tw-progress');
  const play = find<HTMLButtonElement>('.tw-play');
  const announcement = find<HTMLElement>('.tw-announcement');
  const fields = ['id', 'author', 'date', 'time'] as const;
  const values = fields.map(field => find<HTMLElement>(`[data-field="${field}"]`));
  let sampleIndex = 0;
  let step = reducedMotion.matches ? 3 : 0;
  let selectedWord = -1;
  let playing = !reducedMotion.matches;
  let visible = false;
  let pageActive = true;
  let timer: number | undefined;
  let animations: Animation[] = [];
  const active = () => visible && pageActive && !document.hidden && !signal.aborted;
  const binary = () => samples[sampleIndex].id.toString(2).padStart(8, '0');

  function stopEffects() {
    // Natural end styles are static. Pause leaves no animation or rendering loop running.
    animations.forEach(animation => animation.cancel());
    animations = [];
  }

  function render() {
    const code = binary();
    root.dataset.step = String(step);
    words.forEach((word, i) => {
      const bit = Number(code[i]) as 0 | 1;
      word.textContent = choices[i][bit];
      word.dataset.bit = code[i];
      word.setAttribute('aria-pressed', String(i === selectedWord));
      word.setAttribute('aria-label', `${choices[i][bit]}, choice ${i + 1}, encodes ${bit}. Inspect alternatives.`);
      bits[i].dataset.bit = code[i];
      bits[i].classList.toggle('tw-selected', i === selectedWord);
      bits[i].setAttribute('aria-label', `Bit ${i + 1}: ${step >= 1 ? bit : 'not decoded yet'}`);
      digits[i].textContent = step >= 1 ? code[i] : '·';
    });
    if (selectedWord < 0) inspector.textContent = 'Tap a highlighted word to inspect its code.';
    else {
      const pair = choices[selectedWord];
      inspector.innerHTML = `Choice ${selectedWord + 1}: <span data-bit="0">${pair[0]} = 0</span> <span class="tw-or">/</span> <span data-bit="1">${pair[1]} = 1</span>`;
    }
    equation.innerHTML = step >= 2
      ? `<span class="tw-binary">${code}<sub>2</sub></span><span aria-hidden="true"> → </span><strong>${parseInt(code, 2)}<sub>10</sub></strong><span class="tw-key-label">Lookup key</span>`
      : '<span class="tw-equation-hint">The bits combine into a database key.</span>';
    record.classList.toggle('tw-found', step === 3);
    recordStatus.textContent = step === 3 ? 'Record found' : 'Awaiting key';
    fields.forEach((field, i) => {
      values[i].textContent = step === 3 ? String(samples[sampleIndex][field]) : '—';
    });
    progress.value = String(step);
    progress.setAttribute('aria-valuetext', stages[step]);
    labels.forEach((label, i) => label.classList.toggle('tw-current', i === step));
  }

  function animateStep() {
    if (reducedMotion.matches || !active()) return;
    if (step === 1) {
      // Measure only on a stage change. The browser animates transforms; no RAF or canvas.
      const starts = words.map(word => word.getBoundingClientRect());
      const ends = digits.map(digit => digit.getBoundingClientRect());
      animations = digits.map((digit, i) => {
        const x = starts[i].x + starts[i].width / 2 - ends[i].x - ends[i].width / 2;
        const y = starts[i].y + starts[i].height / 2 - ends[i].y - ends[i].height / 2;
        return digit.animate([
          { transform: `translate(${x}px, ${y}px) scale(.75)`, opacity: 0 },
          { opacity: 1, offset: .15 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        ], { duration: 750, delay: i * 65, easing: 'cubic-bezier(.25,.7,.25,1)', fill: 'backwards' });
      });
    } else if (step >= 2) {
      const target = step === 2 ? equation : record;
      animations = [target.animate([
        { transform: 'translateY(-6px)', opacity: .35 },
        { transform: 'translateY(0)', opacity: 1 },
      ], { duration: 400, easing: 'ease-out' })];
    }
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = undefined;
    play.textContent = playing ? 'Pause' : 'Play';
    play.setAttribute('aria-label', playing ? 'Pause watermark animation' : 'Play watermark animation');
    // Reduced motion keeps every stage available through the range control.
    play.hidden = reducedMotion.matches;
    if (!active() || !playing || reducedMotion.matches) { stopEffects(); return; }
    timer = window.setTimeout(() => {
      stopEffects();
      step = (step + 1) % stages.length;
      render();
      animateStep();
      schedule();
    }, step === 3 ? 4000 : 2200);
  }

  function announce() {
    const entry = samples[sampleIndex];
    announcement.textContent = step === 3
      ? `Record ${entry.id}: ${entry.author}, ${entry.date}, ${entry.time}. Fictional example.`
      : `${stages[step]}${step >= 1 ? `: ${binary()}` : ''}${step === 2 ? `, database key ${entry.id}` : ''}.`;
  }

  words.forEach((word, i) => word.addEventListener('click', () => {
    playing = false;
    selectedWord = i;
    step = Math.max(1, step);
    stopEffects();
    render();
    schedule();
    announcement.textContent = `Choice ${i + 1}: ${choices[i][0]} encodes zero; ${choices[i][1]} encodes one. Selected: ${word.textContent}.`;
  }, { signal }));
  progress.addEventListener('input', () => {
    playing = false;
    step = progress.valueAsNumber;
    stopEffects();
    render();
    schedule();
    announce();
  }, { signal });
  // Keyboard focus stops automatic changes before the reader starts navigating.
  root.addEventListener('focusin', event => {
    if (event.target === play) return;
    playing = false;
    schedule();
  }, { signal });
  sample.addEventListener('change', () => {
    sampleIndex = Number(sample.value);
    selectedWord = -1;
    stopEffects();
    render();
    schedule();
    announce();
  }, { signal });
  play.addEventListener('click', () => { playing = !playing; schedule(); }, { signal });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) playing = false;
    schedule();
  }, { signal });
  document.addEventListener('visibilitychange', schedule, { signal });
  window.addEventListener('pagehide', () => { pageActive = false; schedule(); }, { signal });
  window.addEventListener('pageshow', () => { pageActive = true; schedule(); }, { signal });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= .15;
    schedule();
  }, { threshold: [0, .15] });
  observer.observe(root);
  render();
  schedule();

  return () => {
    events.abort();
    observer.disconnect();
    window.clearTimeout(timer);
    stopEffects();
  };
};

export default mount;
