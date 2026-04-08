import { useState, useCallback, useRef, useEffect } from 'react';
import TraceCanvas from './components/TraceCanvas';
import ShapeCanvas from './components/ShapeCanvas';
import ScoreDisplay from './components/ScoreDisplay';
import HomeScreen from './components/HomeScreen';
import GameSetup from './components/GameSetup';
import type { GameConfig } from './components/GameSetup';
import GameSummary from './components/GameSummary';
import type { RoundResult } from './components/GameSummary';
import type { ContentMode } from './lib/content';
import { getTarget, getFontSize } from './lib/content';
import type { FontKey, SizeKey } from './lib/fonts';
import { FONTS, SIZES, getFontCss, getLineWidthMult } from './lib/fonts';
import type { Theme } from './lib/themes';
import { THEMES, getTheme } from './lib/themes';
import { scoreAttempt, scoreShapeAttempt } from './lib/scoring';
import type { Stroke } from './lib/freehand';
import type { ShapeTarget, ShapeRoundConfig } from './lib/shapes';
import { SHAPE_SIZE_PX } from './lib/shapes';
import { getDailyConfig, isDailyDone, markDailyDone, formatDailyDate } from './lib/daily';

type AppScreen = 'home' | 'quickplay' | 'game-setup' | 'game-playing' | 'game-summary';
type DrawState = 'drawing' | 'scoring' | 'scored';

// ── Routing helpers ───────────────────────────────────────────────────────────
function parseSeedFromUrl(): number | undefined {
  // /game/123  or  /game?seed=123
  const pathMatch = window.location.pathname.match(/\/game\/(\d+)/);
  if (pathMatch) return parseInt(pathMatch[1], 10);
  const param = new URLSearchParams(window.location.search).get('seed');
  return param ? parseInt(param, 10) : undefined;
}

function pathToScreen(pathname: string): AppScreen {
  if (pathname === '/quick') return 'quickplay';
  if (pathname.startsWith('/game')) return 'game-setup';
  return 'home';
}

function screenToPath(screen: AppScreen, seed?: number): string {
  if (screen === 'quickplay') return '/quick';
  if (screen === 'game-setup' || screen === 'game-playing' || screen === 'game-summary')
    return seed !== undefined ? `/game/${seed}` : '/game';
  return '/';
}

const MODE_LABELS: { mode: ContentMode; label: string }[] = [
  { mode: 'uppercase', label: 'A–Z' },
  { mode: 'lowercase', label: 'a–z' },
  { mode: 'numbers', label: '0–9' },
  { mode: 'words', label: 'Words' },
  { mode: 'sentences', label: 'Sentences' },
  { mode: 'custom', label: 'Custom' },
];

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(() => pathToScreen(window.location.pathname));
  const [urlSeed, setUrlSeed] = useState<number | undefined>(parseSeedFromUrl);

  const navigate = useCallback((newScreen: AppScreen, seed?: number) => {
    const path = screenToPath(newScreen, seed);
    window.history.pushState({}, '', path);
    setScreen(newScreen);
  }, []);

  useEffect(() => {
    const onPop = () => setScreen(pathToScreen(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ── Quick play state ──────────────────────────────────────────────────────
  const [qpMode, setQpMode] = useState<ContentMode>(() => (localStorage.getItem('qp-mode') as ContentMode) ?? 'uppercase');
  const [qpFontKey, setQpFontKey] = useState<FontKey>(() => (localStorage.getItem('qp-font') as FontKey) ?? 'caveat');
  const [qpSizeKey, setQpSizeKey] = useState<SizeKey>(() => (localStorage.getItem('qp-size') as SizeKey) ?? 'md');
  const [qpTarget, setQpTarget] = useState(() => getTarget((localStorage.getItem('qp-mode') as ContentMode) ?? 'uppercase'));
  const [qpCustomText, setQpCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [qpDrawState, setQpDrawState] = useState<DrawState>('drawing');
  const [qpScore, setQpScore] = useState(0);
  const [qpTimeMs, setQpTimeMs] = useState<number | null>(null);
  const [qpStrokeCount, setQpStrokeCount] = useState<number | null>(null);
  const [qpTraceStrokes, setQpTraceStrokes] = useState<Stroke[]>([]);
  const [qpResetKey, setQpResetKey] = useState(0);

  // ── Game mode state ───────────────────────────────────────────────────────
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameRoundData, setGameRoundData] = useState<{ target: string; fontKey: FontKey; sizeKey: SizeKey }[]>([]);
  const [gameRound, setGameRound] = useState(1); // 1-indexed, current round being played
  const [gameTarget, setGameTarget] = useState('');
  const [gameRoundFontKey, setGameRoundFontKey] = useState<FontKey>('caveat');
  const [gameRoundSizeKey, setGameRoundSizeKey] = useState<SizeKey>('md');
  const [gameDrawState, setGameDrawState] = useState<DrawState>('drawing');
  const [gameScore, setGameScore] = useState(0);
  const [gameTimeMs, setGameTimeMs] = useState<number | null>(null);
  const [gameStrokeCount, setGameStrokeCount] = useState<number | null>(null);
  const [gameTraceStrokes, setGameTraceStrokes] = useState<Stroke[]>([]);
  const [gameResults, setGameResults] = useState<RoundResult[]>([]);
  const [gameResetKey, setGameResetKey] = useState(0);
  // Shapes game state
  const [gameShapeRoundData, setGameShapeRoundData] = useState<ShapeRoundConfig[]>([]);
  const [gameCurrentShapeConfig, setGameCurrentShapeConfig] = useState<ShapeRoundConfig | null>(null);

  // ── Blind mode ────────────────────────────────────────────────────────────
  const [blindMode, setBlindMode] = useState(() => localStorage.getItem('qp-blind') === 'true');
  const toggleBlindMode = () => setBlindMode((v) => { localStorage.setItem('qp-blind', String(!v)); return !v; });

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('writing-theme') as Theme) ?? 'dark';
  });
  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('writing-theme', t);
  };
  const themeInfo = getTheme(theme);

  // Sync theme background to document so it fills safe areas (notch, home indicator)
  useEffect(() => {
    document.documentElement.style.background = themeInfo.bg;
  }, [themeInfo.bg]);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [canvasH, setCanvasH] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerStartRef = useRef<number | null>(null);
  const isDailyRef = useRef<'text' | 'shapes' | null>(null);

  const handleContainerRef = useCallback((el: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) setCanvasH(el.clientHeight);
  }, []);

  const handleFirstStroke = useCallback(() => {
    timerStartRef.current = performance.now();
  }, []);

  // ── Quick play ────────────────────────────────────────────────────────────
  const startQuickPlay = useCallback(() => {
    if (qpMode === 'custom') {
      setCustomDraft(qpCustomText);
      setShowCustomInput(true);
    } else {
      setQpTarget(getTarget(qpMode));
    }
    setQpDrawState('drawing');
    setQpResetKey((k) => k + 1);
    timerStartRef.current = null;
    navigate('quickplay');
  }, [qpMode, qpCustomText]);

  const qpEffectiveTarget = qpMode === 'custom' ? qpCustomText : qpTarget;
  const qpSizeMult = SIZES.find((s) => s.key === qpSizeKey)?.mult ?? 1;
  const qpFontCss = getFontCss(qpFontKey);
  const qpFontSize = Math.round(getFontSize(qpEffectiveTarget || 'A', canvasH) * qpSizeMult);
  const qpFont = `700 ${qpFontSize}px ${qpFontCss}`;
  const qpLineWidth = Math.max(5, Math.round(qpFontSize * getLineWidthMult(qpFontKey)));

  const handleQpScore = useCallback(
    async (strokes: Stroke[], cx: number, cy: number, w: number, h: number) => {
      const elapsed = timerStartRef.current !== null ? performance.now() - timerStartRef.current : null;
      setQpTimeMs(elapsed);
      setQpStrokeCount(strokes.length);
      setQpTraceStrokes([...strokes]);
      setQpDrawState('scoring');
      const s = await scoreAttempt(strokes, qpTarget, qpFont, cx, cy, w, h);
      setQpScore(s);
      setQpDrawState('scored');
    },
    [qpTarget, qpFont],
  );

  const handleQpNext = useCallback(() => {
    if (qpMode === 'custom') {
      setCustomDraft(qpCustomText);
      setQpDrawState('drawing');
      setQpResetKey((k) => k + 1);
      timerStartRef.current = null;
      setShowCustomInput(true);
      return;
    }
    const next = getTarget(qpMode, qpTarget);
    setQpTarget(next);
    setQpDrawState('drawing');
    setQpResetKey((k) => k + 1);
    timerStartRef.current = null;
    if (containerRef.current) setCanvasH(containerRef.current.clientHeight);
  }, [qpMode, qpTarget, qpCustomText]);

  const handleQpTryAgain = useCallback(() => {
    setQpDrawState('drawing');
    setQpResetKey((k) => k + 1);
    timerStartRef.current = null;
  }, []);

  const handleQpModeChange = useCallback((m: ContentMode) => {
    setQpMode(m);
    localStorage.setItem('qp-mode', m);
    if (m === 'custom') {
      setCustomDraft(qpCustomText);
      setShowCustomInput(true);
    } else {
      setQpTarget(getTarget(m));
      setShowCustomInput(false);
    }
    setQpDrawState('drawing');
    setQpResetKey((k) => k + 1);
    timerStartRef.current = null;
  }, [qpCustomText]);

  // ── Game mode ─────────────────────────────────────────────────────────────
  // Seeded PRNG (mulberry32)
  function makePrng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickWith<T>(rng: () => number, arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }

  const startGame = useCallback((config: GameConfig) => {
    isDailyRef.current = null;
    setUrlSeed(undefined);
    const seed = config.seed ?? Math.floor(Math.random() * 1e9);
    const rng = makePrng(seed);
    const effectiveConfig = { ...config, seed };

    if (config.shapesMode) {
      const sm = config.shapesMode;
      const shapeRounds: ShapeRoundConfig[] = [];
      for (let i = 0; i < config.rounds; i++) {
        const count = pickWith(rng, sm.counts) as number;
        const sizePxOptions = sm.sizeKeys.map(k => SHAPE_SIZE_PX[k] ?? 165);
        shapeRounds.push({ seed: Math.floor(rng() * 0xFFFFFFFF), kinds: sm.kinds, count, sizePxOptions });
      }
      setGameConfig(effectiveConfig);
      setGameShapeRoundData(shapeRounds);
      setGameCurrentShapeConfig(shapeRounds[0]);
      setGameRoundData([]);
      setGameRound(1);
      setGameTarget('');
      setGameResults([]);
      setGameDrawState('drawing');
      setGameResetKey((k) => k + 1);
      timerStartRef.current = null;
      window.history.pushState({}, '', `/game/${seed}`);
      setScreen('game-playing');
      return;
    }

    const rounds: { target: string; fontKey: FontKey; sizeKey: SizeKey }[] = [];
    for (let i = 0; i < config.rounds; i++) {
      const mode = pickWith(rng, config.modes);
      const prev = i > 0 ? rounds[i - 1].target : '';
      let target = getTarget(mode, prev || undefined, rng);
      if (target === prev) target = getTarget(mode, prev || undefined, rng);
      rounds.push({
        target,
        fontKey: pickWith(rng, config.fontKeys) as FontKey,
        sizeKey: pickWith(rng, config.sizeKeys) as SizeKey,
      });
    }

    setGameConfig(effectiveConfig);
    setGameRoundData(rounds);
    setGameShapeRoundData([]);
    setGameCurrentShapeConfig(null);
    setGameRound(1);
    setGameTarget(rounds[0].target);
    setGameRoundFontKey(rounds[0].fontKey);
    setGameRoundSizeKey(rounds[0].sizeKey);
    setGameResults([]);
    setGameDrawState('drawing');
    setGameResetKey((k) => k + 1);
    timerStartRef.current = null;
    window.history.pushState({}, '', `/game/${seed}`);
    setScreen('game-playing');
  }, []);

  const startDailyChallenge = useCallback((mode: 'text' | 'shapes') => {
    isDailyRef.current = mode;
    startGame(getDailyConfig(mode));
  }, [startGame]);

  const gameSizeMult = SIZES.find((s) => s.key === gameRoundSizeKey)?.mult ?? 1;
  const gameFontCss = getFontCss(gameRoundFontKey);
  const gameFontSize = Math.round(getFontSize(gameTarget, canvasH) * gameSizeMult);
  const gameFont = `700 ${gameFontSize}px ${gameFontCss}`;
  const gameLineWidth = Math.max(5, Math.round(gameFontSize * getLineWidthMult(gameRoundFontKey)));

  const handleGameScore = useCallback(
    async (strokes: Stroke[], cx: number, cy: number, w: number, h: number) => {
      const elapsed = timerStartRef.current !== null ? performance.now() - timerStartRef.current : null;
      setGameTimeMs(elapsed);
      setGameStrokeCount(strokes.length);
      setGameTraceStrokes([...strokes]);
      setGameDrawState('scoring');
      const s = await scoreAttempt(strokes, gameTarget, gameFont, cx, cy, w, h);
      setGameScore(s);
      setGameDrawState('scored');
    },
    [gameTarget, gameFont],
  );

  const handleGameShapeScore = useCallback(
    async (strokes: Stroke[], shapes: ShapeTarget[], cx: number, cy: number, w: number, h: number) => {
      const elapsed = timerStartRef.current !== null ? performance.now() - timerStartRef.current : null;
      setGameTimeMs(elapsed);
      setGameStrokeCount(strokes.length);
      setGameTraceStrokes([...strokes]);
      setGameDrawState('scoring');
      const s = await scoreShapeAttempt(strokes, shapes, cx, cy, w, h);
      setGameScore(s);
      setGameTarget(shapes.map((sh) => sh.kind).join(' · '));
      setGameDrawState('scored');
    },
    [],
  );

  const advanceGame = useCallback((result: RoundResult) => {
    if (!gameConfig) return;
    const newResults = [...gameResults, result];
    setGameResults(newResults);

    if (newResults.length >= gameConfig.rounds) {
      if (isDailyRef.current) markDailyDone(isDailyRef.current);
      navigate('game-summary');
    } else {
      const nextRound = newResults.length; // 0-indexed
      setGameRound(nextRound + 1);
      setGameDrawState('drawing');
      setGameResetKey((k) => k + 1);
      timerStartRef.current = null;
      if (containerRef.current) setCanvasH(containerRef.current.clientHeight);

      if (gameConfig.shapesMode) {
        setGameCurrentShapeConfig(gameShapeRoundData[nextRound]);
        setGameTarget('');
      } else {
        const next = gameRoundData[nextRound];
        setGameTarget(next.target);
        setGameRoundFontKey(next.fontKey);
        setGameRoundSizeKey(next.sizeKey);
      }
    }
  }, [gameConfig, gameResults, gameRoundData, gameShapeRoundData]);

  const handleGameNext = useCallback(() => {
    advanceGame({ target: gameTarget, score: gameScore, timeMs: gameTimeMs, strokeCount: gameStrokeCount });
  }, [advanceGame, gameTarget, gameScore, gameTimeMs, gameStrokeCount]);

  const handleGameSkip = useCallback(() => {
    advanceGame({ target: gameTarget, score: 0, timeMs: null, strokeCount: null });
  }, [advanceGame, gameTarget]);

  const handleGameTryAgain = useCallback(() => {
    setGameDrawState('drawing');
    setGameResetKey((k) => k + 1);
    timerStartRef.current = null;
  }, []);

  // Enter = next when score is showing (must be before early returns — Rules of Hooks)
  const _isGameForEffect = screen === 'game-playing';
  const _drawStateForEffect = _isGameForEffect ? gameDrawState : qpDrawState;
  const _handleNextForEffect = _isGameForEffect ? handleGameNext : handleQpNext;
  const handleClear = useCallback(() => {
    if (screen === 'quickplay') {
      setQpDrawState('drawing');
      setQpResetKey((k) => k + 1);
      timerStartRef.current = null;
    } else if (screen === 'game-playing') {
      setGameDrawState('drawing');
      setGameResetKey((k) => k + 1);
      timerStartRef.current = null;
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'quickplay' && screen !== 'game-playing') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
        e.preventDefault();
        handleClear();
        return;
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey && screen === 'game-playing' && _drawStateForEffect === 'drawing') {
        e.preventDefault();
        handleGameSkip();
        return;
      }
      if (_drawStateForEffect !== 'scored') return;
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        _handleNextForEffect();
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && screen === 'quickplay') {
        e.preventDefault();
        handleQpTryAgain();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, _drawStateForEffect, _handleNextForEffect, handleClear, handleQpTryAgain, handleGameSkip]);

  // ── Routing ───────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <HomeScreen
        theme={themeInfo}
        onQuickPlay={startQuickPlay}
        onGameMode={() => navigate('game-setup')}
        onDailyText={() => startDailyChallenge('text')}
        onDailyShapes={() => startDailyChallenge('shapes')}
        dailyTextDone={isDailyDone('text')}
        dailyShapesDone={isDailyDone('shapes')}
        dailyDate={formatDailyDate()}
      />
    );
  }

  if (screen === 'game-setup') {
    return (
      <GameSetup
        onStart={startGame}
        onBack={() => navigate('home')}
        theme={themeInfo}
        initialSeed={urlSeed}
      />
    );
  }

  if (screen === 'game-summary') {
    return (
      <GameSummary
        results={gameResults}
        config={gameConfig ?? undefined}
        onPlayAgain={() => { if (gameConfig) startGame(gameConfig); }}
        onNewGame={() => navigate('game-setup')}
        onHome={() => navigate('home')}
        theme={themeInfo}
      />
    );
  }

  // ── Shared canvas rendering (quickplay + game-playing) ────────────────────
  const isGame = screen === 'game-playing';
  const isShapesGame = isGame && !!gameConfig?.shapesMode;
  const target = isGame ? gameTarget : qpEffectiveTarget;
  const font = isGame ? gameFont : qpFont;
  const lineWidth = isGame ? gameLineWidth : qpLineWidth;
  const drawState = isGame ? gameDrawState : qpDrawState;
  const score = isGame ? gameScore : qpScore;
  const curTimeMs = isGame ? gameTimeMs : qpTimeMs;
  const curStrokeCount = isGame ? gameStrokeCount : qpStrokeCount;
  const curTraceStrokes = isGame ? gameTraceStrokes : qpTraceStrokes;
  const curTraceFont = isShapesGame ? undefined : font;
  const resetKey = isGame ? gameResetKey : qpResetKey;
  const fontKey = isGame ? gameRoundFontKey : qpFontKey;
  const sizeKey = isGame ? gameRoundSizeKey : qpSizeKey;
  const handleScore = isGame ? handleGameScore : handleQpScore;
  const handleNext = isGame ? handleGameNext : handleQpNext;
  const handleTryAgain = isGame ? handleGameTryAgain : handleQpTryAgain;

  const roundInfo = isGame && gameConfig
    ? { current: gameRound, total: gameConfig.rounds }
    : undefined;

  const isLastRound = isGame && gameConfig ? gameRound >= gameConfig.rounds : false;
  const nextLabel = isGame ? (isLastRound ? 'See Results →' : `Next Round →`) : 'Next →';

  // Theme-adaptive header classes
  const d = themeInfo.isDark;
  const hdr = {
    border:      d ? 'border-white/8'  : 'border-black/10',
    divider:     d ? 'bg-white/10'     : 'bg-black/10',
    textWeak:    d ? 'text-white/30 hover:text-white/60'  : 'text-black/35 hover:text-black/70',
    textMid:     d ? 'text-white/40'   : 'text-black/50',
    textFull:    d ? 'text-white'      : 'text-black/85',
    tabActive:   d ? 'bg-[#3b82f6]/20 text-[#93c5fd]'    : 'bg-[#3b82f6]/12 text-[#3b82f6]',
    tabInactive: d ? 'text-white/40 hover:text-white/70 hover:bg-white/8' : 'text-black/40 hover:text-black/65 hover:bg-black/6',
    swatchRing:  d ? '0 0 0 2px rgba(255,255,255,0.7)'  : '0 0 0 2px rgba(0,0,0,0.5)',
    swatchBorder:d ? '0 0 0 1px rgba(255,255,255,0.15)' : '0 0 0 1px rgba(0,0,0,0.15)',
    dotFull:     d ? 'bg-white'        : 'bg-black/70',
    dotMid:      d ? 'bg-white/50'     : 'bg-black/35',
    dotWeak:     d ? 'bg-white/15'     : 'bg-black/12',
  };

  return (
    <div className="flex flex-col w-screen h-dvh select-none overflow-hidden" style={{ background: themeInfo.bg, color: themeInfo.isDark ? '#fff' : '#1a1a1a', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div className={`flex flex-col border-b ${hdr.border} shrink-0`}>
        {isGame ? (
          /* Game header — matches quickplay style */
          <div className="flex items-center gap-2 px-4 py-2">
            {/* Branding */}
            <div className="flex items-center gap-1 shrink-0 mr-1">
              <button onClick={() => navigate('home')} className={`${hdr.textMid} text-xs font-medium`}>writing</button>
              <span className={`${hdr.textWeak.split(' ')[0]} text-xs hidden sm:inline`}>by</span>
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
            <div className={`w-px h-4 ${hdr.divider} shrink-0`} />
            {/* Round progress */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Dots */}
              <div className="flex gap-1 flex-wrap">
                {gameConfig && Array.from({ length: gameConfig.rounds }, (_, i) => (
                  <div
                    key={i}
                    className={[
                      'h-1.5 w-1.5 rounded-full transition-all',
                      i < gameRound - 1 ? hdr.dotMid : i === gameRound - 1 ? hdr.dotFull : hdr.dotWeak,
                    ].join(' ')}
                  />
                ))}
              </div>
              <span className={`${hdr.textMid} text-xs tabular-nums shrink-0`}>
                <span className={`${hdr.textFull} font-semibold`}>{gameRound}</span>
                <span className={hdr.textWeak.split(' ')[0]}> / {gameConfig?.rounds}</span>
              </span>
            </div>
            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Theme swatches */}
              <div className="hidden sm:flex items-center gap-1">
                {THEMES.map((t) => (
                  <button key={t.key} title={t.label} onClick={() => setTheme(t.key)}
                    style={{ background: t.bg, boxShadow: theme === t.key ? hdr.swatchRing : hdr.swatchBorder }}
                    className="w-3.5 h-3.5 rounded-full transition-all hover:scale-110"
                  />
                ))}
              </div>
              {/* Blind mode toggle */}
              <button onClick={toggleBlindMode} title="Blind mode — ghost fades after 2s" className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition-colors ${blindMode ? hdr.tabActive : hdr.tabInactive}`}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  {blindMode
                    ? <><path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z"/><circle cx="8" cy="8" r="2"/><line x1="3" y1="3" x2="13" y2="13"/></>
                    : <><path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z"/><circle cx="8" cy="8" r="2"/></>}
                </svg>
                blind
              </button>
              {drawState === 'drawing' && (
                <button onClick={handleGameSkip} className={`${hdr.textWeak} text-xs transition-colors`} title="Skip round (s)">skip</button>
              )}
              <button onClick={() => navigate('home')} className={`${hdr.textWeak} text-xs transition-colors`}>quit</button>
            </div>
          </div>
        ) : (
          /* Quick play header — responsive */
          <>
            {/* ── Desktop: single row (hidden on mobile) ── */}
            <div className="hidden lg:flex items-center gap-2 px-4 py-2">
              {/* Branding */}
              <div className="flex items-center gap-1 shrink-0 mr-1">
                <button onClick={() => navigate('home')} className={`${hdr.textMid} text-xs font-medium`}>writing</button>
                <span className={`${hdr.textWeak.split(' ')[0]} text-xs`}>by</span>
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
              <div className={`w-px h-4 ${hdr.divider} shrink-0`} />
              {/* Mode tabs */}
              <div className="flex gap-0.5">
                {MODE_LABELS.map(({ mode: m, label }) => (
                  <button key={m} onClick={() => handleQpModeChange(m)} className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${qpMode === m ? hdr.tabActive : hdr.tabInactive}`}>{label}</button>
                ))}
              </div>
              <div className={`w-px h-4 ${hdr.divider} shrink-0`} />
              {/* Font */}
              <div className="flex gap-0.5">
                {FONTS.map((f) => (
                  <button key={f.key} onClick={() => { setQpFontKey(f.key); localStorage.setItem('qp-font', f.key); setQpResetKey((k) => k + 1); }} className={`px-2 py-0.5 rounded-md text-xs transition-colors ${qpFontKey === f.key ? hdr.tabActive : hdr.tabInactive}`} style={{ fontFamily: f.css }}>{f.label}</button>
                ))}
              </div>
              <div className={`w-px h-4 ${hdr.divider} shrink-0`} />
              {/* Size */}
              <div className="flex gap-0.5">
                {SIZES.map((s) => (
                  <button key={s.key} onClick={() => { setQpSizeKey(s.key); localStorage.setItem('qp-size', s.key); setQpResetKey((k) => k + 1); }} className={`w-7 h-6 rounded-md text-xs transition-colors ${qpSizeKey === s.key ? hdr.tabActive : hdr.tabInactive}`}>{s.label}</button>
                ))}
              </div>
              {/* Theme swatches */}
              <div className="ml-auto flex items-center gap-1 shrink-0">
                {THEMES.map((t) => (
                  <button key={t.key} title={t.label} onClick={() => setTheme(t.key)} style={{ background: t.bg, boxShadow: theme === t.key ? hdr.swatchRing : hdr.swatchBorder }} className="w-3.5 h-3.5 rounded-full transition-all hover:scale-110" />
                ))}
              </div>
              {/* Blind mode toggle */}
              <button onClick={toggleBlindMode} title="Blind mode — ghost fades after 2s" className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition-colors shrink-0 ${blindMode ? hdr.tabActive : hdr.tabInactive}`}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  {blindMode
                    ? <><path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z"/><circle cx="8" cy="8" r="2"/><line x1="3" y1="3" x2="13" y2="13"/></>
                    : <><path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z"/><circle cx="8" cy="8" r="2"/></>}
                </svg>
                blind
              </button>
              {/* Home */}
              <button onClick={() => navigate('home')} className={`${hdr.textWeak} text-xs transition-colors shrink-0`}>← home</button>
            </div>

            {/* ── Mobile: two rows (visible below lg) ── */}
            <div className="lg:hidden">
              {/* Row 1: branding + theme + settings toggle + home */}
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => navigate('home')} className={`${hdr.textMid} text-xs font-medium`}>writing</button>
                  <span className={`${hdr.textWeak.split(' ')[0]} text-xs`}>by</span>
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
                <div className="ml-auto flex items-center gap-2">
                  {/* Theme swatches */}
                  <div className="flex items-center gap-1">
                    {THEMES.map((t) => (
                      <button key={t.key} title={t.label} onClick={() => setTheme(t.key)} style={{ background: t.bg, boxShadow: theme === t.key ? hdr.swatchRing : hdr.swatchBorder }} className="w-3.5 h-3.5 rounded-full transition-all" />
                    ))}
                  </div>
                  {/* Blind mode toggle */}
                  <button onClick={toggleBlindMode} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition-colors ${blindMode ? hdr.tabActive : hdr.tabInactive}`}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      {blindMode
                        ? <><path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z"/><circle cx="8" cy="8" r="2"/><line x1="3" y1="3" x2="13" y2="13"/></>
                        : <><path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z"/><circle cx="8" cy="8" r="2"/></>}
                    </svg>
                    blind
                  </button>
                  {/* Home */}
                  <button onClick={() => navigate('home')} className={`${hdr.textWeak} text-xs transition-colors shrink-0`}>← home</button>
                </div>
              </div>
              {/* Row 2: mode tabs (scrollable) */}
              <div className="flex gap-0.5 px-3 pb-1 overflow-x-auto">
                {MODE_LABELS.map(({ mode: m, label }) => (
                  <button key={m} onClick={() => handleQpModeChange(m)} className={`px-2.5 py-1 rounded-lg text-xs transition-colors shrink-0 ${qpMode === m ? hdr.tabActive : hdr.tabInactive}`}>{label}</button>
                ))}
              </div>
              {/* Row 3: font + size always visible */}
              <div className={`flex flex-col gap-1.5 px-3 pb-2.5 pt-1.5 border-t ${hdr.border} mt-1`}>
                <div className="flex items-center gap-1.5">
                  <span className={`${hdr.textMid} text-[10px] tracking-widest uppercase w-8 shrink-0`}>font</span>
                  <div className="flex gap-0.5 flex-wrap">
                    {FONTS.map((f) => (
                      <button key={f.key} onClick={() => { setQpFontKey(f.key); localStorage.setItem('qp-font', f.key); setQpResetKey((k) => k + 1); }} className={`px-2 py-0.5 rounded-md text-xs transition-colors ${qpFontKey === f.key ? hdr.tabActive : hdr.tabInactive}`} style={{ fontFamily: f.css }}>{f.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`${hdr.textMid} text-[10px] tracking-widest uppercase w-8 shrink-0`}>size</span>
                  <div className="flex gap-0.5">
                    {SIZES.map((s) => (
                      <button key={s.key} onClick={() => { setQpSizeKey(s.key); localStorage.setItem('qp-size', s.key); setQpResetKey((k) => k + 1); }} className={`w-9 h-6 rounded-md text-xs transition-colors ${qpSizeKey === s.key ? hdr.tabActive : hdr.tabInactive}`}>{s.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div ref={handleContainerRef} className="relative flex-1 min-h-0">
        {isShapesGame && gameCurrentShapeConfig ? (
          <ShapeCanvas
            key={resetKey}
            config={gameCurrentShapeConfig}
            strokeColor={themeInfo.stroke}
            ghostColor={themeInfo.stroke}
            isDark={themeInfo.isDark}
            blindMode={blindMode}
            onFirstStroke={handleFirstStroke}
            onRequestScore={handleGameShapeScore}
          />
        ) : (
          <TraceCanvas
            key={`${target}-${fontKey}-${sizeKey}-${resetKey}`}
            target={target}
            font={font}
            lineWidth={lineWidth}
            strokeColor={themeInfo.stroke}
            ghostColor={themeInfo.stroke}
            isDark={themeInfo.isDark}
            blindMode={blindMode}
            onFirstStroke={handleFirstStroke}
            onRequestScore={handleScore}
          />
        )}

        {/* Custom text input overlay */}
        {!isGame && showCustomInput && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-5 select-none" style={{ background: themeInfo.bg }}>
            <p className={`text-sm tracking-widest uppercase pointer-events-none ${hdr.textWeak}`}>what do you want to write?</p>
            <textarea
              autoFocus
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && qpCustomText) {
                  setShowCustomInput(false);
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey && customDraft.trim()) {
                  e.preventDefault();
                  const text = customDraft.trim();
                  setQpCustomText(text);
                  setQpTarget(text);
                  setShowCustomInput(false);
                  setQpDrawState('drawing');
                  setQpResetKey((k) => k + 1);
                  timerStartRef.current = null;
                }
              }}
              placeholder="type something…"
              rows={3}
              className={[
                'w-full max-w-sm rounded-2xl px-4 py-3 text-base resize-none outline-none border transition-colors',
                themeInfo.isDark
                  ? 'bg-white/8 border-white/15 text-white placeholder-white/25 focus:border-white/30'
                  : 'bg-black/5 border-black/12 text-black/85 placeholder-black/25 focus:border-black/25',
              ].join(' ')}
            />
            <button
              disabled={!customDraft.trim()}
              onClick={() => {
                const text = customDraft.trim();
                if (!text) return;
                setQpCustomText(text);
                setQpTarget(text);
                setShowCustomInput(false);
                setQpDrawState('drawing');
                setQpResetKey((k) => k + 1);
                timerStartRef.current = null;
              }}
              className={[
                'px-8 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                themeInfo.isDark
                  ? 'bg-white text-black hover:bg-white/90 disabled:opacity-30'
                  : 'bg-black/90 text-white hover:bg-black/80 disabled:opacity-30',
              ].join(' ')}
            >
              Start →
            </button>
          </div>
        )}

        {drawState === 'scoring' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="text-white/60 text-sm">Scoring…</div>
          </div>
        )}

        {drawState === 'scored' && (
          <ScoreDisplay
            score={score}
            target={target}
            timeMs={curTimeMs}
            strokeCount={curStrokeCount}
            traceStrokes={curTraceStrokes}
            traceFont={curTraceFont}
            traceCanvasH={canvasH}
            isDark={themeInfo.isDark}
            nextLabel={nextLabel}
            showTryAgain={!isGame}
            roundInfo={roundInfo}
            onNext={handleNext}
            onTryAgain={handleTryAgain}
          />
        )}
      </div>
    </div>
  );
}
