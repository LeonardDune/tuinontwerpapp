// Pennen en penselen. Een penseelstreek wordt opgebouwd als vereniging van
// cirkels en trapezia (nonzero fill), zodat drukgevoelige lijnen zonder
// artefacten worden getekend.

export const BRUSHES = {
  fineliner: {
    name: 'Fineliner', width: 0.35, pressure: false, alpha: 1, minRatio: 1,
  },
  pen: {
    name: 'Inktpen', width: 0.6, pressure: true, alpha: 1, minRatio: 0.3, gamma: 0.8, taper: 3,
  },
  pencil: {
    name: 'Potlood', width: 0.5, pressure: true, alpha: 0.9, minRatio: 0.55, gamma: 1, texture: 'grain', pressureAlpha: true,
  },
  marker: {
    name: 'Marker', width: 4, pressure: false, alpha: 0.55, minRatio: 1, composite: 'multiply',
  },
  brush: {
    name: 'Penseel', width: 3, pressure: true, alpha: 0.95, minRatio: 0.08, gamma: 1.4, taper: 6,
  },
  watercolor: {
    name: 'Aquarel', width: 8, pressure: true, alpha: 0.28, minRatio: 0.4, gamma: 1, composite: 'multiply', soft: true, taper: 4,
  },
};

/** Breedte (in dezelfde eenheid als baseWidth) bij druk p voor penseel b. */
export function widthAt(brush, baseWidth, p) {
  if (!brush.pressure) return baseWidth;
  const r = brush.minRatio + (1 - brush.minRatio) * Math.pow(Math.max(0, Math.min(1, p)), brush.gamma || 1);
  return baseWidth * r;
}

/**
 * Bouw het omtrekpad van een streek.
 * points: [[x, y, p], ...] in wereldcoördinaten. baseWidth in wereld-eenheden.
 * De punten worden eerst tot een vloeiende kromme gemaakt (zie smoothCurve).
 */
export function strokePath(points, brush, baseWidth) {
  const path = new Path2D();
  if (!points.length) return path;
  const pts = smoothCurve(points, Math.max(baseWidth * 0.2, 1e-4));
  // lengte langs de streek, voor het taps toelopen van begin en eind
  const along = [0];
  for (let i = 1; i < pts.length; i++) {
    along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = along[along.length - 1];
  const taperLen = brush.taper ? brush.taper * baseWidth * 0.9 : 0;
  const widths = pts.map((p, i) => {
    let w = widthAt(brush, baseWidth, p[2] ?? 0.5);
    if (taperLen) {
      const k = Math.min(1, along[i] / taperLen, (total - along[i]) / taperLen);
      w *= 0.35 + 0.65 * Math.max(0, k);
    }
    return Math.max(w, baseWidth * 0.02);
  });

  for (let i = 0; i < pts.length; i++) {
    const r = widths[i] / 2;
    path.moveTo(pts[i][0] + r, pts[i][1]);
    path.arc(pts[i][0], pts[i][1], r, 0, Math.PI * 2, false);
    if (i > 0) {
      const a = pts[i - 1], b = pts[i];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      const nx = -dy / len, ny = dx / len;
      const ra = widths[i - 1] / 2, rb = r;
      // Kloksgewijs (gezien op scherm) zoals de cirkels, zodat nonzero een vereniging geeft.
      path.moveTo(a[0] - nx * ra, a[1] - ny * ra);
      path.lineTo(b[0] - nx * rb, b[1] - ny * rb);
      path.lineTo(b[0] + nx * rb, b[1] + ny * rb);
      path.lineTo(a[0] + nx * ra, a[1] + ny * ra);
      path.closePath();
    }
  }
  return path;
}

/**
 * Maak van een puntenreeks een vloeiende kromme: twee keer Chaikin-afronding
 * (hoeken worden bogen, begin- en eindpunt blijven staan) en daarna zo dicht
 * bijvullen dat er geen zichtbare rechte stukjes overblijven.
 */
export function smoothCurve(points, maxSpacing) {
  let pts = points.map((p) => [p[0], p[1], p[2] ?? 0.5]);
  for (let pass = 0; pass < 2 && pts.length > 2; pass++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75],
      );
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  const dense = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.min(64, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxSpacing));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      dense.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return dense;
}

const grainCache = new Map();

/** Potloodkorrel: patroon met willekeurige transparantie, in de gegeven kleur. */
export function grainPattern(ctx, color) {
  let canvas = grainCache.get(color);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = 96;
    const g = canvas.getContext('2d');
    g.fillStyle = color;
    g.fillRect(0, 0, 96, 96);
    const img = g.getImageData(0, 0, 96, 96);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 3; i < img.data.length; i += 4) {
      const v = rnd();
      img.data[i] = v < 0.18 ? 30 : 110 + v * 145;
    }
    g.putImageData(img, 0, 0);
    grainCache.set(color, canvas);
  }
  return ctx.createPattern(canvas, 'repeat');
}
