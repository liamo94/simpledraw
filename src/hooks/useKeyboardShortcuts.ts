import { useEffect } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { ShapeKind, TextSize, FontFamily, TextAlign } from "./useSettings";
import type { Stroke, UndoAction, BBox } from "../canvas/types";
import { cmdKey, isMac, textBBox, anyStrokeBBox, FONT_FAMILIES } from "../canvas/geometry";

// ─── Ref bag type ─────────────────────────────────────────────────────────────

export type KeyboardRefs = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  strokesRef: MutableRefObject<Stroke[]>;
  undoStackRef: MutableRefObject<UndoAction[]>;
  redoStackRef: MutableRefObject<UndoAction[]>;
  strokesCacheRef: MutableRefObject<{ canvas: HTMLCanvasElement; key: string } | null>;
  viewRef: MutableRefObject<{ x: number; y: number; scale: number }>;
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
    mode: "move" | "corner";
    corner?: 0 | 1 | 2 | 3;
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[];
    startScale: number;
    bbox: BBox;
    cycleHits?: Stroke[];
  } | null>;
  selectedGroupRef: MutableRefObject<Stroke[]>;
  groupDragRef: MutableRefObject<{
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[][];
  } | null>;
  boxSelectRef: MutableRefObject<{ start: { x: number; y: number }; end: { x: number; y: number }; containOnly?: boolean } | null>;
  clipboardRef: MutableRefObject<Stroke[] | null>;
  cursorWorldRef: MutableRefObject<{ x: number; y: number }>;
  lastDPressRef: MutableRefObject<number>;
  shapeFlashRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  textSizeRef: MutableRefObject<TextSize>;
  fontFamilyRef: MutableRefObject<FontFamily>;
  lineColorRef: MutableRefObject<string>;
  lineWidthRef: MutableRefObject<number>;
  laserTrailRef: MutableRefObject<{ x: number; y: number }[]>;
  isDrawingRef: MutableRefObject<boolean>;
  isZoomingRef: MutableRefObject<boolean>;
  activeModifierRef: MutableRefObject<"meta" | "shift" | "alt" | "line" | "shape" | "highlight" | "laser" | null>;
  spaceDownRef: MutableRefObject<boolean>;
  isPanningRef: MutableRefObject<boolean>;
  highlightKeyRef: MutableRefObject<boolean>;
  laserKeyRef: MutableRefObject<boolean>;
  shiftHeldRef: MutableRefObject<boolean>;
  keyShapeRef: MutableRefObject<ShapeKind | null>;
  keyShapeDashedRef: MutableRefObject<boolean>;
  shapeJustCommittedRef: MutableRefObject<boolean>;
  fKeyHeldRef: MutableRefObject<boolean>;
  finishWritingRef: MutableRefObject<() => void>;
  startWritingRef: MutableRefObject<(pos: { x: number; y: number }) => void>;
  cursorRef: MutableRefObject<string>;
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
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKeyboardShortcuts(refs: KeyboardRefs, callbacks: KeyboardCallbacks) {
  const {
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
  } = refs;

  const {
    scheduleRedraw, persistStrokes, persistView, clearCanvas,
    undo, redo, confirmErase, cancelErase, cancelCurrentStroke, discardTinyShape, notifyColorUsed,
    setZCursor, setPanning, setErasing, setShapeActive, setHighlighting, setLasering,
  } = callbacks;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Handle text input while in writing mode
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
        // Helper: replace selection (or nothing) with a string, clear selection
        const replaceSelection = (insert: string) => {
          textUndoRef.current.push(text);
          textRedoRef.current = [];
          writingTextRef.current = text.slice(0, selStart) + insert + text.slice(selEnd);
          caretPosRef.current = selStart + insert.length;
          selectionAnchorRef.current = null;
          caretVisibleRef.current = true;
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
            redoStackRef.current = [];
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
            redoStackRef.current = [];
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
              redoStackRef.current = [];
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
            let i = pos - 1;
            while (i > 0 && text[i - 1] === " ") i--;
            while (i > 0 && text[i - 1] !== " " && text[i - 1] !== "\n") i--;
            writingTextRef.current = text.slice(0, i) + text.slice(pos);
            caretPosRef.current = i;
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
            scheduleRedraw();
          }
          return;
        }
        // Enter → replace selection or insert newline
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
                let i = pos - 1;
                while (i > 0 && text[i - 1] === " ") i--;
                while (i > 0 && text[i - 1] !== " " && text[i - 1] !== "\n") i--;
                caretPosRef.current = i;
              } else {
                caretPosRef.current = pos - 1;
              }
            }
            if (!e.shiftKey) selectionAnchorRef.current = null;
          }
          caretVisibleRef.current = true;
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
                let i = pos;
                while (i < text.length && text[i] === " ") i++;
                while (i < text.length && text[i] !== " " && text[i] !== "\n") i++;
                caretPosRef.current = i;
              } else {
                caretPosRef.current = pos + 1;
              }
            }
            if (!e.shiftKey) selectionAnchorRef.current = null;
          }
          caretVisibleRef.current = true;
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
            scheduleRedraw();
          }
          if (!e.shiftKey) selectionAnchorRef.current = null;
          return;
        }
        // Ignore other modifier combos (Cmd+C, Cmd+V handled elsewhere)
        if (e.metaKey || e.ctrlKey || e.altKey) {
          return;
        }
        // Tab → replace selection or insert spaces
        if (e.key === "Tab") {
          e.preventDefault();
          replaceSelection("  ");
          return;
        }
        // Printable character → replace selection or insert at caret
        if (e.key.length === 1) {
          e.preventDefault();
          replaceSelection(e.key);
          return;
        }
        // Ignore other keys (Shift, Ctrl, etc.)
        return;
      }
      if (e.key === "t" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        startWritingRef.current({ ...cursorWorldRef.current });
        return;
      }
      if ((e.key === "v" || e.key === "V") && !e.repeat && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        zKeyRef.current = true;
        setZCursor("default");
      }
      if (e.key === "T" && e.shiftKey && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        const sizes: TextSize[] = ["xs", "s", "m", "l", "xl"];
        const labels: Record<TextSize, string> = { xs: "XS", s: "S", m: "M", l: "L", xl: "XL" };
        const cur = textSizeRef.current;
        const idx = sizes.indexOf(cur);
        const next = sizes[(idx + 1) % sizes.length];
        window.dispatchEvent(new CustomEvent("drawtool:text-size", { detail: next }));
        window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: `Text: ${labels[next]}` }));
        return;
      }
      if (e.key === "F" && e.shiftKey && !cmdKey(e) && !e.altKey && !e.ctrlKey && !isWritingRef.current) {
        const cur = fontFamilyRef.current;
        const idx = FONT_FAMILIES.findIndex(f => f.key === cur);
        const next = FONT_FAMILIES[(idx + 1) % FONT_FAMILIES.length];
        window.dispatchEvent(new CustomEvent("drawtool:font-family", { detail: next.key }));
        window.dispatchEvent(new CustomEvent("drawtool:toast", { detail: `Font: ${next.label}` }));
        const sel = selectedTextRef.current;
        if (sel && sel.text) {
          undoStackRef.current.push({ type: "font-change", stroke: sel, from: sel.fontFamily, to: next.key });
          redoStackRef.current = [];
          sel.fontFamily = next.key;
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
        }
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
          clipboardRef.current = toDelete.map(s => ({ ...s, points: s.points.map(p => ({ ...p })), widths: s.widths ? [...s.widths] : undefined }));
          strokesRef.current = strokesRef.current.filter(s => !toDelete.includes(s));
          undoStackRef.current.push({ type: "erase", strokes: toDelete });
          redoStackRef.current = [];
          selectedGroupRef.current = [];
          groupDragRef.current = null;
          strokesCacheRef.current = null;
          setZCursor(zKeyRef.current ? "default" : null);
          persistStrokes();
          scheduleRedraw();
        } else if (selectedTextRef.current && !isWritingRef.current) {
          const stroke = selectedTextRef.current;
          clipboardRef.current = [stroke];
          strokesRef.current = strokesRef.current.filter(s => s !== stroke);
          undoStackRef.current.push({ type: "erase", strokes: [stroke] });
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
        const all = strokesRef.current.filter(s => s.points.length > 0);
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
          clipboardRef.current = selectedGroupRef.current.map(s => ({ ...s, points: s.points.map(p => ({ ...p })), widths: s.widths ? [...s.widths] : undefined }));
        } else if (selectedTextRef.current) {
          clipboardRef.current = [selectedTextRef.current];
        }
      }
      if (cmdKey(e) && e.key === "v" && !e.shiftKey && clipboardRef.current) {
        e.preventDefault();
        const srcs = clipboardRef.current;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of srcs) {
          const bb = anyStrokeBBox(s);
          minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
          maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const cursor = cursorWorldRef.current;
        const dx = cursor.x - cx;
        const dy = cursor.y - cy;
        const newStrokes: Stroke[] = srcs.map(src => ({
          ...src,
          points: src.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
          widths: src.widths ? [...src.widths] : undefined,
        }));
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
      }
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
        window.dispatchEvent(new CustomEvent("drawtool:thickness", { detail: 1 }));
      }
      if (e.key === "{" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("drawtool:thickness", { detail: -1 }));
      }
      if (e.key === "m" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:toggle-menu"));
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
      if (cmdKey(e) && e.key === "0") {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:reset-view"));
      }
      if (cmdKey(e) && e.key === "1") {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:center-view"));
      }
      if (e.key === "[") {
        window.dispatchEvent(new CustomEvent("drawtool:color-cycle", { detail: -1 }));
      }
      if (e.key === "]") {
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
          }
        } else if (selectedTextRef.current) {
          const stroke = selectedTextRef.current;
          const from = stroke.points.map(p => ({ ...p }));
          for (const p of stroke.points) { p.x += dx; p.y += dy; }
          const to = stroke.points.map(p => ({ ...p }));
          if (!e.repeat) {
            undoStackRef.current.push({ type: "move", stroke, from, to });
            redoStackRef.current = [];
          }
        }
        strokesCacheRef.current = null;
        scheduleRedraw();
        if (!e.repeat) persistStrokes();
        return;
      }
      const panAmount = e.shiftKey ? 200 : 50;
      if (e.key === "ArrowUp" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.y -= panAmount;
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistView();
      }
      if (e.key === "ArrowDown" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.y += panAmount;
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistView();
      }
      if (e.key === "ArrowLeft" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.x -= panAmount;
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistView();
      }
      if (e.key === "ArrowRight" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        viewRef.current.x += panAmount;
        strokesCacheRef.current = null;
        scheduleRedraw();
        persistView();
      }
      if (cmdKey(e) && e.key === "d" && !isWritingRef.current) {
        e.preventDefault();
        const offset = 16;
        const srcs = selectedGroupRef.current.length > 0
          ? selectedGroupRef.current
          : selectedTextRef.current ? [selectedTextRef.current] : [];
        if (srcs.length > 0) {
          const newStrokes: Stroke[] = srcs.map(src => ({
            ...src,
            points: src.points.map(p => ({ x: p.x + offset, y: p.y + offset })),
            widths: src.widths ? [...src.widths] : undefined,
          }));
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
      if (cmdKey(e) && (e.key === "]" || e.key === "[") && !e.altKey && !isWritingRef.current) {
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
          const forward = e.key === "]";
          const extreme = e.shiftKey;
          const topIdx = strokes.indexOf(sel[sel.length - 1]);
          const insertPos = rest.filter(s => strokes.indexOf(s) < topIdx).length;
          const newInsertPos = extreme
            ? (forward ? rest.length : 0)
            : forward
              ? Math.min(rest.length, insertPos + 1)
              : Math.max(0, insertPos - 1);
          strokesRef.current = [...rest.slice(0, newInsertPos), ...sel, ...rest.slice(newInsertPos)];
          undoStackRef.current.push({ type: "reorder", before, after: [...strokesRef.current] });
          redoStackRef.current = [];
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
          const label = extreme
            ? (forward ? "Brought to front" : "Sent to back")
            : (forward ? "Brought forward" : "Sent backward");
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
      if (e.key === "f" && !e.metaKey) {
        fKeyHeldRef.current = true;
        if (isDrawingRef.current && activeModifierRef.current === "shape") {
          const stroke = strokesRef.current[strokesRef.current.length - 1];
          if (stroke?.shape) { stroke.fill = true; scheduleRedraw(); }
        }
      }
      if (e.key === "p" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(new Event("drawtool:toggle-pressure"));
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
      if (e.key === "Alt" && e.shiftKey && !isMac) setShapeActive(true);
      if (e.key === "Shift" && e.altKey && !isMac) {
        setErasing(false);
        setShapeActive(true);
      }
      if (e.key === "Control" && isMac && !isZoomingRef.current) setShapeActive(true);
      if (e.key === "s" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(new Event("drawtool:cycle-shape"));
        if (shapeFlashRef.current) clearTimeout(shapeFlashRef.current);
        setShapeActive(true);
        shapeFlashRef.current = setTimeout(() => {
          setShapeActive(false);
          shapeFlashRef.current = null;
        }, 300);
      }
      if (e.key === "S" && !cmdKey(e) && !e.altKey && !e.ctrlKey && e.shiftKey) {
        window.dispatchEvent(new Event("drawtool:cycle-shape-back"));
        if (shapeFlashRef.current) clearTimeout(shapeFlashRef.current);
        setShapeActive(true);
        shapeFlashRef.current = setTimeout(() => {
          setShapeActive(false);
          shapeFlashRef.current = null;
        }, 300);
      }
      if ((e.key === "w" || e.key === "h") && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        highlightKeyRef.current = true;
        setHighlighting(true);
      }
      if ((e.key === "q" || e.key === "l") && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        laserKeyRef.current = true;
        setLasering(true);
      }
      // Letter-key shape shortcuts (lowercase = solid, uppercase/shift = dashed)
      const shapeKeyMap: Record<string, ShapeKind> = {
        a: "arrow", A: "arrow",
        r: "rectangle", R: "rectangle",
        c: "circle", C: "circle",
      };
      if (shapeKeyMap[e.key] && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        keyShapeRef.current = shapeKeyMap[e.key];
        keyShapeDashedRef.current = shiftHeldRef.current;
        shapeJustCommittedRef.current = false;
        setShapeActive(true);
      }
      // Number keys 1-9 for canvas switching
      if (e.key >= "1" && e.key <= "9" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(
          new CustomEvent("drawtool:switch-canvas", { detail: parseInt(e.key) }),
        );
      }
      if (e.key === "Escape" && (selectedTextRef.current || selectedGroupRef.current.length > 0 || boxSelectRef.current)) {
        e.preventDefault();
        selectedTextRef.current = null;
        hoverTextRef.current = null;
        selectDragRef.current = null;
        selectedGroupRef.current = [];
        groupDragRef.current = null;
        boxSelectRef.current = null;
        zKeyRef.current = false;
        setZCursor(null);
        scheduleRedraw();
        return;
      }
      if (e.key === "Backspace" && selectedGroupRef.current.length > 0 && !isWritingRef.current) {
        e.preventDefault();
        const toDelete = selectedGroupRef.current;
        strokesRef.current = strokesRef.current.filter(s => !toDelete.includes(s));
        undoStackRef.current.push({ type: "erase", strokes: toDelete });
        redoStackRef.current = [];
        selectedGroupRef.current = [];
        groupDragRef.current = null;
        strokesCacheRef.current = null;
        persistStrokes();
        scheduleRedraw();
        return;
      }
      if (e.key === "Backspace" && selectedTextRef.current && !isWritingRef.current) {
        e.preventDefault();
        const stroke = selectedTextRef.current;
        strokesRef.current = strokesRef.current.filter((s) => s !== stroke);
        undoStackRef.current.push({ type: "erase", strokes: [stroke] });
        redoStackRef.current = [];
        selectedTextRef.current = null;
        selectDragRef.current = null;
        strokesCacheRef.current = null;
        setZCursor(zKeyRef.current ? "default" : null);
        persistStrokes();
        scheduleRedraw();
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
        zKeyRef.current = false;
        if (hoverTextRef.current) {
          hoverTextRef.current = null;
          scheduleRedraw();
        }
        setZCursor(null);
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
        }
      }
      if (e.key === "w" || e.key === "h") {
        highlightKeyRef.current = false;
        setHighlighting(false);
        if (activeModifierRef.current === "highlight") {
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
        }
      }
      if (e.key === "Shift") {
        shiftHeldRef.current = false;
        if (keyShapeRef.current) {
          keyShapeDashedRef.current = false;
          if (isDrawingRef.current && activeModifierRef.current === "shape") {
            const stroke = strokesRef.current[strokesRef.current.length - 1];
            if (stroke?.shape) {
              stroke.style = "solid";
              stroke.dashGap = undefined;
              scheduleRedraw();
            }
          }
        }
      }
      if (e.key === "f") {
        fKeyHeldRef.current = false;
      }
      if (e.key === "Control" && isMac) setShapeActive(false);
      if ((e.key === "Alt" || e.key === "Shift") && !isMac) setShapeActive(false);
      if (["a", "r", "t", "c", "A", "R", "T", "C"].includes(e.key)) {
        keyShapeRef.current = null;
        keyShapeDashedRef.current = false;
        setShapeActive(false);
        if (activeModifierRef.current === "shape") {
          shapeJustCommittedRef.current = true;
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
        }
      }
    };

    const onBlur = () => {
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
      setErasing(false);
      setShapeActive(false);
      setHighlighting(false);
      setLasering(false);
      highlightKeyRef.current = false;
      laserKeyRef.current = false;
      shiftHeldRef.current = false;
      keyShapeRef.current = null;
      keyShapeDashedRef.current = false;
      fKeyHeldRef.current = false;
      if (activeModifierRef.current === "alt") {
        cancelErase();
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

    const onPaste = (e: ClipboardEvent) => {
      if (!isWritingRef.current) return;
      e.preventDefault();
      const pasted = e.clipboardData?.getData("text/plain");
      if (pasted) {
        const text = writingTextRef.current;
        const pos = caretPosRef.current;
        writingTextRef.current = text.slice(0, pos) + pasted + text.slice(pos);
        caretPosRef.current = pos + pasted.length;
        caretVisibleRef.current = true;
        scheduleRedraw();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("paste", onPaste);
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
