// Paneel "Plantvak" (Beplanting ▸ Plantvak inrichten): alles voor één plantvak, in drie stappen:
// 1 Vak (type, zon, grond), 2 Wensen (wensvakjes), 3 Planten (per wensvakje, dan de basis, groepjes).
// Wat voor het hele ontwerp geldt, staat in gardenpanel.js.

import {
  HEIGHTS, HABITS, FORMS, ROLES, FOLIAGE, AUTUMN, WINTER, MONTHS, MONTH_NAMES,
  schemePalette, inScheme, describeRole, drawRoleSymbol, roleDiameter, yearRound, hexToHsl, monthState,
  isBed, isGroup, BED_TYPES, shapePolygon, roleForPlant, bedPlan, plantCount, rolesMap, bedScheme, SCHEMES,
} from './planting.js';
import {
  wishOrder, wishText, wishHex, wishCandidates, normalizeWish, wishControlsHtml, bindWishControls, isWish,
} from './wish.js';
import { PLANT_TYPES, searchPlants, plantById, fitsBedType, roleFromPlant, colorFamily } from './plantdb.js';
import { combosFor } from './combos.js';
import { ESVELD, esveldLinkHtml, roleEsveldLinkHtml } from './esveld.js';
import { TRAITS, REQUIREMENTS, BED_FUNCTIONS, plantTraits } from './traits.js';
import { bedChecks, STRUCTURE_LEVELS, MAINTENANCE } from './checks.js';
import { drawPlant } from './plantdraw.js';
import { drawStencil, STENCIL_MAP } from './stencils.js';
import { checkPlanting, compose, adaptItems, lightFromHours, LIGHTS, MOISTURES } from './composer.js';
import { SOIL_TYPES, PH, EXPOSURE, siteProblems } from './site.js';
import { drawElevation } from './elevation.js';
import { collectCasters, computeSunHours } from './shadows.js';
import { pointInPolygon } from './geom.js';
import { polygonArea } from './geom.js';
import { icon } from './icons.js';

const $ = (sel, root = document) => root.querySelector(sel);

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export class PlantPanel {
  constructor(app) {
    this.app = app;
    this.el = $('#plant-panel');
    this.month = null; // null = bloeikleur, anders 1..12
  }

  get doc() {
    return this.app.store.doc;
  }

  ensure() {
    if (!this.doc.planting) this.doc.planting = { scheme: { type: 'vrij', base: '#8e5bb5' }, roles: [] };
    return this.doc.planting;
  }

  open() {
    $('#layers-panel').hidden = true;
    this.app.pavePanel?.close();
    this.app.gardenPanel?.close();
    this.el.hidden = false;
    // met een plantvak geselecteerd begin je bij het invullen
    $('#btn-planting').classList.add('on');
    document.body.classList.add('side-open');
    this.render();
  }

  close() {
    this.el.hidden = true;
    $('#btn-planting').classList.remove('on');
    if (this.app.gardenPanel?.el.hidden !== false) document.body.classList.remove('side-open');
  }

  setMonth(m) {
    this.month = m;
    this.app.baseDirty = true;
    this.app.requestRender();
    if (!this.el.hidden) this.render();
    this.app.gardenPanel?.refresh();
  }

  /** Na elke wijziging in de tekening. */
  refresh() {
    if (!this.el.hidden) this.render();
  }

  symbol(r, px = 34, month = null) {
    const c = document.createElement('canvas');
    const dpr = 2;
    c.width = c.height = px * dpr;
    c.style.width = c.style.height = px + 'px';
    const g = c.getContext('2d');
    const d = roleDiameter(r);
    const s = (px * dpr * 0.86) / d;
    g.setTransform(s, 0, 0, s, (px * dpr) / 2, (px * dpr) / 2);
    drawRoleSymbol(g, r, 0, 0, d, month, 1.3 / s);
    return c;
  }

  /** Impressie van een plant of bouwsteen (bomen als hun stencil), als klein plaatje. */
  thumb(spec, px = 34, month = null) {
    const c = document.createElement('canvas');
    const dpr = 2;
    c.width = c.height = px * dpr;
    c.style.width = c.style.height = px + 'px';
    const g = c.getContext('2d');
    const d = 1;
    const s = (px * dpr * 0.92) / d;
    g.setTransform(s, 0, 0, s, (px * dpr) / 2, (px * dpr) / 2);
    const def = spec.stencil && STENCIL_MAP[spec.stencil];
    if (def && def.round) drawStencil(g, { type: 'stencil', symbol: spec.stencil, x: 0, y: 0, w: d, h: d, rot: 0, color: def.color }, 0.012, '#ffffff', { noMask: true });
    else drawPlant(g, spec, 0, 0, d, { month, lw: 0.01, pxPerM: 400, seed: 3 });
    return c;
  }

  /** Stap 3: groepjes en losse planten neerzetten, in drie duidelijke keuzes. */
  refineHtml(bed) {
    const roles = this.doc.planting?.roles || [];
    const st = this.app.state;
    const inBed = new Set((bed?.planting?.mix || []).map((m) => m.role));
    const list = [...roles.filter((r) => inBed.has(r.id)), ...roles.filter((r) => !inBed.has(r.id))];
    const cur = roles.find((r) => r.id === st.plantRole) ? st.plantRole : list[0]?.id;
    const placing = st.tool === 'plant' && (st.plantMode === 'groep' || st.plantMode === 'plant');
    const n = st.plantMode === 'plant' && placing ? 1 : [3, 5, 7, 9].includes(st.groupCount) ? st.groupCount : 5;
    return `<section class="refine">
        <p class="hint">De basis is een <b>mengsel</b> van planten. Echt mooi wordt het met <b>groepjes</b>: een paar planten van één soort bij elkaar (bijv. 5 zonnehoeden), die terugkomen in het vak. En met een <b>losse plant</b> als blikvanger, zoals een siergras of een boompje.</p>
        <h4>1. Welke plant?</h4>
        ${list.length ? `<div class="chips g3">${list.map((r) => `<button type="button" class="chip${r.id === cur ? ' on' : ''}" data-g3role="${r.id}" title="${esc(describeRole(r))}"><span class="sym" data-sym="${r.id}"></span> ${esc(r.label || r.code)}${inBed.has(r.id) ? '' : ' <small>(niet in dit vak)</small>'}</button>`).join('')}<button type="button" class="chip" data-g3act="pick">+ Andere plant…</button></div>` : '<p class="hint">Nog geen planten. Kies eerst de basis hierboven, of kies <button type="button" class="link" data-g3act="pick">een plant uit de database</button>.</p>'}
        <h4>2. Hoeveel?</h4>
        <div class="seg g3n">${[3, 5, 7, 9].map((k) => `<button type="button" data-g3n="${k}" class="${placing && n === k ? 'on' : ''}">Groepje van ${k}</button>`).join('')}<button type="button" data-g3n="1" class="${placing && n === 1 ? 'on' : ''}">1 losse plant</button></div>
        <h4>3. Tik in de tekening</h4>
        <p class="hint">${placing ? (n === 1 ? 'Tik waar de plant moet komen.' : `Tik in een plantvak: daar komt een groepje van ${n}. Je ziet vooraf waar het komt; buiten een vak gebeurt niets. Liever een eigen vorm? Sleep een omtrek in het vak.`) : 'Kies hierboven een plant en hoeveel; daarna tik je in de tekening.'} Weghalen of aanpassen: selecteer het groepje en gebruik de balk, of Ongedaan maken.</p>
        ${bed ? `<div class="row add"><button type="button" data-plan="suggest" title="De app legt zelf groepjes van de structuurplanten en accenten uit dit vak">Leg automatisch groepjes</button><button type="button" data-plan="cleargroups" title="Alle groepjes in dit vak weghalen (het mengsel blijft)">Groepjes in dit vak weghalen</button></div>` : ''}
      </section>`;
  }

  // ---------------------------------------------------------------- wensvakjes

  /** Het geselecteerde wensvakje (alleen als dat het enige geselecteerde is). */
  selectedWish() {
    const sel = [...this.app.selection];
    if (sel.length !== 1) return null;
    const it = this.app.store.findItem(sel[0])?.item;
    return isWish(it) ? it : null;
  }

  /** Het wensvakje waar het paneel over gaat: geselecteerd, of het laatst gekozen in dit vak. */
  scopeWish(bed) {
    const sel = this.selectedWish();
    if (sel) return sel;
    const it = this.wishId && this.app.store.findItem(this.wishId)?.item;
    return isWish(it) && (!bed || it.bedId === bed.id) ? it : null;
  }

  wishesOf(bed) {
    if (!bed) return [];
    const groups = this.doc.layers.filter((l) => l.visible).flatMap((l) => l.items).filter((i) => isGroup(i) && i.bedId === bed.id);
    return wishOrder(groups);
  }

  /** Paneel openen op het kiezen van een plant voor dit wensvakje. */
  openWish(id) {
    this.app.state.plantStep = 3;
    this.wishId = id;
    if (this.el.hidden) this.open(); else this.render();
  }

  selectWish(id) {
    this.wishId = id;
    if (this.app.state.tool !== 'lasso') this.app.setTool('lasso');
    this.app.setSelection(new Set([id]));
    this.render();
  }

  setLayerMax(v) {
    this.layerMax = v;
    this.app.baseDirty = true;
    this.app.requestRender();
  }

  /** Lijst met de wensvakjes van het vak, in de volgorde van de piramide. */
  wishListHtml(wishes, active) {
    return `<ol class="wlist">${wishes.map((w, i) => {
      const r = (this.doc.planting?.roles || []).find((x) => x.id === w.planting?.mix?.[0]?.role);
      return `<li data-wid="${w.id}" class="${active?.id === w.id ? 'on' : ''} ${r ? 'done' : ''}"><b>${i + 1}</b><i style="background:${wishHex(w.wish)}"></i><span>${esc(wishText(w.wish))}<small>${r ? `✓ ${esc(r.label || r.code)}` : 'nog geen plant'}</small></span></li>`;
    }).join('')}</ol>`;
  }

  /** Kleuren voor de wenskeuze: het palet van de kleurencombinatie van het vak (niet bij 'vrij'). */
  wishColorOpts(bed, withSize = false) {
    const sch = bedScheme(bed, this.doc);
    const o = sch.type && sch.type !== 'vrij' ? { palette: schemePalette(sch), schemeName: SCHEMES[sch.type]?.name.split(' (')[0] } : {};
    // eigenschappen die de functies van het vak nodig hebben, bovenaan bij de wens
    const need = [...new Set((bed?.aims?.functions || []).flatMap((k) => BED_FUNCTIONS[k]?.traits || []))];
    o.functions = need.length ? need : null;
    if (withSize) o.size = this.app.wishSize();
    return o;
  }

  /** Stap 2: wensvakjes tekenen, alleen met wensen (nog geen planten). */
  wishDrawHtml(bed) {
    const st = this.app.state;
    const drawing = st.tool === 'plant' && st.plantMode === 'wens';
    const wishes = this.wishesOf(bed);
    const active = this.scopeWish(bed);
    const own = !!bed.scheme?.type;
    const sch = bedScheme(bed, this.doc);
    const glob = this.ensure().scheme;
    const aims = bed.aims || {};
    const seg = (key, opts, cur) => `<span class="seg">${Object.entries(opts).map(([k, n]) => `<button type="button" data-aim="${key}" data-v="${k}" class="${cur === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</span>`;
    return `<section class="aims">
        <h3>Uitgangspunten van ${esc(bed.name || 'dit vak')}</h3>
        <div class="aimrow"><span>Mooi in</span><span class="seg">${['lente', 'zomer', 'herfst', 'winter'].map((k) => `<button type="button" data-aimseason="${k}" class="${(aims.seasons || []).includes(k) ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</span></div>
        <div class="aimrow"><span>Structuur</span>${seg('structure', Object.fromEntries(Object.entries(STRUCTURE_LEVELS).map(([k, v]) => [k, v.name])), aims.structure || 'gemiddeld')}</div>
        <div class="aimrow"><span>Onderhoud</span>${seg('maintenance', MAINTENANCE, aims.maintenance || 'gemiddeld')}</div>
        <div class="aimrow fns"><span>Wat moet dit vak doen?</span><div class="chips">${Object.entries(BED_FUNCTIONS).map(([k, v]) => `<button type="button" class="chip${(aims.functions || []).includes(k) ? ' on' : ''}" data-aimfn="${k}" title="${esc(v.hint)}">${esc(v.name)}</button>`).join('')}</div></div>
        <p class="hint">De functie van het vak in de tuin. Bij de wensen staan de eigenschappen die daarvoor nodig zijn bovenaan (★), en de controle in stap 3 kijkt of het vak het waarmaakt.</p>
      </section>
      <section class="scheme">
        <h3>Kleurencombinatie van ${esc(bed.name || 'dit vak')}</h3>
        <div class="row">
          <select data-k="bedscheme">
            <option value="" ${own ? '' : 'selected'}>Zoals het hele ontwerp (${esc(SCHEMES[glob.type]?.name.split(' (')[0] || 'vrij')})</option>
            ${Object.entries(SCHEMES).map(([k, v]) => `<option value="${k}" ${own && sch.type === k ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
          </select>
          <input type="color" data-k="bedbase" value="${sch.base || '#8e5bb5'}" title="Basiskleur op het kleurenwiel" ${['vrij', 'warm', 'koel', 'wit'].includes(sch.type) ? 'hidden' : ''}>
        </div>
        <div class="palette">${schemePalette(sch).map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
        <p class="hint">Bij de wensen hieronder zie je eerst deze kleuren. Afwijken kan met <b>Andere kleur…</b>.</p>
      </section>
      <section class="wishes">
        <h3>Wat wil je hier?</h3>
        <div class="wnew">${wishControlsHtml(st.wish, this.wishColorOpts(bed, true))}</div>
        <div class="row add"><button type="button" class="${drawing ? 'on' : 'primary'}" data-wact="draw">${drawing ? 'Bezig: tik in het vak' : 'Wensvakjes tekenen'}</button></div>
        ${drawing ? '<p class="hint">Tik in het plantvak voor een vakje met deze wens, of sleep een eigen vorm. Verander de wens hierboven tussendoor.</p>' : ''}
        <h3>Wensvakjes <small>${wishes.length ? `${wishes.length}, in de volgorde van de piramide` : 'nog geen'}</small></h3>
        ${wishes.length ? this.wishListHtml(wishes, active) : '<p class="hint">Nog geen wensvakjes. Je mag deze stap ook overslaan en in stap 3 meteen de basis van het vak kiezen.</p>'}
        ${active ? `<div class="wcard">${this.wishNavHtml(active, wishes)}<h4>Wens van vakje ${wishes.indexOf(active) + 1} aanpassen</h4><div class="wedit">${wishControlsHtml(active.wish, this.wishColorOpts(bed))}</div></div>` : ''}
      </section>`;
  }

  /** Stap 3: per wensvakje een plant kiezen, grote planten eerst. */
  wishPickHtml(bed) {
    const wishes = this.wishesOf(bed);
    if (!wishes.length) return '<section class="wishes"><p class="hint">Geen wensvakjes in dit vak (die teken je in stap 2). Kies hieronder de basis voor het hele vak.</p></section>';
    const active = this.scopeWish(bed);
    const open = wishes.filter((w) => !(w.planting?.mix || []).length).length;
    return `<section class="wishes">
        <h3>Wensvakjes <small>${open ? `nog ${open} zonder plant` : 'allemaal ingevuld'}</small></h3>
        <p class="hint">Grote planten eerst: bomen en heesters, dan vaste planten, bollen en bodembedekkers.</p>
        ${this.wishListHtml(wishes, active)}
        ${active ? this.wishCardHtml(active, wishes) : '<p class="hint">Tik op een vakje in de lijst of in de tekening om er een plant voor te kiezen.</p>'}
      </section>`;
  }

  wishCardHtml(w, wishes) {
    const nr = wishes.indexOf(w) + 1;
    const roles = rolesMap(this.doc);
    const mix = (w.planting?.mix || []).filter((m) => roles[m.role]);
    const area = Math.abs(polygonArea(shapePolygon(w)));
    const n = mix.length ? plantCount(area, mix, roles) : 0;
    const r = mix.length ? roles[mix[0].role] : null;
    return `<div class="wcard">
        <h4>Vakje ${nr} <small>${area.toFixed(1).replace('.', ',')} m²${n ? ` · ±${n} plant${n > 1 ? 'en' : ''}` : ''}</small></h4>
        <div class="wedit">${wishControlsHtml(w.wish, this.wishColorOpts(this.app.store.findItem(w.bedId)?.item))}</div>
        ${r ? `<div class="wcur"><span class="th" data-wthumb="${r.id}"></span><span><b>${esc(r.label || r.code)}</b><small>gekozen ${roleEsveldLinkHtml(r)}</small></span><button type="button" data-wact="clear" title="Plant uit dit vakje halen (de wens blijft)">Weghalen</button></div>` : ''}
        <h5>${r ? 'Of een andere plant' : 'Passende planten'}</h5>
        <ul class="wcands"></ul>
        <div class="row add"><button type="button" data-wact="more">Meer planten…</button></div>
        ${this.wishNavHtml(w, wishes)}
      </div>`;
  }

  /** Gebeurtenissen van het deel 'Wensvakjes'. */
  bindWish(el, bed) {
    const aim = (fn) => this.app.store.mutate(() => { bed.aims = fn({ ...(bed.aims || {}) }); }, 'bed-aims');
    for (const b of el.querySelectorAll('[data-aim]')) b.addEventListener('click', () => aim((a) => ({ ...a, [b.dataset.aim]: b.dataset.v })));
    for (const b of el.querySelectorAll('[data-aimseason]')) b.addEventListener('click', () => aim((a) => { const k = b.dataset.aimseason, cur = a.seasons || []; return { ...a, seasons: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] }; }));
    for (const b of el.querySelectorAll('[data-aimfn]')) b.addEventListener('click', () => aim((a) => { const k = b.dataset.aimfn, cur = a.functions || []; return { ...a, functions: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] }; }));
    el.querySelector('[data-k="bedscheme"]')?.addEventListener('change', (e) => this.app.store.mutate(() => {
      if (e.target.value) bed.scheme = { type: e.target.value, base: bed.scheme?.base || this.ensure().scheme.base || '#8e5bb5' };
      else delete bed.scheme;
    }, 'bedscheme'));
    el.querySelector('[data-k="bedbase"]')?.addEventListener('change', (e) => this.app.store.mutate(() => {
      bed.scheme = { ...bedScheme(bed, this.doc), base: e.target.value };
    }, 'bedscheme'));
    const box = $('.wnew', el);
    if (box) {
      bindWishControls(box, this.app.state.wish, (w) => { this.app.state.wish = w; this.app.persistSettings(); this.app.renderOptions(); this.render(); this.app.requestRender(); },
        (a) => { this.app.state.wishSize = a; this.app.persistSettings(); this.app.renderOptions(); this.render(); });
    }
    el.querySelector('[data-wact="draw"]')?.addEventListener('click', () => {
      this.app.state.plantMode = 'wens';
      this.app.persistSettings();
      if (this.app.state.tool !== 'plant') this.app.setTool('plant'); else this.app.renderOptions();
      this.render();
    });
    for (const li of el.querySelectorAll('[data-wid]')) li.addEventListener('click', () => this.selectWish(li.dataset.wid));
    const w = bed && this.scopeWish(bed);
    if (!w) return;
    const id = w.id;
    const edit = $('.wedit', el);
    if (edit) {
      bindWishControls(edit, w.wish, (nw) => this.app.store.mutate(() => {
        const it = this.app.store.findItem(id)?.item;
        if (it) it.wish = nw;
      }, 'wish'));
    }
    el.querySelector('[data-wact="prev"]')?.addEventListener('click', () => this.stepWish(bed, id, -1));
    el.querySelector('[data-wact="next"]')?.addEventListener('click', () => this.stepWish(bed, id, 1));
    if (!$('.wcands', el)) return;
    for (const sp of el.querySelectorAll('[data-wthumb]')) { const r = (this.doc.planting?.roles || []).find((q) => q.id === sp.dataset.wthumb); if (r) sp.appendChild(this.thumb(r, 34)); }
    el.querySelector('[data-wact="clear"]')?.addEventListener('click', () => this.app.store.mutate(() => {
      const it = this.app.store.findItem(id)?.item;
      if (it) it.planting = { mix: [] };
    }, 'wish-clear'));
    const ctx = this.wishCtx(bed);
    el.querySelector('[data-wact="more"]').addEventListener('click', () => {
      const nw = normalizeWish(w.wish);
      this.openPicker({
        title: `Plant voor vakje: ${wishText(nw)}`,
        btype: null, light: ctx.light, moisture: ctx.moisture, height: nw.height, color: nw.color === 'blad' ? '' : nw.color,
        traits: bed.require || [],
        site: bed,
        onPick: (pl) => this.fillWish(id, pl),
      });
    });
    const { list, excluded } = wishCandidates(w.wish, ctx);
    const ul = $('.wcands', el);
    const top = list.slice(0, 8);
    if (!top.length) ul.innerHTML = `<li class="hint">Geen planten gevonden die hierbij passen${excluded.light || excluded.moisture ? ' (met de zon en grond van dit vak)' : ''}. Pas de wens aan of kies via Meer planten.</li>`;
    for (const c of top) {
      const li = document.createElement('li');
      li.className = 'role';
      li.appendChild(this.thumb(c.p, 34));
      const t = document.createElement('div');
      t.className = 'rtxt';
      t.innerHTML = `<b>${esc(c.p.nl)}</b> <i>${esc(c.p.lat)}</i><small>${c.p.h >= 300 ? `${Math.round(c.p.h / 100)} m` : `${c.p.h} cm`} · bloei ${bloomText(c.p)}${c.good.length ? ` · <span class="good">${esc(c.good.join(', '))}</span>` : ''}${c.bad.length ? ` · <em>${esc(c.bad.join(', '))}</em>` : ''}${esveldLinkHtml(c.p) ? ` · ${esveldLinkHtml(c.p)}` : ''}</small>`;
      li.appendChild(t);
      const sw = document.createElement('i');
      sw.className = 'pcolor'; sw.style.background = c.p.bloom.length ? c.p.color : 'transparent';
      li.appendChild(sw);
      li.querySelector('a.esvlink')?.addEventListener('click', (ev) => ev.stopPropagation());
      li.addEventListener('click', () => this.fillWish(id, c.p));
      ul.appendChild(li);
    }
    if (!bed.light || !bed.moisture) {
      const li = document.createElement('li');
      li.className = 'hint';
      li.innerHTML = 'Tip: vul in stap 2 de <b>zon</b> en <b>grond</b> van dit vak in, dan vallen planten die daar niet groeien af.';
      ul.appendChild(li);
    }
  }

  wishCtx(bed) {
    const used = new Set((this.doc.planting?.roles || []).map((r) => r.plant).filter(Boolean));
    return { light: bed?.light || null, moisture: bed?.moisture || null, scheme: bedScheme(bed, this.doc), used, source: this.app.plantSource(), require: bed?.require || [], maintenance: bed?.aims?.maintenance || null, site: bed || null };
  }

  /** Plant in een wensvakje zetten en door naar het volgende open vakje. */
  fillWish(id, pl) {
    const roles = this.ensure().roles;
    const { role, created } = roleForPlant(roles, pl);
    this.app.store.mutate((doc) => {
      if (created) doc.planting.roles.push(role);
      const it = this.app.store.findItem(id)?.item;
      if (it) it.planting = { mix: [{ role: role.id, w: 100 }] };
    }, 'wish-fill');
    const bed = this.app.store.findItem(this.app.store.findItem(id)?.item?.bedId)?.item;
    this.nextWish(bed, id, pl.nl);
  }

  /** Knoppen om door de wensvakjes te bladeren (in de volgorde van de lijst). */
  wishNavHtml(w, wishes) {
    if (wishes.length < 2) return '';
    const i = wishes.indexOf(w);
    return `<div class="row wnav"><button type="button" data-wact="prev" title="Vorig wensvakje">‹ Vorige</button><span>vakje ${i + 1} van ${wishes.length}</span><button type="button" class="primary" data-wact="next" title="Volgend wensvakje">Volgende ›</button></div>`;
  }

  /** Naar het vorige (dir -1) of volgende (dir 1) wensvakje; rondom. */
  stepWish(bed, fromId, dir) {
    const wishes = this.wishesOf(bed);
    if (!wishes.length) return;
    const i = wishes.findIndex((w) => w.id === fromId);
    const next = wishes[(i + dir + wishes.length) % wishes.length];
    this.selectWish(next.id);
  }

  nextWish(bed, fromId, chosen = null) {
    const wishes = this.wishesOf(bed);
    const i = wishes.findIndex((w) => w.id === fromId);
    const order = [...wishes.slice(i + 1), ...wishes.slice(0, Math.max(0, i))];
    const next = order.find((w) => !(w.planting?.mix || []).length) || (chosen ? null : order[0]);
    if (next) {
      this.selectWish(next.id);
      if (chosen) this.app.toast(`${chosen} gekozen. Nu vakje ${wishes.indexOf(next) + 1}: ${wishText(next.wish)}.`, 3000);
    } else {
      this.render();
      this.app.toast(chosen ? `${chosen} gekozen. Alle wensvakjes in dit vak hebben een plant. Bekijk de Plantenlijst.` : 'Er zijn geen andere vakjes.', 3500);
    }
  }

  /** Plant uit de database kiezen om als groepje of losse plant te zetten. */
  pickForPlacing() {
    this.openPicker({
      title: 'Kies een plant om te zetten',
      onPick: (pl) => {
        const roles = this.doc.planting?.roles || [];
        const { role, created } = roleForPlant(roles, pl);
        if (created) this.mutate((x) => { x.roles.push(role); });
        this.app.state.plantRole = role.id;
        if (this.app.state.plantMode !== 'plant') this.app.state.plantMode = 'groep';
        this.app.persistSettings();
        if (this.app.state.tool !== 'plant') this.app.setTool('plant'); else this.app.renderOptions();
        this.render();
      },
    });
  }

  /** Huidige stap van de route (1 schetsen, 2 invullen, 3 verfijnen). */
  step() {
    const s2 = Number(this.app.state.plantStep);
    return s2 >= 1 && s2 <= 3 ? s2 : 1;
  }

  /** Alle zichtbare plantvakken met hun oppervlak. */
  beds() {
    const out = [];
    for (const l of this.doc.layers) {
      if (!l.visible) continue;
      for (const it of l.items) if (isBed(it)) out.push({ item: it, area: Math.abs(polygonArea(shapePolygon(it))) });
    }
    return out;
  }

  /** Plantvak waarop het overzicht betrekking heeft (geselecteerd vak of het vak van een groep). */
  scopeBed() {
    // het geselecteerde vak (of het vak van een geselecteerde groep) …
    const sel = [...this.app.selection];
    if (sel.length === 1) {
      const it = this.app.store.findItem(sel[0])?.item;
      const bed = it && (isBed(it) ? it : isGroup(it) ? this.app.store.findItem(it.bedId)?.item : null);
      if (bed) { this.focusId = bed.id; return bed; }
    }
    // … anders het vak waar je mee bezig was (bijv. tijdens het leggen van groepjes), tot je 'Alle vakken' kiest
    const f = this.focusId && this.app.store.findItem(this.focusId)?.item;
    if (f && isBed(f)) return f;
    this.focusId = null;
    return null;
  }

  /** Kop: over welk plantvak gaat het paneel nu? */
  focusHtml(bed, beds) {
    if (!bed) return beds.length ? '<section class="focus none"><p class="hint">Alle plantvakken. Tik op een vak in de tekening of in de lijst om alleen dat vak te zien.</p></section>' : '';
    const bt = BED_TYPES[bed.btype];
    const area = Math.abs(polygonArea(shapePolygon(bed)));
    const plan = bedPlan(bed);
    const n = plan.mix.length;
    const groups = this.doc.layers.flatMap((l) => l.items).filter((i) => isGroup(i) && i.bedId === bed.id).length;
    return `<section class="focus"><i style="background:${bt ? bt.color : '#cdb9a4'}"></i><div><b>${esc(bed.name || 'Plantvak')}</b><small>${bt ? esc(bt.name) : 'type nog open'} · ${area < 10 ? area.toFixed(1).replace('.', ',') : Math.round(area)} m² · ${n ? `${n} soort${n > 1 ? 'en' : ''}` : 'nog leeg'}${groups ? ` · ${groups} groepje${groups > 1 ? 's' : ''}` : ''}${plan.grouped.length ? ` (${plan.grouped.map((id) => esc((this.doc.planting?.roles || []).find((r) => r.id === id)?.label || '')).join(', ')} in groepjes)` : ''}</small></div><button type="button" data-act="unfocus" title="Terug naar het overzicht van alle plantvakken">Alle vakken</button></section>`;
  }

  render() {
    this.ensure();
    // een wensvakje geselecteerd: meteen naar 'plant kiezen' voor dat vakje
    const selWish = this.selectedWish();
    if (selWish && selWish.id !== this.lastSelWish) {
      // in stap 2 pas je de wens aan; anders kies je er een plant voor
      if (this.step() !== 2) this.app.state.plantStep = 3;
      this.wishId = selWish.id;
    }
    this.lastSelWish = selWish?.id || null;
    const bed = this.scopeBed();
    const el = this.el;
    const beds = this.beds();
    const head = `<div class="panel-head">
        <h2>Plantvak</h2>
        <button class="tb" data-act="close" title="Sluiten">${icon('close')}</button>
      </div>`;
    if (!bed) {
      // zonder plantvak is er niets in te richten: kies een vak of teken er een
      el.innerHTML = `${head}
        <section class="step-intro"><p>Hier richt je <b>één plantvak</b> in: type, zon en grond, de planten, wensvakjes en groepjes. Kies een plantvak in de tekening of hieronder, of teken een nieuw vak.</p></section>
        <section>
          <h3>Kies een plantvak <small>${beds.length ? `${beds.length} in de tekening` : ''}</small></h3>
          <ul class="bedlist"></ul>
        </section>
        <section>
          <h3>Nieuw plantvak</h3>
          <div class="btypes">${Object.entries(BED_TYPES).map(([k, v]) => `<button type="button" data-btype="${k}" class="${(this.app.state.bedType || '') === k ? 'on' : ''}" title="${esc(v.name)}${v.examples ? ` (${esc(v.examples)})` : ''}"><i style="background:${v.color}"></i>${esc(v.label)}<small>${v.range}</small></button>`).join('')}</div>
          <div class="row add"><button type="button" class="primary" data-tool="vak">${icon('area', 16)} Plantvak tekenen</button></div>
          <p class="hint">Kies het type (hoe hoog wordt het ongeveer?) en teken het vak. De vorm kies je onderin: vrij, rechthoek, cirkel, boog, of <b>tik in ruimte</b>.</p>
        </section>
        <section><p class="hint">Instellingen voor het <b>hele ontwerp</b> (weergave van alle vakken, maand, kleurenschema, alle planten, plantenlijst) staan apart: <button type="button" class="link" data-act="garden">Beplanting ▸ Hele ontwerp</button>.</p></section>`;
      el.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
      el.querySelector('[data-act="garden"]').addEventListener('click', () => this.app.gardenPanel.open());
      this.bindBedTypes(el, null);
      this.bindBedList(el, beds, null);
      return;
    }
    const yr = yearRound(this.doc, bed.id);
    const view = this.app.state.plantViews?.[bed.id] || this.app.state.plantView || 'planten';
    const low = yr.total ? yr.months.filter((m) => m.score < 0.3) : [];
    const step = this.step();
    const name = esc(bed.name || 'dit vak');
    const stepBtn = (n, t) => `<button type="button" data-step="${n}" class="${step === n ? 'on' : ''}"><b>${n}</b> ${t}</button>`;
    el.innerHTML = `${head}
      ${this.focusHtml(bed, beds)}
      <nav class="steps">${stepBtn(1, 'Vak')}${stepBtn(2, 'Wensen')}${stepBtn(3, 'Planten')}</nav>
      <section class="step-intro">${[
        '',
        `<p><b>Het vak.</b> Hoe hoog wordt ${name} ongeveer, en hoe staat het erbij: hoeveel zon, welke grond? Dat bepaalt welke planten er kunnen.</p>`,
        `<p><b>Wensen.</b> Teken in ${name} kleine <b>wensvakjes</b> (0,5–1,5 m²) met alleen wat je daar wilt: soort, hoogte, kleur, seizoen. Nog geen planten. Geen wensen? Sla deze stap over.</p>`,
        `<p><b>Planten.</b> Kies per wensvakje een plant, de grote eerst. Daarna de <b>basis</b>: de planten die de rest van ${name} vullen.</p>`,
      ][step]}</section>
      ${step === 1 ? `<section class="bedsec">
        <h3>Type van ${name}</h3>
        <div class="btypes">${Object.entries(BED_TYPES).map(([k, v]) => `<button type="button" data-btype="${k}" class="${(bed.btype || '') === k ? 'on' : ''}" title="${esc(v.name)}${v.examples ? ` (${esc(v.examples)})` : ''}"><i style="background:${v.color}"></i>${esc(v.label)}<small>${v.range}</small></button>`).join('')}</div>
        <h3>Standplaats</h3>
        <label class="row">Zon
          <select data-k="bedlight">${[['', 'nog onbekend'], ...Object.entries(LIGHTS)].map(([k, n]) => `<option value="${k}" ${(bed.light || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <button type="button" data-act="measure" title="Meet de zonuren in dit vak met de zonnestudie (gemiddeld per dag, april t/m september)">☀ Meet</button>
        </label>
        ${bed.sunHours != null ? `<p class="hint sunh">Zonnestudie: gemiddeld <b>${String(bed.sunHours).replace('.', ',')} uur</b> zon per dag (apr–sep).</p>` : ''}
        <label class="row">Vocht
          <select data-k="bedmoist">${[['', 'nog onbekend'], ...Object.entries(MOISTURES)].map(([k, n]) => `<option value="${k}" ${(bed.moisture || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <label class="row">Grondsoort
          <select data-k="bedsoiltype">${[['', 'nog onbekend'], ...Object.entries(SOIL_TYPES)].map(([k, n]) => `<option value="${k}" ${(bed.soilType || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <select data-k="bedph" title="Zuurgraad">${[['', 'zuurgraad?'], ...Object.entries(PH)].map(([k, n]) => `<option value="${k}" ${(bed.ph || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <label class="row">Ligging
          <select data-k="bedexposure">${[['', 'nog onbekend'], ...Object.entries(EXPOSURE)].map(([k, n]) => `<option value="${k}" ${(bed.exposure || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <label class="check"><input type="checkbox" data-k="bedwarm" ${bed.warmWall ? 'checked' : ''}> Tegen een warme muur (zuid of west): meer kans voor minder winterharde planten</label>
        <p class="hint">Grondsoort, zuurgraad en ligging houden planten tegen die er niet willen groeien, zoals zuurminnaars op kalk of windgevoelige planten op een winderige plek.</p>
        <h3>Eisen voor alle planten in ${name}</h3>
        <div class="chips reqs">${REQUIREMENTS.map((k) => `<button type="button" class="chip${(bed.require || []).includes(k) ? ' on' : ''}" data-req="${k}" title="${esc(TRAITS[k].hint)}">${esc(TRAITS[k].name)}</button>`).join('')}</div>
        <p class="hint">Bijvoorbeeld alleen eetbare planten in een moestuinvak, of alleen klimplanten langs een hek. Deze eisen gelden bij kiezen, samenstellen en de wensvakjes; afwijken kan per keer in de plantkeuze.</p>
        <div class="row add"><button type="button" data-tool="vak">${icon('area', 16)} Nog een plantvak tekenen</button></div>
      </section>` : ''}
      ${step === 2 ? this.wishDrawHtml(bed) : ''}
      ${step === 3 ? `${this.wishPickHtml(bed)}
      <section class="bedsec">
        <h3>Basis van ${name}</h3>
        <p class="hint">De planten die de rest van het vak vullen (tussen de wensvakjes), als mengsel.</p>
        <ul class="roles mixlist"></ul>
        <div class="row add">
          <button type="button" class="primary" data-act="compose" title="Laat de app planten kiezen die passen bij hoogte, zon, grond en kleurenschema, met bloei door het jaar en afwisseling in vorm">Stel een basis samen</button>
          <button type="button" data-act="addplant" title="Kies een plant uit de plantendatabase; hij komt in de basis van dit vak">+ Plant toevoegen</button>
          <button type="button" data-act="combos" title="Vul de basis met een kant-en-klare plantcombinatie (aangepast aan dit vak)">Combinatie</button>
        </div>
        <div class="proposal" hidden></div>
        <div class="combos" hidden></div>
      </section>
      <details class="refine-more" ${this.app.state.refineOpen ? 'open' : ''}><summary>Groepjes en losse planten</summary>${this.refineHtml(bed)}</details>
      <section class="elev">
        <h3>Vooraanzicht van ${name}</h3>
        <canvas class="elevation" width="640" height="300"></canvas>
        <div class="row"><span class="seg">${[[null, 'Bloei'], [2, 'Feb'], [5, 'Mei'], [8, 'Aug'], [11, 'Nov']].map(([m, n]) => `<button type="button" data-elm="${m ?? ''}" class="${(this.elevMonth ?? null) === m ? 'on' : ''}">${n}</button>`).join('')}</span><button type="button" data-act="elevflip" title="Bekijk het vak van de andere kant">⇄ Andere kant</button></div>
      </section>
      <section class="control">
        <h3>Controle van ${name} <small>4 momenten, groene soep, structuur, functies</small></h3>
        <ul class="checks bedchecks"></ul>
      </section>` : ''}
      <section>
        <h3>Weergave van ${name}</h3>
        <div class="seg" title="Hoe dit plantvak in de tekening staat">
          <button type="button" data-view="planten" class="${view === 'planten' ? 'on' : ''}" title="Impressie: de planten zoals ze er uitzien">Impressie</button>
          <button type="button" data-view="symbolen" class="${view === 'symbolen' ? 'on' : ''}" title="Plansymbolen: technisch beplantingsplan met codes">Symbolen</button>
          <button type="button" data-view="groepen" class="${view === 'groepen' ? 'on' : ''}" title="Groepen: vlakken per mix, met aantallen">Groepen</button>
        </div>
      </section>
      <section>
        <h3>${name} door het jaar</h3>
        <div class="year"></div>
        <div class="advice">${!yr.total ? '<p>Nog geen planten in dit vak.</p>' : low.length ? `<p>Weinig te zien in <b>${low.map((m) => MONTHS[m.m - 1]).join(', ')}</b>.${low.some((m) => m.m <= 3 || m.m >= 11) ? ' Denk aan wintergroen, planten met een mooi silhouet of zaaddozen, of vroege bloeiers.' : ' Voeg een plant toe die dan bloeit.'}</p>` : '<p>Het hele jaar iets te zien.</p>'}</div>
      </section>
      <div class="row add plist"><button type="button" data-act="plantlist" title="Planten van dit vak met aantallen, standplaats, bloei, leverancier en prijs; als PDF of voor Excel">Plantenlijst van ${name}</button></div>
      ${step < 3 ? `<div class="row next"><button type="button" class="primary" data-step="${step + 1}">Verder: ${step === 1 ? '2 Invullen' : '3 Verfijnen'} ›</button></div>` : ''}`;

    yearBars($('.year', el), yr, this.month, null);
    const ec = $('canvas.elevation', el);
    if (ec) {
      drawElevation(ec, this.doc, bed, { month: this.elevMonth ?? null, back: !!this.elevBack });
      for (const b of el.querySelectorAll('[data-elm]')) b.addEventListener('click', () => { this.elevMonth = b.dataset.elm ? Number(b.dataset.elm) : null; this.render(); });
      el.querySelector('[data-act="elevflip"]').addEventListener('click', () => { this.elevBack = !this.elevBack; this.render(); });
    }
    const bc = $('.bedchecks', el);
    if (bc) {
      // standplaats en type (per plant in het vak) en de controles van het hele vak in één lijst
      const roles = this.ensure().roles;
      const byId = Object.fromEntries(roles.map((r) => [r.id, r]));
      const all = new Map();
      for (const m of bedPlan(bed).mix) all.set(m.role, m.w);
      for (const l of this.doc.layers) for (const g of l.items) if (isGroup(g) && g.bedId === bed.id) for (const m of g.planting?.mix || []) if (!all.has(m.role)) all.set(m.role, m.w);
      const base = checkPlanting([...all].map(([id, w]) => ({ role: byId[id], w })), this.bedCtx(bed)).filter((c) => ['hoogte', 'zon', 'grond', 'plek', 'vormen', 'kleur'].includes(c.key));
      const list = all.size ? [...base, ...bedChecks(this.doc, bed)] : [];
      if (list.length) this.fillChecks(bc, list); else bc.innerHTML = '<li class="open">Nog geen planten in dit vak.</li>';
    }
    this.renderBed(el, bed, step);

    // gebeurtenissen
    el.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    el.querySelector('[data-act="unfocus"]')?.addEventListener('click', () => { this.focusId = null; this.app.setSelection(new Set()); this.render(); });
    for (const b of el.querySelectorAll('[data-step]')) b.addEventListener('click', () => { this.app.state.plantStep = Number(b.dataset.step); this.app.persistSettings(); this.render(); });
    this.bindBedTypes(el, bed);
    el.querySelector('[data-act="plantlist"]')?.addEventListener('click', () => this.app.openPlantList(bed.id));
    el.querySelector('.refine-more')?.addEventListener('toggle', (e) => { this.app.state.refineOpen = e.target.open; this.app.persistSettings(); });
    this.bindWish(el, bed);
    el.querySelector('[data-plan="suggest"]')?.addEventListener('click', () => this.app.planAction('suggest'));
    el.querySelector('[data-plan="cleargroups"]')?.addEventListener('click', () => this.app.planAction('cleargroups'));
    const place = (mode) => {
      this.app.state.plantMode = mode;
      this.app.persistSettings();
      if (this.app.state.tool !== 'plant') this.app.setTool('plant'); else this.app.renderOptions();
      this.render();
      this.app.requestRender();
    };
    for (const b of el.querySelectorAll('[data-g3role]')) b.addEventListener('click', () => { this.app.state.plantRole = b.dataset.g3role; place(this.app.state.plantMode === 'plant' ? 'plant' : 'groep'); });
    for (const b of el.querySelectorAll('[data-g3n]')) b.addEventListener('click', () => {
      const n = Number(b.dataset.g3n);
      if (n === 1) place('plant'); else { this.app.state.groupCount = n; place('groep'); }
    });
    el.querySelector('[data-g3act="pick"]')?.addEventListener('click', () => this.pickForPlacing());
    for (const sp of el.querySelectorAll('[data-sym]')) { const r = (this.doc.planting?.roles || []).find((q) => q.id === sp.dataset.sym); if (r) sp.appendChild(this.symbol(r, 22)); }
    for (const b of el.querySelectorAll('[data-view]')) {
      b.addEventListener('click', () => {
        // alleen dit vak; de weergave van alle vakken staat onder Hele ontwerp
        this.app.state.plantViews = { ...(this.app.state.plantViews || {}), [bed.id]: b.dataset.view };
        this.app.persistSettings();
        this.app.baseDirty = true;
        this.app.requestRender();
        this.render();
      });
    }
  }

  /** Typeknoppen (stap 1) en 'Plantvak tekenen'. Met een vak: het type van dat vak; zonder: voor nieuwe vakken. */
  bindBedTypes(el, bed) {
    for (const b of el.querySelectorAll('[data-btype]')) {
      b.addEventListener('click', () => {
        this.app.state.bedType = b.dataset.btype;
        this.app.persistSettings();
        if (bed) this.app.store.mutate(() => { bed.btype = b.dataset.btype; }, 'bedtype');
        this.render();
      });
    }
    for (const b of el.querySelectorAll('[data-tool]')) {
      b.addEventListener('click', () => {
        this.app.state.plantMode = b.dataset.tool;
        this.app.persistSettings();
        if (this.app.state.tool !== 'plant') this.app.setTool('plant'); else this.app.renderOptions();
        this.app.toast('Teken een plantvak in de tekening (vorm kiezen onderin).', 3000);
      });
    }
  }

  /** Lijst met plantvakken om er een te kiezen. */
  bindBedList(el, beds, bed) {
    const bl = $('.bedlist', el);
    if (!bl) return;
    if (!beds.length) bl.innerHTML = '<li class="hint">Nog geen plantvakken. Kies een type en teken een vak.</li>';
    for (const { item: b2, area } of beds) {
      const li = document.createElement('li');
      li.className = 'bedrow' + (bed && bed.id === b2.id ? ' active' : '');
      const bt = BED_TYPES[b2.btype];
      const n = (b2.planting?.mix || []).length;
      li.innerHTML = `<i style="background:${bt ? bt.color : '#cdb9a4'}"></i><span><b>${esc(b2.name || 'Plantvak')}</b><small>${bt ? esc(bt.name) : 'type nog open'} · ${area < 10 ? area.toFixed(1).replace('.', ',') : Math.round(area)} m² · ${n ? `${n} soort${n > 1 ? 'en' : ''}` : 'nog leeg'}</small></span>`;
      li.addEventListener('click', () => {
        if (this.app.state.tool !== 'lasso') this.app.setTool('lasso');
        this.app.setSelection(new Set([b2.id]));
        if (this.el.hidden) this.open(); else this.render();
      });
      bl.appendChild(li);
    }
  }

  mutate(fn) {
    this.app.store.mutate(() => fn(this.ensure()), 'planting');
  }

  /** Kleurcirkel: kleuren van de gekozen maand (of de bloeikleuren) op tint, met het schema als vlak. */
  drawWheel(c, p, areas) {
    const g = c.getContext('2d');
    const W = c.width, cx = W / 2, cy = W / 2, R = W * 0.4;
    g.clearRect(0, 0, W, W);
    // ring met alle tinten
    for (let a = 0; a < 360; a += 3) {
      g.beginPath();
      g.strokeStyle = `hsl(${a}, 60%, 60%)`;
      g.lineWidth = 10;
      g.arc(cx, cy, R + 14, ((a - 90) * Math.PI) / 180, ((a - 87) * Math.PI) / 180);
      g.stroke();
    }
    // schemavlakken
    if (p.scheme.type !== 'vrij') {
      g.fillStyle = 'rgba(47, 93, 58, 0.10)';
      for (const col of schemePalette(p.scheme)) {
        const [h, s] = hexToHsl(col);
        if (s < 0.18) continue;
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, R + 6, ((h - 22 - 90) * Math.PI) / 180, ((h + 22 - 90) * Math.PI) / 180);
        g.closePath();
        g.fill();
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    // stippen per bouwsteen
    const max = Math.max(1e-6, ...Object.values(areas));
    for (const r of p.roles) {
      const st = this.month ? monthState(r, this.month) : { color: r.color, kind: 'bloei' };
      if (!st.color) continue;
      const [h, s, l] = hexToHsl(st.color);
      const rad = s < 0.18 || l > 0.9 ? R * 0.12 : R * (0.25 + 0.75 * Math.min(1, s));
      const x = cx + Math.cos(((h - 90) * Math.PI) / 180) * rad, y = cy + Math.sin(((h - 90) * Math.PI) / 180) * rad;
      const size = 6 + 16 * Math.sqrt((areas[r.id] || 0) / max);
      g.beginPath();
      g.arc(x, y, size, 0, Math.PI * 2);
      g.fillStyle = st.color;
      g.fill();
      // het kleurenschema gaat over bloeikleuren; blad, herfst en silhouet tellen niet mee
      const off = st.kind === 'bloei' && !inScheme(st.color, p.scheme);
      g.lineWidth = off ? 3 : 1.5;
      g.strokeStyle = off ? '#c0392b' : 'rgba(0,0,0,0.35)';
      g.stroke();
      g.fillStyle = l > 0.6 ? '#222' : '#fff';
      g.font = '600 13px system-ui, -apple-system, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(r.code, x, y + 1);
    }
  }

  // ---------------------------------------------------------------- dit vak

  /** Het geselecteerde plantvak: type, inhoud (mix) met aandelen, plant toevoegen en combinaties. */
  renderBed(el, bed) {
    this.bindBedConditions(el, bed);
    if (!$('.mixlist', el)) return;
    const roles = this.ensure().roles;
    const byId = Object.fromEntries(roles.map((r) => [r.id, r]));
    const mix = bed.planting?.mix || [];
    const tot = mix.reduce((a, m) => a + (Number(m.w) || 0), 0) || 1;
    const ul = $('.mixlist', el);
    if (!mix.length) ul.innerHTML = `<li class="hint">Nog leeg. ${bed.btype ? `Kies een plant of een combinatie die past bij <b>${BED_TYPES[bed.btype].name.toLowerCase()}</b>.` : 'Kies eerst een type (hoe hoog wordt het?), dan een plant of combinatie.'}</li>`;
    for (const m of mix) {
      const r = byId[m.role];
      if (!r) continue;
      const fits = fitsBedType(r.height, bed.btype, r.kind);
      const li = document.createElement('li');
      li.className = 'role' + (fits ? '' : ' unfit');
      li.appendChild(this.thumb(r, 34, this.month));
      const txt = document.createElement('div');
      txt.className = 'rtxt';
      txt.innerHTML = `<b>${esc(r.code)}</b> ${esc(describeRole(r))}<small>${ROLES[r.role].name} · ${HEIGHTS[r.height]?.range || ''} · bloei ${bloomText(r)}${fits ? '' : ` · <em>past niet bij ${esc(BED_TYPES[bed.btype].label.toLowerCase())}</em>`}${roleEsveldLinkHtml(r) ? ` · ${roleEsveldLinkHtml(r)}` : ''}</small>`;
      li.appendChild(txt);
      const w = document.createElement('input');
      w.type = 'number'; w.min = '0'; w.max = '100'; w.step = '5'; w.value = String(Math.round(((Number(m.w) || 0) / tot) * 100));
      w.title = 'Aandeel in dit vak (%)'; w.className = 'share';
      w.addEventListener('click', (e) => e.stopPropagation());
      w.addEventListener('change', () => this.app.store.mutate(() => {
        const mm = bed.planting.mix.find((x) => x.role === m.role);
        if (mm) mm.w = Math.max(0, Number(w.value) || 0);
      }, 'mix'));
      li.appendChild(w);
      const pct = document.createElement('span'); pct.className = 'u'; pct.textContent = '%'; li.appendChild(pct);
      const ed = document.createElement('button');
      ed.type = 'button'; ed.title = 'Plant bewerken (kleur, bloei, blad …)'; ed.innerHTML = icon('pen', 16);
      ed.addEventListener('click', (e) => { e.stopPropagation(); this.editRole(r.id); });
      li.appendChild(ed);
      const del = document.createElement('button');
      del.type = 'button'; del.title = 'Uit dit vak halen'; del.innerHTML = icon('trash', 16);
      del.addEventListener('click', (e) => { e.stopPropagation(); this.app.store.mutate(() => { bed.planting.mix = bed.planting.mix.filter((x) => x.role !== m.role); }, 'mix'); });
      li.appendChild(del);
      ul.appendChild(li);
    }
    const ctx = this.bedCtx(bed);
    // de controle staat onderaan in stap 3 (alle planten van het vak samen)
    el.querySelector('[data-act="compose"]').addEventListener('click', () => this.showProposal(el, bed, 1));
    el.querySelector('[data-act="addplant"]').addEventListener('click', () => this.openPicker({
      title: `Plant toevoegen aan ${bed.name ? bed.name : 'dit vak'}`,
      btype: bed.btype,
      light: bed.light,
      moisture: bed.moisture,
      traits: bed.require || [],
      site: bed,
      onPick: (pl) => this.addPlantToBed(bed, pl),
    }));
    const cbox = $('.combos', el);
    el.querySelector('[data-act="combos"]').addEventListener('click', () => {
      cbox.hidden = !cbox.hidden;
      if (cbox.hidden) return;
      // passend bij de standplaats eerst; bij elke combinatie wat er voor dit vak aan aangepast wordt
      const list = combosFor(bed.btype).map((c) => ({ c, a: adaptItems(c.items, ctx) })).sort((x, y) => x.a.swaps.length - y.a.swaps.length || (y.c.light === ctx.light) - (x.c.light === ctx.light));
      cbox.innerHTML = list.length ? '' : '<p class="hint">Nog geen combinaties voor dit type.</p>';
      for (const { c, a } of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'combo';
        const thumbs = document.createElement('span'); thumbs.className = 'thumbs';
        for (const [id] of c.items.slice(0, 5)) { const pl = plantById(id); if (pl) thumbs.appendChild(this.thumb(pl, 26)); }
        b.appendChild(thumbs);
        const t = document.createElement('span');
        t.innerHTML = `<b>${esc(c.name)}</b><small>${c.items.map(([id]) => esc(plantById(id)?.nl || id)).join(', ')}</small>${a.swaps.length ? `<small class="swap">Voor dit vak: ${a.swaps.map(([x, y]) => `${esc(x)} → ${esc(y)}`).join(', ')}</small>` : ''}`;
        b.appendChild(t);
        b.addEventListener('click', () => this.applyCombo(bed, { ...c, items: a.items }, a.swaps));
        cbox.appendChild(b);
      }
    });
  }

  /** Type, zon en grond van het vak (stap 1). */
  bindBedConditions(el, bed) {
    for (const b of el.querySelectorAll('[data-req]')) {
      b.addEventListener('click', () => this.app.store.mutate(() => {
        const k = b.dataset.req, cur = bed.require || [];
        bed.require = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
        if (!bed.require.length) delete bed.require;
      }, 'bed-require'));
    }
    el.querySelector('[data-k="bedtype"]')?.addEventListener('change', (e) => this.app.store.mutate(() => {
      if (e.target.value) bed.btype = e.target.value; else delete bed.btype;
    }, 'bedtype'));
    el.querySelector('[data-k="bedlight"]')?.addEventListener('change', (e) => this.app.store.mutate(() => {
      if (e.target.value) bed.light = e.target.value; else delete bed.light;
      delete bed.sunHours;
    }, 'bedlight'));
    el.querySelector('[data-k="bedmoist"]')?.addEventListener('change', (e) => this.app.store.mutate(() => {
      if (e.target.value) bed.moisture = e.target.value; else delete bed.moisture;
    }, 'bedmoist'));
    el.querySelector('[data-act="measure"]')?.addEventListener('click', () => this.measureSun(bed));
    const setSite = (k, v) => this.app.store.mutate(() => { if (v) bed[k] = v; else delete bed[k]; }, 'bed-site');
    el.querySelector('[data-k="bedsoiltype"]')?.addEventListener('change', (e) => setSite('soilType', e.target.value));
    el.querySelector('[data-k="bedph"]')?.addEventListener('change', (e) => setSite('ph', e.target.value));
    el.querySelector('[data-k="bedexposure"]')?.addEventListener('change', (e) => setSite('exposure', e.target.value));
    el.querySelector('[data-k="bedwarm"]')?.addEventListener('change', (e) => setSite('warmWall', e.target.checked));
  }

  /** Omstandigheden van een vak voor samenstellen en controleren. */
  bedCtx(bed) {
    return { btype: bed.btype || null, light: bed.light || null, moisture: bed.moisture || null, scheme: bedScheme(bed, this.doc), source: this.app.plantSource(), require: bed.require || [], site: bed };
  }

  fillChecks(ul, checks) {
    ul.innerHTML = checks.map((c) => `<li class="${c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'open'}" title="${esc(c.text)}"><b>${c.ok === true ? '✓' : c.ok === false ? '✗' : '?'} ${esc(c.label)}</b> <span>${esc(c.text)}</span></li>`).join('');
  }

  /** Zonuren in een vak uit de zonnestudie: gemiddeld per dag, april t/m september, binnen de omtrek van het vak. */
  async measureSun(bed) {
    const poly = shapePolygon(bed);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const pad = 0.2;
    const box = { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    const sun = this.app.sun;
    const { lat, lon } = sun.geo();
    const y = new Date().getFullYear();
    const dates = [4, 5, 6, 7, 8, 9].map((m) => `${y}-${String(m).padStart(2, '0')}-21`);
    this.app.toast('Zonuren meten…', 1500);
    // schaduw van alles met een hoogte: huis, schuur, schuttingen, hagen en bomen
    const casters = collectCasters(this.doc);
    const res = await computeSunHours({ casters, box, dates, lat, lon, northRot: sun.northRot(), maxCells: 60, stepMin: 20 });
    if (!res) return;
    let sum = 0, n = 0;
    const { cols, rows } = res;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const px = box.minX + ((i + 0.5) / cols) * (box.maxX - box.minX), py = box.minY + ((j + 0.5) / rows) * (box.maxY - box.minY);
        if (!pointInPolygon([px, py], poly)) continue;
        sum += res.hours[j * cols + i]; n++;
      }
    }
    if (!n) return;
    const hours = Math.round((sum / n) * 10) / 10;
    const light = lightFromHours(hours);
    this.app.store.mutate(() => { bed.sunHours = hours; bed.light = light; }, 'bedlight');
    const geoNote = this.doc.geo && Number.isFinite(this.doc.geo.lat) ? '' : ' (zonder kaart: gerekend voor het midden van Nederland, noorden boven)';
    this.app.toast(`Gemiddeld ${String(hours).replace('.', ',')} uur zon per dag van april t/m september: ${LIGHTS[light].split(' (')[0].toLowerCase()}${geoNote}.`, 5000);
  }

  /** Voorstel van de samensteller tonen, met checklist; gebruiken of een nieuw voorstel. */
  showProposal(el, bed, seed) {
    const box = $('.proposal', el);
    const ctx = this.bedCtx(bed);
    const keep = box.querySelector('[data-k="keep"]')?.checked ? (bed.planting?.mix || []).map((m) => this.ensure().roles.find((r) => r.id === m.role)?.plant).filter(Boolean) : [];
    const { items, pool } = compose(ctx, seed, keep);
    box.hidden = false;
    const missing = [!ctx.btype && 'het type', !ctx.light && 'de zon', !ctx.moisture && 'de grond'].filter(Boolean);
    const entries = items.map(([id, role, w]) => ({ role: { ...roleFromPlant(plantById(id)), role, code: '' }, w }));
    box.innerHTML = `
      <h4>Voorstel ${seed} <small>gekozen uit ${pool} passende planten</small></h4>
      ${missing.length ? `<p class="hint">Tip: vul ook ${missing.join(' en ')} van het vak in, dan past het voorstel beter.</p>` : ''}
      <ul class="roles prop"></ul>
      <ul class="checks"></ul>
      <label class="check"><input type="checkbox" data-k="keep" ${keep.length ? 'checked' : ''}> Houd de planten die al in het vak staan</label>
      <div class="row add">
        <button type="button" class="primary" data-act="use">Gebruik dit voorstel</button>
        <button type="button" data-act="again">Nog een voorstel</button>
      </div>`;
    const ul = $('.prop', box);
    if (!items.length) ul.innerHTML = '<li class="hint">Geen planten gevonden die aan alle eisen voldoen. Kies een ander kleurenschema of andere grond.</li>';
    for (const [id, role, w] of items) {
      const pl = plantById(id);
      const li = document.createElement('li');
      li.className = 'role';
      li.appendChild(this.thumb(pl, 30));
      const t = document.createElement('div');
      t.className = 'rtxt';
      t.innerHTML = `<b>${esc(pl.nl)}</b> <small>${ROLES[role].name} · ${w}% · ${pl.h} cm · bloei ${bloomText(pl)}</small>`;
      li.appendChild(t);
      ul.appendChild(li);
    }
    this.fillChecks($('.checks', box), checkPlanting(entries, ctx));
    box.querySelector('[data-act="again"]').addEventListener('click', () => this.showProposal(el, bed, seed + 1));
    box.querySelector('[data-k="keep"]').addEventListener('change', () => this.showProposal(el, bed, seed));
    box.querySelector('[data-act="use"]').addEventListener('click', () => {
      this.ensure();
      this.app.store.mutate((doc) => {
        const mix = [];
        for (const [id, role, w] of items) {
          const { role: r, created } = roleForPlant(doc.planting.roles, plantById(id), role);
          if (created) doc.planting.roles.push(r);
          mix.push({ role: r.id, w });
        }
        bed.planting = { ...(bed.planting || {}), mix };
      }, 'compose');
      this.app.toast('Voorstel in het vak gezet. Pas aandelen aan, of verfijn in stap 3 met groepen.', 3500);
    });
  }

  /** Plant uit de database in een vak zetten (als bouwsteen; bestaat die al, dan die). */
  addPlantToBed(bed, pl) {
    const roles = this.ensure().roles;
    const { role, created } = roleForPlant(roles, pl);
    this.app.store.mutate((doc) => {
      if (created) doc.planting.roles.push(role);
      bed.planting = bed.planting || { mix: [] };
      if (!bed.planting.mix.some((m) => m.role === role.id)) bed.planting.mix.push({ role: role.id, w: ROLES[role.role].weight });
    }, 'mix');
    if (!fitsBedType(role.height, bed.btype, role.kind)) this.app.toast(`${pl.nl} past eigenlijk niet bij ${BED_TYPES[bed.btype].name.toLowerCase()} (${HEIGHTS[role.height].range}).`, 3500);
  }

  /** Een vak vullen met een kant-en-klare combinatie. */
  applyCombo(bed, combo, swaps = []) {
    if ((bed.planting?.mix || []).length && !confirm(`"${combo.name}" vervangt wat er nu in dit vak staat. Doorgaan?`)) return;
    this.ensure();
    this.app.store.mutate((doc) => {
      const mix = [];
      for (const [id, roleName, w] of combo.items) {
        const pl = plantById(id);
        if (!pl) continue;
        const { role, created } = roleForPlant(doc.planting.roles, pl, roleName);
        if (created) doc.planting.roles.push(role);
        mix.push({ role: role.id, w });
      }
      bed.planting = { ...(bed.planting || {}), mix };
      if (!bed.btype) bed.btype = combo.btype;
    }, 'combo');
    this.app.toast(`Vak gevuld met "${combo.name}"${swaps.length ? `, aangepast aan dit vak (${swaps.map(([x, y]) => `${x} → ${y}`).join(', ')})` : ''}.`, 4500);
  }

  // ---------------------------------------------------------------- plant kiezen

  /** Venster met de plantendatabase: zoeken en filteren, met wat past bij het vak bovenaan. */
  openPicker({ title, btype = null, light = null, moisture = null, height = '', color = '', traits = [], site = null, onPick }) {
    let dlg = document.getElementById('dlg-plants');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-plants'; document.body.appendChild(dlg); }
    const opt = (o, cur, empty) => `<option value="">${empty}</option>` + Object.entries(o).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`).join('');
    const f = { q: '', type: '', height: height || '', light: light || '', soil: moisture || '', color: color || '', month: '', native: false, bees: false, evergreen: false, onlyFit: !!btype, btype, source: this.app.plantSource() || '', traits: [...traits] };
    // een precieze kleur (uit een kleurencombinatie) zoeken als kleurnaam
    if (/^#[0-9a-f]{6}$/i.test(f.color)) f.color = colorFamily(f.color) || '';
    const esvOn = ESVELD.loaded;
    dlg.innerHTML = `
      <form method="dialog" class="dlg wide picker">
        <header><h2>${esc(title)}</h2><button class="x" value="close">${icon('close')}</button></header>
        <div class="searchrow"><input type="search" data-f="q" placeholder="Naam of cultivar, bijv. salvia caradonna" autocomplete="off" enterkeyhint="search"><button type="button" class="primary" data-act="search">${icon('search', 18)} Zoek</button></div>
        <div class="filters">
          ${esvOn ? `<select data-f="source" title="Uit welke bron"><option value="esveld" ${f.source === 'esveld' ? 'selected' : ''}>Esveld (${ESVELD.count.toLocaleString('nl-NL')} cultivars)</option><option value="" ${f.source === '' ? 'selected' : ''}>Alle planten</option><option value="eigen">Alleen de basislijst</option></select>` : ''}
          <select data-f="type">${opt(PLANT_TYPES, '', 'Alle soorten')}</select>
          <select data-f="height">${opt(Object.fromEntries(Object.entries(HEIGHTS).map(([k, v]) => [k, `${v.name} (${v.range})`])), f.height, 'Elke hoogte')}</select>
          <select data-f="light">${opt({ zon: 'Zon', halfzon: 'Halfzon', half: 'Halfschaduw', schaduw: 'Schaduw' }, f.light, 'Elke standplaats')}</select>
          <select data-f="soil">${opt({ droog: 'Droog', normaal: 'Normaal', vochtig: 'Vochtig' }, f.soil, 'Elke grond')}</select>
          <select data-f="color">${opt({ wit: 'Wit', geel: 'Geel', oranje: 'Oranje', rood: 'Rood', roze: 'Roze', paars: 'Paars', blauw: 'Blauw', groen: 'Groen' }, f.color, 'Elke bloeikleur')}</select>
          <select data-f="month">${opt(Object.fromEntries(MONTH_NAMES.map((m, i) => [String(i + 1), `Bloeit in ${m}`])), '', 'Elke bloeitijd')}</select>
          ${btype ? `<label class="check"><input type="checkbox" data-f="onlyFit" checked> Alleen wat past bij ${esc(BED_TYPES[btype].name.toLowerCase())}</label>` : ''}
        </div>
        <div class="tfilters" title="Alleen planten met al deze eigenschappen">${['structuur', 'eetbaar', 'klimmer', 'leiden', 'wintergroen', 'geur', 'bijen', 'vogels', 'inheems', 'windvast', 'inkijk', 'bodem', 'weef'].map((k) => `<button type="button" class="chip${f.traits.includes(k) ? ' on' : ''}" data-tf="${k}" title="${esc(TRAITS[k].hint)}">${esc(TRAITS[k].name)}</button>`).join('')}</div>
        ${traits.length ? `<p class="hint">Eisen van dit vak staan aan: ${traits.map((k) => esc(TRAITS[k].short)).join(', ')}. Zet ze uit om ervan af te wijken.</p>` : ''}
        <div class="activef"></div>
        <p class="hint count"></p>
        <ul class="plantlist"></ul>
        <footer><span class="spacer"></span><button value="close">Annuleren</button></footer>
      </form>`;
    const list = $('.plantlist', dlg);
    const FILTER_NAMES = { q: 'zoekwoord', type: 'soort', height: 'hoogte', light: 'standplaats', soil: 'grond', color: 'bloeikleur', month: 'bloeitijd', onlyFit: 'past bij het vak', source: 'alleen Esveld' };
    // bediening en de balk met actieve filters laten zien wat er nu geldt
    const sync = () => {
      for (const inp of dlg.querySelectorAll('[data-f]')) {
        const key = inp.dataset.f;
        if (inp.type === 'checkbox') inp.checked = !!f[key]; else if (inp.value !== (f[key] ?? '')) inp.value = f[key] ?? '';
        if (inp.tagName === 'SELECT') inp.classList.toggle('active', !!f[key] && key !== 'source');
      }
      for (const tb of dlg.querySelectorAll('[data-tf]')) tb.classList.toggle('on', f.traits.includes(tb.dataset.tf));
      const label = (key) => { const sel = dlg.querySelector(`select[data-f="${key}"]`); return sel ? sel.options[sel.selectedIndex]?.text : f[key]; };
      const chips = [];
      if (f.q) chips.push(['q', `“${f.q}”`]);
      for (const key of ['type', 'height', 'light', 'soil', 'color', 'month']) if (f[key]) chips.push([key, label(key)]);
      if (f.onlyFit && btype) chips.push(['onlyFit', `past bij ${BED_TYPES[btype].label.toLowerCase()}`]);
      for (const k of f.traits) chips.push([`t:${k}`, TRAITS[k].name]);
      const af = $('.activef', dlg);
      af.innerHTML = chips.length
        ? `<span>Actieve filters:</span>${chips.map(([k, t]) => `<button type="button" class="chip on" data-clear="${k}" title="Dit filter weghalen">${esc(t)} ×</button>`).join('')}<button type="button" class="link" data-clear="all">Alle filters wissen</button>`
        : `<span>Geen filters${f.source === 'esveld' ? ' (alleen de Esveld-catalogus)' : ''}.</span>`;
      for (const b of af.querySelectorAll('[data-clear]')) b.addEventListener('click', () => clear(b.dataset.clear));
    };
    const clear = (k) => {
      if (k === 'all') { f.q = ''; for (const x of ['type', 'height', 'light', 'soil', 'color', 'month']) f[x] = ''; f.traits = []; f.onlyFit = false; }
      else if (k.startsWith('t:')) f.traits = f.traits.filter((x) => x !== k.slice(2));
      else f[k] = k === 'onlyFit' ? false : '';
      show();
    };
    const show = () => {
      sync();
      const res = searchPlants(f);
      const cnt = $('.count', dlg);
      if (res.length) {
        cnt.textContent = `${res.length} planten${res.length > 150 ? ', de eerste 150 getoond' : ''}. Tik op een plant om hem te kiezen.`;
      } else {
        // welk filter is te streng? Laat zien wat er overblijft zonder elk filter apart
        const loose = [];
        for (const k of ['color', 'height', 'light', 'soil', 'month', 'type', 'onlyFit', 'source', 'q']) {
          if (!f[k]) continue;
          const n = searchPlants({ ...f, [k]: k === 'onlyFit' ? false : '' }).length;
          if (n) loose.push({ k, n, name: FILTER_NAMES[k] });
        }
        for (const k of f.traits) {
          const n = searchPlants({ ...f, traits: f.traits.filter((x) => x !== k) }).length;
          if (n) loose.push({ k: `t:${k}`, n, name: TRAITS[k].short });
        }
        cnt.innerHTML = `Geen planten met al deze filters. ${loose.length ? `Laat er een los: ${loose.map((x) => `<button type="button" class="link" data-loose="${x.k}">zonder ${esc(x.name)} (${x.n})</button>`).join(' · ')} · ` : ''}<button type="button" class="link" data-loose="all">alle filters wissen</button>`;
        for (const b of cnt.querySelectorAll('[data-loose]')) b.addEventListener('click', () => clear(b.dataset.loose));
      }
      list.innerHTML = '';
      // in porties van 150 (elke plant krijgt een eigen tekeningetje); onderaan laden de volgende vanzelf
      const addItem = (p, fits) => {
        const li = document.createElement('li');
        li.className = 'plant' + (fits ? '' : ' unfit');
        li.appendChild(this.thumb(p, 48));
        const t = document.createElement('div');
        t.className = 'ptxt';
        const tr = plantTraits(p);
        const tags = ['structuur', 'eetbaar', 'klimmer', 'leiden', 'wintergroen', 'geur', 'bijen', 'vogels', 'inheems'].filter((k) => tr.has(k)).map((k) => (k === 'klimmer' || k === 'eetbaar' || k === 'structuur' ? `${TRAITS[k].short} (${tr.get(k)})` : TRAITS[k].short));
        const sun = p.light.map((l) => ({ zon: '☀', half: '◐', schaduw: '●' }[l])).join('');
        const e = p.esv;
        const size = (cm) => (cm >= 300 ? `${String(Math.round(cm / 10) / 10).replace('.', ',')} m` : `${cm} cm`);
        t.innerHTML = `<b>${esc(p.nl)}</b> <i>${esc(p.lat)}</i><small>${PLANT_TYPES[p.type]} · ${size(p.h)} hoog, ${size(p.w)} breed · <span title="Standplaats">${sun}</span> · bloei ${bloomText(p)}${e?.perM2 ? ` · ${String(e.perM2).replace('.', ',')}/m²` : ''}${tags.length ? ' · ' + tags.join(', ') : ''}${fits ? '' : ` · <em>past niet bij ${esc(BED_TYPES[btype].label.toLowerCase())}</em>`}${site ? siteProblems(p, site).map((x) => ` · <em>${esc(x)}</em>`).join('') : ''}</small>${e ? `<small class="esv">Esveld${e.price != null ? ` · vanaf ${e.price.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}` : ''}${e.sizes.length ? ` · ${esc(e.sizes.slice(0, 3).join(', '))}` : ''}${e.hard ? ` · ${esc(e.hard)}` : ''} · <a href="${e.url}" target="_blank" rel="noopener">bekijk ↗</a></small>` : p.esvSearch ? `<small class="esv">Esveld heeft ${p.esvSearch.n} cultivar${p.esvSearch.n > 1 ? 's' : ''} van deze ${p.esvSearch.what} · <a href="${p.esvSearch.url}" target="_blank" rel="noopener">aanbod ↗</a></small>` : ''}`;
        t.querySelector('a')?.addEventListener('click', (ev) => ev.stopPropagation());
        li.appendChild(t);
        const sw = document.createElement('i');
        sw.className = 'pcolor'; sw.style.background = p.bloom.length ? p.color : 'transparent';
        li.appendChild(sw);
        li.addEventListener('click', () => { dlg.close(); onPick(p); });
        list.appendChild(li);
      };
      let shown = 0;
      const more = document.createElement('li');
      more.className = 'more';
      const batch = () => {
        more.remove();
        for (const { p, fits } of res.slice(shown, shown + 150)) addItem(p, fits);
        shown = Math.min(res.length, shown + 150);
        if (shown < res.length) {
          more.innerHTML = `<button type="button">Toon meer (${Math.min(150, res.length - shown)} van de ${res.length - shown} die nog volgen)</button>`;
          more.firstChild.addEventListener('click', batch);
          list.appendChild(more);
        }
        cnt.dataset.shown = String(shown);
        if (res.length) cnt.textContent = `${res.length} planten${shown < res.length ? `, ${shown} getoond (scroll door voor meer)` : ''}. Tik op een plant om hem te kiezen.`;
      };
      this.pickerObserver?.disconnect();
      this.pickerObserver = new window.IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting) && more.isConnected) batch(); }, { root: list, rootMargin: '300px' });
      this.pickerObserver.observe(more);
      batch();
    };
    for (const b of dlg.querySelectorAll('[data-tf]')) {
      b.addEventListener('click', () => {
        const k = b.dataset.tf;
        f.traits = f.traits.includes(k) ? f.traits.filter((x) => x !== k) : [...f.traits, k];
        b.classList.toggle('on', f.traits.includes(k));
        show();
      });
    }
    for (const inp of dlg.querySelectorAll('[data-f]')) {
      const ev = inp.type === 'search' ? 'input' : 'change';
      inp.addEventListener(ev, () => { f[inp.dataset.f] = inp.type === 'checkbox' ? inp.checked : inp.value; show(); });
    }
    show();
    dlg.showModal();
    // Enter in het zoekveld sluit het venster niet (de lijst filtert al bij het typen)
    const search = () => { f.q = $('[data-f="q"]', dlg).value; show(); $('[data-f="q"]', dlg).blur(); list.scrollTop = 0; };
    $('[data-f="q"]', dlg).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    $('[data-act="search"]', dlg).addEventListener('click', search);
    $('form', dlg).addEventListener('submit', (e) => { if (e.submitter?.value !== 'close') e.preventDefault(); });
    setTimeout(() => $('[data-f="q"]', dlg)?.focus(), 50);
  }

  // ---------------------------------------------------------------- bouwsteen bewerken

  editRole(id) {
    const pl = this.ensure();
    const r = pl.roles.find((x) => x.id === id);
    if (!r) return;
    const dlg = $('#dlg-role');
    const form = $('form', dlg);
    const sel = (k, opts, val) => `<select data-k="${k}">${Object.entries(opts).map(([key, v]) => `<option value="${key}" ${val === key ? 'selected' : ''}>${v.name}${v.range ? ` (${v.range})` : ''}</option>`).join('')}</select>`;
    const palette = schemePalette(pl.scheme);
    form.innerHTML = `
      <header><h2>Bouwsteen ${esc(r.code)}</h2><button class="x" value="close">${icon('close')}</button></header>
      <div class="role-preview"></div>
      <div class="row"><button type="button" data-act="choose" title="De eigenschappen van een echte plant uit de database overnemen">${r.plant ? 'Andere plant kiezen…' : 'Kies een plant uit de database…'}</button>${r.plant ? `<small class="hint">gebaseerd op ${esc(plantById(r.plant)?.lat || '')}</small>` : ''}</div>
      <label>Omschrijving (optioneel)<input type="text" data-k="label" value="${esc(r.label || '')}" placeholder="${esc(describeRole({ ...r, label: '' }))}"></label>
      <div class="grid2">
        <label>Rol in het vak${sel('role', ROLES, r.role)}</label>
        <label>Hoogte${sel('height', HEIGHTS, r.height)}</label>
        <label>Groeivorm${sel('habit', HABITS, r.habit)}</label>
        <label>Bloei- / zaadvorm${sel('form', FORMS, r.form)}</label>
      </div>
      <label>Bloeikleur <span class="inline-hint">kleuren uit het schema</span>
        <div class="swatch-row">${palette.map((c) => `<button type="button" class="sw ${c === r.color ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
          <input type="color" data-k="color" value="${r.color}" title="Eigen kleur"></div>
      </label>
      <label>Bloeimaanden
        <div class="months">${MONTHS.map((m, i) => `<button type="button" class="${r.bloom.includes(i + 1) ? 'on' : ''}" data-month="${i + 1}">${m}</button>`).join('')}</div>
      </label>
      <div class="grid2">
        <label>Blad${sel('foliage', FOLIAGE, r.foliage)}</label>
        <label>Herfstkleur${sel('autumn', AUTUMN, r.autumn)}</label>
        <label>In de winter${sel('winter', WINTER, r.winter)}</label>
        <label>Standplaats
          <div class="checks">${['zon', 'halfschaduw', 'schaduw'].map((l) => `<label class="check"><input type="checkbox" data-light="${l}" ${r.light?.includes(l) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        </label>
      </div>
      <footer>
        <button type="button" class="danger" data-act="delete">${icon('trash', 18)} Verwijderen</button>
        <span class="spacer"></span>
        <button value="close" class="primary">Klaar</button>
      </footer>`;
    const draft = JSON.parse(JSON.stringify(r));
    let deleted = false;
    const preview = () => {
      const box = $('.role-preview', form);
      box.innerHTML = '';
      box.appendChild(this.thumb(draft, 64));
      box.appendChild(this.symbol(draft, 40));
      const strip = document.createElement('div');
      strip.className = 'strip';
      for (let m = 1; m <= 12; m++) {
        const st = monthState(draft, m);
        const i = document.createElement('i');
        i.style.background = st.color || 'transparent';
        i.style.opacity = 0.35 + 0.65 * st.interest;
        i.title = `${MONTH_NAMES[m - 1]}: ${st.kind}`;
        strip.appendChild(i);
      }
      box.appendChild(strip);
    };
    preview();
    form.onchange = (e) => {
      const k = e.target.dataset.k;
      if (k) draft[k] = e.target.value;
      if (e.target.dataset.light) draft.light = [...form.querySelectorAll('[data-light]')].filter((x) => x.checked).map((x) => x.dataset.light);
      if (k === 'role' && draft.code[0] !== ROLES[draft.role].prefix) {
        let n = 1;
        while (pl.roles.some((x) => x.id !== draft.id && x.code === `${ROLES[draft.role].prefix}${n}`)) n++;
        draft.code = `${ROLES[draft.role].prefix}${n}`;
        $('h2', form).textContent = `Bouwsteen ${draft.code}`;
      }
      if (k === 'color') form.querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', b.dataset.color === draft.color));
      preview();
    };
    form.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.color) {
        draft.color = b.dataset.color;
        form.querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === b));
        $('[data-k="color"]', form).value = draft.color;
        preview();
      } else if (b.dataset.month) {
        const m = Number(b.dataset.month);
        draft.bloom = draft.bloom.includes(m) ? draft.bloom.filter((x) => x !== m) : [...draft.bloom, m].sort((a, c) => a - c);
        b.classList.toggle('on');
        preview();
      } else if (b.dataset.act === 'choose') {
        this.openPicker({
          title: `Plant kiezen voor bouwsteen ${draft.code}`,
          onPick: (pl) => {
            Object.assign(draft, roleFromPlant(pl));
            done = true;
            this.app.store.mutate((doc) => {
              const i = doc.planting.roles.findIndex((x) => x.id === id);
              if (i >= 0) doc.planting.roles[i] = JSON.parse(JSON.stringify(draft));
            }, 'role');
            dlg.close();
            setTimeout(() => this.editRole(id), 30);
          },
        });
      } else if (b.dataset.act === 'delete') {
        const used = this.doc.layers.some((l) => l.items.some((i) => i.role === id || i.planting?.mix?.some((m) => m.role === id)));
        if (used && !confirm(`${r.code} staat in de tekening. Verwijderen haalt ook die planten weg. Doorgaan?`)) return;
        this.app.store.mutate((doc) => {
          doc.planting.roles = doc.planting.roles.filter((x) => x.id !== id);
          for (const l of doc.layers) {
            l.items = l.items.filter((i) => i.type !== 'plant' || i.role !== id);
            for (const i of l.items) if (i.type === 'stencil' && i.role === id) delete i.role;
            for (const i of l.items) if (i.planting?.mix) i.planting.mix = i.planting.mix.filter((m) => m.role !== id);
          }
        }, 'role-delete');
        deleted = true;
        done = true;
        dlg.close('deleted');
      }
    };
    // Opslaan direct bij "Klaar" (submit, synchroon) of bij sluiten met Esc/achtergrond.
    // Een laat sluit-signaal van een vorig venster wordt genegeerd (token).
    const token = {};
    this.roleToken = token;
    let done = false;
    const commit = () => {
      if (done || this.roleToken !== token) return;
      done = true;
      form.onclick = null;
      form.onchange = null;
      form.onsubmit = null;
      if (deleted) return;
      const cur = this.ensure().roles.find((x) => x.id === id);
      if (cur && JSON.stringify(cur) !== JSON.stringify(draft)) {
        this.app.store.mutate((doc) => {
          const i = doc.planting.roles.findIndex((x) => x.id === id);
          if (i >= 0) doc.planting.roles[i] = JSON.parse(JSON.stringify(draft));
        }, 'role');
      } else {
        this.render();
      }
    };
    form.onsubmit = () => commit();
    dlg.onclose = () => commit();
    dlg.returnValue = '';
    dlg.showModal();
  }
}

export function bloomText(r) {
  if (!r.bloom?.length) return 'geen';
  const b = [...r.bloom].sort((a, c) => a - c);
  return b.length === 1 ? MONTHS[b[0] - 1] : `${MONTHS[b[0] - 1]}–${MONTHS[b[b.length - 1] - 1]}`;
}

export function hueKey(c) {
  const [h, s] = hexToHsl(c);
  return s < 0.18 ? 999 : h;
}

/** Adviezen over afwisseling in rol, hoogte, groeivorm en bloeivorm (op oppervlak). */
export function mixAdvice(roles, areas) {
  const tot = roles.reduce((s, r) => s + (areas[r.id] || 0), 0);
  if (!tot) return [];
  const share = (key) => {
    const m = {};
    for (const r of roles) m[r[key]] = (m[r[key]] || 0) + (areas[r.id] || 0) / tot;
    return m;
  };
  const out = [];
  const role = share('role');
  if ((role.structuur || 0) < 0.15) out.push('Weinig <b>structuurplanten</b> (minder dan 15%); het vak kan aan het eind van het seizoen rommelig ogen.');
  if ((role.vulling || 0) < 0.35) out.push('Weinig <b>vulling</b>; een matrix van een paar soorten houdt het geheel rustig en bedekt de grond.');
  const pick = (m, names) => Object.entries(m).filter(([, v]) => v > 0.6).map(([k]) => names[k]?.name.split(' /')[0].toLowerCase());
  const habit = pick(share('habit'), HABITS);
  if (habit.length) out.push(`Meer dan 60% heeft dezelfde groeivorm (<b>${habit[0]}</b>); afwisseling geeft meer spanning.`);
  const form = pick(share('form'), FORMS);
  if (form.length) out.push(`Meer dan 60% heeft dezelfde bloeivorm (<b>${form[0]}</b>); combineer bijvoorbeeld aren met schermen of schijfbloemen.`);
  const hs = share('height');
  if (Object.values(hs).filter((v) => v > 0.05).length < 2) out.push('Alles is ongeveer even hoog; varieer in hoogte voor diepte en ritme.');
  if (!out.length) out.push('Goede afwisseling in rol, hoogte, groeivorm en bloeivorm.');
  return out;
}

/** Staafjes per maand: hoeveel er te zien is en in welke kleuren. onClick(m) maakt ze aanklikbaar. */
export function yearBars(year, yr, month, onClick) {
  for (const m of yr.months) {
    const col = document.createElement(onClick ? 'button' : 'div');
    if (onClick) col.type = 'button';
    col.className = 'ymonth' + (month === m.m ? ' on' : '') + (yr.total && m.score < 0.3 ? ' low' : '') + (onClick ? '' : ' ro');
    col.title = `${MONTH_NAMES[m.m - 1]}: ${Math.round(m.score * 100)}% interessant`;
    const bar = document.createElement('span');
    bar.className = 'ybar';
    const tot = Object.values(m.colors).reduce((s, v) => s + v, 0) || 1;
    bar.style.height = `${Math.max(2, Math.round(m.score * 100))}%`;
    bar.innerHTML = Object.entries(m.colors).sort((a, b) => hueKey(a[0]) - hueKey(b[0]))
      .map(([c, v]) => `<i style="background:${c};flex:${v / tot}"></i>`).join('');
    col.appendChild(bar);
    const lab = document.createElement('small');
    lab.textContent = MONTHS[m.m - 1];
    col.appendChild(lab);
    if (onClick) col.addEventListener('click', () => onClick(m.m));
    year.appendChild(col);
  }
}
