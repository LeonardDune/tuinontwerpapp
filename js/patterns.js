// Arceringen voor vlakken. Patronen zijn op ware grootte: een tegel van
// 60 cm blijft 60 cm, ongeacht de zoom.

export const HATCHES = {
  none: { name: 'Geen' },
  gras: { name: 'Gras', size: 0.6 },
  grind: { name: 'Grind', size: 0.4 },
  tegels: { name: 'Tegels 60×60', size: 1.2 },
  tegels30: { name: 'Tegels 30×30', size: 0.6 },
  klinkers: { name: 'Klinkers', size: 0.4 },
  hout: { name: 'Vlonder', size: 0.6 },
  water: { name: 'Water', size: 1.2 },
  beplanting: { name: 'Beplanting', size: 1 },
  arcering: { name: 'Arcering', size: 0.5 },
};

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
export function hatchPattern(ctx, kind, color) {
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
  pattern.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
  return pattern;
}
