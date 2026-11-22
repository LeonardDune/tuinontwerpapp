// Planten in 3D. Elke plant is opgebouwd uit kleine 'kaartjes' met een doorzichtige textuur (bladeren,
// grassprieten, varenbladen, bloemen in de vorm van hun bloeiwijze) aan stengels en takken. Per soort
// wordt één model gemaakt in een paar varianten, dat in de vakken vaak herhaald wordt (instancing).
// Kleuren zitten in de hoekpunten (blad, bloei, herfst, winter van de gekozen maand), met naar de grond
// toe wat donkerder (schaduw binnenin de plant).

import { plantShape } from './plantdraw.js';

const S = 256; // celgrootte in de textuuratlas (4 × 4 cellen)
export const CELL = { leaf: 0, leafRound: 1, leafBig: 2, blade: 3, fern: 4, daisy: 5, umbel: 6, spike: 7, plume: 8, ball: 9, cluster: 10, needles: 11, bark: 12, cup: 13, florets: 14, rose: 15 };

function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ------------------------------------------------------------------ textuur

function shade(v) {
  const c = Math.round(Math.max(0, Math.min(255, v)));
  return `rgb(${c},${c},${c})`;
}

function leafPath(g, w, len, round = 0.5) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(w * (0.6 + round * 0.5), -len * 0.15, w * (0.5 + round * 0.4), -len * 0.75, 0, -len);
  g.bezierCurveTo(-w * (0.5 + round * 0.4), -len * 0.75, -w * (0.6 + round * 0.5), -len * 0.15, 0, 0);
}

function fillLeaf(g, w, len, round, tone) {
  leafPath(g, w, len, round);
  const gr = g.createLinearGradient(-w, 0, w, 0);
  gr.addColorStop(0, shade(tone * 0.78));
  gr.addColorStop(0.5, shade(tone));
  gr.addColorStop(1, shade(tone * 0.7));
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = shade(tone * 0.62);
  g.lineWidth = Math.max(1, w * 0.06);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -len * 0.92);
  g.stroke();
}

const DRAW = [
  // 0 smal blad
  (g, r) => { g.translate(S / 2, S - 4); fillLeaf(g, 58, S - 12, 0.2, 245); },
  // 1 rond blad
  (g, r) => { g.translate(S / 2, S - 4); fillLeaf(g, 100, S - 14, 0.9, 245); },
  // 2 groot blad met nerven (hosta, bergenia)
  (g, r) => {
    g.translate(S / 2, S - 4);
    fillLeaf(g, 118, S - 12, 1.1, 240);
    g.strokeStyle = shade(170); g.lineWidth = 2.5;
    for (let i = 1; i <= 5; i++) for (const sd of [-1, 1]) {
      g.beginPath(); g.moveTo(0, -i * 38); g.quadraticCurveTo(sd * 60, -i * 38 - 20, sd * (95 - i * 12), -i * 38 - 55); g.stroke();
    }
  },
  // 3 spriet / stengel (vol)
  (g, r) => {
    const gr = g.createLinearGradient(0, 0, S, 0);
    gr.addColorStop(0, shade(185)); gr.addColorStop(0.5, shade(255)); gr.addColorStop(1, shade(175));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = shade(215); g.fillRect(S / 2 - 3, 0, 6, S);
  },
  // 4 varenblad
  (g, r) => {
    g.translate(S / 2, S - 2);
    g.strokeStyle = shade(170); g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -S + 8); g.stroke();
    for (let i = 0; i < 20; i++) {
      const y = -10 - i * 12, len = 112 * Math.pow(1 - i / 21, 0.75);
      for (const sd of [-1, 1]) {
        g.save(); g.translate(0, y); g.rotate(sd * -1.2);
        g.beginPath(); g.ellipse(0, -len / 2, 9 - i * 0.3, len / 2, 0, 0, Math.PI * 2);
        g.fillStyle = shade(225 + r() * 30); g.fill(); g.restore();
      }
    }
  },
  // 5 margriet / schijfbloem
  (g, r) => {
    g.translate(S / 2, S / 2);
    for (let i = 0; i < 15; i++) {
      g.save(); g.rotate((i / 15) * Math.PI * 2 + r() * 0.15);
      g.beginPath(); g.ellipse(0, -72, 15, 52, 0, 0, Math.PI * 2);
      g.fillStyle = shade(235 + r() * 20); g.fill();
      g.strokeStyle = shade(200); g.lineWidth = 1.5; g.stroke(); g.restore();
    }
    g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fillStyle = '#5b4523'; g.fill();
    for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = r() * 26; g.fillStyle = '#7d6232'; g.fillRect(Math.cos(a) * d, Math.sin(a) * d, 3, 3); }
  },
  // 6 scherm (veel kleine bloemetjes in een plat bolletje)
  (g, r) => {
    g.translate(S / 2, S / 2);
    for (let i = 0; i < 150; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 112;
      g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d * 0.95, 6 + r() * 5, 0, Math.PI * 2);
      g.fillStyle = shade(255 - d * 0.5 - r() * 25); g.fill();
    }
  },
  // 7 aar / kaars
  (g, r) => {
    g.translate(S / 2, 0);
    g.fillStyle = shade(160); g.fillRect(-3, 20, 6, S - 20);
    for (let i = 0; i < 170; i++) {
      const t = r(), y = S - 8 - t * (S - 26), w = 46 * (1 - t * 0.75);
      g.beginPath(); g.arc((r() - 0.5) * 2 * w, y, 6 + r() * 6 * (1 - t * 0.5), 0, Math.PI * 2);
      g.fillStyle = shade(205 + r() * 50); g.fill();
    }
  },
  // 8 pluim (grassen, astilbe)
  (g, r) => {
    g.translate(S / 2, S - 2);
    g.lineCap = 'round';
    for (let i = 0; i < 120; i++) {
      const t = r(), y = -t * (S - 14), env = Math.sin(Math.min(1, t * 1.3) * Math.PI) * 80 + 6;
      const sd = r() < 0.5 ? -1 : 1, len = env * (0.6 + r() * 0.5);
      g.strokeStyle = shade(200 + r() * 55); g.lineWidth = 2 + r() * 2;
      g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(sd * len * 0.5, y - 6, sd * len, y - 26 - r() * 20); g.stroke();
    }
    g.strokeStyle = shade(190); g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -S + 14); g.stroke();
  },
  // 9 bol (sierui)
  (g, r) => {
    g.translate(S / 2, S / 2);
    for (let i = 0; i < 260; i++) {
      const a = r() * 6.28, d = Math.pow(r(), 0.35) * 112;
      g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 4 + r() * 4, 0, Math.PI * 2);
      g.fillStyle = shade(255 - (112 - d) * 0.45 - r() * 30); g.fill();
    }
  },
  // 10 bladtros (heesters, bomen)
  (g, r) => {
    g.translate(S / 2, S / 2 + 6);
    const leaves = [];
    for (let i = 0; i < 26; i++) leaves.push({ a: r() * 6.28, l: 50 + r() * 58, t: 150 + r() * 105, d: r() * 34 });
    leaves.sort((p, q) => p.t - q.t);
    for (const lf of leaves) {
      g.save(); g.rotate(lf.a); g.translate(0, -lf.d);
      fillLeaf(g, lf.l * 0.36, lf.l, 0.55, lf.t); g.restore();
    }
  },
  // 11 naalden
  (g, r) => {
    g.translate(S / 2, S - 4);
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const ox = (k - 1) * 60;
      g.strokeStyle = shade(150); g.lineWidth = 4; g.beginPath(); g.moveTo(ox * 0.3, 0); g.lineTo(ox, -S + 30); g.stroke();
      for (let i = 0; i < 50; i++) {
        const t = r(), x = ox * 0.3 + (ox - ox * 0.3) * t, y = -t * (S - 30), sd = r() < 0.5 ? -1 : 1;
        g.strokeStyle = shade(200 + r() * 55); g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + sd * (24 + r() * 18), y - 14 - r() * 12); g.stroke();
      }
    }
  },
  // 12 schors
  (g, r) => {
    g.fillStyle = shade(205); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) { g.fillStyle = shade(150 + r() * 100); g.fillRect(r() * S, 0, 2 + r() * 6, S); }
    for (let i = 0; i < 60; i++) { g.fillStyle = shade(90 + r() * 60); g.fillRect(r() * S, r() * S, 3 + r() * 10, 2); }
  },
  // 13 kelk / tulp (zijaanzicht)
  (g, r) => {
    g.translate(S / 2, S - 6);
    g.fillStyle = shade(170); g.fillRect(-4, -70, 8, 70);
    const gr = g.createLinearGradient(-90, 0, 90, 0);
    gr.addColorStop(0, shade(200)); gr.addColorStop(0.45, shade(255)); gr.addColorStop(1, shade(190));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-80, -190); g.lineTo(-50, -235); g.lineTo(-25, -190); g.lineTo(0, -245); g.lineTo(25, -190); g.lineTo(50, -235); g.lineTo(80, -190);
    g.bezierCurveTo(90, -110, 40, -66, 0, -66); g.bezierCurveTo(-40, -66, -90, -110, -80, -190); g.fill();
  },
  // 14 losse bloemetjes
  (g, r) => {
    g.translate(S / 2, S / 2);
    for (let i = 0; i < 22; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 100, R = 14 + r() * 12;
      g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d); g.rotate(r() * 6);
      for (let k = 0; k < 5; k++) { g.rotate(1.2566); g.beginPath(); g.ellipse(0, -R * 0.55, R * 0.36, R * 0.55, 0, 0, Math.PI * 2); g.fillStyle = shade(232 + r() * 23); g.fill(); }
      g.beginPath(); g.arc(0, 0, R * 0.22, 0, Math.PI * 2); g.fillStyle = '#c9b04a'; g.fill();
      g.restore();
    }
  },
  // 15 roos (van bovenaf: blaadjes in een spiraal)
  (g, r) => {
    g.translate(S / 2, S / 2);
    for (let ring = 0; ring < 5; ring++) {
      const n = 5 + ring, R = 110 - ring * 20;
      for (let i = 0; i < n; i++) {
        g.save(); g.rotate((i / n) * Math.PI * 2 + ring * 0.6);
        g.beginPath(); g.ellipse(0, -R * 0.55, R * 0.42, R * 0.5, 0, 0, Math.PI * 2);
        g.fillStyle = shade(255 - ring * 22 - r() * 15); g.fill();
        g.strokeStyle = shade(170 - ring * 15); g.lineWidth = 2; g.stroke(); g.restore();
      }
    }
  },
];

/** De textuuratlas (canvas 1024 × 1024) met alle bladvormen en bloeiwijzen. */
export function drawAtlas() {
  const c = document.createElement('canvas');
  c.width = c.height = S * 8; // dubbele resolutie voor scherpe blaadjes van dichtbij
  const g = c.getContext('2d');
  g.scale(2, 2);
  DRAW.forEach((fn, i) => {
    g.save();
    g.translate((i % 4) * S, Math.floor(i / 4) * S);
    g.beginPath(); g.rect(1, 1, S - 2, S - 2); g.clip();
    fn(g, rng(101 + i * 7));
    g.restore();
  });
  return c;
}

/** Herhaalbare haagtextuur (blad op blad), 512 × 512. */
export function drawHedgeTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = shade(105);
  g.fillRect(0, 0, 512, 512);
  const r = rng(77);
  for (let i = 0; i < 1400; i++) {
    const x = r() * 512, y = r() * 512, l = 12 + r() * 12, a = r() * 6.28, t = 150 + r() * 105;
    for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
      if (x + dx < -40 || x + dx > 552 || y + dy < -40 || y + dy > 552) continue;
      g.save(); g.translate(x + dx, y + dy); g.rotate(a); fillLeaf(g, l * 0.4, l, 0.6, t); g.restore();
    }
  }
  return c;
}

// ------------------------------------------------------------------ opbouw

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const UP = [0, 1, 0];

/** Verzamelt driehoeken (positie, normaal, uv, kleur) voor één model. */
export class Geo {
  constructor(T, height) {
    this.T = T;
    this.h = Math.max(0.05, height);
    this.P = []; this.N = []; this.U = []; this.C = [];
    this.center = [0, this.h * 0.4, 0];
    this.aoMin = 0.45;
  }

  /** Kleur (hex) → lineaire rgb, met variatie in helderheid. */
  col(hex, vary = 0) {
    const c = new this.T.Color(hex);
    if (vary) c.offsetHSL(0, 0, vary);
    return [c.r, c.g, c.b];
  }

  ao(y) {
    return this.aoMin + (1 - this.aoMin) * Math.min(1, Math.max(0, y / (this.h * 0.85)));
  }

  /** Normaal voor blad: van het midden van de plant naar buiten (zacht, 'bolvormig' licht). */
  foliageNormal(p, faceN, k = 0.65) {
    const out = norm(sub(p, this.center));
    return norm(add(mul(out, k), mul(faceN, 1 - k)));
  }

  uv(cell, u, v) {
    const cx = (cell % 4) * S, cy = Math.floor(cell / 4) * S, inset = 3;
    return [(cx + inset + u * (S - inset * 2)) / (S * 4), 1 - (cy + inset + (1 - v) * (S - inset * 2)) / (S * 4)];
  }

  vert(p, n, uv, c) {
    this.P.push(p[0], p[1], p[2]);
    this.N.push(n[0], n[1], n[2]);
    this.U.push(uv[0], uv[1]);
    const k = this.ao(p[1]);
    this.C.push(c[0] * k, c[1] * k, c[2] * k);
  }

  /** Vierhoek a-b-c-d (linksonder, rechtsonder, rechtsboven, linksboven), aan twee kanten zichtbaar. */
  quad(a, b, c, d, ns, uvs, cols, two = true) {
    const idx = [[0, 1, 2], [0, 2, 3]];
    const vs = [a, b, c, d];
    for (const t of idx) for (const i of t) this.vert(vs[i], ns[i], uvs[i], cols[i]);
    if (two) for (const t of idx) for (const i of [t[0], t[2], t[1]]) this.vert(vs[i], ns[i], uvs[i], cols[i]);
  }

  /** Kaartje vanaf basis in richting 'up', breedte w, lengte len. */
  card(base, up, right, w, len, cell, color, opts = {}) {
    up = norm(up); right = norm(right);
    const a = add(base, mul(right, -w / 2)), b = add(base, mul(right, w / 2));
    const c = add(b, mul(up, len)), d = add(a, mul(up, len));
    const face = norm(cross(right, up));
    const nf = (p) => (opts.flatNormal ? (opts.n || face) : this.foliageNormal(p, face, opts.k ?? 0.65));
    const cc = opts.tipColor || color;
    this.quad(a, b, c, d, [nf(a), nf(b), nf(c), nf(d)], [this.uv(cell, 0, 0), this.uv(cell, 1, 0), this.uv(cell, 1, 1), this.uv(cell, 0, 1)], [color, color, cc, cc]);
  }

  /** Kaartje rond een middelpunt met een normaal (bloemen die naar boven of opzij kijken). */
  disc(center, normal, size, cell, color, spin = 0) {
    normal = norm(normal);
    let t = Math.abs(normal[1]) > 0.9 ? [1, 0, 0] : UP;
    let right = norm(cross(t, normal));
    let up = norm(cross(normal, right));
    const c = Math.cos(spin), s = Math.sin(spin);
    [right, up] = [add(mul(right, c), mul(up, s)), add(mul(up, c), mul(right, -s))];
    this.card(add(center, mul(up, -size / 2)), up, right, size, size, cell, color, { flatNormal: true, n: norm(add(normal, [0, 0.4, 0])) });
  }

  /** Gekromde strook (spriet, varenblad) langs punten, breedtes per punt. */
  strip(pts, widths, cell, colors, side) {
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const dir = norm(sub(p1, p0));
      const sd = side ? norm(side) : norm(cross(dir, UP));
      const face = norm(cross(sd, dir));
      const a = add(p0, mul(sd, -widths[i] / 2)), b = add(p0, mul(sd, widths[i] / 2));
      const c = add(p1, mul(sd, widths[i + 1] / 2)), d = add(p1, mul(sd, -widths[i + 1] / 2));
      const nn = (p) => this.foliageNormal(p, face, 0.5);
      this.quad(a, b, c, d, [nn(a), nn(b), nn(c), nn(d)],
        [this.uv(cell, 0, i / n), this.uv(cell, 1, i / n), this.uv(cell, 1, (i + 1) / n), this.uv(cell, 0, (i + 1) / n)],
        [colors[i], colors[i], colors[i + 1], colors[i + 1]]);
    }
  }

  /** Buis (stengel, tak, stam) langs punten met stralen. */
  tube(pts, radii, color, sides = 5, cell = CELL.bark) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const dir = norm(sub(p1, p0));
      const ref = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : UP;
      const e1 = norm(cross(dir, ref)), e2 = norm(cross(dir, e1));
      for (let k = 0; k < sides; k++) {
        const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
        const r0 = (a) => add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
        const n0 = r0(a0), n1 = r0(a1);
        const A = add(p0, mul(n0, radii[i])), B = add(p0, mul(n1, radii[i])), C = add(p1, mul(n1, radii[i + 1])), D = add(p1, mul(n0, radii[i + 1]));
        this.quad(A, B, C, D, [n0, n1, n1, n0], [this.uv(cell, k / sides, 0), this.uv(cell, (k + 1) / sides, 0), this.uv(cell, (k + 1) / sides, 1), this.uv(cell, k / sides, 1)], [color, color, color, color], false);
      }
    }
  }

  get triangles() { return this.P.length / 9; }

  geometry() {
    const T = this.T, g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(this.C, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------ vaste planten, grassen, heesters

/** Bloeiwijze → cel en manier van neerzetten. */
function flowerKind(form, shape) {
  if (shape === 'zwaard') return form === 'aar' ? 'aar' : 'kelk';
  if (shape === 'bol') return form === 'knop' ? 'bol' : form === 'schijf' ? 'schijf' : 'kelk';
  return { aar: 'aar', knop: 'bol', pluim: 'pluim', scherm: 'scherm', schijf: 'schijf' }[form] || 'bloemetjes';
}

function flowerAt(G, tip, out, kind, size, color, r) {
  switch (kind) {
    case 'aar': {
      const h = size * 3.2;
      const a = r() * 3.14;
      for (const k of [0, 1.5708]) G.card(add(tip, [0, -h * 0.15, 0]), [out[0] * 0.08, 1, out[2] * 0.08], [Math.cos(a + k), 0, Math.sin(a + k)], h * 0.32, h, CELL.spike, color, { k: 0.4 });
      break;
    }
    case 'pluim': {
      const h = size * 3;
      const a = r() * 3.14;
      for (const k of [0, 1.5708]) G.card(add(tip, [0, -h * 0.1, 0]), [out[0] * 0.3, 1, out[2] * 0.3], [Math.cos(a + k), 0, Math.sin(a + k)], h * 0.55, h, CELL.plume, color, { k: 0.4 });
      break;
    }
    case 'bol':
      for (const k of [0, 1.05, 2.1]) G.disc(tip, [Math.cos(k), 0.2, Math.sin(k)], size * 1.4, CELL.ball, color, r() * 6);
      break;
    case 'kelk': {
      const a = r() * 3.14;
      for (const k of [0, 1.5708]) G.card(add(tip, [0, -size * 0.2, 0]), UP, [Math.cos(a + k), 0, Math.sin(a + k)], size * 1.1, size * 1.2, CELL.cup, color, { k: 0.3 });
      break;
    }
    case 'scherm':
      G.disc(add(tip, [0, size * 0.1, 0]), add(UP, mul(out, 0.35)), size * 1.7, CELL.umbel, color, r() * 6);
      break;
    case 'schijf':
      G.disc(tip, add(UP, mul(out, 0.7 + r() * 0.5)), size * 1.3, CELL.daisy, color, r() * 6);
      break;
    default:
      G.disc(tip, add(UP, mul(out, 0.5)), size * 1.6, CELL.florets, color, r() * 6);
  }
}

/**
 * Model van één plant (meters, voet op de grond in de oorsprong).
 * spec: { shape, form, h, d, leaf (hex), flower (hex of null), straw (winter: alleen uitgebloeide stengels) }
 */
export function buildPlant(T, spec, seed = 1) {
  const r = rng(seed * 9973 + 17);
  const H = Math.max(0.04, spec.h), R = Math.max(0.05, spec.d / 2);
  const G = new Geo(T, H);
  const shape = spec.shape || 'kussen';
  const leafCol = () => G.col(spec.leaf, (r() - 0.5) * 0.12);
  const stemCol = G.col(spec.straw ? '#9c8763' : spec.leaf, spec.straw ? 0 : -0.05);
  const fl = spec.flower && !spec.straw ? spec.flower : null;
  const flCol = () => G.col(fl, (r() - 0.5) * 0.1);
  const fkind = flowerKind(spec.form, shape);
  const fsize = Math.max(0.03, Math.min(0.12, R * 0.22 + H * 0.04));
  const around = (rad) => { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad; return [Math.cos(a) * d, 0, Math.sin(a) * d]; };
  const outOf = (p) => { const l = Math.hypot(p[0], p[2]) || 1; return [p[0] / l, 0, p[2] / l]; };

  const stemWithFlower = (base, topY, lean) => {
    const out = outOf(base[0] || base[2] ? base : [r() - 0.5, 0, r() - 0.5]);
    const tip = add([base[0], topY, base[2]], mul(out, lean));
    const mid = add(mul(add(base, tip), 0.5), mul(out, lean * 0.2));
    G.tube([base, mid, tip], [0.0045, 0.0035, 0.002], stemCol, 3, CELL.blade);
    if (fl) flowerAt(G, tip, out, fkind, fsize, flCol(), r);
    else if (spec.straw && fkind !== 'bloemetjes') G.disc(tip, UP, fsize * 0.8, fkind === 'schijf' ? CELL.daisy : CELL.ball, G.col('#5e4a33'), r() * 6);
    return tip;
  };

  const blades = (n, len, width, fan, droop, plume) => {
    for (let i = 0; i < n; i++) {
      const base = around(R * 0.22);
      const a = r() * Math.PI * 2, out = [Math.cos(a), 0, Math.sin(a)];
      const L = len * (0.6 + r() * 0.45), lean = fan * (0.4 + r() * 0.8);
      const pts = [], ws = [], cs = [];
      const c0 = spec.straw ? G.col('#a48b5e', (r() - 0.5) * 0.1) : leafCol(), c1 = spec.straw ? G.col('#d6c08e') : G.col(spec.leaf, 0.08 + (r() - 0.5) * 0.08);
      const segs = spec.segs || 4;
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        const bend = lean * t * t * L * (droop ? 1.25 : 0.7);
        pts.push(add(base, add(mul(out, bend + lean * t * L * 0.2), [0, L * (t - (droop ? 0.28 : 0.1) * t * t * lean), 0])));
        ws.push(width * (1 - t * 0.85));
        cs.push(c0.map((v, j) => v + (c1[j] - v) * t));
      }
      G.strip(pts, ws, CELL.blade, cs);
    }
    if (plume) {
      const n2 = Math.max(3, Math.round(n / 5));
      for (let i = 0; i < n2; i++) {
        const base = around(R * 0.2);
        const out = outOf(base);
        const tip = add([base[0], H * (0.85 + r() * 0.2), base[2]], mul(out, R * 0.35 * r()));
        G.tube([base, tip], [0.004, 0.002], stemCol, 3, CELL.blade);
        const c = fl ? flCol() : G.col(spec.straw ? '#cdb98a' : '#d9cfa8', (r() - 0.5) * 0.08);
        flowerAt(G, add(tip, [0, -fsize * 2.2, 0]), out, spec.form === 'aar' ? 'aar' : 'pluim', fsize * 1.1, c, r);
      }
    }
  };

  const leafCard = (p, outward, len, cell, tilt = 0.6) => {
    const up = norm(add(outward, [0, tilt + (r() - 0.5) * 0.5, 0]));
    const right = norm(cross(UP, outward[0] || outward[2] ? outward : [1, 0, 0]));
    const rr = norm(add(right, mul(up, (r() - 0.5) * 0.6)));
    G.card(p, up, rr, len * (cell === CELL.leaf ? 0.42 : 0.7), len, cell, leafCol());
  };

  switch (shape) {
    case 'gras':
      blades(spec.blades || Math.round(Math.min(150, Math.max(30, R * R * 420))), H * (spec.form === 'pluim' || spec.form === 'aar' ? 0.75 : 1), Math.max(0.008, Math.min(0.022, R * 0.06)), 0.55, true, spec.form === 'pluim' || spec.form === 'aar');
      break;
    case 'zwaard': {
      G.aoMin = 0.55;
      blades(Math.round(Math.min(26, Math.max(8, R * 50))), H * 0.8, Math.max(0.018, Math.min(0.045, R * 0.12)), 0.18, false, false);
      if (fl || spec.straw) for (let i = 0, n = Math.max(2, Math.round(R * 10)); i < n; i++) stemWithFlower(around(R * 0.25), H * (0.85 + r() * 0.2), R * 0.2);
      break;
    }
    case 'varen': {
      const n = Math.round(Math.min(16, Math.max(7, R * 22)));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.4, out = [Math.cos(a), 0, Math.sin(a)];
        const L = Math.max(H, R) * (0.85 + r() * 0.3), lean = 0.45 + r() * 0.35;
        const pts = [], ws = [], cs = [];
        for (let k = 0; k <= 4; k++) {
          const t = k / 4;
          pts.push(add(mul(out, lean * L * (t * 0.8 + t * t * 0.3)), [0, H * (t * 1.15 - t * t * 0.3 * lean), 0]));
          ws.push(L * 0.42); cs.push(spec.straw ? G.col('#8a6a43') : leafCol());
        }
        G.strip(pts, ws, CELL.fern, cs, norm(cross(out, UP)));
      }
      break;
    }
    case 'bladplant': {
      const n = Math.round(Math.min(16, Math.max(6, R * 20)));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.5, out = [Math.cos(a), 0, Math.sin(a)];
        const base = add(mul(out, R * (0.05 + r() * 0.2)), [0, H * (0.15 + r() * 0.35), 0]);
        G.tube([[0, 0, 0], base], [0.008, 0.006], G.col(spec.leaf, -0.1), 3, CELL.blade);
        const up = norm(add(out, [0, 0.35 + r() * 0.5, 0]));
        G.card(base, up, norm(cross(UP, out)), R * 0.75, R * 0.85, CELL.leafBig, leafCol(), { k: 0.45 });
      }
      if (fl || spec.straw) for (let i = 0, n2 = Math.max(1, Math.round(R * 4)); i < n2; i++) stemWithFlower(around(R * 0.2), H * (1.1 + r() * 0.3), 0.05);
      break;
    }
    case 'mat': {
      const n = Math.round(Math.min(320, Math.max(40, R * R * 900)));
      G.aoMin = 0.6;
      for (let i = 0; i < n; i++) {
        const p = around(R * 0.95);
        const y = H * (0.25 + 0.75 * (1 - Math.hypot(p[0], p[2]) / R) * r());
        const out = outOf(p);
        G.card([p[0], y * 0.4, p[2]], norm(add(out, [0, 1.6 + r(), 0])), norm(cross(UP, out)), Math.max(0.07, R * 0.32), Math.max(0.08, R * 0.36), CELL.cluster, leafCol(), { k: 0.4 });
      }
      if (fl) for (let i = 0, n2 = Math.round(Math.min(40, Math.max(4, R * R * 70))); i < n2; i++) {
        const p = around(R * 0.85);
        G.disc([p[0], H * (0.7 + r() * 0.4), p[2]], add(UP, mul(outOf(p), 0.3)), fsize * 1.8, fkind === 'schijf' ? CELL.daisy : fkind === 'scherm' ? CELL.umbel : CELL.florets, flCol(), r() * 6);
      }
      break;
    }
    case 'bol': {
      const n = 3 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28, out = [Math.cos(a), 0, Math.sin(a)], L = H * (0.45 + r() * 0.2);
        G.strip([[0, 0, 0], add(mul(out, L * 0.15), [0, L * 0.5, 0]), add(mul(out, L * 0.45), [0, L * 0.8, 0])], [0.03, 0.026, 0.004], CELL.blade, [leafCol(), leafCol(), leafCol()]);
      }
      if (fl) for (let i = 0, n2 = 1 + Math.floor(R * 6); i < n2; i++) stemWithFlower(around(R * 0.2), H * (0.85 + r() * 0.2), 0.02);
      break;
    }
    case 'heester':
      return buildShrub(T, spec, seed);
    case 'rechtop':
    case 'ijl': {
      const airy = shape === 'ijl';
      const n = Math.round(Math.min(airy ? 14 : 24, Math.max(airy ? 5 : 7, R * R * (airy ? 60 : 120))));
      for (let i = 0; i < n; i++) {
        const base = around(R * 0.4);
        const tip = stemWithFlower(base, H * (0.78 + r() * 0.25), R * (airy ? 0.6 : 0.3) * r());
        const m = airy ? 4 : 10;
        for (let k = 1; k <= m; k++) {
          const t = (k / (m + 1)) * 0.8;
          const p = add(mul(base, 1 - t), mul(tip, t));
          const a = r() * 6.28;
          leafCard(p, [Math.cos(a), 0, Math.sin(a)], Math.max(0.05, Math.min(airy ? 0.07 : 0.17, H * 0.16)) * (1.25 - t * 0.6), r() < 0.6 ? CELL.leaf : CELL.leafRound, 0.55);
        }
        if (airy && fl) for (let k = 0; k < 2; k++) flowerAt(G, add(tip, [(r() - 0.5) * 0.12, -0.05 - r() * 0.1, (r() - 0.5) * 0.12]), outOf(base), fkind, fsize * 0.8, flCol(), r);
      }
      // rozet onderin
      for (let i = 0; i < 18; i++) { const a = r() * 6.28, p = around(R * 0.35); leafCard([p[0], H * 0.03, p[2]], [Math.cos(a), 0, Math.sin(a)], Math.min(0.24, R * 0.7), CELL.leafRound, 0.45); }
      break;
    }
    default: { // kussen: een pol bladeren met bloemen erboven
      const n = Math.round(Math.min(260, Math.max(80, R * R * 700)));
      for (let i = 0; i < n; i++) {
        const th = r() * Math.PI * 2, ph = Math.acos(1 - r() * 0.95);
        const k = 0.7 + r() * 0.35;
        const out = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
        const p = [out[0] * R * k, Math.max(0.01, out[1] * H * 0.82 * k), out[2] * R * k];
        const len = Math.max(0.06, Math.min(0.18, Math.min(R, H) * 0.5));
        const horiz = norm([out[0], 0.0001, out[2]]);
        const up = norm(add(horiz, [0, 0.5 + out[1] * 1.2 + (r() - 0.5) * 0.5, 0]));
        G.card(sub(p, mul(up, len * 0.4)), up, norm(cross(UP, horiz)), len * 0.6, len, r() < 0.5 ? CELL.leaf : CELL.leafRound, leafCol());
      }
      if (fl || spec.straw) {
        const nf = Math.round(Math.min(45, Math.max(5, R * R * 75)));
        for (let i = 0; i < nf; i++) stemWithFlower(around(R * 0.75), H * (0.85 + r() * 0.25), R * 0.15);
      }
    }
  }
  return G;
}

/** Heester: een paar stammetjes en een kroon van bladtrossen; bloemen verspreid over de buitenkant. */
export function buildShrub(T, spec, seed = 1) {
  const r = rng(seed * 7919 + 3);
  const H = Math.max(0.3, spec.h), R = Math.max(0.2, spec.d / 2);
  const G = new Geo(T, H);
  G.center = [0, H * 0.5, 0];
  G.aoMin = 0.4;
  const bark = G.col('#5e4a39');
  for (let i = 0, n = 3 + Math.floor(r() * 3); i < n; i++) {
    const a = r() * 6.28, out = [Math.cos(a), 0, Math.sin(a)];
    G.tube([[0, 0, 0], add(mul(out, R * 0.25), [0, H * 0.35, 0]), add(mul(out, R * 0.45), [0, H * 0.6, 0])], [0.03, 0.022, 0.012], bark, 4);
  }
  if (spec.bare) {
    for (let i = 0; i < 18; i++) {
      const a = r() * 6.28, out = [Math.cos(a), 0, Math.sin(a)];
      G.tube([add(mul(out, R * 0.2), [0, H * 0.3, 0]), add(mul(out, R * (0.6 + r() * 0.4)), [0, H * (0.7 + r() * 0.3), 0])], [0.012, 0.004], bark, 3);
    }
    return G;
  }
  const n = Math.round(Math.min(700, Math.max(160, R * R * H * 260)));
  const size = Math.max(0.2, Math.min(0.5, R * 0.42));
  // donkere kern, zodat je niet dwars door de struik kijkt
  for (let i = 0; i < 24; i++) {
    const th = r() * Math.PI * 2, up = [Math.cos(th) * 0.3, 1, Math.sin(th) * 0.3];
    G.card([Math.cos(th) * R * 0.2, H * 0.2, Math.sin(th) * R * 0.2], up, [Math.sin(th), 0, -Math.cos(th)], R * 1.1, H * 0.65, CELL.cluster, G.col(spec.leaf, -0.18));
  }
  for (let i = 0; i < n; i++) {
    // meer blad aan de buitenkant
    const th = r() * Math.PI * 2, ph = Math.acos(1 - 2 * r());
    const k = Math.pow(r(), 0.35);
    const out = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
    const p = [out[0] * R * k, H * 0.5 + out[1] * H * 0.48 * k, out[2] * R * k];
    if (p[1] < 0.03) continue;
    const up = norm(add(out, [(r() - 0.5) * 0.8, 0.6, (r() - 0.5) * 0.8]));
    const right = norm(cross(up, [r() - 0.5, r() - 0.5, r() - 0.5]));
    G.card(sub(p, mul(up, size * 0.5)), up, right, size, size, CELL.cluster, G.col(spec.leaf, (r() - 0.5) * 0.14));
  }
  if (spec.flower) {
    const nf = Math.round(n * 0.3);
    const cell = { pluim: CELL.plume, scherm: CELL.umbel, aar: CELL.spike, knop: CELL.ball }[spec.form] || CELL.florets;
    for (let i = 0; i < nf; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(1 - 1.6 * r());
      const out = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
      const p = [out[0] * R * 0.95, H * 0.5 + out[1] * H * 0.47, out[2] * R * 0.95];
      G.disc(p, out, size * 0.8, cell, G.col(spec.flower, (r() - 0.5) * 0.1), r() * 6);
    }
  }
  return G;
}

// ------------------------------------------------------------------ bomen

/**
 * Boom: stam, gesteltakken en twijgen; in het groeiseizoen bladtrossen in de kroon.
 * spec: { h, rx, rz, crown (deel van de hoogte), leaf, flower, bare, conifer }
 */
export function buildTree(T, spec, seed = 1) {
  const r = rng(seed * 104729 + 11);
  const H = spec.h, rx = spec.rx, rz = spec.rz;
  const ch = H * Math.min(0.92, spec.habit === 'rechtop' && !spec.conifer ? 0.86 : spec.crown || 0.62);
  const G = new Geo(T, H);
  G.center = [0, H - ch / 2, 0];
  G.aoMin = 0.55;
  const bark = G.col(spec.bark || '#9a8a78');
  const tr = Math.max(0.05, Math.min(0.4, H * 0.016 + Math.min(rx, rz) * 0.025));
  const trunkTop = H - ch * 0.85;

  if (spec.conifer) {
    G.tube([[0, 0, 0], [0, H * 0.5, 0], [0, H, 0]], [tr, tr * 0.6, 0.02], bark, 6);
    const tiers = Math.max(6, Math.round(ch / 0.35));
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers, y = H - ch + t * ch, rad = (1 - t) * Math.max(rx, rz) * 1.05 + 0.08;
      const n = Math.max(5, Math.round(rad * 10));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.28 + r() * 0.5, out = [Math.cos(a) * rx / Math.max(rx, rz), 0, Math.sin(a) * rz / Math.max(rx, rz)];
        G.card([0, y, 0], norm(add(out, [0, -0.15 - t * 0.1, 0])), norm(cross(UP, out)), Math.max(0.3, rad * 0.8), rad * 1.05, CELL.needles, G.col(spec.leaf || '#3f6b3a', (r() - 0.5) * 0.12), { k: 0.55 });
      }
    }
    return G;
  }

  // stam met wortelaanzet, licht gebogen
  const lean = [(r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12];
  const trunkPts = [[0, 0, 0], [lean[0] * 0.3, trunkTop * 0.35, lean[2] * 0.3], [lean[0] * 0.7, trunkTop * 0.7, lean[2] * 0.7], [lean[0], trunkTop, lean[2]]];
  G.tube(trunkPts, [tr * 1.35, tr * 1.02, tr * 0.92, tr * 0.8], bark, 9);
  const cy = H - ch / 2, cr = ch / 2;
  const weep = spec.habit === 'overhangend', column = spec.habit === 'rechtop', airy = spec.habit === 'ijl';
  const big = Math.max(rx, rz) > 3.2;
  const maxDepth = big ? 4 : 3;
  const cs = spec.habit === 'rechtop' ? 0.5 : Math.max(0.28, Math.min(0.62, Math.min(rx, rz) * 0.17));
  const leafCell = CELL.cluster;
  const twigs = [];
  /** Buiten de kroon? (> 1 = erbuiten) */
  const crownR = (p) => Math.hypot(p[0] / rx, (p[1] - cy) / cr, p[2] / rz);
  const randDir = (d, spread) => {
    const ref = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : UP;
    const e1 = norm(cross(d, ref)), e2 = norm(cross(d, e1));
    const a = r() * Math.PI * 2, t = spread * (0.5 + r() * 0.5);
    return norm(add(mul(d, Math.cos(t)), add(mul(e1, Math.sin(t) * Math.cos(a)), mul(e2, Math.sin(t) * Math.sin(a)))));
  };
  const branch = (start, dir, len, rad, depth) => {
    const pts = [start];
    let p = start, d = dir;
    for (let k = 1; k <= 4; k++) {
      // takken buigen naar het licht, treurtakken hangen
      const g = weep && depth >= 1 ? -0.5 - depth * 0.25 : column ? 0.18 : 0.06 - depth * 0.05;
      d = norm(add(add(d, [0, g, 0]), [(r() - 0.5) * 0.25, (r() - 0.5) * 0.15, (r() - 0.5) * 0.25]));
      p = add(p, mul(d, len / 4));
      // binnen de kroon blijven (treurtakken mogen omlaag)
      if (!weep && crownR(p) > 1.02) { const k2 = 1.02 / crownR(p); p = [p[0] * k2 + (1 - k2) * 0, cy + (p[1] - cy) * k2, p[2] * k2]; }
      pts.push(p);
    }
    G.tube(pts, pts.map((_, i) => Math.max(0.004, rad * (1 - 0.55 * i / 4))), bark, depth === 0 ? 6 : depth === 1 ? 4 : 3);
    if (depth >= maxDepth) {
      twigs.push({ pts, d });
      if (weep) {
        // lange hangende twijgen
        for (let k = 0; k < 3; k++) {
          const from = pts[1 + Math.floor(r() * 3)];
          const L = ch * (0.35 + r() * 0.35);
          const sp = [from];
          for (let j = 1; j <= 4; j++) sp.push(add(from, [(r() - 0.5) * 0.25 + d[0] * 0.2 * j, -L * j / 4, (r() - 0.5) * 0.25 + d[2] * 0.2 * j]));
          G.tube(sp, sp.map(() => 0.004), bark, 3);
          twigs.push({ pts: sp, d: [0, -1, 0], hang: true });
        }
      }
      return;
    }
    const n = depth === 0 ? 3 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2) + (depth >= 2 && r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = 0.35 + (i / n) * 0.65 * (0.8 + r() * 0.2);
      const idx = Math.min(3, Math.floor(t * 4));
      const from = add(pts[idx], mul(sub(pts[idx + 1], pts[idx]), t * 4 - idx));
      const nd = randDir(d, weep && depth >= 1 ? 0.6 : column ? 0.45 : 0.75);
      branch(from, nd, len * (0.58 + r() * 0.18), rad * 0.5, depth + 1);
    }
    twigs.push({ pts, d, inner: depth < maxDepth - 1 });
  };
  // gesteltakken vanuit de stam
  const limbs = column ? 16 : 5 + Math.floor(r() * 3);
  if (column) G.tube([[lean[0], trunkTop, lean[2]], [lean[0] * 1.1, trunkTop + ch * 0.5, lean[2] * 1.1], [lean[0] * 1.2, H - 0.3, lean[2] * 1.2]], [tr * 0.8, tr * 0.5, 0.03], bark, 6);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 * 2.4 + r() * 0.7;
    const startY = column ? trunkTop + (i / limbs) * ch * 0.8 : trunkTop - ch * (0.05 + r() * 0.2);
    const out = column ? 0.25 : weep ? 0.85 : airy ? 0.7 : 0.6 + r() * 0.3;
    const dir = norm([Math.cos(a) * out * rx / Math.max(rx, rz), 1, Math.sin(a) * out * rz / Math.max(rx, rz)]);
    const len = column ? Math.max(rx, rz) * 1.4 + ch * 0.12 * (1 - i / limbs) : Math.hypot(rx, cr) * (0.55 + r() * 0.2);
    branch([lean[0], startY, lean[2]], dir, len, column ? tr * 0.25 : tr * 0.55, column ? 1 : 0);
  }
  // doorgaande top
  branch([lean[0], trunkTop, lean[2]], norm([lean[0], 1, lean[2]]), ch * 0.5, tr * 0.55, 1);
  if (spec.bare) return G;

  // blad (en bloesem) aan de twijgen
  const target = Math.min(3600, Math.max(500, rx * rz * ch * (airy ? 34 : column ? 110 : 55)));
  const ends = twigs.filter((t) => !t.inner);
  const perTwig = Math.max(3, Math.round(target / Math.max(1, ends.length)));
  for (const tw of ends) {
    for (let k = 0; k < perTwig; k++) {
      const t = 0.35 + r() * 0.65;
      const idx = Math.min(3, Math.floor(t * 4));
      const base = add(tw.pts[idx], mul(sub(tw.pts[idx + 1], tw.pts[idx]), t * 4 - idx));
      const spread = weep ? cs * 0.3 : cs * 0.9;
      const p = add(base, [(r() - 0.5) * spread, (r() - 0.5) * spread * 0.7, (r() - 0.5) * spread]);
      const out = norm(sub(p, [0, cy, 0]));
      const up = weep && tw.hang ? norm(add([0, -1, 0], mul(out, 0.25))) : norm(add(add(out, [0, 0.55, 0]), [(r() - 0.5) * 0.7, (r() - 0.5) * 0.4, (r() - 0.5) * 0.7]));
      const right = norm(cross(up, [r() - 0.5, r() - 0.5, r() - 0.5]));
      const flower = spec.flower && r() < 0.45;
      const size = cs * (0.75 + r() * 0.5) * (weep ? 0.8 : 1);
      G.card(sub(p, mul(up, size * 0.35)), up, right, weep && tw.hang ? size * 0.6 : size, size, flower ? CELL.florets : leafCell, G.col(flower ? spec.flower : spec.leaf, (r() - 0.5) * 0.16));
    }
  }
  return G;
}

// ------------------------------------------------------------------ gazon

/** Klein plukje gras voor op het gazon. */
export function buildLawnTuft(T, seed, color) {
  return buildPlant(T, { shape: 'gras', h: 0.1, d: 0.16, leaf: color, form: 'blad', blades: 6, segs: 2 }, seed);
}

export { plantShape };

// ------------------------------------------------------------------ klimplanten

const VINES = {
  blauweregen: { leafCell: CELL.fern, leaf: 0.26, ratio: 0.55, per: 1, flower: 'tros', stem: 0.022, cluster: 0 },
  roos: { leafCell: CELL.leafRound, leaf: 0.08, ratio: 0.7, per: 2, flower: 'roos', stem: 0.016, cluster: 0.22 },
  clematis: { leafCell: CELL.leaf, leaf: 0.09, ratio: 0.5, per: 2, flower: 'ster', stem: 0.01, cluster: 0.2 },
  kamperfoelie: { leafCell: CELL.leafRound, leaf: 0.08, ratio: 0.65, per: 2, flower: 'bloemetjes', stem: 0.012, cluster: 0.2 },
  groen: { leafCell: CELL.leafBig, leaf: 0.11, ratio: 0.95, per: 2, flower: null, stem: 0.014, cluster: 0.18 },
  druif: { leafCell: CELL.leafBig, leaf: 0.18, ratio: 0.95, per: 2, flower: 'druif', stem: 0.024, cluster: 0 },
  herfst: { leafCell: CELL.leafBig, leaf: 0.13, ratio: 0.95, per: 2, flower: null, stem: 0.016, cluster: 0.18 },
  haagbeuk: { leafCell: CELL.leaf, leaf: 0.1, ratio: 0.6, per: 2, flower: null, stem: 0.02, cluster: 0.26 },
  fruit: { leafCell: CELL.leafRound, leaf: 0.085, ratio: 0.62, per: 2, flower: 'bloemetjes', stem: 0.03, cluster: 0.2 },
};

/**
 * Klimplant langs dragers: houtige ranken die om palen draaien en over balken lopen, bladeren aan steeltjes,
 * zijscheuten die afhangen, bloemen of trossen. Kaal in de winter (alleen de ranken).
 * supports: polylijnen [[x, y, z], …] (meters). spec: { kind, leaf, flower, fruit, bare, full, face ([x, y, z] = blad
 * kijkt die kant op, voor muren en hekken) }.
 */
export function buildVine(T, supports, spec, seed = 1) {
  const r = rng(seed * 7717 + 5);
  const V = VINES[spec.kind] || VINES.groen;
  let maxY = 1;
  for (const s of supports) for (const p of s) maxY = Math.max(maxY, p[1]);
  const G = new Geo(T, maxY + 0.3);
  G.aoMin = 0.72;
  const bark = G.col('#6a5644');
  const full = spec.full !== false;
  const step = full ? 0.07 : 0.13;
  const leafCol = () => G.col(spec.leaf, (r() - 0.5) * 0.16);
  const GRAV = [0, -1, 0];

  const leafAt = (p, dir) => {
    // steeltje schuin naar buiten, blad hangt iets
    let side = norm(cross(dir, [r() - 0.5, r() - 0.5, r() - 0.5]));
    if (spec.face) { const f = (r() < 0.8 ? 1 : -1) * (spec.faceBoth && r() < 0.5 ? -1 : 1); side = norm(add(mul(spec.face, f * 1.4), mul(side, 0.6))); }
    const tip = add(p, add(mul(side, 0.035), [0, 0.01, 0]));
    if (!spec.bare) {
      const up = norm(add(add(side, mul(GRAV, 0.35 + r() * 0.3)), mul(dir, (r() - 0.5) * 0.6)));
      const right = norm(cross(up, side[1] > 0.9 ? [1, 0, 0] : UP));
      const L = V.leaf * (0.8 + r() * 0.45);
      const n = norm(add(mul(side, 0.6), [0, 0.8, 0]));
      G.card(tip, up, right, L * V.ratio, L, V.leafCell, leafCol(), { flatNormal: true, n });
      if (V.cluster) {
        // bladtrosje aan hetzelfde knooppunt: voller blad, maar vast aan de rank
        const cs = V.cluster * (0.8 + r() * 0.45);
        const cu = norm(add(add(side, mul(GRAV, 0.15)), [(r() - 0.5) * 0.5, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5]));
        G.card(sub(p, mul(cu, cs * 0.15)), cu, norm(cross(cu, Math.abs(cu[1]) > 0.9 ? [1, 0, 0] : UP)), cs, cs, CELL.cluster, G.col(spec.leaf, (r() - 0.5) * 0.16 - 0.04), { flatNormal: true, n });
      }
    }
    return side;
  };

  const flowerAtV = (p, side) => {
    if (spec.bare) return;
    if (spec.fruit && V.flower === 'druif') {
      G.disc(add(p, [0, -0.08, 0]), side, 0.12, CELL.ball, G.col(spec.fruit, (r() - 0.5) * 0.1), r() * 6);
      return;
    }
    if (!spec.flower) return;
    const c = G.col(spec.flower, (r() - 0.5) * 0.1);
    if (V.flower === 'tros') {
      // hangende tros (blauweregen)
      const L = 0.22 + r() * 0.14, a = r() * 3.14;
      for (const k of [0, 1.5708]) G.card(p, GRAV, [Math.cos(a + k), 0, Math.sin(a + k)], L * 0.32, L, CELL.spike, c, { flatNormal: true, n: norm(add(side, [0, 0.5, 0])) });
    } else if (V.flower === 'roos') G.disc(add(p, mul(side, 0.03)), norm(add(side, [0, 0.4, 0])), 0.075, CELL.rose, c, r() * 6);
    else if (V.flower === 'ster') G.disc(add(p, mul(side, 0.03)), side, 0.1, CELL.daisy, c, r() * 6);
    else G.disc(add(p, mul(side, 0.03)), side, 0.09, CELL.florets, c, r() * 6);
  };

  const flowerEvery = { tros: 0.18, roos: 0.22, ster: 0.25, bloemetjes: 0.25, druif: 0.45 }[V.flower] || 9;

  const grow = (pts, radius, depth) => {
    // rank langs een lijn, zachtjes om de lijn heen slingerend
    const out = [];
    let phase = r() * 6.28, sLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (L < 1e-4) continue;
      const dir = norm(sub(b, a));
      const ref = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : UP;
      const e1 = norm(cross(dir, ref)), e2 = norm(cross(dir, e1));
      const n = Math.max(1, Math.round(L / 0.06));
      for (let k = 0; k < n; k++) {
        const t = k / n, s2 = sLen + t * L;
        const w = depth === 0 ? 0.045 : 0.012;
        const off = add(mul(e1, Math.cos(phase + s2 * 6.5) * w), mul(e2, Math.sin(phase + s2 * 6.5) * w));
        out.push({ p: add(add(a, mul(sub(b, a), t)), off), dir, s: s2 });
      }
      sLen += L;
    }
    if (pts.length) out.push({ p: pts[pts.length - 1], dir: out.length ? out[out.length - 1].dir : UP, s: sLen });
    if (out.length < 2) return;
    G.tube(out.map((o) => o.p), out.map((o, i) => radius * (1 - 0.5 * i / out.length)), bark, depth === 0 ? 5 : 3);
    // bladeren, bloemen en zijscheuten langs de rank
    let nextLeaf = 0, nextFlower = r() * flowerEvery, nextShoot = 0.3 + r() * 0.3;
    for (const o of out) {
      if (o.s >= nextLeaf) {
        for (let k = 0; k < V.per; k++) {
          const side = leafAt(add(o.p, mul(o.dir, (r() - 0.5) * step)), o.dir);
          if (o.s >= nextFlower && k === 0) { flowerAtV(add(o.p, mul(side, 0.05)), side); nextFlower = o.s + flowerEvery * (0.6 + r() * 0.8) * (full ? 1 : 1.6); }
        }
        nextLeaf = o.s + step * (0.7 + r() * 0.6);
      }
      if (depth < 2 && o.s >= nextShoot) {
        nextShoot = o.s + (full ? 0.35 : 0.6) * (0.7 + r() * 0.6);
        // zijscheut: van een balk hangt hij omlaag, van een paal groeit hij schuin weg
        const horizontal = Math.abs(o.dir[1]) < 0.5;
        let side = norm(cross(o.dir, [r() - 0.5, r() - 0.5, r() - 0.5]));
        if (spec.face) side = norm(add(mul(side, 0.5), [o.dir[1] * 0.0 + (r() - 0.5), (r() - 0.5) * 0.6, 0]));
        const L = (full ? 0.35 : 0.25) + r() * (depth === 0 ? 0.45 : 0.2);
        const pts2 = [o.p];
        for (let k = 1; k <= 4; k++) {
          const t = k / 4;
          const sag = horizontal ? -t * t * L * (0.9 + r() * 0.4) : -t * t * L * 0.3;
          const along = spec.face ? mul(o.dir, t * L * 0.4) : [0, 0, 0];
          pts2.push(add(add(o.p, add(mul(side, t * L * (horizontal ? 0.45 : 0.75)), along)), [0, sag, 0]));
        }
        grow(pts2, radius * 0.35, depth + 1);
      }
    }
  };
  for (const sp of supports) grow(sp, V.stem * (full ? 1 : 0.85), 0);
  return G;
}
