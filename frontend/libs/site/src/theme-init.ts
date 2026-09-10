import { themes, type ThemeId } from './theme.ts';

// Compiled to a classic script loaded before CSS to choose the theme before paint.
(() => {
  const isTheme = (value: unknown): value is ThemeId => themes.some(theme => theme.id === value);

  function readSavedTheme(): ThemeId | undefined {
    try {
      for (const part of document.cookie.split(';')) {
        const cookie = part.trim();
        if (!cookie.startsWith('brand-theme=')) continue;
        const value = decodeURIComponent(cookie.slice('brand-theme='.length));
        if (isTheme(value)) return value;
      }
    } catch { /* Cookie access may be disabled or its value malformed. */ }
    return undefined;
  }

  function saveTheme(value: ThemeId): void {
    if (!isTheme(value)) return;
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `brand-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch { /* The choice still works for the current page when cookies are blocked. */ }
  }

  function resolveTheme(): ThemeId {
    const saved = readSavedTheme();
    if (saved) return saved;
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'night';
      // "Light" also means no explicit preference, so let the local clock decide.
    } catch { /* Use local time when the browser cannot report a color scheme. */ }
    try {
      const hour = new Date().getHours();
      if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
        return hour >= 7 && hour < 19 ? 'day' : 'night';
      }
    } catch { /* Fall back to Day when the local clock is unavailable. */ }
    return 'day';
  }

  window.brandTheme = { themes, readSavedTheme, saveTheme, resolveTheme };
  document.documentElement.dataset.theme = resolveTheme();
})();
