// Impressie van een plant van bovenaf: vorm en bladstructuur naar de groeivorm, bloemen naar de bloeivorm,
// kleuren naar de maand (bloei, blad, herfst, winter). Gebruikt door plantvakken, groepen, solitairen,
// plantstencils en de plantendatabase, zodat een plant overal hetzelfde oogt.

import { FOLIAGE, AUTUMN, monthState } from './planting.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function rgb(hex) {
  const h = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '7a9a5a';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Kleur lichter (t > 0) of donkerder (t < 0), met dekking a. */
function tone(hex, t, a = 1) {
  const c = rgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)))));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

/** Welke tekening hoort bij deze plant? */
export function plantShape(p) {
  if (p.shape) return p.shape; // vaste tekening (bijv. voor de schets)
  if (p.kind === 'gras' || (p.habit === 'overhangend' && p.form === 'pluim')) return 'gras';
  if (p.kind === 'varen') return 'varen';
  if (p.kind === 'zwaard') return 'zwaard';
  if (p.kind === 'bol') return 'bol';
  if (p.kind === 'heester' || p.kind === 'haag' || p.kind === 'boom' || p.kind === 'klimmer') return 'heester';
  if (p.habit === 'spreidend' || p.kind === 'bodem') return 'mat';
  if (p.form === 'blad' && p.habit !== 'rechtop') return 'bladplant';
  if (p.habit === 'ijl') return 'ijl';
  if (p.habit === 'rechtop') return 'rechtop';
  return 'kussen';
}

/**
 * Teken een plant met middelpunt (x, y) en diameter d (meters).
 * opts: month (1..12 of null = in bloei), lw (lijndikte), seed, pxPerM (voor eenvoudiger tekenen als hij klein
 * op het scherm staat), alpha.
 */
export function drawPlant(g, p, x, y, d, opts = {}) {
  const st = opts.month ? monthState(p, opts.month) : (p.bloom && p.bloom.length ? { kind: 'bloei', color: p.color } : { kind: 'blad', color: (FOLIAGE[p.foliage] || FOLIAGE.groen).color });
  const R = d / 2;
  const shape = plantShape(p);
  const r = rng(opts.seed ?? Math.round(x * 997 + y * 6151 + d * 31));
  const leafBase = (FOLIAGE[p.foliage] || FOLIAGE.groen).color;
  // bladkleur in deze maand
  let leaf = leafBase;
  if (st.kind === 'herfst') leaf = AUTUMN[p.autumn]?.color || leafBase;
  if (p.foliageColor) leaf = p.foliageColor;
  const px = (opts.pxPerM || 400) * d;
  g.save();
  g.translate(x, y);
  if (opts.alpha != null) g.globalAlpha *= opts.alpha;
  if (st.kind === 'weg') {
    // bovengronds weg: alleen een vage plek
    g.strokeStyle = 'rgba(90,80,60,0.35)'; g.lineWidth = (opts.lw || R * 0.04) * 0.8;
    g.setLineDash([R * 0.15, R * 0.12]);
    g.beginPath(); g.arc(0, 0, R * 0.7, 0, TAU); g.stroke();
    g.restore();
    return;
  }
  if (px < 7) {
    // klein op het scherm: één zachte vlek in de kleur van het moment
    g.fillStyle = tone(st.kind === 'bloei' ? mix(leaf, st.color, 0.45) : st.kind === 'silhouet' ? '#a8916a' : leaf, 0, 0.85);
    g.beginPath(); g.arc(0, 0, R * 0.9, 0, TAU); g.fill();
    g.restore();
    return;
  }
  // schaduw naar rechtsonder (licht van linksboven)
  // slagschaduw alleen onder dichte planten; luchtige planten (gras, varen, iris, allium) laten de grond zien
  if (['kussen', 'rechtop', 'heester', 'bladplant'].includes(shape)) {
    g.fillStyle = 'rgba(30,40,20,0.16)';
    g.beginPath(); g.ellipse(R * 0.1, R * 0.12, R * 0.88, R * 0.84, 0, 0, TAU); g.fill();
  }
  const detail = Math.max(0.35, Math.min(1, px / 60));
  if (st.kind === 'silhouet') {
    silhouette(g, R, r, shape);
  } else {
    BODY[shape](g, R, r, leaf, detail, st);
    if (st.kind === 'bloei' && p.form !== 'blad') flowers(g, p.form, R, r, st.color, detail, shape);
  }
  g.restore();
}

function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Bladvlekjes in een cirkel met straal rr: de bladmassa. */
function leafDabs(g, rr, r, leaf, n, size, { spread = 1, elong = 0.55 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * rr * spread;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    // licht linksboven, donker rechtsonder
    const lit = -(x + y) / (rr * 2.4) + 0.08;
    const t = lit + (r() - 0.5) * 0.35;
    g.fillStyle = tone(leaf, t, 0.92);
    const s = size * (0.7 + r() * 0.6);
    g.beginPath(); g.ellipse(x, y, s, s * elong, r() * TAU, 0, TAU); g.fill();
  }
}

/** Zachte, onregelmatige omtrek (bult per sector). */
function moundPath(g, R, r, bumps = 9, irr = 0.12) {
  g.beginPath();
  const k = Array.from({ length: bumps }, () => 1 - irr + r() * irr * 2);
  for (let i = 0; i < bumps; i++) {
    const a0 = (i / bumps) * TAU, a1 = ((i + 1) / bumps) * TAU, am = (a0 + a1) / 2;
    const k0 = k[i], k1 = k[(i + 1) % bumps];
    if (i === 0) g.moveTo(Math.cos(a0) * R * 0.9 * k0, Math.sin(a0) * R * 0.9 * k0);
    g.quadraticCurveTo(Math.cos(am) * R * 1.06 * (k0 + k1) / 2, Math.sin(am) * R * 1.06 * (k0 + k1) / 2, Math.cos(a1) * R * 0.9 * k1, Math.sin(a1) * R * 0.9 * k1);
  }
  g.closePath();
}

const BODY = {
  kussen(g, R, r, leaf, detail) {
    moundPath(g, R, r, 10, 0.1);
    g.fillStyle = tone(leaf, -0.12, 0.95); g.fill();
    leafDabs(g, R * 0.88, r, leaf, Math.round(55 * detail), R * 0.13);
  },
  rechtop(g, R, r, leaf, detail) {
    // pol met opgaande stengels: donker hart, blad naar buiten
    moundPath(g, R * 0.85, r, 8, 0.15);
    g.fillStyle = tone(leaf, -0.18, 0.95); g.fill();
    leafDabs(g, R * 0.75, r, leaf, Math.round(40 * detail), R * 0.12, { elong: 0.4 });
    g.strokeStyle = tone(leaf, -0.45, 0.6); g.lineWidth = R * 0.03;
    for (let i = 0; i < 9; i++) { const a = r() * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7); g.stroke(); }
  },
  ijl(g, R, r, leaf, detail) {
    // luchtig: dunne stengels en wat blad, je kijkt erdoorheen
    g.strokeStyle = tone(leaf, -0.2, 0.75); g.lineWidth = R * 0.025;
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, l = R * (0.5 + r() * 0.45);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + 0.3) * l * 0.5, Math.sin(a + 0.3) * l * 0.5, Math.cos(a) * l, Math.sin(a) * l); g.stroke();
    }
    leafDabs(g, R * 0.55, r, leaf, Math.round(18 * detail), R * 0.1);
  },
  mat(g, R, r, leaf, detail) {
    // bodembedekker: lage, onregelmatige mat
    moundPath(g, R * 1.05, r, 12, 0.18);
    g.fillStyle = tone(leaf, -0.15, 0.9); g.fill();
    leafDabs(g, R, r, leaf, Math.round(80 * detail), R * 0.08);
  },
  bladplant(g, R, r, leaf, detail) {
    // grote bladeren in een rozet (hosta, bergenia)
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.3;
      const lx = Math.cos(a) * R * 0.5, ly = Math.sin(a) * R * 0.5;
      const lit = -(lx + ly) / (R * 1.5);
      g.fillStyle = tone(leaf, lit - 0.08 + (r() - 0.5) * 0.15, 0.95);
      g.strokeStyle = tone(leaf, -0.4, 0.7); g.lineWidth = R * 0.02;
      g.beginPath(); g.ellipse(lx, ly, R * 0.5, R * 0.3, a, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(lx - Math.cos(a) * R * 0.42, ly - Math.sin(a) * R * 0.42); g.lineTo(lx + Math.cos(a) * R * 0.42, ly + Math.sin(a) * R * 0.42); g.stroke();
    }
  },
  gras(g, R, r, leaf, detail) {
    // fontein van halmen vanuit het hart
    g.lineCap = 'round';
    const n = Math.round(46 * detail + 10);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, l = R * (0.55 + r() * 0.48), bend = (r() - 0.5) * 0.9;
      const lit = -(Math.cos(a) + Math.sin(a)) * 0.15;
      g.strokeStyle = tone(leaf, lit + (r() - 0.5) * 0.3, 0.9);
      g.lineWidth = R * (0.025 + r() * 0.02);
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(a + bend) * l * 0.6, Math.sin(a + bend) * l * 0.6, Math.cos(a + bend * 0.4) * l, Math.sin(a + bend * 0.4) * l);
      g.stroke();
    }
  },
  zwaard(g, R, r, leaf) {
    // zwaardvormig blad (iris, daglelie): rechte, spitse bladeren in een waaier
    for (let i = 0; i < 24; i++) {
      const a = r() * TAU, l = R * (0.6 + r() * 0.4), wdt = 0.16 + r() * 0.08;
      g.fillStyle = tone(leaf, (r() - 0.5) * 0.35, 0.92);
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(a + wdt) * l * 0.5, Math.sin(a + wdt) * l * 0.5, Math.cos(a) * l, Math.sin(a) * l);
      g.quadraticCurveTo(Math.cos(a - wdt) * l * 0.5, Math.sin(a - wdt) * l * 0.5, 0, 0);
      g.fill();
    }
  },
  varen(g, R, r, leaf) {
    // varenbladeren: geveerde slierten vanuit het hart
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + r() * 0.3, l = R * (0.75 + r() * 0.25);
      g.strokeStyle = tone(leaf, -0.25, 0.85); g.lineWidth = R * 0.025;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke();
      for (let k = 1; k <= 7; k++) {
        const t = k / 8, w = R * 0.16 * (1 - t * 0.7);
        const cx = Math.cos(a) * l * t, cy = Math.sin(a) * l * t;
        g.fillStyle = tone(leaf, (r() - 0.4) * 0.3, 0.9);
        for (const s of [-1, 1]) {
          g.beginPath(); g.ellipse(cx + Math.cos(a + s * 1.3) * w * 0.6, cy + Math.sin(a + s * 1.3) * w * 0.6, w * 0.6, w * 0.22, a + s * 1.0, 0, TAU); g.fill();
        }
      }
    }
  },
  bol(g, R, r, leaf) {
    // bolgewas: een paar smalle bladeren
    for (let i = 0; i < 6; i++) {
      const a = r() * TAU, l = R * (0.5 + r() * 0.35);
      g.fillStyle = tone(leaf, (r() - 0.5) * 0.3, 0.85);
      g.beginPath(); g.ellipse(Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.5, l * 0.5, R * 0.08, a, 0, TAU); g.fill();
    }
  },
  heester(g, R, r, leaf, detail) {
    moundPath(g, R, r, 12, 0.12);
    g.fillStyle = tone(leaf, -0.18, 0.95); g.fill();
    leafDabs(g, R * 0.92, r, leaf, Math.round(90 * detail), R * 0.09);
    g.strokeStyle = 'rgba(60,45,30,0.25)'; g.lineWidth = R * 0.02;
    for (let i = 0; i < 6; i++) { const a = r() * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6); g.stroke(); }
  },
};

/** Bloemen naar bloeivorm, verspreid over de plant. */
function flowers(g, form, R, r, color, detail, shape) {
  const n = Math.max(4, Math.round((shape === 'gras' ? 22 : form === 'scherm' ? 12 : 20) * Math.sqrt(detail)));
  const zone = shape === 'rechtop' ? 0.75 : shape === 'ijl' ? 0.85 : 0.8;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R * zone;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    const s = R * (0.13 + r() * 0.07);
    switch (form) {
      case 'schijf': { // margriet: kroonblaadjes en een hart
        g.fillStyle = tone(color, (r() - 0.5) * 0.2, 0.97);
        for (let k = 0; k < 8; k++) { const b = (k / 8) * TAU; g.beginPath(); g.ellipse(x + Math.cos(b) * s * 0.55, y + Math.sin(b) * s * 0.55, s * 0.45, s * 0.17, b, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(90,55,25,0.95)'; g.beginPath(); g.arc(x, y, s * 0.3, 0, TAU); g.fill();
        break;
      }
      case 'knop': { // bol (allium, kogeldistel): bol met glans
        const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s * 0.75);
        gr.addColorStop(0, tone(color, 0.45)); gr.addColorStop(1, tone(color, -0.2));
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 0.75, 0, TAU); g.fill();
        break;
      }
      case 'aar': { // aar: langwerpige bloeiwijze, licht naar buiten hellend
        const b = Math.atan2(y, x) + (r() - 0.5) * 0.6;
        g.fillStyle = tone(color, (r() - 0.5) * 0.3, 0.95);
        g.beginPath(); g.ellipse(x, y, s * 1.1, s * 0.3, b, 0, TAU); g.fill();
        g.fillStyle = tone(color, 0.35, 0.8);
        g.beginPath(); g.ellipse(x - Math.cos(b) * s * 0.3, y - Math.sin(b) * s * 0.3, s * 0.45, s * 0.14, b, 0, TAU); g.fill();
        break;
      }
      case 'pluim': { // pluim: zacht en vederachtig
        const b = Math.atan2(y, x) + (r() - 0.5) * 0.8;
        g.fillStyle = tone(color, (r() - 0.3) * 0.3, 0.75);
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + Math.cos(b) * k * s * 0.35, y + Math.sin(b) * k * s * 0.35, s * (0.75 - k * 0.15), s * 0.3, b, 0, TAU); g.fill(); }
        break;
      }
      case 'scherm': { // scherm: plat schermpje van piepkleine bloempjes
        g.fillStyle = tone(color, -0.1, 0.9); g.beginPath(); g.arc(x, y, s * 0.85, 0, TAU); g.fill();
        g.fillStyle = tone(color, 0.35, 0.95);
        for (let k = 0; k < 7; k++) { const b = r() * TAU, dd = r() * s * 0.65; g.beginPath(); g.arc(x + Math.cos(b) * dd, y + Math.sin(b) * dd, s * 0.13, 0, TAU); g.fill(); }
        break;
      }
      default: {
        g.fillStyle = tone(color, 0, 0.9); g.beginPath(); g.arc(x, y, s * 0.5, 0, TAU); g.fill();
      }
    }
  }
}

/** Winter: stengels en zaaddozen blijven staan. */
function silhouette(g, R, r, shape) {
  g.strokeStyle = 'rgba(140,110,70,0.85)'; g.lineWidth = R * 0.03; g.lineCap = 'round';
  const n = shape === 'gras' ? 34 : 12;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, l = R * (0.45 + r() * 0.5);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke();
    if (shape !== 'gras') { g.fillStyle = 'rgba(95,70,45,0.9)'; g.beginPath(); g.arc(Math.cos(a) * l, Math.sin(a) * l, R * 0.06, 0, TAU); g.fill(); }
  }
}
