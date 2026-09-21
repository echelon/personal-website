import type { EmbedMount } from '@brand/embeds';
import './spymark-title.css';

// Real SVG lettering, system fonts, and CSS animation: no JavaScript render loop,
// downloaded fonts, raster textures, or filters. All colors inherit the site palette.
const lettering = '<text x="350" y="169" text-anchor="middle" textLength="540" lengthAdjust="spacingAndGlyphs">Spymark</text>';

const mount: EmbedMount = (root, { reducedMotion }) => {
  const events = new AbortController();
  const { signal } = events;
  const columnGradient = `sm-column-${crypto.randomUUID()}`;
  root.classList.add('spymark-title');
  root.innerHTML = `
    <span class="sr-only">“Spymark”</span>
    <svg class="sm-art" viewBox="0 0 700 360" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${columnGradient}" gradientUnits="userSpaceOnUse" x1="350" y1="207" x2="350" y2="360">
          <stop offset="0" stop-color="currentColor" stop-opacity=".65" />
          <stop offset=".32" stop-color="currentColor" stop-opacity=".4" />
          <stop offset=".72" stop-color="currentColor" stop-opacity=".12" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g class="sm-tower" fill="currentColor">
        <path class="sm-tower-body" fill="url(#${columnGradient})" d="M295 207H405C396 254 398 303 380 360H320C302 303 304 254 295 207Z" />
        <path class="sm-tower-crown" d="M276 18C282 68 292 126 313 148Q350 181 387 148C408 126 418 68 424 18L429 145L441 128L438 179L420 190L405 216H295L280 190L262 179L259 128L271 145Z M324 205L344 181L350 148L356 181L376 205Z" />
        <path class="sm-tower-plane" d="M350 182L387 155L424 178L401 204L379 216H350Z" />
        <path class="sm-tower-ribs" d="M328 216L331 253 M350 216V258 M372 216L369 253" fill="none" stroke="var(--paper)" stroke-width="1.2" />
      </g>
      <g class="sm-eye-anchor">
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
    <button class="sm-toggle" type="button" aria-label="Resume Spymark animation">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2">
        <path class="sm-resume-icon" d="M4 2L13 8L4 14Z" />
        <path class="sm-pause-icon" d="M5 3v10M11 3v10" />
      </svg><span>Resume</span>
    </button>`;

  const button = root.querySelector<HTMLButtonElement>('.sm-toggle')!;
  const label = button.querySelector('span')!;
  const animated = [...root.querySelectorAll<SVGElement>(
    '.sm-word, .sm-echo-above, .sm-echo-below, .sm-eye, .sm-tendrils',
  )];
  const eyeAnchor = root.querySelector<SVGGElement>('.sm-eye-anchor')!;
  const gaze = root.querySelector<SVGGElement>('.sm-gaze')!;
  const forcedColors = window.matchMedia('(forced-colors: active)');
  const printing = window.matchMedia('print');
  let visible = false;
  let userPaused = false;
  let running = false;
  let phase = 0;
  let tracking: AbortController | undefined;
  let pointer: { x: number; y: number } | undefined;
  let touchStart: { id: number; x: number; y: number } | undefined;
  let gazeFrame = 0;

  function stopGazeFrame() {
    cancelAnimationFrame(gazeFrame);
    gazeFrame = 0;
  }

  function trackGaze() {
    if (!running || !pointer || gazeFrame) return;
    // Only input schedules a frame; never schedule an idle rendering loop.
    gazeFrame = requestAnimationFrame(() => {
      gazeFrame = 0;
      if (!running || !pointer) return;
      const matrix = eyeAnchor.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(pointer.x, pointer.y).matrixTransform(matrix.inverse());
      const dx = point.x - 350;
      const dy = point.y - 83;
      const distance = Math.max(80, Math.hypot(dx, dy));
      gaze.style.transform = `translate(${(dx / distance * 14).toFixed(2)}px, ${(dy / distance * 6).toFixed(2)}px)`;
    });
  }

  function rememberPointer(event: PointerEvent) {
    pointer = { x: event.clientX, y: event.clientY };
    trackGaze();
  }

  function startTracking() {
    tracking = new AbortController();
    const options = { passive: true, signal: tracking.signal };
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'touch') rememberPointer(event);
    }, options);
    // Scroll gestures must not replace the last tap; all touch handling is passive.
    document.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') {
        if (event.isPrimary) touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
      } else rememberPointer(event);
    }, options);
    document.addEventListener('pointerup', event => {
      if (touchStart?.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 10) rememberPointer(event);
      touchStart = undefined;
    }, options);
    document.addEventListener('pointercancel', () => { touchStart = undefined; }, options);
    window.addEventListener('scroll', trackGaze, options);
    window.addEventListener('resize', trackGaze, options);
    trackGaze();
  }

  function stop() {
    if (!running) return;
    running = false;
    tracking?.abort();
    tracking = undefined;
    touchStart = undefined;
    stopGazeFrame();

    // Capture this frame once, then remove the CSS animations entirely. Keeping
    // their phase lets Resume continue smoothly without a new entrance effect.
    const clock = root.getAnimations({ subtree: true }).find(animation =>
      animation instanceof CSSAnimation && animation.animationName === 'spymark-drift');
    if (typeof clock?.currentTime === 'number') phase += clock.currentTime;
    for (const element of [...animated, gaze]) {
      const style = getComputedStyle(element);
      element.style.opacity = style.opacity;
      element.style.transform = style.transform;
    }
    root.classList.remove('sm-playing');
  }

  function syncPlayback() {
    const motionAllowed = !reducedMotion.matches && !forcedColors.matches && !printing.matches;
    const shouldRun = motionAllowed && !userPaused && visible && !document.hidden;
    button.hidden = !motionAllowed;
    label.textContent = userPaused ? 'Resume' : 'Pause';
    button.setAttribute('aria-label', `${userPaused ? 'Resume' : 'Pause'} Spymark animation`);
    if (shouldRun === running) return;
    if (!shouldRun) { stop(); return; }

    for (const element of animated) {
      element.style.removeProperty('opacity');
      element.style.removeProperty('transform');
    }
    root.style.setProperty('--sm-phase', `${-phase}ms`);
    root.classList.add('sm-playing');
    running = true;
    startTracking();
  }

  button.addEventListener('click', () => {
    userPaused = !userPaused;
    syncPlayback();
  }, { signal });
  document.addEventListener('visibilitychange', syncPlayback, { signal });
  reducedMotion.addEventListener('change', syncPlayback, { signal });
  forcedColors.addEventListener('change', syncPlayback, { signal });
  printing.addEventListener('change', syncPlayback, { signal });
  syncPlayback();

  // Mounting may happen before the figure enters the viewport. Offscreen/hidden
  // states use the same static snapshot as Pause, without changing user intent.
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.25;
    syncPlayback();
  }, { threshold: 0.25 }) : undefined;
  if (observer) observer.observe(root);
  else { visible = true; syncPlayback(); }

  return () => {
    stop();
    events.abort();
    observer?.disconnect();
  };
};

export default mount;
