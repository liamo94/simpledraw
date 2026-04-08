import type { GameConfig } from '../components/GameSetup';
import type { ContentMode } from './content';
import type { FontKey, SizeKey } from './fonts';
import { ALL_SHAPES } from './shapes';

// ── Date helpers ──────────────────────────────────────────────────────────────

export function getDailyDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function formatDailyDate(): string {
  return new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ── Seeds ─────────────────────────────────────────────────────────────────────

export function getDailySeed(mode: 'text' | 'shapes'): number {
  const base = parseInt(getDailyDateKey(), 10); // e.g. 20260408
  return mode === 'shapes' ? base + 1_000_000 : base;
}

// ── Completion tracking ───────────────────────────────────────────────────────

function storageKey(mode: 'text' | 'shapes'): string {
  return `writing-daily-${getDailyDateKey()}-${mode}`;
}

export function isDailyDone(mode: 'text' | 'shapes'): boolean {
  return localStorage.getItem(storageKey(mode)) === 'done';
}

export function markDailyDone(mode: 'text' | 'shapes'): void {
  localStorage.setItem(storageKey(mode), 'done');
}

// ── Fixed daily configs ───────────────────────────────────────────────────────
// Config is predetermined so every player gets identical rounds.

const TEXT_MODES: ContentMode[] = ['uppercase', 'lowercase', 'numbers', 'words', 'sentences'];
const TEXT_FONTS: FontKey[] = ['caveat', 'bangers', 'boogaloo'];
const TEXT_SIZES: SizeKey[] = ['sm', 'md', 'lg'];

export function getDailyConfig(mode: 'text' | 'shapes'): GameConfig {
  if (mode === 'shapes') {
    return {
      rounds: 5,
      modes: [],
      fontKeys: [],
      sizeKeys: [],
      seed: getDailySeed('shapes'),
      shapesMode: {
        kinds: [...ALL_SHAPES],
        counts: [1, 2, 3],
        sizeKeys: ['sm', 'md', 'lg'],
      },
    };
  }
  return {
    rounds: 5,
    modes: TEXT_MODES,
    fontKeys: TEXT_FONTS,
    sizeKeys: TEXT_SIZES,
    seed: getDailySeed('text'),
  };
}
