// Verbanden (legpatronen) als bouwsteen: het patroon wordt berekend uit de steenmaat, de voeg,
// de kleur en de afwerking. Ook de losse stenen (stencils) gebruiken dezelfde steentekening.

/** Standaardmaten (meters), o.a. naar het gangbare handelsassortiment. */
export const STONE_SIZES = [
  { id: 'waal', name: 'Waalformaat 20×5', l: 0.2, w: 0.05, group: 'Klinkers' },
  { id: 'dik', name: 'Dikformaat 20×6,7', l: 0.2, w: 0.067, group: 'Klinkers' },
  { id: 'kei', name: 'Keiformaat 20×10', l: 0.2, w: 0.1, group: 'Klinkers' },
  { id: 'bkk', name: 'Betonklinker 21×10,5', l: 0.21, w: 0.105, group: 'Klinkers' },
  { id: 'halve', name: 'Halve steen 10,5×10,5', l: 0.105, w: 0.105, group: 'Klinkers' },
  { id: 't20', name: 'Tegel 20×20', l: 0.2, w: 0.2, group: 'Tegels' },
  { id: 't30', name: 'Tegel 30×30', l: 0.3, w: 0.3, group: 'Tegels' },
  { id: 't40', name: 'Tegel 40×40', l: 0.4, w: 0.4, group: 'Tegels' },
  { id: 't50', name: 'Tegel 50×50', l: 0.5, w: 0.5, group: 'Tegels' },
  { id: 't60', name: 'Tegel 60×60', l: 0.6, w: 0.6, group: 'Tegels' },
  { id: 't80', name: 'Tegel 80×80', l: 0.8, w: 0.8, group: 'Tegels' },
  { id: 't90', name: 'Tegel 90×90', l: 0.9, w: 0.9, group: 'Tegels' },
  { id: 't100', name: 'Tegel 100×100', l: 1.0, w: 1.0, group: 'Tegels' },
  { id: 't3015', name: 'Tegel 30×15', l: 0.3, w: 0.15, group: 'Tegels' },
  { id: 't3020', name: 'Tegel 30×20', l: 0.3, w: 0.2, group: 'Tegels' },
  { id: 't6030', name: 'Tegel 60×30', l: 0.6, w: 0.3, group: 'Tegels' },
  { id: 't6040', name: 'Tegel 60×40', l: 0.6, w: 0.4, group: 'Tegels' },
  { id: 't8040', name: 'Tegel 80×40', l: 0.8, w: 0.4, group: 'Tegels' },
  { id: 't9060', name: 'Tegel 90×60', l: 0.9, w: 0.6, group: 'Tegels' },
  { id: 't12060', name: 'Tegel 120×60', l: 1.2, w: 0.6, group: 'Tegels' },
  { id: 'p6015', name: 'Strook 60×15', l: 0.6, w: 0.15, group: 'Stroken en planken' },
  { id: 'p12020', name: 'Plank 120×20 (houtlook)', l: 1.2, w: 0.2, group: 'Stroken en planken' },
  { id: 'p12030', name: 'Plank 120×30 (houtlook)', l: 1.2, w: 0.3, group: 'Stroken en planken' },
  { id: 'k10', name: 'Kassei 10×10', l: 0.1, w: 0.1, group: 'Kasseien en koppen' },
  { id: 'k14', name: 'Kassei 14×14', l: 0.14, w: 0.14, group: 'Kasseien en koppen' },
  { id: 'k1420', name: 'Kassei 14×20', l: 0.2, w: 0.14, group: 'Kasseien en koppen' },
  { id: 'b6', name: 'Opsluitband 100×6', l: 1.0, w: 0.06, group: 'Banden' },
  { id: 'b10', name: 'Opsluitband 100×10', l: 1.0, w: 0.1, group: 'Banden' },
];

export const FINISHES = {
  glad: { name: 'Glad / strak' },
  getrommeld: { name: 'Getrommeld' },
  structuur: { name: 'Structuur (korrel)' },
  gemeleerd: { name: 'Gemêleerd / bont' },
};

/** Gangbare steenkleuren. */
export const STONE_COLORS = {
  rood: '#a8503c', roodbruin: '#8f4a38', paars: '#6f4a4a', geel: '#c9a76a', oranje: '#c27a4a',
  antraciet: '#4a4d52', grijs: '#9a9a96', beige: '#c9bca4', zwart: '#2f3033', taupe: '#8c8072',
};

/**
 * Legpatronen op een raster met eenheid = steenbreedte (incl. voeg); n = lengte / breedte.
 * ratio: het patroon klopt alleen bij een hele verhouding (n wordt dan afgerond).
 * stones(n) → { px, py, list: [[x, y, w, h], ...] } voor één herhaling.
 */
export const BOND_TYPES = {
  halfsteens: { name: 'Halfsteens verband', stones: (n) => ({ px: n, py: 2, list: [[0, 0, n, 1], [n / 2, 1, n, 1]] }) },
  kwartsteens: { name: 'Kwartsteens (wildverband)', stones: (n) => ({ px: n, py: 4, list: [[0, 0, n, 1], [n / 4, 1, n, 1], [n / 2, 2, n, 1], [(3 * n) / 4, 3, n, 1]] }) },
  derdesteens: { name: 'Derdesteens verband', stones: (n) => ({ px: n, py: 3, list: [[0, 0, n, 1], [n / 3, 1, n, 1], [(2 * n) / 3, 2, n, 1]] }) },
  stapel: { name: 'Stapelverband (blokverband)', stones: (n) => ({ px: n, py: 1, list: [[0, 0, n, 1]] }) },
  visgraat: {
    name: 'Visgraat / elleboogverband (90°)', ratio: true,
    stones: (n) => {
      const list = [];
      for (let i = 0; i < 2 * n; i++) for (let j = 0; j < 2; j++) { const x = i + j * n, y = i - j * n; list.push([x, y, n, 1], [x, y + 1, 1, n]); }
      return { px: 2 * n, py: 2 * n, list };
    },
  },
  keper: {
    name: 'Keperverband (visgraat 45°)', ratio: true, rot: Math.PI / 4,
    stones: (n) => BOND_TYPES.visgraat.stones(n),
  },
  dubbelvisgraat: {
    name: 'Dubbele visgraat', ratio: true,
    stones: (n) => {
      const list = [];
      for (let i = 0; i < 2 * n; i++) for (let j = 0; j < 4; j++) {
        const x = 2 * i + j * n, y = 2 * i - j * n;
        list.push([x, y, n, 1], [x, y + 1, n, 1], [x, y + 2, 1, n], [x + 1, y + 2, 1, n]);
      }
      return { px: 4 * n, py: 4 * n, list };
    },
  },
  mand: {
    name: 'Mandverband (blokken om en om)', ratio: true,
    stones: (n) => {
      const list = [];
      for (let k = 0; k < n; k++) list.push([0, k, n, 1], [n + k, 0, 1, n], [k, n, 1, n], [n, n + k, n, 1]);
      return { px: 2 * n, py: 2 * n, list };
    },
  },
  molenwiek: {
    name: 'Molenwiekverband (met middensteen)', ratio: true, minN: 2,
    stones: (n) => ({ px: n + 1, py: n + 1, list: [[0, 0, n, 1], [n, 0, 1, n], [1, n, n, 1], [0, 1, 1, n], [1, 1, n - 1, n - 1]] }),
  },
  vlecht: {
    name: 'Vlechtverband (Hollands patroon)', ratio: true, minN: 2,
    stones: (n) => {
      const list = [];
      for (const [ox, oy] of [[0, 0], [(n + 1) / 2, n]]) {
        for (let k = 0; k < n; k++) list.push([ox, oy + k, n, 1]);
        list.push([ox + n, oy, 1, n]);
      }
      return { px: n + 1, py: 2 * n, list };
    },
  },
  banen: {
    name: 'Banenverband (halfsteens met staande rij)', ratio: true, minN: 2,
    stones: (n) => {
      const list = [[0, 0, n, 1], [n / 2, 1, n, 1], [0, 2, n, 1]];
      for (let k = 0; k < n; k++) list.push([k, 3, 1, n]);
      return { px: n, py: 3 + n, list };
    },
  },
  // --- tegels
  diagonaal: { name: 'Diagonaal (45°)', rot: Math.PI / 4, stones: (n) => ({ px: n, py: 1, list: [[0, 0, n, 1]] }) },
  dambord: {
    name: 'Dambord (twee kleuren)', two: true,
    stones: (n) => ({ px: 2 * n, py: 2, list: [[0, 0, n, 1, 0], [n, 0, n, 1, 1], [0, 1, n, 1, 1], [n, 1, n, 1, 0]] }),
  },
  wild3: {
    name: 'Wildverband, 3 maten (bijv. 30×30, 60×30, 60×60)', fixedN: 2,
    // modulair: eenheid = kleinste tegel; 6 × 4 eenheden per herhaling
    stones: () => ({
      px: 6, py: 4,
      list: [[0, 0, 2, 2], [2, 0, 2, 1], [4, 0, 1, 1], [5, 0, 1, 2], [2, 1, 1, 1], [3, 1, 2, 2], [0, 2, 1, 2], [1, 2, 2, 1], [5, 2, 1, 1], [1, 3, 1, 1], [2, 3, 2, 1], [4, 3, 2, 1]],
    }),
  },
  romaans: {
    name: 'Romaans verband (4 maten)', fixedN: 3,
    // eenheid = 1/3 van de grootste tegel (bijv. 20 cm bij 60×60)
    stones: () => ({ px: 6, py: 6, list: [[0, 0, 3, 3], [3, 0, 3, 2], [3, 2, 1, 1], [4, 2, 2, 1], [0, 3, 2, 2], [0, 5, 2, 1], [2, 3, 2, 3], [4, 3, 2, 1], [4, 4, 2, 2]] }),
  },
  hopscotch: {
    name: 'Hopscotch (grote en kleine tegel)', fixedN: 2, two: true,
    // grote tegel (2×2) met een kleine (1×1) ernaast, roosterstappen (2,1) en (-1,2): herhaling 5 × 5
    stones: () => {
      const list = [];
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const x = (((2 * i - j) % 5) + 5) % 5, y = (((i + 2 * j) % 5) + 5) % 5;
        if (list.some((q) => q[0] === x && q[1] === y)) continue;
        list.push([x, y, 2, 2, 0], [x + 2, y, 1, 1, 1]);
      }
      return { px: 5, py: 5, list };
    },
  },
  // --- combinaties van tegels (of kasseien) met klinkers
  tegelband: {
    name: 'Tegels met een klinkerband', two: true, tile: true,
    // eenheid = klinkerbreedte; tegel van 'tile' m met rondom een band van klinkers en een halve steen op de kruising
    stones: (n, b, U) => {
      const S = Math.max(2, Math.round(((b.tile || 0.6) + (b.joint ?? 0.003)) / U));
      const P = S + 1, list = [[0, 0, 1, 1, 0], [1, 1, S, S, 1]];
      for (const horiz of [true, false]) {
        for (let x = 1; x < P; x += n) {
          const len = Math.min(n, P - x);
          list.push(horiz ? [x, 0, len, 1, 0] : [0, x, 1, len, 0]);
        }
      }
      return { px: P, py: P, list };
    },
  },
  kasseivak: {
    name: 'Kasseivakken met een klinkerkruis', two: true, tile: true,
    stones: (n, b, U) => {
      const S = Math.max(2, Math.round(((b.tile || 0.6) + (b.joint ?? 0.003)) / U));
      const P = S + 1, list = [[0, 0, 1, 1, 0]];
      for (let y = 1; y < P; y++) for (let x = 1; x < P; x++) list.push([x, y, 1, 1, 1]);
      for (const horiz of [true, false]) {
        for (let x = 1; x < P; x += n) {
          const len = Math.min(n, P - x);
          list.push(horiz ? [x, 0, len, 1, 0] : [0, x, 1, len, 0]);
        }
      }
      return { px: P, py: P, list };
    },
  },
};

const B = (name, type, size, color, finish, extra = {}) => {
  const sz = STONE_SIZES.find((s) => s.id === size) || size;
  const col = (c) => STONE_COLORS[c] || c;
  return {
    name, group: extra.group || 'Klinkers',
    bond: { type, l: sz.l, w: sz.w, joint: 0.003, color: col(color), jointColor: '#8a857c', finish, ...(extra.color2 ? { color2: col(extra.color2) } : {}), ...extra.bond },
    ...(extra.border ? { border: extra.border } : {}),
  };
};

/** Kant-en-klare bouwstenen voor klinkers. */
export const BOND_PRESETS = {
  'k-half-waal': B('Halfsteens · waalformaat, getrommeld rood', 'halfsteens', 'waal', 'rood', 'getrommeld'),
  'k-half-dik': B('Halfsteens · dikformaat, roodbruin', 'halfsteens', 'dik', 'roodbruin', 'getrommeld'),
  'k-half-bkk': B('Halfsteens · betonklinker antraciet', 'halfsteens', 'bkk', 'antraciet', 'glad'),
  'k-kwart-waal': B('Kwartsteens (wild) · waalformaat bont', 'kwartsteens', 'waal', 'paars', 'gemeleerd'),
  'k-derde-dik': B('Derdesteens · dikformaat geel', 'derdesteens', 'dik', 'geel', 'getrommeld'),
  'k-stapel-waal': B('Stapelverband · waalformaat antraciet', 'stapel', 'waal', 'antraciet', 'glad'),
  'k-visgraat-kei': B('Visgraat / elleboog · keiformaat rood', 'visgraat', 'kei', 'rood', 'getrommeld'),
  'k-keper-waal': B('Keperverband 45° · waalformaat roodbruin', 'keper', 'waal', 'roodbruin', 'getrommeld'),
  'k-keper-fries': B('Keperverband 45° met rollaag (fries)', 'keper', 'kei', 'rood', 'getrommeld', { border: 'rollaag' }),
  'k-dubbelvisgraat': B('Dubbele visgraat · waalformaat', 'dubbelvisgraat', 'waal', 'oranje', 'gemeleerd'),
  'k-mand-kei': B('Mandverband (2 stenen) · keiformaat', 'mand', 'kei', 'rood', 'getrommeld'),
  'k-mand-dik': B('Mandverband (3 stenen) · dikformaat', 'mand', 'dik', 'roodbruin', 'getrommeld'),
  'k-mand-waal': B('Mandverband (4 stenen) · waalformaat', 'mand', 'waal', 'geel', 'getrommeld'),
  'k-molenwiek': B('Molenwiek · betonklinker met halve steen', 'molenwiek', 'bkk', 'grijs', 'glad'),
  'k-vlecht': B('Vlechtverband · keiformaat', 'vlecht', 'kei', 'paars', 'getrommeld'),
  'k-banen': B('Banenverband · keiformaat met staande rij', 'banen', 'kei', 'rood', 'getrommeld'),
  // tegels
  't-blok-6060': B('Blokverband · 60×60 grijs', 'stapel', 't60', 'grijs', 'glad', { group: 'Tegels', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-blok-9090': B('Blokverband · keramiek 90×90 greige', 'stapel', 't90', '#a8a091', 'structuur', { group: 'Tegels', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-half-6030': B('Halfsteens · 60×30 antraciet', 'halfsteens', 't6030', 'antraciet', 'glad', { group: 'Tegels', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-derde-6030': B('Derdesteens · 60×30 grijs', 'derdesteens', 't6030', 'grijs', 'structuur', { group: 'Tegels', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-derde-12060': B('Derdesteens · keramiek 120×60 beige', 'derdesteens', 't12060', 'beige', 'glad', { group: 'Tegels', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-planken': B('Planken 120×30 houtlook (derdesteens)', 'derdesteens', 'p12030', '#9c7a58', 'structuur', { group: 'Tegels', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-wild3': B('Wildverband 3 maten (30, 60×30, 60)', 'wild3', 't6030', 'beige', 'structuur', { group: 'Tegels', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-romaans': B('Romaans verband (20 t/m 60 cm)', 'romaans', { l: 0.6, w: 0.2 }, '#c4b49a', 'gemeleerd', { group: 'Tegels', bond: { joint: 0.005, jointColor: '#6f6a62' } }),
  't-dambord': B('Dambord · 50×50 grijs en antraciet', 'dambord', 't50', 'grijs', 'glad', { group: 'Tegels', color2: 'antraciet', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-diagonaal': B('Diagonaal · 40×40 zandbeige', 'diagonaal', 't40', 'beige', 'glad', { group: 'Tegels', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  't-hopscotch': B('Hopscotch · 60×60 met 30×30', 'hopscotch', 't6030', 'grijs', 'glad', { group: 'Tegels', color2: 'antraciet', bond: { joint: 0.004, jointColor: '#6f6a62' } }),
  // combinaties
  'c-tegelband': B('Tegels 60×60 met klinkerband', 'tegelband', 'kei', 'rood', 'getrommeld', { group: 'Combinaties', color2: 'grijs', bond: { tile: 0.6, finish2: 'glad' } }),
  'c-tegelband-groot': B('Tegels 80×80 met antraciet band', 'tegelband', 'bkk', 'antraciet', 'glad', { group: 'Combinaties', color2: 'beige', bond: { tile: 0.8 } }),
  'c-tegelrollaag': B('Tegelveld 60×60 met rollaag', 'stapel', 't60', 'beige', 'glad', { group: 'Combinaties', border: 'rollaag', bond: { joint: 0.004 } }),
  'c-grasvoeg': B('Tegels 60×60 met grasvoeg', 'stapel', 't60', 'grijs', 'glad', { group: 'Combinaties', bond: { joint: 0.05, jointColor: '#8fae6a' } }),
  'c-splitvoeg': B('Tegels 60×30 met splitvoeg', 'halfsteens', 't6030', 'antraciet', 'structuur', { group: 'Combinaties', bond: { joint: 0.02, jointColor: '#bdb6a8' } }),
  'c-kasseivak': B('Kasseivakken met klinkerkruis', 'kasseivak', 'kei', 'rood', 'getrommeld', { group: 'Combinaties', color2: 'grijs', bond: { tile: 0.5, finish2: 'getrommeld' } }),
  'c-tuinraster': B('Tuinraster: klinkerpaden met plantvakken', 'tegelband', 'kei', 'rood', 'getrommeld', { group: 'Combinaties', color2: '#6f8f4a', bond: { tile: 1.0, finish2: 'gemeleerd' } }),
};

// ---------------------------------------------------------------- tekenen

function rgb(hex) {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '999999';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Kleur lichter (t > 0) of donkerder (t < 0), met een warme zweem (warm 0..1). */
function shade(hex, t, warm = 0) {
  const c = rgb(hex).map((v) => (t >= 0 ? v + (255 - v) * t : v * (1 + t)));
  c[0] += 28 * warm; c[2] -= 22 * warm;
  return `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`;
}

function hash(a, b) {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Eén steen tekenen (bovenaanzicht) in de gegeven afwerking. Eenheden vrij (pixels of meters);
 * seed bepaalt de tint en de kleine onregelmatigheden.
 */
export function paintStone(g, x, y, w, h, color, finish, seed = 1) {
  const r1 = hash(seed, 1.7), r2 = hash(seed, 5.3), r3 = hash(seed, 9.1);
  const d = Math.min(w, h);
  const amp = { glad: 0.03, getrommeld: 0.075, structuur: 0.05, gemeleerd: 0.14 }[finish] ?? 0.03;
  const tone = (r1 - 0.5) * 2 * amp;
  const warm = finish === 'gemeleerd' ? (r2 - 0.5) * 1.2 : finish === 'getrommeld' ? (r2 - 0.5) * 0.4 : 0;
  g.save();
  g.beginPath();
  if (finish === 'getrommeld' || finish === 'gemeleerd') {
    // afgeronde hoeken en een iets onregelmatige rand
    const k = d * 0.05;
    const x0 = x + r1 * k, y0 = y + r2 * k, w0 = w - (r1 + r3) * k, h0 = h - (r2 + r3) * k;
    if (g.roundRect) g.roundRect(x0, y0, w0, h0, d * (finish === 'getrommeld' ? 0.16 : 0.08)); else g.rect(x0, y0, w0, h0);
  } else {
    g.rect(x, y, w, h);
  }
  g.fillStyle = shade(color, tone, warm);
  g.fill();
  if (finish === 'structuur' || finish === 'gemeleerd') {
    g.clip();
    if (finish === 'gemeleerd') {
      // twee tinten die in elkaar overlopen
      const gr = g.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, shade(color, tone + 0.12, warm + 0.3));
      gr.addColorStop(1, shade(color, tone - 0.14, warm - 0.2));
      g.globalAlpha *= 0.55; g.fillStyle = gr; g.fillRect(x, y, w, h);
    } else {
      // fijne korrel
      const nDots = Math.min(60, Math.round((w * h) / (d * d) * 14));
      for (let i = 0; i < nDots; i++) {
        const px = x + hash(seed + i, 2.1) * w, py = y + hash(seed + i, 7.7) * h;
        g.fillStyle = hash(seed + i, 3.3) < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)';
        g.fillRect(px, py, d * 0.035, d * 0.035);
      }
    }
  }
  g.restore();
}

const cache = new Map();

/** Maten van het patroon voor een verband: eenheid U (m), n, periode en stenen. */
export function bondLayout(bond) {
  const T = BOND_TYPES[bond.type] || BOND_TYPES.halfsteens;
  const j = Math.max(0, bond.joint ?? 0.003);
  const l = Math.max(0.02, Math.max(bond.l, bond.w)), w = Math.max(0.02, Math.min(bond.l, bond.w));
  const U = w + j;
  let n = (l + j) / U;
  if (T.ratio || T.tile) n = Math.max(T.minN || 1, Math.round(n));
  if (T.fixedN) n = T.fixedN;
  const st = T.stones(n, bond, U);
  return { T, U, n, j, ...st };
}

/** Canvaspatroon voor een verband, in wereldcoördinaten (meters), met legrichting en beginpunt. */
export function bondPattern(ctx, bond, rot = 0, origin = null) {
  const key = JSON.stringify([bond.type, bond.l, bond.w, bond.joint, bond.color, bond.jointColor, bond.finish, bond.color2, bond.finish2, bond.tile]);
  let tile = cache.get(key);
  const L = bondLayout(bond);
  if (!tile) {
    const W = L.px * L.U, H = L.py * L.U;
    const ppm = Math.min(1024 / Math.max(W, H), Math.max(180, 16 / L.U));
    const c = document.createElement('canvas');
    c.width = Math.max(8, Math.round(W * ppm)); c.height = Math.max(8, Math.round(H * ppm));
    const g = c.getContext('2d');
    const sx = c.width / L.px, sy = c.height / L.py; // pixels per rastereenheid
    const jx = (L.j / L.U) * sx, jy = (L.j / L.U) * sy;
    g.fillStyle = bond.jointColor || '#8a857c';
    g.fillRect(0, 0, c.width, c.height);
    const mod = (v, m) => ((v % m) + m) % m;
    for (const [x, y, w, h, ci] of L.list) {
      const bx = mod(x, L.px), by = mod(y, L.py);
      const col = ci ? bond.color2 || '#9a9a96' : bond.color || '#a8503c', fin = ci ? bond.finish2 || bond.finish || 'glad' : bond.finish || 'glad';
      const seed = Math.round(bx * 97 + by * 389 + w * 13 + 1);
      for (const dx of [-L.px, 0, L.px]) {
        for (const dy of [-L.py, 0, L.py]) {
          const X = (bx + dx) * sx, Y = (by + dy) * sy;
          if (X > c.width || Y > c.height || X + w * sx < 0 || Y + h * sy < 0) continue;
          paintStone(g, X + jx / 2, Y + jy / 2, w * sx - jx, h * sy - jy, col, fin, seed);
        }
      }
    }
    tile = c;
    cache.set(key, tile);
    if (cache.size > 80) cache.delete(cache.keys().next().value);
  }
  const pattern = ctx.createPattern(tile, 'repeat');
  const m = new DOMMatrix();
  if (origin) m.translateSelf(origin[0], origin[1]);
  const r = rot + (L.T.rot || 0);
  if (r) m.rotateSelf((r * 180) / Math.PI);
  m.scaleSelf((L.px * L.U) / tile.width, (L.py * L.U) / tile.height);
  pattern.setTransform(m);
  return pattern;
}

/** Korte omschrijving van een verband. */
export function describeBond(bond) {
  const cm = (v) => (Math.round(v * 1000) / 10).toLocaleString('nl-NL');
  return `${BOND_TYPES[bond.type]?.name || 'Verband'} · ${cm(Math.max(bond.l, bond.w))}×${cm(Math.min(bond.l, bond.w))} cm`;
}
