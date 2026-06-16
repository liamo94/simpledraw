import type { ShapeKind, Theme, TextSize, FontFamily, TextAlign, FillStyle } from "../hooks/useSettings";

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
  fill?: FillStyle | boolean;
  fillOpacity?: number;
  spray?: boolean;
  sharp?: boolean;
  imageId?: string;
  imageW?: number;
  imageH?: number;
  rotation?: number; // radians, clockwise
  lineRotation?: number; // accumulated rotation for bent lines (n>2), for OBB display
  subStrokes?: Stroke[]; // compound stroke: renders each sub-stroke as one unit
  locked?: boolean;
};

export type UndoAction =
  | { type: "draw"; stroke: Stroke }
  | { type: "erase"; strokes: Stroke[]; indices?: number[] }
  | { type: "move"; stroke: Stroke; from: { x: number; y: number }[]; to: { x: number; y: number }[]; subFrom?: { x: number; y: number }[][]; subTo?: { x: number; y: number }[][]; fromLineWidth?: number; toLineWidth?: number; fromSubLineWidths?: number[]; toSubLineWidths?: number[] }
  | { type: "resize"; stroke: Stroke; fromScale: number; toScale: number; fromPoints: { x: number; y: number }[]; toPoints: { x: number; y: number }[]; fromW?: number; toW?: number; fromH?: number; toH?: number }
  | { type: "edit"; stroke: Stroke; oldText: string; newText: string }
  | { type: "font-change"; stroke: Stroke; from: FontFamily | undefined; to: FontFamily; fromAnchor?: { x: number; y: number }; toAnchor?: { x: number; y: number } }
  | { type: "size-change"; stroke: Stroke; from: TextSize | undefined; to: TextSize }
  | { type: "bold-change"; stroke: Stroke; from: boolean | undefined; to: boolean; fromAnchor?: { x: number; y: number }; toAnchor?: { x: number; y: number } }
  | { type: "italic-change"; stroke: Stroke; from: boolean | undefined; to: boolean; fromAnchor?: { x: number; y: number }; toAnchor?: { x: number; y: number } }
  | { type: "align-change"; stroke: Stroke; from: TextAlign; to: TextAlign; fromAnchor?: { x: number; y: number }; toAnchor?: { x: number; y: number } }
  | { type: "color-change"; stroke: Stroke; from: string; to: string }
  | { type: "group-color-change"; strokes: Stroke[]; from: string[]; to: string }
  | { type: "fill-style-change"; strokes: Stroke[]; from: (FillStyle | boolean | undefined)[]; to: FillStyle }
  | { type: "fill-opacity-change"; strokes: Stroke[]; from: (number | undefined)[]; to: number }
  | { type: "corners-change"; strokes: Stroke[]; from: (boolean | undefined)[]; to: boolean | undefined }
  | { type: "group-move"; strokes: Stroke[]; from: { x: number; y: number }[][]; to: { x: number; y: number }[][]; subFrom?: { x: number; y: number }[][][]; subTo?: { x: number; y: number }[][][] }
  | { type: "group-transform"; strokes: Stroke[]; fromPoints: { x: number; y: number }[][]; toPoints: { x: number; y: number }[][]; fromSubPoints?: { x: number; y: number }[][][]; toSubPoints?: { x: number; y: number }[][][]; fromRotations: (number | undefined)[]; toRotations: (number | undefined)[]; fromFontScales: (number | undefined)[]; toFontScales: (number | undefined)[]; fromImageSizes: ({ w: number; h: number } | undefined)[]; toImageSizes: ({ w: number; h: number } | undefined)[] }
  | { type: "multi-draw"; strokes: Stroke[] }
  | { type: "reorder"; before: Stroke[]; after: Stroke[] }
  | { type: "reshape"; stroke: Stroke; from: { x: number; y: number }[]; to: { x: number; y: number }[]; fromLineRotation?: number; toLineRotation?: number }
  | { type: "rotate"; stroke: Stroke; from: number; to: number }
  | { type: "flip"; strokes: Stroke[]; fromPoints: { x: number; y: number }[][]; toPoints: { x: number; y: number }[][]; fromRotations: (number | undefined)[]; toRotations: (number | undefined)[] }
  | { type: "combine"; combined: Stroke; originals: Stroke[]; insertIndex: number; originalIndices?: number[] }
  | { type: "uncombine"; combined: Stroke; originals: Stroke[]; insertIndex: number }
  | { type: "lock"; strokes: Stroke[]; to: boolean };

export type TouchTool =
  | "draw"
  | "dashed"
  | "line"
  | "erase"
  | "hand"
  | "shape"
  | "highlight"
  | "laser"
  | "spray"
  | "text"
  | "select";

export type BBox = { x: number; y: number; w: number; h: number };

export type CanvasSnapshot = {
  strokes: Stroke[];
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  view: { x: number; y: number; scale: number };
};

export const snapshotCache = new Map<number, CanvasSnapshot>();

// Re-export setting types used across canvas modules
export type { Theme, TextSize, FontFamily, TextAlign, FillStyle };

export type StashItem = {
  id: string;
  name: string;
  createdAt: number;
  strokes: Stroke[];
  savedDark?: boolean;
};

export type Slide = {
  id: string;
  name: string;
  canvasIndex: number;
  canvasId?: string;
  canvasName?: string;
  view: { x: number; y: number; scale: number };
  /** World-space center point stored when the slide was created. Used to re-center the view correctly on different screen sizes / orientations. */
  worldCenter?: { x: number; y: number };
  /** Window size when the slide was created. Used to scale the zoom proportionally on resize. */
  refSize?: { width: number; height: number };
  thumbnail?: string;
};
