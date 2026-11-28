// Esveld (esveld.nl) als plantenbron en primaire leverancier.
// De catalogus (esveld.json, gemaakt met tools/esveld.py) staat níet in de app of de repository: je importeert hem
// zelf in Instellingen en hij wordt alleen op dit apparaat bewaard (IndexedDB). Elke cultivar is een eigen plant
// met zijn eigen hoogte, breedte, bloei, standplaats, grond, aantal per m², potmaten en prijs.

import { addPlants, PLANTS } from './plantdb.js';
import { saveCatalog, loadCatalog, deleteCatalog } from './storage.js';
import { resetTraits } from './traits.js';

const LIGHT = { z: 'zon', h: 'half', s: 'schaduw' };
const SOIL = { d: 'droog', n: 'normaal', v: 'vochtig' };

export const ESVELD = { loaded: false, count: 0, date: null, base: 'https://esveld.nl/a/product/' };

/** Latijnse naam vergelijkbaar maken: kleine letters, zonder accenten, ×, aanhalingstekens, handelsnamen en dubbele spaties. */
export function latKey(s) {
  return String(s || '').toLowerCase()
    .replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ü/g, 'ue')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[‘’'"`]/g, '').replace(/\s[×x]\s/g, ' ').replace(/×/g, '')
    .replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Esveld gebruikt soms de oudere (of juist nieuwere) geslachtsnaam
const SYNONYMS = {
  hylotelephium: 'sedum', symphyotrichum: 'aster', eurybia: 'aster', eutrochium: 'eupatorium', lamprocapnos: 'dicentra',
  bistorta: 'persicaria', 'salvia rosmarinus': 'rosmarinus officinalis', 'stachys monieri': 'betonica officinalis', anemanthele: 'stipa', hyacinthoides: 'endymion',
};

export function synonym(key) {
  for (const [a, b] of Object.entries(SYNONYMS)) if (key === a || key.startsWith(a + ' ')) return b + key.slice(a.length);
  return key;
}

/** Delen van een naam: geslacht, soort (zonder cultivar) en cultivar. */
export function nameParts(lat) {
  const m = /[‘'](.+)[’']/.exec(lat);
  const cv = m ? latKey(m[1]) : '';
  const base = latKey(m ? lat.slice(0, m.index) : lat);
  const words = base.split(' ').filter((w) => w && !['var.', 'subsp.', 'ssp.', 'f.'].includes(w));
  return { genus: words[0] || '', species: words.slice(0, 2).join(' '), cv };
}

/** Zoeklink in de webshop van Esveld. */
export function esveldSearch(q) {
  return `https://esveld.nl/a/webshop/?q=${encodeURIComponent(q)}`;
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
  // feiten voor functies en filters (zie traits.js)
  p.facts = { src: 1, e: r.e, gr: r.gr, lf: r.lf, lz: r.lz, fc: r.fc, fm: r.fm, wi: r.wi, k: r.k, lei: r.lei, vm: r.vm, hw: r.hw };
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
  linkBuiltins(list);
  addPlants(list);
  resetTraits();
  ESVELD.loaded = true;
  ESVELD.count = list.length;
  ESVELD.date = data.date;
  return ESVELD;
}

/**
 * Planten uit de basislijst koppelen aan Esveld:
 *  1. dezelfde naam; 2. geslacht + cultivar (Esveld laat de soort vaak weg: Nepeta 'Walker's Low');
 *  3. dezelfde soort zonder cultivar; anders een zoeklink naar het aanbod van die soort of dat geslacht.
 */
function linkBuiltins(list) {
  const full = new Map(), byCv = new Map(), bySpecies = new Map(), countGenus = new Map(), countSpecies = new Map();
  for (const p of list) {
    const k = synonym(latKey(p.lat));
    if (!full.has(k)) full.set(k, p);
    const n = nameParts(p.lat);
    const sp = synonym(n.species), g = sp.split(' ')[0];
    if (n.cv && !byCv.has(`${g}|${n.cv}`)) byCv.set(`${g}|${n.cv}`, p);
    // handelsnaam tussen haakjes ('Speciosa' (FIRETAIL)) telt ook als cultivarnaam
    const trade = /\(([^)]+)\)/.exec(p.lat);
    if (trade && !byCv.has(`${g}|${latKey(trade[1])}`)) byCv.set(`${g}|${latKey(trade[1])}`, p);
    if (!n.cv && !bySpecies.has(sp)) bySpecies.set(sp, p);
    countGenus.set(g, (countGenus.get(g) || 0) + 1);
    countSpecies.set(sp, (countSpecies.get(sp) || 0) + 1);
  }
  for (const p of PLANTS.values()) {
    if (p.src === 'esveld') continue;
    delete p.esv; delete p.esvSearch; delete p.facts;
    const n = nameParts(p.lat);
    const sp = synonym(n.species), g = sp.split(' ')[0];
    const e = full.get(synonym(latKey(p.lat))) || (n.cv ? byCv.get(`${g}|${n.cv}`) : bySpecies.get(sp));
    if (e) { p.esv = e.esv; p.facts = e.facts; continue; }
    // geen artikel met precies deze naam: het aanbod van de soort (of het geslacht) bij Esveld
    const nSp = countSpecies.get(sp) || 0, nG = countGenus.get(g) || 0;
    if (nSp || nG) {
      // zoekterm: de (Esveld-)naam van de soort, of alleen het geslacht
      const words = synonym(latKey(p.lat.replace(/[‘'].*$/, ''))).split(' ');
      const q = nSp ? p.lat.replace(/[‘'].*$/, '').replace(/×\s*/g, '').trim().split(/\s+/).slice(0, 2).join(' ') : words[0];
      const syn = Object.entries(SYNONYMS).find(([a]) => !a.includes(' ') && latKey(q).startsWith(a + ' '));
      const qq = syn ? syn[1] + q.slice(syn[0].length) : q;
      p.esvSearch = { url: esveldSearch(qq.charAt(0).toUpperCase() + qq.slice(1)), n: nSp || nG, what: nSp ? 'soort' : 'geslacht' };
    }
  }
}

/** Is deze plant bij Esveld te koop (eigen Esveld-plant of gekoppelde ingebouwde plant)? */
export function atEsveld(p) {
  return !!p?.esv;
}

/** Link naar Esveld voor een plant uit de database (artikel, of het aanbod van de soort), als HTML; anders ''. */
export function esveldLinkHtml(p) {
  if (!p) return '';
  if (p.esv?.url) return `<a class="esvlink" href="${p.esv.url}" target="_blank" rel="noopener" title="Bekijk bij Esveld${p.esv.price != null ? `, vanaf € ${p.esv.price.toFixed(2).replace('.', ',')}` : ''}">Esveld ↗</a>`;
  if (p.esvSearch?.url) return `<a class="esvlink" href="${p.esvSearch.url}" target="_blank" rel="noopener" title="${p.esvSearch.n} cultivar${p.esvSearch.n > 1 ? 's' : ''} van deze ${p.esvSearch.what} bij Esveld">aanbod Esveld ↗</a>`;
  return '';
}

/** Zelfde voor een bouwsteen (via de plant waar hij op gebaseerd is). */
export function roleEsveldLinkHtml(r) {
  return r?.plant ? esveldLinkHtml(PLANTS.get(r.plant)) : '';
}
