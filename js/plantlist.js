// Planten(boodschappen)lijst: alle planten uit het ontwerp met aantallen, standplaats, maten, bloei,
// leverancier en prijs. Naar de werkwijze van Elisabeth Scholt (Bloemenpark Appeltern): de lijst is
// boodschappenlijst, checklist en naslagwerk tegelijk. Exporteren als CSV (Excel) of PDF.

import {
  rolesMap, bedStats, roleSpacing, HEIGHTS, MONTHS, PYRAMID, roleLayer, layerIndex, describeRole, isBed,
} from './planting.js';
import { plantById, PLANT_TYPES } from './plantdb.js';
import { buildPdfPages, dataUrlToBytes } from './pdf.js';

const LIGHT_NAMES = { zon: 'zon', half: 'halfschaduw', halfschaduw: 'halfschaduw', schaduw: 'schaduw' };

/** Aantal planten per m² bij de plantafstand van een bouwsteen (driehoeksverband). */
export function perM2(r) {
  const sp = roleSpacing(r);
  return 1 / (0.866 * sp * sp);
}

function cleanMix(mix, roles) {
  return (mix || []).filter((m) => roles[m.role] && m.w > 0);
}

/**
 * Regels van de plantenlijst, in de volgorde van de beplantingspiramide (grote planten eerst).
 * bedId: alleen dat plantvak (zonder losse planten buiten het vak).
 * Geeft { rows, total, price, groups: [{ layer, rows }] }.
 */
export function plantList(doc, bedId = null) {
  const roles = rolesMap(doc);
  const count = {}; // role → aantal (kommagetal)
  const where = {}; // role → Set van vaknamen
  const add = (id, n, name) => {
    if (!roles[id] || !(n > 0)) return;
    count[id] = (count[id] || 0) + n;
    if (name) (where[id] = where[id] || new Set()).add(name);
  };
  const addMix = (mix, A, name) => {
    const m = cleanMix(mix, roles);
    const tot = m.reduce((s, x) => s + x.w, 0);
    for (const x of m) add(x.role, (A * x.w / tot) * perM2(roles[x.role]), name);
  };
  let nBed = 0;
  const stats = bedStats(doc);
  stats.forEach((st) => {
    nBed++;
    if (bedId && st.bed.id !== bedId) return;
    const name = (st.bed.name || '').trim() || `Vak ${nBed}`;
    addMix(st.bed.planting?.mix, st.baseArea, name);
    for (const g of st.groups) addMix(g.group.planting?.mix, g.area, name);
  });
  if (!bedId) {
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      for (const it of layer.items) {
        if ((it.type === 'plant' || it.type === 'stencil') && roles[it.role]) add(it.role, 1, 'los');
      }
    }
  }
  const rows = [];
  for (const [id, n] of Object.entries(count)) {
    const r = roles[id];
    const p = r.plant ? plantById(r.plant) : null;
    const amount = Math.max(1, Math.round(n));
    const tree = roleLayer(r) === 'bomen';
    const price = Number(r.price) > 0 ? Number(r.price) : null;
    rows.push({
      id,
      role: r,
      code: r.code,
      nl: r.label || p?.nl || describeRole(r),
      lat: p?.lat || '',
      type: p ? PLANT_TYPES[p.type] : '',
      layer: roleLayer(r),
      light: (p ? p.light : (r.light || [])).map((l) => LIGHT_NAMES[l] || l),
      soil: p ? p.soil : [],
      h: p ? p.h : null,
      w: p ? p.w : Math.round((r.d || HEIGHTS[r.height]?.d || 0.5) * 100),
      hRange: p ? null : HEIGHTS[r.height]?.range || '',
      bloom: [...(r.bloom || [])].sort((a, b) => a - b),
      color: r.color,
      seasons: seasonText(r),
      perM2: tree ? null : perM2(r),
      count: amount,
      where: [...(where[id] || [])],
      supplier: r.supplier || '',
      price,
      total: price != null ? price * amount : null,
      note: [r.note, p?.native ? 'inheems' : '', p?.bees ? 'bijen en vlinders' : '', p?.evergreen ? 'wintergroen' : ''].filter(Boolean).join(', '),
    });
  }
  rows.sort((a, b) => layerIndex(a.layer) - layerIndex(b.layer) || (b.h ?? b.w) - (a.h ?? a.w) || a.nl.localeCompare(b.nl, 'nl'));
  const groups = PYRAMID.map((l) => ({ layer: l, rows: rows.filter((r) => r.layer === l.key) })).filter((g) => g.rows.length);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const priced = rows.filter((r) => r.total != null);
  const price = priced.length ? priced.reduce((s, r) => s + r.total, 0) : null;
  return { rows, groups, total, price, missingPrice: rows.length - priced.length };
}

/** Wat de plant per seizoen te bieden heeft, kort. */
export function seasonText(r) {
  const has = (ms) => (r.bloom || []).some((m) => ms.includes(m));
  const out = [];
  if (has([3, 4, 5])) out.push('L');
  if (has([6, 7, 8])) out.push('Z');
  if (has([9, 10, 11]) || (r.autumn && r.autumn !== 'geen')) out.push('H');
  if (has([12, 1, 2]) || r.winter === 'groen' || r.winter === 'silhouet') out.push('W');
  return out.join(' ');
}

export function bloomRange(bloom) {
  if (!bloom?.length) return '';
  return bloom.length === 1 ? MONTHS[bloom[0] - 1] : `${MONTHS[bloom[0] - 1]}–${MONTHS[bloom[bloom.length - 1] - 1]}`;
}

export const euro = (v) => (v == null ? '' : v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' }));
const num = (v, d = 1) => (v == null ? '' : v.toLocaleString('nl-NL', { maximumFractionDigits: d }));
export const sizeText = (row) => (row.h != null ? `${fmtCm(row.h)} × ${fmtCm(row.w)}` : `${row.hRange} × ${fmtCm(row.w)}`);
function fmtCm(cm) {
  return cm >= 300 ? `${num(cm / 100)} m` : `${Math.round(cm)} cm`;
}

// ---------------------------------------------------------------- CSV

/** CSV voor Excel/Numbers (puntkomma, decimale komma, UTF-8 met BOM). */
export function plantListCsv(list) {
  const head = ['Nr', 'Nederlandse naam', 'Latijnse naam', 'Categorie', 'Standplaats', 'Grond', 'Hoogte (cm)', 'Breedte (cm)',
    'Bloeitijd', ...MONTHS, 'Seizoenen', 'Per m²', 'Aantal', 'Waar', 'Leverancier', 'Prijs per stuk', 'Totaal', 'Bijzonderheden'];
  const q = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const dec = (v, d = 2) => (v == null ? '' : v.toFixed(d).replace('.', ','));
  const lines = [head.map(q).join(';')];
  for (const g of list.groups) {
    for (const r of g.rows) {
      lines.push([
        r.code, r.nl, r.lat, g.layer.name, r.light.join(', '), r.soil.join(', '), r.h ?? r.hRange, r.w,
        bloomRange(r.bloom), ...MONTHS.map((_, i) => (r.bloom.includes(i + 1) ? 'x' : '')), r.seasons,
        r.perM2 != null ? dec(r.perM2, 1) : '', r.count, r.where.join(', '), r.supplier, dec(r.price), dec(r.total), r.note,
      ].map(q).join(';'));
    }
  }
  lines.push(['', 'Totaal', '', '', '', '', '', '', '', ...MONTHS.map(() => ''), '', '', list.total, '', '', '', dec(list.price), ''].map(q).join(';'));
  return new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

// ---------------------------------------------------------------- PDF

const COLS = [
  { k: 'code', t: 'Nr', w: 40 },
  { k: 'name', t: 'Plant', w: 290 },
  { k: 'light', t: 'Standplaats', w: 165 },
  { k: 'size', t: 'h × b', w: 150 },
  { k: 'bloom', t: 'Bloei', w: 280 },
  { k: 'seasons', t: 'Seizoen', w: 84 },
  { k: 'perM2', t: 'Per m²', w: 64, right: true },
  { k: 'count', t: 'Aantal', w: 64, right: true },
  { k: 'supplier', t: 'Leverancier', w: 175 },
  { k: 'price', t: 'Prijs/st', w: 90, right: true },
  { k: 'total', t: 'Totaal', w: 100, right: true },
];

/**
 * PDF (A4 liggend) van de plantenlijst; pagina's worden als afbeelding getekend.
 * info: { title, subtitle }
 */
export async function plantListPdf(list, info = {}) {
  const W = 1754, H = 1240; // A4 liggend, ±150 dpi
  const M = 70;
  const tableW = COLS.reduce((s, c) => s + c.w, 0);
  const k = (W - 2 * M) / tableW;
  const cols = [];
  let x = M;
  for (const c of COLS) { cols.push({ ...c, x, w: c.w * k }); x += c.w * k; }
  const rowH = 40, headH = 34, groupH = 38;
  const pages = [];
  let g = null, y = 0, pageNo = 0;
  const font = (px, weight = 400, italic = false) => `${italic ? 'italic ' : ''}${weight} ${px}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
  const newPage = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    pages.push(c);
    pageNo++;
    g.fillStyle = '#1f3a2a';
    g.font = font(34, 700);
    g.textBaseline = 'alphabetic';
    g.fillText(info.title || 'Plantenlijst', M, M + 10);
    g.font = font(20);
    g.fillStyle = '#5a6a5a';
    g.fillText(info.subtitle || '', M, M + 42);
    g.textAlign = 'right';
    g.fillText(`${new Date().toLocaleDateString('nl-NL')} · blad ${pageNo}`, W - M, M + 10);
    g.textAlign = 'left';
    y = M + 70;
    // kop van de tabel
    g.fillStyle = '#2f5d3a';
    g.fillRect(M, y, W - 2 * M, headH);
    g.fillStyle = '#ffffff';
    g.font = font(17, 600);
    for (const c of cols) {
      if (c.k === 'bloom') {
        const cw = c.w / 12;
        g.textAlign = 'center';
        MONTHS.forEach((m, i) => g.fillText(m[0].toUpperCase(), c.x + cw * (i + 0.5), y + 23));
        g.textAlign = 'left';
      } else {
        g.textAlign = c.right ? 'right' : 'left';
        g.fillText(c.t, c.right ? c.x + c.w - 8 : c.x + 8, y + 23);
      }
    }
    g.textAlign = 'left';
    y += headH;
  };
  const fit = (s, w) => {
    s = String(s ?? '');
    if (g.measureText(s).width <= w) return s;
    while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1);
    return s + '…';
  };
  newPage();
  let stripe = 0;
  for (const grp of list.groups) {
    if (y + groupH + rowH > H - M - 40) newPage();
    g.fillStyle = '#e6efe1';
    g.fillRect(M, y, W - 2 * M, groupH);
    g.fillStyle = '#2f4a25';
    g.font = font(19, 700);
    g.fillText(`${layerIndex(grp.layer.key) + 1}. ${grp.layer.name}`, M + 8, y + 26);
    y += groupH;
    for (const r of grp.rows) {
      if (y + rowH > H - M - 40) newPage();
      if (stripe++ % 2) { g.fillStyle = '#f6f8f4'; g.fillRect(M, y, W - 2 * M, rowH); }
      g.strokeStyle = '#e2e6de';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(M, y + rowH); g.lineTo(W - M, y + rowH); g.stroke();
      for (const c of cols) {
        const ty = y + 26;
        g.fillStyle = '#1d2b22';
        g.font = font(17);
        if (c.k === 'name') {
          g.font = font(17, 600);
          const nl = fit(r.nl, c.w - 16);
          g.fillText(nl, c.x + 8, y + (r.lat ? 18 : 26));
          if (r.lat) { g.font = font(14, 400, true); g.fillStyle = '#5a6a5a'; g.fillText(fit(r.lat, c.w - 16), c.x + 8, y + 35); }
        } else if (c.k === 'bloom') {
          const cw = c.w / 12;
          for (let m = 1; m <= 12; m++) {
            const on = r.bloom.includes(m);
            g.fillStyle = on ? r.color : (m === 12 || m <= 2 ? '#f1f1ee' : '#ffffff');
            g.fillRect(c.x + cw * (m - 1) + 1, y + 8, cw - 2, rowH - 16);
            g.strokeStyle = on ? 'rgba(60,50,40,0.45)' : '#d8dcd2';
            g.strokeRect(c.x + cw * (m - 1) + 1, y + 8, cw - 2, rowH - 16);
          }
        } else {
          const v = {
            code: r.code, light: r.light.join(', '), size: sizeText(r), seasons: r.seasons,
            perM2: r.perM2 != null ? num(r.perM2, 1) : '–', count: r.count, supplier: r.supplier, price: euro(r.price), total: euro(r.total),
          }[c.k];
          if (c.k === 'code') g.font = font(17, 700);
          g.textAlign = c.right ? 'right' : 'left';
          g.fillText(fit(v, c.w - 16), c.right ? c.x + c.w - 8 : c.x + 8, ty);
          g.textAlign = 'left';
        }
      }
      y += rowH;
    }
  }
  // totalen
  if (y + rowH * 2 > H - M) newPage();
  y += 10;
  g.fillStyle = '#1f3a2a';
  g.font = font(19, 700);
  const cCount = cols.find((c) => c.k === 'count'), cTot = cols.find((c) => c.k === 'total');
  g.fillText('Totaal', M + 8, y + 26);
  g.textAlign = 'right';
  g.fillText(String(list.total), cCount.x + cCount.w - 8, y + 26);
  if (list.price != null) g.fillText(euro(list.price), cTot.x + cTot.w - 8, y + 26);
  g.textAlign = 'left';
  g.font = font(15);
  g.fillStyle = '#5a6a5a';
  g.fillText('Aantallen zijn geschat op de plantafstand (driehoeksverband) en het oppervlak in de tekening. Seizoen: L lente, Z zomer, H herfst, W winter.', M, H - M + 20);
  const imgs = pages.map((c) => ({ jpeg: dataUrlToBytes(c.toDataURL('image/jpeg', 0.9)), w: W, h: H }));
  return buildPdfPages(imgs, 297, 210, { title: info.title || 'Plantenlijst' });
}

export function hasPlants(doc) {
  return !!doc.planting?.roles?.length && doc.layers.some((l) => l.items.some((i) => isBed(i) || i.type === 'plant' || i.group || i.role));
}

// ---------------------------------------------------------------- venster

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/**
 * Venster met de plantenlijst: per laag van de piramide, met leverancier en prijs om in te vullen
 * (bewaard bij de bouwsteen) en knoppen voor CSV en PDF.
 */
export function openPlantList(app, bedId = null, { share, safeFilename } = {}) {
  let dlg = document.getElementById('dlg-shoplist');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-shoplist'; document.body.appendChild(dlg); }
  const doc = () => app.store.doc;
  const beds = [];
  for (const l of doc().layers) if (l.visible) for (const it of l.items) if (isBed(it)) beds.push(it);
  let scope = bedId && beds.some((b) => b.id === bedId) ? bedId : '';
  const bedName = (b, i) => (b.name || '').trim() || `Vak ${i + 1}`;
  const render = () => {
    const list = plantList(doc(), scope || null);
    const scopeName = scope ? bedName(beds.find((b) => b.id === scope), beds.findIndex((b) => b.id === scope)) : 'Hele tuin';
    dlg.innerHTML = `
      <form method="dialog" class="dlg wide shoplist">
        <header><h2>Plantenlijst</h2><button class="x" value="close" aria-label="Sluiten">✕</button></header>
        <div class="row">
          <label class="row">Voor <select data-k="scope"><option value="">Hele tuin</option>${beds.map((b, i) => `<option value="${b.id}" ${scope === b.id ? 'selected' : ''}>${esc(bedName(b, i))}</option>`).join('')}</select></label>
          <span class="hint sum"></span>
        </div>
        ${list.rows.length ? `<div class="sl-wrap"><table class="sl">
          <thead><tr><th>Nr</th><th>Plant</th><th>Standplaats</th><th>h × b</th><th class="bl">Bloei<span>${MONTHS.map((m) => `<i>${m[0]}</i>`).join('')}</span></th><th title="Lente, Zomer, Herfst, Winter">Seizoen</th><th class="r" title="Aantal planten per m² bij de plantafstand">Per m²</th><th class="r">Aantal</th><th>Waar</th><th>Leverancier</th><th class="r">Prijs/st</th><th class="r">Totaal</th></tr></thead>
          <tbody>${list.groups.map((g) => `<tr class="grp"><th colspan="12">${layerIndex(g.layer.key) + 1}. ${esc(g.layer.name)}</th></tr>${g.rows.map((r) => `<tr data-id="${r.id}">
            <td class="code">${esc(r.code)}</td>
            <td class="nm"><b>${esc(r.nl)}</b>${r.lat ? `<i>${esc(r.lat)}</i>` : ''}${r.note ? `<small>${esc(r.note)}</small>` : ''}</td>
            <td>${esc(r.light.join(', '))}${r.soil.length ? `<small>${esc(r.soil.join(', '))}</small>` : ''}</td>
            <td class="nw">${esc(sizeText(r))}</td>
            <td class="bl"><span>${MONTHS.map((m, i) => `<i title="${m}" style="${r.bloom.includes(i + 1) ? `background:${r.color}` : ''}"></i>`).join('')}</span></td>
            <td>${esc(r.seasons)}</td>
            <td class="r">${r.perM2 != null ? num(r.perM2, 1) : '–'}</td>
            <td class="r"><b>${r.count}</b></td>
            <td><small>${esc(r.where.join(', '))}</small></td>
            <td><input type="text" data-f="supplier" value="${esc(r.supplier)}" placeholder="bijv. kwekerij"></td>
            <td class="r"><input type="text" inputmode="decimal" data-f="price" value="${r.price != null ? num(r.price, 2) : ''}" placeholder="€"></td>
            <td class="r tot">${euro(r.total)}</td></tr>`).join('')}`).join('')}</tbody>
          <tfoot><tr><th colspan="7">Totaal</th><th class="r">${list.total}</th><th colspan="3"></th><th class="r gtot">${euro(list.price)}</th></tr></tfoot>
        </table></div>` : '<p class="hint">Nog geen planten in het ontwerp. Vul eerst een plantvak (stap 2 van Beplanting) of zet losse planten.</p>'}
        <p class="hint">In de volgorde van de beplantingspiramide: grote planten eerst. Aantallen zijn geschat op het oppervlak en de plantafstand. Leverancier en prijs worden bij de plant in het ontwerp bewaard.</p>
        <footer>
          <button type="button" data-act="csv" ${list.rows.length ? '' : 'disabled'}>CSV (Excel)</button>
          <button type="button" class="primary" data-act="pdf" ${list.rows.length ? '' : 'disabled'}>PDF maken</button>
        </footer>
      </form>`;
    const sum = dlg.querySelector('.sum');
    const updateSum = (l) => { sum.textContent = `${l.rows.length} soorten, ${l.total} planten${l.price != null ? `, ${euro(l.price)}${l.missingPrice ? ` (${l.missingPrice} zonder prijs)` : ''}` : ''}`; };
    updateSum(list);
    dlg.querySelector('[data-k="scope"]').addEventListener('change', (e) => { scope = e.target.value; render(); });
    for (const inp of dlg.querySelectorAll('[data-f]')) {
      inp.addEventListener('change', () => {
        const id = inp.closest('tr').dataset.id;
        const f = inp.dataset.f;
        let v = inp.value.trim();
        if (f === 'price') {
          v = v.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
          v = v === '' ? null : Number(v);
          if (v != null && !(v >= 0)) { app.toast('Vul een prijs in als getal, bijv. 3,95'); return; }
        }
        app.store.mutate((d) => {
          const r = d.planting?.roles?.find((x) => x.id === id);
          if (!r) return;
          if (v == null || v === '') delete r[f]; else r[f] = v;
        }, 'plantlist');
        const l = plantList(doc(), scope || null);
        const row = l.rows.find((r) => r.id === id);
        const tr = inp.closest('tr');
        if (row) {
          tr.querySelector('.tot').textContent = euro(row.total);
          if (f === 'price') inp.value = row.price != null ? num(row.price, 2) : '';
        }
        dlg.querySelector('.gtot').textContent = euro(l.price);
        updateSum(l);
      });
    }
    const title = () => `Plantenlijst ${doc().name || ''}`.trim();
    const file = (ext) => `${(safeFilename || ((x) => x))(`plantenlijst ${doc().name || ''}${scope ? ' ' + scopeName : ''}`)}.${ext}`;
    dlg.querySelector('[data-act="csv"]').addEventListener('click', async () => {
      await share(plantListCsv(plantList(doc(), scope || null)), file('csv'));
    });
    dlg.querySelector('[data-act="pdf"]').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const blob = await plantListPdf(plantList(doc(), scope || null), { title: title(), subtitle: scopeName });
        await share(blob, file('pdf'));
      } catch (err) {
        console.error(err);
        app.toast('PDF maken mislukt: ' + (err.message || err));
      } finally {
        e.target.disabled = false;
      }
    });
  };
  render();
  if (!dlg.open) dlg.showModal();
}
