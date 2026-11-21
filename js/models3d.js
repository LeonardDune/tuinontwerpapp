// 3D-modellen van de stencils: meubels, potten, regentonnen, waterelementen, schuren, kas, kliko's, auto,
// poorten, kruidenspiraal, rozenboog, leifruit enz. Elk model in eigen coördinaten: midden van het stencil in de
// oorsprong, x langs de breedte (w), z langs de diepte (h van het stencil, 'onder' op de tekening = +z),
// y omhoog. De aanroeper zet het model op zijn plek en draait het mee.

import { Geo, CELL, buildPlant, buildShrub, buildTree } from './flora3d.js';

const TAU = Math.PI * 2;

/** Klimplanten (zoals in het stencilmenu): blad, bloei per maand en wat ze in de winter doen. */
const CLIMB_ROLES = {
  groen: { leaf: '#4f7f36', bloom: [], winter: 'groen' },
  druif: { leaf: '#6b8f3a', bloom: [], winter: 'weg', autumn: 'geel', fruit: '#6a3d7a', fruitMonths: [8, 9, 10] },
  blauweregen: { leaf: '#6d9a4a', bloom: [5], color: '#9b7fd1', winter: 'weg', autumn: 'geel' },
  roos: { leaf: '#4f7a3a', bloom: [6, 7, 8, 9], color: '#d9577a', winter: 'weg' },
  clematis: { leaf: '#5a8a40', bloom: [6, 7, 8], color: '#7b4fb0', winter: 'weg' },
  kamperfoelie: { leaf: '#5f8f45', bloom: [6, 7, 8], color: '#e8c35a', winter: 'groen' },
  herfst: { leaf: '#5f8f45', bloom: [], winter: 'weg', autumn: 'rood' },
  haagbeuk: { leaf: '#3f6b2d', bloom: [], winter: 'bruin', autumn: 'geel' },
};
/** Begroeiing van een stencil: null (geen) of { full, role }. */
export function climberRole(item, fallback = 'blauweregen') {
  const grow = item.grow || 'geen';
  if (grow === 'geen') return null;
  return { full: grow === 'vol', role: { foliage: 'groen', ...(CLIMB_ROLES[item.growKind || fallback] || CLIMB_ROLES[fallback]) } };
}

function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const KINDS = {
  mat: { roughness: 0.85 },
  wood: { roughness: 0.78 },
  stone: { roughness: 0.95 },
  plastic: { roughness: 0.5 },
  metal: { roughness: 0.38, metalness: 0.55 },
  fabric: { roughness: 0.97 },
  glass: { roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, double: true },
  opal: { roughness: 0.4, transparent: true, opacity: 0.5, depthWrite: false, double: true },
  water: { roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.88 },
};

/** Bouwdoos: verzamelt onderdelen per soort materiaal (één mesh per soort), met kleuren in de hoekpunten. */
export class Kit {
  constructor(T) {
    this.T = T;
    this.L = {};
    this.stack = [new T.Matrix4()];
    this.extra = [];
  }

  get M() { return this.stack[this.stack.length - 1]; }

  /** Onderdelen in een verschoven en gedraaid assenstelsel. */
  at(x, y, z, ry, fn) {
    const m = new this.T.Matrix4().makeRotationY(ry || 0).setPosition(x, y, z);
    this.stack.push(this.M.clone().multiply(m));
    fn();
    this.stack.pop();
  }

  xf(x, y, z, o = {}) {
    const T = this.T;
    return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), new T.Vector3(o.sx || 1, o.sy || 1, o.sz || 1));
  }

  add(geo, color, kind = 'mat', m = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const mm = this.M.clone();
    if (m) mm.multiply(m);
    g.applyMatrix4(mm);
    const L = (this.L[kind] ||= { P: [], N: [], C: [] });
    const c = new this.T.Color(color);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      L.P.push(p.getX(i), p.getY(i), p.getZ(i));
      L.N.push(n.getX(i), n.getY(i), n.getZ(i));
      L.C.push(c.r, c.g, c.b);
    }
    g.dispose();
  }

  /** Blok met de onderkant op hoogte y. */
  box(w, h, d, x, y, z, color, o = {}) {
    this.add(new this.T.BoxGeometry(w, h, d), color, o.kind, this.xf(x, y + h / 2, z, o));
  }

  /** Cilinder (of kegel) met de onderkant op hoogte y. */
  cyl(r1, r2, h, x, y, z, color, o = {}) {
    this.add(new this.T.CylinderGeometry(r1, r2, h, o.seg || 18, 1, !!o.open), color, o.kind, this.xf(x, y + h / 2, z, o));
  }

  sphere(r, x, y, z, color, o = {}) {
    this.add(new this.T.SphereGeometry(r, o.seg || 18, o.seg2 || 12, 0, TAU, 0, o.half ? Math.PI / 2 : Math.PI), color, o.kind, this.xf(x, y, z, o));
  }

  /** Draaivorm: profiel [[straal, hoogte], …] rond de y-as. */
  lathe(profile, x, y, z, color, o = {}) {
    const T = this.T;
    this.add(new T.LatheGeometry(profile.map(([r, yy]) => new T.Vector2(Math.max(0.0001, r), yy)), o.seg || 28), color, o.kind, this.xf(x, y, z, o));
  }

  torus(R, r, x, y, z, color, o = {}) {
    this.add(new this.T.TorusGeometry(R, r, o.ts || 6, o.rs || 28, o.arc || TAU), color, o.kind, this.xf(x, y, z, o));
  }

  /** Staaf van punt a naar punt b. */
  rod(a, b, r, color, kind = 'metal', seg = 6) {
    const T = this.T;
    const A = new T.Vector3(...a), B = new T.Vector3(...b);
    const L = A.distanceTo(B);
    if (L < 1e-4) return;
    const m = new T.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()), new T.Vector3(1, 1, 1));
    this.add(new T.CylinderGeometry(r, r, L, seg), color, kind, m);
  }

  /** Los object (plant, boom) erbij, in het huidige assenstelsel. */
  object(obj, x, y, z, ry = 0) {
    const m = this.M.clone().multiply(this.xf(x, y, z, { ry }));
    obj.applyMatrix4(m);
    this.extra.push(obj);
  }

  build(name) {
    const T = this.T;
    const group = new T.Group();
    group.name = name;
    for (const [kind, L] of Object.entries(this.L)) {
      if (!L.P.length) continue;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(L.P, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(L.N, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(L.C, 3));
      const k = KINDS[kind] || KINDS.mat;
      const m = new T.MeshStandardMaterial({
        vertexColors: true, roughness: k.roughness, metalness: k.metalness || 0, name: kind,
        ...(k.transparent ? { transparent: true, opacity: k.opacity, depthWrite: k.depthWrite !== false } : {}),
        side: k.double ? T.DoubleSide : T.FrontSide,
      });
      const mesh = new T.Mesh(g, m);
      mesh.name = `${name} (${kind})`;
      group.add(mesh);
    }
    for (const o of this.extra) group.add(o);
    return group;
  }
}

// ------------------------------------------------------------------ kleuren

const C = {
  wood: '#9b7a55', darkwood: '#6e5137', teak: '#a8794b', grey: '#7d8186', anthracite: '#3c4045', white: '#e9e6df',
  cushion: '#d9d2c2', cushion2: '#b9b1a0', metal: '#5c6166', terracotta: '#b5653d', stone: '#a7a196', concrete: '#b8b4ab',
  soil: '#4f3b2a', sand: '#e0cf9f', water: '#4d86a3', brick: '#9c5a3c', glassframe: '#d9dcde', moss: '#6f8a43', black: '#2a2c2e',
};

// ------------------------------------------------------------------ meubels

/** Stoel, zitvlak naar +z (kijkrichting); stijl: 'hout', 'metaal', 'lounge', 'bistro'. */
function chair(K, style = 'hout') {
  if (style === 'lounge') {
    K.box(0.78, 0.32, 0.78, 0, 0.06, 0, C.anthracite, { kind: 'wood' });
    K.box(0.66, 0.14, 0.64, 0, 0.38, 0.05, C.cushion, { kind: 'fabric' });
    K.box(0.78, 0.42, 0.14, 0, 0.38, -0.32, C.anthracite, { kind: 'wood' });
    K.box(0.64, 0.4, 0.12, 0, 0.5, -0.22, C.cushion2, { kind: 'fabric', rx: -0.15 });
    for (const sx of [-1, 1]) K.box(0.12, 0.22, 0.78, sx * 0.33, 0.38, 0, C.anthracite, { kind: 'wood' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.06, 0.06, 0.06, sx * 0.34, 0, sz * 0.34, C.black);
    return;
  }
  const metal = style === 'metaal' || style === 'bistro';
  const col = metal ? (style === 'bistro' ? '#3d4f5c' : C.metal) : C.teak;
  const kind = metal ? 'metal' : 'wood';
  const s = style === 'bistro' ? 0.4 : 0.46;
  if (style === 'bistro') K.cyl(s / 2, s / 2, 0.03, 0, 0.44, 0, col, { kind, seg: 20 });
  else K.box(s, 0.04, s, 0, 0.43, 0, col, { kind });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.rod([sx * s * 0.42, 0, sz * s * 0.42], [sx * s * 0.45, 0.44, sz * s * 0.42], metal ? 0.012 : 0.02, col, kind);
  // rugleuning
  for (const sx of [-1, 1]) K.rod([sx * s * 0.42, 0.44, -s * 0.42], [sx * s * 0.44, 0.88, -s * 0.5], metal ? 0.012 : 0.02, col, kind);
  if (style === 'bistro') K.torus(s * 0.45, 0.012, 0, 0.8, -s * 0.12, col, { kind, rx: -1.25, arc: Math.PI, rz: 0 });
  else for (let i = 0; i < 3; i++) K.box(s, 0.07, 0.025, 0, 0.56 + i * 0.1, -s * 0.46 - i * 0.012, col, { kind, rx: -0.1 });
}

function table(K, w, d, h = 0.74, o = {}) {
  const col = o.color || C.teak, kind = o.kind || 'wood';
  if (o.round) {
    K.cyl(w / 2, w / 2, 0.035, 0, h - 0.035, 0, col, { kind, seg: 36 });
    if (w > 0.8) for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.785; K.rod([Math.cos(a) * w * 0.3, 0, Math.sin(a) * w * 0.3], [Math.cos(a) * w * 0.12, h - 0.03, Math.sin(a) * w * 0.12], 0.025, col, kind); }
    else { K.cyl(0.03, 0.03, h - 0.03, 0, 0, 0, col, { kind }); K.cyl(w * 0.3, w * 0.32, 0.03, 0, 0, 0, col, { kind }); }
    return;
  }
  if (o.slats) for (let i = 0, n = Math.max(3, Math.round(d / 0.14)); i < n; i++) K.box(w, 0.035, d / n - 0.012, 0, h - 0.035, -d / 2 + (d / n) * (i + 0.5), col, { kind });
  else K.box(w, 0.035, d, 0, h - 0.035, 0, col, { kind });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.055, h - 0.035, 0.055, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07), col, { kind });
}

/** Stoelen rond een middelpunt laten kijken. */
function chairAt(K, x, z, style) {
  K.at(x, 0, z, Math.atan2(-x, -z), () => chair(K, style));
}

function bench(K, w, d, back, color = C.teak) {
  const seatD = back ? d * 0.75 : d;
  const z0 = back ? d / 2 - seatD / 2 : 0;
  for (let i = 0; i < 4; i++) K.box(w, 0.035, seatD / 4 - 0.012, 0, 0.42, z0 - seatD / 2 + (seatD / 4) * (i + 0.5), color, { kind: 'wood' });
  for (const sx of [-1, 1]) {
    K.box(0.06, 0.42, seatD * 0.9, sx * (w / 2 - 0.08), 0, z0, color, { kind: 'wood' });
    if (back) {
      K.box(0.06, 0.25, 0.06, sx * (w / 2 - 0.03), 0.45, z0 + seatD * 0.35, color, { kind: 'wood' });
      K.box(0.08, 0.04, seatD * 0.8, sx * (w / 2 - 0.03), 0.68, z0, color, { kind: 'wood' });
    }
  }
  if (back) for (let i = 0; i < 3; i++) K.box(w - 0.1, 0.08, 0.025, 0, 0.5 + i * 0.12, -d / 2 + 0.05 - i * 0.02, color, { kind: 'wood', rx: -0.15 });
}

// ------------------------------------------------------------------ potten en planten

/** Pot (rond of vierkant) met aarde; geeft de hoogte van de aarde terug. */
function pot(K, x, z, r, h, color, square = false) {
  if (square) {
    K.add(new K.T.CylinderGeometry(r * 1.414, r * 1.2, h, 4, 1, true), color, 'mat', K.xf(x, h / 2, z, { ry: Math.PI / 4 }));
    K.box(r * 2, 0.03, r * 2, x, h - 0.03, z, color);
    K.box(r * 1.9, 0.02, r * 1.9, x, h - 0.04, z, C.soil, { kind: 'stone' });
    return h - 0.03;
  }
  K.lathe([[r * 0.72, 0], [r * 0.78, 0.02], [r * 0.95, h * 0.85], [r, h * 0.88], [r * 1.04, h], [r * 0.92, h], [r * 0.9, h * 0.94], [0, h * 0.94]], x, 0, z, color, { seg: 28 });
  return h * 0.94;
}

// ------------------------------------------------------------------ modellen per stencil

/**
 * ctx: { leafMat, hedgeMat(color), month, plant(spec, seed) → Mesh, tree(spec, seed) → Mesh, season(role) → { leaf, flower, bare } }
 */
const MODELS = {
  // ---- meubilair
  tafelrond: (K, w, d) => { table(K, Math.min(w, d) * 0.48, 0, 0.74, { round: true }); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; chairAt(K, Math.cos(a) * w * 0.36, Math.sin(a) * d * 0.36, 'hout'); } },
  tafel6: (K, w, d) => {
    const tw = w * 0.7, td = d * 0.45;
    table(K, tw, td, 0.74, { slats: true });
    for (let i = 0; i < 3; i++) { const x = -tw / 2 + (tw / 3) * (i + 0.5); chairAt(K, x, -td / 2 - 0.3, 'hout'); chairAt(K, x, td / 2 + 0.3, 'hout'); }
  },
  loungebank: (K, w, d) => {
    const s = Math.min(w, d) * 0.38;
    // L-vorm: lange kant achter (-z), korte kant links (-x)
    const seat = (x0, x1, z0, z1) => {
      K.box(x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, 0.05, (z0 + z1) / 2, C.anthracite, { kind: 'wood' });
      K.box(x1 - x0 - 0.04, 0.13, z1 - z0 - 0.04, (x0 + x1) / 2, 0.35, (z0 + z1) / 2, C.cushion, { kind: 'fabric' });
    };
    seat(-w / 2, w / 2, -d / 2, -d / 2 + s);
    seat(-w / 2, -w / 2 + s, -d / 2 + s, d / 2);
    K.box(w, 0.4, 0.14, 0, 0.35, -d / 2 + 0.07, C.anthracite, { kind: 'wood' });
    K.box(0.14, 0.4, d - 0.14, -w / 2 + 0.07, 0.35, 0.07, C.anthracite, { kind: 'wood' });
    for (let i = 0; i < 4; i++) K.box(0.5, 0.36, 0.14, -w / 2 + s + 0.3 + i * 0.52, 0.44, -d / 2 + 0.2, i % 2 ? C.cushion2 : C.cushion, { kind: 'fabric', rx: -0.2 });
    K.box(0.14, 0.36, 0.5, -w / 2 + 0.2, 0.44, d / 2 - 0.4, C.cushion2, { kind: 'fabric', rz: 0.2 });
    K.box(0.12, 0.25, 0.12, w / 2 - 0.06, 0.35, -d / 2 + s * 0.5, C.anthracite, { kind: 'wood' });
    K.box(0.9, 0.35, 0.6, w * 0.12, 0, d * 0.12, C.teak, { kind: 'wood' });
  },
  ligbed: (K, w, d) => {
    K.box(w, 0.06, d * 0.68, 0, 0.3, d * 0.16, C.white, { kind: 'plastic' });
    K.box(w - 0.06, 0.06, d * 0.64, 0, 0.36, d * 0.16, C.cushion, { kind: 'fabric' });
    K.box(w, 0.06, d * 0.34, 0, 0.42, -d * 0.31, C.white, { kind: 'plastic', rx: -0.75 });
    K.box(w - 0.06, 0.05, d * 0.32, 0, 0.47, -d * 0.29, C.cushion, { kind: 'fabric', rx: -0.75 });
    for (const sx of [-1, 1]) for (const sz of [-0.42, 0.45]) K.box(0.05, 0.3, 0.05, sx * (w / 2 - 0.05), 0, sz * d, C.white, { kind: 'plastic' });
  },
  parasol: (K, w, d, ctx, item) => {
    const H = item.height > 0 ? item.height : 2.4, R = Math.max(w, d) / 2;
    K.box(0.5, 0.08, 0.5, 0, 0, 0, C.concrete, { kind: 'stone' });
    K.cyl(0.025, 0.025, H, 0, 0, 0, C.metal, { kind: 'metal' });
    K.lathe([[R, 0], [R * 0.98, 0.04], [0.04, 0.5], [0, 0.52]], 0, H - 0.5, 0, item.color || '#e8e0cf', { kind: 'fabric', seg: 8 });
    K.lathe([[0, 0.52], [0.04, 0.5], [R * 0.98, 0.04], [R, 0]], 0, H - 0.505, 0, item.color || '#e8e0cf', { kind: 'fabric', seg: 8 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.rod([0, H - 0.05, 0], [Math.cos(a) * R * 0.97, H - 0.52, Math.sin(a) * R * 0.97], 0.008, C.metal); }
  },
  bbq: (K, w) => {
    const R = w * 0.42;
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; K.rod([Math.cos(a) * R * 0.95, 0, Math.sin(a) * R * 0.95], [Math.cos(a) * R * 0.5, 0.62, Math.sin(a) * R * 0.5], 0.012, C.metal); }
    K.sphere(R, 0, 0.78, 0, C.black, { kind: 'metal', rx: Math.PI, half: true });
    K.sphere(R * 1.01, 0, 0.8, 0, C.black, { kind: 'metal', half: true, sy: 0.85 });
    K.cyl(0.03, 0.03, 0.04, 0, 0.8 + R * 0.85, 0, C.metal, { kind: 'metal' });
    K.box(R * 1.4, 0.02, 0.2, 0, 0.3, 0, C.metal, { kind: 'metal' });
  },
  bank: (K, w, d) => bench(K, w, d, true),
  zitbank: (K, w, d) => bench(K, w, d, false),
  bankhalfrond: (K, w, d) => {
    const R = w / 2, n = 14;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI, a = (a0 + a1) / 2;
      const rr = R - 0.25;
      K.at(Math.cos(a) * rr, 0, Math.sin(a) * rr + d / 2 - 0.05, -a + Math.PI / 2, () => {
        K.box(rr * (a1 - a0) + 0.02, 0.04, 0.42, 0, 0.42, 0, C.teak, { kind: 'wood' });
        if (i % 3 === 0) K.box(0.06, 0.42, 0.36, 0, 0, 0, C.teak, { kind: 'wood' });
        K.box(rr * (a1 - a0) + 0.02, 0.36, 0.04, 0, 0.5, -0.22, C.teak, { kind: 'wood', rx: -0.12 });
      });
    }
  },
  boombank: (K, w) => {
    const R = w / 2, r0 = R * 0.45, n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, len = 2 * (R - 0.2) * Math.tan(Math.PI / n);
      K.at(Math.cos(a) * (R - 0.22), 0, Math.sin(a) * (R - 0.22), -a + Math.PI / 2, () => {
        K.box(len, 0.04, 0.44, 0, 0.42, 0, C.teak, { kind: 'wood' });
        K.box(0.06, 0.42, 0.38, len / 2 - 0.05, 0, 0, C.teak, { kind: 'wood' });
        K.box(len * 0.85, 0.3, 0.04, 0, 0.52, 0.22, C.teak, { kind: 'wood', rx: 0.12 });
      });
    }
    K.cyl(r0 * 0.5, r0 * 0.6, 0.05, 0, 0, 0, C.soil, { kind: 'stone' });
  },
  tuinstoel: (K) => chair(K, 'hout'),
  loungestoel: (K) => chair(K, 'lounge'),
  bistrostoel: (K) => chair(K, 'bistro'),
  terrastafel: (K, w, d) => table(K, w, d),
  terrastafelrecht: (K, w, d) => table(K, w, d, 0.74, { slats: true }),
  tafelrondlos: (K, w) => table(K, w, 0, 0.74, { round: true }),
  bistrotafel: (K, w) => table(K, w, 0, 0.72, { round: true, color: '#3d4f5c', kind: 'metal' }),
  bistroset: (K, w, d) => {
    const t = Math.min(d, w * 0.42);
    table(K, t, 0, 0.72, { round: true, color: '#3d4f5c', kind: 'metal' });
    for (const sx of [-1, 1]) chairAt(K, sx * (t / 2 + (w / 2 - t / 2) * 0.5), 0, 'bistro');
  },
  picknicktafel: (K, w, d) => {
    const td = d * 0.44, bd = d * 0.19;
    for (let i = 0; i < 4; i++) K.box(w, 0.04, td / 4 - 0.01, 0, 0.72, -td / 2 + (td / 4) * (i + 0.5), C.wood, { kind: 'wood' });
    for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) K.box(w, 0.04, bd / 2 - 0.01, 0, 0.42, sz * (d / 2 - bd / 2) + (i - 0.5) * bd / 2, C.wood, { kind: 'wood' });
    for (const x of [-w * 0.38, w * 0.38]) {
      for (const sz of [-1, 1]) K.rod([x, 0, sz * d * 0.42], [x, 0.72, sz * td * 0.25], 0.03, C.wood, 'wood');
      K.box(0.06, 0.06, d * 0.9, x, 0.36, 0, C.wood, { kind: 'wood' });
    }
  },

  // ---- potten & bakken
  potrond: (K, w, d, ctx) => { const y = pot(K, 0, 0, w * 0.45, w * 0.8, C.terracotta); K.object(ctx.plant({ shape: 'kussen', h: 0.35, d: w * 0.95, ...ctx.season({ foliage: 'groen', bloom: [5, 6, 7, 8, 9], color: '#d6688f', winter: 'groen' }) }, 3), 0, y, 0); },
  potvierkant: (K, w, d, ctx) => { const y = pot(K, 0, 0, w * 0.45, w * 0.9, C.anthracite, true); K.object(ctx.plant({ shape: 'rechtop', form: 'aar', h: 0.5, d: w * 0.9, ...ctx.season({ foliage: 'zilver', bloom: [6, 7, 8], color: '#7e6bb8', winter: 'silhouet' }) }, 5), 0, y, 0); },
  potbol: (K, w, d, ctx) => {
    const y = pot(K, 0, 0, w * 0.36, w * 0.6, C.anthracite, true);
    const ball = new K.T.Mesh(new K.T.SphereGeometry(w * 0.42, 24, 16), ctx.hedgeMat('#4a6b35'));
    ball.name = 'buxusbol';
    K.object(ball, 0, y + w * 0.4, 0);
  },
  potgras: (K, w, d, ctx) => { const y = pot(K, 0, 0, w * 0.4, w * 0.7, C.concrete); K.object(ctx.plant({ shape: 'gras', form: 'pluim', h: 0.7, d: w * 1.1, ...ctx.season({ foliage: 'groen', bloom: [8, 9, 10], color: '#d9c58a', winter: 'silhouet' }) }, 7), 0, y, 0); },
  potbloei: (K, w, d, ctx) => { const y = pot(K, 0, 0, w * 0.45, w * 0.85, C.terracotta); K.object(ctx.plant({ shape: 'kussen', form: 'schijf', h: 0.3, d: w * 1.05, ...ctx.season({ foliage: 'groen', bloom: [5, 6, 7, 8, 9], color: '#e85d75', winter: 'weg' }) }, 9), 0, y, 0); },
  potboom: (K, w, d, ctx) => { const y = pot(K, 0, 0, w * 0.26, 0.6, C.terracotta); K.object(ctx.tree({ h: 2.3, rx: w * 0.42, rz: w * 0.42, crown: 0.5, leaf: '#8c9a72' }, 11), 0, y - 0.05, 0); },
  plantenbak: (K, w, d, ctx) => {
    K.box(w, 0.5, d, 0, 0, 0, C.anthracite, { kind: 'metal' });
    K.box(w - 0.04, 0.02, d - 0.04, 0, 0.47, 0, C.soil, { kind: 'stone' });
    const n = Math.max(2, Math.round(w / 0.35));
    for (let i = 0; i < n; i++) K.object(ctx.plant({ shape: i % 2 ? 'gras' : 'kussen', form: 'schijf', h: 0.35, d: Math.min(0.45, d * 1.1), ...ctx.season({ foliage: 'groen', bloom: i % 2 ? [] : [6, 7, 8], color: '#f1f1f1', winter: 'silhouet' }) }, 13 + i), -w / 2 + (w / n) * (i + 0.5), 0.48, 0);
  },
  potgroep: (K, w, d, ctx) => {
    const pots = [[-w * 0.22, -d * 0.12, 0.24, 0.6], [w * 0.22, -d * 0.18, 0.19, 0.45], [w * 0.05, d * 0.22, 0.15, 0.35]];
    pots.forEach(([x, z, r, h], i) => {
      const y = pot(K, x, z, r, h, [C.terracotta, C.concrete, C.anthracite][i], i === 1);
      K.object(ctx.plant({ shape: ['kussen', 'gras', 'kussen'][i], form: 'schijf', h: 0.3 + r, d: r * 2.3, ...ctx.season({ foliage: 'groen', bloom: i === 1 ? [] : [6, 7, 8], color: ['#e9a23b', '#ffffff', '#b46fc9'][i], winter: 'groen' }) }, 21 + i), x, y, z);
    });
  },
  kruidenspiraal: (K, w, d, ctx) => spiral(K, w, d, ctx, true),
  kruidenspiraal_klein: (K, w, d, ctx) => spiral(K, w, d, ctx, false),
  moestuinbak: (K, w, d, ctx) => {
    const h = 0.45, t = 0.04;
    for (const sz of [-1, 1]) K.box(w, h, t, 0, 0, sz * (d / 2 - t / 2), C.wood, { kind: 'wood' });
    for (const sx of [-1, 1]) K.box(t, h, d - t * 2, sx * (w / 2 - t / 2), 0, 0, C.wood, { kind: 'wood' });
    K.box(w - t * 2, 0.02, d - t * 2, 0, h - 0.06, 0, C.soil, { kind: 'stone' });
    const rows = Math.max(2, Math.round(d / 0.45)), cols = Math.max(2, Math.round(w / 0.4));
    const veg = [{ shape: 'kussen', leaf: '#8fbf5a' }, { shape: 'zwaard', leaf: '#6d8f6a' }, { shape: 'kussen', leaf: '#4f7d3c' }, { shape: 'bladplant', leaf: '#5d8f45' }];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const v = veg[i % veg.length];
      if (ctx.month <= 3 || ctx.month >= 11) continue;
      K.object(ctx.plant({ ...v, form: 'blad', h: 0.25, d: 0.28, leaf: v.leaf }, 31 + i), -w / 2 + (w / cols) * (j + 0.5), h - 0.05, -d / 2 + (d / rows) * (i + 0.5), j);
    }
  },
  scherm_bak: (K, w, d, ctx) => {
    K.box(w, 0.45, d, 0, 0, 0, C.anthracite, { kind: 'metal' });
    K.box(w - 0.04, 0.02, d - 0.04, 0, 0.42, 0, C.soil, { kind: 'stone' });
    for (let i = 0; i < 11; i++) K.box(w, 0.09, 0.025, 0, 0.5 + i * 0.12, -d / 2 + 0.06, C.teak, { kind: 'wood' });
    for (const sx of [-1, 1]) K.box(0.05, 1.4, 0.05, sx * (w / 2 - 0.03), 0.45, -d / 2 + 0.06, C.anthracite, { kind: 'metal' });
    for (let i = 0; i < 4; i++) K.object(ctx.plant({ shape: 'gras', form: 'pluim', h: 0.6, d: 0.4, ...ctx.season({ foliage: 'groen', bloom: [8, 9], color: '#e0d3a8', winter: 'silhouet' }) }, 41 + i), -w / 2 + (w / 4) * (i + 0.5), 0.43, 0.05);
  },

  // ---- water
  waterschaal: (K, w) => {
    const R = w / 2;
    K.lathe([[R * 0.3, 0], [R * 0.35, 0.08], [R, 0.38], [R * 1.02, 0.42], [R * 0.9, 0.42], [R * 0.3, 0.2], [0, 0.2]], 0, 0, 0, C.concrete, { kind: 'stone' });
    K.cyl(R * 0.9, R * 0.9, 0.005, 0, 0.37, 0, C.water, { kind: 'water', seg: 32 });
  },
  waterzuil: (K, w) => {
    K.cyl(w / 2, w / 2, 0.04, 0, 0, 0, '#8d8a84', { kind: 'stone', seg: 32 });
    K.cyl(0.17, 0.19, 0.8, 0, 0, 0, C.stone, { kind: 'stone', seg: 20 });
    K.cyl(0.165, 0.2, 0.012, 0, 0.8, 0, C.water, { kind: 'water', seg: 20 });
  },
  watertafel: (K, w, d) => basin(K, w, d, 0.7, 0.03, '#7b4a2c', 'metal'),
  waterbak: (K, w, d) => basin(K, w, d, 0.5, 0.06, C.anthracite, 'stone'),
  waterwand: (K, w, d) => {
    K.box(w, 1.2, 0.2, 0, 0, -d / 2 + 0.1, C.stone, { kind: 'stone' });
    K.box(w * 0.8, 1.1, 0.01, 0, 0.1, -d / 2 + 0.205, '#a9cfe0', { kind: 'water' });
    K.at(0, 0, 0.1, 0, () => basin(K, w, d - 0.2, 0.3, 0.05, C.stone, 'stone'));
  },
  fontein: (K, w) => {
    const R = w / 2;
    K.lathe([[R, 0], [R, 0.4], [R - 0.12, 0.4], [R - 0.12, 0.1], [0, 0.1]], 0, 0, 0, C.stone, { kind: 'stone', seg: 40 });
    K.cyl(R - 0.12, R - 0.12, 0.01, 0, 0.32, 0, C.water, { kind: 'water', seg: 40 });
    K.lathe([[0.15, 0], [0.09, 0.3], [0.08, 0.85], [0.35, 0.95], [0.36, 1.0], [0.3, 1.0], [0.06, 0.95], [0, 0.95]], 0, 0.1, 0, C.stone, { kind: 'stone' });
    K.cyl(0.3, 0.3, 0.005, 0, 1.06, 0, C.water, { kind: 'water' });
    K.lathe([[0.05, 0], [0.04, 0.25], [0.12, 0.3], [0, 0.32]], 0, 1.05, 0, C.stone, { kind: 'stone' });
  },
  vijverrond: (K, w) => {
    const R = w / 2;
    K.lathe([[R, 0], [R, 0.5], [R - 0.2, 0.5], [R - 0.2, 0.02], [0, 0.02]], 0, 0, 0, C.brick, { kind: 'stone', seg: 40 });
    K.cyl(R - 0.2, R - 0.2, 0.01, 0, 0.43, 0, C.water, { kind: 'water', seg: 40 });
  },
  vijverrecht: (K, w, d) => {
    for (const sz of [-1, 1]) K.box(w, 0.08, 0.15, 0, 0, sz * (d / 2 - 0.075), C.concrete, { kind: 'stone' });
    for (const sx of [-1, 1]) K.box(0.15, 0.08, d - 0.3, sx * (w / 2 - 0.075), 0, 0, C.concrete, { kind: 'stone' });
    K.box(w - 0.3, 0.01, d - 0.3, 0, 0.02, 0, C.water, { kind: 'water' });
  },
  vijver: (K, w, d, ctx, item, r) => {
    K.cyl(1, 1, 0.01, 0, 0.02, 0, C.water, { kind: 'water', seg: 40, sx: w / 2 * 0.92, sz: d / 2 * 0.92 });
    for (let i = 0; i < 34; i++) { const a = (i / 34) * TAU; K.sphere(0.12 + r() * 0.08, Math.cos(a) * w / 2 * 0.95, 0.02, Math.sin(a) * d / 2 * 0.95, ['#9b958a', '#857f75', '#aaa498'][i % 3], { kind: 'stone', sy: 0.45, seg: 8, seg2: 6 }); }
  },
  vogelbad: (K, w) => {
    K.lathe([[0.12, 0], [0.06, 0.1], [0.05, 0.6], [w / 2, 0.68], [w / 2, 0.72], [w / 2 - 0.03, 0.72], [0, 0.66]], 0, 0, 0, C.stone, { kind: 'stone' });
    K.cyl(w / 2 - 0.04, w / 2 - 0.04, 0.005, 0, 0.7, 0, C.water, { kind: 'water' });
  },

  // ---- regenwater
  regenton: (K, w, d, ctx, item) => barrel(K, w, 0.95, item.color || '#3f6b3a'),
  regenton_groot: (K, w, d, ctx, item) => barrel(K, w, 1.2, item.color || '#3f6b3a'),
  regenton_vat: (K, w) => {
    const R = w / 2, H = 0.95;
    const prof = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([R * (0.86 + 0.14 * Math.sin(Math.PI * t)), t * H]); }
    prof.push([0, H]);
    K.lathe(prof, 0, 0, 0, '#7a5534', { kind: 'wood', seg: 24 });
    for (const t of [0.1, 0.3, 0.7, 0.9]) K.torus(R * (0.87 + 0.14 * Math.sin(Math.PI * t)), 0.012, 0, t * H, 0, C.black, { kind: 'metal', rx: Math.PI / 2 });
    K.cyl(0.02, 0.02, 0.08, 0, 0.12, R * 0.9, C.metal, { kind: 'metal', rx: Math.PI / 2 });
  },
  regenton_plat: (K, w, d, ctx, item) => {
    K.box(w, 1.2, d, 0, 0, 0, item.color || '#5c5f63', { kind: 'plastic' });
    K.box(w * 0.4, 0.05, d * 0.6, 0, 1.2, 0, C.black, { kind: 'plastic' });
    K.cyl(0.02, 0.02, 0.08, 0, 0.12, d / 2, C.metal, { kind: 'metal', rx: Math.PI / 2 });
  },
  regenton_zuil: (K, w, d, ctx, item) => {
    const R = w / 2;
    K.lathe([[R * 0.5, 0], [R * 0.85, 0.25], [R, 0.55], [R * 0.75, 0.9], [R * 0.45, 1.0], [R * 0.5, 1.05], [0, 1.05]], 0, 0, 0, item.color || '#a46a48', { kind: 'stone', seg: 28 });
  },
  regenton_bak: (K, w, d, ctx) => {
    K.box(w, 0.75, d, 0, 0, 0, C.anthracite, { kind: 'plastic' });
    K.box(w, 0.25, d, 0, 0.75, 0, '#4b4f54', { kind: 'plastic' });
    K.box(w - 0.04, 0.02, d - 0.04, 0, 0.97, 0, C.soil, { kind: 'stone' });
    for (let i = 0; i < 3; i++) K.object(ctx.plant({ shape: 'kussen', form: 'schijf', h: 0.3, d: 0.3, ...ctx.season({ foliage: 'groen', bloom: [6, 7, 8], color: '#f2c14e', winter: 'weg' }) }, 51 + i), -w / 3 + (w / 3) * i, 0.98, 0);
  },
  regentank_ibc: (K, w, d) => {
    K.box(w, 0.14, d, 0, 0, 0, C.darkwood, { kind: 'wood' });
    K.box(w - 0.06, 0.95, d - 0.06, 0, 0.15, 0, '#eeeeea', { kind: 'plastic' });
    for (let i = 0; i <= 4; i++) {
      const x = -w / 2 + (w / 4) * i, z = -d / 2 + (d / 4) * i;
      for (const sz of [-1, 1]) K.rod([x, 0.14, sz * d / 2], [x, 1.12, sz * d / 2], 0.01, C.metal);
      for (const sx of [-1, 1]) K.rod([sx * w / 2, 0.14, z], [sx * w / 2, 1.12, z], 0.01, C.metal);
    }
    for (const y of [0.5, 0.85, 1.12]) {
      for (const sz of [-1, 1]) K.rod([-w / 2, y, sz * d / 2], [w / 2, y, sz * d / 2], 0.01, C.metal);
      for (const sx of [-1, 1]) K.rod([sx * w / 2, y, -d / 2], [sx * w / 2, y, d / 2], 0.01, C.metal);
    }
    K.cyl(0.1, 0.1, 0.05, 0, 1.1, 0, C.black, { kind: 'plastic' });
  },
  regentank_ondergronds: (K, w, d) => { K.cyl(0.3, 0.3, 0.03, 0, 0, 0, '#3e4a3c', { kind: 'plastic' }); },

  // ---- bouw
  schuur: (K, w, d, ctx, item) => shed(K, w, d, item, 'zadel'),
  schuurgroen: (K, w, d, ctx, item) => shed(K, w, d, item, 'groen'),
  schuurmos: (K, w, d, ctx, item) => shed(K, w, d, item, 'mos'),
  kas: (K, w, d, ctx, item) => {
    const H = 1.9, R = item.height > 0 ? item.height : 2.6;
    K.box(w, 0.3, d, 0, 0, 0, C.brick, { kind: 'stone' });
    K.box(w - 0.04, H - 0.3, d - 0.04, 0, 0.3, 0, '#d7ecf2', { kind: 'glass' });
    const rise = R - H, half = d / 2, slope = Math.atan2(rise, half), L = Math.hypot(rise, half);
    for (const sz of [-1, 1]) K.box(w, 0.01, L, 0, H + rise / 2 - 0.005, sz * half / 2, '#d7ecf2', { kind: 'glass', rx: sz * slope });
    // gevels boven
    const tri = new K.T.Shape([new K.T.Vector2(-half, 0), new K.T.Vector2(half, 0), new K.T.Vector2(0, rise)]);
    for (const sx of [-1, 1]) K.add(new K.T.ShapeGeometry(tri), '#d7ecf2', 'glass', K.xf(sx * w / 2, H, 0, { ry: Math.PI / 2 }));
    const fr = C.glassframe;
    for (let i = 0, n = Math.max(2, Math.round(w / 0.75)); i <= n; i++) {
      const x = -w / 2 + (w / n) * i;
      for (const sz of [-1, 1]) K.rod([x, 0.3, sz * half], [x, H, sz * half], 0.02, fr);
      for (const sz of [-1, 1]) K.rod([x, H, sz * half], [x, R, 0], 0.02, fr);
    }
    for (const sx of [-1, 1]) for (const z of [-half, -half / 3, half / 3, half]) K.rod([sx * w / 2, 0.3, z], [sx * w / 2, H + rise * (1 - Math.abs(z) / half), z], 0.02, fr);
    for (const sz of [-1, 1]) K.rod([-w / 2, H, sz * half], [w / 2, H, sz * half], 0.025, fr);
    K.rod([-w / 2, R, 0], [w / 2, R, 0], 0.03, fr);
    K.box(0.7, 1.8, 0.02, 0, 0.05, half + 0.01, '#d7ecf2', { kind: 'glass' });
    for (let i = 0; i < 6; i++) K.object(ctx.plant({ shape: 'rechtop', form: 'knop', h: 0.9, d: 0.4, ...ctx.season({ foliage: 'groen', bloom: [7, 8, 9], color: '#d9412b', winter: 'weg' }) }, 61 + i), -w / 2 + 0.35 + (w - 0.7) * (i % 3) / 2, 0.02, (i < 3 ? -1 : 1) * half * 0.55);
  },
  trampoline: (K, w) => {
    const R = w / 2, H = 0.85;
    K.torus(R, 0.025, 0, H, 0, C.metal, { kind: 'metal', rx: Math.PI / 2, rs: 48 });
    K.torus(R - 0.15, 0.11, 0, H + 0.01, 0, '#2f6fb0', { kind: 'plastic', rx: Math.PI / 2, rs: 48, sz: 0.25, ts: 8 });
    K.cyl(R - 0.25, R - 0.25, 0.01, 0, H - 0.02, 0, C.black, { kind: 'fabric', seg: 48 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, x = Math.cos(a) * R, z = Math.sin(a) * R;
      K.rod([x, 0, z], [x, H, z], 0.022, C.metal);
      K.rod([x * 1.02, H, z * 1.02], [x * 1.02, H + 1.8, z * 1.02], 0.018, '#2b2b2b');
    }
    K.cyl(R * 1.02, R * 1.02, 1.8, 0, H, 0, '#2a2a2a', { kind: 'glass', open: true, seg: 48 });
  },
  zandbak: (K, w, d) => {
    for (const sz of [-1, 1]) K.box(w, 0.28, 0.06, 0, 0, sz * (d / 2 - 0.03), C.wood, { kind: 'wood' });
    for (const sx of [-1, 1]) K.box(0.06, 0.28, d - 0.12, sx * (w / 2 - 0.03), 0, 0, C.wood, { kind: 'wood' });
    for (const sx of [-1, 1]) K.box(0.25, 0.03, d, sx * (w / 2 - 0.125), 0.28, 0, C.wood, { kind: 'wood' });
    K.box(w - 0.12, 0.2, d - 0.12, 0, 0, 0, C.sand, { kind: 'stone' });
  },
  kliko: (K, w, d, ctx, item) => bin(K, w, d, 1.07, item.color || '#5a5f66'),
  kliko140: (K, w, d, ctx, item) => bin(K, w, d, 1.0, item.color || '#5a5f66'),
  kliko3: (K, w, d, ctx, item) => { const bw = (w - 0.06) / 3; ['#5a5f66', '#4f7f36', '#2f5f9e'].forEach((c, k) => K.at(-w / 2 + bw / 2 + k * (bw + 0.03), 0, 0, 0, () => bin(K, bw, d, 1.07, k === 0 ? item.color || c : c))); },
  auto: (K, w, d, ctx, item) => {
    const col = item.color && item.color !== '#555555' ? item.color : '#5f6b78';
    const L = d;
    K.box(w * 0.98, 0.55, L * 0.97, 0, 0.3, 0, col, { kind: 'metal' });
    K.box(w * 0.96, 0.12, L * 0.3, 0, 0.85, -L * 0.33, col, { kind: 'metal', rx: 0.06 });
    // cabine met ramen
    K.box(w * 0.86, 0.5, L * 0.46, 0, 0.82, L * 0.06, '#26313b', { kind: 'metal' });
    K.box(w * 0.82, 0.05, L * 0.4, 0, 1.31, L * 0.07, col, { kind: 'metal' });
    for (const sx of [-1, 1]) for (const sz of [-0.31, 0.32]) K.cyl(0.33, 0.33, 0.22, sx * (w / 2 - 0.12), 0.33, sz * L, '#1f2124', { kind: 'plastic', rz: Math.PI / 2, seg: 20 });
    for (const sx of [-1, 1]) for (const sz of [-0.31, 0.32]) K.cyl(0.2, 0.2, 0.23, sx * (w / 2 - 0.12), 0.33, sz * L, '#b8bcc0', { kind: 'metal', rz: Math.PI / 2, seg: 16 });
    for (const sx of [-1, 1]) {
      K.box(0.25, 0.08, 0.03, sx * w * 0.32, 0.62, -L / 2 + 0.005, '#f2f0e6', { kind: 'plastic' });
      K.box(0.25, 0.08, 0.03, sx * w * 0.34, 0.68, L / 2 - 0.02, '#b3262a', { kind: 'plastic' });
      K.box(0.04, 0.08, 0.14, sx * (w / 2 + 0.06), 0.95, -L * 0.17, col, { kind: 'metal' });
    }
  },

  // ---- pergola's, rozenboog en klimplanten
  rozenboog: (K, w, d, ctx, item) => {
    const R = w / 2 - 0.05, H = 1.9;
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) K.rod([sx * R, 0, sz * d * 0.4], [sx * R, H, sz * d * 0.4], 0.015, C.black);
      K.torus(R, 0.015, 0, H, sz * d * 0.4, C.black, { kind: 'metal', arc: Math.PI, rs: 20 });
    }
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; K.rod([Math.cos(a) * R, H + Math.sin(a) * R, -d * 0.4], [Math.cos(a) * R, H + Math.sin(a) * R, d * 0.4], 0.008, C.black); }
    const pts = [];
    for (const sx of [-1, 1]) for (let y = 0.2; y < H; y += 0.25) pts.push([sx * R, y, 0]);
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; pts.push([Math.cos(a) * R, H + Math.sin(a) * R, 0]); }
    const cr = climberRole(item, 'roos');
    if (cr) K.object(ctx.climber(cr.full ? pts : pts.filter((_, i) => i % 2 === 0), d * 0.9, cr.role, 71), 0, 0, 0);
  },
  klimplant: (K, w, d, ctx, item) => {
    const cr = climberRole({ grow: 'vol', ...item }, 'groen');
    const pts = [];
    for (let x = -w / 2 + 0.2; x <= w / 2 - 0.1; x += cr.full ? 0.28 : 0.45) for (let y = 0.3; y < 2.3; y += 0.3) if (y < 2.3 - Math.abs(x) * 0.25) pts.push([x, y, 0]);
    K.object(ctx.climber(pts, 0.25, cr.role, 81), 0, 0, 0);
  },
  berceau: (K, w, d, ctx, item) => tunnel(K, w, d, ctx, item, C.black, 0.012),
  berceau_hout: (K, w, d, ctx, item) => tunnel(K, w, d, ctx, item, C.wood, 0.03),
  berceau_groen: (K, w, d, ctx, item) => tunnel(K, w, d, ctx, { ...item, grow: 'vol', growKind: 'haagbeuk' }, C.black, 0.012),
  leifruitmuur: (K, w, d, ctx) => espalier(K, w, d, ctx, false),
  leifruitrek: (K, w, d, ctx) => espalier(K, w, d, ctx, true),
  fruitsnoer: (K, w, d, ctx) => {
    for (const sx of [-1, 1]) K.box(0.06, 0.6, 0.06, sx * w / 2, 0, 0, C.wood, { kind: 'wood' });
    K.rod([-w / 2, 0.5, 0], [w / 2, 0.5, 0], 0.003, C.metal);
    const n = Math.max(1, Math.round(w / 1.5));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w / n) * (i + 0.3);
      K.rod([x0, 0, 0], [x0, 0.48, 0], 0.03, '#6a5847', 'wood');
      K.rod([x0, 0.48, 0], [x0 + w / n * 0.65, 0.5, 0], 0.022, '#6a5847', 'wood');
    }
    const pts = [];
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.15) pts.push([x, 0.5, 0]);
    K.object(ctx.climber(pts, 0.2, { foliage: 'groen', bloom: [4, 5], color: '#f6f1e3', winter: 'weg', fruit: true }, 91, 0.25), 0, 0, 0);
  },
  leiboom: (K, w, d, ctx) => {
    K.rod([0, 0, 0], [0, 2.2, 0], 0.07, '#6a5847', 'wood');
    for (let y = 2.3; y < 3.8; y += 0.35) K.rod([-w / 2 * 0.95, y, 0], [w / 2 * 0.95, y, 0], 0.02, '#6a5847', 'wood');
    K.object(ctx.leafBlock(-w / 2, w / 2, 2.15, 3.9, -d / 2 * 0.7, d / 2 * 0.7, { foliage: 'groen', bloom: [], autumn: 'geel', winter: 'weg' }, 101), 0, 0, 0);
  },
  dakleiboom: (K, w, d, ctx) => {
    K.rod([0, 0, 0], [0, 2.3, 0], 0.08, '#6a5847', 'wood');
    for (let i = -2; i <= 2; i++) { K.rod([i * w / 5, 2.4, -d / 2 * 0.95], [i * w / 5, 2.4, d / 2 * 0.95], 0.02, '#6a5847', 'wood'); K.rod([-w / 2 * 0.95, 2.42, i * d / 5], [w / 2 * 0.95, 2.42, i * d / 5], 0.02, '#6a5847', 'wood'); }
    K.object(ctx.leafBlock(-w / 2, w / 2, 2.3, 2.85, -d / 2, d / 2, { foliage: 'groen', bloom: [], autumn: 'geel', winter: 'weg' }, 111), 0, 0, 0);
  },

  // ---- poorten
  poort: (K, w) => gate(K, w, 1.8, 1),
  poortdubbel: (K, w) => gate(K, w, 1.8, 2),
  hekjeterras: (K, w) => gate(K, w, 0.9, 1, true),
  schuifpoort: (K, w) => {
    for (const sx of [-1, 1]) K.box(0.1, 1.7, 0.1, sx * (w / 2 + 0.05), 0, 0, C.anthracite, { kind: 'metal' });
    K.box(w, 0.06, 0.05, 0, 0.12, 0, C.anthracite, { kind: 'metal' });
    K.box(w, 0.06, 0.05, 0, 1.55, 0, C.anthracite, { kind: 'metal' });
    for (let x = -w / 2 + 0.06; x < w / 2; x += 0.12) K.box(0.03, 1.45, 0.03, x, 0.15, 0, C.anthracite, { kind: 'metal' });
  },
  doorgang: () => {},

  // ---- overig
  persoon: (K) => {
    for (const sx of [-1, 1]) K.cyl(0.065, 0.055, 0.85, sx * 0.09, 0, 0, '#2f3d52', { kind: 'fabric', seg: 10 });
    K.cyl(0.17, 0.15, 0.62, 0, 0.85, 0, '#c9653f', { kind: 'fabric', seg: 14, sz: 0.6 });
    for (const sx of [-1, 1]) K.cyl(0.045, 0.04, 0.6, sx * 0.21, 0.88, 0, '#c9653f', { kind: 'fabric', seg: 8, rz: sx * 0.08 });
    K.cyl(0.05, 0.05, 0.08, 0, 1.47, 0, '#d9a98a', { seg: 10 });
    K.sphere(0.11, 0, 1.64, 0, '#d9a98a', { sy: 1.15 });
    K.sphere(0.115, 0, 1.68, -0.01, '#3b2a1e', { sy: 1.0, half: true });
  },
  noordpijl: () => {},
};

/** Bak met water: vier wanden, een donkere bodem en het wateroppervlak net onder de rand. */
function basin(K, w, d, h, t, col, kind) {
  for (const sz of [-1, 1]) K.box(w, h, t, 0, 0, sz * (d / 2 - t / 2), col, { kind });
  for (const sx of [-1, 1]) K.box(t, h, d - t * 2, sx * (w / 2 - t / 2), 0, 0, col, { kind });
  K.box(w - t * 2, h - 0.15, d - t * 2, 0, 0, 0, '#2d3b40', { kind: 'stone' });
  K.box(w - t * 2, 0.005, d - t * 2, 0, h - 0.04, 0, C.water, { kind: 'water' });
}

function barrel(K, w, H, col) {
  const R = w / 2 * 0.96;
  K.cyl(R * 0.93, R * 0.86, H, 0, 0, 0, col, { kind: 'plastic', seg: 28 });
  for (const t of [0.25, 0.5, 0.75]) K.torus(R * (0.86 + 0.07 * t) + 0.005, 0.012, 0, t * H, 0, col, { kind: 'plastic', rx: Math.PI / 2 });
  K.cyl(R * 0.97, R * 0.97, 0.05, 0, H, 0, col, { kind: 'plastic', seg: 28 });
  K.cyl(0.02, 0.02, 0.08, 0, 0.12, R * 0.88, C.metal, { kind: 'metal', rx: Math.PI / 2 });
}

function bin(K, w, d, H, col) {
  K.add(new K.T.CylinderGeometry(0.71, 0.6, 1, 4, 1), col, 'plastic', K.xf(0, (H - 0.06) / 2 + 0.04, 0.02, { ry: Math.PI / 4, sx: w * 0.94, sy: H - 0.1, sz: d * 0.85 }));
  K.box(w, 0.05, d, 0, H - 0.05, 0, col, { kind: 'plastic' });
  K.rod([-w * 0.4, H - 0.08, -d / 2 - 0.02], [w * 0.4, H - 0.08, -d / 2 - 0.02], 0.015, col, 'plastic');
  for (const sx of [-1, 1]) K.cyl(0.1, 0.1, 0.05, sx * (w / 2 - 0.04), 0, -d / 2 + 0.1, '#1d1f21', { kind: 'plastic', rz: Math.PI / 2 });
}

function gate(K, w, H, leaves, picket = false) {
  for (const sx of [-1, 1]) K.box(0.09, H + 0.1, 0.09, sx * (w / 2 + 0.045), 0, 0, C.darkwood, { kind: 'wood' });
  const lw = w / leaves;
  for (let k = 0; k < leaves; k++) {
    const x0 = -w / 2 + lw * k;
    const n = Math.max(3, Math.round(lw / (picket ? 0.11 : 0.13)));
    for (let i = 0; i < n; i++) {
      const top = picket ? H - 0.05 + (i % 2) * 0.05 : H;
      K.box(lw / n - 0.015, top - 0.05, 0.025, x0 + (lw / n) * (i + 0.5), 0.05, 0.02, C.wood, { kind: 'wood' });
    }
    for (const y of [0.2, H - 0.25]) K.box(lw - 0.04, 0.09, 0.03, x0 + lw / 2, y, -0.01, C.wood, { kind: 'wood' });
    K.rod([x0 + 0.05, 0.25, -0.03], [x0 + lw - 0.05, H - 0.2, -0.03], 0.02, C.wood, 'wood');
  }
}

/** Schuur: wanden van verticale planken, deur, raam en dak (zadeldak, groen dak of lessenaarsdak met mos). */
function shed(K, w, d, item, roof) {
  const H = roof === 'zadel' ? 2.1 : 2.2;
  const top = item.height > 0 ? item.height : roof === 'zadel' ? 2.7 : 2.4;
  const col = item.color && item.color !== '#6b4f3a' ? item.color : '#85654a';
  K.box(w, H, d, 0, 0, 0, col, { kind: 'wood' });
  for (let x = -w / 2 + 0.12; x < w / 2; x += 0.14) for (const sz of [-1, 1]) K.box(0.012, H, 0.01, x, 0, sz * (d / 2 + 0.003), '#4f3a2a', { kind: 'wood' });
  K.box(0.9, 1.95, 0.04, -w * 0.2, 0, d / 2 + 0.01, '#4a3727', { kind: 'wood' });
  K.box(0.6, 0.5, 0.03, w * 0.25, 1.1, d / 2 + 0.01, '#2b3640', { kind: 'metal' });
  K.box(0.68, 0.06, 0.05, w * 0.25, 1.05, d / 2 + 0.02, C.white);
  if (roof === 'zadel') {
    const rise = top - H, half = d / 2 + 0.15, L = Math.hypot(rise, half), slope = Math.atan2(rise, half);
    for (const sz of [-1, 1]) K.box(w + 0.3, 0.04, L, 0, H + rise / 2 - 0.02, sz * half / 2, '#3a3d40', { rx: sz * slope });
    const tri = new K.T.Shape([new K.T.Vector2(-d / 2, 0), new K.T.Vector2(d / 2, 0), new K.T.Vector2(0, rise - 0.03)]);
    for (const sx of [-1, 1]) K.add(new K.T.ShapeGeometry(tri), col, 'wood', K.xf(sx * (w / 2 + 0.001), H, 0, { ry: sx * Math.PI / 2 }));
  } else if (roof === 'groen') {
    K.box(w + 0.3, 0.12, d + 0.3, 0, H, 0, '#3a3d40');
    K.box(w + 0.2, 0.08, d + 0.2, 0, H + 0.12, 0, '#7d9a4a', { kind: 'fabric' });
  } else {
    const drop = 0.35, slope = Math.atan2(drop, d + 0.3);
    K.box(w + 0.3, 0.08, Math.hypot(d + 0.3, drop), 0, H + drop / 2 - 0.04, 0, C.moss, { kind: 'fabric', rx: -slope });
  }
}

/** Kruidenspiraal: stapelmuurtje dat in een spiraal oploopt naar het midden, aarde, kruiden en (groot) een vijvertje. */
function spiral(K, w, d, ctx, pond) {
  const R = Math.min(w, d) / 2 * (pond ? 0.82 : 0.95);
  const ox = pond ? -(w / 2 - R) * 0.9 : 0, oz = pond ? -(d / 2 - R) * 0.9 : 0;
  const top = pond ? 0.95 : 0.75;
  const r = rng(Math.round(w * 1000));
  const turns = 2.1, start = 0.04;
  const rad = (t) => R * (0.95 - 0.8 * t), ang = (t) => t * turns * TAU, hgt = (t) => 0.12 + (top - 0.12) * Math.pow(t, 0.9);
  // grond: een heuvel die naar het midden oploopt
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([rad(t) * 0.98 + 0.02, hgt(t) * 0.92 - 0.04]); }
  prof.push([0, top * 0.92]);
  K.lathe([[rad(0) + 0.05, 0], ...prof], ox, 0, oz, C.soil, { kind: 'stone', seg: 40 });
  // muurtje: stenen langs de spiraal, in lagen tot de hoogte ter plaatse
  let t = start;
  while (t < 1) {
    const rr = rad(t), a = ang(t);
    const step = 0.2 / Math.max(0.2, rr * turns * TAU);
    const courses = Math.max(1, Math.round(hgt(t) / 0.1));
    for (let c = 0; c < courses; c++) {
      const tone = ['#a79f91', '#918a7e', '#b8ae9e', '#9c9486'][Math.floor(r() * 4)];
      const aa = a + (c % 2 ? step * turns * Math.PI * 0.5 : 0);
      K.box(0.2, 0.095, 0.15, ox + Math.cos(aa) * rr, c * 0.1, oz + Math.sin(aa) * rr, tone, { kind: 'stone', ry: -aa + Math.PI / 2 + (r() - 0.5) * 0.1 });
    }
    t += step;
  }
  // kruiden langs de spiraal, net binnen het muurtje
  const herbs = [
    { shape: 'rechtop', form: 'aar', foliage: 'zilver', bloom: [6, 7, 8], color: '#8e7cc3', winter: 'groen' }, // lavendel
    { shape: 'mat', form: 'scherm', foliage: 'donker', bloom: [6, 7], color: '#c77fb0', winter: 'groen' }, // tijm
    { shape: 'kussen', form: 'blad', foliage: 'zilver', bloom: [], color: '#9aab8f', winter: 'groen' }, // salie
    { shape: 'rechtop', form: 'bloemetjes', foliage: 'donker', bloom: [4, 5], color: '#a9b8e0', winter: 'groen' }, // rozemarijn
    { shape: 'gras', form: 'knop', foliage: 'groen', bloom: [5, 6], color: '#c27bb8', winter: 'weg' }, // bieslook
    { shape: 'kussen', form: 'blad', foliage: 'groen', bloom: [], color: '#6f9a4a', winter: 'weg' }, // peterselie/basilicum
  ];
  const n = pond ? 14 : 10;
  for (let i = 0; i < n; i++) {
    const tt = 0.1 + (i / n) * 0.85;
    const rr = Math.max(0.12, rad(tt) - 0.18), a = ang(tt) + 0.3;
    const hb = herbs[i % herbs.length];
    const st = ctx.season(hb);
    if (st.bare) continue;
    K.object(ctx.plant({ shape: hb.shape, form: hb.form, h: 0.22 + r() * 0.12, d: 0.3 + r() * 0.1, ...st }, 120 + i), ox + Math.cos(a) * rr, Math.max(0.05, hgt(tt) * 0.92 - 0.06), oz + Math.sin(a) * rr);
  }
  if (pond) {
    const pr = Math.min(w, d) * 0.2, px = ox + Math.cos(ang(start)) * (R + pr * 0.55), pz = oz + Math.sin(ang(start)) * (R + pr * 0.55) * 0.3 + pr * 0.6;
    K.cyl(pr, pr, 0.01, px, 0.02, pz, C.water, { kind: 'water', seg: 28 });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; K.sphere(0.08, px + Math.cos(a) * pr, 0.02, pz + Math.sin(a) * pr, '#968f83', { kind: 'stone', sy: 0.5, seg: 8, seg2: 6 }); }
  }
}

/** Berceau / pergolagang van bogen over een pad, met klimplanten (item.grow: 'vol', 'deels', leeg). */
function tunnel(K, w, d, ctx, item, col, t) {
  const R = d / 2 - 0.05, H = 1.5;
  const n = Math.max(2, Math.round(w / 1.2));
  const xs = [];
  for (let i = 0; i <= n; i++) xs.push(-w / 2 + 0.05 + ((w - 0.1) / n) * i);
  for (const x of xs) {
    for (const sz of [-1, 1]) K.rod([x, 0, sz * R], [x, H, sz * R], t, col, t > 0.02 ? 'wood' : 'metal');
    K.torus(R, t, x, H, 0, col, { kind: t > 0.02 ? 'wood' : 'metal', arc: Math.PI, rs: 20, ry: Math.PI / 2 });
  }
  for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI; K.rod([-w / 2, H + Math.sin(a) * R, Math.cos(a) * R], [w / 2, H + Math.sin(a) * R, Math.cos(a) * R], t * 0.6, col); }
  const cr = climberRole(item, 'roos');
  if (!cr) return;
  const full = cr.full;
  const pts = [];
  for (let x = -w / 2 + 0.1; x < w / 2; x += full ? 0.3 : 0.45) {
    for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; if (full || k % 2 === 0) pts.push([x, H + Math.sin(a) * R, Math.cos(a) * R]); }
    for (const sz of [-1, 1]) for (let y = 0.3; y < H; y += full ? 0.25 : 0.45) pts.push([x, y, sz * R]);
  }
  K.object(ctx.climber(pts, 0.22, cr.role, 131, full ? 0.34 : 0.28), 0, 0, 0);
}

/** Leifruit: stam met horizontale etages langs draden (tegen een muur of aan een rek). */
function espalier(K, w, d, ctx, rack) {
  const tiers = [0.55, 1.05, 1.55, 2.0];
  if (rack) {
    for (const sx of [-1, 1]) K.box(0.08, 2.2, 0.08, sx * (w / 2 - 0.04), 0, 0, C.wood, { kind: 'wood' });
    for (const y of tiers) K.rod([-w / 2, y, 0], [w / 2, y, 0], 0.003, C.metal);
  }
  K.rod([0, 0, 0], [0, 2.0, 0], 0.045, '#6a5847', 'wood');
  const pts = [];
  for (const y of tiers) for (const sx of [-1, 1]) {
    K.rod([0, y, 0], [sx * w * 0.45, y + 0.04, 0], 0.025, '#6a5847', 'wood');
    for (let x = 0.15; x < w * 0.45; x += 0.15) pts.push([sx * x, y + 0.05, 0]);
  }
  K.object(ctx.climber(pts, 0.18, { foliage: 'groen', bloom: [4, 5], color: '#f6f1e3', autumn: 'geel', winter: 'weg', fruit: true }, 141, 0.26), 0, 0, 0);
}

/** Heeft dit stencil een eigen 3D-model? */
export function hasModel(symbol) {
  return Object.prototype.hasOwnProperty.call(MODELS, symbol);
}

/** Bouw het model (THREE.Group, of null als er niets te zien is). */
export function stencilModel(T, item, ctx) {
  const fn = MODELS[item.symbol];
  if (!fn) return null;
  const K = new Kit(T);
  fn(K, item.w, item.h, ctx, item, rng(Math.round((item.x || 0) * 131 + (item.y || 0) * 977) + 5));
  const g = K.build(item.symbol);
  return g.children.length ? g : null;
}

// ------------------------------------------------------------------ deuren en ramen in een muur

/** Deur, raam of pui in een muur: een paneel dat aan beide kanten net uit de muur steekt. */
export function openingModel(T, item, wallWidth) {
  const K = new Kit(T);
  const t = (wallWidth || 0.2) + 0.03, w = item.w;
  const glass = /raam|schuif|openslaand/.test(item.symbol);
  if (item.symbol === 'raam') {
    K.box(w, 1.3, t, 0, 0.9, 0, C.white);
    K.box(w - 0.12, 1.18, t + 0.01, 0, 0.96, 0, '#2c3a46', { kind: 'metal' });
    K.box(w + 0.1, 0.05, t + 0.06, 0, 0.86, 0, C.white);
  } else {
    const H = 2.15;
    K.box(w, H, t, 0, 0, 0, C.white);
    if (glass) {
      const n = item.symbol === 'schuifpui' ? 3 : 2;
      for (let i = 0; i < n; i++) K.box(w / n - 0.1, H - 0.12, t + 0.01, -w / 2 + (w / n) * (i + 0.5), 0.06, 0, '#2c3a46', { kind: 'metal' });
    } else {
      const leaves = item.symbol === 'dubbeledeur' ? 2 : 1;
      for (let i = 0; i < leaves; i++) K.box(w / leaves - 0.08, H - 0.06, t + 0.01, -w / 2 + (w / leaves) * (i + 0.5), 0, 0, item.symbol === 'deur' ? '#e3ded3' : '#3e5a4a', { kind: 'wood' });
    }
  }
  return K.build(item.symbol);
}

export { Geo, CELL, buildPlant, buildShrub, buildTree };

// ------------------------------------------------------------------ huis en overkapping (wereldcoördinaten)

let brickCanvas = null, tileCanvas = null;
function brickTile() {
  if (brickCanvas) return brickCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#cfc8bb'; // voeg
  g.fillRect(0, 0, 512, 512);
  const r = rng(17), rows = 16, bw = 128; // 1 m: 16 lagen, 4 stenen
  for (let i = 0; i < rows; i++) {
    const y = i * 32, off = (i % 2) * 64;
    for (let x = -64; x < 512; x += bw) {
      const t = r();
      g.fillStyle = `rgb(${150 + t * 40 | 0},${72 + t * 25 | 0},${52 + t * 18 | 0})`;
      g.fillRect(x + off + 3, y + 3, bw - 6, 26);
    }
  }
  brickCanvas = c;
  return c;
}
function roofTile() {
  if (tileCanvas) return tileCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2f3033';
  g.fillRect(0, 0, 256, 256);
  const r = rng(29);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const t = r();
    const gr = g.createLinearGradient(0, i * 32, 0, i * 32 + 32);
    gr.addColorStop(0, `rgb(${70 + t * 18 | 0},${72 + t * 18 | 0},${76 + t * 18 | 0})`);
    gr.addColorStop(1, `rgb(${48 + t * 10 | 0},${50 + t * 10 | 0},${54 + t * 10 | 0})`);
    g.fillStyle = gr;
    g.fillRect(j * 32 + ((i % 2) * 16) + 1, i * 32 + 1, 30, 30);
  }
  tileCanvas = c;
  return c;
}
function canvasTex(T, canvas) {
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 8;
  t.userData.mimeType = 'image/jpeg';
  return t;
}

/** Georiënteerde omhullende rechthoek van een veelhoek. */
export function orientedBox(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], v = [-u[1], u[0]];
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of ring) { const pu = p[0] * u[0] + p[1] * u[1], pv = p[0] * v[0] + p[1] * v[1]; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, u, v, u0, u1, v0, v1 };
  }
  const { u, v, u0, u1, v0, v1 } = best;
  // lange as = u
  let hu = (u1 - u0) / 2, hv = (v1 - v0) / 2, U = u, V = v;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const c = [u[0] * cu + v[0] * cv, u[1] * cu + v[1] * cv];
  if (hv > hu) { [hu, hv] = [hv, hu]; U = v; V = [-u[0], -u[1]]; }
  return { c, u: U, v: V, hu, hv, area: best.area };
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

/**
 * Huis: bakstenen gevels met ramen per verdieping (en een schuifpui naar de tuin), zadeldak met pannen bij een
 * (bijna) rechthoekige plattegrond, anders een plat dak met dakrand.
 * opts: { shared(a, b) → true als die gevel tegen een ander gebouw staat, garden: [x, y], name }
 */
export function buildHouse(T, ring, H, opts = {}) {
  const K = new Kit(T);
  const group = new T.Group();
  group.name = opts.name || 'huis';
  if (ringArea(ring) < 0) ring = [...ring].reverse(); // tegen de klok in: buitenkant links van a→b … in tekening-assen
  const area = Math.abs(ringArea(ring));
  const ob0 = orientedBox(ring);
  // nok evenwijdig aan de gevel die naar de tuin kijkt (zoals bij de meeste rijtjes- en twee-onder-een-kapwoningen)
  let ob = ob0;
  {
    const c0 = ring.reduce((acc, p) => [acc[0] + p[0] / ring.length, acc[1] + p[1] / ring.length], [0, 0]);
    const gd = opts.garden || c0;
    let best = null;
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 2) return;
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let n = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L];
      if ((m[0] - c0[0]) * n[0] + (m[1] - c0[1]) * n[1] < 0) n = [-n[0], -n[1]];
      const gl = Math.hypot(gd[0] - m[0], gd[1] - m[1]) || 1;
      const dot = (n[0] * (gd[0] - m[0]) + n[1] * (gd[1] - m[1])) / gl;
      if (!best || dot > best.dot) best = { dot, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
    });
    if (best && best.dot > 0.3) {
      const u = best.u, v = [-u[1], u[0]];
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const p of ring) { const pu = p[0] * u[0] + p[1] * u[1], pv = p[0] * v[0] + p[1] * v[1]; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      ob = { c: [u[0] * cu + v[0] * cv, u[1] * cu + v[1] * cv], u, v, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2, area: (u1 - u0) * (v1 - v0) };
    }
  }
  const rect = area / ob0.area > 0.9 && H >= 4.2 && ob.hv >= 1.5;
  const rise = rect ? Math.min(H * 0.42, ob.hv * 0.9) : 0;
  const eave = H - rise;
  const brick = new T.MeshStandardMaterial({ map: canvasTex(T, brickTile()), roughness: 0.92, name: 'baksteen', side: T.DoubleSide });
  // gevels
  const shape = new T.Shape(ring.map((p) => new T.Vector2(p[0], p[1])));
  const wallGeo = new T.ExtrudeGeometry(shape, { depth: eave, bevelEnabled: false });
  wallGeo.rotateX(Math.PI / 2);
  wallGeo.translate(0, eave, 0);
  const flatTop = new T.MeshStandardMaterial({ color: '#3d3f42', roughness: 0.9, name: 'plat dak' });
  const walls = new T.Mesh(wallGeo, [flatTop, brick]);
  walls.name = 'gevels';
  group.add(walls);

  // ramen en pui
  const cen = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
  const garden = opts.garden || cen;
  let gardenEdge = -1, bestDot = -Infinity;
  const edges = ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let n = [(b[1] - a[1]) / (L || 1), -(b[0] - a[0]) / (L || 1)];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if ((m[0] - cen[0]) * n[0] + (m[1] - cen[1]) * n[1] < 0) n = [-n[0], -n[1]];
    return { a, b, L, n, m };
  });
  edges.forEach((e, i) => {
    if (e.L < 2 || (opts.shared && opts.shared(e.a, e.b))) { e.blind = true; return; }
    const gl = Math.hypot(garden[0] - e.m[0], garden[1] - e.m[1]) || 1;
    const dot = (e.n[0] * (garden[0] - e.m[0]) + e.n[1] * (garden[1] - e.m[1])) / gl;
    if (dot > bestDot) { bestDot = dot; gardenEdge = i; }
  });
  const storeys = Math.max(1, Math.floor((eave + 0.6) / 2.75));
  edges.forEach((e, i) => {
    if (e.blind) return;
    const d = [(e.b[0] - e.a[0]) / e.L, (e.b[1] - e.a[1]) / e.L];
    // lokale x langs de gevel, lokale +z naar buiten
    const flip = d[0] * e.n[1] - d[1] * e.n[0] < 0; // n moet links (–dz, dx) liggen
    const ux = flip ? -d[0] : d[0], uz = flip ? -d[1] : d[1];
    const ry = Math.atan2(-uz, ux);
    const n = Math.max(1, Math.floor((e.L - 0.6) / 1.9));
    K.at(e.m[0], 0, e.m[1], ry, () => {
      for (let f = 0; f < storeys; f++) {
        const ground = f === 0;
        for (let k = 0; k < n; k++) {
          const x = -e.L / 2 + (e.L / n) * (k + 0.5);
          if (ground && i === gardenEdge && n >= 2 && k === Math.floor(n / 2)) continue;
          const y = ground ? 0.85 : f * 2.8 + 0.8, wh = ground ? 1.4 : 1.3, ww = 1.1;
          if (y + wh > eave - 0.15) continue;
          window(K, x, y, ww, wh);
        }
        if (ground && i === gardenEdge) {
          // schuifpui naar de tuin
          const pw = Math.min(3, e.L * 0.45), px = n >= 2 ? -e.L / 2 + (e.L / n) * (Math.floor(n / 2) + 0.5) : 0;
          K.box(pw + 0.12, 2.36, 0.08, px, 0, 0.0, C.white);
          for (let j = 0; j < 3; j++) K.box(pw / 3 - 0.06, 2.2, 0.03, px - pw / 2 + (pw / 3) * (j + 0.5), 0.06, 0.05, '#2c3a46', { kind: 'metal' });
          K.box(pw + 0.3, 0.05, 0.4, px, 0, 0.2, C.concrete, { kind: 'stone' });
        }
      }
    });
  });

  // dak
  if (rect) {
    const roofMat = new T.MeshStandardMaterial({ map: canvasTex(T, roofTile()), roughness: 0.85, name: 'dakpannen' });
    const over = 0.35, ang = Math.atan2(rise, ob.hv), slopeL = ob.hv / Math.cos(ang) + over, L = ob.hu * 2 + 0.4;
    // assenstelsel op de nok: x langs de nok (lange as), z dwars, y omhoog
    const ridge = new T.Group();
    ridge.position.set(ob.c[0], eave + rise + 0.04, ob.c[1]);
    ridge.rotation.y = Math.atan2(-ob.u[1], ob.u[0]);
    for (const s of [-1, 1]) {
      const geo = new T.BoxGeometry(L, 0.06, slopeL);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L, uv.getY(i) * slopeL);
      const m = new T.Mesh(geo, roofMat);
      m.position.set(0, -Math.sin(ang) * slopeL / 2, s * Math.cos(ang) * slopeL / 2);
      m.rotation.x = s * ang;
      m.name = 'dak';
      ridge.add(m);
    }
    const tri = new T.Shape([new T.Vector2(-ob.hv, 0), new T.Vector2(ob.hv, 0), new T.Vector2(0, rise)]);
    for (const s of [-1, 1]) {
      const m = new T.Mesh(new T.ShapeGeometry(tri), brick);
      m.position.set(s * ob.hu, -rise - 0.04, 0);
      m.rotation.y = Math.PI / 2;
      m.name = 'gevelpunt';
      ridge.add(m);
    }
    group.add(ridge);
    // nok en schoorsteen
    K.rod([ob.c[0] - ob.u[0] * (ob.hu + 0.2), eave + rise + 0.04, ob.c[1] - ob.u[1] * (ob.hu + 0.2)], [ob.c[0] + ob.u[0] * (ob.hu + 0.2), eave + rise + 0.04, ob.c[1] + ob.u[1] * (ob.hu + 0.2)], 0.07, '#2b2c2f', 'mat');
    const ch = [ob.c[0] + ob.u[0] * ob.hu * 0.55 + ob.v[0] * ob.hv * 0.3, ob.c[1] + ob.u[1] * ob.hu * 0.55 + ob.v[1] * ob.hv * 0.3];
    K.box(0.5, rise * 0.75 + 0.6, 0.5, ch[0], eave + rise * 0.55, ch[1], '#8e4a35', { kind: 'stone', ry: Math.atan2(-ob.u[1], ob.u[0]) });
  } else {
    // dakrand
    for (const e of edges) {
      const ry = Math.atan2(-(e.b[1] - e.a[1]), e.b[0] - e.a[0]);
      K.box(e.L + 0.05, 0.18, 0.06, e.m[0], eave - 0.02, e.m[1], '#3a3c3f', { ry });
    }
  }
  const parts = K.build('details');
  for (const c of [...parts.children]) group.add(c);
  return group;
}

/** Raam: kozijn, glas met roede, vensterbank. Lokale +z = buitenkant. */
function window(K, x, y, w, h) {
  K.box(w + 0.12, h + 0.12, 0.08, x, y - 0.06, 0.0, C.white);
  K.box(w - 0.04, h - 0.04, 0.03, x, y + 0.02, 0.05, '#2c3a46', { kind: 'metal' });
  K.box(0.04, h - 0.04, 0.035, x, y + 0.02, 0.055, C.white);
  K.box(w + 0.2, 0.05, 0.14, x, y - 0.1, 0.06, C.concrete, { kind: 'stone' });
}

/**
 * Overkapping (veranda, pergola, lamellendak) boven een vlak: staanders, liggers en een dak dat je ziet
 * zitten maar waar je doorheen kijkt (glas, open balken of lamellen). type: 'veranda' | 'pergola' | 'lamellen' | 'dicht'.
 */
export function buildCanopy(T, ring, H, type, color) {
  const K = new Kit(T);
  const ob = orientedBox(ring);
  const frame = type === 'pergola' ? (color || C.wood) : (color || C.anthracite);
  const kind = type === 'pergola' ? 'wood' : 'metal';
  const P = (a, b) => [ob.c[0] + ob.u[0] * a + ob.v[0] * b, ob.c[1] + ob.u[1] * a + ob.v[1] * b];
  const ps = type === 'pergola' ? 0.12 : 0.09;
  // staanders aan de voorkant (+v) en op de hoeken; liggers rondom
  const n = Math.max(1, Math.round((ob.hu * 2) / 3));
  for (let i = 0; i <= n; i++) for (const sv of [-1, 1]) {
    const [x, z] = P(-ob.hu + ps / 2 + ((ob.hu * 2 - ps) / n) * i, sv * (ob.hv - ps / 2));
    if (sv < 0 && i > 0 && i < n) continue;
    K.box(ps, H, ps, x, 0, z, frame, { kind });
  }
  const ry = Math.atan2(-ob.u[1], ob.u[0]);
  for (const sv of [-1, 1]) { const [x, z] = P(0, sv * (ob.hv - ps / 2)); K.box(ob.hu * 2, 0.18, ps, x, H - 0.18, z, frame, { kind, ry }); }
  for (const su of [-1, 1]) { const [x, z] = P(su * (ob.hu - ps / 2), 0); K.box(ps, 0.18, ob.hv * 2, x, H - 0.18, z, frame, { kind, ry }); }
  if (type === 'pergola') {
    for (let a = -ob.hu + 0.25; a < ob.hu; a += 0.5) { const [x, z] = P(a, 0); K.box(0.06, 0.14, ob.hv * 2 + 0.3, x, H, z, frame, { kind, ry }); }
  } else if (type === 'lamellen') {
    for (let a = -ob.hu + 0.12; a < ob.hu; a += 0.22) { const [x, z] = P(a, 0); K.box(0.18, 0.02, ob.hv * 2 - 0.1, x, H - 0.1, z, '#c9cccf', { kind: 'metal', ry, rz: 0.6 }); }
  } else {
    // glazen (of opaal) dak met profielen en goot aan de voorkant
    const glass = type === 'dicht' ? '#e9eef0' : '#d7ecf2';
    const [x, z] = P(0, 0);
    K.box(ob.hu * 2, 0.012, ob.hv * 2 + 0.1, x, H, z, glass, { kind: type === 'dicht' ? 'opal' : 'glass', ry, rx: 0 });
    for (let a = -ob.hu; a <= ob.hu + 0.01; a += Math.max(0.6, (ob.hu * 2) / Math.round(ob.hu * 2 / 0.75))) { const [px, pz] = P(Math.min(a, ob.hu - 0.03), 0); K.box(0.05, 0.09, ob.hv * 2 + 0.1, px, H - 0.02, pz, frame, { kind, ry }); }
    const [gx, gz] = P(0, ob.hv + 0.05);
    K.box(ob.hu * 2 + 0.1, 0.12, 0.12, gx, H - 0.08, gz, frame, { kind, ry });
  }
  return K.build('overkapping');
}
