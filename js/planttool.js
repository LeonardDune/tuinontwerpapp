// Gereedschap "Beplanten": plantvakken (contouren), groepen binnen een vak en solitairen.
//   Plantvak: vrij, rechthoek, cirkel of "tik in ruimte" (volgt de lijnen van het ontwerp).
//   Groep:    vrij, rechthoek of cirkel, altijd binnen een plantvak (wordt erdoor begrensd).
//   Solitair: een losse bouwsteen, mag overal staan.

import { Tool, snapPoint, drawSnapMarker, drawBubble } from './tools.js';
import { drawItem } from './items.js';
import { uid, paperToWorld } from './model.js';
import { roleDiameter, rolesMap, ROLES, isBed, shapePolygon, smoothClosed } from './planting.js';
import { regionAt } from './region.js';
import { simplify, dist, polygonArea, pointInPolygon, polygonCentroid } from './geom.js';
import { formatArea, formatLength } from './units.js';

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

export class PlantTool extends Tool {
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

  down(e) {
    this.layer = this.app.editableLayer();
    if (!this.layer) return;
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
        this.app.toast(hasBeds(doc) ? 'Een groep begint binnen een plantvak.' : 'Teken eerst een plantvak; groepen komen daarbinnen. Solitairen mogen overal.');
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
      } else {
        item = newBed(res.points, res.kind, this.mix(false), scale);
      }
    } else if (this.preview) {
      item = { ...this.preview, x: r4(this.preview.x), y: r4(this.preview.y) };
    } else {
      const geo = this.geometry();
      if (geo) {
        const poly = geo.kind === 'circle' ? null : geo.points;
        const big = geo.kind === 'circle' ? dist(geo.points[0], geo.points[1]) > 0.1 : Math.abs(polygonArea(poly)) > 0.05;
        if (big) {
          const points = geo.points.map(rp);
          const extra = geo.rect ? { rect: true } : {};
          if (mode === 'groep') {
            const c = geo.kind === 'circle' ? geo.points[0] : polygonCentroid(poly);
            const bed = pointInPolygon(c, shapePolygon(this.bed)) ? this.bed : (bedAt(doc, c) || this.bed);
            item = newGroup(points, geo.kind, this.mix(), bed.id, scale, extra);
          } else {
            item = newBed(points, geo.kind, this.mix(false), scale, extra);
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
    const geo = this.geometry();
    if (!geo) return;
    const mode = this.mode();
    const doc = this.app.store.doc;
    const tmp = mode === 'groep' && this.bed
      ? newGroup(geo.points, geo.kind, this.mix(), this.bed.id, doc.scale)
      : newBed(geo.points, geo.kind, this.mix(false), doc.scale);
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
    } else if (geo.rect) {
      const [a, b, , d] = geo.points;
      drawBubble(ctx, `${formatLength(dist(a, b))} × ${formatLength(dist(a, d))}`, this.curS[0], this.curS[1]);
    } else {
      drawBubble(ctx, formatArea(Math.abs(polygonArea(geo.points))), this.curS[0], this.curS[1]);
    }
  }
}
