// Zon & schaduw: paneel, schaduw op een tijdstip en zonkaart (zon / halfschaduw / schaduw).

import { sunPosition, sunTimes, dayPath, localDate, compassName, formatClock } from './sun.js';
import {
  collectCasters, shadowOffset, fillShadows, computeSunHours, sunHoursImage, sunHoursAt, sunClass, SUN_CLASSES,
} from './shadows.js';
import { itemBBox } from './items.js';
import { unionBox, rotate } from './geom.js';
import { icon } from './icons.js';

const FALLBACK = { lat: 52.1, lon: 5.3, name: 'midden van Nederland', fallback: true };
const $ = (sel, root = document) => root.querySelector(sel);

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class SunPanel {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.mode = 'shadow'; // shadow | hours
    this.period = 'season'; // day | season | year
    this.ymd = todayYmd();
    this.minutes = null;
    this.result = null;
    this.resultKey = null;
    this.computing = false;
    this.jobId = 0;
    this.layer = document.createElement('canvas');
    this.el = $('#sun-panel');
    $('#btn-sun').addEventListener('click', () => this.toggle());
  }

  // ---------------------------------------------------------------- gegevens

  get doc() {
    return this.app.store.doc;
  }

  geo() {
    const g = this.doc.geo;
    return g && Number.isFinite(g.lat) ? g : FALLBACK;
  }

  northRot() {
    return ((this.doc.northDeg || 0) * Math.PI) / 180;
  }

  times() {
    const { lat, lon } = this.geo();
    return sunTimes(this.ymd, lat, lon);
  }

  sun() {
    const { lat, lon } = this.geo();
    return sunPosition(localDate(this.ymd, this.minutes), lat, lon);
  }

  periodDates() {
    const y = this.ymd.slice(0, 4);
    if (this.period === 'day') return [this.ymd];
    const months = this.period === 'season' ? [4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return months.map((m) => `${y}-${String(m).padStart(2, '0')}-21`);
  }

  /** Gebied voor de zonkaart: de getekende tuin (zonder ondergronden), anders de ondergrond. */
  analysisBox() {
    let box = null, under = null;
    for (const layer of this.doc.layers) {
      if (!layer.visible) continue;
      for (const item of layer.items) {
        const b = itemBBox(item);
        if (item.type === 'image') under = unionBox(under, b);
        else box = unionBox(box, b);
      }
    }
    box = box || under;
    if (!box) return null;
    const pad = 3;
    box = { minX: box.minX - pad, minY: box.minY - pad, maxX: box.maxX + pad, maxY: box.maxY + pad };
    const max = 300;
    const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
    const hw = Math.min(max, box.maxX - box.minX) / 2, hh = Math.min(max, box.maxY - box.minY) / 2;
    return { minX: cx - hw, minY: cy - hh, maxX: cx + hw, maxY: cy + hh };
  }

  // ---------------------------------------------------------------- paneel

  toggle(force) {
    this.active = force ?? !this.active;
    $('#btn-sun').classList.toggle('on', this.active);
    if (this.active) {
      if (this.minutes == null) this.resetTime();
      this.render();
      if (this.mode === 'hours') this.scheduleCompute(0);
    } else {
      this.stopPlay();
      this.el.hidden = true;
    }
    this.app.baseDirty = true;
    this.app.requestRender();
  }

  resetTime() {
    const t = this.times();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const isToday = this.ymd === todayYmd();
    if (isToday && t.rise != null && nowMin > t.rise && nowMin < t.set) this.minutes = nowMin;
    else this.minutes = Math.round(t.noon / 10) * 10 + 120; // begin van de middag
    if (t.set != null) this.minutes = Math.min(this.minutes, t.set - 10);
  }

  render() {
    const el = this.el;
    const geo = this.geo();
    const presets = [
      ['21 maart', '-03-21'], ['21 juni (langste dag)', '-06-21'],
      ['21 september', '-09-21'], ['21 december (kortste dag)', '-12-21'],
    ];
    const y = this.ymd.slice(0, 4);
    const presetVal = presets.find(([, md]) => `${y}${md}` === this.ymd)?.[1] || '';
    el.innerHTML = `
      <div class="sun-row">
        <div class="seg">
          <button type="button" data-mode="shadow" class="${this.mode === 'shadow' ? 'on' : ''}">Schaduw</button>
          <button type="button" data-mode="hours" class="${this.mode === 'hours' ? 'on' : ''}">Zonkaart</button>
        </div>
        <select class="sun-preset" title="Snelkeuze datum">
          <option value="">Datum…</option>
          ${presets.map(([n, md]) => `<option value="${md}" ${md === presetVal ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <input type="date" class="sun-date" value="${this.ymd}">
        <label class="sun-north" title="Richting van het noorden. Bij een PDOK-kaart is dit automatisch 0° (noorden boven).">N
          <input type="number" step="1" class="num sun-north-input" value="${Math.round(this.doc.northDeg || 0)}">°</label>
        <button type="button" class="x sun-close" title="Sluiten">${icon('close', 18)}</button>
      </div>
      <div class="sun-row sun-mode-row"></div>
      <div class="sun-loc">${geo.fallback
        ? 'Locatie: midden van Nederland. Importeer een kaart van je adres voor de exacte zonnestand.'
        : `Locatie: ${escapeHtml(geo.name || `${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`)} · noorden ${this.doc.northDeg ? `${Math.round(this.doc.northDeg)}° gedraaid` : 'boven (van de kaart)'}`}</div>`;
    el.hidden = false;

    for (const b of el.querySelectorAll('[data-mode]')) {
      b.addEventListener('click', () => {
        this.mode = b.dataset.mode;
        this.stopPlay();
        this.render();
        if (this.mode === 'hours') this.scheduleCompute(0);
        this.changed();
      });
    }
    $('.sun-preset', el).addEventListener('change', (e) => {
      if (!e.target.value) return;
      this.setDate(`${y}${e.target.value}`);
    });
    $('.sun-date', el).addEventListener('change', (e) => { if (e.target.value) this.setDate(e.target.value); });
    $('.sun-north-input', el).addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      this.doc.northDeg = Number.isFinite(v) ? ((v % 360) + 360) % 360 : 0;
      this.app.scheduleSave();
      this.render();
      this.onDocChange();
      this.changed();
    });
    $('.sun-close', el).addEventListener('click', () => this.toggle(false));
    this.renderModeRow();
  }

  renderModeRow() {
    const row = $('.sun-mode-row', this.el);
    if (this.mode === 'shadow') {
      const t = this.times();
      if (t.rise == null) {
        row.innerHTML = '<span class="hint">De zon komt deze dag niet op.</span>';
        return;
      }
      const lo = Math.ceil(t.rise / 5) * 5, hi = Math.floor(t.set / 5) * 5;
      this.minutes = Math.min(hi, Math.max(lo, this.minutes));
      row.innerHTML = `
        <button type="button" class="sun-play" title="Afspelen">${this.playTimer ? '❚❚' : '▶'}</button>
        <span class="sun-edge">${formatClock(t.rise)}</span>
        <input type="range" class="sun-time" min="${lo}" max="${hi}" step="5" value="${this.minutes}">
        <span class="sun-edge">${formatClock(t.set)}</span>
        <span class="sun-info"></span>`;
      const slider = $('.sun-time', row);
      slider.addEventListener('input', () => { this.minutes = Number(slider.value); this.updateInfo(); this.changed(); });
      $('.sun-play', row).addEventListener('click', () => (this.playTimer ? this.stopPlay() : this.startPlay()));
      this.updateInfo();
    } else {
      row.innerHTML = `
        <select class="sun-period">
          <option value="season" ${this.period === 'season' ? 'selected' : ''}>Groeiseizoen (apr–sep)</option>
          <option value="day" ${this.period === 'day' ? 'selected' : ''}>Gekozen dag</option>
          <option value="year" ${this.period === 'year' ? 'selected' : ''}>Heel jaar</option>
        </select>
        <div class="sun-legend">${SUN_CLASSES.map((c) => `<span><i style="background:rgb(${c.color.join(',')})"></i>${c.name} <small>${c.note}</small></span>`).join('')}</div>
        <span class="sun-status"></span>`;
      $('.sun-period', row).addEventListener('change', (e) => { this.period = e.target.value; this.scheduleCompute(0); });
      this.updateStatus();
    }
  }

  updateInfo() {
    const info = $('.sun-info', this.el);
    if (!info) return;
    const s = this.sun();
    info.textContent = s.altitude > 0
      ? `${formatClock(this.minutes)} · zon ${Math.round(s.altitude)}° hoog uit het ${compassName(s.azimuth)}`
      : `${formatClock(this.minutes)} · zon onder`;
  }

  updateStatus() {
    const st = $('.sun-status', this.el);
    if (!st) return;
    if (this.computing) st.textContent = `Berekenen… ${Math.round((this.progress || 0) * 100)}%`;
    else if (!this.analysisBox()) st.textContent = 'Teken eerst iets of importeer een kaart.';
    else st.textContent = this.period === 'day' ? 'Uren zon op deze dag' : 'Gemiddeld aantal uren zon per dag';
  }

  setDate(ymd) {
    this.ymd = ymd;
    this.resetTime();
    this.render();
    if (this.mode === 'hours') this.scheduleCompute(0);
    this.changed();
  }

  startPlay() {
    const t = this.times();
    if (t.rise == null) return;
    if (this.minutes >= t.set - 10) this.minutes = Math.ceil(t.rise / 5) * 5;
    this.playTimer = setInterval(() => {
      this.minutes += 10;
      if (this.minutes > t.set) this.minutes = Math.ceil(t.rise / 5) * 5;
      const slider = $('.sun-time', this.el);
      if (slider) slider.value = String(this.minutes);
      this.updateInfo();
      this.changed();
    }, 120);
    this.renderModeRow();
  }

  stopPlay() {
    if (!this.playTimer) return;
    clearInterval(this.playTimer);
    this.playTimer = null;
    if (this.active && this.mode === 'shadow') this.renderModeRow();
  }

  changed() {
    this.app.baseDirty = true;
    this.app.requestRender();
  }

  /** Document gewijzigd (hoogtes, vormen, lagen): zonkaart opnieuw berekenen. */
  onDocChange() {
    if (!this.active) return;
    if (this.mode === 'hours') this.scheduleCompute(600);
    else this.changed();
  }

  scheduleCompute(delay) {
    clearTimeout(this.computeTimer);
    this.computeTimer = setTimeout(() => this.compute(), delay);
  }

  async compute() {
    const box = this.analysisBox();
    const job = ++this.jobId;
    if (!box) {
      this.result = null;
      this.updateStatus();
      this.changed();
      return;
    }
    const { lat, lon } = this.geo();
    this.computing = true;
    this.progress = 0;
    this.updateStatus();
    const res = await computeSunHours({
      casters: collectCasters(this.doc), box, dates: this.periodDates(), lat, lon, northRot: this.northRot(),
      stepMin: this.period === 'day' ? 10 : 20,
      onProgress: (f) => { this.progress = f; this.updateStatus(); },
      isCancelled: () => job !== this.jobId,
    });
    if (job !== this.jobId) return;
    this.computing = false;
    this.result = res;
    this.resultImage = res ? sunHoursImage(res) : null;
    this.updateStatus();
    this.changed();
  }

  // ---------------------------------------------------------------- tekenen

  /** Schaduw of zonkaart in de (gecachete) basislaag. */
  drawBase(ctx) {
    if (!this.active) return;
    const { cam, dpr } = this.app;
    if (this.mode === 'hours') {
      if (!this.result || !this.resultImage) return;
      const b = this.result.box;
      ctx.save();
      cam.apply(ctx, dpr);
      ctx.globalAlpha = 0.5;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.resultImage, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      ctx.restore();
      return;
    }
    const d = shadowOffset(this.sun(), this.northRot());
    if (!d) return;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    if (this.layer.width !== W || this.layer.height !== H) {
      this.layer.width = W;
      this.layer.height = H;
    }
    const g = this.layer.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    cam.apply(g, dpr);
    g.fillStyle = '#1b2a4a';
    fillShadows(g, collectCasters(this.doc), d);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.32;
    ctx.drawImage(this.layer, 0, 0);
    ctx.restore();
  }

  /** Zonnekompas rechtsonder: noorden, zonnebaan van de dag en de huidige stand. */
  drawOverlay(ctx) {
    if (!this.active) return;
    const { width, height, dpr, cam } = this.app;
    const R = 62;
    const cx = width - R - 22, cy = height - R - 26;
    const north = this.northRot() + cam.rot; // op het scherm
    const toScreen = (az, alt) => {
      const r = R * (1 - Math.max(0, alt) / 90);
      const v = rotate([0, -1], north + (az * Math.PI) / 180);
      return [cx + v[0] * r, cy + v[1] * r];
    };
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.strokeStyle = 'rgba(29,43,54,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * (2 / 3), 0, Math.PI * 2); ctx.arc(cx, cy, R / 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(29,43,54,0.12)'; ctx.stroke();
    // windrichtingen
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [['N', 0], ['O', 90], ['Z', 180], ['W', 270]].forEach(([n, az]) => {
      const v = rotate([0, -1], north + (az * Math.PI) / 180);
      ctx.fillStyle = n === 'N' ? '#c0392b' : '#4a5864';
      ctx.fillText(n, cx + v[0] * (R + 7), cy + v[1] * (R + 7));
    });
    const { lat, lon } = this.geo();
    // zonnebanen van de langste en kortste dag (vaag) en van de gekozen dag
    const y = this.ymd.slice(0, 4);
    const pathLine = (ymd, style, w) => {
      const pts = dayPath(ymd, lat, lon, 15);
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach((p, i) => { const s = toScreen(p.azimuth, p.altitude); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); });
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    pathLine(`${y}-06-21`, 'rgba(224,138,44,0.35)', 1);
    pathLine(`${y}-12-21`, 'rgba(61,127,181,0.35)', 1);
    pathLine(this.ymd, '#e08a2c', 2);
    if (this.mode === 'shadow') {
      const s = this.sun();
      if (s.altitude > 0) {
        const p = toScreen(s.azimuth, s.altitude);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]);
        ctx.strokeStyle = 'rgba(224,138,44,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, Math.PI * 2);
        ctx.fillStyle = '#f6be3b'; ctx.fill();
        ctx.strokeStyle = '#c47a12'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    ctx.restore();

    if (this.hover) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = '600 13px system-ui, -apple-system, sans-serif';
      const w = ctx.measureText(this.hover.text).width + 14;
      const bx = this.hover.s[0] + 16, by = this.hover.s[1] - 32;
      ctx.fillStyle = 'rgba(29, 43, 54, 0.9)';
      ctx.fillRect(bx, by, w, 24);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.hover.text, bx + 7, by + 12.5);
      ctx.restore();
    }
  }

  /** Uren zon onder de cursor (zonkaart). */
  hoverAt(e) {
    const before = this.hover;
    this.hover = null;
    if (this.active && this.mode === 'hours' && this.result) {
      const h = sunHoursAt(this.result, e.w);
      if (h != null) {
        this.hover = { s: e.s, text: `${h.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} uur zon · ${sunClass(h).name.toLowerCase()}` };
      }
    }
    if (before || this.hover) this.app.requestRender();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
