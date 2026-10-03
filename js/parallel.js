// Evenwijdigheid: liniaal/driehoek uitlijnen op bestaande rechte lijnen.

import { STENCIL_MAP } from './stencils.js';
import { itemOutline } from './items.js';
import { simplify, dist, normAngle, projectOnLine } from './geom.js';

const DEG = Math.PI / 180;

/** Rechte stukken in de tekening (wereldcoördinaten). minLen in meters. */
export function collectSegments(doc, minLen) {
  const segs = [];
  const push = (a, b, item) => {
    if (dist(a, b) >= minLen) segs.push({ a, b, angle: Math.atan2(b[1] - a[1], b[0] - a[0]), item });
  };
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const item of layer.items) {
      if (item.type === 'shape' && item.kind !== 'circle') {
        const p = item.points;
        for (let i = 1; i < p.length; i++) push(p[i - 1], p[i], item);
        if (item.kind === 'polygon' && p.length > 2) push(p[p.length - 1], p[0], item);
      } else if (item.type === 'stroke' && item.points.length > 1) {
        if (item.dims) {
          push(item.points[0], item.points[item.points.length - 1], item);
        } else {
          // alleen duidelijk rechte delen van een penseelstreek
          const s = simplify(item.points, Math.max(item.width, minLen * 0.03));
          for (let i = 1; i < s.length; i++) push(s[i - 1], s[i], item);
        }
      } else if (item.type === 'dim') {
        push(item.a, item.b, item);
      } else if (item.type === 'stencil' && !STENCIL_MAP[item.symbol]?.round) {
        const o = itemOutline(item);
        for (let i = 0; i < o.length; i++) push(o[i], o[(i + 1) % o.length], item);
      }
    }
  }
  return segs;
}

/** Randen van een hulpmiddel in wereldcoördinaten. */
export function guideEdgesWorld(g, cam) {
  return g.edges.map(([a, b]) => {
    const A = cam.toWorld(g.toScreen(a)), B = cam.toWorld(g.toScreen(b));
    return { a: A, b: B, angle: Math.atan2(B[1] - A[1], B[0] - A[0]) };
  });
}

/** Hoekverschil tussen twee lijnrichtingen, genormaliseerd naar (-90°, 90°]. */
function lineDiff(a, b) {
  let d = normAngle(a - b);
  if (d > Math.PI / 2) d -= Math.PI;
  if (d <= -Math.PI / 2) d += Math.PI;
  return d;
}

/**
 * Beste uitlijning binnen tol (radialen). Geeft { diff, seg, edge, kind } of null.
 * diff: hoeveel de hulpmiddel-rand moet terugdraaien om exact uit te lijnen.
 */
export function bestAlignment(g, cam, segs, tol) {
  if (g.type === 'protractor') return null;
  const edges = guideEdgesWorld(g, cam);
  const c = cam.toWorld([g.x, g.y]);
  let best = null;
  for (const seg of segs) {
    const segMid = [(seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2];
    const far = dist(c, segMid);
    edges.forEach((edge, ei) => {
      const kinds = g.type === 'ruler' && ei === 0 ? ['parallel', 'perp'] : ['parallel'];
      for (const kind of kinds) {
        const target = kind === 'perp' ? seg.angle + Math.PI / 2 : seg.angle;
        const d = lineDiff(edge.angle, target);
        if (Math.abs(d) > tol) continue;
        // voorkeur: kleinste hoekverschil, dan dichtstbijzijnde lijn, dan evenwijdig boven haaks
        const score = Math.abs(d) / tol + far * 1e-3 + (kind === 'perp' ? 0.05 : 0);
        if (!best || score < best.score) best = { diff: d, seg, edge, edgeIndex: ei, kind, score };
      }
    });
  }
  return best;
}

/** Alle lijnen waarmee het hulpmiddel nu (vrijwel) exact uitgelijnd is. */
export function currentAlignments(g, cam, segs, tol = 0.05 * DEG) {
  if (g.type === 'protractor') return [];
  const edges = guideEdgesWorld(g, cam);
  const out = [];
  for (const seg of segs) {
    for (let ei = 0; ei < edges.length; ei++) {
      const edge = edges[ei];
      if (Math.abs(lineDiff(edge.angle, seg.angle)) <= tol) {
        out.push({ seg, edge, edgeIndex: ei, kind: 'parallel', offset: signedOffset(edge, seg) });
        break;
      }
      if (g.type === 'ruler' && ei === 0 && Math.abs(lineDiff(edge.angle, seg.angle + Math.PI / 2)) <= tol) {
        out.push({ seg, edge, edgeIndex: ei, kind: 'perp' });
        break;
      }
    }
  }
  return out;
}

/** Loodrechte afstand (m) van de lijn door seg tot de rand (positief = links van seg). */
export function signedOffset(edge, seg) {
  const [q] = projectOnLine(edge.a, seg.a, seg.b);
  const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return (edge.a[0] - q[0]) * nx + (edge.a[1] - q[1]) * ny;
}

export { DEG as PARALLEL_DEG };
