import { useRef, useCallback, useEffect, useState } from 'react';
import type { Stroke, Pt } from '../lib/freehand';
import { renderStroke, smoothPoints } from '../lib/freehand';
import type { ShapeTarget, ShapeRoundConfig } from '../lib/shapes';
import { layoutShapes, renderShapeGhost, makePrng } from '../lib/shapes';

const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='50%25' stop-color='%2389CFF0'/%3E%3Cstop offset='50%25' stop-color='%23FA8072'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='3' y='5' width='18' height='12' rx='2.5' transform='rotate(-25 12 11)' fill='url(%23g)' stroke='%23666' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`;

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

type UndoAction = { type: 'draw'; stroke: Stroke } | { type: 'erase'; strokes: Stroke[] };

type Props = {
  config: ShapeRoundConfig;
  strokeColor?: string;
  ghostColor?: string;
  ghostAlpha?: number;
  isDark?: boolean;
  blindMode?: boolean;
  onFirstStroke: () => void;
  onRequestScore: (strokes: Stroke[], shapes: ShapeTarget[], cx: number, cy: number, w: number, h: number) => void;
};

export default function ShapeCanvas({
  config,
  strokeColor = '#ffffff',
  ghostColor = '#ffffff',
  ghostAlpha = 0.18,
  isDark = true,
  blindMode = false,
  onFirstStroke,
  onRequestScore,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const toolRef = useRef<'mouse' | 'cmd' | null>(null);
  const firstStrokeFiredRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const mousePosRef = useRef<Pt>({ x: 0, y: 0 });
  const undoStackRef = useRef<UndoAction[]>([]);
  const activePointerIdRef = useRef<number | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const eraseModeRef = useRef(false);
  eraseModeRef.current = eraseMode;

  // Erase state
  const pendingEraseRef = useRef<Set<Stroke>>(new Set());
  const eraseTrailRef = useRef<Pt[]>([]);
  const eraseMovingRef = useRef(false);
  const isErasingRef = useRef(false);
  const drainRafRef = useRef<number | null>(null);

  // Blind mode animated alpha
  const blindAlphaRef = useRef(ghostAlpha);

  // Shapes — computed once from config + canvas dimensions
  const shapesRef = useRef<ShapeTarget[]>([]);

  // Mirror props to refs
  const lineWidthRef = useRef(Math.max(6, Math.max(...config.sizePxOptions) * 0.065));
  const strokeColorRef = useRef(strokeColor);
  const ghostColorRef = useRef(ghostColor);
  const ghostAlphaRef = useRef(ghostAlpha);
  const configRef = useRef(config);
  const onFirstStrokeRef = useRef(onFirstStroke);
  const onRequestScoreRef = useRef(onRequestScore);
  lineWidthRef.current = Math.max(6, Math.max(...config.sizePxOptions) * 0.065);
  strokeColorRef.current = strokeColor;
  ghostColorRef.current = ghostColor;
  ghostAlphaRef.current = ghostAlpha;
  configRef.current = config;
  onFirstStrokeRef.current = onFirstStroke;
  onRequestScoreRef.current = onRequestScore;

  const redraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d')!;
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      // Ghost shapes at absolute canvas coords
      ctx.save();
      ctx.globalAlpha = blindAlphaRef.current;
      for (const shape of shapesRef.current) {
        renderShapeGhost(ctx, shape, ghostColorRef.current);
      }
      ctx.restore();

      // Strokes in center-relative coords
      ctx.save();
      ctx.translate(cssW / 2, cssH / 2);
      ctx.setLineDash([]);

      const pending = pendingEraseRef.current;
      const isErasing = pending.size > 0;

      if (isErasing) {
        for (const stroke of strokesRef.current) {
          if (!pending.has(stroke)) renderStroke(ctx, stroke, strokeColorRef.current);
        }
        ctx.globalAlpha = 0.25;
        for (const stroke of strokesRef.current) {
          if (pending.has(stroke)) renderStroke(ctx, stroke, strokeColorRef.current);
        }
        ctx.globalAlpha = 1;
      } else {
        for (const stroke of strokesRef.current) {
          renderStroke(ctx, stroke, strokeColorRef.current);
        }
      }

      if (currentRef.current && currentRef.current.points.length > 1) {
        renderStroke(ctx, currentRef.current, strokeColorRef.current);
      }

      // Erase trail
      const trail = eraseTrailRef.current;
      if (trail.length >= 2) {
        const pts = smoothPoints(smoothPoints(trail));
        const len = pts.length;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        for (let i = 1; i < len; i++) {
          const t = i / (len - 1);
          ctx.beginPath();
          ctx.lineWidth = 3 + t * 5;
          ctx.strokeStyle = `rgba(252, 80, 80, ${t * 0.4})`;
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      }

      ctx.restore();
    });
  }, []);

  const startEraseDrain = useCallback(() => {
    if (drainRafRef.current !== null) return;
    const tick = () => {
      const trail = eraseTrailRef.current;
      if (eraseMovingRef.current) {
        eraseMovingRef.current = false;
      } else if (trail.length > 0) {
        const remove = Math.max(1, Math.ceil(trail.length * 0.15));
        trail.splice(0, remove);
        redraw();
      }
      if (trail.length > 0 || isErasingRef.current) {
        drainRafRef.current = requestAnimationFrame(tick);
      } else {
        drainRafRef.current = null;
      }
    };
    drainRafRef.current = requestAnimationFrame(tick);
  }, [redraw]);

  const stopEraseDrain = useCallback(() => {
    // Drain loop self-terminates when trail is empty and isErasingRef is false
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    // Compute shape layout once on first valid canvas size
    if (shapesRef.current.length === 0 && w > 0 && h > 0) {
      const cfg = configRef.current;
      const rng = makePrng(cfg.seed);
      shapesRef.current = layoutShapes(cfg.kinds, cfg.count, cfg.sizePxOptions, w, h, rng);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    redraw();
    const ro = new ResizeObserver(() => { resizeCanvas(); redraw(); });
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas, redraw]);

  // Blind mode: wait 1s, then fade ghost out over 0.8s
  useEffect(() => {
    blindAlphaRef.current = ghostAlpha;
    if (!blindMode) { redraw(); return; }

    let raf: number;
    const tfade = setTimeout(() => {
      const startAlpha = ghostAlpha;
      const start = performance.now();
      const FADE_MS = 800;
      const tick = (now: number) => {
        const t = Math.min((now - start) / FADE_MS, 1);
        blindAlphaRef.current = startAlpha * (1 - t);
        redraw();
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 1000);

    return () => {
      clearTimeout(tfade);
      cancelAnimationFrame(raf);
    };
  }, [blindMode, ghostAlpha, config, redraw]);

  const getCanvasPos = (clientX: number, clientY: number): Pt => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    };
  };

  const eraseAt = useCallback((pt: Pt) => {
    const trail = eraseTrailRef.current;
    const maxGap = 6;
    if (trail.length > 0) {
      const last = trail[trail.length - 1];
      const dx = pt.x - last.x;
      const dy = pt.y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxGap) {
        const steps = Math.ceil(dist / maxGap);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          trail.push({ x: last.x + dx * t, y: last.y + dy * t });
        }
      }
    }
    trail.push({ x: pt.x, y: pt.y });
    eraseMovingRef.current = true;

    const maxLen = 200;
    if (trail.length > 2) {
      let acc = 0;
      let cutIdx = 0;
      for (let i = trail.length - 1; i > 0; i--) {
        const dx = trail[i].x - trail[i - 1].x;
        const dy = trail[i].y - trail[i - 1].y;
        acc += Math.sqrt(dx * dx + dy * dy);
        if (acc > maxLen) { cutIdx = i; break; }
      }
      if (cutIdx > 0) trail.splice(0, cutIdx);
      else if (trail.length > 50) trail.splice(0, trail.length - 50);
    }

    const radius = 12;
    for (const stroke of strokesRef.current) {
      if (pendingEraseRef.current.has(stroke)) continue;
      let hit = false;
      for (const p of stroke.points) {
        const dx = p.x - pt.x;
        const dy = p.y - pt.y;
        if (dx * dx + dy * dy < radius * radius) { hit = true; break; }
      }
      if (!hit) {
        for (let i = 1; i < stroke.points.length; i++) {
          const a = stroke.points[i - 1];
          const b = stroke.points[i];
          if (distToSegment(pt.x, pt.y, a.x, a.y, b.x, b.y) < radius) { hit = true; break; }
        }
      }
      if (hit) pendingEraseRef.current.add(stroke);
    }
  }, []);

  const confirmErase = useCallback(() => {
    eraseTrailRef.current = [];
    const pending = pendingEraseRef.current;
    if (pending.size > 0) {
      const erased = [...pending];
      undoStackRef.current.push({ type: 'erase', strokes: erased });
      strokesRef.current = strokesRef.current.filter((s) => !pending.has(s));
      pending.clear();
      if (strokesRef.current.length === 0) setHasStrokes(false);
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    redraw();
  }, [redraw]);

  const cancelErase = useCallback(() => {
    eraseTrailRef.current = [];
    pendingEraseRef.current.clear();
    isErasingRef.current = false;
    redraw();
  }, [redraw]);

  const startStroke = useCallback((pt: Pt) => {
    currentRef.current = { points: [pt], lineWidth: lineWidthRef.current };
    if (!firstStrokeFiredRef.current) {
      firstStrokeFiredRef.current = true;
      onFirstStrokeRef.current();
    }
    setHasStrokes(true);
    redraw();
  }, [redraw]);

  const MIN_STROKE_PX = 3;

  const finishStroke = useCallback(() => {
    toolRef.current = null;
    const stroke = currentRef.current;
    currentRef.current = null;
    if (stroke) {
      let len = 0;
      for (let i = 1; i < stroke.points.length; i++) {
        const dx = stroke.points[i].x - stroke.points[i - 1].x;
        const dy = stroke.points[i].y - stroke.points[i - 1].y;
        len += Math.sqrt(dx * dx + dy * dy);
        if (len >= MIN_STROKE_PX) break;
      }
      if (len >= MIN_STROKE_PX) {
        strokesRef.current.push(stroke);
        undoStackRef.current.push({ type: 'draw', stroke });
      } else {
        if (strokesRef.current.length === 0) setHasStrokes(false);
      }
      redraw();
    }
  }, [redraw]);

  const handleUndo = useCallback(() => {
    if (hasSubmittedRef.current) return;
    const action = undoStackRef.current.pop();
    if (action) {
      if (action.type === 'draw') {
        const idx = strokesRef.current.lastIndexOf(action.stroke);
        if (idx !== -1) strokesRef.current.splice(idx, 1);
        if (strokesRef.current.length === 0) setHasStrokes(false);
      } else {
        strokesRef.current.push(...action.strokes);
        if (action.strokes.length > 0) setHasStrokes(true);
      }
      redraw();
    }
  }, [redraw]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && !hasSubmittedRef.current) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (!hasSubmittedRef.current && strokesRef.current.length > 0 && canvasRef.current) {
          hasSubmittedRef.current = true;
          const c = canvasRef.current;
          const dpr = window.devicePixelRatio || 1;
          const w = c.width / dpr;
          const h = c.height / dpr;
          onRequestScoreRef.current(strokesRef.current, shapesRef.current, w / 2, h / 2, w, h);
        }
        return;
      }

      if (e.key === '.' && !e.metaKey && !e.ctrlKey && !isErasingRef.current && !hasSubmittedRef.current) {
        e.preventDefault();
        const dot: Stroke = { points: [{ ...mousePosRef.current }], lineWidth: lineWidthRef.current };
        if (!firstStrokeFiredRef.current) {
          firstStrokeFiredRef.current = true;
          onFirstStrokeRef.current();
        }
        strokesRef.current.push(dot);
        undoStackRef.current.push({ type: 'draw', stroke: dot });
        setHasStrokes(true);
        redraw();
        return;
      }

      if (e.key === 'Escape' && isErasingRef.current) {
        stopEraseDrain();
        cancelErase();
        canvas.style.cursor = 'crosshair';
        return;
      }

      if (e.altKey) canvas.style.cursor = ERASER_CURSOR;
      else if ((e.metaKey || e.ctrlKey) && !isErasingRef.current) canvas.style.cursor = 'crosshair';

      if (e.repeat) return;

      if ((e.metaKey || e.ctrlKey) && !toolRef.current && !isErasingRef.current && !hasSubmittedRef.current) {
        toolRef.current = 'cmd';
        startStroke(mousePosRef.current);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const canvas = canvasRef.current;
      if (e.key === 'Meta' || e.key === 'Control') {
        if (toolRef.current === 'cmd') finishStroke();
      }
      if (canvas && !isErasingRef.current) canvas.style.cursor = 'crosshair';
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey) return;
      if (hasSubmittedRef.current) return;
      if ((e.target as HTMLElement)?.closest('[data-no-draw]')) return;
      if (activePointerIdRef.current !== null) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom
      ) return;
      if (eraseModeRef.current && !hasSubmittedRef.current) {
        pendingEraseRef.current.clear();
        eraseTrailRef.current = [];
        isErasingRef.current = true;
        startEraseDrain();
        activePointerIdRef.current = e.pointerId;
        eraseAt(getCanvasPos(e.clientX, e.clientY));
        redraw();
        return;
      }
      if (isErasingRef.current) return;
      activePointerIdRef.current = e.pointerId;
      toolRef.current = 'mouse';
      startStroke(getCanvasPos(e.clientX, e.clientY));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;
      const pt = getCanvasPos(e.clientX, e.clientY);
      mousePosRef.current = pt;

      if (toolRef.current === 'cmd' && !e.metaKey && !e.ctrlKey) {
        finishStroke();
        return;
      }

      const wasErasing = isErasingRef.current;
      const shouldErase = (e.altKey || (eraseModeRef.current && isErasingRef.current)) && toolRef.current !== 'cmd' && toolRef.current !== 'mouse' && !hasSubmittedRef.current;

      if (wasErasing && !shouldErase) {
        isErasingRef.current = false;
        stopEraseDrain();
        confirmErase();
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = 'crosshair';
      }

      if (shouldErase) {
        if (!wasErasing) {
          pendingEraseRef.current.clear();
          eraseTrailRef.current = [];
          isErasingRef.current = true;
          startEraseDrain();
          const canvas = canvasRef.current;
          if (canvas) canvas.style.cursor = ERASER_CURSOR;
        }
        eraseAt(pt);
        redraw();
        return;
      }

      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
      if (!toolRef.current) return;
      if (toolRef.current === 'mouse' && (e.buttons & 1) === 0) {
        finishStroke();
        activePointerIdRef.current = null;
        return;
      }
      if (!currentRef.current) return;
      currentRef.current.points.push(pt);
      redraw();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isErasingRef.current) {
        isErasingRef.current = false;
        stopEraseDrain();
        confirmErase();
        activePointerIdRef.current = null;
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = e.altKey ? ERASER_CURSOR : 'crosshair';
        return;
      }
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
      activePointerIdRef.current = null;
      if (toolRef.current === 'mouse') finishStroke();
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
      activePointerIdRef.current = null;
      if (toolRef.current === 'mouse') finishStroke();
    };

    const onBlur = () => {
      if (toolRef.current === 'cmd' || toolRef.current === 'mouse') {
        if (currentRef.current) {
          strokesRef.current.push(currentRef.current);
          currentRef.current = null;
        }
        toolRef.current = null;
        redraw();
      }
      activePointerIdRef.current = null;
      stopEraseDrain();
      cancelErase();
      isErasingRef.current = false;
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'crosshair';
    };

    const onFocus = () => {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'crosshair';
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [redraw, startStroke, finishStroke, eraseAt, confirmErase, cancelErase, handleUndo, startEraseDrain, stopEraseDrain]);

  const handleCheck = useCallback(() => {
    if (hasSubmittedRef.current || strokesRef.current.length === 0) return;
    hasSubmittedRef.current = true;
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    onRequestScoreRef.current(strokesRef.current, shapesRef.current, w / 2, h / 2, w, h);
  }, []);

  const d = isDark;
  const btnBase = d
    ? 'bg-white/10 hover:bg-white/18 border-white/20 text-white/70'
    : 'bg-black/7 hover:bg-black/13 border-black/15 text-black/55';
  const hintsBg = d ? 'bg-black/80 border-white/10 text-white/70' : 'bg-white/90 border-black/10 text-black/60';
  const hintsKbd = d ? 'bg-white/10 text-white/50' : 'bg-black/8 text-black/40';

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Submit button */}
      <button
        onClick={handleCheck}
        disabled={!hasStrokes}
        className="absolute bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center transition-all select-none"
        style={hasStrokes ? {
          background: 'linear-gradient(135deg, #34d399, #10b981)',
          boxShadow: '0 4px 24px rgba(16,185,129,0.45)',
        } : {
          background: d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          border: d ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
        }}
        data-no-draw
        title="Check score (↵)"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline
            points="4,12 9,18 20,6"
            stroke={hasStrokes ? '#fff' : (d ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)')}
            strokeWidth="2.5"
          />
        </svg>
      </button>

      {/* Shortcut hints toggle + erase toggle */}
      {showHints && (
        <div className="absolute inset-0" onClick={() => setShowHints(false)} data-no-draw />
      )}
      <div className="absolute bottom-8 left-8 flex flex-col items-start gap-2">
        {showHints && (
          <div className={`rounded-xl border px-3 py-2.5 text-xs flex flex-col gap-1.5 ${hintsBg}`} data-no-draw onClick={(e) => e.stopPropagation()}>
            {[
              ['draw',   'click + drag'],
              ['dot',    '.'],
              ['erase',  'alt + drag'],
              ['undo',   '⌘Z'],
              ['submit', '↵'],
            ].map(([label, key]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-11 opacity-60">{label}</span>
                <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${hintsKbd}`}>{key}</kbd>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHints((h) => !h)}
            className={[
              'w-7 h-7 rounded-full text-xs items-center justify-center border transition-colors select-none hidden md:flex',
              btnBase,
            ].join(' ')}
            data-no-draw
            title="Keyboard shortcuts"
          >
            ?
          </button>
          {/* Undo button (mobile only) */}
          <button
            onClick={handleUndo}
            className={[
              'w-11 h-11 rounded-full text-lg items-center justify-center border transition-colors select-none md:hidden',
              btnBase,
            ].join(' ')}
            data-no-draw
            title="Undo"
          >
            ↩
          </button>
          <button
            onClick={() => setEraseMode((v) => !v)}
            className={[
              'w-11 h-11 rounded-full flex items-center justify-center transition-colors select-none border md:hidden',
              eraseMode
                ? (d ? 'bg-[#3b82f6]/20 border-[#3b82f6]/50 text-[#93c5fd]' : 'bg-[#3b82f6]/12 border-[#3b82f6]/40 text-[#3b82f6]')
                : btnBase,
            ].join(' ')}
            data-no-draw
            title="Erase mode (or hold alt)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="eg2" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="50%" stopColor="#89CFF0" />
                  <stop offset="50%" stopColor="#FA8072" />
                </linearGradient>
              </defs>
              <rect x="3" y="5" width="18" height="12" rx="2.5" transform="rotate(-25 12 11)" fill="url(#eg2)" stroke={d ? '#aaa' : '#666'} strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
