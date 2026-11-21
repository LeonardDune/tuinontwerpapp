// Paneel "Beplanting": kleurenschema, bouwstenen, jaarrond-overzicht en kleurcirkel.

import {
  HEIGHTS, HABITS, FORMS, ROLES, FOLIAGE, AUTUMN, WINTER, SCHEMES, MONTHS, MONTH_NAMES,
  schemePalette, inScheme, newRole, describeRole, drawRoleSymbol, roleDiameter, yearRound, hexToHsl, monthState,
  plantCounts, isBed, isGroup, BED_TYPES, shapePolygon, roleForPlant,
} from './planting.js';
import { PLANT_TYPES, searchPlants, plantById, fitsBedType, roleFromPlant } from './plantdb.js';
import { combosFor } from './combos.js';
import { drawPlant } from './plantdraw.js';
import { drawStencil, STENCIL_MAP } from './stencils.js';
import { checkPlanting, compose, adaptItems, lightFromHours, LIGHTS, MOISTURES } from './composer.js';
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
    $('#btn-planting').addEventListener('click', () => (this.el.hidden ? this.open() : this.close()));
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
    this.el.hidden = false;
    // met een plantvak geselecteerd begin je bij het invullen
    if (this.scopeBed() && this.step() === 1) this.app.state.plantStep = 2;
    $('#btn-planting').classList.add('on');
    document.body.classList.add('side-open');
    this.render();
  }

  close() {
    this.el.hidden = true;
    $('#btn-planting').classList.remove('on');
    document.body.classList.remove('side-open');
    if (this.month) this.setMonth(null);
  }

  setMonth(m) {
    this.month = m;
    this.app.baseDirty = true;
    this.app.requestRender();
    if (!this.el.hidden) this.render();
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
    const sel = [...this.app.selection];
    if (sel.length !== 1) return null;
    const it = this.app.store.findItem(sel[0])?.item;
    if (!it) return null;
    if (isBed(it)) return it;
    if (isGroup(it)) return this.app.store.findItem(it.bedId)?.item || null;
    return null;
  }

  render() {
    const p = this.ensure();
    const bed = this.scopeBed();
    const yr = yearRound(this.doc, bed?.id || null);
    const counts = plantCounts(this.doc, bed?.id || null);
    const view = this.app.state.plantView || 'planten';
    const palette = schemePalette(p.scheme);
    const off = p.roles.filter((r) => !inScheme(r.color, p.scheme));
    const low = yr.total ? yr.months.filter((m) => m.score < 0.3) : [];
    const el = this.el;
    const step = this.step();
    const beds = this.beds();
    const stepBtn = (n, t) => `<button type="button" data-step="${n}" class="${step === n ? 'on' : ''}"><b>${n}</b> ${t}</button>`;
    el.innerHTML = `
      <div class="panel-head">
        <h2>Beplanting</h2>
        <button class="tb" data-act="close" title="Sluiten">${icon('close')}</button>
      </div>
      <nav class="steps">${stepBtn(1, 'Schetsen')}${stepBtn(2, 'Invullen')}${stepBtn(3, 'Verfijnen')}</nav>
      <section class="step-intro">${[
        '',
        '<p><b>Schets de beplanting.</b> Teken plantvakken en geef elk vak een <b>type</b>: hoe hoog wordt het ongeveer? Welke planten erin komen, kies je in stap 2.</p>',
        '<p><b>Vul de vakken.</b> Selecteer een vak en kies planten uit de database of een kant-en-klare combinatie. Wat bij het type past, staat bovenaan.</p>',
        '<p><b>Maak het af.</b> Leg vlekken (groepen) van structuurplanten en accenten in een vak, zet losse solitairen, en kijk hoe de tuin er het hele jaar uitziet.</p>',
      ][step]}</section>
      ${step === 1 ? `<section>
        <h3>Type voor nieuwe vakken</h3>
        <div class="btypes">${Object.entries(BED_TYPES).map(([k, v]) => `<button type="button" data-btype="${k}" class="${(this.app.state.bedType || '') === k ? 'on' : ''}" title="${esc(v.name)}${v.examples ? ` (${esc(v.examples)})` : ''}"><i style="background:${v.color}"></i>${esc(v.label)}<small>${v.range}</small></button>`).join('')}</div>
        <div class="row add">
          <button type="button" class="primary" data-tool="vak">${icon('area', 16)} Plantvak tekenen</button>
        </div>
        <p class="hint">De vorm kies je onderin: vrij, rechthoek, cirkel, boog, of <b>tik in ruimte</b> (het vak volgt de lijnen eromheen). Is er een vak geselecteerd, dan krijgt dat vak het gekozen type.</p>
      </section>` : ''}
      ${step <= 2 && !(step === 2 && bed) ? `<section>
        <h3>Plantvakken <small>${beds.length ? `${beds.length} in de tekening` : ''}</small></h3>
        <ul class="bedlist"></ul>
      </section>` : ''}
      <section>
        <div class="row">
          <div class="seg" title="Weergave van plantvakken en groepen">
            <button type="button" data-view="planten" class="${view === 'planten' ? 'on' : ''}" title="Impressie: de planten zoals ze er (in de gekozen maand) uitzien">Impressie</button>
            <button type="button" data-view="symbolen" class="${view === 'symbolen' ? 'on' : ''}" title="Plansymbolen: technisch beplantingsplan met codes">Symbolen</button>
            <button type="button" data-view="groepen" class="${view === 'groepen' ? 'on' : ''}" title="Groepen: vlakken per mix, met aantallen">Groepen</button>
          </div>
          <small class="scope">${bed ? `Overzicht: <b>${bed.name ? esc(bed.name) : 'dit plantvak'}</b>` : 'Overzicht: hele tuin'}</small>
        </div>
      </section>
      ${step !== 2 ? '' : bed ? `<section class="bedsec">
        <h3>Dit vak <small>${bed.name ? esc(bed.name) : ''}</small></h3>
        <label class="row">Type
          <select data-k="bedtype">${[['', 'nog open'], ...Object.entries(BED_TYPES).map(([k, v]) => [k, `${v.name} (${v.range})`])].map(([k, n]) => `<option value="${k}" ${(bed.btype || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <label class="row">Zon
          <select data-k="bedlight">${[['', 'nog onbekend'], ...Object.entries(LIGHTS)].map(([k, n]) => `<option value="${k}" ${(bed.light || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <button type="button" data-act="measure" title="Meet de zonuren in dit vak met de zonnestudie (gemiddeld per dag, april t/m september)">☀ Meet</button>
        </label>
        ${bed.sunHours != null ? `<p class="hint sunh">Zonnestudie: gemiddeld <b>${String(bed.sunHours).replace('.', ',')} uur</b> zon per dag (apr–sep).</p>` : ''}
        <label class="row">Grond
          <select data-k="bedmoist">${[['', 'nog onbekend'], ...Object.entries(MOISTURES)].map(([k, n]) => `<option value="${k}" ${(bed.moisture || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <ul class="checks"></ul>
        <ul class="roles mixlist"></ul>
        <div class="row add">
          <button type="button" class="primary" data-act="compose" title="Laat de app planten kiezen die passen bij hoogte, zon, grond en kleurenschema, met bloei door het jaar en afwisseling in vorm">Stel een beplanting samen</button>
          <button type="button" data-act="addplant" title="Kies een plant uit de plantendatabase; hij komt in dit vak">+ Plant toevoegen</button>
          <button type="button" data-act="combos" title="Vul het vak met een kant-en-klare plantcombinatie (aangepast aan dit vak)">Vul met een combinatie</button>
        </div>
        <div class="proposal" hidden></div>
        <div class="combos" hidden></div>
      </section>` : `<section class="bedsec"><p class="hint">Tik op een plantvak in de tekening of in de lijst hierboven om het te vullen.</p></section>`}
      ${step === 3 ? `<section>
        <h3>Groepen en solitairen ${bed ? `<small>${bed.name ? esc(bed.name) : 'dit vak'}</small>` : ''}</h3>
        <div class="row add">
          ${bed ? '<button type="button" class="primary" data-plan="suggest" title="Vlekken (drifts) van structuurplanten en accenten voorstellen in dit vak">Stel groepen voor</button>' : ''}
          <button type="button" data-tool="groep" title="Zelf een vlek van één of een paar soorten tekenen, binnen een plantvak">Groep tekenen</button>
          <button type="button" data-tool="plant" title="Eén losse plant of boom zetten (mag overal)">Solitair zetten</button>
        </div>
        <p class="hint">${bed ? 'Groepen liggen bovenop de basis van het vak. Hun inhoud kies je in de balk als je een groep selecteert.' : 'Selecteer een plantvak om er groepen in te laten voorstellen.'}</p>
      </section>` : ''}
      <section data-in="1">
        <h3>Schets: soorten plantvak</h3>
        <div class="sketch"></div>
      </section>
      <details data-in="2" ${p.scheme.type !== 'vrij' ? 'open' : ''}><summary>Kleurenschema <small>${esc(SCHEMES[p.scheme.type]?.name || '')}</small></summary><section>
        <div class="row">
          <select data-k="scheme">${Object.entries(SCHEMES).map(([k, v]) => `<option value="${k}" ${p.scheme.type === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select>
          <input type="color" data-k="base" value="${p.scheme.base}" title="Basiskleur" ${['vrij', 'warm', 'koel', 'wit'].includes(p.scheme.type) ? 'hidden' : ''}>
        </div>
        <div class="palette">${palette.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
      </section></details>
      <details data-in="2" ${bed ? '' : 'open'}><summary>Alle bouwstenen in deze tuin <small>${p.roles.length}</small></summary><section>
        <ul class="roles"></ul>
        <div class="row add">
          <button type="button" data-act="pickrole" class="primary" title="Een bouwsteen maken van een echte plant uit de plantendatabase">+ Plant uit de database</button>
          ${Object.entries(ROLES).map(([k, v]) => `<button type="button" data-add="${k}" title="Een eigen bouwsteen zonder soort (${v.note})">+ ${v.name}</button>`).join('')}
        </div>
      </section></details>
      <section data-in="3">
        <h3>Het hele jaar <small>${this.month ? MONTH_NAMES[this.month - 1] : 'tik een maand om de tekening zo te zien'}</small></h3>
        <div class="year"></div>
        <div class="row month-row">
          <button type="button" data-act="prev" title="Vorige maand">‹</button>
          <button type="button" data-act="bloom" class="${this.month ? '' : 'on'}">Bloeikleur</button>
          <button type="button" data-act="next" title="Volgende maand">›</button>
        </div>
        <canvas class="wheel" width="300" height="300"></canvas>
        <div class="advice"></div>
      </section>
      ${step < 3 ? `<div class="row next"><button type="button" class="primary" data-step="${step + 1}">Verder: ${step === 1 ? '2 Invullen' : '3 Verfijnen'} ›</button></div>` : ''}`;
    // onderdelen die alleen bij één stap horen
    for (const sec of el.querySelectorAll('[data-in]')) if (Number(sec.dataset.in) !== step) sec.hidden = true;

    // schets: oppervlakte per type plantvak
    const sk = {};
    let open = 0;
    for (const l of this.doc.layers) {
      if (!l.visible) continue;
      for (const it of l.items) {
        if (!isBed(it) || (bed && it.id !== bed.id)) continue;
        const a = Math.abs(polygonArea(shapePolygon(it)));
        if (BED_TYPES[it.btype]) sk[it.btype] = (sk[it.btype] || 0) + a; else open += a;
      }
    }
    const m2 = (v) => `${v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)} m²`;
    $('.sketch', el).innerHTML = (Object.keys(sk).length || open
      ? `<ul class="sk">${Object.entries(BED_TYPES).filter(([k]) => sk[k]).map(([k, v]) => `<li><i style="background:${v.color}"></i>${v.name} <small>${v.range}</small><b>${m2(sk[k])}</b></li>`).join('')}${open ? `<li><i style="background:#cdb9a4"></i>Nog open<b>${m2(open)}</b></li>` : ''}</ul>`
      : '') + '<p class="hint">Kies bij een plantvak het <b>Type</b> (beloopbaar groen, bodembedekkers, laag, middelhoog, hoog, heesters) voor de ruwe schets. Welke planten erin komen, voeg je later toe met de bouwstenen hieronder.</p>';

    // bouwstenen
    const ul = $('.roles:not(.mixlist)', el);
    const areas = yr.areas;
    if (!p.roles.length) ul.innerHTML = '<li class="hint">Nog geen bouwstenen. Begin met een paar structuurplanten en een vulling.</li>';
    for (const r of p.roles) {
      const li = document.createElement('li');
      li.className = 'role' + (this.app.state.plantRole === r.id ? ' active' : '');
      li.appendChild(view === 'symbolen' ? this.symbol(r, 34, this.month) : this.thumb(r, 34, this.month));
      const txt = document.createElement('div');
      txt.className = 'rtxt';
      const a = areas[r.id];
      const n = counts[r.id];
      txt.innerHTML = `<b>${esc(r.code)}</b> ${esc(describeRole(r))}<small>${ROLES[r.role].name} · bloei ${bloomText(r)}${a ? ` · ${a < 10 ? a.toFixed(1).replace('.', ',') : Math.round(a)} m²` : ''}${n ? ` · ${n} st.` : ''}${inScheme(r.color, p.scheme) ? '' : ' · <em>buiten schema</em>'}</small>`;
      li.appendChild(txt);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.title = 'Bewerken';
      edit.innerHTML = icon('pen', 18);
      edit.addEventListener('click', (e) => { e.stopPropagation(); this.editRole(r.id); });
      li.appendChild(edit);
      li.addEventListener('click', () => {
        this.app.state.plantRole = r.id;
        this.app.persistSettings();
        if (this.app.state.tool !== 'plant') this.app.setTool('plant');
        else this.app.renderOptions();
        this.render();
      });
      ul.appendChild(li);
    }

    // jaarrond-balken
    const year = $('.year', el);
    for (const m of yr.months) {
      const col = document.createElement('button');
      col.type = 'button';
      col.className = 'ymonth' + (this.month === m.m ? ' on' : '') + (yr.total && m.score < 0.3 ? ' low' : '');
      col.title = `${MONTH_NAMES[m.m - 1]}: ${Math.round(m.score * 100)}% interessant`;
      const bar = document.createElement('span');
      bar.className = 'ybar';
      const tot = Object.values(m.colors).reduce((s, v) => s + v, 0) || 1;
      const h = Math.round(m.score * 100);
      bar.style.height = `${Math.max(2, h)}%`;
      bar.innerHTML = Object.entries(m.colors).sort((a, b) => hueKey(a[0]) - hueKey(b[0]))
        .map(([c, v]) => `<i style="background:${c};flex:${v / tot}"></i>`).join('');
      col.appendChild(bar);
      const lab = document.createElement('small');
      lab.textContent = MONTHS[m.m - 1];
      col.appendChild(lab);
      col.addEventListener('click', () => this.setMonth(this.month === m.m ? null : m.m));
      year.appendChild(col);
    }

    // advies
    const adv = [];
    if (!yr.total) adv.push('Plaats bouwstenen of plantvakken met het gereedschap Beplanten om het jaarrond-overzicht te vullen.');
    if (low.length) {
      const names = low.map((m) => MONTHS[m.m - 1]).join(', ');
      const winter = low.some((m) => m.m <= 3 || m.m >= 11);
      adv.push(`Weinig te zien in <b>${names}</b>.${winter ? ' Denk aan wintergroen, planten met een mooi silhouet of zaaddozen, of vroege bloeiers.' : ' Voeg een bouwsteen toe die dan bloeit.'}`);
    }
    if (off.length) adv.push(`Buiten het kleurenschema: <b>${off.map((r) => esc(r.code)).join(', ')}</b>.`);
    const mixAdv = mixAdvice(p.roles, areas);
    adv.push(...mixAdv);
    $('.advice', el).innerHTML = adv.map((t) => `<p>${t}</p>`).join('');

    this.drawWheel($('.wheel', el), p, areas);
    if (bed && step === 2) this.renderBed(el, bed);
    el.querySelector('[data-act="pickrole"]').addEventListener('click', () => this.openPicker({
      title: 'Plant kiezen voor een nieuwe bouwsteen',
      onPick: (pl) => {
        const roles = this.ensure().roles;
        const { role, created } = roleForPlant(roles, pl);
        if (created) this.mutate((x) => { x.roles.push(role); });
        this.app.state.plantRole = role.id;
        this.app.persistSettings();
        this.app.toast(created ? `Bouwsteen ${role.code}: ${pl.nl}. Kies Beplanten om hem te plaatsen, of zet hem in een vak.` : `${pl.nl} is al bouwsteen ${role.code}.`, 3500);
        this.render();
      },
    }));

    // gebeurtenissen
    el.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    for (const b of el.querySelectorAll('[data-step]')) b.addEventListener('click', () => { this.app.state.plantStep = Number(b.dataset.step); this.app.persistSettings(); this.render(); });
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
        this.app.toast({ vak: 'Teken een plantvak in de tekening (vorm kiezen onderin).', groep: 'Teken een groep binnen een plantvak.', plant: 'Tik in de tekening om een solitair te zetten; kies de plant onderin of bij de bouwstenen.' }[b.dataset.tool], 3000);
      });
    }
    el.querySelector('[data-plan="suggest"]')?.addEventListener('click', () => this.app.planAction('suggest'));
    const bl = $('.bedlist', el);
    if (bl) {
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
          this.render();
        });
        bl.appendChild(li);
      }
    }
    for (const b of el.querySelectorAll('[data-view]')) {
      b.addEventListener('click', () => {
        this.app.state.plantView = b.dataset.view;
        this.app.persistSettings();
        this.app.baseDirty = true;
        this.app.requestRender();
        this.render();
      });
    }
    el.querySelector('[data-k="scheme"]').addEventListener('change', (e) => this.mutate((pl) => { pl.scheme.type = e.target.value; }));
    el.querySelector('[data-k="base"]').addEventListener('change', (e) => this.mutate((pl) => { pl.scheme.base = e.target.value; }));
    for (const b of el.querySelectorAll('[data-add]')) {
      b.addEventListener('click', () => {
        const r = newRole(this.ensure().roles, b.dataset.add);
        const pal = schemePalette(this.ensure().scheme);
        r.color = pal[Math.min(pal.length - 1, this.ensure().roles.length % pal.length)];
        this.mutate((pl) => { pl.roles.push(r); });
        this.app.state.plantRole = r.id;
        this.editRole(r.id);
      });
    }
    el.querySelector('[data-act="bloom"]').addEventListener('click', () => this.setMonth(null));
    el.querySelector('[data-act="prev"]').addEventListener('click', () => this.setMonth(this.month ? ((this.month + 10) % 12) + 1 : 1));
    el.querySelector('[data-act="next"]').addEventListener('click', () => this.setMonth(this.month ? (this.month % 12) + 1 : 1));
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
      txt.innerHTML = `<b>${esc(r.code)}</b> ${esc(describeRole(r))}<small>${ROLES[r.role].name} · ${HEIGHTS[r.height]?.range || ''} · bloei ${bloomText(r)}${fits ? '' : ` · <em>past niet bij ${esc(BED_TYPES[bed.btype].label.toLowerCase())}</em>`}</small>`;
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
      const del = document.createElement('button');
      del.type = 'button'; del.title = 'Uit dit vak halen'; del.innerHTML = icon('trash', 16);
      del.addEventListener('click', (e) => { e.stopPropagation(); this.app.store.mutate(() => { bed.planting.mix = bed.planting.mix.filter((x) => x.role !== m.role); }, 'mix'); });
      li.appendChild(del);
      ul.appendChild(li);
    }
    const ctx = this.bedCtx(bed);
    this.fillChecks($('.checks', el), checkPlanting(mix.map((m) => ({ role: byId[m.role], w: m.w })), ctx));
    el.querySelector('[data-k="bedtype"]').addEventListener('change', (e) => this.app.store.mutate(() => {
      if (e.target.value) bed.btype = e.target.value; else delete bed.btype;
    }, 'bedtype'));
    el.querySelector('[data-k="bedlight"]').addEventListener('change', (e) => this.app.store.mutate(() => {
      if (e.target.value) bed.light = e.target.value; else delete bed.light;
      delete bed.sunHours;
    }, 'bedlight'));
    el.querySelector('[data-k="bedmoist"]').addEventListener('change', (e) => this.app.store.mutate(() => {
      if (e.target.value) bed.moisture = e.target.value; else delete bed.moisture;
    }, 'bedmoist'));
    el.querySelector('[data-act="measure"]').addEventListener('click', () => this.measureSun(bed));
    el.querySelector('[data-act="compose"]').addEventListener('click', () => this.showProposal(el, bed, 1));
    el.querySelector('[data-act="addplant"]').addEventListener('click', () => this.openPicker({
      title: `Plant toevoegen aan ${bed.name ? bed.name : 'dit vak'}`,
      btype: bed.btype,
      light: bed.light,
      moisture: bed.moisture,
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

  /** Omstandigheden van een vak voor samenstellen en controleren. */
  bedCtx(bed) {
    return { btype: bed.btype || null, light: bed.light || null, moisture: bed.moisture || null, scheme: this.ensure().scheme };
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
  openPicker({ title, btype = null, light = null, moisture = null, onPick }) {
    let dlg = document.getElementById('dlg-plants');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-plants'; document.body.appendChild(dlg); }
    const opt = (o, cur, empty) => `<option value="">${empty}</option>` + Object.entries(o).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`).join('');
    const f = { q: '', type: '', height: '', light: light || '', soil: moisture || '', color: '', month: '', native: false, bees: false, evergreen: false, onlyFit: !!btype, btype };
    dlg.innerHTML = `
      <form method="dialog" class="dlg wide picker">
        <header><h2>${esc(title)}</h2><button class="x" value="close">${icon('close')}</button></header>
        <input type="search" data-f="q" placeholder="Zoek op Nederlandse of Latijnse naam" autocomplete="off">
        <div class="filters">
          <select data-f="type">${opt(PLANT_TYPES, '', 'Alle soorten')}</select>
          <select data-f="height">${opt(Object.fromEntries(Object.entries(HEIGHTS).map(([k, v]) => [k, `${v.name} (${v.range})`])), '', 'Elke hoogte')}</select>
          <select data-f="light">${opt({ zon: 'Zon', half: 'Halfschaduw', schaduw: 'Schaduw' }, f.light, 'Elke standplaats')}</select>
          <select data-f="soil">${opt({ droog: 'Droog', normaal: 'Normaal', vochtig: 'Vochtig' }, f.soil, 'Elke grond')}</select>
          <select data-f="color">${opt({ wit: 'Wit', geel: 'Geel', oranje: 'Oranje', rood: 'Rood', roze: 'Roze', paars: 'Paars', blauw: 'Blauw', groen: 'Groen' }, '', 'Elke bloeikleur')}</select>
          <select data-f="month">${opt(Object.fromEntries(MONTH_NAMES.map((m, i) => [String(i + 1), `Bloeit in ${m}`])), '', 'Elke bloeitijd')}</select>
          <label class="check"><input type="checkbox" data-f="native"> Inheems</label>
          <label class="check"><input type="checkbox" data-f="bees"> Bijen en vlinders</label>
          <label class="check"><input type="checkbox" data-f="evergreen"> Wintergroen</label>
          ${btype ? `<label class="check"><input type="checkbox" data-f="onlyFit" checked> Alleen wat past bij ${esc(BED_TYPES[btype].name.toLowerCase())}</label>` : ''}
        </div>
        <p class="hint count"></p>
        <ul class="plantlist"></ul>
      </form>`;
    const list = $('.plantlist', dlg);
    const show = () => {
      const res = searchPlants(f);
      $('.count', dlg).textContent = `${res.length} planten${res.length > 150 ? ', de eerste 150 getoond' : ''}. Tik op een plant om hem te kiezen.`;
      list.innerHTML = '';
      for (const { p, fits } of res.slice(0, 150)) {
        const li = document.createElement('li');
        li.className = 'plant' + (fits ? '' : ' unfit');
        li.appendChild(this.thumb(p, 48));
        const t = document.createElement('div');
        t.className = 'ptxt';
        const tags = [p.native ? 'inheems' : '', p.bees ? 'bijen' : '', p.evergreen ? 'wintergroen' : ''].filter(Boolean);
        const sun = p.light.map((l) => ({ zon: '☀', half: '◐', schaduw: '●' }[l])).join('');
        t.innerHTML = `<b>${esc(p.nl)}</b> <i>${esc(p.lat)}</i><small>${PLANT_TYPES[p.type]} · ${p.h >= 300 ? `${Math.round(p.h / 100)} m` : `${p.h} cm`} hoog · <span title="Standplaats">${sun}</span> · bloei ${bloomText(p)}${tags.length ? ' · ' + tags.join(', ') : ''}${fits ? '' : ` · <em>past niet bij ${esc(BED_TYPES[btype].label.toLowerCase())}</em>`}</small>`;
        li.appendChild(t);
        const sw = document.createElement('i');
        sw.className = 'pcolor'; sw.style.background = p.bloom.length ? p.color : 'transparent';
        li.appendChild(sw);
        li.addEventListener('click', () => { dlg.close(); onPick(p); });
        list.appendChild(li);
      }
    };
    for (const inp of dlg.querySelectorAll('[data-f]')) {
      const ev = inp.type === 'search' ? 'input' : 'change';
      inp.addEventListener(ev, () => { f[inp.dataset.f] = inp.type === 'checkbox' ? inp.checked : inp.value; show(); });
    }
    show();
    dlg.showModal();
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

function bloomText(r) {
  if (!r.bloom?.length) return 'geen';
  const b = [...r.bloom].sort((a, c) => a - c);
  return b.length === 1 ? MONTHS[b[0] - 1] : `${MONTHS[b[0] - 1]}–${MONTHS[b[b.length - 1] - 1]}`;
}

function hueKey(c) {
  const [h, s] = hexToHsl(c);
  return s < 0.18 ? 999 : h;
}

/** Adviezen over afwisseling in rol, hoogte, groeivorm en bloeivorm (op oppervlak). */
function mixAdvice(roles, areas) {
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
