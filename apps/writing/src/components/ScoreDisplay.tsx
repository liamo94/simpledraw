import { useRef, useEffect, useState } from 'react';
import type { Stroke } from '../lib/freehand';
import { smoothPoints } from '../lib/freehand';

type Props = {
  score: number;
  target: string;
  timeMs: number | null;
  strokeCount?: number | null;
  traceStrokes?: Stroke[];
  traceFont?: string;
  traceCanvasH?: number;
  isDark?: boolean;
  nextLabel?: string;
  showTryAgain?: boolean;
  roundInfo?: { current: number; total: number };
  onNext: () => void;
  onTryAgain: () => void;
};

type Verdict = { label: string; emoji: string; badgeBg: string; glowColor: string };

function getVerdict(score: number): Verdict {
  if (score >= 85) return { label: 'Excellent!',  emoji: '🔥', badgeBg: '#10b981', glowColor: 'rgba(16,185,129,0.35)'  };
  if (score >= 70) return { label: 'Nice job!',   emoji: '✨', badgeBg: '#3b82f6', glowColor: 'rgba(59,130,246,0.35)'  };
  if (score >= 50) return { label: 'Good effort', emoji: '👍', badgeBg: '#f59e0b', glowColor: 'rgba(245,158,11,0.35)'  };
  if (score >= 30) return { label: 'Keep trying', emoji: '💪', badgeBg: '#f97316', glowColor: 'rgba(249,115,22,0.35)'  };
  return              { label: 'Needs work',   emoji: '😅', badgeBg: '#ef4444', glowColor: 'rgba(239,68,68,0.35)'   };
}

function formatTime(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function renderStrokeToCtx(ctx: CanvasRenderingContext2D, stroke: Stroke, color = '#fff') {
  const pts = smoothPoints(stroke.points);
  if (pts.length === 0) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.lineWidth;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, stroke.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  ctx.stroke();
}

const CARD_W = 340;
const PREVIEW_H = 180;

export default function ScoreDisplay({
  score,
  target,
  timeMs,
  strokeCount,
  traceStrokes,
  traceFont,
  traceCanvasH,
  isDark = true,
  nextLabel = 'Next →',
  showTryAgain = true,
  roundInfo,
  onNext,
  onTryAgain,
}: Props) {
  const { label, emoji, badgeBg, glowColor } = getVerdict(score);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [displayScore, setDisplayScore] = useState(0);

  // Count-up animation
  useEffect(() => {
    const duration = 650;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !traceStrokes || !traceFont || !traceCanvasH) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CARD_W * dpr;
    canvas.height = PREVIEW_H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CARD_W, PREVIEW_H);

    const cx = CARD_W / 2;
    const cy = PREVIEW_H / 2;

    // Compute bounding box of actual strokes (center-relative coords)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of traceStrokes) {
      const hw = stroke.lineWidth / 2;
      for (const p of stroke.points) {
        minX = Math.min(minX, p.x - hw); maxX = Math.max(maxX, p.x + hw);
        minY = Math.min(minY, p.y - hw); maxY = Math.max(maxY, p.y + hw);
      }
    }
    // Fallback to ghost-text-sized box if no strokes
    const ghostFallback = traceCanvasH * 0.25;
    if (!isFinite(minX)) { minX = -ghostFallback; maxX = ghostFallback; minY = -ghostFallback * 0.5; maxY = ghostFallback * 0.5; }

    const FIT_PAD = 24;
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const bboxCx = (minX + maxX) / 2;
    const bboxCy = (minY + maxY) / 2;
    const scale = Math.min(
      (CARD_W - FIT_PAD * 2) / bboxW,
      (PREVIEW_H - FIT_PAD * 2) / bboxH,
      PREVIEW_H / traceCanvasH * 4, // cap zoom so ghost text stays recognisable
    );

    const origSizeMatch = traceFont.match(/(\d+(?:\.\d+)?)px/);
    const origFontSize = origSizeMatch ? parseFloat(origSizeMatch[1]) : 100;
    const fontFamily = traceFont.replace(/^.*?\d+px\s*/, '');
    const previewFontSize = origFontSize * scale;

    // Ghost text centred at the transformed origin (0,0 in center-relative space)
    const ghostX = cx - bboxCx * scale;
    const ghostY = cy - bboxCy * scale;
    const ghostColor = isDark ? '#ffffff' : '#000000';
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = ghostColor;
    ctx.font = `700 ${previewFontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    {
      const maxW = CARD_W * 0.88;
      const words = target.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
        else line = test;
      }
      if (line) lines.push(line);
      const metrics = ctx.measureText('M');
      const lineH = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) * 1.35;
      const startY = ghostY - (lineH * (lines.length - 1)) / 2;
      lines.forEach((l, i) => ctx.fillText(l, ghostX, startY + i * lineH));
    }
    ctx.restore();

    // User strokes — translate so bbox centre maps to preview centre
    const strokeColor = isDark ? '#ffffff' : '#1a1a1a';
    ctx.save();
    ctx.translate(cx - bboxCx * scale, cy - bboxCy * scale);
    ctx.scale(scale, scale);
    for (const stroke of traceStrokes) {
      renderStrokeToCtx(ctx, stroke, strokeColor);
    }
    ctx.restore();
  }, [traceStrokes, traceFont, traceCanvasH, target, isDark]);

  const d = isDark;
  const scrim   = d ? 'bg-black/50'    : 'bg-black/20';
  const card    = d ? 'bg-[#111118] border-white/8' : 'bg-white border-black/8';
  const txt     = d ? 'text-white'     : 'text-black/85';
  const txtMid  = d ? 'text-white/45'  : 'text-black/45';
  const txtWeak = d ? 'text-white/25'  : 'text-black/25';
  const divider = d ? 'bg-white/8'     : 'bg-black/8';
  const dotFull = d ? 'bg-white/70'    : 'bg-black/50';
  const dotWeak = d ? 'bg-white/20'    : 'bg-black/15';
  const tryAgainCls = d
    ? 'bg-white/8 hover:bg-white/15 text-white/80 border-white/12'
    : 'bg-black/5 hover:bg-black/10 text-black/70 border-black/10';
  const nextCls = d
    ? 'bg-white text-black hover:bg-white/90'
    : 'bg-black/90 text-white hover:bg-black/80';

  return (
    <div className={`absolute inset-0 flex items-center justify-center ${scrim} backdrop-blur-sm`}>
      <div
        className={`flex flex-col rounded-2xl border overflow-hidden shadow-2xl ${card}`}
        style={{ width: CARD_W }}
      >
        {/* Round progress bar */}
        {roundInfo && (
          <div className="flex items-center justify-between px-5 py-3">
            <span className={`${txtWeak} text-xs tracking-widest uppercase`}>
              round {roundInfo.current} / {roundInfo.total}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: roundInfo.total }, (_, i) => (
                <div
                  key={i}
                  className={[
                    'h-1 w-5 rounded-full transition-all',
                    i < roundInfo.current ? dotFull : dotWeak,
                  ].join(' ')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Attempt preview — edge to edge, no label */}
        {traceStrokes && (
          <canvas
            ref={previewRef}
            style={{ width: CARD_W, height: PREVIEW_H, display: 'block' }}
          />
        )}

        <div className={`h-px ${divider}`} />

        {/* Score + verdict row */}
        <div className="flex items-center gap-4 px-5 py-5">
          {/* Score badge */}
          <div
            className="shrink-0 w-[72px] h-[72px] rounded-2xl flex flex-col items-center justify-center"
            style={{ background: badgeBg, boxShadow: `0 6px 24px ${glowColor}` }}
          >
            <span className="text-white text-3xl font-black tabular-nums leading-none">{displayScore}</span>
            <span className="text-white/50 text-[10px] mt-0.5 tracking-widest">/ 100</span>
          </div>

          {/* Verdict + stats */}
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xl leading-none">{emoji}</span>
              <span className={`text-xl font-bold leading-none ${txt}`}>{label}</span>
            </div>
            <div className={`flex items-center gap-2 text-sm ${txtMid}`}>
              {timeMs !== null && (
                <span className="tabular-nums font-medium">{formatTime(timeMs)}</span>
              )}
              {timeMs !== null && strokeCount != null && (
                <span className={txtWeak}>·</span>
              )}
              {strokeCount != null && (
                <span className="tabular-nums">{strokeCount} stroke{strokeCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>

        <div className={`h-px ${divider}`} />

        {/* Buttons */}
        <div className="flex gap-2.5 px-5 py-4">
          {showTryAgain && (
            <button
              onClick={onTryAgain}
              className={`flex-1 py-2.5 rounded-xl text-sm border transition-colors flex items-center justify-center gap-2 ${tryAgainCls}`}
            >
              Try again
              <kbd className={`${txtWeak} text-xs font-mono hidden md:inline`}>r</kbd>
            </button>
          )}
          <button
            onClick={onNext}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${nextCls}`}
          >
            {nextLabel}
            <kbd className="opacity-30 text-xs font-mono hidden md:inline">↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
