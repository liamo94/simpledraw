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
