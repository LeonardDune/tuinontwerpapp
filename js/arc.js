// Boogvormige vakken (een pad of border als deel van een ring): als gewoon vlak met een rij punten,
// zodat verband, vulling, beplanting en randen gewoon werken. De boogmaten zijn uit de punten terug te
// rekenen, ook na verschuiven, draaien of spiegelen.

const r4 = (v) => Math.round(v * 10000) / 10000;

/**
 * Punten van een boog: middelpunt c, binnenstraal r1, buitenstraal r2, middenrichting mid (radialen),
 * boog sweep (radialen, 0 < sweep < 2π). Eerst de buitenrand, dan de binnenrand terug.
 */
export function arcPolygon(c, r1, r2, mid, sweep) {
  const n = Math.max(8, Math.ceil(((sweep * 180) / Math.PI) / 3));
  const a0 = mid - sweep / 2;
  const out = [], inn = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    out.push([r4(c[0] + Math.cos(a) * r2), r4(c[1] + Math.sin(a) * r2)]);
    inn.push([r4(c[0] + Math.cos(a) * r1), r4(c[1] + Math.sin(a) * r1)]);
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
  let step = ang(out[1]) - ang(out[0]);
  step = Math.atan2(Math.sin(step), Math.cos(step));
  const sweep = step * n;
  const a0 = ang(out[0]);
  // gespiegelde boog (andere draairichting): zelfde boog, maar met positieve hoek beschreven
  const mid = a0 + sweep / 2;
  return { c, r1, r2, mid, sweep: Math.abs(sweep) };
}
