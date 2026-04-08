import type { RoundResult } from '../components/GameSummary';
import type { GameConfig } from '../components/GameSetup';
import type { ThemeInfo } from './themes';
import { FONTS, SIZES } from './fonts';

const MODE_LABELS: Record<string, string> = {
  uppercase: 'A–Z', lowercase: 'a–z', numbers: '0–9', words: 'Words', sentences: 'Sentences', custom: 'Custom',
};

const DRAWTOOL_LETTERS = [
  { letter: 'd', color: '#3b82f6', rotate: -6 },
  { letter: 'r', color: '#ef4444', rotate: 3 },
  { letter: 'a', color: '#22c55e', rotate: -4 },
  { letter: 'w', color: '#eab308', rotate: 5 },
  { letter: 't', color: '#ec4899', rotate: -3 },
  { letter: 'o', color: '#f97316', rotate: 4 },
  { letter: 'o', color: '#8b5cf6', rotate: -5 },
  { letter: 'l', color: '#06b6d4', rotate: 3 },
] as const;

export function scoreColor(s: number) {
  if (s >= 85) return '#10b981';
  if (s >= 70) return '#3b82f6';
  if (s >= 50) return '#f59e0b';
  if (s >= 30) return '#f97316';
  return '#ef4444';
}

function badgeEmoji(s: number) {
  if (s >= 85) return '🔥';
  if (s >= 70) return '✨';
  if (s >= 50) return '👍';
  if (s >= 30) return '💪';
  return '😅';
}

function badgeLabel(s: number) {
  if (s >= 85) return 'Excellent!';
  if (s >= 70) return 'Nice job!';
  if (s >= 50) return 'Good effort';
  if (s >= 30) return 'Keep trying';
  return 'Needs work';
}

function fmt(ms: number) {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// Draw the "writing by drawtool" header branding, returns total width used
function drawBranding(ctx: CanvasRenderingContext2D, x: number, y: number, fgMid: string, fgWeak: string, sans: string): number {
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fgMid;
  ctx.font = `600 13px ${sans}`;
  ctx.fillText('writing', x, y);
  let cx = x + ctx.measureText('writing').width;

  ctx.fillStyle = fgWeak;
  ctx.font = `400 12px ${sans}`;
  ctx.fillText(' by ', cx, y);
  cx += ctx.measureText(' by ').width;

  // Drawtool colored letters in Pacifico
  ctx.font = `400 13px Pacifico, cursive`;
  for (const { letter, color, rotate } of DRAWTOOL_LETTERS) {
    const lw = ctx.measureText(letter).width + 1;
    ctx.save();
    ctx.translate(cx + lw / 2, y);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.fillStyle = color;
    ctx.shadowColor = `${color}55`;
    ctx.shadowBlur = 4;
    ctx.fillText(letter, -lw / 2, 0);
    ctx.restore();
    cx += lw;
  }
  ctx.shadowBlur = 0;
  return cx - x;
}

export async function generateResultsImage(
  results: RoundResult[],
  theme: ThemeInfo,
  config?: GameConfig,
): Promise<Blob> {
  await Promise.all([
    document.fonts.load('600 20px Caveat'),
    document.fonts.load('400 13px Pacifico'),
  ]);

  const DPR = 2;
  const W = 560;
  const PAD = 28;
  const HEADER_H = 44;
  const CONFIG_H = config ? 36 : 0;
  const HERO_H = 84;
  const ROW_H = 44;
  const totalH = HEADER_H + CONFIG_H + HERO_H + results.length * ROW_H + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = totalH * DPR;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);

  const d = theme.isDark;
  const fg     = d ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
  const fgMid  = d ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.48)';
  const fgWeak = d ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
  const div    = d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const sans   = '-apple-system, BlinkMacSystemFont, sans-serif';

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, totalH);

  // ── Header ──
  drawBranding(ctx, PAD, HEADER_H / 2, fgMid, fgWeak, sans);

  // Right: seed + rounds
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = `400 11px ${sans}`;
  const rightParts = [];
  if (config?.seed !== undefined) rightParts.push(String(config.seed));
  rightParts.push(`${results.length} rounds`);
  ctx.fillStyle = fgWeak;
  ctx.fillText(rightParts.join('  ·  '), W - PAD, HEADER_H / 2);
  ctx.textAlign = 'left';

  ctx.fillStyle = div;
  ctx.fillRect(0, HEADER_H, W, 1);

  // ── Config row ──
  let nextY = HEADER_H + 1;
  if (config) {
    const modeLabels = config.modes.map((m) => MODE_LABELS[m] ?? m);
    const fontLabels = FONTS.filter((f) => config.fontKeys.includes(f.key)).map((f) => f.label);
    const sizeLabels = SIZES.filter((s) => config.sizeKeys.includes(s.key)).map((s) => s.label);

    const sections: [string, string][] = [
      ['content', modeLabels.join(', ')],
      ['font',    fontLabels.length === FONTS.length ? 'All' : fontLabels.join(', ')],
      ['size',    sizeLabels.length === SIZES.length ? 'All' : sizeLabels.join(', ')],
    ];

    ctx.textBaseline = 'middle';
    const midY = nextY + CONFIG_H / 2;
    let cx = PAD;
    sections.forEach(([label, value], i) => {
      if (i > 0) {
        ctx.fillStyle = div;
        ctx.font = `400 11px ${sans}`;
        ctx.fillText('  ·  ', cx, midY);
        cx += ctx.measureText('  ·  ').width;
      }
      ctx.fillStyle = fgWeak;
      ctx.font = `500 10px ${sans}`;
      const labelUpper = label.toUpperCase();
      ctx.fillText(labelUpper, cx, midY);
      cx += ctx.measureText(labelUpper).width + 6;
      ctx.fillStyle = fgMid;
      ctx.font = `400 11px ${sans}`;
      ctx.fillText(value, cx, midY);
      cx += ctx.measureText(value).width;
    });

    ctx.fillStyle = div;
    ctx.fillRect(0, nextY + CONFIG_H, W, 1);
    nextY += CONFIG_H + 1;
  }

  // ── Hero ──
  const avgScore = Math.round(results.reduce((a, r) => a + r.score, 0) / results.length);
  const bestScore = Math.max(...results.map((r) => r.score));
  const totalTime = results.reduce((a, r) => a + (r.timeMs ?? 0), 0);
  const color = scoreColor(avgScore);
  const label = badgeLabel(avgScore);

  const hY = nextY;
  const badgeSize = 52;
  const badgeY = hY + (HERO_H - badgeSize) / 2;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(PAD, badgeY, badgeSize, badgeSize, 12);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = `bold 20px ${sans}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(avgScore), PAD + badgeSize / 2, badgeY + badgeSize / 2 - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `400 9px ${sans}`;
  ctx.fillText('avg', PAD + badgeSize / 2, badgeY + badgeSize / 2 + 11);
  ctx.textAlign = 'left';

  const tx = PAD + badgeSize + 14;
  ctx.font = `17px serif`;
  ctx.fillText(badgeEmoji(avgScore), tx, hY + 22);
  const emojiW = ctx.measureText(badgeEmoji(avgScore)).width + 6;
  ctx.fillStyle = fg;
  ctx.font = `bold 17px ${sans}`;
  ctx.fillText(label, tx + emojiW, hY + 22);

  const sy = hY + 50;
  ctx.fillStyle = fgMid;
  ctx.font = `400 12px ${sans}`;
  ctx.fillText('best ', tx, sy);
  const bw = ctx.measureText('best ').width;
  ctx.fillStyle = scoreColor(bestScore);
  ctx.font = `600 12px ${sans}`;
  ctx.fillText(String(bestScore), tx + bw, sy);
  const bnw = ctx.measureText(String(bestScore)).width;
  ctx.fillStyle = fgWeak;
  ctx.font = `400 12px ${sans}`;
  ctx.fillText('  ·  ', tx + bw + bnw, sy);
  const dw = ctx.measureText('  ·  ').width;
  ctx.fillStyle = fg;
  ctx.font = `500 12px ${sans}`;
  ctx.fillText(fmt(totalTime), tx + bw + bnw + dw, sy);
  const tw2 = ctx.measureText(fmt(totalTime)).width;
  ctx.fillStyle = fgMid;
  ctx.font = `400 12px ${sans}`;
  ctx.fillText(' total', tx + bw + bnw + dw + tw2, sy);

  ctx.fillStyle = div;
  ctx.fillRect(0, hY + HERO_H, W, 1);

  // ── Rounds ──
  const listY = hY + HERO_H + 1;
  results.forEach((r, i) => {
    const ry = listY + i * ROW_H;
    const mid = ry + ROW_H / 2;
    const rc = scoreColor(r.score);

    if (i > 0) {
      ctx.fillStyle = div;
      ctx.fillRect(PAD, ry, W - PAD * 2, 1);
    }

    ctx.fillStyle = fgWeak;
    ctx.font = `400 11px ${sans}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), PAD + 18, mid);
    ctx.textAlign = 'left';

    ctx.fillStyle = rc;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.roundRect(PAD + 26, mid - 12, 3, 24, 1.5);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.85;
    ctx.font = `600 20px Caveat, cursive`;
    ctx.fillText(r.target, PAD + 36, mid + 1);
    ctx.globalAlpha = 1;

    const timeStr = r.timeMs !== null ? fmt(r.timeMs) : '—';
    ctx.fillStyle = fgMid;
    ctx.font = `400 11px ${sans}`;
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, W - PAD, mid);

    ctx.font = `bold 11px ${sans}`;
    const scoreStr = String(r.score);
    const chipW = ctx.measureText(scoreStr).width + 14;
    const timeW = ctx.measureText(timeStr).width;
    const chipX = W - PAD - timeW - 10 - chipW;
    ctx.fillStyle = `${rc}28`;
    ctx.beginPath();
    ctx.roundRect(chipX, mid - 10, chipW, 20, 5);
    ctx.fill();
    ctx.fillStyle = rc;
    ctx.textAlign = 'center';
    ctx.fillText(scoreStr, chipX + chipW / 2, mid + 1);
    ctx.textAlign = 'left';
  });

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}
