import type { EmbedMount } from '@brand/embeds';
import './spymark-title.css';

// Real SVG lettering, system fonts, and finite CSS animations: no rendering loop,
// downloaded fonts, raster textures, or filters. All colors inherit the site palette.
const lettering = '<text x="350" y="169" text-anchor="middle" textLength="540" lengthAdjust="spacingAndGlyphs">Spymark</text>';

const mount: EmbedMount = (root, { reducedMotion }) => {
  const events = new AbortController();
  const { signal } = events;
  root.classList.add('spymark-title');
  root.innerHTML = `
    <span class="sr-only">“Spymark”</span>
    <svg class="sm-art" viewBox="0 0 700 360" aria-hidden="true" focusable="false">
      <g class="sm-tower" fill="currentColor">
        <path class="sm-tower-crown" d="M319 202L316 181L303 169L306 157L288 130L281 83L264 22L287 41L300 90L318 121L337 138L350 143L363 138L382 121L400 90L413 41L436 22L419 83L412 130L394 157L397 169L384 181L381 202Z" />
        <path class="sm-tower-body" d="M319 194L381 194L380 221L388 228L385 235L397 247L303 247L315 235L312 228L320 221Z" />
        <path class="sm-tower-ribs" d="M323 146L330 169L333 225 M337 155L340 228 M350 160V232 M363 155L360 228 M377 146L370 169L367 225" fill="none" stroke="var(--paper)" stroke-width="1.5" />
        <path class="sm-tower-rim" d="M309 168L328 177H372L391 168 M316 190H384 M318 213H382 M311 237H389" fill="none" stroke="currentColor" stroke-width="2" />
      </g>
      <g class="sm-eye">
        <path class="sm-fire-halo" d="M282 83L299 75L298 61L315 63L318 48L335 55L349 37L361 54L380 47L382 63L400 58L400 74L418 83L400 92L403 104L383 101L377 119L362 109L350 129L337 110L320 119L318 102L299 107L301 91Z" />
        <path class="sm-fire-edge" d="M292 83Q317 52 350 57Q383 52 408 83Q382 111 350 110Q317 111 292 83Z" />
        <g class="sm-fire-threads" fill="none">
          <path d="M301 81L323 69L320 62 M309 93L329 91L321 104 M329 60L340 75 M340 108L344 96 M371 61L360 73 M394 82L377 71L380 64 M390 94L374 91L377 103 M360 97L366 108" />
        </g>
        <g class="sm-gaze">
          <ellipse class="sm-iris" cx="350" cy="83" rx="12" ry="26" />
          <path class="sm-pupil" d="M350 59Q338 83 350 107Q362 83 350 59Z" />
          <path class="sm-pupil-core" d="M350 63Q345 83 350 103Q355 83 350 63Z" />
        </g>
      </g>
      <g transform="translate(0 130)">
      <g class="sm-tendrils" fill="none" stroke="currentColor" stroke-width=".85">
        <path d="M163 149C164 174 147 188 152 204S147 220 141 228 M163 181L172 194" />
        <path d="M275 163C268 182 279 191 265 212 M272 187L262 195" />
        <path d="M396 157C389 174 400 199 386 223 M394 198L403 210" />
        <path d="M548 147C536 170 550 192 534 211" />
      </g>
      <g class="sm-lettering sm-echo sm-echo-above">${lettering}</g>
      <g class="sm-lettering sm-echo sm-echo-below">${lettering}</g>
      <g class="sm-lettering sm-contour">${lettering}</g>
      <g class="sm-lettering sm-word">${lettering}</g>
      <g class="sm-quotes" fill="currentColor"><text x="27" y="120">“</text><text x="642" y="120">”</text></g>
      </g>
    </svg>
    <button class="sm-toggle" type="button" aria-label="Replay Spymark animation">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2">
        <path class="sm-replay-icon" d="M3 6a5 5 0 1 1 0 4M3 2v4h4" />
        <path class="sm-pause-icon" d="M5 3v10M11 3v10" />
      </svg><span>Replay</span>
    </button>`;

  const button = root.querySelector<HTMLButtonElement>('.sm-toggle')!;
  const label = button.querySelector('span')!;
  const word = root.querySelector('.sm-word')!;
  const art = root.querySelector<SVGSVGElement>('.sm-art')!;
  const gaze = root.querySelector<SVGGElement>('.sm-gaze')!;
  let visible = false;
  let introduced = false;
  let playing = false;
  let pointer: { x: number; y: number } | undefined;
  let touchStart: { id: number; x: number; y: number } | undefined;
  let gazeFrame = 0;

  function setPlaying(value: boolean) {
    playing = value;
    root.classList.remove('sm-playing');
    if (value) {
      // Flush a previous pause before a rapid keyboard/touch replay.
      void word.getBoundingClientRect();
      root.classList.add('sm-playing');
    }
    label.textContent = value ? 'Pause' : 'Replay';
    button.setAttribute('aria-label', `${value ? 'Pause' : 'Replay'} Spymark animation`);
  }

  function stopGazeFrame() {
    cancelAnimationFrame(gazeFrame);
    gazeFrame = 0;
  }

  function trackGaze() {
    if (!pointer || !visible || document.hidden || reducedMotion.matches || gazeFrame) return;
    // Coalesce input events into one paint, never schedule an idle animation loop.
    gazeFrame = requestAnimationFrame(() => {
      gazeFrame = 0;
      if (!pointer) return;
      const bounds = art.getBoundingClientRect();
      const scale = bounds.width / 700;
      if (!scale) return;
      const dx = (pointer.x - bounds.left) / scale - 350;
      const dy = (pointer.y - bounds.top) / scale - 83;
      const distance = Math.max(80, Math.hypot(dx, dy));
      gaze.style.transform = `translate(${(dx / distance * 14).toFixed(2)}px, ${(dy / distance * 6).toFixed(2)}px)`;
    });
  }

  function rememberPointer(event: PointerEvent) {
    pointer = { x: event.clientX, y: event.clientY };
    trackGaze();
  }
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') rememberPointer(event);
  }, { passive: true, signal });
  // A scroll gesture must not replace the last tap. Keep touch handling passive.
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') {
      if (event.isPrimary) touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    } else rememberPointer(event);
  }, { passive: true, signal });
  document.addEventListener('pointerup', event => {
    if (touchStart?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 10) rememberPointer(event);
    touchStart = undefined;
  }, { passive: true, signal });
  document.addEventListener('pointercancel', () => { touchStart = undefined; }, { passive: true, signal });
  window.addEventListener('scroll', trackGaze, { passive: true, signal });
  window.addEventListener('resize', trackGaze, { passive: true, signal });

  function introduce() {
    if (!visible || document.hidden || introduced) return;
    introduced = true;
    if (!reducedMotion.matches) setPlaying(true);
  }

  button.addEventListener('click', () => {
    if (!reducedMotion.matches && !document.hidden && visible) setPlaying(!playing);
  }, { signal });
  word.addEventListener('animationend', () => setPlaying(false), { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { setPlaying(false); stopGazeFrame(); }
    else { introduce(); trackGaze(); }
  }, { signal });
  function motionPreference() {
    button.hidden = reducedMotion.matches;
    if (reducedMotion.matches) {
      setPlaying(false);
      stopGazeFrame();
      gaze.style.removeProperty('transform');
    } else trackGaze();
  }
  reducedMotion.addEventListener('change', motionPreference, { signal });
  motionPreference();

  // The page preloads embeds near the viewport. Wait until the art itself is
  // visible, play once, and settle immediately if the reader scrolls away.
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.25;
    if (visible) { introduce(); trackGaze(); }
    else { setPlaying(false); stopGazeFrame(); }
  }, { threshold: 0.25 }) : undefined;
  if (observer) observer.observe(root);
  else { visible = true; introduce(); }

  return () => {
    setPlaying(false);
    stopGazeFrame();
    events.abort();
    observer?.disconnect();
  };
};

export default mount;
