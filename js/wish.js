// Wensvakjes (werkwijze Elisabeth Scholt, Bloemenpark Appeltern): teken in een border kleine organische
// vakjes van 0,5 tot 1,5 m² met alleen wat je daar wilt (soort, hoogte, kleur, seizoen). Daarna kies je per
// vakje een plant, in de volgorde van de beplantingspiramide: eerst de grote planten, dan de kleinere.
//
// Een wensvakje is een groep (group: true, bedId) met wish: { layer, height, color, seasons } en een lege
// mix zolang er nog geen plant gekozen is.

import { PYRAMID, HEIGHTS, HEIGHT_ORDER, plantLayer, roleLayer, layerIndex, inScheme, hexToHsl } from './planting.js';
import { PLANTS, heightClass, colorFamily } from './plantdb.js';
import { meetsAll, plantTraits, TRAITS, FUNCTIONS } from './traits.js';
import { lightFits, siteProblems } from './site.js';

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
  return { layer: 'vaste', height: 'middel', color: '', seasons: [], role: '', fn: '' };
}

/** Rol van een wens in de border (Studio Ferm: structuur, blad, bloei; plus weefplant). */
export const WISH_ROLES = {
  structuur: { name: 'Structuur en hoogte', hint: 'het skelet: groenblijvend, siergras of stevige stengels die in de winter blijven staan' },
  blad: { name: 'Blad', hint: 'mooi of opvallend blad: vorm, grootte of kleur' },
  bloei: { name: 'Kleur en bloei', hint: 'bloei als seizoensaccent' },
  weef: { name: 'Weefplant', hint: 'luchtig, weeft zich tussen de andere planten door' },
};

/** Wens opschonen: hoogte die bij de laag past, bekende kleur en seizoenen. */
export function normalizeWish(w) {
  const out = { ...defaultWish(), ...(w || {}) };
  if (!PYRAMID.some((l) => l.key === out.layer)) out.layer = 'vaste';
  const hs = LAYER_HEIGHTS[out.layer];
  if (!hs.includes(out.height)) out.height = hs[0];
  // kleur: een familie (roze, blauw …), 'blad', of een precieze kleur uit de kleurencombinatie (#rrggbb)
  if (out.color && !WISH_COLORS[out.color] && !isHex(out.color)) out.color = '';
  out.seasons = (out.seasons || []).filter((s) => SEASONS[s]);
  if (out.role && !WISH_ROLES[out.role]) out.role = '';
  if (out.fn && !TRAITS[out.fn]) out.fn = '';
  return out;
}

const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');

/** Naam van een gewenste kleur: familie, of de familie van een precieze kleur ('roze (uit de combinatie)'). */
export function wishColorName(c) {
  if (!c) return '';
  if (WISH_COLORS[c]) return WISH_COLORS[c].name.toLowerCase();
  return isHex(c) ? colorFamily(c) : '';
}

/** Lijkt een bloeikleur op de gewenste precieze kleur? (zelfde tint, of allebei wit/crème) */
export function colorMatches(color, want) {
  if (!color || !want) return false;
  const [h, s, l] = hexToHsl(color), [wh, ws, wl] = hexToHsl(want);
  const pale = (sat, lig) => sat < 0.18 || lig > 0.88;
  if (pale(ws, wl) || pale(s, l)) return pale(ws, wl) && pale(s, l);
  const d = Math.abs(((h - wh + 540) % 360) - 180);
  return d < 24 && Math.abs(l - wl) < 0.35;
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
    ? [h ? h.range : '', wishColorName(w.color).split(' ')[0], w.seasons.map((s) => SEASONS[s].short).join('')]
    : [layer?.wish, w.role ? WISH_ROLES[w.role].name.toLowerCase() : '', h ? h.range : '', wishColorName(w.color), w.seasons.map((s) => SEASONS[s].name.toLowerCase()).join(', '), w.fn ? TRAITS[w.fn].short : ''];
  return parts.filter(Boolean).join(' · ');
}

export function wishHex(w) {
  if (isHex(w?.color)) return w.color;
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
    if (ctx.require?.length && !meetsAll(p, ctx.require)) continue;
    const hc = HEIGHT_ORDER.indexOf(heightClass(p));
    const dh = Math.abs(hc - want);
    if (dh > 1) continue;
    if (ctx.light && !lightFits(p.light, ctx.light)) { excluded.light++; continue; }
    if (ctx.moisture && !p.soil.includes(ctx.moisture)) { excluded.moisture++; continue; }
    let score = dh === 0 ? 3 : 1;
    const good = [], bad = [];
    if (dh) bad.push(hc > want ? 'iets hoger' : 'iets lager');
    if (w.color === 'blad') {
      if (p.form === 'blad' || !p.bloom.length) { score += 3; good.push('bladplant'); } else if (p.foliage && p.foliage !== 'groen') { score += 2; good.push(`${p.foliage} blad`); } else { score -= 1; bad.push('bloeit opvallend'); }
    } else if (w.color) {
      const blooms = p.bloom.length && p.form !== 'blad';
      const fam = blooms ? colorFamily(p.color) : null;
      const ok = isHex(w.color) ? blooms && colorMatches(p.color, w.color) : fam === w.color;
      if (ok) { score += 3; good.push(isHex(w.color) ? `${fam}, als gekozen` : WISH_COLORS[w.color].name.toLowerCase()); } else { score -= 3; bad.push(fam ? `bloeit ${fam}` : 'geen opvallende bloei'); }
    }
    const ps = plantSeasons(p);
    for (const s of w.seasons) {
      if (ps.has(s)) { score += 2; good.push(SEASONS[s].name.toLowerCase()); } else { score -= 1.5; bad.push(`niets in de ${SEASONS[s].name.toLowerCase()}`); }
    }
    // meer seizoenen is meer waard, zeker in een kleine tuin
    score += Math.max(0, ps.size - 1) * 0.3;
    // grondsoort, zuurgraad en ligging van het vak
    for (const why of ctx.site ? siteProblems(p, ctx.site) : []) { score -= 3; bad.push(why); }
    // rol en functie van de wens
    const tr = plantTraits(p);
    if (w.role === 'structuur') { if (tr.has('structuur')) { score += 3; good.push(tr.get('structuur')); } else { score -= 2; bad.push('geen structuurplant'); } }
    else if (w.role === 'blad') { const leafy = p.form === 'blad' || (p.foliage && p.foliage !== 'groen') || (p.facts?.lz || 0) >= 10 || ['gelobd', 'samengesteld', 'rond', 'gestekeld'].includes(p.facts?.lf); if (leafy) { score += 2; good.push('opvallend blad'); } else score -= 1; }
    else if (w.role === 'bloei') { if (p.bloom.length && p.form !== 'blad') score += 1.5; else { score -= 2; bad.push('geen opvallende bloei'); } }
    else if (w.role === 'weef') { if (tr.has('weef')) { score += 3; good.push('weefplant'); } else score -= 1; }
    if (w.fn) { if (tr.has(w.fn)) { score += 3; good.push(`${TRAITS[w.fn].short}: ${tr.get(w.fn)}`); } else { score -= 2.5; bad.push(`niet ${TRAITS[w.fn].short}`); } }
    // onderhoud: weinig werk = geen woekeraars of kwetsbare planten
    if (ctx.maintenance === 'laag') {
      if (p.facts?.k?.includes('woek')) { score -= 2; bad.push('woekert'); }
      if (/matig|niet|subtrop/.test(p.esv?.hard || '')) { score -= 1.5; bad.push(p.esv.hard); }
      if (tr.has('wintergroen') || p.type === 'heester') score += 0.5;
    }
    if (ctx.scheme && ctx.scheme.type && ctx.scheme.type !== 'vrij' && p.bloom.length && p.form !== 'blad' && !inScheme(p.color, ctx.scheme)) { score -= 1; bad.push('buiten kleurenschema'); }
    if (ctx.used?.has(p.id)) { score += 1; good.push('komt al terug in de tuin'); }
    list.push({ p, score, good, bad });
  }
  list.sort((a, b) => b.score - a.score || a.p.nl.localeCompare(b.p.nl, 'nl'));
  return { list, excluded };
}

// ---------------------------------------------------------------- invoer (paneel en optiebalk)

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Keuzes voor een wens: soort, hoogte, kleur, seizoenen en (optioneel) de grootte van een nieuw vakje.
 * palette: de kleuren van de kleurencombinatie van het vak; die staan voorop, 'Andere kleur…' wijkt ervan af.
 */
export function wishControlsHtml(wish, { size = null, palette = null, schemeName = '', functions = null } = {}) {
  const w = normalizeWish(wish);
  const opt = (pairs, cur) => pairs.map(([k, n]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${escH(n)}</option>`).join('');
  const pal = palette && palette.length ? palette : Object.entries(WISH_COLORS).filter(([k]) => k !== 'blad').map(([, v]) => v.hex);
  const famHex = Object.fromEntries(Object.entries(WISH_COLORS).map(([k, v]) => [k, v.hex]));
  const inPal = !w.color || w.color === 'blad' || pal.some((c) => c.toLowerCase() === (famHex[w.color] || w.color).toLowerCase());
  const chip = (val, inner, title, on) => `<button type="button" class="wc${on ? ' on' : ''}" data-wcol="${val}" title="${escH(title)}">${inner}</button>`;
  const colors = `<div class="wcolors" title="${palette ? `Kleuren uit de kleurencombinatie${schemeName ? ` (${escH(schemeName)})` : ''}` : 'Bloeikleur'}">
      ${chip('', 'Geen voorkeur', 'Geen voorkeur voor de kleur', !w.color)}
      ${pal.map((c) => {
        const fam = palette ? c : Object.keys(famHex).find((k) => famHex[k] === c);
        return chip(fam, `<i style="background:${c}"></i>`, palette ? `${colorFamily(c)} (uit de combinatie)` : WISH_COLORS[fam].name, w.color && (famHex[w.color] || w.color).toLowerCase() === c.toLowerCase());
      }).join('')}
      ${chip('blad', 'Blad', 'Geen opvallende bloei: een bladplant', w.color === 'blad')}
      ${palette ? chip('meer', 'Andere kleur…', 'Afwijken van de kleurencombinatie', !inPal) : ''}
    </div>
    ${palette ? `<select data-wc title="Een kleur buiten de combinatie" ${inPal ? 'hidden' : ''}>${opt([['', 'Kies een andere kleur'], ...Object.entries(WISH_COLORS).filter(([k]) => k !== 'blad').map(([k, v]) => [k, v.name])], inPal ? '' : w.color)}</select>` : ''}`;
  return `<div class="wishctl">
    <select data-wl title="Wat voor plant (laag van de beplantingspiramide)">${opt(PYRAMID.map((l) => [l.key, l.wish]), w.layer)}</select>
    <select data-wh title="Hoe hoog">${opt(LAYER_HEIGHTS[w.layer].map((h) => [h, `${HEIGHTS[h].name} (${HEIGHTS[h].range})`]), w.height)}</select>
    <select data-wr title="Welke rol heeft de plant hier?">${opt([['', 'Rol: geen voorkeur'], ...Object.entries(WISH_ROLES).map(([k, v]) => [k, v.name])], w.role)}</select>
    <select data-wf title="Welke eigenschap moet de plant hier hebben?">${opt([['', 'Eigenschap: geen voorkeur'], ...(functions?.length ? functions.map((k) => [k, `★ ${TRAITS[k].name}`]) : []), ...FUNCTIONS.filter((k) => !functions?.includes(k)).map((k) => [k, TRAITS[k].name])], w.fn)}</select>
    ${colors}
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
  root.querySelector('[data-wr]')?.addEventListener('change', (e) => set({ role: e.target.value }));
  root.querySelector('[data-wf]')?.addEventListener('change', (e) => set({ fn: e.target.value }));
  root.querySelector('[data-wc]')?.addEventListener('change', (e) => { if (e.target.value) set({ color: e.target.value }); });
  for (const b of root.querySelectorAll('[data-wcol]')) {
    b.addEventListener('click', () => {
      if (b.dataset.wcol === 'meer') {
        const sel = root.querySelector('[data-wc]');
        if (sel) { sel.hidden = false; sel.focus(); }
        b.classList.add('on');
        return;
      }
      set({ color: b.dataset.wcol });
    });
  }
  for (const b of root.querySelectorAll('[data-ws]')) {
    b.addEventListener('click', () => {
      const s = b.dataset.ws;
      set({ seasons: w.seasons.includes(s) ? w.seasons.filter((x) => x !== s) : [...w.seasons, s] });
    });
  }
  for (const b of root.querySelectorAll('[data-wsize]')) b.addEventListener('click', () => onSize?.(Number(b.dataset.wsize)));
}
