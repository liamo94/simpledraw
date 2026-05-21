import { useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import type { TextAlign } from "./useSettings";
import type { Stroke, UndoAction, BBox } from "../canvas/types";
import {
  dispatchTextStyleSync, textBBox, anyStrokeBBox,
  screenToWorld, computeCaretPosFromClick,
  getBBoxMeasureCtx, buildFont, TEXT_SIZE_MAP, fontLineHeight,
} from "../canvas/geometry";
import type { TouchTool } from "../canvas/types";

// ─── Text selection helpers ────────────────────────────────────────────────────

function getWordBounds(text: string, pos: number): [number, number] {
  const isWord = (ch: string) => /\w/.test(ch);
  const atWord = (pos > 0 && isWord(text[pos - 1])) || (pos < text.length && isWord(text[pos]));
  if (atWord) {
    let start = pos, end = pos;
    while (start > 0 && isWord(text[start - 1])) start--;
    while (end < text.length && isWord(text[end])) end++;
    return [start, end];
  }
  // Not in a word — select adjacent non-whitespace token
  let start = pos, end = pos;
  while (start > 0 && text[start - 1] !== " " && text[start - 1] !== "\n") start--;
  while (end < text.length && text[end] !== " " && text[end] !== "\n") end++;
  if (start === end) end = Math.min(text.length, pos + 1);
  return [start, end];
}

function getLineBounds(text: string, pos: number): [number, number] {
  const start = text.lastIndexOf("\n", pos > 0 ? pos - 1 : 0) + 1;
  const endIdx = text.indexOf("\n", pos);
  return [start, endIdx === -1 ? text.length : endIdx];
}

// ─── Hit-testing helpers ───────────────────────────────────────────────────────

/** Returns the axis-aligned bounding box of a stroke after its rotation is applied. */
function rotatedAABB(stroke: Stroke): BBox {
  const bb = anyStrokeBBox(stroke);
  if (!stroke.rotation) return bb;
  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  const cos = Math.abs(Math.cos(stroke.rotation));
  const sin = Math.abs(Math.sin(stroke.rotation));
  const hw = bb.w / 2 * cos + bb.h / 2 * sin;
  const hh = bb.w / 2 * sin + bb.h / 2 * cos;
  return { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function segmentIntersectsRect(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  rx: number, ry: number, rx2: number, ry2: number,
): boolean {
  if (p1.x >= rx && p1.x <= rx2 && p1.y >= ry && p1.y <= ry2) return true;
  if (p2.x >= rx && p2.x <= rx2 && p2.y >= ry && p2.y <= ry2) return true;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  for (const [ex, ey, horiz] of [[rx, ry, false], [rx2, ry, false], [rx, ry, true], [rx, ry2, true]] as [number, number, boolean][]) {
    const t = horiz ? (ey - p1.y) / (dy || 1) : (ex - p1.x) / (dx || 1);
    if (t < 0 || t > 1 || (horiz && dy === 0) || (!horiz && dx === 0)) continue;
    const ix = p1.x + t * dx, iy = p1.y + t * dy;
    if (horiz ? (ix >= rx && ix <= rx2) : (iy >= ry && iy <= ry2)) return true;
  }
  return false;
}

/** Returns true if (wx, wy) hits the stroke. Arrow/line uses line-proximity; everything else uses bbox. */
export function hitTestStroke(stroke: Stroke, wx: number, wy: number, scale: number): boolean {
  if (stroke.subStrokes) return stroke.subStrokes.some(s => hitTestStroke(s, wx, wy, scale));
  if (stroke.points.length === 0) return false;
  // Un-rotate the test point into the stroke's local frame before testing
  if (stroke.rotation) {
    const bb = anyStrokeBBox(stroke);
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    const cos = Math.cos(-stroke.rotation), sin = Math.sin(-stroke.rotation);
    const dx = wx - cx, dy = wy - cy;
    wx = cx + dx * cos - dy * sin;
    wy = cy + dx * sin + dy * cos;
  }
  if ((stroke.shape === "arrow" || stroke.shape === "line") && stroke.points.length >= 2) {
    const threshold = 8 / scale;
    const pts = stroke.points;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(wx, wy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= threshold) return true;
    }
    return false;
  }
  const pad = 3 / scale;
  const bb = anyStrokeBBox(stroke);
  return wx >= bb.x - pad && wx <= bb.x + bb.w + pad &&
         wy >= bb.y - pad && wy <= bb.y + bb.h + pad;
}

// ─── Ref bag ──────────────────────────────────────────────────────────────────

export type TextSelectionRefs = {
  writingTextRef: MutableRefObject<string>;
  writingPosRef: MutableRefObject<{ x: number; y: number }>;
  writingBoldRef: MutableRefObject<boolean>;
  writingItalicRef: MutableRefObject<boolean>;
  writingAlignRef: MutableRefObject<TextAlign>;
  textBoldRef: MutableRefObject<boolean>;
  textItalicRef: MutableRefObject<boolean>;
  textAlignRef: MutableRefObject<TextAlign>;
  caretPosRef: MutableRefObject<number>;
  caretVisibleRef: MutableRefObject<boolean>;
  caretTimerRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  selectionAnchorRef: MutableRefObject<number | null>;
  textUndoRef: MutableRefObject<string[]>;
  textRedoRef: MutableRefObject<string[]>;
  editingStrokeRef: MutableRefObject<Stroke | null>;
  editingOldTextRef: MutableRefObject<string>;
  isWritingRef: MutableRefObject<boolean>;
  strokesRef: MutableRefObject<Stroke[]>;
  undoStackRef: MutableRefObject<UndoAction[]>;
  redoStackRef: MutableRefObject<UndoAction[]>;
  strokesCacheRef: MutableRefObject<{ canvas: HTMLCanvasElement; key: string } | null>;
  selectedTextRef: MutableRefObject<Stroke | null>;
  selectedGroupRef: MutableRefObject<Stroke[]>;
  selectDragRef: MutableRefObject<{
    mode: "move" | "corner" | "rotate";
    corner?: number;
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[];
    startScale: number;
    startRotation?: number;
    bbox: BBox;
    cycleHits?: Stroke[];
    pendingBend?: { segmentIdx: number };
    subStrokeStartPoints?: { x: number; y: number }[][];
    startLineWidth?: number;
    startSubLineWidths?: number[];
  } | null>;
  hoverTextRef: MutableRefObject<Stroke | null>;
  groupDragRef: MutableRefObject<{
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[][];
    subStrokeStartPoints?: { x: number; y: number }[][][];
  } | null>;
  boxSelectRef: MutableRefObject<{ start: { x: number; y: number }; end: { x: number; y: number }; containOnly?: boolean; clickHit?: Stroke; prevGroup?: Stroke[]; prevSingle?: Stroke | null } | null>;
  zKeyRef: MutableRefObject<boolean>;
  shiftHeldRef: MutableRefObject<boolean>;
  touchToolRef: MutableRefObject<TouchTool>;
  lastTextTapRef: MutableRefObject<{ time: number; stroke: Stroke; count: number } | null>;
  textareaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  lineColorRef: MutableRefObject<string>;
  textSizeRef: MutableRefObject<import("./useSettings").TextSize>;
  fontFamilyRef: MutableRefObject<import("./useSettings").FontFamily>;
  viewRef: MutableRefObject<{ x: number; y: number; scale: number }>;
  finishWritingRef: MutableRefObject<() => void>;
  startWritingRef: MutableRefObject<(pos: { x: number; y: number }) => void>;
  lastCycleRef: MutableRefObject<{ selectedStroke: Stroke; hits: Stroke[] } | null>;
  textSelectDragAnchorRef: MutableRefObject<number | null>;
};

// ─── Callback bag ─────────────────────────────────────────────────────────────

export type TextSelectionCallbacks = {
  scheduleRedraw: () => void;
  persistStrokes: () => void;
  notifyColorUsed: (color: string) => void;
  setZCursor: (cursor: string | null) => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTextSelection(refs: TextSelectionRefs, callbacks: TextSelectionCallbacks) {
  const {
    writingTextRef, writingPosRef, writingBoldRef, writingItalicRef, writingAlignRef,
    textBoldRef, textItalicRef, textAlignRef,
    caretPosRef, caretVisibleRef, caretTimerRef, selectionAnchorRef,
    textUndoRef, textRedoRef, editingStrokeRef, editingOldTextRef,
    isWritingRef, strokesRef, undoStackRef, redoStackRef, strokesCacheRef,
    selectedTextRef, selectedGroupRef, selectDragRef, hoverTextRef, groupDragRef, boxSelectRef,
    zKeyRef, shiftHeldRef, touchToolRef, lastTextTapRef, lineColorRef, textSizeRef, fontFamilyRef, viewRef,
    finishWritingRef, startWritingRef, lastCycleRef, textSelectDragAnchorRef, textareaRef,
  } = refs;

  const lastLockedTapRef = useRef<{ time: number; stroke: Stroke } | null>(null);

  const {
    scheduleRedraw, persistStrokes, notifyColorUsed, setZCursor,
    onPointerDown, onPointerMove, onPointerUp,
  } = callbacks;

  const finishWriting = useCallback(() => {
    const raw = writingTextRef.current;
    if (editingStrokeRef.current) {
      // Editing an existing stroke in-place
      const stroke = editingStrokeRef.current;
      const oldText = editingOldTextRef.current;
      const newText = raw.trim() ? raw : oldText; // revert to old text if cleared
      if (newText !== oldText) {
        stroke.text = newText;
        undoStackRef.current.push({ type: "edit", stroke, oldText, newText });
        redoStackRef.current = [];
        persistStrokes();
      }
      editingStrokeRef.current = null;
      editingOldTextRef.current = "";
      strokesCacheRef.current = null;
      // Re-select the stroke after editing
      selectedTextRef.current = stroke;
      selectedGroupRef.current = [];
      setZCursor("default");
      dispatchTextStyleSync(stroke.bold ?? false, stroke.italic ?? false, stroke.textAlign ?? "left");
      window.dispatchEvent(new Event("drawtool:text-placed"));
    } else if (raw.trim()) {
      notifyColorUsed(lineColorRef.current);
      const stroke: Stroke = {
        points: [{ ...writingPosRef.current }],
        style: "solid",
        lineWidth: 1,
        color: lineColorRef.current,
        text: raw,
        fontSize: textSizeRef.current,
        fontFamily: fontFamilyRef.current,
        bold: writingBoldRef.current || undefined,
        italic: writingItalicRef.current || undefined,
        textAlign: writingAlignRef.current !== "left" ? writingAlignRef.current : undefined,
      };
      strokesRef.current.push(stroke);
      undoStackRef.current.push({ type: "draw", stroke });
      redoStackRef.current = [];
      strokesCacheRef.current = null;
      persistStrokes();
      window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
        detail: { shape: stroke.shape, style: stroke.style, color: stroke.color, fill: stroke.fill, text: stroke.text, fontFamily: stroke.fontFamily, sharp: stroke.sharp, highlight: stroke.highlight, spray: stroke.spray, points: stroke.points.length },
      }));
      // Auto-select the new text stroke
      selectedTextRef.current = stroke;
      selectedGroupRef.current = [];
      setZCursor("default");
      dispatchTextStyleSync(stroke.bold ?? false, stroke.italic ?? false, stroke.textAlign ?? "left");
      window.dispatchEvent(new Event("drawtool:text-placed"));
    } else {
      setZCursor(zKeyRef.current ? "default" : null);
    }
    writingTextRef.current = "";
    caretPosRef.current = 0;
    selectionAnchorRef.current = null;
    if (caretTimerRef.current) {
      clearInterval(caretTimerRef.current);
      caretTimerRef.current = null;
    }
    isWritingRef.current = false;
    window.dispatchEvent(new CustomEvent("drawtool:writing", { detail: false }));
    scheduleRedraw();
  }, [persistStrokes, scheduleRedraw, notifyColorUsed, setZCursor]);

  const startWriting = useCallback((worldPos: { x: number; y: number }) => {
    // Offset anchor left so the first character appears centered on the click point.
    // Only applies to left-aligned text; center/right already anchor at the click naturally.
    const basePx = TEXT_SIZE_MAP[textSizeRef.current];
    let xOffset = 0;
    if (textAlignRef.current === "left") {
      const mCtx = getBBoxMeasureCtx();
      if (mCtx) {
        mCtx.font = buildFont(basePx, textBoldRef.current, textItalicRef.current, fontFamilyRef.current);
        xOffset = mCtx.measureText("n").width * 0.5;
      }
    }
    const yOffset = fontLineHeight(basePx, fontFamilyRef.current) * 0.5;
    writingPosRef.current = { x: worldPos.x - xOffset, y: worldPos.y - yOffset };
    writingTextRef.current = "";
    caretPosRef.current = 0;
    selectionAnchorRef.current = null;
    writingBoldRef.current = textBoldRef.current;
    writingItalicRef.current = textItalicRef.current;
    writingAlignRef.current = textAlignRef.current;
    textUndoRef.current = [];
    textRedoRef.current = [];
    caretVisibleRef.current = true;
    if (caretTimerRef.current) clearInterval(caretTimerRef.current);
    caretTimerRef.current = setInterval(() => {
      caretVisibleRef.current = !caretVisibleRef.current;
      scheduleRedraw();
    }, 530);
    isWritingRef.current = true;
    window.dispatchEvent(new CustomEvent("drawtool:writing", { detail: true }));
    setZCursor("text");
    scheduleRedraw();
  }, [scheduleRedraw, setZCursor]);

  const startEditingStroke = useCallback((stroke: Stroke, clickWorldPos?: { x: number; y: number }, selectAll?: boolean) => {
    const text = stroke.text ?? "";
    const anchor = stroke.points[0];

    let caretPos = text.length;
    let selAnchor: number | null = null;
    if (selectAll) {
      caretPos = text.length;
      selAnchor = 0;
    } else if (clickWorldPos) {
      caretPos = computeCaretPosFromClick(stroke, clickWorldPos);
    }

    editingStrokeRef.current = stroke;
    editingOldTextRef.current = text;
    writingBoldRef.current = stroke.bold ?? false;
    writingItalicRef.current = stroke.italic ?? false;
    writingAlignRef.current = stroke.textAlign ?? "left";
    textUndoRef.current = [];
    textRedoRef.current = [];
    writingPosRef.current = { ...anchor };
    writingTextRef.current = text;
    caretPosRef.current = caretPos;
    selectionAnchorRef.current = selAnchor;
    caretVisibleRef.current = true;
    if (caretTimerRef.current) clearInterval(caretTimerRef.current);
    caretTimerRef.current = setInterval(() => {
      caretVisibleRef.current = !caretVisibleRef.current;
      scheduleRedraw();
    }, 530);
    isWritingRef.current = true;
    window.dispatchEvent(new CustomEvent("drawtool:writing", { detail: true }));
    selectedTextRef.current = null;
    selectedGroupRef.current = [];
    selectDragRef.current = null;
    strokesCacheRef.current = null;
    setZCursor("text");
    scheduleRedraw();
  }, [scheduleRedraw, setZCursor]);

  // Keep refs in sync (used by the keyboard handler hook)
  finishWritingRef.current = finishWriting;
  startWritingRef.current = startWriting;

  // Touch: tap canvas to place text when text tool is active
  const handlePointerDownForText = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isWritingRef.current) {
        const editStroke = editingStrokeRef.current;
        if (editStroke) {
          const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
          const bb = textBBox(editStroke);
          const pad = 8 / viewRef.current.scale;
          if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
              wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
            const now = performance.now();
            const last = lastTextTapRef.current;
            const isQuick = last !== null && last.stroke === editStroke && now - last.time < 400;
            const count = isQuick ? Math.min(last.count + 1, 3) : 1;
            const clickPos = computeCaretPosFromClick(editStroke, wp);
            const text = editStroke.text ?? "";
            lastTextTapRef.current = { time: now, stroke: editStroke, count };

            if (count === 2) {
              // Double-click → select word
              const [wordStart, wordEnd] = getWordBounds(text, clickPos);
              selectionAnchorRef.current = wordStart;
              caretPosRef.current = wordEnd;
              textSelectDragAnchorRef.current = null;
            } else if (count === 3) {
              // Triple-click → select line
              const [lineStart, lineEnd] = getLineBounds(text, clickPos);
              selectionAnchorRef.current = lineStart;
              caretPosRef.current = lineEnd;
              textSelectDragAnchorRef.current = null;
            } else {
              // Single click → place cursor and start drag-select
              caretPosRef.current = clickPos;
              selectionAnchorRef.current = null;
              textSelectDragAnchorRef.current = clickPos;
              (e.target as Element).setPointerCapture(e.pointerId);
            }
            // Sync selection to textarea so Cmd+C etc. work on the right range
            const ta = textareaRef?.current;
            if (ta) {
              const anch = selectionAnchorRef.current;
              const caret = caretPosRef.current;
              ta.setSelectionRange(anch !== null ? Math.min(anch, caret) : caret, caret);
            }
            caretVisibleRef.current = true;
            scheduleRedraw();
            return;
          }
        }
        finishWriting();
        return;
      }
      if (touchToolRef.current === "text") {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        startWriting(wp);
        return;
      }

      // Double-click on text = enter edit mode (mouse/stylus, no z key needed)
      // Only guard when nothing is selected — if something is selected, let the selection-switch logic run.
      if (e.pointerType !== "touch" && !zKeyRef.current && !selectedTextRef.current) {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const { scale } = viewRef.current;
        const pad = 3 / scale;
        for (let i = strokesRef.current.length - 1; i >= 0; i--) {
          const stroke = strokesRef.current[i];
          if (!stroke.text) continue;
          const bb = textBBox(stroke);
          if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
              wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
            const now = performance.now();
            const last = lastTextTapRef.current;
            if (last && last.stroke === stroke && now - last.time < 300) {
              lastTextTapRef.current = null;
              startEditingStroke(stroke, undefined, true);
              return;
            }
            lastTextTapRef.current = { time: now, stroke, count: 1 };
            return; // block drawing on first tap — wait for potential double-click
          }
        }
        lastTextTapRef.current = null;
      }

      // Shift+click (no V): toggle stroke in/out of group selection, only when something is already selected
      const hasExistingSelection = selectedGroupRef.current.length > 0 || selectedTextRef.current !== null;
      if (e.shiftKey && !zKeyRef.current && e.pointerType !== "touch" && hasExistingSelection) {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const { scale } = viewRef.current;
        let hit: Stroke | null = null;
        for (let i = strokesRef.current.length - 1; i >= 0; i--) {
          if (!strokesRef.current[i].locked && hitTestStroke(strokesRef.current[i], wp.x, wp.y, scale)) { hit = strokesRef.current[i]; break; }
        }
        if (hit) {
          const current = selectedGroupRef.current.length > 0
            ? [...selectedGroupRef.current]
            : selectedTextRef.current ? [selectedTextRef.current] : [];
          const idx = current.indexOf(hit);
          const newGroup = idx >= 0 ? current.filter(s => s !== hit) : [...current, hit];
          selectedGroupRef.current = newGroup;
          selectedTextRef.current = null;
          selectDragRef.current = null;
          (e.target as Element).setPointerCapture(e.pointerId);
          scheduleRedraw();
          return;
        }
      }

      // In select mode: double-click a locked stroke to unlock it immediately
      if ((zKeyRef.current || touchToolRef.current === "select") && e.pointerType !== "touch") {
        const wp2 = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const scale2 = viewRef.current.scale;
        let lockedHit: Stroke | null = null;
        for (let i = strokesRef.current.length - 1; i >= 0; i--) {
          const s = strokesRef.current[i];
          if (s.locked && hitTestStroke(s, wp2.x, wp2.y, scale2)) { lockedHit = s; break; }
        }
        if (lockedHit) {
          const now = performance.now();
          const last = lastLockedTapRef.current;
          if (last && last.stroke === lockedHit && now - last.time < 400) {
            lastLockedTapRef.current = null;
            lockedHit.locked = undefined;
            undoStackRef.current.push({ type: "lock", strokes: [lockedHit], to: false });
            redoStackRef.current = [];
            selectedTextRef.current = lockedHit;
            selectedGroupRef.current = [];
            hoverTextRef.current = null;
            lastCycleRef.current = null;
            selectDragRef.current = {
              mode: "move",
              startPtr: { ...wp2 },
              startPoints: lockedHit.points.map(p => ({ ...p })),
              startScale: lockedHit.fontScale ?? 1,
              bbox: anyStrokeBBox(lockedHit),
              subStrokeStartPoints: lockedHit.subStrokes?.map(s => s.points.map(p => ({ ...p }))),
            };
            strokesCacheRef.current = null;
            persistStrokes();
            setZCursor("default");
            scheduleRedraw();
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
          }
          lastLockedTapRef.current = { time: now, stroke: lockedHit };
          return;
        }
      }

      // Shift+V: always start a containment box select so dragging inside a large element works.
      // Click-toggle (tiny drag) is resolved on pointerup via clickHit.
      // Don't clear selection on pointerdown — preserve it so click-toggle can build on it.
      if (zKeyRef.current && e.shiftKey && e.pointerType !== "touch") {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const { scale } = viewRef.current;
        let clickHit: Stroke | null = null;
        for (let i = strokesRef.current.length - 1; i >= 0; i--) {
          const s = strokesRef.current[i];
          if (!s.locked && hitTestStroke(s, wp.x, wp.y, scale)) { clickHit = s; break; }
        }
        boxSelectRef.current = {
          start: { ...wp }, end: { ...wp }, containOnly: true,
          clickHit: clickHit ?? undefined,
          prevGroup: [...selectedGroupRef.current],
          prevSingle: selectedTextRef.current,
        };
        selectDragRef.current = null;
        hoverTextRef.current = null;
        (e.target as Element).setPointerCapture(e.pointerId);
        scheduleRedraw();
        return;
      }

      // Group move: if a group is selected, check if pointer is inside combined bbox
      if (selectedGroupRef.current.length > 0 && (e.pointerType !== "touch" || touchToolRef.current === "select")) {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const { scale } = viewRef.current;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of selectedGroupRef.current) {
          const bb = anyStrokeBBox(s);
          minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
          maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
        }
        const pad = 8 / scale;
        if (wp.x >= minX - pad && wp.x <= maxX + pad && wp.y >= minY - pad && wp.y <= maxY + pad) {
          groupDragRef.current = {
            startPtr: { ...wp },
            startPoints: selectedGroupRef.current.map(s => s.points.map(p => ({ ...p }))),
            subStrokeStartPoints: selectedGroupRef.current.some(s => s.subStrokes)
              ? selectedGroupRef.current.map(s => s.subStrokes?.map(sub => sub.points.map(p => ({ ...p }))) ?? [])
              : undefined,
          };
          (e.target as Element).setPointerCapture(e.pointerId);
          scheduleRedraw();
          return;
        } else {
          // Click outside group — clear group selection
          // Hit-test at the actual click position rather than using (potentially stale) hoverTextRef
          let hitOnClear: Stroke | null = null;
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            if (!strokesRef.current[i].locked && hitTestStroke(strokesRef.current[i], wp.x, wp.y, scale)) { hitOnClear = strokesRef.current[i]; break; }
          }
          selectedGroupRef.current = [];
          groupDragRef.current = null;
          hoverTextRef.current = null;
          lastCycleRef.current = null;
          strokesCacheRef.current = null;
          if (!zKeyRef.current) {
            if (hitOnClear) {
              selectedTextRef.current = hitOnClear;
              selectDragRef.current = {
                mode: "move",
                startPtr: { ...wp },
                startPoints: hitOnClear.points.map(p => ({ ...p })),
                startScale: hitOnClear.fontScale ?? 1,
                bbox: anyStrokeBBox(hitOnClear),
                subStrokeStartPoints: hitOnClear.subStrokes?.map(s => s.points.map(p => ({ ...p }))),
              };
              dispatchTextStyleSync(hitOnClear.bold ?? false, hitOnClear.italic ?? false, hitOnClear.textAlign ?? "left");
              setZCursor("default");
              (e.target as Element).setPointerCapture(e.pointerId);
            } else {
              setZCursor(null);
            }
            scheduleRedraw();
            return;
          }
          setZCursor("default");
          scheduleRedraw();
        }
      }

      // Text select / move / resize mode (mouse/stylus, z held or already selected, or touch select tool)
      if ((selectedTextRef.current || zKeyRef.current) && (e.pointerType !== "touch" || touchToolRef.current === "select")) {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const { scale } = viewRef.current;
        const pad = 3 / scale;
        const hs = 7 / scale;

        if (selectedTextRef.current) {
          const bb = anyStrokeBBox(selectedTextRef.current);
          const selShape = selectedTextRef.current.shape;
          const strokeRotation = selectedTextRef.current.rotation ?? 0;
          // For rotated strokes, un-rotate the hit point into the stroke's local frame
          let twp = wp;
          if (strokeRotation) {
            const rcx = bb.x + bb.w / 2, rcy = bb.y + bb.h / 2;
            const cos = Math.cos(-strokeRotation), sin = Math.sin(-strokeRotation);
            const dx = wp.x - rcx, dy = wp.y - rcy;
            twp = { x: rcx + dx * cos - dy * sin, y: rcy + dx * sin + dy * cos };
          }
          // Check rotate handle first (all types except arrows/lines)
          if (selShape !== "arrow" && selShape !== "line") {
            const rotPad = 3 / scale;
            const handleOffset = 28 / scale;
            const rotHs = 7 / scale;
            const handleX = bb.x + bb.w / 2;
            const handleY = bb.y - rotPad - handleOffset;
            if (Math.hypot(twp.x - handleX, twp.y - handleY) <= rotHs) {
              selectDragRef.current = {
                mode: "rotate",
                startPtr: { ...wp },
                startPoints: [],
                startScale: 1,
                startRotation: strokeRotation,
                bbox: bb,
              };
              (e.target as Element).setPointerCapture(e.pointerId);
              return;
            }
          }
          // Check handles for all stroke types (shapes, text, images, and freehand)
          if (selShape || selectedTextRef.current.text || selectedTextRef.current.imageId || (!selShape && !selectedTextRef.current.text && !selectedTextRef.current.imageId)) {
            if (selShape === "arrow" || selShape === "line") {
              const pts = selectedTextRef.current.points;
              const n = pts.length;
              if (n === 2) {
                // 2-point: 3 inline handles — start (0), mid (1), end (2)
                const p0 = pts[0], p1 = pts[1];
                const handles = [p0, { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, p1];
                for (let ci = 0; ci < 3; ci++) {
                  const hh = handles[ci];
                  if (Math.hypot(wp.x - hh.x, wp.y - hh.y) <= hs) {
                    selectDragRef.current = {
                      mode: "corner",
                      corner: ci,
                      startPtr: { ...wp },
                      startPoints: pts.map(p => ({ ...p })),
                      startScale: 1,
                      bbox: bb,
                    };
                    (e.target as Element).setPointerCapture(e.pointerId);
                    return;
                  }
                }
              } else {
                // N-point: handle at each actual point
                for (let ci = 0; ci < n; ci++) {
                  if (Math.hypot(wp.x - pts[ci].x, wp.y - pts[ci].y) <= hs) {
                    selectDragRef.current = {
                      mode: "corner",
                      corner: ci,
                      startPtr: { ...wp },
                      startPoints: pts.map(p => ({ ...p })),
                      startScale: 1,
                      bbox: bb,
                    };
                    (e.target as Element).setPointerCapture(e.pointerId);
                    return;
                  }
                }
              }
            } else {
              const cornerCenters = [
                { x: bb.x - pad,        y: bb.y - pad },
                { x: bb.x + bb.w + pad, y: bb.y - pad },
                { x: bb.x + bb.w + pad, y: bb.y + bb.h + pad },
                { x: bb.x - pad,        y: bb.y + bb.h + pad },
              ];
              for (let ci = 0; ci < 4; ci++) {
                const cc = cornerCenters[ci];
                if (Math.abs(twp.x - cc.x) <= hs + pad && Math.abs(twp.y - cc.y) <= hs + pad) {
                  selectDragRef.current = {
                    mode: "corner",
                    corner: ci,
                    startPtr: { ...wp },
                    startPoints: selectedTextRef.current.points.map(p => ({ ...p })),
                    startScale: selectedTextRef.current.fontScale ?? 1,
                    bbox: bb,
                    subStrokeStartPoints: selectedTextRef.current.subStrokes?.map(s => s.points.map(p => ({ ...p }))),
                    startLineWidth: selectedTextRef.current.lineWidth,
                    startSubLineWidths: selectedTextRef.current.subStrokes?.map(s => s.lineWidth),
                  };
                  (e.target as Element).setPointerCapture(e.pointerId);
                  return;
                }
              }
            }
          }
          // Check body — drag current stroke; for arrows, defer click-to-add-bend to pointer up
          if (hitTestStroke(selectedTextRef.current, wp.x, wp.y, scale)) {
            const curStroke = selectedTextRef.current;
            // Double-click on selected text stroke → enter edit mode
            if (curStroke.text) {
              const now = performance.now();
              const last = lastTextTapRef.current;
              if (last && last.stroke === curStroke && now - last.time < 300) {
                lastTextTapRef.current = null;
                startEditingStroke(curStroke, undefined, true);
                return;
              }
              lastTextTapRef.current = { time: now, stroke: curStroke, count: 1 };
            }
            const isArrow = curStroke.shape === "arrow" || curStroke.shape === "line";
            let pendingBend: { segmentIdx: number } | undefined;
            if (isArrow) {
              // Find which segment was clicked (for deferred bend insertion on pointer up)
              let bestSeg = -1, bestDist = Infinity;
              const pts = curStroke.points;
              for (let i = 0; i < pts.length - 1; i++) {
                const d = distToSegment(wp.x, wp.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
                if (d < bestDist) { bestDist = d; bestSeg = i; }
              }
              pendingBend = bestSeg >= 0 ? { segmentIdx: bestSeg } : undefined;
            }
            // Collect all hits for non-arrow strokes (deferred click-to-cycle)
            const allHits: Stroke[] = [];
            if (!isArrow) {
              for (let i = strokesRef.current.length - 1; i >= 0; i--) {
                const s = strokesRef.current[i];
                if (hitTestStroke(s, wp.x, wp.y, scale)) allHits.push(s);
              }
              // Merge in any persisted cycle strokes (e.g. a small dot that wasn't
              // hit at this exact click position but was hit when first selected).
              const lc = lastCycleRef.current;
              if (lc?.selectedStroke === curStroke) {
                for (const s of lc.hits) {
                  if (!allHits.includes(s) && strokesRef.current.includes(s)) {
                    allHits.push(s);
                  }
                }
                allHits.sort((a, b) => strokesRef.current.indexOf(b) - strokesRef.current.indexOf(a));
              }
            }
            selectDragRef.current = {
              mode: "move",
              startPtr: { ...wp },
              startPoints: curStroke.points.map(p => ({ ...p })),
              startScale: curStroke.fontScale ?? 1,
              bbox: bb,
              cycleHits: allHits.length > 1 ? allHits : undefined,
              pendingBend,
              subStrokeStartPoints: curStroke.subStrokes?.map(s => s.points.map(p => ({ ...p }))),
            };
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
          }
          // Clicked elsewhere — check if a different stroke was hit
          let newSel: Stroke | null = null;
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            const stroke = strokesRef.current[i];
            if (stroke === selectedTextRef.current) continue;
            if (stroke.locked) continue;
            if (hitTestStroke(stroke, wp.x, wp.y, scale)) { newSel = stroke; break; }
          }
          if (newSel) {
            selectedTextRef.current = newSel;
            selectedGroupRef.current = [];
            hoverTextRef.current = null;
            selectDragRef.current = {
              mode: "move",
              startPtr: { ...wp },
              startPoints: newSel.points.map(p => ({ ...p })),
              startScale: newSel.fontScale ?? 1,
              bbox: anyStrokeBBox(newSel),
              subStrokeStartPoints: newSel.subStrokes?.map(s => s.points.map(p => ({ ...p }))),
            };
            dispatchTextStyleSync(newSel.bold ?? false, newSel.italic ?? false, newSel.textAlign ?? "left");
            (e.target as Element).setPointerCapture(e.pointerId);
            scheduleRedraw();
            return;
          }
          // Nothing hit — start box select (or deselect if z not held)
          selectedTextRef.current = null;
          selectDragRef.current = null;
          selectedGroupRef.current = [];
          lastCycleRef.current = null;
          if (zKeyRef.current || touchToolRef.current === "select") {
            boxSelectRef.current = { start: { ...wp }, end: { ...wp } };
            (e.target as Element).setPointerCapture(e.pointerId);
            scheduleRedraw();
          } else {
            setZCursor(null);
            scheduleRedraw();
          }
          return;
        }

        // z held (or touch select tool), no selection — collect all hits and cycle / start box select
        if (zKeyRef.current || touchToolRef.current === "select") {
          const hits: Stroke[] = [];
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            const stroke = strokesRef.current[i];
            if (!stroke.locked && hitTestStroke(stroke, wp.x, wp.y, scale)) hits.push(stroke);
          }
          if (hits.length === 0) {
            selectedTextRef.current = null;
            selectDragRef.current = null;
            boxSelectRef.current = { start: { ...wp }, end: { ...wp } };
            (e.target as Element).setPointerCapture(e.pointerId);
            scheduleRedraw();
            return;
          }
          const stroke = hits[0];
          selectedTextRef.current = stroke;
          selectedGroupRef.current = [];
          hoverTextRef.current = null;
          setZCursor("default");
          // Persist cycle list so the second click can cycle even if it doesn't
          // land precisely on smaller strokes (e.g. dots) in the stack.
          lastCycleRef.current = hits.length > 1 ? { selectedStroke: stroke, hits } : null;
          selectDragRef.current = {
            mode: "move",
            startPtr: { ...wp },
            startPoints: stroke.points.map(p => ({ ...p })),
            startScale: stroke.fontScale ?? 1,
            bbox: anyStrokeBBox(stroke),
            subStrokeStartPoints: stroke.subStrokes?.map(s => s.points.map(p => ({ ...p }))),
          };
          dispatchTextStyleSync(stroke.bold ?? false, stroke.italic ?? false, stroke.textAlign ?? "left");
          (e.target as Element).setPointerCapture(e.pointerId);
          scheduleRedraw();
          return;
        }
      }

      onPointerDown(e);
    },
    [onPointerDown, finishWriting, startWriting, startEditingStroke, scheduleRedraw, setZCursor],
  );

  const handlePointerMoveGuarded = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isWritingRef.current) {
        if (textSelectDragAnchorRef.current !== null && editingStrokeRef.current) {
          const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
          const newPos = computeCaretPosFromClick(editingStrokeRef.current, wp);
          caretPosRef.current = newPos;
          const anchor = textSelectDragAnchorRef.current;
          selectionAnchorRef.current = newPos !== anchor ? anchor : null;
          caretVisibleRef.current = true;
          scheduleRedraw();
        }
        if (editingStrokeRef.current && e.pointerType !== "touch") {
          const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
          const bb = textBBox(editingStrokeRef.current);
          const pad = 8 / viewRef.current.scale;
          const inside = wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
                         wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad;
          setZCursor(inside ? "text" : "default");
        }
        return;
      }

      // Handle box selection drag
      if (boxSelectRef.current) {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        boxSelectRef.current.end = { ...wp };
        scheduleRedraw();
        return;
      }

      // Handle group drag
      if (groupDragRef.current) {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const { startPtr, startPoints, subStrokeStartPoints } = groupDragRef.current;
        const dx = wp.x - startPtr.x;
        const dy = wp.y - startPtr.y;
        for (let i = 0; i < selectedGroupRef.current.length; i++) {
          const stroke = selectedGroupRef.current[i];
          for (let j = 0; j < startPoints[i].length; j++) {
            stroke.points[j] = { x: startPoints[i][j].x + dx, y: startPoints[i][j].y + dy };
          }
          if (subStrokeStartPoints && stroke.subStrokes) {
            const spts = subStrokeStartPoints[i];
            for (let k = 0; k < stroke.subStrokes.length; k++) {
              for (let j = 0; j < spts[k].length; j++) {
                stroke.subStrokes[k].points[j] = { x: spts[k][j].x + dx, y: spts[k][j].y + dy };
              }
            }
          }
        }
        strokesCacheRef.current = null;
        scheduleRedraw();
        return;
      }

      // Handle active select drag (text and shapes)
      if (selectDragRef.current && selectedTextRef.current) {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const drag = selectDragRef.current;
        const stroke = selectedTextRef.current;

        if (drag.mode === "rotate") {
          const bb = anyStrokeBBox(stroke);
          const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
          const startAngle = Math.atan2(drag.startPtr.y - cy, drag.startPtr.x - cx);
          const currentAngle = Math.atan2(wp.y - cy, wp.x - cx);
          let newRotation = (drag.startRotation ?? 0) + (currentAngle - startAngle);
          if (e.shiftKey) {
            const snap = (15 * Math.PI) / 180;
            newRotation = Math.round(newRotation / snap) * snap;
          }
          stroke.rotation = newRotation || undefined;
        } else if (drag.mode === "move") {
          const dx = wp.x - drag.startPtr.x;
          const dy = wp.y - drag.startPtr.y;
          for (let i = 0; i < drag.startPoints.length; i++) {
            stroke.points[i] = { x: drag.startPoints[i].x + dx, y: drag.startPoints[i].y + dy };
          }
          if (drag.subStrokeStartPoints && stroke.subStrokes) {
            for (let k = 0; k < stroke.subStrokes.length; k++) {
              const spts = drag.subStrokeStartPoints[k];
              for (let j = 0; j < spts.length; j++) {
                stroke.subStrokes[k].points[j] = { x: spts[j].x + dx, y: spts[j].y + dy };
              }
            }
          }
        } else {
          // Corner resize / arrow endpoint drag
          const ci = drag.corner!;
          const bb = drag.bbox;

          // Arrow/line: endpoint handles reshape, midpoint handle translates
          if (stroke.shape === "arrow" || stroke.shape === "line") {
            if (drag.startPoints.length === 2) {
              // 2-point arrow: ci=1 (midpoint) inserts a bend; ci=0/2 move endpoints
              if (ci === 1) {
                if (stroke.points.length === 2) {
                  stroke.points.splice(1, 0, { ...wp });
                } else {
                  stroke.points[1] = { ...wp };
                }
              } else {
                const ptIdx = ci === 0 ? 0 : 1;
                const otherIdx = 1 - ptIdx;
                stroke.points[ptIdx] = { ...wp };
                stroke.points[otherIdx] = { ...drag.startPoints[otherIdx] };
              }
            } else {
              // N-point arrow: ci directly maps to point index
              stroke.points[ci] = { ...wp };
            }
            strokesCacheRef.current = null;
            scheduleRedraw();
            return;
          }

          // For rotated strokes, un-rotate wp and startPtr into the unrotated bbox frame
          // so all resize math can work in local (unrotated) coordinates
          let resizeWp = wp;
          let resizeStartPtr = drag.startPtr;
          if (stroke.rotation) {
            const rcx = bb.x + bb.w / 2, rcy = bb.y + bb.h / 2;
            const cos = Math.cos(-stroke.rotation), sin = Math.sin(-stroke.rotation);
            const dx = wp.x - rcx, dy = wp.y - rcy;
            resizeWp = { x: rcx + dx * cos - dy * sin, y: rcy + dx * sin + dy * cos };
            const sdx = drag.startPtr.x - rcx, sdy = drag.startPtr.y - rcy;
            resizeStartPtr = { x: rcx + sdx * cos - sdy * sin, y: rcy + sdx * sin + sdy * cos };
          }

          const oppCorners = [
            { x: bb.x + bb.w, y: bb.y + bb.h }, // TL drag → BR fixed
            { x: bb.x,        y: bb.y + bb.h }, // TR drag → BL fixed
            { x: bb.x,        y: bb.y },         // BR drag → TL fixed
            { x: bb.x + bb.w, y: bb.y },         // BL drag → TR fixed
          ];
          const opp = oppCorners[ci];

          if (stroke.text) {
            // Text resize: scale fontScale, keep opposite corner anchored
            const startDist = Math.hypot(resizeStartPtr.x - opp.x, resizeStartPtr.y - opp.y);
            const currDist  = Math.hypot(resizeWp.x - opp.x, resizeWp.y - opp.y);
            if (startDist > 1e-6) {
              const ratio = currDist / startDist;
              const newScale = Math.min(5, Math.max(0.3, drag.startScale * ratio));
              const actualRatio = newScale / drag.startScale;
              stroke.fontScale = newScale;
              const relX = bb.x - opp.x;
              const relY = bb.y - opp.y;
              stroke.points[0] = { x: opp.x + relX * actualRatio, y: opp.y + relY * actualRatio };
            }
          } else if (stroke.imageId) {
            // Image resize: scale imageW/imageH proportionally, keep opposite corner anchored
            const startDist = Math.hypot(resizeStartPtr.x - opp.x, resizeStartPtr.y - opp.y);
            const currDist  = Math.hypot(resizeWp.x - opp.x, resizeWp.y - opp.y);
            if (startDist > 1e-6) {
              const ratio = currDist / startDist;
              const minSize = 20 / viewRef.current.scale;
              const newW = Math.max(minSize, bb.w * ratio);
              const actualRatio = newW / bb.w;
              stroke.imageW = newW;
              stroke.imageH = (bb.h / bb.w) * newW;
              const relX = bb.x - opp.x;
              const relY = bb.y - opp.y;
              stroke.points[0] = { x: opp.x + relX * actualRatio, y: opp.y + relY * actualRatio };
            }
          } else if (!stroke.shape && !stroke.text && !stroke.imageId) {
            // Freehand resize: scale all points from the fixed opposite corner
            const origX = ci === 1 || ci === 2 ? bb.x + bb.w : bb.x;
            const origY = ci === 2 || ci === 3 ? bb.y + bb.h : bb.y;
            const denomX = origX - opp.x;
            const denomY = origY - opp.y;
            if (Math.abs(denomX) > 1e-6 && Math.abs(denomY) > 1e-6) {
              const sx = (resizeWp.x - opp.x) / denomX;
              const sy = (resizeWp.y - opp.y) / denomY;
              const minSize = 5 / viewRef.current.scale;
              if (Math.abs(resizeWp.x - opp.x) > minSize && Math.abs(resizeWp.y - opp.y) > minSize) {
                for (let i = 0; i < drag.startPoints.length; i++) {
                  stroke.points[i] = {
                    x: opp.x + (drag.startPoints[i].x - opp.x) * sx,
                    y: opp.y + (drag.startPoints[i].y - opp.y) * sy,
                  };
                }
                if (drag.subStrokeStartPoints && stroke.subStrokes) {
                  for (let k = 0; k < stroke.subStrokes.length; k++) {
                    const spts = drag.subStrokeStartPoints[k];
                    for (let j = 0; j < spts.length; j++) {
                      stroke.subStrokes[k].points[j] = {
                        x: opp.x + (spts[j].x - opp.x) * sx,
                        y: opp.y + (spts[j].y - opp.y) * sy,
                      };
                    }
                  }
                }
                // Scale lineWidth proportionally using geometric mean of x/y scale factors
                const lwScale = Math.sqrt(Math.abs(sx * sy));
                if (drag.startLineWidth !== undefined) {
                  stroke.lineWidth = Math.max(0.5, drag.startLineWidth * lwScale);
                }
                if (drag.startSubLineWidths && stroke.subStrokes) {
                  stroke.subStrokes.forEach((sub, k) => {
                    if (drag.startSubLineWidths![k] !== undefined) {
                      sub.lineWidth = Math.max(0.5, drag.startSubLineWidths![k] * lwScale);
                    }
                  });
                }
              }
            }
          } else {
            // Shape resize: move both defining points to new bbox corners
            const p0IsLeft = drag.startPoints[0].x <= drag.startPoints[1].x;
            const p0IsTop  = drag.startPoints[0].y <= drag.startPoints[1].y;
            const minSize = 10 / viewRef.current.scale;
            const newLeft   = Math.min(opp.x, resizeWp.x);
            const newTop    = Math.min(opp.y, resizeWp.y);
            const newRight  = Math.max(opp.x, resizeWp.x, newLeft + minSize);
            const newBottom = Math.max(opp.y, resizeWp.y, newTop  + minSize);
            stroke.points[0] = {
              x: p0IsLeft ? newLeft  : newRight,
              y: p0IsTop  ? newTop   : newBottom,
            };
            stroke.points[1] = {
              x: p0IsLeft ? newRight  : newLeft,
              y: p0IsTop  ? newBottom : newTop,
            };
            // Scale shape lineWidth proportionally
            if (drag.startLineWidth !== undefined && bb.w > 0 && bb.h > 0) {
              const newW = newRight - newLeft;
              const newH = newBottom - newTop;
              const lwScale = Math.sqrt((newW / bb.w) * (newH / bb.h));
              stroke.lineWidth = Math.max(0.5, drag.startLineWidth * lwScale);
            }
          }
        }

        strokesCacheRef.current = null;
        scheduleRedraw();
        return;
      }

      // Cursor updates for select mode (non-drag, mouse/stylus only)
      if (e.pointerType !== "touch") {
        if (selectedTextRef.current) {
          const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
          const { scale } = viewRef.current;
          const bb = anyStrokeBBox(selectedTextRef.current);
          const pad = 3 / scale;
          const hs = 7 / scale;
          const selStroke = selectedTextRef.current;
          const selRotation = selStroke.rotation ?? 0;
          // Un-rotate hover point for handle cursor checks
          let cwp = wp;
          if (selRotation) {
            const rcx = bb.x + bb.w / 2, rcy = bb.y + bb.h / 2;
            const cos = Math.cos(-selRotation), sin = Math.sin(-selRotation);
            const dx = wp.x - rcx, dy = wp.y - rcy;
            cwp = { x: rcx + dx * cos - dy * sin, y: rcy + dx * sin + dy * cos };
          }
          let cur = "default";
          // Check rotate handle first (non-arrow/line strokes)
          if (selStroke.shape !== "arrow" && selStroke.shape !== "line") {
            const handleOffset = 28 / scale;
            const handleX = bb.x + bb.w / 2, handleY = bb.y - pad - handleOffset;
            if (Math.hypot(cwp.x - handleX, cwp.y - handleY) <= hs) {
              cur = "grab";
            }
          }
          if (cur === "default" && (selStroke.shape || selStroke.text || selStroke.imageId || (!selStroke.shape && !selStroke.text && !selStroke.imageId))) {
            const selShape = selStroke.shape;
            if ((selShape === "arrow" || selShape === "line") && selStroke.points.length >= 2) {
              const pts = selStroke.points;
              const n = pts.length;
              if (n === 2) {
                // 2-point: 3 inline handles — start, mid, end
                const p0 = pts[0], p1 = pts[1];
                const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
                for (const [, hp] of [[0, p0], [1, mid], [2, p1]] as [number, {x:number;y:number}][]) {
                  if (Math.hypot(wp.x - hp.x, wp.y - hp.y) <= hs) {
                    cur = "pointer";
                    break;
                  }
                }
              } else {
                // N-point: endpoints get crosshair, intermediate bend points get grab
                for (let i = 0; i < n; i++) {
                  if (Math.hypot(wp.x - pts[i].x, wp.y - pts[i].y) <= hs) {
                    cur = "pointer";
                    break;
                  }
                }
              }
              if (cur === "default" && hitTestStroke(selStroke, wp.x, wp.y, scale)) {
                cur = "move"; // shaft: drag to move, click without drag adds a bend
              }
            } else {
              const cornerCenters = [
                { x: bb.x - pad,        y: bb.y - pad },
                { x: bb.x + bb.w + pad, y: bb.y - pad },
                { x: bb.x + bb.w + pad, y: bb.y + bb.h + pad },
                { x: bb.x - pad,        y: bb.y + bb.h + pad },
              ];
              for (const cc of cornerCenters) {
                if (Math.abs(cwp.x - cc.x) <= hs + pad && Math.abs(cwp.y - cc.y) <= hs + pad) {
                  cur = "nwse-resize";
                  break;
                }
              }
              if (cur === "default" &&
                  cwp.x >= bb.x - pad && cwp.x <= bb.x + bb.w + pad &&
                  cwp.y >= bb.y - pad && cwp.y <= bb.y + bb.h + pad) {
                cur = "move";
              }
            }
          } else if (cur === "default" && (
            cwp.x >= bb.x - pad && cwp.x <= bb.x + bb.w + pad &&
            cwp.y >= bb.y - pad && cwp.y <= bb.y + bb.h + pad
          )) {
            cur = "move";
          }
          // If not hovering over the selected stroke, check if hovering over a different stroke
          if (cur === "default") {
            for (let i = strokesRef.current.length - 1; i >= 0; i--) {
              const s = strokesRef.current[i];
              if (s !== selStroke && hitTestStroke(s, wp.x, wp.y, scale)) { cur = "move"; break; }
            }
          }
          setZCursor(cur);
        } else if (selectedGroupRef.current.length > 0) {
          // Group selected without V: show move cursor inside group bbox, arrow elsewhere
          const wp2 = screenToWorld(e.clientX, e.clientY, viewRef.current);
          const scale2 = viewRef.current.scale;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const s of selectedGroupRef.current) {
            const bb = anyStrokeBBox(s);
            minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
            maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
          }
          const pad2 = 8 / scale2;
          setZCursor(wp2.x >= minX - pad2 && wp2.x <= maxX + pad2 && wp2.y >= minY - pad2 && wp2.y <= maxY + pad2 ? "move" : "default");
        } else if (zKeyRef.current) {
          if (shiftHeldRef.current) {
            // Shift+V: box-select mode — suppress individual hover, show crosshair
            if (hoverTextRef.current !== null) {
              hoverTextRef.current = null;
              scheduleRedraw();
            }
            setZCursor("default");
          } else {
            // V held, no selection: show move cursor on hover
            const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
            const { scale } = viewRef.current;
            let hit: Stroke | null = null;
            for (let i = strokesRef.current.length - 1; i >= 0; i--) {
              const stroke = strokesRef.current[i];
              if (!stroke.locked && hitTestStroke(stroke, wp.x, wp.y, scale)) { hit = stroke; break; }
            }
            if (hit !== hoverTextRef.current) {
              hoverTextRef.current = hit;
              setZCursor(hit ? "move" : "default");
              scheduleRedraw();
            }
          }
        }
      }

      onPointerMove(e);
    },
    [onPointerMove, scheduleRedraw, setZCursor],
  );

  const handlePointerUpGuarded = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isWritingRef.current) {
        textSelectDragAnchorRef.current = null;
        return;
      }

      // Commit box selection
      if (boxSelectRef.current) {
        const { scale } = viewRef.current;
        const { start, end, clickHit } = boxSelectRef.current;
        const selX = Math.min(start.x, end.x);
        const selY = Math.min(start.y, end.y);
        const selW = Math.abs(end.x - start.x);
        const selH = Math.abs(end.y - start.y);
        // Tiny drag = click: toggle the stroke that was under the pointer on pointerdown
        if (selW <= 6 / scale && selH <= 6 / scale && clickHit) {
          const { prevGroup, prevSingle } = boxSelectRef.current!;
          const group = prevGroup ?? [];
          const single = prevSingle ?? null;
          const current = group.length > 0 ? [...group] : (single ? [single] : []);
          const idx = current.indexOf(clickHit);
          const newGroup = idx >= 0 ? current.filter(s => s !== clickHit) : [...current, clickHit];
          if (newGroup.length === 0) {
            selectedTextRef.current = null;
            selectedGroupRef.current = [];
          } else if (newGroup.length === 1) {
            selectedTextRef.current = newGroup[0];
            selectedGroupRef.current = [];
            dispatchTextStyleSync(newGroup[0].bold ?? false, newGroup[0].italic ?? false, newGroup[0].textAlign ?? "left");
          } else {
            selectedTextRef.current = null;
            selectedGroupRef.current = newGroup;
          }
          boxSelectRef.current = null;
          strokesCacheRef.current = null;
          scheduleRedraw();
          return;
        }
        if (selW > 2 / scale && selH > 2 / scale) {
          const containOnly = boxSelectRef.current?.containOnly ?? false;
          const hits = strokesRef.current.filter(stroke => {
            if (stroke.locked) return false;
            const bb = rotatedAABB(stroke);
            if (containOnly) {
              // Shift+V: stroke must be fully inside the selection box
              return bb.x >= selX && bb.x + bb.w <= selX + selW &&
                     bb.y >= selY && bb.y + bb.h <= selY + selH;
            }
            // Quick AABB rejection
            if (bb.x >= selX + selW || bb.x + bb.w <= selX ||
                bb.y >= selY + selH || bb.y + bb.h <= selY) return false;
            // Text, images, combined groups, and area shapes: AABB intersection is correct
            if (stroke.text || stroke.imageId || stroke.subStrokes) return true;
            if (stroke.shape && stroke.shape !== "line" && stroke.shape !== "arrow") return true;
            // Line/arrow shapes and freehand strokes: test actual geometry
            // so a wide-spanning stroke's AABB doesn't capture unrelated nearby shapes.
            const selX2 = selX + selW, selY2 = selY + selH;
            if (stroke.points.some(p => p.x >= selX && p.x <= selX2 && p.y >= selY && p.y <= selY2)) return true;
            for (let i = 0; i < stroke.points.length - 1; i++) {
              if (segmentIntersectsRect(stroke.points[i], stroke.points[i + 1], selX, selY, selX2, selY2)) return true;
            }
            return false;
          });
          if (hits.length === 1) {
            selectedTextRef.current = hits[0];
            selectedGroupRef.current = [];
            setZCursor("default");
            dispatchTextStyleSync(hits[0].bold ?? false, hits[0].italic ?? false, hits[0].textAlign ?? "left");
          } else if (hits.length > 1) {
            selectedGroupRef.current = hits;
            selectedTextRef.current = null;
            setZCursor("default");
          } else {
            // Drag captured nothing — clear any pre-existing selection
            selectedTextRef.current = null;
            selectedGroupRef.current = [];
            setZCursor(zKeyRef.current ? "default" : null);
          }
        }
        boxSelectRef.current = null;
        strokesCacheRef.current = null;
        scheduleRedraw();
        return;
      }

      // Commit group drag
      if (groupDragRef.current) {
        const { startPoints, subStrokeStartPoints } = groupDragRef.current;
        const anyMoved = selectedGroupRef.current.some((stroke, i) =>
          startPoints[i].some((p, j) => p.x !== stroke.points[j].x || p.y !== stroke.points[j].y) ||
          (stroke.subStrokes && subStrokeStartPoints?.[i]?.some((spts, k) =>
            spts.some((p, j) => p.x !== stroke.subStrokes![k].points[j].x || p.y !== stroke.subStrokes![k].points[j].y)
          ))
        );
        if (anyMoved) {
          undoStackRef.current.push({
            type: "group-move",
            strokes: selectedGroupRef.current,
            from: startPoints,
            to: selectedGroupRef.current.map(s => s.points.map(p => ({ ...p }))),
            subFrom: subStrokeStartPoints,
            subTo: subStrokeStartPoints
              ? selectedGroupRef.current.map(s => s.subStrokes?.map(sub => sub.points.map(p => ({ ...p }))) ?? [])
              : undefined,
          });
          redoStackRef.current = [];
          persistStrokes();
          window.dispatchEvent(new Event("drawtool:selection-moved"));
        } else {
          // Click without drag inside group — select the clicked item, or deselect if none
          const { scale } = viewRef.current;
          const wp = groupDragRef.current.startPtr;
          let hit: Stroke | null = null;
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            if (!strokesRef.current[i].locked && hitTestStroke(strokesRef.current[i], wp.x, wp.y, scale)) { hit = strokesRef.current[i]; break; }
          }
          selectedGroupRef.current = [];
          selectedTextRef.current = hit ?? null;
        }
        groupDragRef.current = null;
        setZCursor("default");
        scheduleRedraw();
        return;
      }

      // Commit select drag (text and shapes)
      if (selectDragRef.current && selectedTextRef.current) {
        const drag = selectDragRef.current;
        const stroke = selectedTextRef.current;

        if (drag.mode === "rotate") {
          const startRot = drag.startRotation ?? 0;
          const endRot = stroke.rotation ?? 0;
          if (Math.abs(endRot - startRot) > 0.0001) {
            undoStackRef.current.push({ type: "rotate", stroke, from: startRot, to: endRot });
            redoStackRef.current = [];
            persistStrokes();
          }
          selectDragRef.current = null;
          scheduleRedraw();
          return;
        } else if (drag.mode === "move") {
          const anyMoved = drag.startPoints.some((p, i) =>
            p.x !== stroke.points[i].x || p.y !== stroke.points[i].y) ||
            (drag.subStrokeStartPoints && stroke.subStrokes?.some((s, k) =>
              drag.subStrokeStartPoints![k]?.some((p, j) => p.x !== s.points[j].x || p.y !== s.points[j].y)
            ));
          if (anyMoved) {
            undoStackRef.current.push({
              type: "move",
              stroke,
              from: drag.startPoints.map(p => ({ ...p })),
              to: stroke.points.slice(0, drag.startPoints.length).map(p => ({ ...p })),
              subFrom: drag.subStrokeStartPoints,
              subTo: drag.subStrokeStartPoints
                ? stroke.subStrokes?.map(s => s.points.map(p => ({ ...p })))
                : undefined,
            });
            redoStackRef.current = [];
            persistStrokes();
            window.dispatchEvent(new Event("drawtool:selection-moved"));
          } else if (drag.pendingBend && (stroke.shape === "arrow" || stroke.shape === "line")) {
            // No drag — insert a bend point at the click position
            const from = drag.startPoints.map(p => ({ ...p }));
            stroke.points.splice(drag.pendingBend.segmentIdx + 1, 0, { ...drag.startPtr });
            const to = stroke.points.map(p => ({ ...p }));
            undoStackRef.current.push({ type: "reshape", stroke, from, to });
            redoStackRef.current = [];
            strokesCacheRef.current = null;
            persistStrokes();
          } else if (drag.cycleHits && drag.cycleHits.length > 1) {
            // No drag occurred — cycle to the next overlapping stroke
            const hits = drag.cycleHits;
            const curIdx = hits.indexOf(stroke);
            const nextStroke = hits[(curIdx + 1) % hits.length];
            selectedTextRef.current = nextStroke;
            lastCycleRef.current = { selectedStroke: nextStroke, hits };
            dispatchTextStyleSync(nextStroke.bold ?? false, nextStroke.italic ?? false, nextStroke.textAlign ?? "left");
          }
        } else if (stroke.text) {
          // Text resize — fontScale + anchor changed
          const newScale = stroke.fontScale ?? 1;
          if (newScale !== drag.startScale) {
            undoStackRef.current.push({
              type: "resize",
              stroke,
              fromScale: drag.startScale,
              toScale: newScale,
              fromPoints: drag.startPoints.map(p => ({ ...p })),
              toPoints: [{ ...stroke.points[0] }],
            });
            redoStackRef.current = [];
            persistStrokes();
          }
        } else if (stroke.imageId) {
          // Image resize — imageW/imageH + anchor changed
          const fromW = drag.bbox.w;
          const toW = stroke.imageW ?? fromW;
          if (Math.abs(toW - fromW) > 0.1) {
            undoStackRef.current.push({
              type: "resize",
              stroke,
              fromScale: 1,
              toScale: 1,
              fromW,
              toW,
              fromH: drag.bbox.h,
              toH: stroke.imageH ?? drag.bbox.h,
              fromPoints: drag.startPoints.map(p => ({ ...p })),
              toPoints: [{ ...stroke.points[0] }],
            });
            redoStackRef.current = [];
            persistStrokes();
          }
        } else if (
          (stroke.shape === "arrow" || stroke.shape === "line") &&
          drag.corner === 1 &&
          drag.startPoints.length === 2 &&
          stroke.points.length === 2
        ) {
          // 2-point arrow midpoint handle single-click (no drag) — insert bend at midpoint
          const from = drag.startPoints.map(p => ({ ...p }));
          const p0 = drag.startPoints[0], p1 = drag.startPoints[1];
          stroke.points.splice(1, 0, { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 });
          const to = stroke.points.map(p => ({ ...p }));
          undoStackRef.current.push({ type: "reshape", stroke, from, to });
          redoStackRef.current = [];
          strokesCacheRef.current = null;
          persistStrokes();
        } else if ((stroke.shape === "arrow" || stroke.shape === "line") && stroke.points.length > drag.startPoints.length) {
          // Midpoint handle drag inserted a bend — commit as reshape
          undoStackRef.current.push({
            type: "reshape",
            stroke,
            from: drag.startPoints.map(p => ({ ...p })),
            to: stroke.points.map(p => ({ ...p })),
          });
          redoStackRef.current = [];
          persistStrokes();
        } else {
          // Shape/freehand resize — point positions changed, use "move" undo
          const anyChanged = drag.startPoints.some((p, i) =>
            p.x !== stroke.points[i].x || p.y !== stroke.points[i].y) ||
            (drag.subStrokeStartPoints && stroke.subStrokes?.some((s, k) =>
              drag.subStrokeStartPoints![k]?.some((p, j) => p.x !== s.points[j].x || p.y !== s.points[j].y)
            ));
          if (anyChanged) {
            undoStackRef.current.push({
              type: "move",
              stroke,
              from: drag.startPoints.map(p => ({ ...p })),
              to: stroke.points.slice(0, drag.startPoints.length).map(p => ({ ...p })),
              subFrom: drag.subStrokeStartPoints,
              subTo: drag.subStrokeStartPoints
                ? stroke.subStrokes?.map(s => s.points.map(p => ({ ...p })))
                : undefined,
              fromLineWidth: drag.startLineWidth,
              toLineWidth: drag.startLineWidth !== undefined ? stroke.lineWidth : undefined,
              fromSubLineWidths: drag.startSubLineWidths,
              toSubLineWidths: drag.startSubLineWidths
                ? stroke.subStrokes?.map(s => s.lineWidth)
                : undefined,
            });
            redoStackRef.current = [];
            persistStrokes();
          }
        }

        strokesCacheRef.current = null;
        selectDragRef.current = null;
        setZCursor("default");
        scheduleRedraw();
        return;
      }

      onPointerUp(e);
    },
    [onPointerUp, persistStrokes, scheduleRedraw, setZCursor],
  );

  return {
    finishWriting,
    startWriting,
    startEditingStroke,
    handlePointerDownForText,
    handlePointerMoveGuarded,
    handlePointerUpGuarded,
    lastLockedTapRef,
  };
}
