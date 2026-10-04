// Gebouwen rondom de kaart ophalen: omtrekken uit de BAG (PDOK) en hoogtes uit de 3D BAG.
//
// De BAG-omtrekken vragen we op in Web Mercator (EPSG:3857), dezelfde projectie als de
// kaarttegels, zodat ze precies op de luchtfoto vallen. De hoogte koppelen we via het
// BAG-pandnummer aan de 3D BAG (dakhoogte min maaiveld).

const R = 6378137;
const BAG_WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
const BAG3D = 'https://api.3dbag.nl/collections/pand/items';
export const DEFAULT_BUILDING_HEIGHT = 6;

export function mercator(lat, lon) {
  return [(lon * Math.PI * R) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
}

function inverseMercator(x, y) {
  return [(Math.atan(Math.exp(y / R)) * 360) / Math.PI - 90, (x / (Math.PI * R)) * 180];
}

/** WGS84 -> RD (Rijksdriehoek), benaderingsformules; ruim voldoende voor een zoekgebied. */
export function wgsToRd(lat, lon) {
  const dp = 0.36 * (lat - 52.1551744), dl = 0.36 * (lon - 5.38720621);
  const X = 155000 + 190094.945 * dl - 11832.228 * dp * dl - 114.221 * dp * dp * dl - 32.391 * dl ** 3
    - 0.705 * dp - 2.34 * dp ** 3 * dl - 0.608 * dp * dl ** 3 - 0.008 * dl * dl + 0.148 * dp * dp * dl ** 3;
  const Y = 463000 + 309056.544 * dp + 3638.893 * dl * dl + 73.077 * dp * dp - 157.984 * dp * dl * dl
    + 59.788 * dp ** 3 + 0.433 * dl - 6.439 * dp * dp * dl * dl - 0.032 * dp * dl + 0.092 * dl ** 4 - 0.054 * dp * dl ** 4;
  return [X, Y];
}

const SKIP_STATUS = /gesloopt|niet gerealiseerd|vergunning verleend|ten onrechte/i;

/** Haal BAG-panden op binnen een vierkant van sizeM meter rond (lat, lon). */
async function fetchBagFootprints(lat, lon, sizeM) {
  const [mx, my] = mercator(lat, lon);
  const half = sizeM / 2 / Math.cos((lat * Math.PI) / 180);
  const bbox = [mx - half, my - half, mx + half, my + half];
  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'bag:pand',
    outputFormat: 'application/json', srsName: 'EPSG:3857', count: '1000',
    bbox: `${bbox.join(',')},urn:ogc:def:crs:EPSG::3857`,
  });
  const res = await fetch(`${BAG_WFS}?${params}`);
  if (!res.ok) throw new Error(`BAG gaf foutcode ${res.status}`);
  const json = await res.json();
  const out = [];
  for (const f of json.features || []) {
    const p = f.properties || {};
    if (SKIP_STATUS.test(p.status || '')) continue;
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      let ring = poly[0];
      if (!ring || ring.length < 4) continue;
      // Sommige servers negeren srsName en geven lengte/breedte: dan zelf omrekenen.
      if (Math.abs(ring[0][0]) <= 180 && Math.abs(ring[0][1]) <= 90) ring = ring.map(([x, y]) => mercator(y, x));
      out.push({ id: String(p.identificatie || f.id || '').replace(/^.*\./, ''), ring, bouwjaar: p.bouwjaar });
    }
  }
  return out;
}

/** Hoogtes (m boven maaiveld) per BAG-pandnummer uit de 3D BAG. */
async function fetch3dBagHeights(lat, lon, sizeM) {
  const [mx, my] = mercator(lat, lon);
  const half = sizeM / 2 / Math.cos((lat * Math.PI) / 180) + 10;
  const corners = [[mx - half, my - half], [mx + half, my + half]].map(([x, y]) => inverseMercator(x, y));
  const a = wgsToRd(corners[0][0], corners[0][1]), b = wgsToRd(corners[1][0], corners[1][1]);
  const bbox = [Math.min(a[0], b[0]) - 20, Math.min(a[1], b[1]) - 20, Math.max(a[0], b[0]) + 20, Math.max(a[1], b[1]) + 20].map((v) => v.toFixed(1));
  const heights = new Map();
  let url = `${BAG3D}?bbox=${bbox.join(',')}&limit=100`;
  for (let page = 0; url && page < 15; page++) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`3D BAG gaf foutcode ${res.status}`);
    const json = await res.json();
    for (const f of json.features || []) {
      const objs = f.CityObjects || f.feature?.CityObjects || {};
      for (const [key, obj] of Object.entries(objs)) {
        const m = /Pand\.(\d+)$/.exec(key);
        const at = obj.attributes;
        if (!m || !at) continue;
        const roof = at.b3_h_dak_70p ?? at.b3_h_dak_50p ?? at.b3_h_dak_max;
        const ground = at.b3_h_maaiveld ?? 0;
        if (Number.isFinite(roof)) heights.set(m[1], Math.max(0, Math.round((roof - ground) * 10) / 10));
      }
    }
    const next = (json.links || []).find((l) => l.rel === 'next');
    url = next ? next.href : null;
  }
  return heights;
}

/**
 * Gebouwen als vormen met hoogte, in wereldcoördinaten.
 * anchor: wereldpunt waar (lat, lon) ligt (het midden van de geïmporteerde kaart).
 */
export async function fetchBuildings({ lat, lon, sizeM, anchor, onStatus }) {
  onStatus?.('Gebouwen ophalen uit de BAG…');
  const foot = await fetchBagFootprints(lat, lon, sizeM);
  let heights = new Map(), heightError = null;
  if (foot.length) {
    onStatus?.('Hoogtes ophalen uit de 3D BAG…');
    try {
      heights = await fetch3dBagHeights(lat, lon, sizeM);
    } catch (err) {
      heightError = err.message || String(err);
    }
  }
  const [mx0, my0] = mercator(lat, lon);
  const k = Math.cos((lat * Math.PI) / 180);
  const toWorld = ([x, y]) => [
    Math.round((anchor[0] + (x - mx0) * k) * 1000) / 1000,
    Math.round((anchor[1] - (y - my0) * k) * 1000) / 1000,
  ];
  let withHeight = 0;
  const buildings = foot.map((b) => {
    const pts = b.ring.map(toWorld);
    const last = pts[pts.length - 1];
    if (last[0] === pts[0][0] && last[1] === pts[0][1]) pts.pop();
    const h = heights.get(b.id);
    if (h != null) withHeight++;
    return { id: b.id, points: pts, height: h ?? DEFAULT_BUILDING_HEIGHT, estimated: h == null, bouwjaar: b.bouwjaar };
  });
  return { buildings, withHeight, heightError };
}
