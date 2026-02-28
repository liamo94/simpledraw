import type { TextSize, FontFamily, TextAlign } from "../hooks/useSettings";
import type { Stroke, BBox } from "./types";

// ─── Platform ─────────────────────────────────────────────────────────────────

export const isMac = navigator.platform.toUpperCase().includes("MAC");

export function cmdKey(e: { metaKey: boolean; ctrlKey: boolean }) {
  return e.metaKey || e.ctrlKey;
}

// ─── Coordinate utilities ─────────────────────────────────────────────────────

export function screenToWorld(
  sx: number,
  sy: number,
  view: { x: number; y: number; scale: number },
) {
  return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t =
    lenSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

// ─── Point smoothing ──────────────────────────────────────────────────────────

export function smoothPoints(raw: { x: number; y: number }[]) {
  if (raw.length < 3) return raw;
  const out = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    out.push({
      x: raw[i - 1].x * 0.25 + raw[i].x * 0.5 + raw[i + 1].x * 0.25,
      y: raw[i - 1].y * 0.25 + raw[i].y * 0.5 + raw[i + 1].y * 0.25,
    });
  }
  out.push(raw[raw.length - 1]);
  return out;
}

export function smoothWidths(raw: number[]) {
  if (raw.length < 3) return raw;
  const out = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    out.push(raw[i - 1] * 0.25 + raw[i] * 0.5 + raw[i + 1] * 0.25);
  }
  out.push(raw[raw.length - 1]);
  return out;
}

// ─── Font utilities ───────────────────────────────────────────────────────────

export const TEXT_SIZE_MAP: Record<TextSize, number> = { xs: 14, s: 21, m: 32, l: 49, xl: 70 };

export const FONT_FAMILIES: { key: FontFamily; label: string; css: string }[] = [
  { key: "caveat",   label: "Handwritten", css: "'Caveat', cursive" },
  { key: "comic",    label: "Comic",       css: "'Bangers', cursive" },
  { key: "cartoon",  label: "Cartoon",     css: "'Boogaloo', cursive" },
  { key: "sans",     label: "Sans-serif",  css: "system-ui, -apple-system, sans-serif" },
  { key: "serif",    label: "Serif",       css: "Georgia, serif" },
  { key: "mono",     label: "Mono",        css: "ui-monospace, 'Courier New', monospace" },
];

export function getFontCss(key?: FontFamily): string {
  return FONT_FAMILIES.find(f => f.key === key)?.css ?? FONT_FAMILIES[0].css;
}

export function buildFont(basePx: number, bold?: boolean, italic?: boolean, fontFamily?: FontFamily): string {
  const style = italic ? "italic " : "";
  const weight = bold ? "700 " : "400 ";
  return `${style}${weight}${basePx}px ${getFontCss(fontFamily)}`;
}

export function dispatchTextStyleSync(bold: boolean, italic: boolean, align: TextAlign) {
  window.dispatchEvent(new CustomEvent("drawtool:text-style-sync", {
    detail: { textBold: bold, textItalic: italic, textAlign: align },
  }));
}

// ─── Text bbox ────────────────────────────────────────────────────────────────

let _bboxMeasureCtx: CanvasRenderingContext2D | null = null;
export function getBBoxMeasureCtx(): CanvasRenderingContext2D | null {
  if (!_bboxMeasureCtx) {
    const c = document.createElement("canvas");
    _bboxMeasureCtx = c.getContext("2d");
  }
  return _bboxMeasureCtx;
}

export function textBBox(stroke: Stroke): { x: number; y: number; w: number; h: number } {
  const anchor = stroke.points[0];
  const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"] * (stroke.fontScale ?? 1);
  const lines = (stroke.text ?? "").split("\n");
  const lineHeight = basePx * 1.2;
  const mCtx = getBBoxMeasureCtx();

  let w: number;
  let yOff = 0;
  let lineH = basePx;

  if (mCtx) {
    mCtx.font = buildFont(basePx, stroke.bold, stroke.italic, stroke.fontFamily);
    mCtx.textBaseline = "top";
    w = Math.max(...lines.map((l) => mCtx.measureText(l || " ").width)) * 1.05;
    // Measure actual glyph extents (caps + descenders) relative to the "top" baseline
    const m = mCtx.measureText("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
    if (m.actualBoundingBoxAscent !== undefined) {
      // With textBaseline="top": negative ascent means glyph top is below the em-top
      // yOff shifts the box down to where glyphs actually start
      yOff = -m.actualBoundingBoxAscent;
      lineH = Math.max(basePx * 0.4, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
    }
  } else {
    w = Math.max(...lines.map((l) => l.length)) * basePx * 0.6;
  }

  const h = lineHeight * (lines.length - 1) + lineH;
  // x depends on textAlign: anchor is the reference point for each alignment
  let x = anchor.x;
  if (stroke.textAlign === "center") x = anchor.x - w / 2;
  else if (stroke.textAlign === "right") x = anchor.x - w;
  return { x, y: anchor.y + yOff, w, h };
}

export function computeCaretPosFromClick(stroke: Stroke, wp: { x: number; y: number }): number {
  const text = stroke.text ?? "";
  const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"] * (stroke.fontScale ?? 1);
  const lines = text.split("\n");
  const anchor = stroke.points[0];
  const lineHeight = basePx * 1.2;
  const lineIndex = Math.max(0, Math.min(lines.length - 1, Math.floor((wp.y - anchor.y) / lineHeight)));
  const line = lines[lineIndex];
  const bboxCtx = getBBoxMeasureCtx();
  let col = line.length;
  if (bboxCtx) {
    bboxCtx.font = buildFont(basePx, stroke.bold, stroke.italic, stroke.fontFamily);
    const lineWidth = bboxCtx.measureText(line).width;
    const strokeAlign = stroke.textAlign ?? "left";
    let lineStartX = anchor.x;
    if (strokeAlign === "center") lineStartX = anchor.x - lineWidth / 2;
    else if (strokeAlign === "right") lineStartX = anchor.x - lineWidth;
    const xInLine = wp.x - lineStartX;
    for (let i = 1; i <= line.length; i++) {
      if (bboxCtx.measureText(line.slice(0, i)).width > xInLine) {
        const wBefore = bboxCtx.measureText(line.slice(0, i - 1)).width;
        const wAt = bboxCtx.measureText(line.slice(0, i)).width;
        col = (xInLine - wBefore) < (wAt - xInLine) ? i - 1 : i;
        break;
      }
    }
  }
  return lines.slice(0, lineIndex).reduce((acc, l) => acc + l.length + 1, 0) + col;
}

// ─── Bounding box utilities ───────────────────────────────────────────────────

export function shapeBBox(stroke: Stroke): BBox {
  const p0 = stroke.points[0];
  const p1 = stroke.points[1];
  return {
    x: Math.min(p0.x, p1.x),
    y: Math.min(p0.y, p1.y),
    w: Math.abs(p1.x - p0.x),
    h: Math.abs(p1.y - p0.y),
  };
}

export function selectBBox(stroke: Stroke): BBox | null {
  if (stroke.text) return textBBox(stroke);
  if (stroke.shape && stroke.points.length === 2) return shapeBBox(stroke);
  return null;
}

export function anyStrokeBBox(stroke: Stroke): BBox {
  const bb = selectBBox(stroke);
  if (bb) return bb;
  // Freehand: compute AABB from all points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };
}
