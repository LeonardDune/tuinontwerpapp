// Voorbeeldschema's toepassen op een plantvak: planten opzoeken (Esveld eerst als die catalogus geladen is),
// schalen naar de maat van het vak, en wat niet past bij zon, grond, ligging of winterhardheid vervangen.

import { PLANTS, plantById, defaultRole, colorFamily, heightClass, fitsBedType } from './plantdb.js';
import { latKey, synonym, nameParts } from './esveld.js';
import { BORDERS, BORDER_ROLES, TENDER } from './borderdata.js';
import { COMBOS } from './combos.js';
import { lightFits, siteProblems } from './site.js';
import { meetsAll } from './traits.js';
import { inScheme } from './planting.js';

export { BORDERS, BORDER_ROLES };

// ------------------------------------------------------------------ planten opzoeken op Latijnse naam

let index = null, indexSize = -1;

function buildIndex() {
  const full = new Map(), byCv = new Map(), bySpecies = new Map(), byGenus = new Map();
  const add = (m, k, p) => { if (!m.has(k)) m.set(k, []); m.get(k).push(p); };
  for (const p of PLANTS.values()) {
    if (!p.lat) continue;
    add(full, synonym(latKey(p.lat)), p);
    const n = nameParts(p.lat);
    const sp = synonym(n.species), g = sp.split(' ')[0];
    if (n.cv) add(byCv, `${g}|${n.cv}`, p);
    add(bySpecies, sp, p);
    add(byGenus, g, p);
  }
  index = { full, byCv, bySpecies, byGenus };
  indexSize = PLANTS.size;
}

/** Beste uit een lijst: bij Esveld te koop (als die bron gekozen is), dan de ingebouwde plant. */
function best(list, ctx) {
  if (!list?.length) return null;
  const pool = ctx.source === 'esveld' ? list.filter((p) => p.esv) : list;
  const l = pool.length ? pool : list;
  return [...l].sort((a, b) => (!!b.esv - !!a.esv) || (a.src === 'esveld') - (b.src === 'esveld'))[0];
}

/**
 * Plant bij een naam uit een schema. Geeft { p, how } met how: 'exact' (zelfde naam), 'cultivar' (zelfde cultivar,
 * soortnaam anders geschreven), 'soort' (andere cultivar of de soort zelf), 'geslacht' (ander lid van het geslacht), of null.
 */
export function findByLat(lat, ctx = {}) {
  if (!index || indexSize !== PLANTS.size) buildIndex();
  const n = nameParts(lat);
  const sp = synonym(n.species), g = sp.split(' ')[0];
  let p = best(index.full.get(synonym(latKey(lat))), ctx);
  if (p) return { p, how: 'exact' };
  if (n.cv && (p = best(index.byCv.get(`${g}|${n.cv}`), ctx))) return { p, how: 'cultivar' };
  const species = index.bySpecies.get(sp);
  if (species?.length) {
    // de soort zelf als die er is, anders de cultivar die het meest op de soort lijkt (geen bonte of afwijkende)
    const plain = species.filter((q) => !nameParts(q.lat).cv);
    p = best(plain.length ? plain : species, ctx);
    if (p) return { p, how: n.cv ? 'soort' : 'exact' };
  }
  const genus = index.byGenus.get(g);
  if (genus?.length) return { p: best(genus, ctx), how: 'geslacht', genus: true };
  return { p: null, how: null };
}

const SOIL_ADJ = { droog: 'droge', normaal: 'normale', vochtig: 'vochtige' };
const LIGHT_ORDER = ['zon', 'halfzon', 'half', 'schaduw'];

const isTender = (lat) => { const k = latKey(lat); return TENDER.some((t) => k === t || k.startsWith(t + ' ')); };

// ------------------------------------------------------------------ past een plant op deze plek?

/** Redenen waarom een plant hier niet goed staat (leeg = past). */
export function siteMisfits(p, ctx, lat = '') {
  const out = [];
  if (ctx.light && p.light && !lightFits(p.light, ctx.light)) out.push('andere standplaats');
  // gewone grond (vochthoudend) gaat voor bijna alles; alleen droge en vochtige plekken zijn streng
  if (ctx.moisture && ctx.moisture !== 'normaal' && p.soil && !p.soil.includes(ctx.moisture)) out.push(`wil geen ${SOIL_ADJ[ctx.moisture] || ctx.moisture} grond`);
  if (ctx.require?.length && !meetsAll(p, ctx.require)) out.push('voldoet niet aan de eisen van het vak');
  if (ctx.site) out.push(...siteProblems(p, ctx.site));
  if (!p.esv?.hard && lat && isTender(lat)) out.push('niet overal winterhard');
  return out;
}

/** Vervanger voor een plant: zelfde soort plant en rol, past op de plek, lijkt in hoogte, kleur en bloei. */
function substitute(orig, brole, ctx, used) {
  const fam = orig?.bloom?.length ? colorFamily(orig.color) : null;
  const hc = orig ? heightClass(orig) : null;
  let bestP = null, bestS = -Infinity;
  for (const q of PLANTS.values()) {
    if (used.has(q.id) || ['boom', 'haag', 'klimmer'].includes(q.type)) continue;
    if (ctx.source === 'esveld' && !q.esv) continue;
    if (siteMisfits(q, ctx).length) continue;
    if (orig && q.type !== orig.type && !(orig.type === 'vaste' && q.type === 'gras') && !(orig.type === 'gras' && q.type === 'vaste')) continue;
    if (!orig && boleOf(q) !== (brole === 'bol')) continue;
    let s = 0;
    if (orig) {
      s -= Math.abs(q.h - orig.h) / 30;
      if (heightClass(q) === hc) s += 2;
      if (fam && q.bloom.length && colorFamily(q.color) === fam) s += 3;
      if (orig.bloom.length && q.bloom.length) s += orig.bloom.filter((m) => q.bloom.includes(m)).length * 0.5;
      if (q.form === orig.form) s += 1;
      if (q.lat && orig.lat && q.lat.split(' ')[0] === orig.lat.split(' ')[0]) s += 2;
    }
    if (borderRole(q) === brole) s += 2;
    if (q.esv) s += 0.5;
    if (s > bestS) { bestS = s; bestP = q; }
  }
  return bestP;
}

const boleOf = (p) => p.type === 'bol';

/** Rol in een schema voor een plant zonder opgegeven rol. */
function borderRole(p) {
  if (p.type === 'bol') return 'bol';
  const r = defaultRole(p);
  if (r === 'structuur') return 'structuur';
  if (r === 'accent') return 'vuller';
  return p.h <= 40 ? 'bodem' : 'begeleider';
}

// ------------------------------------------------------------------ schalen naar de maat van het vak

/** Hoeveel soorten (zonder bollen) bij deze oppervlakte, naar het voorbeeld van kleine borders (1 × 3 m: 7 soorten). */
export function speciesFor(area) {
  if (!area) return 99;
  if (area < 2) return 4;
  if (area < 4) return 7;
  if (area < 8) return 9;
  if (area < 15) return 11;
  if (area < 30) return 14;
  return 99;
}

const bulbsFor = (area) => (!area ? 9 : area < 4 ? 2 : area < 15 ? 3 : 4);

/** Alle schema's, met de oude kant-en-klare combinaties van de app erbij. */
export function allBorders() {
  const legacy = COMBOS.map((c) => ({
    id: 'app_' + c.id, name: c.name, source: 'Tuinontwerp-app', kind: 'combo', light: c.light, soil: 'normaal', btype: c.btype,
    plants: c.items.map(([id, role, w]) => {
      const p = plantById(id);
      return { id, share: w, role: role === 'structuur' ? 'structuur' : role === 'accent' ? (p?.type === 'bol' ? 'bol' : 'vuller') : (p && p.h <= 40 ? 'bodem' : 'begeleider') };
    }),
  }));
  return [...BORDERS, ...legacy];
}

/**
 * Een schema voor dit vak: welke planten (opgezocht, eventueel vervangen), hoeveel soorten bij deze maat,
 * en hoe goed het past. ctx: { light, moisture, site, require, source, scheme, area }.
 * Geeft { items: [[plantId, appRole, w]], rows: [...], swaps: [[van, naar]], dropped, score, notes }.
 */
export function borderPlan(border, ctx = {}) {
  const area = ctx.area || 0;
  const used = new Set();
  const rows = [];
  // 1. opzoeken
  const entries = border.plants.map((e) => (typeof e === 'string' ? { lat: e } : e));
  const counted = entries.filter((e) => e.count && e.role !== 'bol').reduce((s, e) => s + e.count, 0);
  for (const e of entries) {
    let p = null, how = null;
    if (e.id) { p = plantById(e.id); how = p ? 'exact' : null; } else ({ p, how } = findByLat(e.lat, ctx));
    const role = e.role || (p ? borderRole(p) : 'begeleider');
    let share = e.share ?? (e.count && role !== 'bol' && counted ? (100 * e.count) / counted : null);
    rows.push({ name: e.lat || p?.lat || e.id, p, how, role, share, tender: !!e.tender || (e.lat && isTender(e.lat)) });
  }
  // standaardaandelen voor wat de bron niet gaf
  for (const [k, def] of Object.entries(BORDER_ROLES)) {
    const rs = rows.filter((r) => r.role === k && r.share == null);
    for (const r of rs) r.share = def.share / Math.max(1, rows.filter((x) => x.role === k).length);
  }
  // 2. kiezen bij de maat van het vak: alle structuur eerst (tot een derde), dan van elke rol de grootste, dan op aandeel
  const maxN = speciesFor(area);
  const plants = rows.filter((r) => r.role !== 'bol');
  const bulbs = rows.filter((r) => r.role === 'bol').slice(0, bulbsFor(area));
  const byShare = (a, b) => b.share - a.share;
  const chosen = [];
  const sMax = Math.max(1, Math.round(maxN * 0.4));
  // heesters nemen ruimte in: ongeveer één per 3 m² (in een heestervak meer); de wintergroene eerst
  const shrubMax = ctx.btype === 'heesters' ? 99 : Math.max(1, Math.floor((area || 99) / 3));
  const isShrub = (r) => ['heester', 'boom', 'haag'].includes(r.p?.type);
  let shrubs = 0;
  for (const r of plants.filter((x) => x.role === 'structuur').sort((a, b) => (isShrub(b) && !!b.p?.evergreen) - (isShrub(a) && !!a.p?.evergreen) || byShare(a, b))) {
    if (chosen.length >= sMax) break;
    if (isShrub(r) && shrubs >= shrubMax) continue;
    if (isShrub(r)) shrubs++;
    chosen.push(r);
  }
  for (const k of ['bodem', 'begeleider', 'vuller']) {
    const top = plants.filter((r) => r.role === k && !chosen.includes(r)).sort(byShare)[0];
    if (top && chosen.length < maxN) chosen.push(top);
  }
  for (const r of plants.filter((x) => !chosen.includes(x)).sort(byShare)) {
    if (chosen.length >= maxN || r.role === 'structuur') continue;
    if (isShrub(r)) { if (shrubs >= shrubMax) continue; shrubs++; }
    chosen.push(r);
  }
  const dropped = rows.filter((r) => r.role !== 'bol' && !chosen.includes(r)).map((r) => r.name);
  // 3. passend maken: wat niet op deze plek past (of niet te vinden is) vervangen
  const swaps = [], items = [], notes = [];
  let kept = 0;
  for (const r of [...chosen, ...bulbs]) {
    let p = r.p;
    const why = p ? siteMisfits(p, ctx, r.tender ? r.name : '') : ['niet in de plantendatabase'];
    if (p && (used.has(p.id) || why.length || r.how === 'geslacht')) {
      const alt = substitute(p, r.role, ctx, used);
      if (alt && alt.id !== p.id) { swaps.push([r.name, alt.lat || alt.nl, why[0] || (r.how === 'geslacht' ? 'niet te koop in deze cultivar' : 'dubbel')]); p = alt; } else if (used.has(p.id)) p = null;
    } else if (!p) {
      const alt = substitute(null, r.role, ctx, used);
      if (alt) { swaps.push([r.name, alt.lat || alt.nl, 'niet gevonden']); p = alt; }
    } else kept++;
    if (!p) continue;
    used.add(p.id);
    r.final = p;
    items.push([p.id, BORDER_ROLES[r.role].role, Math.max(1, Math.round(r.share * 10) / 10)]);
  }
  // 4. hoe goed past het schema hier?
  const total = chosen.length + bulbs.length;
  let score = total ? (kept / total) * 6 : 0;
  // rijker schema (zoveel soorten als bij deze maat past) telt mee
  score += Math.min(1, (items.length - bulbs.length) / Math.min(maxN, 8)) * 5;
  if (ctx.light && border.light && Math.abs(LIGHT_ORDER.indexOf(border.light) - LIGHT_ORDER.indexOf(ctx.light)) > 1) { score -= 4; notes.push(`bedoeld voor ${border.light === 'half' ? 'halfschaduw' : border.light}`); }
  if (ctx.moisture && border.soil && border.soil !== 'normaal' && border.soil !== ctx.moisture) { score -= 3; notes.push(`bedoeld voor ${SOIL_ADJ[border.soil]} grond`); }
  if (border.minArea && area && area < border.minArea) { score -= 3; notes.push(`bedoeld voor borders vanaf ${border.minArea} m²`); }
  if (ctx.scheme?.type && ctx.scheme.type !== 'vrij') {
    const off = items.map(([id]) => plantById(id)).filter((p) => p?.bloom?.length && p.form !== 'blad' && !inScheme(p.color, ctx.scheme));
    if (off.length) { score -= off.length; notes.push(`${off.length} buiten je kleurencombinatie`); }
  }
  if (ctx.btype && border.btype && border.btype !== ctx.btype) score -= 2;
  // past de hoogte bij het type vak?
  if (ctx.btype) {
    const high = items.map(([id]) => plantById(id)).filter((p) => p && p.type !== 'bol' && !fitsBedType(heightClass(p), ctx.btype, p.kind || p.type));
    if (high.length) { score -= high.length * 1.5; notes.push(`${high.length} past niet bij dit type vak`); }
  }
  if (border.source === 'Tuinontwerp-app') score -= 1; // erkende schema's eerst
  const atEsveld = items.filter(([id]) => plantById(id)?.esv).length;
  return { border, items, rows, swaps, dropped, score, notes, kept, total, atEsveld };
}

/** Alle schema's voor een vak, het best passende eerst. */
export function rankBorders(ctx = {}) {
  return allBorders().map((b) => borderPlan(b, ctx)).filter((x) => x.items.length >= 2).sort((a, b) => b.score - a.score || a.border.name.localeCompare(b.border.name, 'nl'));
}
