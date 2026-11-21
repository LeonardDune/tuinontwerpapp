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
import { plantForStencil, stencilPlantSpec } from './planting.js';
import { plantShape } from './plantdraw.js';
import { stencilModel, openingModel, hasModel } from './models3d.js';
import { Geo, CELL, buildPlant, buildShrub, buildTree, buildLawnTuft, drawAtlas, drawHedgeTile } from './flora3d.js';
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
    return !!def?.opening || hasModel(item.symbol) || /^hek_/.test(item.symbol) || FRAME.test(item.symbol) || itemHeight(item) > 0;
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
  const stats = { prisms: 0, walls: 0, fences: 0, trees: 0, bushes: 0, plants: 0, frames: 0, models: 0 };

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

  // bladeren, bloemen en takken: één doorzichtige textuur voor alle planten
  const leafMat = foliageMaterial(T);
  const hedgeMat = (color) => {
    const key = 'haag' + color;
    if (!mats.has(key)) {
      const m = new T.MeshStandardMaterial({ map: hedgeTexture(T), color, roughness: 0.95, name: 'haag' });
      mats.set(key, m);
    }
    return mats.get(key);
  };

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
    const lc = conifer ? { color: '#3f6b3a' } : leafColor(spec);
    const bare = !conifer && lc.bare;
    const G = buildTree(T, { h, rx, rz, crown, conifer, bare, leaf: lc.bloom ? lc.leaf : lc.color, flower: lc.bloom ? lc.color : null }, hashId(id) + Math.round(x * 7 + y * 13));
    const m = new T.Mesh(G.geometry(), leafMat);
    m.position.set(x, 0, y);
    m.rotation.y = -rot;
    add(m, bare ? 'boom (kaal)' : 'boom');
    stats.trees++;
  };

  /** Struik of heester als los model (stencils, solitairen). */
  const shrub = ({ x, y, rx, rz, rot = 0, h, spec, seed }) => {
    const R = Math.max(rx, rz);
    const G = spec.shape && spec.shape !== 'heester' ? buildPlant(T, { ...spec, h, d: R * 2 }, seed) : buildShrub(T, { ...spec, h, d: R * 2 }, seed);
    const m = new T.Mesh(G.geometry(), leafMat);
    m.position.set(x, 0, y);
    m.scale.set(rx / R, 1, rz / R);
    m.rotation.y = -rot;
    add(m, 'struik');
    stats.bushes++;
  };

  /** Haag: blokvorm met bladtextuur, en losse bladtrossen aan de buitenkant voor een levendige rand. */
  const hedge = (ring, h, color, name, seed, fringe = 1) => {
    const mesh = prism(ring, h * 0.94, [hedgeMat(color), hedgeMat(color)]);
    if (!mesh) return;
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.array.length; i++) uv.array[i] /= 0.55;
    uv.needsUpdate = true;
    add(mesh, name);
    const G = new Geo(T, h);
    G.aoMin = 0.6;
    const r = rng(seed);
    const cen = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
    const leafC = () => G.col(color, (r() - 0.5) * 0.14);
    const sz = 0.2;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], L = dist(a, b);
      if (L < 0.05) continue;
      let nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if ((mx - cen[0]) * nx + (mz - cen[1]) * nz < 0) { nx = -nx; nz = -nz; }
      const n = Math.round(L * h * 22 * fringe);
      for (let k = 0; k < n; k++) {
        const t = r(), y = 0.1 + r() * (h - 0.15);
        const p = [a[0] + (b[0] - a[0]) * t + nx * 0.03, y, a[1] + (b[1] - a[1]) * t + nz * 0.03];
        const up = [nx * 0.9 + (r() - 0.5) * 0.6, 0.6 + r() * 0.6, nz * 0.9 + (r() - 0.5) * 0.6];
        G.card([p[0] - up[0] * sz * 0.3, p[1] - up[1] * sz * 0.3, p[2] - up[2] * sz * 0.3], up, [-nz + (r() - 0.5) * 0.4, (r() - 0.5) * 0.4, nx], sz, sz, CELL.cluster, leafC(), { flatNormal: true, n: [nx * 0.6, 0.8, nz * 0.6] });
      }
    }
    // bovenkant
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of ring) { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); }
    const nTop = Math.min(3000, Math.round(Math.abs(polygonArea(ring)) * 30 * fringe));
    for (let k = 0; k < nTop; k++) {
      const px = minX + r() * (maxX - minX), pz = minY + r() * (maxY - minY);
      if (!pointInPolygon([px, pz], ring)) continue;
      const up = [(r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8];
      G.card([px, h * 0.93, pz], up, [1, 0, (r() - 0.5)], sz, sz, CELL.cluster, leafC(), { flatNormal: true, n: [0, 1, 0] });
    }
    const fr = new T.Mesh(G.geometry(), leafMat);
    add(fr, name + ' (blad)');
  };

  // ------------------------------------------------------------ elementen
  const pc = plantContext(doc);
  const roles = rolesMap(doc);
  const houses = [];
  const wallsById = {};
  for (const layer of doc.layers) for (const it of layer.items) if (it.type === 'shape' && it.wall) wallsById[it.id] = it;

  /** Blad, bloei of kaal in deze maand voor een eenvoudige plantbeschrijving. */
  const season = (role) => {
    const st = monthState({ autumn: 'geen', ...role }, month);
    const foliage = (FOLIAGE[role.foliage] || FOLIAGE.groen).color;
    if (st.kind === 'weg') return { leaf: foliage, bare: true };
    if (st.kind === 'silhouet') return { leaf: '#9c8763', straw: true };
    return { leaf: st.kind === 'bloei' ? foliage : st.color || foliage, flower: st.kind === 'bloei' ? role.color : null };
  };
  const mctx = {
    month, leafMat, hedgeMat, season,
    plant(spec, seed) {
      if (spec.bare && spec.shape !== 'heester') return new T.Group();
      const G = spec.shape === 'heester' ? buildShrub(T, spec, seed) : buildPlant(T, spec, seed);
      const m = new T.Mesh(G.geometry(), leafMat);
      m.name = 'plant';
      return m;
    },
    tree(spec, seed) {
      const m = new T.Mesh(buildTree(T, { leaf: '#5d8a46', ...spec }, seed).geometry(), leafMat);
      m.name = 'boompje';
      return m;
    },
    /** Klimplant: bladtrossen (en bloemen) rond de gegeven punten. */
    climber(pts, spread, role, seed, size = 0.3) {
      const st = season(role);
      if (st.bare || st.straw || !pts.length) return new T.Group();
      const G = new Geo(T, 3);
      G.aoMin = 0.75;
      G.center = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);
      const r = rng(seed);
      for (const p of pts) for (let k = 0; k < 3; k++) {
        const up = [r() - 0.5, 0.8, r() - 0.5], right = [r() - 0.5 + 0.8, r() - 0.5, r() - 0.5];
        const q = [p[0] + (r() - 0.5) * spread - up[0] * size / 2, p[1] + (r() - 0.5) * spread * 0.8 - up[1] * size / 2, p[2] + (r() - 0.5) * spread - up[2] * size / 2];
        const fl = st.flower && r() < 0.35;
        G.card(q, up, right, size, size, fl ? CELL.florets : CELL.cluster, G.col(fl ? st.flower : st.leaf, (r() - 0.5) * 0.14));
      }
      const m = new T.Mesh(G.geometry(), leafMat);
      m.name = 'klimplant';
      return m;
    },
    /** Blok vol blad (leiboom, dakboom). */
    leafBlock(x0, x1, y0, y1, z0, z1, role, seed) {
      const st = season(role);
      if (st.bare || st.straw) return new T.Group();
      const G = new Geo(T, y1);
      G.center = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
      G.aoMin = 0.8;
      const r = rng(seed), size = 0.4;
      const n = Math.min(1600, Math.round((x1 - x0) * (y1 - y0) * (z1 - z0) * 110) + 60);
      for (let i = 0; i < n; i++) {
        const p = [x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), z0 + r() * (z1 - z0)];
        const up = [r() - 0.5, 0.7, r() - 0.5];
        G.card([p[0] - up[0] * size / 2, p[1] - up[1] * size / 2, p[2] - up[2] * size / 2], up, [r() - 0.5 + 0.6, r() - 0.5, r() - 0.5], size, size, CELL.cluster, G.col(st.leaf, (r() - 0.5) * 0.14));
      }
      const m = new T.Mesh(G.geometry(), leafMat);
      m.name = 'leiboom';
      return m;
    },
  };

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

  function placeModel(g, item, name) {
    if (!g) return;
    g.position.set(item.x, 0, item.y);
    g.rotation.y = -(item.rot || 0);
    add(g, name);
    stats.models++;
  }

  function stencil(item, h) {
    const def = STENCIL_MAP[item.symbol];
    if (!def) return;
    if (def.opening) {
      // deur of raam in een muur; poort of hekje in een hek (of los)
      const wall = item.wallId && wallsById[item.wallId];
      if (wall && !wall.fence) return placeModel(openingModel(T, item, wall.width), item, def.name);
      if (hasModel(item.symbol)) placeModel(stencilModel(T, item, mctx), item, def.name);
      return;
    }
    if (/^hek_/.test(item.symbol) && FENCES[item.symbol.slice(4)]) {
      const c = Math.cos(item.rot || 0), sn = Math.sin(item.rot || 0), hw = item.w / 2;
      return fence({ id: item.id, kind: 'line', fence: item.symbol.slice(4), height: item.height, points: [[item.x - c * hw, item.y - sn * hw], [item.x + c * hw, item.y + sn * hw]] });
    }
    if (hasModel(item.symbol)) return placeModel(stencilModel(T, item, mctx), item, def.name);
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
    if (sh.type === 'bush') return shrub({ x: item.x, y: item.y, rx, rz, rot, h, spec: stencilSpec(item.symbol, h), seed: hashId(item.id) });
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
    const isHedge = /^haag|bamboe/.test(item.symbol) || dbTree?.type === 'haag';
    if (isHedge) {
      const color = stencilGreen(item.symbol);
      const c = Math.cos(rot), sn = Math.sin(rot);
      const P = (u, v) => [item.x + u * c - v * sn, item.y + u * sn + v * c];
      const r = rng(hashId(item.id));
      if (/^haag_(vrij|bloei|inheems)$|^bamboe$/.test(item.symbol)) {
        // losse haag: een rij struiken die in elkaar groeien
        const n = Math.max(2, Math.round(item.w / (rz * 1.4)));
        const spec = stencilSpec(item.symbol, h);
        for (let i = 0; i < n; i++) {
          const [x, y] = P(-item.w / 2 + (item.w / n) * (i + 0.5), (r() - 0.5) * rz * 0.3);
          const R = Math.max(rz * 1.15, item.w / n * 0.75);
          if (item.symbol === 'bamboe') shrub({ x, y, rx: R, rz: rz, rot, h: h * (0.85 + r() * 0.2), spec: { shape: 'gras', form: 'blad', leaf: '#6f8f3c', blades: 60 }, seed: hashId(item.id) + i });
          else shrub({ x, y, rx: R, rz: rz * 1.1, rot, h: h * (0.85 + r() * 0.25), spec: { ...spec, shape: 'heester', flower: item.symbol === 'haag_bloei' && !spec.bare ? spec.flower || (month >= 5 && month <= 7 ? '#f0f0f0' : null) : spec.flower }, seed: hashId(item.id) + i });
        }
      } else if (item.symbol === 'haag_wolk') {
        // wolkenhaag: in bollen geschoren
        let u = -item.w / 2;
        while (u < item.w / 2 - 0.2) {
          const R = rz * (0.8 + r() * 0.5);
          const [x, y] = P(u + R, (r() - 0.5) * rz * 0.4);
          const ball = new T.Mesh(new T.SphereGeometry(1, 20, 14), hedgeMat(color));
          ball.scale.set(R, Math.min(h, R * 1.6) / 2 * (0.9 + r() * 0.3), R);
          ball.position.set(x, ball.scale.y * 0.95, y);
          add(ball, 'wolkenhaag');
          u += R * 1.4;
        }
      } else if (item.symbol === 'haag_golf') {
        // golvende bovenkant: plakken met wisselende hoogte
        const n = Math.max(6, Math.round(item.w / 0.25));
        for (let i = 0; i < n; i++) {
          const u0 = -item.w / 2 + (item.w / n) * i, u1 = u0 + item.w / n;
          const hh = h * (0.72 + 0.28 * (0.5 + 0.5 * Math.sin(((u0 + u1) / 2 / item.w) * Math.PI * 4)));
          hedge([P(u0, -rz), P(u1, -rz), P(u1, rz), P(u0, rz)], hh, color, 'golvende haag', hashId(item.id) + i, 0.6);
        }
      } else hedge(itemOutline(item), h, color, 'haag', hashId(item.id));
      stats.prisms++;
      return;
    }
    const color = item.symbol === 'kas' ? '#d6ebef' : def.color || '#9a8f80';
    const m = mat(color, { name: def.name || item.symbol, opacity: item.symbol === 'kas' ? 0.4 : 1 });
    if (def.round) {
      const c = new T.Mesh(new T.CylinderGeometry(1, 1, h, 24), m);
      c.scale.set(rx, 1, rz);
      c.position.set(item.x, h / 2, item.y);
      c.rotation.y = -rot;
      add(c, def.name || item.symbol);
    } else {
      const mesh = prism(itemOutline(item), h, [m, m]);
      if (mesh) add(mesh, def.name || item.symbol);
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
    if (item.symbol === 'lamellendak') {
      // aluminium lamellen, half open
      const alu = mat('#c9cccf', { name: 'lamellen', metalness: 0.4, roughness: 0.4 });
      for (let u = -w / 2 + 0.1; u < w / 2; u += 0.2) {
        const b = beam(P(u, -d / 2 + ps), P(u, d / 2 - ps), 0.16, h - 0.1, h - 0.08, alu);
        if (b) { b.rotation.x = 0.6; add(b, 'lamel'); }
      }
      for (const u of [-w / 2 + ps, w / 2 - ps]) { const b = beam(P(u, -d / 2), P(u, d / 2), ps, h - 0.2, h, wood); if (b) add(b, 'ligger'); }
    } else if (/veranda/.test(item.symbol)) {
      const roof = prism(itemOutline(item), 0.08, [mat('#5a5f65', { name: 'dak' }), mat('#5a5f65', { name: 'dak' })], h);
      if (roof) add(roof, 'dak');
      if (item.symbol === 'verandaterras') { const deck = prism(itemOutline(item), 0.12, [mat('#a07850', { name: 'vlonder' }), mat('#8a6643', { name: 'vlonder' })], 0); if (deck) add(deck, 'vlonder'); }
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
    const spec = specFor(r);
    if (!spec) return;
    shrub({ x: item.x, y: item.y, rx: item.d / 2, rz: item.d / 2, h, spec, seed: hashId(item.id) });
  }

  /** Model-gegevens van een stencil-struik uit de plantendatabase (bloei in deze maand), anders groen blad. */
  function stencilSpec(symbol, h) {
    const sp = stencilPlantSpec(symbol);
    if (sp && !plantsWithStencil(symbol)[0]) return specFor({ id: symbol, d: 0.6, ...sp, kind: sp.kind || (symbol === 'varen' ? 'varen' : symbol === 'vp_zwaard' ? 'zwaard' : symbol === 'bolgewas' ? 'bol' : undefined) }) || { shape: 'kussen', leaf: '#8c7b63', bare: true };
    const p = plantsWithStencil(symbol)[0];
    if (!p) return { shape: /gras/.test(symbol) ? 'gras' : /vaste|vp_/.test(symbol) ? 'kussen' : 'heester', leaf: '#4f7d3c', form: 'blad' };
    return specFor(roleFromPlant(p)) || { shape: 'heester', leaf: '#8c7b63', bare: true };
  }


  // ------------------------------------------------------------ planten in de vakken (instanced)
  /** Model-gegevens van een bouwsteen in deze maand (null = bovengronds niets te zien). */
  function specFor(r) {
    const st = monthState(r, month);
    const woody = r.kind === 'heester' || r.kind === 'haag' || r.kind === 'klimmer';
    const foliage = (FOLIAGE[r.foliage] || FOLIAGE.groen).color;
    if ((st.kind === 'weg' || st.kind === 'silhouet') && woody) return { shape: 'heester', form: r.form, leaf: '#8c7b63', bare: true, key: `${r.id}|kaal` };
    if (st.kind === 'weg') return null;
    const straw = st.kind === 'silhouet';
    return {
      shape: plantShape(r), form: r.form, h: roleHeight(r), d: roleDiameter(r), straw,
      leaf: st.kind === 'bloei' ? foliage : straw ? '#9c8763' : st.color || foliage,
      flower: st.kind === 'bloei' ? r.color : null,
      key: `${r.id}|${st.kind}|${st.color}`,
    };
  }
  let lawnLeft = 12000;
  const lawnSpecs = ['#6e9a45', '#5d8a3b', '#7fa653'].map((c, i) => ({ lawn: true, leaf: winter ? '#7d8f55' : c, key: `gazon|${i}` }));
  const placed = new Map(); // soort → { spec, list: [{ x, z, s, sy, rot, seed }] }
  const place = (spec, x, z, s, seed) => {
    if (!placed.has(spec.key)) placed.set(spec.key, { spec, list: [] });
    placed.get(spec.key).list.push({ x, z, s, sy: s * (0.9 + ((seed >> 5) % 100) / 500), rot: (seed % 628) / 100, seed });
    stats.plants++;
  };
  function plantAt(r, x, z, d, seed) {
    if (r.kind === 'boom') return tree({ x, y: z, rx: d / 2, rz: d / 2, h: roleHeight(r), spec: r, id: seed });
    const spec = specFor(r);
    if (!spec) return;
    place(spec, x, z, d / roleDiameter(r), seed);
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
      } else if (it.type === 'shape' && it.hatch === 'gras' && (it.kind === 'polygon' || it.kind === 'circle') && !in3d(it)) lawn(shapePolygon(it), hashId(it.id));
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
    const shape = { bodem: 'mat', heesters: 'heester' }[it.btype] || 'kussen';
    const specs = tints.map((c, i) => ({ shape, form: 'blad', h: bt.h, d: bt.r * 2.1, leaf: c, key: `schets|${it.btype}|${i}` }));
    let row = 0;
    for (let y = minY + sp * 0.4; y <= maxY; y += sp * 0.87, row++) {
      for (let x = minX + sp * 0.4 + (row % 2) * sp * 0.5; x <= maxX; x += sp) {
        const px = x + (rnd() - 0.5) * sp * 0.35, py = y + (rnd() - 0.5) * sp * 0.35;
        if (!pointInPolygon([px, py], poly) || groups.some((q) => pointInPolygon([px, py], q))) continue;
        place(specs[Math.floor(rnd() * 3)], px, py, 0.85 + rnd() * 0.35, Math.floor(rnd() * 1e6));
      }
    }
  }
  /** Gazon: losse plukjes gras over het grasveld (tot een maximum, voor de snelheid). */
  function lawn(poly, seed) {
    const rnd = rng(seed);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const n = Math.min(lawnLeft, Math.round(Math.abs(polygonArea(poly)) * 40));
    for (let i = 0; i < n; i++) {
      const x = minX + rnd() * (maxX - minX), y = minY + rnd() * (maxY - minY);
      if (!pointInPolygon([x, y], poly)) continue;
      const spec = lawnSpecs[Math.floor(rnd() * 3)];
      if (!placed.has(spec.key)) placed.set(spec.key, { spec, list: [] });
      const s = 0.8 + rnd() * 0.6;
      placed.get(spec.key).list.push({ x, z: y, s, sy: s * (0.8 + rnd() * 0.5), rot: rnd() * 6.28, seed: i });
      lawnLeft--;
    }
  }
  // per soort een paar varianten, elk vaak herhaald
  const M = new T.Matrix4(), Q = new T.Quaternion(), SV = new T.Vector3(), V = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
  for (const { spec, list } of placed.values()) {
    const nv = spec.lawn ? 2 : Math.min(3, Math.max(1, Math.ceil(list.length / 4)));
    for (let v = 0; v < nv; v++) {
      const sub = list.filter((_, i) => i % nv === v);
      if (!sub.length) continue;
      const G = spec.lawn ? buildLawnTuft(T, v + 1, spec.leaf) : spec.shape === 'heester' ? buildShrub(T, spec, hashId(spec.key) + v) : buildPlant(T, spec, hashId(spec.key) + v);
      const im = new T.InstancedMesh(G.geometry(), leafMat, sub.length);
      sub.forEach((e, i) => {
        Q.setFromAxisAngle(Y, e.rot);
        M.compose(V.set(e.x, 0, e.z), Q, SV.set(e.s, e.sy, e.s));
        im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      add(im, spec.lawn ? 'gazon' : `planten ${spec.key.split('|')[0]}`);
    }
  }

  return { group, box, start: startPoint(box, houses), stats, month };
}

let atlasCanvas = null, hedgeCanvas = null;
/** Gedeeld materiaal voor alle bladeren, sprieten, bloemen en takken. */
function foliageMaterial(T) {
  atlasCanvas ||= drawAtlas();
  const tex = new T.CanvasTexture(atlasCanvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.mimeType = 'image/png';
  const leaf = new T.MeshStandardMaterial({ map: tex, alphaTest: 0.5, vertexColors: true, roughness: 0.82, name: 'planten', alphaToCoverage: true });
  return leaf;
}
function hedgeTexture(T) {
  hedgeCanvas ||= drawHedgeTile();
  const tex = new T.CanvasTexture(hedgeCanvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.anisotropy = 4;
  tex.userData.mimeType = 'image/jpeg';
  return tex;
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
