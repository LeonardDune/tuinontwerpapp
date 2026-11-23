// Gereedschap "Beplanten": plantvakken (contouren), groepen binnen een vak en solitairen.
//   Plantvak: vrij, rechthoek, cirkel of "tik in ruimte" (volgt de lijnen van het ontwerp).
//   Groep:    vrij, rechthoek of cirkel, altijd binnen een plantvak (wordt erdoor begrensd).
//   Solitair: een losse bouwsteen, mag overal staan.

import { Tool, snapPoint, drawSnapMarker, drawBubble } from './tools.js';
import { drawItem } from './items.js';
import { uid, paperToWorld } from './model.js';
import { roleDiameter, rolesMap, ROLES, isBed, shapePolygon, smoothClosed, BED_TYPES, roleSpacing } from './planting.js';
import { regionAt } from './region.js';
import { simplify, dist, polygonArea, pointInPolygon, polygonCentroid } from './geom.js';
import { formatArea, formatLength } from './units.js';
import { arcPolygon, arcParams } from './arc.js';
import { brushStones, stonesOutline, SCATTER_JOINT } from './scatter.js';
import { BOND_TYPES } from './bonds.js';

const r4 = (v) => Math.round(v * 10000) / 10000;
const rp = (p) => [r4(p[0]), r4(p[1])];

/** Het kleinste zichtbare plantvak waarin p ligt. */
export function bedAt(doc, p) {
  let best = null, ba = Infinity;
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const it of layer.items) {
      if (!isBed(it)) continue;
      const poly = shapePolygon(it);
      if (!pointInPolygon(p, poly)) continue;
      const a = Math.abs(polygonArea(poly));
      if (a < ba) { ba = a; best = it; }
    }
  }
  return best;
}

export function hasBeds(doc) {
  return doc.layers.some((l) => l.items.some((it) => isBed(it)));
}

export function newBed(points, kind, mix, scale, extra = {}) {
  return {
    type: 'shape', id: uid(), kind, points, color: '#3f7a2e', width: paperToWorld(0.3, scale),
    bed: true, planting: { mix }, ...extra,
  };
}

export function newGroup(points, kind, mix, bedId, scale, extra = {}) {
  return {
    type: 'shape', id: uid(), kind, points, color: '#2f4a25', width: paperToWorld(0.2, scale),
    group: true, bedId, planting: { mix }, ...extra,
  };
}

/**
 * Een natuurlijk gevormde vlek voor een groepje van n planten: iets uitgerekt (zoals een 'drift'), met een
 * golvende rand, en zo groot als n planten op hun plantafstand nodig hebben.
 */
export function groupBlob(center, role, n, seed = 1) {
  const s = roleSpacing(role);
  const area = Math.max(0.05, n * s * s * 0.95);
  let k = Math.abs(Math.round(seed)) % 2147483646 + 1;
  const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  const ratio = n <= 3 ? 1.15 : 1.4 + rnd() * 0.4;
  const a = Math.sqrt((area * ratio) / Math.PI), b = area / (Math.PI * a);
  const rot = rnd() * Math.PI;
  const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28;
  const pts = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const wob = 1 + 0.1 * Math.sin(t * 2 + ph1) + 0.07 * Math.sin(t * 3 + ph2);
    const x = Math.cos(t) * a * wob, y = Math.sin(t) * b * wob;
    pts.push(rp([center[0] + x * Math.cos(rot) - y * Math.sin(rot), center[1] + x * Math.sin(rot) + y * Math.cos(rot)]));
  }
  return pts;
}

export class PlantTool extends Tool {
  /** Type voor de schets (bodembedekkers, laag, middel, hoog) van een nieuw plantvak. */
  btype() {
    const t = this.app.state.bedType;
    return BED_TYPES[t] ? { btype: t } : {};
  }

  /** Nieuw vak van dit gereedschap (plantvak; het verhardingsgereedschap maakt een verhardingsvak). */
  makeVak(points, kind, scale, extra) {
    return newBed(points, kind, this.mix(false), scale, { ...extra, ...this.btype() });
  }

  vakAt() { return false; }

  get roles() {
    return this.app.store.doc.planting?.roles || [];
  }

  current() {
    const id = this.app.state.plantRole;
    return this.roles.find((r) => r.id === id) || this.roles[0] || null;
  }

  mode() {
    const m = this.app.state.plantMode || 'vak';
    return m === 'plant' || m === 'groep' ? m : 'vak';
  }

  shape() {
    if (this.mode() === 'groep') return 'vrij'; // groepjes: tikken (of zelf een omtrek slepen), geen vaste vormen
    const s = this.app.state.plantShape || 'vrij';
    if (s === 'tik' && this.mode() !== 'vak') return 'vrij';
    return s;
  }

  /** Gekozen bouwstenen als mix, met het standaardgewicht van hun rol. */
  mix(fallback = true) {
    const ids = this.app.state.plantMix || [];
    const roles = rolesMap(this.app.store.doc);
    const mix = ids.filter((id) => roles[id]).map((id) => ({ role: id, w: ROLES[roles[id].role]?.weight || 30 }));
    if (mix.length || !fallback) return mix;
    const cur = this.current();
    return cur ? [{ role: cur.id, w: 100 }] : [];
  }

  /** Aantal planten in een groepje. */
  groupCount() { return [3, 5, 7, 9].includes(this.app.state.groupCount) ? this.app.state.groupCount : 5; }

  /** Voorbeeld van het groepje op plek w (of null buiten een plantvak). */
  blobAt(w) {
    const r = this.current();
    const bed = r && bedAt(this.app.store.doc, w);
    if (!bed) return null;
    return { bed, item: newGroup(groupBlob(w, r, this.groupCount(), Math.round(w[0] * 997 + w[1] * 131)), 'polygon', [{ role: r.id, w: 100 }], bed.id, this.app.store.doc.scale) };
  }

  hover(e) {
    this.hoverW = e.w;
    this.curS = e.s;
    if (this.mode() === 'groep' || this.mode() === 'plant') this.app.requestRender();
  }

  down(e) {
    this.layer = this.app.editableLayer();
    if (!this.layer) return;
    this.hoverW = null;
    this.downS = e.s;
    const mode = this.mode();
    const doc = this.app.store.doc;
    if (mode !== 'vak' && !this.roles.length) {
      this.app.toast('Maak eerst een bouwsteen in het paneel Beplanting.');
      this.app.plantPanel.open();
      this.layer = null;
      return;
    }
    if (mode === 'groep') {
      this.bed = bedAt(doc, e.w);
      if (!this.bed) {
        this.app.toast(hasBeds(doc) ? 'Tik binnen een plantvak om daar een groepje te leggen.' : 'Teken eerst een plantvak; groepjes komen daarbinnen. Een losse plant mag overal.');
        this.layer = null;
        return;
      }
    }
    if (mode === 'plant') {
      const r = this.current();
      this.snap = snapPoint(this.app, e.w);
      this.preview = { type: 'plant', id: uid(), role: r.id, x: this.snap.p[0], y: this.snap.p[1], d: this.app.state.plantD?.[r.id] || roleDiameter(r) };
      return;
    }
    const shape = this.shape();
    if (shape === 'tik') {
      this.tap = { s: e.s, w: e.w };
      return;
    }
    if (shape === 'vrij') {
      this.pts = [e.w];
      this.ptsS = [e.s];
      return;
    }
    this.snap = mode === 'vak' ? snapPoint(this.app, e.w) : null;
    this.start = this.snap ? this.snap.p : e.w;
    this.end = this.start;
  }

  move(e) {
    this.curS = e.s;
    if (!this.layer) return;
    if (this.pts) {
      if (dist(e.s, this.ptsS[this.ptsS.length - 1]) > 2) {
        this.pts.push(e.w);
        this.ptsS.push(e.s);
      }
      return;
    }
    if (this.preview) {
      this.snap = snapPoint(this.app, e.w);
      this.preview.x = this.snap.p[0];
      this.preview.y = this.snap.p[1];
      return;
    }
    if (this.start) {
      this.snap = this.mode() === 'vak' ? snapPoint(this.app, e.w) : null;
      this.end = this.snap ? this.snap.p : e.w;
    }
  }

  /** Vorm van wat er nu getekend wordt: { kind, points } of null. */
  geometry() {
    if (this.pts && this.pts.length > 2) {
      let pts = simplify(this.pts, 1.5 / this.app.cam.zoom);
      if (pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < 1e-9) pts = pts.slice(0, -1);
      if (pts.length < 3) return null;
      return { kind: 'polygon', points: smoothClosed(simplify(pts, 3 / this.app.cam.zoom), 2) };
    }
    if (this.start && this.end) {
      const cam = this.app.cam;
      if (this.shape() === 'cirkel') return { kind: 'circle', points: [this.start, this.end] };
      if (this.shape() === 'boog') {
        // van het middelpunt naar de binnenrand; breedte en hoek uit de opties
        const r1 = dist(this.start, this.end);
        if (r1 < 0.05) return null;
        const st = this.app.state;
        const width = st.arcWidth || 0.8, sweep = ((st.arcAngle || 180) * Math.PI) / 180;
        const mid = Math.atan2(this.end[1] - this.start[1], this.end[0] - this.start[0]);
        return { kind: 'polygon', arc: true, points: arcPolygon(this.start, r1, r1 + width, mid, sweep) };
      }
      const a = cam.toScreen(this.start), b = cam.toScreen(this.end);
      return { kind: 'polygon', rect: true, points: [a, [b[0], a[1]], b, [a[0], b[1]]].map((s) => cam.toWorld(s)) };
    }
    return null;
  }

  up() {
    if (!this.layer) return;
    const doc = this.app.store.doc;
    const scale = doc.scale;
    const mode = this.mode();
    let item = null;
    if (this.tap) {
      const tapW = this.tap.w;
      const res = regionAt(doc, tapW, { toScreen: (p) => this.app.cam.toScreen(p), toWorld: (s) => this.app.cam.toWorld(s), width: this.app.width, height: this.app.height });
      this.tap = null;
      const existing = res.error ? null : bedAt(doc, tapW);
      const area = (pts, kind) => (kind === 'circle' ? Math.PI * dist(pts[0], pts[1]) ** 2 : Math.abs(polygonArea(pts)));
      if (res.error) {
        this.app.toast(res.error);
      } else if (existing && Math.abs(area(shapePolygon(existing), 'polygon') - area(res.points, res.kind)) / area(res.points, res.kind) < 0.05) {
        this.app.toast('Hier ligt al een plantvak.');
      } else if (this.vakAt(tapW, res)) {
        this.app.toast('Hier ligt al een verhardingsvak.');
      } else {
        item = this.makeVak(res.points, res.kind, scale, {});
      }
    } else if (this.preview) {
      item = { ...this.preview, x: r4(this.preview.x), y: r4(this.preview.y) };
    } else if (mode === 'groep' && this.pts && (this.pts.length < 4 || Math.max(...this.ptsS.map((q) => dist(q, this.downS))) < 10)) {
      // tik: een groepje van n planten op deze plek
      const b = this.blobAt(this.pts[0]);
      if (b) {
        item = b.item;
        const r = this.current();
        this.app.toast(`Groepje van ${this.groupCount()} × ${r.label || r.code} gelegd. Tik nog eens voor nog een groepje.`, 2500);
      }
    } else {
      const geo = this.geometry();
      if (geo) {
        const poly = geo.kind === 'circle' ? null : geo.points;
        const big = geo.kind === 'circle' ? dist(geo.points[0], geo.points[1]) > 0.1 : Math.abs(polygonArea(poly)) > 0.05;
        if (big) {
          const points = geo.points.map(rp);
          const extra = geo.rect ? { rect: true } : geo.arc ? { arc: true } : {};
          if (mode === 'groep') {
            const c = geo.kind === 'circle' ? geo.points[0] : polygonCentroid(poly);
            const bed = pointInPolygon(c, shapePolygon(this.bed)) ? this.bed : (bedAt(doc, c) || this.bed);
            const r = this.current();
            item = newGroup(points, geo.kind, r ? [{ role: r.id, w: 100 }] : this.mix(), bed.id, scale, extra);
          } else {
            item = this.makeVak(points, geo.kind, scale, extra);
          }
        }
      }
    }
    this.cancel();
    if (!item) return;
    const layerId = this.layer.id;
    this.app.store.mutate((d) => {
      d.layers.find((l) => l.id === layerId)?.items.push(item);
    }, 'plant');
    if (item.bed || item.group) this.app.lastPlantItem = item.id;
    // het paneel Beplanting blijft over het vak gaan waarin je werkt
    if (this.app.plantPanel && (item.bed || item.group)) { this.app.plantPanel.focusId = item.group ? item.bedId : item.id; this.app.plantPanel.refresh(); }
  }

  cancel() {
    this.pts = null;
    this.preview = null;
    this.snap = null;
    this.start = null;
    this.end = null;
    this.tap = null;
    this.bed = null;
  }

  drawWorld(g, rc) {
    if (this.preview) {
      drawItem(g, this.preview, rc);
      return;
    }
    if (this.mode() === 'groep' && this.hoverW && !this.pts) {
      // voorbeeld: hier komt het groepje als je tikt
      const b = this.blobAt(this.hoverW);
      if (b) {
        b.item.id = 'voorbeeld';
        g.save();
        g.globalAlpha *= 0.75;
        drawItem(g, b.item, { ...rc, bedsById: { ...rc.bedsById, [b.bed.id]: b.bed }, groupsByBed: {} });
        g.restore();
      }
      return;
    }
    if (this.mode() === 'plant' && this.hoverW && !this.preview) {
      const r = this.current();
      if (r) { g.save(); g.globalAlpha *= 0.6; drawItem(g, { type: 'plant', id: 'voorbeeld', role: r.id, x: this.hoverW[0], y: this.hoverW[1], d: this.app.state.plantD?.[r.id] || roleDiameter(r) }, rc); g.restore(); }
      return;
    }
    const geo = this.geometry();
    if (!geo) return;
    const mode = this.mode();
    const doc = this.app.store.doc;
    const tmp = mode === 'groep' && this.bed
      ? newGroup(geo.points, geo.kind, this.current() ? [{ role: this.current().id, w: 100 }] : this.mix(), this.bed.id, doc.scale)
      : this.makeVak(geo.points, geo.kind, doc.scale, geo.rect ? { rect: true } : geo.arc ? { arc: true } : {});
    tmp.id = 'voorbeeld';
    const ctx = mode === 'groep' && this.bed ? { ...rc, bedsById: { ...rc.bedsById, [this.bed.id]: this.bed }, groupsByBed: {} } : { ...rc, groupsByBed: {} };
    drawItem(g, tmp, ctx);
  }

  drawScreen(ctx) {
    drawSnapMarker(ctx, this.app, this.snap);
    const geo = this.geometry();
    if (!geo || !this.curS) return;
    if (geo.kind === 'circle') {
      const r = dist(geo.points[0], geo.points[1]);
      drawBubble(ctx, `Ø ${formatLength(r * 2)} · ${formatArea(Math.PI * r * r)}`, this.curS[0], this.curS[1]);
    } else if (geo.arc) {
      const p = arcParams(geo.points);
      if (p) drawBubble(ctx, `binnen Ø ${formatLength(p.r1 * 2)} · breedte ${formatLength(p.r2 - p.r1)} · ${Math.round((p.sweep * 180) / Math.PI)}°`, this.curS[0], this.curS[1]);
    } else if (geo.rect) {
      const [a, b, , d] = geo.points;
      drawBubble(ctx, `${formatLength(dist(a, b))} × ${formatLength(dist(a, d))}`, this.curS[0], this.curS[1]);
    } else {
      drawBubble(ctx, formatArea(Math.abs(polygonArea(geo.points))), this.curS[0], this.curS[1]);
    }
  }
}


/** Verharden: werkt als Beplanten, maar tekent een verhardingsvak met de gekozen bouwsteen (verband). */
export class PaveTool extends PlantTool {
  mode() { return 'vak'; }

  shape() { return this.app.state.paveShape || 'rechthoek'; }

  makeVak(points, kind, scale, extra) {
    const blk = this.app.paveBlock();
    return {
      type: 'shape', id: uid(), kind, points, color: '#4a4640', width: paperToWorld(0.25, scale), ...extra,
      hatch: 'bond', bond: { ...blk.bond }, bondName: blk.name, ...(blk.lib ? { bondLib: blk.lib } : {}),
      ...(blk.border && kind === 'polygon' ? { border: blk.border } : {}),
    };
  }

  // ---- strooien: losse stenen met een penseel in het raster van het verband
  get scattering() { return this.shape() === 'strooien'; }

  brushR() { return Math.max(0.05, this.app.state.scatterSize || 0.5); }

  down(e) {
    if (!this.scattering) return super.down(e);
    this.layer = this.app.editableLayer();
    if (!this.layer) return;
    const blk = this.app.paveBlock();
    if (BOND_TYPES[blk.bond.type]?.surface) {
      this.app.toast('Kies een bouwsteen met stenen (klinkers, kasseien, tegels) om te strooien; halfverharding teken je als vak.', 4000);
      this.layer = null;
      return;
    }
    const erase = !!this.app.state.scatterErase;
    const r = this.brushR();
    // verder strooien in een steenveld met dezelfde steen dat hier al ligt (of bij gummen: elk steenveld)
    const near = (it) => {
      const o = stonesOutline(it);
      const xs = o.map((q) => q[0]), ys = o.map((q) => q[1]);
      return e.w[0] >= Math.min(...xs) - r - 0.3 && e.w[0] <= Math.max(...xs) + r + 0.3 && e.w[1] >= Math.min(...ys) - r - 0.3 && e.w[1] <= Math.max(...ys) + r + 0.3;
    };
    const sel = this.app.selection ? [...this.app.selection].map((id) => this.app.store.findItem(id)?.item).find((it) => it?.type === 'stones') : null;
    let target = sel && near(sel) ? sel : null;
    if (!target) for (const it of this.layer.items) if (it.type === 'stones' && (erase || it.bondName === blk.name) && near(it)) target = it;
    this.app.store.begin();
    this.created = false;
    if (!target) {
      if (erase) { this.app.store.cancel(); this.layer = null; return; }
      target = {
        type: 'stones', id: uid(), origin: rp(e.w), rot: 0,
        bond: { ...blk.bond, joint: Math.max(blk.bond.joint ?? 0.003, SCATTER_JOINT) }, bondName: blk.name, cells: [],
      };
      this.layer.items.push(target);
      this.created = true;
    }
    this.target = target;
    this.visited = new Set();
    this.seed = Math.floor(Math.random() * 100000);
    this.last = e.w;
    this.cur = e.s;
    this.dab(e.w);
  }

  dab(p) {
    const st = this.app.state;
    if (brushStones(this.target, p, this.brushR(), st.scatterDensity ?? 0.6, this.seed, this.visited, !!st.scatterErase)) this.app.store.touch();
  }

  move(e) {
    if (!this.scattering) return super.move(e);
    this.cur = e.s;
    if (!this.target) { this.app.requestRender(); return; }
    const step = this.brushR() * 0.3, d = dist(this.last, e.w);
    // tussenpunten, zodat een snelle streek geen gaten geeft (nieuwe cellen per stap)
    for (let t = step; t < d; t += step) {
      this.visited = new Set();
      this.dab([this.last[0] + (e.w[0] - this.last[0]) * (t / d), this.last[1] + (e.w[1] - this.last[1]) * (t / d)]);
    }
    if (d >= step) { this.visited = new Set(); this.dab(e.w); this.last = e.w; }
    this.app.requestRender();
  }

  up() {
    if (!this.scattering) return super.up();
    if (!this.target) return;
    if (this.created && !this.target.cells.length) this.layer.items.splice(this.layer.items.indexOf(this.target), 1);
    const id = this.target.cells.length ? this.target.id : null;
    this.target = null;
    this.app.store.commit('strooien');
    if (id && this.created) this.app.toast('Stenen gestrooid. Strooi verder om bij te vullen, of zet Weghalen aan om stenen weg te halen.', 3500);
  }

  hover(e) {
    if (!this.scattering) return super.hover?.(e);
    this.cur = e.s;
    this.app.requestRender();
  }

  cancel() {
    if (this.target) { this.target = null; this.app.store.cancel(); }
    return super.cancel();
  }

  drawScreen(ctx) {
    if (!this.scattering) return super.drawScreen(ctx);
    if (!this.cur) return;
    ctx.save();
    const rr = this.brushR() * this.app.cam.zoom;
    ctx.strokeStyle = this.app.state.scatterErase ? 'rgba(180, 40, 40, 0.75)' : 'rgba(29, 43, 54, 0.6)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash(this.app.state.scatterErase ? [5, 4] : []);
    ctx.beginPath();
    ctx.arc(this.cur[0], this.cur[1], rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  vakAt(w, res) {
    const a = Math.abs(polygonArea(res.points));
    return this.app.store.doc.layers.some((l) => l.visible && l.items.some((it) => it.bond && it.kind === 'polygon' && pointInPolygon(w, it.points) && Math.abs(Math.abs(polygonArea(it.points)) - a) / a < 0.05));
  }
}
