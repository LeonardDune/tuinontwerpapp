// Boogvormige vakken (een pad of border als deel van een ring): als gewoon vlak met een rij punten,
// zodat verband, vulling, beplanting en randen gewoon werken. De boogmaten zijn uit de punten terug te
// rekenen, ook na verschuiven, draaien of spiegelen.

const r4 = (v) => Math.round(v * 10000) / 10000;

/**
 * Punten van een boog: middelpunt c, binnenstraal r1, buitenstraal r2, middenrichting mid (radialen),
 * boog sweep (radialen, 0 < sweep < 2π). Eerst de buitenrand, dan de binnenrand terug.
 */
export function arcPolygon(c, r1, r2, mid, sweep, imid = mid, isweep = sweep) {
  const n = Math.max(8, Math.ceil(((Math.max(sweep, isweep) * 180) / Math.PI) / 3));
  const a0 = mid - sweep / 2, b0 = imid - isweep / 2; // binnenrand mag eigen uiteinden hebben (schuin afgesneden)
  const out = [], inn = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n, b = b0 + (isweep * i) / n;
    out.push([r4(c[0] + Math.cos(a) * r2), r4(c[1] + Math.sin(a) * r2)]);
    inn.push([r4(c[0] + Math.cos(b) * r1), r4(c[1] + Math.sin(b) * r1)]);
  }
  return out.concat(inn.reverse());
}

/** Middelpunt van de cirkel door drie punten. */
function circumcenter(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a[0] ** 2 + a[1] ** 2, b2 = b[0] ** 2 + b[1] ** 2, c2 = c[0] ** 2 + c[1] ** 2;
  return [(a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d, (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d];
}

/** Boogmaten uit de punten: { c, r1, r2, mid, sweep } of null als het (niet meer) een nette boog is. */
export function arcParams(points) {
  if (!points || points.length < 6 || points.length % 2) return null;
  const n = points.length / 2 - 1;
  const out = points.slice(0, n + 1), inn = points.slice(n + 1).reverse();
  const c = circumcenter(out[0], out[Math.floor(n / 2)], out[n]);
  if (!c) return null;
  const R = (p) => Math.hypot(p[0] - c[0], p[1] - c[1]);
  const r2 = R(out[0]), r1 = R(inn[0]);
  if (!(r2 > r1) || r1 <= 0) return null;
  const tol = Math.max(0.003, r2 * 0.01);
  if (out.some((p) => Math.abs(R(p) - r2) > tol) || inn.some((p) => Math.abs(R(p) - r1) > tol)) return null;
  const ang = (p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const edge = (pts) => {
    let step = ang(pts[1]) - ang(pts[0]);
    step = Math.atan2(Math.sin(step), Math.cos(step));
    const sw = step * n;
    // gespiegelde boog (andere draairichting): zelfde boog, met positieve hoek beschreven
    return { mid: ang(pts[0]) + sw / 2, sweep: Math.abs(sw) };
  };
  const o = edge(out), i = edge(inn);
  return { c, r1, r2, mid: o.mid, sweep: o.sweep, imid: i.mid, isweep: i.sweep };
}

/** Hoekpunten en randmiddens van een boog (voor de grepen bij "Punten bewerken"). */
export function arcHandles(p) {
  const at = (a, r) => [p.c[0] + Math.cos(a) * r, p.c[1] + Math.sin(a) * r];
  return {
    o0: at(p.mid - p.sweep / 2, p.r2), o1: at(p.mid + p.sweep / 2, p.r2),
    i0: at(p.imid - p.isweep / 2, p.r1), i1: at(p.imid + p.isweep / 2, p.r1),
    om: at(p.mid, p.r2), im: at(p.imid, p.r1),
  };
}

/** Een greep van de boog naar punt w slepen: hoekpunten verschuiven langs hun rand en veranderen de straal. */
export function dragArc(p, role, w) {
  const TAU = Math.PI * 2;
  const r = Math.hypot(w[0] - p.c[0], w[1] - p.c[1]);
  const th = Math.atan2(w[1] - p.c[1], w[0] - p.c[0]);
  let { r1, r2, mid, sweep, imid, isweep } = p;
  const outer = role[0] === 'o';
  if (outer) r2 = Math.max(r1 + 0.05, r); else r1 = Math.max(0.02, Math.min(r2 - 0.05, r));
  if (role[1] !== 'm') {
    let m = outer ? mid : imid, s = outer ? sweep : isweep;
    const lo = m - s / 2, hi = m + s / 2;
    const norm = (v) => ((v % TAU) + TAU) % TAU;
    if (role[1] === '0') { s = norm(hi - th); if (s < 0.05 || s > TAU - 0.05) s = Math.max(0.05, Math.min(TAU - 0.05, s)); m = hi - s / 2; } else { s = norm(th - lo); if (s < 0.05 || s > TAU - 0.05) s = Math.max(0.05, Math.min(TAU - 0.05, s)); m = lo + s / 2; }
    if (outer) { mid = m; sweep = s; } else { imid = m; isweep = s; }
  }
  return arcPolygon(p.c, r1, r2, mid, sweep, imid, isweep);
}
