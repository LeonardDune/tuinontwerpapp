// Muren: aansluitingen (hoek- en T-aansluiting netjes afsnijden) en de koppeling van deuren en
// ramen aan hun muur (ze bewegen mee als de muur verplaatst, gedraaid of aangepast wordt).

import { distToSegment, projectOnLine, dist } from './geom.js';
import { STENCIL_MAP } from './stencils.js';

const EPS = 1e-3;

export function isWall(it) {
  return it.type === 'shape' && !!it.wall;
}

export function isOpening(it) {
  return it.type === 'stencil' && !!STENCIL_MAP[it.symbol]?.opening;
}

/** Segmenten van een muur als [a, b]. */
export function wallSegments(w) {
  const pts = w.points;
  const n = w.kind === 'polygon' ? pts.length : pts.length - 1;
  const out = [];
  for (let i = 0; i < n; i++) out.push([pts[i], pts[(i + 1) % pts.length]]);
  return out;
}

function unit(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

function cross(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

/** Snijpunt van lijn p + s·d met lijn q + t·e (null bij evenwijdig). */
function intersect(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross([q[0] - p[0], q[1] - p[1]], e) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

/** Hartlijn naar beide kanten verschoven (verstekhoeken bij de tussenpunten). */
export function wallSides(pts, closed, t) {
  const n = pts.length;
  const h = t / 2;
  const left = [], right = [];
  const nrm = (a, b) => { const u = unit(a, b); return [-u[1], u[0]]; };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = closed ? pts[(i - 1 + n) % n] : pts[i - 1];
    const next = closed ? pts[(i + 1) % n] : pts[i + 1];
    let off;
    if (!prev) off = nrm(p, next).map((v) => v * h);
    else if (!next) off = nrm(prev, p).map((v) => v * h);
    else {
      const n1 = nrm(prev, p), n2 = nrm(p, next);
      let mx = n1[0] + n2[0], my = n1[1] + n2[1];
      const ml = Math.hypot(mx, my) || 1;
      mx /= ml; my /= ml;
      const k = 1 / Math.max(0.25, mx * n1[0] + my * n1[1]);
      off = [mx * h * k, my * h * k];
    }
    left.push([p[0] + off[0], p[1] + off[1]]);
    right.push([p[0] - off[0], p[1] - off[1]]);
  }
  return { left, right };
}

/**
 * Hoe eindigt een open muur bij zijn eindpunt? Geeft een snijlijn { p, d, fill } of null (vrij eind).
 * - hoekaansluiting (eindpunt valt samen met het eindpunt van een andere muur): verstek langs de bissectrice;
 * - T-aansluiting (eindpunt ligt in een andere muur): afsnijden op het vlak van die muur.
 * fill: snijlijn voor de vulling, een haar verder de andere muur in, zodat er geen naad zichtbaar is.
 */
function endCut(wall, atEnd, walls, lw) {
  const pts = wall.points;
  const P = atEnd ? pts[pts.length - 1] : pts[0];
  const Q = atEnd ? pts[pts.length - 2] : pts[1];
  const back = unit(P, Q); // vanaf het eindpunt terug de muur in
  for (const o of walls) {
    if (o === wall) continue;
    const op = o.points;
    if (o.kind !== 'polygon') {
      for (const [E, F] of [[op[0], op[1]], [op[op.length - 1], op[op.length - 2]]]) {
        if (dist(E, P) > EPS) continue;
        const v = unit(E, F);
        let m = [back[0] + v[0], back[1] + v[1]];
        if (Math.hypot(m[0], m[1]) < 1e-6) return null; // in elkaars verlengde: gewoon doorlopen
        m = [m[0], m[1]];
        return { p: P, d: m, fill: { p: P, d: m } };
      }
    }
    let best = null;
    for (const [A, B] of wallSegments(o)) {
      const dd = distToSegment(P, A, B);
      if (dd > o.width / 2 + EPS) continue;
      const u = unit(A, B);
      if (Math.abs(cross(u, back)) < 0.2) continue; // (bijna) evenwijdig
      if (!best || dd < best.dd) best = { dd, A, B, u, o };
    }
    if (best) {
      const { A, u, o: ow } = best;
      const n = [-u[1], u[0]];
      const s = Math.sign(cross(u, [Q[0] - A[0], Q[1] - A[1]])) || 1;
      const [foot] = projectOnLine(P, A, best.B);
      const face = [foot[0] + n[0] * s * ow.width / 2, foot[1] + n[1] * s * ow.width / 2];
      const inside = [face[0] - n[0] * s * lw, face[1] - n[1] * s * lw];
      return { p: face, d: u, fill: { p: inside, d: u } };
    }
  }
  return null;
}

/**
 * Vorm van een muur om te tekenen: vulling (ringen) en buitenlijnen (losse lijnstukken),
 * rekening houdend met de andere muren. lw: lijndikte in meters.
 */
export function wallShape(wall, walls, lw) {
  const closed = wall.kind === 'polygon';
  const { left, right } = wallSides(wall.points, closed, wall.width);
  if (closed) return { fill: [left, right], lines: [[...left, left[0]], [...right, right[0]]] };
  const n = left.length;
  const fl = left.map((p) => [...p]), fr = right.map((p) => [...p]);
  const sl = left.map((p) => [...p]), sr = right.map((p) => [...p]);
  const caps = [];
  for (const atEnd of [false, true]) {
    const i = atEnd ? n - 1 : 0, j = atEnd ? n - 2 : 1;
    const cut = n >= 2 ? endCut(wall, atEnd, walls, lw) : null;
    if (!cut) { caps.push([left[i], right[i]]); continue; }
    for (const [src, dstS, dstF] of [[left, sl, fl], [right, sr, fr]]) {
      const d = unit(src[j], src[i]);
      const ps = intersect(src[j], d, cut.p, cut.d);
      const pf = intersect(src[j], d, cut.fill.p, cut.fill.d);
      if (ps) dstS[i] = ps;
      if (pf) dstF[i] = pf;
    }
  }
  return { fill: [[...fl, ...fr.reverse()]], lines: [sl, sr, ...caps] };
}

// ------------------------------------------------------------------ deuren en ramen

/** Dichtstbijzijnde muur(segment) bij punt w binnen maxDist (meters, gemeten vanaf het muurvlak). */
export function nearestWallSeg(doc, w, maxDist) {
  let best = null, bd = maxDist;
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const it of layer.items) {
      if (!isWall(it)) continue;
      wallSegments(it).forEach(([a, b], seg) => {
        const d = Math.max(0, distToSegment(w, a, b) - it.width / 2);
        if (d > bd) return;
        bd = d;
        const [, t] = projectOnLine(w, a, b);
        best = { wall: it, seg, t: Math.max(0, Math.min(1, t)) };
      });
    }
  }
  return best;
}

/** Koppel een opening aan een muursegment; side: +1 = draaikant links van de segmentrichting. */
export function linkOpening(op, res, side) {
  op.wallId = res.wall.id;
  op.wallSeg = res.seg;
  op.wallT = res.t;
  op.wallSide = side >= 0 ? 1 : -1;
  placeOpening(op, res.wall);
}

/** Zet een gekoppelde opening op zijn plek in de muur (positie, richting, dikte). */
export function placeOpening(op, wall) {
  const segs = wallSegments(wall);
  if (!segs.length) return;
  let seg = op.wallSeg;
  if (!(seg >= 0 && seg < segs.length)) {
    const res = nearestWallSeg({ layers: [{ visible: true, items: [wall] }] }, [op.x, op.y], Infinity);
    seg = res ? res.seg : 0;
    op.wallSeg = seg;
  }
  const [a, b] = segs[seg];
  const t = Math.max(0, Math.min(1, op.wallT ?? 0.5));
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  op.x = Math.round((a[0] + (b[0] - a[0]) * t) * 10000) / 10000;
  op.y = Math.round((a[1] + (b[1] - a[1]) * t) * 10000) / 10000;
  op.rot = (op.wallSide ?? 1) > 0 ? ang : ang + Math.PI;
  op.h = wall.width;
}

/**
 * Na een bewerking: openingen van gewijzigde muren opnieuw plaatsen; verplaatste openingen
 * opnieuw in de dichtstbijzijnde muur klikken (of loskoppelen als er geen muur meer is).
 */
export function syncOpenings(doc, wallIds, movedOpenings = [], maxDist = 0.5) {
  const walls = {};
  for (const layer of doc.layers) for (const it of layer.items) if (isWall(it)) walls[it.id] = it;
  const moved = new Set(movedOpenings.map((o) => o.id));
  for (const layer of doc.layers) {
    for (const it of layer.items) {
      if (!isOpening(it) || moved.has(it.id) || !it.wallId || !wallIds.has(it.wallId)) continue;
      if (walls[it.wallId]) placeOpening(it, walls[it.wallId]);
    }
  }
  for (const op of movedOpenings) {
    const res = nearestWallSeg(doc, [op.x, op.y], maxDist);
    if (!res) {
      delete op.wallId; delete op.wallSeg; delete op.wallT; delete op.wallSide;
      continue;
    }
    const [a, b] = wallSegments(res.wall)[res.seg];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    linkOpening(op, res, Math.cos((op.rot || 0) - ang) >= 0 ? 1 : -1);
  }
}
