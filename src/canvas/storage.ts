import type { Stroke } from "./types";

// ─── Storage keys ─────────────────────────────────────────────────────────────

export function strokesKey(n: number) {
  return `drawtool-strokes-${n}`;
}

export function viewKey(n: number) {
  return `drawtool-view-${n}`;
}

// ─── Strokes persistence ──────────────────────────────────────────────────────

export function loadStrokes(canvasIndex: number): Stroke[] {
  try {
    const raw = localStorage.getItem(strokesKey(canvasIndex));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveStrokes(strokes: Stroke[], canvasIndex: number) {
  try {
    const json = JSON.stringify(strokes);
    if (json.length < 5_000_000)
      localStorage.setItem(strokesKey(canvasIndex), json);
  } catch {
    /* ignore */
  }
}

// ─── Import / export ──────────────────────────────────────────────────────────

export type StrokesFile = { version: 1; strokes: Stroke[] };

const VALID_STYLES  = new Set(["solid", "dashed"]);
const VALID_SHAPES  = new Set(["line", "circle", "rectangle", "triangle", "star", "arrow", "pentagon", "hexagon", "diamond", "lightning"]);
const VALID_SIZES   = new Set(["xs", "s", "m", "l", "xl"]);
const VALID_FONTS   = new Set(["caveat", "sans", "serif", "mono", "comic", "cartoon"]);
const VALID_ALIGNS  = new Set(["left", "center", "right"]);

/** Validate a parsed JSON value as a drawtool strokes file. Throws on failure. */
export function validateStrokesFile(data: unknown): Stroke[] {
  if (typeof data !== "object" || data === null)
    throw new Error("Not a valid drawtool file");
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1)
    throw new Error("Unknown file version — was this made by a newer drawtool?");
  if (!Array.isArray(obj.strokes))
    throw new Error("Missing strokes array");

  for (let i = 0; i < obj.strokes.length; i++) {
    const s = obj.strokes[i];
    if (typeof s !== "object" || s === null)
      throw new Error(`Stroke ${i}: not an object`);
    const st = s as Record<string, unknown>;

    if (!Array.isArray(st.points) || st.points.length === 0)
      throw new Error(`Stroke ${i}: missing points`);
    for (const p of st.points as unknown[]) {
      const pt = p as Record<string, unknown>;
      if (typeof pt?.x !== "number" || typeof pt?.y !== "number")
        throw new Error(`Stroke ${i}: invalid point`);
    }
    if (!VALID_STYLES.has(st.style as string))
      throw new Error(`Stroke ${i}: invalid style`);
    if (typeof st.lineWidth !== "number" || st.lineWidth <= 0)
      throw new Error(`Stroke ${i}: invalid lineWidth`);
    if (typeof st.color !== "string")
      throw new Error(`Stroke ${i}: invalid color`);

    // Optional fields
    if (st.shape    !== undefined && !VALID_SHAPES.has(st.shape as string))
      throw new Error(`Stroke ${i}: invalid shape`);
    if (st.text     !== undefined && typeof st.text !== "string")
      throw new Error(`Stroke ${i}: text must be a string`);
    if (st.fontSize !== undefined && !VALID_SIZES.has(st.fontSize as string))
      throw new Error(`Stroke ${i}: invalid fontSize`);
    if (st.fontFamily !== undefined && !VALID_FONTS.has(st.fontFamily as string))
      throw new Error(`Stroke ${i}: invalid fontFamily`);
    if (st.textAlign  !== undefined && !VALID_ALIGNS.has(st.textAlign as string))
      throw new Error(`Stroke ${i}: invalid textAlign`);
  }

  return obj.strokes as Stroke[];
}

// ─── View persistence ─────────────────────────────────────────────────────────

export function defaultView() {
  return { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 150, scale: 1 };
}

export function loadView(canvasIndex: number): { x: number; y: number; scale: number } {
  try {
    const raw = localStorage.getItem(viewKey(canvasIndex));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return defaultView();
}

export function saveView(view: { x: number; y: number; scale: number }, canvasIndex: number) {
  try {
    localStorage.setItem(viewKey(canvasIndex), JSON.stringify(view));
  } catch {
    /* ignore */
  }
}
