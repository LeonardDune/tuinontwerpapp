// Bewerkingen op afzonderlijke objecten: rechthoek-kaders, exacte maten en draaiing.

import { dist, rotate, polygonArea, normAngle, matMul, matTranslate, matRotate, unionBox } from './geom.js';
import { STENCIL_MAP } from './stencils.js';
import { transformItem, itemBBox, invalidate } from './items.js';

const DEG = Math.PI / 180;

/** Is deze vorm een rechthoek (vier rechte hoeken)? */
export function isRect(item) {
  if (item.type !== 'shape' || item.kind !== 'polygon' || item.points.length !== 4) return false;
  if (item.rect) return true;
  const p = item.points;
  for (let i = 0; i < 4; i++) {
    const a = p[(i + 3) % 4], b = p[i], c = p[(i + 1) % 4];
    const ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    if (!l || Math.abs(ux * vx + uy * vy) / l > 1e-3) return false;
  }
  return true;
}

/**
 * Kader: oorsprong o, hoek ang (richting van de eerste zijde), breedte w en diepte h
 * (h mag negatief zijn: dan ligt de rechthoek aan de andere kant van de eerste zijde).
 */
export function rectFrame(pts) {
  const [p0, p1, , p3] = pts;
  const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const n = [-Math.sin(ang), Math.cos(ang)];
  return { o: p0, ang, w: dist(p0, p1), h: (p3[0] - p0[0]) * n[0] + (p3[1] - p0[1]) * n[1] };
}

export function frameAxes(f) {
  return { u: [Math.cos(f.ang), Math.sin(f.ang)], n: [-Math.sin(f.ang), Math.cos(f.ang)] };
}

/** Punt in het kader (lokale x langs de eerste zijde, y loodrecht) naar wereld. */
export function frameToWorld(f, x, y) {
  const { u, n } = frameAxes(f);
  return [f.o[0] + u[0] * x + n[0] * y, f.o[1] + u[1] * x + n[1] * y];
}

export function worldToFrame(f, p) {
  const { u, n } = frameAxes(f);
  const dx = p[0] - f.o[0], dy = p[1] - f.o[1];
  return [dx * u[0] + dy * u[1], dx * n[0] + dy * n[1]];
}

export function rectPoints(f) {
  return [frameToWorld(f, 0, 0), frameToWorld(f, f.w, 0), frameToWorld(f, f.w, f.h), frameToWorld(f, 0, f.h)];
}

export function frameCenter(f) {
  return frameToWorld(f, f.w / 2, f.h / 2);
}

/** Kader van een stencil of afbeelding (midden x,y; w × h; draaiing rot). */
export function boxFrame(item) {
  const f = { ang: item.rot || 0, w: item.w, h: item.h, o: null };
  const { u, n } = frameAxes(f);
  f.o = [item.x - u[0] * item.w / 2 - n[0] * item.h / 2, item.y - u[1] * item.w / 2 - n[1] * item.h / 2];
  return f;
}

/** Kader van een item als het er een heeft (rechthoek, stencil, afbeelding), anders null. */
export function itemFrame(item) {
  if (isRect(item)) return rectFrame(item.points);
  if (item.type === 'stencil' || item.type === 'image') return boxFrame(item);
  return null;
}

/** Schrijf een (gewijzigd) kader terug in het item. */
export function applyFrame(item, f) {
  if (item.type === 'shape') {
    item.points = rectPoints(f).map(round);
  } else {
    const c = frameCenter(f);
    item.x = round1(c[0]);
    item.y = round1(c[1]);
    item.w = Math.abs(f.w);
    item.h = Math.abs(f.h);
    item.rot = f.ang;
  }
  invalidate(item);
}

function round1(v) {
  return Math.round(v * 10000) / 10000;
}

function round(p) {
  return [round1(p[0]), round1(p[1]), ...p.slice(2)];
}

/** Hoek voor weergave: graden tegen de klok in (y-as wijst naar beneden), 0..360. */
export function displayAngle(rad) {
  let d = (-rad / DEG) % 360;
  if (d < 0) d += 360;
  if (d > 359.95) d = 0;
  return Math.round(d * 10) / 10;
}

export function fromDisplayAngle(deg) {
  return -deg * DEG;
}

/** Huidige hoek van een item (voor exact draaien), of null als het geen eigen richting heeft. */
export function itemAngle(item) {
  const f = itemFrame(item);
  if (f) return f.ang;
  if (item.type === 'text') return item.rot || 0;
  if (item.type === 'shape' && item.kind === 'line' && item.points.length === 2) {
    const [a, b] = item.points;
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  if (item.type === 'dim' && item.kind !== 'area') return Math.atan2(item.b[1] - item.a[1], item.b[0] - item.a[0]);
  return null;
}

/** Draaipunt van een item. */
export function itemPivot(item) {
  const f = itemFrame(item);
  if (f) return frameCenter(f);
  if (item.type === 'text') return [item.x, item.y];
  const b = itemBBox(item);
  return b ? [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2] : [0, 0];
}

/** Draai items om een punt. */
export function rotateItems(items, r, c) {
  const m = matMul(matTranslate(c[0], c[1]), matMul(matRotate(r), matTranslate(-c[0], -c[1])));
  for (const it of items) transformItem(it, m, 1, r);
}

/** Zet de hoek van één item exact (draait om het eigen midden). */
export function setItemAngle(item, rad) {
  const cur = itemAngle(item);
  if (cur == null) return;
  rotateItems([item], normAngle(rad - cur), itemPivot(item));
}

export function selectionBox(items) {
  let box = null;
  for (const it of items) box = unionBox(box, itemBBox(it));
  return box;
}

/** Maat van een item voor de eigenschappenbalk. */
export function itemSize(item) {
  const f = itemFrame(item);
  if (f) return { w: Math.abs(f.w), h: Math.abs(f.h) };
  if (item.type === 'shape' && item.kind === 'circle') return { d: dist(item.points[0], item.points[1]) * 2 };
  if (item.type === 'shape' && item.kind === 'line' && item.points.length === 2) return { len: dist(item.points[0], item.points[1]) };
  if (item.type === 'dim' && item.kind !== 'area') return { len: dist(item.a, item.b) };
  return {};
}

/** Breedte en/of diepte van een kader-item aanpassen, met het midden op zijn plek. */
export function setFrameSize(item, w, h) {
  const f = itemFrame(item);
  if (!f) return;
  const def = item.type === 'stencil' ? STENCIL_MAP[item.symbol] : null;
  const c = frameCenter(f);
  const sw = Math.sign(f.w) || 1, sh = Math.sign(f.h) || 1;
  let nw = w ?? Math.abs(f.w), nh = h ?? Math.abs(f.h);
  if ((def && def.round && def.w === def.h) || item.type === 'image') {
    // ronde stencils en afbeeldingen schalen in verhouding
    const k = w != null ? w / Math.abs(f.w) : h / Math.abs(f.h);
    nw = Math.abs(f.w) * k;
    nh = Math.abs(f.h) * k;
  }
  const nf = { ang: f.ang, w: nw * sw, h: nh * sh, o: null };
  const { u, n } = frameAxes(nf);
  nf.o = [c[0] - u[0] * nf.w / 2 - n[0] * nf.h / 2, c[1] - u[1] * nf.w / 2 - n[1] * nf.h / 2];
  applyFrame(item, nf);
}

/** Diameter van een cirkel (of rond stencil). */
export function setDiameter(item, d) {
  if (item.type === 'shape' && item.kind === 'circle') {
    const [c, e] = item.points;
    const r = dist(c, e) || 1;
    item.points = [c, [c[0] + ((e[0] - c[0]) / r) * d / 2, c[1] + ((e[1] - c[1]) / r) * d / 2]].map(round);
    invalidate(item);
  } else {
    setFrameSize(item, d, d);
  }
}

/** Lengte van een lijn (beginpunt blijft staan). */
export function setLength(item, len) {
  const pts = item.type === 'dim' ? [item.a, item.b] : item.points;
  const [a, b] = pts;
  const l = dist(a, b) || 1;
  const nb = round([a[0] + ((b[0] - a[0]) / l) * len, a[1] + ((b[1] - a[1]) / l) * len]);
  if (item.type === 'dim') item.b = nb;
  else item.points = [a, nb];
  invalidate(item);
}

export function closedArea(item) {
  if (item.type !== 'shape') return null;
  if (item.kind === 'polygon' && item.points.length >= 3) return polygonArea(item.points);
  if (item.kind === 'circle') { const r = dist(item.points[0], item.points[1]); return Math.PI * r * r; }
  return null;
}

export { rotate, DEG };
