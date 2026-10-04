// Gereedschappen. Elk gereedschap krijgt genormaliseerde invoer:
// e = { s: [x, y] scherm, w: [x, y] wereld, pressure, pointerType, time }

import { BRUSHES } from './brushes.js';
import { uid, paperToWorld } from './model.js';
import {
  drawItem, hitItem, itemOutline, itemBBox, itemSnapPoints, transformItem, measureText,
} from './items.js';
import { STENCIL_MAP } from './stencils.js';
import { gridStepFor } from './render.js';
import { formatLength, formatAngle, parseLength, formatArea } from './units.js';
import { collectSegments } from './parallel.js';
import {
  dist, angleOf, DEG, snapAngle, pointInPolygon, unionBox, matMul, matTranslate, matRotate, matScale,
  simplify, distToSegment, clamp, projectOnLine, polygonArea,
} from './geom.js';

const round4 = (v) => Math.round(v * 10000) / 10000;
const roundPt = (p) => p.map((v, i) => (i < 2 ? round4(v) : Math.round(v * 100) / 100));

// ------------------------------------------------------------------ snappen

export function snapPoint(app, w, from = null, exclude = null) {
  const { cam, settings, store } = app;
  if (settings.snap) {
    let best = null, bd = 12 / cam.zoom;
    for (const layer of store.doc.layers) {
      if (!layer.visible) continue;
      for (const item of layer.items) {
        if (exclude && exclude.has(item.id)) continue;
        for (const p of itemSnapPoints(item)) {
          const d = dist(p, w);
          if (d < bd) { bd = d; best = p; }
        }
      }
    }
    if (best) return { p: [best[0], best[1]], kind: 'point' };
    // op een rand van een lijn of vorm
    let edge = null, ed = 9 / cam.zoom;
    for (const seg of collectSegments(store.doc, 0)) {
      if (exclude && exclude.has(seg.item.id)) continue;
      const d = distToSegment(w, seg.a, seg.b);
      if (d < ed) {
        const [q, t] = projectOnLine(w, seg.a, seg.b);
        if (t >= 0 && t <= 1) { ed = d; edge = q; }
      }
    }
    if (edge) return { p: edge, kind: 'edge' };
  }
  if (from && settings.angleSnap) {
    const ang = angleOf(from, w);
    const sn = snapAngle(ang, 15 * DEG, 4 * DEG);
    if (sn !== ang) {
      const len = dist(from, w);
      return { p: [from[0] + Math.cos(sn) * len, from[1] + Math.sin(sn) * len], kind: 'angle' };
    }
  }
  if (settings.snap && settings.grid) {
    const step = gridStepFor(cam.zoom, store.doc.grid);
    const g = [Math.round(w[0] / step) * step, Math.round(w[1] / step) * step];
    if (dist(g, w) < 8 / cam.zoom) return { p: g, kind: 'grid' };
  }
  return { p: w, kind: null };
}

/** Snappen, behalve als de invoer al langs een hulpmiddel (liniaal e.d.) is geleid. */
function pick(app, e, from = null) {
  return e.guided ? { p: e.w, kind: null } : snapPoint(app, e.w, from);
}

function drawSnapMarker(ctx, app, snap) {
  if (!snap || !snap.kind || snap.kind === 'angle') return;
  const s = app.cam.toScreen(snap.p);
  ctx.save();
  ctx.strokeStyle = snap.kind === 'point' ? '#d35400' : '#2f5d3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (snap.kind === 'point') ctx.arc(s[0], s[1], 7, 0, Math.PI * 2);
  else if (snap.kind === 'edge') {
    ctx.moveTo(s[0] - 6, s[1] - 6); ctx.lineTo(s[0] + 6, s[1] + 6);
    ctx.moveTo(s[0] + 6, s[1] - 6); ctx.lineTo(s[0] - 6, s[1] + 6);
  } else ctx.rect(s[0] - 5, s[1] - 5, 10, 10);
  ctx.stroke();
  ctx.restore();
}

export function drawBubble(ctx, text, x, y) {
  ctx.save();
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  const w = ctx.measureText(text).width + 14;
  const bx = x + 18, by = y - 34;
  ctx.fillStyle = 'rgba(29, 43, 54, 0.9)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx, by, w, 24, 8) : ctx.rect(bx, by, w, 24);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 7, by + 12.5);
  ctx.restore();
}

class Tool {
  constructor(app) { this.app = app; }
  down() {}
  move() {}
  up() {}
  cancel() {}
  hover() {}
  drawWorld() {}
  drawScreen() {}
  /** Het gereedschap is bezig met een handeling (bijv. veelhoek). */
  get busy() { return false; }
}

// ------------------------------------------------------------- pennen

export class DrawTool extends Tool {
  down(e) {
    this.layer = this.app.editableLayer();
    if (!this.layer) { this.points = null; return; }
    this.snap = this.app.activeGuideSnap; // invoer wordt door de app al langs de rand geleid
    this.points = [];
    this.lastS = null;
    this.pEma = null;
    this.stab = null;
    this.stab2 = null;
    this.rawHist = [];
    this.lastT = e.time;
    this.add(e);
  }

  /**
   * Stabilisator: tijdfilter in twee trappen (laagdoorlaat). Handtrilling (8–12 Hz) wordt
   * gedempt, ongeacht hoeveel punten per seconde binnenkomen (muis ~60, Apple Pencil 240).
   * Langs een liniaal/gradenboog (guided) is de invoer al exact.
   */
  stabilize(e) {
    const s = e.s;
    // ruwe invoer bewaren voor het laatste stukje (zie catchUp)
    (this.rawHist ||= []).push({ s, t: e.time, p: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : null });
    if (e.guided || !this.stab) {
      this.stab = s;
      this.stab2 = s;
      this.rawT = e.time;
      return s;
    }
    const smoothing = this.app.state.smoothing ?? 0.5;
    const tau = 32 * Math.pow(smoothing, 1.2); // ms per trap
    const dt = Math.max(0.5, e.time - this.rawT);
    this.rawT = e.time;
    const a = tau > 0.5 ? 1 - Math.exp(-dt / tau) : 1;
    this.stab = [this.stab[0] + (s[0] - this.stab[0]) * a, this.stab[1] + (s[1] - this.stab[1]) * a];
    this.stab2 = [this.stab2[0] + (this.stab[0] - this.stab2[0]) * a, this.stab2[1] + (this.stab[1] - this.stab2[1]) * a];
    return this.stab2;
  }

  add(e) {
    this.rawS = e.s;
    this.guided = e.guided;
    const s = this.stabilize(e);
    this.curS = e.s;
    if (this.lastS && dist(s, this.lastS) < 0.75) return;
    const brush = BRUSHES[this.app.state.brush];
    let p;
    if (e.pointerType === 'pen') {
      p = e.pressure > 0 ? e.pressure : 0.5;
    } else if (brush.pressure && this.lastS) {
      const dt = Math.max(1, e.time - this.lastT);
      const v = dist(s, this.lastS) / dt; // px per ms
      p = clamp(1.05 - v * 0.3, 0.3, 1);
    } else {
      p = 0.65;
    }
    this.pEma = this.pEma == null ? p : this.pEma * 0.55 + p * 0.45;
    const w = this.app.cam.toWorld(s);
    this.points.push([w[0], w[1], this.pEma]);
    this.lastS = s;
    this.lastT = e.time;
  }

  move(e) {
    if (this.points) this.add(e);
  }

  buildItem() {
    const { state, store } = this.app;
    let pts = this.points.length === 1
      ? [this.points[0], [this.points[0][0] + 1e-4, this.points[0][1], this.points[0][2]]]
      : this.points;
    if (!this.guided && pts.length > 3) {
      // sensorruis gladstrijken langs de lijn (in schermpixels), begin- en eindpunt blijven staan
      const sigma = (0.6 + (state.smoothing ?? 0.5) * 2.4) / this.app.cam.zoom;
      pts = smoothAlong(pts, sigma);
    }
    const item = {
      type: 'stroke',
      id: uid(),
      brush: state.brush,
      color: state.color,
      width: paperToWorld(state.widths[state.brush], store.doc.scale),
      opacity: state.opacity,
      points: pts.map(roundPt),
    };
    return item;
  }

  /** Laat de gestabiliseerde lijn bij het optillen alsnog tot de pen doorlopen. */
  catchUp() {
    const from = this.stab2 || this.stab;
    if (this.guided || !this.rawS || !from) return;
    if (dist(this.rawS, from) < 1) return;
    const p = this.pEma ?? 0.5;
    const smoothing = this.app.state.smoothing ?? 0.5;
    const lag = 2 * 32 * Math.pow(smoothing, 1.2); // vertraging van het tweetrapsfilter (ms)
    const hist = this.rawHist || [];
    const tEnd = hist.length ? hist[hist.length - 1].t : 0;
    const tail = hist.filter((r) => r.t >= tEnd - lag);
    const push = (sx, sy) => {
      const w = this.app.cam.toWorld([sx, sy]);
      this.points.push([w[0], w[1], p]);
    };
    if (tail.length >= 3) {
      // volg het werkelijke pad van de pen over het achterstallige stukje, vloeiend aansluitend
      const off = [from[0] - tail[0].s[0], from[1] - tail[0].s[1]];
      for (let k = 1; k < tail.length; k++) {
        const u = k / (tail.length - 1);
        push(tail[k].s[0] + off[0] * (1 - u), tail[k].s[1] + off[1] * (1 - u));
      }
    } else {
      const n = Math.min(16, Math.ceil(dist(this.rawS, from) / 3));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        push(from[0] + (this.rawS[0] - from[0]) * t, from[1] + (this.rawS[1] - from[1]) * t);
      }
    }
    this.stab = this.stab2 = this.rawS;
  }

  /**
   * Bij het optillen: hele streek opnieuw filteren, vooruit én achteruit (zonder vertraging).
   * De lijn eindigt zo precies waar de pen werd opgetild en ook het laatste stuk is glad.
   */
  refine() {
    const raw = this.rawHist || [];
    const smoothing = this.app.state.smoothing ?? 0.5;
    const tau = 32 * Math.pow(smoothing, 1.2);
    if (this.guided || raw.length < 4 || tau < 0.5) return false;
    const n = raw.length;
    const xs = raw.map((r) => r.s[0]), ys = raw.map((r) => r.s[1]), ts = raw.map((r) => r.t);
    // Gespiegelde verlenging aan beide uiteinden (punt-spiegeling), zodat het filter
    // de uiteinden niet naar binnen trekt. Lengte: ruim 4× de tijdconstante.
    const padT = 4 * tau;
    let m0 = 1; while (m0 < n - 1 && ts[m0] - ts[0] < padT) m0++;
    let m1 = 1; while (m1 < n - 1 && ts[n - 1] - ts[n - 1 - m1] < padT) m1++;
    const PX = [], PY = [], PT = [];
    for (let k = m0; k >= 1; k--) { PX.push(2 * xs[0] - xs[k]); PY.push(2 * ys[0] - ys[k]); PT.push(2 * ts[0] - ts[k]); }
    for (let i = 0; i < n; i++) { PX.push(xs[i]); PY.push(ys[i]); PT.push(ts[i]); }
    for (let k = 1; k <= m1; k++) { PX.push(2 * xs[n - 1] - xs[n - 1 - k]); PY.push(2 * ys[n - 1] - ys[n - 1 - k]); PT.push(2 * ts[n - 1] - ts[n - 1 - k]); }
    const N = PX.length;
    const pass = (arr, forward) => {
      const out = arr.slice();
      let a1 = forward ? arr[0] : arr[N - 1], a2 = a1;
      for (let k = 0; k < N; k++) {
        const i = forward ? k : N - 1 - k;
        const j = forward ? i - 1 : i + 1;
        const dt = j >= 0 && j < N ? Math.max(0.5, Math.abs(PT[i] - PT[j])) : 0;
        const al = dt ? 1 - Math.exp(-dt / tau) : 1;
        a1 += (arr[i] - a1) * al;
        a2 += (a1 - a2) * al;
        out[i] = a2;
      }
      return out;
    };
    const fx = pass(pass(PX, true), false).slice(m0, m0 + n);
    const fy = pass(pass(PY, true), false).slice(m0, m0 + n);
    // begin en eind exact op de pen
    fx[0] = xs[0]; fy[0] = ys[0]; fx[n - 1] = xs[n - 1]; fy[n - 1] = ys[n - 1];
    const pressures = this.points.map((q) => q[2]);
    const pAt = (i) => {
      if (raw[i].p != null) return raw[i].p;
      return pressures[Math.min(pressures.length - 1, Math.round((i / (n - 1)) * (pressures.length - 1)))] ?? 0.5;
    };
    const pts = [];
    let last = null, pE = null;
    for (let i = 0; i < n; i++) {
      const sc = [fx[i], fy[i]];
      const pr = pAt(i);
      pE = pE == null ? pr : pE * 0.55 + pr * 0.45;
      if (last && i < n - 1 && dist(sc, last) < 0.75) continue;
      const w = this.app.cam.toWorld(sc);
      pts.push([w[0], w[1], pE]);
      last = sc;
    }
    if (pts.length >= 2) this.points = pts;
    return true;
  }

  up() {
    if (!this.points || !this.points.length) { this.points = null; return; }
    if (!this.refine()) this.catchUp();
    const item = this.buildItem();
    const layerId = this.layer.id;
    this.app.store.mutate((doc) => {
      const layer = doc.layers.find((l) => l.id === layerId);
      if (layer) layer.items.push(item);
    }, 'stroke');
    this.points = null;
    this.snap = null;
  }

  cancel() {
    this.points = null;
    this.snap = null;
  }

  drawWorld(g, rc) {
    if (!this.points || !this.points.length) return;
    const item = this.buildItem();
    g.globalAlpha = this.layer.opacity;
    drawItem(g, item, rc);
  }

  drawScreen(ctx) {
    if (!this.points || !this.snap || this.points.length < 1) return;
    const a = this.points[0], b = this.points[this.points.length - 1];
    let text;
    if (this.snap.kind === 'ray') {
      const deg = this.snap.degrees();
      text = deg == null ? '' : `${formatAngle(deg * DEG)}  ·  ${formatLength(dist(a, b), this.app.store.doc.scale)}`;
    } else if (this.snap.kind === 'line') {
      text = formatLength(dist(a, b), this.app.store.doc.scale);
    }
    if (text) drawBubble(ctx, text, this.curS[0], this.curS[1]);
  }
}

// ------------------------------------------------------------- gum

export class EraserTool extends Tool {
  down(e) {
    this.layer = this.app.editableLayer();
    if (!this.layer) return;
    this.app.store.begin();
    this.active = true;
    this.last = e.w;
    this.cur = e.s;
    this.eraseAt(e.w);
  }

  move(e) {
    this.cur = e.s;
    if (!this.active) return;
    const r = this.radius();
    const d = dist(this.last, e.w);
    const n = Math.max(1, Math.ceil(d / (r * 0.5)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.eraseAt([this.last[0] + (e.w[0] - this.last[0]) * t, this.last[1] + (e.w[1] - this.last[1]) * t]);
    }
    this.last = e.w;
  }

  hover(e) {
    this.cur = e.s;
  }

  radius() {
    return this.app.state.eraserSize / this.app.cam.zoom;
  }

  eraseAt(w) {
    const r = this.radius();
    const out = [];
    let changed = false;
    for (const item of this.layer.items) {
      if (item.type === 'image') { out.push(item); continue; }
      if (item.type === 'stroke') {
        const pieces = splitStroke(item, w, r);
        if (pieces === null) { out.push(item); continue; }
        changed = true;
        out.push(...pieces);
        continue;
      }
      if (hitItem(item, w, r)) { changed = true; continue; }
      out.push(item);
    }
    if (changed) {
      this.layer.items = out;
      this.app.store.touch();
    }
  }

  up() {
    if (!this.active) return;
    this.active = false;
    this.app.store.commit('erase');
  }

  cancel() {
    if (!this.active) return;
    this.active = false;
    this.app.store.cancel();
  }

  drawScreen(ctx) {
    if (!this.cur) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(29, 43, 54, 0.6)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.cur[0], this.cur[1], this.app.state.eraserSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** Gaussische afvlakking langs de booglengte; venster krimpt naar de uiteinden toe. */
function smoothAlong(points, sigma) {
  const n = points.length;
  const along = new Float64Array(n);
  for (let i = 1; i < n; i++) along[i] = along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  const total = along[n - 1];
  const out = new Array(n);
  let lo = 0;
  for (let i = 0; i < n; i++) {
    const win = Math.min(3 * sigma, along[i], total - along[i]);
    if (win <= 0) { out[i] = points[i]; continue; }
    while (along[lo] < along[i] - win) lo++;
    let sx = 0, sy = 0, sp = 0, sw = 0;
    for (let j = lo; j < n && along[j] <= along[i] + win; j++) {
      const d = along[j] - along[i];
      const w = Math.exp(-(d * d) / (2 * sigma * sigma));
      sx += points[j][0] * w; sy += points[j][1] * w; sp += (points[j][2] ?? 0.5) * w; sw += w;
    }
    out[i] = [sx / sw, sy / sw, sp / sw];
  }
  return out;
}

/** Knip een streek door op de plek van de gum. null = onaangeroerd. */
function splitStroke(item, w, r) {
  const rr = r + item.width / 2;
  const pts = item.points;
  const removed = pts.map((p) => dist(p, w) <= rr);
  let any = removed.some(Boolean);
  const cutAfter = new Array(pts.length).fill(false);
  for (let i = 1; i < pts.length; i++) {
    if (!removed[i] && !removed[i - 1] && distToSegment(w, pts[i - 1], pts[i]) <= rr) {
      cutAfter[i - 1] = true;
      any = true;
    }
  }
  if (!any) return null;
  const pieces = [];
  let run = [];
  const flush = () => {
    if (run.length >= 2) pieces.push({ ...item, id: uid(), points: run });
    run = [];
  };
  for (let i = 0; i < pts.length; i++) {
    if (removed[i]) { flush(); continue; }
    run.push(pts[i]);
    if (cutAfter[i]) flush();
  }
  flush();
  return pieces;
}

// ------------------------------------------------------------- magische lasso

export class LassoTool extends Tool {
  get selection() { return this.app.selection; }

  selectedItems() {
    const out = [];
    for (const id of this.selection) {
      const f = this.app.store.findItem(id);
      if (f) out.push(f);
    }
    return out;
  }

  selectionBox() {
    let box = null;
    for (const { item } of this.selectedItems()) box = unionBox(box, itemBBox(item));
    return box;
  }

  /** Schermposities van kader en grepen. */
  handles() {
    const box = this.selectionBox();
    if (!box) return null;
    const cam = this.app.cam;
    const pad = 6 / cam.zoom;
    const corners = [
      [box.minX - pad, box.minY - pad], [box.maxX + pad, box.minY - pad],
      [box.maxX + pad, box.maxY + pad], [box.minX - pad, box.maxY + pad],
    ].map((p) => cam.toScreen(p));
    const topMid = [(corners[0][0] + corners[1][0]) / 2, (corners[0][1] + corners[1][1]) / 2];
    const botMid = [(corners[2][0] + corners[3][0]) / 2, (corners[2][1] + corners[3][1]) / 2];
    const len = dist(topMid, botMid) || 1;
    const up = [(topMid[0] - botMid[0]) / len, (topMid[1] - botMid[1]) / len];
    const rot = [topMid[0] + up[0] * 30, topMid[1] + up[1] * 30];
    return { box, corners, rot, topMid };
  }

  handleAt(s) {
    const h = this.handles();
    if (!h) return null;
    if (dist(s, h.rot) < 22) return 'rotate';
    for (const c of h.corners) if (dist(s, c) < 22) return 'scale';
    if (pointInPolygon(s, h.corners)) return 'move';
    return null;
  }

  down(e) {
    if (this.selection.size) {
      const h = this.handleAt(e.s);
      if (h) { this.startTransform(h, e); return; }
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
      this.updateTransform(e);
    }
  }

  up(e) {
    if (this.mode === 'lasso') this.finishLasso(e);
    else if (this.mode) this.app.store.commit('transform');
    this.mode = null;
    this.path = null;
    this.app.updateSelectionUI();
  }

  cancel() {
    if (this.mode && this.mode !== 'lasso') this.app.store.cancel();
    this.mode = null;
    this.path = null;
  }

  finishLasso(e) {
    const app = this.app;
    const xs = this.pathS.map((p) => p[0]), ys = this.pathS.map((p) => p[1]);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const ids = new Set();
    if (this.pathS.length < 4 || extent < 8) {
      // Tik: selecteer het bovenste item onder de vinger, in elke zichtbare, ontgrendelde laag.
      const tol = 8 / app.cam.zoom;
      const layers = app.store.doc.layers;
      for (let li = layers.length - 1; li >= 0 && !ids.size; li--) {
        const layer = layers[li];
        if (!layer.visible || layer.locked) continue;
        for (let i = layer.items.length - 1; i >= 0; i--) {
          if (hitItem(layer.items[i], e.w, tol)) {
            ids.add(layer.items[i].id);
            if (layer.id !== app.store.doc.activeLayer) app.setActiveLayer(layer.id);
            break;
          }
        }
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
          if (pts.length > 60) pts = pts.filter((_, i) => i % Math.ceil(pts.length / 60) === 0);
          const inside = pts.filter((p) => pointInPolygon(p, poly)).length;
          if (pts.length && inside / pts.length >= 0.5) ids.add(item.id);
        }
      }
    }
    app.setSelection(ids);
  }

  startTransform(kind, e) {
    const box = this.selectionBox();
    this.app.store.begin();
    this.mode = kind;
    this.startW = e.w;
    this.center = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
    this.orig = new Map(this.selectedItems().map(({ item }) => [item.id, JSON.parse(JSON.stringify(item))]));
  }

  updateTransform(e) {
    const c = this.center;
    let m, s = 1, r = 0;
    if (this.mode === 'move') {
      m = matTranslate(e.w[0] - this.startW[0], e.w[1] - this.startW[1]);
    } else if (this.mode === 'scale') {
      s = Math.max(0.02, dist(c, e.w) / Math.max(1e-9, dist(c, this.startW)));
      m = matMul(matTranslate(c[0], c[1]), matMul(matScale(s), matTranslate(-c[0], -c[1])));
    } else {
      r = angleOf(c, e.w) - angleOf(c, this.startW);
      r = snapAngle(r, 15 * DEG, 3 * DEG);
      m = matMul(matTranslate(c[0], c[1]), matMul(matRotate(r), matTranslate(-c[0], -c[1])));
    }
    this.liveInfo = this.mode === 'rotate' ? formatAngle(-r) : this.mode === 'scale' ? `${Math.round(s * 100)}%` : null;
    this.liveS = e.s;
    for (const [id, orig] of this.orig) {
      const f = this.app.store.findItem(id);
      if (!f) continue;
      const fresh = JSON.parse(JSON.stringify(orig));
      for (const k of Object.keys(f.item)) delete f.item[k];
      Object.assign(f.item, fresh);
      transformItem(f.item, m, s, r);
    }
    this.app.store.touch();
  }

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
    h.corners.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(h.topMid[0], h.topMid[1]);
    ctx.lineTo(h.rot[0], h.rot[1]);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const c of h.corners) {
      ctx.beginPath();
      ctx.rect(c[0] - 6, c[1] - 6, 12, 12);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(h.rot[0], h.rot[1], 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (this.mode && this.liveInfo) drawBubble(ctx, this.liveInfo, this.liveS[0], this.liveS[1]);
  }
}

// ------------------------------------------------------------- vormen

function shapeStyle(app) {
  const { state, store } = app;
  return {
    color: state.color,
    width: paperToWorld(state.shapeWidth, store.doc.scale),
    fill: state.fill ? state.color : null,
    fillAlpha: 0.3,
    hatch: state.hatch,
    height: state.shapeHeight > 0 ? state.shapeHeight : undefined,
  };
}

export class ShapeTool extends Tool {
  constructor(app, kind) {
    super(app);
    this.kind = kind; // line | rect | circle | polygon | area
    this.poly = null;
  }

  get busy() {
    return this.kind === 'polygon' && !!this.poly;
  }

  down(e) {
    this.layer = this.app.editableLayer();
    if (!this.layer) return;
    if (this.kind === 'polygon') return this.polyDown(e);
    if (this.kind === 'area') {
      this.pts = [e.w];
      this.ptsS = [e.s];
      return;
    }
    this.snap = pick(this.app, e);
    this.p0 = this.snap.p;
    this.p1 = this.p0;
    this.curS = e.s;
  }

  move(e) {
    this.curS = e.s;
    if (!this.layer) return;
    if (this.kind === 'polygon') {
      if (!this.poly) return;
      const prev = this.poly.length > 1 ? this.poly[this.poly.length - 2] : null;
      this.snap = pick(this.app, e, prev);
      this.poly[this.poly.length - 1] = this.snap.p;
      return;
    }
    if (this.kind === 'area') {
      if (this.pts && dist(e.s, this.ptsS[this.ptsS.length - 1]) > 2) {
        this.pts.push(e.w);
        this.ptsS.push(e.s);
      }
      return;
    }
    if (!this.p0) return;
    this.snap = pick(this.app, e, this.kind === 'line' ? this.p0 : null);
    this.p1 = this.snap.p;
  }

  up() {
    if (!this.layer) return;
    if (this.kind === 'polygon') return;
    const item = this.buildItem();
    this.p0 = this.p1 = null;
    this.pts = null;
    this.snap = null;
    if (!item) return;
    this.commitItem(item);
  }

  commitItem(item) {
    const layerId = this.layer.id;
    this.app.store.mutate((doc) => {
      const layer = doc.layers.find((l) => l.id === layerId);
      if (layer) layer.items.push(item);
    }, 'shape');
  }

  buildItem() {
    const app = this.app;
    const st = shapeStyle(app);
    const minW = 3 / app.cam.zoom;
    if (this.kind === 'area') {
      if (!this.pts || this.pts.length < 3) return null;
      const pts = simplify(this.pts, 1.2 / app.cam.zoom).map(roundPt);
      if (pts.length < 3) return null;
      return {
        type: 'shape', id: uid(), kind: 'polygon', points: pts,
        color: st.color, width: paperToWorld(0.25, app.store.doc.scale),
        fill: st.color, fillAlpha: 0.28, hatch: st.hatch,
      };
    }
    if (!this.p0 || !this.p1 || dist(this.p0, this.p1) < minW) return null;
    const base = { type: 'shape', id: uid(), color: st.color, width: st.width };
    if (st.height) base.height = st.height;
    if (this.kind === 'line') {
      return { ...base, kind: 'line', points: [this.p0, this.p1].map(roundPt) };
    }
    if (this.kind === 'circle') {
      return { ...base, kind: 'circle', points: [this.p0, this.p1].map(roundPt), fill: st.fill, fillAlpha: st.fillAlpha, hatch: st.hatch };
    }
    if (this.kind === 'rect') {
      const cam = app.cam;
      const s0 = cam.toScreen(this.p0), s1 = cam.toScreen(this.p1);
      if (Math.abs(s1[0] - s0[0]) < 3 || Math.abs(s1[1] - s0[1]) < 3) return null;
      const corners = [s0, [s1[0], s0[1]], s1, [s0[0], s1[1]]].map((s) => cam.toWorld(s));
      corners[0] = this.p0;
      corners[2] = this.p1;
      return {
        ...base, kind: 'polygon', points: corners.map(roundPt),
        fill: st.fill, fillAlpha: st.fillAlpha, hatch: st.hatch,
      };
    }
    return null;
  }

  // --- veelhoek: tik of sleep punten; tik op het eerste punt om te sluiten
  polyDown(e) {
    const app = this.app;
    const now = e.time;
    if (!this.poly) {
      this.snap = pick(app, e);
      this.poly = [this.snap.p, this.snap.p];
      this.lastDown = { t: now, s: e.s };
      app.updatePolygonUI(true);
      return;
    }
    const first = app.cam.toScreen(this.poly[0]);
    if (this.poly.length >= 3 && dist(e.s, first) < 16) {
      this.poly.pop();
      this.finish(true);
      return;
    }
    if (this.lastDown && now - this.lastDown.t < 350 && dist(e.s, this.lastDown.s) < 14) {
      this.poly.pop();
      this.finish(false);
      return;
    }
    this.lastDown = { t: now, s: e.s };
    const prev = this.poly[this.poly.length - 2];
    this.snap = pick(app, e, prev);
    this.poly[this.poly.length - 1] = this.snap.p;
    this.poly.push(this.snap.p);
  }

  finish(closed) {
    if (!this.poly) return;
    // laatste "zwevende" punt verwijderen als het samenvalt met het vorige
    let pts = this.poly.filter((p, i, arr) => i === 0 || dist(p, arr[i - 1]) > 1e-6);
    this.poly = null;
    this.app.updatePolygonUI(false);
    if (pts.length < 2 || (closed && pts.length < 3)) { this.app.requestRender(); return; }
    const st = shapeStyle(this.app);
    const item = {
      type: 'shape', id: uid(), kind: closed ? 'polygon' : 'line', points: pts.map(roundPt),
      color: st.color, width: st.width,
    };
    if (st.height) item.height = st.height;
    if (closed) Object.assign(item, { fill: st.fill, fillAlpha: st.fillAlpha, hatch: st.hatch });
    this.commitItem(item);
  }

  closePolygon() {
    if (this.poly) {
      this.poly.pop();
      this.finish(true);
    }
  }

  finishPolygon() {
    if (this.poly) {
      this.poly.pop();
      this.finish(false);
    }
  }

  cancel() {
    this.poly = null;
    this.p0 = this.p1 = null;
    this.pts = null;
    this.snap = null;
    this.app.updatePolygonUI(false);
  }

  drawWorld(g, rc) {
    let item = null;
    const st = shapeStyle(this.app);
    if (this.kind === 'polygon' && this.poly) {
      item = { type: 'shape', kind: 'line', points: this.poly, color: st.color, width: st.width };
    } else if (this.kind === 'area' && this.pts && this.pts.length > 1) {
      item = {
        type: 'shape', kind: 'polygon', points: this.pts, color: st.color,
        width: paperToWorld(0.25, rc.scale), fill: st.color, fillAlpha: 0.28, hatch: st.hatch,
      };
    } else if (this.p0) {
      item = this.buildItem();
    }
    if (item) drawItem(g, item, rc);
  }

  /** Tijdelijke maat tijdens het tekenen (komt niet in de tekening). */
  liveText() {
    const sc = this.app.store.doc.scale;
    if (this.kind === 'line' && this.p0 && this.p1) return formatLength(dist(this.p0, this.p1), sc);
    if (this.kind === 'circle' && this.p0 && this.p1) return `Ø ${formatLength(dist(this.p0, this.p1) * 2, sc)}`;
    if (this.kind === 'rect' && this.p0 && this.p1) {
      const s0 = this.app.cam.toScreen(this.p0), s1 = this.app.cam.toScreen(this.p1);
      const z = this.app.cam.zoom;
      return `${formatLength(Math.abs(s1[0] - s0[0]) / z, sc)} × ${formatLength(Math.abs(s1[1] - s0[1]) / z, sc)}`;
    }
    if (this.kind === 'polygon' && this.poly && this.poly.length >= 2) {
      const n = this.poly.length;
      return formatLength(dist(this.poly[n - 2], this.poly[n - 1]), sc);
    }
    if (this.kind === 'area' && this.pts && this.pts.length > 2) return formatArea(polygonArea(this.pts));
    return null;
  }

  drawScreen(ctx) {
    drawSnapMarker(ctx, this.app, this.snap);
    const text = this.liveText();
    if (text && this.curS) drawBubble(ctx, text, this.curS[0], this.curS[1]);
    if (this.kind === 'polygon' && this.poly && this.poly.length >= 3) {
      const f = this.app.cam.toScreen(this.poly[0]);
      ctx.save();
      ctx.strokeStyle = '#2f5d3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f[0], f[1], 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------- maatlijn

export class DimTool extends Tool {
  // Lengte: begin- en eindpunt aantikken (of slepen); daarna de maatlijn aan het midden opzij slepen.
  // Oppervlakte: tik in een vlak of vorm om de oppervlakte erin te zetten (nogmaals tikken = weghalen).

  get mode() {
    return this.app.state.dimMode || 'length';
  }

  get busy() {
    return !!this.pending;
  }

  /** Midden van een bestaande maatlijn onder de vinger (om opzij te slepen). */
  dimHandleAt(s) {
    const cam = this.app.cam;
    for (const layer of [...this.app.store.doc.layers].reverse()) {
      if (!layer.visible || layer.locked) continue;
      for (const item of [...layer.items].reverse()) {
        if (item.type !== 'dim' || item.kind === 'area') continue;
        const len = dist(item.a, item.b) || 1;
        const n = [-(item.b[1] - item.a[1]) / len, (item.b[0] - item.a[0]) / len];
        const o = item.offset || 0;
        const A = cam.toScreen([item.a[0] + n[0] * o, item.a[1] + n[1] * o]);
        const B = cam.toScreen([item.b[0] + n[0] * o, item.b[1] + n[1] * o]);
        if (distToSegment(s, A, B) < 14 && dist(s, A) > 10 && dist(s, B) > 10) return { item, layer, n };
      }
    }
    return null;
  }

  down(e) {
    this.layer = this.app.editableLayer();
    if (!this.layer) return;
    this.downS = e.s;
    this.downT = e.time;
    if (this.mode === 'area') return;
    if (!this.pending) {
      const h = this.dimHandleAt(e.s);
      if (h) {
        this.app.store.begin();
        this.offsetDrag = { id: h.item.id, n: h.n, a: h.item.a };
        return;
      }
    }
    this.snap = pick(this.app, e, this.pending || null);
    if (this.pending) {
      this.a = this.pending;
      this.b = this.snap.p;
    } else {
      this.a = this.snap.p;
      this.b = this.a;
    }
  }

  move(e) {
    this.curS = e.s;
    if (this.offsetDrag) {
      const f = this.app.store.findItem(this.offsetDrag.id);
      if (!f) return;
      const { n, a } = this.offsetDrag;
      f.item.offset = Math.round(((e.w[0] - a[0]) * n[0] + (e.w[1] - a[1]) * n[1]) * 1000) / 1000;
      this.app.store.touch();
      return;
    }
    if (!this.a) return;
    this.snap = pick(this.app, e, this.a);
    this.b = this.snap.p;
  }

  hover(e) {
    this.curS = e.s;
    if (!this.pending) return;
    this.snap = pick(this.app, e, this.pending);
    this.a = this.pending;
    this.b = this.snap.p;
  }

  up(e) {
    if (!this.layer) return;
    if (this.offsetDrag) {
      this.offsetDrag = null;
      this.app.store.commit('dim-offset');
      return;
    }
    if (this.mode === 'area') return this.toggleArea(e);
    if (!this.a) return;
    const tap = dist(e.s, this.downS) < 8;
    if (!this.pending && tap) {
      // eerste tik: beginpunt vastzetten, wachten op het eindpunt
      this.pending = this.a;
      this.a = this.b = null;
      return;
    }
    const a = this.a, b = this.b;
    this.a = this.b = null;
    this.pending = null;
    if (dist(a, b) < 4 / this.app.cam.zoom) return;
    const layerId = this.layer.id;
    const item = { type: 'dim', id: uid(), a: roundPt(a), b: roundPt(b), offset: 0, color: '#1d2b36' };
    this.app.store.mutate((doc) => {
      doc.layers.find((l) => l.id === layerId)?.items.push(item);
    }, 'dim');
    this.app.toast('Sleep het midden van de maatlijn om hem opzij te leggen.', 2200);
  }

  toggleArea(e) {
    const app = this.app;
    const doc = app.store.doc;
    // bovenste gesloten vorm onder de vinger
    let target = null;
    for (const layer of [...doc.layers].reverse()) {
      if (!layer.visible) continue;
      for (const item of [...layer.items].reverse()) {
        if (item.type !== 'shape') continue;
        if (item.kind === 'polygon' && pointInPolygon(e.w, item.points)) { target = item; break; }
        if (item.kind === 'circle' && dist(e.w, item.points[0]) <= dist(item.points[0], item.points[1])) { target = item; break; }
      }
      if (target) break;
    }
    if (!target) {
      app.toast('Tik in een vlak, rechthoek, cirkel of veelhoek.');
      return;
    }
    const existing = doc.layers.flatMap((l) => l.items.map((i) => ({ l, i }))).find(({ i }) => i.type === 'dim' && i.kind === 'area' && i.ref === target.id);
    const layerId = this.layer.id;
    app.store.mutate((d) => {
      if (existing) existing.l.items = existing.l.items.filter((i) => i !== existing.i);
      else d.layers.find((l) => l.id === layerId)?.items.push({ type: 'dim', kind: 'area', id: uid(), ref: target.id, color: '#1d2b36' });
    }, 'area-label');
  }

  cancel() {
    if (this.offsetDrag) this.app.store.cancel();
    this.offsetDrag = null;
    this.pending = null;
    this.a = this.b = null;
  }

  drawWorld(g, rc) {
    if (!this.a || !this.b) return;
    drawItem(g, { type: 'dim', a: this.a, b: this.b, offset: 0 }, rc);
  }

  drawScreen(ctx) {
    drawSnapMarker(ctx, this.app, this.snap);
    if (this.pending) {
      const s = this.app.cam.toScreen(this.pending);
      ctx.save();
      ctx.fillStyle = '#d35400';
      ctx.beginPath(); ctx.arc(s[0], s[1], 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------- tekst

export class TextTool extends Tool {
  down(e) {
    this.start = e;
  }

  async up(e) {
    if (!this.start) return;
    this.start = null;
    const app = this.app;
    const layer = app.editableLayer();
    if (!layer) return;
    const tol = 6 / app.cam.zoom;
    const existing = [...layer.items].reverse().find((i) => i.type === 'text' && hitItem(i, e.w, tol));
    if (existing) {
      const text = await app.askText('Tekst wijzigen', existing.text, { multiline: true });
      if (text == null) return;
      app.store.mutate(() => {
        const f = app.store.findItem(existing.id);
        if (!f) return;
        if (text.trim() === '') f.layer.items = f.layer.items.filter((i) => i.id !== existing.id);
        else f.item.text = text;
      }, 'text');
      return;
    }
    const text = await app.askText('Tekst', '', { multiline: true, hint: 'Bijvoorbeeld een plantnaam of toelichting.' });
    if (!text || !text.trim()) return;
    const item = {
      type: 'text', id: uid(), x: round4(e.w[0]), y: round4(e.w[1]), text,
      size: paperToWorld(app.state.textSize, app.store.doc.scale), color: app.state.color, rot: -app.cam.rot,
    };
    const layerId = layer.id;
    app.store.mutate((doc) => {
      doc.layers.find((l) => l.id === layerId)?.items.push(item);
    }, 'text');
  }
}

// ------------------------------------------------------------- stencils

export class StencilTool extends Tool {
  down(e) {
    this.layer = this.app.editableLayer();
    if (!this.layer) return;
    const def = STENCIL_MAP[this.app.state.stencil];
    if (!def) return;
    this.snap = pick(this.app, e);
    const size = this.app.stencilSize(def.id);
    this.item = {
      type: 'stencil', id: uid(), symbol: def.id,
      x: this.snap.p[0], y: this.snap.p[1], w: size.w, h: size.h, rot: -this.app.cam.rot,
      color: this.app.state.stencilOwnColor ? this.app.state.color : def.color,
    };
    const hh = this.app.state.stencilHeights?.[def.id];
    if (hh != null) this.item.height = hh;
    this.startS = e.s;
  }

  move(e) {
    if (!this.item) return;
    if (dist(e.s, this.startS) > 18) {
      this.item.rot = snapAngle(angleOf([this.item.x, this.item.y], e.w), 15 * DEG, 4 * DEG);
    }
  }

  up() {
    if (!this.item) return;
    const item = this.item;
    this.item = null;
    item.x = round4(item.x);
    item.y = round4(item.y);
    const layerId = this.layer.id;
    this.app.store.mutate((doc) => {
      doc.layers.find((l) => l.id === layerId)?.items.push(item);
    }, 'stencil');
  }

  cancel() { this.item = null; }

  drawWorld(g, rc) {
    if (this.item) drawItem(g, this.item, rc);
  }
}

// ------------------------------------------------------------- schaal instellen

export class CalibrateTool extends Tool {
  down(e) {
    this.snap = pick(this.app, e);
    this.a = this.snap.p;
    this.b = this.a;
  }

  move(e) {
    if (!this.a) return;
    this.snap = pick(this.app, e, this.a);
    this.b = this.snap.p;
  }

  async up() {
    if (!this.a) return;
    const a = this.a, b = this.b;
    const app = this.app;
    const len = dist(a, b);
    if (len < 4 / app.cam.zoom) {
      this.a = this.b = null;
      app.toast('Trek een lijn over een bekende maat, bijvoorbeeld een gevel of erfgrens.');
      return;
    }
    const answer = await app.askText('Schaal instellen', '', {
      hint: `De getekende lijn is nu ${formatLength(len, app.store.doc.scale)}. Hoe lang is deze in werkelijkheid? (bijv. 8,5 m of 350 cm)`,
      check: { label: 'Alle lagen meeschalen (anders alleen de actieve laag)', value: false },
    });
    this.a = this.b = null;
    if (answer == null) return;
    const real = parseLength(answer.text ?? answer);
    if (!(real > 0)) {
      app.toast('Ongeldige lengte.');
      return;
    }
    const f = real / len;
    const all = !!answer.checked;
    const m = matMul(matTranslate(a[0], a[1]), matMul(matScale(f), matTranslate(-a[0], -a[1])));
    app.store.mutate((doc) => {
      const layers = all ? doc.layers : [doc.layers.find((l) => l.id === doc.activeLayer)];
      for (const layer of layers) {
        if (!layer) continue;
        for (const item of layer.items) transformItem(item, m, f, 0);
      }
    }, 'calibrate');
    app.toast(`Schaal ingesteld: de lijn is nu ${formatLength(real, app.store.doc.scale)}.`);
  }

  cancel() { this.a = this.b = null; }

  drawWorld(g, rc) {
    if (!this.a) return;
    drawItem(g, { type: 'dim', a: this.a, b: this.b, offset: 0, color: '#c0392b' }, rc);
  }

  drawScreen(ctx) {
    drawSnapMarker(ctx, this.app, this.snap);
  }
}

// ------------------------------------------------------------- verschuiven

export class PanTool extends Tool {
  down(e) { this.last = e.s; }

  move(e) {
    if (!this.last) return;
    this.app.cam.x += e.s[0] - this.last[0];
    this.app.cam.y += e.s[1] - this.last[1];
    this.last = e.s;
    this.app.cameraChanged();
  }

  up() { this.last = null; }
}
