export const themes = [
  { id: 'day', label: 'Day' },
  { id: 'sunset', label: 'Evening sunset' },
  { id: 'forest', label: 'Foggy forest' },
  { id: 'rain', label: 'Rain' },
  { id: 'night', label: 'Night' },
] as const;

export type ThemeId = typeof themes[number]['id'];

export interface ThemePreferences {
  themes: typeof themes;
  readSavedTheme(): ThemeId | undefined;
  saveTheme(value: ThemeId): void;
  resolveTheme(): ThemeId;
}

declare global {
  interface Window {
    brandTheme: ThemePreferences;
  }
}
