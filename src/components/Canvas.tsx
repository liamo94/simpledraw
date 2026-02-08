import { useRef, useEffect, useCallback, useState } from "react";
import type { ShapeKind, Theme } from "../hooks/useSettings";

function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || theme === "midnight";
}

function getBackgroundColor(theme: Theme): string {
  if (theme === "midnight") return "#1a1a2e";
  if (theme === "dark") return "#050510";
  if (theme === "journal") return "#fde68a";
  return "#f5f5f0";
}

type Stroke = {
  points: { x: number; y: number }[];
  style: "solid" | "dashed";
  lineWidth: number;
  dashGap?: number;
  color: string;
  shape?: ShapeKind;
  highlight?: boolean;
};

type UndoAction =
  | { type: "draw"; stroke: Stroke }
  | { type: "erase"; strokes: Stroke[] };

export type TouchTool =
  | "draw"
  | "dashed"
  | "line"
  | "erase"
  | "hand"
  | "shape"
  | "highlight";

const STROKES_KEY = "simpledraw-strokes";

function loadStrokes(): Stroke[] {
  try {
    const raw = localStorage.getItem(STROKES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function saveStrokes(strokes: Stroke[]) {
  try {
    const json = JSON.stringify(strokes);
    if (json.length < 5_000_000) localStorage.setItem(STROKES_KEY, json);
  } catch {
    /* ignore */
  }
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t =
    lenSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

function cmdKey(e: { metaKey: boolean; ctrlKey: boolean }) {
  return e.metaKey || e.ctrlKey;
}

function screenToWorld(
  sx: number,
  sy: number,
  view: { x: number; y: number; scale: number },
) {
  return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
}

function smoothPoints(raw: { x: number; y: number }[]) {
  if (raw.length < 3) return raw;
  const out = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    out.push({
      x: raw[i - 1].x * 0.25 + raw[i].x * 0.5 + raw[i + 1].x * 0.25,
      y: raw[i - 1].y * 0.25 + raw[i].y * 0.5 + raw[i + 1].y * 0.25,
    });
  }
  out.push(raw[raw.length - 1]);
  return out;
}

const isMac = navigator.platform.toUpperCase().includes("MAC");

function starPoints(
  cx: number,
  cy: number,
  outerRx: number,
  outerRy: number,
  innerRx: number,
  innerRy: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const rx = i % 2 === 0 ? outerRx : innerRx;
    const ry = i % 2 === 0 ? outerRy : innerRy;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

function regularPolygonPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

function renderShape(
  ctx: CanvasRenderingContext2D,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  shape: ShapeKind,
  lineWidth: number,
) {
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.beginPath();
  switch (shape) {
    case "line":
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      break;
    case "rectangle":
      ctx.rect(x, y, w, h);
      break;
    case "circle":
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    case "star": {
      const pts = starPoints(cx, cy, w / 2, h / 2, w / 5, h / 5);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      break;
    }
    case "arrow": {
      // Draw line from p0 to p1
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      // Draw arrowhead
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const headLen = Math.max(15, lineWidth * 3);
      const headAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(
        p1.x - headLen * Math.cos(angle - headAngle),
        p1.y - headLen * Math.sin(angle - headAngle),
      );
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(
        p1.x - headLen * Math.cos(angle + headAngle),
        p1.y - headLen * Math.sin(angle + headAngle),
      );
      break;
    }
    case "pentagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 5);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      break;
    }
    case "hexagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 6);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      break;
    }
    case "diamond": {
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, cy);
      ctx.closePath();
      break;
    }
    case "lightning": {
      ctx.moveTo(x + w * 0.55, y);
      ctx.lineTo(x + w * 0.15, y + h * 0.5);
      ctx.lineTo(x + w * 0.45, y + h * 0.5);
      ctx.lineTo(x + w * 0.35, y + h);
      ctx.lineTo(x + w * 0.85, y + h * 0.4);
      ctx.lineTo(x + w * 0.55, y + h * 0.4);
      ctx.closePath();
      break;
    }
  }
  ctx.stroke();
}

function shapeToSegments(stroke: Stroke): { x: number; y: number }[] {
  const p0 = stroke.points[0];
  const p1 = stroke.points[1];
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);
  const cx = x + w / 2;
  const cy = y + h / 2;

  switch (stroke.shape!) {
    case "line":
      return [p0, p1];
    case "rectangle":
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
        { x, y },
      ];
    case "circle": {
      const pts: { x: number; y: number }[] = [];
      const n = 36;
      for (let i = 0; i <= n; i++) {
        const a = (Math.PI * 2 * i) / n;
        pts.push({
          x: cx + (w / 2) * Math.cos(a),
          y: cy + (h / 2) * Math.sin(a),
        });
      }
      return pts;
    }
    case "triangle":
      return [
        { x: cx, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
        { x: cx, y },
      ];
    case "star": {
      const pts = starPoints(cx, cy, w / 2, h / 2, w / 5, h / 5);
      return [...pts, pts[0]];
    }
    case "arrow": {
      // Line from p0 to p1 plus arrowhead points
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const headLen = 15;
      const headAngle = Math.PI / 6;
      return [
        p0,
        p1,
        {
          x: p1.x - headLen * Math.cos(angle - headAngle),
          y: p1.y - headLen * Math.sin(angle - headAngle),
        },
        p1,
        {
          x: p1.x - headLen * Math.cos(angle + headAngle),
          y: p1.y - headLen * Math.sin(angle + headAngle),
        },
      ];
    }
    case "pentagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 5);
      return [...pts, pts[0]];
    }
    case "hexagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 6);
      return [...pts, pts[0]];
    }
    case "diamond": {
      return [
        { x: cx, y },
        { x: x + w, y: cy },
        { x: cx, y: y + h },
        { x, y: cy },
        { x: cx, y },
      ];
    }
    case "lightning": {
      const pts = [
        { x: x + w * 0.55, y },
        { x: x + w * 0.15, y: y + h * 0.5 },
        { x: x + w * 0.45, y: y + h * 0.5 },
        { x: x + w * 0.35, y: y + h },
        { x: x + w * 0.85, y: y + h * 0.4 },
        { x: x + w * 0.55, y: y + h * 0.4 },
      ];
      return [...pts, pts[0]];
    }
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderStrokesToCtx(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const color = stroke.highlight
      ? hexToRgba(stroke.color, 0.4)
      : stroke.color;
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(p.x, p.y, stroke.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (stroke.shape && stroke.points.length === 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      renderShape(
        ctx,
        stroke.points[0],
        stroke.points[1],
        stroke.shape,
        stroke.lineWidth,
      );
      continue;
    }
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = stroke.highlight
      ? stroke.lineWidth * 2.5
      : stroke.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const dashScale = stroke.lineWidth / 4;
    ctx.setLineDash(
      stroke.style === "dashed"
        ? [10 * dashScale, (stroke.dashGap ?? 8) * 5 * dashScale]
        : [],
    );
    const pts = smoothPoints(stroke.points);
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
}

export default function Canvas({
  lineWidth,
  lineColor,
  dashGap,
  showDotGrid,
  theme,
  touchTool,
  activeShape,
}: {
  lineWidth: number;
  lineColor: string;
  dashGap: number;
  showDotGrid: boolean;
  theme: Theme;
  touchTool: TouchTool;
  activeShape: ShapeKind;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedStrokes] = useState(loadStrokes);
  const strokesRef = useRef<Stroke[]>(loadedStrokes);
  const undoStackRef = useRef<UndoAction[]>(
    loadedStrokes.map((stroke) => ({ type: "draw" as const, stroke })),
  );
  const redoStackRef = useRef<UndoAction[]>([]);
  const pendingEraseRef = useRef<Set<Stroke>>(new Set());
  const eraseTrailRef = useRef<{ x: number; y: number }[]>([]);
  const eraseMovingRef = useRef(false);
  const isDrawingRef = useRef(false);
  const activeModifierRef = useRef<
    "meta" | "shift" | "alt" | "line" | "shape" | "highlight" | null
  >(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const showDotGridRef = useRef(showDotGrid);
  showDotGridRef.current = showDotGrid;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const touchToolRef = useRef(touchTool);
  touchToolRef.current = touchTool;
  const lineWidthRef = useRef(lineWidth);
  lineWidthRef.current = lineWidth;
  const lineColorRef = useRef(lineColor);
  lineColorRef.current = lineColor;
  const activeShapeRef = useRef(activeShape);
  activeShapeRef.current = activeShape;
  const isPanningRef = useRef(false);
  const panLastRef = useRef({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [shapeActive, setShapeActive] = useState(false);
  const shapeFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlighting, setHighlighting] = useState(false);
  const highlightKeyRef = useRef(false);
  const keyShapeRef = useRef<ShapeKind | null>(null);
  const cursorWorldRef = useRef({ x: 0, y: 0 });
  const tapStartRef = useRef<{ x: number; y: number; id: number } | null>(null);

  // Multi-touch tracking
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(
    null,
  );
  // Two-finger tap tracking for undo
  const twoFingerTapRef = useRef<{
    startPositions: Map<number, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);

  const persistStrokes = useCallback(() => {
    saveStrokes(strokesRef.current);
  }, []);

  const confirmErase = useCallback(() => {
    eraseTrailRef.current = [];
    const pending = pendingEraseRef.current;
    if (pending.size > 0) {
      const erased = strokesRef.current.filter((s) => pending.has(s));
      strokesRef.current = strokesRef.current.filter((s) => !pending.has(s));
      undoStackRef.current.push({ type: "erase", strokes: erased });
      redoStackRef.current = [];
      pending.clear();
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y, scale } = viewRef.current;

    const isDark = isDarkTheme(themeRef.current);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getBackgroundColor(themeRef.current);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, x, y);

    if (showDotGridRef.current) {
      const baseDotRadius = 1.1 / scale;
      const topLeft = screenToWorld(0, 0, { x, y, scale });
      const bottomRight = screenToWorld(canvas.width, canvas.height, {
        x,
        y,
        scale,
      });

      // Multi-level grid: each level fades independently based on screen gap
      const BASE = 20;
      const baseAlpha = isDark ? 0.4 : 0.45;

      // Collect visible levels (fine → coarse)
      const levels: { spacing: number; opacity: number }[] = [];
      for (let spacing = BASE; spacing < 500000; spacing *= 5) {
        const screenGap = spacing * scale;
        if (screenGap < 4) continue;
        if (screenGap > Math.max(canvas.width, canvas.height) * 2) break;
        // Smooth fade: 0 at screenGap=6, 1 at screenGap=40
        const opacity = Math.max(0, Math.min(1, (screenGap - 6) / 34));
        levels.push({ spacing, opacity });
      }

      // Draw from coarsest to finest so finer dots layer on top
      for (let i = levels.length - 1; i >= 0; i--) {
        const { spacing, opacity } = levels[i];
        if (opacity <= 0) continue;
        const coarser = i < levels.length - 1 ? levels[i + 1].spacing : null;

        const alpha = opacity * baseAlpha;
        ctx.fillStyle = isDark
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(0, 0, 0, ${alpha})`;

        ctx.beginPath();
        const sx = Math.floor(topLeft.x / spacing) * spacing;
        const sy = Math.floor(topLeft.y / spacing) * spacing;
        for (let wx = sx; wx <= bottomRight.x; wx += spacing) {
          for (let wy = sy; wy <= bottomRight.y; wy += spacing) {
            // Skip positions already drawn by a coarser level
            if (coarser) {
              const onCoarserX =
                Math.abs(((wx % coarser) + coarser) % coarser) < 0.5;
              const onCoarserY =
                Math.abs(((wy % coarser) + coarser) % coarser) < 0.5;
              if (onCoarserX && onCoarserY) continue;
            }
            ctx.moveTo(wx + baseDotRadius, wy);
            ctx.arc(wx, wy, baseDotRadius, 0, Math.PI * 2);
          }
        }
        ctx.fill();
      }
    }

    const pending = pendingEraseRef.current;
    if (pending.size > 0) {
      renderStrokesToCtx(
        ctx,
        strokesRef.current.filter((s) => !pending.has(s)),
      );
      ctx.globalAlpha = 0.25;
      renderStrokesToCtx(
        ctx,
        strokesRef.current.filter((s) => pending.has(s)),
      );
      ctx.globalAlpha = 1;
    } else {
      renderStrokesToCtx(ctx, strokesRef.current);
    }

    // Draw erase trail with fading tail
    const trail = eraseTrailRef.current;
    if (trail.length >= 2) {
      const pts = smoothPoints(smoothPoints(trail));
      const len = pts.length;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      for (let i = 1; i < len; i++) {
        const t = i / (len - 1);
        ctx.beginPath();
        ctx.lineWidth = (3 + t * 5) / scale;
        ctx.strokeStyle = `rgba(252, 80, 80, ${t * 0.4})`;
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  const cancelErase = useCallback(() => {
    eraseTrailRef.current = [];
    pendingEraseRef.current.clear();
    isDrawingRef.current = false;
    activeModifierRef.current = null;
    redraw();
  }, [redraw]);

  // Drain erase trail when cursor stops moving
  useEffect(() => {
    if (!erasing) return;
    let raf: number;
    let stopped = false;
    const tick = () => {
      const trail = eraseTrailRef.current;
      if (eraseMovingRef.current) {
        // Reset flag — will be set again on next eraseAt call
        eraseMovingRef.current = false;
      } else if (trail.length > 0) {
        // Not moving — drain tail toward head
        const remove = Math.max(1, Math.ceil(trail.length * 0.15));
        trail.splice(0, remove);
        redraw();
      }
      // Keep running until trail is fully drained, even after erasing ends
      if (!stopped || trail.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      // Don't cancel if trail still needs draining
      if (eraseTrailRef.current.length === 0) {
        cancelAnimationFrame(raf);
      }
    };
  }, [erasing, redraw]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    persistStrokes();
    redraw();
  }, [redraw, persistStrokes]);

  // Swap default stroke colors when switching between dark/light themes, then redraw
  const prevThemeRef = useRef(theme);
  useEffect(() => {
    if (prevThemeRef.current !== theme) {
      const prevIsDark = isDarkTheme(prevThemeRef.current);
      const nowIsDark = isDarkTheme(theme);
      if (prevIsDark !== nowIsDark) {
        const from = nowIsDark ? "#000000" : "#ffffff";
        const to = nowIsDark ? "#ffffff" : "#000000";
        for (const stroke of strokesRef.current) {
          if (stroke.color === from) stroke.color = to;
        }
        const swapAction = (a: UndoAction) => {
          const list = a.type === "draw" ? [a.stroke] : a.strokes;
          for (const s of list) {
            if (s.color === from) s.color = to;
          }
        };
        undoStackRef.current.forEach(swapAction);
        redoStackRef.current.forEach(swapAction);
        persistStrokes();
      }
      prevThemeRef.current = theme;
    }
    redraw();
  }, [showDotGrid, theme, redraw, persistStrokes]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redraw();
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [redraw]);

  const broadcastZoom = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("simpledraw:zoom", { detail: viewRef.current.scale }),
    );
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = { x: 0, y: 0, scale: 1 };
    redraw();
    broadcastZoom();
  }, [redraw, broadcastZoom]);

  const zoomBy = useCallback(
    (factor: number) => {
      const view = viewRef.current;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const newScale = Math.min(10, Math.max(0.1, view.scale * factor));
      const ratio = newScale / view.scale;
      view.x = cx - ratio * (cx - view.x);
      view.y = cy - ratio * (cy - view.y);
      view.scale = newScale;
      redraw();
      broadcastZoom();
    },
    [redraw, broadcastZoom],
  );

  const centerView = useCallback(() => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const stroke of strokes) {
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const pad = 60;
    const w = maxX - minX;
    const h = maxY - minY;
    const vw = window.innerWidth - pad * 2;
    const vh = window.innerHeight - pad * 2;
    if (w === 0 && h === 0) {
      viewRef.current = {
        x: window.innerWidth / 2 - minX,
        y: window.innerHeight / 2 - minY,
        scale: 1,
      };
    } else {
      const scale = Math.min(
        10,
        Math.max(0.1, Math.min(vw / (w || 1), vh / (h || 1))),
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      viewRef.current = {
        x: window.innerWidth / 2 - cx * scale,
        y: window.innerHeight / 2 - cy * scale,
        scale,
      };
    }
    redraw();
    broadcastZoom();
  }, [redraw, broadcastZoom]);

  const exportTransparent = useCallback(() => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const stroke of strokes) {
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const maxLW = Math.max(...strokes.map((s) => s.lineWidth));
    const pad = 20 + maxLW / 2;
    const w = Math.ceil(maxX - minX + pad * 2);
    const h = Math.ceil(maxY - minY + pad * 2);
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d")!;
    ctx.translate(-minX + pad, -minY + pad);
    renderStrokesToCtx(ctx, strokes);
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "simpledraw-transparent.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  }, []);

  // Listen for clear / reset-view / center-view / zoom-step / stroke-count-query / export-transparent events
  useEffect(() => {
    const onClear = () => clearCanvas();
    const onResetView = () => resetView();
    const onCenterView = () => centerView();
    const onZoomStep = (e: Event) =>
      zoomBy((e as CustomEvent).detail as number);
    const onQueryCount = (e: Event) => {
      (e as CustomEvent).detail.count = strokesRef.current.length;
    };
    const onExportTransparent = () => exportTransparent();
    window.addEventListener("simpledraw:clear", onClear);
    window.addEventListener("simpledraw:reset-view", onResetView);
    window.addEventListener("simpledraw:center-view", onCenterView);
    window.addEventListener("simpledraw:zoom-step", onZoomStep);
    window.addEventListener("simpledraw:query-stroke-count", onQueryCount);
    window.addEventListener(
      "simpledraw:export-transparent",
      onExportTransparent,
    );
    return () => {
      window.removeEventListener("simpledraw:clear", onClear);
      window.removeEventListener("simpledraw:reset-view", onResetView);
      window.removeEventListener("simpledraw:center-view", onCenterView);
      window.removeEventListener("simpledraw:zoom-step", onZoomStep);
      window.removeEventListener("simpledraw:query-stroke-count", onQueryCount);
      window.removeEventListener(
        "simpledraw:export-transparent",
        onExportTransparent,
      );
    };
  }, [clearCanvas, resetView, centerView, zoomBy, exportTransparent]);

  const MIN_SHAPE_SIZE = 8;

  const discardTinyShape = useCallback(() => {
    if (
      activeModifierRef.current !== "shape" &&
      activeModifierRef.current !== "line"
    )
      return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    if (!stroke || stroke.points.length < 2) return;
    const dx = Math.abs(stroke.points[1].x - stroke.points[0].x);
    const dy = Math.abs(stroke.points[1].y - stroke.points[0].y);
    if (dx < MIN_SHAPE_SIZE && dy < MIN_SHAPE_SIZE) {
      strokesRef.current.pop();
      undoStackRef.current.pop();
    }
  }, []);

  const cancelCurrentStroke = useCallback(() => {
    if (isDrawingRef.current && activeModifierRef.current !== "alt") {
      strokesRef.current.pop();
      undoStackRef.current.pop();
    }
    if (isDrawingRef.current && activeModifierRef.current === "alt") {
      pendingEraseRef.current.clear();
    }
    isDrawingRef.current = false;
    activeModifierRef.current = null;
    redraw();
  }, [redraw]);

  // Keyboard shortcuts + eraser cursor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (cmdKey(e) && e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event("simpledraw:request-clear"));
      }
      if (cmdKey(e) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const action = undoStackRef.current.pop();
        if (action) {
          if (action.type === "draw") {
            const idx = strokesRef.current.lastIndexOf(action.stroke);
            if (idx !== -1) strokesRef.current.splice(idx, 1);
          } else {
            strokesRef.current.push(...action.strokes);
          }
          redoStackRef.current.push(action);
        }
        persistStrokes();
        redraw();
      }
      if (cmdKey(e) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        const action = redoStackRef.current.pop();
        if (action) {
          if (action.type === "draw") {
            strokesRef.current.push(action.stroke);
          } else {
            for (const s of action.strokes) {
              const idx = strokesRef.current.lastIndexOf(s);
              if (idx !== -1) strokesRef.current.splice(idx, 1);
            }
          }
          undoStackRef.current.push(action);
        }
        persistStrokes();
        redraw();
      }
      if (
        e.ctrlKey &&
        !e.metaKey &&
        (e.code === "Equal" || e.code === "NumpadAdd")
      ) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("simpledraw:thickness", { detail: 1 }),
        );
      }
      if (
        e.ctrlKey &&
        !e.metaKey &&
        (e.code === "Minus" || e.code === "NumpadSubtract")
      ) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("simpledraw:thickness", { detail: -1 }),
        );
      }
      if (e.ctrlKey && !e.metaKey && e.key === "o") {
        e.preventDefault();
        window.dispatchEvent(new Event("simpledraw:toggle-menu"));
      }
      if (cmdKey(e) && e.key === "0") {
        e.preventDefault();
        window.dispatchEvent(new Event("simpledraw:reset-view"));
      }
      if (cmdKey(e) && e.key === "1") {
        e.preventDefault();
        window.dispatchEvent(new Event("simpledraw:center-view"));
      }
      if (e.key === "[") {
        window.dispatchEvent(
          new CustomEvent("simpledraw:color-cycle", { detail: -1 }),
        );
      }
      if (e.key === "]") {
        window.dispatchEvent(
          new CustomEvent("simpledraw:color-cycle", { detail: 1 }),
        );
      }
      if ((e.key === "+" || e.key === "=") && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("simpledraw:zoom-step", { detail: 1.25 }),
        );
      }
      if (e.key === "-" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("simpledraw:zoom-step", { detail: 0.8 }),
        );
      }
      const panAmount = e.shiftKey ? 200 : 50;
      if (e.key === "ArrowUp" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.y -= panAmount;
        redraw();
      }
      if (e.key === "ArrowDown" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.y += panAmount;
        redraw();
      }
      if (e.key === "ArrowLeft" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.x -= panAmount;
        redraw();
      }
      if (e.key === "ArrowRight" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.x += panAmount;
        redraw();
      }
      if (e.key === "." && !cmdKey(e) && !e.altKey) {
        const dot: Stroke = {
          points: [{ ...cursorWorldRef.current }],
          style: "solid",
          lineWidth: lineWidthRef.current,
          color: lineColorRef.current,
        };
        strokesRef.current.push(dot);
        undoStackRef.current.push({ type: "draw", stroke: dot });
        redoStackRef.current = [];
        persistStrokes();
        redraw();
      }
      if (e.key === "Alt" && !e.shiftKey) setErasing(true);
      if (e.key === "Alt" && e.shiftKey && !isMac) setShapeActive(true);
      if (e.key === "Shift" && e.altKey && !isMac) {
        setErasing(false);
        setShapeActive(true);
      }
      if (e.key === "Control" && isMac) setShapeActive(true);
      if (
        e.key === "s" &&
        !cmdKey(e) &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey
      ) {
        window.dispatchEvent(new Event("simpledraw:cycle-shape"));
        if (shapeFlashRef.current) clearTimeout(shapeFlashRef.current);
        setShapeActive(true);
        shapeFlashRef.current = setTimeout(() => {
          setShapeActive(false);
          shapeFlashRef.current = null;
        }, 300);
      }
      if (
        e.key === "S" &&
        !cmdKey(e) &&
        !e.altKey &&
        !e.ctrlKey &&
        e.shiftKey
      ) {
        window.dispatchEvent(new Event("simpledraw:cycle-shape-back"));
        if (shapeFlashRef.current) clearTimeout(shapeFlashRef.current);
        setShapeActive(true);
        shapeFlashRef.current = setTimeout(() => {
          setShapeActive(false);
          shapeFlashRef.current = null;
        }, 300);
      }
      if (e.key === "v" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        highlightKeyRef.current = true;
        setHighlighting(true);
      }
      // Letter-key shape shortcuts
      const shapeKeyMap: Record<string, ShapeKind> = {
        a: "arrow",
        r: "rectangle",
        t: "triangle",
        c: "circle",
      };
      if (
        shapeKeyMap[e.key] &&
        !cmdKey(e) &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey
      ) {
        keyShapeRef.current = shapeKeyMap[e.key];
        setShapeActive(true);
      }
      // Number keys 1-9 for quick color selection
      if (
        e.key >= "1" &&
        e.key <= "9" &&
        !cmdKey(e) &&
        !e.altKey &&
        !e.ctrlKey
      ) {
        const colorIndex = parseInt(e.key) - 1;
        window.dispatchEvent(
          new CustomEvent("simpledraw:set-color-index", { detail: colorIndex }),
        );
      }
      if (e.key === "Escape" && activeModifierRef.current === "alt") {
        e.preventDefault();
        setErasing(false);
        cancelErase();
      }
      if (e.key === "Escape" && activeModifierRef.current === "shape") {
        e.preventDefault();
        cancelCurrentStroke();
      }
      if (e.key === "Escape" && activeModifierRef.current === "highlight") {
        e.preventDefault();
        cancelCurrentStroke();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setErasing(false);
        if (activeModifierRef.current === "alt") {
          confirmErase();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          persistStrokes();
          redraw();
        }
      }
      if (e.key === "v") {
        highlightKeyRef.current = false;
        setHighlighting(false);
        if (activeModifierRef.current === "highlight") {
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          persistStrokes();
        }
      }
      if (e.key === "Control" && isMac) setShapeActive(false);
      if ((e.key === "Alt" || e.key === "Shift") && !isMac)
        setShapeActive(false);
      if (["a", "r", "t", "c"].includes(e.key)) {
        keyShapeRef.current = null;
        setShapeActive(false);
        if (activeModifierRef.current === "shape") {
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          persistStrokes();
          redraw();
        }
      }
    };

    const onBlur = () => {
      setErasing(false);
      setShapeActive(false);
      setHighlighting(false);
      highlightKeyRef.current = false;
      keyShapeRef.current = null;
      if (activeModifierRef.current === "alt") {
        cancelErase();
      }
      if (activeModifierRef.current === "highlight") {
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    clearCanvas,
    persistStrokes,
    redraw,
    confirmErase,
    cancelErase,
    cancelCurrentStroke,
    discardTinyShape,
  ]);

  const eraseAt = useCallback((x: number, y: number) => {
    // Interpolate extra points when cursor jumps far (fast movement)
    const trail = eraseTrailRef.current;
    const maxGap = 6 / viewRef.current.scale;
    if (trail.length > 0) {
      const last = trail[trail.length - 1];
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxGap) {
        const steps = Math.ceil(dist / maxGap);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          trail.push({ x: last.x + dx * t, y: last.y + dy * t });
        }
      }
    }
    trail.push({ x, y });
    eraseMovingRef.current = true;

    // Limit trail by cumulative path length (world coords)
    const maxLen = 200 / viewRef.current.scale;
    if (trail.length > 2) {
      let acc = 0;
      let cutIdx = 0;
      for (let i = trail.length - 1; i > 0; i--) {
        const dx = trail[i].x - trail[i - 1].x;
        const dy = trail[i].y - trail[i - 1].y;
        acc += Math.sqrt(dx * dx + dy * dy);
        if (acc > maxLen) {
          cutIdx = i;
          break;
        }
      }
      if (cutIdx > 0) {
        trail.splice(0, cutIdx);
      } else if (trail.length > 50) {
        trail.splice(0, trail.length - 50);
      }
    }
    const radius = 12 / viewRef.current.scale;
    for (const stroke of strokesRef.current) {
      if (pendingEraseRef.current.has(stroke)) continue;
      let hit = false;
      // For shape strokes, test against the rendered shape polygon
      const pts =
        stroke.shape && stroke.points.length === 2
          ? shapeToSegments(stroke)
          : stroke.points;
      for (const p of pts) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < radius * radius) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          if (distToSegment(x, y, a.x, a.y, b.x, b.y) < radius) {
            hit = true;
            break;
          }
        }
      }
      if (hit) pendingEraseRef.current.add(stroke);
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size === 2) {
          // Cancel any in-progress drawing/pan and start pinch
          if (isDrawingRef.current) cancelCurrentStroke();
          isPanningRef.current = false;
          const pts = [...pointersRef.current.values()];
          pinchRef.current = {
            dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
            cx: (pts[0].x + pts[1].x) / 2,
            cy: (pts[0].y + pts[1].y) / 2,
          };
          // Start tracking two-finger tap for undo
          twoFingerTapRef.current = {
            startPositions: new Map(pointersRef.current),
            moved: false,
          };
        } else if (
          pointersRef.current.size === 1 &&
          touchToolRef.current === "hand"
        ) {
          isPanningRef.current = true;
          panLastRef.current = { x: e.clientX, y: e.clientY };
        }
        // Track tap start for single-finger draw/dashed/line/shape/highlight tools
        const tool = touchToolRef.current;
        if (
          pointersRef.current.size === 1 &&
          (tool === "draw" ||
            tool === "dashed" ||
            tool === "line" ||
            tool === "shape" ||
            tool === "highlight")
        ) {
          tapStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        } else {
          tapStartRef.current = null;
        }
      } else if (
        (e.buttons & 1) !== 0 &&
        !e.altKey &&
        !cmdKey(e) &&
        !e.shiftKey
      ) {
        // Mouse: bare left click = pan
        isPanningRef.current = true;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        setPanning(true);
      }
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [cancelCurrentStroke],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) {
          // Check for two-finger tap (undo gesture)
          if (
            pointersRef.current.size === 1 &&
            twoFingerTapRef.current &&
            !twoFingerTapRef.current.moved
          ) {
            // Two fingers were down and neither moved much - trigger undo
            const action = undoStackRef.current.pop();
            if (action) {
              if (action.type === "draw") {
                const idx = strokesRef.current.lastIndexOf(action.stroke);
                if (idx !== -1) strokesRef.current.splice(idx, 1);
              } else {
                strokesRef.current.push(...action.strokes);
              }
              redoStackRef.current.push(action);
              persistStrokes();
              redraw();
            }
          }
          twoFingerTapRef.current = null;
          pinchRef.current = null;
        }
        if (pointersRef.current.size === 0) {
          if (isPanningRef.current) {
            isPanningRef.current = false;
            tapStartRef.current = null;
            return;
          }
          // Tap-to-dot: if finger didn't move beyond threshold, place a dot
          if (tapStartRef.current && tapStartRef.current.id === e.pointerId) {
            const dx = e.clientX - tapStartRef.current.x;
            const dy = e.clientY - tapStartRef.current.y;
            if (dx * dx + dy * dy <= 25) {
              // Remove any stroke that was started by the move handler
              if (isDrawingRef.current) {
                strokesRef.current.pop();
                undoStackRef.current.pop();
                isDrawingRef.current = false;
                activeModifierRef.current = null;
              }
              const wp = screenToWorld(
                tapStartRef.current.x,
                tapStartRef.current.y,
                viewRef.current,
              );
              const dot: Stroke = {
                points: [wp],
                style: "solid",
                lineWidth: lineWidthRef.current,
                color: lineColorRef.current,
              };
              strokesRef.current.push(dot);
              undoStackRef.current.push({ type: "draw", stroke: dot });
              redoStackRef.current = [];
              persistStrokes();
              redraw();
              tapStartRef.current = null;
              return;
            }
          }
          tapStartRef.current = null;
          if (isDrawingRef.current) {
            if (activeModifierRef.current === "alt") {
              setErasing(false);
              confirmErase();
              redraw();
            }
            discardTinyShape();
            isDrawingRef.current = false;
            activeModifierRef.current = null;
            persistStrokes();
            redraw();
          }
        }
        return;
      }
      // Mouse pointer up
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setPanning(false);
        return;
      }
      if (isDrawingRef.current) {
        if (activeModifierRef.current === "alt") {
          confirmErase();
          redraw();
        }
        discardTinyShape();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
        redraw();
      }
    },
    [confirmErase, discardTinyShape, persistStrokes, redraw],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // --- Multi-touch pan/zoom ---
      if (e.pointerType === "touch") {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size >= 2 && pinchRef.current) {
          const pts = [...pointersRef.current.values()];
          const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          const cx = (pts[0].x + pts[1].x) / 2;
          const cy = (pts[0].y + pts[1].y) / 2;
          // Check if fingers moved enough to invalidate two-finger tap
          if (twoFingerTapRef.current && !twoFingerTapRef.current.moved) {
            const startPts = twoFingerTapRef.current.startPositions;
            let totalMove = 0;
            for (const [id, pos] of pointersRef.current) {
              const start = startPts.get(id);
              if (start) {
                totalMove += Math.hypot(pos.x - start.x, pos.y - start.y);
              }
            }
            if (totalMove > 20) {
              twoFingerTapRef.current.moved = true;
            }
          }
          // Pan
          const view = viewRef.current;
          view.x += cx - pinchRef.current.cx;
          view.y += cy - pinchRef.current.cy;
          // Zoom
          const factor = dist / pinchRef.current.dist;
          const newScale = Math.min(10, Math.max(0.1, view.scale * factor));
          const ratio = newScale / view.scale;
          view.x = cx - ratio * (cx - view.x);
          view.y = cy - ratio * (cy - view.y);
          view.scale = newScale;
          pinchRef.current = { dist, cx, cy };
          broadcastZoom();
          redraw();
          return;
        }
        if (pointersRef.current.size > 1) return;
        // Cancel tap if finger moved beyond threshold
        if (tapStartRef.current) {
          const dx = e.clientX - tapStartRef.current.x;
          const dy = e.clientY - tapStartRef.current.y;
          if (dx * dx + dy * dy > 25) tapStartRef.current = null;
        }
      }

      // --- Panning (mouse bare-click or touch hand tool) ---
      if (isPanningRef.current) {
        const view = viewRef.current;
        view.x += e.clientX - panLastRef.current.x;
        view.y += e.clientY - panLastRef.current.y;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        redraw();
        return;
      }

      // Track cursor world position for desktop dot placement
      if (e.pointerType !== "touch") {
        cursorWorldRef.current = screenToWorld(
          e.clientX,
          e.clientY,
          viewRef.current,
        );
      }

      // --- Determine modifier ---
      let modifier:
        | "meta"
        | "shift"
        | "alt"
        | "line"
        | "shape"
        | "highlight"
        | null;

      if (e.pointerType === "touch") {
        const down = (e.buttons & 1) !== 0;
        if (!down) {
          modifier = null;
        } else {
          const tool = touchToolRef.current;
          modifier =
            tool === "draw"
              ? "meta"
              : tool === "dashed"
                ? "shift"
                : tool === "line"
                  ? "line"
                  : tool === "erase"
                    ? "alt"
                    : tool === "shape"
                      ? "shape"
                      : tool === "highlight"
                        ? "highlight"
                        : null;
        }
      } else {
        modifier = highlightKeyRef.current
          ? "highlight"
          : keyShapeRef.current
            ? "shape"
            : e.altKey && e.shiftKey && !isMac
              ? "shape"
              : e.altKey
                ? "alt"
                : e.ctrlKey && !e.metaKey && isMac
                  ? "shape"
                  : cmdKey(e) && e.shiftKey
                    ? "line"
                    : cmdKey(e)
                      ? "meta"
                      : e.shiftKey
                        ? "shift"
                        : null;
      }

      if (!modifier) {
        if (isDrawingRef.current) {
          if (activeModifierRef.current === "alt") {
            confirmErase();
            redraw();
          }
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          persistStrokes();
          redraw();
        }
        return;
      }

      const point = screenToWorld(e.clientX, e.clientY, viewRef.current);

      // Flush erase buffer when switching away from erasing
      if (modifier !== "alt" && activeModifierRef.current === "alt") {
        confirmErase();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }

      if (modifier === "alt") {
        if (!isDrawingRef.current || activeModifierRef.current !== "alt") {
          pendingEraseRef.current.clear();
          eraseTrailRef.current = [];
          setErasing(true);
        }
        isDrawingRef.current = true;
        activeModifierRef.current = "alt";
        eraseAt(point.x, point.y);
        redraw();
        return;
      }

      if (modifier === "line") {
        if (!isDrawingRef.current || activeModifierRef.current !== "line") {
          isDrawingRef.current = true;
          activeModifierRef.current = "line";
          const stroke: Stroke = {
            points: [point, { ...point }],
            style: "solid",
            lineWidth,
            color: lineColor,
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          current.points[1] = point;
        }
        redraw();
        return;
      }

      if (modifier === "shape") {
        if (!isDrawingRef.current || activeModifierRef.current !== "shape") {
          isDrawingRef.current = true;
          activeModifierRef.current = "shape";
          const stroke: Stroke = {
            points: [point, { ...point }],
            style: "solid",
            lineWidth,
            color: lineColor,
            shape: keyShapeRef.current || activeShapeRef.current,
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          current.points[1] = point;
        }
        redraw();
        return;
      }

      if (modifier === "highlight") {
        if (
          !isDrawingRef.current ||
          activeModifierRef.current !== "highlight"
        ) {
          isDrawingRef.current = true;
          activeModifierRef.current = "highlight";
          const stroke: Stroke = {
            points: [point],
            style: "solid",
            lineWidth,
            dashGap,
            color: lineColor,
            highlight: true,
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          current.points.push(point);
        }
        redraw();
        return;
      }

      if (!isDrawingRef.current || activeModifierRef.current !== modifier) {
        isDrawingRef.current = true;
        activeModifierRef.current = modifier;
        const stroke: Stroke = {
          points: [point],
          style: modifier === "shift" ? "dashed" : "solid",
          lineWidth,
          dashGap,
          color: lineColor,
        };
        strokesRef.current.push(stroke);
        undoStackRef.current.push({ type: "draw", stroke });
        redoStackRef.current = [];
      } else {
        const current = strokesRef.current[strokesRef.current.length - 1];
        current.points.push(point);
      }

      redraw();
    },
    [
      redraw,
      lineWidth,
      lineColor,
      dashGap,
      eraseAt,
      persistStrokes,
      confirmErase,
      discardTinyShape,
      broadcastZoom,
    ],
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") return; // handled by pointerUp with capture
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setPanning(false);
      }
      if (isDrawingRef.current) {
        if (activeModifierRef.current === "alt") {
          cancelErase();
          return;
        }
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }
    },
    [persistStrokes, cancelErase],
  );

  // Wheel: pan (scroll) and zoom (Ctrl/Cmd + scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom on trackpad (sets ctrlKey) or Ctrl/Cmd+scroll
        const zoom = Math.pow(0.99, e.deltaY);
        const newScale = Math.min(10, Math.max(0.1, view.scale * zoom));
        const ratio = newScale / view.scale;
        view.x = e.clientX - ratio * (e.clientX - view.x);
        view.y = e.clientY - ratio * (e.clientY - view.y);
        view.scale = newScale;
        broadcastZoom();
      } else {
        // Two-finger swipe on trackpad or mouse scroll = pan
        view.x -= e.deltaX;
        view.y -= e.deltaY;
      }
      redraw();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [redraw, broadcastZoom]);

  const encodedColor = encodeURIComponent(lineColor);
  const crosshairCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='12' y1='4' x2='12' y2='20' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, crosshair`;
  const eraserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='50%25' stop-color='%2389CFF0'/%3E%3Cstop offset='50%25' stop-color='%23FA8072'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='3' y='5' width='18' height='12' rx='2.5' transform='rotate(-25 12 11)' fill='url(%23g)' stroke='%23666' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`;
  const shapeCursors: Record<ShapeKind, string> = {
    line: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='20' x2='20' y2='4' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    rectangle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect x='4' y='4' width='16' height='16' fill='none' stroke='${encodedColor}' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`,
    circle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='8' fill='none' stroke='${encodedColor}' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`,
    triangle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,4 20,20 4,20' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    star: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,2 14.5,9 22,9 16,14 18.5,21 12,17 5.5,21 8,14 2,9 9.5,9' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    arrow: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='12' x2='18' y2='12' stroke='${encodedColor}' stroke-width='1.5'/%3E%3Cpolyline points='14,8 18,12 14,16' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    pentagon: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,3 21,10 18,21 6,21 3,10' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    hexagon: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,2 21,7 21,17 12,22 3,17 3,7' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    diamond: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,2 22,12 12,22 2,12' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    lightning: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='13,2 4,12 11,12 9,22 20,10 13,10' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
  };
  const highlightCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='${encodedColor}' stroke-width='6' stroke-linecap='round' stroke-opacity='0.4'/%3E%3C/svg%3E") 12 12, crosshair`;
  const cursor = panning
    ? "grabbing"
    : erasing
      ? eraserCursor
      : highlighting
        ? highlightCursor
        : shapeActive
          ? shapeCursors[keyShapeRef.current || activeShape]
          : crosshairCursor;

  return (
    <canvas
      ref={canvasRef}
      className="block touch-none select-none"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
