// Vectorgegevens van PDOK rond de kaartlocatie, in dezelfde wereldcoördinaten als de kaart:
//   - perceelgrenzen uit de Kadastrale Kaart (BRK, OGC API Features)
//   - de bestaande situatie uit de BGT (verharding, groen, water, scheidingen, bouwwerken)
// Beide API's leveren GeoJSON in lengte/breedte (CRS84); we rekenen om via Web Mercator,
// net als de kaarttegels en de BAG-gebouwen, zodat alles precies op de luchtfoto valt.

import { mercator } from './buildings.js';
import { pointInPolygon, polygonArea, polygonCentroid } from './geom.js';

export const BRK_API = 'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1';
export const BGT_API = 'https://api.pdok.nl/lv/bgt/ogc/v1';
const R = 6378137;

function inverseMercator(x, y) {
  return [(Math.atan(Math.exp(y / R)) * 360) / Math.PI - 90, (x / (Math.PI * R)) * 180];
}

/** Zoekgebied (CRS84: lon/lat) van sizeM × sizeM meter rond (lat, lon), plus de omrekening naar de tekening. */
export function geoFrame(lat, lon, sizeM, anchor) {
  const [mx0, my0] = mercator(lat, lon);
  const k = Math.cos((lat * Math.PI) / 180);
  const half = sizeM / 2 / k;
  const sw = inverseMercator(mx0 - half, my0 - half), ne = inverseMercator(mx0 + half, my0 + half);
  const toWorld = ([lo, la]) => {
    const [x, y] = mercator(la, lo);
    return [Math.round((anchor[0] + (x - mx0) * k) * 1000) / 1000, Math.round((anchor[1] - (y - my0) * k) * 1000) / 1000];
  };
  const box = { minX: anchor[0] - sizeM / 2, minY: anchor[1] - sizeM / 2, maxX: anchor[0] + sizeM / 2, maxY: anchor[1] + sizeM / 2 };
  return { bbox: [sw[1], sw[0], ne[1], ne[0]], toWorld, box };
}

/** Alle features binnen een bbox, met paginering (max. pages × 1000). Een ontbrekende collectie geeft []. */
async function fetchAll(base, collection, bbox, pages = 8) {
  let url = `${base}/collections/${collection}/items?f=json&limit=1000&bbox=${bbox.map((v) => v.toFixed(7)).join(',')}`;
  const out = [];
  for (let p = 0; url && p < pages; p++) {
    const res = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } });
    if (res.status === 404) return out;
    if (!res.ok) throw new Error(`${collection}: foutcode ${res.status}`);
    const json = await res.json();
    out.push(...(json.features || []));
    const next = (json.links || []).find((l) => l.rel === 'next');
    url = next ? next.href : null;
  }
  return out;
}

/** Eigenschap opzoeken op (een deel van) de naam, ongeacht schrijfwijze: fysiekVoorkomen, fysiek_voorkomen, bgt_fysiek_voorkomen … */
function prop(props, ...names) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  const keys = Object.keys(props || {});
  for (const n of names) {
    const want = norm(n);
    const k = keys.find((key) => norm(key) === want) || keys.find((key) => norm(key).endsWith(want) && !norm(key).startsWith('plus'));
    if (k != null && props[k] != null && props[k] !== '') return props[k];
  }
  return null;
}

/** Is dit object niet meer actueel (BGT/BRK bevatten ook de historie)? */
function isHistoric(props) {
  const end = prop(props, 'eind_registratie', 'eindregistratie', 'tijdstip_eind_registratie', 'eind_geldigheid');
  if (end) return true;
  const st = prop(props, 'status_historie_code');
  if (st && st !== 'G') return true;
  const status = prop(props, 'status', 'bgt_status');
  return !!status && /historie|plan/i.test(String(status));
}

/** Ringen (buitenrand) en lijnen uit een GeoJSON-geometrie. */
function parts(geom) {
  if (!geom) return { rings: [], lines: [] };
  const c = geom.coordinates;
  switch (geom.type) {
    case 'Polygon': return { rings: [c[0]], lines: [] };
    case 'MultiPolygon': return { rings: c.map((p) => p[0]), lines: [] };
    case 'LineString': return { rings: [], lines: [c] };
    case 'MultiLineString': return { rings: [], lines: c };
    case 'GeometryCollection': {
      const out = { rings: [], lines: [] };
      for (const g of geom.geometries || []) { const p = parts(g); out.rings.push(...p.rings); out.lines.push(...p.lines); }
      return out;
    }
    default: return { rings: [], lines: [] };
  }
}

function ringToWorld(ring, toWorld) {
  const pts = ring.map(toWorld);
  const a = pts[0], b = pts[pts.length - 1];
  if (pts.length > 1 && a[0] === b[0] && a[1] === b[1]) pts.pop();
  return pts;
}

// ---- bijsnijden tot het kaartgebied (Sutherland–Hodgman voor vlakken, Liang–Barsky voor lijnen)

function clipPolygon(pts, box) {
  const edges = [
    (p) => p[0] >= box.minX, (p) => p[0] <= box.maxX, (p) => p[1] >= box.minY, (p) => p[1] <= box.maxY,
  ];
  const cut = [
    (a, b) => { const t = (box.minX - a[0]) / (b[0] - a[0]); return [box.minX, a[1] + (b[1] - a[1]) * t]; },
    (a, b) => { const t = (box.maxX - a[0]) / (b[0] - a[0]); return [box.maxX, a[1] + (b[1] - a[1]) * t]; },
    (a, b) => { const t = (box.minY - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, box.minY]; },
    (a, b) => { const t = (box.maxY - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, box.maxY]; },
  ];
  let out = pts;
  for (let e = 0; e < 4 && out.length; e++) {
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
      const ci = edges[e](cur), pi = edges[e](prev);
      if (ci) { if (!pi) out.push(cut[e](prev, cur)); out.push(cur); } else if (pi) out.push(cut[e](prev, cur));
    }
  }
  return out.map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
}

function clipLine(pts, box) {
  const out = [];
  let cur = [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let ok = true;
    for (const [p, q] of [[-dx, a[0] - box.minX], [dx, box.maxX - a[0]], [-dy, a[1] - box.minY], [dy, box.maxY - a[1]]]) {
      if (p === 0) { if (q < 0) ok = false; continue; }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    }
    if (!ok || t0 > t1) { if (cur.length > 1) out.push(cur); cur = []; continue; }
    const A = [a[0] + dx * t0, a[1] + dy * t0], B = [a[0] + dx * t1, a[1] + dy * t1];
    if (!cur.length) cur.push(A);
    cur.push(B);
    if (t1 < 1) { out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// ------------------------------------------------------------------ perceelgrenzen

/**
 * Percelen rond de locatie. Geeft [{ points, label, grootte, own }], own = het perceel waarin het adres ligt.
 */
export async function fetchParcels({ lat, lon, sizeM, anchor }) {
  const { bbox, toWorld } = geoFrame(lat, lon, sizeM, anchor);
  const feats = await fetchAll(BRK_API, 'perceel', bbox);
  const out = [];
  for (const f of feats) {
    const p = f.properties || {};
    if (isHistoric(p)) continue;
    const { rings } = parts(f.geometry);
    for (const ring of rings) {
      const pts = ringToWorld(ring, toWorld);
      if (pts.length < 3) continue;
      const gem = prop(p, 'akr_kadastrale_gemeente_code_waarde', 'kadastrale_gemeente_code', 'kadastrale_gemeente_waarde');
      const sectie = prop(p, 'sectie');
      const nr = prop(p, 'perceelnummer');
      const grootte = Number(prop(p, 'kadastrale_grootte_waarde', 'kadastrale_grootte', 'grootte'));
      out.push({
        points: pts,
        label: [gem, sectie, nr].filter((v) => v != null).join(' '),
        grootte: Number.isFinite(grootte) && grootte > 0 ? grootte : null,
        own: false,
      });
    }
  }
  // het eigen perceel: waar het adres (het midden van de kaart) in ligt
  const own = out.filter((q) => pointInPolygon(anchor, q.points)).sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
  if (own) own.own = true;
  return out;
}

/** Bebouwd oppervlak binnen een veelhoek (bemonstering), voor "perceel min huis". */
export function builtArea(parcel, buildings) {
  const xs = parcel.map((p) => p[0]), ys = parcel.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const A = Math.abs(polygonArea(parcel));
  const step = Math.max(0.05, Math.sqrt(A) / 80);
  let built = 0;
  for (let y = minY + step / 2; y < maxY; y += step) {
    for (let x = minX + step / 2; x < maxX; x += step) {
      if (!pointInPolygon([x, y], parcel)) continue;
      if (buildings.some((b) => pointInPolygon([x, y], b))) built += step * step;
    }
  }
  return built;
}

export { polygonCentroid };

// ------------------------------------------------------------------ BGT: bestaande situatie

/** Welke collecties we ophalen, en hoe ze in de tekening komen. */
export const BGT_COLLECTIONS = [
  'begroeidterreindeel', 'onbegroeidterreindeel', 'wegdeel', 'ondersteunendwegdeel',
  'waterdeel', 'ondersteunendwaterdeel', 'overigbouwwerk', 'scheiding',
];

const NAMES = {
  begroeidterreindeel: 'Begroeid terrein', onbegroeidterreindeel: 'Onbegroeid terrein', wegdeel: 'Weg',
  ondersteunendwegdeel: 'Berm / weggroen', waterdeel: 'Water', ondersteunendwaterdeel: 'Oever',
  overigbouwwerk: 'Bouwwerk', scheiding: 'Scheiding',
};

/** Materiaal (arcering) en kleur bij een BGT-object. */
export function bgtStyle(collection, props) {
  const fv = String(prop(props, 'fysiek_voorkomen', 'fysiekvoorkomen') || '').toLowerCase();
  const fn = String(prop(props, 'functie') || '').toLowerCase();
  const type = String(prop(props, 'type', 'bgt_type') || '').toLowerCase();
  const verharding = () => (/gesloten/.test(fv) ? { hatch: 'none', fill: '#b9b6b0' }
    : /open verharding/.test(fv) ? { hatch: 'klinkers' }
      : /half verhard/.test(fv) ? { hatch: 'grind' }
        : /onverhard|zand/.test(fv) ? { hatch: 'none', fill: '#e2d3ad' }
          : null);
  switch (collection) {
    case 'begroeidterreindeel':
      if (/gras/.test(fv)) return { hatch: 'gras', label: fv };
      if (/bos|houtwal|struik|heide|groenvoorziening|moeras|riet/.test(fv)) return { hatch: 'beplanting', label: fv };
      return { hatch: 'gras', label: fv || 'begroeid' };
    case 'onbegroeidterreindeel':
      if (/erf/.test(fv)) return { hatch: 'none', fill: '#efe9dc', label: 'erf' };
      return { ...(verharding() || { hatch: 'none', fill: '#e6e0d2' }), label: fv || 'onbegroeid' };
    case 'wegdeel':
      return { ...(verharding() || { hatch: 'none', fill: '#c9c6c0' }), label: fn || fv || 'weg' };
    case 'ondersteunendwegdeel':
      if (/gras|berm|groen/.test(fv) || /berm/.test(fn)) return { hatch: 'gras', label: fn || fv };
      return { ...(verharding() || { hatch: 'gras' }), label: fn || fv };
    case 'waterdeel': return { hatch: 'water', label: type || 'water' };
    case 'ondersteunendwaterdeel': return { hatch: 'gras', label: type || 'oever' };
    case 'overigbouwwerk': return { hatch: 'arcering', fill: '#b8b2a7', label: type || 'bouwwerk' };
    case 'scheiding': return { line: true, label: type || 'scheiding' };
    default: return { hatch: 'none' };
  }
}

/**
 * BGT-objecten rond de locatie als tekenvormen (vlakken met materiaal, scheidingen als lijnen),
 * bijgesneden tot het kaartgebied. Grote vlakken eerst, zodat kleinere erbovenop liggen.
 */
export async function fetchBgt({ lat, lon, sizeM, anchor, onStatus }) {
  const { bbox, toWorld, box } = geoFrame(lat, lon, sizeM, anchor);
  const shapes = [];
  const counts = {};
  const errors = [];
  for (const col of BGT_COLLECTIONS) {
    onStatus?.(`BGT: ${NAMES[col].toLowerCase()} ophalen…`);
    let feats;
    try {
      feats = await fetchAll(BGT_API, col, bbox);
    } catch (err) {
      errors.push(err.message || String(err));
      continue;
    }
    for (const f of feats) {
      const p = f.properties || {};
      if (isHistoric(p)) continue;
      const st = bgtStyle(col, p);
      const { rings, lines } = parts(f.geometry);
      for (const ring of rings) {
        const pts = clipPolygon(ringToWorld(ring, toWorld), box);
        if (pts.length < 3 || Math.abs(polygonArea(pts)) < 0.05) continue;
        shapes.push({ collection: col, kind: st.line ? 'line' : 'polygon', points: st.line ? [...pts, pts[0]] : pts, style: st });
        counts[col] = (counts[col] || 0) + 1;
      }
      for (const line of lines) {
        for (const seg of clipLine(line.map(toWorld), box)) {
          shapes.push({ collection: col, kind: 'line', points: seg, style: { ...st, line: true } });
          counts[col] = (counts[col] || 0) + 1;
        }
      }
    }
  }
  shapes.sort((a, b) => (b.kind === 'polygon' ? Math.abs(polygonArea(b.points)) : -1) - (a.kind === 'polygon' ? Math.abs(polygonArea(a.points)) : -1));
  return { shapes, counts, errors, names: NAMES };
}

export const _test = { clipPolygon, clipLine, prop, isHistoric };
