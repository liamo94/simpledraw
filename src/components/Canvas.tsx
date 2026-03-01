import { useRef, useEffect, useCallback, useState, memo } from "react";
import type { ShapeKind, Theme, TextSize, GridType, FontFamily, TextAlign } from "../hooks/useSettings";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useTextSelection } from "../hooks/useTextSelection";
import {
  isDarkTheme, getBackgroundColor,
  TEXT_SIZE_MAP, buildFont, dispatchTextStyleSync,
  loadStrokes, saveStrokes, loadView, saveView,
  distToSegment, cmdKey, screenToWorld, smoothPoints, isMac,
  shapeToSegments,
  textBBox, anyStrokeBBox,
  renderStrokesToCtx, snapshotCache,
} from "../canvas/canvasUtils";
import type { Stroke, UndoAction, BBox, TouchTool } from "../canvas/canvasUtils";
export type { TouchTool } from "../canvas/canvasUtils";

function Canvas({
  lineWidth,
  lineColor,
  dashGap,
  gridType,
  theme,
  touchTool,
  activeShape,
  shapeFill,
  shapeDashed,
  canvasIndex,
  textSize,
  fontFamily,
  textBold,
  textItalic,
  textAlign,
  pressureSensitivity,
  onContentOffScreen,
}: {
  lineWidth: number;
  lineColor: string;
  dashGap: number;
  gridType: GridType;
  theme: Theme;
  touchTool: TouchTool;
  activeShape: ShapeKind;
  shapeFill: boolean;
  shapeDashed: boolean;
  canvasIndex: number;
  textSize: TextSize;
  fontFamily: FontFamily;
  textBold: boolean;
  textItalic: boolean;
  textAlign: TextAlign;
  pressureSensitivity: boolean;
  onContentOffScreen?: (offScreen: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasIndexRef = useRef(canvasIndex);
  const [loadedStrokes] = useState(() => loadStrokes(canvasIndex));
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
    "meta" | "shift" | "alt" | "line" | "shape" | "highlight" | "laser" | null
  >(null);
  const laserTrailRef = useRef<{ x: number; y: number }[]>([]);
  const laserMovingRef = useRef(false);
  const viewRef = useRef(loadView(canvasIndex));
  const gridTypeRef = useRef(gridType);
  gridTypeRef.current = gridType;
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
  const shapeFillRef = useRef(shapeFill);
  shapeFillRef.current = shapeFill;
  const shapeDashedRef = useRef(shapeDashed);
  shapeDashedRef.current = shapeDashed;
  const pressureSensitivityRef = useRef(pressureSensitivity);
  pressureSensitivityRef.current = pressureSensitivity;
  const lastDrawPointRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const prevWidthRef = useRef(1);
  const isPanningRef = useRef(false);
  const panLastRef = useRef({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [shapeActive, setShapeActive] = useState(false);
  const shapeFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isZoomingRef = useRef(false);
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlighting, setHighlighting] = useState(false);
  const [zCursor, setZCursor] = useState<string | null>(null);
  const highlightKeyRef = useRef(false);
  const laserKeyRef = useRef(false);
  const [lasering, setLasering] = useState(false);
  const spaceDownRef = useRef(false);
  const keyShapeRef = useRef<ShapeKind | null>(null);
  const keyShapeDashedRef = useRef(false);
  const fKeyHeldRef = useRef(false);
  const pointerButtonDownRef = useRef(false);
  const shiftHeldRef = useRef(false); // own shift tracking — e.shiftKey can get stuck on Mac
  const shapeJustCommittedRef = useRef(false); // block phantom shapes from drift after pointer-up
  const clipboardRef = useRef<Stroke[] | null>(null);
  const cursorWorldRef = useRef({ x: 0, y: 0 });
  const lastDPressRef = useRef(0);
  const tapStartRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const isWritingRef = useRef(false);
  const writingPosRef = useRef({ x: 0, y: 0 });
  const writingTextRef = useRef("");
  const caretVisibleRef = useRef(true);
  const caretTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const caretPosRef = useRef(0); // tracks selectionEnd for caret rendering
  const selectionAnchorRef = useRef<number | null>(null); // non-null = selection active
  const writingBoldRef = useRef(false);
  const writingItalicRef = useRef(false);
  const writingAlignRef = useRef<TextAlign>("left");
  const textUndoRef = useRef<string[]>([]);
  const textRedoRef = useRef<string[]>([]);
  const textSizeRef = useRef(textSize);
  textSizeRef.current = textSize;
  const fontFamilyRef = useRef(fontFamily);
  fontFamilyRef.current = fontFamily;
  const textBoldRef = useRef(textBold);
  textBoldRef.current = textBold;
  const textItalicRef = useRef(textItalic);
  textItalicRef.current = textItalic;
  const textAlignRef = useRef(textAlign);
  textAlignRef.current = textAlign;
  const onContentOffScreenRef = useRef(onContentOffScreen);
  onContentOffScreenRef.current = onContentOffScreen;

  // Text select / move / resize / edit state
  const zKeyRef = useRef(false);
  const selectedTextRef = useRef<Stroke | null>(null);
  const hoverTextRef = useRef<Stroke | null>(null);
  const editingStrokeRef = useRef<Stroke | null>(null);
  const editingOldTextRef = useRef("");
  const lastTextTapRef = useRef<{ time: number; stroke: Stroke } | null>(null);
  const selectDragRef = useRef<{
    mode: "move" | "corner";
    corner?: 0 | 1 | 2 | 3;
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[];
    startScale: number;
    bbox: BBox;
    cycleHits?: Stroke[]; // strokes under pointer for deferred click-to-cycle
  } | null>(null);
  const boxSelectRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number }; containOnly?: boolean } | null>(null);
  const selectedGroupRef = useRef<Stroke[]>([]);
  const groupDragRef = useRef<{
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[][];
  } | null>(null);

  // Refs to late-defined callbacks (populated after they're created below)
  const finishWritingRef = useRef<() => void>(() => {});
  const startWritingRef = useRef<(pos: { x: number; y: number }) => void>(() => {});
  const cursorRef = useRef("");

  // Multi-touch tracking
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(
    null,
  );
  // Two-finger tap tracking for undo, three-finger tap for redo
  const twoFingerTapRef = useRef<{
    startPositions: Map<number, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);
  const threeFingerTapRef = useRef<{
    startPositions: Map<number, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);

  // --- Debounced persistStrokes (item 5) ---
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistStrokes = useCallback(() => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    saveStrokes(strokesRef.current, canvasIndexRef.current);
  }, []);

  const persistStrokesDebounced = useCallback(() => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      saveStrokes(strokesRef.current, canvasIndexRef.current);
    }, 500);
  }, []);

  const notifyColorUsed = useCallback((color: string) => {
    window.dispatchEvent(new CustomEvent("drawtool:color-used", { detail: color }));
  }, []);

  const persistView = useCallback(() => {
    saveView(viewRef.current, canvasIndexRef.current);
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

  // --- Dot grid pattern tile cache (item 7) ---
  // Key: `${Math.ceil(screenGap)},${isDark}` → tiny tile canvas pattern.
  // Using createPattern lets the GPU tile it — panning is free (just update
  // the pattern transform offset) and zooming only creates a new tile when
  // the screen gap changes by ≥1px, instead of redrawing N² arcs each frame.
  const gridPatternCacheRef = useRef<Map<string, CanvasPattern>>(new Map());

  // --- Completed strokes cache (item 8) ---
  const strokesCacheRef = useRef<{
    canvas: HTMLCanvasElement;
    key: string;
  } | null>(null);

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

    // --- Grid via tiled patterns ---
    const isDarkKey = isDark ? "1" : "0";
    if (gridTypeRef.current === "dot") {
      const BASE = 12;
      const DOT_RADIUS = 0.75;
      const baseAlpha = isDark ? 0.4 : 0.55;
      const dotColor = isDark ? "white" : "black";

      for (let spacing = BASE; spacing < 500000; spacing *= 5) {
        const screenGap = spacing * scale;
        if (screenGap < 4) continue;
        if (screenGap > Math.max(canvas.width, canvas.height) * 2) break;
        const opacity = Math.max(0, Math.min(1, (screenGap - 6) / 20));
        if (opacity <= 0) continue;

        const tileSize = Math.max(Math.round(screenGap), 1);
        const patternScale = screenGap / tileSize;
        const tileKey = `${tileSize},${isDarkKey}`;
        let pattern = gridPatternCacheRef.current.get(tileKey);
        if (!pattern) {
          const tile = document.createElement("canvas");
          tile.width = tileSize;
          tile.height = tileSize;
          const tctx = tile.getContext("2d")!;
          const half = tileSize / 2;
          tctx.fillStyle = dotColor;
          tctx.beginPath();
          tctx.arc(half, half, DOT_RADIUS, 0, Math.PI * 2);
          tctx.fill();
          pattern = ctx.createPattern(tile, "repeat")!;
          gridPatternCacheRef.current.set(tileKey, pattern);
        }

        const ox = ((x % screenGap) + screenGap) % screenGap;
        const oy = ((y % screenGap) + screenGap) % screenGap;
        pattern.setTransform(
          new DOMMatrix()
            .translate(ox - screenGap / 2, oy - screenGap / 2)
            .scale(patternScale),
        );

        ctx.globalAlpha = opacity * baseAlpha;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.globalAlpha = 1;
    } else if (gridTypeRef.current === "square") {
      // Adaptive multi-level grid. Each spacing level independently crossfades
      // between two roles based on its current screen size:
      //   Minor (dashed):  screenGap ~10–120 px  — inner subdivisions
      //   Major (solid):   screenGap ~60–600 px  — outer grid lines
      // The 60–120 px overlap is the crossfade zone where a level transitions
      // from dashed inner to solid outer as you zoom in, giving seamless adaption.
      const lineColor = isDark ? "white" : "black";
      const canvasMax = Math.max(canvas.width, canvas.height);

      const drawSqLevel = (sg: number, dashed: boolean, alpha: number) => {
        if (alpha < 0.005) return;
        const tileSize = Math.max(Math.round(sg), 1);
        const patternScale = sg / tileSize;
        const tileKey = `sq-${tileSize},${isDarkKey},${dashed ? "d" : "s"}`;
        let pat = gridPatternCacheRef.current.get(tileKey);
        if (!pat) {
          const tile = document.createElement("canvas");
          tile.width = tileSize; tile.height = tileSize;
          const tc = tile.getContext("2d")!;
          tc.strokeStyle = lineColor; tc.lineWidth = 1;
          if (dashed) {
            const du = Math.max(2, tileSize / 16); // 8 cycles/tile → seamless
            tc.setLineDash([du, du]);
          }
          tc.beginPath(); tc.moveTo(tileSize - 0.5, 0); tc.lineTo(tileSize - 0.5, tileSize); tc.stroke();
          tc.beginPath(); tc.moveTo(0, tileSize - 0.5); tc.lineTo(tileSize, tileSize - 0.5); tc.stroke();
          pat = ctx.createPattern(tile, "repeat")!;
          gridPatternCacheRef.current.set(tileKey, pat);
        }
        const ox = ((x % sg) + sg) % sg;
        const oy = ((y % sg) + sg) % sg;
        pat.setTransform(new DOMMatrix().translate(ox - sg, oy - sg).scale(patternScale));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      // Zoom-responsive global multiplier:
      //   scale < 0.2  → dims to ~15% ("very far away")
      //   scale 0.2–3  → normal
      //   scale > 3    → brightens to 1.5× ("zoomed in close")
      const zoomAlpha =
        scale < 0.2  ? Math.max(0.15, scale / 0.2)
        : scale > 3  ? Math.min(1.5, 1 + (scale - 3) / 6)
        : 1.0;

      if (scale >= 0.5) {
        // ≥ 50%: adaptive — grid coarsens automatically to stay comfortable
        for (let spacing = 12; spacing < 500000; spacing *= 5) {
          const sg = spacing * scale;
          if (sg < 4) continue;
          if (sg > canvasMax * 2) break;

          const minorOp =
            Math.max(0, Math.min(1, (sg - 10) / 20)) *
            Math.max(0, Math.min(1, (50 - sg) / 20));
          const majorOp =
            Math.max(0, Math.min(1, (sg - 30) / 30)) *
            Math.max(0, Math.min(1, (600 - sg) / 200));

          const darkAlphaScale = themeRef.current === "dark" ? 1.4 : 1;
          drawSqLevel(sg, true,  minorOp * zoomAlpha * (isDark ? 0.04 * darkAlphaScale : 0.08));
          drawSqLevel(sg, false, majorOp * zoomAlpha * (isDark ? 0.07 * darkAlphaScale : 0.12));
        }
      } else {
        // < 50%: fixed world-space levels so squares shrink with zoom,
        // giving clear visual feedback that you're far out.
        // At scale=0.5 both branches produce identical output (30px/150px) — seamless.
        const drawFixed = (spacing: number, dashed: boolean, baseAlpha: number) => {
          const sg = spacing * scale;
          if (sg < 2) return;
          const op = Math.max(0, Math.min(1, (sg - 4) / 16));
          drawSqLevel(sg, dashed, op * zoomAlpha * baseAlpha);
        };
        const darkAlphaScale = themeRef.current === "dark" ? 1.4 : 1;
        drawFixed(60,  true,  isDark ? 0.04 * darkAlphaScale : 0.08); // dashed inner, shrinks with zoom
        drawFixed(300, false, isDark ? 0.07 * darkAlphaScale : 0.12); // solid outer, shrinks with zoom
      }
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(scale, 0, 0, scale, x, y);

    // --- Cached completed strokes (item 8) ---
    const pending = pendingEraseRef.current;
    const isErasing = pending.size > 0;
    const activeStroke = isDrawingRef.current && activeModifierRef.current !== "alt" && activeModifierRef.current !== "laser"
      ? strokesRef.current[strokesRef.current.length - 1]
      : null;

    if (isErasing) {
      // During erase mode, render all strokes directly (need per-stroke opacity)
      strokesCacheRef.current = null;
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
      // Use cache for completed strokes
      let completedStrokes = activeStroke
        ? strokesRef.current.slice(0, -1)
        : strokesRef.current;
      if (editingStrokeRef.current) {
        completedStrokes = completedStrokes.filter(s => s !== editingStrokeRef.current);
      }
      const cacheKey = `${completedStrokes.length},${x},${y},${scale},${canvas.width},${canvas.height}`;
      let sCache = strokesCacheRef.current;
      if (!sCache || sCache.key !== cacheKey) {
        const offscreen = sCache?.canvas || document.createElement("canvas");
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const sctx = offscreen.getContext("2d")!;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.clearRect(0, 0, offscreen.width, offscreen.height);
        sctx.setTransform(scale, 0, 0, scale, x, y);
        renderStrokesToCtx(sctx, completedStrokes);
        strokesCacheRef.current = { canvas: offscreen, key: cacheKey };
        sCache = strokesCacheRef.current;
      }
      // Blit cached strokes
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sCache.canvas, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, x, y);

      // Render only the active stroke on top
      if (activeStroke) {
        renderStrokesToCtx(ctx, [activeStroke]);
      }
    }

    // Render live writing text preview + blinking caret
    if (isWritingRef.current || writingTextRef.current) {
      const editStroke = editingStrokeRef.current;
      const basePx = editStroke
        ? TEXT_SIZE_MAP[editStroke.fontSize || "m"] * (editStroke.fontScale ?? 1)
        : TEXT_SIZE_MAP[textSizeRef.current];
      const textColor = editStroke ? editStroke.color : lineColorRef.current;
      const bold = editStroke ? (editStroke.bold ?? false) : writingBoldRef.current;
      const italic = editStroke ? (editStroke.italic ?? false) : writingItalicRef.current;
      const align: TextAlign = editStroke ? (editStroke.textAlign ?? "left") : writingAlignRef.current;
      ctx.font = buildFont(basePx, bold, italic, editStroke ? editStroke.fontFamily : fontFamilyRef.current);
      ctx.fillStyle = textColor;
      ctx.textBaseline = "top";
      ctx.textAlign = align;
      const text = writingTextRef.current;
      const lines = text ? text.split("\n") : [""];
      const lineHeight = basePx * 1.2;
      const anchor = writingPosRef.current;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          ctx.fillText(lines[i], anchor.x, anchor.y + i * lineHeight);
        }
      }
      ctx.textAlign = "left";
      // Helper: compute left edge of a line for cursor/selection, based on alignment
      const lineStartX = (lineStr: string) => {
        const lw = ctx.measureText(lineStr).width;
        if (align === "center") return anchor.x - lw / 2;
        if (align === "right") return anchor.x - lw;
        return anchor.x;
      };
      // Draw selection highlight
      if (isWritingRef.current && selectionAnchorRef.current !== null) {
        const selStart = Math.min(selectionAnchorRef.current, caretPosRef.current);
        const selEnd = Math.max(selectionAnchorRef.current, caretPosRef.current);
        ctx.fillStyle = "rgba(72,149,239,0.35)";
        let lineStart = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineEnd = lineStart + lines[i].length;
          if (selStart <= lineEnd && selEnd > lineStart) {
            const colStart = Math.max(0, selStart - lineStart);
            const colEnd = Math.min(lines[i].length, selEnd - lineStart);
            const lx = lineStartX(lines[i]);
            const x1 = lx + ctx.measureText(lines[i].slice(0, colStart)).width;
            const x2 = lx + ctx.measureText(lines[i].slice(0, colEnd)).width;
            ctx.fillRect(x1, anchor.y + i * lineHeight, Math.max(x2 - x1, 2 / scale), basePx);
          }
          lineStart += lines[i].length + 1;
        }
      }
      // Draw blinking caret at selectionEnd position (hidden when selection active)
      if (isWritingRef.current && caretVisibleRef.current && selectionAnchorRef.current === null) {
        const pos = caretPosRef.current;
        // Find which line and column the caret is on
        let charCount = 0;
        let caretLine = 0;
        let caretCol = 0;
        for (let i = 0; i < lines.length; i++) {
          if (pos <= charCount + lines[i].length) {
            caretLine = i;
            caretCol = pos - charCount;
            break;
          }
          charCount += lines[i].length + 1; // +1 for \n
          if (i === lines.length - 1) {
            caretLine = i;
            caretCol = lines[i].length;
          }
        }
        const textBeforeCaret = lines[caretLine].slice(0, caretCol);
        const lx = lineStartX(lines[caretLine]);
        const caretX = lx + ctx.measureText(textBeforeCaret).width;
        const caretY = anchor.y + caretLine * lineHeight;
        ctx.fillStyle = textColor;
        ctx.fillRect(caretX, caretY, 2 / scale, basePx);
      }
    }

    // Write mode indicator (screen-space) — pill badge bottom-right
    if (isWritingRef.current) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const isDark = isDarkTheme(themeRef.current);
      const label = "Text mode — esc to finish";
      ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(label).width;
      const ph = 8, pv = 5;
      const pillW = tw + ph * 2;
      const pillH = 11 + pv * 2;
      const margin = 12;
      const px = canvas.width - pillW - margin;
      const py = canvas.height - pillH - margin;
      const r = pillH / 2;
      ctx.beginPath();
      ctx.moveTo(px + r, py);
      ctx.lineTo(px + pillW - r, py);
      ctx.arcTo(px + pillW, py, px + pillW, py + r, r);
      ctx.arcTo(px + pillW, py + pillH, px + pillW - r, py + pillH, r);
      ctx.lineTo(px + r, py + pillH);
      ctx.arcTo(px, py + pillH, px, py + pillH - r, r);
      ctx.arcTo(px, py, px + r, py, r);
      ctx.closePath();
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";
      ctx.fillText(label, px + ph, py + pillH / 2);
      ctx.setTransform(scale, 0, 0, scale, x, y);
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

    // Draw laser pointer trail (screen-space thickness)
    const laser = laserTrailRef.current;
    if (laser.length >= 2) {
      const pts = smoothPoints(smoothPoints(laser));
      const len = pts.length;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      for (let i = 1; i < len; i++) {
        const t = i / (len - 1);
        ctx.beginPath();
        ctx.lineWidth = (2 + t * 4) / scale;
        ctx.strokeStyle = `rgba(255, 30, 30, ${t * 0.8})`;
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      // Bright dot at the head
      if (len > 0) {
        const head = pts[len - 1];
        const dotR = 4 / scale;
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 60, 60, 0.9)";
        ctx.arc(head.x, head.y, dotR, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 80, 80, 0.3)";
        ctx.arc(head.x, head.y, dotR * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw text select hover/selection overlay (world space)
    const drawOverlayStroke = (stroke: Stroke, isSelected: boolean) => {
      if (stroke.points.length === 0) return;
      const lw = 1.5 / scale;

      // Arrow/line: handles along the stroke, not a bounding box
      if ((stroke.shape === "arrow" || stroke.shape === "line") && stroke.points.length >= 2) {
        const p0 = stroke.points[0];
        const p1 = stroke.points[1];
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        ctx.save();
        ctx.setLineDash([]);
        ctx.lineWidth = lw;
        if (isSelected) {
          ctx.strokeStyle = "#4895ef";
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          const hr = 4.5 / scale;
          for (const hp of [p0, mid, p1]) {
            ctx.beginPath();
            ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.fill();
            ctx.strokeStyle = "#4895ef"; ctx.stroke();
          }
        } else {
          // Hover: wide semi-transparent halo + faint handle outlines
          ctx.lineCap = "round";
          ctx.lineWidth = 8 / scale;
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(72,149,239,0.22)";
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          const hr = 4.5 / scale;
          ctx.lineWidth = lw;
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(72,149,239,0.5)";
          for (const hp of [p0, mid, p1]) {
            ctx.beginPath();
            ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
        return;
      }

      const bb = anyStrokeBBox(stroke);
      const pad = (stroke.shape === "rectangle" ? 6 : 3) / scale;
      const rx = bb.x - pad, ry = bb.y - pad;
      const rw = bb.w + pad * 2, rh = bb.h + pad * 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);

      if (isSelected) {
        ctx.fillStyle = "rgba(72,149,239,0.07)";
        ctx.fill();
        ctx.strokeStyle = "#4895ef";
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        ctx.stroke();

        // Square corner handles (only for shapes and text, not freehand)
        if (stroke.shape || stroke.text) {
          const hr = 4.5 / scale;
          const corners = [
            { x: rx,      y: ry },
            { x: rx + rw, y: ry },
            { x: rx + rw, y: ry + rh },
            { x: rx,      y: ry + rh },
          ];
          ctx.lineWidth = lw;
          for (const c of corners) {
            ctx.beginPath();
            ctx.rect(c.x - hr, c.y - hr, hr * 2, hr * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.strokeStyle = "#4895ef";
            ctx.stroke();
          }
        }
      } else {
        // Hover — solid outline with subtle fill
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
        ctx.fill();
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.45)";
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        ctx.stroke();
      }
      ctx.restore();
    };

    // Draw hover first (underneath selected)
    if (hoverTextRef.current && hoverTextRef.current !== selectedTextRef.current) {
      drawOverlayStroke(hoverTextRef.current, false);
    }
    if (selectedTextRef.current) {
      drawOverlayStroke(selectedTextRef.current, true);
    }

    // Draw box selection rectangle while dragging
    if (boxSelectRef.current) {
      const { start, end } = boxSelectRef.current;
      ctx.save();
      ctx.strokeStyle = "#4895ef";
      ctx.fillStyle = "rgba(72,149,239,0.07)";
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([6 / scale, 3 / scale]);
      const rx = Math.min(start.x, end.x), ry = Math.min(start.y, end.y);
      const rw = Math.abs(end.x - start.x), rh = Math.abs(end.y - start.y);
      ctx.beginPath(); ctx.rect(rx, ry, rw, rh);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // Draw group selection: individual outlines (no handles) + combined bbox
    if (selectedGroupRef.current.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const stroke of selectedGroupRef.current) {
        drawOverlayStroke(stroke, false);
        const bb = anyStrokeBBox(stroke);
        minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
      }
      // Combined selection box
      const pad = 6 / scale;
      ctx.save();
      ctx.strokeStyle = "#4895ef";
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([6 / scale, 3 / scale]);
      ctx.beginPath();
      ctx.rect(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  // --- Content off-screen detection ---
  const contentOffScreenRef = useRef(false);
  const checkContentOffScreen = useCallback(() => {
    const cb = onContentOffScreenRef.current;
    if (!cb) return;
    const strokes = strokesRef.current;
    if (strokes.length === 0) {
      if (contentOffScreenRef.current) {
        contentOffScreenRef.current = false;
        cb(false);
      }
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of strokes) {
      if (stroke.text) {
        const anchor = stroke.points[0];
        const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
        const lines = stroke.text.split("\n");
        const maxLineLen = Math.max(...lines.map((l) => l.length));
        const textW = maxLineLen * basePx * 0.6;
        const textH = lines.length * basePx * 1.2;
        if (anchor.x < minX) minX = anchor.x;
        if (anchor.y < minY) minY = anchor.y;
        if (anchor.x + textW > maxX) maxX = anchor.x + textW;
        if (anchor.y + textH > maxY) maxY = anchor.y + textH;
        continue;
      }
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const { x, y, scale } = viewRef.current;
    const screenMinX = minX * scale + x;
    const screenMinY = minY * scale + y;
    const screenMaxX = maxX * scale + x;
    const screenMaxY = maxY * scale + y;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const offScreen =
      screenMaxX < 0 || screenMinX > vw || screenMaxY < 0 || screenMinY > vh;
    if (offScreen !== contentOffScreenRef.current) {
      contentOffScreenRef.current = offScreen;
      cb(offScreen);
    }
  }, []);

  // --- RAF-queue scheduleRedraw (item 1) ---
  const rafIdRef = useRef<number | null>(null);
  const scheduleRedraw = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      redraw();
      checkContentOffScreen();
    });
  }, [redraw, checkContentOffScreen]);

  // Cancel pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const cancelErase = useCallback(() => {
    eraseTrailRef.current = [];
    pendingEraseRef.current.clear();
    isDrawingRef.current = false;
    activeModifierRef.current = null;
    scheduleRedraw();
  }, [scheduleRedraw]);

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

  // Drain laser trail
  useEffect(() => {
    if (!lasering) return;
    let raf: number;
    let stopped = false;
    const tick = () => {
      const trail = laserTrailRef.current;
      if (laserMovingRef.current) {
        laserMovingRef.current = false;
      } else if (trail.length > 0) {
        const remove = Math.max(1, Math.ceil(trail.length * 0.15));
        trail.splice(0, remove);
        redraw();
      }
      if (!stopped || trail.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (laserTrailRef.current.length === 0) {
        cancelAnimationFrame(raf);
      }
    };
  }, [lasering, redraw]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    strokesCacheRef.current = null;
    persistStrokes();
    scheduleRedraw();
  }, [scheduleRedraw, persistStrokes]);

  // Swap default stroke colors when switching between dark/light themes, then redraw
  const prevThemeRef = useRef(theme);
  useEffect(() => {
    if (prevThemeRef.current !== theme) {
      const prevIsDark = isDarkTheme(prevThemeRef.current);
      const nowIsDark = isDarkTheme(theme);
      if (prevIsDark !== nowIsDark) {
        const from = nowIsDark ? "#000000" : "#ffffff";
        const to = nowIsDark ? "#ffffff" : "#000000";
        const swapStrokes = (strokes: Stroke[]) => {
          for (const s of strokes) {
            if (s.color === from) s.color = to;
          }
        };
        const swapAction = (a: UndoAction) => {
          const list = a.type === "erase" || a.type === "group-move" || a.type === "multi-draw" ? a.strokes : a.type === "draw" || a.type === "move" || a.type === "resize" || a.type === "edit" || a.type === "font-change" ? [a.stroke] : [];
          for (const s of list) {
            if (s.color === from) s.color = to;
          }
        };
        // Swap active canvas
        swapStrokes(strokesRef.current);
        undoStackRef.current.forEach(swapAction);
        redoStackRef.current.forEach(swapAction);
        persistStrokes();
        // Swap cached (inactive) canvases
        for (const [idx, snapshot] of snapshotCache) {
          if (idx === canvasIndexRef.current) continue;
          swapStrokes(snapshot.strokes);
          snapshot.undoStack.forEach(swapAction);
          snapshot.redoStack.forEach(swapAction);
          saveStrokes(snapshot.strokes, idx);
        }
        // Swap uncached canvases still in localStorage
        for (let i = 1; i <= 9; i++) {
          if (i === canvasIndexRef.current || snapshotCache.has(i)) continue;
          const strokes = loadStrokes(i);
          if (strokes.length > 0) {
            swapStrokes(strokes);
            saveStrokes(strokes, i);
          }
        }
      }
      prevThemeRef.current = theme;
    }
    strokesCacheRef.current = null;
    scheduleRedraw();
  }, [gridType, theme, scheduleRedraw, persistStrokes]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gridPatternCacheRef.current.clear();
      strokesCacheRef.current = null;
      redraw(); // immediate — must paint now
    };

    resize();
    window.addEventListener("resize", resize);

    // Redraw after fonts load to ensure text renders correctly
    document.fonts.ready.then(() => {
      strokesCacheRef.current = null;
      scheduleRedraw();
    });

    // Track cursor position globally so W key always has accurate coords
    const onMouseMove = (e: MouseEvent) => {
      cursorWorldRef.current = screenToWorld(
        e.clientX,
        e.clientY,
        viewRef.current,
      );
    };
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      if (caretTimerRef.current) {
        clearInterval(caretTimerRef.current);
        caretTimerRef.current = null;
      }
    };
  }, [redraw, scheduleRedraw]);

  const broadcastZoom = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("drawtool:zoom", { detail: viewRef.current.scale }),
    );
  }, []);

  // Canvas switching effect
  useEffect(() => {
    const prevIndex = canvasIndexRef.current;
    if (prevIndex === canvasIndex) return;

    // Cancel any in-progress drawing
    if (isDrawingRef.current) {
      if (activeModifierRef.current !== "alt") {
        strokesRef.current.pop();
        undoStackRef.current.pop();
      }
      if (activeModifierRef.current === "alt") {
        pendingEraseRef.current.clear();
      }
      isDrawingRef.current = false;
      activeModifierRef.current = null;
    }

    // Save current state to cache + localStorage
    snapshotCache.set(prevIndex, {
      strokes: strokesRef.current,
      undoStack: undoStackRef.current,
      redoStack: redoStackRef.current,
      view: { ...viewRef.current },
    });
    saveStrokes(strokesRef.current, prevIndex);
    saveView(viewRef.current, prevIndex);

    // Restore new canvas from cache or localStorage
    const cached = snapshotCache.get(canvasIndex);
    if (cached) {
      strokesRef.current = cached.strokes;
      undoStackRef.current = cached.undoStack;
      redoStackRef.current = cached.redoStack;
      viewRef.current = cached.view;
    } else {
      const strokes = loadStrokes(canvasIndex);
      strokesRef.current = strokes;
      undoStackRef.current = strokes.map((stroke) => ({
        type: "draw" as const,
        stroke,
      }));
      redoStackRef.current = [];
      viewRef.current = loadView(canvasIndex);
    }

    // Clear transient state
    eraseTrailRef.current = [];
    laserTrailRef.current = [];
    pendingEraseRef.current.clear();
    gridPatternCacheRef.current.clear();
    strokesCacheRef.current = null;

    canvasIndexRef.current = canvasIndex;
    broadcastZoom();
    scheduleRedraw();
  }, [canvasIndex, scheduleRedraw, broadcastZoom]);

  const animFrameRef = useRef(0);
  const animateView = useCallback(
    (target: { x: number; y: number; scale: number }, duration = 300) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const start = { ...viewRef.current };
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - t0) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        viewRef.current.x = start.x + (target.x - start.x) * ease;
        viewRef.current.y = start.y + (target.y - start.y) * ease;
        viewRef.current.scale = start.scale + (target.scale - start.scale) * ease;
        strokesCacheRef.current = null;
        scheduleRedraw();
        broadcastZoom();
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          animFrameRef.current = 0;
          persistView();
        }
      };
      animFrameRef.current = requestAnimationFrame(step);
    },
    [scheduleRedraw, broadcastZoom, persistView],
  );

  const resetView = useCallback(() => {
    animateView({ x: 0, y: 0, scale: 1 });
  }, [animateView]);

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
      strokesCacheRef.current = null;
      scheduleRedraw();
      broadcastZoom();
      persistView();
    },
    [scheduleRedraw, broadcastZoom, persistView],
  );

  const centerView = useCallback(() => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const stroke of strokes) {
      if (stroke.text) {
        const anchor = stroke.points[0];
        const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
        const lines = stroke.text.split("\n");
        const maxLineLen = Math.max(...lines.map((l) => l.length));
        const textW = maxLineLen * basePx * 0.6;
        const textH = lines.length * basePx * 1.2;
        if (anchor.x < minX) minX = anchor.x;
        if (anchor.y < minY) minY = anchor.y;
        if (anchor.x + textW > maxX) maxX = anchor.x + textW;
        if (anchor.y + textH > maxY) maxY = anchor.y + textH;
        continue;
      }
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
    let target;
    if (w === 0 && h === 0) {
      target = {
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
      target = {
        x: window.innerWidth / 2 - cx * scale,
        y: window.innerHeight / 2 - cy * scale,
        scale,
      };
    }
    animateView(target);
  }, [animateView]);

  const exportTransparent = useCallback(() => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const stroke of strokes) {
      if (stroke.text) {
        const anchor = stroke.points[0];
        const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
        const lines = stroke.text.split("\n");
        const maxLineLen = Math.max(...lines.map((l) => l.length));
        const textW = maxLineLen * basePx * 0.6;
        const textH = lines.length * basePx * 1.2;
        if (anchor.x < minX) minX = anchor.x;
        if (anchor.y < minY) minY = anchor.y;
        if (anchor.x + textW > maxX) maxX = anchor.x + textW;
        if (anchor.y + textH > maxY) maxY = anchor.y + textH;
        continue;
      }
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
      a.download = "drawtool-transparent.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  }, []);

  const undo = useCallback(() => {
    const action = undoStackRef.current.pop();
    if (action) {
      if (action.type === "draw") {
        const idx = strokesRef.current.lastIndexOf(action.stroke);
        if (idx !== -1) strokesRef.current.splice(idx, 1);
      } else if (action.type === "erase") {
        strokesRef.current.push(...action.strokes);
      } else if (action.type === "move") {
        action.from.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "resize") {
        action.stroke.fontScale = action.fromScale;
        action.fromPoints.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "edit") {
        action.stroke.text = action.oldText;
      } else if (action.type === "font-change") {
        action.stroke.fontFamily = action.from;
      } else if (action.type === "bold-change") {
        action.stroke.bold = action.from;
        if (action.fromAnchor) action.stroke.points[0] = { ...action.fromAnchor };
      } else if (action.type === "italic-change") {
        action.stroke.italic = action.from;
        if (action.fromAnchor) action.stroke.points[0] = { ...action.fromAnchor };
      } else if (action.type === "align-change") {
        action.stroke.textAlign = action.from !== "left" ? action.from : undefined;
        if (action.fromAnchor) action.stroke.points[0] = { ...action.fromAnchor };
      } else if (action.type === "color-change") {
        action.stroke.color = action.from;
      } else if (action.type === "group-color-change") {
        action.strokes.forEach((s, i) => { s.color = action.from[i]; });
      } else if (action.type === "group-move") {
        for (let i = 0; i < action.strokes.length; i++) {
          action.strokes[i].points = action.from[i].map(p => ({ ...p }));
        }
        selectedGroupRef.current = action.strokes;
      } else if (action.type === "multi-draw") {
        for (const s of action.strokes) {
          const idx = strokesRef.current.lastIndexOf(s);
          if (idx !== -1) strokesRef.current.splice(idx, 1);
        }
      } else if (action.type === "reorder") {
        strokesRef.current = [...action.before];
      }
      redoStackRef.current.push(action);
    }
    // Abort any in-progress edit
    if (editingStrokeRef.current) {
      editingStrokeRef.current = null;
      editingOldTextRef.current = "";
      isWritingRef.current = false;
      writingTextRef.current = "";
      if (caretTimerRef.current) { clearInterval(caretTimerRef.current); caretTimerRef.current = null; }
    }
    selectedTextRef.current = null;
    selectDragRef.current = null;
    groupDragRef.current = null;
    // Clear group selection unless we just re-selected it for a group-move undo
    if (!action || action.type !== "group-move") selectedGroupRef.current = [];
    lastTextTapRef.current = null;
    hoverTextRef.current = null;
    strokesCacheRef.current = null;
    setZCursor(zKeyRef.current ? "default" : null);
    persistStrokes();
    scheduleRedraw();
  }, [persistStrokes, scheduleRedraw, setZCursor]);

  const redo = useCallback(() => {
    const action = redoStackRef.current.pop();
    if (action) {
      if (action.type === "draw") {
        strokesRef.current.push(action.stroke);
      } else if (action.type === "erase") {
        for (const s of action.strokes) {
          const idx = strokesRef.current.lastIndexOf(s);
          if (idx !== -1) strokesRef.current.splice(idx, 1);
        }
      } else if (action.type === "move") {
        action.to.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "resize") {
        action.stroke.fontScale = action.toScale;
        action.toPoints.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "edit") {
        action.stroke.text = action.newText;
      } else if (action.type === "font-change") {
        action.stroke.fontFamily = action.to;
      } else if (action.type === "bold-change") {
        action.stroke.bold = action.to || undefined;
        if (action.toAnchor) action.stroke.points[0] = { ...action.toAnchor };
      } else if (action.type === "italic-change") {
        action.stroke.italic = action.to || undefined;
        if (action.toAnchor) action.stroke.points[0] = { ...action.toAnchor };
      } else if (action.type === "align-change") {
        action.stroke.textAlign = action.to !== "left" ? action.to : undefined;
        if (action.toAnchor) action.stroke.points[0] = { ...action.toAnchor };
      } else if (action.type === "color-change") {
        action.stroke.color = action.to;
      } else if (action.type === "group-color-change") {
        action.strokes.forEach(s => { s.color = action.to; });
      } else if (action.type === "group-move") {
        for (let i = 0; i < action.strokes.length; i++) {
          action.strokes[i].points = action.to[i].map(p => ({ ...p }));
        }
        selectedGroupRef.current = action.strokes;
      } else if (action.type === "multi-draw") {
        strokesRef.current.push(...action.strokes);
      } else if (action.type === "reorder") {
        strokesRef.current = [...action.after];
      }
      undoStackRef.current.push(action);
    }
    // Abort any in-progress edit
    if (editingStrokeRef.current) {
      editingStrokeRef.current = null;
      editingOldTextRef.current = "";
      isWritingRef.current = false;
      writingTextRef.current = "";
      if (caretTimerRef.current) { clearInterval(caretTimerRef.current); caretTimerRef.current = null; }
    }
    selectedTextRef.current = null;
    selectDragRef.current = null;
    groupDragRef.current = null;
    // Clear group selection unless we just re-selected it for a group-move redo
    if (!action || action.type !== "group-move") selectedGroupRef.current = [];
    lastTextTapRef.current = null;
    hoverTextRef.current = null;
    strokesCacheRef.current = null;
    setZCursor(zKeyRef.current ? "default" : null);
    persistStrokes();
    scheduleRedraw();
  }, [persistStrokes, scheduleRedraw, setZCursor]);

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
    const onFontFamily = (e: Event) => {
      const key = (e as CustomEvent).detail as FontFamily;
      const sel = selectedTextRef.current;
      if (sel && sel.text && !isWritingRef.current) {
        undoStackRef.current.push({ type: "font-change", stroke: sel, from: sel.fontFamily, to: key });
        redoStackRef.current = [];
        sel.fontFamily = key;
        strokesCacheRef.current = null;
        persistStrokes();
        scheduleRedraw();
      }
    };
    const onSetColor = (e: Event) => {
      const color = (e as CustomEvent).detail as string;
      const group = selectedGroupRef.current;
      const single = selectedTextRef.current;
      if (isWritingRef.current) return;
      if (group.length > 0) {
        undoStackRef.current.push({ type: "group-color-change", strokes: group, from: group.map(s => s.color), to: color });
        redoStackRef.current = [];
        group.forEach(s => { s.color = color; });
        strokesCacheRef.current = null;
        persistStrokes();
        scheduleRedraw();
      } else if (single) {
        undoStackRef.current.push({ type: "color-change", stroke: single, from: single.color, to: color });
        redoStackRef.current = [];
        single.color = color;
        strokesCacheRef.current = null;
        persistStrokes();
        scheduleRedraw();
      }
    };
    window.addEventListener("drawtool:clear", onClear);
    window.addEventListener("drawtool:reset-view", onResetView);
    window.addEventListener("drawtool:center-view", onCenterView);
    window.addEventListener("drawtool:zoom-step", onZoomStep);
    window.addEventListener("drawtool:query-stroke-count", onQueryCount);
    window.addEventListener("drawtool:export-transparent", onExportTransparent);
    const onTextBold = () => {
      const editStroke = editingStrokeRef.current;
      const sel = selectedTextRef.current;
      if (isWritingRef.current) {
        if (editStroke) {
          const newBold = !(editStroke.bold ?? false);
          undoStackRef.current.push({ type: "bold-change", stroke: editStroke, from: editStroke.bold, to: newBold });
          redoStackRef.current = [];
          editStroke.bold = newBold || undefined;
          writingBoldRef.current = newBold;
          strokesCacheRef.current = null;
        } else {
          writingBoldRef.current = !writingBoldRef.current;
        }
        dispatchTextStyleSync(writingBoldRef.current, writingItalicRef.current, writingAlignRef.current);
        scheduleRedraw();
      } else if (sel && sel.text) {
        const newBold = !(sel.bold ?? false);
        const fromBold = sel.bold;
        const fromAnchor = { ...sel.points[0] };
        const oldBbox = textBBox(sel);
        sel.bold = newBold || undefined;
        const newBbox = textBBox(sel);
        sel.points[0] = { x: fromAnchor.x + (oldBbox.x - newBbox.x), y: fromAnchor.y + (oldBbox.y - newBbox.y) };
        const toAnchor = { ...sel.points[0] };
        undoStackRef.current.push({ type: "bold-change", stroke: sel, from: fromBold, to: newBold, fromAnchor, toAnchor });
        redoStackRef.current = [];
        strokesCacheRef.current = null;
        persistStrokes();
        scheduleRedraw();
        dispatchTextStyleSync(newBold, sel.italic ?? false, sel.textAlign ?? "left");
      } else {
        dispatchTextStyleSync(!textBoldRef.current, textItalicRef.current, textAlignRef.current);
      }
    };
    const onTextItalic = () => {
      const editStroke = editingStrokeRef.current;
      const sel = selectedTextRef.current;
      if (isWritingRef.current) {
        if (editStroke) {
          const newItalic = !(editStroke.italic ?? false);
          undoStackRef.current.push({ type: "italic-change", stroke: editStroke, from: editStroke.italic, to: newItalic });
          redoStackRef.current = [];
          editStroke.italic = newItalic || undefined;
          writingItalicRef.current = newItalic;
          strokesCacheRef.current = null;
        } else {
          writingItalicRef.current = !writingItalicRef.current;
        }
        dispatchTextStyleSync(writingBoldRef.current, writingItalicRef.current, writingAlignRef.current);
        scheduleRedraw();
      } else if (sel && sel.text) {
        const newItalic = !(sel.italic ?? false);
        const fromItalic = sel.italic;
        const fromAnchor = { ...sel.points[0] };
        const oldBbox = textBBox(sel);
        sel.italic = newItalic || undefined;
        const newBbox = textBBox(sel);
        sel.points[0] = { x: fromAnchor.x + (oldBbox.x - newBbox.x), y: fromAnchor.y + (oldBbox.y - newBbox.y) };
        const toAnchor = { ...sel.points[0] };
        undoStackRef.current.push({ type: "italic-change", stroke: sel, from: fromItalic, to: newItalic, fromAnchor, toAnchor });
        redoStackRef.current = [];
        strokesCacheRef.current = null;
        persistStrokes();
        scheduleRedraw();
        dispatchTextStyleSync(sel.bold ?? false, newItalic, sel.textAlign ?? "left");
      } else {
        dispatchTextStyleSync(textBoldRef.current, !textItalicRef.current, textAlignRef.current);
      }
    };
    const onTextAlign = (e: Event) => {
      const newAlign = (e as CustomEvent).detail as TextAlign;
      const editStroke = editingStrokeRef.current;
      const sel = selectedTextRef.current;
      if (isWritingRef.current) {
        if (editStroke) {
          const oldAlign: TextAlign = editStroke.textAlign ?? "left";
          if (oldAlign !== newAlign) {
            undoStackRef.current.push({ type: "align-change", stroke: editStroke, from: oldAlign, to: newAlign });
            redoStackRef.current = [];
            editStroke.textAlign = newAlign !== "left" ? newAlign : undefined;
            strokesCacheRef.current = null;
          }
        }
        writingAlignRef.current = newAlign;
        dispatchTextStyleSync(writingBoldRef.current, writingItalicRef.current, newAlign);
        scheduleRedraw();
      } else if (sel && sel.text) {
        const oldAlign: TextAlign = sel.textAlign ?? "left";
        if (oldAlign !== newAlign) {
          const fromAnchor = { ...sel.points[0] };
          const oldBbox = textBBox(sel);
          sel.textAlign = newAlign !== "left" ? newAlign : undefined;
          const newBbox = textBBox(sel);
          sel.points[0] = { x: fromAnchor.x + (oldBbox.x - newBbox.x), y: fromAnchor.y + (oldBbox.y - newBbox.y) };
          const toAnchor = { ...sel.points[0] };
          undoStackRef.current.push({ type: "align-change", stroke: sel, from: oldAlign, to: newAlign, fromAnchor, toAnchor });
          redoStackRef.current = [];
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
        }
        dispatchTextStyleSync(sel.bold ?? false, sel.italic ?? false, newAlign);
      } else {
        dispatchTextStyleSync(textBoldRef.current, textItalicRef.current, newAlign);
      }
    };
    window.addEventListener("drawtool:font-family", onFontFamily);
    window.addEventListener("drawtool:set-color", onSetColor);
    window.addEventListener("drawtool:text-bold", onTextBold);
    window.addEventListener("drawtool:text-italic", onTextItalic);
    window.addEventListener("drawtool:text-align", onTextAlign);
    const onImportStrokes = (e: Event) => {
      const strokes = (e as CustomEvent).detail as Stroke[];
      strokesRef.current = strokes;
      undoStackRef.current = strokes.map((stroke) => ({ type: "draw" as const, stroke }));
      redoStackRef.current = [];
      strokesCacheRef.current = null;
      selectedTextRef.current = null;
      selectedGroupRef.current = [];
      scheduleRedraw();
    };
    window.addEventListener("drawtool:import-strokes", onImportStrokes);
    return () => {
      window.removeEventListener("drawtool:clear", onClear);
      window.removeEventListener("drawtool:reset-view", onResetView);
      window.removeEventListener("drawtool:center-view", onCenterView);
      window.removeEventListener("drawtool:zoom-step", onZoomStep);
      window.removeEventListener("drawtool:query-stroke-count", onQueryCount);
      window.removeEventListener("drawtool:export-transparent", onExportTransparent);
      window.removeEventListener("drawtool:font-family", onFontFamily);
      window.removeEventListener("drawtool:set-color", onSetColor);
      window.removeEventListener("drawtool:text-bold", onTextBold);
      window.removeEventListener("drawtool:text-italic", onTextItalic);
      window.removeEventListener("drawtool:text-align", onTextAlign);
      window.removeEventListener("drawtool:import-strokes", onImportStrokes);
    };
  }, [clearCanvas, resetView, centerView, zoomBy, exportTransparent, scheduleRedraw]);

  const MIN_SHAPE_SIZE = 8;
  const MIN_DASH_LENGTH = 10; // world units — discard dashed strokes shorter than this

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
    if (dx < MIN_SHAPE_SIZE && dy < MIN_SHAPE_SIZE && stroke.shape !== "arrow") {
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
    scheduleRedraw();
  }, [scheduleRedraw]);

  // Keyboard shortcuts (keydown/keyup/blur/paste)
  useKeyboardShortcuts(
    {
      canvasRef, strokesRef, undoStackRef, redoStackRef, strokesCacheRef, viewRef,
      isWritingRef, writingTextRef, caretPosRef, caretVisibleRef, selectionAnchorRef,
      textUndoRef, textRedoRef, editingStrokeRef, writingBoldRef, writingItalicRef, writingAlignRef,
      zKeyRef, selectedTextRef, hoverTextRef, selectDragRef, selectedGroupRef, groupDragRef, boxSelectRef,
      clipboardRef, cursorWorldRef, lastDPressRef, shapeFlashRef,
      textSizeRef, fontFamilyRef, lineColorRef, lineWidthRef,
      laserTrailRef, isDrawingRef, isZoomingRef, activeModifierRef,
      spaceDownRef, isPanningRef, highlightKeyRef, laserKeyRef,
      shiftHeldRef, keyShapeRef, keyShapeDashedRef, shapeJustCommittedRef, fKeyHeldRef,
      finishWritingRef, startWritingRef, cursorRef,
    },
    {
      scheduleRedraw, persistStrokes, persistView, clearCanvas,
      undo, redo, confirmErase, cancelErase, cancelCurrentStroke, discardTinyShape, notifyColorUsed,
      setZCursor, setPanning, setErasing, setShapeActive, setHighlighting, setLasering,
    },
  );

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
      // For text strokes, test against bounding box
      if (stroke.text) {
        const bb = textBBox(stroke);
        if (
          x >= bb.x - radius &&
          x <= bb.x + bb.w + radius &&
          y >= bb.y - radius &&
          y <= bb.y + bb.h + radius
        ) {
          hit = true;
        }
        if (hit) pendingEraseRef.current.add(stroke);
        continue;
      }
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
        } else if (pointersRef.current.size === 3) {
          // Invalidate two-finger tap, start tracking three-finger tap for redo
          twoFingerTapRef.current = null;
          threeFingerTapRef.current = {
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
        e.button === 1 ||
        (spaceDownRef.current && e.button === 0)
      ) {
        // Mouse: middle-click or space+left-click = pan
        isPanningRef.current = true;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        setPanning(true);
      }
      shapeJustCommittedRef.current = false;
      // Re-evaluate dashed state for any in-progress hover shape at actual button press time.
      // Style is locked at hover creation and may be stale if shift state changed after hover started.
      if (e.button === 0 && isDrawingRef.current && activeModifierRef.current === "shape") {
        const stroke = strokesRef.current[strokesRef.current.length - 1];
        if (stroke?.shape) {
          const dashed = keyShapeDashedRef.current;
          stroke.style = dashed ? "dashed" : "solid";
          if (!dashed) stroke.dashGap = undefined;
          stroke.fill = fKeyHeldRef.current || undefined;
        }
      }
      if (e.button === 0) pointerButtonDownRef.current = true;
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [cancelCurrentStroke],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") {
        pointersRef.current.delete(e.pointerId);
        // Check for three-finger tap (redo gesture)
        if (
          pointersRef.current.size === 2 &&
          threeFingerTapRef.current &&
          !threeFingerTapRef.current.moved
        ) {
          redo();
          threeFingerTapRef.current = null;
        }
        if (pointersRef.current.size < 2) {
          // Check for two-finger tap (undo gesture)
          if (
            pointersRef.current.size === 1 &&
            twoFingerTapRef.current &&
            !twoFingerTapRef.current.moved
          ) {
            undo();
          }
          twoFingerTapRef.current = null;
          threeFingerTapRef.current = null;
          pinchRef.current = null;
          persistView();
        }
        if (pointersRef.current.size === 0) {
          if (isPanningRef.current) {
            isPanningRef.current = false;
            tapStartRef.current = null;
            persistView();
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
              notifyColorUsed(lineColorRef.current);
              const dot: Stroke = {
                points: [wp],
                style: "solid",
                lineWidth: lineWidthRef.current,
                color: lineColorRef.current,
              };
              strokesRef.current.push(dot);
              undoStackRef.current.push({ type: "draw", stroke: dot });
              redoStackRef.current = [];
              strokesCacheRef.current = null;
              persistStrokes();
              scheduleRedraw();
              tapStartRef.current = null;
              return;
            }
          }
          tapStartRef.current = null;
          if (isDrawingRef.current) {
            if (activeModifierRef.current === "alt") {
              setErasing(false);
              confirmErase();
              strokesCacheRef.current = null;
              scheduleRedraw();
            }
            discardTinyShape();
            isDrawingRef.current = false;
            activeModifierRef.current = null;
            strokesCacheRef.current = null;
            persistStrokes();
            scheduleRedraw();
          }
        }
        return;
      }
      // Mouse pointer up
      pointerButtonDownRef.current = false;
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setPanning(false);
        if (spaceDownRef.current && canvasRef.current) {
          canvasRef.current.style.cursor = "grab";
        }
        persistView();
        return;
      }
      if (isDrawingRef.current) {
        if (activeModifierRef.current === "alt") {
          confirmErase();
          strokesCacheRef.current = null;
          scheduleRedraw();
        }
        if (activeModifierRef.current === "shape") shapeJustCommittedRef.current = true;
        discardTinyShape();
        // Discard dashed freehand strokes that are too short to show a dash
        if (activeModifierRef.current === "shift") {
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke && stroke.style === "dashed" && !stroke.shape) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of stroke.points) {
              if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
              if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
            }
            if (maxX - minX < MIN_DASH_LENGTH && maxY - minY < MIN_DASH_LENGTH) {
              strokesRef.current.pop();
              undoStackRef.current.pop();
            }
          }
        }
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        strokesCacheRef.current = null;
        persistStrokes();
        scheduleRedraw();
      }
    },
    [confirmErase, discardTinyShape, persistStrokes, persistView, scheduleRedraw, notifyColorUsed],
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
          // Check if fingers moved enough to invalidate three-finger tap
          if (threeFingerTapRef.current && !threeFingerTapRef.current.moved) {
            const startPts3 = threeFingerTapRef.current.startPositions;
            let totalMove3 = 0;
            for (const [id, pos] of pointersRef.current) {
              const start = startPts3.get(id);
              if (start) {
                totalMove3 += Math.hypot(pos.x - start.x, pos.y - start.y);
              }
            }
            if (totalMove3 > 20) {
              threeFingerTapRef.current.moved = true;
            }
          }
          // Pan
          const view = viewRef.current;
          view.x += cx - pinchRef.current.cx;
          view.y += cy - pinchRef.current.cy;
          // Zoom
          const rawFactor = dist / pinchRef.current.dist;
          const factor = Math.pow(rawFactor, 2);
          const newScale = Math.min(10, Math.max(0.1, view.scale * factor));
          const ratio = newScale / view.scale;
          view.x = cx - ratio * (cx - view.x);
          view.y = cy - ratio * (cy - view.y);
          view.scale = newScale;
          pinchRef.current = { dist, cx, cy };
          strokesCacheRef.current = null;
          broadcastZoom();
          scheduleRedraw();
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

      // --- Panning (mouse space+drag, middle-click, or touch hand tool) ---
      // Start panning if space is held or middle button is pressed
      if (
        !isPanningRef.current &&
        e.pointerType !== "touch" &&
        (spaceDownRef.current || (e.buttons & 4) !== 0)
      ) {
        if (isDrawingRef.current) {
          cancelCurrentStroke();
        }
        isPanningRef.current = true;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        setPanning(true);
      }
      if (isPanningRef.current) {
        const view = viewRef.current;
        view.x += e.clientX - panLastRef.current.x;
        view.y += e.clientY - panLastRef.current.y;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        strokesCacheRef.current = null;
        scheduleRedraw();
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

      // Block all drawing/erasing while a stroke or group is selected, or in V-select mode
      if (selectedTextRef.current || selectedGroupRef.current.length > 0 || zKeyRef.current) return;

      // --- Determine modifier ---
      let modifier:
        | "meta"
        | "shift"
        | "alt"
        | "line"
        | "shape"
        | "highlight"
        | "laser"
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
        modifier = isZoomingRef.current
          ? null
          : spaceDownRef.current
          ? null
          : laserKeyRef.current
          ? "laser"
          : highlightKeyRef.current
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
                        : (e.buttons & 1) !== 0
                          ? "meta"
                          : null;
      }

      if (!modifier) {
        if (isDrawingRef.current) {
          if (activeModifierRef.current === "alt") {
            confirmErase();
            strokesCacheRef.current = null;
            scheduleRedraw();
          }
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
        }
        return;
      }

      const point = screenToWorld(e.clientX, e.clientY, viewRef.current);

      // Flush erase buffer when switching away from erasing
      if (modifier !== "alt" && activeModifierRef.current === "alt") {
        confirmErase();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        strokesCacheRef.current = null;
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
        scheduleRedraw();
        return;
      }

      if (modifier === "laser") {
        if (!isDrawingRef.current || activeModifierRef.current !== "laser") {
          laserTrailRef.current = [];
        }
        isDrawingRef.current = true;
        activeModifierRef.current = "laser";
        // Add point to laser trail with interpolation
        const trail = laserTrailRef.current;
        const maxGap = 6 / viewRef.current.scale;
        if (trail.length > 0) {
          const last = trail[trail.length - 1];
          const dx = point.x - last.x;
          const dy = point.y - last.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxGap) {
            const steps = Math.ceil(dist / maxGap);
            for (let s = 1; s < steps; s++) {
              const t = s / steps;
              trail.push({ x: last.x + dx * t, y: last.y + dy * t });
            }
          }
        }
        trail.push({ ...point });
        laserMovingRef.current = true;
        // Limit trail length
        const maxLen = 450 / viewRef.current.scale;
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
          else if (trail.length > 120) trail.splice(0, trail.length - 120);
        }
        scheduleRedraw();
        return;
      }

      if (modifier === "line") {
        if (!isDrawingRef.current || activeModifierRef.current !== "line") {
          notifyColorUsed(lineColor);
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
        scheduleRedraw();
        return;
      }

      if (modifier === "shape") {
        if (!isDrawingRef.current || activeModifierRef.current !== "shape") {
          if (shapeJustCommittedRef.current && keyShapeRef.current && !e.buttons) {
            shapeJustCommittedRef.current = false;
            return;
          }
          shapeJustCommittedRef.current = false;
          notifyColorUsed(lineColor);
          isDrawingRef.current = true;
          activeModifierRef.current = "shape";
          const isTouch = e.pointerType === "touch";
          const dashed = keyShapeRef.current ? keyShapeDashedRef.current : (isTouch ? shapeDashedRef.current : shiftHeldRef.current);
          const fill = isTouch ? shapeFillRef.current : fKeyHeldRef.current;
          const stroke: Stroke = {
            points: [point, { ...point }],
            style: dashed ? "dashed" : "solid",
            dashGap: dashed ? dashGap : undefined,
            lineWidth,
            color: lineColor,
            shape: keyShapeRef.current || activeShapeRef.current,
            ...(fill ? { fill: true } : {}),
            ...(pressureSensitivityRef.current
              ? { seed: Math.floor(Math.random() * 2 ** 31) }
              : {}),
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          current.points[1] = point;
        }
        scheduleRedraw();
        return;
      }

      if (modifier === "highlight") {
        if (
          !isDrawingRef.current ||
          activeModifierRef.current !== "highlight"
        ) {
          notifyColorUsed(lineColor);
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
        scheduleRedraw();
        return;
      }

      if (!isDrawingRef.current || activeModifierRef.current !== modifier) {
        if (modifier === "shift" && shapeJustCommittedRef.current && !e.buttons) {
          shapeJustCommittedRef.current = false;
          return;
        }
        shapeJustCommittedRef.current = false;
        const usePressure = pressureSensitivityRef.current;
        notifyColorUsed(lineColor);
        isDrawingRef.current = true;
        activeModifierRef.current = modifier;
        lastDrawPointRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
        prevWidthRef.current = 1;
        const stroke: Stroke = {
          points: [point],
          style: modifier === "shift" ? "dashed" : "solid",
          lineWidth,
          dashGap,
          color: lineColor,
          ...(usePressure && modifier !== "shift" ? { widths: [1] } : {}),
        };
        strokesRef.current.push(stroke);
        undoStackRef.current.push({ type: "draw", stroke });
        redoStackRef.current = [];
      } else {
        const current = strokesRef.current[strokesRef.current.length - 1];
        current.points.push(point);
        if (current.widths) {
          const now = performance.now();
          const last = lastDrawPointRef.current!;
          const dx = e.clientX - last.x;
          const dy = e.clientY - last.y;
          const dt = Math.max(now - last.t, 1);
          const speed = Math.sqrt(dx * dx + dy * dy) / dt;
          const speedFactor = Math.min(2, Math.max(0.5, 2 - speed / 3));
          const pressure = e.pressure > 0 ? e.pressure : 0.5;
          const raw = speedFactor * (0.5 + pressure);
          const w = prevWidthRef.current * 0.6 + raw * 0.4;
          prevWidthRef.current = w;
          current.widths.push(w);
          lastDrawPointRef.current = { x: e.clientX, y: e.clientY, t: now };
        }
      }

      persistStrokesDebounced();
      scheduleRedraw();
    },
    [
      scheduleRedraw,
      lineWidth,
      lineColor,
      dashGap,
      eraseAt,
      persistStrokes,
      persistStrokesDebounced,
      confirmErase,
      discardTinyShape,
      broadcastZoom,
      notifyColorUsed,
      cancelCurrentStroke,
    ],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType !== "touch") return;
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size === 0) {
        isPanningRef.current = false;
        pinchRef.current = null;
        twoFingerTapRef.current = null;
        threeFingerTapRef.current = null;
        tapStartRef.current = null;
        if (isDrawingRef.current) cancelCurrentStroke();
      }
    },
    [cancelCurrentStroke],
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
        if (activeModifierRef.current === "shape") shapeJustCommittedRef.current = true;
        discardTinyShape();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }
    },
    [persistStrokes, cancelErase, discardTinyShape],
  );

  // Wheel: pan (scroll) and zoom (Ctrl/Cmd + scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      if (isWritingRef.current) return;
      e.preventDefault();
      const view = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom on trackpad (sets ctrlKey) or Ctrl/Cmd+scroll
        isZoomingRef.current = true;
        setShapeActive(false);
        if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = setTimeout(() => {
          isZoomingRef.current = false;
          zoomTimeoutRef.current = null;
        }, 300);
        const clampedDelta = Math.max(-25, Math.min(25, e.deltaY));
        const zoom = Math.pow(0.99, clampedDelta);
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
      strokesCacheRef.current = null;
      scheduleRedraw();
      persistView();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [scheduleRedraw, broadcastZoom, persistView]);

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
  const laserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='4' fill='%23ff3030' fill-opacity='0.9'/%3E%3Ccircle cx='12' cy='12' r='7' fill='none' stroke='%23ff3030' stroke-width='1' stroke-opacity='0.4'/%3E%3C/svg%3E") 12 12, crosshair`;
  const cursor = zCursor !== null
      ? zCursor
      : panning
        ? "grabbing"
        : lasering
          ? laserCursor
          : erasing
            ? eraserCursor
            : highlighting
              ? highlightCursor
              : shapeActive
                ? shapeCursors[keyShapeRef.current || activeShape]
                : crosshairCursor;

  cursorRef.current = cursor;

  const {
    handlePointerDownForText,
    handlePointerMoveGuarded,
    handlePointerUpGuarded,
  } = useTextSelection(
    {
      writingTextRef, writingPosRef, writingBoldRef, writingItalicRef, writingAlignRef,
      textBoldRef, textItalicRef, textAlignRef,
      caretPosRef, caretVisibleRef, caretTimerRef, selectionAnchorRef,
      textUndoRef, textRedoRef, editingStrokeRef, editingOldTextRef,
      isWritingRef, strokesRef, undoStackRef, redoStackRef, strokesCacheRef,
      selectedTextRef, selectedGroupRef, selectDragRef, hoverTextRef, groupDragRef, boxSelectRef,
      zKeyRef, touchToolRef, lastTextTapRef, lineColorRef, textSizeRef, fontFamilyRef, viewRef,
      finishWritingRef, startWritingRef,
    },
    {
      scheduleRedraw, persistStrokes, notifyColorUsed, setZCursor,
      onPointerDown, onPointerMove, onPointerUp,
    },
  );

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Drawing canvas"
      className="block touch-none select-none outline-none"
      tabIndex={-1}
      style={{ cursor }}
      onPointerDown={handlePointerDownForText}
      onPointerMove={handlePointerMoveGuarded}
      onPointerUp={handlePointerUpGuarded}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

export default memo(Canvas);
