// Beplanting samenstellen en controleren voor een plantvak: hoogte (type vak), zon, grond, bloei door het jaar,
// afwisseling in bloeivorm, verdeling structuur / vulling / accent, iets voor de winter en het kleurenschema.

import { PLANTS, fitsBedType, heightClass, defaultRole, colorFamily, plantById } from './plantdb.js';
import { inScheme, ROLES } from './planting.js';

export const LIGHTS = { zon: 'Zon (6 uur of meer)', half: 'Halfschaduw (3 tot 6 uur)', schaduw: 'Schaduw (minder dan 3 uur)' };
export const MOISTURES = { droog: 'Droog', normaal: 'Normaal', vochtig: 'Vochtig' };
const SEASON = [3, 4, 5, 6, 7, 8, 9, 10, 11]; // maanden waarin je bloei verwacht (maart t/m november)

/** Standplaats bij een aantal zonuren per dag. */
export function lightFromHours(h) {
  return h >= 6 ? 'zon' : h >= 3 ? 'half' : 'schaduw';
}

/** Licht van een bouwsteen in de termen van de database (zon, half, schaduw). */
function roleLight(r) {
  const p = r.plant && plantById(r.plant);
  if (p) return p.light;
  return (r.light || ['zon', 'halfschaduw']).map((l) => (l === 'halfschaduw' ? 'half' : l));
}

function roleSoil(r) {
  const p = r.plant && plantById(r.plant);
  return p ? p.soil : null; // onbekend bij een eigen bouwsteen
}

function monthsText(ms) {
  const names = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return ms.map((m) => names[m - 1]).join(', ');
}

/**
 * Checklist voor een vak. entries: [{ role (bouwsteen), w }]. ctx: { btype, light, moisture, scheme }.
 * Geeft [{ key, label, ok, text }] (ok: true, false, of null als het niet te beoordelen is).
 */
export function checkPlanting(entries, ctx) {
  const items = entries.filter((e) => e.role);
  const out = [];
  if (!items.length) return out;
  const names = (list) => list.map((e) => e.role.label || e.role.code).join(', ');
  // hoogte
  const highLow = items.filter((e) => !fitsBedType(e.role.height, ctx.btype, e.role.kind));
  out.push({ key: 'hoogte', label: 'Hoogte', ok: ctx.btype ? !highLow.length : null, text: !ctx.btype ? 'type vak nog open' : highLow.length ? `te hoog of te laag: ${names(highLow)}` : 'past bij het type vak' });
  // zon
  const darkSun = ctx.light ? items.filter((e) => !roleLight(e.role).includes(ctx.light)) : [];
  out.push({ key: 'zon', label: 'Zon', ok: ctx.light ? !darkSun.length : null, text: !ctx.light ? 'standplaats nog onbekend' : darkSun.length ? `wil ${ctx.light === 'zon' ? 'minder zon' : 'meer zon'}: ${names(darkSun)}` : `alles kan tegen ${LIGHTS[ctx.light].split(' (')[0].toLowerCase()}` });
  // grond
  const wrongSoil = ctx.moisture ? items.filter((e) => { const s = roleSoil(e.role); return s && !s.includes(ctx.moisture); }) : [];
  out.push({ key: 'grond', label: 'Grond', ok: ctx.moisture ? !wrongSoil.length : null, text: !ctx.moisture ? 'grond nog onbekend' : wrongSoil.length ? `past niet bij ${ctx.moisture}e grond: ${names(wrongSoil)}` : `alles kan tegen ${ctx.moisture}e grond` });
  // bloei door het jaar
  const bloom = new Set(items.flatMap((e) => e.role.bloom || []));
  const gaps = SEASON.filter((m) => !bloom.has(m));
  const inner = gaps.filter((m) => m >= 4 && m <= 10);
  out.push({ key: 'bloei', label: 'Bloei', ok: inner.length === 0, text: inner.length ? `geen bloei in ${monthsText(inner)}` : `bloei van ${monthsText([Math.min(...[...bloom].filter((m) => SEASON.includes(m)))])} t/m ${monthsText([Math.max(...[...bloom].filter((m) => SEASON.includes(m)))])}` });
  // vormen
  const forms = new Set(items.map((e) => (e.role.kind === 'gras' ? 'gras' : e.role.form)).filter((f) => f && f !== 'blad'));
  // bodembedekkers en heesters hebben van nature minder verschillende bloeivormen
  const minForms = ['bodem', 'beloopbaar', 'heesters'].includes(ctx.btype) ? 2 : 3;
  out.push({ key: 'vormen', label: 'Vormen', ok: forms.size >= minForms, text: `${forms.size} bloeivorm${forms.size === 1 ? '' : 'en'}${forms.size < minForms ? ' (combineer bijv. aren met schermen of schijven)' : ''}` });
  // rolverdeling
  const tot = items.reduce((a, e) => a + (Number(e.w) || 0), 0) || 1;
  const share = (k) => items.filter((e) => e.role.role === k).reduce((a, e) => a + (Number(e.w) || 0), 0) / tot;
  const s = share('structuur'), v = share('vulling');
  out.push({ key: 'rollen', label: 'Opbouw', ok: s >= 0.15 && v >= 0.35, text: `structuur ${Math.round(s * 100)}%, vulling ${Math.round(v * 100)}%, accent ${Math.round(share('accent') * 100)}%` });
  // winter
  const winter = items.filter((e) => e.role.winter === 'silhouet' || e.role.winter === 'groen');
  out.push({ key: 'winter', label: 'Winter', ok: winter.length > 0, text: winter.length ? `blijft staan: ${names(winter)}` : 'in de winter is alles weg' });
  // kleurenschema
  if (ctx.scheme && ctx.scheme.type && ctx.scheme.type !== 'vrij') {
    const off = items.filter((e) => (e.role.bloom || []).length && e.role.form !== 'blad' && !inScheme(e.role.color, ctx.scheme));
    out.push({ key: 'kleur', label: 'Kleur', ok: !off.length, text: off.length ? `buiten het schema: ${names(off)}` : 'binnen het kleurenschema' });
  }
  return out;
}

// ---------------------------------------------------------------- samenstellen

function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Planten die (hard) passen bij het vak: hoogte, zon, grond en kleur. */
export function candidates(ctx) {
  const out = [];
  for (const p of PLANTS.values()) {
    if (['boom', 'haag', 'klimmer'].includes(p.type)) continue;
    if (ctx.btype === 'heesters' ? p.type !== 'heester' && p.type !== 'bol' : p.type === 'heester') continue;
    if (!fitsBedType(heightClass(p), ctx.btype, p.kind || p.type)) continue;
    if (ctx.light && !p.light.includes(ctx.light)) continue;
    if (ctx.moisture && !p.soil.includes(ctx.moisture)) continue;
    if (ctx.scheme && ctx.scheme.type !== 'vrij' && p.bloom.length && p.form !== 'blad' && !inScheme(p.color, ctx.scheme)) continue;
    out.push(p);
  }
  return out;
}

/** Plaatsen in een samenstelling per type vak: [rol, aantal]. */
function slotsFor(btype) {
  if (btype === 'bodem' || btype === 'beloopbaar') return [['vulling', 3], ['structuur', 1], ['accent', 1]];
  if (btype === 'heesters') return [['structuur', 2], ['vulling', 3], ['accent', 1]];
  return [['structuur', 2], ['vulling', 3], ['accent', 1]];
}

function fitsRole(p, role) {
  const d = defaultRole(p);
  if (role === 'accent') return p.type === 'bol' || d === 'accent';
  if (role === 'structuur') return d === 'structuur' || p.type === 'gras' || p.type === 'varen' || (p.habit === 'rechtop' && p.h >= 60) || p.evergreen;
  return d === 'vulling' || p.habit === 'kussen' || p.habit === 'spreidend' || p.habit === 'bol';
}

/**
 * Stel een beplanting samen voor een vak. ctx: { btype, light, moisture, scheme }. keep: plant-id's die blijven.
 * Geeft { items: [[plantId, rol, aandeel]], pool } (pool = aantal planten waaruit gekozen kon worden).
 */
export function compose(ctx, seed = 1, keep = []) {
  const r = rng(seed * 7919 + 13);
  const pool = candidates(ctx);
  const chosen = [];
  for (const id of keep) {
    const p = plantById(id);
    if (p) chosen.push({ p, role: defaultRole(p) });
  }
  const bloom = new Set(chosen.flatMap((c) => c.p.bloom));
  const forms = new Set(chosen.map((c) => (c.p.type === 'gras' ? 'gras' : c.p.form)));
  const fams = new Set(chosen.map((c) => colorFamily(c.p.color)));
  let winter = chosen.some((c) => c.p.winter !== 'weg');
  const need = Object.fromEntries(slotsFor(ctx.btype));
  for (const c of chosen) if (need[c.role] > 0) need[c.role]--;
  const order = [];
  for (const [role, n] of Object.entries(need)) for (let i = 0; i < n; i++) order.push(role);
  for (const role of order) {
    let best = null, bs = -Infinity;
    for (const p of pool) {
      if (chosen.some((c) => c.p.id === p.id)) continue;
      if (!fitsRole(p, role)) continue;
      let sc = 0;
      // bloei in maanden die nog leeg zijn (vooral april t/m oktober)
      for (const m of p.bloom) if (SEASON.includes(m) && !bloom.has(m)) sc += m >= 4 && m <= 10 ? 2.2 : 1.2;
      const f = p.type === 'gras' ? 'gras' : p.form;
      if (f !== 'blad' && !forms.has(f)) sc += 6; else if (f !== 'blad') sc -= 1.5;
      if (!winter && p.winter !== 'weg') sc += 2;
      const fam = colorFamily(p.color);
      if (p.bloom.length && fams.has(fam) && ctx.scheme?.type !== 'monochroom') sc -= 0.8;
      if (p.native) sc += 0.4;
      if (p.bees) sc += 0.4;
      if (role === 'structuur' && (p.type === 'gras' || p.winter === 'silhouet')) sc += 1;
      sc += r() * 2.2;
      if (sc > bs) { bs = sc; best = p; }
    }
    if (!best) continue;
    chosen.push({ p: best, role });
    for (const m of best.bloom) bloom.add(m);
    forms.add(best.type === 'gras' ? 'gras' : best.form);
    fams.add(colorFamily(best.color));
    if (best.winter !== 'weg') winter = true;
  }
  // gaten in de bloei (april t/m oktober)? Dan tot twee planten erbij die precies die maanden vullen
  for (let extra = 0; extra < 2; extra++) {
    const gaps = SEASON.filter((m) => m >= 4 && m <= 10 && !bloom.has(m));
    if (!gaps.length) break;
    let best = null, bs = 0, brole = 'vulling';
    for (const p of pool) {
      if (chosen.some((c) => c.p.id === p.id)) continue;
      const gain = p.bloom.filter((m) => gaps.includes(m)).length;
      if (!gain) continue;
      const role = fitsRole(p, 'vulling') ? 'vulling' : fitsRole(p, 'accent') ? 'accent' : fitsRole(p, 'structuur') ? 'structuur' : null;
      if (!role) continue;
      const sc = gain * 2 + (forms.has(p.type === 'gras' ? 'gras' : p.form) ? 0 : 1) + r();
      if (sc > bs) { bs = sc; best = p; brole = role; }
    }
    if (!best) break;
    chosen.push({ p: best, role: brole });
    for (const m of best.bloom) bloom.add(m);
    forms.add(best.type === 'gras' ? 'gras' : best.form);
  }
  // aandelen: structuur 30%, vulling 60%, accent 10%, verdeeld over de planten in die rol
  const count = (role) => chosen.filter((c) => c.role === role).length || 1;
  const total = { structuur: 30, vulling: 60, accent: 10 };
  const items = chosen.map((c) => [c.p.id, c.role, Math.max(5, Math.round(total[c.role] / count(c.role) / 5) * 5)]);
  return { items, pool: pool.length };
}

/**
 * Een vaste combinatie aanpassen aan het vak: planten die niet tegen de zon of grond kunnen, of buiten het
 * kleurenschema vallen, worden vervangen door een plant met dezelfde rol en zo mogelijk dezelfde bloeivorm.
 */
export function adaptItems(items, ctx) {
  const pool = candidates(ctx);
  const used = new Set(items.map(([id]) => id));
  const swaps = [];
  const out = items.map(([id, role, w]) => {
    const p = plantById(id);
    if (!p || pool.some((q) => q.id === id)) return [id, role, w];
    const alt = pool.filter((q) => !used.has(q.id) && fitsRole(q, role))
      .sort((a, b) => (b.form === p.form) - (a.form === p.form) || (b.type === p.type) - (a.type === p.type) || Math.abs(a.h - p.h) - Math.abs(b.h - p.h))[0];
    if (!alt) return [id, role, w];
    used.add(alt.id);
    swaps.push([p.nl, alt.nl]);
    return [alt.id, role, w];
  });
  return { items: out, swaps };
}

export { ROLES };
