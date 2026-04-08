import { useState } from "react";
import type { ContentMode } from "../lib/content";
import type { FontKey, SizeKey } from "../lib/fonts";
import { FONTS, SIZES } from "../lib/fonts";
import type { ThemeInfo } from "../lib/themes";
import type { ShapeKind } from "../lib/shapes";
import { ALL_SHAPES, SHAPE_LABELS } from "../lib/shapes";
import ShapeIcon from "./ShapeIcon";

export type GameConfig = {
  rounds: number;
  modes: ContentMode[];
  fontKeys: FontKey[];
  sizeKeys: SizeKey[];
  seed?: number;
  shapesMode?: {
    kinds: ShapeKind[];
    counts: number[];
    sizeKeys: SizeKey[];
  };
};

const MODE_OPTIONS: { mode: ContentMode; label: string }[] = [
  { mode: "uppercase", label: "A–Z" },
  { mode: "lowercase", label: "a–z" },
  { mode: "numbers", label: "0–9" },
  { mode: "words", label: "Words" },
  { mode: "sentences", label: "Sentences" },
];

const ALL_MODES = MODE_OPTIONS.map((m) => m.mode);
const ALL_FONTS = FONTS.map((f) => f.key);
const ALL_SIZES = SIZES.map((s) => s.key);

const ROUND_OPTIONS = [5, 10, 15, 20];
const SHAPE_ROUND_OPTIONS = [1, 3, 5, 10];
const SHAPE_COUNT_OPTIONS = [1, 2, 3, 4, 5];

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}


type Props = {
  onStart: (config: GameConfig) => void;
  onBack: () => void;
  theme: ThemeInfo;
  initialSeed?: number;
};

function SectionHeader({
  label,
  hint,
  allCount,
  selectedCount,
  onSelectAll,
  txtWeak,
  txtDim,
}: {
  label: string;
  hint?: string;
  allCount: number;
  selectedCount: number;
  onSelectAll: (all: boolean) => void;
  txtWeak: string;
  txtDim: string;
}) {
  const allSelected = selectedCount === allCount;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <label className={`${txtWeak} text-xs tracking-widest uppercase`}>
          {label}
        </label>
        {hint && <span className={`${txtDim} text-xs`}>{hint}</span>}
      </div>
      <button
        onClick={() => onSelectAll(!allSelected)}
        className={`${txtWeak} hover:opacity-100 text-xs transition-opacity`}
      >
        {allSelected ? "clear" : "all"}
      </button>
    </div>
  );
}

const STORAGE_KEY = "writing-game-config";

function loadSaved(): Partial<GameConfig> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function GameSetup({ onStart, onBack, theme, initialSeed }: Props) {
  const saved = loadSaved();
  const [gameType, setGameType] = useState<'text' | 'shapes'>(saved.shapesMode ? 'shapes' : 'text');

  function switchGameType(type: 'text' | 'shapes') {
    setGameType(type);
    if (type === 'shapes' && !SHAPE_ROUND_OPTIONS.includes(rounds)) {
      // Snap to closest valid shapes round count
      setRounds(SHAPE_ROUND_OPTIONS.reduce((a, b) => Math.abs(b - rounds) < Math.abs(a - rounds) ? b : a));
    }
    if (type === 'text' && !ROUND_OPTIONS.includes(rounds)) {
      setRounds(ROUND_OPTIONS.reduce((a, b) => Math.abs(b - rounds) < Math.abs(a - rounds) ? b : a));
    }
  }
  const [rounds, setRounds] = useState<number>(saved.rounds ?? 10);
  const [modes, setModes] = useState<ContentMode[]>(saved.modes ?? []);
  const [fontKeys, setFontKeys] = useState<FontKey[]>(saved.fontKeys ?? []);
  const [sizeKeys, setSizeKeys] = useState<SizeKey[]>(saved.sizeKeys ?? []);
  const [seedStr, setSeedStr] = useState(initialSeed !== undefined ? String(initialSeed) : "");
  // Shapes config
  const [shapeKinds, setShapeKinds] = useState<ShapeKind[]>(saved.shapesMode?.kinds ?? ALL_SHAPES);
  const [shapesCounts, setShapesCounts] = useState<number[]>(saved.shapesMode?.counts ?? [2]);
  const [shapesSizeKeys, setShapesSizeKeys] = useState<SizeKey[]>(saved.shapesMode?.sizeKeys ?? ['md']);

  const hasSeed = seedStr.trim().length > 0;
  const canStartText = modes.length > 0 && fontKeys.length > 0 && sizeKeys.length > 0;
  const canStartShapes = shapeKinds.length > 0 && shapesCounts.length > 0 && shapesSizeKeys.length > 0;
  const canStart = hasSeed || (gameType === 'text' ? canStartText : canStartShapes);

  function handleStart() {
    const seed = seedStr.trim() ? parseInt(seedStr.trim(), 10) : undefined;
    const shapesMode = { kinds: shapeKinds, counts: shapesCounts, sizeKeys: shapesSizeKeys };
    const config: GameConfig = gameType === 'shapes'
      ? { rounds, modes: [], fontKeys: [], sizeKeys: [], seed, shapesMode }
      : { rounds, modes, fontKeys, sizeKeys, seed };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rounds, modes, fontKeys, sizeKeys,
      shapesMode: gameType === 'shapes' ? shapesMode : undefined,
    }));
    onStart(config);
  }

  const d = theme.isDark;
  const txt = d ? "text-white" : "text-black/85";
  const txtWeak = d ? "text-white/40" : "text-black/40";
  const txtDim = d ? "text-white/25" : "text-black/25";
  const border = d ? "border-white/8" : "border-black/8";
  const btnActive = d
    ? "bg-[#3b82f6]/20 text-[#93c5fd] border-[#3b82f6]/50"
    : "bg-[#3b82f6]/12 text-[#3b82f6] border-[#3b82f6]/40";
  const btnInactive = d
    ? "text-white/40 border-white/10 hover:text-white/70 hover:bg-white/8"
    : "text-black/40 border-black/10 hover:text-black/70 hover:bg-black/6";
  const btnStart = d
    ? "bg-white text-black hover:bg-white/90"
    : "bg-black/90 text-white hover:bg-black/80";

  const btn = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm transition-colors border ${active ? btnActive : btnInactive}`;

  return (
    <div
      className={`flex flex-col w-screen h-dvh select-none overflow-y-auto ${txt}`}
      style={{ background: theme.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${border} shrink-0`}>
        {/* Branding */}
        <div className="flex items-center gap-1 shrink-0 mr-1">
          <button onClick={onBack} className={`${txtWeak} text-xs font-medium transition-colors`}>writing</button>
          <span className={`${txtDim} text-xs`}>by</span>
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
        <div className={`w-px h-4 ${d ? 'bg-white/10' : 'bg-black/10'} shrink-0`} />
        <span className={`${txtDim} text-xs tracking-widest uppercase`}>game setup</span>
      </div>

      {/* Settings */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 py-10 gap-10 max-w-lg mx-auto w-full">

        {/* Game type toggle */}
        <div className="w-full flex gap-1 p-1 rounded-xl" style={{ background: d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          {(['text', 'shapes'] as const).map((type) => (
            <button
              key={type}
              onClick={() => switchGameType(type)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${gameType === type ? btnActive : btnInactive}`}
            >
              {type === 'text' ? 'Text' : 'Shapes'}
            </button>
          ))}
        </div>

        {/* Config sections — locked when seed is set */}
        <div className={`w-full flex flex-col gap-10 transition-opacity ${hasSeed ? 'opacity-25 pointer-events-none select-none' : ''}`}>
          {/* Rounds */}
          <div className="w-full flex flex-col gap-3">
            <label className={`${txtWeak} text-xs tracking-widest uppercase`}>Rounds</label>
            <div className="flex gap-2">
              {(gameType === 'shapes' ? SHAPE_ROUND_OPTIONS : ROUND_OPTIONS).map((n) => (
                <button
                  key={n}
                  onClick={() => setRounds(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${rounds === n ? btnActive : btnInactive}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {gameType === 'text' ? (
            <>
              {/* Content — multi-select */}
              <div className="w-full flex flex-col gap-3">
                <SectionHeader
                  label="Content"
                  hint={modes.length > 1 ? "mixed each round" : undefined}
                  allCount={ALL_MODES.length}
                  selectedCount={modes.length}
                  onSelectAll={(all) => setModes(all ? ALL_MODES : [])}
                  txtWeak={txtWeak}
                  txtDim={txtDim}
                />
                <div className="flex flex-wrap gap-2">
                  {MODE_OPTIONS.map(({ mode: m, label }) => (
                    <button
                      key={m}
                      onClick={() => setModes(toggle(modes, m))}
                      className={btn(modes.includes(m))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font — multi-select */}
              <div className="w-full flex flex-col gap-3">
                <SectionHeader
                  label="Font"
                  hint={fontKeys.length > 1 ? "random each round" : undefined}
                  allCount={ALL_FONTS.length}
                  selectedCount={fontKeys.length}
                  onSelectAll={(all) => setFontKeys(all ? ALL_FONTS : [])}
                  txtWeak={txtWeak}
                  txtDim={txtDim}
                />
                <div className="flex flex-wrap gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFontKeys(toggle(fontKeys, f.key))}
                      className={btn(fontKeys.includes(f.key))}
                      style={{ fontFamily: f.css }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size — multi-select */}
              <div className="w-full flex flex-col gap-3">
                <SectionHeader
                  label="Size"
                  hint={sizeKeys.length > 1 ? "random each round" : undefined}
                  allCount={ALL_SIZES.length}
                  selectedCount={sizeKeys.length}
                  onSelectAll={(all) => setSizeKeys(all ? ALL_SIZES : [])}
                  txtWeak={txtWeak}
                  txtDim={txtDim}
                />
                <div className="flex gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSizeKeys(toggle(sizeKeys, s.key))}
                      className={`flex-1 py-2 rounded-xl text-sm transition-colors border ${sizeKeys.includes(s.key) ? btnActive : btnInactive}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Shapes — multi-select */}
              <div className="w-full flex flex-col gap-3">
                <SectionHeader
                  label="Shapes"
                  hint={shapeKinds.length > 1 ? "random each round" : undefined}
                  allCount={ALL_SHAPES.length}
                  selectedCount={shapeKinds.length}
                  onSelectAll={(all) => setShapeKinds(all ? [...ALL_SHAPES] : [])}
                  txtWeak={txtWeak}
                  txtDim={txtDim}
                />
                <div className="flex gap-1.5">
                  {ALL_SHAPES.map((kind) => (
                    <button
                      key={kind}
                      title={SHAPE_LABELS[kind]}
                      onClick={() => setShapeKinds(toggle(shapeKinds, kind))}
                      className={`flex-1 h-9 rounded-lg flex items-center justify-center transition-colors border ${shapeKinds.includes(kind) ? btnActive : btnInactive}`}
                    >
                      <ShapeIcon kind={kind} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Count — multi-select */}
              <div className="w-full flex flex-col gap-3">
                <SectionHeader
                  label="Shapes per round"
                  hint={shapesCounts.length > 1 ? "random each round" : undefined}
                  allCount={SHAPE_COUNT_OPTIONS.length}
                  selectedCount={shapesCounts.length}
                  onSelectAll={(all) => setShapesCounts(all ? [...SHAPE_COUNT_OPTIONS] : [])}
                  txtWeak={txtWeak}
                  txtDim={txtDim}
                />
                <div className="flex gap-2">
                  {SHAPE_COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setShapesCounts(toggle(shapesCounts, n))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${shapesCounts.includes(n) ? btnActive : btnInactive}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size — multi-select */}
              <div className="w-full flex flex-col gap-3">
                <SectionHeader
                  label="Size"
                  hint={shapesSizeKeys.length > 1 ? "random each round" : undefined}
                  allCount={SIZES.length}
                  selectedCount={shapesSizeKeys.length}
                  onSelectAll={(all) => setShapesSizeKeys(all ? ALL_SIZES : [])}
                  txtWeak={txtWeak}
                  txtDim={txtDim}
                />
                <div className="flex gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setShapesSizeKeys(toggle(shapesSizeKeys, s.key))}
                      className={`flex-1 py-2 rounded-xl text-sm transition-colors border ${shapesSizeKeys.includes(s.key) ? btnActive : btnInactive}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Seed */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className={`${txtWeak} text-xs tracking-widest uppercase`}>
              Seed
            </label>
            <span className={`${txtDim} text-xs`}>
              share to compete on the same {gameType === 'shapes' ? 'shapes' : 'words'}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={seedStr}
              onChange={(e) => setSeedStr(e.target.value)}
              placeholder="optional"
              className={[
                "flex-1 px-3 py-2 rounded-xl text-sm border transition-colors outline-none",
                d
                  ? "bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-white/25"
                  : "bg-black/4 border-black/8 text-black/85 placeholder-black/20 focus:border-black/20",
              ].join(" ")}
            />
            {seedStr && (
              <button
                onClick={() => setSeedStr("")}
                className={`px-3 py-2 rounded-xl text-xs border transition-colors ${btnInactive}`}
              >
                clear
              </button>
            )}
          </div>
        </div>

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-colors mt-2 ${canStart ? btnStart : "opacity-30 " + btnStart}`}
        >
          {canStart
            ? (hasSeed ? "Start Seeded Game" : `Start ${rounds} Rounds`)
            : gameType === 'text'
              ? "Select content, font & size"
              : "Select at least one shape"}
        </button>
      </div>
    </div>
  );
}
