// Kleine geometrie-hulpfuncties. Punten zijn [x, y] arrays.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function dist(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

export function scale(a, s) {
  return [a[0] * s, a[1] * s];
}

export function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function rotate(p, angle, c = [0, 0]) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * cos - y * sin, c[1] + x * sin + y * cos];
}

export function angleOf(a, b) {
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

export function normAngle(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

/** Projecteer p op de oneindige lijn door a en b. Geeft [punt, t]. */
export function projectOnLine(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1e-12;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  return [[a[0] + dx * t, a[1] + dy * t], t];
}

export function distToSegment(p, a, b) {
  const [, t] = projectOnLine(p, a, b);
  const tc = Math.max(0, Math.min(1, t));
  return dist(p, lerp(a, b, tc));
}

export function distToLine(p, a, b) {
  const [q] = projectOnLine(p, a, b);
  return dist(p, q);
}

/** Aan welke kant van lijn a->b ligt p? (+1 / -1) */
export function sideOf(p, a, b) {
  const v = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  return v >= 0 ? 1 : -1;
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

export function polygonCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += f;
    cx += (poly[j][0] + poly[i][0]) * f;
    cy += (poly[j][1] + poly[i][1]) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const b = bbox(poly);
    return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function bbox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  return { minX, minY, maxX, maxY };
}

export function unionBox(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Ramer–Douglas–Peucker vereenvoudiging. */
export function simplify(points, tolerance) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distToSegment(points[i], points[s], points[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Affiene 2D-matrix [a, b, c, d, e, f] zoals in canvas. */
export function matMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function matApply(m, p) {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

export function matTranslate(x, y) {
  return [1, 0, 0, 1, x, y];
}

export function matRotate(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, s, -s, c, 0, 0];
}

export function matScale(s) {
  return [s, 0, 0, s, 0, 0];
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function snapAngle(angle, stepRad, tolerance) {
  const snapped = Math.round(angle / stepRad) * stepRad;
  return Math.abs(normAngle(angle - snapped)) <= tolerance ? snapped : angle;
}
