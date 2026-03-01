import type { ShapeKind, Theme, TextSize, FontFamily, TextAlign } from "../hooks/useSettings";

// ─── Core types ───────────────────────────────────────────────────────────────

export type Stroke = {
  points: { x: number; y: number }[];
  style: "solid" | "dashed";
  lineWidth: number;
  dashGap?: number;
  color: string;
  shape?: ShapeKind;
  highlight?: boolean;
  text?: string;
  fontSize?: TextSize;
  fontFamily?: FontFamily;
  bold?: boolean;
  italic?: boolean;
  textAlign?: TextAlign;
  fontScale?: number;
  widths?: number[];
  seed?: number;
  fill?: boolean;
};

export type UndoAction =
  | { type: "draw"; stroke: Stroke }
  | { type: "erase"; strokes: Stroke[] }
  | { type: "move"; stroke: Stroke; from: { x: number; y: number }[]; to: { x: number; y: number }[] }
  | { type: "resize"; stroke: Stroke; fromScale: number; toScale: number; fromPoints: { x: number; y: number }[]; toPoints: { x: number; y: number }[] }
  | { type: "edit"; stroke: Stroke; oldText: string; newText: string }
  | { type: "font-change"; stroke: Stroke; from: FontFamily | undefined; to: FontFamily }
  | { type: "bold-change"; stroke: Stroke; from: boolean | undefined; to: boolean; fromAnchor?: { x: number; y: number }; toAnchor?: { x: number; y: number } }
  | { type: "italic-change"; stroke: Stroke; from: boolean | undefined; to: boolean; fromAnchor?: { x: number; y: number }; toAnchor?: { x: number; y: number } }
  | { type: "align-change"; stroke: Stroke; from: TextAlign; to: TextAlign; fromAnchor?: { x: number; y: number }; toAnchor?: { x: number; y: number } }
  | { type: "color-change"; stroke: Stroke; from: string; to: string }
  | { type: "group-color-change"; strokes: Stroke[]; from: string[]; to: string }
  | { type: "group-move"; strokes: Stroke[]; from: { x: number; y: number }[][]; to: { x: number; y: number }[][] }
  | { type: "multi-draw"; strokes: Stroke[] }
  | { type: "reorder"; before: Stroke[]; after: Stroke[] };

export type TouchTool =
  | "draw"
  | "dashed"
  | "line"
  | "erase"
  | "hand"
  | "shape"
  | "highlight"
  | "text";

export type BBox = { x: number; y: number; w: number; h: number };

export type CanvasSnapshot = {
  strokes: Stroke[];
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  view: { x: number; y: number; scale: number };
};

export const snapshotCache = new Map<number, CanvasSnapshot>();

// Re-export setting types used across canvas modules
export type { Theme, TextSize, FontFamily, TextAlign };
