// Vlakken samenvoegen tot één omtrek (vereniging van eenvoudige veelhoeken).
// Werkt voor vakken die tegen elkaar liggen (gedeelde zijden) en voor vakken die overlappen.

import { pointInPolygon, polygonArea, distToSegment } from './geom.js';

const EPS = 1e-7;
const key = (p) => `${Math.round(p[0] / 1e-6)},${Math.round(p[1] / 1e-6)}`;

function signed(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Splitsparameters van segment a-b door de zijden van een andere veelhoek. */
function splitParams(a, b, poly, out) {
  const d = [b[0] - a[0], b[1] - a[1]];
  const L2 = d[0] * d[0] + d[1] * d[1];
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i], e = poly[(i + 1) % poly.length];
    const f = [e[0] - c[0], e[1] - c[1]];
    const den = d[0] * f[1] - d[1] * f[0];
    const qx = c[0] - a[0], qy = c[1] - a[1];
    if (Math.abs(den) < 1e-12 * Math.sqrt(L2 * (f[0] * f[0] + f[1] * f[1]))) {
      // evenwijdig: alleen als ze op één lijn liggen, de eindpunten van de ander projecteren
      if (Math.abs(qx * d[1] - qy * d[0]) / Math.sqrt(L2) > EPS) continue;
      for (const p of [c, e]) {
        const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / L2;
        if (t > EPS && t < 1 - EPS) out.push(t);
      }
      continue;
    }
    const t = (qx * f[1] - qy * f[0]) / den, u = (qx * d[1] - qy * d[0]) / den;
    if (u < -EPS || u > 1 + EPS) continue;
    if (t > EPS && t < 1 - EPS) out.push(t);
  }
}

/** Ligt p op de rand van poly? Geeft de richting van die zijde, of null. */
function onEdge(p, poly) {
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i], e = poly[(i + 1) % poly.length];
    if (distToSegment(p, c, e) < 1e-6) return [e[0] - c[0], e[1] - c[1]];
  }
  return null;
}

/**
 * Vereniging van veelhoeken. Geeft { rings: [[...punten]], outer: aantal buitenranden, holes: aantal gaten }.
 */
export function unionPolygons(input) {
  const polys = input.map((p) => (signed(p) < 0 ? [...p].reverse() : [...p]));
  const edges = [];
  polys.forEach((poly, i) => {
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < EPS) continue;
      const ts = [0, 1];
      polys.forEach((other, j) => { if (j !== i) splitParams(a, b, other, ts); });
      ts.sort((x, y) => x - y);
      for (let m = 1; m < ts.length; m++) {
        if (ts[m] - ts[m - 1] < 1e-9) continue;
        const p = [a[0] + (b[0] - a[0]) * ts[m - 1], a[1] + (b[1] - a[1]) * ts[m - 1]];
        const q = [a[0] + (b[0] - a[0]) * ts[m], a[1] + (b[1] - a[1]) * ts[m]];
        const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        let keep = true;
        for (let j = 0; j < polys.length && keep; j++) {
          if (j === i) continue;
          const dir = onEdge(mid, polys[j]);
          if (dir) {
            const same = dir[0] * (q[0] - p[0]) + dir[1] * (q[1] - p[1]) > 0;
            // gedeelde zijde: tegengesteld = binnenkant (weg); gelijk = dubbel (één houden)
            if (!same || j < i) keep = false;
          } else if (pointInPolygon(mid, polys[j])) keep = false;
        }
        if (keep) edges.push({ p, q, used: false });
      }
    }
  });
  // zijden aan elkaar rijgen tot rondes
  const byStart = new Map();
  for (const e of edges) {
    const k = key(e.p);
    if (!byStart.has(k)) byStart.set(k, []);
    byStart.get(k).push(e);
  }
  const rings = [];
  for (const e0 of edges) {
    if (e0.used) continue;
    const ring = [];
    let e = e0;
    let guard = 0;
    while (e && !e.used && guard++ < 100000) {
      e.used = true;
      ring.push(e.p);
      const next = (byStart.get(key(e.q)) || []).filter((x) => !x.used);
      if (!next.length) break;
      // bij een knooppunt: de scherpste bocht naar links houdt de buitenrand bij elkaar
      const din = Math.atan2(e.q[1] - e.p[1], e.q[0] - e.p[0]);
      next.sort((x, y) => turn(din, x) - turn(din, y));
      e = next[next.length - 1];
    }
    if (ring.length >= 3) rings.push(simplify(ring));
  }
  const good = rings.filter((r) => r.length >= 3 && Math.abs(polygonArea(r)) > 1e-8);
  return {
    rings: good,
    outer: good.filter((r) => signed(r) > 0).length,
    holes: good.filter((r) => signed(r) < 0).length,
  };
}

function turn(din, e) {
  let d = Math.atan2(e.q[1] - e.p[1], e.q[0] - e.p[0]) - din;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  return d;
}

/** Punten op een rechte lijn weghalen. */
function simplify(ring) {
  let pts = ring;
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      if (Math.abs(cross) / len < 1e-7 || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-7) { changed = true; continue; }
      out.push(b);
    }
    pts = out;
  }
  return pts;
}

/** Is deze ring een rechthoek (4 rechte hoeken)? */
export function isRectRing(r) {
  if (r.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = r[i], b = r[(i + 1) % 4], c = r[(i + 2) % 4];
    const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
    if (Math.abs(dot) > 1e-6 * Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1])) return false;
  }
  return true;
}
