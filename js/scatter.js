// Steenveld: losse stenen in het raster van een verband (kinderkopjes, waalklinkers, kasseien, tegels), zoals
// gestrooid in grind of zand. Alleen de stenen die er liggen worden bewaard (cellen), zodat je met een penseel
// stenen kunt bijstrooien of weghalen en een rafelig vak in één keer kunt laten vullen.
//
// item: { type: 'stones', id, origin: [x, y], rot, bond: {...}, bondName, cells: [[pi, pj, k], ...],
//         gen?: { density, edge, seed } }
// Een cel is steen k uit één herhaling van het verband, in herhaling (pi, pj).

import { bondLayout, bondPalette, paintStone } from './bonds.js';
import { pointInPolygon, distToSegment } from './geom.js';

/** Minimale voeg bij gestrooide stenen: er zit grind of zand tussen. */
export const SCATTER_JOINT = 0.012;

function hash3(a, b, c, s = 0) {
  const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + s * 19.19) * 43758.5453;
  return h - Math.floor(h);
}

/** Vloeiende ruis (0..1) voor groepjes. */
function valueNoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (i, j) => hash3(x0 + i, y0 + j, 7, seed);
  return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
}

/** Verband en assenstelsel van het steenveld. */
export function stonesFrame(item) {
  const L = bondLayout(item.bond);
  const rot = (item.rot || 0) + (L.T.rot || 0);
  return { L, rot, c: Math.cos(rot), s: Math.sin(rot), o: item.origin || [0, 0] };
}

/** Rechthoek (lokaal, meters) van een cel: [x, y, w, h]. */
export function cellRect(F, pi, pj, k) {
  const { L } = F;
  const st = L.list[k];
  if (!st) return null;
  const j = L.j;
  return [(pi * L.px + st[0]) * L.U + j / 2, (pj * L.py + st[1]) * L.U + j / 2, st[2] * L.U - j, st[3] * L.U - j];
}

const toLocal = (F, p) => { const dx = p[0] - F.o[0], dy = p[1] - F.o[1]; return [dx * F.c + dy * F.s, -dx * F.s + dy * F.c]; };
const toWorld = (F, q) => [F.o[0] + q[0] * F.c - q[1] * F.s, F.o[1] + q[0] * F.s + q[1] * F.c];

/** Alle cellen (ook lege) waarvan het midden binnen straal r (m) van wereldpunt p ligt. */
export function cellsNear(F, p, r) {
  const { L } = F;
  const q = toLocal(F, p);
  const PW = L.px * L.U, PH = L.py * L.U;
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const [x, y, w, h] of L.list) { minX = Math.min(minX, x * L.U); minY = Math.min(minY, y * L.U); maxX = Math.max(maxX, (x + w) * L.U); maxY = Math.max(maxY, (y + h) * L.U); }
  const out = [];
  for (let pi = Math.floor((q[0] - r - maxX) / PW); pi <= Math.ceil((q[0] + r - minX) / PW); pi++) {
    for (let pj = Math.floor((q[1] - r - maxY) / PH); pj <= Math.ceil((q[1] + r - minY) / PH); pj++) {
      for (let k = 0; k < L.list.length; k++) {
        const rc = cellRect(F, pi, pj, k);
        const cx = rc[0] + rc[2] / 2, cy = rc[1] + rc[3] / 2;
        const d = Math.hypot(cx - q[0], cy - q[1]);
        if (d <= r) out.push({ key: [pi, pj, k], d, rect: rc, center: toWorld(F, [cx, cy]) });
      }
    }
  }
  return out;
}

const keyOf = (c) => `${c[0]},${c[1]},${c[2]}`;

/**
 * Penseelstreek: strooi stenen (of haal ze weg) rond p. Elke cel wordt per streek één keer beoordeeld
 * (visited), met meer kans in het midden van het penseel. Geeft true als er iets veranderde.
 */
export function brushStones(item, p, r, density, strokeSeed, visited, erase = false) {
  const F = stonesFrame(item);
  const have = new Map(item.cells.map((c) => [keyOf(c), c]));
  let changed = false;
  for (const c of cellsNear(F, p, r)) {
    const k = keyOf(c.key);
    if (visited.has(k)) continue;
    visited.add(k);
    if (erase) {
      if (have.has(k)) { have.delete(k); changed = true; }
      continue;
    }
    if (have.has(k)) continue;
    const f = 1 - (c.d / r) ** 2;
    if (hash3(c.key[0] * 3 + c.key[2], c.key[1], c.key[2], strokeSeed) < f * density * 1.15) { have.set(k, c.key); changed = true; }
  }
  if (changed) item.cells = [...have.values()];
  return changed;
}

/**
 * Vul een vlak met stenen in groepjes die naar de rand toe uitdunnen.
 * density 0..1 (hoeveel van het vlak), edge 0..1 (hoe breed de rafelrand is), seed (ander patroon).
 */
export function scatterInPolygon(item, poly, density = 0.6, edge = 0.5, seed = 1) {
  const F = stonesFrame(item);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) { const q = toLocal(F, p); minX = Math.min(minX, q[0]); minY = Math.min(minY, q[1]); maxX = Math.max(maxX, q[0]); maxY = Math.max(maxY, q[1]); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const R = Math.hypot(maxX - minX, maxY - minY) / 2 + 0.3;
  const band = 0.15 + edge * 1.6;
  const scale = 0.45 + edge * 0.6; // grootte van de groepjes (m)
  const cells = [];
  for (const c of cellsNear(F, toWorld(F, [cx, cy]), R)) {
    const w = c.center;
    if (!pointInPolygon(w, poly)) continue;
    let dEdge = Infinity;
    for (let i = 0; i < poly.length; i++) dEdge = Math.min(dEdge, distToSegment(w, poly[i], poly[(i + 1) % poly.length]));
    const e = edge > 0 ? Math.min(1, dEdge / band) : 1;
    const n = valueNoise(w[0] / scale, w[1] / scale, seed) * 0.75 + valueNoise(w[0] / (scale * 0.4), w[1] / (scale * 0.4), seed + 3) * 0.25;
    const s = 0.28 * e + 0.72 * n + (hash3(c.key[0], c.key[1], c.key[2], seed) - 0.5) * 0.2;
    if (s > 1.12 - density * 1.12) cells.push(c.key);
  }
  item.cells = cells;
  return cells.length;
}

/** Kleur van een steen: bij gemengde kleuren gewogen naar het aandeel. */
function cellColor(bond, pal, key) {
  if (!pal) return bond.color || '#8d8a84';
  const total = pal.reduce((a, c) => a + c.share, 0) || 1;
  let t = hash3(key[0], key[1], key[2], 91) * total;
  for (const c of pal) { if ((t -= c.share) <= 0) return c.color; }
  return pal[pal.length - 1].color;
}

/** Teken het steenveld (wereldcoördinaten). */
export function drawStones(g, item) {
  if (!item.cells?.length) return;
  const F = stonesFrame(item);
  const pal = bondPalette(item.bond);
  g.save();
  g.translate(F.o[0], F.o[1]);
  g.rotate(F.rot);
  for (const key of item.cells) {
    const rc = cellRect(F, key[0], key[1], key[2]);
    if (!rc) continue;
    // schaduwrandje: de steen ligt iets hoger dan het grind
    g.fillStyle = 'rgba(40, 32, 22, 0.28)';
    g.fillRect(rc[0] + rc[2] * 0.04, rc[1] + rc[3] * 0.06, rc[2], rc[3]);
    paintStone(g, rc[0], rc[1], rc[2], rc[3], cellColor(item.bond, pal, key), item.bond.finish || 'getrommeld', Math.round(key[0] * 31 + key[1] * 977 + key[2] * 7) + 3);
  }
  g.restore();
}

/** Omtrek (gedraaide rechthoek om alle stenen). */
export function stonesOutline(item) {
  const F = stonesFrame(item);
  if (!item.cells?.length) { const o = F.o; return [[o[0] - 0.1, o[1] - 0.1], [o[0] + 0.1, o[1] - 0.1], [o[0] + 0.1, o[1] + 0.1], [o[0] - 0.1, o[1] + 0.1]]; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of item.cells) {
    const rc = cellRect(F, key[0], key[1], key[2]);
    if (!rc) continue;
    minX = Math.min(minX, rc[0]); minY = Math.min(minY, rc[1]); maxX = Math.max(maxX, rc[0] + rc[2]); maxY = Math.max(maxY, rc[1] + rc[3]);
  }
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]].map((q) => toWorld(F, q));
}

/** Ligt p op een van de stenen (met tolerantie)? */
export function hitStones(item, p, tol) {
  if (!item.cells?.length) return false;
  const F = stonesFrame(item);
  const have = new Set(item.cells.map(keyOf));
  const q = toLocal(F, p);
  const L = F.L;
  for (const c of cellsNear(F, p, Math.max(L.U * 2, L.n * L.U) + tol)) {
    if (!have.has(keyOf(c.key))) continue;
    const [x, y, w, h] = c.rect;
    if (q[0] >= x - tol && q[0] <= x + w + tol && q[1] >= y - tol && q[1] <= y + h + tol) return true;
  }
  return false;
}

/** Stenen als rechthoeken in wereldcoördinaten (voor 3D): { c: [x, y], w, h, rot, color }. */
export function stonesList(item) {
  const F = stonesFrame(item);
  const pal = bondPalette(item.bond);
  return (item.cells || []).map((key) => {
    const rc = cellRect(F, key[0], key[1], key[2]);
    return rc && { c: toWorld(F, [rc[0] + rc[2] / 2, rc[1] + rc[3] / 2]), w: rc[2], h: rc[3], rot: F.rot, color: cellColor(item.bond, pal, key), key };
  }).filter(Boolean);
}
