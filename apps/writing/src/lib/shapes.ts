// ── Types ─────────────────────────────────────────────────────────────────────

export type ShapeKind =
  | 'circle' | 'rectangle' | 'triangle' | 'diamond'
  | 'pentagon' | 'hexagon' | 'star' | 'line' | 'arrow' | 'cloud';

export const ALL_SHAPES: ShapeKind[] = [
  'circle', 'rectangle', 'triangle', 'diamond',
  'pentagon', 'hexagon', 'star', 'line', 'arrow', 'cloud',
];

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  circle: 'Circle', rectangle: 'Rect', triangle: 'Triangle',
  diamond: 'Diamond', pentagon: 'Pentagon', hexagon: 'Hexagon',
  star: 'Star', line: 'Line', arrow: 'Arrow', cloud: 'Cloud',
};

// Bounding box size in px per size key
export const SHAPE_SIZE_PX: Record<string, number> = {
  xs: 80, sm: 120, md: 165, lg: 215, xl: 270,
};

export type ShapeTarget = {
  kind: ShapeKind;
  x: number; // absolute canvas left edge of bounding box
  y: number; // absolute canvas top edge of bounding box
  w: number;
  h: number;
  angle?: number; // radians — used for line/arrow direction
};

export type ShapeRoundConfig = {
  seed: number;
  kinds: ShapeKind[];
  count: number;
  sizePxOptions: number[];
};

// ── Geometry helpers (ported from apps/drawtool/src/canvas/rendering.ts) ─────

function starPoints(
  cx: number, cy: number,
  outerRx: number, outerRy: number,
  innerRx: number, innerRy: number,
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
  cx: number, cy: number,
  rx: number, ry: number,
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

function cloudArcData(x: number, y: number, w: number, h: number) {
  const ox = x + w / 2, oy = y + h / 2;
  const naturalBumpR = 3 * Math.sqrt(Math.max(1, Math.min(w, h)));
  const bumpR = Math.max(naturalBumpR, 2 * (w + h) / 42);
  const norm2pi = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  const margin = bumpR * 0.55;
  const iw = Math.max(bumpR * 0.6, w - 2 * margin);
  const ih = Math.max(bumpR * 0.6, h - 2 * margin);
  const ir = Math.min(iw / 2, ih / 2, bumpR * 1.1);
  const ix = ox - iw / 2, iy = oy - ih / 2;

  const sw = Math.max(0, iw - 2 * ir);
  const sh = Math.max(0, ih - 2 * ir);
  const cp = (Math.PI / 2) * ir;
  const perimeter = 2 * (sw + sh) + 4 * cp;

  const N = Math.min(200, Math.max(6, Math.ceil(perimeter / (bumpR * 1.5)) + 1));
  const spacing = perimeter / N;

  const centers: { x: number; y: number }[] = [];
  const normals: number[] = [];
  for (let i = 0; i < N; i++) {
    let d = i * spacing;
    let pt: { x: number; y: number };
    let na: number;
    if (d < cp) {
      const a = Math.PI + (d / cp) * (Math.PI / 2);
      pt = { x: ix + ir + Math.cos(a) * ir, y: iy + ir + Math.sin(a) * ir };
      na = a;
    } else if ((d -= cp) < sw) {
      pt = { x: ix + ir + d, y: iy };
      na = -Math.PI / 2;
    } else if ((d -= sw) < cp) {
      const a = -Math.PI / 2 + (d / cp) * (Math.PI / 2);
      pt = { x: ix + iw - ir + Math.cos(a) * ir, y: iy + ir + Math.sin(a) * ir };
      na = a;
    } else if ((d -= cp) < sh) {
      pt = { x: ix + iw, y: iy + ir + d };
      na = 0;
    } else if ((d -= sh) < cp) {
      const a = (d / cp) * (Math.PI / 2);
      pt = { x: ix + iw - ir + Math.cos(a) * ir, y: iy + ih - ir + Math.sin(a) * ir };
      na = a;
    } else if ((d -= cp) < sw) {
      pt = { x: ix + iw - ir - d, y: iy + ih };
      na = Math.PI / 2;
    } else if ((d -= sw) < cp) {
      const a = Math.PI / 2 + (d / cp) * (Math.PI / 2);
      pt = { x: ix + ir + Math.cos(a) * ir, y: iy + ih - ir + Math.sin(a) * ir };
      na = a;
    } else {
      d -= cp;
      pt = { x: ix, y: iy + ih - ir - d };
      na = Math.PI;
    }
    centers.push(pt);
    normals.push(na);
  }

  const ipts: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const c1 = centers[i], c2 = centers[(i + 1) % N];
    const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy);
    const a2 = d / 2, h2 = bumpR * bumpR - a2 * a2;
    if (h2 <= 0) { ipts.push({ x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }); continue; }
    const hh = Math.sqrt(h2);
    const mx = (c1.x + c2.x) / 2, my = (c1.y + c2.y) / 2;
    const px = -dy / d * hh, py = dx / d * hh;
    const d1 = Math.hypot(mx + px - ox, my + py - oy);
    const d2 = Math.hypot(mx - px - ox, my - py - oy);
    ipts.push(d1 > d2 ? { x: mx + px, y: my + py } : { x: mx - px, y: my - py });
  }

  return { centers, normals, ipts, bumpR, N, norm2pi };
}

// ── Shape path builder ────────────────────────────────────────────────────────

export function buildShapePath(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  x: number, y: number, w: number, h: number,
  angle = 0,
): void {
  const cx = x + w / 2, cy = y + h / 2;
  const r = Math.min(w, h) * 0.1;
  ctx.beginPath();
  switch (kind) {
    case 'circle':
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'rectangle':
      ctx.roundRect(x, y, w, h, r);
      break;
    case 'triangle':
      roundedPoly(ctx, [{ x: cx, y }, { x: x + w, y: y + h }, { x, y: y + h }], r);
      break;
    case 'diamond':
      roundedPoly(ctx, [{ x: cx, y }, { x: x + w, y: cy }, { x: cx, y: y + h }, { x, y: cy }], r);
      break;
    case 'pentagon': {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 5);
      roundedPoly(ctx, pts, r);
      break;
    }
    case 'hexagon': {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 6);
      roundedPoly(ctx, pts, r);
      break;
    }
    case 'star': {
      const pts = starPoints(cx, cy, w / 2, h / 2, w / 5, h / 5);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      break;
    }
    case 'line': {
      const hl = w * 0.7;
      ctx.moveTo(cx - hl * Math.cos(angle), cy - hl * Math.sin(angle));
      ctx.lineTo(cx + hl * Math.cos(angle), cy + hl * Math.sin(angle));
      break;
    }
    case 'arrow': {
      const hl = w * 0.65;
      const p0x = cx - hl * Math.cos(angle), p0y = cy - hl * Math.sin(angle);
      const p1x = cx + hl * Math.cos(angle), p1y = cy + hl * Math.sin(angle);
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(p1x, p1y);
      // Arrowhead wings pointing back from tip
      const hs = Math.min(w, h) * 0.42;
      const ha = Math.PI / 6;
      const dirBack = angle + Math.PI;
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p1x + hs * Math.cos(dirBack - ha), p1y + hs * Math.sin(dirBack - ha));
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p1x + hs * Math.cos(dirBack + ha), p1y + hs * Math.sin(dirBack + ha));
      break;
    }
    case 'cloud': {
      const { centers, normals, ipts, bumpR, N, norm2pi } = cloudArcData(x, y, w, h);
      ctx.moveTo(ipts[N - 1].x, ipts[N - 1].y);
      for (let i = 0; i < N; i++) {
        const c = centers[i];
        const sp = ipts[(i + N - 1) % N], ep = ipts[i];
        const sa = Math.atan2(sp.y - c.y, sp.x - c.x);
        const ea = Math.atan2(ep.y - c.y, ep.x - c.x);
        const outerDir = norm2pi(normals[i]);
        const t1 = norm2pi(sa), t2 = norm2pi(ea);
        const cwPasses = t1 <= t2
          ? (outerDir >= t1 && outerDir <= t2)
          : (outerDir >= t1 || outerDir <= t2);
        ctx.arc(c.x, c.y, bumpR, sa, ea, !cwPasses);
      }
      ctx.closePath();
      break;
    }
  }
}

// ── Ghost renderer ────────────────────────────────────────────────────────────

/** Renders a shape outline with the context's current globalAlpha. */
export function renderShapeGhost(
  ctx: CanvasRenderingContext2D,
  shape: ShapeTarget,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, shape.w * 0.075);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  buildShapePath(ctx, shape.kind, shape.x, shape.y, shape.w, shape.h, shape.angle);
  ctx.stroke();
}

// ── Layout engine ─────────────────────────────────────────────────────────────

// Fractional center positions per count (in [0,1] × [0,1] available area)
const GRID_FRACTIONS: { fx: number; fy: number }[][] = [
  [{ fx: 0.5, fy: 0.5 }],
  [{ fx: 0.28, fy: 0.5 }, { fx: 0.72, fy: 0.5 }],
  [{ fx: 0.5, fy: 0.26 }, { fx: 0.25, fy: 0.74 }, { fx: 0.75, fy: 0.74 }],
  [
    { fx: 0.27, fy: 0.3 }, { fx: 0.73, fy: 0.3 },
    { fx: 0.27, fy: 0.7 }, { fx: 0.73, fy: 0.7 },
  ],
  [
    { fx: 0.18, fy: 0.3 }, { fx: 0.5, fy: 0.3 }, { fx: 0.82, fy: 0.3 },
    { fx: 0.33, fy: 0.72 }, { fx: 0.67, fy: 0.72 },
  ],
];

export function layoutShapes(
  kinds: ShapeKind[],
  count: number,
  sizePxOptions: number[],
  canvasW: number,
  canvasH: number,
  rng: () => number,
): ShapeTarget[] {
  const clampedCount = Math.min(count, GRID_FRACTIONS.length);
  const positions = GRID_FRACTIONS[clampedCount - 1] ?? GRID_FRACTIONS[0];

  // Use the largest size for grid spacing so shapes never overlap
  const maxSizePx = Math.max(...sizePxOptions);

  // Available area for shape centers (so no shape overflows the canvas)
  const pad = maxSizePx * 0.15;
  const minX = maxSizePx / 2 + pad;
  const maxX = canvasW - maxSizePx / 2 - pad;
  const minY = maxSizePx / 2 + pad;
  const maxY = canvasH - maxSizePx / 2 - pad;
  const areaW = Math.max(0, maxX - minX);
  const areaH = Math.max(0, maxY - minY);
  const jitter = 0.07;

  return positions.map((pos) => {
    let cx = minX + pos.fx * areaW;
    let cy = minY + pos.fy * areaH;
    cx += (rng() - 0.5) * 2 * jitter * areaW;
    cy += (rng() - 0.5) * 2 * jitter * areaH;
    cx = Math.max(minX, Math.min(maxX, cx));
    cy = Math.max(minY, Math.min(maxY, cy));
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const sizePx = sizePxOptions[Math.floor(rng() * sizePxOptions.length)];
    // Random angle for lines/arrows: ±50° range
    const angle = (kind === 'line' || kind === 'arrow')
      ? (rng() - 0.5) * Math.PI * (5 / 9)
      : undefined;
    return { kind, x: cx - sizePx / 2, y: cy - sizePx / 2, w: sizePx, h: sizePx, angle };
  });
}

// Mulberry32 PRNG (same as App.tsx)
export function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
