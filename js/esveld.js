// Esveld (esveld.nl) als plantenbron en primaire leverancier.
// De catalogus (esveld.json, gemaakt met tools/esveld.py) staat níet in de app of de repository: je importeert hem
// zelf in Instellingen en hij wordt alleen op dit apparaat bewaard (IndexedDB). Elke cultivar is een eigen plant
// met zijn eigen hoogte, breedte, bloei, standplaats, grond, aantal per m², potmaten en prijs.

import { addPlants, PLANTS } from './plantdb.js';
import { saveCatalog, loadCatalog, deleteCatalog } from './storage.js';

const LIGHT = { z: 'zon', h: 'half', s: 'schaduw' };
const SOIL = { d: 'droog', n: 'normaal', v: 'vochtig' };

export const ESVELD = { loaded: false, count: 0, date: null, base: 'https://esveld.nl/a/product/' };

/** Latijnse naam vergelijkbaar maken: kleine letters, zonder ×, aanhalingstekens en dubbele spaties. */
export function latKey(s) {
  return String(s || '').toLowerCase().replace(/[‘’'"`]/g, '').replace(/\s[×x]\s/g, ' ').replace(/×/g, '').replace(/\s+/g, ' ').trim();
}

/** Plant uit de compacte vorm van data/esveld.json. */
function fromRecord(r, date) {
  const nl = r.nl ? (r.cv ? `${r.nl} '${r.cv}'` : r.nl) : r.lat;
  const p = {
    id: r.id, nl, lat: r.lat, type: r.t, h: r.h, w: r.w, habit: r.ha, form: r.f, color: r.c, bloom: r.b || [],
    light: [...(r.l || 'zh')].map((c) => LIGHT[c]), soil: [...(r.s || 'n')].map((c) => SOIL[c]),
    foliage: r.fo || 'groen', autumn: r.a || 'geen',
    winter: r.ev ? 'groen' : ['gras', 'heester', 'boom'].includes(r.t) ? 'silhouet' : 'weg',
    src: 'esveld',
    esv: { url: ESVELD.base + r.u + '/', price: r.p ? r.p / 100 : null, priceMax: r.pm ? r.pm / 100 : null, sizes: r.sz || [], perM2: r.m2 || null, hard: r.hd || null, stock: !!r.st, date },
  };
  if (r.ev) p.evergreen = true;
  if (r.bee) p.bees = true;
  if (r.g) p.ground = r.g;
  if (r.fr) p.fruit = true;
  return p;
}

/** Bij het starten: de catalogus die op dit apparaat bewaard is (of niets). */
export async function loadEsveld() {
  if (ESVELD.loaded) return ESVELD;
  const data = await loadCatalog('esveld');
  return data ? useEsveld(data) : ESVELD;
}

/** Een gekozen bestand (esveld.json) controleren, op dit apparaat bewaren en gebruiken. */
export async function importEsveld(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Dit is geen geldig catalogusbestand (JSON).');
  }
  if (data?.source !== 'Esveld' || !Array.isArray(data.plants) || !data.plants.length) throw new Error('Dit bestand is geen Esveld-catalogus.');
  await saveCatalog('esveld', data);
  return useEsveld(data);
}

/** Catalogus van dit apparaat verwijderen (werkt na herladen). */
export async function removeEsveld() {
  await deleteCatalog('esveld');
}

export function useEsveld(data) {
  const list = data.plants.map((r) => fromRecord(r, data.date));
  // ingebouwde planten met dezelfde Latijnse naam: verwijzing naar het Esveld-artikel
  const byLat = new Map(list.map((p) => [latKey(p.lat), p]));
  for (const p of PLANTS.values()) {
    if (p.src === 'esveld') continue;
    const e = byLat.get(latKey(p.lat));
    if (e) p.esv = e.esv;
  }
  addPlants(list);
  ESVELD.loaded = true;
  ESVELD.count = list.length;
  ESVELD.date = data.date;
  return ESVELD;
}

/** Is deze plant bij Esveld te koop (eigen Esveld-plant of gekoppelde ingebouwde plant)? */
export function atEsveld(p) {
  return !!p?.esv;
}
