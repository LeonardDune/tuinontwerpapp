// Vooraanzicht van een plantvak: zoals je ertegenaan kijkt, met de hoogte van de planten en wat er in een gekozen
// maand te zien is (Elisabeth Scholt: "teken de plattegrond én vanaf waar je ertegenaan kijkt").

import {
  shapePolygon, layoutPoints, rolesMap, roleDiameter, monthState, principalAngle, HEIGHTS, FOLIAGE, isGroup,
} from './planting.js';
import { plantById } from './plantdb.js';
import { pointInPolygon } from './geom.js';

/** Hoogte van een bouwsteen in meters (van de plant, anders van de hoogteklasse). */
function roleHeight(r) {
  const p = r.plant && plantById(r.plant);
  if (p?.h) return p.h / 100;
  return HEIGHTS[r.height]?.h || 0.5;
}

/** Alle planten in een vak met hun plek: basis, groepjes en wensvakjes met een plant, losse planten. */
export function bedPlants(doc, bed) {
  const roles = rolesMap(doc);
  const poly = shapePolygon(bed);
  const groups = [];
  const loose = [];
  for (const l of doc.layers) {
    if (!l.visible) continue;
    for (const it of l.items) {
      if (isGroup(it) && it.bedId === bed.id) groups.push(it);
      else if ((it.type === 'plant' || (it.type === 'stencil' && it.role)) && roles[it.role] && pointInPolygon([it.x, it.y], poly)) loose.push({ x: it.x, y: it.y, role: roles[it.role] });
    }
  }
  const gpolys = groups.map((g) => shapePolygon(g));
  const pts = layoutPoints(poly, bed.planting?.mix, roles, bed.id, gpolys);
  groups.forEach((g, i) => {
    const later = gpolys.slice(i + 1);
    for (const p of layoutPoints(gpolys[i], g.planting?.mix, roles, g.id, later)) if (pointInPolygon([p.x, p.y], poly)) pts.push(p);
  });
  return { poly, pts: [...pts, ...loose] };
}

/**
 * Teken het vooraanzicht. opts: { month (1..12 of null = bloei), back (van de andere kant kijken) }.
 * Geeft de gebruikte schaal terug ({ maxH }).
 */
export function drawElevation(canvas, doc, bed, opts = {}) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  let H = canvas.height;
  const fs = Math.round(W / 28); // lettergrootte (het canvas wordt op ongeveer de halve breedte getoond)
  const { poly, pts } = bedPlants(doc, bed);
  if (!pts.length) {
    g.fillStyle = '#fbfaf6';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#8a8a80';
    g.font = `${Math.round(H / 12)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText('Nog geen planten in dit vak', W / 2, H / 2);
    return null;
  }
  // kijkrichting: loodrecht op de lange kant van het vak
  const th = principalAngle(poly);
  const ux = Math.cos(th), uy = Math.sin(th);
  const vx = -uy * (opts.back ? -1 : 1), vy = ux * (opts.back ? -1 : 1);
  const proj = (x, y) => [x * ux + y * uy, x * vx + y * vy];
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const [x, y] of poly) { const [u, v] = proj(x, y); minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
  const items = pts.map((p) => {
    const [u, v] = proj(p.x, p.y);
    return { u, v, r: p.role, h: roleHeight(p.role), d: roleDiameter(p.role) };
  });
  const maxH = Math.max(1, ...items.map((i) => i.h));
  const L = fs * 3.4, R = fs * 0.6, T = fs * 1.4, B = fs * 2.2; // marges in pixels
  const span = maxU - minU + 0.6;
  // hoogte van de tekening naar de verhouding van het vak (op schaal), binnen redelijke grenzen
  H = Math.round(Math.max(W * 0.32, Math.min(W * 0.75, ((W - L - R) * maxH * 1.12) / span + T + B)));
  if (canvas.height !== H) canvas.height = H;
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, W, H);
  const s = Math.min((W - L - R) / span, (H - T - B) / (maxH * 1.08));
  const X = (u) => L + (u - minU + 0.3) * s;
  const ground = H - B;
  const Y = (h) => ground - h * s;
  // hoogteschaal
  g.font = `${fs}px system-ui, sans-serif`;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  const step = maxH > 6 ? 2 : maxH > 2.5 ? 1 : 0.5;
  for (let h = 0; h <= maxH * 1.05; h += step) {
    g.strokeStyle = h ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.5)';
    g.beginPath(); g.moveTo(L - 4, Y(h)); g.lineTo(W - R, Y(h)); g.stroke();
    g.fillStyle = '#6a6a60';
    g.fillText(h >= 1 ? `${String(h).replace('.', ',')} m` : `${Math.round(h * 100)} cm`, L - fs * 0.4, Y(h));
  }
  // achter naar voor (verst eerst), met wat nevel achterin
  items.sort((a, b) => b.v - a.v);
  const depth = Math.max(0.01, maxV - minV);
  const month = opts.month || null;
  for (const it of items) {
    const st = month ? monthState(it.r, month) : { kind: 'bloei', color: it.r.color };
    const far = (it.v - minV) / depth; // 1 = achterin
    const fol = FOLIAGE[it.r.foliage]?.color || '#7a9a5a';
    drawPlantSide(g, X(it.u), ground, it.h * s, it.d * s, it.r, st, fol, 0.55 + 0.45 * (1 - far));
  }
  // grond
  g.fillStyle = '#b39a7a';
  g.fillRect(L - 4, ground, W - L - R + 4, Math.max(3, fs * 0.25));
  // codes van de grootste planten per soort
  const seen = new Set();
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `600 ${fs}px system-ui, sans-serif`;
  for (const it of [...items].sort((a, b) => b.h - a.h)) {
    if (seen.has(it.r.id)) continue;
    seen.add(it.r.id);
    g.fillStyle = '#2f3a2a';
    g.fillText(it.r.code || '', X(it.u), Math.max(T, Y(it.h) - 3));
  }
  g.fillStyle = '#6a6a60';
  g.font = `${fs}px system-ui, sans-serif`;
  g.textAlign = 'left';
  g.fillText(`${opts.back ? 'achterkant' : 'voorkant'} · ${String(Math.round(span * 10) / 10).replace('.', ',')} m breed`, L, H - fs * 0.6);
  return { maxH };
}

/** Silhouet van een plant van opzij, naar groeivorm; bloei bovenin in de bloeikleur. */
function drawPlantSide(g, x, y0, h, d, r, st, fol, alpha) {
  if (st.kind === 'weg') {
    // bovengronds weg: alleen een stippellijntje op de grond
    g.save(); g.globalAlpha = 0.35 * alpha; g.strokeStyle = '#8a7a5a'; g.setLineDash([2, 2]);
    g.beginPath(); g.moveTo(x - d / 3, y0 - 1); g.lineTo(x + d / 3, y0 - 1); g.stroke(); g.restore();
    return;
  }
  const body = st.kind === 'silhouet' ? '#b39a6b' : st.kind === 'herfst' ? st.color : st.kind === 'wintergroen' ? st.color : fol;
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = body;
  g.strokeStyle = 'rgba(40,50,35,0.55)';
  g.lineWidth = 1.5;
  const w = Math.max(3, d);
  g.beginPath();
  const tree = (r.kind === 'boom') || h > 3.2 * w;
  if (r.kind === 'boom' || (r.height === 'xhoog' && h > w * 1.2)) {
    // stam en kroon
    g.fillStyle = '#7a5a3a';
    g.fillRect(x - Math.max(1.5, w * 0.05), y0 - h * 0.45, Math.max(3, w * 0.1), h * 0.45);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(x, y0 - h * 0.68, w / 2, h * 0.32, 0, 0, Math.PI * 2);
  } else if (r.habit === 'rechtop' || (tree && r.habit !== 'overhangend')) {
    g.ellipse(x, y0 - h / 2, Math.max(2, w * 0.28), h / 2, 0, 0, Math.PI * 2);
  } else if (r.habit === 'bol') {
    g.ellipse(x, y0 - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (r.habit === 'spreidend') {
    g.ellipse(x, y0, w / 2, Math.max(2, h), 0, Math.PI, 0);
  } else if (r.habit === 'overhangend') {
    // fontein
    g.moveTo(x, y0);
    for (const k of [-1, -0.5, 0, 0.5, 1]) { g.moveTo(x, y0); g.quadraticCurveTo(x + k * w * 0.2, y0 - h * 1.1, x + k * w / 2, y0 - h * (0.55 + 0.4 * (1 - Math.abs(k)))); }
    g.stroke();
    g.beginPath();
    g.ellipse(x, y0 - h * 0.35, w * 0.3, h * 0.35, 0, 0, Math.PI * 2);
  } else if (r.habit === 'ijl') {
    g.ellipse(x, y0 - h / 2, w * 0.35, h / 2, 0, 0, Math.PI * 2);
    g.globalAlpha = alpha * 0.55;
  } else {
    g.ellipse(x, y0, w / 2, Math.max(2, h), 0, Math.PI, 0);
  }
  g.fill();
  g.stroke();
  // bloei bovenin
  if (st.kind === 'bloei' && st.color && r.form !== 'blad') {
    g.fillStyle = st.color;
    g.globalAlpha = alpha;
    const n = r.form === 'aar' ? 3 : r.form === 'scherm' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const fx = x + (i - (n - 1) / 2) * w * 0.18;
      g.beginPath();
      if (r.form === 'aar') g.ellipse(fx, y0 - h * 0.88, Math.max(1.5, w * 0.04), Math.max(3, h * 0.12), 0, 0, Math.PI * 2);
      else if (r.form === 'scherm') g.ellipse(fx, y0 - h * 0.95, Math.max(2, w * 0.09), Math.max(1.5, h * 0.03), 0, 0, Math.PI * 2);
      else if (r.form === 'pluim') g.ellipse(fx, y0 - h * 0.9, Math.max(2, w * 0.07), Math.max(3, h * 0.1), 0, 0, Math.PI * 2);
      else g.arc(fx, y0 - h * 0.92, Math.max(1.5, w * 0.06), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}
