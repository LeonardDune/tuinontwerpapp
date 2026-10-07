// Tekenen, raken, begrenzen en transformeren van items.

import { BRUSHES, strokePath, grainPattern } from './brushes.js';
import { hatchPattern, HATCHES } from './patterns.js';
import { drawStencil, STENCIL_MAP } from './stencils.js';
import { getImage } from './assets.js';
import {
  drawRoleSymbol, rolesMap, layoutPoints, roleDiameter, plantOutline, hitPlant, shapePolygon, monthState, plantCount, isBed,
} from './planting.js';
import { paperToWorld } from './model.js';
import { wallShape } from './walls.js';
import { formatLength, formatArea } from './units.js';
import {
  dist, bbox, distToSegment, pointInPolygon, polygonArea, polygonCentroid, matApply, rotate,
} from './geom.js';

const pathCache = new WeakMap();

export function invalidate(item) {
  pathCache.delete(item);
}

function hexA(color, a) {
  const c = (color || '#000000').replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------- tekenen

/**
 * rc: { doc, scale, zoom }  — zoom = px per meter (voor schermafhankelijke details)
 */
export function drawItem(g, item, rc) {
  switch (item.type) {
    case 'stroke': return drawStroke(g, item, rc);
    case 'shape': return drawShape(g, item, rc);
    case 'dim':
      if (item.kind === 'area') return drawAreaLabel(g, item, rc);
      return drawDim(g, item.a, item.b, item.offset || 0, rc, { color: item.color });
    case 'stencil':
      if (item.role && rc.month) drawStencilMonth(g, item, rc);
      return drawStencil(g, item, paperToWorld(0.25, rc.scale), rc.paper);
    case 'text': return drawText(g, item, rc);
    case 'image': return drawImage(g, item, rc);
    case 'plant': return drawPlant(g, item, rc);
  }
}

function drawPlant(g, item, rc) {
  const roles = rc.roles || rolesMap(rc.doc);
  const r = roles[item.role];
  if (!r) return;
  drawRoleSymbol(g, r, item.x, item.y, item.d, rc.month || null, paperToWorld(0.2, rc.scale));
}

const layoutCache = new WeakMap();

/** Plantposities van een vak of groep, gecachet zolang vorm, mix en bouwstenen gelijk blijven. */
function cachedLayout(item, poly, rc, exclude, clip) {
  const roles = rc.roles || rolesMap(rc.doc);
  const key = JSON.stringify([item.points, item.planting?.mix, exclude, clip ? clip.length : 0, rc.rolesKey || '']);
  const hit = layoutCache.get(item);
  if (hit && hit.key === key) return hit.pts;
  let pts = layoutPoints(poly, item.planting?.mix, roles, item.id, exclude);
  if (clip) pts = pts.filter((p) => pointInPolygon([p.x, p.y], clip));
  layoutCache.set(item, { key, pts });
  return pts;
}

/** Kleur van een mix in de gekozen maand (gewogen naar het grootste aandeel). */
function mixColor(mix, rc) {
  const roles = rc.roles || rolesMap(rc.doc);
  let best = null, bw = -1;
  for (const m of mix || []) {
    const r = roles[m.role];
    if (!r || m.w <= bw) continue;
    const st = rc.month ? monthState(r, rc.month) : { color: r.color };
    best = st.color || '#c9c2b0';
    bw = m.w;
  }
  return best || '#9fb98a';
}

function mixCodes(mix, rc) {
  const roles = rc.roles || rolesMap(rc.doc);
  return (mix || []).filter((m) => roles[m.role]).map((m) => roles[m.role].code).join('+');
}

/** Plantvak: rand, basismix (zonder de groepen) als symbolen of als vlak met code en aantal. */
function drawBed(g, item, rc) {
  const roles = rc.roles || rolesMap(rc.doc);
  const poly = shapePolygon(item);
  const groups = (rc.groupsByBed?.[item.id] || []).map((gr) => shapePolygon(gr));
  const view = rc.plantView || 'planten';
  const lw = paperToWorld(0.15, rc.scale);
  g.save();
  tracePath(g, item);
  const mix = item.planting?.mix || [];
  if (view === 'groepen' && mix.length) {
    g.fillStyle = hexA(mixColor(mix, rc), 0.18);
  } else {
    g.fillStyle = 'rgba(122, 154, 90, 0.10)';
  }
  g.fill();
  if (view !== 'groepen') {
    g.save();
    g.clip();
    for (const p of cachedLayout(item, poly, rc, groups)) {
      drawRoleSymbol(g, p.role, p.x, p.y, roleDiameter(p.role) * 0.95, rc.month || null, lw, { alpha: 0.6 });
    }
    g.restore();
  }
  tracePath(g, item);
  g.strokeStyle = item.color || '#3f7a2e';
  g.lineWidth = item.width || paperToWorld(0.3, rc.scale);
  g.setLineDash([g.lineWidth * 4, g.lineWidth * 2]);
  g.stroke();
  g.restore();
  if (view === 'groepen' && mix.length && rc.bedAreas?.[item.id] != null) {
    const n = plantCount(rc.bedAreas[item.id], mix, roles);
    drawLabel(g, `${mixCodes(mix, rc)} · ${n} st.`, labelPoint(poly, groups), rc, false, 2.2, '#2f4a25');
  }
}

/** Punt in het vak buiten de groepen voor het label. */
function labelPoint(poly, groups) {
  const c = polygonCentroid(poly);
  const free = (p) => pointInPolygon(p, poly) && !groups.some((q) => pointInPolygon(p, q));
  if (free(c)) return c;
  const b = bbox(poly);
  const n = 12;
  let best = c, bd = Infinity;
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < n; j++) {
      const p = [b.minX + ((b.maxX - b.minX) * i) / n, b.minY + ((b.maxY - b.minY) * j) / n];
      if (!free(p)) continue;
      const d = dist(p, c);
      if (d < bd) { bd = d; best = p; }
    }
  }
  return best;
}

/** Groep binnen een plantvak: begrensd door het vak, eigen mix. */
function drawGroup(g, item, rc) {
  const roles = rc.roles || rolesMap(rc.doc);
  const bed = rc.bedsById?.[item.bedId];
  const bedPoly = bed ? shapePolygon(bed) : null;
  const poly = shapePolygon(item);
  const view = rc.plantView || 'planten';
  const mix = item.planting?.mix || [];
  const color = mixColor(mix, rc);
  const lw = paperToWorld(0.15, rc.scale);
  g.save();
  if (bed) {
    tracePath(g, bed);
    g.clip();
  }
  tracePath(g, item);
  g.fillStyle = hexA(color, view === 'groepen' ? 0.45 : 0.12);
  g.fill();
  if (view !== 'groepen') {
    g.save();
    g.clip();
    // latere groepen in hetzelfde vak liggen erboven
    const later = (rc.groupsByBed?.[item.bedId] || []);
    const idx = later.indexOf(item);
    const exclude = idx >= 0 ? later.slice(idx + 1).map((q) => shapePolygon(q)) : [];
    for (const p of cachedLayout(item, poly, rc, exclude, bedPoly)) {
      drawRoleSymbol(g, p.role, p.x, p.y, roleDiameter(p.role) * 0.95, rc.month || null, lw, { alpha: 0.75 });
    }
    g.restore();
  }
  tracePath(g, item);
  g.strokeStyle = view === 'groepen' ? hexA('#2f4a25', 0.7) : hexA('#2f4a25', 0.45);
  g.lineWidth = paperToWorld(0.2, rc.scale);
  g.stroke();
  g.restore();
  if (view === 'groepen' && mix.length) {
    const A = rc.groupAreas?.[item.id] ?? polygonArea(poly);
    const n = plantCount(A, mix, roles);
    drawLabel(g, `${mixCodes(mix, rc)} · ${n}`, polygonCentroid(poly), rc, false, 2.2, '#1d2b36');
  }
}

/** Maandkleur van een plantstencil met bouwsteen: zachte waas over het stencil. */
function drawStencilMonth(g, item, rc) {
  const roles = rc.roles || rolesMap(rc.doc);
  const r = roles[item.role];
  if (!r || !rc.month) return;
  const st = monthState(r, rc.month);
  g.save();
  g.translate(item.x, item.y);
  g.rotate(item.rot || 0);
  g.beginPath();
  g.ellipse(0, 0, item.w / 2, item.h / 2, 0, 0, Math.PI * 2);
  if (st.color) {
    g.fillStyle = hexA(st.color, st.kind === 'bloei' ? 0.45 : 0.25);
    g.fill();
  } else {
    g.setLineDash([item.w / 30, item.w / 30]);
    g.strokeStyle = 'rgba(90,90,90,0.4)';
    g.lineWidth = paperToWorld(0.2, rc.scale);
    g.stroke();
  }
  g.restore();
}

function drawStroke(g, item, rc) {
  const brush = BRUSHES[item.brush] || BRUSHES.pen;
  let path = pathCache.get(item);
  if (!path) {
    path = strokePath(item.points, brush, item.width);
    pathCache.set(item, path);
  }
  g.save();
  g.globalAlpha *= brush.alpha * (item.opacity ?? 1);
  if (brush.composite) g.globalCompositeOperation = brush.composite;
  if (brush.texture === 'grain') {
    const pat = grainPattern(g, item.color);
    // Korrel in schermruimte houden, zodat het potlood er bij elke zoom hetzelfde uitziet.
    const m = g.getTransform();
    pat.setTransform(m.inverse());
    g.fillStyle = pat;
  } else {
    g.fillStyle = item.color;
  }
  if (brush.soft) {
    g.shadowColor = item.color;
    g.shadowBlur = Math.max(2, item.width * rc.zoom * rc.dpr * 0.35);
  }
  g.fill(path, 'nonzero');
  g.restore();
  if (item.dims && item.points.length > 1) {
    const a = item.points[0], b = item.points[item.points.length - 1];
    drawDim(g, a, b, (item.dimSide || 1) * paperToWorld(4, rc.scale), rc, { extension: false });
  }
}

function tracePath(g, item) {
  const pts = item.points;
  g.beginPath();
  if (item.kind === 'circle') {
    const r = dist(pts[0], pts[1]);
    g.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2);
    return;
  }
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (item.kind === 'polygon') g.closePath();
}

function drawShape(g, item, rc) {
  if (item.points.length < 2) return;
  if (item.wall) return drawWall(g, item, rc);
  if (item.group) return drawGroup(g, item, rc);
  if (isBed(item)) return drawBed(g, item, rc);
  g.save();
  g.globalAlpha *= item.opacity ?? 1;
  tracePath(g, item);
  const closed = item.kind === 'polygon' || item.kind === 'circle';
  if (closed && item.fill) {
    g.fillStyle = hexA(item.fill, item.fillAlpha ?? 0.35);
    g.fill();
  }
  if (closed && item.hatch && item.hatch !== 'none') {
    const hd = HATCHES[item.hatch];
    if (hd?.bg && !item.fill) {
      // zachte ondergrondkleur van het materiaal (klinkerrood, grind, gras …)
      g.save();
      g.globalAlpha *= 0.45;
      g.fillStyle = hd.bg;
      g.fill();
      g.restore();
    }
    const pat = hd?.radial ? null : hatchPattern(g, item.hatch, item.hatchColor || item.color, hatchAngle(item), item.points[0]);
    if (hd?.radial) drawRadialPaving(g, item, hd.size, rc);
    if (pat) {
      g.save();
      g.globalAlpha *= 0.75;
      g.fillStyle = pat;
      g.fill();
      g.restore();
    }
  }
  if (item.width > 0 && item.stroke !== false) {
    g.strokeStyle = item.color;
    g.lineWidth = item.width;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (item.dash) g.setLineDash([item.width * 4, item.width * 3]);
    g.stroke();
  }
  g.restore();
  if (item.dims) drawShapeDims(g, item, rc);
}

/** Muur: gevuld en gearceerd vlak met de dikte van de muur (item.width), aansluitingen netjes afgesneden. */
function drawWall(g, item, rc) {
  const lw = paperToWorld(0.3, rc.scale);
  const shape = wallShape(item, rc.walls || [item], lw);
  g.save();
  g.beginPath();
  for (const r of shape.fill) {
    r.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
  }
  g.fillStyle = '#dcd7cf';
  g.fill('evenodd');
  const pat = hatchPattern(g, 'arcering', item.color || '#2f2f2f');
  if (pat) {
    g.save();
    g.globalAlpha *= 0.55;
    g.fillStyle = pat;
    g.fill('evenodd');
    g.restore();
  }
  g.beginPath();
  for (const l of shape.lines) l.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.strokeStyle = item.color || '#2f2f2f';
  g.lineWidth = lw;
  g.lineJoin = 'miter';
  g.lineCap = 'square';
  g.stroke();
  g.restore();
}

/** Cirkelverband: ringen van keien rond het middelpunt (cirkel) of zwaartepunt (vorm), met verspringende voegen. */
function drawRadialPaving(g, item, size, rc) {
  const pts = item.points;
  const c = item.kind === 'circle' ? pts[0] : polygonCentroid(pts);
  const R = item.kind === 'circle' ? dist(pts[0], pts[1]) : Math.max(...pts.map((p) => dist(p, c)));
  if (R / size > 400) return;
  g.save();
  tracePath(g, item);
  g.clip();
  g.strokeStyle = item.hatchColor || item.color;
  g.globalAlpha *= 0.75;
  g.lineWidth = Math.max(paperToWorld(0.1, rc.scale), 0.6 / (rc.zoom * (rc.dpr || 1)));
  g.beginPath();
  g.arc(c[0], c[1], size * 0.6, 0, Math.PI * 2);
  for (let k = 1; k * size <= R + size; k++) {
    const r0 = size * 0.6 + (k - 1) * size, r1 = r0 + size;
    g.moveTo(c[0] + r1, c[1]);
    g.arc(c[0], c[1], r1, 0, Math.PI * 2);
    const n = Math.max(6, Math.round((Math.PI * 2 * (r0 + r1) / 2) / (size * 1.1)));
    const off = (k % 2) * 0.5;
    for (let i = 0; i < n; i++) {
      const a = ((i + off) / n) * Math.PI * 2;
      g.moveTo(c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0);
      g.lineTo(c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1);
    }
  }
  g.stroke();
  g.restore();
  tracePath(g, item); // het pad van de vorm terugzetten voor de omtrek
}

/** Legrichting van bestrating: zelf ingesteld, anders langs de eerste zijde van de vorm. */
export function hatchAngle(item) {
  if (item.hatchRot != null) return item.hatchRot;
  if (item.kind === 'polygon' && item.points.length >= 2) {
    const [a, b] = item.points;
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  return 0;
}

function drawShapeDims(g, item, rc) {
  const pts = item.points;
  const off = paperToWorld(4, rc.scale);
  if (item.kind === 'circle') {
    const c = pts[0], r = dist(pts[0], pts[1]);
    drawDim(g, [c[0] - r, c[1]], [c[0] + r, c[1]], 0, rc, { prefix: 'Ø ', extension: false });
    if (item.area !== false) drawLabel(g, formatArea(Math.PI * r * r), [c[0], c[1] + paperToWorld(5, rc.scale)], rc);
    return;
  }
  const closed = item.kind === 'polygon';
  const centroid = closed ? polygonCentroid(pts) : null;
  const n = closed ? pts.length : pts.length - 1;
  const edges = item.dimEdges || [...Array(n).keys()];
  for (const i of edges) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (!a || !b || dist(a, b) < 1e-6) continue;
    let o = 0;
    if (closed) {
      const nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const mx = (a[0] + b[0]) / 2 - centroid[0], my = (a[1] + b[1]) / 2 - centroid[1];
      o = nx * mx + ny * my > 0 ? off : -off;
    }
    drawDim(g, a, b, o, rc, { extension: closed });
  }
  if (closed && item.area !== false && pts.length >= 3) {
    drawLabel(g, formatArea(polygonArea(pts)), centroid, rc, true);
  }
}

/** Maatlijn met schuine tikjes en een leesbaar label. */
export function drawDim(g, a, b, offset, rc, opts = {}) {
  const len = dist(a, b);
  if (len < 1e-9) return;
  const s = rc.scale;
  const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  const nx = -uy, ny = ux;
  const ox = nx * offset, oy = ny * offset;
  const A = [a[0] + ox, a[1] + oy], B = [b[0] + ox, b[1] + oy];
  const color = opts.color || '#1d2b36';
  // op het scherm nooit kleiner dan leesbaar (rc.minPx); in de export op papiergrootte
  const minW = rc.minPx ? 1 / rc.zoom : 0;
  const lw = Math.max(paperToWorld(0.18, s), minW);
  const tick = Math.max(paperToWorld(1.4, s), minW * 7);

  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.beginPath();
  if (offset !== 0 && opts.extension !== false) {
    const sg = Math.sign(offset);
    const gap = Math.max(paperToWorld(0.8, s), minW * 3) * sg, ext = Math.max(paperToWorld(1.2, s), minW * 5) * sg;
    g.moveTo(a[0] + nx * gap, a[1] + ny * gap); g.lineTo(A[0] + nx * ext, A[1] + ny * ext);
    g.moveTo(b[0] + nx * gap, b[1] + ny * gap); g.lineTo(B[0] + nx * ext, B[1] + ny * ext);
  }
  g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
  // architectonische tikjes onder 45°
  const tx = (ux + nx) * tick * 0.5, ty = (uy + ny) * tick * 0.5;
  g.moveTo(A[0] - tx, A[1] - ty); g.lineTo(A[0] + tx, A[1] + ty);
  g.moveTo(B[0] - tx, B[1] - ty); g.lineTo(B[0] + tx, B[1] + ty);
  g.stroke();

  // label
  let ang = Math.atan2(uy, ux);
  if (ang > Math.PI / 2 + 1e-6 || ang <= -Math.PI / 2 + 1e-6) ang += Math.PI;
  const up = [Math.sin(ang), -Math.cos(ang)];
  let out = up;
  if (offset !== 0) out = [nx * Math.sign(offset), ny * Math.sign(offset)];
  const above = out[0] * up[0] + out[1] * up[1] >= 0;
  const text = (opts.prefix || '') + formatLength(len, s);
  const h = Math.max(paperToWorld(2.3, s), (rc.minPx || 0) / rc.zoom);
  const gapT = Math.max(paperToWorld(0.8, s), h * 0.3);
  const mx = (A[0] + B[0]) / 2 + out[0] * gapT, my = (A[1] + B[1]) / 2 + out[1] * gapT;
  g.translate(mx, my);
  g.rotate(ang);
  const k = h / 100;
  g.scale(k, k);
  g.font = '500 100px system-ui, -apple-system, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = above ? 'bottom' : 'top';
  g.lineWidth = 22;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineJoin = 'round';
  g.strokeText(text, 0, 0);
  g.fillText(text, 0, 0);
  g.restore();
}

function findById(doc, id) {
  for (const l of doc.layers) for (const i of l.items) if (i.id === id) return i;
  return null;
}

/** Middelpunt en oppervlakte van de vorm waar een oppervlaktelabel bij hoort. */
export function areaLabelInfo(doc, item) {
  const ref = doc && findById(doc, item.ref);
  if (!ref || ref.type !== 'shape') return null;
  if (ref.kind === 'circle') {
    const r = dist(ref.points[0], ref.points[1]);
    return { c: ref.points[0], area: Math.PI * r * r };
  }
  if (ref.kind === 'polygon' && ref.points.length >= 3) return { c: polygonCentroid(ref.points), area: polygonArea(ref.points) };
  return null;
}

function drawAreaLabel(g, item, rc) {
  const info = areaLabelInfo(rc.doc, item);
  if (info) drawLabel(g, formatArea(info.area), info.c, rc, true, 2.5, item.color || '#1d2b36');
}

export function drawLabel(g, text, p, rc, italic = false, sizeMm = 2.5, color = '#1d2b36') {
  const h = Math.max(paperToWorld(sizeMm, rc.scale), (rc.minPx || 0) / rc.zoom);
  g.save();
  g.translate(p[0], p[1]);
  const k = h / 100;
  g.scale(k, k);
  g.font = `${italic ? 'italic ' : ''}500 100px system-ui, -apple-system, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 22;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineJoin = 'round';
  g.strokeText(text, 0, 0);
  g.fillStyle = color;
  g.fillText(text, 0, 0);
  g.restore();
}

function drawText(g, item) {
  g.save();
  g.translate(item.x, item.y);
  g.rotate(item.rot || 0);
  const k = item.size / 100;
  g.scale(k, k);
  g.font = `${item.bold ? '700' : '500'} 100px system-ui, -apple-system, sans-serif`;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = item.color || '#222';
  const lines = String(item.text).split('\n');
  lines.forEach((line, i) => g.fillText(line, 0, i * 120));
  g.restore();
}

export function measureText(item) {
  const lines = String(item.text).split('\n');
  const longest = Math.max(...lines.map((l) => l.length), 1);
  return { w: longest * 0.56 * item.size, h: (lines.length - 1) * 1.2 * item.size + item.size };
}

function drawImage(g, item, rc) {
  const img = getImage(rc.doc, item.asset);
  g.save();
  g.translate(item.x, item.y);
  g.rotate(item.rot || 0);
  g.globalAlpha *= item.opacity ?? 1;
  if (img) {
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, -item.w / 2, -item.h / 2, item.w, item.h);
  } else {
    g.fillStyle = '#e8e8e8';
    g.fillRect(-item.w / 2, -item.h / 2, item.w, item.h);
  }
  g.restore();
}

// ---------------------------------------------------------------- geometrie

/** Omtrekpunten van een item (wereld), voor lasso, begrenzing en snappen. */
export function itemOutline(item) {
  switch (item.type) {
    case 'stroke':
    case 'shape':
      if (item.kind === 'circle') {
        const c = item.points[0], r = dist(item.points[0], item.points[1]);
        return Array.from({ length: 16 }, (_, i) => [c[0] + Math.cos(i * Math.PI / 8) * r, c[1] + Math.sin(i * Math.PI / 8) * r]);
      }
      return item.points;
    case 'dim':
      return item.kind === 'area' ? [] : [item.a, item.b];
    case 'plant':
      return plantOutline(item);
    case 'stencil':
    case 'image':
      return rectCorners(item.x, item.y, item.w, item.h, item.rot || 0);
    case 'text': {
      const m = measureText(item);
      const r = item.rot || 0;
      return [[0, -item.size], [m.w, -item.size], [m.w, m.h - item.size], [0, m.h - item.size]]
        .map((p) => rotate(p, r)).map((p) => [p[0] + item.x, p[1] + item.y]);
    }
  }
  return [];
}

function rectCorners(cx, cy, w, h, rot) {
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map((p) => rotate(p, rot)).map((p) => [p[0] + cx, p[1] + cy]);
}

export function itemBBox(item) {
  const pts = itemOutline(item);
  if (!pts.length) return null;
  const b = bbox(pts);
  const pad = (item.width || 0) / 2;
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

/** Ligt wereldpunt p binnen tol (meters) van het item? */
export function hitItem(item, p, tol) {
  switch (item.type) {
    case 'stroke': {
      const pts = item.points;
      const t = tol + item.width / 2;
      if (pts.length === 1) return dist(p, pts[0]) <= t;
      for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) <= t) return true;
      return false;
    }
    case 'shape': {
      const t = tol + (item.width || 0) / 2;
      if (item.kind === 'circle') {
        const r = dist(item.points[0], item.points[1]);
        const d = dist(p, item.points[0]);
        return Math.abs(d - r) <= t || ((item.fill || item.hatch || item.group || isBed(item)) && d <= r);
      }
      const pts = item.points;
      const n = item.kind === 'polygon' ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) if (distToSegment(p, pts[i], pts[(i + 1) % pts.length]) <= t) return true;
      if (item.kind === 'polygon' && (item.fill || (item.hatch && item.hatch !== 'none') || item.group || isBed(item))) return pointInPolygon(p, pts);
      return false;
    }
    case 'plant':
      return hitPlant(item, p, tol);
    case 'dim':
      if (item.kind === 'area') return false;
      return distToSegment(p, item.a, item.b) <= tol * 1.5;
    case 'stencil':
      if (STENCIL_MAP[item.symbol]?.swing) {
        // deur: ook het deurblad en de draaicirkel (buiten de muur) zijn aan te tikken
        const l = rotate([p[0] - item.x, p[1] - item.y], -(item.rot || 0));
        if (Math.abs(l[0]) <= item.w / 2 + tol && l[1] >= -item.h / 2 - tol && l[1] <= item.h / 2 + item.w + tol) return true;
      }
    // fall through
    case 'image':
    case 'text':
      return pointInPolygon(p, itemOutline(item)) || itemOutline(item).some((q, i, arr) => distToSegment(p, q, arr[(i + 1) % arr.length]) <= tol);
  }
  return false;
}

/** Punten waarop andere geometrie kan snappen. */
export function itemSnapPoints(item) {
  switch (item.type) {
    case 'stroke':
      return item.points.length ? [item.points[0], item.points[item.points.length - 1]] : [];
    case 'shape':
      return item.kind === 'circle' ? [item.points[0]] : item.points;
    case 'dim':
      return item.kind === 'area' ? [] : [item.a, item.b];
    case 'stencil':
    case 'plant':
      return [[item.x, item.y]];
  }
  return [];
}

/** Pas matrix m (gelijkvormig: schaal s, rotatie r) toe op een item. */
export function transformItem(item, m, s, r) {
  const tp = (p) => {
    const q = matApply(m, p);
    return p.length > 2 ? [q[0], q[1], ...p.slice(2)] : q;
  };
  switch (item.type) {
    case 'stroke':
    case 'shape':
      item.points = item.points.map(tp);
      if (item.width) item.width *= s;
      if (item.hatchRot != null) item.hatchRot += r;
      break;
    case 'dim':
      if (item.kind === 'area') break;
      item.a = tp(item.a);
      item.b = tp(item.b);
      item.offset = (item.offset || 0) * s;
      break;
    case 'stencil':
    case 'image': {
      const c = tp([item.x, item.y]);
      item.x = c[0]; item.y = c[1];
      item.w *= s; item.h *= s;
      item.rot = (item.rot || 0) + r;
      break;
    }
    case 'plant': {
      const c = tp([item.x, item.y]);
      item.x = c[0]; item.y = c[1];
      item.d *= s;
      break;
    }
    case 'text': {
      const c = tp([item.x, item.y]);
      item.x = c[0]; item.y = c[1];
      item.size *= s;
      item.rot = (item.rot || 0) + r;
      break;
    }
  }
  invalidate(item);
}

export function stencilDef(item) {
  return STENCIL_MAP[item.symbol];
}
