import { getStroke } from "perfect-freehand";
import rough from "roughjs";
import type { Stroke, Theme } from "./types";
import { TEXT_SIZE_MAP, smoothPoints, smoothWidths, getFontCss, anyStrokeBBox } from "./geometry";
import {
  cloudArcData, starPoints, regularPolygonPoints, roughPolyPath,
  hexToRgba, getBackgroundColor,
} from "./rendering";
import { getImageDataUrl } from "./imageStore";

const NS = "http://www.w3.org/2000/svg";


function svgEl(tag: string, attrs: Record<string, string | number> = {}): Element {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const n = (v: number) => v.toFixed(2);

function strokePathFromOutline(outline: number[][]): string {
  const len = outline.length;
  if (len < 2) return "";
  const mx0 = (outline[len - 1][0] + outline[0][0]) / 2;
  const my0 = (outline[len - 1][1] + outline[0][1]) / 2;
  const parts = [`M${n(mx0)},${n(my0)}`];
  for (let i = 0; i < len; i++) {
    const next = outline[(i + 1) % len];
    const mx = (outline[i][0] + next[0]) / 2;
    const my = (outline[i][1] + next[1]) / 2;
    parts.push(`Q${n(outline[i][0])},${n(outline[i][1])},${n(mx)},${n(my)}`);
  }
  parts.push("Z");
  return parts.join("");
}

function smoothPolyPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M${n(pts[0].x)},${n(pts[0].y)}L${n(pts[1].x)},${n(pts[1].y)}`;
  const parts = [`M${n(pts[0].x)},${n(pts[0].y)}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    parts.push(`Q${n(pts[i].x)},${n(pts[i].y)},${n(mx)},${n(my)}`);
  }
  parts.push(`L${n(pts[pts.length - 1].x)},${n(pts[pts.length - 1].y)}`);
  return parts.join("");
}

function smoothLineSvg(pts: { x: number; y: number }[], cornerRadius = 40): string {
  const len = pts.length;
  if (!len) return "";
  const parts: string[] = [`M${n(pts[0].x)},${n(pts[0].y)}`];
  for (let i = 1; i < len - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const d1x = prev.x - curr.x, d1y = prev.y - curr.y;
    const l1 = Math.hypot(d1x, d1y);
    const d2x = next.x - curr.x, d2y = next.y - curr.y;
    const l2 = Math.hypot(d2x, d2y);
    if (l1 < 1e-6 || l2 < 1e-6) { parts.push(`L${n(curr.x)},${n(curr.y)}`); continue; }
    const r = Math.min(cornerRadius, l1 / 2, l2 / 2);
    const t1x = curr.x + (d1x / l1) * r, t1y = curr.y + (d1y / l1) * r;
    const t2x = curr.x + (d2x / l2) * r, t2y = curr.y + (d2y / l2) * r;
    parts.push(`L${n(t1x)},${n(t1y)}Q${n(curr.x)},${n(curr.y)},${n(t2x)},${n(t2y)}`);
  }
  parts.push(`L${n(pts[len - 1].x)},${n(pts[len - 1].y)}`);
  return parts.join("");
}

function cloudPathSvg(x: number, y: number, w: number, h: number, seed?: number, sharp?: boolean): string {
  const { centers, normals, ipts, bumpR, N, norm2pi } = cloudArcData(x, y, w, h);

  if (sharp) {
    let rs = ((seed ?? 42) | 0) >>> 0;
    const rng = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
    const parts = [`M${n(ipts[N - 1].x)},${n(ipts[N - 1].y)}`];
    for (let i = 0; i < N; i++) {
      const scale = 1.4 + rng() * 0.4;
      const tipX = centers[i].x + Math.cos(normals[i]) * bumpR * scale;
      const tipY = centers[i].y + Math.sin(normals[i]) * bumpR * scale;
      parts.push(`L${n(tipX)},${n(tipY)}L${n(ipts[i].x)},${n(ipts[i].y)}`);
    }
    return parts.join("") + "Z";
  }

  const parts = [`M${n(ipts[N - 1].x)},${n(ipts[N - 1].y)}`];
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
    const anticlockwise = !cwPasses;
    const sx = c.x + bumpR * Math.cos(sa), sy = c.y + bumpR * Math.sin(sa);
    const ex = c.x + bumpR * Math.cos(ea), ey = c.y + bumpR * Math.sin(ea);
    const span = anticlockwise
      ? ((sa - ea + 2 * Math.PI) % (2 * Math.PI))
      : ((ea - sa + 2 * Math.PI) % (2 * Math.PI));
    const largeArc = span > Math.PI ? 1 : 0;
    const sweep = anticlockwise ? 0 : 1;
    parts.push(`L${n(sx)},${n(sy)}A${n(bumpR)},${n(bumpR)},0,${largeArc},${sweep},${n(ex)},${n(ey)}`);
  }
  return parts.join("") + "Z";
}

function buildShapePathSvg(
  shape: string,
  x: number, y: number, w: number, h: number,
  cx: number, cy: number, r: number,
  p0: { x: number; y: number }, p1: { x: number; y: number },
  seed?: number, sharp?: boolean,
): string | null {
  switch (shape) {
    case "line": return `M${n(p0.x)},${n(p0.y)}L${n(p1.x)},${n(p1.y)}`;
    case "rectangle": return roughPolyPath([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], r);
    case "circle": return null; // handled via <ellipse>
    case "triangle": return roughPolyPath([{ x: cx, y }, { x: x + w, y: y + h }, { x, y: y + h }], r);
    case "star": {
      const pts = starPoints(cx, cy, w / 2, h / 2, w / 5, h / 5);
      return "M" + pts.map(p => `${n(p.x)},${n(p.y)}`).join("L") + "Z";
    }
    case "pentagon": return roughPolyPath(regularPolygonPoints(cx, cy, w / 2, h / 2, 5), r);
    case "hexagon": return roughPolyPath(regularPolygonPoints(cx, cy, w / 2, h / 2, 6), r);
    case "diamond": return roughPolyPath([{ x: cx, y }, { x: x + w, y: cy }, { x: cx, y: y + h }, { x, y: cy }], r);
    case "cloud": return cloudPathSvg(x, y, w, h, seed, sharp);
    default: return null;
  }
}

function addPatternFill(
  defs: Element,
  mainG: Element,
  shape: string,
  x: number, y: number, w: number, h: number,
  cx: number, cy: number, r: number,
  p0: { x: number; y: number }, p1: { x: number; y: number },
  fill: string,
  color: string,
  lineWidth: number,
  seed: number | undefined,
  fillOpacity: number | undefined,
  clipIndex: number,
): number {
  if (shape === "line" || shape === "arrow") return clipIndex;

  const clipId = `clip-${clipIndex++}`;
  const clipPath = svgEl("clipPath", { id: clipId });

  if (shape === "circle") {
    clipPath.appendChild(svgEl("ellipse", { cx, cy, rx: w / 2, ry: h / 2 }));
  } else {
    const pathData = buildShapePathSvg(shape, x, y, w, h, cx, cy, r, p0, p1, seed);
    if (pathData) clipPath.appendChild(svgEl("path", { d: pathData }));
  }
  defs.appendChild(clipPath);

  const fillG = svgEl("g", { "clip-path": `url(#${clipId})` });

  const gap = Math.max(8, lineWidth * 3);
  const sw = Math.max(1, lineWidth * 0.4);
  const fillPad = shape === "cloud"
    ? Math.max(3 * Math.sqrt(Math.max(1, Math.min(w, h))), 2 * (w + h) / 42)
    : 0;
  const fx = x - fillPad, fy = y - fillPad, fw = w + 2 * fillPad, fh = h + 2 * fillPad;

  if (fill === "dots") {
    const dotR = Math.max(1, lineWidth * 0.28);
    for (let px = fx + gap / 2; px < fx + fw; px += gap) {
      for (let py = fy + gap / 2; py < fy + fh; py += gap) {
        fillG.appendChild(svgEl("circle", { cx: px, cy: py, r: dotR, fill: hexToRgba(color, fillOpacity ?? 0.55) }));
      }
    }
  } else {
    const strokeColor = hexToRgba(color, fillOpacity ?? 0.4);
    const diag = fw + fh;
    for (let d = -diag; d <= diag; d += gap) {
      fillG.appendChild(svgEl("line", { x1: fx + d, y1: fy, x2: fx + d + fh, y2: fy + fh, stroke: strokeColor, "stroke-width": sw }));
    }
    if (fill === "crosshatch") {
      for (let d = -diag; d <= diag; d += gap) {
        fillG.appendChild(svgEl("line", { x1: fx + d, y1: fy + fh, x2: fx + d + fh, y2: fy, stroke: strokeColor, "stroke-width": sw }));
      }
    }
  }

  mainG.appendChild(fillG);
  return clipIndex;
}

function flattenStrokes(strokes: Stroke[]): Stroke[] {
  const out: Stroke[] = [];
  for (const s of strokes) {
    if (s.subStrokes) out.push(...flattenStrokes(s.subStrokes));
    else out.push(s);
  }
  return out;
}

const WATERMARK_LETTERS = [
  { letter: "d", color: "#3b82f6" },
  { letter: "r", color: "#ef4444" },
  { letter: "a", color: "#22c55e" },
  { letter: "w", color: "#eab308" },
  { letter: "z", color: "#ec4899" },
  { letter: "i", color: "#f97316" },
  { letter: "l", color: "#8b5cf6" },
  { letter: "l", color: "#06b6d4" },
  { letter: "a", color: "#ef4444" },
]

export function generateSvg(strokes: Stroke[], transparent: boolean, theme: Theme, watermark = false): string {
  if (!strokes.length) return "";

  const adaptColor = (c: string) => c;

  strokes = flattenStrokes(strokes);
  if (!strokes.length) return "";

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    if (stroke.imageId) {
      const a = stroke.points[0];
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x + (stroke.imageW ?? 0));
      maxY = Math.max(maxY, a.y + (stroke.imageH ?? 0));
      continue;
    }
    if (stroke.text) {
      const anchor = stroke.points[0];
      const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
      const lines = stroke.text.split("\n");
      const maxLen = Math.max(...lines.map(l => l.length));
      const textW = maxLen * basePx * 0.6;
      const textH = lines.length * basePx * 1.2;
      minX = Math.min(minX, anchor.x);
      minY = Math.min(minY, anchor.y);
      maxX = Math.max(maxX, anchor.x + textW);
      maxY = Math.max(maxY, anchor.y + textH);
      continue;
    }
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    // Cloud bump centers sit margin=0.55×bumpR inside the bbox, so bumps protrude
    // only ~0.45×bumpR beyond it. Sharp spikes extend up to ~1.25×bumpR beyond.
    if (stroke.shape === "cloud" && stroke.points.length === 2) {
      const p0 = stroke.points[0], p1 = stroke.points[1];
      const cw = Math.abs(p1.x - p0.x), ch = Math.abs(p1.y - p0.y);
      const bumpR = Math.max(3 * Math.sqrt(Math.max(1, Math.min(cw, ch))), 2 * (cw + ch) / 42);
      const extra = stroke.sharp ? bumpR * 1.4 : bumpR * 0.6;
      minX -= extra; minY -= extra; maxX += extra; maxY += extra;
    }
  }

  // Expand bounds for rotated strokes (rotation changes the visual AABB)
  for (const stroke of strokes) {
    if (!stroke.rotation) continue;
    const bb = anyStrokeBBox(stroke);
    const bcx = bb.x + bb.w / 2, bcy = bb.y + bb.h / 2;
    const cos = Math.abs(Math.cos(stroke.rotation));
    const sin = Math.abs(Math.sin(stroke.rotation));
    const newHW = bb.w / 2 * cos + bb.h / 2 * sin;
    const newHH = bb.w / 2 * sin + bb.h / 2 * cos;
    minX = Math.min(minX, bcx - newHW);
    minY = Math.min(minY, bcy - newHH);
    maxX = Math.max(maxX, bcx + newHW);
    maxY = Math.max(maxY, bcy + newHH);
  }

  const maxLW = Math.max(...strokes.map(s => s.lineWidth));
  const pad = 20 + maxLW / 2;
  const svgW = Math.ceil(maxX - minX + pad * 2);
  const svgH = Math.ceil(maxY - minY + pad * 2);
  const tx = -minX + pad;
  const ty = -minY + pad;

  const svg = document.createElementNS(NS, "svg") as SVGSVGElement;
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("width", String(svgW));
  svg.setAttribute("height", String(svgH));
  svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);

  const defs = svgEl("defs");
  svg.appendChild(defs);

  if (!transparent) {
    svg.appendChild(svgEl("rect", { width: svgW, height: svgH, fill: getBackgroundColor(theme) }));
  }

  const mainG = svgEl("g", { transform: `translate(${tx},${ty})` });
  svg.appendChild(mainG);

  let clipIndex = 0;

  for (const stroke of strokes) {
    // If rotated, wrap all stroke elements in a rotation group
    let strokeG: Element = mainG;
    if (stroke.rotation) {
      const bb = anyStrokeBBox(stroke);
      const bcx = bb.x + bb.w / 2, bcy = bb.y + bb.h / 2;
      const deg = stroke.rotation * 180 / Math.PI;
      const rotG = svgEl("g", { transform: `rotate(${n(deg)},${n(bcx)},${n(bcy)})` });
      mainG.appendChild(rotG);
      strokeG = rotG;
    }

    // ── Image ─────────────────────────────────────────────────────────────────
    if (stroke.imageId) {
      const dataUrl = getImageDataUrl(stroke.imageId);
      if (dataUrl) {
        const a = stroke.points[0];
        strokeG.appendChild(svgEl("image", {
          href: dataUrl,
          x: n(a.x), y: n(a.y),
          width: stroke.imageW ?? 0,
          height: stroke.imageH ?? 0,
          preserveAspectRatio: "none",
        }));
      }
      continue;
    }
    // ── Text ──────────────────────────────────────────────────────────────────
    if (stroke.text) {
      const basePx = TEXT_SIZE_MAP[stroke.fontSize || "m"];
      const fontCss = getFontCss(stroke.fontFamily);
      const anchor = stroke.points[0];
      const lines = stroke.text.split("\n");
      const lineHeight = basePx * 1.2;
      const textAlign = stroke.textAlign ?? "left";
      const textAnchor = textAlign === "center" ? "middle" : textAlign === "right" ? "end" : "start";

      const textEl = svgEl("text", {
        fill: adaptColor(stroke.color),
        "font-family": fontCss,
        "font-size": basePx,
        "font-weight": stroke.bold ? "bold" : "normal",
        "text-anchor": textAnchor,
        "dominant-baseline": "text-before-edge",
      });
      if (stroke.italic) textEl.setAttribute("font-style", "italic");

      for (let i = 0; i < lines.length; i++) {
        const tspan = svgEl("tspan", {
          x: anchor.x,
          y: anchor.y + i * lineHeight,
        });
        tspan.textContent = lines[i] || " ";
        textEl.appendChild(tspan);
      }
      strokeG.appendChild(textEl);
      continue;
    }

    const adaptedStrokeColor = adaptColor(stroke.color);
    const color = stroke.highlight ? hexToRgba(adaptedStrokeColor, 0.4) : adaptedStrokeColor;
    const dashScale = stroke.lineWidth / 4;
    const dashArr = stroke.style === "dashed"
      ? `${10 * dashScale} ${(stroke.dashGap ?? 8) * 5 * dashScale}`
      : "";

    // ── Single dot ────────────────────────────────────────────────────────────
    if (stroke.points.length === 1 && !stroke.shape) {
      strokeG.appendChild(svgEl("circle", {
        cx: stroke.points[0].x, cy: stroke.points[0].y,
        r: stroke.lineWidth * 0.6,
        fill: color,
      }));
      continue;
    }

    // ── Spray ─────────────────────────────────────────────────────────────────
    if (stroke.spray) {
      const dotR = Math.max(0.5, stroke.lineWidth * 0.35);
      const g = svgEl("g", { fill: color });
      for (const p of stroke.points) g.appendChild(svgEl("circle", { cx: p.x, cy: p.y, r: dotR }));
      strokeG.appendChild(g);
      continue;
    }

    // ── Multi-point line (3+ points) ──────────────────────────────────────────
    if (stroke.shape === "line" && stroke.points.length > 2) {
      const pts = stroke.points;
      const d = stroke.sharp
        ? "M" + pts.map(p => `${n(p.x)},${n(p.y)}`).join("L")
        : smoothLineSvg(pts);
      const el2 = svgEl("path", {
        d, stroke: color, "stroke-width": stroke.lineWidth,
        fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round",
      });
      if (dashArr) el2.setAttribute("stroke-dasharray", dashArr);
      strokeG.appendChild(el2);
      continue;
    }

    // ── Multi-point arrow (3+ points) ─────────────────────────────────────────
    if (stroke.shape === "arrow" && stroke.points.length > 2) {
      const pts = stroke.points;
      const len2 = pts.length;
      const last = pts[len2 - 1];
      const angleFrom = Math.hypot(last.x - pts[len2 - 2].x, last.y - pts[len2 - 2].y) < 1 && len2 >= 3
        ? pts[len2 - 3] : pts[len2 - 2];
      const angle = Math.atan2(last.y - angleFrom.y, last.x - angleFrom.x);
      const headLen = Math.max(22, stroke.lineWidth * 4.5);
      const headAngle = Math.PI / 6;

      const d = stroke.sharp
        ? "M" + pts.map(p => `${n(p.x)},${n(p.y)}`).join("L")
        : smoothLineSvg(pts);
      const ahd = `M${n(last.x)},${n(last.y)}L${n(last.x - headLen * Math.cos(angle - headAngle))},${n(last.y - headLen * Math.sin(angle - headAngle))}M${n(last.x)},${n(last.y)}L${n(last.x - headLen * Math.cos(angle + headAngle))},${n(last.y - headLen * Math.sin(angle + headAngle))}`;

      const g = svgEl("g", {
        stroke: color, "stroke-width": stroke.lineWidth,
        fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round",
      });
      const bodyEl = svgEl("path", { d });
      if (dashArr) bodyEl.setAttribute("stroke-dasharray", dashArr);
      g.appendChild(bodyEl);
      g.appendChild(svgEl("path", { d: ahd }));
      strokeG.appendChild(g);
      continue;
    }

    // ── 2-point shape ─────────────────────────────────────────────────────────
    if (stroke.shape && stroke.points.length === 2) {
      const p0 = stroke.points[0], p1 = stroke.points[1];
      if (Math.abs(p1.x - p0.x) < 0.5 && Math.abs(p1.y - p0.y) < 0.5) continue;

      const x = Math.min(p0.x, p1.x), y = Math.min(p0.y, p1.y);
      const w = Math.abs(p1.x - p0.x), h = Math.abs(p1.y - p0.y);
      const cx2 = x + w / 2, cy2 = y + h / 2;
      const r = stroke.sharp ? 0 : Math.min(w, h) * (stroke.seed !== undefined ? 0.1 : 0.12);
      const f_fill = stroke.fill === true ? "solid" : stroke.fill;
      const hasFill = !!f_fill && stroke.shape !== "line" && stroke.shape !== "arrow";

      if (stroke.seed !== undefined) {
        // ── Rough shape ───────────────────────────────────────────────────────
        const tempSvg = document.createElementNS(NS, "svg") as SVGSVGElement;
        const rc = rough.svg(tempSvg);
        const opts = {
          roughness: 1.2,
          bowing: 1,
          seed: stroke.seed,
          stroke: color,
          strokeWidth: stroke.lineWidth,
          disableMultiStroke: stroke.style === "dashed",
          ...(stroke.style === "dashed" ? { strokeLineDash: [10 * dashScale, (stroke.dashGap ?? 8) * 5 * dashScale] } : {}),
          ...(f_fill === "solid" ? { fill: hexToRgba(color, stroke.fillOpacity ?? 0.2), fillStyle: "solid" as const } : {}),
          ...(f_fill === "crosshatch" ? { fill: hexToRgba(color, stroke.fillOpacity ?? 0.35), fillStyle: "cross-hatch" as const, fillWeight: Math.max(1, stroke.lineWidth * 0.45), hachureGap: Math.max(6, stroke.lineWidth * 3.5) } : {}),
        };
        const roundedOpts = { ...opts, preserveVertices: true };

        // Hatch/dots fill via clipPath (same as canvas rendering)
        if (hasFill && (f_fill === "dots" || f_fill === "hatch") && stroke.shape !== "cloud") {
          clipIndex = addPatternFill(defs, strokeG, stroke.shape, x, y, w, h, cx2, cy2, r, p0, p1, f_fill, color, stroke.lineWidth, undefined, stroke.fillOpacity, clipIndex);
        }

        let roughNode: Element | null = null;
        switch (stroke.shape) {
          case "line": roughNode = rc.line(p0.x, p0.y, p1.x, p1.y, opts); break;
          case "rectangle": roughNode = rc.path(roughPolyPath([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], r), roundedOpts); break;
          case "circle": roughNode = rc.ellipse(cx2, cy2, w, h, opts); break;
          case "triangle": roughNode = rc.path(roughPolyPath([{ x: cx2, y }, { x: x + w, y: y + h }, { x, y: y + h }], r), roundedOpts); break;
          case "diamond": roughNode = rc.path(roughPolyPath([{ x: cx2, y }, { x: x + w, y: cy2 }, { x: cx2, y: y + h }, { x, y: cy2 }], r), roundedOpts); break;
          case "pentagon": roughNode = rc.path(roughPolyPath(regularPolygonPoints(cx2, cy2, w / 2, h / 2, 5), r), roundedOpts); break;
          case "hexagon": roughNode = rc.path(roughPolyPath(regularPolygonPoints(cx2, cy2, w / 2, h / 2, 6), r), roundedOpts); break;
          case "star": {
            const pts = starPoints(cx2, cy2, w / 2, h / 2, w / 5, h / 5);
            roughNode = rc.polygon(pts.map(p => [p.x, p.y] as [number, number]), opts);
            break;
          }
          case "cloud":
            roughNode = rc.path(cloudPathSvg(x, y, w, h, stroke.seed, stroke.sharp), opts);
            break;
          case "arrow":
            roughNode = rc.line(p0.x, p0.y, p1.x, p1.y, opts);
            break;
        }

        if (roughNode) {
          strokeG.appendChild(roughNode);
          if (stroke.shape === "arrow") {
            const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
            const headLen = Math.max(22, stroke.lineWidth * 4.5);
            const headAngle = Math.PI / 6;
            const ahd = `M${n(p1.x)},${n(p1.y)}L${n(p1.x - headLen * Math.cos(angle - headAngle))},${n(p1.y - headLen * Math.sin(angle - headAngle))}M${n(p1.x)},${n(p1.y)}L${n(p1.x - headLen * Math.cos(angle + headAngle))},${n(p1.y - headLen * Math.sin(angle + headAngle))}`;
            strokeG.appendChild(svgEl("path", { d: ahd, stroke: color, "stroke-width": stroke.lineWidth, fill: "none", "stroke-linecap": "round" }));
          }
        }
      } else {
        // ── Smooth shape ──────────────────────────────────────────────────────
        const commonStroke = { stroke: color, "stroke-width": stroke.lineWidth, "stroke-linecap": "round", "stroke-linejoin": "round" };

        if (stroke.shape === "arrow") {
          const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          const headLen = Math.max(22, stroke.lineWidth * 4.5);
          const headAngle = Math.PI / 6;
          const bodyD = `M${n(p0.x)},${n(p0.y)}L${n(p1.x)},${n(p1.y)}`;
          const ahd = `M${n(p1.x)},${n(p1.y)}L${n(p1.x - headLen * Math.cos(angle - headAngle))},${n(p1.y - headLen * Math.sin(angle - headAngle))}M${n(p1.x)},${n(p1.y)}L${n(p1.x - headLen * Math.cos(angle + headAngle))},${n(p1.y - headLen * Math.sin(angle + headAngle))}`;
          const g = svgEl("g", { ...commonStroke, fill: "none" });
          const bodyEl = svgEl("path", { d: bodyD });
          if (dashArr) bodyEl.setAttribute("stroke-dasharray", dashArr);
          g.appendChild(bodyEl);
          g.appendChild(svgEl("path", { d: ahd }));
          strokeG.appendChild(g);
        } else if (stroke.shape === "circle") {
          const fillAttr = f_fill === "solid" ? hexToRgba(color, stroke.fillOpacity ?? 0.2) : "none";
          if (hasFill && f_fill !== "solid") {
            clipIndex = addPatternFill(defs, strokeG, stroke.shape, x, y, w, h, cx2, cy2, r, p0, p1, f_fill, color, stroke.lineWidth, stroke.seed, stroke.fillOpacity, clipIndex);
          }
          const el2 = svgEl("ellipse", { cx: cx2, cy: cy2, rx: w / 2, ry: h / 2, ...commonStroke, fill: fillAttr });
          if (dashArr) el2.setAttribute("stroke-dasharray", dashArr);
          strokeG.appendChild(el2);
        } else {
          const pathD = buildShapePathSvg(stroke.shape, x, y, w, h, cx2, cy2, r, p0, p1, stroke.seed, stroke.sharp);
          if (pathD) {
            const isLineShape = stroke.shape === "line";
            const fillAttr = isLineShape ? "none" : (f_fill === "solid" ? hexToRgba(color, stroke.fillOpacity ?? 0.2) : "none");
            if (hasFill && f_fill !== "solid") {
              clipIndex = addPatternFill(defs, strokeG, stroke.shape, x, y, w, h, cx2, cy2, r, p0, p1, f_fill, color, stroke.lineWidth, stroke.seed, stroke.fillOpacity, clipIndex);
            }
            const el2 = svgEl("path", { d: pathD, ...commonStroke, fill: fillAttr });
            if (dashArr) el2.setAttribute("stroke-dasharray", dashArr);
            strokeG.appendChild(el2);
          }
        }
      }
      continue;
    }

    // ── Freehand ───────────────────────────────────────────────────────────────
    const pts = smoothPoints(stroke.points);
    const baseWidth = stroke.highlight ? stroke.lineWidth * 2.5 : stroke.lineWidth;

    if (stroke.widths && stroke.widths.length >= pts.length) {
      // Dynamic (pressure-sensitive) stroke
      const sw = smoothWidths(stroke.widths);
      if (pts.length < 2) continue;
      const pfPts = pts.map((p, i) => [p.x, p.y, sw[i] / 2] as [number, number, number]);
      const outline = getStroke(pfPts, {
        size: baseWidth, thinning: 1, smoothing: 0.5, streamline: 0.4,
        simulatePressure: false, last: true,
      });
      if (outline.length < 2) continue;
      strokeG.appendChild(svgEl("path", { d: strokePathFromOutline(outline), fill: color }));
    } else {
      // Uniform width stroke
      const d = smoothPolyPath(pts);
      if (!d) continue;
      const el2 = svgEl("path", {
        d, stroke: color, "stroke-width": baseWidth,
        fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round",
      });
      if (dashArr) el2.setAttribute("stroke-dasharray", dashArr);
      strokeG.appendChild(el2);
    }
  }

  if (watermark) {
    const fontSize = 13
    const pad = 10
    const prefix = "Made with "
    // Approximate char widths at 13px Caveat Brush
    const charW: Record<string, number> = { M: 10, a: 7, d: 8, e: 7, " ": 4, w: 10, i: 4, t: 6, h: 8, r: 6, z: 7, l: 5 }
    const prefixWidth = Array.from(prefix).reduce((acc, ch) => acc + (charW[ch] ?? 7), 0)
    const logoWidth = WATERMARK_LETTERS.reduce((acc, { letter }) => acc + (charW[letter] ?? 7), 0)
    const totalWidth = prefixWidth + logoWidth

    const wmG = svgEl("g", { opacity: "0.8" })
    wmG.appendChild(svgEl("rect", {
      x: pad - 4, y: svgH - pad - fontSize - 4,
      width: totalWidth + 8, height: fontSize + 8,
      fill: "rgba(0,0,0,0.3)", rx: 3,
    }))
    const prefixEl = svgEl("text", {
      "font-family": "Caveat Brush, cursive",
      "font-size": fontSize,
      fill: "#cccccc",
      x: pad,
      y: svgH - pad,
      "dominant-baseline": "auto",
    })
    prefixEl.textContent = prefix
    wmG.appendChild(prefixEl)

    let cx = pad + prefixWidth
    for (const { letter, color } of WATERMARK_LETTERS) {
      const el = svgEl("text", {
        "font-family": "Caveat Brush, cursive",
        "font-size": fontSize,
        fill: color,
        x: cx,
        y: svgH - pad,
        "dominant-baseline": "auto",
      })
      el.textContent = letter
      wmG.appendChild(el)
      cx += charW[letter] ?? 7
    }
    svg.appendChild(wmG)
  }

  return new XMLSerializer().serializeToString(svg);
}
