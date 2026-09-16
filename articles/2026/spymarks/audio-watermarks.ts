import type { EmbedMount } from '@brand/embeds';
import './audio-watermarks.css';

// Original LJ examples: https://sokaudiowm.github.io/#watermarked-audio-samples
// Entries compile to _embeds/, alongside the article's copied media directory.
const asset = (name: string) => new URL(`../media/audio-watermarks/${name}`, import.meta.url).href;
const examples = [
  ['unwatermarked', 'Unwatermarked'],
  ['timbre', 'Timbre'],
  ['audioseal', 'AudioSeal'],
  ['wavmark', 'WavMark'],
  ['fsvc', 'FSVC'],
  ['patchwork', 'Patchwork'],
  ['norm-space', 'Norm-Space'],
] as const;

const mount: EmbedMount = (root, { reducedMotion }) => {
  const events = new AbortController();
  const { signal } = events;
  const hoverCapable = window.matchMedia('(any-hover: hover)');
  root.classList.add('audio-watermarks');
  root.innerHTML = `
    <div class="aw-heading"><strong class="aw-name"></strong><span class="aw-count"></span></div>
    <div class="aw-plot"></div>
    <p class="aw-axes">Frequency ↑ <span>Time → · 6.5 seconds</span></p>
    <div class="aw-choices" role="group" aria-label="Compare audio watermarks"></div>
    <p class="aw-hint">Hover to compare. On touch screens, tap a name to hold that view.</p>
    <div class="aw-controls">
      <button type="button" class="aw-cycle"></button>
      <button type="button" class="aw-play">Play audio</button>
      <progress class="aw-progress" max="6.5" value="0" aria-label="Audio playback position"></progress>
    </div>
    <p class="aw-status" role="status">Same speech excerpt; seven versions.</p>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const name = find<HTMLElement>('.aw-name');
  const count = find<HTMLElement>('.aw-count');
  const plot = find<HTMLElement>('.aw-plot');
  const choices = find<HTMLElement>('.aw-choices');
  const cycle = find<HTMLButtonElement>('.aw-cycle');
  const play = find<HTMLButtonElement>('.aw-play');
  const progress = find<HTMLProgressElement>('.aw-progress');
  const status = find<HTMLElement>('.aw-status');
  const audio = document.createElement('audio');
  audio.preload = 'none';
  audio.loop = true;
  root.append(audio);

  let selected = 0;
  let rotating = !reducedMotion.matches;
  let hovering = false;
  let visible = false;
  let pageActive = true;
  let autoplayAttempted = false;
  let wantsAudio = false;
  let sourceIndex = -1;
  let playbackRequest = 0;
  let position = 0;
  let timer: number | undefined;
  const active = () => visible && pageActive && !document.hidden && !signal.aborted;

  const images = examples.map(([, label]) => {
    const image = new Image(775, 308);
    image.alt = `${label}: spectrogram of the same LJ Speech excerpt.`;
    image.decoding = 'async';
    image.hidden = true;
    plot.append(image);
    return image;
  });
  const buttons = examples.map(([, label], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && hoverCapable.matches) select(index);
    }, { signal });
    button.addEventListener('click', () => {
      rotating = false;
      select(index);
      schedule();
    }, { signal });
    button.addEventListener('keydown', event => {
      let next: number;
      if (event.key === 'ArrowRight') next = (index + 1) % examples.length;
      else if (event.key === 'ArrowLeft') next = (index + examples.length - 1) % examples.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = examples.length - 1;
      else return;
      event.preventDefault();
      buttons[next].focus();
      select(next);
    }, { signal });
    choices.append(button);
    return button;
  });

  function loadImage(index: number) {
    if (!images[index].hasAttribute('src')) images[index].src = asset(`${examples[index][0]}.png`);
  }

  function select(index: number) {
    selected = index;
    loadImage(index);
    images.forEach((image, i) => { image.hidden = i !== index; });
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    name.textContent = examples[index][1];
    count.textContent = `${index + 1} / ${examples.length}`;
    audio.setAttribute('aria-label', `${examples[index][1]} audio sample`);
    if (wantsAudio) playSelected();
    // Only fetch the next plot while visible, so automatic comparisons don't flash.
    if (active() && rotating) loadImage((index + 1) % examples.length);
  }

  function updatePlayButton() {
    play.textContent = wantsAudio ? 'Pause audio' : 'Play audio';
    play.setAttribute('aria-pressed', String(wantsAudio));
  }

  function playSelected() {
    if (!active() || !wantsAudio) return;
    const request = ++playbackRequest;
    if (sourceIndex !== selected) {
      // One player; retain the phrase's playhead when comparing another method.
      if (audio.readyState >= 1) position = audio.currentTime;
      audio.pause();
      sourceIndex = selected;
      audio.src = asset(`${examples[selected][0]}.wav`);
      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = position % audio.duration;
          progress.max = audio.duration;
        }
      };
    }
    updatePlayButton();
    // Call play directly from gestures as well as the first visibility event.
    // Audible autoplay is allowed only when the browser permits it.
    void audio.play().then(() => {
      if (request === playbackRequest && wantsAudio && active()) {
        status.textContent = 'Audio follows the selected version.';
      }
    }).catch((error: unknown) => {
      if (request !== playbackRequest || signal.aborted) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      wantsAudio = false;
      updatePlayButton();
      status.textContent = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Tap Play audio to listen.' : 'Audio could not load. Tap Play audio to retry.';
    });
  }

  function schedule() {
    window.clearTimeout(timer);
    cycle.textContent = rotating ? 'Pause cycle' : 'Auto cycle';
    cycle.setAttribute('aria-pressed', String(rotating));
    if (active() && rotating && !hovering) {
      timer = window.setTimeout(() => {
        select((selected + 1) % examples.length);
        schedule();
      }, 3000);
    }
  }

  function syncVisibility() {
    if (active()) {
      if (!autoplayAttempted) {
        autoplayAttempted = true;
        wantsAudio = true;
      }
      if (wantsAudio) playSelected();
      if (rotating) loadImage((selected + 1) % examples.length);
    } else {
      ++playbackRequest;
      audio.pause();
    }
    schedule();
  }

  play.addEventListener('click', () => {
    wantsAudio = !wantsAudio;
    if (wantsAudio) playSelected();
    else {
      ++playbackRequest;
      audio.pause();
      status.textContent = 'Audio paused.';
    }
    updatePlayButton();
  }, { signal });
  audio.addEventListener('timeupdate', () => {
    if (audio.readyState >= 1) {
      position = audio.currentTime;
      progress.value = position;
    }
  }, { signal });
  cycle.addEventListener('click', () => {
    rotating = !rotating;
    schedule();
  }, { signal });
  root.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && hoverCapable.matches) { hovering = true; schedule(); }
  }, { signal });
  root.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') { hovering = false; schedule(); }
  }, { signal });
  root.addEventListener('pointerdown', event => {
    // A touchscreen can take over while a hybrid device's mouse still rests here.
    if (event.pointerType !== 'mouse') { hovering = false; schedule(); }
  }, { signal });
  hoverCapable.addEventListener('change', () => {
    if (!hoverCapable.matches) { hovering = false; schedule(); }
  }, { signal });
  root.addEventListener('focusin', event => {
    // Stop automatic changes for keyboard readers; restarting is explicit.
    if (event.target !== cycle) { rotating = false; schedule(); }
  }, { signal });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) rotating = false;
    schedule();
  }, { signal });
  document.addEventListener('visibilitychange', syncVisibility, { signal });
  window.addEventListener('pagehide', () => { pageActive = false; syncVisibility(); }, { signal });
  window.addEventListener('pageshow', () => { pageActive = true; syncVisibility(); }, { signal });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
    syncVisibility();
  }, { threshold: [0, 0.15] });
  observer.observe(root);
  select(0);
  updatePlayButton();
  schedule();

  return () => {
    events.abort();
    observer.disconnect();
    window.clearTimeout(timer);
    ++playbackRequest;
    audio.onloadedmetadata = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
};

export default mount;
