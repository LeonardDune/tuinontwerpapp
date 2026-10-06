// Paneel "Beplanting": kleurenschema, bouwstenen, jaarrond-overzicht en kleurcirkel.

import {
  HEIGHTS, HABITS, FORMS, ROLES, FOLIAGE, AUTUMN, WINTER, SCHEMES, MONTHS, MONTH_NAMES,
  schemePalette, inScheme, newRole, describeRole, drawRoleSymbol, roleDiameter, yearRound, hexToHsl, monthState,
} from './planting.js';
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
    this.el.hidden = false;
    $('#btn-planting').classList.add('on');
    this.render();
  }

  close() {
    this.el.hidden = true;
    $('#btn-planting').classList.remove('on');
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

  render() {
    const p = this.ensure();
    const yr = yearRound(this.doc);
    const palette = schemePalette(p.scheme);
    const off = p.roles.filter((r) => !inScheme(r.color, p.scheme));
    const low = yr.total ? yr.months.filter((m) => m.score < 0.3) : [];
    const el = this.el;
    el.innerHTML = `
      <div class="panel-head">
        <h2>Beplanting</h2>
        <button class="tb" data-act="close" title="Sluiten">${icon('close')}</button>
      </div>
      <section>
        <h3>Kleurenschema</h3>
        <div class="row">
          <select data-k="scheme">${Object.entries(SCHEMES).map(([k, v]) => `<option value="${k}" ${p.scheme.type === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select>
          <input type="color" data-k="base" value="${p.scheme.base}" title="Basiskleur" ${['vrij', 'warm', 'koel', 'wit'].includes(p.scheme.type) ? 'hidden' : ''}>
        </div>
        <div class="palette">${palette.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
      </section>
      <section>
        <h3>Bouwstenen</h3>
        <ul class="roles"></ul>
        <div class="row add">
          ${Object.entries(ROLES).map(([k, v]) => `<button type="button" data-add="${k}" title="${v.note}">+ ${v.name}</button>`).join('')}
        </div>
      </section>
      <section>
        <h3>Het hele jaar <small>${this.month ? MONTH_NAMES[this.month - 1] : 'tik een maand om de tekening zo te zien'}</small></h3>
        <div class="year"></div>
        <div class="row month-row">
          <button type="button" data-act="prev" title="Vorige maand">‹</button>
          <button type="button" data-act="bloom" class="${this.month ? '' : 'on'}">Bloeikleur</button>
          <button type="button" data-act="next" title="Volgende maand">›</button>
        </div>
        <canvas class="wheel" width="300" height="300"></canvas>
        <div class="advice"></div>
      </section>`;

    // bouwstenen
    const ul = $('.roles', el);
    const areas = yr.areas;
    if (!p.roles.length) ul.innerHTML = '<li class="hint">Nog geen bouwstenen. Begin met een paar structuurplanten en een vulling.</li>';
    for (const r of p.roles) {
      const li = document.createElement('li');
      li.className = 'role' + (this.app.state.plantRole === r.id ? ' active' : '');
      li.appendChild(this.symbol(r, 34, this.month));
      const txt = document.createElement('div');
      txt.className = 'rtxt';
      const a = areas[r.id];
      txt.innerHTML = `<b>${esc(r.code)}</b> ${esc(describeRole(r))}<small>${ROLES[r.role].name} · bloei ${bloomText(r)}${a ? ` · ${a < 10 ? a.toFixed(1).replace('.', ',') : Math.round(a)} m²` : ''}${inScheme(r.color, p.scheme) ? '' : ' · <em>buiten schema</em>'}</small>`;
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

    // gebeurtenissen
    el.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
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
      box.appendChild(this.symbol(draft, 64));
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
      } else if (b.dataset.act === 'delete') {
        const used = this.doc.layers.some((l) => l.items.some((i) => i.role === id || i.planting?.mix?.some((m) => m.role === id)));
        if (used && !confirm(`${r.code} staat in de tekening. Verwijderen haalt ook die planten weg. Doorgaan?`)) return;
        this.app.store.mutate((doc) => {
          doc.planting.roles = doc.planting.roles.filter((x) => x.id !== id);
          for (const l of doc.layers) {
            l.items = l.items.filter((i) => i.role !== id);
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
