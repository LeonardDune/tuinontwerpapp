// Het ontwerp als 3D-model voor de wandeling en de export (glTF). Alles in meters:
// x = rechts op de tekening, z = omlaag op de tekening, y = omhoog.
//
// - De grond is de tekening zelf (bestrating, gras, water, aarde in de vakken), van bovenaf als textuur.
// - Wat hoogte heeft, staat er als 3D-vorm op: muren, schuttingen, gebouwen en vlakken met een hoogte,
//   hagen, bomen, heesters, pergola's, parasols, en de planten in de plantvakken (kleur van de gekozen maand).

import { STENCIL_MAP } from './stencils.js';
import { itemOutline } from './items.js';
import { stencilShadow, itemHeight } from './shadows.js';
import { rolesMap, isBed, isGroup, shapePolygon, layoutPoints, roleDiameter, monthState, HEIGHTS, BED_TYPES, FOLIAGE, AUTUMN } from './planting.js';
import { PLANTS, plantById, roleFromPlant } from './plantdb.js';
import { plantForStencil } from './planting.js';
import { plantShape } from './plantdraw.js';
import { wallShape } from './walls.js';
import { FENCES } from './fences.js';
import { contentBox } from './export.js';
import { renderScene, plantContext } from './render.js';
import { Camera } from './camera.js';
import { dist, distToSegment, pointInPolygon, polygonArea } from './geom.js';

const FRAME = /pergola|berceau|overkapping|lamellendak|veranda/;
const WALL_H = 2;

/** Krijgt dit item een eigen 3D-vorm (en hoort het dus niet op de grondtekening)? */
function in3d(item) {
  if (item.type === 'text' || item.type === 'dim' || item.type === 'plant') return true;
  if (item.type === 'shape') return !!item.wall || isGroup(item) || itemHeight(item) > 0;
  if (item.type === 'stencil') {
    const def = STENCIL_MAP[item.symbol];
    return !!def?.opening || FRAME.test(item.symbol) || itemHeight(item) > 0;
  }
  return false;
}

/** Hoogte (m) van een bouwsteen uit de beplanting. */
function roleHeight(r) {
  const p = r.plant && plantById(r.plant);
  if (p && p.h) return p.h / 100;
  return HEIGHTS[r.height]?.h ?? 0.5;
}

function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function hashId(id) {
  return String(id || '').split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1e9, 7);
}

/** Gebied van het model: de getekende tuin met wat ruimte eromheen. */
export function modelBox(doc) {
  const b = contentBox(doc);
  if (!b) return { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  const m = 2;
  return { minX: b.minX - m, minY: b.minY - m, maxX: b.maxX + m, maxY: b.maxY + m };
}

/** De tekening van bovenaf, zonder wat in 3D komt (canvas). */
export function groundCanvas(doc, box, month, maxPx = 4096) {
  const bw = box.maxX - box.minX, bh = box.maxY - box.minY;
  const ppm = Math.max(4, Math.min(80, maxPx / Math.max(bw, bh)));
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(bw * ppm));
  c.height = Math.max(2, Math.round(bh * ppm));
  const cam = new Camera();
  cam.zoom = ppm;
  cam.x = -box.minX * ppm;
  cam.y = -box.minY * ppm;
  renderScene(c.getContext('2d'), {
    doc, cam, width: c.width, height: c.height, dpr: 1, background: '#a9b48e', paperColor: '#e6e1d3',
    plantView: 'grond', month, skip: in3d,
  });
  return c;
}

/**
 * Bouw het model. T = de three.js-module (window.Tuin3D.THREE).
 * opts: { month (1..12) }. Geeft { group, box, start, stats }.
 */
export function buildGarden(T, doc, opts = {}) {
  const month = opts.month || new Date().getMonth() + 1;
  const winter = month >= 11 || month <= 3;
  const box = modelBox(doc);
  const group = new T.Group();
  group.name = doc.name || 'Tuinontwerp';
  const stats = { prisms: 0, walls: 0, fences: 0, trees: 0, bushes: 0, plants: 0, frames: 0 };

  const mats = new Map();
  const mat = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    if (!mats.has(key)) {
      const m = new T.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.92, metalness: o.metalness ?? 0, ...(o.opacity != null && o.opacity < 1 ? { transparent: true, opacity: o.opacity, depthWrite: o.opacity > 0.5 } : {}), side: o.double ? T.DoubleSide : T.FrontSide });
      m.name = o.name || color;
      mats.set(key, m);
    }
    return mats.get(key);
  };
  const add = (mesh, name) => { if (name) mesh.name = name; group.add(mesh); return mesh; };

  // ------------------------------------------------------------ grond
  const gc = groundCanvas(doc, box, month, opts.maxTexture || 4096);
  const tex = new T.CanvasTexture(gc);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData.mimeType = 'image/jpeg';
  const bw = box.maxX - box.minX, bh = box.maxY - box.minY;
  const groundGeo = new T.PlaneGeometry(bw, bh);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new T.Mesh(groundGeo, new T.MeshStandardMaterial({ map: tex, roughness: 1, name: 'tekening' }));
  ground.position.set((box.minX + box.maxX) / 2, 0.003, (box.minY + box.maxY) / 2);
  ground.userData.ground = true;
  add(ground, 'grond');

  // ------------------------------------------------------------ hulpvormen
  const toShape = (ring, holes = []) => {
    const s = new T.Shape(ring.map((p) => new T.Vector2(p[0], p[1])));
    for (const h of holes) s.holes.push(new T.Path(h.map((p) => new T.Vector2(p[0], p[1]))));
    return s;
  };
  /** Blok met plattegrond ring van y0 tot y0 + h. materials: [boven/onder, zijkanten]. */
  const prism = (ring, h, materials, y0 = 0, holes = []) => {
    if (!ring || ring.length < 3 || Math.abs(polygonArea(ring)) < 1e-4 || !(h > 0)) return null;
    const geo = new T.ExtrudeGeometry(toShape(ring, holes), { depth: h, bevelEnabled: false, curveSegments: 4 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, h + y0, 0);
    return new T.Mesh(geo, materials);
  };
  /** Balk van a naar b (plattegrond), dikte t, van y0 tot y1. */
  const beam = (a, b, t, y0, y1, m) => {
    const L = dist(a, b);
    if (L < 1e-3) return null;
    const mesh = new T.Mesh(new T.BoxGeometry(L, y1 - y0, t), m);
    mesh.position.set((a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2);
    mesh.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    return mesh;
  };
  const post = (p, s, h, m) => {
    const mesh = new T.Mesh(new T.BoxGeometry(s, h, s), m);
    mesh.position.set(p[0], h / 2, p[1]);
    return mesh;
  };

  // gedeelde, wat onregelmatige bol voor kronen en struiken
  const blobGeo = new T.IcosahedronGeometry(1, 3);
  {
    const pos = blobGeo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = 1 + 0.07 * Math.sin(v.x * 5.1 + v.y * 2.3) * Math.cos(v.z * 4.7 - v.y * 1.9) + 0.04 * Math.sin(v.x * 11 + v.z * 9);
      v.multiplyScalar(n);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    blobGeo.computeVertexNormals();
  }

  /** Kleur van blad/kroon in deze maand voor een plant uit de database (of een algemene boom). */
  const leafColor = (spec, base = '#5d8a46') => {
    if (!spec) return { color: base, bare: winter };
    const st = monthState(spec, month);
    if (st.kind === 'weg' || st.kind === 'silhouet') return { color: '#8c7b63', bare: true };
    if (st.kind === 'bloei') return { color: st.color || base, bloom: true, leaf: (FOLIAGE[spec.foliage] || FOLIAGE.groen).color };
    if (st.kind === 'herfst') return { color: AUTUMN[spec.autumn]?.color || base };
    return { color: st.color || base };
  };

  const tree = ({ x, y, rx, rz, rot = 0, h, crown = 0.62, spec, conifer, id }) => {
    const rnd = rng(hashId(id) + x * 7 + y * 13);
    const cr = Math.min(0.9, crown);
    const ch = h * cr;
    const trunkR = Math.max(0.05, Math.min(0.35, h * 0.018 + Math.min(rx, rz) * 0.02));
    const trunk = new T.Mesh(new T.CylinderGeometry(trunkR * 0.75, trunkR, h - ch * 0.6, 10), mat('#6b5440', { name: 'stam' }));
    trunk.position.set(x, (h - ch * 0.6) / 2, y);
    add(trunk, 'stam');
    const lc = conifer ? { color: '#3f6b3a' } : leafColor(spec);
    let crownMesh;
    if (conifer) {
      crownMesh = new T.Mesh(new T.ConeGeometry(1, 1, 14), mat(lc.color, { name: 'kroon' }));
      crownMesh.scale.set(rx, ch, rz);
      crownMesh.position.set(x, h - ch / 2, y);
    } else if (!lc.bare) {
      crownMesh = new T.Mesh(blobGeo, mat(lc.color, { name: 'kroon' }));
      crownMesh.scale.set(rx * (0.95 + rnd() * 0.1), ch / 2, rz * (0.95 + rnd() * 0.1));
      crownMesh.position.set(x, h - ch / 2, y);
      crownMesh.rotation.y = -rot + rnd() * 6;
    }
    if (crownMesh) add(crownMesh, 'kroon');
    if (lc.bare && !conifer) {
      // kaal in de winter: takken en twijgen in plaats van een kroon
      const tm = mat('#5e4a39', { name: 'kale takken' });
      const limb = (from, dir, len, r0) => {
        const to = from.clone().addScaledVector(dir, len);
        const m = new T.Mesh(new T.CylinderGeometry(r0 * 0.55, r0, len, 5), tm);
        m.position.copy(from).add(to).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
        add(m, 'tak');
        return to;
      };
      const base = new T.Vector3(x, h - ch * 0.75, y);
      const n = 6 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
        const out = 0.55 + rnd() * 0.35;
        const dir = new T.Vector3(Math.cos(a) * out * rx / Math.max(rx, rz), 1, Math.sin(a) * out * rz / Math.max(rx, rz)).normalize();
        const end = limb(base, dir, ch * (0.45 + rnd() * 0.15), trunkR * 0.45);
        for (let j = 0; j < 2; j++) {
          const b = a + (j ? 0.5 : -0.5);
          limb(end, new T.Vector3(Math.cos(b) * 0.6, 1, Math.sin(b) * 0.6).normalize(), ch * 0.25, trunkR * 0.2);
        }
      }
    }
    stats.trees++;
  };

  const bush = ({ x, y, rx, rz, rot = 0, h, color }) => {
    const m = new T.Mesh(blobGeo, mat(color, { name: 'struik' }));
    m.scale.set(rx, h / 2, rz);
    m.position.set(x, h / 2, y);
    m.rotation.y = -rot;
    add(m, 'struik');
    stats.bushes++;
  };

  // ------------------------------------------------------------ elementen
  const pc = plantContext(doc);
  const roles = rolesMap(doc);
  const houses = [];
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const item of layer.items) {
      const h = itemHeight(item);
      if (item.type === 'shape' && item.wall) {
        if (item.fence) fence(item);
        else wall(item);
        continue;
      }
      if (item.type === 'shape' && !isGroup(item) && h > 0 && item.points?.length >= 2) {
        const closed = item.kind === 'polygon' || item.kind === 'circle';
        if (closed) {
          const ring = shapePolygon(item);
          const house = item.source === '3dbag' || h >= 2.4;
          const top = house ? '#7d716a' : item.matColor || item.fill || '#b5ab9b';
          const side = house ? '#c2ab92' : item.matColor || item.fill || '#a59a89';
          const mesh = prism(ring, h, [mat(top, { name: house ? 'dak' : 'bovenkant' }), mat(side, { name: house ? 'gevel' : 'zijkant' })]);
          if (mesh) { add(mesh, item.name || (house ? 'gebouw' : 'blok')); stats.prisms++; if (house) houses.push(ring); }
        } else {
          const m = mat(item.color || '#a59a89', { name: 'muurtje' });
          for (let i = 0; i < item.points.length - 1; i++) {
            const b = beam(item.points[i], item.points[i + 1], Math.max(item.width || 0, 0.1), 0, h, m);
            if (b) add(b, 'muurtje');
          }
        }
        continue;
      }
      if (item.type === 'stencil') stencil(item, h);
      else if (item.type === 'plant') solitair(item);
    }
  }

  function wall(item) {
    const shape = wallShape(item, pc.walls, 0);
    const h = item.height > 0 ? item.height : WALL_H;
    const m = [mat('#bfb6a8', { name: 'muur boven' }), mat(item.fill || '#d5ccbd', { name: 'muur' })];
    if (item.kind === 'polygon' && shape.fill.length === 2) {
      const [a, b] = shape.fill;
      const outer = Math.abs(polygonArea(a)) >= Math.abs(polygonArea(b)) ? a : b, inner = outer === a ? b : a;
      const mesh = prism(outer, h, m, 0, [inner]);
      if (mesh) add(mesh, 'muur');
    } else {
      for (const ring of shape.fill) { const mesh = prism(ring, h, m); if (mesh) add(mesh, 'muur'); }
    }
    stats.walls++;
  }

  function fence(item) {
    const f = FENCES[item.fence] || FENCES.schutting;
    const H = item.height > 0 ? item.height : f.height || 1.8;
    const open = { gaas: 0.4, spijlen: 0.5, touw: 0, glas: 0.25, trellis: 0.65, piket: 0.7 }[f.style];
    const panel = mat(f.style === 'glas' ? '#c9dde3' : f.color, { name: f.name, opacity: open ?? 1, double: open != null });
    const pm = mat(f.postColor || f.color, { name: 'paal' });
    const pts = item.points, closed = item.kind === 'polygon';
    const n = closed ? pts.length : pts.length - 1;
    // openingen (poorten) in het hek
    const gaps = {};
    for (const op of [...(pc.openingsByWall[item.id] || []), ...pc.looseOpenings]) {
      for (let s = 0; s < n; s++) {
        const a = pts[s], b = pts[(s + 1) % pts.length];
        if (op.wallId === item.id ? (op.wallSeg ?? 0) !== s : distToSegment([op.x, op.y], a, b) > Math.max(0.12, item.width || 0)) continue;
        const L = dist(a, b) || 1;
        const s0 = ((op.x - a[0]) * (b[0] - a[0]) + (op.y - a[1]) * (b[1] - a[1])) / L;
        (gaps[s] ||= []).push([s0 - op.w / 2, s0 + op.w / 2]);
        break;
      }
    }
    const t = Math.max(f.t || 0.04, 0.03);
    for (let s = 0; s < n; s++) {
      const a = pts[s], b = pts[(s + 1) % pts.length], L = dist(a, b);
      if (L < 1e-3) continue;
      const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      const at = (d) => [a[0] + u[0] * d, a[1] + u[1] * d];
      // stukken tussen de openingen
      const cuts = (gaps[s] || []).sort((p, q) => p[0] - q[0]);
      let from = 0;
      const pieces = [];
      for (const [g0, g1] of cuts) { if (g0 > from) pieces.push([from, Math.min(g0, L)]); from = Math.max(from, g1); }
      if (from < L) pieces.push([from, L]);
      for (const [d0, d1] of pieces) {
        if (d1 - d0 < 0.02) continue;
        if (open !== 0) { const p = beam(at(d0), at(d1), t, f.style === 'gabion' ? 0 : 0.04, H, panel); if (p) add(p, 'scherm'); }
        else for (const y of [H * 0.45, H * 0.9]) { const r = beam(at(d0), at(d1), 0.02, y - 0.015, y + 0.015, panel); if (r) add(r, 'touw'); }
        if (f.post > 0) {
          const k = Math.max(1, Math.round((d1 - d0) / (f.every || 1.8)));
          for (let i = 0; i <= k; i++) add(post(at(d0 + ((d1 - d0) * i) / k), f.post, H + 0.05, pm), 'paal');
        }
      }
    }
    stats.fences++;
  }

  function stencil(item, h) {
    const def = STENCIL_MAP[item.symbol];
    if (!def || def.opening) return;
    if (FRAME.test(item.symbol)) return frame(item, def, h > 0 ? h : item.symbol.startsWith('berceau') ? 2.3 : 2.5);
    if (!(h > 0)) return;
    const sh = stencilShadow(item.symbol) || { type: 'prism' };
    const rx = item.w / 2, rz = item.h / 2, rot = item.rot || 0;
    const dbTree = plantForStencil(item.symbol);
    if (sh.type === 'tree') {
      const spec = dbTree ? roleFromPlant(dbTree) : item.symbol === 'naaldboom' ? null : { foliage: 'groen', winter: 'weg', bloom: item.symbol === 'fruitboom' ? [4] : [], color: '#f3e6ee', autumn: 'geel' };
      const conifer = item.symbol === 'naaldboom' || (dbTree && (dbTree.habit === 'zuil' && dbTree.ev));
      return tree({ x: item.x, y: item.y, rx, rz, rot, h, crown: sh.crown || 0.62, spec, conifer, id: item.id });
    }
    if (sh.type === 'bush') return bush({ x: item.x, y: item.y, rx, rz, rot, h, color: stencilGreen(item.symbol) });
    if (sh.type === 'canopy') {
      const pole = new T.Mesh(new T.CylinderGeometry(0.025, 0.03, h, 8), mat('#8d8a85', { name: 'stok' }));
      pole.position.set(item.x, h / 2, item.y);
      add(pole, 'parasol');
      const top = new T.Mesh(new T.ConeGeometry(1, 0.45, 16, 1, true), mat(def.color || '#ece3d0', { name: 'doek', double: true }));
      top.scale.set(rx, 1, rz);
      top.position.set(item.x, h - 0.1, item.y);
      return add(top, 'parasol');
    }
    // blok: haag, schuur, regenton, bak …
    const hedge = /^haag|bamboe/.test(item.symbol) || dbTree?.type === 'haag';
    const color = hedge ? stencilGreen(item.symbol) : item.symbol === 'kas' ? '#d6ebef' : def.color || '#9a8f80';
    const m = mat(color, { name: hedge ? 'haag' : def.name || item.symbol, opacity: item.symbol === 'kas' ? 0.4 : 1 });
    if (def.round) {
      const c = new T.Mesh(new T.CylinderGeometry(1, 1, h, 24), m);
      c.scale.set(rx, 1, rz);
      c.position.set(item.x, h / 2, item.y);
      c.rotation.y = -rot;
      add(c, def.name || item.symbol);
    } else {
      const mesh = prism(itemOutline(item), h, [m, m]);
      if (mesh) add(mesh, hedge ? 'haag' : def.name || item.symbol);
    }
    stats.prisms++;
  }

  /** Groen van een haag of struik uit de database (beuk bruin in de winter …), anders een standaardgroen. */
  function stencilGreen(symbol) {
    let p = null;
    for (const q of plantsWithStencil(symbol)) { p = q; break; }
    if (!p) return winter && symbol === 'haag_beuk' ? '#9a6b3c' : '#4f7d3c';
    const lc = leafColor(roleFromPlant(p), '#4f7d3c');
    return lc.bare ? (p.id.includes('beuk') ? '#9a6b3c' : '#8c7b63') : lc.bloom ? lc.leaf : lc.color;
  }

  function frame(item, def, h) {
    const w = item.w, d = item.h, rot = item.rot || 0;
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (u, v) => [item.x + u * c - v * s, item.y + u * s + v * c];
    const wood = mat(def.color || '#8a6a45', { name: def.name || 'pergola' });
    const ps = item.symbol.startsWith('berceau') ? 0.05 : 0.12;
    const nx = Math.max(1, Math.round(w / 3));
    const posts = [];
    for (let i = 0; i <= nx; i++) for (const v of [-d / 2 + ps, d / 2 - ps]) posts.push(P(-w / 2 + ps + ((w - ps * 2) * i) / nx, v));
    for (const p of posts) add(post(p, ps, h, wood), 'paal');
    // liggers in de lengte, dwarsbalken of een dak
    for (const v of [-d / 2 + ps, d / 2 - ps]) { const b = beam(P(-w / 2, v), P(w / 2, v), ps, h - 0.2, h, wood); if (b) add(b, 'ligger'); }
    if (/lamellendak|veranda/.test(item.symbol)) {
      const roof = prism(itemOutline(item), 0.08, [mat('#4a4f55', { name: 'dak' }), mat('#4a4f55', { name: 'dak' })], h);
      if (roof) add(roof, 'dak');
    } else {
      const green = item.symbol === 'berceau_groen' || item.grow === 'vol';
      const step = item.symbol === 'pergolalatten' ? 0.3 : 0.55;
      for (let u = -w / 2 + 0.1; u <= w / 2 - 0.05; u += step) {
        const b = beam(P(u, -d / 2 - 0.15), P(u, d / 2 + 0.15), 0.06, h, h + 0.12, wood);
        if (b) add(b, 'dwarsbalk');
      }
      if (green || item.grow === 'deels') {
        const lm = mat(item.symbol === 'berceau_groen' ? '#4f7d3c' : '#5e8a45', { name: 'klimplant', opacity: green ? 1 : 0.85 });
        const top = prism(itemOutline(item), 0.25, [lm, lm], h + 0.08);
        if (top) add(top, 'klimplant');
      }
    }
    stats.frames++;
  }

  function solitair(item) {
    const r = roles[item.role];
    if (!r) return;
    const h = roleHeight(r);
    if (r.kind === 'boom') return tree({ x: item.x, y: item.y, rx: item.d / 2, rz: item.d / 2, h, spec: r, id: item.id });
    const lc = leafColor(r, (FOLIAGE[r.foliage] || FOLIAGE.groen).color);
    if (lc.bare) return;
    bush({ x: item.x, y: item.y, rx: item.d / 2, rz: item.d / 2, h, color: lc.bloom ? lc.leaf : lc.color });
    if (lc.bloom) flowersOn(item.x, item.y, item.d, h, lc.color, hashId(item.id));
  }

  // ------------------------------------------------------------ planten in de vakken (instanced)
  const inst = { blob: [], tuft: [], mat: [], flower: [] };
  const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(), V = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const put = (kind, x, y0, z, sx, sy, sz, color, turn = 0) => {
    Q.setFromAxisAngle(up, turn);
    M.compose(V.set(x, y0, z), Q, S.set(sx, sy, sz));
    inst[kind].push({ m: M.clone(), c: color });
  };
  function flowersOn(x, z, d, h, color, seed) {
    const rnd = rng(seed);
    const n = Math.max(3, Math.min(16, Math.round(d * d * 30)));
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * d * 0.36;
      const fr = Math.max(0.018, d * 0.055);
      put('flower', x + Math.cos(a) * rr, h * (0.78 + rnd() * 0.22), z + Math.sin(a) * rr, fr, fr, fr, color);
    }
  }
  function plantAt(r, x, z, d, seed) {
    const st = monthState(r, month);
    if (st.kind === 'weg') return;
    const h = Math.max(0.05, roleHeight(r) * (0.88 + ((seed % 97) / 97) * 0.24));
    const shape = plantShape(r);
    const leaf = st.kind === 'bloei' ? (FOLIAGE[r.foliage] || FOLIAGE.groen).color : st.color;
    const turn = (seed % 628) / 100;
    if (r.kind === 'boom') return tree({ x, y: z, rx: d / 2, rz: d / 2, h, spec: r, id: seed });
    if (shape === 'gras' || shape === 'zwaard') put('tuft', x, 0, z, d * 0.5, h, d * 0.5, leaf, turn);
    else if (shape === 'rechtop' || shape === 'ijl') put('blob', x, h * 0.5, z, d * 0.44, h * 0.5, d * 0.44, leaf, turn);
    else if (shape === 'mat') put('mat', x, 0, z, d * 0.55, Math.min(h, 0.2), d * 0.55, leaf, turn);
    else put('blob', x, h * 0.45, z, d * 0.5, h * 0.55, d * 0.5, leaf, turn);
    if (st.kind === 'bloei' && st.color) flowersOn(x, z, d, h, st.color, seed);
    stats.plants++;
  }
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const it of layer.items) {
      if (isBed(it)) {
        const poly = shapePolygon(it);
        const groups = (pc.groupsByBed[it.id] || []).map((g) => shapePolygon(g));
        const mix = it.planting?.mix || [];
        if (mix.length) placeAll(layoutPoints(poly, mix, roles, it.id, groups));
        else sketch(it, poly, groups);
      } else if (isGroup(it)) {
        const bed = pc.bedsById[it.bedId];
        const later = pc.groupsByBed[it.bedId] || [];
        const idx = later.indexOf(it);
        const exclude = idx >= 0 ? later.slice(idx + 1).map((q) => shapePolygon(q)) : [];
        let pts = layoutPoints(shapePolygon(it), it.planting?.mix, roles, it.id, exclude);
        if (bed) { const bp = shapePolygon(bed); pts = pts.filter((p) => pointInPolygon([p.x, p.y], bp)); }
        placeAll(pts);
      }
    }
  }
  function placeAll(pts) {
    for (const p of pts) {
      const seed = Math.abs(Math.round(p.x * 7919 + p.y * 104729));
      const f = (seed % 1000) / 1000, f2 = ((seed >> 3) % 1000) / 1000;
      const d = roleDiameter(p.role) * (0.92 + f * 0.26);
      plantAt(p.role, p.x + (f - 0.5) * d * 0.22, p.y + (f2 - 0.5) * d * 0.22, d, seed);
    }
  }
  /** Vak met alleen een type (schets): groene massa's op de hoogte van het type. */
  function sketch(it, poly, groups) {
    const bt = BED_TYPES[it.btype];
    if (!bt || !bt.spacing) return;
    const rnd = rng(hashId(it.id));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const sp = bt.spacing;
    if (((maxX - minX) / sp) * ((maxY - minY) / sp) > 8000) return;
    const tints = [bt.color, '#6f9f52', '#4f7d3c'];
    let row = 0;
    for (let y = minY + sp * 0.4; y <= maxY; y += sp * 0.87, row++) {
      for (let x = minX + sp * 0.4 + (row % 2) * sp * 0.5; x <= maxX; x += sp) {
        const px = x + (rnd() - 0.5) * sp * 0.35, py = y + (rnd() - 0.5) * sp * 0.35;
        if (!pointInPolygon([px, py], poly) || groups.some((q) => pointInPolygon([px, py], q))) continue;
        const d = bt.r * 2.1 * (0.85 + rnd() * 0.35), h = bt.h * (0.8 + rnd() * 0.35), c = tints[Math.floor(rnd() * 3)];
        if (it.btype === 'bodem') put('mat', px, 0, py, d * 0.55, h, d * 0.55, c);
        else put('blob', px, h * 0.45, py, d * 0.5, h * 0.55, d * 0.5, c, rnd() * 6);
        stats.plants++;
      }
    }
  }
  const geos = {
    blob: new T.IcosahedronGeometry(1, 1),
    tuft: tuftGeometry(T),
    mat: (() => { const g = new T.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); return g; })(),
    flower: new T.IcosahedronGeometry(1, 0),
  };
  for (const [kind, list] of Object.entries(inst)) {
    if (!list.length) { geos[kind].dispose(); continue; }
    const im = new T.InstancedMesh(geos[kind], new T.MeshStandardMaterial({ color: '#ffffff', roughness: kind === 'flower' ? 0.7 : 0.95, name: kind === 'flower' ? 'bloemen' : kind === 'tuft' ? 'grassen' : 'planten', side: kind === 'tuft' ? T.DoubleSide : T.FrontSide }), list.length);
    const col = new T.Color();
    list.forEach((e, i) => { im.setMatrixAt(i, e.m); im.setColorAt(i, col.set(e.c)); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    add(im, kind === 'flower' ? 'bloemen' : `planten (${kind})`);
  }

  return { group, box, start: startPoint(box, houses), stats, month };
}

/** Pol siergras: smalle, overhangende sprieten vanuit één punt (hoogte 0..1, straal 1). */
function tuftGeometry(T) {
  const P = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.4;
    const lean = 0.35 + (i % 4) * 0.2, top = 0.75 + (i % 5) * 0.06, w = 0.07;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa * w, pz = ca * w;
    // spriet in twee delen: recht omhoog en dan naar buiten buigend
    const mid = [ca * lean * 0.45, top * 0.7, sa * lean * 0.45], tip = [ca * lean, top, sa * lean];
    P.push(px, 0, pz, -px, 0, -pz, mid[0] + px * 0.6, mid[1], mid[2] + pz * 0.6);
    P.push(-px, 0, -pz, mid[0] - px * 0.6, mid[1], mid[2] - pz * 0.6, mid[0] + px * 0.6, mid[1], mid[2] + pz * 0.6);
    P.push(mid[0] + px * 0.6, mid[1], mid[2] + pz * 0.6, mid[0] - px * 0.6, mid[1], mid[2] - pz * 0.6, tip[0], tip[1], tip[2]);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}

const stencilPlants = new Map();
function plantsWithStencil(symbol) {
  if (!stencilPlants.has(symbol)) stencilPlants.set(symbol, [...PLANTS.values()].filter((p) => p.stencil === symbol));
  return stencilPlants.get(symbol);
}

/** Beginpunt: bij het huis (als dat er is), kijkend de tuin in; anders aan de onderkant van de tuin. */
export function startPoint(box, houses) {
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  let best = null;
  for (const ring of houses) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((cx - a[0]) * (b[0] - a[0]) + (cy - a[1]) * (b[1] - a[1])) / L2));
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const d = dist(p, [cx, cy]);
      if (!best || d < best.d) best = { p, d };
    }
  }
  let x, y;
  if (best && best.d > 2.5) {
    const ux = (cx - best.p[0]) / best.d, uy = (cy - best.p[1]) / best.d;
    x = best.p[0] + ux * 1.5; y = best.p[1] + uy * 1.5;
  } else {
    x = cx; y = box.maxY - 1.5;
  }
  const yaw = Math.atan2(-(cx - x), -(cy - y));
  return { x, y, yaw };
}
