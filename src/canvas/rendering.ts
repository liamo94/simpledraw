import { getStroke } from "perfect-freehand";
import rough from "roughjs";
import type { ShapeKind, Theme } from "../hooks/useSettings";
import type { Stroke } from "./types";
import { smoothPoints, smoothWidths, buildFont, TEXT_SIZE_MAP } from "./geometry";

// ─── Theme helpers ────────────────────────────────────────────────────────────

export function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || theme === "midnight" || theme === "lumber" || theme === "slate";
}

export function getBackgroundColor(theme: Theme): string {
  if (theme === "midnight") return "#1a1a2e";
  if (theme === "dark") return "#06060e";
  if (theme === "lumber") return "#110e0a";
  if (theme === "slate") return "#1c2128";
  if (theme === "journal") return "#f5e2b8";
  if (theme === "sky") return "#e0ecf6";
  if (theme === "sand") return "#f5e8dc";
  return "#f5f5f0";
}

// ─── Color utilities ──────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Shape geometry helpers ───────────────────────────────────────────────────

export function starPoints(
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

export function regularPolygonPoints(
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

export function roundedPoly(
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

export function roughPolyPath(pts: { x: number; y: number }[], r: number): string {
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

// ─── Smooth polyline path (rounded bezier corners for multi-point arrows) ─────

/** Builds a smooth open-polyline path through pts using quadratic bezier corners. */
export function smoothArrowPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], cornerRadius = 40) {
  const n = pts.length;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < n - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const d1x = prev.x - curr.x, d1y = prev.y - curr.y;
    const l1 = Math.hypot(d1x, d1y);
    const d2x = next.x - curr.x, d2y = next.y - curr.y;
    const l2 = Math.hypot(d2x, d2y);
    if (l1 < 1e-6 || l2 < 1e-6) { ctx.lineTo(curr.x, curr.y); continue; }
    const r = Math.min(cornerRadius, l1 / 2, l2 / 2);
    const t1x = curr.x + (d1x / l1) * r, t1y = curr.y + (d1y / l1) * r;
    const t2x = curr.x + (d2x / l2) * r, t2y = curr.y + (d2y / l2) * r;
    ctx.lineTo(t1x, t1y);
    ctx.quadraticCurveTo(curr.x, curr.y, t2x, t2y);
  }
  ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
}

/** Samples many points along the smooth bezier path that smoothArrowPath would draw.
 *  Used to feed perfect-freehand for dynamic-stroke rendering of bent arrows. */
function densifySmoothedPath(
  pts: { x: number; y: number }[],
  cornerRadius = 40,
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  const n = pts.length;
  if (n === 0) return result;
  result.push({ ...pts[0] });
  let prevPt = pts[0];
  for (let i = 1; i < n - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const d1x = prev.x - curr.x, d1y = prev.y - curr.y;
    const l1 = Math.hypot(d1x, d1y);
    const d2x = next.x - curr.x, d2y = next.y - curr.y;
    const l2 = Math.hypot(d2x, d2y);
    if (l1 < 1e-6 || l2 < 1e-6) { result.push({ ...curr }); prevPt = curr; continue; }
    const r = Math.min(cornerRadius, l1 / 2, l2 / 2);
    const t1 = { x: curr.x + (d1x / l1) * r, y: curr.y + (d1y / l1) * r };
    const t2 = { x: curr.x + (d2x / l2) * r, y: curr.y + (d2y / l2) * r };
    // Linear segment prevPt → t1
    const linearSteps = Math.max(1, Math.round(Math.hypot(t1.x - prevPt.x, t1.y - prevPt.y) / 4));
    for (let s = 1; s <= linearSteps; s++) {
      const t = s / linearSteps;
      result.push({ x: prevPt.x + (t1.x - prevPt.x) * t, y: prevPt.y + (t1.y - prevPt.y) * t });
    }
    // Quadratic bezier t1 → curr (control) → t2
    const bezierSteps = Math.max(4, Math.round(Math.hypot(t2.x - t1.x, t2.y - t1.y) * 1.2 / 4));
    for (let s = 1; s <= bezierSteps; s++) {
      const t = s / bezierSteps, mt = 1 - t;
      result.push({
        x: mt * mt * t1.x + 2 * mt * t * curr.x + t * t * t2.x,
        y: mt * mt * t1.y + 2 * mt * t * curr.y + t * t * t2.y,
      });
    }
    prevPt = t2;
  }
  // Final straight segment → last point
  const last = pts[n - 1];
  const finalSteps = Math.max(1, Math.round(Math.hypot(last.x - prevPt.x, last.y - prevPt.y) / 4));
  for (let s = 1; s <= finalSteps; s++) {
    const t = s / finalSteps;
    result.push({ x: prevPt.x + (last.x - prevPt.x) * t, y: prevPt.y + (last.y - prevPt.y) * t });
  }
  return result;
}

// ─── Shape rendering ──────────────────────────────────────────────────────────

export function renderShape(
  ctx: CanvasRenderingContext2D,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  shape: ShapeKind,
  lineWidth: number,
  color?: string,
  fill?: boolean,
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
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const headLen = Math.max(22, lineWidth * 4.5);
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
  if (fill && color && shape !== "line" && shape !== "arrow") {
    ctx.fillStyle = hexToRgba(color, 0.2);
    ctx.fill();
  }
  ctx.stroke();
}

export function renderRoughShape(
  ctx: CanvasRenderingContext2D,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  shape: ShapeKind,
  lineWidth: number,
  style: "solid" | "dashed",
  dashGap: number | undefined,
  seed: number,
  color: string,
  fill?: boolean,
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
    disableMultiStroke: style === "dashed",
    ...(style === "dashed"
      ? { strokeLineDash: [10 * dashScale, (dashGap ?? 8) * 5 * dashScale] }
      : {}),
    ...(fill && shape !== "line" && shape !== "arrow"
      ? { fill: hexToRgba(color, 0.2), fillStyle: "solid" as const }
      : {}),
  };
  const r = Math.min(w, h) * 0.1;
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
      const headLen = Math.max(22, lineWidth * 4.5);
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

// ─── Shape-to-segments (hit-testing) ─────────────────────────────────────────

export function shapeToSegments(stroke: Stroke): { x: number; y: number }[] {
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
      return stroke.points.length > 2 ? [...stroke.points] : [p0, p1];
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
      const pts = stroke.points;
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const headLen = 22;
      const headAngle = Math.PI / 6;
      return [
        ...pts,
        { x: last.x - headLen * Math.cos(angle - headAngle), y: last.y - headLen * Math.sin(angle - headAngle) },
        last,
        { x: last.x - headLen * Math.cos(angle + headAngle), y: last.y - headLen * Math.sin(angle + headAngle) },
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

// ─── Full stroke rendering ────────────────────────────────────────────────────

export function renderStrokesToCtx(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    // Text stroke rendering
    if (stroke.text) {
      const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"] * (stroke.fontScale ?? 1);
      ctx.font = buildFont(basePx, stroke.bold, stroke.italic, stroke.fontFamily);
      ctx.fillStyle = stroke.color;
      ctx.textBaseline = "top";
      ctx.textAlign = stroke.textAlign ?? "left";
      const lines = stroke.text.split("\n");
      const lineHeight = basePx * 1.2;
      const anchor = stroke.points[0];
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], anchor.x, anchor.y + i * lineHeight);
      }
      ctx.textAlign = "left";
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
    // Multi-point line (3+ bend points, no arrowhead)
    if (stroke.shape === "line" && stroke.points.length > 2) {
      const pts = stroke.points;
      ctx.strokeStyle = color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const dashScale = stroke.lineWidth / 4;
      ctx.setLineDash(stroke.style === "dashed" ? [10 * dashScale, (stroke.dashGap ?? 8) * 5 * dashScale] : []);
      ctx.beginPath();
      smoothArrowPath(ctx, pts);
      ctx.stroke();
      continue;
    }
    // Multi-point arrow (3+ bend points)
    if (stroke.shape === "arrow" && stroke.points.length > 2) {
      const pts = stroke.points;
      const n = pts.length;
      const last = pts[n - 1];
      const prev = pts[n - 2];
      // If the trailing point hasn't moved yet (duplicate from bend click), use the prior segment direction
      const angleFrom = Math.hypot(last.x - prev.x, last.y - prev.y) < 1 && n >= 3 ? pts[n - 3] : prev;
      const angle = Math.atan2(last.y - angleFrom.y, last.x - angleFrom.x);
      const headLen = Math.max(22, stroke.lineWidth * 4.5);
      const headAngle = Math.PI / 6;
      if (stroke.seed !== undefined && stroke.style !== "dashed") {
        // Dynamic stroke: densify the bezier path and run through perfect-freehand.
        // Trim the body to stop before the arrowhead tip so the V lines are clearly visible.
        const sampled = densifySmoothedPath(pts);

        // Walk backwards from the end and drop points until we've cleared headLen * 0.5
        let cumulLen = 0;
        let bodyEnd = sampled.length - 1;
        for (let i = sampled.length - 1; i > 0; i--) {
          cumulLen += Math.hypot(sampled[i].x - sampled[i - 1].x, sampled[i].y - sampled[i - 1].y);
          if (cumulLen >= headLen * 0.5) { bodyEnd = i; break; }
        }
        const bodyPath = sampled.slice(0, bodyEnd + 1);

        const ns = bodyPath.length;
        const pfPts = bodyPath.map((p, i) => {
          // straight → 0.7 (85% of lineWidth), sharp bend → 0.8 (90% of lineWidth).
          let pressure = 0.7;
          if (i > 0 && i < ns - 1) {
            const sp = bodyPath[i - 1], sn = bodyPath[i + 1];
            const ax = p.x - sp.x, ay = p.y - sp.y;
            const bx = sn.x - p.x, by = sn.y - p.y;
            const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
            if (la > 1e-6 && lb > 1e-6) {
              const cos = (ax * bx + ay * by) / (la * lb);
              pressure = 0.7 + (1 - Math.max(-1, Math.min(1, cos))) * 0.05;
            }
          }
          return [p.x, p.y, pressure] as [number, number, number];
        });
        const outline = getStroke(pfPts, {
          size: stroke.lineWidth,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0,
          simulatePressure: false,
          last: true,
          end: { cap: true },
        });
        if (outline.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(outline[0][0], outline[0][1]);
          for (let i = 1; i < outline.length - 1; i++) {
            const mx = (outline[i][0] + outline[i + 1][0]) / 2;
            const my = (outline[i][1] + outline[i + 1][1]) / 2;
            ctx.quadraticCurveTo(outline[i][0], outline[i][1], mx, my);
          }
          ctx.lineTo(outline[outline.length - 1][0], outline[outline.length - 1][1]);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const dashScale = stroke.lineWidth / 4;
        ctx.setLineDash(stroke.style === "dashed" ? [10 * dashScale, (stroke.dashGap ?? 8) * 5 * dashScale] : []);
        ctx.beginPath();
        smoothArrowPath(ctx, pts);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Arrowhead (same for both paths)
      ctx.strokeStyle = color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(last.x - headLen * Math.cos(angle - headAngle), last.y - headLen * Math.sin(angle - headAngle));
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(last.x - headLen * Math.cos(angle + headAngle), last.y - headLen * Math.sin(angle + headAngle));
      ctx.stroke();
      continue;
    }
    if (stroke.shape && stroke.points.length === 2) {
      if (Math.abs(stroke.points[1].x - stroke.points[0].x) < 0.5 &&
          Math.abs(stroke.points[1].y - stroke.points[0].y) < 0.5) continue;
      if (stroke.seed !== undefined) {
        // rough.js uses ctx.save()/restore() per path but only sets lineDash when strokeLineDash
        // is provided (i.e. for dashed shapes). For solid shapes it inherits whatever lineDash is
        // currently on the canvas — so reset it here to prevent contamination from previous strokes.
        ctx.setLineDash([]);
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
          stroke.fill,
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
          color,
          stroke.fill,
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
