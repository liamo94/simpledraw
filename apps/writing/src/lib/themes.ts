export type Theme = 'dark' | 'midnight' | 'lumber' | 'slate' | 'white' | 'journal' | 'sky' | 'sand';

export type ThemeInfo = {
  key: Theme;
  label: string;
  bg: string;
  isDark: boolean;
  stroke: string;
};

export const THEMES: ThemeInfo[] = [
  { key: 'dark',     label: 'Dark',     bg: '#06060e', isDark: true,  stroke: '#ffffff' },
  { key: 'midnight', label: 'Midnight', bg: '#15152a', isDark: true,  stroke: '#ffffff' },
  { key: 'lumber',   label: 'Lumber',   bg: '#141404', isDark: true,  stroke: '#ffffff' },
  { key: 'slate',    label: 'Slate',    bg: '#1c2128', isDark: true,  stroke: '#ffffff' },
  { key: 'white',    label: 'White',    bg: '#f5f5f0', isDark: false, stroke: '#1a1a1a' },
  { key: 'journal',  label: 'Journal',  bg: '#fffce0', isDark: false, stroke: '#3a2a0a' },
  { key: 'sky',      label: 'Sky',      bg: '#eaf4fb', isDark: false, stroke: '#0a2a4a' },
  { key: 'sand',     label: 'Sand',     bg: '#f5ede8', isDark: false, stroke: '#3a1a0a' },
];

export function getTheme(key: Theme): ThemeInfo {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
