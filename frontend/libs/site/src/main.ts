import './site.css';
import type { EmbedMount } from '@brand/embeds';

const themes = ['day', 'night', 'forest', 'sunset'] as const;
const select = document.querySelector<HTMLSelectElement>('#theme-select');
const control = document.querySelector<HTMLElement>('.theme-control');

function applyTheme(value: string) {
  if (!themes.some(theme => theme === value)) return;
  document.documentElement.dataset.theme = value;
  if (select) select.value = value;
}

if (select && control) {
  applyTheme(document.documentElement.dataset.theme ?? 'day');
  control.hidden = false;
  select.addEventListener('change', () => {
    applyTheme(select.value);
    try { localStorage.setItem('brand-theme', select.value); } catch { /* Storage can be disabled. */ }
  });
  window.addEventListener('storage', event => {
    if (event.key === 'brand-theme' && event.newValue) applyTheme(event.newValue);
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
  try {
    const module = await import(/* @vite-ignore */ src) as { default: EmbedMount };
    if (typeof module.default !== 'function') throw new Error(`Embed ${src} needs a default mount function`);
    root.replaceChildren();
    const cleanup = await module.default(root, { reducedMotion });
    // esbuild emits a sibling CSS file for any CSS imported by this entry point.
    // These styles are loaded by the generator's head manifest, not guessed at runtime.
    if (typeof cleanup === 'function') cleanupCallbacks.push(cleanup);
  } catch (error) {
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
