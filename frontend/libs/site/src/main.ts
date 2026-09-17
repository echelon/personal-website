import './site.css';
import type { EmbedMount } from '@brand/embeds';
import type {} from './theme.ts';
import { watchOutboundLinks } from './outbound-links.ts';
const preferences = window.brandTheme;
const themes = preferences.themes;
const control = document.querySelector<HTMLButtonElement>('#theme-cycle');

function applyTheme(value: string) {
  const index = themes.findIndex(theme => theme.id === value);
  if (index < 0) return;
  document.documentElement.dataset.theme = value;
  const current = themes[index];
  const next = themes[(index + 1) % themes.length];
  const label = `${current.label} theme (${index + 1} of ${themes.length}). Switch to ${next.label}.`;
  control?.setAttribute('aria-label', label);
  control?.setAttribute('title', label);
}

if (control) {
  applyTheme(document.documentElement.dataset.theme ?? 'day');
  control.hidden = false;
  control.addEventListener('click', () => {
    const index = themes.findIndex(theme => theme.id === document.documentElement.dataset.theme);
    const next = themes[(index + 1) % themes.length];
    applyTheme(next.id);
    preferences.saveTheme(next.id);
  });
  // Cookies are shared between tabs. Refresh the label and palette on return.
  window.addEventListener('focus', () => {
    const saved = preferences.readSavedTheme();
    if (saved) applyTheme(saved);
  });
}

const cleanupCallbacks: Array<() => void> = [];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
async function mountEmbed(root: HTMLElement) {
  const src = root.dataset.embedSrc;
  if (!src || root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  root.setAttribute('aria-busy', 'true');
  const fallback = root.querySelector('.embed-fallback')?.textContent ?? 'This figure could not be loaded.';
  let stopLinkObserver: (() => void) | undefined;
  try {
    const module = await import(/* @vite-ignore */ src) as { default: EmbedMount };
    if (typeof module.default !== 'function') throw new Error(`Embed ${src} needs a default mount function`);
    root.replaceChildren();
    const siteOrigin = root.closest<HTMLElement>('[data-nofollow-external-links]')?.dataset.nofollowExternalLinks;
    if (siteOrigin) stopLinkObserver = watchOutboundLinks(root, siteOrigin);
    const cleanup = await module.default(root, { reducedMotion });
    // esbuild emits a sibling CSS file for any CSS imported by this entry point.
    // These styles are loaded by the generator's head manifest, not guessed at runtime.
    if (typeof cleanup === 'function') cleanupCallbacks.push(cleanup);
    if (stopLinkObserver) cleanupCallbacks.push(stopLinkObserver);
  } catch (error) {
    stopLinkObserver?.();
    const message = document.createElement('p');
    message.className = 'embed-fallback';
    message.textContent = fallback;
    root.replaceChildren(message);
    console.error('Article embed failed:', error);
  } finally {
    root.removeAttribute('aria-busy');
  }
}

const roots = document.querySelectorAll<HTMLElement>('[data-embed-src]');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        void mountEmbed(entry.target as HTMLElement);
      }
    }
  }, { rootMargin: '240px' });
  roots.forEach(root => observer.observe(root));
} else {
  roots.forEach(root => void mountEmbed(root));
}
window.addEventListener('pagehide', event => {
  if (!event.persisted) cleanupCallbacks.forEach(cleanup => cleanup());
});
