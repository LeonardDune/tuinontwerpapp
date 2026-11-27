// Paneel "Hele ontwerp" (Beplanting ▸ Hele ontwerp): alles wat voor alle plantvakken samen geldt.
// Weergave van alle vakken, maand bekijken, niveaus van de beplantingspiramide, kleurenschema, alle planten
// (bouwstenen) in het ontwerp, advies en de plantenlijst. Eén plantvak inrichten gebeurt in het paneel Plantvak.

import {
  ROLES, SCHEMES, MONTH_NAMES, MONTHS, PYRAMID, BED_TYPES, schemePalette, inScheme, newRole, describeRole,
  yearRound, plantCounts, roleForPlant,
} from './planting.js';
import { icon } from './icons.js';
import { yearBars, bloomText, mixAdvice } from './plantpanel.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class GardenPanel {
  constructor(app) {
    this.app = app;
    this.el = $('#garden-panel');
  }

  get pp() { return this.app.plantPanel; }

  get doc() { return this.app.store.doc; }

  open() {
    $('#layers-panel').hidden = true;
    this.app.pavePanel?.close();
    this.pp.close();
    this.el.hidden = false;
    $('#btn-planting').classList.add('on');
    document.body.classList.add('side-open');
    this.render();
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    // tijdelijke weergaven (maand, piramideniveau) niet stilletjes laten staan
    if (this.pp.layerMax != null) this.pp.setLayerMax(null);
    if (this.pp.month) this.pp.setMonth(null);
    if (this.pp.el.hidden) { $('#btn-planting').classList.remove('on'); document.body.classList.remove('side-open'); }
  }

  refresh() {
    if (!this.el.hidden) this.render();
  }

  render() {
    const p = this.pp.ensure();
    const pp = this.pp;
    const yr = yearRound(this.doc, null);
    const counts = plantCounts(this.doc, null);
    const view = this.app.state.plantView || 'planten';
    const own = Object.keys(this.app.state.plantViews || {}).length;
    const palette = schemePalette(p.scheme);
    const month = pp.month;
    const beds = pp.beds();
    const el = this.el;
    el.innerHTML = `
      <div class="panel-head">
        <h2>Hele ontwerp</h2>
        <button class="tb" data-act="close" title="Sluiten">${icon('close')}</button>
      </div>
      <section class="step-intro"><p>Instellingen voor <b>alle plantvakken samen</b>. Eén plantvak inrichten doe je via <button type="button" class="link" data-act="bed">Beplanting ▸ Plantvak</button>.</p></section>
      <section>
        <h3>Weergave van alle vakken</h3>
        <div class="seg">
          <button type="button" data-view="planten" class="${view === 'planten' ? 'on' : ''}" title="Impressie: de planten zoals ze er uitzien">Impressie</button>
          <button type="button" data-view="symbolen" class="${view === 'symbolen' ? 'on' : ''}" title="Plansymbolen: technisch beplantingsplan met codes">Symbolen</button>
          <button type="button" data-view="groepen" class="${view === 'groepen' ? 'on' : ''}" title="Groepen: vlakken per mix, met aantallen">Groepen</button>
        </div>
        ${own ? `<p class="hint">${own} vak${own > 1 ? 'ken hebben' : ' heeft'} een eigen weergave; die vervalt als je hier kiest.</p>` : ''}
      </section>
      <section>
        <h3>Door het jaar <small>${month ? MONTH_NAMES[month - 1] : 'tik een maand om de tekening zo te zien'}</small></h3>
        <div class="year"></div>
        <div class="row month-row">
          <button type="button" data-act="prev" title="Vorige maand">‹</button>
          <button type="button" data-act="bloom" class="${month ? '' : 'on'}">Bloeikleur</button>
          <button type="button" data-act="next" title="Volgende maand">›</button>
        </div>
        <canvas class="wheel" width="300" height="300"></canvas>
      </section>
      <section>
        <h3>Piramideniveaus <small>zoals overtrekpapier</small></h3>
        <p class="hint">Toon alleen de grote planten om eerst de structuur te beoordelen.</p>
        <div class="seg layers">${[[null, 'Alles'], ...PYRAMID.slice(0, 4).map((l, i) => [i, `t/m ${l.wish.toLowerCase()}`])].map(([v, n]) => `<button type="button" data-layer="${v ?? ''}" class="${(pp.layerMax ?? null) === v ? 'on' : ''}">${n}</button>`).join('')}</div>
      </section>
      <section>
        <h3>Standaard kleurencombinatie <small>${esc(SCHEMES[p.scheme.type]?.name || '')}</small></h3>
        <div class="row">
          <select data-k="scheme">${Object.entries(SCHEMES).map(([k, v]) => `<option value="${k}" ${p.scheme.type === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select>
          <input type="color" data-k="base" value="${p.scheme.base}" title="Basiskleur" ${['vrij', 'warm', 'koel', 'wit'].includes(p.scheme.type) ? 'hidden' : ''}>
        </div>
        <div class="palette">${palette.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
        <p class="hint">Voor plantvakken zonder eigen keuze. Een eigen combinatie per vak kies je bij Plantvak ▸ 2 Wensen.</p>
      </section>
      <section>
        <h3>Plantvakken <small>${beds.length ? `${beds.length} in de tekening` : ''}</small></h3>
        <div class="sketch"></div>
        <ul class="bedlist"></ul>
      </section>
      <details class="allroles" ${this.rolesOpen ? 'open' : ''}><summary>Alle planten in dit ontwerp <small>${p.roles.length}</small></summary><section>
        <ul class="roles"></ul>
        <div class="row add">
          <button type="button" data-act="pickrole" class="primary" title="Een bouwsteen maken van een echte plant uit de plantendatabase">+ Plant uit de database</button>
          ${Object.entries(ROLES).map(([k, v]) => `<button type="button" data-add="${k}" title="Een eigen bouwsteen zonder soort (${v.note})">+ ${v.name}</button>`).join('')}
        </div>
      </section></details>
      <section>
        <h3>Advies voor het hele ontwerp</h3>
        <div class="advice"></div>
      </section>
      <div class="row add plist"><button type="button" class="primary" data-act="plantlist" title="Alle planten met aantallen, standplaats, bloei, leverancier en prijs">Plantenlijst van de hele tuin</button></div>`;

    yearBars($('.year', el), yr, month, (m) => pp.setMonth(month === m ? null : m));
    pp.drawWheel($('.wheel', el), p, yr.areas);

    // oppervlak per type plantvak
    const sk = {};
    let open = 0;
    for (const { item, area } of beds) { if (BED_TYPES[item.btype]) sk[item.btype] = (sk[item.btype] || 0) + area; else open += area; }
    const m2 = (v) => `${v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)} m²`;
    $('.sketch', el).innerHTML = Object.keys(sk).length || open
      ? `<ul class="sk">${Object.entries(BED_TYPES).filter(([k]) => sk[k]).map(([k, v]) => `<li><i style="background:${v.color}"></i>${v.name} <small>${v.range}</small><b>${m2(sk[k])}</b></li>`).join('')}${open ? `<li><i style="background:#cdb9a4"></i>Type nog open<b>${m2(open)}</b></li>` : ''}</ul>`
      : '';
    pp.bindBedList(el, beds, null);

    // alle bouwstenen
    const ul = $('.roles', el);
    if (!p.roles.length) ul.innerHTML = '<li class="hint">Nog geen planten in dit ontwerp.</li>';
    for (const r of p.roles) {
      const li = document.createElement('li');
      li.className = 'role' + (this.app.state.plantRole === r.id ? ' active' : '');
      li.appendChild(view === 'symbolen' ? pp.symbol(r, 34, month) : pp.thumb(r, 34, month));
      const txt = document.createElement('div');
      txt.className = 'rtxt';
      const a = yr.areas[r.id], n = counts[r.id];
      txt.innerHTML = `<b>${esc(r.code)}</b> ${esc(describeRole(r))}<small>${ROLES[r.role]?.name || 'Plant'} · bloei ${bloomText(r)}${a ? ` · ${a < 10 ? a.toFixed(1).replace('.', ',') : Math.round(a)} m²` : ''}${n ? ` · ${n} st.` : ''}${inScheme(r.color, p.scheme) ? '' : ' · <em>buiten schema</em>'}</small>`;
      li.appendChild(txt);
      const edit = document.createElement('button');
      edit.type = 'button'; edit.title = 'Bewerken'; edit.innerHTML = icon('pen', 18);
      edit.addEventListener('click', (e) => { e.stopPropagation(); pp.editRole(r.id); });
      li.appendChild(edit);
      // tikken: deze plant los neerzetten
      li.title = 'Tik om deze plant los in de tekening te zetten';
      li.addEventListener('click', () => {
        this.app.state.plantRole = r.id;
        if (!['plant', 'groep'].includes(this.app.state.plantMode)) this.app.state.plantMode = 'plant';
        this.app.persistSettings();
        if (this.app.state.tool !== 'plant') this.app.setTool('plant'); else this.app.renderOptions();
        this.render();
      });
      ul.appendChild(li);
    }

    // advies
    const adv = [];
    const low = yr.total ? yr.months.filter((m) => m.score < 0.3) : [];
    if (!yr.total) adv.push('Nog geen planten in het ontwerp.');
    if (low.length) adv.push(`Weinig te zien in <b>${low.map((m) => MONTHS[m.m - 1]).join(', ')}</b>.${low.some((m) => m.m <= 3 || m.m >= 11) ? ' Denk aan wintergroen, planten met een mooi silhouet of zaaddozen, of vroege bloeiers.' : ' Voeg een plant toe die dan bloeit.'}`);
    const off = p.roles.filter((r) => !inScheme(r.color, p.scheme));
    if (off.length && p.scheme.type !== 'vrij') adv.push(`Buiten het kleurenschema: <b>${off.map((r) => esc(r.code)).join(', ')}</b>.`);
    adv.push(...mixAdvice(p.roles, yr.areas));
    $('.advice', el).innerHTML = adv.map((t) => `<p>${t}</p>`).join('');

    // gebeurtenissen
    el.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    el.querySelector('.allroles').addEventListener('toggle', (e) => { this.rolesOpen = e.target.open; });
    el.querySelector('[data-act="bed"]').addEventListener('click', () => pp.open());
    el.querySelector('[data-act="plantlist"]').addEventListener('click', () => this.app.openPlantList(null));
    for (const b of el.querySelectorAll('[data-view]')) {
      b.addEventListener('click', () => {
        this.app.state.plantView = b.dataset.view;
        this.app.state.plantViews = {};
        this.app.persistSettings();
        this.app.baseDirty = true;
        this.app.requestRender();
        this.render();
      });
    }
    for (const b of el.querySelectorAll('[data-layer]')) b.addEventListener('click', () => { pp.setLayerMax(b.dataset.layer === '' ? null : Number(b.dataset.layer)); this.render(); });
    el.querySelector('[data-k="scheme"]').addEventListener('change', (e) => pp.mutate((pl) => { pl.scheme.type = e.target.value; }));
    el.querySelector('[data-k="base"]').addEventListener('change', (e) => pp.mutate((pl) => { pl.scheme.base = e.target.value; }));
    el.querySelector('[data-act="bloom"]').addEventListener('click', () => pp.setMonth(null));
    el.querySelector('[data-act="prev"]').addEventListener('click', () => pp.setMonth(month ? ((month + 10) % 12) + 1 : 1));
    el.querySelector('[data-act="next"]').addEventListener('click', () => pp.setMonth(month ? (month % 12) + 1 : 1));
    el.querySelector('[data-act="pickrole"]').addEventListener('click', () => pp.openPicker({
      title: 'Plant kiezen voor het ontwerp',
      onPick: (pl) => {
        const { role, created } = roleForPlant(pp.ensure().roles, pl);
        if (created) pp.mutate((x) => { x.roles.push(role); });
        this.app.state.plantRole = role.id;
        this.app.persistSettings();
        this.app.toast(created ? `${pl.nl} staat nu als ${role.code} in het ontwerp. Zet hem in een plantvak via Beplanting ▸ Plantvak.` : `${pl.nl} is al ${role.code}.`, 3500);
        this.render();
      },
    }));
    for (const b of el.querySelectorAll('[data-add]')) {
      b.addEventListener('click', () => {
        const r = newRole(pp.ensure().roles, b.dataset.add);
        const pal = schemePalette(pp.ensure().scheme);
        r.color = pal[Math.min(pal.length - 1, pp.ensure().roles.length % pal.length)];
        pp.mutate((pl) => { pl.roles.push(r); });
        this.app.state.plantRole = r.id;
        pp.editRole(r.id);
      });
    }
  }
}

