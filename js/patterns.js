// Arceringen voor vlakken. Patronen zijn op ware grootte: een tegel van
// 60 cm blijft 60 cm, ongeacht de zoom.

// size = maat van één patroontegel in meters; bg = zachte ondergrondkleur; group = indeling in de keuzelijst
export const HATCHES = {
  none: { name: 'Geen' },
  // bestrating
  tegels: { name: 'Tegels 60×60', size: 1.2, bg: '#cfcac1', group: 'Bestrating' },
  tegels50: { name: 'Tegels 50×50', size: 1.0, bg: '#cfcac1', group: 'Bestrating' },
  tegels30: { name: 'Tegels 30×30', size: 0.6, bg: '#cfcac1', group: 'Bestrating' },
  tegels6040: { name: 'Tegels 60×40, halfsteens', size: 2.4, bg: '#cfcac1', group: 'Bestrating' },
  keramiek80: { name: 'Keramisch 80×80', size: 1.6, bg: '#cbbfae', group: 'Bestrating' },
  keramiek100: { name: 'Keramisch 100×100', size: 2.0, bg: '#cbbfae', group: 'Bestrating' },
  keramiek: { name: 'Keramisch 90×60, halfsteens', size: 3.6, bg: '#cbbfae', group: 'Bestrating' },
  keramiek120: { name: 'Keramisch 120×60, halfsteens', size: 2.4, bg: '#cbbfae', group: 'Bestrating' },
  houtlook: { name: 'Keramisch houtlook 120×30', size: 2.4, bg: '#c4a27e', group: 'Bestrating' },
  tegels20: { name: 'Gebakken tegels 20×20', size: 0.4, bg: '#b9785e', group: 'Bestrating' },
  klinkers: { name: 'Klinkers, halfsteens', size: 0.4, bg: '#b06a52', group: 'Bestrating' },
  visgraat: { name: 'Klinkers, visgraat', size: 0.4, bg: '#b06a52', group: 'Bestrating' },
  bredevoeg: { name: 'Klinkers met brede voeg (waterdoorlatend)', size: 0.48, bg: '#b06a52', joint: '#8fae6a', group: 'Bestrating' },
  cirkel: { name: 'Cirkelverband (rond terras, om een boom)', size: 0.12, bg: '#a29d94', group: 'Bestrating', radial: true },
  kinderkopjes: { name: 'Kinderkopjes / kasseien', size: 0.6, bg: '#a29d94', group: 'Bestrating' },
  romaans: { name: 'Natuursteen, Romaans verband', size: 1.2, bg: '#d4cbbb', group: 'Bestrating' },
  flagstones: { name: 'Flagstones / breuksteen', size: 2.0, bg: '#cdc3b0', group: 'Bestrating' },
  grastegels: { name: 'Grastegels (waterdoorlatend)', size: 0.5, bg: '#a9c493', group: 'Bestrating' },
  // halfverharding
  grind: { name: 'Grind', size: 0.4, bg: '#ddd3bd', group: 'Halfverharding' },
  split: { name: 'Split', size: 0.4, bg: '#cfcfcf', group: 'Halfverharding' },
  schelpen: { name: 'Schelpen', size: 0.4, bg: '#efe8d9', group: 'Halfverharding' },
  houtsnippers: { name: 'Boomschors / houtsnippers', size: 0.6, bg: '#9c7a58', group: 'Halfverharding' },
  // hout
  hout: { name: 'Vlonder (hout of composiet)', size: 0.6, bg: '#c9a173', group: 'Hout' },
  // groen en water
  gras: { name: 'Gras', size: 0.6, bg: '#b3d19a', group: 'Groen en water' },
  beplanting: { name: 'Beplanting', size: 1, bg: '#bdd4a6', group: 'Groen en water' },
  water: { name: 'Water', size: 1.2, bg: '#a7cbe9', group: 'Groen en water' },
  // overig
  arcering: { name: 'Arcering', size: 0.5, group: 'Overig' },
};

/** <option>-lijst met groepen, voor de keuzelijsten. */
export function hatchOptions(selected = 'none') {
  const groups = {};
  let html = '';
  for (const [k, h] of Object.entries(HATCHES)) {
    if (!h.group) { html += `<option value="${k}" ${k === selected ? 'selected' : ''}>${h.name}</option>`; continue; }
    (groups[h.group] ||= []).push(`<option value="${k}" ${k === selected ? 'selected' : ''}>${h.name}</option>`);
  }
  for (const [g, opts] of Object.entries(groups)) html += `<optgroup label="${g}">${opts.join('')}</optgroup>`;
  return html;
}

const TILE = 128;
const cache = new Map();

function makeTile(kind, color) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 2;
  g.lineCap = 'round';
  const T = TILE;
  let seed = 99;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  switch (kind) {
    case 'gras':
      for (let i = 0; i < 14; i++) {
        const x = rnd() * T, y = rnd() * T;
        g.beginPath();
        g.moveTo(x - 4, y + 6); g.lineTo(x - 2, y - 2);
        g.moveTo(x, y + 6); g.lineTo(x + 1, y - 5);
        g.moveTo(x + 4, y + 6); g.lineTo(x + 5, y - 1);
        g.stroke();
      }
      break;
    case 'grind':
      for (let i = 0; i < 40; i++) {
        g.beginPath();
        g.ellipse(rnd() * T, rnd() * T, 2 + rnd() * 3, 1.5 + rnd() * 2, rnd() * 3, 0, Math.PI * 2);
        g.globalAlpha = 0.5 + rnd() * 0.5;
        g.stroke();
      }
      break;
    case 'tegels':
    case 'tegels30':
      g.lineWidth = 1.5;
      g.strokeRect(0, 0, T / 2, T / 2);
      g.strokeRect(T / 2, 0, T / 2, T / 2);
      g.strokeRect(0, T / 2, T / 2, T / 2);
      g.strokeRect(T / 2, T / 2, T / 2, T / 2);
      break;
    case 'klinkers': {
      g.lineWidth = 1.2;
      const h = T / 4; // 10 cm rijen
      for (let r = 0; r < 4; r++) {
        const y = r * h;
        g.beginPath(); g.moveTo(0, y); g.lineTo(T, y); g.stroke();
        const off = r % 2 ? T / 4 : 0;
        for (let x = off; x <= T; x += T / 2) {
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.stroke();
        }
      }
      break;
    }
    case 'hout':
      g.lineWidth = 1.2;
      for (let r = 0; r < 4; r++) {
        const y = (r * T) / 4;
        g.beginPath(); g.moveTo(0, y); g.lineTo(T, y); g.stroke();
        const x = ((r * 37) % T);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + T / 4); g.stroke();
        g.globalAlpha = 0.35;
        g.beginPath(); g.moveTo(0, y + T / 8); g.bezierCurveTo(T / 3, y + T / 8 - 3, (2 * T) / 3, y + T / 8 + 3, T, y + T / 8); g.stroke();
        g.globalAlpha = 1;
      }
      break;
    case 'water':
      g.lineWidth = 1.5;
      for (let r = 0; r < 4; r++) {
        const y = (r + 0.5) * (T / 4);
        const off = r % 2 ? T / 4 : 0;
        g.beginPath();
        for (let x = -T / 2 + off; x < T; x += T / 2) {
          g.moveTo(x, y);
          g.quadraticCurveTo(x + T / 8, y - 6, x + T / 4, y);
          g.quadraticCurveTo(x + (3 * T) / 8, y + 6, x + T / 2, y);
        }
        g.stroke();
      }
      break;
    case 'beplanting':
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const x = rnd() * T, y = rnd() * T, r = 6 + rnd() * 8;
        g.beginPath();
        for (let a = 0; a <= 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          const rr = r * (a % 2 ? 0.75 : 1);
          const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
          a ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.stroke();
      }
      break;
    case 'tegels50':
    case 'tegels20':
    case 'keramiek80':
    case 'keramiek100':
      g.lineWidth = kind === 'tegels20' ? 1.2 : kind.startsWith('keramiek') ? 1.1 : 1.5;
      for (const x of [0, T / 2]) for (const y of [0, T / 2]) g.strokeRect(x, y, T / 2, T / 2);
      break;
    case 'tegels6040':
    case 'keramiek':
    case 'keramiek120': {
      // halfsteens verband: rijen, elke volgende rij een halve tegel verschoven
      // vierkante patroontegel met een even aantal rijen: 60×40 → 2,4 m (6 × 4), 90×60 → 3,6 m (6 × 4), 120×60 → 2,4 m (4 × 2)
      const rows = kind === 'keramiek120' ? 4 : 6;
      const per = kind === 'keramiek120' ? 2 : 4;
      const h = T / rows, w = T / per;
      g.lineWidth = kind === 'tegels6040' ? 1.2 : 1.6;
      for (let r = 0; r < rows; r++) {
        const y = r * h;
        g.beginPath(); g.moveTo(0, y); g.lineTo(T, y); g.stroke();
        const off = r % 2 ? w / 2 : 0;
        for (let x = off; x <= T + 0.1; x += w) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.stroke(); }
      }
      break;
    }
    case 'houtlook': {
      // planken 120×30 in wildverband (wisselende verspringing), met een zachte houtnerf
      const rows = 8, h = T / rows, w = T / 2;
      const offs = [0, 0.33, 0.67, 0.17, 0.5, 0.83, 0.25, 0.58];
      g.lineWidth = 1.1;
      for (let r = 0; r < rows; r++) {
        const y = r * h;
        g.beginPath(); g.moveTo(0, y); g.lineTo(T, y); g.stroke();
        for (let x = offs[r] * w; x <= T + 0.1; x += w) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.stroke(); }
        g.globalAlpha = 0.3;
        g.beginPath(); g.moveTo(0, y + h * 0.45); g.bezierCurveTo(T / 3, y + h * 0.3, (2 * T) / 3, y + h * 0.65, T, y + h * 0.45); g.stroke();
        g.globalAlpha = 1;
      }
      break;
    }
    case 'bredevoeg': {
      // klinkers 22×10 halfsteens met een brede voeg van 2 cm: de voeg is een gekleurd vlak (gras, split, zand),
      // de klinkers zelf blijven open zodat de materiaalkleur eronder zichtbaar is
      const cm = T / 48; // patroontegel = 48 cm
      g.fillStyle = color;
      g.fillRect(0, 0, T, T);
      g.globalCompositeOperation = 'destination-out';
      for (let r = 0; r < 4; r++) {
        const y = r * 12 * cm + cm;
        const off = r % 2 ? 12 * cm : 0;
        for (let x = off - 24 * cm; x < T; x += 24 * cm) g.fillRect(x + cm, y, 22 * cm, 10 * cm);
      }
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'visgraat': {
      // 20×10 klinkers in keperverband; roosters (1,1) en (2,-2) in eenheden van 10 cm, tegel = 4 × 4 eenheden
      const u = T / 4;
      g.lineWidth = 1.2;
      for (let a = -6; a <= 6; a++) {
        for (let b = -4; b <= 4; b++) {
          const ox = a + b * 2, oy = a - b * 2;
          if (ox < -3 || ox > 4 || oy < -3 || oy > 4) continue;
          g.strokeRect(ox * u, oy * u, 2 * u, u);
          g.strokeRect(ox * u, (oy + 1) * u, u, 2 * u);
        }
      }
      break;
    }
    case 'kinderkopjes': {
      // rijen ronde keien met wisselende maat; randen lopen door naar de volgende tegel
      const rows = 4, per = 4, h = T / rows, w = T / per;
      g.lineWidth = 1.2;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? w / 2 : 0;
        for (let i = 0; i < per; i++) {
          const jw = 0.8 + rnd() * 0.15, jh = 0.78 + rnd() * 0.15;
          const cx = off + i * w + w / 2, cy = r * h + h / 2;
          for (const dx of [-T, 0, T]) {
            g.beginPath();
            g.ellipse(cx + dx, cy, (w * jw) / 2, (h * jh) / 2, 0, 0, Math.PI * 2);
            g.stroke();
          }
        }
      }
      break;
    }
    case 'romaans': {
      // natuursteen in wildverband: 6 × 6 eenheden van 20 cm
      const u = T / 6;
      g.lineWidth = 1.4;
      for (const [x, y, w, h] of [[0, 0, 3, 3], [3, 0, 3, 2], [3, 2, 1, 1], [4, 2, 2, 1], [0, 3, 2, 2], [0, 5, 2, 1], [2, 3, 2, 3], [4, 3, 2, 1], [4, 4, 2, 2]]) {
        g.strokeRect(x * u, y * u, w * u, h * u);
      }
      break;
    }
    case 'flagstones': {
      // breuksteen: vervormd rooster; de vervorming hangt af van het hoekpunt (mod n), dus naadloos
      const n = 4, u = T / n;
      const jit = (i, j) => {
        const k = ((((i % n) + n) % n) * 7 + (((j % n) + n) % n) * 13) % 17;
        return [Math.sin(k * 2.1) * u * 0.28, Math.cos(k * 1.7) * u * 0.28];
      };
      const P = (i, j) => { const d = jit(i, j); return [i * u + d[0], j * u + d[1]]; };
      g.lineWidth = 1.6;
      g.lineJoin = 'round';
      for (let i = -1; i <= n; i++) {
        for (let j = -1; j <= n; j++) {
          const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
          const c = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
          // iets kleiner tekenen: brede voeg
          g.beginPath();
          q.forEach((p, k) => { const x = c[0] + (p[0] - c[0]) * 0.9, y = c[1] + (p[1] - c[1]) * 0.9; k ? g.lineTo(x, y) : g.moveTo(x, y); });
          g.closePath();
          g.stroke();
        }
      }
      break;
    }
    case 'grastegels': {
      // betonnen grastegel met open vakken (gras groeit erdoorheen)
      g.lineWidth = 1.5;
      g.strokeRect(0, 0, T, T);
      const m = T * 0.1, cell = (T - m * 3) / 2;
      for (const x of [m, m * 2 + cell]) {
        for (const y of [m, m * 2 + cell]) {
          g.strokeRect(x, y, cell, cell);
          g.globalAlpha = 0.6;
          for (let k = 0; k < 3; k++) {
            const gx = x + cell * (0.25 + 0.25 * k), gy = y + cell * 0.6;
            g.beginPath(); g.moveTo(gx - 3, gy + 4); g.lineTo(gx - 1, gy - 3); g.moveTo(gx + 1, gy + 4); g.lineTo(gx + 3, gy - 2); g.stroke();
          }
          g.globalAlpha = 1;
        }
      }
      break;
    }
    case 'split':
      g.lineWidth = 1.3;
      for (let i = 0; i < 48; i++) {
        const x = rnd() * T, y = rnd() * T, r = 2 + rnd() * 3, a0 = rnd() * 6;
        g.globalAlpha = 0.5 + rnd() * 0.5;
        g.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = a0 + (k * Math.PI * 2) / 3 + rnd() * 0.5;
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
          k ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath();
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    case 'schelpen':
      g.lineWidth = 1.1;
      for (let i = 0; i < 26; i++) {
        const x = rnd() * T, y = rnd() * T, r = 3 + rnd() * 3, a = rnd() * 6;
        g.globalAlpha = 0.55 + rnd() * 0.45;
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.arc(0, 0, r, Math.PI * 1.1, Math.PI * 1.9); g.closePath(); g.stroke();
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r); g.moveTo(0, 0); g.lineTo(-r * 0.6, -r * 0.75); g.moveTo(0, 0); g.lineTo(r * 0.6, -r * 0.75); g.stroke();
        g.restore();
      }
      g.globalAlpha = 1;
      break;
    case 'houtsnippers':
      g.lineWidth = 1.6;
      for (let i = 0; i < 40; i++) {
        const x = rnd() * T, y = rnd() * T, l = 4 + rnd() * 7, a = rnd() * Math.PI;
        g.globalAlpha = 0.45 + rnd() * 0.55;
        g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
      }
      g.globalAlpha = 1;
      break;
    case 'arcering':
      g.lineWidth = 1.5;
      for (let k = -T; k <= T; k += T / 4) {
        g.beginPath(); g.moveTo(k, T); g.lineTo(k + T, 0); g.stroke();
      }
      break;
  }
  return c;
}

/** Canvaspatroon voor een arcering, geschaald naar wereldcoördinaten (meters). */
export function hatchPattern(ctx, kind, color, rot = 0, origin = null) {
  const def = HATCHES[kind];
  if (!def || kind === 'none') return null;
  const key = kind + color;
  let tile = cache.get(key);
  if (!tile) {
    tile = makeTile(kind, color);
    cache.set(key, tile);
  }
  const pattern = ctx.createPattern(tile, 'repeat');
  const s = def.size / TILE;
  // legrichting (rot, radialen) en beginpunt (origin) van het patroon in de tekening
  const m = new DOMMatrix();
  if (origin) m.translateSelf(origin[0], origin[1]);
  if (rot) m.rotateSelf((rot * 180) / Math.PI);
  m.scaleSelf(s, s);
  pattern.setTransform(m);
  return pattern;
}
