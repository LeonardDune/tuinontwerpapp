// Paneel "Verharding": bouwstenen (verbanden) kiezen en beheren, en een overzicht van de oppervlakten.

import { BOND_PRESETS, bondPattern, bondLayout, describeBond } from './bonds.js';
import { shapePolygon } from './planting.js';
import { polygonArea, dist } from './geom.js';
import { icon } from './icons.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Oppervlakte van een verhardingsvak (m²). */
export function paveArea(it) {
  if (it.kind === 'circle') return Math.PI * dist(it.points[0], it.points[1]) ** 2;
  return Math.abs(polygonArea(shapePolygon(it)));
}

/** Geschat aantal stenen voor een oppervlakte (zonder snijverlies). */
export function stoneCount(bond, area) {
  const L = bondLayout(bond);
  // gemiddeld steenoppervlak (incl. voeg) over één herhaling van het patroon
  const uniq = new Set(L.list.map(([x, y, w, h]) => [((x % L.px) + L.px) % L.px, ((y % L.py) + L.py) % L.py, w, h].map((v) => Math.round(v * 1000)).join()));
  return Math.round(area / ((L.px * L.py * L.U * L.U) / uniq.size));
}

export class PavePanel {
  constructor(app) {
    this.app = app;
    this.el = $('#pave-panel');
    $('#btn-paving').addEventListener('click', () => (this.el.hidden ? this.open() : this.close()));
  }

  open() {
    $('#layers-panel').hidden = true;
    this.app.plantPanel.close();
    this.el.hidden = false;
    $('#btn-paving').classList.add('on');
    document.body.classList.add('side-open');
    this.render();
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    $('#btn-paving').classList.remove('on');
    document.body.classList.remove('side-open');
  }

  refresh() {
    if (!this.el.hidden) this.render();
  }

  /** Voorbeeldje van een verband (ca. 90 cm breed). */
  swatch(bond, px = 44) {
    const c = document.createElement('canvas');
    const dpr = 2;
    c.width = c.height = px * dpr;
    c.style.width = c.style.height = px + 'px';
    const g = c.getContext('2d');
    const s = (px * dpr) / Math.max(0.6, Math.min(2.4, Math.max(bond.l, bond.w) * 3.2));
    g.setTransform(s, 0, 0, s, 0, 0);
    g.fillStyle = bondPattern(g, bond, 0, [0, 0]);
    g.fillRect(0, 0, (px * dpr) / s, (px * dpr) / s);
    return c;
  }

  render() {
    const app = this.app;
    const lib = app.settings.bondLibrary || {};
    const cur = app.state.paveBlock || 'pre:k-half-waal';
    // overzicht: oppervlakte en aantal stenen per bouwsteen (naam)
    const rows = new Map();
    let total = 0;
    for (const l of app.store.doc.layers) {
      if (!l.visible) continue;
      for (const it of l.items) {
        if (it.type !== 'shape' || !it.bond || it.hatch !== 'bond') continue;
        const a = paveArea(it);
        const key = it.bondName || describeBond(it.bond);
        const r = rows.get(key) || { area: 0, n: 0, vakken: [] };
        r.area += a; r.n += stoneCount(it.bond, a); if (it.name) r.vakken.push(it.name);
        rows.set(key, r); total += a;
      }
    }
    const m2 = (v) => `${v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)} m²`;
    const el = this.el;
    el.innerHTML = `
      <div class="panel-head">
        <h2>Verharding</h2>
        <button class="tb" data-act="close" title="Sluiten">${icon('close')}</button>
      </div>
      <section>
        <h3>Overzicht <small>${rows.size ? `totaal ${m2(total)}` : ''}</small></h3>
        ${rows.size ? `<ul class="sk">${[...rows.entries()].map(([k, r]) => `<li><span>${esc(k)}${r.vakken.length ? `<small> · ${esc(r.vakken.join(', '))}</small>` : ''}</span><b>${m2(r.area)}</b><small>ca. ${r.n.toLocaleString('nl-NL')} st.</small></li>`).join('')}</ul>` : ''}
        <p class="hint">${rows.size ? 'Aantal stenen zonder snijverlies; reken 5–10% extra.' : 'Nog geen verhardingsvakken. Kies hieronder een bouwsteen en teken een vak met het gereedschap Verharden.'}</p>
      </section>
      <section>
        <h3>Mijn bouwstenen</h3>
        <ul class="roles" data-list="my"></ul>
        <p class="hint">Een eigen bouwsteen maak je zo: teken een vak, pas verband, steenmaat, kleur, voeg en afwerking aan in de balk, en kies <b>Bewaar als bouwsteen</b>.</p>
      </section>
      <section>
        <h3>Klinkerverbanden</h3>
        <ul class="roles" data-list="pre"></ul>
      </section>`;
    const fill = (ul, entries, kind) => {
      if (!entries.length) { ul.innerHTML = '<li class="hint">Nog geen eigen bouwstenen.</li>'; return; }
      for (const [id, blk] of entries) {
        const li = document.createElement('li');
        li.className = 'role' + (cur === `${kind}:${id}` ? ' active' : '');
        li.appendChild(this.swatch(blk.bond));
        const txt = document.createElement('div');
        txt.className = 'rtxt';
        txt.innerHTML = `<b>${esc(blk.name)}</b><small>${esc(describeBond(blk.bond))} · voeg ${Math.round((blk.bond.joint ?? 0.003) * 1000)} mm${blk.border ? ' · met rand' : ''}</small>`;
        li.appendChild(txt);
        if (kind === 'my') {
          const del = document.createElement('button');
          del.type = 'button'; del.title = 'Bouwsteen verwijderen'; del.innerHTML = icon('trash', 18);
          del.addEventListener('click', (e) => {
            e.stopPropagation();
            const next = { ...(app.settings.bondLibrary || {}) };
            delete next[id];
            app.settings.bondLibrary = next;
            if (app.state.paveBlock === `my:${id}`) app.state.paveBlock = null;
            app.persistSettings();
            app.toast(`Bouwsteen "${blk.name}" verwijderd. Vakken die hem gebruiken blijven zoals ze zijn.`, 3000);
            this.render(); app.renderOptions();
          });
          li.appendChild(del);
        }
        li.addEventListener('click', () => {
          app.state.paveBlock = `${kind}:${id}`;
          app.persistSettings();
          if (app.state.tool !== 'pave') app.setTool('pave'); else app.renderOptions();
          this.render();
        });
        ul.appendChild(li);
      }
    };
    fill($('[data-list="my"]', el), Object.entries(lib), 'my');
    fill($('[data-list="pre"]', el), Object.entries(BOND_PRESETS), 'pre');
    $('[data-act="close"]', el).addEventListener('click', () => this.close());
  }
}
