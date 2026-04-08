export type FontKey = 'caveat' | 'sans' | 'mono' | 'bangers' | 'boogaloo';

export const FONTS: { key: FontKey; label: string; css: string; lineWidthMult: number }[] = [
  { key: 'caveat',   label: 'Handwritten', css: "'Caveat', cursive",                         lineWidthMult: 0.072 },
  { key: 'sans',     label: 'Sans',        css: "system-ui, -apple-system, sans-serif",       lineWidthMult: 0.11  },
  { key: 'mono',     label: 'Mono',        css: "ui-monospace, 'Courier New', monospace",     lineWidthMult: 0.075 },
  { key: 'bangers',  label: 'Comic',       css: "'Bangers', cursive",                         lineWidthMult: 0.16  },
  { key: 'boogaloo', label: 'Cartoon',     css: "'Boogaloo', cursive",                        lineWidthMult: 0.13  },
];

export function getFontCss(key: FontKey): string {
  return FONTS.find((f) => f.key === key)?.css ?? FONTS[0].css;
}

export function getLineWidthMult(key: FontKey): number {
  return FONTS.find((f) => f.key === key)?.lineWidthMult ?? 0.072;
}

export type SizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const SIZES: { key: SizeKey; label: string; mult: number }[] = [
  { key: 'xs', label: 'XS', mult: 0.3  },
  { key: 'sm', label: 'S',  mult: 0.45 },
  { key: 'md', label: 'M',  mult: 0.65 },
  { key: 'lg', label: 'L',  mult: 0.85 },
  { key: 'xl', label: 'XL', mult: 1.1  },
];
