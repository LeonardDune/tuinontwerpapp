// Schaduwen en zonuren. Alles in wereldcoördinaten (meters).
//
// Elk element met een hoogte werpt schaduw:
//  - prism: een blok op de grond (schuur, huis, haag, muur) met een plattegrond
//  - tree:  een kroon (ellipsoïde) op een stam
//  - bush:  een ellipsoïde vanaf de grond (heester, gras)
//  - canopy: een plat dak op hoogte (parasol)

import { STENCIL_MAP } from './stencils.js';
import { itemOutline } from './items.js';
import { dist, rotate } from './geom.js';
import { sunPosition, localDate, sunTimes } from './sun.js';

/** Standaard schaduwgedrag en hoogte (m) per stencil. Hoogte 0 = geen schaduw. */
export const STENCIL_SHADOW = {
  loofboom: { type: 'tree', h: 8 },
  solitair: { type: 'tree', h: 12 },
  naaldboom: { type: 'tree', h: 10, crown: 0.9 }, // kroon beslaat 90% van de hoogte
  fruitboom: { type: 'tree', h: 4 },
  meerstammig: { type: 'tree', h: 6 },
  bestaandeboom: { type: 'tree', h: 10 },
  heester: { type: 'bush', h: 1.5 },
  bloeiend: { type: 'bush', h: 1.5 },
  haag: { type: 'prism', h: 1.8 },
  siergras: { type: 'bush', h: 1.2 },
  vasteplant: { type: 'bush', h: 0.6 },
  moestuinbak: { type: 'prism', h: 0.4 },
  parasol: { type: 'canopy', h: 2.4 },
  schuur: { type: 'prism', h: 2.5 },
  overkapping: { type: 'prism', h: 2.6 },
  kas: { type: 'prism', h: 2.4 },
  regenton: { type: 'prism', h: 1 },
  auto: { type: 'prism', h: 1.5 },
};

export function defaultHeight(item) {
  if (item.type === 'stencil') return STENCIL_SHADOW[item.symbol]?.h ?? 0;
  return 0;
}

export function itemHeight(item) {
  return item.height ?? defaultHeight(item);
}

/** Kan dit item een hoogte krijgen? */
export function canHaveHeight(item) {
  return item.type === 'stencil' || item.type === 'shape';
}

/** Verzamel alle schaduwwerpers uit zichtbare lagen. */
export function collectCasters(doc) {
  const out = [];
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const item of layer.items) {
      const h = itemHeight(item);
      if (!(h > 0)) continue;
      if (item.type === 'stencil') {
        const def = STENCIL_MAP[item.symbol];
        const sh = STENCIL_SHADOW[item.symbol] || { type: 'prism' };
        if (sh.type === 'prism' || !def?.round) {
          out.push({ type: 'prism', poly: itemOutline(item), h });
        } else {
          out.push({ type: sh.type, c: [item.x, item.y], rx: item.w / 2, ry: item.h / 2, rot: item.rot || 0, h, crown: sh.crown });
        }
      } else if (item.type === 'shape') {
        if (item.kind === 'circle') {
          const c = item.points[0], r = dist(item.points[0], item.points[1]);
          out.push({ type: 'prism', poly: circlePoly(c, r, r, 0, 28), h });
        } else if (item.kind === 'polygon') {
          out.push({ type: 'prism', poly: item.points, h });
        } else {
          out.push({ type: 'wall', line: item.points, h });
        }
      }
    }
  }
  return out;
}

function circlePoly(c, rx, ry, rot, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = rotate([Math.cos(a) * rx, Math.sin(a) * ry], rot);
    pts.push([c[0] + p[0], c[1] + p[1]]);
  }
  return pts;
}

/**
 * Horizontale verschuiving van de schaduw per meter hoogte, in wereldcoördinaten.
 * northRot: draaiing van het noorden t.o.v. "boven" (radialen, met de klok mee).
 */
export function shadowOffset(sun, northRot = 0) {
  if (sun.altitude <= 0.5) return null;
  const az = (sun.azimuth * Math.PI) / 180;
  const north = rotate([0, -1], northRot);
  const east = rotate([1, 0], northRot);
  const toSun = [north[0] * Math.cos(az) + east[0] * Math.sin(az), north[1] * Math.cos(az) + east[1] * Math.sin(az)];
  const k = 1 / Math.tan((sun.altitude * Math.PI) / 180);
  return [-toSun[0] * k, -toSun[1] * k];
}

/** Schaduwvlakken (polygonen) voor één werper. */
export function shadowPieces(c, d) {
  const sh = (p, z) => [p[0] + d[0] * z, p[1] + d[1] * z];
  const pieces = [];
  if (c.type === 'prism') {
    const top = c.poly.map((p) => sh(p, c.h));
    pieces.push(c.poly, top);
    for (let i = 0; i < c.poly.length; i++) {
      const a = c.poly[i], b = c.poly[(i + 1) % c.poly.length];
      pieces.push([a, b, sh(b, c.h), sh(a, c.h)]);
    }
  } else if (c.type === 'wall') {
    for (let i = 1; i < c.line.length; i++) {
      const a = c.line[i - 1], b = c.line[i];
      pieces.push([a, b, sh(b, c.h), sh(a, c.h)]);
    }
  } else {
    // ellipsoïde kroon: projecteer punten op het oppervlak en neem het omhulsel
    let zc, rz;
    if (c.type === 'tree') {
      rz = c.crown ? (c.h * c.crown) / 2 : Math.min(Math.max(c.rx, c.ry), c.h * 0.38);
      zc = c.h - rz;
      const trunkTop = Math.max(0, zc - rz * 0.6);
      const w = Math.max(0.12, Math.min(0.4, c.rx * 0.08));
      const nrm = Math.hypot(d[0], d[1]) || 1;
      const n = [(-d[1] / nrm) * w, (d[0] / nrm) * w];
      const b0 = c.c, b1 = sh(c.c, trunkTop);
      pieces.push([[b0[0] + n[0], b0[1] + n[1]], [b1[0] + n[0], b1[1] + n[1]], [b1[0] - n[0], b1[1] - n[1]], [b0[0] - n[0], b0[1] - n[1]]]);
    } else if (c.type === 'canopy') {
      rz = 0.08;
      zc = c.h;
    } else {
      rz = c.h / 2;
      zc = c.h / 2;
    }
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const phi = -Math.PI / 2 + (i / 6) * Math.PI;
      const ring = Math.cos(phi), z = zc + Math.sin(phi) * rz;
      for (let j = 0; j < 20; j++) {
        const a = (j / 20) * Math.PI * 2;
        const p = rotate([Math.cos(a) * c.rx * ring, Math.sin(a) * c.ry * ring], c.rot);
        pts.push(sh([c.c[0] + p[0], c.c[1] + p[1]], z));
      }
    }
    if (c.type === 'canopy') {
      // paal van de parasol
      const b1 = sh(c.c, c.h);
      const nrm = Math.hypot(d[0], d[1]) || 1, w = 0.05;
      const n = [(-d[1] / nrm) * w, (d[0] / nrm) * w];
      pieces.push([[c.c[0] + n[0], c.c[1] + n[1]], [b1[0] + n[0], b1[1] + n[1]], [b1[0] - n[0], b1[1] - n[1]], [c.c[0] - n[0], c.c[1] - n[1]]]);
    }
    pieces.push(convexHull(pts));
  }
  return pieces;
}

function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Vul alle schaduwvlakken (in de huidige transform) met de huidige fillStyle. */
export function fillShadows(g, casters, d) {
  for (const c of casters) {
    for (const poly of shadowPieces(c, d)) {
      if (poly.length < 3) continue;
      g.beginPath();
      g.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]);
      g.closePath();
      g.fill();
    }
  }
}

// ------------------------------------------------------------------ zonuren

export const SUN_CLASSES = [
  { min: 6, name: 'Zon', note: '6 uur of meer', color: [246, 190, 59] },
  { min: 3, name: 'Halfschaduw', note: '3 tot 6 uur', color: [176, 205, 112] },
  { min: 0, name: 'Schaduw', note: 'minder dan 3 uur', color: [92, 118, 160] },
];

export function sunClass(hours) {
  return SUN_CLASSES.find((c) => hours >= c.min) || SUN_CLASSES[SUN_CLASSES.length - 1];
}

/**
 * Bereken per rastercel het gemiddeld aantal uren direct zonlicht per dag.
 * box: wereldkader; dates: lijst 'JJJJ-MM-DD'.
 */
export async function computeSunHours({ casters, box, dates, lat, lon, northRot, maxCells = 180, stepMin = 15, onProgress, isCancelled }) {
  const bw = box.maxX - box.minX, bh = box.maxY - box.minY;
  const cell = Math.max(bw, bh) / maxCells;
  const cols = Math.max(1, Math.round(bw / cell)), rows = Math.max(1, Math.round(bh / cell));
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const hours = new Float32Array(cols * rows);
  let done = 0;
  for (const ymd of dates) {
    const t = sunTimes(ymd, lat, lon);
    if (t.rise == null) continue;
    for (let m = Math.ceil(t.rise / stepMin) * stepMin; m <= t.set; m += stepMin) {
      const sun = sunPosition(localDate(ymd, m), lat, lon);
      const d = shadowOffset(sun, northRot);
      if (!d) continue;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cols, rows);
      g.setTransform(cols / bw, 0, 0, rows / bh, -box.minX * cols / bw, -box.minY * rows / bh);
      g.fillStyle = '#000';
      fillShadows(g, casters, d);
      const data = g.getImageData(0, 0, cols, rows).data;
      const add = stepMin / 60;
      for (let i = 0; i < hours.length; i++) if (data[i * 4 + 3] < 128) hours[i] += add;
    }
    done++;
    onProgress?.(done / dates.length);
    await new Promise((r) => setTimeout(r, 0));
    if (isCancelled?.()) return null;
  }
  const n = Math.max(1, dates.length);
  for (let i = 0; i < hours.length; i++) hours[i] /= n;
  return { hours, cols, rows, box };
}

/** Kleurenkaart (canvas) van een zonuren-resultaat. */
export function sunHoursImage(result) {
  const { hours, cols, rows } = result;
  const c = document.createElement('canvas');
  c.width = cols;
  c.height = rows;
  const g = c.getContext('2d');
  const img = g.createImageData(cols, rows);
  for (let i = 0; i < hours.length; i++) {
    const col = sunClass(hours[i]).color;
    img.data[i * 4] = col[0];
    img.data[i * 4 + 1] = col[1];
    img.data[i * 4 + 2] = col[2];
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function sunHoursAt(result, w) {
  const { hours, cols, rows, box } = result;
  const x = Math.floor(((w[0] - box.minX) / (box.maxX - box.minX)) * cols);
  const y = Math.floor(((w[1] - box.minY) / (box.maxY - box.minY)) * rows);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
  return hours[y * cols + x];
}
