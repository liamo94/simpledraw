import { useRef, useCallback, useEffect } from 'react';

export type AimRoundResult = {
  reactionMs: number;
  accuracyPct: number;
  score: number;
};

type Pt = { x: number; y: number };

type Props = {
  circleFx: number;     // 0-1 horizontal fraction of canvas width
  circleFy: number;     // 0-1 vertical fraction of canvas height
  circleRadius: number; // px
  strokeColor: string;
  isDark: boolean;
  minStrokePx: number;  // 0 = any click registers; >0 = require this many px of movement
  onComplete: (result: AimRoundResult) => void;
};

function calcScore(reactionMs: number, accuracyPct: number): number {
  if (accuracyPct === 0) return 0;
  // Speed: 100 at ≤300ms, 0 at ≥3000ms
  const speed = Math.max(0, Math.min(100, 100 * (1 - Math.max(0, reactionMs - 300) / 2700)));
  return Math.round(speed * 0.6 + accuracyPct * 0.4);
}

export default function AimTrainerCanvas({
  circleFx, circleFy, circleRadius, strokeColor, isDark, minStrokePx, onComplete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountTimeRef = useRef(performance.now());
  const pointsRef = useRef<Pt[]>([]);
  const toolRef = useRef<'mouse' | 'cmd' | null>(null);
  const hasCompletedRef = useRef(false);
  const reactionMsRef = useRef<number | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const mousePosRef = useRef<Pt>({ x: 0, y: 0 });
  const pulseRef = useRef(0);
  const animRafRef = useRef<number | null>(null);
  // Track length of the current stroke segment (resets each pointerdown)
  const currentStrokeLenRef = useRef(0);
  const minStrokePxRef = useRef(minStrokePx);
  minStrokePxRef.current = minStrokePx;

  const getCirclePx = useCallback((): { x: number; y: number; r: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (canvas.width / dpr) * circleFx,
      y: (canvas.height / dpr) * circleFy,
      r: circleRadius,
    };
  }, [circleFx, circleFy, circleRadius]);

  const getCanvasPos = useCallback((clientX: number, clientY: number): Pt => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const circle = getCirclePx();
    if (!circle) return;

    const pulse = 0.5 + 0.5 * Math.sin(pulseRef.current);

    // Did user draw inside the circle yet?
    const pts = pointsRef.current;
    const hasHit = pts.some(pt => {
      const dx = pt.x - circle.x, dy = pt.y - circle.y;
      return dx * dx + dy * dy <= circle.r * circle.r;
    });
    const color = hasHit ? '#10b981' : '#f97316';

    // Fill
    ctx.save();
    ctx.globalAlpha = 0.07 + pulse * 0.05;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Pulsing outer ring
    ctx.save();
    ctx.globalAlpha = (1 - pulse) * 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.r * (1.18 + pulse * 0.1), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Main ring
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Center dot
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cross hair lines through center dot
    const ch = Math.min(circle.r * 0.28, 12);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(circle.x - ch, circle.y);
    ctx.lineTo(circle.x + ch, circle.y);
    ctx.moveTo(circle.x, circle.y - ch);
    ctx.lineTo(circle.x, circle.y + ch);
    ctx.stroke();
    ctx.restore();

    // User strokes
    if (pts.length >= 2) {
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        if (i < pts.length - 1) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        } else {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
      ctx.stroke();
      ctx.restore();
    } else if (pts.length === 1) {
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Crosshair cursor hint (very faint, top-left area) if no interaction yet
    if (pts.length === 0 && !isDark) {
      // light theme: add subtle label
    }
  }, [getCirclePx, strokeColor, isDark]);

  // Continuous pulse animation loop
  useEffect(() => {
    const tick = () => {
      pulseRef.current += 0.045;
      render();
      animRafRef.current = requestAnimationFrame(tick);
    };
    animRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRafRef.current !== null) cancelAnimationFrame(animRafRef.current);
    };
  }, [render]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const complete = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    const pts = pointsRef.current;
    if (pts.length === 0) {
      onComplete({ reactionMs: 4000, accuracyPct: 0, score: 0 });
      return;
    }

    const reactionMs = reactionMsRef.current ?? 4000;
    const circle = getCirclePx();
    let insideCount = 0;
    if (circle) {
      for (const pt of pts) {
        const dx = pt.x - circle.x, dy = pt.y - circle.y;
        if (dx * dx + dy * dy <= circle.r * circle.r) insideCount++;
      }
    }
    const accuracyPct = Math.round((insideCount / pts.length) * 100);
    onComplete({ reactionMs, accuracyPct, score: calcScore(reactionMs, accuracyPct) });
  }, [getCirclePx, onComplete]);

  // 4-second auto-timeout if no drawing
  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasCompletedRef.current && pointsRef.current.length === 0) complete();
    }, 4000);
    return () => clearTimeout(t);
  }, [complete]);

  const recordReaction = useCallback(() => {
    if (reactionMsRef.current === null) {
      reactionMsRef.current = performance.now() - mountTimeRef.current;
    }
  }, []);

  // Pointer + keyboard event handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (hasCompletedRef.current) return;
      if ((e.metaKey || e.ctrlKey) && !toolRef.current) {
        toolRef.current = 'cmd';
        // Don't record reaction or push points here — Cmd alone could be Cmd+Tab.
        // Wait for actual mouse movement before starting the stroke.
      }
    };

    const tryComplete = () => {
      if (hasCompletedRef.current || pointsRef.current.length === 0) return;
      if (minStrokePxRef.current > 0 && currentStrokeLenRef.current < minStrokePxRef.current) {
        // Stroke too short — discard and let the user try again
        pointsRef.current = [];
        currentStrokeLenRef.current = 0;
        return;
      }
      complete();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') {
        if (toolRef.current === 'cmd') {
          toolRef.current = null;
          tryComplete();
        }
      }
    };

    const onDown = (e: PointerEvent) => {
      if (hasCompletedRef.current || activePointerRef.current !== null || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey) return; // cmd mode handles this
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      }
      activePointerRef.current = e.pointerId;
      toolRef.current = 'mouse';
      currentStrokeLenRef.current = 0;
      recordReaction();
      pointsRef.current.push(getCanvasPos(e.clientX, e.clientY));
    };

    const onMove = (e: PointerEvent) => {
      const pt = getCanvasPos(e.clientX, e.clientY);
      mousePosRef.current = pt;

      if (hasCompletedRef.current) return;

      // If cmd mode was active but key released while tab was inactive
      if (toolRef.current === 'cmd' && !e.metaKey && !e.ctrlKey) {
        toolRef.current = null;
        tryComplete();
        return;
      }

      if (toolRef.current === 'cmd') {
        recordReaction();
        const prev = pointsRef.current[pointsRef.current.length - 1];
        if (prev) {
          const dx = pt.x - prev.x, dy = pt.y - prev.y;
          currentStrokeLenRef.current += Math.sqrt(dx * dx + dy * dy);
        }
        pointsRef.current.push(pt);
        return;
      }

      if (toolRef.current !== 'mouse' || e.pointerId !== activePointerRef.current) return;
      // Stop if button released mid-move
      if ((e.buttons & 1) === 0) {
        toolRef.current = null;
        activePointerRef.current = null;
        tryComplete();
        return;
      }
      const prev = pointsRef.current[pointsRef.current.length - 1];
      if (prev) {
        const dx = pt.x - prev.x, dy = pt.y - prev.y;
        currentStrokeLenRef.current += Math.sqrt(dx * dx + dy * dy);
      }
      pointsRef.current.push(pt);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerRef.current) return;
      activePointerRef.current = null;
      toolRef.current = null;
      tryComplete();
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== activePointerRef.current) return;
      activePointerRef.current = null;
      toolRef.current = null;
      tryComplete();
    };

    const onBlur = () => {
      // Window lost focus (e.g. Cmd+Tab) — cancel any in-progress stroke
      toolRef.current = null;
      activePointerRef.current = null;
      pointsRef.current = [];
      currentStrokeLenRef.current = 0;
      reactionMsRef.current = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onBlur);
    };
  }, [complete, getCanvasPos, recordReaction]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
