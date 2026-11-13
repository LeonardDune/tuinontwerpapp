// Stencils: symbolen op ware grootte (meters). Elk symbool tekent zichzelf
// rond (0, 0) met breedte w en hoogte h. lw is de lijndikte in meters.

import { drawFence } from './fences.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// eigen vulkleur en -sterkte van het stencil dat nu getekend wordt (zie drawStencil)
const fillOverride = { line: null, color: null, alpha: null, paper: null };

function hexA(color, a) {
  if (fillOverride.paper) return fillOverride.paper; // afdekken: silhouet in papierkleur
  if (fillOverride.line && color === fillOverride.line) {
    if (fillOverride.color) color = fillOverride.color;
    if (fillOverride.alpha != null) a = fillOverride.alpha;
  }
  const c = color.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Wolkvormige kroonrand. */
function cloud(g, rx, ry, bumps, depth = 0.12) {
  g.beginPath();
  for (let i = 0; i < bumps; i++) {
    const a0 = (i / bumps) * TAU, a1 = ((i + 1) / bumps) * TAU, am = (a0 + a1) / 2;
    const p0 = [Math.cos(a0) * rx * (1 - depth), Math.sin(a0) * ry * (1 - depth)];
    const p1 = [Math.cos(a1) * rx * (1 - depth), Math.sin(a1) * ry * (1 - depth)];
    const cp = [Math.cos(am) * rx * (1 + depth * 0.9), Math.sin(am) * ry * (1 + depth * 0.9)];
    if (i === 0) g.moveTo(p0[0], p0[1]);
    g.quadraticCurveTo(cp[0], cp[1], p1[0], p1[1]);
  }
  g.closePath();
}

function star(g, rx, ry, spikes, inner) {
  g.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU;
    const r = i % 2 ? inner : 1;
    const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}

function blob(g, rx, ry, seed, n = 9, irr = 0.18) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 - irr + r() * irr * 2;
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) {
      const l = pts[n - 1];
      g.moveTo((l[0] + p[0]) / 2, (l[1] + p[1]) / 2);
    }
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
}

function dot(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** Stoel in bovenaanzicht, zitting naar boven en rugleuning onder; optioneel armleuningen. */
function chairTop(g, w, h, { arms = false, back = 0.2, r = 0.06 } = {}) {
  const rr = (x, y, ww, hh, rad) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, ww, hh, rad) : g.rect(x, y, ww, hh); };
  rr(-w / 2, -h / 2, w, h, Math.min(w, h) * r);
  g.fill(); g.stroke();
  const bh = h * back;
  rr(-w / 2, h / 2 - bh, w, bh, Math.min(w, h) * r);
  g.stroke();
  if (arms) {
    const aw = w * 0.14;
    for (const x of [-w / 2, w / 2 - aw]) { rr(x, -h / 2 + h * 0.08, aw, h - bh - h * 0.08, aw * 0.4); g.stroke(); }
  }
}

/** Tafelblad (rond of recht) met een rand. */
function tableTop(g, w, h, c, lw, round = false) {
  g.fillStyle = hexA(c, 0.22);
  g.beginPath();
  if (round) g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); else g.rect(-w / 2, -h / 2, w, h);
  g.fill(); g.stroke();
  g.lineWidth = lw * 0.6;
  g.globalAlpha = 0.5;
  const k = Math.min(w, h) * 0.08;
  g.beginPath();
  if (round) g.ellipse(0, 0, w / 2 - k, h / 2 - k, 0, 0, TAU); else g.rect(-w / 2 + k, -h / 2 + k, w - 2 * k, h - 2 * k);
  g.stroke();
  g.globalAlpha = 1;
}

function chair(g, x, y, s, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  g.rect(-s / 2, -s / 2, s, s);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(-s / 2, s / 2 - s * 0.18);
  g.lineTo(s / 2, s / 2 - s * 0.18);
  g.stroke();
  g.restore();
}

const POT_GREEN = '#4f7f36';
const LEAF = '#4f7f36';

/** Groen bladkussen onder de bloemen van een vaste plant. */
function leafBase(g, rx, ry, seed, lw) {
  g.save();
  g.strokeStyle = LEAF; g.fillStyle = hexA('#6b8f4a', 0.35); g.lineWidth = lw * 0.7;
  blob(g, rx, ry, seed, 10, 0.14); g.fill(); g.stroke();
  g.globalAlpha = 0.45; g.lineWidth = lw * 0.6;
  blob(g, rx * 0.55, ry * 0.55, seed + 3, 7, 0.25); g.stroke();
  g.restore();
}
const SOIL = '#6b4f3a';

/** Ronde pot in bovenaanzicht: rand in de potkleur, aarde binnenin. */
function potRound(g, rx, ry, c, lw) {
  g.fillStyle = hexA(c, 0.5);
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill(); g.stroke();
  const k = Math.max(Math.min(rx, ry) * 0.14, lw * 2);
  g.fillStyle = hexA(SOIL, 0.35);
  g.beginPath(); g.ellipse(0, 0, rx - k, ry - k, 0, 0, TAU); g.fill();
  g.save(); g.lineWidth = lw * 0.6; g.stroke(); g.restore();
}

/** Vierkante of lange bak in bovenaanzicht. */
function potSquare(g, w, h, c, lw) {
  g.fillStyle = hexA(c, 0.5);
  g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
  const k = Math.max(Math.min(w, h) * 0.1, lw * 2);
  g.fillStyle = hexA(SOIL, 0.35);
  g.beginPath(); g.rect(-w / 2 + k, -h / 2 + k, w - 2 * k, h - 2 * k); g.fill();
  g.save(); g.lineWidth = lw * 0.6; g.stroke(); g.restore();
}

/** Plant in een pot, van boven gezien: een rozet van bladeren. */
function potPlant(g, rx, ry, lw, seed) {
  const r = rng(seed);
  const n = 7 + Math.floor(r() * 3);
  const off = r() * TAU;
  g.save();
  g.strokeStyle = POT_GREEN;
  g.lineWidth = lw * 0.8;
  for (const [k, sc, al] of [[0, 1, 0.55], [0.5, 0.62, 0.7]]) {
    g.fillStyle = hexA('#5a8f3c', al);
    for (let i = 0; i < n; i++) {
      const a = off + ((i + k) / n) * TAU + (r() - 0.5) * 0.3;
      const L = (0.78 + r() * 0.22) * sc;
      const cx = Math.cos(a) * rx * L * 0.52, cy = Math.sin(a) * ry * L * 0.52;
      g.beginPath();
      g.ellipse(cx, cy, rx * L * 0.48, ry * L * 0.2, a, 0, TAU);
      g.fill(); g.stroke();
    }
  }
  g.restore();
}

// ---------- pergola's en klimplanten ----------

/** Soorten klimplanten: bladkleur en (eventueel) bloemen. */
export const CLIMBERS = {
  groen: { name: 'Groen (klimop, wingerd, hop)', leaf: '#4f7f36' },
  druif: { name: 'Druif', leaf: '#6b8f3a', fruit: '#6a3d7a' },
  blauweregen: { name: 'Blauweregen', leaf: '#6d9a4a', flower: '#9b7fd1', tros: true },
  roos: { name: 'Klimroos', leaf: '#4f7a3a', flower: '#d9577a' },
  clematis: { name: 'Clematis', leaf: '#5a8a40', flower: '#7b4fb0' },
  kamperfoelie: { name: 'Kamperfoelie', leaf: '#5f8f45', flower: '#e8c35a' },
  herfst: { name: 'Wingerd in de herfst', leaf: '#b5462f' },
};
export const GROW = { geen: 'Geen begroeiing', deels: 'Deels begroeid', vol: 'Helemaal begroeid' };

/** Stuk hout (of metaal) van boven gezien. */
function wood(g, x, y, ww, hh, c, a = 0.55) {
  g.fillStyle = hexA(c, a);
  g.beginPath(); g.rect(x, y, ww, hh); g.fill(); g.stroke();
}

/** Palen en liggers (langs de lengte); geeft de paalposities terug. */
function pergolaFrame(g, w, h, c, lw, { front = true, back = true, span = 3 } = {}) {
  const ov = Math.min(0.25, h * 0.08);
  const ps = 0.12, bw = 0.07;
  const n = Math.max(2, Math.ceil((w - 0.6) / span) + 1);
  const posts = [];
  const rows = [];
  if (back) rows.push(-h / 2 + ov);
  if (front) rows.push(h / 2 - ov);
  for (const y of rows) {
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.3 + ((w - 0.6) * i) / (n - 1);
      posts.push([x, y]);
      g.fillStyle = hexA(c, 0.9);
      g.beginPath(); g.rect(x - ps / 2, y - ps / 2, ps, ps); g.fill(); g.stroke();
    }
  }
  g.save(); g.lineWidth = lw * 0.9;
  for (const y of rows) wood(g, -w / 2 + 0.05, y - bw / 2, w - 0.1, bw, c, 0.6);
  g.restore();
  return posts;
}

/** Dwarsbalken (gordingen) bovenop, over de hele diepte, met schuin afgezaagde koppen. */
function rafters(g, w, h, c, lw, step = 0.45, wallSide = false) {
  const rw = 0.05, cut = 0.06;
  const n = Math.max(2, Math.round((w - 0.1) / step));
  g.save(); g.lineWidth = lw * 0.7;
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + 0.05 + ((w - 0.1 - rw) * i) / n;
    g.fillStyle = hexA(c, 0.5);
    g.beginPath();
    g.moveTo(x, -h / 2 + (wallSide ? 0 : cut)); g.lineTo(x + rw, -h / 2);
    g.lineTo(x + rw, h / 2 - cut); g.lineTo(x, h / 2);
    g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}

/** Bladmassa als één vlak (zonder donkere overlappingen), met bloemen of trossen. */
function foliage(g, centers, r, lw, kind, seed, line) {
  const rnd = rng(seed);
  const blobs = centers.map(([x, y]) => [x + (rnd() - 0.5) * r * 0.4, y + (rnd() - 0.5) * r * 0.4, r * (0.8 + rnd() * 0.35), Math.floor(rnd() * 1000)]);
  const path = () => {
    g.beginPath();
    for (const [x, y, rr, s] of blobs) {
      const q = rng(s + 1); const n = 9;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU; const k = 0.8 + q() * 0.3;
        const px = x + Math.cos(a) * rr * k, py = y + Math.sin(a) * rr * k;
        if (i === 0) g.moveTo(px, py); else g.quadraticCurveTo(x + Math.cos(a - 0.35) * rr * 1.15, y + Math.sin(a - 0.35) * rr * 1.15, px, py);
      }
      g.closePath();
    }
  };
  g.save();
  path();
  g.fillStyle = hexA(kind.leaf, 0.42);
  g.fill('nonzero');
  g.globalAlpha = 0.3; g.strokeStyle = fillOverride.paper || kind.leaf || line; g.lineWidth = lw * 0.6;
  g.stroke();
  g.globalAlpha = 1;
  if (!fillOverride.paper && (kind.flower || kind.fruit)) {
    for (const [x, y, rr] of blobs) {
      for (let k = 0; k < 4; k++) {
        const a = rnd() * TAU, d = rnd() * rr * 0.7;
        const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d;
        if (kind.tros) {
          g.fillStyle = hexA(kind.flower, 0.85);
          g.beginPath(); g.ellipse(fx, fy, rr * 0.09, rr * 0.28, rnd() * 0.6 - 0.3, 0, TAU); g.fill();
        } else {
          g.fillStyle = hexA(kind.flower || kind.fruit, 0.9);
          g.beginPath(); g.arc(fx, fy, rr * 0.1, 0, TAU); g.fill();
        }
      }
    }
  }
  g.restore();
}

/** Begroeiing over een pergola: plantgaten bij de palen en bladmassa over het dak. */
function climbOver(g, w, h, lw, it, posts) {
  const grow = it?.grow || 'geen';
  if (grow === 'geen') return;
  const kind = CLIMBERS[it?.growKind || 'blauweregen'] || CLIMBERS.blauweregen;
  const part = grow === 'deels';
  const step = Math.max(0.35, Math.min(0.6, Math.min(w, h) / 3));
  const centers = [];
  const xmax = part ? -w / 2 + w * 0.55 : w / 2;
  for (let x = -w / 2 + step * 0.6; x <= xmax - step * 0.3; x += step) {
    for (let y = -h / 2 + step * 0.6; y <= h / 2 - step * 0.3; y += step) {
      // deels: dichter bij de palen, uitlopend naar het midden
      if (part && (x + w / 2) / (w * 0.55) > 0.55 + 0.45 * Math.abs(y) / (h / 2)) continue;
      centers.push([x, y]);
    }
  }
  foliage(g, centers, step * 0.75, lw, kind, Math.round(w * 13 + h * 7));
  // plantgaten bij de palen (bij deels: alleen aan het begin)
  const planted = part ? posts.filter(([x]) => x < -w / 2 + w * 0.3) : posts;
  g.save();
  g.strokeStyle = hexA('#5b4a32', 1); g.lineWidth = lw * 0.8;
  for (const [x, y] of planted) {
    const oy = y + (y >= 0 ? 0.18 : -0.18);
    g.fillStyle = hexA(kind.leaf, 0.5);
    g.beginPath(); g.arc(x, oy, 0.09, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x, oy); g.lineTo(x, y); g.stroke();
  }
  g.restore();
}


/** Rolcontainer van boven: deksel met greep en scharnier achter (boven), wielen achter. */
function drawBin(g, w, h, c, lw) {
  const rr = (x, y, ww, hh, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, ww, hh, r); else g.rect(x, y, ww, hh); };
  // wielen achter, net buiten de bak
  g.fillStyle = hexA('#2b2b2b', 0.9);
  for (const sx of [-1, 1]) { rr(sx * (w / 2 - w * 0.16) - w * 0.08, -h / 2 - h * 0.035, w * 0.16, h * 0.08, w * 0.03); g.fill(); }
  // deksel (iets groter dan de bak)
  g.fillStyle = hexA(c, 0.55);
  rr(-w / 2, -h / 2 + h * 0.03, w, h * 0.97, w * 0.06); g.fill(); g.stroke();
  // greep / scharnierbalk achter
  g.fillStyle = hexA(c, 0.85);
  rr(-w / 2 + w * 0.06, -h / 2, w * 0.88, h * 0.09, w * 0.03); g.fill(); g.stroke();
  // ribbels en handgreep voor op het deksel
  g.save(); g.globalAlpha = 0.6; g.lineWidth = lw * 0.6;
  g.beginPath();
  for (const f of [0.35, 0.65]) { g.moveTo(-w * 0.3, -h / 2 + h * f); g.lineTo(w * 0.3, -h / 2 + h * f); }
  g.stroke();
  g.restore();
  rr(-w * 0.15, h / 2 - h * 0.11, w * 0.3, h * 0.06, w * 0.02); g.stroke();
}

/** Plat groen dak van boven: daktrim in de kleur van het hout, grindstrook langs de rand, begroeiing. */
function greenRoof(g, w, h, c, lw, kind) {
  const trim = Math.min(0.06, w * 0.03), gravel = Math.min(0.2, Math.min(w, h) * 0.08);
  // overstek met daktrim
  g.fillStyle = hexA(c, 0.85);
  g.lineWidth = lw * 1.4;
  g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
  // grindstrook
  const gx = -w / 2 + trim, gy = -h / 2 + trim, gw = w - 2 * trim, gh = h - 2 * trim;
  g.fillStyle = hexA('#cfc6b4', 1);
  g.beginPath(); g.rect(gx, gy, gw, gh); g.fill();
  // begroeiing
  const ix = gx + gravel, iy = gy + gravel, iw = gw - 2 * gravel, ih = gh - 2 * gravel;
  g.fillStyle = hexA(kind === 'mos' ? '#6f8f3a' : '#7f9f4a', 1);
  g.beginPath(); g.rect(ix, iy, iw, ih); g.fill();
  g.save();
  g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
  const r = rng(kind === 'mos' ? 17 : 29);
  if (!fillOverride.paper) {
    const n = Math.min(1500, Math.round(iw * ih * (kind === 'mos' ? 220 : 160)));
    for (let k = 0; k < n; k++) {
      const x = ix + r() * iw, y = iy + r() * ih, s = 0.02 + r() * 0.035;
      if (kind === 'mos') {
        const tones = ['#55752c', '#8aa84a', '#a3b85a', '#4a6a2a'];
        g.fillStyle = hexA(tones[Math.floor(r() * tones.length)], 0.7);
        g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
      } else {
        // sedum: rozetjes in groen, met hier en daar rood en geel
        const t = r();
        const col = t < 0.05 ? '#b5523a' : t < 0.09 ? '#e2c044' : t < 0.55 ? '#5f8a35' : '#9cbf5a';
        g.fillStyle = hexA(col, 0.85);
        for (let q = 0; q < 5; q++) {
          const a = (q / 5) * TAU + t * 3;
          g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.5, s * 0.25, a, 0, TAU); g.fill();
        }
      }
    }
  }
  g.restore();
  g.save();
  g.lineWidth = lw * 0.6; g.strokeStyle = hexA('#8a8070', 1);
  g.beginPath(); g.rect(ix, iy, iw, ih); g.stroke();
  // grindkorrels in de strook
  if (!fillOverride.paper) {
    g.fillStyle = hexA('#9c9282', 0.7);
    const per = Math.round((gw + gh) * 2 / 0.04);
    for (let k = 0; k < per; k++) {
      const side = Math.floor(r() * 4), t = r(), d = r() * gravel;
      const x = side < 2 ? gx + t * gw : side === 2 ? gx + d : gx + gw - d;
      const y = side >= 2 ? gy + t * gh : side === 0 ? gy + d : gy + gh - d;
      g.beginPath(); g.arc(x, y, 0.008 + r() * 0.008, 0, TAU); g.fill();
    }
  }
  g.restore();
  // regenpijp in de hoek
  g.fillStyle = hexA('#555a60', 0.9);
  g.beginPath(); g.arc(w / 2 - trim * 2, h / 2 - trim * 2, Math.max(0.04, trim * 0.8), 0, TAU); g.fill(); g.stroke();
}

// ---------- leibomen ----------

/** Platte kroon langs de breedte: één doorlopende, golvende bladrand. */
function espalierBand(g, w, h, c, lw, seed, oy) {
  const r = rng(seed);
  const hh = h * 0.42;
  const n = Math.max(3, Math.round(w / Math.max(h * 0.6, 0.18)));
  const step = w / n;
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) { top.push(hh * (0.8 + r() * 0.3)); bot.push(hh * (0.8 + r() * 0.3)); }
  g.save();
  g.fillStyle = hexA(c, 0.35);
  g.lineWidth = lw * 0.8;
  g.beginPath();
  g.moveTo(-w / 2, oy);
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + i * step;
    g.quadraticCurveTo(x0 + step / 2, oy - top[i] * 1.35, x0 + step, oy - top[i + 1] * (i === n - 1 ? 0 : 0.85));
  }
  for (let i = n; i > 0; i--) {
    const x0 = -w / 2 + i * step;
    g.quadraticCurveTo(x0 - step / 2, oy + bot[i] * 1.35, x0 - step, oy + bot[i - 1] * (i === 1 ? 0 : 0.85));
  }
  g.closePath();
  g.fill(); g.stroke();
  g.restore();
}

/** Gesteltakken: waaier vanuit de stam, of horizontale etages. */
function espalierArms(g, w, h, c, lw, ty, kind) {
  g.save();
  g.strokeStyle = hexA('#5b4a32', 0.75); g.lineWidth = lw * 0.9;
  g.beginPath();
  if (kind === 'waaier') {
    for (const f of [-0.48, -0.32, -0.16, 0.16, 0.32, 0.48]) { g.moveTo(0, ty); g.quadraticCurveTo(w * f * 0.4, ty - h * 0.25, w * f, -h * 0.15); }
  } else {
    g.moveTo(-w / 2 + 0.08, 0); g.lineTo(w / 2 - 0.08, 0);
  }
  g.stroke();
  g.restore();
}

/** Spandraden (met haken tegen de muur). */
function espalierWires(g, w, y, lw, hooks) {
  g.save();
  g.strokeStyle = hexA('#7a7a7a', 0.8); g.lineWidth = lw * 0.5;
  g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y); g.stroke();
  if (hooks) {
    g.fillStyle = hexA('#555555', 0.9);
    for (let x = -w / 2 + 0.05; x <= w / 2; x += 0.75) { g.beginPath(); g.arc(x, y, 0.015, 0, TAU); g.fill(); }
  }
  g.restore();
}

function espalierTrunk(g, x, y, c, lw, h) {
  g.save();
  g.fillStyle = hexA('#5b4a32', 0.95);
  g.beginPath(); g.arc(x, y, Math.max(0.035, h * 0.08), 0, TAU); g.fill();
  g.restore();
}

function espalierFruit(g, w, h, seed) {
  if (fillOverride.paper) return;
  const r = rng(seed);
  g.save();
  g.fillStyle = hexA('#c0392b', 0.85);
  const n = Math.round(w * 4);
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(-w / 2 + 0.1 + r() * (w - 0.2), (r() - 0.5) * h * 0.6, 0.025, 0, TAU); g.fill(); }
  g.restore();
}

export const STENCIL_CATEGORIES = ['Bomen', 'Heesters & planten', 'Vaste planten', 'Potten & bakken', 'Pergola\'s & klimplanten', 'Meubilair', 'Bouw & water', 'Hekwerk en poorten', 'Huis: deuren en ramen', 'Overig'];

export const STENCILS = [
  // --- Bomen (maat = kroondiameter) ---
  {
    id: 'loofboom', name: 'Loofboom', cat: 'Bomen', round: true, w: 6, h: 6, color: '#5a8f3c',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.25);
      cloud(g, w / 2, h / 2, 11);
      g.fill(); g.stroke();
      g.lineWidth = lw * 0.6;
      cloud(g, w * 0.3, h * 0.3, 7, 0.15);
      g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.025, lw * 1.5));
    },
  },
  {
    id: 'solitair', name: 'Solitairboom', cat: 'Bomen', round: true, w: 10, h: 10, color: '#3f7a2e',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.2);
      cloud(g, w / 2, h / 2, 16, 0.08);
      g.fill(); g.stroke();
      g.globalAlpha = 0.45;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * w * 0.38, Math.sin(a) * h * 0.38); g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.025, lw * 1.5));
    },
  },
  {
    id: 'naaldboom', name: 'Naaldboom', cat: 'Bomen', round: true, w: 4, h: 4, color: '#2f6b4f',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.3);
      star(g, w / 2, h / 2, 14, 0.72);
      g.fill(); g.stroke();
      g.globalAlpha = 0.5;
      star(g, w * 0.3, h * 0.3, 9, 0.6); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.03, lw * 1.5));
    },
  },
  {
    id: 'fruitboom', name: 'Fruitboom', cat: 'Bomen', round: true, w: 4, h: 4, color: '#6d9a3a',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.22);
      cloud(g, w / 2, h / 2, 9, 0.14);
      g.fill(); g.stroke();
      const r = rng(7);
      g.fillStyle = '#c0392b';
      for (let i = 0; i < 7; i++) {
        const a = r() * TAU, d = 0.15 + r() * 0.25;
        dot(g, Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.035);
      }
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.03, lw * 1.5));
    },
  },
  {
    id: 'meerstammig', name: 'Meerstammige boom', cat: 'Bomen', round: true, w: 5, h: 5, color: '#628c45',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.22);
      blob(g, w / 2, h / 2, 11, 12, 0.1);
      g.fill(); g.stroke();
      g.fillStyle = c;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.4;
        dot(g, Math.cos(a) * w * 0.08, Math.sin(a) * h * 0.08, Math.max(w * 0.022, lw * 1.2));
      }
    },
  },
  {
    id: 'bestaandeboom', name: 'Bestaande boom', cat: 'Bomen', round: true, w: 8, h: 8, color: '#555555',
    draw(g, w, h, c, lw) {
      g.setLineDash([lw * 4, lw * 3]);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.moveTo(-w * 0.08, 0); g.lineTo(w * 0.08, 0);
      g.moveTo(0, -h * 0.08); g.lineTo(0, h * 0.08);
      g.stroke();
    },
  },

  // --- Leibomen (B = breedte langs het rek of de muur, D = diepte van het blad) ---
  {
    id: 'leifruitmuur', name: 'Leifruit tegen een muur (waaier / etages)', cat: 'Bomen', round: false, w: 3, h: 0.4, color: '#5a8f3c',
    draw(g, w, h, c, lw) {
      // bovenkant = muur: draden met muurhaken, daarvoor de platte kroon en de stam
      espalierWires(g, w, -h / 2 + h * 0.12, lw, true);
      espalierBand(g, w, h, c, lw, 11, -h * 0.05);
      espalierArms(g, w, h, c, lw, h * 0.22, 'waaier');
      espalierFruit(g, w, h, 13);
      espalierTrunk(g, 0, h * 0.25, c, lw, h);
    },
  },
  {
    id: 'leifruitrek', name: 'Leifruit vrijstaand aan een rek', cat: 'Bomen', round: false, w: 3, h: 0.45, color: '#5a8f3c',
    draw(g, w, h, c, lw) {
      espalierBand(g, w, h, c, lw, 23, 0);
      espalierArms(g, w, h, c, lw, 0, 'etages');
      espalierWires(g, w, 0, lw, false);
      // palen van het rek aan de uiteinden (en om de 2,5 m)
      const n = Math.max(1, Math.round(w / 2.5));
      g.save(); g.fillStyle = hexA('#6b4f33', 0.95); g.lineWidth = lw * 0.6;
      for (let i = 0; i <= n; i++) { const x = -w / 2 + (w * i) / n; g.beginPath(); g.rect(x - 0.04, -0.04, 0.08, 0.08); g.fill(); g.stroke(); }
      g.restore();
      espalierFruit(g, w, h, 29);
      espalierTrunk(g, 0, 0, c, lw, h);
    },
  },
  {
    id: 'leiboom', name: 'Leiboom op stam (scherm, bijv. leilinde)', cat: 'Bomen', round: false, w: 2, h: 0.6, color: '#4f7f36',
    draw(g, w, h, c, lw) {
      espalierBand(g, w, h, c, lw, 37, 0);
      espalierArms(g, w, h, c, lw, 0, 'etages');
      // bamboe raamwerk
      g.save(); g.strokeStyle = hexA('#b59a62', 0.9); g.lineWidth = lw * 0.6; g.setLineDash([lw * 3, lw * 2]);
      g.beginPath(); g.rect(-w / 2 + 0.05, -0.03, w - 0.1, 0.06); g.stroke(); g.restore();
      espalierTrunk(g, 0, 0, c, lw, h * 1.6);
    },
  },
  {
    id: 'dakleiboom', name: 'Dakleiboom (platte kroon)', cat: 'Bomen', round: false, w: 2.5, h: 2.5, color: '#4f7f36',
    draw(g, w, h, c, lw) {
      // vierkant dak: raamwerk van takken in een raster, blad eroverheen
      g.fillStyle = hexA(c, 0.28);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill();
      g.save(); g.lineWidth = lw * 0.5; g.globalAlpha = 0.5;
      g.beginPath();
      for (let k = 1; k < 5; k++) { const x = -w / 2 + (w * k) / 5, y = -h / 2 + (h * k) / 5; g.moveTo(x, -h / 2); g.lineTo(x, h / 2); g.moveTo(-w / 2, y); g.lineTo(w / 2, y); }
      g.stroke(); g.restore();
      // golvende bladrand rondom (de kroon is plat en vierkant gesnoeid)
      const b = Math.min(w, h) * 0.06, n = Math.max(4, Math.round(Math.max(w, h) / 0.35));
      g.save(); g.fillStyle = hexA(c, 0.22); g.lineWidth = lw * 0.9;
      g.beginPath(); g.moveTo(-w / 2, -h / 2);
      const side = (x0, y0, x1, y1, nx, ny) => { for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, tm = (t0 + t1) / 2; g.quadraticCurveTo(x0 + (x1 - x0) * tm + nx * b, y0 + (y1 - y0) * tm + ny * b, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1); } };
      side(-w / 2, -h / 2, w / 2, -h / 2, 0, -1); side(w / 2, -h / 2, w / 2, h / 2, 1, 0); side(w / 2, h / 2, -w / 2, h / 2, 0, 1); side(-w / 2, h / 2, -w / 2, -h / 2, -1, 0);
      g.closePath(); g.fill(); g.stroke(); g.restore();
      espalierTrunk(g, 0, 0, c, lw, Math.min(w, h) * 0.3);
    },
  },
  {
    id: 'fruitsnoer', name: 'Fruitsnoer (laag, langs een pad)', cat: 'Bomen', round: false, w: 4, h: 0.3, color: '#5a8f3c',
    draw(g, w, h, c, lw) {
      espalierWires(g, w, 0, lw, false);
      espalierBand(g, w, h, c, lw, 53, 0);
      g.save(); g.lineWidth = lw * 1.4; g.strokeStyle = hexA('#6b4f33', 0.9);
      g.beginPath(); g.moveTo(-w / 2 + 0.1, 0); g.lineTo(w / 2 - 0.1, 0); g.stroke(); g.restore();
      const n = Math.max(1, Math.round(w / 1.5));
      for (let i = 0; i < n; i++) espalierTrunk(g, -w / 2 + (w * (i + 0.5)) / n, 0, c, lw, h * 0.8);
      espalierFruit(g, w, h, 59);
    },
  },

  // --- Heesters & planten ---
  {
    id: 'heester', name: 'Heester', cat: 'Heesters & planten', round: true, w: 1.5, h: 1.5, color: '#7aa64b',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.3);
      blob(g, w / 2, h / 2, 3, 8, 0.2);
      g.fill(); g.stroke();
      g.globalAlpha = 0.5;
      blob(g, w * 0.25, h * 0.25, 5, 6, 0.3); g.stroke();
      g.globalAlpha = 1;
    },
  },
  {
    id: 'bloeiend', name: 'Bloeiende heester', cat: 'Heesters & planten', round: true, w: 1.5, h: 1.5, color: '#b0568f',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.25);
      cloud(g, w / 2, h / 2, 8, 0.18);
      g.fill(); g.stroke();
      const r = rng(31);
      g.fillStyle = c;
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU, d = r() * 0.32;
        dot(g, Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.03);
      }
    },
  },
  {
    id: 'haag', name: 'Haag', cat: 'Heesters & planten', round: false, w: 5, h: 0.8, color: '#4f7f36',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.3);
      const n = Math.max(3, Math.round(w / (h * 0.7)));
      const step = w / n;
      g.beginPath();
      g.moveTo(-w / 2, -h / 2);
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + i * step;
        g.quadraticCurveTo(x + step / 2, -h / 2 - h * 0.25, x + step, -h / 2);
      }
      g.lineTo(w / 2, h / 2);
      for (let i = n; i > 0; i--) {
        const x = -w / 2 + i * step;
        g.quadraticCurveTo(x - step / 2, h / 2 + h * 0.25, x - step, h / 2);
      }
      g.closePath();
      g.fill(); g.stroke();
    },
  },
  {
    id: 'siergras', name: 'Siergras', cat: 'Heesters & planten', round: true, w: 0.8, h: 0.8, color: '#a39a45',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill();
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.moveTo(Math.cos(a) * w * 0.06, Math.sin(a) * h * 0.06);
        g.lineTo(Math.cos(a) * w * 0.5, Math.sin(a) * h * 0.5);
      }
      g.stroke();
    },
  },
  {
    id: 'vasteplant', name: 'Vaste plant (algemeen)', cat: 'Vaste planten', round: true, w: 0.5, h: 0.5, color: '#8e5bb5',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.3);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        g.beginPath();
        g.ellipse(Math.cos(a) * w * 0.22, Math.sin(a) * h * 0.22, w * 0.2, h * 0.13, a, 0, TAU);
        g.fill(); g.stroke();
      }
      g.fillStyle = '#e1b530'; dot(g, 0, 0, w * 0.09);
    },
  },
  {
    id: 'bodembedekker', name: 'Bodembedekker', cat: 'Heesters & planten', round: true, w: 1, h: 1, color: '#6b9c5a',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.2);
      blob(g, w / 2, h / 2, 19, 10, 0.12);
      g.fill(); g.stroke();
      const r = rng(5);
      g.fillStyle = c;
      for (let i = 0; i < 18; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 0.38;
        dot(g, Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.02);
      }
    },
  },
  {
    id: 'moestuinbak', name: 'Moestuinbak', cat: 'Heesters & planten', round: false, w: 1.2, h: 2.4, color: '#8a6a3f',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.18);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath(); g.rect(-w / 2 + lw * 3, -h / 2 + lw * 3, w - lw * 6, h - lw * 6); g.stroke();
      g.globalAlpha = 0.5;
      for (let y = -h / 2 + h / 6; y < h / 2; y += h / 6) {
        for (let x = -w / 2 + w / 4; x < w / 2; x += w / 4) { g.fillStyle = '#5a8f3c'; dot(g, x, y, Math.min(w, h) * 0.04); }
      }
      g.globalAlpha = 1;
    },
  },

  // --- Vaste planten per bloeivorm (c = bloemkleur; het blad blijft groen) ---
  {
    id: 'vp_aar', name: 'Vaste plant – aar / kaars (salvia, veronicastrum)', cat: 'Vaste planten', round: true, w: 0.5, h: 0.5, color: '#7b5ab5',
    draw(g, w, h, c, lw) {
      leafBase(g, w * 0.46, h * 0.46, 41, lw);
      const r = rng(43);
      g.fillStyle = hexA(c, 0.8);
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU, d = 0.06 + r() * 0.3;
        g.beginPath(); g.ellipse(Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.035, w * 0.11, a + Math.PI / 2, 0, TAU); g.fill(); g.stroke();
      }
    },
  },
  {
    id: 'vp_knop', name: 'Vaste plant – knop / bol (allium, echinops)', cat: 'Vaste planten', round: true, w: 0.4, h: 0.4, color: '#9b6fb5',
    draw(g, w, h, c, lw) {
      leafBase(g, w * 0.45, h * 0.45, 51, lw);
      const r = rng(53);
      for (let i = 0; i < 6; i++) {
        const a = r() * TAU, d = r() * 0.3, x = Math.cos(a) * w * d, y = Math.sin(a) * h * d, rr = w * (0.07 + r() * 0.03);
        g.fillStyle = hexA(c, 0.75);
        g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); g.stroke();
        g.save(); g.globalAlpha = 0.6; g.lineWidth = lw * 0.5;
        g.beginPath();
        for (let k = 0; k < 8; k++) { const b = (k / 8) * TAU; g.moveTo(x, y); g.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); }
        g.stroke(); g.restore();
      }
    },
  },
  {
    id: 'vp_pluim', name: 'Vaste plant – pluim (astilbe, filipendula)', cat: 'Vaste planten', round: true, w: 0.6, h: 0.6, color: '#e39ab5',
    draw(g, w, h, c, lw) {
      leafBase(g, w * 0.46, h * 0.46, 61, lw);
      const r = rng(63);
      g.fillStyle = hexA(c, 0.55);
      for (let i = 0; i < 5; i++) {
        const a = r() * TAU, d = 0.05 + r() * 0.25;
        const x = Math.cos(a) * w * d, y = Math.sin(a) * h * d;
        g.save(); g.translate(x, y); g.rotate(a);
        cloud(g, w * 0.13, w * 0.07, 9, 0.25); g.fill(); g.stroke();
        g.restore();
      }
    },
  },
  {
    id: 'vp_scherm', name: 'Vaste plant – scherm (duizendblad, sedum)', cat: 'Vaste planten', round: true, w: 0.5, h: 0.5, color: '#e8c35a',
    draw(g, w, h, c, lw) {
      leafBase(g, w * 0.46, h * 0.46, 71, lw);
      const r = rng(73);
      for (let i = 0; i < 5; i++) {
        const a = r() * TAU, d = r() * 0.28, x = Math.cos(a) * w * d, y = Math.sin(a) * h * d, rr = w * (0.09 + r() * 0.03);
        g.fillStyle = hexA(c, 0.35);
        g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = hexA(c, 0.95);
        for (let k = 0; k < 7; k++) { const b = (k / 7) * TAU + a; dot(g, x + Math.cos(b) * rr * 0.6, y + Math.sin(b) * rr * 0.6, rr * 0.16); }
        dot(g, x, y, rr * 0.16);
      }
    },
  },
  {
    id: 'vp_schijf', name: 'Vaste plant – schijf / margriet (echinacea, rudbeckia)', cat: 'Vaste planten', round: true, w: 0.5, h: 0.5, color: '#d9822b',
    draw(g, w, h, c, lw) {
      leafBase(g, w * 0.46, h * 0.46, 81, lw);
      const r = rng(83);
      for (let i = 0; i < 4; i++) {
        const a = r() * TAU, d = 0.05 + r() * 0.24, x = Math.cos(a) * w * d, y = Math.sin(a) * h * d, rr = w * (0.13 + r() * 0.02);
        g.fillStyle = hexA(c, 0.8);
        for (let k = 0; k < 10; k++) {
          const b = (k / 10) * TAU;
          g.beginPath(); g.ellipse(x + Math.cos(b) * rr * 0.55, y + Math.sin(b) * rr * 0.55, rr * 0.45, rr * 0.14, b, 0, TAU); g.fill();
        }
        g.fillStyle = hexA('#5b3a1e', 0.95); dot(g, x, y, rr * 0.3);
      }
    },
  },
  {
    id: 'vp_kussen', name: 'Vaste plant – kussen (geranium, kattenkruid)', cat: 'Vaste planten', round: true, w: 0.6, h: 0.6, color: '#6c7fc8',
    draw(g, w, h, c, lw) {
      g.save();
      g.strokeStyle = LEAF; g.fillStyle = hexA('#6b8f4a', 0.4);
      cloud(g, w / 2, h / 2, 13, 0.1); g.fill(); g.stroke();
      g.globalAlpha = 0.5; g.lineWidth = lw * 0.6;
      cloud(g, w * 0.3, h * 0.3, 9, 0.12); g.stroke();
      g.restore();
      const r = rng(93);
      g.fillStyle = hexA(c, 0.9);
      for (let i = 0; i < 16; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.4; dot(g, Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.025); }
    },
  },
  {
    id: 'vp_blad', name: 'Bladplant (hosta, bergenia)', cat: 'Vaste planten', round: true, w: 0.7, h: 0.7, color: '#5f8f7a',
    draw(g, w, h, c, lw) {
      const r = rng(101);
      g.fillStyle = hexA(c, 0.4);
      for (const [n, sc, off] of [[7, 1, 0], [5, 0.6, 0.4]]) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + off + (r() - 0.5) * 0.2;
          const L = w * 0.25 * sc;
          g.save(); g.translate(Math.cos(a) * L, Math.sin(a) * L); g.rotate(a);
          g.beginPath(); g.ellipse(0, 0, L * 0.95, L * 0.55, 0, 0, TAU); g.fill(); g.stroke();
          g.globalAlpha = 0.6; g.lineWidth = lw * 0.5;
          g.beginPath(); g.moveTo(-L * 0.9, 0); g.lineTo(L * 0.85, 0); g.stroke();
          g.restore();
        }
      }
    },
  },
  {
    id: 'varen', name: 'Varen', cat: 'Vaste planten', round: true, w: 0.7, h: 0.7, color: '#4f8a3a',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.12);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill();
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.2, R = w * 0.48;
        g.save(); g.rotate(a);
        g.lineWidth = lw * 0.9;
        g.beginPath(); g.moveTo(w * 0.03, 0); g.quadraticCurveTo(R * 0.6, R * 0.08, R, R * 0.02); g.stroke();
        g.fillStyle = hexA(c, 0.5); g.lineWidth = lw * 0.5;
        for (let k = 1; k <= 7; k++) {
          const t = k / 8, x = R * t, s = (1 - t * 0.7) * R * 0.13;
          for (const side of [-1, 1]) {
            g.beginPath(); g.ellipse(x + s * 0.3, side * s * 0.75, s * 0.75, s * 0.32, side * 0.6, 0, TAU); g.fill(); g.stroke();
          }
        }
        g.restore();
      }
    },
  },
  {
    id: 'vp_zwaard', name: 'Zwaardbladige plant (iris, daglelie)', cat: 'Vaste planten', round: true, w: 0.6, h: 0.6, color: '#e0a030',
    draw(g, w, h, c, lw) {
      g.save();
      g.strokeStyle = LEAF; g.fillStyle = hexA('#6b9c4a', 0.45); g.lineWidth = lw * 0.7;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, R = w * (i % 2 ? 0.48 : 0.4), bw = w * 0.035;
        g.save(); g.rotate(a);
        g.beginPath(); g.moveTo(0, -bw); g.quadraticCurveTo(R * 0.6, -bw * 1.4 + R * 0.1, R, R * 0.12); g.quadraticCurveTo(R * 0.6, bw * 1.4 + R * 0.1, 0, bw); g.closePath();
        g.fill(); g.stroke();
        g.restore();
      }
      g.restore();
      const r = rng(111);
      g.fillStyle = hexA(c, 0.9);
      for (let i = 0; i < 4; i++) {
        const a = r() * TAU, d = 0.08 + r() * 0.18, x = Math.cos(a) * w * d, y = Math.sin(a) * h * d;
        for (let k = 0; k < 3; k++) { const b = (k / 3) * TAU + a; g.beginPath(); g.ellipse(x + Math.cos(b) * w * 0.03, y + Math.sin(b) * w * 0.03, w * 0.045, w * 0.022, b, 0, TAU); g.fill(); }
      }
    },
  },
  {
    id: 'bolgewas', name: 'Bolgewassen (tulpen, narcissen)', cat: 'Vaste planten', round: true, w: 0.4, h: 0.4, color: '#d9577a',
    draw(g, w, h, c, lw) {
      g.save();
      g.setLineDash([lw * 2, lw * 2]);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.stroke();
      g.restore();
      const r = rng(121);
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 0.38, x = Math.cos(a) * w * d, y = Math.sin(a) * h * d;
        g.fillStyle = hexA(c, 0.85);
        g.beginPath(); g.arc(x, y, w * 0.05, 0, TAU); g.fill(); g.stroke();
      }
    },
  },

  // --- Potten & bakken (maat = buitenmaat van pot plus plant; c = kleur van de pot) ---
  {
    id: 'potrond', name: 'Ronde pot met plant', cat: 'Potten & bakken', round: true, w: 0.5, h: 0.5, color: '#b5653a',
    draw(g, w, h, c, lw) {
      potRound(g, w / 2, h / 2, c, lw);
      potPlant(g, w * 0.4, h * 0.4, lw, 7);
    },
  },
  {
    id: 'potvierkant', name: 'Vierkante pot met plant', cat: 'Potten & bakken', round: false, w: 0.5, h: 0.5, color: '#55595e',
    draw(g, w, h, c, lw) {
      potSquare(g, w, h, c, lw);
      potPlant(g, w * 0.4, h * 0.4, lw, 11);
    },
  },
  {
    id: 'potbol', name: 'Pot met bolvorm (buxus)', cat: 'Potten & bakken', round: true, w: 0.6, h: 0.6, color: '#9a968e',
    draw(g, w, h, c, lw) {
      potRound(g, w / 2, h / 2, c, lw);
      g.save();
      g.strokeStyle = POT_GREEN; g.fillStyle = hexA('#3f6f34', 0.45);
      cloud(g, w * 0.4, h * 0.4, 14, 0.06); g.fill(); g.stroke();
      g.globalAlpha = 0.5; g.lineWidth = lw * 0.6;
      cloud(g, w * 0.22, h * 0.22, 9, 0.1); g.stroke();
      g.restore();
    },
  },
  {
    id: 'potgras', name: 'Pot met siergras', cat: 'Potten & bakken', round: true, w: 0.6, h: 0.6, color: '#c9c2b3',
    draw(g, w, h, c, lw) {
      potRound(g, w * 0.38, h * 0.38, c, lw);
      g.save();
      g.strokeStyle = '#8a8238'; g.lineWidth = lw * 0.8;
      g.fillStyle = hexA('#a39a45', 0.15);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill();
      g.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU, k = i % 2 ? 0.5 : 0.42;
        g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(a + 0.25) * w * 0.25, Math.sin(a + 0.25) * h * 0.25, Math.cos(a) * w * k, Math.sin(a) * h * k);
      }
      g.stroke();
      g.restore();
    },
  },
  {
    id: 'potbloei', name: 'Pot met bloeiende plant', cat: 'Potten & bakken', round: true, w: 0.4, h: 0.4, color: '#b5653a',
    draw(g, w, h, c, lw) {
      potRound(g, w / 2, h / 2, c, lw);
      potPlant(g, w * 0.4, h * 0.4, lw, 23);
      g.save();
      const r = rng(17);
      g.fillStyle = hexA('#d0569a', 0.9);
      for (let i = 0; i < 8; i++) {
        const a = r() * TAU, d = 0.08 + r() * 0.22;
        dot(g, Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.045);
      }
      g.restore();
    },
  },
  {
    id: 'potboom', name: 'Pot met boompje (olijf)', cat: 'Potten & bakken', round: true, w: 1.4, h: 1.4, color: '#b5653a',
    draw(g, w, h, c, lw) {
      // de kroon is groter dan de pot; de pot zie je gestippeld door de kroon heen
      g.save();
      g.strokeStyle = '#6f8455'; g.fillStyle = hexA('#8a9a6a', 0.35);
      cloud(g, w / 2, h / 2, 10, 0.14); g.fill(); g.stroke();
      g.globalAlpha = 0.5; g.lineWidth = lw * 0.6;
      cloud(g, w * 0.28, h * 0.28, 7, 0.15); g.stroke();
      g.restore();
      g.save();
      g.setLineDash([lw * 3, lw * 2.5]);
      g.beginPath(); g.ellipse(0, 0, w * 0.22, h * 0.22, 0, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.restore();
      dot(g, 0, 0, Math.max(w * 0.03, lw * 1.5));
    },
  },
  {
    id: 'plantenbak', name: 'Plantenbak (lang)', cat: 'Potten & bakken', round: false, w: 1.2, h: 0.4, color: '#8a4b2a',
    draw(g, w, h, c, lw) {
      potSquare(g, w, h, c, lw);
      const n = Math.max(1, Math.round(w / h));
      for (let i = 0; i < n; i++) {
        g.save();
        g.translate(-w / 2 + (w / n) * (i + 0.5), 0);
        potPlant(g, Math.min(w / n, h) * 0.42, h * 0.42, lw, 31 + i);
        g.restore();
      }
    },
  },
  {
    id: 'potgroep', name: 'Groep van 3 potten', cat: 'Potten & bakken', round: false, w: 1.0, h: 0.8, color: '#b5653a',
    draw(g, w, h, c, lw) {
      const s = Math.min(w, h * 1.25);
      for (const [x, y, d, seed] of [[-0.22, -0.12, 0.5, 3], [0.27, -0.2, 0.36, 9], [0.12, 0.24, 0.32, 13]]) {
        g.save();
        g.translate(x * w, y * h);
        potRound(g, (s * d) / 2, (s * d) / 2, c, lw);
        potPlant(g, s * d * 0.4, s * d * 0.4, lw, seed);
        g.restore();
      }
    },
  },

  // --- Pergola's en overkappingen (B = lengte, D = diepte; c = kleur van hout of metaal) ---
  {
    id: 'overkapping', asHatch: 'pergola', name: 'Houten pergola (dwarsbalken)', cat: 'Pergola\'s & klimplanten', round: false, w: 4, h: 3, color: '#8a6a45', climb: true,
    draw(g, w, h, c, lw, paper, it) {
      const posts = pergolaFrame(g, w, h, c, lw, { front: true, back: true });
      rafters(g, w, h, c, lw);
      climbOver(g, w, h, lw, it, posts);
    },
  },
  {
    id: 'pergolagang', asHatch: 'pergola', name: 'Pergolagang (over een pad)', cat: 'Pergola\'s & klimplanten', round: false, w: 7, h: 2.4, color: '#8a6a45', climb: true,
    draw(g, w, h, c, lw, paper, it) {
      const posts = pergolaFrame(g, w, h, c, lw, { front: true, back: true, span: 2.4 });
      rafters(g, w, h, c, lw, 0.6);
      climbOver(g, w, h, lw, it, posts);
    },
  },
  {
    id: 'pergolamuur', asHatch: 'pergola', name: 'Muurpergola (aan de gevel)', cat: 'Pergola\'s & klimplanten', round: false, w: 4, h: 3, color: '#8a6a45', climb: true,
    draw(g, w, h, c, lw, paper, it) {
      // boven = gevelkant: muurregel tegen de gevel, palen alleen aan de voorkant
      const posts = pergolaFrame(g, w, h, c, lw, { front: true, back: false });
      wood(g, -w / 2, -h / 2, w, 0.07, c);
      rafters(g, w, h, c, lw, 0.45, true);
      climbOver(g, w, h, lw, it, posts);
    },
  },
  {
    id: 'pergolalatten', asHatch: 'pergola', name: 'Pergola met lattenrooster', cat: 'Pergola\'s & klimplanten', round: false, w: 4, h: 3, color: '#9c7a52', climb: true,
    draw(g, w, h, c, lw, paper, it) {
      const posts = pergolaFrame(g, w, h, c, lw, { front: true, back: true });
      rafters(g, w, h, c, lw, 0.6);
      // dunne latten bovenop, haaks op de dwarsbalken
      const ov = Math.min(0.25, h * 0.08);
      for (let y = -h / 2 + ov + 0.2; y < h / 2 - ov - 0.1; y += 0.3) wood(g, -w / 2 + 0.1, y - 0.015, w - 0.2, 0.03, c, 0.7);
      climbOver(g, w, h, lw, it, posts);
    },
  },
  {
    id: 'lamellendak', asHatch: 'lamellen', name: 'Lamellenoverkapping (aluminium)', cat: 'Pergola\'s & klimplanten', round: false, w: 4, h: 3, color: '#3c4146',
    draw(g, w, h, c, lw) {
      const f = 0.16;
      g.fillStyle = hexA(c, 0.12);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill();
      // lamellen dwars op de lengte, iets schuin gezien
      g.save();
      g.lineWidth = lw * 0.6;
      for (let x = -w / 2 + f + 0.1; x < w / 2 - f; x += 0.2) {
        g.fillStyle = hexA(c, 0.28);
        g.beginPath(); g.rect(x, -h / 2 + f, 0.16, h - 2 * f); g.fill(); g.stroke();
      }
      g.restore();
      g.fillStyle = hexA(c, 0.75);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.rect(-w / 2 + f, -h / 2 + f, w - 2 * f, h - 2 * f);
      g.fill('evenodd'); g.stroke();
      g.beginPath(); g.rect(-w / 2 + f, -h / 2 + f, w - 2 * f, h - 2 * f); g.stroke();
      g.fillStyle = c;
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.fillRect(x * (w / 2 - f / 2) - f / 2, y * (h / 2 - f / 2) - f / 2, f, f);
    },
  },
  {
    id: 'veranda', asHatch: 'veranda', name: 'Overkapping met dicht dak', cat: 'Pergola\'s & klimplanten', round: false, w: 4, h: 3, color: '#4a4f55',
    draw(g, w, h, c, lw) {
      // boven = gevelkant; het dak loopt af naar de goot aan de voorkant
      g.fillStyle = hexA('#9fb8c8', 0.3);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.fillStyle = hexA(c, 0.8);
      g.fillRect(-w / 2, -h / 2, w, 0.08);
      g.fillRect(-w / 2, h / 2 - 0.14, w, 0.14);
      g.beginPath(); g.moveTo(-w / 2, h / 2 - 0.2); g.lineTo(w / 2, h / 2 - 0.2); g.stroke();
      const n = Math.max(2, Math.round(w / 0.8));
      for (let i = 0; i <= n; i++) {
        const x = -w / 2 + (w * i) / n;
        g.fillStyle = hexA(c, 0.8);
        g.fillRect(x - (i === 0 ? 0 : i === n ? 0.06 : 0.03), -h / 2, 0.06, h);
      }
      const np = Math.max(2, Math.ceil(w / 3.5) + 1);
      g.fillStyle = c;
      for (let i = 0; i < np; i++) { const x = -w / 2 + 0.06 + ((w - 0.12) * i) / (np - 1); g.fillRect(x - 0.06, h / 2 - 0.12, 0.12, 0.12); }
      // afschot naar de goot
      g.save(); g.lineWidth = lw * 0.8; g.globalAlpha = 0.7;
      const ax = w * 0.18, s = Math.min(h * 0.12, 0.3);
      g.beginPath(); g.moveTo(ax, -h * 0.25); g.lineTo(ax, h * 0.2); g.moveTo(ax - s * 0.5, h * 0.2 - s); g.lineTo(ax, h * 0.2); g.lineTo(ax + s * 0.5, h * 0.2 - s); g.stroke();
      g.restore();
    },
  },
  {
    id: 'verandaterras', asHatch: 'veranda', name: 'Veranda (terras met overkapping)', cat: 'Pergola\'s & klimplanten', round: false, w: 5, h: 3.5, color: '#4a4f55',
    draw(g, w, h, c, lw) {
      // boven = gevel. Een vlonder onder een glazen dak, palen en goot aan de voorkant,
      // glazen schuifwanden aan de zijkanten.
      g.fillStyle = hexA('#b08a5a', 0.35);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill();
      g.save();
      g.strokeStyle = hexA('#7a5a35', 0.55); g.lineWidth = lw * 0.5;
      g.beginPath();
      for (let y = -h / 2 + 0.145; y < h / 2 - 0.05; y += 0.145) { g.moveTo(-w / 2, y); g.lineTo(w / 2, y); }
      g.stroke();
      g.restore();
      // glazen dak
      g.fillStyle = hexA('#9fc3d8', 0.28);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.fillStyle = hexA(c, 0.85);
      g.fillRect(-w / 2, -h / 2, w, 0.08);
      g.fillRect(-w / 2, h / 2 - 0.15, w, 0.15);
      const n = Math.max(2, Math.round(w / 0.85));
      for (let i = 1; i < n; i++) g.fillRect(-w / 2 + (w * i) / n - 0.03, -h / 2, 0.06, h - 0.15);
      // zijwanden van glas (schuifpanelen)
      g.save();
      g.lineWidth = lw * 0.8;
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) {
        g.fillStyle = hexA(c, 0.85); g.fillRect(x - 0.06, -h / 2, 0.12, h);
        g.strokeStyle = hexA('#e8f2f8', 1);
        g.beginPath(); g.moveTo(x - 0.02, -h / 2 + 0.1); g.lineTo(x - 0.02, h / 2 * 0.1); g.moveTo(x + 0.02, -h / 2 * 0.1); g.lineTo(x + 0.02, h / 2 - 0.2); g.stroke();
      }
      g.restore();
      const np = Math.max(2, Math.ceil(w / 3.5) + 1);
      g.fillStyle = c;
      for (let i = 0; i < np; i++) { const x = -w / 2 + 0.06 + ((w - 0.12) * i) / (np - 1); g.fillRect(x - 0.06, h / 2 - 0.13, 0.12, 0.12); }
      g.save(); g.lineWidth = lw * 0.8; g.globalAlpha = 0.7;
      const ax = w * 0.22, sz = Math.min(h * 0.1, 0.3);
      g.beginPath(); g.moveTo(ax, -h * 0.25); g.lineTo(ax, h * 0.2); g.moveTo(ax - sz * 0.5, h * 0.2 - sz); g.lineTo(ax, h * 0.2); g.lineTo(ax + sz * 0.5, h * 0.2 - sz); g.stroke();
      g.restore();
    },
  },
  {
    id: 'rozenboog', name: 'Rozenboog', cat: 'Pergola\'s & klimplanten', round: false, w: 1.4, h: 0.5, color: '#3d3d3d', climb: true, defaults: { grow: 'vol', growKind: 'roos' },
    draw(g, w, h, c, lw, paper, it) {
      // je loopt er van boven naar beneden doorheen; links en rechts de zijkanten
      const r = 0.03;
      g.save();
      g.lineWidth = lw * 1.2;
      for (const x of [-w / 2 + r, w / 2 - r]) { g.beginPath(); g.moveTo(x, -h / 2 + r); g.lineTo(x, h / 2 - r); g.stroke(); }
      for (const y of [-h / 2 + r, h / 2 - r]) { g.beginPath(); g.moveTo(-w / 2 + r, y); g.lineTo(w / 2 - r, y); g.stroke(); }
      g.lineWidth = lw * 0.6;
      for (let y = -h / 2 + 0.12; y < h / 2 - 0.08; y += 0.12) { g.beginPath(); g.moveTo(-w / 2 + r, y); g.lineTo(w / 2 - r, y); g.stroke(); }
      g.restore();
      g.fillStyle = c;
      const posts = [];
      for (const x of [-w / 2 + r, w / 2 - r]) for (const y of [-h / 2 + r, h / 2 - r]) { dot(g, x, y, r * 1.4); posts.push([x, y]); }
      climbOver(g, w, h, lw, it, posts);
    },
  },
  {
    id: 'klimplant', name: 'Klimplant (langs muur, schutting of hek)', cat: 'Pergola\'s & klimplanten', round: false, w: 2.5, h: 0.5, color: '#4f7f36', climbPlant: true, defaults: { grow: 'vol', growKind: 'groen' },
    draw(g, w, h, c, lw, paper, it) {
      // bovenkant = de muur of het hek; het plantgat staat ervoor (onder)
      const kind = CLIMBERS[it?.growKind || 'groen'] || CLIMBERS.groen;
      const px = -w / 2 + Math.min(0.35, w * 0.15), py = h * 0.18;
      const band = [];
      const n = Math.max(3, Math.round(w / 0.35));
      for (let i = 0; i < n; i++) band.push([-w / 2 + (w * (i + 0.5)) / n, -h * 0.22]);
      g.save();
      g.strokeStyle = hexA('#5b4a32', 0.8); g.lineWidth = lw * 0.8;
      g.beginPath();
      for (let i = 0; i < band.length; i += 2) { g.moveTo(px, py); g.quadraticCurveTo(px, band[i][1], band[i][0], band[i][1]); }
      g.stroke();
      g.restore();
      foliage(g, band, Math.min(h * 0.42, w / n * 0.95), lw, kind, 7, c);
      g.save();
      g.fillStyle = hexA(c, 0.35);
      g.beginPath(); g.ellipse(px, py, h * 0.22, h * 0.22, 0, 0, TAU); g.fill(); g.stroke();
      g.restore();
      g.fillStyle = c; dot(g, px, py, lw * 1.6);
    },
  },

  // --- Meubilair ---
  {
    id: 'tafelrond', name: 'Ronde tafel (4)', cat: 'Meubilair', round: true, w: 2.4, h: 2.4, color: '#7a6a58',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      const s = w * 0.2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        chair(g, Math.cos(a) * w * 0.36, Math.sin(a) * h * 0.36, s, a + Math.PI / 2);
      }
      g.fillStyle = hexA(c, 0.25);
      g.beginPath(); g.ellipse(0, 0, w * 0.25, h * 0.25, 0, 0, TAU); g.fill(); g.stroke();
    },
  },
  {
    id: 'tafel6', name: 'Tafel (6)', cat: 'Meubilair', round: false, w: 2.6, h: 2.0, color: '#7a6a58',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      const tw = w * 0.7, th = h * 0.45, s = Math.min(0.5, h * 0.22);
      for (let i = 0; i < 3; i++) {
        const x = -tw / 2 + (tw / 3) * (i + 0.5);
        chair(g, x, -th / 2 - s * 0.7, s, Math.PI);
        chair(g, x, th / 2 + s * 0.7, s, 0);
      }
      g.fillStyle = hexA(c, 0.25);
      g.beginPath(); g.rect(-tw / 2, -th / 2, tw, th); g.fill(); g.stroke();
    },
  },
  {
    id: 'loungebank', name: 'Loungebank', cat: 'Meubilair', round: false, w: 2.6, h: 2.0, color: '#6c7a89',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.25);
      const d = Math.min(w, h) * 0.38;
      g.beginPath();
      g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(w / 2, -h / 2 + d);
      g.lineTo(-w / 2 + d, -h / 2 + d); g.lineTo(-w / 2 + d, h / 2); g.lineTo(-w / 2, h / 2);
      g.closePath(); g.fill(); g.stroke();
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo(-w / 2 + d * 0.3, -h / 2 + d * 0.3); g.lineTo(w / 2, -h / 2 + d * 0.3);
      g.moveTo(-w / 2 + d * 0.3, -h / 2 + d * 0.3); g.lineTo(-w / 2 + d * 0.3, h / 2);
      g.stroke();
    },
  },
  {
    id: 'ligbed', name: 'Ligbed', cat: 'Meubilair', round: false, w: 0.7, h: 2.0, color: '#6c7a89',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.25);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-w / 2, -h / 2 + h * 0.3); g.lineTo(w / 2, -h / 2 + h * 0.3); g.stroke();
    },
  },
  {
    id: 'parasol', name: 'Parasol', cat: 'Meubilair', round: true, w: 3, h: 3, color: '#c27c3a',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * TAU;
        const x = Math.cos(a) * w / 2, y = Math.sin(a) * h / 2;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.fill(); g.stroke();
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 8) * TAU;
        g.moveTo(Math.cos(a) * w / 2, Math.sin(a) * h / 2);
        g.lineTo(-Math.cos(a) * w / 2, -Math.sin(a) * h / 2);
      }
      g.stroke();
    },
  },
  {
    id: 'bbq', name: 'Barbecue', cat: 'Meubilair', round: true, w: 0.6, h: 0.6, color: '#333333',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath();
      for (let i = -2; i <= 2; i++) { g.moveTo(-w * 0.35, i * h * 0.12); g.lineTo(w * 0.35, i * h * 0.12); }
      g.stroke();
    },
  },
  {
    id: 'bank', name: 'Tuinbank', cat: 'Meubilair', round: false, w: 1.8, h: 0.6, color: '#7a6a58',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.2);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h * 0.22); g.stroke();
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-w / 2, -h / 2 + h * 0.22 + i * h * 0.195); g.lineTo(w / 2, -h / 2 + h * 0.22 + i * h * 0.195); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1; }
    },
  },

  {
    id: 'zitbank', name: 'Bank zonder leuning', cat: 'Meubilair', round: false, w: 1.5, h: 0.45, color: '#7a6a58',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.2);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.globalAlpha = 0.5;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-w / 2, -h / 2 + (h * i) / 4); g.lineTo(w / 2, -h / 2 + (h * i) / 4); g.stroke(); }
      g.globalAlpha = 1;
    },
  },
  {
    id: 'bankhalfrond', name: 'Halfronde bank', cat: 'Meubilair', round: false, w: 2.6, h: 1.3, color: '#7a6a58',
    draw(g, w, h, c, lw) {
      // halve ring, rugleuning aan de buitenkant; open kant onder
      const R = w / 2, d = Math.min(0.5, R * 0.45), cy = h / 2;
      g.fillStyle = hexA(c, 0.2);
      g.beginPath(); g.arc(0, cy, R, Math.PI, TAU); g.arc(0, cy, R - d, TAU, Math.PI, true); g.closePath(); g.fill(); g.stroke();
      g.lineWidth = lw * 1.6;
      g.beginPath(); g.arc(0, cy, R - d * 0.15, Math.PI, TAU); g.stroke();
      g.lineWidth = lw * 0.6;
      g.globalAlpha = 0.5;
      for (let i = 1; i < 8; i++) { const a = Math.PI + (i / 8) * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * (R - d), cy + Math.sin(a) * (R - d)); g.lineTo(Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97); g.stroke(); }
      g.globalAlpha = 1;
    },
  },
  {
    id: 'boombank', name: 'Boombank (rond om een boom)', cat: 'Meubilair', round: true, w: 2.2, h: 2.2, color: '#7a6a58',
    draw(g, w, h, c, lw) {
      const R = w / 2, r = R - Math.min(0.5, R * 0.45);
      g.fillStyle = hexA(c, 0.2);
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.arc(0, 0, r, TAU, 0, true); g.fill('evenodd'); g.stroke();
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.lineWidth = lw * 0.6;
      g.globalAlpha = 0.5;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
      g.globalAlpha = 1;
    },
  },
  {
    id: 'tuinstoel', name: 'Tuinstoel', cat: 'Meubilair', round: false, w: 0.6, h: 0.6, color: '#7a6a58',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.2);
      chairTop(g, w, h, { arms: false });
    },
  },
  {
    id: 'loungestoel', name: 'Loungestoel', cat: 'Meubilair', round: false, w: 0.85, h: 0.85, color: '#6c7a89',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.25);
      chairTop(g, w, h, { arms: true, back: 0.28, r: 0.12 });
    },
  },
  {
    id: 'bistrostoel', name: 'Bistrostoel', cat: 'Meubilair', round: false, w: 0.45, h: 0.48, color: '#3d4f5c',
    draw(g, w, h, c, lw) {
      // rond zitje met gebogen rugleuning (onder)
      g.fillStyle = hexA(c, 0.2);
      g.beginPath(); g.ellipse(0, -h * 0.06, w * 0.46, h * 0.4, 0, 0, TAU); g.fill(); g.stroke();
      g.lineWidth = lw * 1.8;
      g.beginPath(); g.ellipse(0, -h * 0.06, w * 0.46, h * 0.44, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
    },
  },
  {
    id: 'terrastafel', name: 'Terrastafel 80×80', cat: 'Meubilair', round: false, w: 0.8, h: 0.8, color: '#7a6a58',
    draw(g, w, h, c, lw) { tableTop(g, w, h, c, lw); },
  },
  {
    id: 'terrastafelrecht', name: 'Terrastafel 160×90', cat: 'Meubilair', round: false, w: 1.6, h: 0.9, color: '#7a6a58',
    draw(g, w, h, c, lw) { tableTop(g, w, h, c, lw); },
  },
  {
    id: 'tafelrondlos', name: 'Ronde tafel Ø 1,0 m', cat: 'Meubilair', round: true, w: 1.0, h: 1.0, color: '#7a6a58',
    draw(g, w, h, c, lw) { tableTop(g, w, h, c, lw, true); },
  },
  {
    id: 'bistrotafel', name: 'Bistrotafel Ø 0,6 m', cat: 'Meubilair', round: true, w: 0.6, h: 0.6, color: '#3d4f5c',
    draw(g, w, h, c, lw) {
      tableTop(g, w, h, c, lw, true);
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.06, lw));
    },
  },
  {
    id: 'bistroset', name: 'Bistroset (tafel + 2 stoelen)', cat: 'Meubilair', round: false, w: 1.45, h: 0.62, color: '#3d4f5c',
    draw(g, w, h, c, lw) {
      const t = Math.min(h, w * 0.42);
      g.save(); tableTop(g, t, t, c, lw, true); g.fillStyle = c; dot(g, 0, 0, Math.max(t * 0.06, lw)); g.restore();
      for (const sx of [-1, 1]) {
        g.save();
        g.translate(sx * (t / 2 + (w / 2 - t / 2) * 0.5), 0);
        g.rotate(sx > 0 ? -Math.PI / 2 : Math.PI / 2);
        const s = Math.min(w / 2 - t / 2, h) * 0.95;
        g.fillStyle = hexA(c, 0.2);
        g.beginPath(); g.ellipse(0, -s * 0.06, s * 0.46, s * 0.4, 0, 0, TAU); g.fill(); g.stroke();
        g.lineWidth = lw * 1.8;
        g.beginPath(); g.ellipse(0, -s * 0.06, s * 0.46, s * 0.44, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
        g.restore();
      }
    },
  },
  {
    id: 'picknicktafel', name: 'Picknicktafel', cat: 'Meubilair', round: false, w: 1.8, h: 1.6, color: '#7a6a58',
    draw(g, w, h, c, lw) {
      const th = h * 0.44, bh = h * 0.19;
      g.fillStyle = hexA(c, 0.22);
      g.beginPath(); g.rect(-w / 2, -th / 2, w, th); g.fill(); g.stroke();
      g.globalAlpha = 0.5;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-w / 2, -th / 2 + (th * i) / 4); g.lineTo(w / 2, -th / 2 + (th * i) / 4); g.stroke(); }
      g.globalAlpha = 1;
      g.fillStyle = hexA(c, 0.18);
      for (const sy of [-1, 1]) { g.beginPath(); g.rect(-w / 2, sy > 0 ? h / 2 - bh : -h / 2, w, bh); g.fill(); g.stroke(); }
      g.lineWidth = lw * 0.6;
      g.beginPath(); for (const x of [-w * 0.38, w * 0.38]) { g.moveTo(x, -h / 2 + bh); g.lineTo(x, -th / 2); g.moveTo(x, th / 2); g.lineTo(x, h / 2 - bh); } g.stroke();
    },
  },

  // --- Huis: deuren, ramen en puien (bovenaanzicht; h = muurdikte, ze klikken in een muur) ---
  {
    id: 'hek_schutting', name: 'Houten schutting', cat: 'Hekwerk en poorten', fenceTool: 'schutting', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'schutting', lw); },
  },
  {
    id: 'hek_houtbeton', name: 'Hout-betonschutting', cat: 'Hekwerk en poorten', fenceTool: 'houtbeton', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'houtbeton', lw); },
  },
  {
    id: 'hek_lamellen', name: 'Lamellenschutting', cat: 'Hekwerk en poorten', fenceTool: 'lamellen', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'lamellen', lw); },
  },
  {
    id: 'hek_dubbelstaaf', name: 'Dubbelstaafmat / gaashek', cat: 'Hekwerk en poorten', fenceTool: 'dubbelstaaf', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'dubbelstaaf', lw); },
  },
  {
    id: 'hek_vlecht', name: 'Wilgentenen vlechtscherm', cat: 'Hekwerk en poorten', fenceTool: 'vlecht', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'vlecht', lw); },
  },
  {
    id: 'hek_groen', name: 'Groenscherm (klimop)', cat: 'Hekwerk en poorten', fenceTool: 'groen', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'groen', lw); },
  },
  {
    id: 'hek_gabion', name: 'Schanskorf (gabion)', cat: 'Hekwerk en poorten', fenceTool: 'gabion', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'gabion', lw); },
  },
  {
    id: 'hek_spijlen', name: 'Spijlenhek (terras)', cat: 'Hekwerk en poorten', fenceTool: 'spijlen', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'spijlen', lw); },
  },
  {
    id: 'hek_glas', name: 'Glazen windscherm (terras)', cat: 'Hekwerk en poorten', fenceTool: 'glas', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'glas', lw); },
  },
  {
    id: 'hek_hekje', name: 'Laag houten hekje (terras)', cat: 'Hekwerk en poorten', fenceTool: 'hekje', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'hekje', lw); },
  },
  {
    id: 'hek_touw', name: 'Palen met touw (terras)', cat: 'Hekwerk en poorten', fenceTool: 'touw', w: 2.4, h: 0.3, color: '#555555',
    draw(g, w, h, c, lw) { if (!fillOverride.paper) drawFence(g, [[-w / 2, 0], [w / 2, 0]], false, 'touw', lw); },
  },
  {
    id: 'poort', name: 'Tuinpoort (1,0 m)', cat: 'Hekwerk en poorten', opening: true, swing: true, w: 1.0, h: 0.05, color: '#6b4f33',
    draw(g, w, h, c, lw, paper) { openingMask(g, w, h, lw, paper); gatePosts(g, w, h, c, lw); doorLeaf(g, -w / 2, h / 2, w, 1, lw * 1.6); },
  },
  {
    id: 'poortdubbel', name: 'Dubbele poort / inrijpoort (3,0 m)', cat: 'Hekwerk en poorten', opening: true, swing: true, w: 3.0, h: 0.05, color: '#6b4f33',
    draw(g, w, h, c, lw, paper) { openingMask(g, w, h, lw, paper); gatePosts(g, w, h, c, lw); doorLeaf(g, -w / 2, h / 2, w / 2, 1, lw * 1.6); doorLeaf(g, w / 2, h / 2, w / 2, -1, lw * 1.6); },
  },
  {
    id: 'schuifpoort', name: 'Schuifpoort (4,0 m)', cat: 'Hekwerk en poorten', opening: true, w: 4.0, h: 0.05, color: '#3c4146',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper); gatePosts(g, w, h, c, lw);
      // het poortblad schuift langs het hek (open getekend, iets naast de lijn)
      const y = h / 2 + 0.06;
      g.save(); g.lineWidth = lw * 2; g.beginPath(); g.moveTo(-w / 2 - w * 0.9, y); g.lineTo(-w / 2 + 0.05, y); g.stroke(); g.restore();
      arrow(g, w * 0.1, -w * 0.3, y + Math.min(0.25, w * 0.06), lw);
    },
  },
  {
    id: 'hekjeterras', name: 'Terrashekje (0,9 m)', cat: 'Hekwerk en poorten', opening: true, swing: true, w: 0.9, h: 0.04, color: '#2b2b2b',
    draw(g, w, h, c, lw, paper) { openingMask(g, w, h, lw, paper); gatePosts(g, w, h, c, lw); doorLeaf(g, -w / 2, h / 2, w, 1, lw * 1.2); },
  },
  {
    id: 'doorgang', name: 'Doorgang zonder poort', cat: 'Hekwerk en poorten', opening: true, w: 1.2, h: 0.05, color: '#6b4f33',
    draw(g, w, h, c, lw, paper) { openingMask(g, w, h, lw, paper); gatePosts(g, w, h, c, lw); },
  },
  {
    id: 'deur', name: 'Binnendeur', cat: 'Huis: deuren en ramen', opening: true, swing: true, w: 0.93, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) { openingMask(g, w, h, lw, paper); doorLeaf(g, -w / 2, h / 2, w, 1, lw); },
  },
  {
    id: 'buitendeur', name: 'Buitendeur', cat: 'Huis: deuren en ramen', opening: true, swing: true, w: 1.0, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      // dorpel
      g.lineWidth = lw * 0.6;
      g.beginPath(); g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, h / 2); g.stroke();
      doorLeaf(g, -w / 2, h / 2, w, 1, lw);
    },
  },
  {
    id: 'dubbeledeur', name: 'Dubbele deur', cat: 'Huis: deuren en ramen', opening: true, swing: true, w: 1.6, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      doorLeaf(g, -w / 2, h / 2, w / 2, 1, lw);
      doorLeaf(g, w / 2, h / 2, w / 2, -1, lw);
    },
  },
  {
    id: 'openslaand', name: 'Openslaande tuindeuren', cat: 'Huis: deuren en ramen', opening: true, swing: true, w: 1.8, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      glass(g, -w / 2, w / 2, 0, h, lw);
      doorLeaf(g, -w / 2, h / 2, w / 2, 1, lw);
      doorLeaf(g, w / 2, h / 2, w / 2, -1, lw);
    },
  },
  {
    id: 'schuifdeur', name: 'Schuifdeur', cat: 'Huis: deuren en ramen', opening: true, w: 1.0, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      g.lineWidth = lw * 1.6;
      g.beginPath();
      g.moveTo(-w / 2, -h * 0.1); g.lineTo(w * 0.08, -h * 0.1);
      g.moveTo(-w * 0.08, h * 0.1); g.lineTo(w / 2, h * 0.1);
      g.stroke();
      arrow(g, -w * 0.3, w * 0.1, h / 2 + Math.min(0.15, w * 0.12), lw);
    },
  },
  {
    id: 'raam', name: 'Raam', cat: 'Huis: deuren en ramen', opening: true, w: 1.2, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2);
      g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, h / 2);
      g.stroke();
      glass(g, -w / 2, w / 2, 0, h, lw);
    },
  },
  {
    id: 'schuifpui', name: 'Schuifpui', cat: 'Huis: deuren en ramen', opening: true, w: 3.0, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      glass(g, -w / 2, w * 0.04, -h * 0.12, h, lw);
      glass(g, -w * 0.04, w / 2, h * 0.12, h, lw);
      arrow(g, w * 0.05, w * 0.35, h / 2 + Math.min(0.18, w * 0.06), lw);
    },
  },

  // --- Bouw & water ---
  {
    id: 'schuur', name: 'Schuur / berging', cat: 'Bouw & water', round: false, w: 3, h: 2.5, color: '#6b4f3a',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.15);
      g.lineWidth = lw * 1.6;
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.lineWidth = lw * 0.6;
      g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, h / 2); g.moveTo(w / 2, -h / 2); g.lineTo(-w / 2, h / 2); g.stroke();
    },
  },
  {
    id: 'schuurgroen', name: 'Schuur met groen dak (sedum / mos)', cat: 'Bouw & water', round: false, w: 3, h: 2.5, color: '#6b4f3a',
    draw(g, w, h, c, lw) { greenRoof(g, w, h, c, lw, 'sedum'); },
  },
  {
    id: 'schuurmos', name: 'Schuurtje met mosdak', cat: 'Bouw & water', round: false, w: 2, h: 1.6, color: '#6b4f3a',
    draw(g, w, h, c, lw) { greenRoof(g, w, h, c, lw, 'mos'); },
  },
  {
    id: 'kas', name: 'Kas', cat: 'Bouw & water', round: false, w: 2.5, h: 3, color: '#4a7c8c',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.12);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath();
      for (let x = -w / 2 + w / 4; x < w / 2 - 1e-6; x += w / 4) { g.moveTo(x, -h / 2); g.lineTo(x, h / 2); }
      g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0);
      g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
    },
  },
  {
    id: 'vijver', name: 'Vijver', cat: 'Bouw & water', round: true, w: 3, h: 2, color: '#3d7fb5',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.25);
      blob(g, w / 2, h / 2, 13, 9, 0.15);
      g.fill(); g.stroke();
      g.lineWidth = lw * 0.6;
      g.globalAlpha = 0.6;
      for (let i = -1; i <= 1; i++) {
        const y = i * h * 0.15, x = i * w * 0.05;
        g.beginPath();
        g.moveTo(x - w * 0.15, y);
        g.quadraticCurveTo(x - w * 0.075, y - h * 0.05, x, y);
        g.quadraticCurveTo(x + w * 0.075, y + h * 0.05, x + w * 0.15, y);
        g.stroke();
      }
      g.globalAlpha = 1;
    },
  },
  {
    id: 'trampoline', name: 'Trampoline', cat: 'Bouw & water', round: true, w: 3.66, h: 3.66, color: '#2c3e50',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.12);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, w * 0.42, h * 0.42, 0, 0, TAU); g.stroke();
    },
  },
  {
    id: 'zandbak', name: 'Zandbak', cat: 'Bouw & water', round: false, w: 1.5, h: 1.5, color: '#c9a65a',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.3);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath(); g.rect(-w / 2 + lw * 4, -h / 2 + lw * 4, w - lw * 8, h - lw * 8); g.stroke();
    },
  },
  {
    id: 'kliko', name: 'Kliko 240 L (rolcontainer)', cat: 'Bouw & water', round: false, w: 0.58, h: 0.74, color: '#4f7f36',
    draw(g, w, h, c, lw) { drawBin(g, w, h, c, lw); },
  },
  {
    id: 'kliko140', name: 'Kliko 140 L', cat: 'Bouw & water', round: false, w: 0.48, h: 0.56, color: '#5a5f66',
    draw(g, w, h, c, lw) { drawBin(g, w, h, c, lw); },
  },
  {
    id: 'kliko3', name: 'Kliko\'s: rest, gft en papier', cat: 'Bouw & water', round: false, w: 1.86, h: 0.74, color: '#5a5f66',
    draw(g, w, h, c, lw) {
      const bw = (w - 0.06) / 3;
      for (const [k, col] of [[0, c], [1, '#4f7f36'], [2, '#2f5f9e']]) {
        g.save(); g.translate(-w / 2 + bw / 2 + k * (bw + 0.03), 0);
        g.strokeStyle = col; drawBin(g, bw, h, col, lw);
        g.restore();
      }
    },
  },
  {
    id: 'regenton', name: 'Regenton', cat: 'Bouw & water', round: true, w: 0.6, h: 0.6, color: '#3d7fb5',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.3);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, w * 0.3, h * 0.3, 0, 0, TAU); g.stroke();
    },
  },
  {
    id: 'stapsteen', name: 'Stapsteen', cat: 'Bouw & water', round: true, w: 0.5, h: 0.4, color: '#8c8c8c',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.35);
      blob(g, w / 2, h / 2, 23, 7, 0.12);
      g.fill(); g.stroke();
    },
  },
  {
    id: 'auto', name: 'Auto', cat: 'Bouw & water', round: false, w: 1.8, h: 4.5, color: '#555555',
    draw(g, w, h, c, lw) {
      // bovenaanzicht, neus boven: carrosserie, ruiten, dak, spiegels en wielen
      const rr = (x, y, ww, hh, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, ww, hh, r) : g.rect(x, y, ww, hh); };
      g.fillStyle = hexA(c, 0.55);
      for (const sx of [-1, 1]) for (const sy of [-0.3, 0.3]) { rr(sx * w / 2 - (sx > 0 ? w * 0.07 : 0), sy * h - h * 0.07, w * 0.07, h * 0.14, w * 0.02); g.fill(); }
      g.fillStyle = hexA(c, 0.12);
      rr(-w / 2, -h / 2, w, h, [w * 0.32, w * 0.32, w * 0.2, w * 0.2]);
      g.fill(); g.stroke();
      // spiegels
      g.fillStyle = hexA(c, 0.3);
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * (w / 2 + w * 0.05), -h * 0.15, w * 0.06, h * 0.025, 0, 0, TAU); g.fill(); g.stroke(); }
      // voorruit, dak, achterruit
      g.lineWidth = lw * 0.8;
      g.fillStyle = hexA(c, 0.35);
      g.beginPath();
      g.moveTo(-w * 0.4, -h * 0.13); g.quadraticCurveTo(0, -h * 0.2, w * 0.4, -h * 0.13);
      g.lineTo(w * 0.36, -h * 0.03); g.lineTo(-w * 0.36, -h * 0.03); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = hexA(c, 0.18);
      rr(-w * 0.36, -h * 0.03, w * 0.72, h * 0.27, w * 0.06); g.fill(); g.stroke();
      g.fillStyle = hexA(c, 0.35);
      g.beginPath();
      g.moveTo(-w * 0.36, h * 0.24); g.lineTo(w * 0.36, h * 0.24);
      g.lineTo(w * 0.38, h * 0.33); g.quadraticCurveTo(0, h * 0.37, -w * 0.38, h * 0.33); g.closePath(); g.fill(); g.stroke();
      // motorkap-lijnen
      g.globalAlpha = 0.45;
      g.beginPath(); g.moveTo(-w * 0.22, -h * 0.46); g.lineTo(-w * 0.3, -h * 0.2); g.moveTo(w * 0.22, -h * 0.46); g.lineTo(w * 0.3, -h * 0.2); g.stroke();
      g.globalAlpha = 1;
    },
  },

  // --- Overig ---
  {
    id: 'noordpijl', name: 'Noordpijl', cat: 'Overig', round: true, w: 2, h: 2, color: '#222222', fixedPaper: true,
    draw(g, w, h, c, lw) {
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.stroke();
      g.fillStyle = c;
      g.beginPath(); g.moveTo(0, -h * 0.45); g.lineTo(w * 0.16, h * 0.25); g.lineTo(0, h * 0.12); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, -h * 0.45); g.lineTo(-w * 0.16, h * 0.25); g.lineTo(0, h * 0.12); g.closePath(); g.stroke();
      g.save();
      g.translate(0, -h * 0.62);
      const s = h * 0.003;
      g.scale(s, s);
      g.font = 'bold 60px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('N', 0, 0);
      g.restore();
    },
  },
  {
    id: 'persoon', name: 'Persoon (schaal)', cat: 'Overig', round: true, w: 0.6, h: 0.6, color: '#444444',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      g.beginPath(); g.ellipse(0, 0, w / 2, h * 0.3, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, w * 0.2, h * 0.2, 0, 0, TAU); g.fill(); g.stroke();
    },
  },
];

export const STENCIL_MAP = Object.fromEntries(STENCILS.map((s) => [s.id, s]));

// ---- hulpjes voor deuren en ramen

/** Muur ter plekke van de opening wegvlakken (papierkleur) en de dagkanten tekenen. */
function openingMask(g, w, h, lw, paper) {
  g.save();
  g.fillStyle = paper || '#fbfaf6';
  g.fillRect(-w / 2, -h / 2 - lw, w, h + lw * 2);
  g.lineWidth = lw * 1.4;
  g.beginPath();
  g.moveTo(-w / 2, -h / 2); g.lineTo(-w / 2, h / 2);
  g.moveTo(w / 2, -h / 2); g.lineTo(w / 2, h / 2);
  g.stroke();
  g.restore();
}

/** Stevige palen aan beide kanten van een poort. */
function gatePosts(g, w, h, c, lw) {
  const p = Math.max(0.08, h * 1.6);
  g.save();
  g.fillStyle = hexA(c, 0.95);
  g.lineWidth = lw * 0.6;
  for (const x of [-w / 2, w / 2]) { g.beginPath(); g.rect(x - p / 2, -p / 2, p, p); g.fill(); g.stroke(); }
  g.restore();
}

/** Deurblad met draaicirkel: scharnier (hx, hy), breedte r, dir +1 = draait naar rechts open. */
function doorLeaf(g, hx, hy, r, dir, lw) {
  g.save();
  g.lineWidth = lw * 1.3;
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx, hy + r); g.stroke();
  g.lineWidth = lw * 0.6;
  g.beginPath();
  if (dir > 0) g.arc(hx, hy, r, 0, Math.PI / 2);
  else g.arc(hx, hy, r, Math.PI / 2, Math.PI);
  g.stroke();
  g.restore();
}

/** Glas: dubbele dunne lijn over de opening. */
function glass(g, x0, x1, y, h, lw) {
  const d = Math.min(h * 0.08, 0.025);
  g.save();
  g.lineWidth = lw * 0.6;
  g.beginPath();
  g.moveTo(x0, y - d); g.lineTo(x1, y - d);
  g.moveTo(x0, y + d); g.lineTo(x1, y + d);
  g.stroke();
  g.restore();
}

function arrow(g, x0, x1, y, lw) {
  const k = Math.abs(x1 - x0) * 0.18;
  g.save();
  g.lineWidth = lw * 0.6;
  g.beginPath();
  g.moveTo(x0, y); g.lineTo(x1, y);
  g.moveTo(x1 - k, y - k * 0.6); g.lineTo(x1, y); g.lineTo(x1 - k, y + k * 0.6);
  g.stroke();
  g.restore();
}

/** Teken een stencil-item (wereldcoördinaten). paper: achtergrondkleur (voor openingen in muren). */
export function drawStencil(g, item, lw, paper) {
  const def = STENCIL_MAP[item.symbol];
  if (!def) return;
  g.save();
  g.translate(item.x, item.y);
  g.rotate(item.rot || 0);
  if (item.mirror) g.scale(-1, 1);
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const c = item.color || def.color;
  const view = def.defaults ? { ...def.defaults, ...item } : item;
  if (!item.see && !def.opening && !def.fixedPaper) {
    // dichte ondergrond: het stencil eerst één keer in papierkleur tekenen, zodat precies zijn eigen
    // vorm afdekt wat eronder ligt (geen rechthoek met witte hoeken, geen vlak tussen de stoelen)
    const P = paper || '#fbfaf6';
    g.save();
    fillOverride.paper = P;
    g.strokeStyle = P;
    g.fillStyle = P;
    try {
      def.draw(g, item.w, item.h, P, lw, P, view);
    } finally {
      fillOverride.paper = null;
    }
    g.restore();
  }
  g.strokeStyle = c;
  g.fillStyle = c;
  fillOverride.line = item.fillColor || item.fillAlpha != null ? c : null;
  fillOverride.color = item.fillColor || null;
  fillOverride.alpha = item.fillAlpha ?? null;
  try {
    def.draw(g, item.w, item.h, c, lw, paper, view);
  } finally {
    fillOverride.line = null;
  }
  g.restore();
}
