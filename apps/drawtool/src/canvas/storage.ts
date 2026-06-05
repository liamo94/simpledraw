import type { Stroke, StashItem } from "./types";

// ─── Cloud save hook ──────────────────────────────────────────────────────────

type SaveHook = (canvasIndex: number, strokes: Stroke[]) => void
let _saveHook: SaveHook | null = null
export function setSaveHook(fn: SaveHook | null) { _saveHook = fn }
export function hasSaveHook(): boolean { return _saveHook !== null }

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

const _quotaHit = new Set<number>();

export function saveStrokes(strokes: Stroke[], canvasIndex: number, skipHook = false) {
  try {
    const json = JSON.stringify(strokes);
    if (json.length < 5_000_000) {
      localStorage.setItem(strokesKey(canvasIndex), json);
      if (_quotaHit.has(canvasIndex)) {
        _quotaHit.delete(canvasIndex);
        window.dispatchEvent(new CustomEvent("drawtool:storage-ok", { detail: { canvasIndex } }));
      }
    } else {
      if (!_quotaHit.has(canvasIndex)) {
        _quotaHit.add(canvasIndex);
        window.dispatchEvent(new CustomEvent("drawtool:storage-quota", { detail: { canvasIndex } }));
      }
    }
    if (!skipHook) _saveHook?.(canvasIndex, strokes);
  } catch {
    /* ignore */
  }
}

// ─── Import / export ──────────────────────────────────────────────────────────

export type StrokesFile = { version: 1; strokes: Stroke[]; name?: string; images?: Record<string, string> };

export type WorkspaceCanvas = {
  index: number;
  strokes: Stroke[];
  view?: { x: number; y: number; scale: number };
  name?: string;
  images?: Record<string, string>;
};

export type WorkspaceFile = { version: 1; type: "workspace"; canvases: WorkspaceCanvas[] };

const VALID_STYLES  = new Set(["solid", "dashed"]);
const VALID_SHAPES  = new Set(["line", "circle", "rectangle", "triangle", "star", "arrow", "pentagon", "hexagon", "diamond", "cloud"]);
const VALID_SIZES   = new Set(["xs", "s", "m", "l", "xl"]);
const VALID_FONTS   = new Set(["caveat", "sans", "serif", "mono", "comic", "cartoon"]);
const VALID_ALIGNS  = new Set(["left", "center", "right"]);

function validateStrokesArray(strokes: unknown[], prefix: string): Stroke[] {
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    if (typeof s !== "object" || s === null)
      throw new Error(`${prefix}${i}: not an object`);
    const st = s as Record<string, unknown>;

    const isCombined = Array.isArray(st.subStrokes) && st.subStrokes.length > 0;
    if (!Array.isArray(st.points) || (!isCombined && st.points.length === 0))
      throw new Error(`${prefix}${i}: missing points`);
    for (const p of st.points as unknown[]) {
      const pt = p as Record<string, unknown>;
      if (typeof pt?.x !== "number" || typeof pt?.y !== "number")
        throw new Error(`${prefix}${i}: invalid point`);
    }
    if (!VALID_STYLES.has(st.style as string))
      throw new Error(`${prefix}${i}: invalid style`);
    if (typeof st.lineWidth !== "number" || (!isCombined && st.lineWidth <= 0))
      throw new Error(`${prefix}${i}: invalid lineWidth`);
    if (typeof st.color !== "string")
      throw new Error(`${prefix}${i}: invalid color`);

    if (st.shape     !== undefined && !VALID_SHAPES.has(st.shape as string))
      throw new Error(`${prefix}${i}: invalid shape`);
    if (st.text      !== undefined && typeof st.text !== "string")
      throw new Error(`${prefix}${i}: text must be a string`);
    if (st.fontSize  !== undefined && !VALID_SIZES.has(st.fontSize as string))
      throw new Error(`${prefix}${i}: invalid fontSize`);
    if (st.fontFamily !== undefined && !VALID_FONTS.has(st.fontFamily as string))
      throw new Error(`${prefix}${i}: invalid fontFamily`);
    if (st.textAlign  !== undefined && !VALID_ALIGNS.has(st.textAlign as string))
      throw new Error(`${prefix}${i}: invalid textAlign`);
    if (isCombined)
      validateStrokesArray(st.subStrokes as unknown[], `${prefix}${i} sub-stroke `);
  }
  return strokes as Stroke[];
}

/** Validate a parsed JSON value as a drawtool canvas file. Throws on failure. */
export function validateStrokesFile(data: unknown): { strokes: Stroke[]; name?: string; images?: Record<string, string> } {
  if (typeof data !== "object" || data === null)
    throw new Error("Not a valid drawtool file");
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1)
    throw new Error("Unknown file version - was this made by a newer drawtool?");
  if (!Array.isArray(obj.strokes))
    throw new Error("Missing strokes array");
  const strokes = validateStrokesArray(obj.strokes, "Stroke ");
  const name = typeof obj.name === "string" ? obj.name : undefined;
  const images = obj.images && typeof obj.images === "object" && !Array.isArray(obj.images)
    ? obj.images as Record<string, string>
    : undefined;
  return { strokes, name, images };
}

/** Validate a parsed JSON value as a drawtool workspace file. Throws on failure. */
export function validateWorkspaceFile(data: unknown): WorkspaceCanvas[] {
  if (typeof data !== "object" || data === null)
    throw new Error("Not a valid drawtool workspace file");
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1)
    throw new Error("Unknown file version - was this made by a newer drawtool?");
  if (obj.type !== "workspace")
    throw new Error("Not a workspace file - use 'Import canvas' for single-canvas files");
  if (!Array.isArray(obj.canvases))
    throw new Error("Missing canvases array");

  return obj.canvases.map((c, i) => {
    if (typeof c !== "object" || c === null)
      throw new Error(`Canvas ${i}: not an object`);
    const cv = c as Record<string, unknown>;
    if (typeof cv.index !== "number" || cv.index < 1 || cv.index > 9)
      throw new Error(`Canvas ${i}: invalid index (must be 1–9)`);
    if (!Array.isArray(cv.strokes))
      throw new Error(`Canvas ${i}: missing strokes`);
    const strokes = validateStrokesArray(cv.strokes, `Canvas ${i} stroke `);
    const name = typeof cv.name === "string" ? cv.name : undefined;
    const images = cv.images && typeof cv.images === "object" && !Array.isArray(cv.images)
      ? cv.images as Record<string, string>
      : undefined;
    return { index: cv.index as number, strokes, view: cv.view as WorkspaceCanvas["view"], name, images };
  });
}

// ─── Canvas reorder ───────────────────────────────────────────────────────────

/** Physically swap localStorage data so slot i+1 gets the data that was in newOrder[i]. */
export function reorderCanvases(newOrder: number[]) {
  const data = newOrder.map((n) => ({
    strokes: localStorage.getItem(strokesKey(n)),
    view: localStorage.getItem(viewKey(n)),
    name: localStorage.getItem(`drawtool-canvas-name-${n}`),
  }));
  data.forEach((d, i) => {
    const slot = i + 1;
    if (d.strokes !== null) localStorage.setItem(strokesKey(slot), d.strokes);
    else localStorage.removeItem(strokesKey(slot));
    if (d.view !== null) localStorage.setItem(viewKey(slot), d.view);
    else localStorage.removeItem(viewKey(slot));
    if (d.name !== null) localStorage.setItem(`drawtool-canvas-name-${slot}`, d.name);
    else localStorage.removeItem(`drawtool-canvas-name-${slot}`);
  });
}

// ─── Stash persistence ─────────────────────────────────────────────────────────

const STASH_KEY = "drawtool-stash";

export function loadStash(): StashItem[] {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveStash(items: StashItem[]) {
  try {
    const json = JSON.stringify(items);
    if (json.length < 5_000_000)
      localStorage.setItem(STASH_KEY, json);
  } catch {
    /* ignore */
  }
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
