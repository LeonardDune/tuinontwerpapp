// Selecteren en bewerken: tikken of omcirkelen om te kiezen, daarna verplaatsen, draaien,
// schalen, maten aanpassen met grepen en hoekpunten verslepen.

import { Tool, snapPoint, drawBubble, drawSnapMarker } from './tools.js';
import { hitItem, itemOutline, itemSnapPoints, transformItem, measureText, invalidate } from './items.js';
import { STENCIL_MAP } from './stencils.js';
import { isBed, isGroup } from './planting.js';
import { isWall, isOpening, syncOpenings } from './walls.js';
import { formatLength } from './units.js';
import {
  dist, pointInPolygon, distToSegment, snapAngle, matTranslate, matMul, matScale, matRotate, angleOf,
} from './geom.js';
import {
  isRect, itemFrame, frameToWorld, worldToFrame, applyFrame, selectionBox, displayAngle, itemAngle, itemPivot,
} from './edit.js';

const DEG = Math.PI / 180;
const HANDLE_R = 16;
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Raak een element op zijn lijn of rand (vormen nog niet op hun binnenkant). */
function edgeHit(it, w, tol) {
  if (it.type === 'shape' && (it.kind === 'polygon' || it.kind === 'circle')) {
    const t = tol + (it.width || 0) / 2;
    if (it.kind === 'circle') return Math.abs(dist(w, it.points[0]) - dist(it.points[0], it.points[1])) <= t;
    const p = it.points;
    for (let i = 0; i < p.length; i++) if (distToSegment(w, p[i], p[(i + 1) % p.length]) <= t) return true;
    return false;
  }
  return hitItem(it, w, tol);
}

export class SelectTool extends Tool {
  get selection() { return this.app.selection; }

  selectedItems() {
    const out = [];
    for (const id of this.selection) {
      const f = this.app.store.findItem(id);
      if (f) out.push(f);
    }
    return out;
  }

  single() {
    const s = this.selectedItems();
    return s.length === 1 ? s[0].item : null;
  }

  // ------------------------------------------------------------------ grepen

  /** Alle grepen voor de huidige selectie, in schermcoördinaten. */
  handles() {
    const cam = this.app.cam;
    const items = this.selectedItems().map((f) => f.item);
    if (!items.length) return null;
    const S = (p) => cam.toScreen(p);
    const list = [];
    const it = items.length === 1 ? items[0] : null;
    const frame = it ? itemFrame(it) : null;
    let outline, rotPos, pivot;

    if (frame) {
      const f = frame;
      const round = it.type === 'stencil' && STENCIL_MAP[it.symbol]?.round && it.w === it.h;
      const uniform = round || it.type === 'image';
      outline = [[0, 0], [f.w, 0], [f.w, f.h], [0, f.h]].map(([x, y]) => S(frameToWorld(f, x, y)));
      const opening = isOpening(it);
      if (opening) {
        // deur/raam: de muur bepaalt de diepte, alleen de breedte is te verslepen
        for (const [hx, hy] of [[1, 0.5], [0, 0.5]]) list.push({ kind: 'frame', hx, hy, s: S(frameToWorld(f, f.w * hx, f.h * hy)), shape: 'round' });
      }
      for (const [hx, hy] of opening ? [] : [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        list.push({ kind: 'frame', hx, hy, uniform, s: S(frameToWorld(f, f.w * hx, f.h * hy)), shape: 'square' });
      }
      if (!uniform && !opening) {
        for (const [hx, hy] of [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) {
          list.push({ kind: 'frame', hx, hy, s: S(frameToWorld(f, f.w * hx, f.h * hy)), shape: 'round' });
        }
      }
      pivot = frameToWorld(f, f.w / 2, f.h / 2);
      const top = S(frameToWorld(f, f.w / 2, 0)), mid = S(pivot);
      const d = dist(top, mid) || 1;
      rotPos = [top[0] + ((top[0] - mid[0]) / d) * 34, top[1] + ((top[1] - mid[1]) / d) * 34];
      if (d < 1) rotPos = [top[0], top[1] - 34];
    } else {
      const box = selectionBox(items);
      const pad = 8 / cam.zoom;
      const corners = [[box.minX - pad, box.minY - pad], [box.maxX + pad, box.minY - pad], [box.maxX + pad, box.maxY + pad], [box.minX - pad, box.maxY + pad]];
      outline = corners.map(S);
      pivot = it ? itemPivot(it) : [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
      const editable = it && it.type === 'shape' && it.kind !== 'circle' || it?.type === 'dim' && it.kind !== 'area';
      const isCircle = it && it.type === 'shape' && it.kind === 'circle';
      if (!editable && !isCircle) {
        corners.forEach((c, i) => list.push({ kind: 'scale', s: outline[i], opposite: corners[(i + 2) % 4], shape: 'square' }));
      }
      if (editable) {
        const pts = it.type === 'dim' ? [it.a, it.b] : it.points;
        pts.forEach((p, i) => list.push({ kind: 'vertex', i, s: S(p), shape: 'vertex' }));
        if (it.type === 'shape') {
          const closed = it.kind === 'polygon';
          const n = closed ? pts.length : pts.length - 1;
          for (let i = 0; i < n; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            const m = S([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
            if (dist(S(a), S(b)) > 44) list.push({ kind: 'insert', i, s: m, shape: 'plus' });
          }
        }
      }
      if (isCircle) list.push({ kind: 'radius', s: S(it.points[1]), shape: 'vertex' });
      const topMid = [(outline[0][0] + outline[1][0]) / 2, (outline[0][1] + outline[1][1]) / 2];
      rotPos = [topMid[0], topMid[1] - 34];
    }
    const canRotate = !(it && it.type === 'dim');
    if (canRotate) list.push({ kind: 'rotate', s: rotPos, shape: 'rotate', pivot });
    return { list, outline, rotPos: canRotate ? rotPos : null, pivot, frame, item: it };
  }

  handleAt(s) {
    const h = this.handles();
    if (!h) return null;
    // vertex- en kadergrepen gaan voor; "+"-grepen liggen ertussen
    let best = null, bd = HANDLE_R + 4;
    for (const g of h.list) {
      const d = dist(s, g.s);
      const r = g.shape === 'plus' ? HANDLE_R - 4 : HANDLE_R + 4;
      if (d < r && d < bd + (g.shape === 'plus' ? -6 : 0)) { bd = d; best = g; }
    }
    if (best) return best;
    // binnen het kader verplaatsen geldt alleen voor elementen met een kader (rechthoek, stencil, tekst);
    // bij lijnen, vormen en muren telt alleen het element zelf (anders blokkeert een muur rond het huis alles)
    if (h.frame && pointInPolygon(s, h.outline)) return { kind: 'move' };
    // ook direct op een geselecteerd element (bij dunne lijnen ligt het kader er vlak omheen)
    const w = this.app.cam.toWorld(s);
    if (this.selectedItems().some(({ item }) => hitItem(item, w, 10 / this.app.cam.zoom))) return { kind: 'move' };
    return null;
  }

  // ------------------------------------------------------------------ invoer

  down(e) {
    const now = e.time;
    this.downS = e.s;
    if (this.selection.size) {
      const h = this.handleAt(e.s);
      if (h) {
        // dubbeltik op een hoekpunt = verwijderen; dubbeltik op tekst = bewerken
        if (h.kind === 'vertex' && this.lastTap && this.lastTap.kind === 'vertex' && this.lastTap.i === h.i && now - this.lastTap.t < 350) {
          this.lastTap = null;
          this.deleteVertex(h.i);
          return;
        }
        if (h.kind === 'move' && this.lastTap && this.lastTap.kind === 'move' && now - this.lastTap.t < 350) {
          const it = this.single();
          if (it && it.type === 'text') { this.lastTap = null; this.app.editText(it.id); return; }
        }
        this.startDrag(h, e);
        return;
      }
    }
    this.mode = 'lasso';
    this.path = [e.w];
    this.pathS = [e.s];
  }

  move(e) {
    if (this.mode === 'lasso') {
      if (dist(e.s, this.pathS[this.pathS.length - 1]) > 2) {
        this.path.push(e.w);
        this.pathS.push(e.s);
      }
    } else if (this.mode) {
      if (dist(e.s, this.downS) > 3) this.moved = true;
      this.updateDrag(e);
    }
  }

  up(e) {
    if (this.mode === 'lasso') {
      this.finishLasso(e);
    } else if (this.mode) {
      if (this.moved) this.app.store.commit('edit');
      else this.app.store.cancel();
      if (!this.moved) this.lastTap = { kind: this.drag.kind, i: this.drag.i, t: e.time };
      if (!this.moved && this.drag.kind === 'move') {
        // tik zonder slepen: wat ligt er bovenop? Dat selecteren (of niets, op een lege plek)
        const hit = this.pickAt(e.w);
        if (!hit) this.app.setSelection(new Set());
        else if (!this.selection.has(hit.item.id)) {
          if (hit.layer.id !== this.app.store.doc.activeLayer) this.app.setActiveLayer(hit.layer.id);
          this.app.setSelection(new Set([hit.item.id]));
        }
      }
    }
    this.mode = null;
    this.path = null;
    this.drag = null;
    this.snap = null;
    this.app.updateSelectionUI();
  }

  cancel() {
    if (this.mode && this.mode !== 'lasso') this.app.store.cancel();
    this.mode = null;
    this.path = null;
    this.drag = null;
  }

  // ------------------------------------------------------------------ selecteren

  /** Bovenste element onder een punt: eerst lijnen/randen, dan binnenkant van vormen. */
  pickAt(w) {
    const app = this.app;
    const tol = 9 / app.cam.zoom;
    const layers = app.store.doc.layers;
    for (const pass of [0, 1]) {
      for (let li = layers.length - 1; li >= 0; li--) {
        const layer = layers[li];
        if (!layer.visible || layer.locked) continue;
        for (let i = layer.items.length - 1; i >= 0; i--) {
          const it = layer.items[i];
          if (pass === 0 && edgeHit(it, w, tol)) return { layer, item: it };
          if (pass === 1 && it.type === 'shape' && !it.wall) {
            if (it.kind === 'polygon' && pointInPolygon(w, it.points)) return { layer, item: it };
            if (it.kind === 'circle' && dist(w, it.points[0]) <= dist(it.points[0], it.points[1])) return { layer, item: it };
          }
        }
      }
    }
    return null;
  }

  finishLasso(e) {
    const app = this.app;
    const xs = this.pathS.map((p) => p[0]), ys = this.pathS.map((p) => p[1]);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const ids = new Set();
    if (this.pathS.length < 4 || extent < 8) {
      const hit = this.pickAt(e.w);
      if (hit) {
        ids.add(hit.item.id);
        if (hit.layer.id !== app.store.doc.activeLayer) app.setActiveLayer(hit.layer.id);
      }
    } else {
      const layer = app.editableLayer();
      if (layer) {
        const poly = this.path;
        for (const item of layer.items) {
          if (item.type === 'stencil' || item.type === 'text' || item.type === 'image') {
            const c = item.type === 'text' ? [item.x + measureText(item).w / 2, item.y - item.size / 2] : [item.x, item.y];
            if (pointInPolygon(c, poly)) ids.add(item.id);
            continue;
          }
          let pts = itemOutline(item);
          if (!pts.length) continue;
          if (pts.length > 60) pts = pts.filter((_, i) => i % Math.ceil(pts.length / 60) === 0);
          const inside = pts.filter((p) => pointInPolygon(p, poly)).length;
          if (inside / pts.length >= 0.5) ids.add(item.id);
        }
      }
    }
    app.setSelection(ids);
  }

  // ------------------------------------------------------------------ slepen

  startDrag(h, e) {
    const app = this.app;
    app.store.begin();
    this.mode = h.kind;
    this.moved = false;
    this.drag = { ...h, startW: e.w, startS: e.s };
    const items = this.selectedItems();
    // groepen van een geselecteerd plantvak bewegen mee
    const bedIds = new Set(items.filter(({ item }) => isBed(item)).map(({ item }) => item.id));
    this.followers = [];
    if (bedIds.size && ['move', 'rotate', 'scale'].includes(h.kind)) {
      for (const layer of app.store.doc.layers) {
        for (const item of layer.items) if (isGroup(item) && bedIds.has(item.bedId) && !this.selection.has(item.id)) this.followers.push({ item, layer });
      }
    }
    this.orig = new Map([...items, ...this.followers].map(({ item }) => [item.id, clone(item)]));
    const it = items.length === 1 ? items[0].item : null;
    if (h.kind === 'frame') this.drag.frame = itemFrame(it);
    if (h.kind === 'rotate') {
      const hs = this.handles();
      this.drag.pivot = hs.pivot;
      this.drag.baseAngle = it ? itemAngle(it) : null;
    }
    if (h.kind === 'insert') {
      // nieuw hoekpunt midden op de zijde en meteen verslepen
      const pts = it.points;
      const a = pts[h.i], b = pts[(h.i + 1) % pts.length];
      pts.splice(h.i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      invalidate(it);
      this.mode = 'vertex';
      this.drag.kind = 'vertex';
      this.drag.i = h.i + 1;
      this.moved = true;
    }
    if (h.kind === 'move') {
      // punten om op te snappen, en punten van de selectie
      const sel = new Set(items.map(({ item }) => item.id));
      this.drag.targets = [];
      for (const layer of app.store.doc.layers) {
        if (!layer.visible) continue;
        for (const item of layer.items) if (!sel.has(item.id)) this.drag.targets.push(...itemSnapPoints(item));
      }
      this.drag.own = items.flatMap(({ item }) => itemSnapPoints(item).map((p) => [p[0], p[1]]));
    }
  }

  restore() {
    for (const [id, orig] of this.orig) {
      const f = this.app.store.findItem(id);
      if (!f) continue;
      for (const k of Object.keys(f.item)) delete f.item[k];
      Object.assign(f.item, clone(orig));
      invalidate(f.item);
    }
  }

  updateDrag(e) {
    const app = this.app;
    const d = this.drag;
    const cam = app.cam;
    this.liveS = e.s;
    this.liveInfo = null;
    this.snap = null;
    const it = this.single();

    if (d.kind === 'move') {
      let dx = e.w[0] - d.startW[0], dy = e.w[1] - d.startW[1];
      // snap: een punt van de selectie op een punt van een ander element
      if (app.settings.snap && d.own.length && d.targets.length) {
        let best = null, bd = 10 / cam.zoom;
        for (const p of d.own) {
          const q = [p[0] + dx, p[1] + dy];
          for (const t of d.targets) {
            const dd = Math.hypot(t[0] - q[0], t[1] - q[1]);
            if (dd < bd) { bd = dd; best = [t[0] - p[0], t[1] - p[1], t]; }
          }
        }
        if (best) { dx = best[0]; dy = best[1]; this.snap = { p: best[2], kind: 'point' }; }
      }
      this.restore();
      const m = matTranslate(dx, dy);
      for (const { item } of [...this.selectedItems(), ...this.followers]) transformItem(item, m, 1, 0);
    } else if (d.kind === 'rotate') {
      const c = d.pivot;
      let r = angleOf(c, e.w) - angleOf(c, d.startW);
      if (d.baseAngle != null) {
        // absolute hoek van het element klikt per 15°
        const target = snapAngle(d.baseAngle + r, 15 * DEG, 3 * DEG);
        r = target - d.baseAngle;
        this.liveInfo = `${String(displayAngle(d.baseAngle + r)).replace('.', ',')}°`;
      } else {
        r = snapAngle(r, 15 * DEG, 3 * DEG);
        this.liveInfo = `${String(displayAngle(-r)).replace('.', ',')}°`;
      }
      this.restore();
      const m = matMul(matTranslate(c[0], c[1]), matMul(matRotate(r), matTranslate(-c[0], -c[1])));
      for (const { item } of [...this.selectedItems(), ...this.followers]) transformItem(item, m, 1, r);
    } else if (d.kind === 'scale') {
      const o = d.opposite;
      const s = Math.max(0.02, dist(o, e.w) / Math.max(1e-9, dist(o, d.startW)));
      this.restore();
      const m = matMul(matTranslate(o[0], o[1]), matMul(matScale(s), matTranslate(-o[0], -o[1])));
      for (const { item } of [...this.selectedItems(), ...this.followers]) transformItem(item, m, s, 0);
      this.liveInfo = `${Math.round(s * 100)}%`;
    } else if (d.kind === 'frame') {
      const f = d.frame;
      const snap = snapPoint(app, e.w, null, new Set([it.id]));
      if (snap.kind === 'point' || snap.kind === 'edge') this.snap = snap;
      const [px, py] = worldToFrame(f, snap.p);
      let xa = 0, xb = f.w, ya = 0, yb = f.h;
      if (d.hx !== 0.5) { xa = (1 - d.hx) * f.w; xb = px; }
      if (d.hy !== 0.5) { ya = (1 - d.hy) * f.h; yb = py; }
      if (d.uniform) {
        // in verhouding: grootste factor bepaalt
        const k = Math.max(Math.abs(xb - xa) / Math.abs(f.w || 1), Math.abs(yb - ya) / Math.abs(f.h || 1));
        xb = xa + Math.sign(xb - xa || 1) * Math.abs(f.w) * k;
        yb = ya + Math.sign(yb - ya || 1) * Math.abs(f.h) * k;
      }
      const min = 0.02;
      if (Math.abs(xb - xa) < min) xb = xa + min * Math.sign(xb - xa || 1);
      if (Math.abs(yb - ya) < min) yb = ya + min * Math.sign(yb - ya || 1);
      this.restore();
      const nf = { ang: f.ang, o: frameToWorld(f, xa, ya), w: xb - xa, h: yb - ya };
      applyFrame(it, nf);
      const sc = app.store.doc.scale;
      this.liveInfo = `${formatLength(Math.abs(nf.w), sc)} × ${formatLength(Math.abs(nf.h), sc)}`;
    } else if (d.kind === 'vertex') {
      const pts = it.type === 'dim' ? null : it.points;
      const prev = pts ? pts[d.i - 1] || (it.kind === 'polygon' ? pts[pts.length - 1] : null) : (d.i === 1 ? it.a : it.b);
      const snap = snapPoint(app, e.w, prev, new Set([it.id]));
      if (snap.kind) this.snap = snap;
      const p = [Math.round(snap.p[0] * 10000) / 10000, Math.round(snap.p[1] * 10000) / 10000];
      if (it.type === 'dim') {
        if (d.i === 0) it.a = p; else it.b = p;
        this.liveInfo = formatLength(dist(it.a, it.b), app.store.doc.scale);
      } else {
        pts[d.i] = p;
        if (prev) this.liveInfo = formatLength(dist(prev, p), app.store.doc.scale);
      }
      invalidate(it);
    } else if (d.kind === 'radius') {
      const snap = snapPoint(app, e.w, null, new Set([it.id]));
      if (snap.kind) this.snap = snap;
      it.points = [it.points[0], snap.p];
      invalidate(it);
      this.liveInfo = `Ø ${formatLength(dist(it.points[0], snap.p) * 2, app.store.doc.scale)}`;
    }
    this.syncWalls();
    app.store.touch();
  }

  /** Deuren en ramen blijven in hun muur: meebewegen met de muur, of opnieuw inklikken na verslepen. */
  syncWalls() {
    const sel = this.selectedItems().map(({ item }) => item);
    const wallIds = new Set(sel.filter(isWall).map((w) => w.id));
    const moved = sel.filter((o) => isOpening(o) && !(o.wallId && wallIds.has(o.wallId)));
    if (wallIds.size || moved.length) syncOpenings(this.app.store.doc, wallIds, moved, 30 / this.app.cam.zoom);
  }

  deleteVertex(i) {
    const it = this.single();
    if (!it || it.type !== 'shape') return;
    const min = it.kind === 'polygon' ? 3 : 2;
    if (it.points.length <= min) {
      this.app.toast('Minder punten kan niet; verwijder het element met de prullenbak.');
      return;
    }
    this.app.store.mutate(() => {
      it.points.splice(i, 1);
      if (it.rect) delete it.rect;
      invalidate(it);
      if (isWall(it)) syncOpenings(this.app.store.doc, new Set([it.id]));
    }, 'vertex-delete');
  }

  // ------------------------------------------------------------------ tekenen

  drawScreen(ctx) {
    if (this.mode === 'lasso' && this.pathS && this.pathS.length > 1) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#2f5d3a';
      ctx.fillStyle = 'rgba(47, 93, 58, 0.07)';
      ctx.beginPath();
      this.pathS.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (!this.selection.size) return;
    const h = this.handles();
    if (!h) return;
    ctx.save();
    ctx.strokeStyle = '#2f5d3a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    h.outline.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    if (h.rotPos) {
      const top = [(h.outline[0][0] + h.outline[1][0]) / 2, (h.outline[0][1] + h.outline[1][1]) / 2];
      ctx.beginPath();
      ctx.moveTo(top[0], top[1]);
      ctx.lineTo(h.rotPos[0], h.rotPos[1]);
      ctx.stroke();
    }
    for (const g of h.list) {
      const [x, y] = g.s;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#2f5d3a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (g.shape === 'square') ctx.rect(x - 6.5, y - 6.5, 13, 13);
      else if (g.shape === 'round') ctx.arc(x, y, 6, 0, Math.PI * 2);
      else if (g.shape === 'vertex') { ctx.fillStyle = '#2f5d3a'; ctx.arc(x, y, 6.5, 0, Math.PI * 2); }
      else if (g.shape === 'plus') ctx.arc(x, y, 7, 0, Math.PI * 2);
      else if (g.shape === 'rotate') ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (g.shape === 'plus') {
        ctx.beginPath();
        ctx.moveTo(x - 3.5, y); ctx.lineTo(x + 3.5, y);
        ctx.moveTo(x, y - 3.5); ctx.lineTo(x, y + 3.5);
        ctx.stroke();
      }
      if (g.shape === 'rotate') {
        ctx.beginPath();
        ctx.arc(x, y, 5, -Math.PI * 0.9, Math.PI * 0.4);
        ctx.stroke();
      }
    }
    ctx.restore();
    drawSnapMarker(ctx, this.app, this.snap);
    if (this.mode && this.liveInfo && this.liveS) drawBubble(ctx, this.liveInfo, this.liveS[0], this.liveS[1]);
  }
}

export { isRect };
