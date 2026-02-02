import { useRef, useEffect, useCallback, useState } from "react";

type Stroke = {
  points: { x: number; y: number }[];
  style: "solid" | "dashed";
  lineWidth: number;
  dashGap?: number;
  color: string;
};

type UndoAction =
  | { type: "draw"; stroke: Stroke }
  | { type: "erase"; strokes: Stroke[] };

export type TouchTool = "draw" | "dashed" | "line" | "erase" | "hand";

const STROKES_KEY = "blackboard-strokes";

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

function renderStrokesToCtx(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const dashScale = stroke.lineWidth / 4;
    ctx.setLineDash(
      stroke.style === "dashed"
        ? [10 * dashScale, (stroke.dashGap ?? 8) * 5 * dashScale]
        : [],
    );
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }
}

export default function Canvas({
  lineWidth,
  lineColor,
  dashGap,
  showDotGrid,
  resolvedTheme,
  touchTool,
}: {
  lineWidth: number;
  lineColor: string;
  dashGap: number;
  showDotGrid: boolean;
  resolvedTheme: "dark" | "light";
  touchTool: TouchTool;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedStrokes] = useState(loadStrokes);
  const strokesRef = useRef<Stroke[]>(loadedStrokes);
  const undoStackRef = useRef<UndoAction[]>(
    loadedStrokes.map((stroke) => ({ type: "draw" as const, stroke })),
  );
  const redoStackRef = useRef<UndoAction[]>([]);
  const eraseBufRef = useRef<Stroke[]>([]);
  const isDrawingRef = useRef(false);
  const activeModifierRef = useRef<"meta" | "shift" | "alt" | "line" | null>(
    null,
  );
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const showDotGridRef = useRef(showDotGrid);
  showDotGridRef.current = showDotGrid;
  const resolvedThemeRef = useRef(resolvedTheme);
  resolvedThemeRef.current = resolvedTheme;
  const touchToolRef = useRef(touchTool);
  touchToolRef.current = touchTool;
  const isPanningRef = useRef(false);
  const panLastRef = useRef({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [erasing, setErasing] = useState(false);

  // Multi-touch tracking
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(
    null,
  );

  const persistStrokes = useCallback(() => {
    saveStrokes(strokesRef.current);
  }, []);

  const flushEraseBuf = useCallback(() => {
    if (eraseBufRef.current.length > 0) {
      undoStackRef.current.push({
        type: "erase",
        strokes: eraseBufRef.current,
      });
      eraseBufRef.current = [];
      redoStackRef.current = [];
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y, scale } = viewRef.current;

    const isDark = resolvedThemeRef.current === "dark";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isDark ? "#0a0a1a" : "#f5f5f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, x, y);

    if (showDotGridRef.current) {
      const spacing = 40 / scale;
      const dotRadius = 1 / scale;
      const topLeft = screenToWorld(0, 0, { x, y, scale });
      const bottomRight = screenToWorld(canvas.width, canvas.height, {
        x,
        y,
        scale,
      });
      const startX = Math.floor(topLeft.x / spacing) * spacing;
      const startY = Math.floor(topLeft.y / spacing) * spacing;

      ctx.fillStyle = isDark
        ? "rgba(255, 255, 255, 0.25)"
        : "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      for (let wx = startX; wx <= bottomRight.x; wx += spacing) {
        for (let wy = startY; wy <= bottomRight.y; wy += spacing) {
          ctx.moveTo(wx + dotRadius, wy);
          ctx.arc(wx, wy, dotRadius, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }

    renderStrokesToCtx(ctx, strokesRef.current);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    persistStrokes();
    redraw();
  }, [redraw, persistStrokes]);

  // Swap default stroke colors when theme changes, then redraw
  const prevThemeRef = useRef(resolvedTheme);
  useEffect(() => {
    if (prevThemeRef.current !== resolvedTheme) {
      const from = resolvedTheme === "light" ? "#ffffff" : "#000000";
      const to = resolvedTheme === "light" ? "#000000" : "#ffffff";
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
      prevThemeRef.current = resolvedTheme;
      persistStrokes();
    }
    redraw();
  }, [showDotGrid, resolvedTheme, redraw, persistStrokes]);

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
      new CustomEvent("blackboard:zoom", { detail: viewRef.current.scale }),
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
    window.addEventListener("blackboard:clear", onClear);
    window.addEventListener("blackboard:reset-view", onResetView);
    window.addEventListener("blackboard:center-view", onCenterView);
    window.addEventListener("blackboard:zoom-step", onZoomStep);
    window.addEventListener("blackboard:query-stroke-count", onQueryCount);
    window.addEventListener(
      "blackboard:export-transparent",
      onExportTransparent,
    );
    return () => {
      window.removeEventListener("blackboard:clear", onClear);
      window.removeEventListener("blackboard:reset-view", onResetView);
      window.removeEventListener("blackboard:center-view", onCenterView);
      window.removeEventListener("blackboard:zoom-step", onZoomStep);
      window.removeEventListener("blackboard:query-stroke-count", onQueryCount);
      window.removeEventListener(
        "blackboard:export-transparent",
        onExportTransparent,
      );
    };
  }, [clearCanvas, resetView, centerView, zoomBy, exportTransparent]);

  // Keyboard shortcuts + eraser cursor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (cmdKey(e) && e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event("blackboard:request-clear"));
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
          new CustomEvent("blackboard:thickness", { detail: 1 }),
        );
      }
      if (
        e.ctrlKey &&
        !e.metaKey &&
        (e.code === "Minus" || e.code === "NumpadSubtract")
      ) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("blackboard:thickness", { detail: -1 }),
        );
      }
      if (e.ctrlKey && !e.metaKey && e.key === "o") {
        e.preventDefault();
        window.dispatchEvent(new Event("blackboard:toggle-menu"));
      }
      if (cmdKey(e) && e.key === "0") {
        e.preventDefault();
        window.dispatchEvent(new Event("blackboard:reset-view"));
      }
      if (cmdKey(e) && e.key === "1") {
        e.preventDefault();
        window.dispatchEvent(new Event("blackboard:center-view"));
      }
      if (e.key === "Alt") setErasing(true);
      if (
        e.key === "Meta" ||
        e.key === "Control" ||
        e.key === "Shift"
      )
        setDrawMode(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setErasing(false);
        if (activeModifierRef.current === "alt") {
          flushEraseBuf();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          persistStrokes();
        }
      }
      if (
        e.key === "Meta" ||
        e.key === "Control" ||
        e.key === "Shift"
      ) {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
          setDrawMode(false);
        }
      }
    };

    const onBlur = () => {
      setDrawMode(false);
      setErasing(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [clearCanvas, persistStrokes, redraw, flushEraseBuf]);

  const eraseAt = useCallback((x: number, y: number) => {
    const radius = 12 / viewRef.current.scale;
    const kept: Stroke[] = [];
    for (const stroke of strokesRef.current) {
      let hit = false;
      for (const p of stroke.points) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < radius * radius) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let i = 1; i < stroke.points.length; i++) {
          const a = stroke.points[i - 1];
          const b = stroke.points[i];
          if (distToSegment(x, y, a.x, a.y, b.x, b.y) < radius) {
            hit = true;
            break;
          }
        }
      }
      if (hit) eraseBufRef.current.push(stroke);
      else kept.push(stroke);
    }
    strokesRef.current = kept;
  }, []);

  const cancelCurrentStroke = useCallback(() => {
    if (isDrawingRef.current && activeModifierRef.current !== "alt") {
      strokesRef.current.pop();
      undoStackRef.current.pop();
    }
    if (isDrawingRef.current && activeModifierRef.current === "alt") {
      // Put erased strokes back
      strokesRef.current.push(...eraseBufRef.current);
      eraseBufRef.current = [];
    }
    isDrawingRef.current = false;
    activeModifierRef.current = null;
    redraw();
  }, [redraw]);

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
        } else if (
          pointersRef.current.size === 1 &&
          touchToolRef.current === "hand"
        ) {
          isPanningRef.current = true;
          panLastRef.current = { x: e.clientX, y: e.clientY };
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
        if (pointersRef.current.size < 2) pinchRef.current = null;
        if (pointersRef.current.size === 0) {
          if (isPanningRef.current) {
            isPanningRef.current = false;
            return;
          }
          if (isDrawingRef.current) {
            if (activeModifierRef.current === "alt") flushEraseBuf();
            isDrawingRef.current = false;
            activeModifierRef.current = null;
            persistStrokes();
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
        if (activeModifierRef.current === "alt") flushEraseBuf();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }
    },
    [flushEraseBuf, persistStrokes],
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

      // --- Determine modifier ---
      let modifier: "meta" | "shift" | "alt" | "line" | null;

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
                    : null;
        }
      } else {
        modifier = e.altKey
          ? "alt"
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
          if (activeModifierRef.current === "alt") flushEraseBuf();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          persistStrokes();
        }
        return;
      }

      const point = screenToWorld(e.clientX, e.clientY, viewRef.current);

      // Flush erase buffer when switching away from erasing
      if (modifier !== "alt" && activeModifierRef.current === "alt") {
        flushEraseBuf();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }

      if (modifier === "alt") {
        if (!isDrawingRef.current || activeModifierRef.current !== "alt") {
          eraseBufRef.current = [];
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
      flushEraseBuf,
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
        if (activeModifierRef.current === "alt") flushEraseBuf();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }
    },
    [persistStrokes, flushEraseBuf],
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
  const eraserStroke = resolvedTheme === "dark" ? "white" : "black";
  const eraserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${eraserStroke}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 21h10'/%3E%3Crect x='3' y='5' width='18' height='12' rx='1' transform='rotate(-15 12 11)'/%3E%3Cpath d='m3.5 13.5 5 5'/%3E%3C/svg%3E") 12 12, crosshair`;

  const cursor = panning
    ? "grabbing"
    : erasing
      ? eraserCursor
      : drawMode
        ? crosshairCursor
        : "grab";

  return (
    <canvas
      ref={canvasRef}
      className="block touch-none"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
