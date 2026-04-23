import type { Stroke } from './freehand';
import { smoothPoints } from './freehand';
import type { ShapeTarget } from './shapes';
import { buildShapePath } from './shapes';

function renderStrokeToCtx(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = smoothPoints(stroke.points);
  if (pts.length === 0) return;

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.lineWidth;

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, stroke.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
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

export async function scoreAttempt(
  strokes: Stroke[],
  target: string,
  font: string,
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number,
): Promise<number> {
  if (strokes.length === 0) return 0;

  // Ensure fonts are loaded before measuring
  await document.fonts.load(font, target);

  // Target canvas — render the ghost letter as filled white
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = Math.ceil(canvasW);
  targetCanvas.height = Math.ceil(canvasH);
  const tCtx = targetCanvas.getContext('2d')!;
  tCtx.fillStyle = '#fff';
  tCtx.font = font;
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  // Word-wrap to match TraceCanvas ghost rendering
  {
    const maxW = canvasW * 0.88;
    const words = target.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (tCtx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    const metrics = tCtx.measureText('M');
    const lineH = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) * 1.35;
    const startY = cy - (lineH * (lines.length - 1)) / 2;
    lines.forEach((l, i) => tCtx.fillText(l, cx, startY + i * lineH));
  }

  // User canvas — render all drawn strokes (stored in center-relative coords)
  const userCanvas = document.createElement('canvas');
  userCanvas.width = Math.ceil(canvasW);
  userCanvas.height = Math.ceil(canvasH);
  const uCtx = userCanvas.getContext('2d')!;
  uCtx.translate(cx, cy);
  for (const stroke of strokes) {
    renderStrokeToCtx(uCtx, stroke);
  }

  const tData = tCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height).data;
  const uData = uCtx.getImageData(0, 0, userCanvas.width, userCanvas.height).data;

  let targetPx = 0;
  let covered = 0;
  let userTotal = 0;

  for (let i = 3; i < tData.length; i += 4) {
    const inTarget = tData[i] > 100;
    const inUser = uData[i] > 100;
    if (inTarget) targetPx++;
    if (inUser && inTarget) covered++;
    if (inUser) userTotal++;
  }

  if (targetPx === 0 || covered === 0) return 0;

  const coverage = covered / targetPx;
  const precision = userTotal > 0 ? covered / userTotal : 0;

  // Effort multiplier: requires drawing ~30% of the target pixel area before penalty lifts.
  const effort = Math.min(1, userTotal / (targetPx * 0.3));

  // coverage^1.5 makes partial coverage much more costly — a scribble on one corner
  // of a letter can't score well, you need to cover most of the target shape.
  const coveragePow = Math.pow(coverage, 1.2);

  return Math.round(effort * (coveragePow * 0.7 + precision * 0.3) * 100);
}

export async function scoreShapeAttempt(
  strokes: Stroke[],
  shapes: ShapeTarget[],
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number,
): Promise<number> {
  if (strokes.length === 0) return 0;
  if (shapes.length === 0) return 0;

  // Target canvas — render all shapes as stroked outlines, matching ghost line widths
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = Math.ceil(canvasW);
  targetCanvas.height = Math.ceil(canvasH);
  const tCtx = targetCanvas.getContext('2d')!;
  tCtx.strokeStyle = '#fff';
  tCtx.lineCap = 'round';
  tCtx.lineJoin = 'round';
  for (const shape of shapes) {
    tCtx.lineWidth = Math.max(3, shape.w * 0.075);
    buildShapePath(tCtx, shape.kind, shape.x, shape.y, shape.w, shape.h, shape.angle);
    tCtx.stroke();
  }

  // User canvas — render strokes in center-relative coords
  const userCanvas = document.createElement('canvas');
  userCanvas.width = Math.ceil(canvasW);
  userCanvas.height = Math.ceil(canvasH);
  const uCtx = userCanvas.getContext('2d')!;
  uCtx.translate(cx, cy);
  for (const stroke of strokes) {
    renderStrokeToCtx(uCtx, stroke);
  }

  const tData = tCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height).data;
  const uData = uCtx.getImageData(0, 0, userCanvas.width, userCanvas.height).data;

  let targetPx = 0, covered = 0, userTotal = 0;
  for (let i = 3; i < tData.length; i += 4) {
    const inTarget = tData[i] > 100;
    const inUser = uData[i] > 100;
    if (inTarget) targetPx++;
    if (inUser && inTarget) covered++;
    if (inUser) userTotal++;
  }

  if (targetPx === 0 || covered === 0) return 0;

  const coverage = covered / targetPx;
  const precision = userTotal > 0 ? covered / userTotal : 0;
  const effort = Math.min(1, userTotal / (targetPx * 0.3));
  const coveragePow = Math.pow(coverage, 1.2);

  return Math.round(effort * (coveragePow * 0.7 + precision * 0.3) * 100);
}
