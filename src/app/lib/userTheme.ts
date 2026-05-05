export type ThemePreset = 'default' | 'ocean' | 'forest' | 'sunset' | 'slate';

export const THEME_PRESET_OPTIONS: Array<{ value: ThemePreset; label: string }> = [
  { value: 'default', label: 'Default Blue' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'forest', label: 'Forest' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'slate', label: 'Slate' },
];

export function normalizeThemePreset(value: unknown): ThemePreset {
  if (value === 'ocean' || value === 'forest' || value === 'sunset' || value === 'slate') {
    return value;
  }
  return 'default';
}

export function applyThemePreset(value: unknown) {
  if (typeof document === 'undefined') return;
  const preset = normalizeThemePreset(value);
  document.documentElement.setAttribute('data-app-theme', preset);
}
