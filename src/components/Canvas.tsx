import { useRef, useEffect, useCallback, useState, memo } from "react";
import { getStroke } from "perfect-freehand";
import rough from "roughjs";
import type { ShapeKind, Theme, TextSize } from "../hooks/useSettings";

function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || theme === "midnight" || theme === "lumber";
}

function getBackgroundColor(theme: Theme): string {
  if (theme === "midnight") return "#1a1a2e";
  if (theme === "dark") return "#06060e";
  if (theme === "lumber") return "#110e0a";
  if (theme === "journal") return "#f5e2b8";
  if (theme === "sky") return "#e0ecf6";
  return "#f5f5f0";
}

type Stroke = {
  points: { x: number; y: number }[];
  style: "solid" | "dashed";
  lineWidth: number;
  dashGap?: number;
  color: string;
  shape?: ShapeKind;
  highlight?: boolean;
  text?: string;
  fontSize?: TextSize;
  fontScale?: number;
  widths?: number[];
  seed?: number;
};

type UndoAction =
  | { type: "draw"; stroke: Stroke }
  | { type: "erase"; strokes: Stroke[] }
  | { type: "move"; stroke: Stroke; from: { x: number; y: number }[]; to: { x: number; y: number }[] }
  | { type: "resize"; stroke: Stroke; fromScale: number; toScale: number; fromPoints: { x: number; y: number }[]; toPoints: { x: number; y: number }[] }
  | { type: "edit"; stroke: Stroke; oldText: string; newText: string };

export type TouchTool =
  | "draw"
  | "dashed"
  | "line"
  | "erase"
  | "hand"
  | "shape"
  | "highlight"
  | "text";

const TEXT_SIZE_MAP: Record<TextSize, number> = { xs: 14, s: 21, m: 32, l: 49, xl: 70 };
const TEXT_FONT_FAMILY = "'Caveat', cursive";

function strokesKey(n: number) {
  return `drawtool-strokes-${n}`;
}
function viewKey(n: number) {
  return `drawtool-view-${n}`;
}

function loadStrokes(canvasIndex: number): Stroke[] {
  try {
    const raw = localStorage.getItem(strokesKey(canvasIndex));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function saveStrokes(strokes: Stroke[], canvasIndex: number) {
  try {
    const json = JSON.stringify(strokes);
    if (json.length < 5_000_000)
      localStorage.setItem(strokesKey(canvasIndex), json);
  } catch {
    /* ignore */
  }
}

function loadView(canvasIndex: number): { x: number; y: number; scale: number } {
  try {
    const raw = localStorage.getItem(viewKey(canvasIndex));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0, scale: 1 };
}

function saveView(view: { x: number; y: number; scale: number }, canvasIndex: number) {
  try {
    localStorage.setItem(viewKey(canvasIndex), JSON.stringify(view));
  } catch {
    /* ignore */
  }
}

type CanvasSnapshot = {
  strokes: Stroke[];
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  view: { x: number; y: number; scale: number };
};

const snapshotCache = new Map<number, CanvasSnapshot>();

function distToSegment(
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

function cmdKey(e: { metaKey: boolean; ctrlKey: boolean }) {
  return e.metaKey || e.ctrlKey;
}

function screenToWorld(
  sx: number,
  sy: number,
  view: { x: number; y: number; scale: number },
) {
  return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
}

function smoothPoints(raw: { x: number; y: number }[]) {
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

const isMac = navigator.platform.toUpperCase().includes("MAC");

function starPoints(
  cx: number,
  cy: number,
  outerRx: number,
  outerRy: number,
  innerRx: number,
  innerRy: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const rx = i % 2 === 0 ? outerRx : innerRx;
    const ry = i % 2 === 0 ? outerRy : innerRy;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

function regularPolygonPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

function roundedPoly(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  r: number,
) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const d1x = prev.x - curr.x, d1y = prev.y - curr.y;
    const l1 = Math.hypot(d1x, d1y);
    const d2x = next.x - curr.x, d2y = next.y - curr.y;
    const l2 = Math.hypot(d2x, d2y);
    const cr = Math.min(r, l1 / 2, l2 / 2);
    const t1x = curr.x + (d1x / l1) * cr, t1y = curr.y + (d1y / l1) * cr;
    const t2x = curr.x + (d2x / l2) * cr, t2y = curr.y + (d2y / l2) * cr;
    if (i === 0) ctx.moveTo(t1x, t1y); else ctx.lineTo(t1x, t1y);
    ctx.quadraticCurveTo(curr.x, curr.y, t2x, t2y);
  }
  ctx.closePath();
}

function renderShape(
  ctx: CanvasRenderingContext2D,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  shape: ShapeKind,
  lineWidth: number,
) {
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.12;

  ctx.beginPath();
  switch (shape) {
    case "line":
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      break;
    case "rectangle":
      ctx.roundRect(x, y, w, h, r);
      break;
    case "circle":
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case "triangle":
      roundedPoly(ctx, [{ x: cx, y }, { x: x + w, y: y + h }, { x, y: y + h }], r);
      break;
    case "star": {
      const pts = starPoints(cx, cy, w / 2, h / 2, w / 5, h / 5);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      break;
    }
    case "arrow": {
      // Draw line from p0 to p1
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      // Draw arrowhead
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const headLen = Math.max(15, lineWidth * 3);
      const headAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(
        p1.x - headLen * Math.cos(angle - headAngle),
        p1.y - headLen * Math.sin(angle - headAngle),
      );
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(
        p1.x - headLen * Math.cos(angle + headAngle),
        p1.y - headLen * Math.sin(angle + headAngle),
      );
      break;
    }
    case "pentagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 5);
      roundedPoly(ctx, pts, r);
      break;
    }
    case "hexagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 6);
      roundedPoly(ctx, pts, r);
      break;
    }
    case "diamond":
      roundedPoly(ctx, [{ x: cx, y }, { x: x + w, y: cy }, { x: cx, y: y + h }, { x, y: cy }], r);
      break;
    case "lightning": {
      ctx.moveTo(x + w * 0.55, y);
      ctx.lineTo(x + w * 0.15, y + h * 0.5);
      ctx.lineTo(x + w * 0.45, y + h * 0.5);
      ctx.lineTo(x + w * 0.35, y + h);
      ctx.lineTo(x + w * 0.85, y + h * 0.4);
      ctx.lineTo(x + w * 0.55, y + h * 0.4);
      ctx.closePath();
      break;
    }
  }
  ctx.stroke();
}

function roughPolyPath(pts: { x: number; y: number }[], r: number): string {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const d1x = prev.x - curr.x, d1y = prev.y - curr.y;
    const l1 = Math.hypot(d1x, d1y);
    const d2x = next.x - curr.x, d2y = next.y - curr.y;
    const l2 = Math.hypot(d2x, d2y);
    const cr = Math.min(r, l1 / 2, l2 / 2);
    const t1x = curr.x + (d1x / l1) * cr, t1y = curr.y + (d1y / l1) * cr;
    const t2x = curr.x + (d2x / l2) * cr, t2y = curr.y + (d2y / l2) * cr;
    d += i === 0 ? `M ${t1x} ${t1y} ` : `L ${t1x} ${t1y} `;
    d += `Q ${curr.x} ${curr.y} ${t2x} ${t2y} `;
  }
  return d + "Z";
}

function renderRoughShape(
  ctx: CanvasRenderingContext2D,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  shape: ShapeKind,
  lineWidth: number,
  style: "solid" | "dashed",
  dashGap: number | undefined,
  seed: number,
  color: string,
) {
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dashScale = lineWidth / 4;
  const opts = {
    roughness: 1.2,
    bowing: 1,
    seed,
    stroke: color,
    strokeWidth: lineWidth,
    disableMultiStroke: false,
    ...(style === "dashed"
      ? { strokeLineDash: [10 * dashScale, (dashGap ?? 8) * 5 * dashScale] }
      : {}),
  };
  const r = Math.min(w, h) * 0.1;
  // preserveVertices keeps bezier transition points fixed across both strokes,
  // preventing gap artifacts at the corner/edge junctions
  const roundedOpts = { ...opts, preserveVertices: true };
  const rc = rough.canvas(ctx.canvas as HTMLCanvasElement);
  switch (shape) {
    case "line":
      rc.line(p0.x, p0.y, p1.x, p1.y, opts);
      break;
    case "rectangle":
      rc.path(roughPolyPath([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], r), roundedOpts);
      break;
    case "circle":
      rc.ellipse(cx, cy, w, h, opts);
      break;
    case "triangle":
      rc.path(roughPolyPath([{ x: cx, y }, { x: x + w, y: y + h }, { x, y: y + h }], r), roundedOpts);
      break;
    case "diamond":
      rc.path(roughPolyPath([{ x: cx, y }, { x: x + w, y: cy }, { x: cx, y: y + h }, { x, y: cy }], r), roundedOpts);
      break;
    case "pentagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 5);
      rc.path(roughPolyPath(pts, r), roundedOpts);
      break;
    }
    case "hexagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 6);
      rc.path(roughPolyPath(pts, r), roundedOpts);
      break;
    }
    case "star": {
      const pts = starPoints(cx, cy, w / 2, h / 2, w / 5, h / 5);
      rc.polygon(pts.map((p) => [p.x, p.y] as [number, number]), opts);
      break;
    }
    case "lightning":
      rc.polygon([
        [x + w * 0.55, y],
        [x + w * 0.15, y + h * 0.5],
        [x + w * 0.45, y + h * 0.5],
        [x + w * 0.35, y + h],
        [x + w * 0.85, y + h * 0.4],
        [x + w * 0.55, y + h * 0.4],
      ], opts);
      break;
    case "arrow": {
      rc.line(p0.x, p0.y, p1.x, p1.y, opts);
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const headLen = Math.max(15, lineWidth * 3);
      const headAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.setLineDash([]);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x - headLen * Math.cos(angle - headAngle), p1.y - headLen * Math.sin(angle - headAngle));
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x - headLen * Math.cos(angle + headAngle), p1.y - headLen * Math.sin(angle + headAngle));
      ctx.stroke();
      break;
    }
  }
}

function shapeToSegments(stroke: Stroke): { x: number; y: number }[] {
  const p0 = stroke.points[0];
  const p1 = stroke.points[1];
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);
  const cx = x + w / 2;
  const cy = y + h / 2;

  switch (stroke.shape!) {
    case "line":
      return [p0, p1];
    case "rectangle":
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
        { x, y },
      ];
    case "circle": {
      const pts: { x: number; y: number }[] = [];
      const n = 36;
      for (let i = 0; i <= n; i++) {
        const a = (Math.PI * 2 * i) / n;
        pts.push({
          x: cx + (w / 2) * Math.cos(a),
          y: cy + (h / 2) * Math.sin(a),
        });
      }
      return pts;
    }
    case "triangle":
      return [
        { x: cx, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
        { x: cx, y },
      ];
    case "star": {
      const pts = starPoints(cx, cy, w / 2, h / 2, w / 5, h / 5);
      return [...pts, pts[0]];
    }
    case "arrow": {
      // Line from p0 to p1 plus arrowhead points
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const headLen = 15;
      const headAngle = Math.PI / 6;
      return [
        p0,
        p1,
        {
          x: p1.x - headLen * Math.cos(angle - headAngle),
          y: p1.y - headLen * Math.sin(angle - headAngle),
        },
        p1,
        {
          x: p1.x - headLen * Math.cos(angle + headAngle),
          y: p1.y - headLen * Math.sin(angle + headAngle),
        },
      ];
    }
    case "pentagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 5);
      return [...pts, pts[0]];
    }
    case "hexagon": {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 6);
      return [...pts, pts[0]];
    }
    case "diamond": {
      return [
        { x: cx, y },
        { x: x + w, y: cy },
        { x: cx, y: y + h },
        { x, y: cy },
        { x: cx, y },
      ];
    }
    case "lightning": {
      const pts = [
        { x: x + w * 0.55, y },
        { x: x + w * 0.15, y: y + h * 0.5 },
        { x: x + w * 0.45, y: y + h * 0.5 },
        { x: x + w * 0.35, y: y + h },
        { x: x + w * 0.85, y: y + h * 0.4 },
        { x: x + w * 0.55, y: y + h * 0.4 },
      ];
      return [...pts, pts[0]];
    }
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function smoothWidths(raw: number[]) {
  if (raw.length < 3) return raw;
  const out = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    out.push(raw[i - 1] * 0.25 + raw[i] * 0.5 + raw[i + 1] * 0.25);
  }
  out.push(raw[raw.length - 1]);
  return out;
}


let _bboxMeasureCtx: CanvasRenderingContext2D | null = null;
function getBBoxMeasureCtx(): CanvasRenderingContext2D | null {
  if (!_bboxMeasureCtx) {
    const c = document.createElement("canvas");
    _bboxMeasureCtx = c.getContext("2d");
  }
  return _bboxMeasureCtx;
}

function textBBox(stroke: Stroke): { x: number; y: number; w: number; h: number } {
  const anchor = stroke.points[0];
  const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"] * (stroke.fontScale ?? 1);
  const lines = (stroke.text ?? "").split("\n");
  const lineHeight = basePx * 1.2;
  const mCtx = getBBoxMeasureCtx();

  let w: number;
  let yOff = 0;
  let lineH = basePx;

  if (mCtx) {
    mCtx.font = `400 ${basePx}px ${TEXT_FONT_FAMILY}`;
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
  return { x: anchor.x, y: anchor.y + yOff, w, h };
}

type BBox = { x: number; y: number; w: number; h: number };

function shapeBBox(stroke: Stroke): BBox {
  const p0 = stroke.points[0];
  const p1 = stroke.points[1];
  return {
    x: Math.min(p0.x, p1.x),
    y: Math.min(p0.y, p1.y),
    w: Math.abs(p1.x - p0.x),
    h: Math.abs(p1.y - p0.y),
  };
}

function selectBBox(stroke: Stroke): BBox | null {
  if (stroke.text) return textBBox(stroke);
  if (stroke.shape && stroke.points.length === 2) return shapeBBox(stroke);
  return null;
}

function renderStrokesToCtx(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    // Text stroke rendering
    if (stroke.text) {
      const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"] * (stroke.fontScale ?? 1);
      ctx.font = `400 ${basePx}px ${TEXT_FONT_FAMILY}`;

      ctx.fillStyle = stroke.color;
      ctx.textBaseline = "top";
      const lines = stroke.text.split("\n");
      const lineHeight = basePx * 1.2;
      const anchor = stroke.points[0];
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], anchor.x, anchor.y + i * lineHeight);
      }
      continue;
    }
    const color = stroke.highlight
      ? hexToRgba(stroke.color, 0.4)
      : stroke.color;
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(p.x, p.y, stroke.lineWidth * 0.6, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (stroke.shape && stroke.points.length === 2) {
      if (stroke.seed !== undefined) {
        renderRoughShape(
          ctx,
          stroke.points[0],
          stroke.points[1],
          stroke.shape,
          stroke.lineWidth,
          stroke.style,
          stroke.dashGap,
          stroke.seed,
          color,
        );
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const dashScale = stroke.lineWidth / 4;
        ctx.setLineDash(
          stroke.style === "dashed"
            ? [10 * dashScale, (stroke.dashGap ?? 8) * 5 * dashScale]
            : [],
        );
        renderShape(
          ctx,
          stroke.points[0],
          stroke.points[1],
          stroke.shape,
          stroke.lineWidth,
        );
      }
      continue;
    }
    const baseWidth = stroke.highlight
      ? stroke.lineWidth * 2.5
      : stroke.lineWidth;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const dashScale = stroke.lineWidth / 4;
    ctx.setLineDash(
      stroke.style === "dashed"
        ? [10 * dashScale, (stroke.dashGap ?? 8) * 5 * dashScale]
        : [],
    );
    const pts = smoothPoints(stroke.points);
    if (stroke.widths && stroke.widths.length >= pts.length) {
      const sw = smoothWidths(stroke.widths);
      if (pts.length < 2) continue;

      // Use perfect-freehand (same library as excalidraw/tldraw) to generate
      // a clean variable-width outline polygon. It handles self-intersections,
      // smooth joins, and tapered caps correctly.
      const pfPts = pts.map((p, i) => [p.x, p.y, sw[i] / 2] as [number, number, number]);
      const outline = getStroke(pfPts, {
        size: baseWidth,
        thinning: 1,
        smoothing: 0.5,
        streamline: 0,
        simulatePressure: false,
        last: true,
      });

      if (outline.length < 2) continue;

      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) {
        ctx.lineTo(outline[i][0], outline[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.lineWidth = baseWidth;
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 2) {
        ctx.lineTo(pts[1].x, pts[1].y);
      } else {
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      }
      ctx.stroke();
    }
  }
}


function Canvas({
  lineWidth,
  lineColor,
  dashGap,
  showDotGrid,
  theme,
  touchTool,
  activeShape,
  canvasIndex,
  textSize,
  pressureSensitivity,
  onContentOffScreen,
}: {
  lineWidth: number;
  lineColor: string;
  dashGap: number;
  showDotGrid: boolean;
  theme: Theme;
  touchTool: TouchTool;
  activeShape: ShapeKind;
  canvasIndex: number;
  textSize: TextSize;
  pressureSensitivity: boolean;
  onContentOffScreen?: (offScreen: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasIndexRef = useRef(canvasIndex);
  const [loadedStrokes] = useState(() => loadStrokes(canvasIndex));
  const strokesRef = useRef<Stroke[]>(loadedStrokes);
  const undoStackRef = useRef<UndoAction[]>(
    loadedStrokes.map((stroke) => ({ type: "draw" as const, stroke })),
  );
  const redoStackRef = useRef<UndoAction[]>([]);
  const pendingEraseRef = useRef<Set<Stroke>>(new Set());
  const eraseTrailRef = useRef<{ x: number; y: number }[]>([]);
  const eraseMovingRef = useRef(false);
  const isDrawingRef = useRef(false);
  const activeModifierRef = useRef<
    "meta" | "shift" | "alt" | "line" | "shape" | "highlight" | "laser" | null
  >(null);
  const laserTrailRef = useRef<{ x: number; y: number }[]>([]);
  const laserMovingRef = useRef(false);
  const viewRef = useRef(loadView(canvasIndex));
  const showDotGridRef = useRef(showDotGrid);
  showDotGridRef.current = showDotGrid;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const touchToolRef = useRef(touchTool);
  touchToolRef.current = touchTool;
  const lineWidthRef = useRef(lineWidth);
  lineWidthRef.current = lineWidth;
  const lineColorRef = useRef(lineColor);
  lineColorRef.current = lineColor;
  const activeShapeRef = useRef(activeShape);
  activeShapeRef.current = activeShape;
  const pressureSensitivityRef = useRef(pressureSensitivity);
  pressureSensitivityRef.current = pressureSensitivity;
  const lastDrawPointRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const prevWidthRef = useRef(1);
  const isPanningRef = useRef(false);
  const panLastRef = useRef({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [shapeActive, setShapeActive] = useState(false);
  const shapeFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isZoomingRef = useRef(false);
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlighting, setHighlighting] = useState(false);
  const [zCursor, setZCursor] = useState<string | null>(null);
  const highlightKeyRef = useRef(false);
  const laserKeyRef = useRef(false);
  const [lasering, setLasering] = useState(false);
  const spaceDownRef = useRef(false);
  const keyShapeRef = useRef<ShapeKind | null>(null);
  const keyShapeDashedRef = useRef(false);
  const cursorWorldRef = useRef({ x: 0, y: 0 });
  const lastDPressRef = useRef(0);
  const tapStartRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const isWritingRef = useRef(false);
  const writingPosRef = useRef({ x: 0, y: 0 });
  const writingTextRef = useRef("");
  const caretVisibleRef = useRef(true);
  const caretTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const caretPosRef = useRef(0); // tracks selectionEnd for caret rendering
  const textSizeRef = useRef(textSize);
  textSizeRef.current = textSize;
  const onContentOffScreenRef = useRef(onContentOffScreen);
  onContentOffScreenRef.current = onContentOffScreen;

  // Text select / move / resize / edit state
  const zKeyRef = useRef(false);
  const selectedTextRef = useRef<Stroke | null>(null);
  const hoverTextRef = useRef<Stroke | null>(null);
  const editingStrokeRef = useRef<Stroke | null>(null);
  const editingOldTextRef = useRef("");
  const lastTextTapRef = useRef<{ time: number; stroke: Stroke } | null>(null);
  const selectDragRef = useRef<{
    mode: "move" | "corner";
    corner?: 0 | 1 | 2 | 3;
    startPtr: { x: number; y: number };
    startPoints: { x: number; y: number }[];
    startScale: number;
    bbox: BBox;
  } | null>(null);

  // Multi-touch tracking
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(
    null,
  );
  // Two-finger tap tracking for undo, three-finger tap for redo
  const twoFingerTapRef = useRef<{
    startPositions: Map<number, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);
  const threeFingerTapRef = useRef<{
    startPositions: Map<number, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);

  // --- Debounced persistStrokes (item 5) ---
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistStrokes = useCallback(() => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    saveStrokes(strokesRef.current, canvasIndexRef.current);
  }, []);

  const persistStrokesDebounced = useCallback(() => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      saveStrokes(strokesRef.current, canvasIndexRef.current);
    }, 500);
  }, []);

  const notifyColorUsed = useCallback((color: string) => {
    window.dispatchEvent(new CustomEvent("drawtool:color-used", { detail: color }));
  }, []);

  const persistView = useCallback(() => {
    saveView(viewRef.current, canvasIndexRef.current);
  }, []);

  const confirmErase = useCallback(() => {
    eraseTrailRef.current = [];
    const pending = pendingEraseRef.current;
    if (pending.size > 0) {
      const erased = strokesRef.current.filter((s) => pending.has(s));
      strokesRef.current = strokesRef.current.filter((s) => !pending.has(s));
      undoStackRef.current.push({ type: "erase", strokes: erased });
      redoStackRef.current = [];
      pending.clear();
    }
  }, []);

  // --- Dot grid pattern tile cache (item 7) ---
  // Key: `${Math.ceil(screenGap)},${isDark}` → tiny tile canvas pattern.
  // Using createPattern lets the GPU tile it — panning is free (just update
  // the pattern transform offset) and zooming only creates a new tile when
  // the screen gap changes by ≥1px, instead of redrawing N² arcs each frame.
  const gridPatternCacheRef = useRef<Map<string, CanvasPattern>>(new Map());

  // --- Completed strokes cache (item 8) ---
  const strokesCacheRef = useRef<{
    canvas: HTMLCanvasElement;
    key: string;
  } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y, scale } = viewRef.current;

    const isDark = isDarkTheme(themeRef.current);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getBackgroundColor(themeRef.current);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Dot grid via tiled patterns (item 7) ---
    // Each zoom level gets a tiny tile canvas (one dot centered) turned into a
    // repeating CanvasPattern. Drawing is a single fillRect per level — the GPU
    // handles the tiling. The pattern transform offset aligns dots to world
    // grid positions so panning never requires a redraw.
    if (showDotGridRef.current) {
      const BASE = 12;
      const DOT_RADIUS = 0.75;
      const baseAlpha = isDark ? 0.7 : 1.0;
      const isDarkKey = isDark ? "1" : "0";
      const dotColor = isDark ? "white" : "black";

      for (let spacing = BASE; spacing < 500000; spacing *= 5) {
        const screenGap = spacing * scale;
        if (screenGap < 4) continue;
        if (screenGap > Math.max(canvas.width, canvas.height) * 2) break;
        const opacity = Math.max(0, Math.min(1, (screenGap - 6) / 20));
        if (opacity <= 0) continue;

        // Round to nearest integer for the tile canvas dimension.
        // patternScale then corrects the repeating interval to the exact float
        // screenGap so dots don't drift/jitter as zoom changes continuously.
        const tileSize = Math.max(Math.round(screenGap), 1);
        const patternScale = screenGap / tileSize;
        const tileKey = `${tileSize},${isDarkKey}`;
        let pattern = gridPatternCacheRef.current.get(tileKey);
        if (!pattern) {
          const tile = document.createElement("canvas");
          tile.width = tileSize;
          tile.height = tileSize;
          const tctx = tile.getContext("2d")!;
          const half = tileSize / 2;
          tctx.fillStyle = dotColor;
          tctx.beginPath();
          tctx.arc(half, half, DOT_RADIUS, 0, Math.PI * 2);
          tctx.fill();
          pattern = ctx.createPattern(tile, "repeat")!;
          gridPatternCacheRef.current.set(tileKey, pattern);
        }

        // Translate so the dot at tile-center lands on the world-origin's
        // screen position, then scale so the tile repeats at exactly screenGap.
        const ox = ((x % screenGap) + screenGap) % screenGap;
        const oy = ((y % screenGap) + screenGap) % screenGap;
        pattern.setTransform(
          new DOMMatrix()
            .translate(ox - screenGap / 2, oy - screenGap / 2)
            .scale(patternScale),
        );

        ctx.globalAlpha = opacity * baseAlpha;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(scale, 0, 0, scale, x, y);

    // --- Cached completed strokes (item 8) ---
    const pending = pendingEraseRef.current;
    const isErasing = pending.size > 0;
    const activeStroke = isDrawingRef.current && activeModifierRef.current !== "alt" && activeModifierRef.current !== "laser"
      ? strokesRef.current[strokesRef.current.length - 1]
      : null;

    if (isErasing) {
      // During erase mode, render all strokes directly (need per-stroke opacity)
      strokesCacheRef.current = null;
      renderStrokesToCtx(
        ctx,
        strokesRef.current.filter((s) => !pending.has(s)),
      );
      ctx.globalAlpha = 0.25;
      renderStrokesToCtx(
        ctx,
        strokesRef.current.filter((s) => pending.has(s)),
      );
      ctx.globalAlpha = 1;
    } else {
      // Use cache for completed strokes
      let completedStrokes = activeStroke
        ? strokesRef.current.slice(0, -1)
        : strokesRef.current;
      if (editingStrokeRef.current) {
        completedStrokes = completedStrokes.filter(s => s !== editingStrokeRef.current);
      }
      const cacheKey = `${completedStrokes.length},${x},${y},${scale},${canvas.width},${canvas.height}`;
      let sCache = strokesCacheRef.current;
      if (!sCache || sCache.key !== cacheKey) {
        const offscreen = sCache?.canvas || document.createElement("canvas");
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const sctx = offscreen.getContext("2d")!;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.clearRect(0, 0, offscreen.width, offscreen.height);
        sctx.setTransform(scale, 0, 0, scale, x, y);
        renderStrokesToCtx(sctx, completedStrokes);
        strokesCacheRef.current = { canvas: offscreen, key: cacheKey };
        sCache = strokesCacheRef.current;
      }
      // Blit cached strokes
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sCache.canvas, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, x, y);

      // Render only the active stroke on top
      if (activeStroke) {
        renderStrokesToCtx(ctx, [activeStroke]);
      }
    }

    // Render live writing text preview + blinking caret
    if (isWritingRef.current || writingTextRef.current) {
      const editStroke = editingStrokeRef.current;
      const basePx = editStroke
        ? TEXT_SIZE_MAP[editStroke.fontSize || "m"] * (editStroke.fontScale ?? 1)
        : TEXT_SIZE_MAP[textSizeRef.current];
      const textColor = editStroke ? editStroke.color : lineColorRef.current;
      ctx.font = `400 ${basePx}px ${TEXT_FONT_FAMILY}`;

      ctx.fillStyle = textColor;
      ctx.textBaseline = "top";
      const text = writingTextRef.current;
      const lines = text ? text.split("\n") : [""];
      const lineHeight = basePx * 1.2;
      const anchor = writingPosRef.current;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          ctx.fillText(lines[i], anchor.x, anchor.y + i * lineHeight);
        }
      }
      // Draw blinking caret at selectionEnd position
      if (isWritingRef.current && caretVisibleRef.current) {
        const pos = caretPosRef.current;
        // Find which line and column the caret is on
        let charCount = 0;
        let caretLine = 0;
        let caretCol = 0;
        for (let i = 0; i < lines.length; i++) {
          if (pos <= charCount + lines[i].length) {
            caretLine = i;
            caretCol = pos - charCount;
            break;
          }
          charCount += lines[i].length + 1; // +1 for \n
          if (i === lines.length - 1) {
            caretLine = i;
            caretCol = lines[i].length;
          }
        }
        const textBeforeCaret = lines[caretLine].slice(0, caretCol);
        const caretX = anchor.x + ctx.measureText(textBeforeCaret).width;
        const caretY = anchor.y + caretLine * lineHeight;
        ctx.fillStyle = textColor;
        ctx.fillRect(caretX, caretY, 2 / scale, basePx);
      }
    }

    // Write mode indicator (screen-space) — pill badge bottom-right
    if (isWritingRef.current) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const isDark = isDarkTheme(themeRef.current);
      const label = "Text mode — esc to finish";
      ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(label).width;
      const ph = 8, pv = 5;
      const pillW = tw + ph * 2;
      const pillH = 11 + pv * 2;
      const margin = 12;
      const px = canvas.width - pillW - margin;
      const py = canvas.height - pillH - margin;
      const r = pillH / 2;
      ctx.beginPath();
      ctx.moveTo(px + r, py);
      ctx.lineTo(px + pillW - r, py);
      ctx.arcTo(px + pillW, py, px + pillW, py + r, r);
      ctx.arcTo(px + pillW, py + pillH, px + pillW - r, py + pillH, r);
      ctx.lineTo(px + r, py + pillH);
      ctx.arcTo(px, py + pillH, px, py + pillH - r, r);
      ctx.arcTo(px, py, px + r, py, r);
      ctx.closePath();
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";
      ctx.fillText(label, px + ph, py + pillH / 2);
      ctx.setTransform(scale, 0, 0, scale, x, y);
    }

    // Draw erase trail with fading tail
    const trail = eraseTrailRef.current;
    if (trail.length >= 2) {
      const pts = smoothPoints(smoothPoints(trail));
      const len = pts.length;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      for (let i = 1; i < len; i++) {
        const t = i / (len - 1);
        ctx.beginPath();
        ctx.lineWidth = (3 + t * 5) / scale;
        ctx.strokeStyle = `rgba(252, 80, 80, ${t * 0.4})`;
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }

    // Draw laser pointer trail (screen-space thickness)
    const laser = laserTrailRef.current;
    if (laser.length >= 2) {
      const pts = smoothPoints(smoothPoints(laser));
      const len = pts.length;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      for (let i = 1; i < len; i++) {
        const t = i / (len - 1);
        ctx.beginPath();
        ctx.lineWidth = (2 + t * 4) / scale;
        ctx.strokeStyle = `rgba(255, 30, 30, ${t * 0.8})`;
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      // Bright dot at the head
      if (len > 0) {
        const head = pts[len - 1];
        const dotR = 4 / scale;
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 60, 60, 0.9)";
        ctx.arc(head.x, head.y, dotR, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 80, 80, 0.3)";
        ctx.arc(head.x, head.y, dotR * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw text select hover/selection overlay (world space)
    const overlayStroke = selectedTextRef.current || hoverTextRef.current;
    if (overlayStroke) {
      const bb = selectBBox(overlayStroke);
      if (!bb) { /* shouldn't happen */ return; }
      const isSelected = !!selectedTextRef.current;
      const pad = 3 / scale;
      const r = 3 / scale; // rounded corner radius
      const lw = 1.5 / scale;
      const rx = bb.x - pad, ry = bb.y - pad;
      const rw = bb.w + pad * 2, rh = bb.h + pad * 2;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, r);

      if (isSelected) {
        ctx.fillStyle = "rgba(72,149,239,0.07)";
        ctx.fill();
        ctx.strokeStyle = "#4895ef";
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        ctx.stroke();

        // Circular corner handles
        const hr = 4.5 / scale;
        const corners = [
          { x: rx,      y: ry },
          { x: rx + rw, y: ry },
          { x: rx + rw, y: ry + rh },
          { x: rx,      y: ry + rh },
        ];
        ctx.lineWidth = 1.5 / scale;
        for (const c of corners) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, hr, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#4895ef";
          ctx.stroke();
        }
      } else {
        // Hover — subtle dashed outline
        const hoverColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.3)";
        ctx.strokeStyle = hoverColor;
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([4 / scale, 3 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  // --- Content off-screen detection ---
  const contentOffScreenRef = useRef(false);
  const checkContentOffScreen = useCallback(() => {
    const cb = onContentOffScreenRef.current;
    if (!cb) return;
    const strokes = strokesRef.current;
    if (strokes.length === 0) {
      if (contentOffScreenRef.current) {
        contentOffScreenRef.current = false;
        cb(false);
      }
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of strokes) {
      if (stroke.text) {
        const anchor = stroke.points[0];
        const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
        const lines = stroke.text.split("\n");
        const maxLineLen = Math.max(...lines.map((l) => l.length));
        const textW = maxLineLen * basePx * 0.6;
        const textH = lines.length * basePx * 1.2;
        if (anchor.x < minX) minX = anchor.x;
        if (anchor.y < minY) minY = anchor.y;
        if (anchor.x + textW > maxX) maxX = anchor.x + textW;
        if (anchor.y + textH > maxY) maxY = anchor.y + textH;
        continue;
      }
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const { x, y, scale } = viewRef.current;
    const screenMinX = minX * scale + x;
    const screenMinY = minY * scale + y;
    const screenMaxX = maxX * scale + x;
    const screenMaxY = maxY * scale + y;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const offScreen =
      screenMaxX < 0 || screenMinX > vw || screenMaxY < 0 || screenMinY > vh;
    if (offScreen !== contentOffScreenRef.current) {
      contentOffScreenRef.current = offScreen;
      cb(offScreen);
    }
  }, []);

  // --- RAF-queue scheduleRedraw (item 1) ---
  const rafIdRef = useRef<number | null>(null);
  const scheduleRedraw = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      redraw();
      checkContentOffScreen();
    });
  }, [redraw, checkContentOffScreen]);

  // Cancel pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const cancelErase = useCallback(() => {
    eraseTrailRef.current = [];
    pendingEraseRef.current.clear();
    isDrawingRef.current = false;
    activeModifierRef.current = null;
    scheduleRedraw();
  }, [scheduleRedraw]);

  // Drain erase trail when cursor stops moving
  useEffect(() => {
    if (!erasing) return;
    let raf: number;
    let stopped = false;
    const tick = () => {
      const trail = eraseTrailRef.current;
      if (eraseMovingRef.current) {
        // Reset flag — will be set again on next eraseAt call
        eraseMovingRef.current = false;
      } else if (trail.length > 0) {
        // Not moving — drain tail toward head
        const remove = Math.max(1, Math.ceil(trail.length * 0.15));
        trail.splice(0, remove);
        redraw();
      }
      // Keep running until trail is fully drained, even after erasing ends
      if (!stopped || trail.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      // Don't cancel if trail still needs draining
      if (eraseTrailRef.current.length === 0) {
        cancelAnimationFrame(raf);
      }
    };
  }, [erasing, redraw]);

  // Drain laser trail
  useEffect(() => {
    if (!lasering) return;
    let raf: number;
    let stopped = false;
    const tick = () => {
      const trail = laserTrailRef.current;
      if (laserMovingRef.current) {
        laserMovingRef.current = false;
      } else if (trail.length > 0) {
        const remove = Math.max(1, Math.ceil(trail.length * 0.15));
        trail.splice(0, remove);
        redraw();
      }
      if (!stopped || trail.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (laserTrailRef.current.length === 0) {
        cancelAnimationFrame(raf);
      }
    };
  }, [lasering, redraw]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    strokesCacheRef.current = null;
    persistStrokes();
    scheduleRedraw();
  }, [scheduleRedraw, persistStrokes]);

  // Swap default stroke colors when switching between dark/light themes, then redraw
  const prevThemeRef = useRef(theme);
  useEffect(() => {
    if (prevThemeRef.current !== theme) {
      const prevIsDark = isDarkTheme(prevThemeRef.current);
      const nowIsDark = isDarkTheme(theme);
      if (prevIsDark !== nowIsDark) {
        const from = nowIsDark ? "#000000" : "#ffffff";
        const to = nowIsDark ? "#ffffff" : "#000000";
        const swapStrokes = (strokes: Stroke[]) => {
          for (const s of strokes) {
            if (s.color === from) s.color = to;
          }
        };
        const swapAction = (a: UndoAction) => {
          const list = a.type === "erase" ? a.strokes : [a.stroke];
          for (const s of list) {
            if (s.color === from) s.color = to;
          }
        };
        // Swap active canvas
        swapStrokes(strokesRef.current);
        undoStackRef.current.forEach(swapAction);
        redoStackRef.current.forEach(swapAction);
        persistStrokes();
        // Swap cached (inactive) canvases
        for (const [idx, snapshot] of snapshotCache) {
          if (idx === canvasIndexRef.current) continue;
          swapStrokes(snapshot.strokes);
          snapshot.undoStack.forEach(swapAction);
          snapshot.redoStack.forEach(swapAction);
          saveStrokes(snapshot.strokes, idx);
        }
        // Swap uncached canvases still in localStorage
        for (let i = 1; i <= 9; i++) {
          if (i === canvasIndexRef.current || snapshotCache.has(i)) continue;
          const strokes = loadStrokes(i);
          if (strokes.length > 0) {
            swapStrokes(strokes);
            saveStrokes(strokes, i);
          }
        }
      }
      prevThemeRef.current = theme;
    }
    strokesCacheRef.current = null;
    scheduleRedraw();
  }, [showDotGrid, theme, scheduleRedraw, persistStrokes]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gridPatternCacheRef.current.clear();
      strokesCacheRef.current = null;
      redraw(); // immediate — must paint now
    };

    resize();
    window.addEventListener("resize", resize);

    // Redraw after fonts load to ensure text renders correctly
    document.fonts.ready.then(() => {
      strokesCacheRef.current = null;
      scheduleRedraw();
    });

    // Track cursor position globally so W key always has accurate coords
    const onMouseMove = (e: MouseEvent) => {
      cursorWorldRef.current = screenToWorld(
        e.clientX,
        e.clientY,
        viewRef.current,
      );
    };
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      if (caretTimerRef.current) {
        clearInterval(caretTimerRef.current);
        caretTimerRef.current = null;
      }
    };
  }, [redraw, scheduleRedraw]);

  const broadcastZoom = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("drawtool:zoom", { detail: viewRef.current.scale }),
    );
  }, []);

  // Canvas switching effect
  useEffect(() => {
    const prevIndex = canvasIndexRef.current;
    if (prevIndex === canvasIndex) return;

    // Cancel any in-progress drawing
    if (isDrawingRef.current) {
      if (activeModifierRef.current !== "alt") {
        strokesRef.current.pop();
        undoStackRef.current.pop();
      }
      if (activeModifierRef.current === "alt") {
        pendingEraseRef.current.clear();
      }
      isDrawingRef.current = false;
      activeModifierRef.current = null;
    }

    // Save current state to cache + localStorage
    snapshotCache.set(prevIndex, {
      strokes: strokesRef.current,
      undoStack: undoStackRef.current,
      redoStack: redoStackRef.current,
      view: { ...viewRef.current },
    });
    saveStrokes(strokesRef.current, prevIndex);
    saveView(viewRef.current, prevIndex);

    // Restore new canvas from cache or localStorage
    const cached = snapshotCache.get(canvasIndex);
    if (cached) {
      strokesRef.current = cached.strokes;
      undoStackRef.current = cached.undoStack;
      redoStackRef.current = cached.redoStack;
      viewRef.current = cached.view;
    } else {
      const strokes = loadStrokes(canvasIndex);
      strokesRef.current = strokes;
      undoStackRef.current = strokes.map((stroke) => ({
        type: "draw" as const,
        stroke,
      }));
      redoStackRef.current = [];
      viewRef.current = loadView(canvasIndex);
    }

    // Clear transient state
    eraseTrailRef.current = [];
    laserTrailRef.current = [];
    pendingEraseRef.current.clear();
    gridPatternCacheRef.current.clear();
    strokesCacheRef.current = null;

    canvasIndexRef.current = canvasIndex;
    broadcastZoom();
    scheduleRedraw();
  }, [canvasIndex, scheduleRedraw, broadcastZoom]);

  const animFrameRef = useRef(0);
  const animateView = useCallback(
    (target: { x: number; y: number; scale: number }, duration = 300) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const start = { ...viewRef.current };
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - t0) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        viewRef.current.x = start.x + (target.x - start.x) * ease;
        viewRef.current.y = start.y + (target.y - start.y) * ease;
        viewRef.current.scale = start.scale + (target.scale - start.scale) * ease;
        strokesCacheRef.current = null;
        scheduleRedraw();
        broadcastZoom();
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          animFrameRef.current = 0;
          persistView();
        }
      };
      animFrameRef.current = requestAnimationFrame(step);
    },
    [scheduleRedraw, broadcastZoom, persistView],
  );

  const resetView = useCallback(() => {
    animateView({ x: 0, y: 0, scale: 1 });
  }, [animateView]);

  const zoomBy = useCallback(
    (factor: number) => {
      const view = viewRef.current;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const newScale = Math.min(10, Math.max(0.1, view.scale * factor));
      const ratio = newScale / view.scale;
      view.x = cx - ratio * (cx - view.x);
      view.y = cy - ratio * (cy - view.y);
      view.scale = newScale;
      strokesCacheRef.current = null;
      scheduleRedraw();
      broadcastZoom();
      persistView();
    },
    [scheduleRedraw, broadcastZoom, persistView],
  );

  const centerView = useCallback(() => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const stroke of strokes) {
      if (stroke.text) {
        const anchor = stroke.points[0];
        const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
        const lines = stroke.text.split("\n");
        const maxLineLen = Math.max(...lines.map((l) => l.length));
        const textW = maxLineLen * basePx * 0.6;
        const textH = lines.length * basePx * 1.2;
        if (anchor.x < minX) minX = anchor.x;
        if (anchor.y < minY) minY = anchor.y;
        if (anchor.x + textW > maxX) maxX = anchor.x + textW;
        if (anchor.y + textH > maxY) maxY = anchor.y + textH;
        continue;
      }
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const pad = 60;
    const w = maxX - minX;
    const h = maxY - minY;
    const vw = window.innerWidth - pad * 2;
    const vh = window.innerHeight - pad * 2;
    let target;
    if (w === 0 && h === 0) {
      target = {
        x: window.innerWidth / 2 - minX,
        y: window.innerHeight / 2 - minY,
        scale: 1,
      };
    } else {
      const scale = Math.min(
        10,
        Math.max(0.1, Math.min(vw / (w || 1), vh / (h || 1))),
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      target = {
        x: window.innerWidth / 2 - cx * scale,
        y: window.innerHeight / 2 - cy * scale,
        scale,
      };
    }
    animateView(target);
  }, [animateView]);

  const exportTransparent = useCallback(() => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const stroke of strokes) {
      if (stroke.text) {
        const anchor = stroke.points[0];
        const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
        const lines = stroke.text.split("\n");
        const maxLineLen = Math.max(...lines.map((l) => l.length));
        const textW = maxLineLen * basePx * 0.6;
        const textH = lines.length * basePx * 1.2;
        if (anchor.x < minX) minX = anchor.x;
        if (anchor.y < minY) minY = anchor.y;
        if (anchor.x + textW > maxX) maxX = anchor.x + textW;
        if (anchor.y + textH > maxY) maxY = anchor.y + textH;
        continue;
      }
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const maxLW = Math.max(...strokes.map((s) => s.lineWidth));
    const pad = 20 + maxLW / 2;
    const w = Math.ceil(maxX - minX + pad * 2);
    const h = Math.ceil(maxY - minY + pad * 2);
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d")!;
    ctx.translate(-minX + pad, -minY + pad);
    renderStrokesToCtx(ctx, strokes);
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "drawtool-transparent.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  }, []);

  const undo = useCallback(() => {
    const action = undoStackRef.current.pop();
    if (action) {
      if (action.type === "draw") {
        const idx = strokesRef.current.lastIndexOf(action.stroke);
        if (idx !== -1) strokesRef.current.splice(idx, 1);
      } else if (action.type === "erase") {
        strokesRef.current.push(...action.strokes);
      } else if (action.type === "move") {
        action.from.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "resize") {
        action.stroke.fontScale = action.fromScale;
        action.fromPoints.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "edit") {
        action.stroke.text = action.oldText;
      }
      redoStackRef.current.push(action);
    }
    // Abort any in-progress edit
    if (editingStrokeRef.current) {
      editingStrokeRef.current = null;
      editingOldTextRef.current = "";
      isWritingRef.current = false;
      writingTextRef.current = "";
      if (caretTimerRef.current) { clearInterval(caretTimerRef.current); caretTimerRef.current = null; }
    }
    selectedTextRef.current = null;
    selectDragRef.current = null;
    lastTextTapRef.current = null;
    hoverTextRef.current = null;
    strokesCacheRef.current = null;
    persistStrokes();
    scheduleRedraw();
  }, [persistStrokes, scheduleRedraw]);

  const redo = useCallback(() => {
    const action = redoStackRef.current.pop();
    if (action) {
      if (action.type === "draw") {
        strokesRef.current.push(action.stroke);
      } else if (action.type === "erase") {
        for (const s of action.strokes) {
          const idx = strokesRef.current.lastIndexOf(s);
          if (idx !== -1) strokesRef.current.splice(idx, 1);
        }
      } else if (action.type === "move") {
        action.to.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "resize") {
        action.stroke.fontScale = action.toScale;
        action.toPoints.forEach((p, i) => { action.stroke.points[i] = { ...p }; });
      } else if (action.type === "edit") {
        action.stroke.text = action.newText;
      }
      undoStackRef.current.push(action);
    }
    // Abort any in-progress edit
    if (editingStrokeRef.current) {
      editingStrokeRef.current = null;
      editingOldTextRef.current = "";
      isWritingRef.current = false;
      writingTextRef.current = "";
      if (caretTimerRef.current) { clearInterval(caretTimerRef.current); caretTimerRef.current = null; }
    }
    selectedTextRef.current = null;
    selectDragRef.current = null;
    lastTextTapRef.current = null;
    hoverTextRef.current = null;
    strokesCacheRef.current = null;
    persistStrokes();
    scheduleRedraw();
  }, [persistStrokes, scheduleRedraw]);

  // Listen for clear / reset-view / center-view / zoom-step / stroke-count-query / export-transparent events
  useEffect(() => {
    const onClear = () => clearCanvas();
    const onResetView = () => resetView();
    const onCenterView = () => centerView();
    const onZoomStep = (e: Event) =>
      zoomBy((e as CustomEvent).detail as number);
    const onQueryCount = (e: Event) => {
      (e as CustomEvent).detail.count = strokesRef.current.length;
    };
    const onExportTransparent = () => exportTransparent();
    window.addEventListener("drawtool:clear", onClear);
    window.addEventListener("drawtool:reset-view", onResetView);
    window.addEventListener("drawtool:center-view", onCenterView);
    window.addEventListener("drawtool:zoom-step", onZoomStep);
    window.addEventListener("drawtool:query-stroke-count", onQueryCount);
    window.addEventListener("drawtool:export-transparent", onExportTransparent);
    return () => {
      window.removeEventListener("drawtool:clear", onClear);
      window.removeEventListener("drawtool:reset-view", onResetView);
      window.removeEventListener("drawtool:center-view", onCenterView);
      window.removeEventListener("drawtool:zoom-step", onZoomStep);
      window.removeEventListener("drawtool:query-stroke-count", onQueryCount);
      window.removeEventListener("drawtool:export-transparent", onExportTransparent);
    };
  }, [clearCanvas, resetView, centerView, zoomBy, exportTransparent]);

  const MIN_SHAPE_SIZE = 8;

  const discardTinyShape = useCallback(() => {
    if (
      activeModifierRef.current !== "shape" &&
      activeModifierRef.current !== "line"
    )
      return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    if (!stroke || stroke.points.length < 2) return;
    const dx = Math.abs(stroke.points[1].x - stroke.points[0].x);
    const dy = Math.abs(stroke.points[1].y - stroke.points[0].y);
    if (dx < MIN_SHAPE_SIZE && dy < MIN_SHAPE_SIZE) {
      strokesRef.current.pop();
      undoStackRef.current.pop();
    }
  }, []);

  const cancelCurrentStroke = useCallback(() => {
    if (isDrawingRef.current && activeModifierRef.current !== "alt") {
      strokesRef.current.pop();
      undoStackRef.current.pop();
    }
    if (isDrawingRef.current && activeModifierRef.current === "alt") {
      pendingEraseRef.current.clear();
    }
    isDrawingRef.current = false;
    activeModifierRef.current = null;
    scheduleRedraw();
  }, [scheduleRedraw]);

  // Keyboard shortcuts + eraser cursor
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
        // Cmd+Backspace → delete to start of line
        if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
          if (lineStart === pos && pos > 0) {
            writingTextRef.current = text.slice(0, pos - 1) + text.slice(pos);
            caretPosRef.current = pos - 1;
          } else {
            writingTextRef.current = text.slice(0, lineStart) + text.slice(pos);
            caretPosRef.current = lineStart;
          }
          scheduleRedraw();
          return;
        }
        // Option+Backspace → delete word before caret
        if (e.key === "Backspace" && e.altKey) {
          e.preventDefault();
          if (pos > 0) {
            let i = pos - 1;
            while (i > 0 && text[i - 1] === " ") i--;
            while (i > 0 && text[i - 1] !== " " && text[i - 1] !== "\n") i--;
            writingTextRef.current = text.slice(0, i) + text.slice(pos);
            caretPosRef.current = i;
            scheduleRedraw();
          }
          return;
        }
        // Backspace → delete char before caret
        if (e.key === "Backspace") {
          e.preventDefault();
          if (pos > 0) {
            writingTextRef.current = text.slice(0, pos - 1) + text.slice(pos);
            caretPosRef.current = pos - 1;
            scheduleRedraw();
          }
          return;
        }
        // Delete key → delete char after caret
        if (e.key === "Delete") {
          e.preventDefault();
          if (pos < text.length) {
            writingTextRef.current = text.slice(0, pos) + text.slice(pos + 1);
            scheduleRedraw();
          }
          return;
        }
        // Enter → insert newline
        if (e.key === "Enter") {
          e.preventDefault();
          writingTextRef.current = text.slice(0, pos) + "\n" + text.slice(pos);
          caretPosRef.current = pos + 1;
          scheduleRedraw();
          return;
        }
        // Arrow keys → move caret
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (pos > 0) {
            if (e.altKey) {
              // Option+Left → jump to start of word
              let i = pos - 1;
              while (i > 0 && text[i - 1] === " ") i--;
              while (i > 0 && text[i - 1] !== " " && text[i - 1] !== "\n") i--;
              caretPosRef.current = i;
            } else if (e.metaKey) {
              // Cmd+Left → jump to start of line
              const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
              caretPosRef.current = lineStart;
            } else {
              caretPosRef.current = pos - 1;
            }
            caretVisibleRef.current = true;
            scheduleRedraw();
          }
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          if (pos < text.length) {
            if (e.altKey) {
              // Option+Right → jump to end of word
              let i = pos;
              while (i < text.length && text[i] === " ") i++;
              while (i < text.length && text[i] !== " " && text[i] !== "\n") i++;
              caretPosRef.current = i;
            } else if (e.metaKey) {
              // Cmd+Right → jump to end of line
              let end = text.indexOf("\n", pos);
              if (end === -1) end = text.length;
              caretPosRef.current = end;
            } else {
              caretPosRef.current = pos + 1;
            }
            caretVisibleRef.current = true;
            scheduleRedraw();
          }
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
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
          return;
        }
        // Cmd+A → move caret to end
        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
          e.preventDefault();
          caretPosRef.current = text.length;
          caretVisibleRef.current = true;
          scheduleRedraw();
          return;
        }
        // Ignore other modifier combos (Cmd+C, Cmd+V handled elsewhere)
        if (e.metaKey || e.ctrlKey || e.altKey) {
          return;
        }
        // Tab → insert spaces
        if (e.key === "Tab") {
          e.preventDefault();
          writingTextRef.current = text.slice(0, pos) + "  " + text.slice(pos);
          caretPosRef.current = pos + 2;
          scheduleRedraw();
          return;
        }
        // Printable character → insert at caret
        if (e.key.length === 1) {
          e.preventDefault();
          writingTextRef.current = text.slice(0, pos) + e.key + text.slice(pos);
          caretPosRef.current = pos + 1;
          caretVisibleRef.current = true;
          scheduleRedraw();
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
      if (e.key === "z" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        zKeyRef.current = true;
        setZCursor("default");
      }
      if (e.key === "T" && e.shiftKey && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        const sizes: TextSize[] = ["xs", "s", "m", "l", "xl"];
        const labels: Record<TextSize, string> = { xs: "XS", s: "S", m: "M", l: "L", xl: "XL" };
        const cur = textSizeRef.current;
        const idx = sizes.indexOf(cur);
        const next = sizes[(idx + 1) % sizes.length];
        window.dispatchEvent(
          new CustomEvent("drawtool:text-size", { detail: next }),
        );
        window.dispatchEvent(
          new CustomEvent("drawtool:toast", { detail: `Text: ${labels[next]}` }),
        );
        return;
      }
      if (cmdKey(e) && e.key === "x") {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:request-clear"));
      }
      if (cmdKey(e) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (cmdKey(e) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
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
        window.dispatchEvent(
          new CustomEvent("drawtool:thickness", { detail: 1 }),
        );
      }
      if (e.key === "{" && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("drawtool:thickness", { detail: -1 }),
        );
      }
      if (e.key === "m" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:toggle-menu"));
      }
      if (e.key === "g" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new Event("drawtool:toggle-grid"));
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
        window.dispatchEvent(
          new CustomEvent("drawtool:color-cycle", { detail: -1 }),
        );
      }
      if (e.key === "]") {
        window.dispatchEvent(
          new CustomEvent("drawtool:color-cycle", { detail: 1 }),
        );
      }
      if ((e.key === "+" || e.key === "=") && !cmdKey(e) && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("drawtool:zoom-step", { detail: 1.25 }),
        );
      }
      if (e.key === "-" && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("drawtool:zoom-step", { detail: 0.8 }),
        );
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
      if (e.key === "f" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(new Event("drawtool:toggle-fullscreen"));
      }
      if (e.key === "p" && !cmdKey(e) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        window.dispatchEvent(new Event("drawtool:toggle-pressure"));
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
      if (e.key === "Alt" && !e.shiftKey) setErasing(true);
      if (e.key === "Alt" && e.shiftKey && !isMac) setShapeActive(true);
      if (e.key === "Shift" && e.altKey && !isMac) {
        setErasing(false);
        setShapeActive(true);
      }
      if (e.key === "Control" && isMac && !isZoomingRef.current) setShapeActive(true);
      if (
        e.key === "s" &&
        !cmdKey(e) &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey
      ) {
        window.dispatchEvent(new Event("drawtool:cycle-shape"));
        if (shapeFlashRef.current) clearTimeout(shapeFlashRef.current);
        setShapeActive(true);
        shapeFlashRef.current = setTimeout(() => {
          setShapeActive(false);
          shapeFlashRef.current = null;
        }, 300);
      }
      if (
        e.key === "S" &&
        !cmdKey(e) &&
        !e.altKey &&
        !e.ctrlKey &&
        e.shiftKey
      ) {
        window.dispatchEvent(new Event("drawtool:cycle-shape-back"));
        if (shapeFlashRef.current) clearTimeout(shapeFlashRef.current);
        setShapeActive(true);
        shapeFlashRef.current = setTimeout(() => {
          setShapeActive(false);
          shapeFlashRef.current = null;
        }, 300);
      }
      if ((e.key === "v" || e.key === "h") && !cmdKey(e) && !e.altKey && !e.ctrlKey) {
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
      if (
        shapeKeyMap[e.key] &&
        !cmdKey(e) &&
        !e.altKey &&
        !e.ctrlKey
      ) {
        keyShapeRef.current = shapeKeyMap[e.key];
        keyShapeDashedRef.current = e.shiftKey;
        setShapeActive(true);
      }
      // Number keys 1-9 for canvas switching
      if (
        e.key >= "1" &&
        e.key <= "9" &&
        !cmdKey(e) &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey
      ) {
        window.dispatchEvent(
          new CustomEvent("drawtool:switch-canvas", {
            detail: parseInt(e.key),
          }),
        );
      }
      if (e.key === "Escape" && selectedTextRef.current) {
        e.preventDefault();
        selectedTextRef.current = null;
        selectDragRef.current = null;
        setZCursor(zKeyRef.current ? "default" : null);
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
      if (e.key === "z") {
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
      if (e.key === "v" || e.key === "h") {
        highlightKeyRef.current = false;
        setHighlighting(false);
        if (activeModifierRef.current === "highlight") {
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
        }
      }
      if (e.key === "Control" && isMac) setShapeActive(false);
      if ((e.key === "Alt" || e.key === "Shift") && !isMac)
        setShapeActive(false);
      if (["a", "r", "t", "c", "A", "R", "T", "C"].includes(e.key)) {
        keyShapeRef.current = null;
        keyShapeDashedRef.current = false;
        setShapeActive(false);
        if (activeModifierRef.current === "shape") {
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
      keyShapeRef.current = null;
      keyShapeDashedRef.current = false;
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
  ]);

  const eraseAt = useCallback((x: number, y: number) => {
    // Interpolate extra points when cursor jumps far (fast movement)
    const trail = eraseTrailRef.current;
    const maxGap = 6 / viewRef.current.scale;
    if (trail.length > 0) {
      const last = trail[trail.length - 1];
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxGap) {
        const steps = Math.ceil(dist / maxGap);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          trail.push({ x: last.x + dx * t, y: last.y + dy * t });
        }
      }
    }
    trail.push({ x, y });
    eraseMovingRef.current = true;

    // Limit trail by cumulative path length (world coords)
    const maxLen = 200 / viewRef.current.scale;
    if (trail.length > 2) {
      let acc = 0;
      let cutIdx = 0;
      for (let i = trail.length - 1; i > 0; i--) {
        const dx = trail[i].x - trail[i - 1].x;
        const dy = trail[i].y - trail[i - 1].y;
        acc += Math.sqrt(dx * dx + dy * dy);
        if (acc > maxLen) {
          cutIdx = i;
          break;
        }
      }
      if (cutIdx > 0) {
        trail.splice(0, cutIdx);
      } else if (trail.length > 50) {
        trail.splice(0, trail.length - 50);
      }
    }
    const radius = 12 / viewRef.current.scale;
    for (const stroke of strokesRef.current) {
      if (pendingEraseRef.current.has(stroke)) continue;
      let hit = false;
      // For text strokes, test against bounding box
      if (stroke.text) {
        const bb = textBBox(stroke);
        if (
          x >= bb.x - radius &&
          x <= bb.x + bb.w + radius &&
          y >= bb.y - radius &&
          y <= bb.y + bb.h + radius
        ) {
          hit = true;
        }
        if (hit) pendingEraseRef.current.add(stroke);
        continue;
      }
      // For shape strokes, test against the rendered shape polygon
      const pts =
        stroke.shape && stroke.points.length === 2
          ? shapeToSegments(stroke)
          : stroke.points;
      for (const p of pts) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < radius * radius) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          if (distToSegment(x, y, a.x, a.y, b.x, b.y) < radius) {
            hit = true;
            break;
          }
        }
      }
      if (hit) pendingEraseRef.current.add(stroke);
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size === 2) {
          // Cancel any in-progress drawing/pan and start pinch
          if (isDrawingRef.current) cancelCurrentStroke();
          isPanningRef.current = false;
          const pts = [...pointersRef.current.values()];
          pinchRef.current = {
            dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
            cx: (pts[0].x + pts[1].x) / 2,
            cy: (pts[0].y + pts[1].y) / 2,
          };
          // Start tracking two-finger tap for undo
          twoFingerTapRef.current = {
            startPositions: new Map(pointersRef.current),
            moved: false,
          };
        } else if (pointersRef.current.size === 3) {
          // Invalidate two-finger tap, start tracking three-finger tap for redo
          twoFingerTapRef.current = null;
          threeFingerTapRef.current = {
            startPositions: new Map(pointersRef.current),
            moved: false,
          };
        } else if (
          pointersRef.current.size === 1 &&
          touchToolRef.current === "hand"
        ) {
          isPanningRef.current = true;
          panLastRef.current = { x: e.clientX, y: e.clientY };
        }
        // Track tap start for single-finger draw/dashed/line/shape/highlight tools
        const tool = touchToolRef.current;
        if (
          pointersRef.current.size === 1 &&
          (tool === "draw" ||
            tool === "dashed" ||
            tool === "line" ||
            tool === "shape" ||
            tool === "highlight")
        ) {
          tapStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        } else {
          tapStartRef.current = null;
        }
      } else if (
        e.button === 1 ||
        (spaceDownRef.current && e.button === 0)
      ) {
        // Mouse: middle-click or space+left-click = pan
        isPanningRef.current = true;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        setPanning(true);
      }
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [cancelCurrentStroke],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") {
        pointersRef.current.delete(e.pointerId);
        // Check for three-finger tap (redo gesture)
        if (
          pointersRef.current.size === 2 &&
          threeFingerTapRef.current &&
          !threeFingerTapRef.current.moved
        ) {
          redo();
          threeFingerTapRef.current = null;
        }
        if (pointersRef.current.size < 2) {
          // Check for two-finger tap (undo gesture)
          if (
            pointersRef.current.size === 1 &&
            twoFingerTapRef.current &&
            !twoFingerTapRef.current.moved
          ) {
            undo();
          }
          twoFingerTapRef.current = null;
          threeFingerTapRef.current = null;
          pinchRef.current = null;
          persistView();
        }
        if (pointersRef.current.size === 0) {
          if (isPanningRef.current) {
            isPanningRef.current = false;
            tapStartRef.current = null;
            persistView();
            return;
          }
          // Tap-to-dot: if finger didn't move beyond threshold, place a dot
          if (tapStartRef.current && tapStartRef.current.id === e.pointerId) {
            const dx = e.clientX - tapStartRef.current.x;
            const dy = e.clientY - tapStartRef.current.y;
            if (dx * dx + dy * dy <= 25) {
              // Remove any stroke that was started by the move handler
              if (isDrawingRef.current) {
                strokesRef.current.pop();
                undoStackRef.current.pop();
                isDrawingRef.current = false;
                activeModifierRef.current = null;
              }
              const wp = screenToWorld(
                tapStartRef.current.x,
                tapStartRef.current.y,
                viewRef.current,
              );
              notifyColorUsed(lineColorRef.current);
              const dot: Stroke = {
                points: [wp],
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
              tapStartRef.current = null;
              return;
            }
          }
          tapStartRef.current = null;
          if (isDrawingRef.current) {
            if (activeModifierRef.current === "alt") {
              setErasing(false);
              confirmErase();
              strokesCacheRef.current = null;
              scheduleRedraw();
            }
            discardTinyShape();
            isDrawingRef.current = false;
            activeModifierRef.current = null;
            strokesCacheRef.current = null;
            persistStrokes();
            scheduleRedraw();
          }
        }
        return;
      }
      // Mouse pointer up
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setPanning(false);
        if (spaceDownRef.current && canvasRef.current) {
          canvasRef.current.style.cursor = "grab";
        }
        persistView();
        return;
      }
      if (isDrawingRef.current) {
        if (activeModifierRef.current === "alt") {
          confirmErase();
          strokesCacheRef.current = null;
          scheduleRedraw();
        }
        discardTinyShape();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        strokesCacheRef.current = null;
        persistStrokes();
        scheduleRedraw();
      }
    },
    [confirmErase, discardTinyShape, persistStrokes, persistView, scheduleRedraw, notifyColorUsed],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // --- Multi-touch pan/zoom ---
      if (e.pointerType === "touch") {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size >= 2 && pinchRef.current) {
          const pts = [...pointersRef.current.values()];
          const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          const cx = (pts[0].x + pts[1].x) / 2;
          const cy = (pts[0].y + pts[1].y) / 2;
          // Check if fingers moved enough to invalidate two-finger tap
          if (twoFingerTapRef.current && !twoFingerTapRef.current.moved) {
            const startPts = twoFingerTapRef.current.startPositions;
            let totalMove = 0;
            for (const [id, pos] of pointersRef.current) {
              const start = startPts.get(id);
              if (start) {
                totalMove += Math.hypot(pos.x - start.x, pos.y - start.y);
              }
            }
            if (totalMove > 20) {
              twoFingerTapRef.current.moved = true;
            }
          }
          // Check if fingers moved enough to invalidate three-finger tap
          if (threeFingerTapRef.current && !threeFingerTapRef.current.moved) {
            const startPts3 = threeFingerTapRef.current.startPositions;
            let totalMove3 = 0;
            for (const [id, pos] of pointersRef.current) {
              const start = startPts3.get(id);
              if (start) {
                totalMove3 += Math.hypot(pos.x - start.x, pos.y - start.y);
              }
            }
            if (totalMove3 > 20) {
              threeFingerTapRef.current.moved = true;
            }
          }
          // Pan
          const view = viewRef.current;
          view.x += cx - pinchRef.current.cx;
          view.y += cy - pinchRef.current.cy;
          // Zoom
          const rawFactor = dist / pinchRef.current.dist;
          const factor = Math.pow(rawFactor, 5);
          const newScale = Math.min(10, Math.max(0.1, view.scale * factor));
          const ratio = newScale / view.scale;
          view.x = cx - ratio * (cx - view.x);
          view.y = cy - ratio * (cy - view.y);
          view.scale = newScale;
          pinchRef.current = { dist, cx, cy };
          strokesCacheRef.current = null;
          broadcastZoom();
          scheduleRedraw();
          return;
        }
        if (pointersRef.current.size > 1) return;
        // Cancel tap if finger moved beyond threshold
        if (tapStartRef.current) {
          const dx = e.clientX - tapStartRef.current.x;
          const dy = e.clientY - tapStartRef.current.y;
          if (dx * dx + dy * dy > 25) tapStartRef.current = null;
        }
      }

      // --- Panning (mouse space+drag, middle-click, or touch hand tool) ---
      // Start panning if space is held or middle button is pressed
      if (
        !isPanningRef.current &&
        e.pointerType !== "touch" &&
        (spaceDownRef.current || (e.buttons & 4) !== 0)
      ) {
        if (isDrawingRef.current) {
          cancelCurrentStroke();
        }
        isPanningRef.current = true;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        setPanning(true);
      }
      if (isPanningRef.current) {
        const view = viewRef.current;
        view.x += e.clientX - panLastRef.current.x;
        view.y += e.clientY - panLastRef.current.y;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        strokesCacheRef.current = null;
        scheduleRedraw();
        return;
      }

      // Track cursor world position for desktop dot placement
      if (e.pointerType !== "touch") {
        cursorWorldRef.current = screenToWorld(
          e.clientX,
          e.clientY,
          viewRef.current,
        );
      }

      // Block all drawing/erasing while a text stroke is selected (panning handled above)
      if (selectedTextRef.current) return;

      // --- Determine modifier ---
      let modifier:
        | "meta"
        | "shift"
        | "alt"
        | "line"
        | "shape"
        | "highlight"
        | "laser"
        | null;

      if (e.pointerType === "touch") {
        const down = (e.buttons & 1) !== 0;
        if (!down) {
          modifier = null;
        } else {
          const tool = touchToolRef.current;
          modifier =
            tool === "draw"
              ? "meta"
              : tool === "dashed"
                ? "shift"
                : tool === "line"
                  ? "line"
                  : tool === "erase"
                    ? "alt"
                    : tool === "shape"
                      ? "shape"
                      : tool === "highlight"
                        ? "highlight"
                        : null;
        }
      } else {
        modifier = isZoomingRef.current
          ? null
          : spaceDownRef.current
          ? null
          : laserKeyRef.current
          ? "laser"
          : highlightKeyRef.current
          ? "highlight"
          : keyShapeRef.current
            ? "shape"
            : e.altKey && e.shiftKey && !isMac
              ? "shape"
              : e.altKey
                ? "alt"
                : e.ctrlKey && !e.metaKey && isMac
                  ? "shape"
                  : cmdKey(e) && e.shiftKey
                    ? "line"
                    : cmdKey(e)
                      ? "meta"
                      : e.shiftKey
                        ? "shift"
                        : (e.buttons & 1) !== 0
                          ? "meta"
                          : null;
      }

      if (!modifier) {
        if (isDrawingRef.current) {
          if (activeModifierRef.current === "alt") {
            confirmErase();
            strokesCacheRef.current = null;
            scheduleRedraw();
          }
          discardTinyShape();
          isDrawingRef.current = false;
          activeModifierRef.current = null;
          strokesCacheRef.current = null;
          persistStrokes();
          scheduleRedraw();
        }
        return;
      }

      const point = screenToWorld(e.clientX, e.clientY, viewRef.current);

      // Flush erase buffer when switching away from erasing
      if (modifier !== "alt" && activeModifierRef.current === "alt") {
        confirmErase();
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        strokesCacheRef.current = null;
        persistStrokes();
      }

      if (modifier === "alt") {
        if (!isDrawingRef.current || activeModifierRef.current !== "alt") {
          pendingEraseRef.current.clear();
          eraseTrailRef.current = [];
          setErasing(true);
        }
        isDrawingRef.current = true;
        activeModifierRef.current = "alt";
        eraseAt(point.x, point.y);
        scheduleRedraw();
        return;
      }

      if (modifier === "laser") {
        if (!isDrawingRef.current || activeModifierRef.current !== "laser") {
          laserTrailRef.current = [];
        }
        isDrawingRef.current = true;
        activeModifierRef.current = "laser";
        // Add point to laser trail with interpolation
        const trail = laserTrailRef.current;
        const maxGap = 6 / viewRef.current.scale;
        if (trail.length > 0) {
          const last = trail[trail.length - 1];
          const dx = point.x - last.x;
          const dy = point.y - last.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxGap) {
            const steps = Math.ceil(dist / maxGap);
            for (let s = 1; s < steps; s++) {
              const t = s / steps;
              trail.push({ x: last.x + dx * t, y: last.y + dy * t });
            }
          }
        }
        trail.push({ ...point });
        laserMovingRef.current = true;
        // Limit trail length
        const maxLen = 450 / viewRef.current.scale;
        if (trail.length > 2) {
          let acc = 0;
          let cutIdx = 0;
          for (let i = trail.length - 1; i > 0; i--) {
            const dx = trail[i].x - trail[i - 1].x;
            const dy = trail[i].y - trail[i - 1].y;
            acc += Math.sqrt(dx * dx + dy * dy);
            if (acc > maxLen) { cutIdx = i; break; }
          }
          if (cutIdx > 0) trail.splice(0, cutIdx);
          else if (trail.length > 120) trail.splice(0, trail.length - 120);
        }
        scheduleRedraw();
        return;
      }

      if (modifier === "line") {
        if (!isDrawingRef.current || activeModifierRef.current !== "line") {
          notifyColorUsed(lineColor);
          isDrawingRef.current = true;
          activeModifierRef.current = "line";
          const stroke: Stroke = {
            points: [point, { ...point }],
            style: "solid",
            lineWidth,
            color: lineColor,
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          current.points[1] = point;
        }
        scheduleRedraw();
        return;
      }

      if (modifier === "shape") {
        if (!isDrawingRef.current || activeModifierRef.current !== "shape") {
          notifyColorUsed(lineColor);
          isDrawingRef.current = true;
          activeModifierRef.current = "shape";
          const dashed = keyShapeDashedRef.current || e.shiftKey;
          const stroke: Stroke = {
            points: [point, { ...point }],
            style: dashed ? "dashed" : "solid",
            dashGap: dashed ? dashGap : undefined,
            lineWidth,
            color: lineColor,
            shape: keyShapeRef.current || activeShapeRef.current,
            ...(pressureSensitivityRef.current
              ? { seed: Math.floor(Math.random() * 2 ** 31) }
              : {}),
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          current.points[1] = point;
        }
        scheduleRedraw();
        return;
      }

      if (modifier === "highlight") {
        if (
          !isDrawingRef.current ||
          activeModifierRef.current !== "highlight"
        ) {
          notifyColorUsed(lineColor);
          isDrawingRef.current = true;
          activeModifierRef.current = "highlight";
          const stroke: Stroke = {
            points: [point],
            style: "solid",
            lineWidth,
            dashGap,
            color: lineColor,
            highlight: true,
          };
          strokesRef.current.push(stroke);
          undoStackRef.current.push({ type: "draw", stroke });
          redoStackRef.current = [];
        } else {
          const current = strokesRef.current[strokesRef.current.length - 1];
          current.points.push(point);
        }
        scheduleRedraw();
        return;
      }

      if (!isDrawingRef.current || activeModifierRef.current !== modifier) {
        const usePressure = pressureSensitivityRef.current;
        notifyColorUsed(lineColor);
        isDrawingRef.current = true;
        activeModifierRef.current = modifier;
        lastDrawPointRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
        prevWidthRef.current = 1;
        const stroke: Stroke = {
          points: [point],
          style: modifier === "shift" ? "dashed" : "solid",
          lineWidth,
          dashGap,
          color: lineColor,
          ...(usePressure && modifier !== "shift" ? { widths: [1] } : {}),
        };
        strokesRef.current.push(stroke);
        undoStackRef.current.push({ type: "draw", stroke });
        redoStackRef.current = [];
      } else {
        const current = strokesRef.current[strokesRef.current.length - 1];
        current.points.push(point);
        if (current.widths) {
          const now = performance.now();
          const last = lastDrawPointRef.current!;
          const dx = e.clientX - last.x;
          const dy = e.clientY - last.y;
          const dt = Math.max(now - last.t, 1);
          const speed = Math.sqrt(dx * dx + dy * dy) / dt;
          const speedFactor = Math.min(2, Math.max(0.5, 2 - speed / 3));
          const pressure = e.pressure > 0 ? e.pressure : 0.5;
          const raw = speedFactor * (0.5 + pressure);
          const w = prevWidthRef.current * 0.6 + raw * 0.4;
          prevWidthRef.current = w;
          current.widths.push(w);
          lastDrawPointRef.current = { x: e.clientX, y: e.clientY, t: now };
        }
      }

      persistStrokesDebounced();
      scheduleRedraw();
    },
    [
      scheduleRedraw,
      lineWidth,
      lineColor,
      dashGap,
      eraseAt,
      persistStrokes,
      persistStrokesDebounced,
      confirmErase,
      discardTinyShape,
      broadcastZoom,
      notifyColorUsed,
      cancelCurrentStroke,
    ],
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") return; // handled by pointerUp with capture
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setPanning(false);
      }
      if (isDrawingRef.current) {
        if (activeModifierRef.current === "alt") {
          cancelErase();
          return;
        }
        isDrawingRef.current = false;
        activeModifierRef.current = null;
        persistStrokes();
      }
    },
    [persistStrokes, cancelErase],
  );

  // Wheel: pan (scroll) and zoom (Ctrl/Cmd + scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      if (isWritingRef.current) return;
      e.preventDefault();
      const view = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom on trackpad (sets ctrlKey) or Ctrl/Cmd+scroll
        isZoomingRef.current = true;
        setShapeActive(false);
        if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = setTimeout(() => {
          isZoomingRef.current = false;
          zoomTimeoutRef.current = null;
        }, 300);
        const clampedDelta = Math.max(-25, Math.min(25, e.deltaY));
        const zoom = Math.pow(0.99, clampedDelta);
        const newScale = Math.min(10, Math.max(0.1, view.scale * zoom));
        const ratio = newScale / view.scale;
        view.x = e.clientX - ratio * (e.clientX - view.x);
        view.y = e.clientY - ratio * (e.clientY - view.y);
        view.scale = newScale;
        broadcastZoom();
      } else {
        // Two-finger swipe on trackpad or mouse scroll = pan
        view.x -= e.deltaX;
        view.y -= e.deltaY;
      }
      strokesCacheRef.current = null;
      scheduleRedraw();
      persistView();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [scheduleRedraw, broadcastZoom, persistView]);

  const encodedColor = encodeURIComponent(lineColor);
  const crosshairCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='12' y1='4' x2='12' y2='20' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, crosshair`;
  const eraserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='50%25' stop-color='%2389CFF0'/%3E%3Cstop offset='50%25' stop-color='%23FA8072'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='3' y='5' width='18' height='12' rx='2.5' transform='rotate(-25 12 11)' fill='url(%23g)' stroke='%23666' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`;
  const shapeCursors: Record<ShapeKind, string> = {
    line: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='20' x2='20' y2='4' stroke='${encodedColor}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    rectangle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect x='4' y='4' width='16' height='16' fill='none' stroke='${encodedColor}' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`,
    circle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='8' fill='none' stroke='${encodedColor}' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, crosshair`,
    triangle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,4 20,20 4,20' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    star: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,2 14.5,9 22,9 16,14 18.5,21 12,17 5.5,21 8,14 2,9 9.5,9' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    arrow: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='12' x2='18' y2='12' stroke='${encodedColor}' stroke-width='1.5'/%3E%3Cpolyline points='14,8 18,12 14,16' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    pentagon: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,3 21,10 18,21 6,21 3,10' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    hexagon: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,2 21,7 21,17 12,22 3,17 3,7' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    diamond: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,2 22,12 12,22 2,12' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
    lightning: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='13,2 4,12 11,12 9,22 20,10 13,10' fill='none' stroke='${encodedColor}' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`,
  };
  const highlightCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='${encodedColor}' stroke-width='6' stroke-linecap='round' stroke-opacity='0.4'/%3E%3C/svg%3E") 12 12, crosshair`;
  const laserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='4' fill='%23ff3030' fill-opacity='0.9'/%3E%3Ccircle cx='12' cy='12' r='7' fill='none' stroke='%23ff3030' stroke-width='1' stroke-opacity='0.4'/%3E%3C/svg%3E") 12 12, crosshair`;
  const cursor = zCursor !== null
      ? zCursor
      : panning
        ? "grabbing"
        : lasering
          ? laserCursor
          : erasing
            ? eraserCursor
            : highlighting
              ? highlightCursor
              : shapeActive
                ? shapeCursors[keyShapeRef.current || activeShape]
                : crosshairCursor;

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

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
      setZCursor(zKeyRef.current ? "default" : null);
    } else if (raw.trim()) {
      notifyColorUsed(lineColorRef.current);
      const stroke: Stroke = {
        points: [{ ...writingPosRef.current }],
        style: "solid",
        lineWidth: 1,
        color: lineColorRef.current,
        text: raw,
        fontSize: textSizeRef.current,
      };
      strokesRef.current.push(stroke);
      undoStackRef.current.push({ type: "draw", stroke });
      redoStackRef.current = [];
      strokesCacheRef.current = null;
      persistStrokes();
      setZCursor(zKeyRef.current ? "default" : null);
    } else {
      setZCursor(zKeyRef.current ? "default" : null);
    }
    writingTextRef.current = "";
    caretPosRef.current = 0;
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
    caretVisibleRef.current = true;
    if (caretTimerRef.current) clearInterval(caretTimerRef.current);
    caretTimerRef.current = setInterval(() => {
      caretVisibleRef.current = !caretVisibleRef.current;
      scheduleRedraw();
    }, 530);
    isWritingRef.current = true;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
    scheduleRedraw();
  }, [scheduleRedraw]);

  const startEditingStroke = useCallback((stroke: Stroke, clickWorldPos?: { x: number; y: number }) => {
    const text = stroke.text ?? "";
    const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"] * (stroke.fontScale ?? 1);
    const lines = text.split("\n");
    const anchor = stroke.points[0];

    // Find caret position from click, or default to end of text
    let caretPos = text.length;
    if (clickWorldPos) {
      const lineHeight = basePx * 1.2;
      const lineIndex = Math.max(0, Math.min(lines.length - 1,
        Math.floor((clickWorldPos.y - anchor.y) / lineHeight)));
      const line = lines[lineIndex];
      const bboxCtx = getBBoxMeasureCtx();
      let col = line.length;
      if (bboxCtx) {
        bboxCtx.font = `400 ${basePx}px ${TEXT_FONT_FAMILY}`;
        const xInLine = clickWorldPos.x - anchor.x;
        col = line.length;
        for (let i = 1; i <= line.length; i++) {
          if (bboxCtx.measureText(line.slice(0, i)).width > xInLine) {
            const wBefore = bboxCtx.measureText(line.slice(0, i - 1)).width;
            const wAt    = bboxCtx.measureText(line.slice(0, i)).width;
            col = (xInLine - wBefore) < (wAt - xInLine) ? i - 1 : i;
            break;
          }
        }
      }
      caretPos = lines.slice(0, lineIndex).reduce((acc, l) => acc + l.length + 1, 0) + col;
    }

    editingStrokeRef.current = stroke;
    editingOldTextRef.current = text;
    writingPosRef.current = { ...anchor };
    writingTextRef.current = text;
    caretPosRef.current = caretPos;
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

  // Stable refs so the keydown useEffect can call these without re-registering
  const finishWritingRef = useRef(finishWriting);
  finishWritingRef.current = finishWriting;
  const startWritingRef = useRef(startWriting);
  startWritingRef.current = startWriting;

  // Touch: tap canvas to place text when text tool is active
  const handlePointerDownForText = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isWritingRef.current) {
        // Click on canvas while writing → accept text
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
              startEditingStroke(stroke, wp);
              return;
            }
            lastTextTapRef.current = { time: now, stroke };
            return; // block drawing on first tap — wait for potential double-click
          }
        }
        lastTextTapRef.current = null;
      }

      // Text select / move / resize mode (mouse/stylus, z held or already selected)
      if ((selectedTextRef.current || zKeyRef.current) && e.pointerType !== "touch") {
        const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
        const { scale } = viewRef.current;
        const pad = 3 / scale;
        const hs = 7 / scale;

        if (selectedTextRef.current) {
          const bb = selectBBox(selectedTextRef.current)!;
          // Check corner handles first
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
          // Check body — double-click edits text, single click starts move
          if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
              wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
            const stroke = selectedTextRef.current;
            if (stroke.text) {
              const now = performance.now();
              const last = lastTextTapRef.current;
              if (last && last.stroke === stroke && now - last.time < 300) {
                lastTextTapRef.current = null;
                startEditingStroke(stroke, wp);
                return;
              }
              lastTextTapRef.current = { time: now, stroke };
            }
            selectDragRef.current = {
              mode: "move",
              startPtr: { ...wp },
              startPoints: stroke.points.map(p => ({ ...p })),
              startScale: stroke.fontScale ?? 1,
              bbox: bb,
            };
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
          }
          // Clicked elsewhere — deselect and stop
          selectedTextRef.current = null;
          selectDragRef.current = null;
          setZCursor(zKeyRef.current ? "default" : null);
          scheduleRedraw();
          return;
        }

        // z held, no selection — check text and shapes
        if (zKeyRef.current) {
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            const stroke = strokesRef.current[i];
            const bb = selectBBox(stroke);
            if (!bb) continue;
            if (wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
                wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
              selectedTextRef.current = stroke;
              hoverTextRef.current = null;
              setZCursor("default");
              selectDragRef.current = {
                mode: "move",
                startPtr: { ...wp },
                startPoints: stroke.points.map(p => ({ ...p })),
                startScale: stroke.fontScale ?? 1,
                bbox: bb,
              };
              (e.target as Element).setPointerCapture(e.pointerId);
              scheduleRedraw();
              return;
            }
          }
          // z held, clicked empty space — don't draw
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
          const bb = selectBBox(selectedTextRef.current);
          if (!bb) { onPointerMove(e); return; }
          const pad = 3 / scale;
          const hs = 7 / scale;
          const cornerCenters = [
            { x: bb.x - pad,        y: bb.y - pad },
            { x: bb.x + bb.w + pad, y: bb.y - pad },
            { x: bb.x + bb.w + pad, y: bb.y + bb.h + pad },
            { x: bb.x - pad,        y: bb.y + bb.h + pad },
          ];
          const resCursors = ["nwse-resize", "nesw-resize", "nwse-resize", "nesw-resize"];
          let cur = "default";
          for (let ci = 0; ci < 4; ci++) {
            const cc = cornerCenters[ci];
            if (Math.abs(wp.x - cc.x) <= hs + pad && Math.abs(wp.y - cc.y) <= hs + pad) {
              cur = resCursors[ci];
              break;
            }
          }
          if (cur === "default" &&
              wp.x >= bb.x - pad && wp.x <= bb.x + bb.w + pad &&
              wp.y >= bb.y - pad && wp.y <= bb.y + bb.h + pad) {
            cur = "move";
          }
          setZCursor(cur);
        } else if (zKeyRef.current) {
          // Z-key hover detection (text + shapes)
          const wp = screenToWorld(e.clientX, e.clientY, viewRef.current);
          const { scale } = viewRef.current;
          const pad = 3 / scale;
          let hit: Stroke | null = null;
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            const stroke = strokesRef.current[i];
            const bb = selectBBox(stroke);
            if (!bb) continue;
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

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Drawing canvas"
      className="block touch-none select-none outline-none"
      tabIndex={-1}
      style={{ cursor }}
      onPointerDown={handlePointerDownForText}
      onPointerMove={handlePointerMoveGuarded}
      onPointerUp={handlePointerUpGuarded}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

export default memo(Canvas);
