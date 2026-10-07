// Snappen aan de tekening: eindpunten, middens, snijpunten, loodrecht op een lijn, randen (ook
// cirkels en muurvlakken), richting evenwijdig of loodrecht aan een bestaande lijn, 15°-stappen en raster.

import { itemSnapPoints } from './items.js';
import { dist, distToSegment, projectOnLine, angleOf, snapAngle, DEG } from './geom.js';
import { gridStepFor } from './render.js';
import { wallSides } from './walls.js';

const cache = { doc: null, key: null, segs: null, circles: null };

/** Rechte stukken en cirkels om op te snappen (gecachet per documentversie). */
function snapGeometry(app) {
  const doc = app.store.doc;
  const key = app.docVersion ?? null;
  if (cache.doc === doc && cache.key === key && key !== null && cache.segs) return cache;
  const segs = [], circles = [];
  const push = (a, b, item) => { if (dist(a, b) > 1e-6) segs.push({ a, b, item, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) }); };
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const it of layer.items) {
      if (it.type === 'shape') {
        if (it.kind === 'circle') { circles.push({ c: it.points[0], r: dist(it.points[0], it.points[1]), item: it }); continue; }
        const p = it.points;
        const closed = it.kind === 'polygon';
        for (let i = 1; i < p.length; i++) push(p[i - 1], p[i], it);
        if (closed && p.length > 2) push(p[p.length - 1], p[0], it);
        if (it.wall) {
          // ook de vlakken van een muur (binnen- en buitenkant)
          const { left, right } = wallSides(p, closed, it.width);
          for (const side of [left, right]) {
            for (let i = 1; i < side.length; i++) push(side[i - 1], side[i], it);
            if (closed) push(side[side.length - 1], side[0], it);
          }
        }
      } else if (it.type === 'dim' && it.kind !== 'area') {
        push(it.a, it.b, it);
      } else if (it.type === 'stroke' && it.points.length > 1 && it.points.length <= 3) {
        push(it.points[0], it.points[it.points.length - 1], it);
      }
    }
  }
  Object.assign(cache, { doc, key, segs, circles });
  return cache;
}

function lineDiff(a, b) {
  let d = (a - b) % Math.PI;
  if (d > Math.PI / 2) d -= Math.PI;
  if (d < -Math.PI / 2) d += Math.PI;
  return d;
}

function intersectSegs(s, t) {
  const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-12) return null;
  const qx = t.a[0] - s.a[0], qy = t.a[1] - s.a[1];
  const u = (qx * d2[1] - qy * d2[0]) / den, v = (qx * d1[1] - qy * d1[0]) / den;
  if (u < -1e-6 || u > 1 + 1e-6 || v < -1e-6 || v > 1 + 1e-6) return null;
  return [s.a[0] + d1[0] * u, s.a[1] + d1[1] * u];
}

/**
 * Snap wereldpunt w. from: het vorige punt (voor richting, loodrecht en hoeken).
 * Geeft { p, kind, ref?, from? } met kind: point | mid | int | perpfoot | edge | parallel | perp | angle | grid | null.
 */
export function snapPoint(app, w, from = null, exclude = null) {
  const { cam, settings, store } = app;
  const px = 1 / cam.zoom;
  const skip = (it) => exclude && exclude.has(it.id);
  if (settings.snap) {
    // 1. eindpunten en middelpunten (cirkel, stencil)
    let best = null, bd = 12 * px;
    for (const layer of store.doc.layers) {
      if (!layer.visible) continue;
      for (const item of layer.items) {
        if (skip(item)) continue;
        for (const p of itemSnapPoints(item)) {
          const d = dist(p, w);
          if (d < bd) { bd = d; best = p; }
        }
      }
    }
    if (best) return { p: [best[0], best[1]], kind: 'point' };
    const { segs, circles } = snapGeometry(app);
    const near = segs.filter((s) => !skip(s.item) && distToSegment(w, s.a, s.b) < 24 * px);
    // 2. middens van lijnstukken
    for (const s of near) {
      const m = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
      const d = dist(m, w);
      if (d < bd) { bd = d; best = { p: m, kind: 'mid', ref: s }; }
    }
    if (best) return best;
    // 3. snijpunten van lijnen in de buurt
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        if (near[i].item === near[j].item && near[i].item.kind !== 'polygon') continue;
        const q = intersectSegs(near[i], near[j]);
        if (!q) continue;
        const d = dist(q, w);
        if (d < bd) { bd = d; best = { p: q, kind: 'int' }; }
      }
    }
    if (best) return best;
    // 4. loodrecht op een lijn vanaf het vorige punt
    if (from) {
      for (const s of near) {
        const [q, t] = projectOnLine(from, s.a, s.b);
        if (t < 0 || t > 1 || dist(q, from) < 4 * px) continue;
        const d = dist(q, w);
        if (d < bd) { bd = d; best = { p: q, kind: 'perpfoot', ref: s, from }; }
      }
      if (best) return best;
    }
    // 5. op een rand (lijn, vorm, muurvlak of cirkel)
    let ed = 9 * px;
    for (const s of near) {
      const d = distToSegment(w, s.a, s.b);
      if (d < ed) {
        const [q, t] = projectOnLine(w, s.a, s.b);
        if (t >= 0 && t <= 1) { ed = d; best = { p: q, kind: 'edge', ref: s }; }
      }
    }
    for (const c of circles) {
      if (skip(c.item)) continue;
      const dc = dist(w, c.c);
      if (dc < 1e-9) continue;
      const d = Math.abs(dc - c.r);
      if (d < ed) { ed = d; best = { p: [c.c[0] + ((w[0] - c.c[0]) / dc) * c.r, c.c[1] + ((w[1] - c.c[1]) / dc) * c.r], kind: 'edge' }; }
    }
    if (best) return best;
    // 6. richting evenwijdig of loodrecht aan een bestaande lijn
    if (from && dist(from, w) > 20 * px) {
      const ang = angleOf(from, w);
      const tol = 2.5 * DEG;
      let cand = null;
      for (const s of segs) {
        if (skip(s.item)) continue;
        for (const kind of ['parallel', 'perp']) {
          const target = kind === 'perp' ? s.angle + Math.PI / 2 : s.angle;
          const dd = lineDiff(ang, target);
          if (Math.abs(dd) > tol) continue;
          // de lijn moet in beeld zijn; voorkeur voor de kleinste afwijking, dan de dichtstbijzijnde lijn
          const ds = Math.min(distToSegment(w, s.a, s.b), distToSegment(from, s.a, s.b));
          if (ds > 600 * px) continue;
          const score = Math.abs(dd) / tol + ds / (600 * px) * 0.5 + (kind === 'perp' ? 0.02 : 0);
          if (!cand || score < cand.score) cand = { score, kind, s, dd };
        }
      }
      if (cand) {
        const a = ang - cand.dd;
        const len = dist(from, w) * Math.cos(cand.dd);
        return { p: [from[0] + Math.cos(a) * len, from[1] + Math.sin(a) * len], kind: cand.kind, ref: cand.s, from };
      }
    }
  }
  if (from && settings.angleSnap) {
    const ang = angleOf(from, w);
    const sn = snapAngle(ang, 15 * DEG, 4 * DEG);
    if (sn !== ang) {
      const len = dist(from, w);
      return { p: [from[0] + Math.cos(sn) * len, from[1] + Math.sin(sn) * len], kind: 'angle' };
    }
  }
  if (settings.snap && settings.grid) {
    const step = gridStepFor(cam.zoom, store.doc.grid);
    const g = [Math.round(w[0] / step) * step, Math.round(w[1] / step) * step];
    if (dist(g, w) < 8 * px) return { p: g, kind: 'grid' };
  }
  return { p: w, kind: null };
}

const LABEL = { point: 'eindpunt', mid: 'midden', int: 'snijpunt', perpfoot: 'loodrecht op', edge: 'op lijn', parallel: 'evenwijdig', perp: 'loodrecht' };

/** Snapaanduiding op het scherm: symbool bij het punt, en bij richting de lijn waaraan gerefereerd wordt. */
export function drawSnapMarker(ctx, app, snap) {
  if (!snap || !snap.kind || snap.kind === 'angle') return;
  const S = (p) => app.cam.toScreen(p);
  const s = S(snap.p);
  const orange = '#d35400', green = '#2f5d3a', blue = '#1f6fb2';
  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (snap.ref && (snap.kind === 'parallel' || snap.kind === 'perp' || snap.kind === 'perpfoot')) {
    // de lijn waarmee het nieuwe stuk evenwijdig of loodrecht is
    const a = S(snap.ref.a), b = S(snap.ref.b);
    ctx.save();
    ctx.strokeStyle = 'rgba(31, 111, 178, 0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = snap.kind === 'point' || snap.kind === 'int' ? orange : snap.kind === 'parallel' || snap.kind === 'perp' || snap.kind === 'perpfoot' ? blue : green;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  switch (snap.kind) {
    case 'point': ctx.arc(s[0], s[1], 7, 0, Math.PI * 2); break;
    case 'mid': ctx.moveTo(s[0], s[1] - 8); ctx.lineTo(s[0] + 7, s[1] + 5); ctx.lineTo(s[0] - 7, s[1] + 5); ctx.closePath(); break;
    case 'int':
      ctx.moveTo(s[0] - 7, s[1] - 7); ctx.lineTo(s[0] + 7, s[1] + 7);
      ctx.moveTo(s[0] + 7, s[1] - 7); ctx.lineTo(s[0] - 7, s[1] + 7);
      ctx.moveTo(s[0] + 9, s[1]); ctx.arc(s[0], s[1], 9, 0, Math.PI * 2);
      break;
    case 'edge':
      ctx.moveTo(s[0] - 6, s[1] - 6); ctx.lineTo(s[0] + 6, s[1] + 6);
      ctx.moveTo(s[0] + 6, s[1] - 6); ctx.lineTo(s[0] - 6, s[1] + 6);
      break;
    case 'perpfoot':
    case 'perp':
    case 'parallel': {
      // symbool ⊥ of ∥ in de richting van de referentielijn
      const ra = Math.atan2(S(snap.ref.b)[1] - S(snap.ref.a)[1], S(snap.ref.b)[0] - S(snap.ref.a)[0]);
      ctx.save();
      ctx.translate(s[0] + 18, s[1] + 16);
      ctx.rotate(ra);
      if (snap.kind === 'parallel') {
        ctx.moveTo(-8, -3); ctx.lineTo(8, -3); ctx.moveTo(-8, 3); ctx.lineTo(8, 3);
      } else {
        ctx.moveTo(-8, 5); ctx.lineTo(8, 5); ctx.moveTo(0, 5); ctx.lineTo(0, -9);
      }
      ctx.restore();
      ctx.moveTo(s[0] + 4, s[1]); ctx.arc(s[0], s[1], 4, 0, Math.PI * 2);
      break;
    }
    default: ctx.rect(s[0] - 5, s[1] - 5, 10, 10);
  }
  ctx.stroke();
  // korte tekst, zodat duidelijk is wát er gesnapt wordt
  const label = LABEL[snap.kind];
  if (label) {
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const ly = snap.ref && (snap.kind === 'parallel' || snap.kind === 'perp' || snap.kind === 'perpfoot') ? s[1] + 30 : s[1] + 8;
    ctx.fillRect(s[0] + 10, ly, tw, 16);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(label, s[0] + 14, ly + 2);
  }
  ctx.restore();
}
