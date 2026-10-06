// Beplantingsplan, conceptfase: bouwstenen (abstracte planten), kleurenschema,
// wat er per maand te zien is, en plansymbolen.
//
// Indelingen:
//  - groeivorm (habitus): silhouet van de hele plant
//  - bloei-/zaadvorm: naar Oudolf & Kingsbury (Designing with Plants)
//  - rol in het vak: structuur, vulling (matrix), accent (o.a. Rainer & West)

import { pointInPolygon, polygonArea, bbox, dist } from './geom.js';

export const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const MONTH_NAMES = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export const HEIGHTS = {
  bodem: { name: 'Bodembedekker', range: '< 30 cm', h: 0.2, d: 0.4 },
  laag: { name: 'Laag', range: '30–60 cm', h: 0.45, d: 0.5 },
  middel: { name: 'Middelhoog', range: '60–120 cm', h: 0.9, d: 0.7 },
  hoog: { name: 'Hoog', range: '120–200 cm', h: 1.6, d: 0.9 },
  xhoog: { name: 'Extra hoog', range: '> 2 m', h: 2.5, d: 1.2 },
};

export const HABITS = {
  rechtop: { name: 'Rechtop / zuilvormig' },
  bol: { name: 'Bolvormig' },
  kussen: { name: 'Kussen / pollenvormend' },
  spreidend: { name: 'Spreidend / bodembedekkend' },
  overhangend: { name: 'Overhangend / boogvormig' },
  ijl: { name: 'IJl / doorkijkplant' },
};

export const FORMS = {
  aar: { name: 'Aar / kaars' },
  knop: { name: 'Knop / bol' },
  pluim: { name: 'Pluim' },
  scherm: { name: 'Scherm' },
  schijf: { name: 'Schijf / margriet' },
  blad: { name: 'Bladplant (geen opvallende bloei)' },
};

export const ROLES = {
  structuur: { name: 'Structuur', prefix: 'S', weight: 30, note: 'het skelet, ±30%' },
  vulling: { name: 'Vulling', prefix: 'V', weight: 60, note: 'de massa (matrix), ±60%' },
  accent: { name: 'Accent', prefix: 'A', weight: 10, note: 'hier en daar, ±10%' },
};

export const FOLIAGE = {
  groen: { name: 'Groen', color: '#7a9a5a', interest: 0.25 },
  donker: { name: 'Donkergroen', color: '#4a6b3a', interest: 0.3 },
  zilver: { name: 'Zilver / grijs', color: '#b8c4b8', interest: 0.5 },
  geel: { name: 'Geel / goud', color: '#c9c25a', interest: 0.5 },
  rood: { name: 'Rood / purper', color: '#7a3b4a', interest: 0.55 },
  blauw: { name: 'Blauwgroen', color: '#7a9ea0', interest: 0.45 },
};

export const AUTUMN = {
  geen: { name: 'Geen', color: null },
  geel: { name: 'Geel', color: '#e3b23c' },
  oranje: { name: 'Oranje', color: '#d9772b' },
  rood: { name: 'Rood', color: '#b0392b' },
  brons: { name: 'Brons / koper', color: '#9a6a3a' },
};

export const WINTER = {
  weg: { name: 'Verdwijnt (bovengronds weg)' },
  silhouet: { name: 'Silhouet / zaaddozen blijven staan' },
  groen: { name: 'Wintergroen' },
};

// ------------------------------------------------------------------ kleur

export function hexToHsl(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

export const SCHEMES = {
  vrij: { name: 'Vrij (geen schema)' },
  monochroom: { name: 'Monochroom (één kleur in tinten)' },
  verwant: { name: 'Verwant (buurkleuren)' },
  complementair: { name: 'Complementair (tegenover elkaar)' },
  splitcompl: { name: 'Gesplitst complementair' },
  drieklank: { name: 'Drieklank' },
  warm: { name: 'Warm (rood, oranje, geel)' },
  koel: { name: 'Koel (blauw, paars, roze, wit)' },
  wit: { name: 'Wit en zilver' },
};

/** Kleurenpalet bij een schema en basiskleur. */
export function schemePalette(scheme) {
  const type = scheme?.type || 'vrij';
  const [h, s0] = hexToHsl(scheme?.base || '#8e5bb5');
  const s = Math.max(0.45, s0);
  const tints = (hue, sat = s) => [hslToHex(hue, sat, 0.35), hslToHex(hue, sat, 0.5), hslToHex(hue, sat * 0.85, 0.68), hslToHex(hue, sat * 0.6, 0.82)];
  switch (type) {
    case 'monochroom': return tints(h);
    case 'verwant': return [-40, -20, 0, 20, 40].flatMap((d) => [hslToHex(h + d, s, 0.45), hslToHex(h + d, s * 0.8, 0.68)]);
    case 'complementair': return [...tints(h).slice(0, 3), ...tints(h + 180).slice(0, 3)];
    case 'splitcompl': return [...tints(h).slice(0, 2), ...tints(h + 150).slice(0, 2), ...tints(h + 210).slice(0, 2)];
    case 'drieklank': return [0, 120, 240].flatMap((d) => [hslToHex(h + d, s, 0.45), hslToHex(h + d, s * 0.8, 0.68)]);
    case 'warm': return ['#b0392b', '#d9542b', '#e8822e', '#f0a830', '#f2cd4a', '#f5e08a', '#8a2f3b', '#fff3d6'];
    case 'koel': return ['#2f4e9e', '#4a6fc2', '#7a6fc8', '#8e5bb5', '#b07ac8', '#d7a2d6', '#e7b6c8', '#f4f4f0'];
    case 'wit': return ['#ffffff', '#f6f1e3', '#efe9d0', '#e3e6df', '#c9d1c9', '#aeb8b0'];
    default: return ['#ffffff', '#f2cd4a', '#e8822e', '#c0392b', '#d77fa1', '#8e5bb5', '#4a6fc2', '#8fc1e3', '#6fa84a'];
  }
}

/** Past een kleur binnen het schema? (wit, crème en grijs passen altijd) */
export function inScheme(color, scheme) {
  if (!color || !scheme || scheme.type === 'vrij' || !scheme.type) return true;
  const [h, s, l] = hexToHsl(color);
  if (s < 0.18 || l > 0.9) return true;
  return schemePalette(scheme).some((p) => {
    const [ph, ps, pl] = hexToHsl(p);
    if (ps < 0.18 || pl > 0.9) return false;
    const d = Math.abs(((h - ph + 540) % 360) - 180);
    return d < 22;
  });
}

// ------------------------------------------------------------------ bouwstenen

export function newRole(roles, role = 'vulling') {
  const prefix = ROLES[role].prefix;
  let n = 1;
  while (roles.some((r) => r.code === `${prefix}${n}`)) n++;
  return {
    id: 'r' + Math.random().toString(36).slice(2, 9),
    code: `${prefix}${n}`,
    label: '',
    role,
    height: role === 'structuur' ? 'hoog' : role === 'accent' ? 'middel' : 'laag',
    habit: role === 'structuur' ? 'rechtop' : 'kussen',
    form: role === 'structuur' ? 'aar' : 'schijf',
    color: '#8e5bb5',
    bloom: [6, 7, 8],
    foliage: 'groen',
    autumn: 'geen',
    winter: role === 'structuur' ? 'silhouet' : 'weg',
    light: ['zon'],
  };
}

export function roleDiameter(r) {
  return r.d || HEIGHTS[r.height]?.d || 0.6;
}

export function describeRole(r) {
  const parts = [HEIGHTS[r.height]?.name, HABITS[r.habit]?.name.split(' /')[0].toLowerCase(), FORMS[r.form]?.name.split(' /')[0].toLowerCase()];
  return r.label || parts.filter(Boolean).join(', ');
}

/** Wat is er in maand m (1..12) van deze bouwsteen te zien? */
export function monthState(r, m) {
  if (r.bloom?.includes(m)) return { kind: 'bloei', color: r.color, interest: 1 };
  if (r.autumn && r.autumn !== 'geen' && (m === 10 || m === 11)) return { kind: 'herfst', color: AUTUMN[r.autumn].color, interest: 0.8 };
  const winter = m >= 11 || m <= 3;
  if (!winter) {
    const f = FOLIAGE[r.foliage] || FOLIAGE.groen;
    return { kind: 'blad', color: f.color, interest: f.interest };
  }
  if (r.winter === 'groen') return { kind: 'wintergroen', color: FOLIAGE[r.foliage]?.color || '#4a6b3a', interest: 0.6 };
  if (r.winter === 'silhouet') return { kind: 'silhouet', color: '#b39a6b', interest: m === 11 || m === 3 ? 0.4 : 0.55 };
  return { kind: 'weg', color: null, interest: 0 };
}

// ------------------------------------------------------------------ symbolen

/** Plansymbool van een bouwsteen, midden (x, y), diameter d (meters). month: null = bloeikleur. */
export function drawRoleSymbol(g, r, x, y, d, month, lw, opts = {}) {
  const st = month ? monthState(r, month) : { kind: 'bloei', color: r.color, interest: 1 };
  const R = d / 2;
  g.save();
  g.translate(x, y);
  g.lineWidth = lw * (r.role === 'structuur' ? 1.8 : 1);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const absent = st.kind === 'weg';
  const outline = absent ? 'rgba(90,90,90,0.35)' : '#3d4a3a';
  g.strokeStyle = outline;
  // buitenvorm naar groeivorm
  g.beginPath();
  habitPath(g, r.habit, R);
  if (!absent) {
    g.globalAlpha = opts.alpha ?? 0.55;
    g.fillStyle = st.color;
    g.fill();
    g.globalAlpha = 1;
  }
  if (r.habit === 'ijl' || r.habit === 'spreidend') g.setLineDash([lw * 2.5, lw * 2]);
  g.stroke();
  g.setLineDash([]);
  // binnenteken naar bloeivorm (alleen als er iets staat)
  if (!absent && R > lw * 4) {
    g.strokeStyle = 'rgba(40,50,40,0.75)';
    g.fillStyle = 'rgba(40,50,40,0.75)';
    g.lineWidth = lw * 0.8;
    formGlyph(g, r.form, R * 0.55);
  }
  if (r.role === 'accent' && !absent) {
    g.fillStyle = '#3d4a3a';
    g.beginPath();
    g.arc(R * 0.72, -R * 0.72, Math.max(lw * 1.6, R * 0.12), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function habitPath(g, habit, R) {
  const TAU = Math.PI * 2;
  switch (habit) {
    case 'kussen': {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU, am = (a0 + a1) / 2;
        if (i === 0) g.moveTo(Math.cos(a0) * R * 0.9, Math.sin(a0) * R * 0.9);
        g.quadraticCurveTo(Math.cos(am) * R * 1.08, Math.sin(am) * R * 1.08, Math.cos(a1) * R * 0.9, Math.sin(a1) * R * 0.9);
      }
      g.closePath();
      break;
    }
    case 'rechtop':
      g.arc(0, 0, R * 0.92, 0, TAU);
      g.moveTo(R * 0.55, 0);
      g.arc(0, 0, R * 0.55, 0, TAU);
      break;
    case 'overhangend':
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * TAU;
        const k = i % 2 ? 1 : 0.86;
        const px = Math.cos(a) * R * k, py = Math.sin(a) * R * k;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
      break;
    default:
      g.arc(0, 0, R, 0, TAU);
  }
}

function formGlyph(g, form, r) {
  g.beginPath();
  switch (form) {
    case 'aar':
      g.ellipse(0, 0, r * 0.28, r, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      for (let k = -2; k <= 2; k++) { g.moveTo(-r * 0.22, k * r * 0.35); g.lineTo(r * 0.22, k * r * 0.35); }
      g.stroke();
      break;
    case 'knop':
      for (const [x, y] of [[0, 0], [-r * 0.55, r * 0.35], [r * 0.55, r * 0.35], [0, -r * 0.6]]) {
        g.moveTo(x + r * 0.26, y);
        g.arc(x, y, r * 0.26, 0, Math.PI * 2);
      }
      g.fill();
      break;
    case 'pluim':
      g.moveTo(-r * 0.5, r * 0.8);
      g.quadraticCurveTo(r * 0.1, 0, r * 0.4, -r * 0.9);
      for (let k = 0; k < 5; k++) {
        const t = 0.2 + k * 0.16;
        const px = -r * 0.5 + (r * 0.9) * t, py = r * 0.8 - (r * 1.7) * t;
        g.moveTo(px, py); g.lineTo(px - r * 0.3, py - r * 0.15);
        g.moveTo(px, py); g.lineTo(px + r * 0.15, py - r * 0.3);
      }
      g.stroke();
      break;
    case 'scherm':
      g.moveTo(-r, -r * 0.1);
      g.quadraticCurveTo(0, -r * 0.75, r, -r * 0.1);
      g.moveTo(0, r * 0.8); g.lineTo(0, -r * 0.42);
      for (const x of [-0.7, -0.35, 0.35, 0.7]) { g.moveTo(0, r * 0.2); g.lineTo(x * r, -r * 0.2 - Math.abs(x) * 0.0); }
      g.stroke();
      break;
    case 'schijf':
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      g.fill();
      break;
    case 'blad':
      g.moveTo(0, -r);
      g.quadraticCurveTo(r * 0.8, 0, 0, r);
      g.quadraticCurveTo(-r * 0.8, 0, 0, -r);
      g.moveTo(0, -r * 0.8); g.lineTo(0, r * 0.8);
      g.stroke();
      break;
  }
}

// ------------------------------------------------------------------ plantvakken

function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  s = s || 12345;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * Posities en bouwstenen in een plantvak (driehoeksverband, deterministisch).
 * mix: [{ role: id, w: gewicht }]
 */
export function vakLayout(item, rolesById) {
  const mix = (item.planting?.mix || []).filter((m) => rolesById[m.role] && m.w > 0);
  if (!mix.length) return [];
  const total = mix.reduce((s, m) => s + m.w, 0);
  // plantafstand: gewogen gemiddelde diameter
  const avgD = mix.reduce((s, m) => s + roleDiameter(rolesById[m.role]) * m.w, 0) / total;
  const step = Math.max(0.15, avgD * 0.85);
  const b = bbox(item.points);
  const rnd = rng(item.id);
  const out = [];
  const rowH = step * Math.sqrt(3) / 2;
  let row = 0;
  for (let y = b.minY + rowH / 2; y < b.maxY; y += rowH, row++) {
    for (let x = b.minX + (row % 2 ? step / 2 : 0) + step / 2; x < b.maxX; x += step) {
      const jx = x + (rnd() - 0.5) * step * 0.25, jy = y + (rnd() - 0.5) * step * 0.25;
      if (!pointInPolygon([jx, jy], item.points)) continue;
      let t = rnd() * total, pick = mix[0];
      for (const m of mix) { t -= m.w; if (t <= 0) { pick = m; break; } }
      out.push({ x: jx, y: jy, role: rolesById[pick.role] });
      if (out.length > 3000) return out;
    }
  }
  return out;
}

export function rolesMap(doc) {
  const map = {};
  for (const r of doc.planting?.roles || []) map[r.id] = r;
  return map;
}

/** Oppervlak per bouwsteen (m²) in de hele tekening. */
export function roleAreas(doc) {
  const roles = rolesMap(doc);
  const areas = {};
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const it of layer.items) {
      if (it.type === 'plant' && roles[it.role]) {
        areas[it.role] = (areas[it.role] || 0) + Math.PI * (it.d / 2) ** 2;
      } else if (it.type === 'shape' && it.planting?.mix?.length) {
        const A = polygonArea(it.points);
        const mix = it.planting.mix.filter((m) => roles[m.role]);
        const tot = mix.reduce((s, m) => s + m.w, 0) || 1;
        for (const m of mix) areas[m.role] = (areas[m.role] || 0) + (A * m.w) / tot;
      }
    }
  }
  return areas;
}

/**
 * Jaarrond: per maand het aandeel "interessant" (0..1) en de kleuren die dan te zien zijn.
 */
export function yearRound(doc) {
  const roles = rolesMap(doc);
  const areas = roleAreas(doc);
  const total = Object.values(areas).reduce((s, v) => s + v, 0);
  const months = [];
  for (let m = 1; m <= 12; m++) {
    let score = 0;
    const colors = {};
    for (const [id, A] of Object.entries(areas)) {
      const st = monthState(roles[id], m);
      score += A * st.interest;
      if (st.color) colors[st.color] = (colors[st.color] || 0) + A * st.interest;
    }
    months.push({ m, score: total ? score / total : 0, colors });
  }
  return { months, total, areas };
}

export function plantOutline(it) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push([it.x + Math.cos(a) * it.d / 2, it.y + Math.sin(a) * it.d / 2]);
  }
  return pts;
}

export function hitPlant(it, p, tol) {
  return dist(p, [it.x, it.y]) <= it.d / 2 + tol;
}
