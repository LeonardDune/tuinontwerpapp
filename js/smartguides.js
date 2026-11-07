// Slimme hulplijnen bij verplaatsen, schalen en draaien: uitlijnen (zijkanten en midden),
// gelijke tussenruimte, gelijke maat en gelijke hoek als andere elementen.

import { itemOutline } from './items.js';
import { itemAngle, itemFrame } from './edit.js';

const COLOR = '#d6336c';

function lineDiff(a, b) {
  let d = (a - b) % (Math.PI / 2);
  if (d > Math.PI / 4) d -= Math.PI / 2;
  if (d < -Math.PI / 4) d += Math.PI / 2;
  return d;
}

/** Omvang van punten in het assenstelsel (U, V) met hoek th. */
export function extentsOf(pts, th) {
  const c = Math.cos(th), s = Math.sin(th);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of pts) {
    const u = x * c + y * s, v = -x * s + y * c;
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  return { u0, u1, v0, v1 };
}

/** Referenties: de andere zichtbare elementen, bekeken in het assenstelsel met hoek th. */
export function collectRefs(app, exclude, th) {
  const refs = [];
  for (const layer of app.store.doc.layers) {
    if (!layer.visible) continue;
    for (const it of layer.items) {
      if (exclude.has(it.id)) continue;
      if (it.type === 'dim' || it.type === 'stroke' || (it.type === 'shape' && it.kind === 'line' && !it.wall)) continue;
      const pts = itemOutline(it);
      if (!pts || pts.length < 2) continue;
      const a = itemAngle(it);
      const parallel = a == null ? (it.type === 'shape' && it.kind === 'circle') || it.type === 'plant' : Math.abs(lineDiff(a, th)) < 0.2 * Math.PI / 180;
      const e = extentsOf(pts, th);
      const f = itemFrame(it);
      refs.push({ id: it.id, ...e, parallel, size: f ? [Math.abs(f.w), Math.abs(f.h)] : null, ang: a });
    }
  }
  return refs;
}

const toWorld = (u, v, th) => { const c = Math.cos(th), s = Math.sin(th); return [u * c - v * s, u * s + v * c]; };

/**
 * Uitlijnen en gelijke tussenruimte voor een verschuiving.
 * ext: omvang van de selectie (al verschoven). Geeft { du, dv, lines, gaps }.
 */
export function alignMove(refs, ext, tol) {
  const res = { du: 0, dv: 0, lines: [], gaps: [] };
  for (const axis of ['u', 'v']) {
    const o = axis === 'u' ? ['u0', 'u1'] : ['v0', 'v1'];
    const q = axis === 'u' ? ['v0', 'v1'] : ['u0', 'u1'];
    const own = [ext[o[0]], (ext[o[0]] + ext[o[1]]) / 2, ext[o[1]]];
    let best = null;
    for (const r of refs) {
      const vals = r.parallel ? [r[o[0]], (r[o[0]] + r[o[1]]) / 2, r[o[1]]] : [(r[o[0]] + r[o[1]]) / 2];
      for (const a of own) {
        for (const b of vals) {
          const d = b - a;
          if (Math.abs(d) < tol && (!best || Math.abs(d) < Math.abs(best.d) - 1e-9)) best = { d, at: b, refs: [r] };
          else if (best && Math.abs(Math.abs(d) - Math.abs(best.d)) < 1e-9 && Math.abs(d - best.d) < 1e-9) best.refs.push(r);
        }
      }
    }
    // gelijke tussenruimte met buren in dezelfde rij
    const row = refs.filter((r) => r.parallel && r[q[1]] > ext[q[0]] && r[q[0]] < ext[q[1]]).sort((a, b) => a[o[0]] - b[o[0]]);
    const left = row.filter((r) => r[o[1]] <= ext[o[0]] + tol).sort((a, b) => b[o[1]] - a[o[1]])[0];
    const right = row.filter((r) => r[o[0]] >= ext[o[1]] - tol).sort((a, b) => a[o[0]] - b[o[0]])[0];
    const gapsIn = [];
    for (let i = 0; i < row.length; i++) {
      for (let j = 0; j < row.length; j++) {
        if (i === j) continue;
        const g = row[j][o[0]] - row[i][o[1]];
        // alleen directe buren (niets ertussen)
        if (g > 1e-6 && !row.some((r) => r !== row[i] && r !== row[j] && r[o[0]] >= row[i][o[1]] - 1e-9 && r[o[1]] <= row[j][o[0]] + 1e-9)) gapsIn.push({ g, a: row[i], b: row[j] });
      }
    }
    let sp = null;
    const tryGap = (d, info) => { if (Math.abs(d) < tol && (!sp || Math.abs(d) < Math.abs(sp.d))) sp = { d, ...info }; };
    const w = ext[o[1]] - ext[o[0]];
    if (left && right) {
      const free = right[o[0]] - left[o[1]];
      tryGap(left[o[1]] + (free - w) / 2 - ext[o[0]], { mode: 'mid', left, right });
    }
    for (const G of gapsIn) {
      if (left) tryGap(left[o[1]] + G.g - ext[o[0]], { mode: 'left', left, G });
      if (right) tryGap(right[o[0]] - G.g - ext[o[1]], { mode: 'right', right, G });
    }
    const useSp = sp && (!best || Math.abs(sp.d) < Math.abs(best.d) - 1e-9);
    const d = useSp ? sp.d : best ? best.d : 0;
    if (axis === 'u') res.du = d; else res.dv = d;
    if (best && !useSp && Math.abs(best.d - d) < 1e-9) {
      let m0 = ext[q[0]], m1 = ext[q[1]];
      for (const r of best.refs) { m0 = Math.min(m0, r[q[0]]); m1 = Math.max(m1, r[q[1]]); }
      res.lines.push({ axis, at: best.at, from: m0 - 0.3, to: m1 + 0.3 });
    }
    if (useSp) {
      const n0 = ext[o[0]] + d, n1 = ext[o[1]] + d;
      const mid = (Math.max(ext[q[0]], (sp.left || sp.right)[q[0]]) + Math.min(ext[q[1]], (sp.left || sp.right)[q[1]])) / 2;
      const segs = [];
      if (sp.left) segs.push([sp.left[o[1]], n0]);
      if (sp.right) segs.push([n1, sp.right[o[0]]]);
      if (sp.G) segs.push([sp.G.a[o[1]], sp.G.b[o[0]]]);
      for (const [a, b] of segs) res.gaps.push({ axis, a, b, at: mid });
    }
  }
  return res;
}

/** Gelijke maat bij schalen: breedte en hoogte (in het eigen kader) gelijk aan die van een ander element. */
export function matchSize(refs, w, h, th, tol) {
  let bw = null, bh = null;
  for (const r of refs) {
    if (!r.size || r.ang == null || Math.abs(lineDiff(r.ang, th)) > 0.2 * Math.PI / 180) continue;
    const quarter = Math.abs(((((r.ang - th) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2) < 0.01;
    const [rw, rh] = quarter ? [r.size[1], r.size[0]] : r.size;
    for (const cand of [rw, rh]) {
      if (Math.abs(cand - Math.abs(w)) < tol && (bw == null || Math.abs(cand - Math.abs(w)) < Math.abs(bw - Math.abs(w)))) bw = cand;
      if (Math.abs(cand - Math.abs(h)) < tol && (bh == null || Math.abs(cand - Math.abs(h)) < Math.abs(bh - Math.abs(h)))) bh = cand;
    }
  }
  return { w: bw, h: bh };
}

/** Gelijke hoek als een ander element (bij draaien). */
export function matchAngle(refs, ang, tolRad) {
  let best = null;
  for (const r of refs) {
    if (r.ang == null) continue;
    const d = lineDiff(r.ang, ang);
    if (Math.abs(d) < tolRad && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, ref: r };
  }
  return best;
}

/** Hulplijnen en maatstreepjes tekenen (in schermcoördinaten). */
export function drawSmartGuides(ctx, app, g) {
  if (!g || (!g.lines?.length && !g.gaps?.length)) return;
  const th = g.th;
  const S = (u, v) => app.cam.toScreen(toWorld(u, v, th));
  ctx.save();
  ctx.strokeStyle = COLOR; ctx.fillStyle = COLOR; ctx.lineWidth = 1.2;
  for (const l of g.lines || []) {
    const [a, b] = l.axis === 'u' ? [S(l.at, l.from), S(l.at, l.to)] : [S(l.from, l.at), S(l.to, l.at)];
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (const gp of g.gaps || []) {
    const [a, b] = gp.axis === 'u' ? [S(gp.a, gp.at), S(gp.b, gp.at)] : [S(gp.at, gp.a), S(gp.at, gp.b)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * 5, ny = dx / L * 5;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.moveTo(a[0] - nx, a[1] - ny); ctx.lineTo(a[0] + nx, a[1] + ny);
    ctx.moveTo(b[0] - nx, b[1] - ny); ctx.lineTo(b[0] + nx, b[1] + ny);
    ctx.stroke();
    const txt = `${(Math.round(Math.abs(gp.b - gp.a) * 100) / 100).toLocaleString('nl-NL')} m`;
    ctx.fillText(txt, (a[0] + b[0]) / 2 + nx * 1.6, (a[1] + b[1]) / 2 + ny * 1.6);
  }
  if (g.label) {
    ctx.textBaseline = 'top';
    const p = g.labelAt;
    if (p) ctx.fillText(g.label, p[0], p[1] + 14);
  }
  ctx.restore();
}

export { toWorld };
