// "Tik in ruimte": het vlak rond een punt vinden dat begrensd wordt door de lijnen van het ontwerp.
// Werkwijze: de lijnen in beeld op een raster tekenen, vanaf het tikpunt vullen, de buitenrand
// overtrekken en die rand terugleggen op de lijnen van het ontwerp.

import { simplify, polygonArea, pointInPolygon, distToSegment, projectOnLine, dist } from './geom.js';
import { strokePath, BRUSHES } from './brushes.js';
import { shapePolygon, isGroup } from './planting.js';

const MAX = 1400;

/** Welke items vormen een grens? Lijnen, vormen, penseelstreken en plantvakken (geen groepen). */
function isBarrier(it) {
  if (it.type === 'stroke') return true;
  if (it.type === 'shape') return !isGroup(it);
  return false;
}

function itemSegments(it) {
  const pts = it.type === 'shape' && it.kind === 'circle' ? shapePolygon(it) : it.points;
  const closed = it.type === 'shape' && (it.kind === 'polygon' || it.kind === 'circle');
  const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
  if (closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
  return segs;
}

/**
 * Zoek het gesloten vlak rond wereldpunt p.
 * view: { toScreen(p), toWorld(s), width, height } (de camera en het zichtbare deel).
 * Geeft { points, exact } of { error }.
 */
export function regionAt(doc, p, view) {
  const items = [];
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const it of layer.items) if (isBarrier(it) && it.points?.length > 1) items.push(it);
  }
  if (!items.length) return { error: 'Er zijn nog geen lijnen in het ontwerp om een vlak in te vinden.' };

  const k = Math.min(1, MAX / Math.max(view.width, view.height));
  const W = Math.max(8, Math.round(view.width * k)), H = Math.max(8, Math.round(view.height * k));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#000';
  g.fillStyle = '#000';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const S = (q) => { const s = view.toScreen(q); return [s[0] * k, s[1] * k]; };
  for (const it of items) {
    if (it.type === 'stroke') {
      // penseelstreek als zijn eigen omtrek (dikte telt mee)
      const brush = BRUSHES[it.brush] || BRUSHES.pen;
      const path = strokePath(it.points, brush, it.width);
      g.save();
      const a = view.toScreen([0, 0]), b = view.toScreen([1, 0]), d = view.toScreen([0, 1]);
      g.setTransform((b[0] - a[0]) * k, (b[1] - a[1]) * k, (d[0] - a[0]) * k, (d[1] - a[1]) * k, a[0] * k, a[1] * k);
      g.fill(path);
      g.restore();
    }
    g.lineWidth = 2;
    g.beginPath();
    for (const [a, b] of itemSegments(it)) {
      const A = S(a), B = S(b);
      g.moveTo(A[0], A[1]);
      g.lineTo(B[0], B[1]);
    }
    g.stroke();
  }
  const data = g.getImageData(0, 0, W, H).data;
  const wall = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) wall[i] = data[i * 4] < 128 ? 1 : 0;

  const s0 = S(p).map(Math.round);
  if (s0[0] < 0 || s0[1] < 0 || s0[0] >= W || s0[1] >= H) return { error: 'Tik binnen het beeld.' };
  if (wall[s0[1] * W + s0[0]]) return { error: 'Tik midden in een vlak, niet op een lijn.' };

  // vullen (stapel, 4-buren)
  const fill = new Uint8Array(W * H);
  const stack = [s0[1] * W + s0[0]];
  fill[stack[0]] = 1;
  let touchesEdge = false, count = 0;
  while (stack.length) {
    const i = stack.pop();
    count++;
    const x = i % W, y = (i - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesEdge = true;
    if (x > 0 && !fill[i - 1] && !wall[i - 1]) { fill[i - 1] = 1; stack.push(i - 1); }
    if (x < W - 1 && !fill[i + 1] && !wall[i + 1]) { fill[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !fill[i - W] && !wall[i - W]) { fill[i - W] = 1; stack.push(i - W); }
    if (y < H - 1 && !fill[i + W] && !wall[i + W]) { fill[i + W] = 1; stack.push(i + W); }
  }
  if (touchesEdge) return { error: 'Dit vlak is niet gesloten (of loopt buiten beeld). Zoom uit of sluit de omtrek.' };
  if (count < 30) return { error: 'Dit vlak is te klein.' };

  // de gaten in de vulling (de lijnen zelf) dichten, zodat de rand op de lijnen komt te liggen
  const grown = new Uint8Array(fill);
  for (let pass = 0; pass < 2; pass++) {
    const src = new Uint8Array(grown);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (src[i]) continue;
        if (src[i - 1] || src[i + 1] || src[i - W] || src[i + W]) grown[i] = 1;
      }
    }
  }

  const contour = traceContour(grown, W, H);
  if (contour.length < 3) return { error: 'Geen omtrek gevonden.' };
  const world = contour.map(([x, y]) => view.toWorld([x / k, y / k]));
  const px = 1 / (dist(view.toWorld([0, 0]), view.toWorld([1, 0])) || 1);
  let pts = simplify([...world, world[0]], 1.2 / px).slice(0, -1);

  // terugleggen op de lijnen van het ontwerp (binnen een paar pixels)
  const segs = items.flatMap(itemSegments);
  const tol = 4 / px;
  pts = pts.map((q) => {
    let best = null, bd = tol;
    for (const [a, b] of segs) {
      const d = distToSegment(q, a, b);
      if (d < bd) {
        bd = d;
        const [pr, t] = projectOnLine(q, a, b);
        best = t <= 0 ? a : t >= 1 ? b : pr;
      }
    }
    return best || q;
  });
  // hoekpunten van het ontwerp vastpakken
  const corners = segs.map((s) => s[0]);
  pts = pts.map((q) => {
    let best = null, bd = tol * 1.5;
    for (const v of corners) { const d = dist(q, v); if (d < bd) { bd = d; best = v; } }
    return best ? [best[0], best[1]] : q;
  });
  pts = dedupe(simplify([...pts, pts[0]], 0.6 / px).slice(0, -1));
  if (pts.length < 3) return { error: 'Geen omtrek gevonden.' };

  // valt het vlak samen met één gesloten vorm? Neem dan die vorm exact over.
  const A = Math.abs(polygonArea(pts));
  let exact = null;
  for (const it of items) {
    if (it.type !== 'shape' || !(it.kind === 'polygon' || it.kind === 'circle')) continue;
    const poly = shapePolygon(it);
    if (!pointInPolygon(p, poly)) continue;
    const a = Math.abs(polygonArea(poly));
    if (Math.abs(a - A) / a < 0.03 && (!exact || a < exact.a)) exact = { it, a };
  }
  if (exact) {
    const it = exact.it;
    return { exact: true, kind: it.kind, points: it.points.map((q) => [q[0], q[1]]) };
  }
  return { exact: false, kind: 'polygon', points: pts.map((q) => [round4(q[0]), round4(q[1])]) };
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

function dedupe(pts) {
  const out = [];
  for (const q of pts) {
    const last = out[out.length - 1];
    if (!last || dist(last, q) > 1e-6) out.push(q);
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  return out;
}

/** Buitenrand van een masker (Moore-buren), als lijst pixelhoekpunten. */
function traceContour(mask, W, H) {
  let start = -1;
  for (let i = 0; i < W * H; i++) if (mask[i]) { start = i; break; }
  if (start < 0) return [];
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const sx = start % W, sy = (start - sx) / W;
  const out = [[sx + 0.5, sy + 0.5]];
  let x = sx, y = sy;
  let back = 4; // we kwamen van links (de pixel links van de start is leeg)
  for (let guard = 0; guard < W * H * 4; guard++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = x + dirs[d][0], ny = y + dirs[d][1];
      if (at(nx, ny)) {
        x = nx;
        y = ny;
        back = (d + 4) % 8;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (x === sx && y === sy) break;
    out.push([x + 0.5, y + 0.5]);
  }
  return out;
}
