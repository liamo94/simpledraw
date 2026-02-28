import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type { TextAlign } from "./useSettings";
import type { Stroke, UndoAction, BBox } from "../canvas/types";
import {
  dispatchTextStyleSync, textBBox, anyStrokeBBox,
  screenToWorld, computeCaretPosFromClick,
} from "../canvas/geometry";
import type { TouchTool } from "../canvas/types";

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
    mode: "move" | "corner";
    corner?: 0 | 1 | 2 | 3;
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[];
    startScale: number;
    bbox: BBox;
    cycleHits?: Stroke[];
  } | null>;
  hoverTextRef: MutableRefObject<Stroke | null>;
  groupDragRef: MutableRefObject<{
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[][];
  } | null>;
  boxSelectRef: MutableRefObject<{ start: { x: number; y: number }; end: { x: number; y: number }; containOnly?: boolean } | null>;
  zKeyRef: MutableRefObject<boolean>;
  touchToolRef: MutableRefObject<TouchTool>;
  lastTextTapRef: MutableRefObject<{ time: number; stroke: Stroke } | null>;
  lineColorRef: MutableRefObject<string>;
  textSizeRef: MutableRefObject<import("./useSettings").TextSize>;
  fontFamilyRef: MutableRefObject<import("./useSettings").FontFamily>;
  viewRef: MutableRefObject<{ x: number; y: number; scale: number }>;
  finishWritingRef: MutableRefObject<() => void>;
  startWritingRef: MutableRefObject<(pos: { x: number; y: number }) => void>;
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
    zKeyRef, touchToolRef, lastTextTapRef, lineColorRef, textSizeRef, fontFamilyRef, viewRef,
    finishWritingRef, startWritingRef,
  } = refs;

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
      // Auto-select the new text stroke
      selectedTextRef.current = stroke;
      selectedGroupRef.current = [];
      setZCursor("default");
      dispatchTextStyleSync(stroke.bold ?? false, stroke.italic ?? false, stroke.textAlign ?? "left");
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
    scheduleRedraw();
  }, [persistStrokes, scheduleRedraw, notifyColorUsed, setZCursor]);

  const startWriting = useCallback((worldPos: { x: number; y: number }) => {
    writingPosRef.current = worldPos;
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
    setZCursor("default");
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
    selectedTextRef.current = null;
    selectDragRef.current = null;
    strokesCacheRef.current = null;
    setZCursor(null);
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
            // Click inside editing stroke → reposition cursor
            caretPosRef.current = computeCaretPosFromClick(editStroke, wp);
            selectionAnchorRef.current = null;
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
            lastTextTapRef.current = { time: now, stroke };
            return; // block drawing on first tap — wait for potential double-click
          }
        }
        lastTextTapRef.current = null;
      }

      // Shift+V: force box select — bypasses any stroke/group hit-testing
      if (zKeyRef.current && e.shiftKey && e.pointerType !== "touch") {
        selectedTextRef.current = null;
        selectDragRef.current = null;
        selectedGroupRef.current = [];
        hoverTextRef.current = null;
        strokesCacheRef.current = null;
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        boxSelectRef.current = { start: { ...wp }, end: { ...wp }, containOnly: true };
        (e.target as Element).setPointerCapture(e.pointerId);
        scheduleRedraw();
        return;
      }

      // Group move: if a group is selected, check if pointer is inside combined bbox
      if (selectedGroupRef.current.length > 0 && e.pointerType !== "touch") {
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
          };
          (e.target as Element).setPointerCapture(e.pointerId);
          scheduleRedraw();
          return;
        } else {
          // Click outside group — clear group selection
          const hitOnClear = hoverTextRef.current;
          selectedGroupRef.current = [];
          groupDragRef.current = null;
          hoverTextRef.current = null;
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

      // Text select / move / resize mode (mouse/stylus, z held or already selected)
      if ((selectedTextRef.current || zKeyRef.current) && e.pointerType !== "touch") {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const { scale } = viewRef.current;
        const pad = 3 / scale;
        const hs = 7 / scale;

        if (selectedTextRef.current) {
          const bb = anyStrokeBBox(selectedTextRef.current);
          // Check corner handles first (only for shapes and text, not freehand)
          if (selectedTextRef.current.shape || selectedTextRef.current.text) {
            const cornerCenters = [
              { x: bb.x - pad,        y: bb.y - pad },
              { x: bb.x + bb.w + pad, y: bb.y - pad },
              { x: bb.x + bb.w + pad, y: bb.y + bb.h + pad },
              { x: bb.x - pad,        y: bb.y + bb.h + pad },
            ];
            for (let ci = 0; ci < 4; ci++) {
              const cc = cornerCenters[ci];
              if (Math.abs(wp.x - cc.x) <= hs + pad && Math.abs(wp.y - cc.y) <= hs + pad) {
                selectDragRef.current = {
                  mode: "corner",
                  corner: ci as 0 | 1 | 2 | 3,
                  startPtr: { ...wp },
                  startPoints: selectedTextRef.current.points.map(p => ({ ...p })),
                  startScale: selectedTextRef.current.fontScale ?? 1,
                  bbox: bb,
                };
                (e.target as Element).setPointerCapture(e.pointerId);
                return;
              }
            }
          }
          // Check body — drag current stroke; defer click-to-cycle to pointer up
          if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
              wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
            const curStroke = selectedTextRef.current;
            // Collect all hits under pointer (for deferred cycling on pointer up)
            const allHits: Stroke[] = [];
            for (let i = strokesRef.current.length - 1; i >= 0; i--) {
              const s = strokesRef.current[i];
              if (s.points.length === 0) continue;
              const hbb = anyStrokeBBox(s);
              if (wp.x >= hbb.x - pad && wp.x <= hbb.x + hbb.w + pad &&
                  wp.y >= hbb.y - pad && wp.y <= hbb.y + hbb.h + pad) {
                allHits.push(s);
              }
            }
            selectDragRef.current = {
              mode: "move",
              startPtr: { ...wp },
              startPoints: curStroke.points.map(p => ({ ...p })),
              startScale: curStroke.fontScale ?? 1,
              bbox: bb,
              cycleHits: allHits.length > 1 ? allHits : undefined,
            };
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
          }
          // Clicked elsewhere — check if a different stroke was hit
          let newSel: Stroke | null = null;
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            const stroke = strokesRef.current[i];
            if (stroke === selectedTextRef.current) continue;
            if (stroke.points.length === 0) continue;
            const hbb = anyStrokeBBox(stroke);
            if (wp.x >= hbb.x - pad && wp.x <= hbb.x + hbb.w + pad &&
                wp.y >= hbb.y - pad && wp.y <= hbb.y + hbb.h + pad) {
              newSel = stroke;
              break;
            }
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
          if (zKeyRef.current) {
            boxSelectRef.current = { start: { ...wp }, end: { ...wp } };
            (e.target as Element).setPointerCapture(e.pointerId);
            scheduleRedraw();
          } else {
            setZCursor(null);
            scheduleRedraw();
          }
          return;
        }

        // z held, no selection — collect all hits and cycle / start box select
        if (zKeyRef.current) {
          const hits: Stroke[] = [];
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            const stroke = strokesRef.current[i];
            if (stroke.points.length === 0) continue;
            const bb = anyStrokeBBox(stroke);
            if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
                wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
              hits.push(stroke);
            }
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
          selectDragRef.current = {
            mode: "move",
            startPtr: { ...wp },
            startPoints: stroke.points.map(p => ({ ...p })),
            startScale: stroke.fontScale ?? 1,
            bbox: anyStrokeBBox(stroke),
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
      if (isWritingRef.current) return;

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
        const { startPtr, startPoints } = groupDragRef.current;
        const dx = wp.x - startPtr.x;
        const dy = wp.y - startPtr.y;
        for (let i = 0; i < selectedGroupRef.current.length; i++) {
          const stroke = selectedGroupRef.current[i];
          for (let j = 0; j < startPoints[i].length; j++) {
            stroke.points[j] = { x: startPoints[i][j].x + dx, y: startPoints[i][j].y + dy };
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

        if (drag.mode === "move") {
          const dx = wp.x - drag.startPtr.x;
          const dy = wp.y - drag.startPtr.y;
          for (let i = 0; i < drag.startPoints.length; i++) {
            stroke.points[i] = { x: drag.startPoints[i].x + dx, y: drag.startPoints[i].y + dy };
          }
        } else {
          // Corner resize — keep opposite corner fixed
          const ci = drag.corner!;
          const bb = drag.bbox;
          const oppCorners = [
            { x: bb.x + bb.w, y: bb.y + bb.h }, // TL drag → BR fixed
            { x: bb.x,        y: bb.y + bb.h }, // TR drag → BL fixed
            { x: bb.x,        y: bb.y },         // BR drag → TL fixed
            { x: bb.x + bb.w, y: bb.y },         // BL drag → TR fixed
          ];
          const opp = oppCorners[ci];

          if (stroke.text) {
            // Text resize: scale fontScale, keep opposite corner anchored
            const startDist = Math.hypot(drag.startPtr.x - opp.x, drag.startPtr.y - opp.y);
            const currDist  = Math.hypot(wp.x - opp.x, wp.y - opp.y);
            if (startDist > 1e-6) {
              const ratio = currDist / startDist;
              const newScale = Math.min(5, Math.max(0.3, drag.startScale * ratio));
              const actualRatio = newScale / drag.startScale;
              stroke.fontScale = newScale;
              const relX = bb.x - opp.x;
              const relY = bb.y - opp.y;
              stroke.points[0] = { x: opp.x + relX * actualRatio, y: opp.y + relY * actualRatio };
            }
          } else {
            // Shape resize: move both defining points to new bbox corners
            const p0IsLeft = drag.startPoints[0].x <= drag.startPoints[1].x;
            const p0IsTop  = drag.startPoints[0].y <= drag.startPoints[1].y;
            const minSize = 10 / viewRef.current.scale;
            const newLeft   = Math.min(opp.x, wp.x);
            const newTop    = Math.min(opp.y, wp.y);
            const newRight  = Math.max(opp.x, wp.x, newLeft + minSize);
            const newBottom = Math.max(opp.y, wp.y, newTop  + minSize);
            stroke.points[0] = {
              x: p0IsLeft ? newLeft  : newRight,
              y: p0IsTop  ? newTop   : newBottom,
            };
            stroke.points[1] = {
              x: p0IsLeft ? newRight  : newLeft,
              y: p0IsTop  ? newBottom : newTop,
            };
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
          let cur = "default";
          if (selStroke.shape || selStroke.text) {
            const cornerCenters = [
              { x: bb.x - pad,        y: bb.y - pad },
              { x: bb.x + bb.w + pad, y: bb.y - pad },
              { x: bb.x + bb.w + pad, y: bb.y + bb.h + pad },
              { x: bb.x - pad,        y: bb.y + bb.h + pad },
            ];
            for (const cc of cornerCenters) {
              if (Math.abs(wp.x - cc.x) <= hs + pad && Math.abs(wp.y - cc.y) <= hs + pad) {
                cur = "nwse-resize";
                break;
              }
            }
            if (cur === "default" &&
                wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
                wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
              cur = "move";
            }
          } else if (
            wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
            wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad
          ) {
            cur = "move";
          }
          setZCursor(cur);
        } else if (zKeyRef.current) {
          // V held, no selection: show move cursor on hover
          const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
          const { scale } = viewRef.current;
          const pad = 3 / scale;
          let hit: Stroke | null = null;
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            const stroke = strokesRef.current[i];
            if (stroke.points.length === 0) continue;
            const bb = anyStrokeBBox(stroke);
            if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
                wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
              hit = stroke;
              break;
            }
          }
          if (hit !== hoverTextRef.current) {
            hoverTextRef.current = hit;
            setZCursor(hit ? "move" : "default");
            scheduleRedraw();
          }
        }
      }

      onPointerMove(e);
    },
    [onPointerMove, scheduleRedraw, setZCursor],
  );

  const handlePointerUpGuarded = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isWritingRef.current) return;

      // Commit box selection
      if (boxSelectRef.current) {
        const { scale } = viewRef.current;
        const { start, end } = boxSelectRef.current;
        const selX = Math.min(start.x, end.x);
        const selY = Math.min(start.y, end.y);
        const selW = Math.abs(end.x - start.x);
        const selH = Math.abs(end.y - start.y);
        if (selW > 2 / scale && selH > 2 / scale) {
          const containOnly = boxSelectRef.current?.containOnly ?? false;
          const hits = strokesRef.current.filter(stroke => {
            const bb = anyStrokeBBox(stroke);
            if (containOnly) {
              // Shift+V: stroke must be fully inside the selection box
              return bb.x >= selX && bb.x + bb.w <= selX + selW &&
                     bb.y >= selY && bb.y + bb.h <= selY + selH;
            }
            // Normal box select: intersection
            return bb.x < selX + selW && bb.x + bb.w > selX &&
                   bb.y < selY + selH && bb.y + bb.h > selY;
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
          }
        }
        boxSelectRef.current = null;
        strokesCacheRef.current = null;
        scheduleRedraw();
        return;
      }

      // Commit group drag
      if (groupDragRef.current) {
        const { startPoints } = groupDragRef.current;
        const anyMoved = selectedGroupRef.current.some((stroke, i) =>
          startPoints[i].some((p, j) => p.x !== stroke.points[j].x || p.y !== stroke.points[j].y)
        );
        if (anyMoved) {
          undoStackRef.current.push({
            type: "group-move",
            strokes: selectedGroupRef.current,
            from: startPoints,
            to: selectedGroupRef.current.map(s => s.points.map(p => ({ ...p }))),
          });
          redoStackRef.current = [];
          persistStrokes();
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

        if (drag.mode === "move") {
          const anyMoved = drag.startPoints.some((p, i) =>
            p.x !== stroke.points[i].x || p.y !== stroke.points[i].y);
          if (anyMoved) {
            undoStackRef.current.push({
              type: "move",
              stroke,
              from: drag.startPoints.map(p => ({ ...p })),
              to: stroke.points.slice(0, drag.startPoints.length).map(p => ({ ...p })),
            });
            redoStackRef.current = [];
            persistStrokes();
          } else if (drag.cycleHits && drag.cycleHits.length > 1) {
            // No drag occurred — cycle to the next overlapping stroke
            const hits = drag.cycleHits;
            const curIdx = hits.indexOf(stroke);
            const nextStroke = hits[(curIdx + 1) % hits.length];
            selectedTextRef.current = nextStroke;
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
        } else {
          // Shape resize — only point positions changed, use "move" undo
          const anyChanged = drag.startPoints.some((p, i) =>
            p.x !== stroke.points[i].x || p.y !== stroke.points[i].y);
          if (anyChanged) {
            undoStackRef.current.push({
              type: "move",
              stroke,
              from: drag.startPoints.map(p => ({ ...p })),
              to: stroke.points.slice(0, drag.startPoints.length).map(p => ({ ...p })),
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
  };
}
