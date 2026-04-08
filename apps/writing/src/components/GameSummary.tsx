import { useState, useEffect, useCallback } from 'react';
import type { ThemeInfo } from '../lib/themes';
import type { GameConfig } from './GameSetup';
import { FONTS, SIZES } from '../lib/fonts';
import { generateResultsImage } from '../lib/shareImage';
import ShapeIcon from './ShapeIcon';
import type { ShapeKind } from '../lib/shapes';
import { ALL_SHAPES } from '../lib/shapes';

const MODE_LABELS: Record<string, string> = {
  uppercase: 'A–Z', lowercase: 'a–z', numbers: '0–9', words: 'Words', sentences: 'Sentences',
};

export type RoundResult = {
  target: string;
  score: number;
  timeMs: number | null;
  strokeCount: number | null;
};

function formatTime(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function getBadge(score: number) {
  if (score >= 85) return { emoji: '🔥', label: 'Excellent!',  bg: '#10b981', glow: 'rgba(16,185,129,0.3)'  };
  if (score >= 70) return { emoji: '✨', label: 'Nice job!',   bg: '#3b82f6', glow: 'rgba(59,130,246,0.3)'  };
  if (score >= 50) return { emoji: '👍', label: 'Good effort', bg: '#f59e0b', glow: 'rgba(245,158,11,0.3)'  };
  if (score >= 30) return { emoji: '💪', label: 'Keep trying', bg: '#f97316', glow: 'rgba(249,115,22,0.3)'  };
  return               { emoji: '😅', label: 'Needs work',  bg: '#ef4444', glow: 'rgba(239,68,68,0.3)'   };
}

function scoreColor(score: number): string {
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#3b82f6';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

type Props = {
  results: RoundResult[];
  theme: ThemeInfo;
  config?: GameConfig;
  onPlayAgain: () => void;
  onNewGame: () => void;
  onHome: () => void;
};

export default function GameSummary({ results, theme, config, onPlayAgain, onNewGame, onHome }: Props) {
  const avgScore = Math.round(results.reduce((a, r) => a + r.score, 0) / results.length);
  const bestScore = Math.max(...results.map((r) => r.score));
  const totalTime = results.reduce((a, r) => a + (r.timeMs ?? 0), 0);
  const badge = getBadge(avgScore);
  const displayAvg = useCountUp(avgScore);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const blob = await generateResultsImage(results, theme, config);
      const filename = config?.seed !== undefined
        ? `writing-${config.seed}.png`
        : 'writing-results.png';
      // Use Web Share only on touch devices (mobile); always download on desktop
      const isTouchDevice = navigator.maxTouchPoints > 0;
      const file = new File([blob], filename, { type: 'image/png' });
      if (isTouchDevice && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Writing score: ${avgScore}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setSharing(false);
    }
  }, [results, theme, config, avgScore]);

  const d = theme.isDark;
  const txt      = d ? 'text-white'       : 'text-black/85';
  const txtMid   = d ? 'text-white/40'    : 'text-black/45';
  const txtWeak  = d ? 'text-white/20'    : 'text-black/20';
  const border   = d ? 'border-white/8'   : 'border-black/8';
  const rowBg    = d ? 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.07]'
                     : 'bg-black/[0.03] border-black/[0.06] hover:bg-black/[0.05]';
  const btnSecondary = d
    ? 'bg-white/8 hover:bg-white/15 text-white border border-white/10'
    : 'bg-black/5 hover:bg-black/10 text-black/80 border border-black/10';
  const btnPrimary = d
    ? 'bg-white text-black hover:bg-white/90'
    : 'bg-black/90 text-white hover:bg-black/80';

  return (
    <div className="flex flex-col w-screen h-dvh select-none overflow-hidden" style={{ background: theme.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Top bar */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${border} shrink-0`}>
        {/* Drawtool wordmark */}
        <div className="flex items-center gap-1">
          <button onClick={onHome} className={`${txtMid} text-xs font-medium`}>writing</button>
          <span className={`${txtWeak} text-xs`}>by</span>
          <a href="https://drawtool.io" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'Pacifico', cursive", fontSize: '0.8rem', lineHeight: 1, textDecoration: 'none' }}>
            {([
              { letter: 'd', color: '#3b82f6', rotate: -6 },
              { letter: 'r', color: '#ef4444', rotate: 3 },
              { letter: 'a', color: '#22c55e', rotate: -4 },
              { letter: 'w', color: '#eab308', rotate: 5 },
              { letter: 't', color: '#ec4899', rotate: -3 },
              { letter: 'o', color: '#f97316', rotate: 4 },
              { letter: 'o', color: '#8b5cf6', rotate: -5 },
              { letter: 'l', color: '#06b6d4', rotate: 3 },
            ] as const).map((l, i) => (
              <span key={i} style={{ display: 'inline-block', marginLeft: i === 0 ? 0 : 1, transform: `rotate(${l.rotate}deg)` }}>
                <span style={{ color: l.color, display: 'inline-block', textShadow: `0 0 6px ${l.color}44` }}>{l.letter}</span>
              </span>
            ))}
          </a>
        </div>
        <div className="flex items-center gap-3">
          {config?.seed !== undefined && (
            <span className={`${txtWeak} text-xs tabular-nums opacity-60`}>{config.seed}</span>
          )}
          <span className={`${txtWeak} text-xs tabular-nums`}>{results.length} rounds</span>
        </div>
      </div>

      {/* Hero */}
      <div className={`flex flex-col gap-3 px-6 py-4 border-b ${border} shrink-0`}>
        {/* Top row: badge + verdict + config */}
        <div className="flex items-center gap-4">
          {/* Score badge */}
          <div
            className="shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
            style={{ background: badge.bg, boxShadow: `0 8px 32px ${badge.glow}` }}
          >
            <span className="text-white text-2xl font-black tabular-nums leading-none">{displayAvg}</span>
            <span className="text-white/50 text-[10px] mt-0.5 tracking-widest">avg</span>
          </div>

          {/* Verdict + stats */}
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none">{badge.emoji}</span>
              <span className={`text-lg font-bold leading-none ${txt}`}>{badge.label}</span>
            </div>
            <div className={`flex items-center gap-3 text-sm ${txtMid}`}>
              <span>
                best{' '}
                <span className="font-semibold tabular-nums" style={{ color: scoreColor(bestScore) }}>
                  {bestScore}
                </span>
              </span>
              <span className={txtWeak}>·</span>
              <span>
                <span className={`${txt} font-medium tabular-nums`}>{formatTime(totalTime)}</span>
                {' '}total
              </span>
            </div>
          </div>

          {/* Game config summary — desktop only */}
          {config && !config.shapesMode && (() => {
            const allModeLabels = config.modes.map((m) => MODE_LABELS[m] ?? m);
            const allFontLabels = FONTS.filter((f) => config.fontKeys.includes(f.key)).map((f) => f.label);
            const allSizeLabels = SIZES.filter((s) => config.sizeKeys.includes(s.key)).map((s) => s.label);
            const rows: [string, string][] = [
              ['content', allModeLabels.join(', ')],
              ['font',    allFontLabels.length === FONTS.length ? 'All' : allFontLabels.join(', ')],
              ['size',    allSizeLabels.length === SIZES.length ? 'All' : allSizeLabels.join(', ')],
            ];
            return (
              <div className={`hidden md:flex shrink-0 flex-col gap-1.5 pl-5 border-l ${border}`}>
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className={`${txtWeak} text-[10px] tracking-widest uppercase w-14 shrink-0`}>{label}</span>
                    <span className={`${txtMid} text-xs leading-snug`}>{value}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Game config summary — mobile only */}
        {config && !config.shapesMode && (() => {
          const allModeLabels = config.modes.map((m) => MODE_LABELS[m] ?? m);
          const allFontLabels = FONTS.filter((f) => config.fontKeys.includes(f.key)).map((f) => f.label);
          const allSizeLabels = SIZES.filter((s) => config.sizeKeys.includes(s.key)).map((s) => s.label);
          return (
            <div className={`md:hidden grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t ${border}`}>
              {([
                ['content', allModeLabels.length === Object.keys(MODE_LABELS).length ? 'All' : allModeLabels.join(', ')],
                ['font',    allFontLabels.length === FONTS.length ? 'All' : allFontLabels.join(', ')],
                ['size',    allSizeLabels.length === SIZES.length ? 'All' : allSizeLabels.join(', ')],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-1.5 min-w-0">
                  <span className={`${txtWeak} text-[10px] tracking-widest uppercase shrink-0`}>{label}</span>
                  <span className={`${txtMid} text-xs truncate`}>{value}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Rounds list */}
      <div className="flex-1 overflow-y-auto px-5 py-2">
        <div className="max-w-xl mx-auto flex flex-col gap-1.5">
          {results.map((r, i) => {
            const color = scoreColor(r.score);
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors ${rowBg}`}
              >
                <span className={`${txtWeak} text-xs w-5 shrink-0 tabular-nums text-right`}>{i + 1}</span>

                <div className="w-0.5 h-8 rounded-full shrink-0" style={{ background: color, opacity: 0.7 }} />

                {config?.shapesMode ? (
                  <div className={`flex items-center gap-1.5 flex-1 min-w-0 ${txt} opacity-85`}>
                    {r.target.split(' · ').map((k, ki) => {
                      const kind = k as ShapeKind;
                      if (!ALL_SHAPES.includes(kind)) return null;
                      return <ShapeIcon key={ki} kind={kind} size={18} />;
                    })}
                  </div>
                ) : (
                  <span
                    className={`font-semibold text-lg leading-none truncate flex-1 min-w-0 ${txt} opacity-85`}
                    style={{ fontFamily: "'Caveat', cursive" }}
                  >
                    {r.target}
                  </span>
                )}

                <div
                  className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums"
                  style={{ background: `${color}22`, color }}
                >
                  {r.score}
                </div>

                <span className={`${txtMid} text-xs tabular-nums shrink-0 w-12 text-right`}>
                  {r.timeMs !== null ? formatTime(r.timeMs) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className={`flex justify-center px-4 py-3 border-t ${border} shrink-0`}>
        <div className="flex items-center gap-2 w-full max-w-sm">
          <button
            onClick={handleShare}
            disabled={sharing}
            className={`h-10 px-3 rounded-xl text-sm transition-colors ${btnSecondary} flex items-center gap-1.5 whitespace-nowrap shrink-0`}
            title="Save as image"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M5 5l3-3 3 3"/>
              <path d="M3 11v2a1 1 0 001 1h8a1 1 0 001-1v-2"/>
            </svg>
            {sharing ? 'saving…' : 'share'}
          </button>
          <button onClick={onPlayAgain} className={`h-10 flex-1 rounded-xl text-sm transition-colors whitespace-nowrap ${btnSecondary}`}>
            Play Again
          </button>
          <button onClick={onNewGame} className={`h-10 flex-1 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${btnPrimary}`}>
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
