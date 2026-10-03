// Kaarten op schaal: adres zoeken en kaarttegels samenvoegen tot één afbeelding
// waarvan de werkelijke afmeting in meters bekend is.

const R = 6378137;

export const MAP_SOURCES = {
  luchtfoto: {
    name: 'Luchtfoto (PDOK, NL)',
    url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',
    maxZoom: 21,
    attribution: 'Luchtfoto: Beeldmateriaal Nederland / PDOK',
  },
  brt: {
    name: 'Topografische kaart (PDOK, NL)',
    url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: 'Kaart: Kadaster / PDOK',
  },
  brtgrijs: {
    name: 'Topografisch grijs (PDOK, NL)',
    url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: 'Kaart: Kadaster / PDOK',
  },
  osm: {
    name: 'OpenStreetMap (wereldwijd)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '© OpenStreetMap-bijdragers',
  },
};

export const KADASTER_OVERLAY = {
  url: 'https://service.pdok.nl/kadaster/kadastralekaart/wmts/v5_0/kadastralekaart/EPSG:3857/{z}/{x}/{y}.png',
  maxZoom: 21,
  attribution: 'Perceelgrenzen: Kadaster / PDOK',
};

/** Adressen zoeken: eerst PDOK Locatieserver (NL), anders Nominatim (wereld). */
export async function searchAddress(q) {
  const results = [];
  try {
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=6&fl=weergavenaam,centroide_ll,type&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      for (const d of json.response?.docs || []) {
        const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(d.centroide_ll || '');
        if (m) results.push({ name: d.weergavenaam, lon: parseFloat(m[1]), lat: parseFloat(m[2]) });
      }
    }
  } catch { /* geen verbinding met PDOK */ }
  if (!results.length) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'nl' } });
      if (res.ok) {
        for (const d of await res.json()) {
          results.push({ name: d.display_name, lon: parseFloat(d.lon), lat: parseFloat(d.lat) });
        }
      }
    } catch { /* geen verbinding */ }
  }
  return results;
}

/** "52.37, 4.89" -> {lat, lon} */
export function parseLatLon(str) {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(str);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, name: `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
}

function mercator(lat, lon) {
  const x = (lon * Math.PI * R) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

function loadTile(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Bouw een kaartafbeelding van sizeM × sizeM meter rond (lat, lon).
 * Geeft { dataUrl, widthM, heightM, zoom, attribution }.
 */
export async function buildMap({ lat, lon, sizeM, source, kadaster, maxPx = 3072, onProgress }) {
  const src = MAP_SOURCES[source];
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const mercSpan = sizeM / cosLat; // mercator-meters voor de gevraagde grondafstand
  const [mx, my] = mercator(lat, lon);

  let z = src.maxZoom;
  const resAt = (zz) => (2 * Math.PI * R) / 256 / Math.pow(2, zz);
  while (z > 1 && mercSpan / resAt(z) > maxPx) z--;

  const attempt = async (zz) => {
    const res = resAt(zz);
    const cx = (mx + Math.PI * R) / res;
    const cy = (Math.PI * R - my) / res;
    const half = mercSpan / res / 2;
    const px0 = cx - half, py0 = cy - half;
    const size = Math.round(half * 2);
    const tx0 = Math.floor(px0 / 256), ty0 = Math.floor(py0 / 256);
    const tx1 = Math.floor((px0 + size) / 256), ty1 = Math.floor((py0 + size) / 256);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, size, size);
    const layers = [src.url];
    if (kadaster) layers.push(KADASTER_OVERLAY.url);
    let total = 0, failed = 0, done = 0;
    const count = (tx1 - tx0 + 1) * (ty1 - ty0 + 1) * layers.length;
    for (const tpl of layers) {
      const jobs = [];
      const isOverlay = tpl !== src.url;
      const zt = isOverlay ? Math.min(zz, KADASTER_OVERLAY.maxZoom) : zz;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const url = tpl.replace('{z}', zt).replace('{x}', tx).replace('{y}', ty);
          jobs.push(loadTile(url).then((img) => {
            done++;
            onProgress?.(done / count);
            if (!isOverlay) total++;
            if (!img) { if (!isOverlay) failed++; return; }
            g.drawImage(img, Math.round(tx * 256 - px0), Math.round(ty * 256 - py0), 256, 256);
          }));
        }
      }
      await Promise.all(jobs);
    }
    return { canvas, failed, total };
  };

  let result = await attempt(z);
  // Bij hoge zoom ontbreken soms tegels; probeer dan een niveau lager.
  while (result.failed > result.total * 0.3 && z > 15) {
    z--;
    result = await attempt(z);
  }
  if (result.failed === result.total) throw new Error('Er konden geen kaarttegels worden geladen. Controleer de internetverbinding.');

  const isPhoto = source === 'luchtfoto';
  let dataUrl;
  try {
    dataUrl = result.canvas.toDataURL(isPhoto ? 'image/jpeg' : 'image/png', 0.9);
  } catch {
    throw new Error('De kaartdienst staat het gebruik van de tegels niet toe (CORS).');
  }
  return {
    dataUrl,
    widthM: sizeM,
    heightM: sizeM,
    zoom: z,
    attribution: src.attribution + (kadaster ? ' · ' + KADASTER_OVERLAY.attribution : ''),
  };
}
