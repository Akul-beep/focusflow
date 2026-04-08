export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'focusflow-theme';

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function applyThemePreference(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolveTheme(preference));
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'light';
}
