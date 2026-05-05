export type ThemePreset = 'default' | 'ocean' | 'forest' | 'sunset' | 'slate';
export type BackgroundPreset = 'clean' | 'soft-grid' | 'mesh' | 'dots' | 'waves';

export const THEME_PRESET_OPTIONS: Array<{ value: ThemePreset; label: string }> = [
  { value: 'default', label: 'Default Blue' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'forest', label: 'Forest' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'slate', label: 'Slate' },
];

export const BACKGROUND_PRESET_OPTIONS: Array<{ value: BackgroundPreset; label: string }> = [
  { value: 'clean', label: 'Clean' },
  { value: 'soft-grid', label: 'Soft Grid' },
  { value: 'mesh', label: 'Mesh Glow' },
  { value: 'dots', label: 'Dots' },
  { value: 'waves', label: 'Waves' },
];

export function normalizeThemePreset(value: unknown): ThemePreset {
  if (value === 'ocean' || value === 'forest' || value === 'sunset' || value === 'slate') {
    return value;
  }
  return 'default';
}

export function normalizeBackgroundPreset(value: unknown): BackgroundPreset {
  if (value === 'soft-grid' || value === 'mesh' || value === 'dots' || value === 'waves') {
    return value;
  }
  return 'clean';
}

export function applyThemePreset(value: unknown) {
  if (typeof document === 'undefined') return;
  const preset = normalizeThemePreset(value);
  document.documentElement.setAttribute('data-app-theme', preset);
}

export function applyBackgroundPreset(value: unknown) {
  if (typeof document === 'undefined') return;
  const preset = normalizeBackgroundPreset(value);
  document.documentElement.setAttribute('data-app-bg', preset);
}
