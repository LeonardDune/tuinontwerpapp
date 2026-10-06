// Gereedschap "Beplanten": losse bouwstenen plaatsen of een plantvak met een mix tekenen.

import { Tool, snapPoint, drawSnapMarker, drawBubble } from './tools.js';
import { drawItem } from './items.js';
import { uid, paperToWorld } from './model.js';
import { roleDiameter, rolesMap, ROLES } from './planting.js';
import { simplify, dist, polygonArea } from './geom.js';
import { formatArea } from './units.js';

const r4 = (v) => Math.round(v * 10000) / 10000;

export class PlantTool extends Tool {
  get roles() {
    return this.app.store.doc.planting?.roles || [];
  }

  current() {
    const id = this.app.state.plantRole;
    return this.roles.find((r) => r.id === id) || this.roles[0] || null;
  }

  mode() {
    return this.app.state.plantMode || 'plant';
  }

  /** Mix voor een nieuw plantvak: gekozen bouwstenen met het standaardgewicht van hun rol. */
  mix() {
    const ids = this.app.state.plantMix || [];
    const roles = rolesMap(this.app.store.doc);
    const mix = ids.filter((id) => roles[id]).map((id) => ({ role: id, w: ROLES[roles[id].role]?.weight || 30 }));
    if (mix.length) return mix;
    const cur = this.current();
    return cur ? [{ role: cur.id, w: 100 }] : [];
  }

  down(e) {
    this.layer = this.app.editableLayer();
    if (!this.layer) return;
    if (!this.roles.length) {
      this.app.toast('Maak eerst een bouwsteen in het paneel Beplanting.');
      this.app.plantPanel.open();
      this.layer = null;
      return;
    }
    if (this.mode() === 'vak') {
      this.pts = [e.w];
      this.ptsS = [e.s];
      return;
    }
    const r = this.current();
    this.snap = snapPoint(this.app, e.w);
    this.preview = { type: 'plant', id: uid(), role: r.id, x: this.snap.p[0], y: this.snap.p[1], d: this.app.state.plantD?.[r.id] || roleDiameter(r) };
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
    }
  }

  up() {
    if (!this.layer) return;
    let item = null;
    if (this.pts) {
      const pts = simplify(this.pts, 1.2 / this.app.cam.zoom).map((p) => [r4(p[0]), r4(p[1])]);
      this.pts = null;
      if (pts.length >= 3 && polygonArea(pts) > 0.05) {
        item = {
          type: 'shape', id: uid(), kind: 'polygon', points: pts, color: '#3f7a2e',
          width: paperToWorld(0.3, this.app.store.doc.scale), planting: { mix: this.mix() },
        };
      }
    } else if (this.preview) {
      item = { ...this.preview, x: r4(this.preview.x), y: r4(this.preview.y) };
      this.preview = null;
    }
    this.snap = null;
    if (!item) return;
    const layerId = this.layer.id;
    this.app.store.mutate((doc) => {
      doc.layers.find((l) => l.id === layerId)?.items.push(item);
    }, 'plant');
  }

  cancel() {
    this.pts = null;
    this.preview = null;
    this.snap = null;
  }

  drawWorld(g, rc) {
    if (this.preview) drawItem(g, this.preview, rc);
    if (this.pts && this.pts.length > 1) {
      drawItem(g, {
        type: 'shape', id: 'voorbeeld', kind: 'polygon', points: this.pts, color: '#3f7a2e',
        width: paperToWorld(0.3, rc.scale), planting: { mix: this.mix() },
      }, rc);
    }
  }

  drawScreen(ctx) {
    drawSnapMarker(ctx, this.app, this.snap);
    if (this.pts && this.pts.length > 2 && this.curS) drawBubble(ctx, formatArea(polygonArea(this.pts)), this.curS[0], this.curS[1]);
  }
}
