// Tuinontwerp — hoofdmodule: invoer, weergave en interface.

import { Store, newDoc, newLayer, uid } from './model.js';
import { Camera } from './camera.js';
import { renderScene, renderGrid, renderScaleBar } from './render.js';
import { Guide, GUIDE_TYPES } from './guides.js';
import { BRUSHES, strokePath } from './brushes.js';
import { HATCHES } from './patterns.js';
import { STENCILS, STENCIL_MAP, STENCIL_CATEGORIES, drawStencil } from './stencils.js';
import { setAssetLoadHandler } from './assets.js';
import { transformItem } from './items.js';
import { saveDoc, loadDoc, listDocs, deleteDoc, loadSettings, saveSettings } from './storage.js';
import { SCALES, formatAngle, parseLength, formatLength, niceStep } from './units.js';
import { MAP_SOURCES, searchAddress, parseLatLon, buildMap } from './map.js';
import { planExport, exportPdf, exportPng, downloadBlob, safeFilename, contentBox } from './export.js';
import { hydrateIcons, icon } from './icons.js';
import {
  DrawTool, EraserTool, LassoTool, ShapeTool, DimTool, TextTool, StencilTool, CalibrateTool, PanTool, snapPoint,
} from './tools.js';
import { dist, DEG, normAngle, matTranslate, rotate } from './geom.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const COLORS = [
  '#1d2b36', '#6b7780', '#8a6a3f', '#3f7a2e', '#6fa84a', '#a9cf7a',
  '#3d7fb5', '#8fc1e3', '#c0392b', '#e08a2c', '#e6c229', '#8e5bb5', '#d77fa1', '#ffffff',
];

const DEFAULT_SETTINGS = {
  pencilOnly: false,
  penDetected: false,
  rotateGesture: true,
  autoDims: true,
  grid: true,
  snap: true,
  angleSnap: true,
  guides: [],
  lastDoc: null,
  state: null,
};

const DEFAULT_STATE = {
  tool: 'draw',
  brush: 'pen',
  color: '#1d2b36',
  widths: Object.fromEntries(Object.entries(BRUSHES).map(([k, b]) => [k, b.width])),
  opacity: 1,
  shapeWidth: 0.35,
  fill: false,
  hatch: 'none',
  textSize: 3.5,
  eraserSize: 14,
  stencil: 'loofboom',
  stencilSizes: {},
  stencilOwnColor: false,
};

class App {
  constructor() {
    this.settings = loadSettings(DEFAULT_SETTINGS);
    this.state = { ...DEFAULT_STATE, ...(this.settings.state || {}) };
    this.state.widths = { ...DEFAULT_STATE.widths, ...(this.state.widths || {}) };
    this.cam = new Camera();
    this.store = new Store(newDoc());
    this.selection = new Set();
    this.guides = new Map();
    this.canvas = $('#canvas');
    this.ctx = this.canvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.baseCtx = this.base.getContext('2d');
    this.dpr = 1;
    this.width = 1;
    this.height = 1;
    this.baseDirty = true;
    this.renderQueued = false;
    this.saveTimer = null;

    this.tools = {
      draw: new DrawTool(this),
      eraser: new EraserTool(this),
      lasso: new LassoTool(this),
      line: new ShapeTool(this, 'line'),
      rect: new ShapeTool(this, 'rect'),
      circle: new ShapeTool(this, 'circle'),
      polygon: new ShapeTool(this, 'polygon'),
      area: new ShapeTool(this, 'area'),
      dim: new DimTool(this),
      text: new TextTool(this),
      stencil: new StencilTool(this),
      calibrate: new CalibrateTool(this),
      pan: new PanTool(this),
    };

    for (const g of this.settings.guides || []) {
      // vroegere tweede driehoek (30°/60°) wordt de ene instelbare driehoek
      const type = g.type === 'tri30' ? 'tri45' : g.type;
      if (GUIDE_TYPES[type] && !this.guides.has(type)) this.guides.set(type, new Guide(type, g.x, g.y, g.rot, g));
    }

    setAssetLoadHandler(() => { this.baseDirty = true; this.requestRender(); });
    this.store.on((evt) => this.onStoreChange(evt));

    hydrateIcons();
    this.setupCanvas();
    this.setupInput();
    this.setupUI();
    this.setTool(this.state.tool, true);
    this.openInitialDoc();
    this.registerServiceWorker();
  }

  get tool() {
    return this.tools[this.state.tool];
  }

  // ================================================================ documenten

  async openInitialDoc() {
    let doc = null;
    try {
      if (this.settings.lastDoc) doc = await loadDoc(this.settings.lastDoc);
      if (!doc) {
        const list = await listDocs();
        if (list.length) doc = await loadDoc(list[0].id);
      }
    } catch (err) {
      console.warn('Opslag niet beschikbaar', err);
    }
    this.openDoc(doc || newDoc(), !doc);
  }

  openDoc(doc, isNew = false) {
    this.tool.cancel();
    this.selection.clear();
    doc.assets = doc.assets || {};
    doc.grid = doc.grid || 1;
    doc.scale = doc.scale || 100;
    this.store.load(doc);
    if (doc.view) this.cam.set(doc.view);
    else this.fitView(true);
    this.settings.lastDoc = doc.id;
    this.persistSettings();
    $('#doc-name').value = doc.name;
    this.refreshAll();
    if (isNew) this.scheduleSave();
  }

  refreshAll() {
    this.baseDirty = true;
    this.renderLayers();
    this.updateUndoButtons();
    this.updateSelectionUI();
    this.updateStatus();
    this.requestRender();
  }

  onStoreChange(evt) {
    this.baseDirty = true;
    this.requestRender();
    if (evt.type === 'load') return;
    if (evt.label === 'live') return;
    // selectie opschonen (bijv. na ongedaan maken)
    for (const id of [...this.selection]) if (!this.store.findItem(id)) this.selection.delete(id);
    this.renderLayers();
    this.updateUndoButtons();
    this.updateSelectionUI();
    this.updateStatus();
    if ($('#doc-name').value !== this.store.doc.name) $('#doc-name').value = this.store.doc.name;
    this.scheduleSave();
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    $('#save-state').textContent = 'Opslaan…';
    this.saveTimer = setTimeout(() => this.saveNow(), 900);
  }

  async saveNow() {
    clearTimeout(this.saveTimer);
    const doc = this.store.doc;
    doc.view = this.cam.toJSON();
    try {
      await saveDoc(doc, this.thumbnail());
      $('#save-state').textContent = 'Opgeslagen';
    } catch (err) {
      console.error(err);
      $('#save-state').textContent = 'Niet opgeslagen!';
      this.toast('Opslaan mislukt: ' + (err?.message || err));
    }
  }

  thumbnail() {
    const doc = this.store.doc;
    const box = contentBox(doc);
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    const cam = new Camera();
    if (box) cam.fitBox(box, 300, 200, 12);
    else { cam.zoom = 10; cam.x = 150; cam.y = 100; }
    try {
      renderScene(c.getContext('2d'), { doc, cam, width: 300, height: 200, dpr: 1, background: '#ffffff' });
      return c.toDataURL('image/jpeg', 0.7);
    } catch {
      return null;
    }
  }

  persistSettings() {
    this.settings.state = this.state;
    this.settings.guides = [...this.guides.values()].map((g) => g.toJSON());
    saveSettings(this.settings);
  }

  // ================================================================ weergave

  setupCanvas() {
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const oldW = this.width, oldH = this.height;
      this.dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.base.width = this.canvas.width;
      this.base.height = this.canvas.height;
      // middelpunt behouden
      if (oldW > 1) {
        this.cam.x += (this.width - oldW) / 2;
        this.cam.y += (this.height - oldH) / 2;
      }
      for (const g of this.guides.values()) {
        g.x = Math.min(Math.max(g.x, 40), this.width - 40);
        g.y = Math.min(Math.max(g.y, 40), this.height - 40);
      }
      this.baseDirty = true;
      this.render();
    };
    new ResizeObserver(resize).observe(this.canvas);
    resize();
  }

  requestRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  cameraChanged() {
    this.baseDirty = true;
    this.requestRender();
    this.updateStatus();
    clearTimeout(this.viewTimer);
    this.viewTimer = setTimeout(() => {
      this.store.doc.view = this.cam.toJSON();
      this.scheduleSave();
    }, 1500);
  }

  render() {
    const { ctx, dpr, width, height, cam } = this;
    const doc = this.store.doc;
    if (this.baseDirty) {
      renderScene(this.baseCtx, { doc, cam, width, height, dpr });
      if (this.settings.grid) renderGrid(this.baseCtx, cam, width, height, dpr, doc.grid);
      this.baseDirty = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.base, 0, 0);

    const rc = { doc, scale: doc.scale, zoom: cam.zoom, dpr };
    ctx.save();
    cam.apply(ctx, dpr);
    this.tool.drawWorld(ctx, rc);
    ctx.restore();

    const activeGuide = this.guideDrag?.guide || this.guideBarFor;
    for (const g of this.guides.values()) {
      g.sync(cam);
      g.draw(ctx, cam, dpr, g === activeGuide);
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tool.drawScreen(ctx);
    ctx.restore();
    renderScaleBar(ctx, cam, width, height, dpr);
  }

  fitView(defaultIfEmpty = false) {
    const box = contentBox(this.store.doc);
    if (box) this.cam.fitBox(box, this.width, this.height, 50);
    else if (defaultIfEmpty || !box) this.cam.fitBox({ minX: -10, minY: -7, maxX: 10, maxY: 7 }, this.width, this.height, 30);
    this.cameraChanged();
  }

  // ================================================================ invoer

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  makeEvent(e, s) {
    return {
      s,
      w: this.cam.toWorld(s),
      pressure: e.pressure,
      pointerType: e.pointerType,
      time: e.timeStamp,
      shift: e.shiftKey,
    };
  }

  setupInput() {
    const c = this.canvas;
    this.pointers = new Map();
    this.mode = null;
    this.spaceDown = false;

    c.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    c.addEventListener('pointermove', (e) => this.onPointerMove(e));
    c.addEventListener('pointerup', (e) => this.onPointerUp(e));
    c.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    c.addEventListener('pointerleave', (e) => {
      if (!this.pointers.has(e.pointerId) && this.tool.cur) { this.tool.cur = null; this.requestRender(); }
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // Safari op de Mac: knijpen/draaien op het trackpad
    let gStart = null;
    c.addEventListener('gesturestart', (e) => {
      e.preventDefault();
      if (this.pointers.size) return;
      gStart = { zoom: this.cam.zoom, rot: this.cam.rot, s: this.pos(e) };
    });
    c.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      if (!gStart || this.pointers.size) return;
      this.cam.zoomAt(gStart.s[0], gStart.s[1], (gStart.zoom * e.scale) / this.cam.zoom);
      if (this.settings.rotateGesture && e.rotation) {
        this.cam.rotateAt(gStart.s[0], gStart.s[1], gStart.rot + e.rotation * DEG - this.cam.rot);
      }
      this.cameraChanged();
    });
    c.addEventListener('gestureend', (e) => { e.preventDefault(); gStart = null; });
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('beforeunload', () => { this.store.doc.view = this.cam.toJSON(); this.saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
  }

  onPointerDown(e) {
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const s = this.pos(e);
    if (e.pointerType === 'pen' && !this.settings.penDetected) {
      this.settings.penDetected = true;
      this.settings.pencilOnly = true;
      this.persistSettings();
      this.syncSettingsUI();
      this.toast('Apple Pencil herkend: tekenen met de Pencil, verschuiven en zoomen met je vingers.');
    }
    this.pointers.set(e.pointerId, { s, start: s, type: e.pointerType, t: e.timeStamp });

    // De Pencil heeft altijd voorrang: een vinger die een hulpmiddel vasthoudt of een rustende
    // handpalm blijft liggen (wordt genegeerd) en de Pencil tekent gewoon.
    if (e.pointerType === 'pen' && this.mode && this.mode !== 'tool') {
      if (this.mode === 'guide' || this.mode === 'guide2') this.persistSettings();
      this.mode = null;
      this.nav = null;
      this.guideDrag = null;
      this.startToolOrGuide(e, s);
      return;
    }

    if (this.mode === 'nav') {
      // twee vingers op (of rond) een hulpmiddel: dat hulpmiddel knijpen/draaien i.p.v. de tekening
      const g = e.pointerType === 'touch' && this.pointers.size === 2 && !this.nav?.moved ? this.guideUnderPinch() : null;
      if (g) this.startGuide2(g);
      else this.startNav(true);
      return;
    }
    if (this.mode === 'tool' && e.pointerType === 'touch' && this.pointers.size === 2) {
      const tp = this.pointers.get(this.toolPointer);
      if (tp && tp.type === 'touch' && (e.timeStamp - tp.t < 500 || dist(tp.s, tp.start) < 40)) {
        this.tool.cancel();
        const g = this.guideUnderPinch();
        if (g) {
          this.toolPointer = null;
          this.startGuide2(g);
          this.requestRender();
          return;
        }
        this.mode = 'nav';
        this.toolPointer = null;
        this.startNav();
        this.requestRender();
      }
      return;
    }
    if (this.mode === 'guide' && e.pointerType === 'touch' && this.pointers.size === 2) {
      this.startGuide2(this.guideDrag.guide);
      return;
    }
    if (this.mode) return;
    this.startToolOrGuide(e, s);
  }

  /** Begin een handeling voor een nieuwe aanraking: hulpmiddel verplaatsen, navigeren of tekenen. */
  startToolOrGuide(e, s) {
    const touchNav = e.pointerType === 'touch' && this.settings.pencilOnly;
    const mouseNav = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || this.spaceDown);

    // Liniaal / driehoek / gradenboog: eerst de grepen, dan tekenen langs een rand, dan verplaatsen
    const guides = [...this.guides.values()].reverse();
    for (const g of guides) g.sync(this.cam);
    let guideHit = null;
    for (const g of guides) {
      const grip = g.gripAt(s);
      if (grip) { guideHit = { g, hit: grip }; break; }
    }
    if (!guideHit) {
      for (const g of guides) {
        if (!touchNav && !mouseNav && this.state.tool === 'draw' && g.snapAt(s)) break;
        const hit = g.hit(s);
        if (hit) { guideHit = { g, hit }; break; }
      }
    }
    if (guideHit) {
      const { g, hit } = guideHit;
      this.mode = 'guide';
      this.guideDrag = {
        guide: g, kind: hit, startS: s, x: g.x, y: g.y, rot: g.rot, size: g.size, worldR: g.worldR, moved: false, id: e.pointerId,
      };
      if (hit === 'angle') {
        this.guideDrag.corner = g.toScreen(g.poly[0]);
        this.guideDrag.w0 = g.poly[1][0] - g.poly[0][0];
      }
      this.requestRender();
      return;
    }
    if (this.guideBarFor && !this.guideSnapAt(s)) this.showGuideBar(null);

    if (touchNav || mouseNav) {
      this.mode = 'nav';
      this.startNav();
      return;
    }
    this.mode = 'tool';
    this.toolPointer = e.pointerId;
    this.tool.down(this.makeEvent(e, s));
    this.requestRender();
  }

  onPointerMove(e) {
    const p = this.pointers.get(e.pointerId);
    const s = this.pos(e);
    if (!p) {
      if (!this.mode) {
        this.tool.hover(this.makeEvent(e, s));
        if (this.state.tool === 'polygon' && this.tool.poly) this.tool.move(this.makeEvent(e, s));
        if (this.tool.cur !== undefined || this.tool.poly) this.requestRender();
      }
      return;
    }
    p.s = s;
    if (dist(p.s, p.start) > 10 && this.nav) this.nav.moved = true;
    switch (this.mode) {
      case 'tool': {
        if (e.pointerId !== this.toolPointer) return;
        const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        if (list.length > 1) for (const ce of list) this.tool.move(this.makeEvent(ce, this.pos(ce)));
        else this.tool.move(this.makeEvent(e, s));
        this.requestRender();
        break;
      }
      case 'nav':
        this.updateNav();
        break;
      case 'guide':
        this.updateGuideDrag(s);
        break;
      case 'guide2':
        this.updateGuide2();
        break;
    }
  }

  onPointerUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const s = this.pos(e);
    switch (this.mode) {
      case 'tool':
        if (e.pointerId !== this.toolPointer) break;
        if (e.type === 'pointercancel') this.tool.cancel();
        else this.tool.up(this.makeEvent(e, s));
        this.mode = null;
        this.toolPointer = null;
        break;
      case 'nav':
        if (this.pointers.size === 0) {
          const n = this.nav;
          if (n && !n.moved && n.maxPointers >= 2 && e.timeStamp - n.t0 < 350) {
            if (n.maxPointers === 2) { this.store.undo(); this.toast('Ongedaan gemaakt', 900); }
            else if (n.maxPointers >= 3) { this.store.redo(); this.toast('Opnieuw', 900); }
          }
          this.mode = null;
          this.nav = null;
        } else {
          this.startNav(true);
        }
        break;
      case 'guide': {
        const gd = this.guideDrag;
        if (gd && !gd.moved) this.showGuideBar(this.guideBarFor === gd.guide && gd.kind === 'move' ? null : gd.guide);
        else if (this.guideBarFor) this.updateGuideBarValues();
        this.mode = null;
        this.guideDrag = null;
        this.persistSettings();
        break;
      }
      case 'guide2':
        if (this.pointers.size === 0) {
          this.mode = null;
          this.guideDrag = null;
          this.persistSettings();
          if (this.guideBarFor) this.updateGuideBarValues();
        }
        break;
    }
    this.requestRender();
  }

  startNav(keep = false) {
    const pts = [...this.pointers.entries()].slice(0, 2);
    const prev = keep ? this.nav : null;
    this.nav = {
      ids: pts.map(([id]) => id),
      t0: prev ? prev.t0 : performance.now(),
      maxPointers: Math.max(this.pointers.size, prev ? prev.maxPointers : 0),
      moved: prev ? prev.moved : false,
    };
    if (pts.length === 1) {
      this.nav.last = pts[0][1].s;
    } else {
      this.nav.A = this.cam.toWorld(pts[0][1].s);
      this.nav.B = this.cam.toWorld(pts[1][1].s);
    }
  }

  updateNav() {
    const n = this.nav;
    if (!n) return;
    n.maxPointers = Math.max(n.maxPointers, this.pointers.size);
    if (n.ids.length === 1) {
      const p = this.pointers.get(n.ids[0]);
      if (!p) return;
      this.cam.x += p.s[0] - n.last[0];
      this.cam.y += p.s[1] - n.last[1];
      n.last = p.s;
    } else {
      const a = this.pointers.get(n.ids[0]), b = this.pointers.get(n.ids[1]);
      if (!a || !b) return;
      this.cam.fitTwoPoints(n.A, n.B, a.s, b.s, this.settings.rotateGesture);
      if (this.settings.rotateGesture && Math.abs(normAngle(this.cam.rot)) < 3 * DEG && this.cam.rot !== 0) {
        this.cam.rot = 0;
        this.cam.fitTwoPoints(n.A, n.B, a.s, b.s, false);
      }
    }
    this.cameraChanged();
  }

  updateGuideDrag(s) {
    const d = this.guideDrag;
    if (!d) return;
    if (dist(s, d.startS) > 4) d.moved = true;
    if (!d.moved) return;
    const g = d.guide;
    if (d.kind === 'move') {
      g.x = d.x + s[0] - d.startS[0];
      g.y = d.y + s[1] - d.startS[1];
      if (g.type === 'protractor') {
        // middelpunt snapt aan eindpunten, handig om bogen rond een punt te tekenen
        const snap = snapPoint(this, this.cam.toWorld([g.x, g.y]));
        if (snap.kind === 'point') [g.x, g.y] = this.cam.toScreen(snap.p);
      }
    } else if (d.kind === 'angle') {
      // hoogte boven de basis bepaalt de hoek; de rechte hoek blijft op zijn plek
      const v = rotate([s[0] - d.corner[0], s[1] - d.corner[1]], -g.rot);
      let deg = Math.atan2(Math.max(1, -v[1]), d.w0) / DEG;
      const near = Math.round(deg / 15) * 15;
      deg = Math.abs(deg - near) < 1.5 ? near : Math.round(deg);
      deg = Math.min(85, Math.max(5, deg));
      const t = Math.tan(deg * DEG);
      g.angle = deg;
      g.size = t <= 1 ? d.w0 : d.w0 * t;
      g.build();
      const c = g.toScreen(g.poly[0]);
      g.x += d.corner[0] - c[0];
      g.y += d.corner[1] - c[1];
      if (this.guideBarFor === g) this.updateGuideBarValues();
    } else if (d.kind === 'resize') {
      const c = [g.x, g.y];
      if (g.type === 'protractor') {
        const r0 = dist(d.startS, c), r1 = dist(s, c);
        const step = Math.max(0.05, niceStep(20 / this.cam.zoom) / 2);
        g.worldR = Math.max(step, Math.round((d.worldR * r1 / Math.max(r0, 1)) / step) * step);
      } else {
        g.size = Math.min(1600, Math.max(120, d.size * dist(s, c) / Math.max(dist(d.startS, c), 1)));
      }
      g.zoom = null;
      g.build();
      if (this.guideBarFor === g) this.updateGuideBarValues();
    } else {
      const c = [g.x, g.y];
      const a0 = Math.atan2(d.startS[1] - c[1], d.startS[0] - c[0]);
      const a1 = Math.atan2(s[1] - c[1], s[0] - c[0]);
      g.rot = this.snapGuideRot(d.rot + a1 - a0);
      if (this.guideBarFor === g) this.updateGuideBarValues();
    }
    this.requestRender();
  }

  snapGuideRot(rot) {
    const world = -(rot - this.cam.rot);
    const step = 15 * DEG;
    const snapped = Math.round(world / step) * step;
    if (Math.abs(normAngle(world - snapped)) < 2.5 * DEG) return this.cam.rot - snapped;
    // anders afronden op hele graden
    return this.cam.rot - Math.round(world / DEG) * DEG;
  }

  /** Hulpmiddel onder een van de twee vingers of onder het midden ertussen. */
  guideUnderPinch() {
    const pts = [...this.pointers.values()].slice(0, 2).map((p) => p.s);
    if (pts.length < 2) return null;
    const mid = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    const guides = [...this.guides.values()].reverse();
    for (const g of guides) {
      g.sync(this.cam);
      if ([mid, ...pts].some((p) => g.hit(p))) return g;
    }
    return null;
  }

  startGuide2(g) {
    const pts = [...this.pointers.values()].slice(0, 2);
    this.mode = 'guide2';
    this.nav = null;
    this.guideDrag = {
      guide: g, s1: pts[0].s, s2: pts[1].s, x: g.x, y: g.y, rot: g.rot, size: g.size, worldR: g.worldR,
      ids: [...this.pointers.keys()].slice(0, 2),
    };
    this.requestRender();
  }

  updateGuide2() {
    const d = this.guideDrag;
    const a = this.pointers.get(d.ids[0]), b = this.pointers.get(d.ids[1]);
    if (!a || !b) return;
    const g = d.guide;
    // draaien
    const ang0 = Math.atan2(d.s2[1] - d.s1[1], d.s2[0] - d.s1[0]);
    const ang1 = Math.atan2(b.s[1] - a.s[1], b.s[0] - a.s[0]);
    g.rot = this.snapGuideRot(d.rot + ang1 - ang0);
    const dr = g.rot - d.rot;
    // knijpen = groter/kleiner (niet voor de liniaal)
    let f = dist(a.s, b.s) / Math.max(1, dist(d.s1, d.s2));
    if (g.type === 'protractor') {
      const step = Math.max(0.05, niceStep(20 / this.cam.zoom) / 2);
      g.worldR = Math.max(step, Math.round((d.worldR * f) / step) * step);
      f = g.worldR / d.worldR;
      g.zoom = null;
      g.sync(this.cam);
    } else if (g.type !== 'ruler') {
      g.size = Math.min(1600, Math.max(120, d.size * f));
      f = g.size / d.size;
      g.build();
    } else {
      f = 1;
    }
    // positie volgt het midden tussen de vingers
    const mid0 = [(d.s1[0] + d.s2[0]) / 2, (d.s1[1] + d.s2[1]) / 2];
    const mid1 = [(a.s[0] + b.s[0]) / 2, (a.s[1] + b.s[1]) / 2];
    const off = rotate([(d.x - mid0[0]) * f, (d.y - mid0[1]) * f], dr);
    g.x = mid1[0] + off[0];
    g.y = mid1[1] + off[1];
    if (this.guideBarFor === g) this.updateGuideBarValues();
    this.requestRender();
  }

  /** Instellingenbalk voor een hulpmiddel (hoek, maat, diameter). null = verbergen. */
  showGuideBar(g) {
    const bar = $('#guide-bar');
    this.guideBarFor = g && this.guides.get(g.type) === g ? g : null;
    if (!this.guideBarFor) {
      bar.hidden = true;
      this.requestRender();
      return;
    }
    const field = (key, label, unit) => `<label>${label}<button type="button" class="step" data-step="${key}:-1">−</button><input data-k="${key}" inputmode="decimal"><button type="button" class="step" data-step="${key}:1">+</button>${unit}</label>`;
    let html = `<span>${GUIDE_TYPES[g.type]}</span>`;
    if (g.type === 'tri45') {
      html += field('angle', 'Hoek', '°');
      html += [30, 45, 60].map((a) => `<button type="button" data-preset="${a}">${a}°</button>`).join('') + '<span class="sepv"></span>';
    }
    if (g.type === 'protractor') html += field('diam', 'Diameter', 'm') + '<span class="sepv"></span>';
    html += field('rot', 'Draaiing', '°');
    html += `<button type="button" data-act="remove" title="Weghalen">${icon('trash', 20)}</button>`;
    html += `<button type="button" data-act="close" title="Sluiten">${icon('check', 20)}</button>`;
    bar.innerHTML = html;
    bar.hidden = false;
    for (const input of $$('input', bar)) {
      input.addEventListener('change', () => this.applyGuideValue(input.dataset.k, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    }
    for (const b of $$('[data-step]', bar)) {
      b.addEventListener('click', () => {
        const [k, dir] = b.dataset.step.split(':');
        const cur = this.guideValue(k);
        const step = k === 'diam' ? Math.max(0.1, niceStep(cur / 20)) : k === 'angle' ? 1 : 1;
        this.applyGuideValue(k, String(Math.round((cur + step * Number(dir)) * 1000) / 1000));
      });
    }
    for (const b of $$('[data-preset]', bar)) b.addEventListener('click', () => this.applyGuideValue('angle', b.dataset.preset));
    $('[data-act="remove"]', bar).addEventListener('click', () => this.toggleGuide(g.type));
    $('[data-act="close"]', bar).addEventListener('click', () => this.showGuideBar(null));
    this.updateGuideBarValues();
    this.requestRender();
  }

  guideValue(k) {
    const g = this.guideBarFor;
    if (k === 'angle') return g.angle;
    if (k === 'diam') return (g.worldR || 0) * 2;
    let deg = (-(g.rot - this.cam.rot) / DEG) % 360;
    if (deg < 0) deg += 360;
    return Math.round(deg * 10) / 10;
  }

  updateGuideBarValues() {
    const bar = $('#guide-bar');
    if (!this.guideBarFor) return;
    const fmt = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
    for (const input of $$('input', bar)) {
      if (document.activeElement !== input) input.value = fmt(this.guideValue(input.dataset.k));
    }
  }

  applyGuideValue(k, raw) {
    const g = this.guideBarFor;
    if (!g) return;
    if (k === 'diam') {
      const v = parseLength(raw);
      if (v > 0) {
        g.worldR = v / 2;
        g.zoom = null;
      }
    } else {
      const v = parseFloat(String(raw).replace(',', '.'));
      if (Number.isFinite(v)) {
        if (k === 'angle') {
          const corner = g.toScreen(g.poly[0]);
          const w0 = g.poly[1][0] - g.poly[0][0];
          g.angle = Math.min(85, Math.max(5, v));
          const t = Math.tan(g.angle * DEG);
          g.size = t <= 1 ? w0 : w0 * t;
          g.build();
          const c = g.toScreen(g.poly[0]);
          g.x += corner[0] - c[0];
          g.y += corner[1] - c[1];
        } else {
          g.rot = this.cam.rot - v * DEG;
        }
      }
    }
    this.persistSettings();
    this.updateGuideBarValues();
    this.requestRender();
  }

  onWheel(e) {
    e.preventDefault();
    const s = this.pos(e);
    if (e.ctrlKey || e.metaKey) {
      this.cam.zoomAt(s[0], s[1], Math.exp(-e.deltaY * 0.01));
    } else if (e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY))) {
      // muiswiel
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      this.cam.zoomAt(s[0], s[1], Math.exp(-dy * 0.0015));
    } else {
      this.cam.x -= e.deltaX;
      this.cam.y -= e.deltaY;
    }
    this.cameraChanged();
  }

  onKey(e, down) {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ($('dialog[open]')) return;
    if (e.code === 'Space') {
      this.spaceDown = down;
      this.canvas.style.cursor = down ? 'grab' : '';
      e.preventDefault();
      return;
    }
    if (!down) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? this.store.redo() : this.store.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); this.store.redo(); return; }
    if (mod && k === 'c') { this.copySelection(); return; }
    if (mod && k === 'v') { this.pasteClipboard(); return; }
    if (mod && k === 'd') { e.preventDefault(); this.selectionAction('duplicate'); return; }
    if (mod && k === 's') { e.preventDefault(); this.saveNow(); return; }
    if (mod) return;
    if (k === 'delete' || k === 'backspace') { this.selectionAction('delete'); return; }
    if (k === 'escape') {
      this.tool.cancel();
      this.setSelection(new Set());
      this.requestRender();
      return;
    }
    if (k === 'enter' && this.state.tool === 'polygon') { this.tool.finishPolygon(); return; }
    const map = { p: 'draw', b: 'draw', e: 'eraser', l: 'lasso', m: 'dim', t: 'text', s: 'stencil', h: 'pan', v: 'area' };
    if (map[k]) { this.setTool(map[k]); return; }
    if (k === 'r') { this.toggleGuide('ruler'); return; }
    if (k === 'g') { this.settings.grid = !this.settings.grid; this.persistSettings(); this.syncSettingsUI(); this.baseDirty = true; this.requestRender(); return; }
    if (k === '0') { this.fitView(); return; }
  }

  // ================================================================ hulpfuncties voor tools

  editableLayer() {
    const layer = this.store.activeLayer;
    if (!layer) return null;
    if (layer.locked) {
      this.toast(`Laag "${layer.name}" is vergrendeld. Ontgrendel hem of kies een andere laag.`);
      return null;
    }
    if (!layer.visible) {
      this.toast(`Laag "${layer.name}" is verborgen.`);
      return null;
    }
    return layer;
  }

  guideSnapAt(s) {
    const guides = [...this.guides.values()].reverse();
    for (const g of guides) {
      const snap = g.snapAt(s);
      if (snap) return snap;
    }
    return null;
  }

  stencilSize(id) {
    const def = STENCIL_MAP[id];
    const saved = this.state.stencilSizes[id];
    return saved ? { w: saved.w, h: saved.h } : { w: def.w, h: def.h };
  }

  setActiveLayer(id) {
    this.store.doc.activeLayer = id;
    this.renderLayers();
  }

  setSelection(ids) {
    this.selection.clear();
    for (const id of ids) this.selection.add(id);
    this.updateSelectionUI();
    this.requestRender();
  }

  // ================================================================ interface

  setupUI() {
    // gereedschap
    for (const b of $$('#toolbar .tool')) b.addEventListener('click', () => this.setTool(b.dataset.tool));
    for (const b of $$('#toolbar .guide-btn')) b.addEventListener('click', () => this.toggleGuide(b.dataset.guide));
    this.syncGuideButtons();

    $('#btn-undo').addEventListener('click', () => this.store.undo());
    $('#btn-redo').addEventListener('click', () => this.store.redo());
    $('#btn-layers').addEventListener('click', () => { $('#layers-panel').hidden = !$('#layers-panel').hidden; });
    $('#btn-layers-close').addEventListener('click', () => { $('#layers-panel').hidden = true; });
    $('#btn-layer-add').addEventListener('click', () => this.addLayer());
    $('#btn-fit').addEventListener('click', () => this.fitView());
    $('#btn-reset-rot').addEventListener('click', () => {
      this.cam.rotateAt(this.width / 2, this.height / 2, -this.cam.rot);
      this.cameraChanged();
    });

    const nameInput = $('#doc-name');
    nameInput.addEventListener('change', () => {
      const v = nameInput.value.trim() || 'Naamloos';
      this.store.mutate((doc) => { doc.name = v; }, 'rename');
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

    // tekenschaal
    const scaleSel = $('#doc-scale');
    scaleSel.innerHTML = SCALES.map((s) => `<option value="${s}">1:${s}</option>`).join('');
    scaleSel.addEventListener('change', () => {
      const v = Number(scaleSel.value);
      this.store.mutate((doc) => { doc.scale = v; }, 'scale');
      this.toast(`Tekenschaal 1:${v}. Pendiktes, teksten en maatlabels worden hierop afgestemd.`);
    });

    // selectiebalk
    for (const b of $$('#selection-bar [data-sel]')) {
      if (b.tagName === 'SELECT') b.addEventListener('change', () => this.selectionAction('layer', b.value));
      else b.addEventListener('click', () => this.selectionAction(b.dataset.sel));
    }
    for (const b of $$('#polygon-bar [data-poly]')) {
      b.addEventListener('click', () => {
        const t = this.tools.polygon;
        if (b.dataset.poly === 'close') t.closePolygon();
        else if (b.dataset.poly === 'finish') t.finishPolygon();
        else t.cancel();
        this.requestRender();
      });
    }

    this.setupDocsDialog();
    this.setupMapDialog();
    this.setupExportDialog();
    this.setupSettingsDialog();
    this.setupStencilDialog();
    this.setupImport();

    // Dialogen sluiten bij klik op de achtergrond
    for (const d of $$('dialog')) {
      d.addEventListener('click', (e) => { if (e.target === d && d.id !== 'dlg-input') d.close(); });
    }
  }

  setTool(name, force = false) {
    if (!this.tools[name]) name = 'draw';
    if (!force && name === this.state.tool) {
      if (name === 'stencil') $('#dlg-stencils').showModal();
      return;
    }
    this.tool?.cancel();
    this.state.tool = name;
    if (name !== 'lasso') this.setSelection(new Set());
    for (const b of $$('#toolbar .tool')) b.classList.toggle('active', b.dataset.tool === name);
    this.canvas.style.cursor = name === 'pan' ? 'grab' : name === 'text' ? 'text' : 'crosshair';
    this.renderOptions();
    this.persistSettings();
    this.requestRender();
  }

  toggleGuide(type) {
    if (this.guides.has(type)) {
      if (this.guideBarFor === this.guides.get(type)) this.showGuideBar(null);
      this.guides.delete(type);
    } else {
      const offset = this.guides.size * 40;
      const g = new Guide(type, this.width / 2 + offset, this.height / 2 + offset, this.cam.rot);
      this.guides.set(type, g);
      if (!this.settings.guideHintShown) {
        this.settings.guideHintShown = true;
        this.toast('Sleep om te verplaatsen. Twee vingers: draaien en knijpen voor de grootte. Bij de driehoek de bovenste punt slepen voor de hoek. Teken langs een rand voor een rechte lijn.', 6000);
      }
    }
    this.syncGuideButtons();
    this.persistSettings();
    this.requestRender();
  }

  syncGuideButtons() {
    for (const b of $$('#toolbar .guide-btn')) b.classList.toggle('active', this.guides.has(b.dataset.guide));
  }

  updateUndoButtons() {
    $('#btn-undo').disabled = !this.store.canUndo();
    $('#btn-redo').disabled = !this.store.canRedo();
  }

  updateStatus() {
    $('#doc-scale').value = String(this.store.doc.scale);
    const rotated = Math.abs(normAngle(this.cam.rot)) > 0.001;
    $('#btn-reset-rot').hidden = !rotated;
    $('#zoom-info').textContent = rotated ? `Beeld gedraaid ${formatAngle(-this.cam.rot)}` : '';
  }

  toast(msg, ms = 3000) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------------------------------------------------------------- optiebalk

  renderOptions() {
    const bar = $('#optionsbar');
    bar.innerHTML = '';
    const t = this.state.tool;
    const add = (el) => { bar.appendChild(el); return el; };

    if (t === 'draw') {
      add(this.brushPicker());
      add(this.slider('Dikte', 0.1, 20, 0.05, this.state.widths[this.state.brush], (v) => { this.state.widths[this.state.brush] = v; }, (v) => `${v.toLocaleString('nl-NL')} mm`, true));
      add(this.slider('Dekking', 0.1, 1, 0.05, this.state.opacity, (v) => { this.state.opacity = v; }, (v) => `${Math.round(v * 100)}%`));
      add(this.swatches());
    } else if (t === 'eraser') {
      add(this.slider('Grootte', 4, 60, 1, this.state.eraserSize, (v) => { this.state.eraserSize = v; }, (v) => `${v} px`));
      add(this.hint('Gumt op de actieve laag. Afbeeldingen en kaarten worden niet gegumd (gebruik de lasso).'));
    } else if (t === 'lasso') {
      add(this.hint('Omcirkel lijnen om ze te selecteren, of tik op een element. Sleep om te verplaatsen, hoeken om te schalen, de ronde greep om te draaien.'));
    } else if (['line', 'rect', 'circle', 'polygon'].includes(t)) {
      add(this.slider('Lijndikte', 0.1, 5, 0.05, this.state.shapeWidth, (v) => { this.state.shapeWidth = v; }, (v) => `${v.toLocaleString('nl-NL')} mm`, true));
      if (t !== 'line') {
        add(this.toggle('Vulling', this.state.fill, (v) => { this.state.fill = v; }));
        add(this.hatchSelect());
      }
      add(this.toggle('Maten', this.settings.autoDims, (v) => { this.settings.autoDims = v; this.syncSettingsUI(); }));
      add(this.swatches());
    } else if (t === 'area') {
      add(this.hatchSelect());
      add(this.toggle('Oppervlakte', this.settings.autoDims, (v) => { this.settings.autoDims = v; this.syncSettingsUI(); }));
      add(this.swatches());
      add(this.hint('Teken de omtrek van een vak (gazon, border, terras).'));
    } else if (t === 'dim') {
      add(this.hint('Sleep van punt naar punt. Snapt aan eindpunten en het raster; de maat volgt uit de tekenschaal.'));
    } else if (t === 'text') {
      add(this.slider('Tekstgrootte', 1.5, 12, 0.5, this.state.textSize, (v) => { this.state.textSize = v; }, (v) => `${v.toLocaleString('nl-NL')} mm`));
      add(this.swatches());
    } else if (t === 'stencil') {
      add(this.stencilOptions());
    } else if (t === 'calibrate') {
      add(this.hint('Trek een lijn over een bekende maat in de ondergrond (bijv. een gevel) en vul de werkelijke lengte in.'));
    } else if (t === 'pan') {
      add(this.hint('Sleep om te verschuiven. Knijp of gebruik het scrollwiel om te zoomen.'));
    }
    hydrateIcons(bar);
  }

  hint(text) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = text;
    return p;
  }

  slider(label, min, max, step, value, onChange, fmt, log = false) {
    const wrap = document.createElement('div');
    wrap.className = 'opt';
    const toPos = (v) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
    const fromPos = (p) => {
      const v = log ? min * Math.pow(max / min, p) : min + p * (max - min);
      return Math.round(v / step) * step;
    };
    wrap.innerHTML = `<span class="opt-label">${label}</span><input type="range" min="0" max="1000" step="1"><span class="val"></span>`;
    const input = $('input', wrap), val = $('.val', wrap);
    input.value = String(Math.round(toPos(value) * 1000));
    val.textContent = fmt(value);
    input.addEventListener('input', () => {
      const v = Math.min(max, Math.max(min, fromPos(Number(input.value) / 1000)));
      const nice = Math.round(v * 1000) / 1000;
      val.textContent = fmt(nice);
      onChange(nice);
      if (this.state.tool === 'draw') this.refreshBrushPreviews();
    });
    input.addEventListener('change', () => this.persistSettings());
    return wrap;
  }

  toggle(label, value, onChange) {
    const b = document.createElement('button');
    b.className = 'toggle' + (value ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      const v = !b.classList.contains('on');
      b.classList.toggle('on', v);
      onChange(v);
      this.persistSettings();
    });
    return b;
  }

  hatchSelect() {
    const wrap = document.createElement('div');
    wrap.className = 'opt';
    wrap.innerHTML = `<span class="opt-label">Arcering</span><select>${Object.entries(HATCHES).map(([k, h]) => `<option value="${k}">${h.name}</option>`).join('')}</select>`;
    const sel = $('select', wrap);
    sel.value = this.state.hatch;
    sel.addEventListener('change', () => { this.state.hatch = sel.value; this.persistSettings(); });
    return wrap;
  }

  swatches() {
    const wrap = document.createElement('div');
    wrap.className = 'swatches';
    const render = () => {
      wrap.innerHTML = '';
      const all = COLORS.includes(this.state.color) ? COLORS : [...COLORS, this.state.color];
      for (const c of all) {
        const b = document.createElement('button');
        b.className = 'swatch' + (c === this.state.color ? ' active' : '');
        b.style.background = c;
        b.title = c;
        b.addEventListener('click', () => { this.state.color = c; this.persistSettings(); render(); this.refreshBrushPreviews(); });
        wrap.appendChild(b);
      }
      const custom = document.createElement('label');
      custom.className = 'swatch swatch-custom';
      custom.title = 'Eigen kleur';
      custom.innerHTML = '<input type="color">';
      const input = $('input', custom);
      input.value = this.state.color;
      input.addEventListener('change', () => { this.state.color = input.value; this.persistSettings(); render(); this.refreshBrushPreviews(); });
      wrap.appendChild(custom);
    };
    render();
    return wrap;
  }

  brushPicker() {
    const wrap = document.createElement('div');
    wrap.className = 'brushes';
    for (const [key, b] of Object.entries(BRUSHES)) {
      const btn = document.createElement('button');
      btn.className = 'brush-btn' + (key === this.state.brush ? ' active' : '');
      btn.dataset.brush = key;
      btn.title = b.name;
      const c = document.createElement('canvas');
      c.width = 104;
      c.height = 36;
      c.style.width = '52px';
      c.style.height = '18px';
      btn.appendChild(c);
      const label = document.createElement('span');
      label.textContent = b.name;
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        this.state.brush = key;
        this.persistSettings();
        this.renderOptions();
      });
      wrap.appendChild(btn);
    }
    requestAnimationFrame(() => this.refreshBrushPreviews());
    return wrap;
  }

  refreshBrushPreviews() {
    for (const btn of $$('.brush-btn')) {
      const key = btn.dataset.brush;
      const b = BRUSHES[key];
      const c = $('canvas', btn);
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push([8 + t * 88, 18 + Math.sin(t * Math.PI * 2) * 9, Math.sin(t * Math.PI) * 0.9 + 0.1]);
      }
      const w = Math.min(14, Math.max(1.5, b.width * 2.2));
      g.globalAlpha = b.alpha;
      g.fillStyle = this.state.color === '#ffffff' ? '#999' : this.state.color;
      g.fill(strokePath(pts, b, w));
    }
  }

  stencilOptions() {
    const wrap = document.createElement('div');
    wrap.className = 'opt';
    const def = STENCIL_MAP[this.state.stencil];
    const size = this.stencilSize(def.id);
    const btn = document.createElement('button');
    btn.className = 'stencil-current';
    btn.appendChild(this.stencilPreview(def, 34));
    const sp = document.createElement('span');
    sp.textContent = `${def.name} ▾`;
    btn.appendChild(sp);
    btn.addEventListener('click', () => $('#dlg-stencils').showModal());
    wrap.appendChild(btn);

    const sizes = document.createElement('div');
    sizes.className = 'opt';
    const fmt = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
    if (def.round && def.w === def.h) {
      sizes.innerHTML = `<span class="opt-label">Diameter (m)</span><input class="num" inputmode="decimal" value="${fmt(size.w)}">`;
      const inp = $('input', sizes);
      inp.addEventListener('change', () => {
        const v = parseLength(inp.value);
        if (v > 0) { this.state.stencilSizes[def.id] = { w: v, h: v }; this.persistSettings(); }
        inp.value = fmt(this.stencilSize(def.id).w);
      });
    } else {
      sizes.innerHTML = `<span class="opt-label">Breedte × diepte (m)</span><input class="num" data-k="w" inputmode="decimal" value="${fmt(size.w)}"><span>×</span><input class="num" data-k="h" inputmode="decimal" value="${fmt(size.h)}">`;
      for (const inp of $$('input', sizes)) {
        inp.addEventListener('change', () => {
          const v = parseLength(inp.value);
          const cur = this.stencilSize(def.id);
          if (v > 0) { cur[inp.dataset.k] = v; this.state.stencilSizes[def.id] = cur; this.persistSettings(); }
          inp.value = fmt(this.stencilSize(def.id)[inp.dataset.k]);
        });
      }
    }
    const outer = document.createElement('div');
    outer.className = 'opt';
    outer.style.gap = '14px';
    outer.appendChild(wrap);
    outer.appendChild(sizes);
    outer.appendChild(this.toggle('Eigen kleur', this.state.stencilOwnColor, (v) => { this.state.stencilOwnColor = v; }));
    if (this.state.stencilOwnColor) outer.appendChild(this.swatches());
    outer.appendChild(this.hint('Tik om te plaatsen, sleep om te draaien.'));
    return outer;
  }

  stencilPreview(def, px = 56) {
    const c = document.createElement('canvas');
    const dpr = 2;
    c.width = c.height = px * dpr;
    c.style.width = c.style.height = px + 'px';
    const g = c.getContext('2d');
    const s = (px * dpr * 0.84) / Math.max(def.w, def.h);
    g.translate((px * dpr) / 2, (px * dpr) / 2);
    g.scale(s, s);
    drawStencil(g, { symbol: def.id, x: 0, y: 0, w: def.w, h: def.h, rot: 0, color: def.color }, 1.6 / s);
    return c;
  }

  setupStencilDialog() {
    const grid = $('#stencil-grid');
    grid.innerHTML = '';
    for (const cat of STENCIL_CATEGORIES) {
      const h = document.createElement('h3');
      h.textContent = cat;
      grid.appendChild(h);
      const box = document.createElement('div');
      box.className = 'stencil-cat';
      for (const def of STENCILS.filter((s) => s.cat === cat)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stencil-item';
        b.dataset.id = def.id;
        b.appendChild(this.stencilPreview(def));
        const name = document.createElement('span');
        name.textContent = def.name;
        b.appendChild(name);
        const size = document.createElement('small');
        size.textContent = def.round && def.w === def.h ? `Ø ${String(def.w).replace('.', ',')} m` : `${String(def.w).replace('.', ',')} × ${String(def.h).replace('.', ',')} m`;
        b.appendChild(size);
        b.addEventListener('click', () => {
          this.state.stencil = def.id;
          this.persistSettings();
          $('#dlg-stencils').close();
          if (this.state.tool !== 'stencil') this.setTool('stencil');
          else this.renderOptions();
        });
        box.appendChild(b);
      }
      grid.appendChild(box);
    }
  }

  // ---------------------------------------------------------------- lagen

  renderLayers() {
    const list = $('#layer-list');
    const doc = this.store.doc;
    list.innerHTML = '';
    const layers = [...doc.layers].reverse();
    for (const layer of layers) {
      const li = document.createElement('li');
      li.className = 'layer' + (layer.id === doc.activeLayer ? ' active' : '');
      li.innerHTML = `
        <div class="row1">
          <button data-a="vis" title="Zichtbaar">${icon(layer.visible ? 'eye' : 'eyeOff', 18)}</button>
          <span class="name" title="Dubbeltik om te hernoemen"></span>
          <button data-a="lock" title="Vergrendelen">${icon(layer.locked ? 'lock' : 'unlock', 18)}</button>
          <button data-a="up" title="Omhoog">${icon('up', 18)}</button>
          <button data-a="down" title="Omlaag">${icon('down', 18)}</button>
          <button data-a="del" title="Verwijderen">${icon('trash', 18)}</button>
        </div>
        <div class="row2">
          <span>Dekking</span><input type="range" data-a="opacity" min="0" max="100" value="${Math.round(layer.opacity * 100)}">
          <span>Papier</span><input type="range" data-a="paper" min="0" max="90" value="${Math.round(layer.paper * 100)}">
        </div>`;
      $('.name', li).textContent = `${layer.name} (${layer.items.length})`;
      $('.name', li).addEventListener('click', () => this.setActiveLayer(layer.id));
      $('.name', li).addEventListener('dblclick', () => this.renameLayer(layer.id));
      for (const b of $$('button', li)) {
        b.addEventListener('click', () => this.layerAction(layer.id, b.dataset.a));
      }
      for (const r of $$('input[type=range]', li)) {
        r.addEventListener('input', () => {
          this.store.begin();
          const l = this.store.layerById(layer.id);
          l[r.dataset.a] = Number(r.value) / 100;
          this.store.touch();
        });
        r.addEventListener('change', () => this.store.commit('layer'));
      }
      list.appendChild(li);
    }
    // laag-keuze in selectiebalk
    const sel = $('#selection-bar select');
    sel.innerHTML = '<option value="">Naar laag…</option>' + layers.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
  }

  addLayer() {
    const doc = this.store.doc;
    const layer = newLayer(`Laag ${doc.layers.length + 1}`);
    layer.paper = doc.layers.length ? 0.35 : 0;
    this.store.mutate((d) => {
      const idx = d.layers.findIndex((l) => l.id === d.activeLayer);
      d.layers.splice(idx + 1, 0, layer);
      d.activeLayer = layer.id;
    }, 'layer');
    this.toast('Nieuwe laag met trekpapier. Pas "Papier" aan voor meer of minder doorzicht.');
  }

  async renameLayer(id) {
    const layer = this.store.layerById(id);
    const name = await this.askText('Laag hernoemen', layer.name);
    if (name && name.trim()) this.store.mutate(() => { this.store.layerById(id).name = name.trim(); }, 'layer');
  }

  layerAction(id, action) {
    const doc = this.store.doc;
    const idx = doc.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    switch (action) {
      case 'vis':
        this.store.mutate(() => { doc.layers[idx].visible = !doc.layers[idx].visible; }, 'layer');
        break;
      case 'lock':
        this.store.mutate(() => { doc.layers[idx].locked = !doc.layers[idx].locked; }, 'layer');
        break;
      case 'up':
        if (idx < doc.layers.length - 1) this.store.mutate(() => { const [l] = doc.layers.splice(idx, 1); doc.layers.splice(idx + 1, 0, l); }, 'layer');
        break;
      case 'down':
        if (idx > 0) this.store.mutate(() => { const [l] = doc.layers.splice(idx, 1); doc.layers.splice(idx - 1, 0, l); }, 'layer');
        break;
      case 'del':
        if (doc.layers.length === 1) { this.toast('De laatste laag kan niet worden verwijderd.'); return; }
        if (doc.layers[idx].items.length && !confirm(`Laag "${doc.layers[idx].name}" met ${doc.layers[idx].items.length} elementen verwijderen?`)) return;
        this.store.mutate(() => {
          doc.layers.splice(idx, 1);
          if (doc.activeLayer === id) doc.activeLayer = doc.layers[Math.max(0, idx - 1)].id;
        }, 'layer');
        break;
    }
  }

  // ---------------------------------------------------------------- selectie

  updateSelectionUI() {
    const bar = $('#selection-bar');
    const n = this.selection.size;
    bar.hidden = n === 0 || this.state.tool !== 'lasso';
    if (n) $('.count', bar).textContent = n === 1 ? '1 element' : `${n} elementen`;
    $('select', bar).value = '';
  }

  updatePolygonUI(show) {
    $('#polygon-bar').hidden = !show;
  }

  selectionAction(action, arg) {
    if (!this.selection.size) return;
    const ids = [...this.selection];
    const found = ids.map((id) => this.store.findItem(id)).filter(Boolean);
    if (!found.length) return;
    const layer = found[0].layer;
    switch (action) {
      case 'delete':
        this.store.mutate(() => {
          for (const l of this.store.doc.layers) l.items = l.items.filter((i) => !this.selection.has(i.id));
        }, 'delete');
        this.setSelection(new Set());
        break;
      case 'duplicate': {
        const off = 16 / this.cam.zoom;
        const clones = found.map(({ item }) => {
          const c = JSON.parse(JSON.stringify(item));
          c.id = uid();
          transformItem(c, matTranslate(off, off), 1, 0);
          return c;
        });
        this.store.mutate(() => { layer.items.push(...clones); }, 'duplicate');
        this.setSelection(new Set(clones.map((c) => c.id)));
        break;
      }
      case 'color': {
        const color = this.state.color;
        this.store.mutate(() => {
          for (const { item } of found) {
            item.color = color;
            if (item.fill) item.fill = color;
          }
        }, 'color');
        break;
      }
      case 'front':
        this.store.mutate(() => {
          const sel = layer.items.filter((i) => this.selection.has(i.id));
          layer.items = layer.items.filter((i) => !this.selection.has(i.id)).concat(sel);
        }, 'order');
        break;
      case 'back':
        this.store.mutate(() => {
          const sel = layer.items.filter((i) => this.selection.has(i.id));
          layer.items = sel.concat(layer.items.filter((i) => !this.selection.has(i.id)));
        }, 'order');
        break;
      case 'layer': {
        if (!arg || arg === layer.id) { this.updateSelectionUI(); return; }
        this.store.mutate((doc) => {
          const target = doc.layers.find((l) => l.id === arg);
          const sel = layer.items.filter((i) => this.selection.has(i.id));
          layer.items = layer.items.filter((i) => !this.selection.has(i.id));
          target.items.push(...sel);
          doc.activeLayer = target.id;
        }, 'move-layer');
        break;
      }
      case 'done':
        this.setSelection(new Set());
        break;
    }
    this.requestRender();
  }

  copySelection() {
    if (!this.selection.size) return;
    this.clipboard = [...this.selection].map((id) => this.store.findItem(id)).filter(Boolean)
      .map(({ item }) => JSON.parse(JSON.stringify(item)));
    this.toast(`${this.clipboard.length} gekopieerd`, 1200);
  }

  pasteClipboard() {
    if (!this.clipboard?.length) return;
    const layer = this.editableLayer();
    if (!layer) return;
    const off = 20 / this.cam.zoom;
    const items = this.clipboard.map((i) => {
      const c = JSON.parse(JSON.stringify(i));
      c.id = uid();
      transformItem(c, matTranslate(off, off), 1, 0);
      return c;
    });
    this.store.mutate(() => { layer.items.push(...items); }, 'paste');
    this.setTool('lasso');
    this.setSelection(new Set(items.map((i) => i.id)));
  }

  // ---------------------------------------------------------------- dialogen

  askText(title, initial = '', opts = {}) {
    const dlg = $('#dlg-input');
    $('#input-title').textContent = title;
    $('#input-hint').textContent = opts.hint || '';
    $('#input-hint').hidden = !opts.hint;
    const ta = $('#input-text');
    ta.value = initial;
    ta.rows = opts.multiline ? 3 : 1;
    const extra = $('#input-extra');
    extra.innerHTML = '';
    let check = null;
    if (opts.check) {
      extra.innerHTML = `<label class="check"><input type="checkbox"> <span></span></label>`;
      check = $('input', extra);
      check.checked = !!opts.check.value;
      $('span', extra).textContent = opts.check.label;
    }
    ta.onkeydown = (e) => {
      if (e.key === 'Enter' && (!opts.multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dlg.close('ok');
      }
    };
    return new Promise((resolve) => {
      dlg.onclose = () => {
        dlg.onclose = null;
        if (dlg.returnValue !== 'ok') return resolve(null);
        resolve(check ? { text: ta.value, checked: check.checked } : ta.value);
      };
      dlg.returnValue = '';
      dlg.showModal();
      setTimeout(() => { ta.focus(); ta.select(); }, 50);
    });
  }

  setupSettingsDialog() {
    $('#btn-settings').addEventListener('click', () => { this.syncSettingsUI(); $('#dlg-settings').showModal(); });
    for (const input of $$('[data-setting]')) {
      input.addEventListener('change', () => {
        this.settings[input.dataset.setting] = input.checked;
        this.persistSettings();
        this.baseDirty = true;
        this.renderOptions();
        this.requestRender();
      });
    }
    $('#set-grid').addEventListener('change', (e) => {
      const v = Number(e.target.value);
      this.store.mutate((doc) => { doc.grid = v; }, 'grid');
    });
    this.syncSettingsUI();
  }

  syncSettingsUI() {
    for (const input of $$('[data-setting]')) input.checked = !!this.settings[input.dataset.setting];
    $('#set-grid').value = String(this.store.doc.grid || 1);
  }

  // --- tekeningen
  setupDocsDialog() {
    const dlg = $('#dlg-docs');
    $('#btn-docs').addEventListener('click', async () => {
      await this.saveNow();
      await this.renderDocList();
      dlg.showModal();
    });
    $('#btn-new-doc').addEventListener('click', async () => {
      await this.saveNow();
      const name = await this.askText('Nieuwe tekening', 'Tuinontwerp');
      if (name == null) return;
      dlg.close();
      const doc = newDoc(name.trim() || 'Tuinontwerp');
      this.openDoc(doc, true);
    });
    $('#btn-backup').addEventListener('click', () => {
      const doc = { ...this.store.doc, view: this.cam.toJSON() };
      const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
      downloadBlob(blob, `${safeFilename(doc.name)}.tuin.json`);
    });
    $('#file-open-doc').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const doc = JSON.parse(await file.text());
        if (!doc.layers) throw new Error('Geen tuinontwerp-bestand');
        const existing = await loadDoc(doc.id);
        if (existing) doc.id = uid();
        await saveDoc(doc);
        dlg.close();
        this.openDoc(doc);
      } catch (err) {
        this.toast('Kon het bestand niet openen: ' + err.message);
      }
    });
  }

  async renderDocList() {
    const ul = $('#doc-list');
    ul.innerHTML = '';
    let docs = [];
    try { docs = await listDocs(); } catch { /* geen opslag */ }
    for (const d of docs) {
      const li = document.createElement('li');
      li.className = 'doc-card' + (d.id === this.store.doc.id ? ' current' : '');
      const date = new Date(d.modified).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      li.innerHTML = `${d.thumb ? `<img src="${d.thumb}" alt="">` : '<div class="noimg"></div>'}
        <div class="meta"><b></b><small>${date}</small></div>
        <div class="acts">
          <button type="button" data-a="copy" title="Dupliceren">${icon('copy', 18)}</button>
          <button type="button" data-a="del" title="Verwijderen">${icon('trash', 18)}</button>
        </div>`;
      $('b', li).textContent = d.name;
      li.addEventListener('click', async (e) => {
        const a = e.target.closest('button')?.dataset.a;
        if (a === 'del') {
          if (!confirm(`"${d.name}" definitief verwijderen?`)) return;
          await deleteDoc(d.id);
          if (d.id === this.store.doc.id) this.openDoc(newDoc(), true);
          this.renderDocList();
          return;
        }
        if (a === 'copy') {
          const full = await loadDoc(d.id);
          full.id = uid();
          full.name += ' (kopie)';
          full.created = full.modified = Date.now();
          await saveDoc(full, d.thumb);
          this.renderDocList();
          return;
        }
        const full = await loadDoc(d.id);
        $('#dlg-docs').close();
        if (full) this.openDoc(full);
      });
      ul.appendChild(li);
    }
    if (!docs.length) ul.innerHTML = '<p class="hint">Nog geen opgeslagen tekeningen.</p>';
  }

  // --- kaart
  setupMapDialog() {
    const dlg = $('#dlg-map');
    const src = $('#map-source');
    src.innerHTML = Object.entries(MAP_SOURCES).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('');
    let chosen = null;
    const status = $('#map-status');
    const results = $('#map-results');
    const placeBtn = $('#map-place');

    const choose = (r, li) => {
      chosen = r;
      for (const x of $$('li', results)) x.classList.toggle('active', x === li);
      placeBtn.disabled = false;
      status.textContent = `Gekozen: ${r.name}`;
    };

    const search = async () => {
      const q = $('#map-q').value.trim();
      if (!q) return;
      results.innerHTML = '';
      const ll = parseLatLon(q);
      const list = ll ? [ll] : (status.textContent = 'Zoeken…', await searchAddress(q));
      if (!list.length) {
        status.textContent = 'Niets gevonden. Probeer een ander adres of voer coördinaten in (bijv. 52.0907, 5.1214).';
        return;
      }
      status.textContent = 'Kies een resultaat.';
      for (const r of list) {
        const li = document.createElement('li');
        li.textContent = r.name;
        li.addEventListener('click', () => choose(r, li));
        results.appendChild(li);
      }
      if (list.length === 1) choose(list[0], $('li', results));
    };

    $('#btn-map').addEventListener('click', () => {
      status.textContent = 'Kies een adres. De kaart wordt op ware grootte als ondergrond in een eigen laag geplaatst.';
      dlg.showModal();
      setTimeout(() => $('#map-q').focus(), 50);
    });
    $('#map-search').addEventListener('click', search);
    $('#map-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    $('#map-locate').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      status.textContent = 'Locatie bepalen…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const r = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Huidige locatie' };
          results.innerHTML = '';
          const li = document.createElement('li');
          li.textContent = `Huidige locatie (${r.lat.toFixed(5)}, ${r.lon.toFixed(5)})`;
          results.appendChild(li);
          choose(r, li);
        },
        () => { status.textContent = 'Locatie niet beschikbaar.'; },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
    placeBtn.addEventListener('click', async () => {
      if (!chosen) return;
      placeBtn.disabled = true;
      status.textContent = 'Kaart laden… 0%';
      try {
        const sizeM = Number($('#map-size').value);
        const map = await buildMap({
          lat: chosen.lat, lon: chosen.lon, sizeM, source: src.value, kadaster: $('#map-kadaster').checked,
          onProgress: (f) => { status.textContent = `Kaart laden… ${Math.round(f * 100)}%`; },
        });
        this.placeUnderlay(map.dataUrl, map.widthM, map.heightM, `Kaart – ${chosen.name.split(',')[0]}`, map.attribution, true);
        this.store.doc.geo = { lat: chosen.lat, lon: chosen.lon, name: chosen.name };
        dlg.close();
        this.toast(`Kaart geplaatst: ${sizeM} × ${sizeM} m op ware grootte. De laag is vergrendeld.`, 4000);
      } catch (err) {
        status.textContent = err.message || String(err);
      } finally {
        placeBtn.disabled = false;
      }
    });
  }

  /** Plaats een afbeelding als onderste laag, gecentreerd in beeld. */
  placeUnderlay(dataUrl, widthM, heightM, name, attribution, lock) {
    const center = contentBox(this.store.doc) ? this.cam.toWorld([this.width / 2, this.height / 2]) : [0, 0];
    const asset = this.store.addAsset(dataUrl);
    const layer = newLayer(name);
    layer.locked = !!lock;
    const item = {
      type: 'image', id: uid(), asset, x: center[0], y: center[1], w: widthM, h: heightM, rot: 0,
    };
    if (attribution) item.attribution = attribution;
    layer.items.push(item);
    this.store.mutate((doc) => {
      doc.layers.unshift(layer);
      // tekenlaag erboven met licht trekpapier, zodat de ondergrond iets terugtreedt
      if (doc.layers.length > 1 && doc.layers[1].paper === 0) doc.layers[1].paper = 0.25;
      if (!lock) doc.activeLayer = layer.id;
    }, 'underlay');
    this.cam.fitBox({ minX: center[0] - widthM / 2, minY: center[1] - heightM / 2, maxX: center[0] + widthM / 2, maxY: center[1] + heightM / 2 }, this.width, this.height, 30);
    this.cameraChanged();
  }

  // --- ondergrond importeren
  setupImport() {
    const input = $('#file-import');
    $('#btn-import').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      try {
        let dataUrl, pageMm = null;
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
          this.toast('PDF wordt geladen…');
          ({ dataUrl, pageMm } = await renderPdfFile(file));
        } else {
          dataUrl = await loadImageFile(file);
        }
        const img = await loadImg(dataUrl);
        const aspect = img.naturalHeight / img.naturalWidth;
        const hint = pageMm
          ? `PDF-pagina: ${Math.round(pageMm[0])} × ${Math.round(pageMm[1])} mm. Is dit een tekening op schaal? Vul de schaal in (bijv. 1:100) of de werkelijke breedte (bijv. 25 m). Leeg laten = later kalibreren.`
          : 'Hoe breed is deze afbeelding in werkelijkheid? (bijv. 25 m). Leeg laten = later kalibreren met de Schaal-tool.';
        const answer = await this.askText('Ondergrond plaatsen', '', { hint });
        if (answer == null) return;
        let width = NaN;
        const sm = /^\s*1\s*:\s*(\d+(?:[.,]\d+)?)\s*$/.exec(answer);
        if (sm && pageMm) width = (pageMm[0] * parseFloat(sm[1].replace(',', '.'))) / 1000;
        else if (answer.trim()) width = parseLength(answer);
        const known = width > 0;
        if (!known) width = 20;
        const name = 'Ondergrond – ' + file.name.replace(/\.[^.]+$/, '');
        this.placeUnderlay(dataUrl, width, width * aspect, name, null, known);
        if (!known) {
          this.setTool('calibrate');
          this.toast('Trek nu een lijn over een bekende maat om de schaal in te stellen.', 5000);
        } else {
          this.toast(`Ondergrond geplaatst (${formatLength(width, 100)} breed). De laag is vergrendeld.`, 4000);
        }
      } catch (err) {
        console.error(err);
        this.toast('Importeren mislukt: ' + (err.message || err));
      }
    });
  }

  // --- export
  setupExportDialog() {
    const dlg = $('#dlg-export');
    const scaleSel = $('#exp-scale');
    scaleSel.innerHTML = '<option value="fit">Passend</option>' + SCALES.map((s) => `<option value="${s}">1:${s}</option>`).join('');
    const opts = () => ({
      paper: $('#exp-paper').value,
      orientation: $('#exp-orient').value,
      scale: scaleSel.value === 'fit' ? 'fit' : Number(scaleSel.value),
      area: $('#exp-area').value,
      titleBlock: $('#exp-titleblock').checked,
      title: $('#exp-title').value.trim(),
      subtitle: $('#exp-subtitle').value.trim(),
    });
    const viewBox = () => {
      const pts = [[0, 0], [this.width, 0], [this.width, this.height], [0, this.height]].map((p) => this.cam.toWorld(p));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    };
    const info = () => {
      const plan = planExport(this.store.doc, opts(), viewBox());
      const el = $('#exp-info');
      if (!plan) { el.textContent = 'De tekening is nog leeg.'; return; }
      const bw = plan.box.maxX - plan.box.minX, bh = plan.box.maxY - plan.box.minY;
      const f = (v) => v.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
      el.textContent = `Gebied ${f(bw)} × ${f(bh)} m op ${opts().paper} bij schaal 1:${plan.scale}. ` +
        (plan.fits ? 'Past op het papier.' : 'Let op: past niet helemaal; de randen vallen weg. Kies een kleinere schaal (groter getal) of groter papier.');
    };
    for (const id of ['#exp-paper', '#exp-orient', '#exp-scale', '#exp-area', '#exp-titleblock']) $(id).addEventListener('change', info);

    $('#btn-export').addEventListener('click', () => {
      $('#exp-title').value = this.store.doc.name;
      scaleSel.value = String(this.store.doc.scale);
      info();
      dlg.showModal();
    });

    const run = async (kind) => {
      const btns = [$('#exp-pdf'), $('#exp-png')];
      btns.forEach((b) => { b.disabled = true; });
      $('#exp-info').textContent = 'Bezig met exporteren…';
      try {
        const o = opts();
        const { blob } = kind === 'pdf' ? await exportPdf(this.store.doc, o, viewBox()) : await exportPng(this.store.doc, o, viewBox());
        const filename = `${safeFilename(o.title || this.store.doc.name)}.${kind}`;
        await shareOrDownload(blob, filename);
        dlg.close();
      } catch (err) {
        console.error(err);
        $('#exp-info').textContent = 'Exporteren mislukt: ' + (err.message || err);
      } finally {
        btns.forEach((b) => { b.disabled = false; });
      }
    };
    $('#exp-pdf').addEventListener('click', () => run('pdf'));
    $('#exp-png').addEventListener('click', () => run('png'));
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
}

// ---------------------------------------------------------------- bestanden

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Afbeelding kon niet worden gelezen'));
    img.src = src;
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Lees een afbeelding en verklein zo nodig tot max. 4096 px. */
async function loadImageFile(file) {
  const src = await readAsDataUrl(file);
  const img = await loadImg(src);
  const max = 4096;
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  if (k === 1 && file.size < 6e6) return src;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Kon PDF-lezer niet laden (internet nodig).'));
    document.head.appendChild(s);
  });
}

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

async function renderPdfFile(file) {
  if (!window.pdfjsLib) await loadScript(PDFJS + 'pdf.min.js');
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(4096 / vp1.width, 4096 / vp1.height, 6);
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return {
    dataUrl: c.toDataURL('image/jpeg', 0.9),
    pageMm: [(vp1.width / 72) * 25.4, (vp1.height / 72) * 25.4],
  };
}

async function shareOrDownload(blob, filename) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
  }
  downloadBlob(blob, filename);
}

window.app = new App();
