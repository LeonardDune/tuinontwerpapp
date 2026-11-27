// Controles per plantvak (Scholt stap 13, Studio Ferm stap 6): de 4 momenten (februari, mei, augustus,
// november), groene soep (buren die te veel op elkaar lijken), structuur, functies, eisen en onderhoud.

import { plantById } from './plantdb.js';
import { plantTraits, TRAITS, BED_FUNCTIONS } from './traits.js';
import { monthState, roleAreas, rolesMap, HEIGHTS, HABITS, FORMS, isBed, shapePolygon } from './planting.js';
import { polygonArea } from './geom.js';

export const MOMENTS = [
  { m: 2, name: 'februari', look: 'structuur: groenblijvers, grassen, zaadhoofden' },
  { m: 5, name: 'mei', look: 'fris blad en de eerste bloei' },
  { m: 8, name: 'augustus', look: 'hoogte, kleur en afwisseling in blad' },
  { m: 11, name: 'november', look: 'vormen, herfstkleur, grassen en zaadhoofden' },
];

export const STRUCTURE_LEVELS = { weinig: { name: 'Weinig', min: 0.1 }, gemiddeld: { name: 'Gemiddeld', min: 0.25 }, veel: { name: 'Veel', min: 0.4 } };
export const MAINTENANCE = { laag: 'Weinig werk', gemiddeld: 'Gemiddeld', hoog: 'Mag veel werk' };

const KIND_TYPE = { gras: 'gras', varen: 'varen', bol: 'bol', bodem: 'bodem', heester: 'heester', haag: 'haag', boom: 'boom', klimmer: 'klimmer' };

/** De plant achter een bouwsteen (uit de database), of een plant opgebouwd uit de eigenschappen van de bouwsteen. */
export function rolePlant(r) {
  const p = r.plant && plantById(r.plant);
  if (p) return p;
  return {
    lat: r.label || '', nl: r.label || r.code, type: KIND_TYPE[r.kind] || 'vaste', h: (HEIGHTS[r.height]?.h || 0.5) * 100, w: (r.d || 0.5) * 100,
    habit: r.habit, form: r.form, color: r.color, bloom: r.bloom || [], foliage: r.foliage, autumn: r.autumn, winter: r.winter, evergreen: r.winter === 'groen',
  };
}

const nameOf = (r) => r.label || r.code;

/** Hoe verschillend zijn twee planten? Geeft { score, same: [overeenkomsten] }. */
export function contrast(a, b) {
  const pa = rolePlant(a), pb = rolePlant(b);
  const fa = pa.facts || {}, fb = pb.facts || {};
  const same = [];
  let score = 0;
  if (a.habit && a.habit === b.habit) same.push(`groeivorm (${HABITS[a.habit]?.name.split(' /')[0].toLowerCase()})`); else score += 1;
  if (a.form && a.form === b.form) same.push(`bloeivorm (${FORMS[a.form]?.name.split(' /')[0].toLowerCase()})`); else score += 1;
  if (fa.lf && fb.lf) { if (fa.lf === fb.lf) same.push(`bladvorm (${fa.lf})`); else score += 1; }
  if (fa.lz && fb.lz) { const q = Math.max(fa.lz, fb.lz) / Math.max(0.5, Math.min(fa.lz, fb.lz)); if (q < 2) same.push('bladgrootte'); else score += 1; }
  if ((a.foliage || 'groen') === (b.foliage || 'groen')) same.push(`bladkleur (${a.foliage || 'groen'})`); else score += 1.5;
  return { score, same };
}

/**
 * Alle controles voor een plantvak. aims: { seasons, structure, maintenance, functions }, require: [eisen].
 * Geeft [{ key, label, ok (true|false|null), text }].
 */
export function bedChecks(doc, bed) {
  const roles = rolesMap(doc);
  const areas = roleAreas(doc, bed.id);
  const ids = Object.keys(areas).filter((id) => roles[id] && areas[id] > 0);
  const total = ids.reduce((s, id) => s + areas[id], 0);
  const aims = bed.aims || {};
  const out = [];
  if (!ids.length) return out;
  // de 4 momenten
  for (const mo of MOMENTS) {
    let score = 0;
    const seen = [];
    for (const id of ids) {
      const st = monthState(roles[id], mo.m);
      score += (areas[id] / total) * st.interest;
      if (st.kind !== 'weg' && st.interest >= 0.4) seen.push({ n: nameOf(roles[id]), k: st.kind, a: areas[id] * st.interest });
    }
    seen.sort((x, y) => y.a - x.a);
    const kinds = { bloei: 'bloeit', herfst: 'herfstkleur', wintergroen: 'groen', silhouet: 'silhouet', blad: 'blad' };
    const ok = score >= 0.35;
    out.push({ key: `m${mo.m}`, label: mo.name[0].toUpperCase() + mo.name.slice(1), ok, text: seen.length ? `${ok ? '' : 'weinig te zien. '}${seen.slice(0, 3).map((x) => `${x.n} (${kinds[x.k] || x.k})`).join(', ')}` : `bijna niets te zien; kijk naar ${mo.look}` });
  }
  // structuur
  const structShare = ids.filter((id) => roles[id].role === 'structuur' || plantTraits(rolePlant(roles[id])).has('structuur')).reduce((s, id) => s + areas[id], 0) / total;
  const want = STRUCTURE_LEVELS[aims.structure || 'gemiddeld'];
  out.push({ key: 'structuur', label: 'Structuur', ok: structShare >= want.min, text: `${Math.round(structShare * 100)}% structuurplanten${structShare < want.min ? ` (je wilt ${want.name.toLowerCase()}: minstens ${Math.round(want.min * 100)}%)` : ''}` });
  // groene soep: planten die naast elkaar staan en te veel op elkaar lijken
  const top = ids.sort((x, y) => areas[y] - areas[x]).slice(0, 10);
  const soup = [];
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const c = contrast(roles[top[i]], roles[top[j]]);
      if (c.score <= 1) soup.push({ a: nameOf(roles[top[i]]), b: nameOf(roles[top[j]]), same: c.same, w: areas[top[i]] + areas[top[j]] });
    }
  }
  soup.sort((x, y) => y.w - x.w);
  out.push({ key: 'soep', label: 'Groene soep', ok: !soup.length, text: soup.length ? soup.slice(0, 2).map((x) => `${x.a} en ${x.b} lijken op elkaar (zelfde ${x.same.slice(0, 2).join(', ')})`).join('; ') + '. Zet er een plant met ander blad of een andere vorm tussen.' : 'genoeg verschil in vorm en blad' });
  // functies
  for (const fn of aims.functions || []) {
    const def = BED_FUNCTIONS[fn];
    if (!def) continue;
    const fits = (id) => { const t = plantTraits(rolePlant(roles[id])); return def.all ? def.traits.every((k) => t.has(k)) : def.traits.some((k) => t.has(k)); };
    const has = ids.filter(fits).map((id) => nameOf(roles[id]));
    out.push({ key: `f-${fn}`, label: def.name, ok: has.length > 0, text: has.length ? `door ${has.slice(0, 3).join(', ')}` : `nog geen plant die dit doet: ${def.hint}` });
  }
  // eisen van het vak
  if (bed.require?.length) {
    const off = ids.filter((id) => !bed.require.every((k) => plantTraits(rolePlant(roles[id])).has(k))).map((id) => nameOf(roles[id]));
    out.push({ key: 'eisen', label: 'Eisen', ok: !off.length, text: off.length ? `voldoet niet (${bed.require.map((k) => TRAITS[k].short).join(', ')}): ${off.join(', ')}` : `alles is ${bed.require.map((k) => TRAITS[k].short).join(', ')}` });
  }
  // onderhoud
  if (aims.maintenance === 'laag') {
    const work = ids.filter((id) => { const p = rolePlant(roles[id]); return p.facts?.k?.includes('woek') || /matig|niet|subtrop/.test(p.esv?.hard || ''); }).map((id) => nameOf(roles[id]));
    out.push({ key: 'onderhoud', label: 'Onderhoud', ok: !work.length, text: work.length ? `geeft werk (woekert of kwetsbaar in de winter): ${work.join(', ')}` : 'geen woekeraars of kwetsbare planten' });
  }
  return out;
}

/**
 * Balans in de hele tuin (Scholt: "minimaal 2/3 groen, waarvan de helft hoger dan 90 cm").
 * Groen = plantvakken, gazon en groen vlak, en kronen van bomen buiten de vakken; verhard = bestrating,
 * halfverharding en hout op de grond. Gebouwen en water tellen niet mee.
 * Geeft { green, paved, share, highShare } (oppervlakken in m²) of null als er nog niets getekend is.
 */
export function gardenBalance(doc, hatches) {
  let green = 0, paved = 0, high = 0;
  const roles = rolesMap(doc);
  const area = (it) => Math.abs(polygonArea(shapePolygon(it)));
  for (const l of doc.layers) {
    if (!l.visible) continue;
    for (const it of l.items) {
      if (it.type === 'shape' && !it.wall && !it.group && (it.kind === 'polygon' || it.kind === 'circle') && (it.points?.length || 0) >= (it.kind === 'circle' ? 2 : 3)) {
        if (isBed(it)) { green += area(it); continue; }
        if ((it.height || 0) > 0) continue;
        const grp = it.hatch === 'bond' ? 'Bestrating' : hatches[it.hatch]?.group;
        if (grp === 'Bestrating' || grp === 'Halfverharding' || grp === 'Hout') paved += area(it);
        else if (it.hatch === 'gras' || it.hatch === 'beplanting' || it.hatch === 'sedum') green += area(it);
      }
    }
  }
  // hoog groen: planten in de vakken die hoger worden dan 90 cm, en bomen en heesters (kroon)
  const areas = roleAreas(doc);
  for (const [id, a] of Object.entries(areas)) {
    const r = roles[id];
    if (!r) continue;
    const p = r.plant && plantById(r.plant);
    const h = p?.h ? p.h / 100 : HEIGHTS[r.height]?.h || 0;
    if (h > 0.9) high += a;
  }
  if (!green && !paved) return null;
  const total = green + paved;
  return { green, paved, share: green / total, high, highShare: green ? Math.min(1, high / green) : 0 };
}
