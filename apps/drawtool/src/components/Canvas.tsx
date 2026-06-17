import { useRef, useEffect, useCallback, useState, memo, type MutableRefObject } from "react";
import type { ShapeKind, Theme, TextSize, GridType, FontFamily, TextAlign, ClickTool } from "../hooks/useSettings";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useTextSelection } from "../hooks/useTextSelection";
import { drawWatermark } from "../canvas/watermark";
import {
  isDarkTheme, getBackgroundColor, getGridColor,
  TEXT_SIZE_MAP, buildFont, fontLineHeight, dispatchTextStyleSync,
  loadStrokes, saveStrokes, hasSaveHook, loadView, saveView,
  distToSegment, cmdKey, screenToWorld, smoothPoints,
  shapeToSegments,
  textBBox, anyStrokeBBox, visualStrokeBBox,
  renderStrokesToCtx, snapshotCache, smoothArrowPath,
  loadImages, storeImage, processImageFile, gcImages,
} from "../canvas/canvasUtils";
import type { Stroke, UndoAction, BBox, TouchTool } from "../canvas/canvasUtils";
export type { TouchTool } from "../canvas/canvasUtils";

// Swap white→black so strokes are visible on a white PDF background
function adaptStrokeForPrint(s: Stroke): Stroke {
  const c = (col: string) => col === "#ffffff" ? "#000000" : col;
  return {
    ...s,
    color: c(s.color),
    subStrokes: s.subStrokes ? (s.subStrokes as Stroke[]).map(adaptStrokeForPrint) : undefined,
  };
}

function rgbToHue(r: number, g: number, b: number): number | null {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  if (max < 0.001 || d / max < 0.2) return null; // dark, achromatic, or low-HSV-saturation (backgrounds)
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0)
        : max === gn ? (bn - rn) / d + 2
        :              (rn - gn) / d + 4;
  return h * 60;
}

function sameColorFamily(ar: number, ag: number, ab: number, br: number, bg: number, bb: number): boolean {
  const hA = rgbToHue(ar, ag, ab);
  const hB = rgbToHue(br, bg, bb);
  if (hA === null || hB === null) {
    // Achromatic: fall back to tight RGB match
    return Math.abs(ar - br) < 30 && Math.abs(ag - bg) < 30 && Math.abs(ab - bb) < 30;
  }
  const diff = Math.abs(hA - hB);
  return Math.min(diff, 360 - diff) < 60;
}

// Module-level clipboard - survives canvas remounts so copy/paste works across canvas slots.
let _moduleClipboard: Stroke[] | null = null;
const _moduleClipboardRef: MutableRefObject<Stroke[] | null> = {
  get current() { return _moduleClipboard; },
  set current(v) { _moduleClipboard = v; },
};

function Canvas({
  lineWidth,
  lineColor,
  dashGap,
  gridType,
  theme,
  customThemeBg,
  touchTool,
  activeShape,
  shapeFill,
  shapeFillEnabled,
  fillOpacity,
  shapeDashed,
  shapeCorners,
  canvasIndex,
  canvasLimit,
  textSize,
  fontFamily,
  textBold,
  textItalic,
  textAlign,
  pressureSensitivity,
  leftClickTool,
  rightClickTool,
  readOnly,
  presentationMode,
  onContentOffScreen,
}: {
  lineWidth: number;
  lineColor: string;
  dashGap: number;
  gridType: GridType;
  theme: Theme;
  customThemeBg?: string;
  touchTool: TouchTool;
  activeShape: ShapeKind;
  shapeFill: import("../hooks/useSettings").FillStyle;
  shapeFillEnabled: boolean;
  fillOpacity: number;
  shapeDashed: boolean;
  shapeCorners: "rounded" | "sharp";
  canvasIndex: number;
  canvasLimit: number;
  textSize: TextSize;
  fontFamily: FontFamily;
  textBold: boolean;
  textItalic: boolean;
  textAlign: TextAlign;
  pressureSensitivity: boolean;
  leftClickTool: ClickTool;
  rightClickTool: ClickTool;
  readOnly?: boolean;
  presentationMode?: boolean;
  onContentOffScreen?: (offScreen: boolean) => void;
}) {
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasIndexRef = useRef(canvasIndex);
  const canvasLimitRef = useRef(canvasLimit);
  const presentationModeRef = useRef(presentationMode ?? false);
  presentationModeRef.current = presentationMode ?? false;
  const dprRef = useRef(window.devicePixelRatio || 1);
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
  const pendingSyncRef = useRef<{ slot: number; strokes: Stroke[] } | null>(null);
  const activeModifierRef = useRef<
    "meta" | "shift" | "alt" | "line" | "shape" | "highlight" | "laser" | "spray" | null
  >(null);
  const laserTrailRef = useRef<{ x: number; y: number }[]>([]);
  const laserMovingRef = useRef(false);
  const viewRef = useRef(loadView(canvasIndex));
  const gridTypeRef = useRef(gridType);
  gridTypeRef.current = gridType;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const customThemeBgRef = useRef(customThemeBg);
  customThemeBgRef.current = customThemeBg;
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
  const shapeFillEnabledRef = useRef(shapeFillEnabled);
  shapeFillEnabledRef.current = shapeFillEnabled;
  const shapeCornersRef = useRef(shapeCorners);
  shapeCornersRef.current = shapeCorners;
  const fillOpacityRef = useRef(fillOpacity);
  fillOpacityRef.current = fillOpacity;
  const shapeDashedRef = useRef(shapeDashed);
  shapeDashedRef.current = shapeDashed;
  const pressureSensitivityRef = useRef(pressureSensitivity);
  pressureSensitivityRef.current = pressureSensitivity;
  const leftClickToolRef = useRef(leftClickTool);
  leftClickToolRef.current = leftClickTool;
  const rightClickToolRef = useRef(rightClickTool);
  rightClickToolRef.current = rightClickTool;
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
  const [overSameColor, setOverSameColor] = useState(false);
  const overSameColorRef = useRef(false);
  const lastSameColorCheckRef = useRef(0);
  const lastCursorScreenRef = useRef<{ x: number; y: number } | null>(null);
  const highlightKeyRef = useRef(false);
  const laserKeyRef = useRef(false);
  const [lasering, setLasering] = useState(false);
  const sprayKeyRef = useRef(false);
  const sprayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [spraying, setSpraying] = useState(false);
  const spaceDownRef = useRef(false);
  const keyShapeRef = useRef<ShapeKind | null>(null);
  const keyShapeDashedRef = useRef(false);
  const fKeyHeldRef = useRef(false);
  const pointerButtonDownRef = useRef(false);
  const penActiveRef = useRef(false); // true while Apple Pencil (or any "pen" pointer) is touching the screen
  const ghostTouchIdsRef = useRef(new Set<number>()); // touch pointerIds rejected due to pen being active
  const penHoverScreenRef = useRef<{ x: number; y: number } | null>(null); // Apple Pencil hover position (pressure=0, not touching)
  const shiftHeldRef = useRef(false); // own shift tracking - e.shiftKey can get stuck on Mac
  const rightClickHeldRef = useRef(false);
  const shapeJustCommittedRef = useRef(false); // block phantom shapes from drift after pointer-up
  const clipboardRef = _moduleClipboardRef;
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
  const textSelectDragAnchorRef = useRef<number | null>(null);
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
  const lastTextTapRef = useRef<{ time: number; stroke: Stroke; count: number } | null>(null);
  const selectDragRef = useRef<{
    mode: "move" | "corner" | "rotate";
    corner?: number;
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[];
    startScale: number;
    bbox: BBox;
    cycleHits?: Stroke[];
    pendingBend?: { segmentIdx: number };
    startRotation?: number;
    subStrokeStartPoints?: { x: number; y: number }[][];
    startLineWidth?: number;
    startSubLineWidths?: number[];
    startLineRotation?: number;
  } | null>(null);
  const boxSelectRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number }; containOnly?: boolean; clickHit?: import("../canvas/types").Stroke; prevGroup?: import("../canvas/types").Stroke[]; prevSingle?: import("../canvas/types").Stroke | null } | null>(null);
  const selectedGroupRef = useRef<Stroke[]>([]);
  const lockedFlashRef = useRef<{ stroke: Stroke; expiry: number } | null>(null);
  const lockedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedIconPositionsRef = useRef<{ stroke: Stroke; wx: number; wy: number; wr: number }[]>([]);
  const lockedHoverRef = useRef<Stroke | null>(null);
  const lastCycleRef = useRef<{ selectedStroke: Stroke; hits: Stroke[] } | null>(null);
  const groupDragRef = useRef<{
    mode: "move" | "corner" | "rotate";
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[][];
    subStrokeStartPoints?: { x: number; y: number }[][][];
    // corner / rotate only:
    startBbox?: { x: number; y: number; w: number; h: number };
    corner?: number;
    cx?: number; cy?: number; startAngle?: number;
    startRotations?: (number | undefined)[];
    startFontScales?: (number | undefined)[];
    startImageSizes?: ({ w: number; h: number } | undefined)[];
    startCenters?: { x: number; y: number }[];
  } | null>(null);

  // Refs to late-defined callbacks (populated after they're created below)
  const finishWritingRef = useRef<() => void>(() => {});
  const startWritingRef = useRef<(pos: { x: number; y: number }) => void>(() => {});
  const startEditingStrokeRef = useRef<(stroke: Stroke, wp?: { x: number; y: number }) => void>(() => {});
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
  // After a two/three-finger tap undo/redo, suppress the remaining finger from starting a new
  // stroke. Without this, a tiny tremor of the drawing finger after the gesture fires clears
  // the redo stack before the user can use it.
  const suppressTouchStrokeRef = useRef(false);

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

  // Collect every imageId still referenced by strokes + undo/redo stacks
  const gcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleImageGC = useCallback(() => {
    if (gcDebounceRef.current) clearTimeout(gcDebounceRef.current);
    gcDebounceRef.current = setTimeout(() => {
      gcDebounceRef.current = null;
      const live = new Set<string>();
      const addIds = (strokes: Stroke[]) => strokes.forEach((s) => s.imageId && live.add(s.imageId));
      // Current canvas in-memory state (includes undo/redo stacks)
      addIds(strokesRef.current);
      for (const action of [...undoStackRef.current, ...redoStackRef.current]) {
        if ("stroke" in action) addIds([action.stroke]);
        if ("strokes" in action) addIds(action.strokes);
        if ("before" in action) addIds(action.before);
        if ("after" in action) addIds(action.after);
      }
      // All other canvas slots persisted in localStorage
      for (let i = 1; i <= 9; i++) {
        if (i !== canvasIndexRef.current) addIds(loadStrokes(i));
      }
      gcImages(live);
    }, 5000);
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
      const erasedIndices = erased.map(s => strokesRef.current.indexOf(s));
      strokesRef.current = strokesRef.current.filter((s) => !pending.has(s));
      undoStackRef.current.push({ type: "erase", strokes: erased, indices: erasedIndices });
      redoStackRef.current = [];
      pending.clear();
      window.dispatchEvent(new CustomEvent("drawtool:stroke-erased"));
      scheduleImageGC();
    }
  }, [scheduleImageGC]);

  // --- Dot grid pattern tile cache (item 7) ---
  // Key: `${Math.ceil(screenGap)},${isDark}` → tiny tile canvas pattern.
  // Using createPattern lets the GPU tile it - panning is free (just update
  // the pattern transform offset) and zooming only creates a new tile when
  // the screen gap changes by ≥1px, instead of redrawing N² arcs each frame.

  // --- Completed strokes cache (item 8) ---
  const strokesCacheRef = useRef<{
    canvas: HTMLCanvasElement;
    key: string;
  } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y, scale } = viewRef.current;
    const dpr = dprRef.current;

    const isDark = isDarkTheme(themeRef.current, customThemeBgRef.current);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getBackgroundColor(themeRef.current, customThemeBgRef.current);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);

    // --- Cached completed strokes (item 8) ---
    const pending = pendingEraseRef.current;
    const isErasing = pending.size > 0;
    const activeStroke = isDrawingRef.current && activeModifierRef.current !== "alt" && activeModifierRef.current !== "laser"
      ? strokesRef.current[strokesRef.current.length - 1]
      : null;

    if (isErasing) {
      // During erase mode, render all strokes directly (need per-stroke opacity)
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
        sctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);
        renderStrokesToCtx(sctx, completedStrokes);
        strokesCacheRef.current = { canvas: offscreen, key: cacheKey };
        sCache = strokesCacheRef.current;
      }
      // Blit cached strokes
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sCache.canvas, 0, 0);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);

      // Render only the active stroke on top
      if (activeStroke) {
        renderStrokesToCtx(ctx, [activeStroke]);
      }
    }

    // --- Grid (cached offscreen - only redrawn when view/theme/grid config changes) ---
    if (gridTypeRef.current !== "off" && !presentationModeRef.current) {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const gridCacheKey = `${x},${y},${scale},${gridTypeRef.current},${themeRef.current},${canvas.width},${canvas.height}`;
      let gCache = gridCacheRef.current;
      if (!gCache || gCache.key !== gridCacheKey) {
        const offscreen = gCache?.canvas || document.createElement("canvas");
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const gctx = offscreen.getContext("2d")!;
        gctx.clearRect(0, 0, offscreen.width, offscreen.height);
        gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const gridColor = getGridColor(themeRef.current, customThemeBgRef.current);

        if (gridTypeRef.current === "dot") {
          let coarseWorld = 125;
          while (coarseWorld * scale < 40) coarseWorld *= 5;
          while (coarseWorld * scale > 200) coarseWorld /= 5;
          const fineWorld = coarseWorld / 5;
          const baseAlpha = isDark ? 0.45 : 0.7;
          const sgC = coarseWorld * scale;
          const sgF = fineWorld * scale;
          const fineOp = Math.max(0, Math.min(1, (sgF - 8) / 15));
          const coarseOp = Math.max(0, Math.min(1, (sgC - 5) / 20));
          gctx.fillStyle = gridColor;

          if (fineOp * baseAlpha * 0.4 >= 0.004) {
            const x0 = x + Math.ceil(-x / sgF) * sgF;
            const y0 = y + Math.ceil(-y / sgF) * sgF;
            gctx.globalAlpha = fineOp * baseAlpha * 0.4;
            gctx.beginPath();
            for (let gx = x0; gx <= screenW; gx += sgF) {
              for (let gy = y0; gy <= screenH; gy += sgF) {
                gctx.moveTo(gx + 1.2, gy);
                gctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
              }
            }
            gctx.fill();
          }

          if (coarseOp * baseAlpha >= 0.004) {
            const x0 = x + Math.ceil(-x / sgC) * sgC;
            const y0 = y + Math.ceil(-y / sgC) * sgC;
            gctx.globalAlpha = coarseOp * baseAlpha;
            gctx.beginPath();
            for (let gx = x0; gx <= screenW; gx += sgC) {
              for (let gy = y0; gy <= screenH; gy += sgC) {
                gctx.moveTo(gx + 2, gy);
                gctx.arc(gx, gy, 2, 0, Math.PI * 2);
              }
            }
            gctx.fill();
          }

          gctx.globalAlpha = 1;
        } else if (gridTypeRef.current === "square") {
          const coarseAlpha = isDark ? 0.18 : 0.36;
          const fineAlpha   = isDark ? 0.07 : 0.22;
          const FINE_WORLD   = 25;
          const COARSE_WORLD = 125;
          gctx.strokeStyle = gridColor;
          gctx.lineWidth = 1;
          const fineCS   = FINE_WORLD   * scale;
          const coarseCS = COARSE_WORLD * scale;
          const fineOp   = Math.max(0, Math.min(1, (fineCS   - 5) / 15));
          const coarseOp = Math.max(0, Math.min(1, (coarseCS - 5) / 15));

          const drawLevel = (cellWorld: number, alpha: number, dashed: boolean, skipMajor: boolean) => {
            if (alpha < 0.004) return;
            const cs = cellWorld * scale;
            if (cs < 3) return;
            gctx.globalAlpha = alpha;
            gctx.setLineDash(dashed ? [2, 2] : []);
            gctx.beginPath();
            const x0 = Math.floor(-x / cs) - 1;
            const x1 = Math.ceil((screenW - x) / cs) + 1;
            for (let n = x0; n <= x1; n++) {
              if (skipMajor && n % 5 === 0) continue;
              const sx = n * cs + x;
              gctx.moveTo(sx, 0); gctx.lineTo(sx, screenH);
            }
            const y0 = Math.floor(-y / cs) - 1;
            const y1 = Math.ceil((screenH - y) / cs) + 1;
            for (let n = y0; n <= y1; n++) {
              if (skipMajor && n % 5 === 0) continue;
              const sy = n * cs + y;
              gctx.moveTo(0, sy); gctx.lineTo(screenW, sy);
            }
            gctx.stroke();
          };

          if (fineOp   > 0.004) drawLevel(FINE_WORLD,   fineOp   * fineAlpha,   true,  true);
          if (coarseOp > 0.004) drawLevel(COARSE_WORLD, coarseOp * coarseAlpha, false, false);

          gctx.setLineDash([]);
          gctx.globalAlpha = 1;
        }

        gridCacheRef.current = { canvas: offscreen, key: gridCacheKey };
        gCache = gridCacheRef.current;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(gCache.canvas, 0, 0);
    }
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);

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
      const lineHeight = fontLineHeight(basePx, editStroke ? editStroke.fontFamily : fontFamilyRef.current);
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
            ctx.fillRect(x1, anchor.y + i * lineHeight, Math.max(x2 - x1, 2 / scale), lineHeight);
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
        ctx.fillRect(caretX, caretY, 2 / scale, lineHeight);
      }
    }


    // Draw erase trail with fading tail
    const trail = eraseTrailRef.current;
    if (trail.length >= 2) {
      const pts = smoothPoints(trail);
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
      const pts = smoothPoints(laser);
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
    const drawOverlayStroke = (stroke: Stroke, isSelected: boolean, noHandles = false) => {
      if (!stroke.subStrokes && stroke.points.length === 0) return;
      const lw = 1.5 / scale;

      // Arrow/line: handles along the stroke, not a bounding box
      if ((stroke.shape === "arrow" || stroke.shape === "line") && stroke.points.length >= 2) {
        const pts = stroke.points;
        const n = pts.length;
        // Handles: for 2-point use [start, mid, end]; for N-point use each actual point
        const handlePoints = n === 2
          ? [pts[0], { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, pts[1]]
          : pts;
        ctx.save();
        ctx.setLineDash([]);
        ctx.lineWidth = lw;
        if (isSelected) {
          ctx.strokeStyle = "#4895ef";
          ctx.beginPath();
          if (n > 2) smoothArrowPath(ctx, pts); else { ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); }
          ctx.stroke();
          if (noHandles) {
            // Group member: draw a bounding box instead of handles
            const bb = anyStrokeBBox(stroke);
            const pad = 6 / scale;
            ctx.beginPath();
            ctx.rect(bb.x - pad, bb.y - pad, bb.w + pad * 2, bb.h + pad * 2);
            ctx.stroke();
          }
          if (!noHandles) {
            const hr = 4.5 / scale;
            for (const hp of handlePoints) {
              ctx.beginPath();
              ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
              ctx.fillStyle = "#ffffff"; ctx.fill();
              ctx.strokeStyle = "#4895ef"; ctx.stroke();
            }
          }
          // Rotate handle above bbox (not shown in group mode)
          if (!noHandles) {
            const bb = anyStrokeBBox(stroke);
            const handleOffset = 28 / scale;
            const rotHr = 5 / scale;
            if (n > 2) {
              // Bent line: OBB. stroke.points and stroke.lineRotation are kept live during drag,
              // so the same code path serves both dragging and at-rest correctly.
              const pad = 6 / scale;
              const lineRot = stroke.lineRotation ?? 0;
              const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
              if (lineRot !== 0) {
                const cosN = Math.cos(-lineRot), sinN = Math.sin(-lineRot);
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const p of stroke.points) {
                  const dx = p.x - cx, dy = p.y - cy;
                  const rx = cx + dx * cosN - dy * sinN;
                  const ry = cy + dx * sinN + dy * cosN;
                  minX = Math.min(minX, rx); maxX = Math.max(maxX, rx);
                  minY = Math.min(minY, ry); maxY = Math.max(maxY, ry);
                }
                ctx.save();
                ctx.translate(cx, cy); ctx.rotate(lineRot); ctx.translate(-cx, -cy);
                ctx.lineWidth = lw; ctx.strokeStyle = "#4895ef";
                ctx.setLineDash([6 / scale, 3 / scale]);
                ctx.beginPath();
                ctx.rect(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2);
                ctx.stroke(); ctx.setLineDash([]);
                const hxL = (minX + maxX) / 2;
                ctx.strokeStyle = "#4895ef"; ctx.lineWidth = lw;
                ctx.beginPath(); ctx.moveTo(hxL, minY - pad); ctx.lineTo(hxL, minY - pad - handleOffset); ctx.stroke();
                ctx.beginPath(); ctx.arc(hxL, minY - pad - handleOffset, rotHr, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.strokeStyle = "#4895ef"; ctx.stroke();
                ctx.restore();
              } else {
                ctx.lineWidth = lw; ctx.strokeStyle = "#4895ef";
                ctx.setLineDash([6 / scale, 3 / scale]);
                ctx.beginPath();
                ctx.rect(bb.x - pad, bb.y - pad, bb.w + pad * 2, bb.h + pad * 2);
                ctx.stroke(); ctx.setLineDash([]);
                const hx = bb.x + bb.w / 2, hy = bb.y - handleOffset;
                ctx.strokeStyle = "#4895ef"; ctx.lineWidth = lw;
                ctx.beginPath(); ctx.moveTo(hx, bb.y); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.beginPath(); ctx.arc(hx, hy, rotHr, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.strokeStyle = "#4895ef"; ctx.stroke();
              }
            }
          }
        } else {
          // Hover: wide semi-transparent halo + faint handle outlines
          ctx.lineCap = "round";
          ctx.lineWidth = 8 / scale;
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(72,149,239,0.22)";
          ctx.beginPath();
          if (n > 2) smoothArrowPath(ctx, pts); else { ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); }
          ctx.stroke();
          const hr = 4.5 / scale;
          ctx.lineWidth = lw;
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(72,149,239,0.5)";
          for (const hp of handlePoints) {
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

      // Apply rotation transform for the entire overlay (handles appear in rotated frame)
      const overlayRotation = stroke.rotation ?? 0;
      ctx.save();
      if (overlayRotation) {
        const ocx = bb.x + bb.w / 2, ocy = bb.y + bb.h / 2;
        ctx.translate(ocx, ocy);
        ctx.rotate(overlayRotation);
        ctx.translate(-ocx, -ocy);
      }

      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);

      if (isSelected) {
        ctx.fillStyle = "rgba(72,149,239,0.07)";
        ctx.fill();
        ctx.strokeStyle = "#4895ef";
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        ctx.stroke();

        // Square corner handles for all selected strokes (not group members)
        if (!noHandles) {
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

        // Rotate handle (all types except arrow/line, single selection only)
        if (!noHandles && stroke.shape !== "arrow" && stroke.shape !== "line") {
          const handleOffset = 28 / scale;
          const hr = 5 / scale;
          const hx = rx + rw / 2, hy = ry - handleOffset;
          ctx.lineWidth = lw;
          ctx.setLineDash([]);
          ctx.strokeStyle = "#4895ef";
          ctx.beginPath(); ctx.moveTo(hx, ry); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff"; ctx.fill();
          ctx.strokeStyle = "#4895ef"; ctx.stroke();
        }
      } else {
        // Hover - solid outline with subtle fill
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
      const inGroup = selectedGroupRef.current.length > 0 && selectedGroupRef.current.includes(selectedTextRef.current);
      drawOverlayStroke(selectedTextRef.current, true, inGroup);
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

    // Draw group selection: individual outlines (no handles) + combined bbox with resize/rotate handles
    if (selectedGroupRef.current.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const stroke of selectedGroupRef.current) {
        drawOverlayStroke(stroke, true, true);
        const bb = visualStrokeBBox(stroke);
        minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
      }
      const pad = 6 / scale;
      const bx = minX - pad, by = minY - pad;
      const bw = (maxX - minX) + pad * 2, bh = (maxY - minY) + pad * 2;
      const lw = 1.5 / scale;
      ctx.save();
      ctx.strokeStyle = "#4895ef";
      ctx.lineWidth = lw;
      ctx.setLineDash([6 / scale, 3 / scale]);
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.stroke();
      ctx.setLineDash([]);
      // Corner handles
      const hr = 4.5 / scale;
      const corners = [
        { x: bx,      y: by },
        { x: bx + bw, y: by },
        { x: bx + bw, y: by + bh },
        { x: bx,      y: by + bh },
      ];
      for (const c of corners) {
        ctx.beginPath();
        ctx.rect(c.x - hr, c.y - hr, hr * 2, hr * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#4895ef";
        ctx.stroke();
      }
      // Rotate handle
      const handleOffset = 28 / scale;
      const rotHr = 5 / scale;
      const hx = bx + bw / 2, hy = by - handleOffset;
      ctx.strokeStyle = "#4895ef";
      ctx.beginPath(); ctx.moveTo(hx, by); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, rotHr, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.fill();
      ctx.strokeStyle = "#4895ef"; ctx.stroke();
      ctx.restore();
    }

    // Draw lock indicators: always compute positions (for hover/click), draw only when flashed or hovered
    const flashStroke = lockedFlashRef.current?.stroke ?? null;
    const lockIconPositions: { stroke: Stroke; wx: number; wy: number; wr: number }[] = [];
    const getLockAnchor = (stroke: Stroke, bb: { x: number; y: number; w: number; h: number }) => {
      // For freehand strokes, find the actual top-right-most point so the icon
      // doesn't float in empty bbox space (e.g. a diagonal curve).
      if ((!stroke.shape || stroke.shape === "line" || stroke.shape === "arrow") && !stroke.text && !stroke.imageId && stroke.points.length > 0) {
        let ax = stroke.points[0].x, ay = stroke.points[0].y, best = ax - ay;
        for (const p of stroke.points) {
          const s = p.x - p.y;
          if (s > best) { best = s; ax = p.x; ay = p.y; }
        }
        return { ax, ay };
      }
      return { ax: bb.x + bb.w, ay: bb.y };
    };
    const drawLockIcon = (stroke: Stroke, alpha: number) => {
      const isHovered = lockedHoverRef.current === stroke;
      const bb = anyStrokeBBox(stroke);
      const sz = (isHovered ? 21 : 17) / scale;
      const margin = 3 / scale;
      const { ax, ay } = getLockAnchor(stroke, bb);
      const ix = ax + margin + sz / 2;
      const iy = ay - margin - sz / 2;
      const effectiveAlpha = isHovered ? Math.min(1, alpha + 0.1) : alpha;
      const shieldStroke = isDark
        ? `rgba(120,185,255,${effectiveAlpha})`
        : `rgba(45,100,200,${effectiveAlpha})`;
      const shieldFill = isDark
        ? `rgba(70,130,230,${effectiveAlpha * 0.28})`
        : `rgba(45,100,200,${effectiveAlpha * 0.18})`;
      const sw = sz * 0.72;
      const sh = sz * 0.82;
      const r = sw * 0.22;
      const cx = ix, cy = iy - sh * 0.04;
      const t = cy - sh / 2;   // top
      const bot = cy + sh / 2; // point
      const mid = cy + sh * 0.14; // where sides start curving inward
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = (isHovered ? 1.7 : 1.4) / scale;
      // Shield path
      ctx.beginPath();
      ctx.moveTo(cx - sw / 2 + r, t);
      ctx.lineTo(cx + sw / 2 - r, t);
      ctx.arc(cx + sw / 2 - r, t + r, r, -Math.PI / 2, 0);
      ctx.lineTo(cx + sw / 2, mid);
      ctx.quadraticCurveTo(cx + sw / 2, bot - sh * 0.08, cx, bot);
      ctx.quadraticCurveTo(cx - sw / 2, bot - sh * 0.08, cx - sw / 2, mid);
      ctx.lineTo(cx - sw / 2, t + r);
      ctx.arc(cx - sw / 2 + r, t + r, r, Math.PI, -Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = shieldFill;
      ctx.fill();
      ctx.strokeStyle = shieldStroke;
      ctx.stroke();
      ctx.restore();
      lockIconPositions.push({ stroke, wx: ix, wy: iy, wr: sz * 0.8 });
    };
    for (const stroke of strokesRef.current) {
      if (!stroke.locked) continue;
      const isFlash = stroke === flashStroke;
      const isHovered = lockedHoverRef.current === stroke;
      if (isFlash || isHovered) {
        drawLockIcon(stroke, 0.9);
      } else {
        // Still track position for hover detection even when not drawn
        const bb = anyStrokeBBox(stroke);
        const sz = 17 / scale;
        const margin = 3 / scale;
        const { ax, ay } = getLockAnchor(stroke, bb);
        const ix = ax + margin + sz / 2;
        lockIconPositions.push({ stroke, wx: ix, wy: ay - margin - sz / 2, wr: sz * 0.8 });
      }
    }
    lockedIconPositionsRef.current = lockIconPositions;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Apple Pencil hover preview (iPadOS 16+: pressure=0 pointermove before touching)
    const penHover = penHoverScreenRef.current;
    if (penHover && !isDrawingRef.current) {
      const px = penHover.x * dpr;
      const py = penHover.y * dpr;
      const r = Math.max(4 * dpr, lineWidthRef.current * scale * dpr * 0.5);
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = lineColorRef.current;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 1.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = lineColorRef.current;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, []);

  // --- Grid cache ---
  const gridCacheRef = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(null);

  // --- Content off-screen detection ---
  const contentOffScreenRef = useRef(false);
  const contentOffScreenSyncedRef = useRef(false); // false = parent state is unknown (fresh mount)
  const strokesBBoxRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const checkContentOffScreen = useCallback(() => {
    const cb = onContentOffScreenRef.current;
    if (!cb) return;
    const strokes = strokesRef.current;
    if (strokes.length === 0) {
      strokesBBoxRef.current = null;
      if (contentOffScreenRef.current || !contentOffScreenSyncedRef.current) {
        contentOffScreenRef.current = false;
        contentOffScreenSyncedRef.current = true;
        cb(false);
      }
      return;
    }
    // Recompute world-space bbox only when invalidated (strokesCacheRef null clears it too)
    if (!strokesBBoxRef.current) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const stroke of strokes) {
        const bb = anyStrokeBBox(stroke);
        if (bb.x < minX) minX = bb.x;
        if (bb.y < minY) minY = bb.y;
        if (bb.x + bb.w > maxX) maxX = bb.x + bb.w;
        if (bb.y + bb.h > maxY) maxY = bb.y + bb.h;
      }
      strokesBBoxRef.current = { minX, minY, maxX, maxY };
    }
    const { minX, minY, maxX, maxY } = strokesBBoxRef.current;
    const { x, y, scale } = viewRef.current;
    const offScreen =
      maxX * scale + x < 0 || minX * scale + x > window.innerWidth ||
      maxY * scale + y < 0 || minY * scale + y > window.innerHeight;
    if (offScreen !== contentOffScreenRef.current || !contentOffScreenSyncedRef.current) {
      contentOffScreenRef.current = offScreen;
      contentOffScreenSyncedRef.current = true;
      cb(offScreen);
    }
  }, []);

  // --- RAF-queue scheduleRedraw (item 1) ---
  const rafIdRef = useRef<number | null>(null);
  const lastStateRef = useRef({ canUndo: false, canRedo: false, hasSelection: false, selectionCount: 0, selectionIsCombined: false, selectionIsText: false, selectionIsLocked: false });
  const scheduleRedraw = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      redraw();
      checkContentOffScreen();
      const canUndo = undoStackRef.current.length > 0;
      const canRedo = redoStackRef.current.length > 0;
      const single = selectedTextRef.current;
      const group = selectedGroupRef.current;
      const hasSelection = single !== null || group.length > 0;
      const selectionCount = group.length > 0 ? group.length : single ? 1 : 0;
      const selectionIsCombined = single !== null && Array.isArray(single.subStrokes) && single.subStrokes.length > 0;
      const selectionIsText = single !== null && single.text !== undefined;
      const selectionIsLocked = single !== null && single.locked === true;
      const last = lastStateRef.current;
      if (canUndo !== last.canUndo || canRedo !== last.canRedo || hasSelection !== last.hasSelection || selectionCount !== last.selectionCount || selectionIsCombined !== last.selectionIsCombined || selectionIsText !== last.selectionIsText || selectionIsLocked !== last.selectionIsLocked) {
        last.canUndo = canUndo;
        last.canRedo = canRedo;
        last.hasSelection = hasSelection;
        last.selectionCount = selectionCount;
        last.selectionIsCombined = selectionIsCombined;
        last.selectionIsText = selectionIsText;
        last.selectionIsLocked = selectionIsLocked;
        window.dispatchEvent(new CustomEvent("drawtool:state", { detail: { canUndo, canRedo, hasSelection, selectionCount, selectionIsCombined, selectionIsText, selectionIsLocked } }));
      }
    });
  }, [redraw, checkContentOffScreen]);

  // Load images from IndexedDB on mount, then re-render once they're ready
  useEffect(() => {
    const ids = strokesRef.current.filter((s) => s.imageId).map((s) => s.imageId!);
    if (ids.length === 0) return;
    loadImages(ids).then(() => {
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      scheduleRedraw();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Live sync: replace strokes in-place without remounting (preserves viewport)
  useEffect(() => {
    const handler = (e: Event) => {
      const { slot, strokes } = (e as CustomEvent<{ slot: number; strokes: Stroke[] }>).detail
      if (slot !== canvasIndex) return
      // Defer if a stroke is in progress - apply after pointer-up to avoid mid-stroke disruption
      if (isDrawingRef.current) { pendingSyncRef.current = { slot, strokes }; return }
      strokesRef.current = strokes
      strokesCacheRef.current = null
      strokesBBoxRef.current = null
      selectedTextRef.current = null
      selectedGroupRef.current = []
      undoStackRef.current = []
      redoStackRef.current = []
      const ids = strokes.filter(s => s.imageId).map(s => s.imageId!)
      if (ids.length > 0) {
        loadImages(ids).then(() => scheduleRedraw())
      } else {
        scheduleRedraw()
      }
    }
    window.addEventListener('drawtool:sync-strokes', handler)
    return () => window.removeEventListener('drawtool:sync-strokes', handler)
  }, [canvasIndex, scheduleRedraw])

  // Apply fill style / fill opacity / corners to selected shape strokes when settings change
  const prevShapeFillForApply = useRef(shapeFill);
  const prevFillOpacityForApply = useRef(fillOpacity);
  const prevShapeCornersForApply = useRef(shapeCorners);

  useEffect(() => {
    const prev = prevShapeFillForApply.current;
    prevShapeFillForApply.current = shapeFill;
    if (prev === shapeFill) return;
    const targets = [
      ...selectedGroupRef.current,
      ...(selectedTextRef.current && !selectedGroupRef.current.includes(selectedTextRef.current) ? [selectedTextRef.current] : []),
    ].filter(s => s.shape && s.shape !== "line" && s.fill !== undefined);
    if (targets.length === 0) return;
    undoStackRef.current.push({ type: "fill-style-change", strokes: targets, from: targets.map(s => s.fill), to: shapeFill });
    redoStackRef.current = [];
    targets.forEach(s => { s.fill = shapeFill; });
    strokesCacheRef.current = null; strokesBBoxRef.current = null;
    persistStrokes();
    scheduleRedraw();
  }, [shapeFill, persistStrokes, scheduleRedraw]);

  useEffect(() => {
    const prev = prevFillOpacityForApply.current;
    prevFillOpacityForApply.current = fillOpacity;
    if (prev === fillOpacity) return;
    const targets = [
      ...selectedGroupRef.current,
      ...(selectedTextRef.current && !selectedGroupRef.current.includes(selectedTextRef.current) ? [selectedTextRef.current] : []),
    ].filter(s => s.shape && s.shape !== "line" && s.fill !== undefined);
    if (targets.length === 0) return;
    undoStackRef.current.push({ type: "fill-opacity-change", strokes: targets, from: targets.map(s => s.fillOpacity), to: fillOpacity / 100 });
    redoStackRef.current = [];
    targets.forEach(s => { s.fillOpacity = fillOpacity / 100; });
    strokesCacheRef.current = null; strokesBBoxRef.current = null;
    persistStrokes();
    scheduleRedraw();
  }, [fillOpacity, persistStrokes, scheduleRedraw]);

  useEffect(() => {
    const prev = prevShapeCornersForApply.current;
    prevShapeCornersForApply.current = shapeCorners;
    if (prev === shapeCorners) return;
    const targets = [
      ...selectedGroupRef.current,
      ...(selectedTextRef.current && !selectedGroupRef.current.includes(selectedTextRef.current) ? [selectedTextRef.current] : []),
    ].filter(s => s.shape && s.shape !== "line");
    if (targets.length === 0) return;
    const toSharp = shapeCorners === "sharp" ? true : undefined;
    undoStackRef.current.push({ type: "corners-change", strokes: targets, from: targets.map(s => s.sharp), to: toSharp });
    redoStackRef.current = [];
    targets.forEach(s => { s.sharp = toSharp; });
    strokesCacheRef.current = null; strokesBBoxRef.current = null;
    persistStrokes();
    scheduleRedraw();
  }, [shapeCorners, persistStrokes, scheduleRedraw]);

  useEffect(() => { scheduleRedraw(); }, [presentationMode, scheduleRedraw]);

  const cancelErase = useCallback(() => {
    eraseTrailRef.current = [];
    pendingEraseRef.current.clear();
    isDrawingRef.current = false;
    activeModifierRef.current = null;
    scheduleRedraw();
  }, [scheduleRedraw]);

  // Sync select tool: set zKeyRef and cursor, clear selection when leaving select mode
  const prevTouchToolRef = useRef(touchTool);
  useEffect(() => {
    const prev = prevTouchToolRef.current;
    prevTouchToolRef.current = touchTool;
    // If the user switches tools while actively writing, commit the text first.
    if (isWritingRef.current && touchTool !== "text") {
      finishWritingRef.current();
    }
    if (isTouchDevice && prev === "select" && touchTool !== "select") {
      zKeyRef.current = false;
      selectedTextRef.current = null;
      selectedGroupRef.current = [];
      selectDragRef.current = null;
      groupDragRef.current = null;
      hoverTextRef.current = null;
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      setZCursor(null);
      scheduleRedraw();
    } else if (isTouchDevice && touchTool === "select") {
      zKeyRef.current = true;
      setZCursor("default");
      scheduleRedraw();
    }
  }, [touchTool, setZCursor, scheduleRedraw]);

  // Drain erase trail when cursor stops moving
  useEffect(() => {
    if (!erasing) return;
    let raf: number;
    let stopped = false;
    const tick = () => {
      const trail = eraseTrailRef.current;
      if (eraseMovingRef.current) {
        // Reset flag - will be set again on next eraseAt call
        eraseMovingRef.current = false;
      } else if (trail.length > 0) {
        // Not moving - drain tail toward head
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
        // Pointer move is already calling scheduleRedraw - don't double-render.
        laserMovingRef.current = false;
      } else if (trail.length > 0) {
        // Trail fading: pointer has stopped, drain loop owns rendering.
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
    strokesCacheRef.current = null; strokesBBoxRef.current = null;
    persistStrokes();
    scheduleRedraw();
    scheduleImageGC();
  }, [scheduleRedraw, persistStrokes, scheduleImageGC]);

  // Swap default stroke colors when switching between dark/light themes, then redraw
  const prevIsDarkRef = useRef(isDarkTheme(theme, customThemeBg));
  useEffect(() => {
    const nowIsDark = isDarkTheme(themeRef.current, customThemeBgRef.current);
    if (prevIsDarkRef.current !== nowIsDark) {
      // Bidirectional swap: black↔white. This preserves layer relationships -
      // e.g. a white-on-dark mouth interior becomes black-on-light, and the
      // black-on-dark teeth become white-on-light, keeping contrast intact.
      const swapColor = (c: string) => c === "#000000" ? "#ffffff" : c === "#ffffff" ? "#000000" : c;
      // Use a Set to avoid double-swapping strokes that appear in both
      // strokesRef.current and in undo/redo action references.
      const swapped = new Set<Stroke>();
      const swapOne = (s: Stroke) => {
        if (!swapped.has(s)) { s.color = swapColor(s.color); swapped.add(s); if (s.subStrokes) for (const sub of s.subStrokes) swapOne(sub); }
      };
      const swapStrokes = (strokes: Stroke[]) => { for (const s of strokes) swapOne(s); };
      const swapAction = (a: UndoAction) => {
        const list = a.type === "erase" || a.type === "group-move" || a.type === "multi-draw" ? a.strokes : a.type === "draw" || a.type === "move" || a.type === "resize" || a.type === "edit" || a.type === "font-change" || a.type === "size-change" || a.type === "reshape" ? [a.stroke] : a.type === "combine" || a.type === "uncombine" ? a.originals : [];
        for (const s of list) swapOne(s);
        // Update stored from/to color values in color-related undo actions
        if (a.type === "color-change") {
          a.from = swapColor(a.from); a.to = swapColor(a.to);
        } else if (a.type === "group-color-change") {
          a.from = a.from.map(swapColor); a.to = swapColor(a.to);
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
        swapped.clear();
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
      prevIsDarkRef.current = nowIsDark;
    }
    strokesCacheRef.current = null; strokesBBoxRef.current = null;
    scheduleRedraw();
  }, [gridType, theme, customThemeBg, scheduleRedraw, persistStrokes]);

  // When lineColor changes, immediately re-evaluate the same-color glow at the current cursor position
  useEffect(() => {
    lastSameColorCheckRef.current = 0;
    const screen = lastCursorScreenRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!screen || !ctx || !canvas) {
      if (overSameColorRef.current) { overSameColorRef.current = false; setOverSameColor(false); }
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = dprRef.current;
    const cx = Math.round((screen.x - rect.left) * dpr);
    const cy = Math.round((screen.y - rect.top) * dpr);
    const px = ctx.getImageData(cx, cy, 1, 1).data;
    const ar = parseInt(lineColor.slice(1, 3), 16);
    const ag = parseInt(lineColor.slice(3, 5), 16);
    const ab = parseInt(lineColor.slice(5, 7), 16);
    const same = sameColorFamily(ar, ag, ab, px[0], px[1], px[2]);
    if (same !== overSameColorRef.current) { overSameColorRef.current = same; setOverSameColor(same); }
  }, [lineColor]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      redraw(); // immediate - must paint now
    };

    // Size and draw immediately - grid and strokes appear at once, no blank period.
    {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      redraw();
    }

    // Redraw once custom fonts are ready to correct any text strokes rendered
    // with fallback fonts. On repeat visits fonts are already cached so this
    // resolves instantly. 2s timeout guards against network failure.
    let fontRedrawDone = false;
    const fontRedraw = () => {
      if (fontRedrawDone) return;
      fontRedrawDone = true;
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      scheduleRedraw();
    };
    const fontTimeout = setTimeout(fontRedraw, 2000);
    Promise.all([
      document.fonts.load("400 32px Caveat"),
      document.fonts.load("700 32px Caveat"),
      document.fonts.load("400 32px Bangers"),
      document.fonts.load("400 32px Boogaloo"),
    ]).then(fontRedraw, fontRedraw);

    window.addEventListener("resize", resize);

    // Re-render if any font batch loads after the first draw (e.g. non-default fonts).
    const onFontsLoaded = () => { strokesCacheRef.current = null; strokesBBoxRef.current = null; scheduleRedraw(); };
    document.fonts.addEventListener("loadingdone", onFontsLoaded);

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
      clearTimeout(fontTimeout);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      document.fonts.removeEventListener("loadingdone", onFontsLoaded);
      if (caretTimerRef.current) {
        clearInterval(caretTimerRef.current);
        caretTimerRef.current = null;
      }
      if (sprayIntervalRef.current) {
        clearInterval(sprayIntervalRef.current);
        sprayIntervalRef.current = null;
      }
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
        // Cloud mode: flushCurrentCanvas handled the save; writing here corrupts the slot pre-populated for the next canvas.
        if (!hasSaveHook()) saveStrokes(strokesRef.current, canvasIndexRef.current);
      }
      if (gcDebounceRef.current) {
        clearTimeout(gcDebounceRef.current);
        gcDebounceRef.current = null;
      }
    };
  }, [redraw, scheduleRedraw]);

  const broadcastZoom = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("drawtool:zoom", { detail: viewRef.current.scale }),
    );
  }, []);

  // Sync the zoom UI on mount. The canvas-switching effect returns early when the canvas
  // remounts via a key change (prevIndex === canvasIndex), so without this the parent's
  // zoom display stays stale from the previous canvas.
  useEffect(() => {
    broadcastZoom();
  }, [broadcastZoom]);

  // Canvas switching effect
  useEffect(() => {
    const prevIndex = canvasIndexRef.current;
    if (prevIndex === canvasIndex) return;

    // Cancel any in-progress drawing or writing
    if (isWritingRef.current) {
      finishWritingRef.current();
    }
    lastTextTapRef.current = null;
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
    strokesCacheRef.current = null; strokesBBoxRef.current = null;

    // Load any images referenced by the new canvas's strokes
    const imageIds = strokesRef.current.filter((s) => s.imageId).map((s) => s.imageId!);
    if (imageIds.length > 0) {
      loadImages(imageIds).then(() => {
        strokesCacheRef.current = null; strokesBBoxRef.current = null;
        scheduleRedraw();
      });
    }

    canvasIndexRef.current = canvasIndex;
    canvasLimitRef.current = canvasLimit;
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
        strokesCacheRef.current = null; // view changed, re-blit strokes; bbox stays valid (strokes unchanged)
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
    const view = viewRef.current;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const wx = (cx - view.x) / view.scale;
    const wy = (cy - view.y) / view.scale;
    animateView({ x: cx - wx, y: cy - wy, scale: 1 });
  }, [animateView]);

  const resetViewOrigin = useCallback(() => {
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
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      scheduleRedraw();
      broadcastZoom();
      window.dispatchEvent(new CustomEvent("drawtool:user-zoom"));
      persistView();
    },
    [scheduleRedraw, broadcastZoom, persistView],
  );

  const zoomToSelection = useCallback(() => {
    const group = selectedGroupRef.current;
    const single = selectedTextRef.current;
    const sel = group.length > 0 ? group : single ? [single] : [];
    if (sel.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of sel) {
      const bb = anyStrokeBBox(stroke);
      if (stroke.rotation) {
        const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
        const hw = bb.w / 2, hh = bb.h / 2;
        const cos = Math.cos(stroke.rotation), sin = Math.sin(stroke.rotation);
        const aw = Math.abs(hw * cos) + Math.abs(hh * sin);
        const ah = Math.abs(hw * sin) + Math.abs(hh * cos);
        minX = Math.min(minX, cx - aw); minY = Math.min(minY, cy - ah);
        maxX = Math.max(maxX, cx + aw); maxY = Math.max(maxY, cy + ah);
      } else {
        minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
      }
    }
    const pad = 80;
    const w = maxX - minX, h = maxY - minY;
    const vw = window.innerWidth - pad * 2, vh = window.innerHeight - pad * 2;
    const targetScale = w === 0 && h === 0 ? 2 : Math.min(10, Math.max(0.1, Math.min(vw / (w || 1), vh / (h || 1))));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    animateView({ x: window.innerWidth / 2 - cx * targetScale, y: window.innerHeight / 2 - cy * targetScale, scale: targetScale });
  }, [animateView]);

  const centerView = useCallback(() => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const stroke of strokes) {
      const bb = anyStrokeBBox(stroke);
      if (bb.x < minX) minX = bb.x;
      if (bb.y < minY) minY = bb.y;
      if (bb.x + bb.w > maxX) maxX = bb.x + bb.w;
      if (bb.y + bb.h > maxY) maxY = bb.y + bb.h;
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

  const exportTransparent = useCallback(async (filename?: string, watermark = false) => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const stroke of strokes) {
      const leaves = (stroke.subStrokes?.length ? stroke.subStrokes as Stroke[] : [stroke]);
      for (const s of leaves) {
        if (s.text) {
          const anchor = s.points[0];
          const basePx = TEXT_SIZE_MAP[s.fontSize || "m"];
          const lines = s.text.split("\n");
          const maxLineLen = Math.max(...lines.map((l) => l.length));
          const textW = maxLineLen * basePx * 0.6;
          const textH = lines.length * basePx * 1.2;
          if (anchor.x < minX) minX = anchor.x;
          if (anchor.y < minY) minY = anchor.y;
          if (anchor.x + textW > maxX) maxX = anchor.x + textW;
          if (anchor.y + textH > maxY) maxY = anchor.y + textH;
          continue;
        }
        for (const p of s.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        // Cloud bump centers sit margin=0.55×bumpR inside the bbox, so bumps protrude
        // only ~0.45×bumpR beyond it. Sharp spikes extend up to ~1.25×bumpR beyond.
        if (s.shape === "cloud" && s.points.length === 2) {
          const p0 = s.points[0], p1 = s.points[1];
          const cw = Math.abs(p1.x - p0.x), ch = Math.abs(p1.y - p0.y);
          const bumpR = Math.max(3 * Math.sqrt(Math.max(1, Math.min(cw, ch))), 2 * (cw + ch) / 42);
          const extra = s.sharp ? bumpR * 1.4 : bumpR * 0.6;
          minX -= extra; minY -= extra; maxX += extra; maxY += extra;
        }
      }
    }
    const maxLW = Math.max(...strokes.flatMap((s) => s.subStrokes?.length ? (s.subStrokes as Stroke[]).map(ss => ss.lineWidth) : [s.lineWidth]));
    const pad = 20 + maxLW / 2;
    const w = Math.ceil(maxX - minX + pad * 2);
    const h = Math.ceil(maxY - minY + pad * 2);
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d")!;
    ctx.translate(-minX + pad, -minY + pad);
    renderStrokesToCtx(ctx, strokes);
    if (watermark) await drawWatermark(ctx, offscreen.width, offscreen.height);
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename
        ? `${filename}.png`
        : `drawtool-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: { message: "Exported PNG", duration: 1500 } }));
    });
  }, []);

  const exportPdf = useCallback(async (filename?: string) => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of strokes) {
      const leaves = (stroke.subStrokes?.length ? stroke.subStrokes as Stroke[] : [stroke]);
      for (const s of leaves) {
        if (s.text) {
          const anchor = s.points[0];
          const basePx = TEXT_SIZE_MAP[s.fontSize || "m"];
          const lines = s.text.split("\n");
          const maxLineLen = Math.max(...lines.map((l) => l.length));
          const textW = maxLineLen * basePx * 0.6;
          const textH = lines.length * basePx * 1.2;
          if (anchor.x < minX) minX = anchor.x;
          if (anchor.y < minY) minY = anchor.y;
          if (anchor.x + textW > maxX) maxX = anchor.x + textW;
          if (anchor.y + textH > maxY) maxY = anchor.y + textH;
          continue;
        }
        for (const p of s.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        if (s.shape === "cloud" && s.points.length === 2) {
          const p0 = s.points[0], p1 = s.points[1];
          const cw = Math.abs(p1.x - p0.x), ch = Math.abs(p1.y - p0.y);
          const bumpR = Math.max(3 * Math.sqrt(Math.max(1, Math.min(cw, ch))), 2 * (cw + ch) / 42);
          const extra = s.sharp ? bumpR * 1.4 : bumpR * 0.6;
          minX -= extra; minY -= extra; maxX += extra; maxY += extra;
        }
      }
    }
    const maxLW = Math.max(...strokes.flatMap((s) => s.subStrokes?.length ? (s.subStrokes as Stroke[]).map(ss => ss.lineWidth) : [s.lineWidth]));
    const pad = 20 + maxLW / 2;
    const w = Math.ceil(maxX - minX + pad * 2);
    const h = Math.ceil(maxY - minY + pad * 2);
    const scale = 2;
    const offscreen = document.createElement("canvas");
    offscreen.width = w * scale;
    offscreen.height = h * scale;
    const ctx = offscreen.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.scale(scale, scale);
    ctx.translate(-minX + pad, -minY + pad);
    const printStrokes = isDarkTheme(themeRef.current, customThemeBgRef.current)
      ? strokes.map(adaptStrokeForPrint)
      : strokes;
    renderStrokesToCtx(ctx, printStrokes);
    const dataUrl = offscreen.toDataURL("image/png");
    const { exportToPdf } = await import("../canvas/pdfExport");
    await exportToPdf(dataUrl, w, h, filename);
    window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: { message: "Exported PDF", duration: 1500 } }));
  }, []);

  const exportSvg = useCallback(async (transparent: boolean, filename?: string, watermark = false) => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    const { generateSvg } = await import("../canvas/svgExport");
    const svgStr = generateSvg(strokes, transparent, theme, watermark);
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    a.download = filename
      ? (transparent ? `${filename}-transparent.svg` : `${filename}.svg`)
      : (transparent ? `drawtool-${ts}-transparent.svg` : `drawtool-${ts}.svg`);
    a.click();
    URL.revokeObjectURL(url);
    window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: { message: transparent ? "Exported transparent SVG" : "Exported SVG", duration: 1500 } }));
  }, [theme]);

  const undo = useCallback(() => {
    const action = undoStackRef.current.pop();
    if (action) {
      if (action.type === "draw") {
        const idx = strokesRef.current.lastIndexOf(action.stroke);
        if (idx !== -1) strokesRef.current.splice(idx, 1);
      } else if (action.type === "erase") {
        if (action.indices) {
          const pairs = action.strokes.map((s, i) => ({ s, idx: action.indices![i] }));
          pairs.sort((a, b) => a.idx - b.idx);
          for (const { s, idx } of pairs) {
            strokesRef.current.splice(Math.min(idx, strokesRef.current.length), 0, s);
          }
        } else {
          strokesRef.current.push(...action.strokes);
        }
      } else if (action.type === "move") {
        action.from.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
        if (action.subFrom && action.stroke.subStrokes) {
          action.stroke.subStrokes.forEach((s, k) => { s.points = action.subFrom![k].map(p => ({ ...p })); });
        }
        if (action.fromLineWidth !== undefined) action.stroke.lineWidth = action.fromLineWidth;
        if (action.fromSubLineWidths && action.stroke.subStrokes) {
          action.stroke.subStrokes.forEach((s, k) => { if (action.fromSubLineWidths![k] !== undefined) s.lineWidth = action.fromSubLineWidths![k]; });
        }
      } else if (action.type === "resize") {
        action.stroke.fontScale = action.fromScale;
        if (action.fromW !== undefined) { action.stroke.imageW = action.fromW; action.stroke.imageH = action.fromH; }
        action.fromPoints.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "edit") {
        action.stroke.text = action.oldText;
      } else if (action.type === "font-change") {
        action.stroke.fontFamily = action.from;
        if (action.fromAnchor) action.stroke.points[0] = { ...action.fromAnchor };
      } else if (action.type === "size-change") {
        action.stroke.fontSize = action.from;
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
      } else if (action.type === "fill-style-change") {
        action.strokes.forEach((s, i) => { s.fill = action.from[i]; });
      } else if (action.type === "fill-opacity-change") {
        action.strokes.forEach((s, i) => { s.fillOpacity = action.from[i]; });
      } else if (action.type === "corners-change") {
        action.strokes.forEach((s, i) => { s.sharp = action.from[i]; });
      } else if (action.type === "group-move") {
        for (let i = 0; i < action.strokes.length; i++) {
          action.strokes[i].points = action.from[i].map(p => ({ ...p }));
          if (action.subFrom && action.strokes[i].subStrokes) {
            action.strokes[i].subStrokes!.forEach((s, k) => { s.points = action.subFrom![i][k].map(p => ({ ...p })); });
          }
        }
        selectedGroupRef.current = action.strokes;
      } else if (action.type === "group-transform") {
        for (let i = 0; i < action.strokes.length; i++) {
          const s = action.strokes[i];
          s.points = action.fromPoints[i].map(p => ({ ...p }));
          if (action.fromSubPoints && s.subStrokes) {
            s.subStrokes.forEach((ss, k) => { ss.points = action.fromSubPoints![i][k].map(p => ({ ...p })); });
          }
          s.rotation = action.fromRotations[i];
          s.fontScale = action.fromFontScales[i];
          if (action.fromImageSizes[i]) { s.imageW = action.fromImageSizes[i]!.w; s.imageH = action.fromImageSizes[i]!.h; }
        }
        selectedGroupRef.current = action.strokes;
      } else if (action.type === "combine") {
        const idx = strokesRef.current.indexOf(action.combined);
        if (idx !== -1) strokesRef.current.splice(idx, 1);
        if (action.originalIndices) {
          const pairs = action.originals.map((s, i) => ({ s, idx: action.originalIndices![i] }));
          pairs.sort((a, b) => a.idx - b.idx);
          for (const { s, idx: origIdx } of pairs) {
            strokesRef.current.splice(Math.min(origIdx, strokesRef.current.length), 0, s);
          }
        } else {
          const insertAt = idx !== -1 ? idx : action.insertIndex;
          strokesRef.current.splice(Math.min(insertAt, strokesRef.current.length), 0, ...action.originals);
        }
        selectedGroupRef.current = action.originals;
        selectedTextRef.current = null;
      } else if (action.type === "uncombine") {
        const firstIdx = action.originals.reduce((min, s) => {
          const i = strokesRef.current.indexOf(s);
          return i !== -1 && i < min ? i : min;
        }, Infinity);
        strokesRef.current = strokesRef.current.filter(s => !action.originals.includes(s));
        strokesRef.current.splice(firstIdx === Infinity ? strokesRef.current.length : firstIdx, 0, action.combined);
        selectedTextRef.current = action.combined;
        selectedGroupRef.current = [];
      } else if (action.type === "multi-draw") {
        for (const s of action.strokes) {
          const idx = strokesRef.current.lastIndexOf(s);
          if (idx !== -1) strokesRef.current.splice(idx, 1);
        }
      } else if (action.type === "reorder") {
        strokesRef.current = [...action.before];
      } else if (action.type === "reshape") {
        action.stroke.points = action.from.map(p => ({ ...p }));
        action.stroke.lineRotation = action.fromLineRotation || undefined;
      } else if (action.type === "rotate") {
        action.stroke.rotation = action.from || undefined;
      } else if (action.type === "flip") {
        for (let i = 0; i < action.strokes.length; i++) {
          action.strokes[i].points = action.fromPoints[i].map(p => ({ ...p }));
          action.strokes[i].rotation = action.fromRotations[i];
        }
      } else if (action.type === "lock") {
        for (const s of action.strokes) {
          s.locked = action.to ? undefined : true;
        }
      }
      redoStackRef.current.push(action);
    }
    // Abort any in-progress drawing (prevents corrupting the new last stroke on next pointerMove)
    if (isDrawingRef.current && activeModifierRef.current !== "alt") {
      if (sprayIntervalRef.current) { clearInterval(sprayIntervalRef.current); sprayIntervalRef.current = null; }
      isDrawingRef.current = false;
      activeModifierRef.current = null;
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
    // Clear group selection unless we just re-selected it for a group-move/group-transform undo
    if (!action || (action.type !== "group-move" && action.type !== "group-transform")) selectedGroupRef.current = [];
    lastTextTapRef.current = null;
    hoverTextRef.current = null;
    strokesCacheRef.current = null; strokesBBoxRef.current = null;
    setZCursor(zKeyRef.current ? "default" : null);
    persistStrokes();
    if (action) window.dispatchEvent(new Event("drawtool:did-undo"));
    scheduleRedraw();
  }, [persistStrokes, scheduleRedraw, setZCursor]);

  const redo = useCallback(() => {
    // Abort any in-progress drawing before applying the redo action.
    // Without this, the redone stroke lands after the current in-progress stroke, so
    // subsequent pointer moves add points to the wrong (redone) stroke instead of the
    // one being drawn — orphaning the in-progress stroke in the undo stack.
    if (isDrawingRef.current && activeModifierRef.current !== "alt") {
      strokesRef.current.pop();
      undoStackRef.current.pop();
      if (sprayIntervalRef.current) { clearInterval(sprayIntervalRef.current); sprayIntervalRef.current = null; }
      isDrawingRef.current = false;
      activeModifierRef.current = null;
    }
    const action = redoStackRef.current.pop();
    // actionForUndo is what actually gets pushed to the undo stack after redo.
    // For erase, we track only the strokes that were actually present and removed, so
    // that a later undo-of-erase doesn't incorrectly re-insert strokes that were already
    // absent (which would leave them permanently stuck on canvas with no draw entry).
    let actionForUndo: typeof action = action;
    if (action) {
      if (action.type === "draw") {
        strokesRef.current.push(action.stroke);
      } else if (action.type === "erase") {
        const actuallyErasedStrokes: typeof action.strokes = [];
        for (const s of action.strokes) {
          const idx = strokesRef.current.lastIndexOf(s);
          if (idx !== -1) {
            strokesRef.current.splice(idx, 1);
            actuallyErasedStrokes.push(s);
          }
        }
        if (actuallyErasedStrokes.length === 0) {
          actionForUndo = undefined; // complete no-op: nothing to undo
        } else if (actuallyErasedStrokes.length < action.strokes.length) {
          // Partial: only push the strokes that were actually removed so undo
          // doesn't re-insert strokes that were already absent.
          actionForUndo = { type: "erase" as const, strokes: actuallyErasedStrokes };
        }
      } else if (action.type === "move") {
        action.to.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
        if (action.subTo && action.stroke.subStrokes) {
          action.stroke.subStrokes.forEach((s, k) => { s.points = action.subTo![k].map(p => ({ ...p })); });
        }
        if (action.toLineWidth !== undefined) action.stroke.lineWidth = action.toLineWidth;
        if (action.toSubLineWidths && action.stroke.subStrokes) {
          action.stroke.subStrokes.forEach((s, k) => { if (action.toSubLineWidths![k] !== undefined) s.lineWidth = action.toSubLineWidths![k]; });
        }
      } else if (action.type === "resize") {
        action.stroke.fontScale = action.toScale;
        if (action.toW !== undefined) { action.stroke.imageW = action.toW; action.stroke.imageH = action.toH; }
        action.toPoints.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "edit") {
        action.stroke.text = action.newText;
      } else if (action.type === "font-change") {
        action.stroke.fontFamily = action.to;
        if (action.toAnchor) action.stroke.points[0] = { ...action.toAnchor };
      } else if (action.type === "size-change") {
        action.stroke.fontSize = action.to;
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
      } else if (action.type === "fill-style-change") {
        action.strokes.forEach(s => { s.fill = action.to; });
      } else if (action.type === "fill-opacity-change") {
        action.strokes.forEach(s => { s.fillOpacity = action.to; });
      } else if (action.type === "corners-change") {
        action.strokes.forEach(s => { s.sharp = action.to; });
      } else if (action.type === "group-move") {
        for (let i = 0; i < action.strokes.length; i++) {
          action.strokes[i].points = action.to[i].map(p => ({ ...p }));
          if (action.subTo && action.strokes[i].subStrokes) {
            action.strokes[i].subStrokes!.forEach((s, k) => { s.points = action.subTo![i][k].map(p => ({ ...p })); });
          }
        }
        selectedGroupRef.current = action.strokes;
      } else if (action.type === "group-transform") {
        for (let i = 0; i < action.strokes.length; i++) {
          const s = action.strokes[i];
          s.points = action.toPoints[i].map(p => ({ ...p }));
          if (action.toSubPoints && s.subStrokes) {
            s.subStrokes.forEach((ss, k) => { ss.points = action.toSubPoints![i][k].map(p => ({ ...p })); });
          }
          s.rotation = action.toRotations[i];
          s.fontScale = action.toFontScales[i];
          if (action.toImageSizes[i]) { s.imageW = action.toImageSizes[i]!.w; s.imageH = action.toImageSizes[i]!.h; }
        }
        selectedGroupRef.current = action.strokes;
      } else if (action.type === "combine") {
        const firstIdx = action.originals.reduce((min, s) => {
          const i = strokesRef.current.indexOf(s);
          return i !== -1 && i < min ? i : min;
        }, Infinity);
        strokesRef.current = strokesRef.current.filter(s => !action.originals.includes(s));
        strokesRef.current.splice(firstIdx === Infinity ? strokesRef.current.length : firstIdx, 0, action.combined);
        selectedTextRef.current = action.combined;
        selectedGroupRef.current = [];
      } else if (action.type === "uncombine") {
        const idx = strokesRef.current.indexOf(action.combined);
        if (idx !== -1) strokesRef.current.splice(idx, 1, ...action.originals);
        else strokesRef.current.splice(action.insertIndex, 0, ...action.originals);
        selectedGroupRef.current = action.originals;
        selectedTextRef.current = null;
      } else if (action.type === "multi-draw") {
        strokesRef.current.push(...action.strokes);
      } else if (action.type === "reorder") {
        strokesRef.current = [...action.after];
      } else if (action.type === "reshape") {
        action.stroke.points = action.to.map(p => ({ ...p }));
        action.stroke.lineRotation = action.toLineRotation || undefined;
      } else if (action.type === "rotate") {
        action.stroke.rotation = action.to || undefined;
      } else if (action.type === "flip") {
        for (let i = 0; i < action.strokes.length; i++) {
          action.strokes[i].points = action.toPoints[i].map(p => ({ ...p }));
          action.strokes[i].rotation = action.toRotations[i];
        }
      } else if (action.type === "lock") {
        for (const s of action.strokes) {
          s.locked = action.to ? true : undefined;
        }
      }
      if (actionForUndo) undoStackRef.current.push(actionForUndo);
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
    // Clear group selection unless we just re-selected it for a group-move/group-transform redo
    if (!action || (action.type !== "group-move" && action.type !== "group-transform")) selectedGroupRef.current = [];
    lastTextTapRef.current = null;
    hoverTextRef.current = null;
    strokesCacheRef.current = null; strokesBBoxRef.current = null;
    setZCursor(zKeyRef.current ? "default" : null);
    persistStrokes();
    scheduleRedraw();
  }, [persistStrokes, scheduleRedraw, setZCursor]);

  // Listen for clear / reset-view / center-view / zoom-step / stroke-count-query / export-transparent events
  useEffect(() => {
    const onClear = () => clearCanvas();
    const onResetView = () => resetView();
    const onResetViewOrigin = () => resetViewOrigin();
    const onCenterView = () => centerView();
    const onZoomToSelection = () => zoomToSelection();
    const onZoomStep = (e: Event) =>
      zoomBy((e as CustomEvent).detail as number);
    const onQueryCount = (e: Event) => {
      (e as CustomEvent).detail.count = strokesRef.current.length;
    };
    const onExportTransparent = (e: Event) => exportTransparent((e as CustomEvent).detail?.filename, (e as CustomEvent).detail?.watermark ?? false);
    const onExportPdf = (e: Event) => exportPdf((e as CustomEvent).detail?.filename);
    const onExportSvg = (e: Event) => exportSvg((e as CustomEvent).detail?.transparent ?? false, (e as CustomEvent).detail?.filename, (e as CustomEvent).detail?.watermark ?? false);
    const onExportSelectionSvg = async (e: Event) => {
      const { transparent = true, filename, watermark = false } = (e as CustomEvent).detail ?? {};
      const strokes = selectedGroupRef.current.length > 0
        ? selectedGroupRef.current
        : selectedTextRef.current
        ? [selectedTextRef.current]
        : [];
      if (!strokes.length) return;
      const { generateSvg } = await import("../canvas/svgExport");
      const svgStr = generateSvg(strokes, transparent, theme, watermark);
      if (!svgStr) return;
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      a.download = filename
        ? (transparent ? `${filename}-selection-transparent.svg` : `${filename}-selection.svg`)
        : `drawtool-selection-${ts}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: { message: "Exported selection as SVG", duration: 1500 } }));
    };
    const onExportSelectionPng = async (e: Event) => {
      const { filename } = (e as CustomEvent).detail ?? {};
      const strokes = selectedGroupRef.current.length > 0
        ? selectedGroupRef.current
        : selectedTextRef.current
        ? [selectedTextRef.current]
        : [];
      if (!strokes.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const stroke of strokes) {
        if (stroke.text) {
          const anchor = stroke.points[0];
          const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
          const lines = stroke.text.split("\n");
          const maxLineLen = Math.max(...lines.map((l) => l.length));
          minX = Math.min(minX, anchor.x);
          minY = Math.min(minY, anchor.y);
          maxX = Math.max(maxX, anchor.x + maxLineLen * basePx * 0.6);
          maxY = Math.max(maxY, anchor.y + lines.length * basePx * 1.2);
          continue;
        }
        for (const p of stroke.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        if (stroke.shape === "cloud" && stroke.points.length === 2) {
          const p0 = stroke.points[0], p1 = stroke.points[1];
          const cw = Math.abs(p1.x - p0.x), ch = Math.abs(p1.y - p0.y);
          const bumpR = Math.max(3 * Math.sqrt(Math.max(1, Math.min(cw, ch))), 2 * (cw + ch) / 42);
          const extra = stroke.sharp ? bumpR * 1.4 : bumpR * 0.6;
          minX -= extra; minY -= extra; maxX += extra; maxY += extra;
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
      const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      offscreen.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename ? `${filename}-selection.png` : `drawtool-selection-${ts}.png`;
        a.click();
        URL.revokeObjectURL(url);
        window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: { message: "Exported selection as PNG", duration: 1500 } }));
      });
    };
    const onFontFamily = (e: Event) => {
      const key = (e as CustomEvent).detail as FontFamily;
      const sel = selectedTextRef.current;
      if (sel && sel.text && !isWritingRef.current) {
        const fromAnchor = { ...sel.points[0] };
        const oldBbox = textBBox(sel);
        const fromFont = sel.fontFamily;
        sel.fontFamily = key;
        const newBbox = textBBox(sel);
        sel.points[0] = { x: fromAnchor.x + (oldBbox.x - newBbox.x), y: fromAnchor.y + (oldBbox.y - newBbox.y) };
        const toAnchor = { ...sel.points[0] };
        undoStackRef.current.push({ type: "font-change", stroke: sel, from: fromFont, to: key, fromAnchor, toAnchor });
        redoStackRef.current = [];
        strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
        strokesCacheRef.current = null; strokesBBoxRef.current = null;
        persistStrokes();
        scheduleRedraw();
      } else if (single) {
        undoStackRef.current.push({ type: "color-change", stroke: single, from: single.color, to: color });
        redoStackRef.current = [];
        single.color = color;
        strokesCacheRef.current = null; strokesBBoxRef.current = null;
        persistStrokes();
        scheduleRedraw();
      }
    };
    const onGetView = (e: Event) => { (e as CustomEvent).detail.view = { ...viewRef.current } }
    const onGetSelectionBBox = (e: Event) => {
      const sel: Stroke[] = selectedGroupRef.current.length > 0
        ? selectedGroupRef.current
        : selectedTextRef.current
          ? [selectedTextRef.current]
          : [];
      if (sel.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of sel) {
        const bb = visualStrokeBBox(s);
        if (bb.x < minX) minX = bb.x; if (bb.y < minY) minY = bb.y;
        if (bb.x + bb.w > maxX) maxX = bb.x + bb.w; if (bb.y + bb.h > maxY) maxY = bb.y + bb.h;
      }
      (e as CustomEvent).detail.bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    const onNavigateSlide = (e: Event) => {
      const v = (e as CustomEvent).detail as { x: number; y: number; scale: number }
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0 }
      viewRef.current.x = v.x; viewRef.current.y = v.y; viewRef.current.scale = v.scale
      strokesCacheRef.current = null
      scheduleRedraw()
      broadcastZoom()
      persistView()
    }
    const onGetThumbnail = (e: Event) => {
      const src = canvasRef.current
      if (!src) return
      const W = 480, H = 270
      const off = document.createElement("canvas")
      off.width = W; off.height = H
      const ctx = off.getContext("2d")
      if (!ctx) return
      ctx.drawImage(src, 0, 0, W, H)
      ;(e as CustomEvent).detail.thumbnail = off.toDataURL("image/jpeg", 0.82)
    }
    window.addEventListener("drawtool:get-view", onGetView);
    window.addEventListener("drawtool:get-selection-bbox", onGetSelectionBBox);
    window.addEventListener("drawtool:navigate-slide", onNavigateSlide);
    window.addEventListener("drawtool:get-thumbnail", onGetThumbnail);
    window.addEventListener("drawtool:clear", onClear);
    window.addEventListener("drawtool:reset-view", onResetView);
    window.addEventListener("drawtool:reset-view-origin", onResetViewOrigin);
    window.addEventListener("drawtool:center-view", onCenterView);
    window.addEventListener("drawtool:zoom-to-selection", onZoomToSelection);
    window.addEventListener("drawtool:zoom-step", onZoomStep);
    window.addEventListener("drawtool:query-stroke-count", onQueryCount);
    window.addEventListener("drawtool:export-transparent", onExportTransparent);
    window.addEventListener("drawtool:export-pdf", onExportPdf);
    window.addEventListener("drawtool:export-svg", onExportSvg);
    window.addEventListener("drawtool:export-selection-svg", onExportSelectionSvg);
    window.addEventListener("drawtool:export-selection-png", onExportSelectionPng);
    const onTextBold = () => {
      const editStroke = editingStrokeRef.current;
      const sel = selectedTextRef.current;
      if (isWritingRef.current) {
        if (editStroke) {
          const newBold = !(editStroke.bold ?? false);
          undoStackRef.current.push({ type: "bold-change", stroke: editStroke, from: editStroke.bold, to: newBold });
          editStroke.bold = newBold || undefined;
          writingBoldRef.current = newBold;
          strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
        strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
          editStroke.italic = newItalic || undefined;
          writingItalicRef.current = newItalic;
          strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
        strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
            editStroke.textAlign = newAlign !== "left" ? newAlign : undefined;
            strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
          strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      selectedTextRef.current = null;
      selectedGroupRef.current = [];
      scheduleRedraw();
    };
    window.addEventListener("drawtool:import-strokes", onImportStrokes);
    const onUndoEvent = () => undo();
    window.addEventListener("drawtool:undo", onUndoEvent);
    const onRedoEvent = () => redo();
    window.addEventListener("drawtool:redo", onRedoEvent);
    const onSaveToStash = () => {
      const group = selectedGroupRef.current;
      const single = selectedTextRef.current;
      const strokes = group.length > 0 ? group
        : single ? [single]
        : strokesRef.current.filter((s) => s.points.length > 0 || s.subStrokes);
      if (strokes.length === 0) return;
      window.dispatchEvent(new CustomEvent("drawtool:save-to-stash-result", { detail: strokes }));
    };
    window.addEventListener("drawtool:save-to-stash", onSaveToStash);
    const onDropStashItem = (e: Event) => {
      const { strokes, savedDark } = (e as CustomEvent<{ strokes: Stroke[]; savedDark?: boolean }>).detail;
      if (!strokes?.length) return;
      const currentIsDark = isDarkTheme(themeRef.current, customThemeBgRef.current);
      const needsColorSwap = savedDark !== undefined && savedDark !== currentIsDark;
      const swapColor = (c: string) => c === "#000000" ? "#ffffff" : c === "#ffffff" ? "#000000" : c;
      const maybeSwap = (c: string) => needsColorSwap ? swapColor(c) : c;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of strokes) {
        const bb = anyStrokeBBox(s);
        minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
      }
      const itemCx = (minX + maxX) / 2, itemCy = (minY + maxY) / 2;
      const view = viewRef.current;
      const w = canvasRef.current?.offsetWidth ?? window.innerWidth;
      const h = canvasRef.current?.offsetHeight ?? window.innerHeight;
      const vpCx = (w / 2 - view.x) / view.scale;
      const vpCy = (h / 2 - view.y) / view.scale;
      const dx = vpCx - itemCx, dy = vpCy - itemCy;
      const offset = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
      const newStrokes: Stroke[] = strokes.map((src) => ({
        ...src,
        color: maybeSwap(src.color),
        points: src.points.map(offset),
        widths: src.widths ? [...src.widths] : undefined,
        subStrokes: src.subStrokes?.map((ss) => ({ ...ss, color: maybeSwap(ss.color), points: ss.points.map(offset) })),
      }));
      strokesRef.current.push(...newStrokes);
      undoStackRef.current.push(
        newStrokes.length === 1
          ? { type: "draw", stroke: newStrokes[0] }
          : { type: "multi-draw", strokes: newStrokes },
      );
      redoStackRef.current = [];
      if (newStrokes.length === 1) {
        selectedTextRef.current = newStrokes[0];
        selectedGroupRef.current = [];
      } else {
        selectedGroupRef.current = newStrokes;
        selectedTextRef.current = null;
      }
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      setZCursor("default");
      persistStrokes();
      scheduleRedraw();
    };
    window.addEventListener("drawtool:drop-stash-item", onDropStashItem);
    const onInsertImage = async (e: Event) => {
      const file = (e as CustomEvent<File>).detail;
      if (!file) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      let result: { dataUrl: string; naturalW: number; naturalH: number };
      let id: string;
      try {
        result = await processImageFile(file);
        id = crypto.randomUUID();
        await storeImage(id, result.dataUrl);
      } catch { return; }
      const { naturalW, naturalH } = result;
      const view = viewRef.current;
      const MAX_SCREEN_W = 600;
      const worldW = Math.min(naturalW, MAX_SCREEN_W / view.scale);
      const worldH = naturalH * (worldW / naturalW);
      const screenCx = canvas.width / (2 * dprRef.current);
      const screenCy = canvas.height / (2 * dprRef.current);
      const worldCenter = screenToWorld(screenCx, screenCy, view);
      const anchor = { x: worldCenter.x - worldW / 2, y: worldCenter.y - worldH / 2 };
      const stroke: import("../canvas/types").Stroke = {
        points: [anchor], style: "solid", lineWidth: 1, color: "#000000",
        imageId: id, imageW: worldW, imageH: worldH,
      };
      strokesRef.current.push(stroke);
      undoStackRef.current.push({ type: "draw", stroke });
      redoStackRef.current = [];
      selectedTextRef.current = stroke;
      selectedGroupRef.current = [];
      setZCursor("default");
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      persistStrokes();
      scheduleRedraw();
    };
    window.addEventListener("drawtool:insert-image", onInsertImage);
    return () => {
      window.removeEventListener("drawtool:clear", onClear);
      window.removeEventListener("drawtool:get-view", onGetView);
      window.removeEventListener("drawtool:get-selection-bbox", onGetSelectionBBox);
      window.removeEventListener("drawtool:navigate-slide", onNavigateSlide);
      window.removeEventListener("drawtool:get-thumbnail", onGetThumbnail);
      window.removeEventListener("drawtool:reset-view", onResetView);
      window.removeEventListener("drawtool:reset-view-origin", onResetViewOrigin);
      window.removeEventListener("drawtool:center-view", onCenterView);
      window.removeEventListener("drawtool:zoom-to-selection", onZoomToSelection);
      window.removeEventListener("drawtool:zoom-step", onZoomStep);
      window.removeEventListener("drawtool:query-stroke-count", onQueryCount);
      window.removeEventListener("drawtool:export-transparent", onExportTransparent);
      window.removeEventListener("drawtool:export-pdf", onExportPdf);
      window.removeEventListener("drawtool:export-svg", onExportSvg);
      window.removeEventListener("drawtool:export-selection-svg", onExportSelectionSvg);
      window.removeEventListener("drawtool:export-selection-png", onExportSelectionPng);
      window.removeEventListener("drawtool:font-family", onFontFamily);
      window.removeEventListener("drawtool:set-color", onSetColor);
      window.removeEventListener("drawtool:text-bold", onTextBold);
      window.removeEventListener("drawtool:text-italic", onTextItalic);
      window.removeEventListener("drawtool:text-align", onTextAlign);
      window.removeEventListener("drawtool:import-strokes", onImportStrokes);
      window.removeEventListener("drawtool:undo", onUndoEvent);
      window.removeEventListener("drawtool:redo", onRedoEvent);
      window.removeEventListener("drawtool:save-to-stash", onSaveToStash);
      window.removeEventListener("drawtool:drop-stash-item", onDropStashItem);
      window.removeEventListener("drawtool:insert-image", onInsertImage);
    };
  }, [clearCanvas, resetView, resetViewOrigin, centerView, zoomToSelection, zoomBy, exportTransparent, exportPdf, exportSvg, scheduleRedraw, undo, redo]);

  // 6 screen pixels converted to world units - so zooming in doesn't cause
  // intentional small strokes to be discarded.
  const MIN_SHAPE_SIZE = 12 / viewRef.current.scale;
  const MIN_DASH_LENGTH = 6 / viewRef.current.scale;
  const MIN_META_LENGTH = 2 / viewRef.current.scale;

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
    const minSize = stroke.shape === "arrow" ? 1 / viewRef.current.scale : MIN_SHAPE_SIZE;
    if (dx < minSize && dy < minSize) {
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

  const shortcutsModalOpenRef = useRef(false);
  useEffect(() => {
    const onModal = (e: Event) => { shortcutsModalOpenRef.current = (e as CustomEvent).detail as boolean; };
    window.addEventListener("drawtool:shortcuts-modal", onModal);
    return () => window.removeEventListener("drawtool:shortcuts-modal", onModal);
  }, []);

  // Capture-phase Escape handler - runs before Menu's bubble-phase handler.
  // Performs the canvas escape action and stops propagation so Menu stays open.
  // Skips entirely when the shortcuts modal is open so it can close first.
  useEffect(() => {
    const onCapture = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (shortcutsModalOpenRef.current) return;
      if (isWritingRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        finishWritingRef.current();
      } else if (selectedTextRef.current || selectedGroupRef.current.length > 0 || boxSelectRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        selectedTextRef.current = null;
        hoverTextRef.current = null;
        selectDragRef.current = null;
        selectedGroupRef.current = [];
        groupDragRef.current = null;
        boxSelectRef.current = null;
        lastTextTapRef.current = null;
        lastLockedTapRef.current = null;
        zKeyRef.current = false;
        setZCursor(null);
        scheduleRedraw();
      }
    };
    window.addEventListener("keydown", onCapture, { capture: true });
    return () => window.removeEventListener("keydown", onCapture, { capture: true });
  }, [finishWritingRef, setZCursor, scheduleRedraw]);

  // Show lock icon briefly when a locked stroke is clicked
  useEffect(() => {
    const onLockedClick = (e: Event) => {
      const stroke = (e as CustomEvent).detail as Stroke;
      if (lockedFlashTimerRef.current) clearTimeout(lockedFlashTimerRef.current);
      lockedFlashRef.current = { stroke, expiry: Date.now() + 2000 };
      scheduleRedraw();
      lockedFlashTimerRef.current = setTimeout(() => {
        lockedFlashRef.current = null;
        lockedFlashTimerRef.current = null;
        scheduleRedraw();
      }, 2000);
    };
    window.addEventListener("drawtool:locked-click", onLockedClick);
    return () => {
      window.removeEventListener("drawtool:locked-click", onLockedClick);
      if (lockedFlashTimerRef.current) {
        clearTimeout(lockedFlashTimerRef.current);
        lockedFlashTimerRef.current = null;
      }
    };
  }, [scheduleRedraw]);

  // Keyboard shortcuts (keydown/keyup/blur/paste)
  useKeyboardShortcuts(
    {
      canvasRef, canvasIndexRef, strokesRef, undoStackRef, redoStackRef, strokesCacheRef, viewRef,
      isWritingRef, writingTextRef, caretPosRef, caretVisibleRef, selectionAnchorRef,
      textUndoRef, textRedoRef, editingStrokeRef, writingBoldRef, writingItalicRef, writingAlignRef,
      zKeyRef, selectedTextRef, hoverTextRef, selectDragRef, selectedGroupRef, groupDragRef, boxSelectRef, lastCycleRef,
      clipboardRef, cursorWorldRef, lastDPressRef, shapeFlashRef, activeShapeRef,
      textSizeRef, fontFamilyRef, lineColorRef, lineWidthRef,
      laserTrailRef, isDrawingRef, isZoomingRef, activeModifierRef,
      spaceDownRef, isPanningRef, highlightKeyRef, laserKeyRef,
      shiftHeldRef, rightClickHeldRef, keyShapeRef, keyShapeDashedRef, shapeJustCommittedRef, fKeyHeldRef, shapeFillRef, fillOpacityRef,
      lastTextTapRef, finishWritingRef, startWritingRef, cursorRef,
      sprayKeyRef, textareaRef, canvasLimitRef, presentationModeRef,
    },
    {
      scheduleRedraw, persistStrokes, persistView, clearCanvas,
      undo, redo, confirmErase, cancelErase, cancelCurrentStroke, discardTinyShape, notifyColorUsed,
      setZCursor, setPanning, setErasing, setShapeActive, setHighlighting, setLasering, setSpraying,
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
      if (stroke.locked) continue;
      let hit = false;
      // Un-rotate eraser point into the stroke's local frame if the stroke is rotated
      let ex = x, ey = y;
      if (stroke.rotation) {
        const bb = anyStrokeBBox(stroke);
        const rcx = bb.x + bb.w / 2, rcy = bb.y + bb.h / 2;
        const cos = Math.cos(-stroke.rotation), sin = Math.sin(-stroke.rotation);
        const rdx = x - rcx, rdy = y - rcy;
        ex = rcx + rdx * cos - rdy * sin;
        ey = rcy + rdx * sin + rdy * cos;
      }
      // For combined strokes, test against overall bounding box
      if (stroke.subStrokes && stroke.subStrokes.length > 0) {
        const bb = anyStrokeBBox(stroke);
        if (ex >= bb.x - radius && ex <= bb.x + bb.w + radius && ey >= bb.y - radius && ey <= bb.y + bb.h + radius) {
          pendingEraseRef.current.add(stroke);
        }
        continue;
      }
      // For image strokes, test against bounding box
      if (stroke.imageId) {
        const a = stroke.points[0];
        const iw = stroke.imageW ?? 0, ih = stroke.imageH ?? 0;
        if (ex >= a.x - radius && ex <= a.x + iw + radius && ey >= a.y - radius && ey <= a.y + ih + radius) {
          hit = true;
        }
        if (hit) pendingEraseRef.current.add(stroke);
        continue;
      }
      // For text strokes, test against bounding box
      if (stroke.text) {
        const bb = textBBox(stroke);
        if (
          ex >= bb.x - radius &&
          ex <= bb.x + bb.w + radius &&
          ey >= bb.y - radius &&
          ey <= bb.y + bb.h + radius
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
        const dx = p.x - ex;
        const dy = p.y - ey;
        if (dx * dx + dy * dy < radius * radius) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          if (distToSegment(ex, ey, a.x, a.y, b.x, b.y) < radius) {
            hit = true;
            break;
          }
        }
      }
      // For filled shapes, also hit-test the interior via ray-casting
      if (!hit && stroke.fill && stroke.shape && stroke.shape !== "line" && stroke.shape !== "arrow") {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const xi = pts[i].x, yi = pts[i].y;
          const xj = pts[j].x, yj = pts[j].y;
          if ((yi > ey) !== (yj > ey) && ex < ((xj - xi) * (ey - yi)) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
        if (inside) hit = true;
      }
      if (hit) pendingEraseRef.current.add(stroke);
    }
  }, []);

  const handleImageDrop = useCallback(
    async (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const stashItemJson = e.dataTransfer.getData("drawtool/stash-item");
      if (stashItemJson) {
        try {
          const { strokes, savedDark } = JSON.parse(stashItemJson) as { strokes: Stroke[]; savedDark?: boolean };
          if (!strokes?.length) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          const currentIsDark = isDarkTheme(themeRef.current, customThemeBgRef.current);
          const needsColorSwap = savedDark !== undefined && savedDark !== currentIsDark;
          const swapColor = (c: string) => c === "#000000" ? "#ffffff" : c === "#ffffff" ? "#000000" : c;
          const maybeSwap = (c: string) => needsColorSwap ? swapColor(c) : c;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const s of strokes) {
            const bb = anyStrokeBBox(s);
            minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
            maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
          }
          const itemCx = (minX + maxX) / 2, itemCy = (minY + maxY) / 2;
          const view = viewRef.current;
          const dropWorld = screenToWorld(screenX, screenY, view);
          const dx = dropWorld.x - itemCx, dy = dropWorld.y - itemCy;
          const offset = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
          const newStrokes: Stroke[] = strokes.map((src) => ({
            ...src,
            color: maybeSwap(src.color),
            points: src.points.map(offset),
            widths: src.widths ? [...src.widths] : undefined,
            subStrokes: src.subStrokes?.map((ss) => ({ ...ss, color: maybeSwap(ss.color), points: ss.points.map(offset) })),
          }));
          strokesRef.current.push(...newStrokes);
          undoStackRef.current.push(
            newStrokes.length === 1
              ? { type: "draw", stroke: newStrokes[0] }
              : { type: "multi-draw", strokes: newStrokes },
          );
          redoStackRef.current = [];
          if (newStrokes.length === 1) {
            selectedTextRef.current = newStrokes[0];
            selectedGroupRef.current = [];
          } else {
            selectedGroupRef.current = newStrokes;
            selectedTextRef.current = null;
          }
          strokesCacheRef.current = null; strokesBBoxRef.current = null;
          setZCursor("default");
          persistStrokes();
          scheduleRedraw();
          window.dispatchEvent(new CustomEvent("drawtool:close-stash"));
        } catch { /* ignore malformed data */ }
        return;
      }

      let file: File | undefined = Array.from(e.dataTransfer.files).find((f) =>
        f.type.startsWith("image/"),
      );
      // iPadOS drag from Photos/Files populates items but not always files
      if (!file) {
        const item = Array.from(e.dataTransfer.items ?? []).find(
          (i) => i.kind === "file" && i.type.startsWith("image/"),
        );
        file = item?.getAsFile() ?? undefined;
      }
      if (!file) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      let result: { dataUrl: string; naturalW: number; naturalH: number };
      let id: string;
      try {
        result = await processImageFile(file);
        id = crypto.randomUUID();
        await storeImage(id, result.dataUrl);
      } catch {
        return;
      }
      const { naturalW, naturalH } = result;
      const view = viewRef.current;
      const MAX_SCREEN_W = 600;
      const worldW = Math.min(naturalW, MAX_SCREEN_W / view.scale);
      const worldH = naturalH * (worldW / naturalW);
      const worldCenter = screenToWorld(screenX, screenY, view);
      const anchor = { x: worldCenter.x - worldW / 2, y: worldCenter.y - worldH / 2 };
      const stroke: Stroke = {
        points: [anchor],
        style: "solid",
        lineWidth: 1,
        color: "#000000",
        imageId: id,
        imageW: worldW,
        imageH: worldH,
      };
      strokesRef.current.push(stroke);
      undoStackRef.current.push({ type: "draw", stroke });
      redoStackRef.current = [];
      selectedTextRef.current = stroke;
      selectedGroupRef.current = [];
      setZCursor("default");
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      persistStrokes();
      scheduleRedraw();
    },
    [scheduleRedraw, persistStrokes, setZCursor],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "pen") {
        penActiveRef.current = true;
        penHoverScreenRef.current = null;
      }
      if (e.pointerType === "touch") {
        if (penActiveRef.current) {
          ghostTouchIdsRef.current.add(e.pointerId); // track so it stays ignored after pen lifts
          return;
        }
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
        (spaceDownRef.current && e.button === 0) ||
        (e.button === 0 && (e.pointerType !== "pen" || !isTouchDevice) && leftClickToolRef.current === "pan") ||
        (e.button === 2 && rightClickToolRef.current === "pan")
      ) {
        // Skip pan activation when a line/arrow bend is in progress - clicks add bend points.
        const inBend =
          isDrawingRef.current &&
          (activeModifierRef.current === "line" ||
            (activeModifierRef.current === "shape" && keyShapeRef.current === "arrow"));
        if (!inBend) {
          // Mouse: middle-click, space+left-click, or click-tool pan = pan
          isPanningRef.current = true;
          panLastRef.current = { x: e.clientX, y: e.clientY };
          setPanning(true);
        }
      }
      shapeJustCommittedRef.current = false;
      // Re-evaluate dashed state for any in-progress hover shape at actual button press time.
      // Style is locked at hover creation and may be stale if shift state changed after hover started.
      if (e.button === 0 && isDrawingRef.current && activeModifierRef.current === "shape") {
        const stroke = strokesRef.current[strokesRef.current.length - 1];
        if (stroke?.shape) {
          // Key shapes track dashed via keyShapeDashedRef; modifier-only shapes use shiftHeldRef.
          const dashed = keyShapeRef.current ? keyShapeDashedRef.current : (shiftHeldRef.current || rightClickHeldRef.current);
          stroke.style = dashed ? "dashed" : "solid";
          if (!dashed) stroke.dashGap = undefined;
          stroke.fill = fKeyHeldRef.current ? shapeFillRef.current : undefined;
          if (stroke.fill) stroke.fillOpacity = fillOpacityRef.current / 100;
        }
      }
      if (e.button === 0 || e.button === 2) pointerButtonDownRef.current = true;
      if (e.button === 2 && rightClickToolRef.current === "dashed") rightClickHeldRef.current = true;
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [cancelCurrentStroke],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "pen") penActiveRef.current = false;
      if (e.pointerType === "touch") {
        if (penActiveRef.current || ghostTouchIdsRef.current.has(e.pointerId)) {
          ghostTouchIdsRef.current.delete(e.pointerId);
          return;
        }
        pointersRef.current.delete(e.pointerId);
        // Check for three-finger tap (redo gesture)
        if (
          pointersRef.current.size === 2 &&
          threeFingerTapRef.current &&
          !threeFingerTapRef.current.moved
        ) {
          redo();
          threeFingerTapRef.current = null;
          suppressTouchStrokeRef.current = true;
        }
        if (pointersRef.current.size < 2) {
          // Check for two-finger tap (undo gesture)
          if (
            pointersRef.current.size === 1 &&
            twoFingerTapRef.current &&
            !twoFingerTapRef.current.moved
          ) {
            undo();
            suppressTouchStrokeRef.current = true;
          }
          twoFingerTapRef.current = null;
          threeFingerTapRef.current = null;
          pinchRef.current = null;
          persistView();
        }
        if (pointersRef.current.size === 0) {
          suppressTouchStrokeRef.current = false;
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
              strokesCacheRef.current = null; strokesBBoxRef.current = null;
              persistStrokes();
              window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
                detail: { shape: dot.shape, style: dot.style, color: dot.color, fill: dot.fill, text: dot.text, fontFamily: dot.fontFamily, sharp: dot.sharp, highlight: dot.highlight, spray: dot.spray, points: dot.points.length, dynamic: pressureSensitivityRef.current },
              }));
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
              strokesCacheRef.current = null; strokesBBoxRef.current = null;
              scheduleRedraw();
            }
            const _wasLaser = activeModifierRef.current === "laser";
            if (_wasLaser) {
              setLasering(false);
            }
            const _commitCandidate =
              activeModifierRef.current !== "alt" && activeModifierRef.current !== "laser"
                ? strokesRef.current[strokesRef.current.length - 1]
                : null;
            discardTinyShape();
            isDrawingRef.current = false;
            activeModifierRef.current = null;
            strokesCacheRef.current = null; strokesBBoxRef.current = null;
            persistStrokes();
            if (_wasLaser) {
              window.dispatchEvent(new Event("drawtool:laser-used"));
            } else if (_commitCandidate && strokesRef.current[strokesRef.current.length - 1] === _commitCandidate) {
              window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
                detail: { shape: _commitCandidate.shape, style: _commitCandidate.style, color: _commitCandidate.color, fill: _commitCandidate.fill, text: _commitCandidate.text, fontFamily: _commitCandidate.fontFamily, sharp: _commitCandidate.sharp, highlight: _commitCandidate.highlight, spray: _commitCandidate.spray, points: _commitCandidate.points.length, dynamic: pressureSensitivityRef.current },
              }));
            }
            scheduleRedraw();
          }
        }
        return;
      }
      // Mouse pointer up
      pointerButtonDownRef.current = false;
      if (e.button === 2) rightClickHeldRef.current = false;
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
        // Line bend: if Cmd+Shift still held on pointer up, freeze endpoint as a bend
        if (activeModifierRef.current === "line") {
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.shape === "line") {
            const lastPt = stroke.points[stroke.points.length - 1];
            stroke.points.push({ ...lastPt }); // trailing point for next segment
            strokesCacheRef.current = null; strokesBBoxRef.current = null;
            scheduleRedraw();
            return;
          }
        }
        // Arrow bend: if 'a' key is still held on pointer up, freeze current endpoint as a
        // bend and keep drawing instead of finalizing the stroke
        if (activeModifierRef.current === "shape" && keyShapeRef.current === "arrow") {
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.shape === "arrow") {
            const lastPt = stroke.points[stroke.points.length - 1];
            stroke.points.push({ ...lastPt }); // trailing point for the next segment
            strokesCacheRef.current = null; strokesBBoxRef.current = null;
            scheduleRedraw();
            return;
          }
        }
        if (activeModifierRef.current === "alt") {
          setErasing(false);
          confirmErase();
          strokesCacheRef.current = null; strokesBBoxRef.current = null;
          scheduleRedraw();
        }
        if (activeModifierRef.current === "shape") shapeJustCommittedRef.current = true;
        // Stop spray interval
        if (sprayIntervalRef.current) {
          clearInterval(sprayIntervalRef.current);
          sprayIntervalRef.current = null;
        }
        // Discard empty spray strokes
        if (activeModifierRef.current === "spray") {
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.spray && stroke.points.length === 0) {
            strokesRef.current.pop();
            undoStackRef.current.pop();
          }
        }
        const _wasLaser = activeModifierRef.current === "laser";
        const _commitCandidate =
          activeModifierRef.current !== "alt" && activeModifierRef.current !== "laser"
            ? strokesRef.current[strokesRef.current.length - 1]
            : null;
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
        strokesCacheRef.current = null; strokesBBoxRef.current = null;
        persistStrokes();
        // Apply any sync that was deferred to avoid disrupting the in-progress stroke
        const deferred = pendingSyncRef.current;
        pendingSyncRef.current = null;
        if (deferred) {
          strokesRef.current = deferred.strokes;
          strokesCacheRef.current = null; strokesBBoxRef.current = null;
          selectedTextRef.current = null;
          selectedGroupRef.current = [];
          undoStackRef.current = [];
          redoStackRef.current = [];
        }
        if (_wasLaser) {
          setLasering(false);
          window.dispatchEvent(new Event("drawtool:laser-used"));
        } else if (_commitCandidate && strokesRef.current[strokesRef.current.length - 1] === _commitCandidate) {
          window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
            detail: { shape: _commitCandidate.shape, style: _commitCandidate.style, color: _commitCandidate.color, fill: _commitCandidate.fill, text: _commitCandidate.text, fontFamily: _commitCandidate.fontFamily, sharp: _commitCandidate.sharp, highlight: _commitCandidate.highlight, spray: _commitCandidate.spray, dynamic: pressureSensitivityRef.current },
          }));
        }
        scheduleRedraw();
      }
    },
    [confirmErase, discardTinyShape, persistStrokes, persistView, scheduleRedraw, notifyColorUsed, setLasering, setErasing],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Apple Pencil hover (pressure=0 = pen near screen but not touching)
      // pressure===0 with no button = genuine hover (pencil near but not touching).
      // Guard against (e.buttons & 1): on some iPads the first pointermove after
      // contact reports pressure=0 even though the pencil is touching; treating that
      // as hover would silently drop the start of a hard-pressed stroke.
      if (e.pointerType === "pen" && e.pressure === 0 && (e.buttons & 1) === 0 && !isDrawingRef.current) {
        penHoverScreenRef.current = { x: e.clientX, y: e.clientY };
        scheduleRedraw();
        return;
      }
      if (e.pointerType === "pen" && penHoverScreenRef.current) {
        penHoverScreenRef.current = null;
      }
      // --- Multi-touch pan/zoom ---
      if (e.pointerType === "touch") {
        if (penActiveRef.current || ghostTouchIdsRef.current.has(e.pointerId)) return; // palm rejection
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
          strokesCacheRef.current = null; strokesBBoxRef.current = null;
          broadcastZoom();
          window.dispatchEvent(new CustomEvent("drawtool:user-zoom"));
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
        const dx = e.clientX - panLastRef.current.x;
        const dy = e.clientY - panLastRef.current.y;
        if (dx !== 0 || dy !== 0) {
          view.x += dx;
          view.y += dy;
          window.dispatchEvent(new Event("drawtool:panned"));
        }
        panLastRef.current = { x: e.clientX, y: e.clientY };
        scheduleRedraw();
        return;
      }

      // Track cursor world and screen positions for desktop dot placement and same-color glow
      if (e.pointerType !== "touch") {
        cursorWorldRef.current = screenToWorld(e.clientX, e.clientY, viewRef.current);
        lastCursorScreenRef.current = { x: e.clientX, y: e.clientY };
      }

      // Block all drawing/erasing while a stroke or group is selected, or in V-select mode
      if (selectedTextRef.current || selectedGroupRef.current.length > 0 || zKeyRef.current) {
        if (overSameColorRef.current) { overSameColorRef.current = false; setOverSameColor(false); }
        return;
      }

      // Same-color glow: read the single pixel under the cursor (O(1), throttled to ~20fps)
      // While drawing, always keep the glow on — the stroke renders under the tip and would
      // cause rapid on/off flickering if we let the pixel check run.
      if (isDrawingRef.current) {
        if (!overSameColorRef.current) { overSameColorRef.current = true; setOverSameColor(true); }
      } else if (e.pointerType !== "touch") {
        const now = performance.now();
        if (now - lastSameColorCheckRef.current > 50) {
          lastSameColorCheckRef.current = now;
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (ctx && canvas) {
            const rect = canvas.getBoundingClientRect();
            const dpr = dprRef.current;
            const cx = Math.round((e.clientX - rect.left) * dpr);
            const cy = Math.round((e.clientY - rect.top) * dpr);
            const px = ctx.getImageData(cx, cy, 1, 1).data;
            const col = lineColorRef.current;
            const ar = parseInt(col.slice(1, 3), 16);
            const ag = parseInt(col.slice(3, 5), 16);
            const ab = parseInt(col.slice(5, 7), 16);
            const same = sameColorFamily(ar, ag, ab, px[0], px[1], px[2]);
            if (same !== overSameColorRef.current) {
              overSameColorRef.current = same;
              setOverSameColor(same);
            }
          }
        }
      }

      // --- Determine modifier ---
      let modifier:
        | "meta"
        | "shift"
        | "alt"
        | "line"
        | "shape"
        | "highlight"
        | "laser"
        | "spray"
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
                        : tool === "laser"
                          ? "laser"
                          : tool === "spray"
                            ? "spray"
                            : null;
        }
      } else if (e.pointerType === "pen" && isTouchDevice) {
        // Apple Pencil on iPad: follow touchTool like a finger, but always draw in hand/select mode
        if ((e.buttons & 32) !== 0) {
          modifier = "alt"; // eraser button (Apple Pencil Pro squeeze / Wacom eraser tip)
        } else {
          const down = (e.buttons & 1) !== 0;
          if (!down) {
            modifier = null;
          } else {
            const tool = touchToolRef.current;
            modifier =
              tool === "dashed"
                ? "shift"
                : tool === "line"
                  ? "line"
                  : tool === "erase"
                    ? "alt"
                    : tool === "shape"
                      ? "shape"
                      : tool === "highlight"
                        ? "highlight"
                        : tool === "laser"
                          ? "laser"
                          : tool === "spray"
                            ? "spray"
                            : "meta"; // draw, hand, select, text → freehand
          }
        }
      } else {
        modifier = isZoomingRef.current
          ? null
          : spaceDownRef.current
          ? null
          : laserKeyRef.current
          ? "laser"
          : sprayKeyRef.current
          ? "spray"
          : highlightKeyRef.current
          ? "highlight"
          : keyShapeRef.current
            ? "shape"
            : (e.buttons & 32) !== 0
                ? "alt" // eraser button (stylus eraser tip)
                : e.altKey
                ? "alt"
                : cmdKey(e) && e.shiftKey
                    ? "line"
                    : cmdKey(e)
                      ? "meta"
                      : e.shiftKey
                        ? "shift"
                        : (e.buttons & 2) !== 0
                          ? (rightClickToolRef.current === "draw" ? "meta" : rightClickToolRef.current === "dashed" ? "shift" : rightClickToolRef.current === "laser" ? "laser" : rightClickToolRef.current === "erase" ? "alt" : null)
                          : (e.buttons & 1) !== 0
                            ? (leftClickToolRef.current === "draw" ? "meta" : leftClickToolRef.current === "dashed" ? "shift" : leftClickToolRef.current === "laser" ? "laser" : leftClickToolRef.current === "erase" ? "alt" : null)
                            : null;
      }

      if (readOnly) modifier = null;

      if (!modifier) {
        if (isDrawingRef.current) {
          if (activeModifierRef.current === "alt") {
            setErasing(false);
            confirmErase();
            strokesCacheRef.current = null; strokesBBoxRef.current = null;
            scheduleRedraw();
          }
          if (activeModifierRef.current === "laser") {
            setLasering(false);
          }
          if (sprayIntervalRef.current) {
            clearInterval(sprayIntervalRef.current);
            sprayIntervalRef.current = null;
          }
          const _commitCandidate =
            activeModifierRef.current !== "alt" && activeModifierRef.current !== "laser"
              ? strokesRef.current[strokesRef.current.length - 1]
              : null;
          discardTinyShape();
          // Discard tiny freehand strokes - catches phantom strokes from brief modifier-key holds
          if (activeModifierRef.current === "shift" || activeModifierRef.current === "meta") {
            const stroke = strokesRef.current[strokesRef.current.length - 1];
            if (stroke && !stroke.shape && !stroke.spray) {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              for (const p of stroke.points) {
                if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
              }
              const threshold = activeModifierRef.current === "meta" ? MIN_META_LENGTH : MIN_DASH_LENGTH;
              if (maxX - minX < threshold && maxY - minY < threshold) {
                strokesRef.current.pop();
                undoStackRef.current.pop();
              }
            }
          }
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null; strokesBBoxRef.current = null;
          persistStrokes();
          if (_commitCandidate && strokesRef.current[strokesRef.current.length - 1] === _commitCandidate) {
            window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
              detail: { shape: _commitCandidate.shape, style: _commitCandidate.style, color: _commitCandidate.color, fill: _commitCandidate.fill, text: _commitCandidate.text, fontFamily: _commitCandidate.fontFamily, sharp: _commitCandidate.sharp, highlight: _commitCandidate.highlight, spray: _commitCandidate.spray, dynamic: pressureSensitivityRef.current },
            }));
          }
          scheduleRedraw();
        }
        return;
      }

      const point = screenToWorld(e.clientX, e.clientY, viewRef.current);

      // Don't start new strokes with a lingering finger after a multi-finger undo/redo gesture.
      // The flag is cleared when the last finger lifts (pointersRef.size === 0).
      if (e.pointerType === "touch" && suppressTouchStrokeRef.current && !isDrawingRef.current) return;

      // Flush erase buffer when switching away from erasing
      if (modifier !== "alt" && activeModifierRef.current === "alt") {
        setErasing(false);
        confirmErase();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        strokesCacheRef.current = null; strokesBBoxRef.current = null;
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
          setLasering(true);
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
          const dashed = shapeDashedRef.current;
          const stroke: Stroke = {
            points: [point, { ...point }],
            style: dashed ? "dashed" : "solid",
            ...(dashed ? { dashGap } : {}),
            lineWidth,
            color: lineColor,
            shape: "line",
            ...(shapeCornersRef.current === "sharp" ? { sharp: true } : {}),
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          // For multi-segment: update last point
          if (current?.shape === "line") {
            current.points[current.points.length - 1] = point;
          } else {
            current.points[1] = point;
          }
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
          const isTouch = e.pointerType === "touch" || (e.pointerType === "pen" && isTouchDevice);
          const dashed = keyShapeRef.current ? keyShapeDashedRef.current : (isTouch ? shapeDashedRef.current : (shiftHeldRef.current || rightClickHeldRef.current));
          const fill = isTouch ? (shapeFillEnabledRef.current ? shapeFillRef.current : undefined) : (fKeyHeldRef.current ? shapeFillRef.current : undefined);
          const stroke: Stroke = {
            points: [point, { ...point }],
            style: dashed ? "dashed" : "solid",
            dashGap: dashed ? dashGap : undefined,
            lineWidth,
            color: lineColor,
            shape: keyShapeRef.current || activeShapeRef.current,
            ...(fill ? { fill, fillOpacity: fillOpacityRef.current / 100 } : {}),
            ...(pressureSensitivityRef.current
              ? { seed: Math.floor(Math.random() * 2 ** 31) }
              : {}),
            ...(shapeCornersRef.current === "sharp" ? { sharp: true } : {}),
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          // For arrows: update last point (supports multi-segment bend drawing)
          if (current?.shape === "arrow") {
            current.points[current.points.length - 1] = point;
          } else {
            current.points[1] = point;
          }
        }
        scheduleRedraw();
        return;
      }

      if (modifier === "spray") {
        const addSprayDots = (wx: number, wy: number) => {
          const current = strokesRef.current[strokesRef.current.length - 1];
          if (!current?.spray) return;
          const radius = lineWidthRef.current * 3;
          const count = Math.max(4, Math.round(lineWidthRef.current * 0.8));
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            current.points.push({ x: wx + Math.cos(angle) * r, y: wy + Math.sin(angle) * r });
          }
        };
        if (!isDrawingRef.current || activeModifierRef.current !== "spray") {
          notifyColorUsed(lineColor);
          isDrawingRef.current = true;
          activeModifierRef.current = "spray";
          const stroke: Stroke = {
            points: [],
            style: "solid",
            lineWidth,
            color: lineColor,
            spray: true,
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
          // Start interval for spraying when stationary
          if (sprayIntervalRef.current) clearInterval(sprayIntervalRef.current);
          sprayIntervalRef.current = setInterval(() => {
            if (!sprayKeyRef.current) {
              if (sprayIntervalRef.current) {
                clearInterval(sprayIntervalRef.current);
                sprayIntervalRef.current = null;
              }
              return;
            }
            addSprayDots(cursorWorldRef.current.x, cursorWorldRef.current.y);
            scheduleRedraw();
          }, 40);
        }
        addSprayDots(point.x, point.y);
        persistStrokesDebounced();
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
      setLasering,
      setErasing,
    ],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "pen") {
        penActiveRef.current = false;
        penHoverScreenRef.current = null;
        if (isDrawingRef.current) cancelCurrentStroke();
        return;
      }
      if (e.pointerType !== "touch") return;
      ghostTouchIdsRef.current.delete(e.pointerId);
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size === 0) {
        isPanningRef.current = false;
        pinchRef.current = null;
        twoFingerTapRef.current = null;
        threeFingerTapRef.current = null;
        tapStartRef.current = null;
        if (isDrawingRef.current) cancelCurrentStroke();
        // Clean up any in-progress selection drag state
        selectDragRef.current = null;
        groupDragRef.current = null;
        boxSelectRef.current = null;
        hoverTextRef.current = null;
      }
    },
    [cancelCurrentStroke],
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") return; // handled by pointerUp with capture
      if (e.pointerType === "pen") {
        penActiveRef.current = false;
        if (penHoverScreenRef.current) {
          penHoverScreenRef.current = null;
          scheduleRedraw();
        }
      }
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setPanning(false);
      }
      if (isDrawingRef.current) {
        if (activeModifierRef.current === "alt") {
          setErasing(false);
          cancelErase();
          return;
        }
        if (activeModifierRef.current === "shape") shapeJustCommittedRef.current = true;
        if (sprayIntervalRef.current) {
          clearInterval(sprayIntervalRef.current);
          sprayIntervalRef.current = null;
        }
        const _leaveLaser = activeModifierRef.current === "laser";
        const _leaveCandidate =
          !_leaveLaser
            ? strokesRef.current[strokesRef.current.length - 1]
            : null;
        discardTinyShape();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
        if (_leaveLaser) {
          setLasering(false);
          window.dispatchEvent(new Event("drawtool:laser-used"));
        } else if (_leaveCandidate && strokesRef.current[strokesRef.current.length - 1] === _leaveCandidate) {
          window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
            detail: { shape: _leaveCandidate.shape, style: _leaveCandidate.style, color: _leaveCandidate.color, fill: _leaveCandidate.fill, text: _leaveCandidate.text, fontFamily: _leaveCandidate.fontFamily, sharp: _leaveCandidate.sharp, highlight: _leaveCandidate.highlight, spray: _leaveCandidate.spray, points: _leaveCandidate.points.length, dynamic: pressureSensitivityRef.current },
          }));
        }
      }
      if (overSameColorRef.current) { overSameColorRef.current = false; setOverSameColor(false); }
    },
    [persistStrokes, cancelErase, discardTinyShape, setErasing, setLasering],
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
        window.dispatchEvent(new CustomEvent("drawtool:user-zoom"));
      } else {
        // Two-finger swipe on trackpad or mouse scroll = pan
        view.x -= e.deltaX;
        view.y -= e.deltaY;
        if (e.deltaX !== 0 || e.deltaY !== 0) {
          window.dispatchEvent(new Event("drawtool:panned"));
        }
      }
      strokesCacheRef.current = null; strokesBBoxRef.current = null;
      scheduleRedraw();
      persistView();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [scheduleRedraw, broadcastZoom, persistView]);

  const encodedColor = encodeURIComponent(lineColor);
  // Compute cursor vs background luminance contrast. If the cursor blends into the canvas
  // background (e.g. dark red on dark theme, light yellow on light theme) it appears dim
  // even when not near a same-color stroke - show a permanent halo in those cases so the
  // cursor URL is stable (no toggling) and always readable.
  const fgR = parseInt(lineColor.slice(1, 3), 16) / 255;
  const fgG = parseInt(lineColor.slice(3, 5), 16) / 255;
  const fgB = parseInt(lineColor.slice(5, 7), 16) / 255;
  const fgLum = 0.2126 * fgR + 0.7152 * fgG + 0.0722 * fgB;
  const bgHex = getBackgroundColor(theme, customThemeBg);
  const bgR = parseInt(bgHex.slice(1, 3), 16) / 255;
  const bgG = parseInt(bgHex.slice(3, 5), 16) / 255;
  const bgB = parseInt(bgHex.slice(5, 7), 16) / 255;
  const bgLum = 0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB;
  const _needsHalo = Math.abs(fgLum - bgLum) < 0.25 || overSameColor;
  const _haloCol = fgLum > 0.4 ? "black" : "white";
  // feMorphology dilate creates a solid, fully-opaque outline ring - unlike feDropShadow's
  // Gaussian fade, the border is uniform opacity so white-on-dark combos (red, blue, purple)
  // are as visible as black-on-light ones.
  const _of = _needsHalo ? `%3Cdefs%3E%3Cfilter id='o' x='-50%25' y='-50%25' width='200%25' height='200%25'%3E%3CfeMorphology operator='dilate' radius='1.5' result='d'/%3E%3CfeFlood flood-color='${_haloCol}' result='f'/%3E%3CfeComposite in='f' in2='d' operator='in' result='c'/%3E%3CfeComposite in='SourceGraphic' in2='c' operator='over'/%3E%3C/filter%3E%3C/defs%3E` : "";
  const _wo = _needsHalo ? "%3Cg filter='url(%23o)'%3E" : "";
  const _wc = _needsHalo ? "%3C/g%3E" : "";
  // Larger radius for semi-transparent cursors (highlight/spray): dilation finds max alpha,
  // so wider expansion compensates for the 0.4-opacity source producing a fainter outline.
  // filterUnits='userSpaceOnUse' with fixed px coords avoids objectBoundingBox making the
  // region too small for a short/thin bounding box like the highlight bar.
  const _sof = _needsHalo ? `%3Cdefs%3E%3Cfilter id='o' filterUnits='userSpaceOnUse' x='-6' y='-6' width='36' height='36'%3E%3CfeMorphology operator='dilate' radius='3' result='d'/%3E%3CfeFlood flood-color='${_haloCol}' result='f'/%3E%3CfeComposite in='f' in2='d' operator='in' result='c'/%3E%3CfeComposite in='SourceGraphic' in2='c' operator='over'/%3E%3C/filter%3E%3C/defs%3E` : "";
  const _sow = _needsHalo ? "%3Cg filter='url(%23o)'%3E" : "";
  const _soc = _needsHalo ? "%3C/g%3E" : "";
  const crosshairCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Cline x1='12' y1='4' x2='12' y2='20' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`;
  const eraserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='50%25' stop-color='%2389CFF0'/%3E%3Cstop offset='50%25' stop-color='%23FA8072'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='3' y='5' width='18' height='12' rx='2.5' transform='rotate(-25 12 11)' fill='url(%23g)' stroke='%23666' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`;
  const shapeCursors: Record<ShapeKind, string> = {
    line: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Cline x1='4' y1='20' x2='20' y2='4' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    rectangle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Crect x='4' y='4' width='16' height='16' fill='none' stroke='${encodedColor}' stroke-width='1.5'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    circle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Ccircle cx='12' cy='12' r='8' fill='none' stroke='${encodedColor}' stroke-width='1.5'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    triangle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Cpolygon points='12,4 20,20 4,20' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    star: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Cpolygon points='12,2 14.5,9 22,9 16,14 18.5,21 12,17 5.5,21 8,14 2,9 9.5,9' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    arrow: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Cline x1='4' y1='12' x2='18' y2='12' stroke='${encodedColor}' stroke-width='1.5'/%3E%3Cpolyline points='14,8 18,12 14,16' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    pentagon: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Cpolygon points='12,3 21,10 18,21 6,21 3,10' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    hexagon: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Cpolygon points='12,2 21,7 21,17 12,22 3,17 3,7' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    diamond: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_of}${_wo}%3Cpolygon points='12,2 22,12 12,22 2,12' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
    cloud: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E${_of}${_wo}%3Cpath d='M7.2 18 H16.8 C19.4 18 21.5 16.2 21.5 13.9 C21.5 11.9 20 10.3 18 10.1 C17.4 7.8 15.4 6.2 12.9 6.2 C10.7 6.2 8.8 7.5 8.0 9.5 C5.6 9.7 3.8 11.5 3.8 13.8 C3.8 16.2 5.6 18 7.2 18 Z' fill='none' stroke='${encodedColor}' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'/%3E${_wc}%3C/svg%3E") 12 12, crosshair`,
  };
  const highlightCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_sof}${_sow}%3Cline x1='4' y1='12' x2='20' y2='12' stroke='${encodedColor}' stroke-width='6' stroke-linecap='round' stroke-opacity='0.4'/%3E${_soc}%3C/svg%3E") 12 12, crosshair`;
  const laserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='4' fill='%23ff3030' fill-opacity='0.9'/%3E%3Ccircle cx='12' cy='12' r='7' fill='none' stroke='%23ff3030' stroke-width='1' stroke-opacity='0.4'/%3E%3C/svg%3E") 12 12, crosshair`;
  const sprayCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E${_sof}${_sow}%3Ccircle cx='2' cy='5' r='1.2' fill='${encodedColor}'/%3E%3Ccircle cx='1' cy='9' r='1' fill='${encodedColor}'/%3E%3Ccircle cx='2.5' cy='13' r='1' fill='${encodedColor}'/%3E%3Cg transform='rotate(-12 12 14)'%3E%3Crect x='8' y='9' width='9' height='11' rx='2' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3Crect x='10' y='5' width='5' height='4' rx='1' fill='none' stroke='${encodedColor}' stroke-width='1.5'/%3E%3Cline x1='10' y1='7' x2='6' y2='7' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/g%3E${_soc}%3C/svg%3E") 2 9, crosshair`;
  const cursor = zCursor !== null
      ? zCursor
      : panning
        ? "grabbing"
        : (readOnly && leftClickTool === "pan")
          ? "grab"
          : lasering
          ? laserCursor
          : spraying
            ? sprayCursor
            : erasing
              ? eraserCursor
              : highlighting
                ? highlightCursor
                : shapeActive
                  ? shapeCursors[keyShapeRef.current || activeShape]
                  : crosshairCursor;

  cursorRef.current = cursor;

  // Hidden textarea: captures all text input including mobile soft keyboard, IME, and paste.
  // The canvas continues to render all text visually - the textarea is purely an input sink.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const onInput = () => {
      if (!isWritingRef.current) return;
      const newText = ta.value;
      const prev = writingTextRef.current;
      // Keydown already handled this via replaceSelection + syncToTextarea (desktop and mobile with physical keyboard)
      if (newText === prev) return;
      textUndoRef.current.push(prev);
      textRedoRef.current = [];
      writingTextRef.current = newText;
      caretPosRef.current = ta.selectionEnd ?? newText.length;
      const ss = ta.selectionStart ?? caretPosRef.current;
      const se = ta.selectionEnd ?? caretPosRef.current;
      selectionAnchorRef.current = ss !== se ? ss : null;
      caretVisibleRef.current = true;
      scheduleRedraw();
    };

    const onSelChange = () => {
      if (!isWritingRef.current || document.activeElement !== ta) return;
      caretPosRef.current = ta.selectionEnd ?? 0;
      const ss = ta.selectionStart ?? caretPosRef.current;
      const se = ta.selectionEnd ?? caretPosRef.current;
      selectionAnchorRef.current = ss !== se ? ss : null;
      caretVisibleRef.current = true;
      scheduleRedraw();
    };

    // Track when writing started so onBlur can guard against the brief blur that fires
    // during desktop double-click (some browsers blur the textarea when the second click
    // lands on the canvas element behind it).
    let writingStartTime = 0;

    const onWriting = (ev: Event) => {
      if (!(ev as CustomEvent).detail) {
        ta.blur();
        return;
      }
      writingStartTime = Date.now();
      ta.value = writingTextRef.current;
      const anch = selectionAnchorRef.current;
      const caret = caretPosRef.current;
      ta.setSelectionRange(anch !== null ? Math.min(anch, caret) : caret, caret);
      // On iOS, ta.focus() was already called directly in the gesture handler (either
      // onTouchStartForText for new text, or onCanvasTouchEndForEdit for select-mode
      // editing). Calling focus() here - inside window.dispatchEvent, which is an
      // untrusted event on iOS - breaks user activation and causes the keyboard to
      // flash open then close. Skip on iOS; desktop always calls focus here.
      if (!isTouchDevice) {
        ta.focus();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (!isWritingRef.current) return;
      e.preventDefault();
      e.stopPropagation(); // prevent window paste handler from double-firing
      const pasted = e.clipboardData?.getData("text/plain");
      if (!pasted) return;
      const text = writingTextRef.current;
      const pos = caretPosRef.current;
      const anch = selectionAnchorRef.current;
      const selStart = anch !== null ? Math.min(anch, pos) : pos;
      const selEnd = anch !== null ? Math.max(anch, pos) : pos;
      textUndoRef.current.push(text);
      textRedoRef.current = [];
      writingTextRef.current = text.slice(0, selStart) + pasted + text.slice(selEnd);
      caretPosRef.current = selStart + pasted.length;
      selectionAnchorRef.current = null;
      caretVisibleRef.current = true;
      ta.value = writingTextRef.current;
      const c = caretPosRef.current;
      ta.setSelectionRange(c, c);
      scheduleRedraw();
    };

    // On touch devices the iOS soft keyboard "Done" button dismisses the keyboard by
    // blurring the textarea, but iOS also fires spurious blurs at unpredictable times
    // during the auto-focus lifecycle (when the browser naturally focuses the textarea
    // after a tap). Using blur as the commit signal is unreliable on touch. Instead we
    // detect keyboard dismissal via visualViewport resize (viewport grows when keyboard
    // closes) and ignore blur entirely on touch devices.
    //
    // On desktop: blur is reliable - guard only against the brief blur during double-click.
    const onBlur = () => {
      if (!isWritingRef.current) return;
      if (isTouchDevice) return;
      if (Date.now() - writingStartTime < 250) return;
      finishWritingRef.current();
    };

    // iOS/Android: keyboard dismissed = visual viewport height grows back.
    // 150px threshold ignores autocorrect suggestion bar micro-changes.
    // 1500ms startup guard: keyboard open animation ~300ms + close animation ~300ms
    // leaves a safety margin. Any iOS rejection of focus (opacity=0 element) causes
    // open+close in ~600ms; the guard prevents that from triggering finishWriting.
    // With opacity:0.01 on both textarea styles, iOS should keep keyboard open and
    // this guard only matters for genuine Done presses which happen after typing.
    let prevVVHeight = window.visualViewport?.height ?? 0;
    const onVVResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const h = vv.height;
      if (isWritingRef.current && h > prevVVHeight + 150 && Date.now() - writingStartTime > 1500) {
        finishWritingRef.current();
      }
      prevVVHeight = h;
    };

    // iOS text-tool mode: the textarea is a full-screen overlay, so the user's touch lands
    // directly on it. We add a NATIVE touchstart listener (not React synthetic) to call
    // ta.focus() and startWriting() at the earliest possible moment in the gesture -
    // before any React event delegation, before any custom event dispatch, guaranteed to
    // be inside iOS's user-activation window for keyboard opening.
    const onTouchStartForText = (e: TouchEvent) => {
      if (touchToolRef.current !== "text") return;
      if (isWritingRef.current) return; // already writing - a second tap, handled elsewhere
      const touch = e.touches[0];
      if (!touch) return;
      ta.focus(); // open iOS keyboard - native handler, definitely a user gesture
      const wp = screenToWorld(touch.clientX, touch.clientY, viewRef.current);
      startWritingRef.current(wp);
    };

    // Select-mode double-tap to edit. Detection is split across two native listeners:
    //
    // onCanvasTouchStartForEdit: records which text stroke was touched and its screen
    //   position, but does NOT act yet - we can't distinguish a tap from a drag at
    //   touchstart time, so any action here would also fire on drag-to-move.
    //
    // onCanvasTouchEndForEdit: checks whether the finger moved (drag) or barely moved
    //   (tap). Only on a tap does it run the double-tap logic. Calling ta.focus() inside
    //   touchend is still within iOS's user-activation window, so the keyboard opens.
    const canvas = canvasRef.current;
    // Stores the touchstart data for the current touch so touchend can check movement.
    let touchStartData: { clientX: number; clientY: number; hitStroke: Stroke } | null = null;

    const onCanvasTouchStartForEdit = (e: TouchEvent) => {
      touchStartData = null;
      if (touchToolRef.current === "text") return;
      if (isWritingRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const wp = screenToWorld(touch.clientX, touch.clientY, viewRef.current);
      const { scale } = viewRef.current;
      let hitStroke: Stroke | null = null;
      for (let i = strokesRef.current.length - 1; i >= 0; i--) {
        const s = strokesRef.current[i];
        if (!s.text || s.locked) continue;
        const bb = anyStrokeBBox(s);
        const pad = 8 / scale;
        if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
            wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
          hitStroke = s;
          break;
        }
      }
      if (!hitStroke) {
        lastTextTapRef.current = null; // touched empty canvas - clear stale state
        return;
      }
      touchStartData = { clientX: touch.clientX, clientY: touch.clientY, hitStroke };
    };

    const onCanvasTouchEndForEdit = (e: TouchEvent) => {
      const start = touchStartData;
      touchStartData = null;
      if (!start) return;
      if (touchToolRef.current === "text") return;
      if (isWritingRef.current) return;
      const changedTouch = e.changedTouches[0];
      if (!changedTouch) return;
      // If the finger moved more than ~10px it was a drag, not a tap - don't edit
      const dx = changedTouch.clientX - start.clientX;
      const dy = changedTouch.clientY - start.clientY;
      if (dx * dx + dy * dy > 10 * 10) {
        lastTextTapRef.current = null;
        return;
      }
      const { hitStroke } = start;
      const last = lastTextTapRef.current;
      const now = performance.now();
      if (last && last.stroke === hitStroke && now - last.time < 300) {
        // Double-tap confirmed - open keyboard in user-activation context and start editing
        const wp = screenToWorld(start.clientX, start.clientY, viewRef.current);
        ta.focus();
        startEditingStrokeRef.current(hitStroke, wp);
        lastTextTapRef.current = null;
      } else {
        // First tap on this stroke - seed the timer for the next tap
        lastTextTapRef.current = { time: now, stroke: hitStroke, count: 1 };
      }
    };

    ta.addEventListener("input", onInput);
    ta.addEventListener("paste", onPaste);
    ta.addEventListener("blur", onBlur);
    ta.addEventListener("touchstart", onTouchStartForText, { passive: true });
    if (canvas) canvas.addEventListener("touchstart", onCanvasTouchStartForEdit, { passive: true });
    if (canvas) canvas.addEventListener("touchend", onCanvasTouchEndForEdit, { passive: true });
    document.addEventListener("selectionchange", onSelChange);
    window.addEventListener("drawtool:writing", onWriting);
    if (isTouchDevice) window.visualViewport?.addEventListener("resize", onVVResize);
    return () => {
      ta.removeEventListener("input", onInput);
      ta.removeEventListener("paste", onPaste);
      ta.removeEventListener("blur", onBlur);
      ta.removeEventListener("touchstart", onTouchStartForText);
      if (canvas) canvas.removeEventListener("touchstart", onCanvasTouchStartForEdit);
      if (canvas) canvas.removeEventListener("touchend", onCanvasTouchEndForEdit);
      document.removeEventListener("selectionchange", onSelChange);
      window.removeEventListener("drawtool:writing", onWriting);
      if (isTouchDevice) window.visualViewport?.removeEventListener("resize", onVVResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleRedraw]);

  const {
    handlePointerDownForText,
    handlePointerMoveGuarded,
    handlePointerUpGuarded,
    lastLockedTapRef,
  } = useTextSelection(
    {
      writingTextRef, writingPosRef, writingBoldRef, writingItalicRef, writingAlignRef,
      textBoldRef, textItalicRef, textAlignRef,
      caretPosRef, caretVisibleRef, caretTimerRef, selectionAnchorRef,
      textUndoRef, textRedoRef, editingStrokeRef, editingOldTextRef,
      isWritingRef, strokesRef, undoStackRef, redoStackRef, strokesCacheRef,
      selectedTextRef, selectedGroupRef, selectDragRef, hoverTextRef, groupDragRef, boxSelectRef,
      zKeyRef, shiftHeldRef, touchToolRef, lastTextTapRef, lineColorRef, textSizeRef, fontFamilyRef, viewRef,
      finishWritingRef, startWritingRef, startEditingStrokeRef, lastCycleRef, textSelectDragAnchorRef, textareaRef,
    },
    {
      scheduleRedraw, persistStrokes, notifyColorUsed, setZCursor,
      onPointerDown, onPointerMove, onPointerUp,
    },
  );

  return (
    <>
      {/* Invisible input sink - captures keyboard input and IME.
          On touch devices in text mode: expands to a full-screen overlay so the user's tap
          goes directly to this element - iOS only shows the keyboard when the touch target IS
          the focused input. On desktop or non-text modes: 1×1px hidden. */}
      <textarea
        ref={textareaRef}
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="enter"
        onPointerDown={isTouchDevice ? (e) => {
          // Always registered on iOS: in text-tool mode the textarea is the tap target
          // (pointer-events:auto), so this fires for new text placement. In select mode
          // it fires while editing (pointer-events becomes auto during writing) - handles
          // cursor placement and Done/outside-tap commit without needing canvas to be target.
          handlePointerDownForText(e as unknown as Parameters<typeof handlePointerDownForText>[0]);
        } : undefined}
        style={isTouchDevice ? {
          // Always full-screen on iOS - iOS won't reliably open the keyboard for small
          // or corner-positioned elements even with explicit focus() in a gesture context.
          // pointerEvents: "auto" only in text-tool mode (where the overlay IS the tap target).
          // In all other modes: "none" so taps pass through to the canvas.
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.01, // must be >0: iOS won't open keyboard for opacity:0 elements
          pointerEvents: touchTool === "text" ? "auto" : "none",
          resize: "none",
          border: "none",
          padding: 0,
          overflow: "hidden",
          fontSize: 16, // prevents iOS auto-zoom on focus
          background: "transparent",
          color: "transparent",
          zIndex: 10, // above canvas, below toolbar (z-40)
        } : {
          position: "fixed",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0.01,
          pointerEvents: "none",
          resize: "none",
          border: "none",
          padding: 0,
          overflow: "hidden",
          fontSize: 16,
          color: "transparent",
          background: "transparent",
        }}
      />
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Drawing canvas"
        className="block touch-none select-none"
        style={{ cursor }}
        onPointerDown={(e) => {
          if (e.pointerType === "touch" || e.pointerType === "pen") {
            window.dispatchEvent(new Event("drawtool:close-menu"));
          }
          // Check if clicking a lock icon → unlock the stroke
          const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
          if (lockedIconPositionsRef.current.length > 0) {
            for (const icon of lockedIconPositionsRef.current) {
              const dx = wp.x - icon.wx, dy = wp.y - icon.wy;
              if (dx * dx + dy * dy <= icon.wr * icon.wr) {
                icon.stroke.locked = undefined;
                undoStackRef.current.push({ type: "lock", strokes: [icon.stroke], to: false });
                redoStackRef.current = [];
                if (lockedFlashTimerRef.current) { clearTimeout(lockedFlashTimerRef.current); lockedFlashTimerRef.current = null; }
                lockedFlashRef.current = null;
                strokesCacheRef.current = null;
                persistStrokes();
                scheduleRedraw();
                window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: "Unlocked" }));
                return;
              }
            }
          }
          // Check if clicking a locked stroke body (any tool mode) → flash its icon
          {
            const { scale } = viewRef.current;
            const pad = 3 / scale;
            for (let i = strokesRef.current.length - 1; i >= 0; i--) {
              const s = strokesRef.current[i];
              if (!s.locked) continue;
              const bb = anyStrokeBBox(s);
              if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
                  wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
                window.dispatchEvent(new CustomEvent("drawtool:locked-click", { detail: s }));
                break;
              }
            }
          }
          // When panning and not in any selection mode, bypass handlePointerDownForText so
          // the text double-click guard can't block pan initiation (e.g. cursor over a text
          // stroke right after a zoom). Must still go through handlePointerDownForText when
          // V is held or something is selected so selection logic runs normally.
          const inSelectMode = isWritingRef.current ||
            zKeyRef.current ||
            (isTouchDevice && touchToolRef.current === "select") ||
            selectedTextRef.current !== null ||
            selectedGroupRef.current.length > 0;
          const clickWillPan = !inSelectMode && (
            e.button === 1 ||
            (spaceDownRef.current && e.button === 0) ||
            (e.button === 0 && leftClickToolRef.current === "pan") ||
            (e.button === 2 && rightClickToolRef.current === "pan")
          );
          if (clickWillPan) {
            onPointerDown(e);
          } else {
            handlePointerDownForText(e);
          }
        }}
        onPointerMove={(e) => {
          const icons = lockedIconPositionsRef.current;
          if (icons.length > 0) {
            const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
            let hovered: Stroke | null = null;
            for (const icon of icons) {
              const dx = wp.x - icon.wx, dy = wp.y - icon.wy;
              if (dx * dx + dy * dy <= icon.wr * icon.wr) { hovered = icon.stroke; break; }
            }
            if (hovered !== lockedHoverRef.current) {
              lockedHoverRef.current = hovered;
              if (canvasRef.current) canvasRef.current.style.cursor = hovered ? "pointer" : cursorRef.current;
              scheduleRedraw();
            }
          } else if (lockedHoverRef.current !== null) {
            lockedHoverRef.current = null;
            if (canvasRef.current) canvasRef.current.style.cursor = cursorRef.current;
            scheduleRedraw();
          }
          handlePointerMoveGuarded(e);
        }}
        onPointerUp={handlePointerUpGuarded}
        onPointerCancel={onPointerCancel}
        onPointerLeave={(e) => {
          if (lockedHoverRef.current !== null) {
            lockedHoverRef.current = null;
            scheduleRedraw();
          }
          onPointerLeave(e);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={handleImageDrop}
      />
    </>
  );
}

export default memo(Canvas);
