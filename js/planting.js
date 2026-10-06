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

// ------------------------------------------------------------------ plantvakken en groepen
//
// Plantvak: gesloten vorm (veelhoek of cirkel) met bed: true en een basis-mix (de matrix).
// Groep: vorm met group: true en bedId, binnen het plantvak (wordt erop afgeknipt), met een eigen mix.
// Solitair: los geplaatste bouwsteen (type 'plant') of een plantstencil met een gekoppelde bouwsteen.

function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  s = s || 12345;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function isBed(it) {
  return it.type === 'shape' && !it.group && (it.bed || !!it.planting) && (it.kind === 'polygon' || it.kind === 'circle');
}

export function isGroup(it) {
  return it.type === 'shape' && !!it.group;
}

/** Omtrek van een vlak als veelhoek (cirkel wordt een 64-hoek). */
export function shapePolygon(it) {
  if (it.kind === 'circle') {
    const [c, e] = it.points;
    const r = dist(c, e);
    return Array.from({ length: 64 }, (_, i) => [c[0] + Math.cos((i / 64) * Math.PI * 2) * r, c[1] + Math.sin((i / 64) * Math.PI * 2) * r]);
  }
  return it.points;
}

/** Gesloten veelhoek vloeiend afronden (Chaikin), voor vrij getekende vakken en groepen. */
export function smoothClosed(points, passes = 2) {
  let pts = points;
  for (let k = 0; k < passes; k++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

export function roleSpacing(r) {
  return Math.max(0.15, roleDiameter(r) * 0.85);
}

function cleanMix(mix, roles) {
  return (mix || []).filter((m) => roles[m.role] && m.w > 0);
}

/**
 * Plantposities in een veelhoek (driehoeksverband, deterministisch), met de mix verdeeld.
 * exclude: veelhoeken waarin geen punten komen (groepen binnen een plantvak).
 */
export function layoutPoints(poly, mix, roles, seed, exclude = []) {
  mix = cleanMix(mix, roles);
  if (!mix.length || poly.length < 3) return [];
  const total = mix.reduce((s, m) => s + m.w, 0);
  const step = mix.reduce((s, m) => s + roleSpacing(roles[m.role]) * m.w, 0) / total;
  const b = bbox(poly);
  const rnd = rng(seed);
  const out = [];
  const rowH = step * Math.sqrt(3) / 2;
  let row = 0;
  for (let y = b.minY + rowH / 2; y < b.maxY; y += rowH, row++) {
    for (let x = b.minX + (row % 2 ? step / 2 : 0) + step / 2; x < b.maxX; x += step) {
      const jx = x + (rnd() - 0.5) * step * 0.25, jy = y + (rnd() - 0.5) * step * 0.25;
      const t0 = rnd();
      if (!pointInPolygon([jx, jy], poly)) continue;
      if (exclude.some((e) => pointInPolygon([jx, jy], e))) continue;
      let t = t0 * total, pick = mix[0];
      for (const m of mix) { t -= m.w; if (t <= 0) { pick = m; break; } }
      out.push({ x: jx, y: jy, role: roles[pick.role] });
      if (out.length > 4000) return out;
    }
  }
  return out;
}

/** Oude naam (V2.1): posities in een vak zonder groepen. */
export function vakLayout(item, rolesById) {
  return layoutPoints(shapePolygon(item), item.planting?.mix, rolesById, item.id);
}

export function rolesMap(doc) {
  const map = {};
  for (const r of doc.planting?.roles || []) map[r.id] = r;
  return map;
}

/** Alle plantvakken met hun groepen en (door bemonstering) de oppervlakken. */
export function bedStats(doc) {
  const beds = [], groups = [];
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const it of layer.items) {
      if (isBed(it)) beds.push(it);
      else if (isGroup(it)) groups.push(it);
    }
  }
  return beds.map((bed) => {
    const poly = shapePolygon(bed);
    const gs = groups.filter((g) => g.bedId === bed.id).map((g) => ({ group: g, poly: shapePolygon(g), area: 0 }));
    const A = polygonArea(poly);
    let baseArea = A;
    if (gs.length) {
      const b = bbox(poly);
      const step = Math.max(0.05, Math.sqrt(A) / 60);
      let base = 0;
      for (let y = b.minY + step / 2; y < b.maxY; y += step) {
        for (let x = b.minX + step / 2; x < b.maxX; x += step) {
          if (!pointInPolygon([x, y], poly)) continue;
          let hit = null;
          for (let k = gs.length - 1; k >= 0; k--) if (pointInPolygon([x, y], gs[k].poly)) { hit = gs[k]; break; }
          if (hit) hit.area += step * step; else base += step * step;
        }
      }
      baseArea = base;
    }
    return { bed, poly, area: A, baseArea, groups: gs };
  });
}

/** Aantal planten in een oppervlak bij een mix (driehoeksverband). */
export function plantCount(area, mix, roles) {
  mix = cleanMix(mix, roles);
  const tot = mix.reduce((s, m) => s + m.w, 0);
  if (!tot || !area) return 0;
  let n = 0;
  for (const m of mix) {
    const sp = roleSpacing(roles[m.role]);
    n += (area * m.w / tot) / (0.866 * sp * sp);
  }
  return Math.round(n);
}

/** Oppervlak per bouwsteen (m²); optioneel alleen voor één plantvak. */
export function roleAreas(doc, bedId = null) {
  const roles = rolesMap(doc);
  const areas = {};
  const add = (id, a) => { if (roles[id] && a > 0) areas[id] = (areas[id] || 0) + a; };
  const addMix = (mix, A) => {
    const m = cleanMix(mix, roles);
    const tot = m.reduce((s, x) => s + x.w, 0);
    for (const x of m) add(x.role, (A * x.w) / tot);
  };
  for (const st of bedStats(doc)) {
    if (bedId && st.bed.id !== bedId) continue;
    addMix(st.bed.planting?.mix, st.baseArea);
    for (const g of st.groups) addMix(g.group.planting?.mix, g.area);
  }
  if (!bedId) {
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      for (const it of layer.items) {
        if (it.type === 'plant') add(it.role, Math.PI * (it.d / 2) ** 2);
        else if (it.type === 'stencil' && it.role) add(it.role, Math.PI * (it.w / 2) * (it.h / 2));
      }
    }
  }
  return areas;
}

/** Geschat aantal planten per bouwsteen; optioneel alleen voor één plantvak. */
export function plantCounts(doc, bedId = null) {
  const roles = rolesMap(doc);
  const counts = {};
  const addMix = (mix, A) => {
    const m = cleanMix(mix, roles);
    const tot = m.reduce((s, x) => s + x.w, 0);
    for (const x of m) {
      const sp = roleSpacing(roles[x.role]);
      counts[x.role] = (counts[x.role] || 0) + (A * x.w / tot) / (0.866 * sp * sp);
    }
  };
  for (const st of bedStats(doc)) {
    if (bedId && st.bed.id !== bedId) continue;
    addMix(st.bed.planting?.mix, st.baseArea);
    for (const g of st.groups) addMix(g.group.planting?.mix, g.area);
  }
  if (!bedId) {
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      for (const it of layer.items) {
        if ((it.type === 'plant' || it.type === 'stencil') && roles[it.role]) counts[it.role] = (counts[it.role] || 0) + 1;
      }
    }
  }
  for (const k of Object.keys(counts)) counts[k] = Math.round(counts[k]);
  return counts;
}

/**
 * Jaarrond: per maand het aandeel "interessant" (0..1) en de kleuren die dan te zien zijn.
 */
export function yearRound(doc, bedId = null) {
  const roles = rolesMap(doc);
  const areas = roleAreas(doc, bedId);
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

// ------------------------------------------------------------------ groepen voorstellen

function principalAngle(poly) {
  let cx = 0, cy = 0;
  for (const p of poly) { cx += p[0]; cy += p[1]; }
  cx /= poly.length; cy /= poly.length;
  let xx = 0, yy = 0, xy = 0;
  for (const p of poly) { const dx = p[0] - cx, dy = p[1] - cy; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
  return 0.5 * Math.atan2(2 * xy, xx - yy);
}

/**
 * Stel groepen ("drifts") voor in een plantvak: structuurplanten ±30% en accenten ±10% in
 * langgerekte vlekken langs de lengterichting van het vak; vullers vormen de basis.
 * roleIds: welke bouwstenen meedoen (leeg = alle).
 */
export function suggestDrifts(bed, allRoles, roleIds, seed) {
  const poly = shapePolygon(bed);
  const A = polygonArea(poly);
  // bomen (extra hoog) zijn solitairen, geen groepen in een border
  const roles = (roleIds?.length ? allRoles.filter((r) => roleIds.includes(r.id)) : allRoles).filter((r) => r.height !== 'xhoog');
  const rnd = rng(`${bed.id}-${seed}`);
  const struct = roles.filter((r) => r.role === 'structuur');
  const accent = roles.filter((r) => r.role === 'accent');
  const fill = roles.filter((r) => r.role === 'vulling');
  const theta = principalAngle(poly);
  const b = bbox(poly);
  const placed = [];
  const groups = [];
  const want = [
    ...struct.map((r) => ({ r, area: (A * 0.3) / struct.length })),
    ...accent.map((r) => ({ r, area: (A * 0.1) / accent.length })),
  ];
  for (const { r, area } of want) {
    const plantA = Math.PI * (roleDiameter(r) / 2) ** 2;
    const n = Math.max(1, Math.min(6, Math.round(area / (plantA * (r.role === 'accent' ? 3 : 6)))));
    const each = area / n;
    for (let k = 0; k < n; k++) {
      const ratio = r.role === 'accent' ? 1.4 : 2.4;
      const ry = Math.sqrt(each / (Math.PI * ratio)), rx = ry * ratio;
      let best = null;
      for (let tries = 0; tries < 80 && !best; tries++) {
        const c = [b.minX + rnd() * (b.maxX - b.minX), b.minY + rnd() * (b.maxY - b.minY)];
        if (!pointInPolygon(c, poly)) continue;
        if (placed.some((q) => dist(q.c, c) < (q.rx + rx) * 0.75)) continue;
        best = c;
      }
      if (!best) continue;
      const ang = theta + (rnd() - 0.5) * 0.6;
      const pts = [];
      const m = 10;
      for (let i = 0; i < m; i++) {
        const a = (i / m) * Math.PI * 2;
        const kk = 0.82 + rnd() * 0.36;
        const lx = Math.cos(a) * rx * kk, ly = Math.sin(a) * ry * kk;
        pts.push([best[0] + lx * Math.cos(ang) - ly * Math.sin(ang), best[1] + lx * Math.sin(ang) + ly * Math.cos(ang)]);
      }
      placed.push({ c: best, rx });
      groups.push({ points: smoothClosed(pts, 2).map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]), mix: [{ role: r.id, w: 100 }] });
    }
  }
  const baseMix = fill.length ? fill.map((r) => ({ role: r.id, w: ROLES.vulling.weight })) : (bed.planting?.mix || []);
  return { groups, baseMix };
}

// ------------------------------------------------------------------ plantstencils

/** Eigenschappen van een bouwsteen voor een plantstencil (null = geen plant). */
const STENCIL_ROLE = {
  loofboom: { role: 'structuur', height: 'xhoog', habit: 'bol', form: 'blad', bloom: [], foliage: 'groen', autumn: 'geel', winter: 'silhouet', color: '#7a9a5a' },
  solitair: { role: 'structuur', height: 'xhoog', habit: 'bol', form: 'blad', bloom: [], foliage: 'groen', autumn: 'oranje', winter: 'silhouet', color: '#6f8f4a' },
  naaldboom: { role: 'structuur', height: 'xhoog', habit: 'rechtop', form: 'blad', bloom: [], foliage: 'donker', autumn: 'geen', winter: 'groen', color: '#4a6b3a' },
  fruitboom: { role: 'structuur', height: 'xhoog', habit: 'bol', form: 'knop', bloom: [4], foliage: 'groen', autumn: 'geel', winter: 'silhouet', color: '#f6f1e3' },
  meerstammig: { role: 'structuur', height: 'xhoog', habit: 'ijl', form: 'blad', bloom: [], foliage: 'groen', autumn: 'rood', winter: 'silhouet', color: '#7a9a5a' },
  bestaandeboom: { role: 'structuur', height: 'xhoog', habit: 'bol', form: 'blad', bloom: [], foliage: 'groen', autumn: 'geel', winter: 'silhouet', color: '#7a9a5a' },
  heester: { role: 'structuur', height: 'hoog', habit: 'bol', form: 'blad', bloom: [], foliage: 'groen', autumn: 'geel', winter: 'silhouet', color: '#7a9a5a' },
  bloeiend: { role: 'structuur', height: 'hoog', habit: 'bol', form: 'knop', bloom: [5, 6], foliage: 'groen', autumn: 'geen', winter: 'silhouet', color: '#d77fa1' },
  haag: { role: 'structuur', height: 'hoog', habit: 'rechtop', form: 'blad', bloom: [], foliage: 'donker', autumn: 'geen', winter: 'groen', color: '#4a6b3a' },
  siergras: { role: 'structuur', height: 'middel', habit: 'overhangend', form: 'pluim', bloom: [8, 9, 10], foliage: 'groen', autumn: 'brons', winter: 'silhouet', color: '#d9c58a' },
  vasteplant: { role: 'vulling', height: 'laag', habit: 'kussen', form: 'schijf', bloom: [6, 7], foliage: 'groen', autumn: 'geen', winter: 'weg', color: '#8e5bb5' },
  bodembedekker: { role: 'vulling', height: 'bodem', habit: 'spreidend', form: 'blad', bloom: [], foliage: 'groen', autumn: 'geen', winter: 'groen', color: '#6b9c5a' },
};

export function isPlantStencil(symbol) {
  return !!STENCIL_ROLE[symbol];
}

/** Zoek of maak de bouwsteen bij een plantstencil (muteert roles). */
export function ensureStencilRole(roles, symbol, name) {
  const tpl = STENCIL_ROLE[symbol];
  if (!tpl) return null;
  const found = roles.find((r) => r.fromStencil === symbol);
  if (found) return found;
  const r = newRole(roles, tpl.role);
  Object.assign(r, tpl, { fromStencil: symbol, label: name, light: ['zon', 'halfschaduw'] });
  roles.push(r);
  return r;
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
