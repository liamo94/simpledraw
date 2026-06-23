import { useEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { ShapeKind, TextSize, FontFamily, TextAlign, FillStyle } from "./useSettings";
import type { Stroke, UndoAction, BBox } from "../canvas/types";
import { cmdKey, isMac, textBBox, anyStrokeBBox, FONT_FAMILIES } from "../canvas/geometry";
import { storeImage, processImageFile } from "../canvas/imageStore";

function deepCopyStroke(s: Stroke, dx = 0, dy = 0): Stroke {
  return {
    ...s,
    locked: undefined,
    points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
    widths: s.widths ? [...s.widths] : undefined,
    subStrokes: s.subStrokes ? s.subStrokes.map(sub => deepCopyStroke(sub, dx, dy)) : undefined,
  };
}

const _wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

function prevWordBoundary(text: string, pos: number): number {
  if (pos === 0) return 0;
  const segs = [..._wordSegmenter.segment(text.slice(0, pos))];
  let i = segs.length - 1;
  while (i >= 0 && /^[ \t]+$/.test(segs[i].segment)) i--;
  return i >= 0 ? segs[i].index : 0;
}

function nextWordBoundary(text: string, pos: number): number {
  if (pos >= text.length) return text.length;
  const segs = [..._wordSegmenter.segment(text)];
  let i = segs.findIndex(s => s.index + s.segment.length > pos);
  if (i === -1) return text.length;
  while (i < segs.length && /^[ \t]+$/.test(segs[i].segment)) i++;
  return i < segs.length ? segs[i].index + segs[i].segment.length : text.length;
}

// ─── Ref bag type ─────────────────────────────────────────────────────────────

export type KeyboardRefs = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasIndexRef: MutableRefObject<number>;
  strokesRef: MutableRefObject<Stroke[]>;
  undoStackRef: MutableRefObject<UndoAction[]>;
  redoStackRef: MutableRefObject<UndoAction[]>;
  strokesCacheRef: MutableRefObject<{ canvas: HTMLCanvasElement; key: string } | null>;
  viewRef: MutableRefObject<{ x: number; y: number; scale: number }>;
  canvasLimitRef: MutableRefObject<number>;
  isWritingRef: MutableRefObject<boolean>;
  writingTextRef: MutableRefObject<string>;
  caretPosRef: MutableRefObject<number>;
  caretVisibleRef: MutableRefObject<boolean>;
  selectionAnchorRef: MutableRefObject<number | null>;
  textUndoRef: MutableRefObject<string[]>;
  textRedoRef: MutableRefObject<string[]>;
  editingStrokeRef: MutableRefObject<Stroke | null>;
  writingBoldRef: MutableRefObject<boolean>;
  writingItalicRef: MutableRefObject<boolean>;
  writingAlignRef: MutableRefObject<TextAlign>;
  zKeyRef: MutableRefObject<boolean>;
  selectedTextRef: MutableRefObject<Stroke | null>;
  hoverTextRef: MutableRefObject<Stroke | null>;
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
  } | null>;
  selectedGroupRef: MutableRefObject<Stroke[]>;
  groupDragRef: MutableRefObject<{
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[][];
  } | null>;
  boxSelectRef: MutableRefObject<{ start: { x: number; y: number }; end: { x: number; y: number }; containOnly?: boolean; clickHit?: Stroke; prevGroup?: Stroke[]; prevSingle?: Stroke | null } | null>;
  clipboardRef: MutableRefObject<Stroke[] | null>;
  cursorWorldRef: MutableRefObject<{ x: number; y: number }>;
  lastDPressRef: MutableRefObject<number>;
  shapeFlashRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  activeShapeRef: MutableRefObject<ShapeKind>;
  textSizeRef: MutableRefObject<TextSize>;
  fontFamilyRef: MutableRefObject<FontFamily>;
  lineColorRef: MutableRefObject<string>;
  lineWidthRef: MutableRefObject<number>;
  laserTrailRef: MutableRefObject<{ x: number; y: number }[]>;
  isDrawingRef: MutableRefObject<boolean>;
  isZoomingRef: MutableRefObject<boolean>;
  activeModifierRef: MutableRefObject<"meta" | "shift" | "alt" | "line" | "shape" | "highlight" | "laser" | "spray" | null>;
  sprayKeyRef: MutableRefObject<boolean>;
  spaceDownRef: MutableRefObject<boolean>;
  isPanningRef: MutableRefObject<boolean>;
  highlightKeyRef: MutableRefObject<boolean>;
  laserKeyRef: MutableRefObject<boolean>;
  shiftHeldRef: MutableRefObject<boolean>;
  rightClickHeldRef: MutableRefObject<boolean>;
  keyShapeRef: MutableRefObject<ShapeKind | null>;
  keyShapeDashedRef: MutableRefObject<boolean>;
  shapeJustCommittedRef: MutableRefObject<boolean>;
  fKeyHeldRef: MutableRefObject<boolean>;
  shapeFillRef: MutableRefObject<FillStyle>;
  fillOpacityRef: MutableRefObject<number>;
  lastTextTapRef: MutableRefObject<{ time: number; stroke: Stroke; count: number } | null>;
  finishWritingRef: MutableRefObject<() => void>;
  startWritingRef: MutableRefObject<(pos: { x: number; y: number }) => void>;
  cursorRef: MutableRefObject<string>;
  lastCycleRef: MutableRefObject<{ selectedStroke: Stroke; hits: Stroke[] } | null>;
  selectedLinePointRef: MutableRefObject<number | null>;
  textareaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  presentationModeRef?: MutableRefObject<boolean>;
};

// ─── Callback bag type ────────────────────────────────────────────────────────

export type KeyboardCallbacks = {
  scheduleRedraw: () => void;
  persistStrokes: () => void;
  persistView: () => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  confirmErase: () => void;
  cancelErase: () => void;
  cancelCurrentStroke: () => void;
  discardTinyShape: () => void;
  notifyColorUsed: (color: string) => void;
  setZCursor: (cursor: string | null) => void;
  setPanning: (p: boolean) => void;
  setErasing: (e: boolean) => void;
  setShapeActive: (s: boolean) => void;
  setHighlighting: (h: boolean) => void;
  setLasering: (l: boolean) => void;
  setSpraying: (s: boolean) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKeyboardShortcuts(refs: KeyboardRefs, callbacks: KeyboardCallbacks) {
  const {
    canvasRef, canvasIndexRef, strokesRef, undoStackRef, redoStackRef, strokesCacheRef, viewRef,
    isWritingRef, writingTextRef, caretPosRef, caretVisibleRef, selectionAnchorRef,
    textUndoRef, textRedoRef, editingStrokeRef, writingBoldRef, writingItalicRef, writingAlignRef,
    zKeyRef, selectedTextRef, hoverTextRef, selectDragRef, selectedGroupRef, groupDragRef, boxSelectRef,
    clipboardRef, cursorWorldRef, lastDPressRef, shapeFlashRef, activeShapeRef,
    textSizeRef, fontFamilyRef, lineColorRef, lineWidthRef,
    laserTrailRef, isDrawingRef, activeModifierRef,
    spaceDownRef, isPanningRef, highlightKeyRef, laserKeyRef,
    shiftHeldRef, rightClickHeldRef, keyShapeRef, keyShapeDashedRef, shapeJustCommittedRef, fKeyHeldRef, shapeFillRef, fillOpacityRef,
    lastTextTapRef, finishWritingRef, startWritingRef, cursorRef,
    sprayKeyRef, lastCycleRef, selectedLinePointRef, textareaRef, canvasLimitRef, presentationModeRef,
  } = refs;

  const {
    scheduleRedraw, persistStrokes, persistView, clearCanvas,
    undo, redo, confirmErase, cancelErase, cancelCurrentStroke, discardTinyShape, notifyColorUsed,
    setZCursor, setPanning, setErasing, setShapeActive, setHighlighting, setLasering, setSpraying,
  } = callbacks;

  // Internal state for select-mode lock (double-tap V) - not part of the ref bag
  const selectLockedRef = useRef(false);
  const lastVPressRef = useRef(0);
  // s key: direction + timer that shows the shape cursor after a short hold (peek mode)
  const sKeyBackwardRef = useRef(false);
  const sHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    const onKeyDown = (e: KeyboardEvent) => {
      if (presentationModeRef?.current) {
        // Allow laser through in presentation mode
        if ((e.key === "q" || e.key === "l") && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
          laserKeyRef.current = true;
          setLasering(true);
        }
        return;
      }
      // Handle text input while in writing mode - runs before the native-input guard so our
      // handlers fire even when the hidden textarea has focus (avoids relying on inconsistent
      // browser behaviour for shortcuts like Cmd+Backspace in a focused textarea).
      if (isWritingRef.current) {
        // Escape / Cmd+Enter → accept text
        if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
          e.preventDefault();
          finishWritingRef.current();
          return;
        }
        const text = writingTextRef.current;
        const pos = caretPosRef.current;
        const hasSel = selectionAnchorRef.current !== null;
        const selStart = hasSel ? Math.min(selectionAnchorRef.current!, pos) : pos;
        const selEnd   = hasSel ? Math.max(selectionAnchorRef.current!, pos) : pos;
        const syncToTextarea = () => {
          const ta = textareaRef?.current;
          if (!ta) return;
          ta.value = writingTextRef.current;
          const anch = selectionAnchorRef.current;
          const caret = caretPosRef.current;
          ta.setSelectionRange(anch !== null ? Math.min(anch, caret) : caret, caret);
        };
        // Helper: replace selection (or nothing) with a string, clear selection
        const replaceSelection = (insert: string) => {
          textUndoRef.current.push(text);
          textRedoRef.current = [];
          writingTextRef.current = text.slice(0, selStart) + insert + text.slice(selEnd);
          caretPosRef.current = selStart + insert.length;
          selectionAnchorRef.current = null;
          caretVisibleRef.current = true;
          syncToTextarea();
          scheduleRedraw();
        };
        // Cmd+Z → text undo
        if (cmdKey(e) && e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          if (textUndoRef.current.length > 0) {
            textRedoRef.current.push(writingTextRef.current);
            writingTextRef.current = textUndoRef.current.pop()!;
            caretPosRef.current = writingTextRef.current.length;
            selectionAnchorRef.current = null;
            syncToTextarea();
            scheduleRedraw();
          }
          return;
        }
        // Cmd+Shift+Z → text redo
        if (cmdKey(e) && e.key === "z" && e.shiftKey) {
          e.preventDefault();
          if (textRedoRef.current.length > 0) {
            textUndoRef.current.push(writingTextRef.current);
            writingTextRef.current = textRedoRef.current.pop()!;
            caretPosRef.current = writingTextRef.current.length;
            selectionAnchorRef.current = null;
            syncToTextarea();
            scheduleRedraw();
          }
          return;
        }
        // Cmd+B → toggle bold
        if (cmdKey(e) && e.key === "b" && !e.shiftKey) {
          e.preventDefault();
          const editStroke = editingStrokeRef.current;
          if (editStroke) {
            const newBold = !(editStroke.bold ?? false);
            undoStackRef.current.push({ type: "bold-change", stroke: editStroke, from: editStroke.bold, to: newBold });
            editStroke.bold = newBold || undefined;
            writingBoldRef.current = newBold;
            strokesCacheRef.current = null;
          } else {
            writingBoldRef.current = !writingBoldRef.current;
          }
          scheduleRedraw();
          return;
        }
        // Cmd+I → toggle italic
        if (cmdKey(e) && e.key === "i" && !e.shiftKey) {
          e.preventDefault();
          const editStroke = editingStrokeRef.current;
          if (editStroke) {
            const newItalic = !(editStroke.italic ?? false);
            undoStackRef.current.push({ type: "italic-change", stroke: editStroke, from: editStroke.italic, to: newItalic });
            editStroke.italic = newItalic || undefined;
            writingItalicRef.current = newItalic;
            strokesCacheRef.current = null;
          } else {
            writingItalicRef.current = !writingItalicRef.current;
          }
          scheduleRedraw();
          return;
        }
        // Cmd+Shift+L/E/R → text alignment
        if (cmdKey(e) && e.shiftKey && (e.key === "l" || e.key === "e" || e.key === "r")) {
          e.preventDefault();
          const newAlign: TextAlign = e.key === "l" ? "left" : e.key === "e" ? "center" : "right";
          const editStroke = editingStrokeRef.current;
          if (editStroke) {
            const oldAlign: TextAlign = editStroke.textAlign ?? "left";
            if (oldAlign !== newAlign) {
              undoStackRef.current.push({ type: "align-change", stroke: editStroke, from: oldAlign, to: newAlign });
              editStroke.textAlign = newAlign !== "left" ? newAlign : undefined;
              strokesCacheRef.current = null;
            }
          }
          writingAlignRef.current = newAlign;
          scheduleRedraw();
          return;
        }
        // Cmd+A → select all
        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
          e.preventDefault();
          selectionAnchorRef.current = 0;
          caretPosRef.current = text.length;
          syncToTextarea();
          scheduleRedraw();
          return;
        }
        // Cmd+Backspace → delete selection or to start of line
        if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (hasSel) {
            replaceSelection("");
          } else {
            textUndoRef.current.push(text);
            textRedoRef.current = [];
            const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
            if (lineStart === pos && pos > 0) {
              writingTextRef.current = text.slice(0, pos - 1) + text.slice(pos);
              caretPosRef.current = pos - 1;
            } else {
              writingTextRef.current = text.slice(0, lineStart) + text.slice(pos);
              caretPosRef.current = lineStart;
            }
            syncToTextarea();
            scheduleRedraw();
          }
          return;
        }
        // Option+Backspace → delete selection or word before caret
        if (e.key === "Backspace" && e.altKey) {
          e.preventDefault();
          if (hasSel) {
            replaceSelection("");
          } else if (pos > 0) {
            textUndoRef.current.push(text);
            textRedoRef.current = [];
            const i = prevWordBoundary(text, pos);
            writingTextRef.current = text.slice(0, i) + text.slice(pos);
            caretPosRef.current = i;
            syncToTextarea();
            scheduleRedraw();
          }
          return;
        }
        // Backspace → delete selection or char before caret
        if (e.key === "Backspace") {
          e.preventDefault();
          if (hasSel) {
            replaceSelection("");
          } else if (pos > 0) {
            textUndoRef.current.push(text);
            textRedoRef.current = [];
            writingTextRef.current = text.slice(0, pos - 1) + text.slice(pos);
            caretPosRef.current = pos - 1;
            syncToTextarea();
            scheduleRedraw();
          }
          return;
        }
        // Delete → delete selection or char after caret
        if (e.key === "Delete") {
          e.preventDefault();
          if (hasSel) {
            replaceSelection("");
          } else if (pos < text.length) {
            textUndoRef.current.push(text);
            textRedoRef.current = [];
            writingTextRef.current = text.slice(0, pos) + text.slice(pos + 1);
            syncToTextarea();
            scheduleRedraw();
          }
          return;
        }
        // Enter → insert newline
        if (e.key === "Enter") {
          e.preventDefault();
          replaceSelection("\n");
          return;
        }
        // Arrow keys → collapse selection or move caret (Shift extends selection)
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (hasSel && !e.shiftKey) {
            caretPosRef.current = selStart;
            selectionAnchorRef.current = null;
          } else {
            if (e.shiftKey && selectionAnchorRef.current === null) selectionAnchorRef.current = pos;
            if (pos > 0) {
              if (e.metaKey) {
                caretPosRef.current = text.lastIndexOf("\n", pos - 1) + 1;
              } else if (e.altKey) {
                caretPosRef.current = prevWordBoundary(text, pos);
              } else {
                caretPosRef.current = pos - 1;
              }
            }
            if (!e.shiftKey) selectionAnchorRef.current = null;
          }
          caretVisibleRef.current = true;
          syncToTextarea();
          scheduleRedraw();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          if (hasSel && !e.shiftKey) {
            caretPosRef.current = selEnd;
            selectionAnchorRef.current = null;
          } else {
            if (e.shiftKey && selectionAnchorRef.current === null) selectionAnchorRef.current = pos;
            if (pos < text.length) {
              if (e.metaKey) {
                let end = text.indexOf("\n", pos);
                if (end === -1) end = text.length;
                caretPosRef.current = end;
              } else if (e.altKey) {
                caretPosRef.current = nextWordBoundary(text, pos);
              } else {
                caretPosRef.current = pos + 1;
              }
            }
            if (!e.shiftKey) selectionAnchorRef.current = null;
          }
          caretVisibleRef.current = true;
          syncToTextarea();
          scheduleRedraw();
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          if (e.shiftKey && selectionAnchorRef.current === null) selectionAnchorRef.current = pos;
          const lines = text.split("\n");
          let charCount = 0;
          let curLine = 0;
          let curCol = 0;
          for (let i = 0; i < lines.length; i++) {
            if (pos <= charCount + lines[i].length) {
              curLine = i;
              curCol = pos - charCount;
              break;
            }
            charCount += lines[i].length + 1;
          }
          const targetLine = e.key === "ArrowUp" ? curLine - 1 : curLine + 1;
          if (targetLine >= 0 && targetLine < lines.length) {
            let newPos = 0;
            for (let i = 0; i < targetLine; i++) newPos += lines[i].length + 1;
            newPos += Math.min(curCol, lines[targetLine].length);
            caretPosRef.current = newPos;
            caretVisibleRef.current = true;
            syncToTextarea();
            scheduleRedraw();
          }
          if (!e.shiftKey) selectionAnchorRef.current = null;
          return;
        }
        // Cmd+C → copy selected text to clipboard
        if (cmdKey(e) && e.key === "c") {
          e.preventDefault();
          if (selectionAnchorRef.current !== null) {
            const copied = text.slice(
              Math.min(selectionAnchorRef.current, pos),
              Math.max(selectionAnchorRef.current, pos),
            );
            navigator.clipboard?.writeText(copied).catch(() => {});
          }
          return;
        }
        // Cmd+X → cut selected text
        if (cmdKey(e) && e.key === "x" && selectionAnchorRef.current !== null) {
          e.preventDefault();
          const copied = text.slice(
            Math.min(selectionAnchorRef.current, pos),
            Math.max(selectionAnchorRef.current, pos),
          );
          navigator.clipboard?.writeText(copied).catch(() => {});
          replaceSelection("");
          return;
        }
        // Ignore other modifier combos (Cmd+V handled elsewhere)
        if (e.metaKey || e.ctrlKey || e.altKey) {
          return;
        }
        // Tab → insert spaces (prevent focus change)
        if (e.key === "Tab") {
          e.preventDefault();
          replaceSelection("  ");
          return;
        }
        // Printable character - handled by keydown on desktop (preventDefault prevents double-insert
        // if textarea also has focus); mobile soft keyboard sends input events instead
        if (e.key?.length === 1) {
          e.preventDefault();
          replaceSelection(e.key);
          return;
        }
        return;
      }
      // Don't intercept shortcuts when focus is inside a native text input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:open-shortcuts"));
        return;
      }
      if (e.key === "t" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        startWritingRef.current({ ...cursorWorldRef.current });
        return;
      }
      if ((e.key === "v" || e.key === "V") && !e.repeat && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        const now = performance.now();
        if (now - lastVPressRef.current < 400) {
          selectLockedRef.current = !selectLockedRef.current;
          lastVPressRef.current = 0;
          window.dispatchEvent(new CustomEvent("drawtool:toast", {
            detail: { type: "toggle", label: "Select mode", on: selectLockedRef.current },
          }));
        } else {
          lastVPressRef.current = now;
        }
        zKeyRef.current = true;
        setZCursor("default");
        window.dispatchEvent(new CustomEvent("drawtool:select-held", { detail: { on: true } }));
      }
      if (e.key === "T" && e.shiftKey && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        const sizes: TextSize[] = ["xs", "s", "m", "l", "xl"];
        const labels: Record<TextSize, string> = { xs: "XS", s: "S", m: "M", l: "L", xl: "XL" };
        const cur = textSizeRef.current;
        const idx = sizes.indexOf(cur);
        const next = sizes[(idx + 1) % sizes.length];
        window.dispatchEvent(new CustomEvent("drawtool:text-size", { detail: next }));
        window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: `Text: ${labels[next]}` }));
        const sel = selectedTextRef.current;
        if (sel && sel.text) {
          undoStackRef.current.push({ type: "size-change", stroke: sel, from: sel.fontSize, to: next });
          redoStackRef.current = [];
          sel.fontSize = next;
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
        }
        return;
      }
      if (e.key === "Y" && e.shiftKey && !cmdKey(e) && !e.altKey && !e.ctrlKey && !isWritingRef.current && !keyShapeRef.current) {
        const cur = fontFamilyRef.current;
        const idx = FONT_FAMILIES.findIndex(f => f.key === cur);
        const next = FONT_FAMILIES[(idx + 1) % FONT_FAMILIES.length];
        window.dispatchEvent(new CustomEvent("drawtool:font-family", { detail: next.key }));
        window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: `Font: ${next.label}` }));
        return;
      }
      // Cmd+B → bold, Cmd+I → italic for selected text stroke (outside writing mode)
      if (cmdKey(e) && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "i") && !isWritingRef.current) {
        const sel = selectedTextRef.current;
        if (sel && sel.text) {
          e.preventDefault();
          const fromAnchor = { ...sel.points[0] };
          const oldBbox = textBBox(sel);
          if (e.key === "b") {
            const newBold = !(sel.bold ?? false);
            const fromBold = sel.bold;
            sel.bold = newBold || undefined;
            const newBbox = textBBox(sel);
            sel.points[0] = { x: fromAnchor.x + (oldBbox.x - newBbox.x), y: fromAnchor.y + (oldBbox.y - newBbox.y) };
            undoStackRef.current.push({ type: "bold-change", stroke: sel, from: fromBold, to: newBold, fromAnchor, toAnchor: { ...sel.points[0] } });
          } else {
            const newItalic = !(sel.italic ?? false);
            const fromItalic = sel.italic;
            sel.italic = newItalic || undefined;
            const newBbox = textBBox(sel);
            sel.points[0] = { x: fromAnchor.x + (oldBbox.x - newBbox.x), y: fromAnchor.y + (oldBbox.y - newBbox.y) };
            undoStackRef.current.push({ type: "italic-change", stroke: sel, from: fromItalic, to: newItalic, fromAnchor, toAnchor: { ...sel.points[0] } });
          }
          redoStackRef.current = [];
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
          return;
        }
      }
      // Cmd+Shift+L/E/R → alignment for selected text stroke (outside writing mode)
      if (cmdKey(e) && e.shiftKey && !e.altKey && (e.key === "l" || e.key === "e" || e.key === "r") && !isWritingRef.current) {
        const sel = selectedTextRef.current;
        if (sel && sel.text) {
          e.preventDefault();
          const newAlign: TextAlign = e.key === "l" ? "left" : e.key === "e" ? "center" : "right";
          const oldAlign: TextAlign = sel.textAlign ?? "left";
          if (oldAlign !== newAlign) {
            const fromAnchor = { ...sel.points[0] };
            const oldBbox = textBBox(sel);
            sel.textAlign = newAlign !== "left" ? newAlign : undefined;
            const newBbox = textBBox(sel);
            sel.points[0] = { x: fromAnchor.x + (oldBbox.x - newBbox.x), y: fromAnchor.y + (oldBbox.y - newBbox.y) };
            undoStackRef.current.push({ type: "align-change", stroke: sel, from: oldAlign, to: newAlign, fromAnchor, toAnchor: { ...sel.points[0] } });
            redoStackRef.current = [];
            strokesCacheRef.current = null;
            persistStrokes();
            scheduleRedraw();
          }
          return;
        }
      }
      if (cmdKey(e) && e.key === "x") {
        e.preventDefault();
        if (selectedGroupRef.current.length > 0 && !isWritingRef.current) {
          const toDelete = selectedGroupRef.current;
          const deleteIndices = toDelete.map(s => strokesRef.current.indexOf(s));
          clipboardRef.current = toDelete.map(s => deepCopyStroke(s));
          navigator.clipboard?.writeText("drawtool-clip").catch(() => {});
          strokesRef.current = strokesRef.current.filter(s => !toDelete.includes(s));
          undoStackRef.current.push({ type: "erase", strokes: toDelete, indices: deleteIndices });
          redoStackRef.current = [];
          selectedGroupRef.current = [];
          selectDragRef.current = null;
          hoverTextRef.current = null;
          groupDragRef.current = null;
          lastCycleRef.current = null;
          strokesCacheRef.current = null;
          setZCursor(zKeyRef.current ? "default" : null);
          persistStrokes();
          scheduleRedraw();
        } else if (selectedTextRef.current && !isWritingRef.current) {
          const stroke = selectedTextRef.current;
          const deleteIdx = strokesRef.current.indexOf(stroke);
          clipboardRef.current = [deepCopyStroke(stroke)];
          navigator.clipboard?.writeText("drawtool-clip").catch(() => {});
          strokesRef.current = strokesRef.current.filter(s => s !== stroke);
          undoStackRef.current.push({ type: "erase", strokes: [stroke], indices: [deleteIdx] });
          redoStackRef.current = [];
          selectedTextRef.current = null;
          selectDragRef.current = null;
          strokesCacheRef.current = null;
          setZCursor(zKeyRef.current ? "default" : null);
          persistStrokes();
          scheduleRedraw();
        } else {
          window.dispatchEvent(new Event("drawtool:request-clear"));
        }
      }
      if (cmdKey(e) && e.key === "a" && !isWritingRef.current) {
        e.preventDefault();
        const all = strokesRef.current.filter(s => s.points.length > 0 && !s.locked);
        if (all.length === 1) {
          selectedTextRef.current = all[0];
          selectedGroupRef.current = [];
        } else if (all.length > 1) {
          selectedGroupRef.current = all;
          selectedTextRef.current = null;
        }
        if (all.length > 0) setZCursor("default");
        scheduleRedraw();
      }
      // Cmd+Shift+H / Cmd+Shift+V → flip selected strokes horizontally / vertically
      if (cmdKey(e) && e.shiftKey && (e.key === "h" || e.key === "v") && !isWritingRef.current) {
        const axis = e.key === "h" ? "h" : "v";
        const srcs = selectedGroupRef.current.length > 0
          ? selectedGroupRef.current
          : selectedTextRef.current ? [selectedTextRef.current] : [];
        if (srcs.length > 0) {
          e.preventDefault();
          // Compute combined bbox center as flip pivot
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const s of srcs) {
            const bb = anyStrokeBBox(s);
            minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
            maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
          }
          const flipCx = (minX + maxX) / 2, flipCy = (minY + maxY) / 2;
          const fromPoints = srcs.map(s => s.points.map(p => ({ ...p })));
          const fromRotations = srcs.map(s => s.rotation);
          for (const s of srcs) {
            if (s.text || s.imageId) continue;
            for (const p of s.points) {
              if (axis === "h") p.x = 2 * flipCx - p.x;
              else p.y = 2 * flipCy - p.y;
            }
            if (s.rotation) s.rotation = -s.rotation;
          }
          const toPoints = srcs.map(s => s.points.map(p => ({ ...p })));
          const toRotations = srcs.map(s => s.rotation);
          undoStackRef.current.push({ type: "flip", strokes: srcs, fromPoints, toPoints, fromRotations, toRotations });
          redoStackRef.current = [];
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
        }
      }
      if (cmdKey(e) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (cmdKey(e) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (cmdKey(e) && e.key === "c") {
        if (selectedGroupRef.current.length > 0) {
          clipboardRef.current = selectedGroupRef.current.map(s => deepCopyStroke(s));
          navigator.clipboard?.writeText("drawtool-clip").catch(() => {});
        } else if (selectedTextRef.current) {
          clipboardRef.current = [deepCopyStroke(selectedTextRef.current)];
          navigator.clipboard?.writeText("drawtool-clip").catch(() => {});
        }
      }
      // Cmd+V: let the paste event handle it so image clipboard takes priority over internal stroke clipboard
      if (e.key === "u" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "U" && e.shiftKey && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === "}" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        const selGroup = selectedGroupRef.current;
        const selSingle = selectedTextRef.current;
        if ((selGroup.length > 0 || selSingle) && !isWritingRef.current) {
          const steps = [1, 2, 4, 6, 8, 10];
          const curLw = selSingle ? selSingle.lineWidth : Math.min(...selGroup.map(s => s.lineWidth));
          const idx = steps.indexOf(curLw);
          const nextIdx = idx === -1 ? steps.findIndex(s => s > curLw) : Math.min(steps.length - 1, idx + 1);
          if (nextIdx !== -1) {
            const nextLw = steps[nextIdx];
            if (nextLw > curLw) window.dispatchEvent(new CustomEvent("drawtool:set-line-width", { detail: nextLw }));
          }
        } else {
          window.dispatchEvent(new CustomEvent("drawtool:thickness", { detail: 1 }));
        }
      }
      if (e.key === "{" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        const selGroup = selectedGroupRef.current;
        const selSingle = selectedTextRef.current;
        if ((selGroup.length > 0 || selSingle) && !isWritingRef.current) {
          const steps = [1, 2, 4, 6, 8, 10];
          const curLw = selSingle ? selSingle.lineWidth : Math.max(...selGroup.map(s => s.lineWidth));
          const idx = steps.indexOf(curLw);
          const lastBelow = steps.reduce((best, s, i) => s < curLw ? i : best, -1);
          const nextIdx = idx === -1 ? lastBelow : Math.max(0, idx - 1);
          if (nextIdx !== -1) {
            const nextLw = steps[nextIdx];
            if (nextLw < curLw) window.dispatchEvent(new CustomEvent("drawtool:set-line-width", { detail: nextLw }));
          }
        } else {
          window.dispatchEvent(new CustomEvent("drawtool:thickness", { detail: -1 }));
        }
      }
      if (e.key === "m" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:toggle-menu"));
      }
      if (e.key === "M" && !cmdKey(e) && !e.altKey && !e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:open-canvas-manager"));
      }
      if (e.key === "g" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:toggle-grid"));
      }
      if (e.key === "G" && !cmdKey(e) && !e.altKey && !e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:toggle-grid-back"));
      }
      if (cmdKey(e) && e.key === "e" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:export"));
      }
      if (cmdKey(e) && e.key === "e" && e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:export-data"));
      }
      if (e.shiftKey && e.code === "Digit1" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:reset-view"));
      }
      if (e.shiftKey && e.code === "Digit3" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:reset-view-origin"));
      }
      if (e.shiftKey && e.code === "Digit2" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:center-view"));
      }
      if (e.shiftKey && e.code === "Digit4" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        const hasSel = !!(selectedTextRef.current || selectedGroupRef.current.length > 0);
        if (hasSel) {
          e.preventDefault();
          window.dispatchEvent(new Event("drawtool:zoom-to-selection"));
        }
      }
      if (e.key === "[" && !cmdKey(e)) {
        window.dispatchEvent(new CustomEvent("drawtool:color-cycle", { detail: -1 }));
      }
      if (e.key === "]" && !cmdKey(e)) {
        window.dispatchEvent(new CustomEvent("drawtool:color-cycle", { detail: 1 }));
      }
      if ((e.key === "+" || e.key === "=") && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("drawtool:zoom-step", { detail: 1.25 }));
      }
      if (e.key === "-" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("drawtool:zoom-step", { detail: 0.8 }));
      }
      const hasSelection = !!(selectedTextRef.current || selectedGroupRef.current.length > 0);
      if (hasSelection && !isWritingRef.current && !cmdKey(e) && !e.altKey &&
          (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const nudge = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -nudge : e.key === "ArrowRight" ? nudge : 0;
        const dy = e.key === "ArrowUp" ? -nudge : e.key === "ArrowDown" ? nudge : 0;
        if (selectedGroupRef.current.length > 0) {
          const from = selectedGroupRef.current.map(s => s.points.map(p => ({ ...p })));
          for (const s of selectedGroupRef.current) {
            for (const p of s.points) { p.x += dx; p.y += dy; }
          }
          const to = selectedGroupRef.current.map(s => s.points.map(p => ({ ...p })));
          if (!e.repeat) {
            undoStackRef.current.push({ type: "group-move", strokes: selectedGroupRef.current, from, to });
            redoStackRef.current = [];
          } else {
            const last = undoStackRef.current[undoStackRef.current.length - 1];
            if (last?.type === "group-move") last.to = to;
          }
        } else if (selectedTextRef.current) {
          const stroke = selectedTextRef.current;
          const from = stroke.points.map(p => ({ ...p }));
          for (const p of stroke.points) { p.x += dx; p.y += dy; }
          const to = stroke.points.map(p => ({ ...p }));
          if (!e.repeat) {
            undoStackRef.current.push({ type: "move", stroke, from, to });
            redoStackRef.current = [];
          } else {
            const last = undoStackRef.current[undoStackRef.current.length - 1];
            if (last?.type === "move" && last.stroke === stroke) last.to = to;
          }
        }
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistStrokes();
        return;
      }
      const panAmount = e.shiftKey ? 200 : 50;
      if (e.key === "ArrowUp" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.y -= panAmount;
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistView();
        window.dispatchEvent(new Event("drawtool:panned"));
      }
      if (e.key === "ArrowDown" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.y += panAmount;
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistView();
        window.dispatchEvent(new Event("drawtool:panned"));
      }
      if (e.key === "ArrowLeft" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.x -= panAmount;
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistView();
        window.dispatchEvent(new Event("drawtool:panned"));
      }
      if (e.key === "ArrowRight" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.x += panAmount;
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistView();
        window.dispatchEvent(new Event("drawtool:panned"));
      }
      if (cmdKey(e) && e.key === "d" && !isWritingRef.current) {
        e.preventDefault();
        const offset = 16;
        const srcs = selectedGroupRef.current.length > 0
          ? selectedGroupRef.current
          : selectedTextRef.current ? [selectedTextRef.current] : [];
        if (srcs.length > 0) {
          const offsetStroke = (src: Stroke): Stroke => ({
            ...src,
            points: src.points.map(p => ({ x: p.x + offset, y: p.y + offset })),
            widths: src.widths ? [...src.widths] : undefined,
            subStrokes: src.subStrokes ? (src.subStrokes as Stroke[]).map(offsetStroke) : undefined,
          });
          const newStrokes: Stroke[] = srcs.map(offsetStroke);
          strokesRef.current.push(...newStrokes);
          if (newStrokes.length === 1) {
            undoStackRef.current.push({ type: "draw", stroke: newStrokes[0] });
            selectedTextRef.current = newStrokes[0];
            selectedGroupRef.current = [];
          } else {
            undoStackRef.current.push({ type: "multi-draw", strokes: newStrokes });
            selectedGroupRef.current = newStrokes;
            selectedTextRef.current = null;
          }
          redoStackRef.current = [];
          setZCursor("default");
          strokesCacheRef.current = null;
          scheduleRedraw();
          persistStrokes();
        }
      }
      if (cmdKey(e) && (e.code === "BracketRight" || e.code === "BracketLeft") && !e.shiftKey && !isWritingRef.current) {
        e.preventDefault();
        const selection = selectedGroupRef.current.length > 0
          ? selectedGroupRef.current
          : selectedTextRef.current ? [selectedTextRef.current] : [];
        if (selection.length > 0) {
          const strokes = strokesRef.current;
          const before = [...strokes];
          const selSet = new Set(selection);
          const sel = [...selection].sort((a, b) => strokes.indexOf(a) - strokes.indexOf(b));
          const rest = strokes.filter(s => !selSet.has(s));
          const forward = e.code === "BracketRight";
          const stepwise = e.altKey;
          const topIdx = strokes.indexOf(sel[sel.length - 1]);
          const insertPos = rest.filter(s => strokes.indexOf(s) < topIdx).length;
          const newInsertPos = stepwise
            ? forward
              ? Math.min(rest.length, insertPos + 1)
              : Math.max(0, insertPos - 1)
            : (forward ? rest.length : 0);
          strokesRef.current = [...rest.slice(0, newInsertPos), ...sel, ...rest.slice(newInsertPos)];
          undoStackRef.current.push({ type: "reorder", before, after: [...strokesRef.current] });
          redoStackRef.current = [];
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
          const label = stepwise
            ? (forward ? "Brought forward" : "Sent backward")
            : (forward ? "Brought to front" : "Sent to back");
          window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: label }));
        }
        return;
      }
      if (e.key === "d" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        const now = performance.now();
        if (now - lastDPressRef.current < 400) {
          lastDPressRef.current = 0;
          window.dispatchEvent(new Event("drawtool:cycle-theme"));
        } else {
          lastDPressRef.current = now;
        }
      }
      if (e.key === "D" && e.shiftKey && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        const now = performance.now();
        if (now - lastDPressRef.current < 400) {
          lastDPressRef.current = 0;
          window.dispatchEvent(new CustomEvent("drawtool:cycle-theme", { detail: -1 }));
        } else {
          lastDPressRef.current = now;
        }
      }
      if (e.key === "f" && e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:toggle-fullscreen"));
      }
      if ((e.key === "f" || e.key === "ƒ") && e.altKey && !e.metaKey) {
        // Alt+F: cycle fill style
        window.dispatchEvent(new Event("drawtool:cycle-fill"));
      } else if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.altKey) {
        // F (with or without shift): apply fill while held
        fKeyHeldRef.current = true;
        if (isDrawingRef.current && activeModifierRef.current === "shape") {
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.shape) { stroke.fill = shapeFillRef.current; stroke.fillOpacity = fillOpacityRef.current / 100; scheduleRedraw(); }
        }
      }
      if (e.key === "p" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(new Event("drawtool:toggle-pressure"));
      }
      if (e.key === "P" && e.shiftKey && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("drawtool:toggle-slides"));
      }
      if (e.key === "N" && e.shiftKey && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("drawtool:add-slide"));
      }
      if (e.key === "e" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(new Event("drawtool:toggle-corners"));
      }
      if (cmdKey(e) && e.key === ",") {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:focus-canvas-name"));
      }
      if (e.key === "," && !cmdKey(e) && !e.altKey) {
        window.dispatchEvent(new Event("drawtool:swap-color"));
      }
      if (e.key === "." && !cmdKey(e) && !e.altKey) {
        notifyColorUsed(lineColorRef.current);
        const dot: Stroke = {
          points: [{ ...cursorWorldRef.current }],
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
      }
      if (e.key === "Shift") shiftHeldRef.current = true;
      if (e.key === "Alt" && !e.shiftKey) setErasing(true);
      if ((e.key === "s" || e.key === "S") && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.repeat) {
        if (shapeFlashRef.current) { clearTimeout(shapeFlashRef.current); shapeFlashRef.current = null; }
        if (sHintTimerRef.current) { clearTimeout(sHintTimerRef.current); sHintTimerRef.current = null; }
        sKeyBackwardRef.current = e.key === "S";
        shapeJustCommittedRef.current = false;
        keyShapeRef.current = activeShapeRef.current;
        keyShapeDashedRef.current = shiftHeldRef.current || rightClickHeldRef.current;
        // After 500ms of holding without dragging, show the shape cursor as a peek hint
        sHintTimerRef.current = setTimeout(() => {
          sHintTimerRef.current = null;
          if (activeModifierRef.current !== "shape") setShapeActive(true);
        }, 500);
      }
      if ((e.key === "w" || e.key === "h") && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        highlightKeyRef.current = true;
        setHighlighting(true);
      }
      if ((e.key === "q" || e.key === "l") && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        laserKeyRef.current = true;
        setLasering(true);
      }
      if (e.key === "b" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey && !isWritingRef.current) {
        sprayKeyRef.current = true;
        setSpraying(true);
      }
      if (e.key === "B" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !isWritingRef.current) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:toggle-stash"));
        return;
      }
      if (cmdKey(e) && e.key === "s" && e.shiftKey && !e.altKey && !isWritingRef.current) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:save-to-stash"));
        return;
      }
      // Letter-key shape shortcuts (lowercase = solid, uppercase/shift = dashed)
      const shapeKeyMap: Record<string, ShapeKind> = {
        a: "arrow", A: "arrow",
        r: "rectangle", R: "rectangle",
        c: "circle", C: "circle",
      };
      if (shapeKeyMap[e.key] && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        keyShapeRef.current = shapeKeyMap[e.key];
        keyShapeDashedRef.current = shiftHeldRef.current || rightClickHeldRef.current;
        shapeJustCommittedRef.current = false;
        setShapeActive(true);
      }
      // Number keys 1-9 for canvas switching
      if (e.key >= "1" && e.key <= "9" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(
          new CustomEvent("drawtool:switch-canvas", { detail: parseInt(e.key) }),
        );
      }
      // 0 → jump to blank/least-used canvas; App.tsx handles cloud vs local logic
      if (e.key === "0" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(new CustomEvent("drawtool:find-blank-canvas"));
      }
      if (e.key === "k" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey && !isWritingRef.current) {
        const group = selectedGroupRef.current;
        const single = selectedTextRef.current;
        const targets = group.length > 0 ? [...group] : single ? [single] : [];
        if (targets.length > 0) {
          const allLocked = targets.every(s => s.locked);
          const toLocked = !allLocked;
          undoStackRef.current.push({ type: "lock", strokes: targets, to: toLocked });
          redoStackRef.current = [];
          for (const s of targets) { s.locked = toLocked ? true : undefined; }
          if (toLocked) {
            selectedTextRef.current = null;
            selectedGroupRef.current = [];
            selectDragRef.current = null;
            groupDragRef.current = null;
            hoverTextRef.current = null;
            lastCycleRef.current = null;
            setZCursor(zKeyRef.current ? "default" : null);
          }
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
          window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: toLocked ? "Locked" : "Unlocked" }));
        }
      }
      if (e.key === "Escape" && (selectedTextRef.current || selectedGroupRef.current.length > 0 || boxSelectRef.current || selectLockedRef.current)) {
        e.preventDefault();
        selectedTextRef.current = null;
        hoverTextRef.current = null;
        selectDragRef.current = null;
        selectedGroupRef.current = [];
        groupDragRef.current = null;
        boxSelectRef.current = null;
        lastCycleRef.current = null;
        lastTextTapRef.current = null;
        selectLockedRef.current = false;
        zKeyRef.current = false;
        setZCursor(null);
        scheduleRedraw();
        window.dispatchEvent(new CustomEvent("drawtool:select-held", { detail: { on: false } }));
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedLinePointRef.current !== null && !isWritingRef.current) {
        const stroke = selectedTextRef.current;
        if (stroke && (stroke.shape === "arrow" || stroke.shape === "line") && stroke.points.length > 2) {
          e.preventDefault();
          const ci = selectedLinePointRef.current;
          const from = stroke.points.map(p => ({ ...p }));
          stroke.points.splice(ci, 1);
          const to = stroke.points.map(p => ({ ...p }));
          undoStackRef.current.push({ type: "reshape", stroke, from, to });
          redoStackRef.current = [];
          selectedLinePointRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
          return;
        }
        selectedLinePointRef.current = null;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedGroupRef.current.length > 0 && !isWritingRef.current) {
        e.preventDefault();
        const toDelete = selectedGroupRef.current;
        const deleteIndices = toDelete.map(s => strokesRef.current.indexOf(s));
        strokesRef.current = strokesRef.current.filter(s => !toDelete.includes(s));
        undoStackRef.current.push({ type: "erase", strokes: toDelete, indices: deleteIndices });
        redoStackRef.current = [];
        selectedGroupRef.current = [];
        selectDragRef.current = null;
        hoverTextRef.current = null;
        groupDragRef.current = null;
        lastCycleRef.current = null;
        strokesCacheRef.current = null;
        setZCursor(zKeyRef.current ? "default" : null);
        persistStrokes();
        scheduleRedraw();
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedTextRef.current && !isWritingRef.current) {
        e.preventDefault();
        const stroke = selectedTextRef.current;
        const deleteIdx = strokesRef.current.indexOf(stroke);
        strokesRef.current = strokesRef.current.filter((s) => s !== stroke);
        undoStackRef.current.push({ type: "erase", strokes: [stroke], indices: [deleteIdx] });
        redoStackRef.current = [];
        selectedTextRef.current = null;
        selectDragRef.current = null;
        selectedLinePointRef.current = null;
        strokesCacheRef.current = null;
        setZCursor(zKeyRef.current ? "default" : null);
        persistStrokes();
        scheduleRedraw();
        return;
      }
      // Cmd+Shift+J - uncombine selected compound stroke back to originals
      if (cmdKey(e) && e.key === "j" && e.shiftKey && !e.altKey && !isWritingRef.current) {
        const stroke = selectedTextRef.current;
        if (stroke?.subStrokes) {
          e.preventDefault();
          // If the combined stroke has been rotated, bake that rotation into each sub-stroke
          // so the individual strokes appear in the correct rotated positions.
          let originals: Stroke[];
          if (stroke.rotation) {
            const R = stroke.rotation;
            const cb = anyStrokeBBox(stroke);
            const gcx = cb.x + cb.w / 2, gcy = cb.y + cb.h / 2;
            const cos = Math.cos(R), sin = Math.sin(R);
            originals = stroke.subStrokes.map(sub => {
              const newStroke: Stroke = { ...sub, points: sub.points.map(p => ({ ...p })) };
              if (newStroke.shape === "arrow" || newStroke.shape === "line") {
                // Rotate each point directly around combined center
                newStroke.points = sub.points.map(p => ({
                  x: gcx + (p.x - gcx) * cos - (p.y - gcy) * sin,
                  y: gcy + (p.x - gcx) * sin + (p.y - gcy) * cos,
                }));
              } else {
                const sc = anyStrokeBBox(sub);
                const scx = sc.x + sc.w / 2, scy = sc.y + sc.h / 2;
                const dx2 = scx - gcx, dy2 = scy - gcy;
                const ncx = gcx + dx2 * cos - dy2 * sin;
                const ncy = gcy + dx2 * sin + dy2 * cos;
                const tx = ncx - scx, ty = ncy - scy;
                newStroke.points = sub.points.map(p => ({ x: p.x + tx, y: p.y + ty }));
                newStroke.rotation = ((sub.rotation ?? 0) + R) || undefined;
              }
              return newStroke;
            });
          } else {
            originals = stroke.subStrokes;
          }
          const idx = strokesRef.current.indexOf(stroke);
          const insertIndex = idx !== -1 ? idx : strokesRef.current.length;
          if (idx !== -1) strokesRef.current.splice(idx, 1, ...originals);
          else strokesRef.current.push(...originals);
          undoStackRef.current.push({ type: "uncombine", combined: stroke, originals, insertIndex });
          redoStackRef.current = [];
          selectedGroupRef.current = originals;
          selectedTextRef.current = null;
          selectDragRef.current = null;
          hoverTextRef.current = null;
          groupDragRef.current = null;
          lastCycleRef.current = null;
          strokesCacheRef.current = null;
          setZCursor("default");
          persistStrokes();
          scheduleRedraw();
        }
        return;
      }
      // Cmd+J - combine selected strokes into one compound stroke
      if (cmdKey(e) && e.key === "j" && !e.shiftKey && !e.altKey && !isWritingRef.current) {
        const toMerge = selectedGroupRef.current;
        if (toMerge.length >= 2) {
          e.preventDefault();
          const originalIndices = toMerge.map(s => strokesRef.current.indexOf(s));
          const insertIndex = originalIndices.reduce((min, i) => i !== -1 && i < min ? i : min, Infinity);
          const combined: import("../canvas/types").Stroke = {
            points: [],
            style: "solid",
            lineWidth: 0,
            color: "transparent",
            subStrokes: [...toMerge],
          };
          strokesRef.current = strokesRef.current.filter(s => !toMerge.includes(s));
          strokesRef.current.splice(insertIndex === Infinity ? strokesRef.current.length : insertIndex, 0, combined);
          undoStackRef.current.push({ type: "combine", combined, originals: toMerge, insertIndex: insertIndex === Infinity ? strokesRef.current.length - 1 : insertIndex, originalIndices });
          redoStackRef.current = [];
          selectedGroupRef.current = [];
          selectedTextRef.current = combined;
          selectDragRef.current = null;
          hoverTextRef.current = null;
          groupDragRef.current = null;
          lastCycleRef.current = null;
          strokesCacheRef.current = null;
          setZCursor("default");
          persistStrokes();
          scheduleRedraw();
        }
        return;
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
      if (e.key === "Escape" && activeModifierRef.current === "laser") {
        e.preventDefault();
        laserTrailRef.current = [];
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        setLasering(false);
        scheduleRedraw();
      }
      if (e.key === " " && !isWritingRef.current && !e.repeat) {
        e.preventDefault();
        spaceDownRef.current = true;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      }
      if (e.key === " " && e.repeat) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") {
        if (!selectLockedRef.current) {
          zKeyRef.current = false;
          if (hoverTextRef.current) {
            hoverTextRef.current = null;
            scheduleRedraw();
          }
          // Keep arrow cursor if something is still selected
          if (!selectedTextRef.current && selectedGroupRef.current.length === 0) {
            setZCursor(null);
          }
          window.dispatchEvent(new CustomEvent("drawtool:select-held", { detail: { on: false } }));
        }
      }
      if (e.key === " ") {
        spaceDownRef.current = false;
        if (isPanningRef.current) {
          isPanningRef.current = false;
          setPanning(false);
          persistView();
        }
        if (canvasRef.current) canvasRef.current.style.cursor = cursorRef.current;
      }
      if (e.key === "Alt") {
        setErasing(false);
        if (activeModifierRef.current === "alt") {
          confirmErase();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
        }
      }
      if (e.key === "q" || e.key === "l") {
        laserKeyRef.current = false;
        setLasering(false);
        if (activeModifierRef.current === "laser") {
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          window.dispatchEvent(new Event("drawtool:laser-used"));
        }
      }
      if (e.key === "w" || e.key === "h") {
        highlightKeyRef.current = false;
        setHighlighting(false);
        if (activeModifierRef.current === "highlight") {
          const _committed = strokesRef.current[strokesRef.current.length - 1];
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          if (_committed?.highlight) {
            window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
              detail: { shape: _committed.shape, style: _committed.style, color: _committed.color, fill: _committed.fill, text: _committed.text, fontFamily: _committed.fontFamily, sharp: _committed.sharp, highlight: _committed.highlight, spray: _committed.spray, points: _committed.points.length },
            }));
          }
        }
      }
      if (e.key === "b") {
        sprayKeyRef.current = false;
        setSpraying(false);
        if (activeModifierRef.current === "spray") {
          const _committed = strokesRef.current[strokesRef.current.length - 1];
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          if (_committed?.spray) {
            window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
              detail: { shape: _committed.shape, style: _committed.style, color: _committed.color, fill: _committed.fill, text: _committed.text, fontFamily: _committed.fontFamily, sharp: _committed.sharp, highlight: _committed.highlight, spray: _committed.spray, points: _committed.points.length },
            }));
          }
        }
      }
      if (e.key === "Shift") {
        shiftHeldRef.current = false;
        // Line multi-segment: Shift release finalizes the in-progress line
        if (activeModifierRef.current === "line" && isDrawingRef.current) {
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.shape === "line" && stroke.points.length > 2) {
            const n = stroke.points.length;
            const last = stroke.points[n - 1];
            const prev = stroke.points[n - 2];
            if (Math.hypot(last.x - prev.x, last.y - prev.y) < 1) {
              stroke.points.pop();
            }
          }
          const _lineCommitted = strokesRef.current[strokesRef.current.length - 1];
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          if (_lineCommitted && strokesRef.current[strokesRef.current.length - 1] === _lineCommitted) {
            window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
              detail: { shape: _lineCommitted.shape, style: _lineCommitted.style, color: _lineCommitted.color, fill: _lineCommitted.fill, text: _lineCommitted.text, fontFamily: _lineCommitted.fontFamily, sharp: _lineCommitted.sharp, highlight: _lineCommitted.highlight, spray: _lineCommitted.spray, points: _lineCommitted.points.length },
            }));
          }
          scheduleRedraw();
        }
        if (keyShapeRef.current) {
          keyShapeDashedRef.current = false;
          // Don't retroactively convert the in-progress stroke to solid - dashed state is locked at creation.
        }
      }
      if (e.key === "Meta" || (e.key === "Control" && !isMac)) {
        // Line multi-segment: Cmd/Ctrl release finalizes the in-progress line
        if (activeModifierRef.current === "line" && isDrawingRef.current) {
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.shape === "line" && stroke.points.length > 2) {
            const n = stroke.points.length;
            const last = stroke.points[n - 1];
            const prev = stroke.points[n - 2];
            if (Math.hypot(last.x - prev.x, last.y - prev.y) < 1) {
              stroke.points.pop();
            }
          }
          const _lineCommitted = strokesRef.current[strokesRef.current.length - 1];
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          if (_lineCommitted && strokesRef.current[strokesRef.current.length - 1] === _lineCommitted) {
            window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
              detail: { shape: _lineCommitted.shape, style: _lineCommitted.style, color: _lineCommitted.color, fill: _lineCommitted.fill, text: _lineCommitted.text, fontFamily: _lineCommitted.fontFamily, sharp: _lineCommitted.sharp, highlight: _lineCommitted.highlight, spray: _lineCommitted.spray, points: _lineCommitted.points.length },
            }));
          }
          scheduleRedraw();
        }
      }
      if (e.key === "f" || e.key === "F") {
        fKeyHeldRef.current = false;
      }
      if ((e.key === "s" || e.key === "S") && !cmdKey(e)) {
        if (shapeFlashRef.current) { clearTimeout(shapeFlashRef.current); shapeFlashRef.current = null; }
        const wasTap = sHintTimerRef.current !== null;
        if (sHintTimerRef.current) { clearTimeout(sHintTimerRef.current); sHintTimerRef.current = null; }
        keyShapeRef.current = null;
        keyShapeDashedRef.current = false;
        if (activeModifierRef.current === "shape") {
          // Draw still in progress - commit it (same path as a/r/c)
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.shape === "arrow" && stroke.points.length > 2) {
            const n = stroke.points.length;
            const last = stroke.points[n - 1];
            const prev = stroke.points[n - 2];
            if (Math.hypot(last.x - prev.x, last.y - prev.y) < 1) stroke.points.pop();
          }
          shapeJustCommittedRef.current = true;
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          const _committed = strokesRef.current[strokesRef.current.length - 1];
          if (_committed?.shape) {
            window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
              detail: { shape: _committed.shape, style: _committed.style, color: _committed.color, fill: _committed.fill, text: _committed.text, fontFamily: _committed.fontFamily, sharp: _committed.sharp, highlight: _committed.highlight, spray: _committed.spray, points: _committed.points.length },
            }));
          }
          scheduleRedraw();
          setShapeActive(false);
        } else if (wasTap && !shapeJustCommittedRef.current) {
          // Released before 500ms with no draw - cycle shape, flash shows the new one
          window.dispatchEvent(new Event(sKeyBackwardRef.current ? "drawtool:cycle-shape-back" : "drawtool:cycle-shape"));
          setShapeActive(true);
          shapeFlashRef.current = setTimeout(() => {
            setShapeActive(false);
            shapeFlashRef.current = null;
          }, 300);
        } else {
          // Peek (held > 500ms, no draw) or draw committed via pointer-up - just clean up
          setShapeActive(false);
        }
      }
      if (["a", "r", "t", "c", "A", "R", "T", "C"].includes(e.key)) {
        keyShapeRef.current = null;
        keyShapeDashedRef.current = false;
        setShapeActive(false);
        if (activeModifierRef.current === "shape") {
          // Arrow multi-segment: trim dangling trailing point added on last pointer-up bend
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.shape === "arrow" && stroke.points.length > 2) {
            const n = stroke.points.length;
            const last = stroke.points[n - 1];
            const prev = stroke.points[n - 2];
            if (Math.hypot(last.x - prev.x, last.y - prev.y) < 1) {
              stroke.points.pop();
            }
          }
          shapeJustCommittedRef.current = true;
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          const _committed = strokesRef.current[strokesRef.current.length - 1];
          if (_committed?.shape) {
            window.dispatchEvent(new CustomEvent("drawtool:stroke-committed", {
              detail: { shape: _committed.shape, style: _committed.style, color: _committed.color, fill: _committed.fill, text: _committed.text, fontFamily: _committed.fontFamily, sharp: _committed.sharp, highlight: _committed.highlight, spray: _committed.spray, points: _committed.points.length },
            }));
          }
          scheduleRedraw();
        }
      }
    };

    const onBlur = () => {
      selectLockedRef.current = false;
      zKeyRef.current = false;
      if (hoverTextRef.current) {
        hoverTextRef.current = null;
        scheduleRedraw();
      }
      setZCursor(null);
      spaceDownRef.current = false;
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setPanning(false);
        persistView();
      }
      if (sHintTimerRef.current) { clearTimeout(sHintTimerRef.current); sHintTimerRef.current = null; }
      window.dispatchEvent(new CustomEvent("drawtool:select-held", { detail: { on: false } }));
      setErasing(false);
      setShapeActive(false);
      setHighlighting(false);
      setLasering(false);
      highlightKeyRef.current = false;
      laserKeyRef.current = false;
      sprayKeyRef.current = false;
      shiftHeldRef.current = false;
      keyShapeRef.current = null;
      keyShapeDashedRef.current = false;
      fKeyHeldRef.current = false;
      if (activeModifierRef.current === "alt") {
        cancelErase();
      }
      if (activeModifierRef.current === "line" && isDrawingRef.current) {
        // Finalize any in-progress multi-segment line
        const stroke = strokesRef.current[strokesRef.current.length - 1];
        if (stroke?.shape === "line" && stroke.points.length > 2) {
          const n = stroke.points.length;
          const last = stroke.points[n - 1];
          const prev = stroke.points[n - 2];
          if (Math.hypot(last.x - prev.x, last.y - prev.y) < 1) {
            stroke.points.pop();
          }
        }
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        strokesCacheRef.current = null;
        persistStrokes();
      }
      if (activeModifierRef.current === "highlight") {
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }
      if (activeModifierRef.current === "laser") {
        laserTrailRef.current = [];
        isDrawingRef.current = false;
        activeModifierRef.current = null;
      }
    };

    const doPasteInternal = () => {
      const srcs = clipboardRef.current;
      if (!srcs) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of srcs) {
        const bb = anyStrokeBBox(s);
        minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rawCursor = cursorWorldRef.current;
      const cursor = (rawCursor.x !== 0 || rawCursor.y !== 0) ? rawCursor : (() => {
        const view = viewRef.current;
        const canvas = canvasRef.current;
        const w = canvas ? canvas.offsetWidth : window.innerWidth;
        const h = canvas ? canvas.offsetHeight : window.innerHeight;
        return { x: (w / 2 - view.x) / view.scale, y: (h / 2 - view.y) / view.scale };
      })();
      const dx = cursor.x - cx;
      const dy = cursor.y - cy;
      const newStrokes: Stroke[] = srcs.map(src => deepCopyStroke(src, dx, dy));
      strokesRef.current.push(...newStrokes);
      if (newStrokes.length === 1) {
        undoStackRef.current.push({ type: "draw", stroke: newStrokes[0] });
      } else {
        undoStackRef.current.push({ type: "multi-draw", strokes: newStrokes });
      }
      redoStackRef.current = [];
      if (newStrokes.length === 1) {
        selectedTextRef.current = newStrokes[0];
        selectedGroupRef.current = [];
      } else {
        selectedGroupRef.current = newStrokes;
        selectedTextRef.current = null;
      }
      setZCursor("default");
      strokesCacheRef.current = null;
      scheduleRedraw();
      persistStrokes();
    };

    const onPaste = (e: ClipboardEvent) => {
      if (canvasIndexRef.current > canvasLimitRef.current && !isWritingRef.current) return;
      if (isWritingRef.current) {
        // Primary handler is on the textarea element (fires when textarea has focus + stops propagation).
        // This window-level fallback handles the case where focus drifted away from the textarea.
        e.preventDefault();
        const pasted = e.clipboardData?.getData("text/plain");
        if (pasted) {
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
          const ta = textareaRef?.current;
          if (ta) { ta.value = writingTextRef.current; const c = caretPosRef.current; ta.setSelectionRange(c, c); }
          scheduleRedraw();
        }
        return;
      }

      const clipboardText = e.clipboardData?.getData("text/plain") ?? "";
      const hasDrawtoolClip = clipboardText === "drawtool-clip";

      // If our sentinel is in the system clipboard, the last copy was a shape - use internal clipboard
      if (hasDrawtoolClip && clipboardRef.current) {
        e.preventDefault();
        doPasteInternal();
        return;
      }

      // No sentinel (or no internal clipboard) - check for image in system clipboard
      const items = e.clipboardData?.items;
      const imageItem = items ? Array.from(items).find(item => item.type.startsWith("image/")) : null;
      if (imageItem) {
        const blob = imageItem.getAsFile();
        if (blob) {
          e.preventDefault();
          processImageFile(blob).then(async ({ dataUrl, naturalW, naturalH }) => {
            const id = crypto.randomUUID();
            await storeImage(id, dataUrl);
            if (!mounted) return;
            const view = viewRef.current;
            const MAX_SCREEN_W = 600;
            const worldW = Math.min(naturalW, MAX_SCREEN_W / view.scale);
            const worldH = naturalH * (worldW / naturalW);
            const rawCursor = cursorWorldRef.current;
            const cursor = (rawCursor.x !== 0 || rawCursor.y !== 0) ? rawCursor : (() => {
              const view = viewRef.current;
              const canvas = canvasRef.current;
              const w = canvas ? canvas.offsetWidth : window.innerWidth;
              const h = canvas ? canvas.offsetHeight : window.innerHeight;
              return { x: (w / 2 - view.x) / view.scale, y: (h / 2 - view.y) / view.scale };
            })();
            const anchor = { x: cursor.x - worldW / 2, y: cursor.y - worldH / 2 };
            const stroke: import("../canvas/types").Stroke = {
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
            strokesCacheRef.current = null;
            persistStrokes();
            scheduleRedraw();
          }).catch(() => {/* ignore */});
        }
      }
    };

    const onPasteInternal = () => {
      if (canvasIndexRef.current > canvasLimitRef.current) return;
      if (isWritingRef.current) return;
      doPasteInternal();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("paste", onPaste);
    window.addEventListener("drawtool:paste", onPasteInternal);
    return () => {
      mounted = false;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("drawtool:paste", onPasteInternal);
    };
  }, [
    clearCanvas,
    persistStrokes,
    persistView,
    scheduleRedraw,
    confirmErase,
    cancelErase,
    cancelCurrentStroke,
    discardTinyShape,
    notifyColorUsed,
    undo,
    redo,
    setZCursor,
    setPanning,
    setErasing,
    setShapeActive,
    setHighlighting,
    setLasering,
  ]);
}
