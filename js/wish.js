// Wensvakjes (werkwijze Elisabeth Scholt, Bloemenpark Appeltern): teken in een border kleine organische
// vakjes van 0,5 tot 1,5 m² met alleen wat je daar wilt (soort, hoogte, kleur, seizoen). Daarna kies je per
// vakje een plant, in de volgorde van de beplantingspiramide: eerst de grote planten, dan de kleinere.
//
// Een wensvakje is een groep (group: true, bedId) met wish: { layer, height, color, seasons } en een lege
// mix zolang er nog geen plant gekozen is.

import { PYRAMID, HEIGHTS, HEIGHT_ORDER, plantLayer, roleLayer, layerIndex, inScheme } from './planting.js';
import { PLANTS, heightClass, colorFamily } from './plantdb.js';

export const WISH_COLORS = {
  wit: { name: 'Wit', hex: '#f1eee4' },
  geel: { name: 'Geel', hex: '#f2d04a' },
  oranje: { name: 'Oranje', hex: '#e8893a' },
  rood: { name: 'Rood', hex: '#c8383a' },
  roze: { name: 'Roze', hex: '#e48ab8' },
  paars: { name: 'Paars', hex: '#8e5bb5' },
  blauw: { name: 'Blauw', hex: '#5a7ad8' },
  blad: { name: 'Blad (geen bloei)', hex: '#7a9a5a' },
};

export const SEASONS = {
  lente: { name: 'Lente', short: 'L', months: [3, 4, 5] },
  zomer: { name: 'Zomer', short: 'Z', months: [6, 7, 8] },
  herfst: { name: 'Herfst', short: 'H', months: [9, 10, 11] },
  winter: { name: 'Winter', short: 'W', months: [12, 1, 2] },
};

export const WISH_SIZES = [0.5, 1, 1.5];

/** Hoogtes die bij een laag van de piramide horen (de eerste is de standaard). */
export const LAYER_HEIGHTS = {
  bomen: ['xhoog'],
  heesters: ['hoog', 'xhoog', 'middel'],
  vaste: ['middel', 'laag', 'hoog', 'bodem'],
  bollen: ['laag', 'middel', 'bodem', 'hoog'],
  klim: ['bodem', 'laag'],
};

export function defaultWish() {
  return { layer: 'vaste', height: 'middel', color: '', seasons: [] };
}

/** Wens opschonen: hoogte die bij de laag past, bekende kleur en seizoenen. */
export function normalizeWish(w) {
  const out = { ...defaultWish(), ...(w || {}) };
  if (!PYRAMID.some((l) => l.key === out.layer)) out.layer = 'vaste';
  const hs = LAYER_HEIGHTS[out.layer];
  if (!hs.includes(out.height)) out.height = hs[0];
  if (out.color && !WISH_COLORS[out.color]) out.color = '';
  out.seasons = (out.seasons || []).filter((s) => SEASONS[s]);
  return out;
}

/** In welke seizoenen heeft een plant (of bouwsteen) iets te bieden? */
export function plantSeasons(p) {
  const b = p.bloom || [];
  const has = (ms) => b.some((m) => ms.includes(m));
  const out = new Set();
  if (has(SEASONS.lente.months)) out.add('lente');
  if (has(SEASONS.zomer.months)) out.add('zomer');
  if (has(SEASONS.herfst.months) || (p.autumn && p.autumn !== 'geen')) out.add('herfst');
  if (has(SEASONS.winter.months) || p.winter === 'groen' || p.winter === 'silhouet' || p.evergreen) out.add('winter');
  return out;
}

/** Korte omschrijving: "Vaste plant · 60–120 cm · roze · zomer". */
export function wishText(w, short = false) {
  w = normalizeWish(w);
  const layer = PYRAMID.find((l) => l.key === w.layer);
  const h = HEIGHTS[w.height];
  const parts = short
    ? [h ? h.range : '', w.color ? WISH_COLORS[w.color].name.split(' ')[0].toLowerCase() : '', w.seasons.map((s) => SEASONS[s].short).join('')]
    : [layer?.wish, h ? h.range : '', w.color ? WISH_COLORS[w.color].name.toLowerCase() : '', w.seasons.map((s) => SEASONS[s].name.toLowerCase()).join(', ')];
  return parts.filter(Boolean).join(' · ');
}

export function wishHex(w) {
  return (w?.color && WISH_COLORS[w.color]?.hex) || '#b9a77f';
}

export function isWish(it) {
  return it?.type === 'shape' && !!it.group && !!it.wish;
}

/** Laag (index in de piramide) van een groep: van de gekozen plant, anders van de wens. */
export function groupLayerIndex(gr, roles) {
  const mix = (gr.planting?.mix || []).filter((m) => roles[m.role]);
  if (mix.length) return Math.min(...mix.map((m) => layerIndex(roleLayer(roles[m.role]))));
  return layerIndex(gr.wish ? normalizeWish(gr.wish).layer : 'vaste');
}

/** Wensvakjes in de volgorde van de piramide: grote planten eerst, daarna in de volgorde van tekenen. */
export function wishOrder(groups) {
  const hi = (w) => HEIGHT_ORDER.indexOf(normalizeWish(w).height);
  return groups.filter(isWish).map((g, i) => ({ g, i })).sort((a, b) => {
    const wa = normalizeWish(a.g.wish), wb = normalizeWish(b.g.wish);
    return layerIndex(wa.layer) - layerIndex(wb.layer) || hi(b.g.wish) - hi(a.g.wish) || a.i - b.i;
  }).map((x) => x.g);
}

/**
 * Planten die bij een wens passen, met een score en de redenen. ctx: { light, moisture, scheme, used: Set(plant-id) }.
 * Hard: laag van de piramide, standplaats, grond en hoogte (hooguit één klasse ernaast).
 * Zacht: kleur, seizoenen, kleurenschema, herhaling (plant komt al voor in de tuin).
 * Geeft { list: [{ p, score, good: [], bad: [] }], excluded: { light, moisture } }.
 */
export function wishCandidates(wish, ctx = {}) {
  const w = normalizeWish(wish);
  const want = HEIGHT_ORDER.indexOf(w.height);
  const list = [];
  const excluded = { light: 0, moisture: 0 };
  for (const p of PLANTS.values()) {
    if (plantLayer(p) !== w.layer) continue;
    if (ctx.source === 'esveld' && !p.esv) continue;
    const hc = HEIGHT_ORDER.indexOf(heightClass(p));
    const dh = Math.abs(hc - want);
    if (dh > 1) continue;
    if (ctx.light && !p.light.includes(ctx.light)) { excluded.light++; continue; }
    if (ctx.moisture && !p.soil.includes(ctx.moisture)) { excluded.moisture++; continue; }
    let score = dh === 0 ? 3 : 1;
    const good = [], bad = [];
    if (dh) bad.push(hc > want ? 'iets hoger' : 'iets lager');
    if (w.color === 'blad') {
      if (p.form === 'blad' || !p.bloom.length) { score += 3; good.push('bladplant'); } else if (p.foliage && p.foliage !== 'groen') { score += 2; good.push(`${p.foliage} blad`); } else { score -= 1; bad.push('bloeit opvallend'); }
    } else if (w.color) {
      const fam = p.bloom.length && p.form !== 'blad' ? colorFamily(p.color) : null;
      if (fam === w.color) { score += 3; good.push(WISH_COLORS[w.color].name.toLowerCase()); } else { score -= 3; bad.push(fam ? `bloeit ${fam}` : 'geen opvallende bloei'); }
    }
    const ps = plantSeasons(p);
    for (const s of w.seasons) {
      if (ps.has(s)) { score += 2; good.push(SEASONS[s].name.toLowerCase()); } else { score -= 1.5; bad.push(`niets in de ${SEASONS[s].name.toLowerCase()}`); }
    }
    // meer seizoenen is meer waard, zeker in een kleine tuin
    score += Math.max(0, ps.size - 1) * 0.3;
    if (ctx.scheme && ctx.scheme.type && ctx.scheme.type !== 'vrij' && p.bloom.length && p.form !== 'blad' && !inScheme(p.color, ctx.scheme)) { score -= 1; bad.push('buiten kleurenschema'); }
    if (ctx.used?.has(p.id)) { score += 1; good.push('komt al terug in de tuin'); }
    list.push({ p, score, good, bad });
  }
  list.sort((a, b) => b.score - a.score || a.p.nl.localeCompare(b.p.nl, 'nl'));
  return { list, excluded };
}

// ---------------------------------------------------------------- invoer (paneel en optiebalk)

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Keuzes voor een wens: soort, hoogte, kleur, seizoenen en (optioneel) de grootte van een nieuw vakje. */
export function wishControlsHtml(wish, { size = null } = {}) {
  const w = normalizeWish(wish);
  const opt = (pairs, cur) => pairs.map(([k, n]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${escH(n)}</option>`).join('');
  return `<div class="wishctl">
    <select data-wl title="Wat voor plant (laag van de beplantingspiramide)">${opt(PYRAMID.map((l) => [l.key, l.wish]), w.layer)}</select>
    <select data-wh title="Hoe hoog">${opt(LAYER_HEIGHTS[w.layer].map((h) => [h, `${HEIGHTS[h].name} (${HEIGHTS[h].range})`]), w.height)}</select>
    <select data-wc title="Bloeikleur (of juist blad)">${opt([['', 'Kleur: geen voorkeur'], ...Object.entries(WISH_COLORS).map(([k, v]) => [k, v.name])], w.color)}</select>
    <span class="seg" title="Wanneer moet het mooi zijn?">${Object.entries(SEASONS).map(([k, v]) => `<button type="button" data-ws="${k}" class="${w.seasons.includes(k) ? 'on' : ''}">${v.name}</button>`).join('')}</span>
    ${size != null ? `<span class="seg" title="Grootte van een nieuw vakje als je tikt (slepen = eigen vorm)">${WISH_SIZES.map((a) => `<button type="button" data-wsize="${a}" class="${size === a ? 'on' : ''}">${String(a).replace('.', ',')} m²</button>`).join('')}</span>` : ''}
  </div>`;
}

/** Keuzes koppelen. onChange(wish) bij een andere wens, onSize(m²) bij een andere grootte. */
export function bindWishControls(root, wish, onChange, onSize = null) {
  let w = normalizeWish(wish);
  const set = (patch) => { w = normalizeWish({ ...w, ...patch }); onChange(w); };
  root.querySelector('[data-wl]')?.addEventListener('change', (e) => set({ layer: e.target.value, height: LAYER_HEIGHTS[e.target.value][0] }));
  root.querySelector('[data-wh]')?.addEventListener('change', (e) => set({ height: e.target.value }));
  root.querySelector('[data-wc]')?.addEventListener('change', (e) => set({ color: e.target.value }));
  for (const b of root.querySelectorAll('[data-ws]')) {
    b.addEventListener('click', () => {
      const s = b.dataset.ws;
      set({ seasons: w.seasons.includes(s) ? w.seasons.filter((x) => x !== s) : [...w.seasons, s] });
    });
  }
  for (const b of root.querySelectorAll('[data-wsize]')) b.addEventListener('click', () => onSize?.(Number(b.dataset.wsize)));
}
