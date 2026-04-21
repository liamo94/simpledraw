import { useState, useCallback, useRef } from 'react';
import AimTrainerCanvas from './AimTrainerCanvas';
import type { AimRoundResult } from './AimTrainerCanvas';
import type { ThemeInfo } from '../lib/themes';

const RESULT_DISPLAY_MS = 1400;

type RoundMode = 'infinite' | 3 | 5 | 10;
const MODES: { label: string; value: RoundMode }[] = [
  { label: '∞', value: 'infinite' },
  { label: '3', value: 3 },
  { label: '5', value: 5 },
  { label: '10', value: 10 },
];

type CircleConfig = { fx: number; fy: number; radius: number };
type GameState = 'playing' | 'between' | 'summary';

const SIZES = [20, 28, 38];

function genCircle(prevFx = 0.5, prevFy = 0.5): CircleConfig {
  let fx = 0, fy = 0, attempts = 0;
  do {
    fx = 0.12 + Math.random() * 0.76;
    fy = 0.15 + Math.random() * 0.7;
    const dist = Math.sqrt((fx - prevFx) ** 2 * 2.25 + (fy - prevFy) ** 2);
    if (dist > 0.25 || attempts++ >= 8) break;
  } while (true);
  return { fx, fy, radius: SIZES[Math.floor(Math.random() * SIZES.length)] };
}

function resultColor(score: number): string {
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#3b82f6';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function resultLabel(score: number): string {
  if (score >= 85) return 'Sharp!';
  if (score >= 70) return 'Nice hit!';
  if (score >= 50) return 'Good aim';
  if (score >= 30) return 'Off target';
  return 'Miss!';
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

type Props = {
  theme: ThemeInfo;
  onHome: () => void;
};

export default function AimTrainer({ theme, onHome }: Props) {
  const d = theme.isDark;

  const [requireDrag, setRequireDrag] = useState(() => localStorage.getItem('aim-require-drag') === 'true');

  const toggleRequireDrag = useCallback(() => {
    setRequireDrag(v => { localStorage.setItem('aim-require-drag', String(!v)); return !v; });
  }, []);

  const [roundMode, setRoundMode] = useState<RoundMode>(() => {
    const saved = localStorage.getItem('aim-round-mode');
    return (saved === 'infinite' || saved === '3' || saved === '5' || saved === '10')
      ? (saved === 'infinite' ? 'infinite' : Number(saved) as 3 | 5 | 10)
      : 10;
  });

  const [gameState, setGameState] = useState<GameState>('playing');
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<AimRoundResult[]>([]);
  const [lastResult, setLastResult] = useState<AimRoundResult | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // Lazy circle buffer — grows on demand
  const circlesRef = useRef<CircleConfig[]>([genCircle()]);
  const getCircle = useCallback((i: number): CircleConfig => {
    while (circlesRef.current.length <= i) {
      const prev = circlesRef.current[circlesRef.current.length - 1];
      circlesRef.current.push(genCircle(prev.fx, prev.fy));
    }
    return circlesRef.current[i];
  }, []);

  const completedRef = useRef(0);
  const betweenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundModeRef = useRef(roundMode);
  roundModeRef.current = roundMode;

  const startFresh = useCallback((mode?: RoundMode) => {
    if (betweenTimerRef.current) clearTimeout(betweenTimerRef.current);
    const m = mode ?? roundModeRef.current;
    completedRef.current = 0;
    circlesRef.current = [genCircle()];
    setResults([]);
    setLastResult(null);
    setRound(0);
    setResetKey(k => k + 1);
    setGameState('playing');
    if (mode !== undefined) {
      setRoundMode(mode);
      localStorage.setItem('aim-round-mode', String(mode));
    }
    // suppress unused var warning
    void m;
  }, []);

  const handleModeChange = useCallback((mode: RoundMode) => {
    startFresh(mode);
  }, [startFresh]);

  const handleRoundComplete = useCallback((result: AimRoundResult) => {
    completedRef.current++;
    const completed = completedRef.current;
    const totalRounds = roundModeRef.current;

    setResults(prev => [...prev, result]);
    setLastResult(result);

    const isLast = totalRounds !== 'infinite' && completed >= totalRounds;

    setGameState('between');
    betweenTimerRef.current = setTimeout(() => {
      if (isLast) {
        setGameState('summary');
      } else {
        setRound(completed);
        setResetKey(k => k + 1);
        setGameState('playing');
      }
    }, RESULT_DISPLAY_MS);
  }, []);

  const handleQuit = useCallback(() => {
    if (betweenTimerRef.current) clearTimeout(betweenTimerRef.current);
    // Show summary if any rounds were completed, otherwise just go home
    if (completedRef.current > 0) {
      setGameState('summary');
    } else {
      onHome();
    }
  }, [onHome]);

  // Header style vars
  const hdrBorder = d ? 'border-white/8' : 'border-black/10';
  const hdrDivider = d ? 'bg-white/10' : 'bg-black/10';
  const hdrTextWeak = d ? 'text-white/35 hover:text-white/65' : 'text-black/35 hover:text-black/65';
  const hdrTextMid = d ? 'text-white/45' : 'text-black/45';
  const hdrTextFull = d ? 'text-white' : 'text-black/85';
  const tabActive = d ? 'bg-[#f97316]/20 text-[#fdba74]' : 'bg-[#f97316]/12 text-[#f97316]';
  const tabInactive = d ? 'text-white/40 hover:text-white/70 hover:bg-white/8' : 'text-black/40 hover:text-black/65 hover:bg-black/6';
  const dotFull = d ? 'bg-white/70' : 'bg-black/50';
  const dotMid = d ? 'bg-white/30' : 'bg-black/20';
  const dotWeak = d ? 'bg-white/12' : 'bg-black/10';

  // Summary screen
  if (gameState === 'summary') {
    const avgScore = avg(results.map(r => r.score));
    const avgReaction = avg(results.map(r => r.reactionMs));
    const avgAccuracy = avg(results.map(r => r.accuracyPct));
    const bestScore = Math.max(...results.map(r => r.score));
    const color = resultColor(avgScore);
    const label = resultLabel(avgScore);
    const cardBg = d ? 'bg-[#111118] border-white/8' : 'bg-white border-black/8';
    const divider = d ? 'bg-white/8' : 'bg-black/8';
    const statBg = d ? 'bg-white/5 border-white/8' : 'bg-black/4 border-black/8';
    const tryAgainCls = d
      ? 'bg-white/8 hover:bg-white/15 text-white/80 border-white/12'
      : 'bg-black/5 hover:bg-black/10 text-black/70 border-black/10';
    const nextCls = d
      ? 'bg-white text-black hover:bg-white/90'
      : 'bg-black/90 text-white hover:bg-black/80';

    return (
      <div className="flex flex-col w-screen h-dvh select-none overflow-hidden" style={{ background: theme.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className={`flex items-center gap-2 px-4 py-2 border-b ${hdrBorder} shrink-0`}>
          <div className="flex items-center gap-1 shrink-0 mr-1">
            <button onClick={onHome} className={`${hdrTextMid} text-xs font-medium`}>writing</button>
            <span className={`${hdrTextMid} text-xs hidden sm:inline`}>by</span>
            <a href="https://drawtool.io" target="_blank" rel="noopener noreferrer" className="hidden sm:inline" style={{ fontFamily: "'Pacifico', cursive", fontSize: '0.8rem', lineHeight: 1, textDecoration: 'none' }}>
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
        </div>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className={`flex flex-col rounded-2xl border shadow-2xl overflow-hidden w-full max-w-sm ${cardBg}`}>
            <div className="flex items-center gap-5 px-6 py-6">
              <div
                className="shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: color, boxShadow: `0 6px 28px ${color}40` }}
              >
                <span className="text-white text-4xl font-black tabular-nums leading-none">{avgScore}</span>
                <span className="text-white/50 text-[10px] mt-0.5 tracking-widest">avg</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className={`text-xl font-bold ${hdrTextFull}`}>{label}</div>
                <div className={`text-sm ${hdrTextMid}`}>{results.length} rounds complete</div>
                <div className={`text-xs ${hdrTextMid}`}>Best: {bestScore}</div>
              </div>
            </div>

            <div className={`h-px ${divider}`} />

            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              <div className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border ${statBg}`}>
                <span className={`text-xs ${hdrTextMid}`}>avg reaction</span>
                <span className={`text-lg font-bold tabular-nums ${hdrTextFull}`}>{formatMs(avgReaction)}</span>
              </div>
              <div className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border ${statBg}`}>
                <span className={`text-xs ${hdrTextMid}`}>avg accuracy</span>
                <span className={`text-lg font-bold tabular-nums ${hdrTextFull}`}>{avgAccuracy}%</span>
              </div>
            </div>

            <div className="px-5 pb-2">
              <div className={`text-[10px] tracking-widest uppercase mb-2 ${hdrTextMid}`}>rounds</div>
              <div className="flex gap-1.5 flex-wrap">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: resultColor(r.score), opacity: 0.9 }}
                    title={`Round ${i + 1}: ${r.score} (${formatMs(r.reactionMs)}, ${r.accuracyPct}%)`}
                  >
                    {r.score}
                  </div>
                ))}
              </div>
            </div>

            <div className={`h-px ${divider} mt-3`} />

            <div className="flex gap-2.5 px-5 py-4">
              <button onClick={() => startFresh()} className={`flex-1 py-2.5 rounded-xl text-sm border transition-colors ${tryAgainCls}`}>
                Play again
              </button>
              <button onClick={onHome} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${nextCls}`}>
                Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Playing / between screens
  const circle = getCircle(round);
  const currentRoundNum = completedRef.current + 1;
  const totalRounds = roundMode === 'infinite' ? null : roundMode;

  return (
    <div
      className="flex flex-col w-screen h-dvh select-none overflow-hidden"
      style={{ background: theme.bg, color: d ? '#fff' : '#1a1a1a', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className={`flex items-center gap-1.5 px-3 py-2 border-b ${hdrBorder} shrink-0 overflow-hidden`}>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleQuit} className={`${hdrTextMid} text-xs font-medium`}>writing</button>
          <span className={`${hdrTextMid} text-xs hidden sm:inline`}>by</span>
          <a href="https://drawtool.io" target="_blank" rel="noopener noreferrer" className="hidden sm:inline" style={{ fontFamily: "'Pacifico', cursive", fontSize: '0.8rem', lineHeight: 1, textDecoration: 'none' }}>
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
        <div className={`w-px h-4 ${hdrDivider} shrink-0`} />
        {/* Mode tabs */}
        <div className="flex gap-0.5">
          {MODES.map(({ label, value }) => (
            <button
              key={String(value)}
              onClick={() => handleModeChange(value)}
              className={`px-2 py-0.5 rounded-md text-xs transition-colors ${roundMode === value ? tabActive : tabInactive}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={`w-px h-4 ${hdrDivider} shrink-0`} />
        {/* Drag toggle */}
        <button
          onClick={toggleRequireDrag}
          title="Require minimum drag distance to register a hit"
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition-colors ${requireDrag ? tabActive : tabInactive}`}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v12M2 8l6 6 6-6"/>
          </svg>
          <span className="hidden sm:inline">drag</span>
        </button>
        {/* Round progress (finite modes only) */}
        {totalRounds !== null && (<>
        <div className={`w-px h-4 ${hdrDivider} shrink-0`} />
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1">
              {Array.from({ length: totalRounds }, (_, i) => (
                <div
                  key={i}
                  className={[
                    'h-1.5 w-1.5 rounded-full transition-all',
                    i < completedRef.current ? dotMid : i === completedRef.current ? dotFull : dotWeak,
                  ].join(' ')}
                />
              ))}
            </div>
            <span className={`${hdrTextMid} text-xs tabular-nums`}>
              <span className={`${hdrTextFull} font-semibold`}>{currentRoundNum}</span>
              <span className={d ? 'text-white/25' : 'text-black/25'}> / {totalRounds}</span>
            </span>
          </div>
        </>)}
        <div className="flex-1" />
        {roundMode === 'infinite' && results.length > 0 && (
          <div className={`flex items-center gap-1.5 text-xs tabular-nums ${hdrTextMid} shrink-0`}>
            {/* Count */}
            <span>{results.length}</span>
            <span className={d ? 'text-white/15' : 'text-black/15'}>·</span>
            {/* Avg score */}
            <div className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3"/>
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2"/>
              </svg>
              <span>{avg(results.map(r => r.score))}</span>
            </div>
            <span className={d ? 'text-white/15' : 'text-black/15'}>·</span>
            {/* Avg reaction */}
            <div className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="9" r="5.5"/>
                <path d="M8 6v3.5l2 1.5"/>
                <path d="M6 1h4M8 1v2"/>
              </svg>
              <span>{formatMs(avg(results.map(r => r.reactionMs)))}</span>
            </div>
          </div>
        )}
        <button onClick={handleQuit} className={`${hdrTextWeak} text-xs transition-colors`}>
          {roundMode === 'infinite' && completedRef.current > 0 ? 'results' : 'quit'}
        </button>
      </div>

      {/* Canvas area */}
      <div className="relative flex-1 min-h-0">
        <AimTrainerCanvas
          key={resetKey}
          circleFx={circle.fx}
          circleFy={circle.fy}
          circleRadius={circle.radius}
          strokeColor={theme.stroke}
          isDark={d}
          minStrokePx={requireDrag ? 6 : 0}
          onComplete={handleRoundComplete}
        />

        {/* Between-round result overlay */}
        {gameState === 'between' && lastResult && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex flex-col items-center gap-2 px-8 py-5 rounded-2xl"
              style={{
                background: d ? 'rgba(6,6,14,0.88)' : 'rgba(245,245,240,0.92)',
                border: `1px solid ${resultColor(lastResult.score)}35`,
                boxShadow: `0 4px 48px ${resultColor(lastResult.score)}20`,
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="text-5xl font-black tabular-nums leading-none" style={{ color: resultColor(lastResult.score) }}>
                {lastResult.score}
              </div>
              <div className={`text-sm font-semibold ${hdrTextFull}`}>{resultLabel(lastResult.score)}</div>
              <div className={`flex items-center gap-2.5 text-xs ${hdrTextMid}`}>
                <span className="tabular-nums">{formatMs(lastResult.reactionMs)}</span>
                <span className={d ? 'text-white/20' : 'text-black/20'}>·</span>
                <span>{lastResult.accuracyPct}% accurate</span>
              </div>
            </div>
          </div>
        )}

        {/* First-round hint */}
        {gameState === 'playing' && round === 0 && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs backdrop-blur-sm border ${d ? 'bg-black/30 border-white/10 text-white/40' : 'bg-white/50 border-black/8 text-black/35'}`}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="8" cy="8" r="5" />
                <path d="M8 6v2M8 10h.01" />
              </svg>
              move your cursor to the target and draw inside it
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
