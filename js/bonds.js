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
  { id: 'gb6040', name: 'Grasbetontegel 60×40', l: 0.6, w: 0.4, group: 'Gras- en grindplaten' },
  { id: 'gb5050', name: 'Grasbetontegel 50×50', l: 0.5, w: 0.5, group: 'Gras- en grindplaten' },
  { id: 'gp5050', name: 'Gras- of grindplaat 50×50', l: 0.5, w: 0.5, group: 'Gras- en grindplaten' },
  { id: 'gp12080', name: 'Grindplaat 120×80', l: 1.2, w: 0.8, group: 'Gras- en grindplaten' },
  { id: 'b10', name: 'Opsluitband 100×10', l: 1.0, w: 0.1, group: 'Banden' },
];

export const FINISHES = {
  glad: { name: 'Glad / strak' },
  getrommeld: { name: 'Getrommeld' },
  structuur: { name: 'Structuur (korrel)' },
  gemeleerd: { name: 'Gemêleerd / bont' },
};

/** Vullingen voor open verharding (gaten, roosters en brede voegen). */
export const FILLS = {
  gras: { name: 'Gras', color: '#7fa35a' },
  grind: { name: 'Grind', color: '#d6caae' },
  split: { name: 'Split', color: '#a9a9a4' },
  schors: { name: 'Boomschors', color: '#7a5a3c' },
  aarde: { name: 'Aarde', color: '#6e5440' },
  kalk: { name: 'Kalksteen (verdicht)', color: '#e0cf9f' },
  schelpen: { name: 'Schelpen', color: '#eee6d6' },
};

/** Halfverharding: een doorlopend oppervlak zonder stenen; aantal in m³ bij deze laagdikte (m). */
export const SURFACE_LAYER = { kalk: 0.07, grind: 0.05, split: 0.05, schelpen: 0.05, schors: 0.07, gras: 0, aarde: 0 };

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
  // --- halfverharding (geen stenen: één doorlopend oppervlak)
  halfverharding: {
    name: 'Halfverharding (doorlopend oppervlak)', surface: true, minPpm: 300,
    stones: () => ({ px: 1, py: 1, list: [[0, 0, 1, 1]] }),
    paint: (g, x, y, w, h, o) => {
      if (o.offset) return; // één keer de hele tegel, naadloos herhalend
      paintFill(g, x, y, w, h, o.bond.fill || 'kalk', o.col, 11, o.ppm, [w, h], o.bond.grain);
    },
  },
  // --- natuurlijk en waterdoorlatend
  grasbeton: {
    name: 'Grasbetontegels (open tegels met vulling)', fill: true, minPpm: 420,
    stones: (n) => ({ px: n, py: 1, list: [[0, 0, n, 1]] }),
    paint: (g, x, y, w, h, o) => {
      paintStone(g, x, y, w, h, o.col, o.fin, o.seed);
      // gaten van ca. 10 cm in een raster van ca. 15 cm, gevuld met gras, grind of split
      const m = o.ppm;
      const cols = Math.max(2, Math.round(w / m / 0.15)), rows = Math.max(2, Math.round(h / m / 0.15));
      const cw = w / cols, ch = h / rows, hw = cw * 0.62, hh = ch * 0.62;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const hx = x + i * cw + (cw - hw) / 2, hy = y + j * ch + (ch - hh) / 2;
        g.save();
        g.beginPath();
        if (g.roundRect) g.roundRect(hx, hy, hw, hh, Math.min(hw, hh) * 0.18); else g.rect(hx, hy, hw, hh);
        g.clip();
        paintFill(g, hx, hy, hw, hh, o.bond.fill || 'gras', o.bond.color2, o.seed * 31 + i * 7 + j, m);
        // schaduwrand: het gat ligt iets dieper
        g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = Math.max(1, 0.006 * m);
        g.stroke();
        g.restore();
      }
    },
  },
  rooster: {
    name: 'Gras- of grindplaten (kunststof honingraat)', fill: true, minPpm: 420,
    stones: (n) => ({ px: n, py: 1, list: [[0, 0, n, 1]] }),
    paint: (g, x, y, w, h, o) => {
      const m = o.ppm;
      g.save();
      g.beginPath(); g.rect(x, y, w, h); g.clip();
      paintFill(g, x, y, w, h, o.bond.fill || 'gras', o.bond.color2, o.seed, m);
      // honingraat van ca. 5 cm, de wanden steken net boven de vulling uit
      const r = (o.bond.cell || 0.05) * m / 2;
      const dx = r * Math.sqrt(3), dy = r * 1.5;
      g.beginPath();
      for (let row = -1; row * dy < h + dy; row++) {
        for (let col = -1; col * dx < w + dx; col++) {
          const cx = x + col * dx + (row % 2 ? dx / 2 : 0), cy = y + row * dy;
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + (k * Math.PI) / 3;
            const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
            if (k) g.lineTo(px, py); else g.moveTo(px, py);
          }
          g.closePath();
        }
      }
      g.strokeStyle = o.col; g.globalAlpha = o.bond.fill === 'gras' ? 0.55 : 0.8;
      g.lineWidth = Math.max(1, 0.004 * m);
      g.stroke();
      g.globalAlpha = 1;
      // naad tussen de platen
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = Math.max(1, 0.003 * m);
      g.strokeRect(x, y, w, h);
      g.restore();
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
  'k-bont-waal': B('Halfsteens · waalformaat, bont gemengd (3 tinten)', 'halfsteens', 'waal', 'rood', 'getrommeld', { bond: { mix: { mode: 'willekeurig', colors: [{ color: '#a8503c', share: 50 }, { color: '#8f4a38', share: 30 }, { color: '#6f4a4a', share: 20 }] } } }),
  'k-vlekken-bkk': B('Halfsteens · betonklinker grijs met antraciet vlekken', 'halfsteens', 'bkk', 'grijs', 'glad', { bond: { mix: { mode: 'vlekken', colors: [{ color: '#9a9a96', share: 70 }, { color: '#4a4d52', share: 30 }] } } }),
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
  'c-kasseivak': B('Kasseivakken met klinkerkruis', 'kasseivak', 'kei', 'rood', 'getrommeld', { group: 'Combinaties', color2: 'grijs', bond: { tile: 0.5, finish2: 'getrommeld' } }),
  'c-tuinraster': B('Tuinraster: klinkerpaden met plantvakken', 'tegelband', 'kei', 'rood', 'getrommeld', { group: 'Combinaties', color2: '#6f8f4a', bond: { tile: 1.0, finish2: 'gemeleerd' } }),
  // halfverharding (zoals verdicht kalksteen, grind en schelpen)
  'h-kalk-geel': B('Verdicht kalksteen, geel (fiets- en wandelpad)', 'halfverharding', { l: 1.5, w: 1.5 }, '#e3d3a6', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'kalk' } }),
  'h-kalk-grijsgeel': B('Verdicht kalksteen, grijsgeel', 'halfverharding', { l: 1.5, w: 1.5 }, '#c2b394', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'kalk' } }),
  'h-kalk-antraciet': B('Verdicht kalksteen, antraciet', 'halfverharding', { l: 1.5, w: 1.5 }, '#8d8f8c', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'kalk' } }),
  'h-kalk-rood': B('Verdicht kalksteen, rood', 'halfverharding', { l: 1.5, w: 1.5 }, '#94574a', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'kalk' } }),
  'h-kalk-grof': B('Verdicht kalksteen, grove korrel (oprit, parkeren)', 'halfverharding', { l: 1.5, w: 1.5 }, '#d8c79a', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'kalk', grain: 'grof' } }),
  'h-grind': B('Grind (los), beige', 'halfverharding', { l: 1.5, w: 1.5 }, '#d6caae', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'grind' } }),
  'h-split': B('Split, grijs', 'halfverharding', { l: 1.5, w: 1.5 }, '#a9a9a4', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'split' } }),
  'h-schelpen': B('Schelpenpad', 'halfverharding', { l: 1.5, w: 1.5 }, '#eee6d6', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'schelpen' } }),
  'h-schors': B('Boomschors / houtsnippers', 'halfverharding', { l: 1.5, w: 1.5 }, '#7a5a3c', 'glad', { group: 'Halfverharding', bond: { joint: 0, fill: 'schors' } }),
  // natuurlijk en waterdoorlatend
  'n-grasbeton': B('Grasbetontegels 60×40 met gras', 'grasbeton', 'gb6040', '#a3a19b', 'structuur', { group: 'Natuurlijk', color2: '#7fa35a', bond: { joint: 0.003, fill: 'gras' } }),
  'n-grasbeton-grind': B('Grasbetontegels 60×40 met grind', 'grasbeton', 'gb6040', '#a3a19b', 'structuur', { group: 'Natuurlijk', color2: '#d6caae', bond: { joint: 0.003, fill: 'grind' } }),
  'n-grasplaat': B('Grasplaten (kunststof honingraat) met gras', 'rooster', 'gp5050', '#3f4a3a', 'glad', { group: 'Natuurlijk', color2: '#7fa35a', bond: { joint: 0, fill: 'gras' } }),
  'n-grindplaat': B('Grindplaten (honingraat) met grind', 'rooster', 'gp12080', '#f2f0ea', 'glad', { group: 'Natuurlijk', color2: '#d6caae', bond: { joint: 0, fill: 'grind' } }),
  'n-grindplaat-split': B('Grindplaten met antraciet split', 'rooster', 'gp12080', '#3a3c40', 'glad', { group: 'Natuurlijk', color2: '#6f7075', bond: { joint: 0, fill: 'split' } }),
  'n-grasvoeg-klinker': B('Klinkers met brede grasvoeg (drainvoeg)', 'halfsteens', 'kei', 'rood', 'getrommeld', { group: 'Natuurlijk', bond: { joint: 0.025, jointColor: '#7fa35a', jointFill: 'gras' } }),
  'n-ecoklinker': B('Waterdoorlatende klinkers met splitvoeg', 'halfsteens', 'bkk', 'grijs', 'glad', { group: 'Natuurlijk', bond: { joint: 0.012, jointColor: '#5d5f63', jointFill: 'split' } }),
  'n-grasvoeg': B('Tegels 60×60 met grasvoeg', 'stapel', 't60', 'grijs', 'glad', { group: 'Natuurlijk', bond: { joint: 0.05, jointColor: '#7fa35a', jointFill: 'gras' } }),
  'n-splitvoeg': B('Tegels 60×30 met splitvoeg', 'halfsteens', 't6030', 'antraciet', 'structuur', { group: 'Natuurlijk', bond: { joint: 0.02, jointColor: '#a9a9a4', jointFill: 'split' } }),
  'n-tegels-in-gras': B('Tegels 60×40 in gras (stapstenen)', 'halfsteens', 't6040', 'beige', 'structuur', { group: 'Natuurlijk', bond: { joint: 0.2, jointColor: '#7fa35a', jointFill: 'gras' } }),
  'n-kinderkopjes': B('Kinderkopjes 14×14 grijs, met grindvoeg (ook om te strooien)', 'stapel', 'k14', 'grijs', 'getrommeld', { group: 'Natuurlijk', bond: { joint: 0.02, jointColor: '#d6caae', jointFill: 'grind' } }),
  'n-kinderkopjes-antraciet': B('Kinderkopjes 10×10 antraciet (om te strooien)', 'stapel', 'k10', '#5b5e63', 'getrommeld', { group: 'Natuurlijk', bond: { joint: 0.018, jointColor: '#d6caae', jointFill: 'grind' } }),
  'n-kasseien-grind': B('Kasseien met grindvoeg', 'halfsteens', 'k1420', 'grijs', 'getrommeld', { group: 'Natuurlijk', bond: { joint: 0.03, jointColor: '#d6caae', jointFill: 'grind' } }),

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
 * Vulling tekenen: gras, grind, split, schors of aarde (bovenaanzicht), met ppm pixels per meter.
 * wrap = [W, H]: korrels over de rand van een herhalende tegel ook aan de overkant tekenen.
 */
export function paintFill(g, x, y, w, h, kind, color, seed = 1, ppm = 200, wrap = null, grain = '') {
  const F = FILLS[kind] || FILLS.gras;
  const base = color || F.color;
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  const areaM = (w * h) / (ppm * ppm);
  const R = (i, k) => hash(seed * 0.37 + i * 1.13, k * 7.77 + seed * 0.11);
  const at = (fn, px, py, ext) => {
    fn(px, py);
    if (!wrap) return;
    const [W, H] = wrap;
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
      if (!ox && !oy) continue;
      const qx = px + ox, qy = py + oy;
      if (qx > x - ext && qx < x + w + ext && qy > y - ext && qy < y + h + ext) fn(qx, qy);
    }
  };
  if (kind === 'gras') {
    // korte sprietjes in wisselende tinten
    const n = Math.min(9000, Math.round(areaM * 9000));
    const len = 0.018 * ppm;
    g.lineWidth = Math.max(0.6, 0.0035 * ppm);
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const px = x + R(i, 1) * w, py = y + R(i, 2) * h;
      const a = -Math.PI / 2 + (R(i, 3) - 0.5) * 1.6, l = len * (0.5 + R(i, 4));
      g.strokeStyle = shade(base, (R(i, 5) - 0.5) * 0.45, (R(i, 6) - 0.5) * 0.4);
      at((qx, qy) => { g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + Math.cos(a) * l, qy + Math.sin(a) * l); g.stroke(); }, px, py, len * 1.5);
    }
    return;
  }
  if (kind === 'kalk') {
    // verdichte kalksteen: vlak en dicht, zachte vlekken en een fijne korrel; 'grof' met grotere steentjes
    const blobs = Math.min(400, Math.round(areaM * 60));
    for (let i = 0; i < blobs; i++) {
      const r = (0.08 + R(i, 3) * 0.22) * ppm;
      g.fillStyle = shade(base, (R(i, 4) - 0.5) * 0.08, 0);
      g.globalAlpha = 0.35;
      at((qx, qy) => { g.beginPath(); g.ellipse(qx, qy, r, r * (0.6 + R(i, 5) * 0.4), R(i, 6) * 3, 0, Math.PI * 2); g.fill(); }, x + R(i, 1) * w, y + R(i, 2) * h, r);
    }
    g.globalAlpha = 1;
    const big = grain === 'grof';
    const n = Math.min(20000, Math.round(areaM * (big ? 9000 : 14000)));
    for (let i = 0; i < n; i++) {
      const r = (big ? 0.0035 + R(i, 3) * 0.006 : 0.0015 + R(i, 3) * 0.0025) * ppm;
      const t = (R(i, 4) - 0.5) * (big ? 0.38 : 0.34);
      g.fillStyle = shade(base, t, (R(i, 5) - 0.5) * 0.3);
      at((qx, qy) => { g.beginPath(); g.ellipse(qx, qy, r, r * 0.75, R(i, 6) * 3, 0, Math.PI * 2); g.fill(); }, x + R(i + 7, 1) * w, y + R(i + 7, 2) * h, r * 2);
    }
    return;
  }
  // korrels: grind en split klein, schors en aarde grover
  const size = { grind: 0.007, split: 0.0055, schors: 0.014, aarde: 0.004, schelpen: 0.008 }[kind] || 0.007;
  const n = Math.min(14000, Math.round((areaM / (size * size)) * 0.55));
  for (let i = 0; i < n; i++) {
    const px = x + R(i, 1) * w, py = y + R(i, 2) * h;
    const r = size * ppm * (0.55 + R(i, 3) * 0.7);
    const t = (R(i, 4) - 0.5) * (kind === 'split' ? 0.5 : 0.35), warm = kind === 'grind' ? (R(i, 5) - 0.5) * 0.6 : 0;
    g.fillStyle = shade(base, t, warm);
    const rot = R(i, 6) * Math.PI;
    at((qx, qy) => {
      g.beginPath();
      if (kind === 'split') {
        // hoekig
        for (let k = 0; k < 4; k++) { const a = rot + k * 1.57 + (R(i, 7 + k) - 0.5) * 0.7; const rr = r * (0.7 + R(i, 11 + k) * 0.5); if (k) g.lineTo(qx + Math.cos(a) * rr, qy + Math.sin(a) * rr); else g.moveTo(qx + Math.cos(a) * rr, qy + Math.sin(a) * rr); }
        g.closePath();
      } else if (kind === 'schelpen') {
        // schelpgruis: halve maantjes en stukjes in wit, crème en grijsblauw
        g.fillStyle = R(i, 9) < 0.15 ? '#9aa0a8' : R(i, 9) < 0.55 ? shade(base, 0.25, 0) : shade(base, t - 0.08, 0.1);
        g.arc(qx, qy, r, rot, rot + Math.PI * (1 + R(i, 10) * 0.6));
        g.closePath();
      } else if (kind === 'schors') {
        g.ellipse(qx, qy, r * 1.6, r * 0.6, rot, 0, Math.PI * 2);
      } else {
        g.ellipse(qx, qy, r, r * (0.7 + R(i, 8) * 0.3), rot, 0, Math.PI * 2);
      }
      g.fill();
    }, px, py, r * 2);
  }
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

// ---------------------------------------------------------------- kleurmenging

/** Hoe meerdere steenkleuren in het verband terugkomen. */
export const MIX_MODES = {
  willekeurig: { name: 'Willekeurig', hint: 'Kleuren los door elkaar, precies in de gekozen verhouding.' },
  verspreid: { name: 'Regelmatig verspreid', hint: 'Een vast ritme waarin de kleuren zo gelijkmatig mogelijk verdeeld zijn.' },
  diagonaal: { name: 'Diagonale lijnen', hint: 'Het kleurritme schuift elke rij één steen op: schuine lijnen.' },
  banen: { name: 'Banen (per rij)', hint: 'Hele rijen in één kleur, in de gekozen verhouding.' },
  vlekken: { name: 'Vlekken (groepjes)', hint: 'Groepjes stenen van dezelfde kleur, als wolken door het vlak.' },
};

/** Kleuren van een gemengd verband (de eerste is altijd de steenkleur), of null bij één kleur. */
export function bondPalette(bond) {
  const cs = bond?.mix?.colors;
  if (!cs || cs.length < 2) return null;
  const list = cs.map((c, i) => ({ color: i === 0 ? bond.color || c.color : c.color, share: Math.max(0, Number(c.share) || 0) }));
  const tot = list.reduce((a, c) => a + c.share, 0);
  if (tot <= 0) return null;
  for (const c of list) c.share /= tot;
  return list.filter((c) => c.share > 0).length > 1 ? list : null;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Kleurritme: een reeks kleurnummers in de juiste verhouding, zo gelijkmatig mogelijk verdeeld. */
export function mixSequence(shares, maxLen = 20) {
  // kortste ritme waarvan de verhouding hooguit 3% afwijkt van de gekozen verhouding
  const tot = shares.reduce((x, v) => x + v, 0) || 1;
  const p = shares.map((v) => v / tot);
  const fit = (n) => {
    const raw = p.map((v) => v * n);
    const w = raw.map((v, i) => (p[i] > 0 ? Math.max(1, Math.floor(v)) : 0));
    let rest = n - w.reduce((x, v) => x + v, 0);
    const byRem = raw.map((v, i) => [v - Math.floor(v), i]).filter(([, i]) => p[i] > 0).sort((x, y) => y[0] - x[0]);
    for (let k = 0; rest > 0 && byRem.length; k = (k + 1) % byRem.length, rest--) w[byRem[k][1]]++;
    return w;
  };
  let w = null;
  for (let n = 2; n <= maxLen && !w; n++) {
    const c = fit(n);
    if (c.reduce((x, v) => x + v, 0) === n && c.every((v, i) => Math.abs(v / n - p[i]) <= 0.03)) w = c;
  }
  if (!w) w = fit(maxLen);
  const len = w.reduce((x, v) => x + v, 0);
  // grootste kleur eerst op gelijke afstanden; de volgende kleuren gelijkmatig over de vrije plekken
  const seq = new Array(len).fill(0);
  let free = [...Array(len).keys()];
  const order = w.map((v, i) => i).filter((i) => w[i] > 0).sort((a, b) => w[b] - w[a]);
  order.forEach((ci, k) => {
    if (k === order.length - 1) { for (const f of free) seq[f] = ci; return; }
    const pick = new Set();
    for (let i = 0; i < w[ci]; i++) pick.add(Math.floor(((i + 0.5) * free.length) / w[ci]));
    free.forEach((f, idx) => { if (pick.has(idx)) seq[f] = ci; });
    free = free.filter((_, idx) => !pick.has(idx));
  });
  return seq;
}

/** Periodieke, gladde ruis (voor vlekken die naadloos herhalen). */
function periodicNoise(x, y, PX, PY, salt) {
  const cx = Math.max(1, Math.round(PX)), cy = Math.max(1, Math.round(PY));
  const fx = x * (cx / PX), fy = y * (cy / PY);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const v = (i, j) => hash(((i % cx) + cx) % cx + salt, (((j % cy) + cy) % cy) * 1.37 + salt * 0.71);
  const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Verdeel de kleuren over de stenen van een (uitgebreide) herhaling.
 * stones: [{ x, y, w, h }] in rastereenheden; geeft per steen een kleurnummer.
 */
export function assignColors(stones, palette, mode, PX, PY) {
  const shares = palette.map((c) => c.share);
  const out = new Array(stones.length).fill(0);
  if (!stones.length) return out;
  const byQuantile = (val) => {
    const order = stones.map((_, i) => i).sort((a, b) => val[a] - val[b]);
    let k = 0, acc = 0;
    order.forEach((idx, r) => {
      while (k < shares.length - 1 && r >= Math.round((acc + shares[k]) * stones.length)) { acc += shares[k]; k++; }
      out[idx] = k;
    });
  };
  if (mode === 'willekeurig' || !MIX_MODES[mode]) {
    byQuantile(stones.map((st) => hash(st.x * 7.31 + st.w * 1.7 + 0.5, st.y * 3.17 + st.h * 2.3 + 0.25)));
    return out;
  }
  if (mode === 'vlekken') {
    // vlekken van zo'n 3 à 4 stenen breed, met wat ruis zodat de randen rafelig zijn
    const long = stones.reduce((a, st) => a + Math.max(st.w, st.h), 0) / stones.length;
    const cell = Math.max(4, 2.2 * long);
    byQuantile(stones.map((st) => {
      const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
      return periodicNoise(cx / cell, cy / cell, PX / cell, PY / cell, 3.3) * 0.82 + periodicNoise(cx / 1.6, cy / 1.6, PX / 1.6, PY / 1.6, 8.1) * 0.12 + hash(cx * 5.1, cy * 2.9) * 0.06;
    }));
    return out;
  }
  const seq = mixSequence(shares);
  const len = seq.length;
  // rijen van één eenheid hoog; binnen een rij op volgorde van links naar rechts
  const rows = new Map();
  stones.forEach((st, i) => {
    const r = Math.floor(st.y + st.h / 2 + 1e-6);
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r).push(i);
  });
  const shift = mode === 'diagonaal' ? 1 : len <= 2 ? 1 : Math.max(1, Math.round(len * 0.382));
  for (const [r, idxs] of rows) {
    idxs.sort((a, b) => stones[a].x - stones[b].x);
    idxs.forEach((i, c) => {
      const k = mode === 'banen' ? r : c + r * shift;
      out[i] = seq[((k % len) + len) % len];
    });
  }
  return out;
}

/** Hoeveel keer de basisherhaling in elke richting, zodat het kleurritme naadloos doorloopt. */
function mixRepeat(L, palette, mode) {
  if (!palette) return [1, 1];
  const span = (k, p) => k * p * L.U;
  let kx = 1, ky = 1;
  if (mode === 'willekeurig' || mode === 'vlekken' || !MIX_MODES[mode]) {
    // een flink stuk, zodat de herhaling niet opvalt (ca. 2,5 m of 24 stenen)
    const target = Math.max(2.5, 24 * L.U);
    kx = Math.max(1, Math.round(target / (L.px * L.U)));
    ky = Math.max(1, Math.round(target / (L.py * L.U)));
  } else {
    const len = mixSequence(palette.map((c) => c.share)).length;
    kx = len;
    ky = len / gcd(Math.max(1, Math.round(L.py)), len);
  }
  // niet groter dan nodig voor een scherp patroon
  while (span(kx, L.px) > 6 && kx > 1) kx = Math.ceil(kx / 2);
  while (span(ky, L.py) > 6 && ky > 1) ky = Math.ceil(ky / 2);
  return [kx, ky];
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
  if (T.surface) return { T, U: 1.5, n: 1, j: 0, ...T.stones(1, bond, 1.5) };
  const st = T.stones(n, bond, U);
  return { T, U, n, j, ...st };
}

/** Canvaspatroon voor een verband, in wereldcoördinaten (meters), met legrichting en beginpunt. */
export function bondPattern(ctx, bond, rot = 0, origin = null) {
  const key = JSON.stringify([bond.type, bond.l, bond.w, bond.joint, bond.color, bond.jointColor, bond.finish, bond.color2, bond.finish2, bond.tile, bond.mix || null, bond.fill || null, bond.jointFill || null]);
  let tile = cache.get(key);
  const L0 = bondLayout(bond);
  const palette = bondPalette(bond);
  const mode = bond.mix?.mode || 'willekeurig';
  const [kx, ky] = mixRepeat(L0, palette, mode);
  // bij meerdere kleuren: een grotere herhaling van kx × ky keer het basispatroon
  const L = kx * ky === 1 ? L0 : { ...L0, px: L0.px * kx, py: L0.py * ky, list: L0.list.flatMap(([x, y, w, h, ci]) => {
    const o = [];
    for (let i = 0; i < kx; i++) for (let j = 0; j < ky; j++) o.push([x + i * L0.px, y + j * L0.py, w, h, ci]);
    return o;
  }) };
  if (!tile) {
    const W = L.px * L.U, H = L.py * L.U;
    const maxPx = kx * ky > 1 ? 2048 : 1024;
    const minPpm = Math.max(180, 16 / L.U, L.T.minPpm || 0, bond.jointFill ? 300 : 0);
    const ppm = Math.min(maxPx / Math.max(W, H), minPpm);
    const c = document.createElement('canvas');
    c.width = Math.max(8, Math.round(W * ppm)); c.height = Math.max(8, Math.round(H * ppm));
    const g = c.getContext('2d');
    const sx = c.width / L.px, sy = c.height / L.py; // pixels per rastereenheid
    const jx = (L.j / L.U) * sx, jy = (L.j / L.U) * sy;
    if (bond.jointFill) paintFill(g, 0, 0, c.width, c.height, bond.jointFill, bond.jointColor, 7, ppm, [c.width, c.height]);
    else {
      g.fillStyle = bond.jointColor || '#8a857c';
      g.fillRect(0, 0, c.width, c.height);
    }
    const mod = (v, m) => ((v % m) + m) % m;
    let mixCol = null;
    if (palette) {
      const main = L.list.map(([x, y, w, h, ci], i) => ({ x: mod(x, L.px), y: mod(y, L.py), w, h, ci, i })).filter((st) => !st.ci);
      const a = assignColors(main, palette, mode, L.px, L.py);
      mixCol = new Map(main.map((st, k) => [st.i, palette[a[k]].color]));
    }
    for (let si = 0; si < L.list.length; si++) {
      const [x, y, w, h, ci] = L.list[si];
      const bx = mod(x, L.px), by = mod(y, L.py);
      const col = ci ? bond.color2 || '#9a9a96' : mixCol?.get(si) || bond.color || '#a8503c', fin = ci ? bond.finish2 || bond.finish || 'glad' : bond.finish || 'glad';
      const seed = Math.round(bx * 97 + by * 389 + w * 13 + 1);
      for (const dx of [-L.px, 0, L.px]) {
        for (const dy of [-L.py, 0, L.py]) {
          const X = (bx + dx) * sx, Y = (by + dy) * sy;
          if (X > c.width || Y > c.height || X + w * sx < 0 || Y + h * sy < 0) continue;
          if (L.T.paint) L.T.paint(g, X + jx / 2, Y + jy / 2, w * sx - jx, h * sy - jy, { col, fin, seed, bond, ppm: sx / L.U, offset: !!(dx || dy) });
          else paintStone(g, X + jx / 2, Y + jy / 2, w * sx - jx, h * sy - jy, col, fin, seed);
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
  if (BOND_TYPES[bond.type]?.surface) return `Halfverharding · ${(FILLS[bond.fill] || FILLS.kalk).name.toLowerCase()}${bond.grain === 'grof' ? ', grove korrel' : ''}`;
  const pal = bondPalette(bond);
  const mix = pal ? ` · ${pal.length} kleuren, ${(MIX_MODES[bond.mix.mode] || MIX_MODES.willekeurig).name.toLowerCase()}` : '';
  return `${BOND_TYPES[bond.type]?.name || 'Verband'} · ${cm(Math.max(bond.l, bond.w))}×${cm(Math.min(bond.l, bond.w))} cm${mix}`;
}

/** Benodigde hoeveelheid: aantal stenen of platen, of m³ bij halfverharding. */
export function materialAmount(bond, area, count) {
  if (BOND_TYPES[bond.type]?.surface) {
    const d = SURFACE_LAYER[bond.fill || 'kalk'] ?? 0.05;
    const v = area * d;
    return d ? `ca. ${v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)} m³ (laag ${Math.round(d * 100)} cm)` : '';
  }
  return `ca. ${count.toLocaleString('nl-NL')} st.`;
}
