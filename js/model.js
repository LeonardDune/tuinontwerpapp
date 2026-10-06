// Documentmodel, lagen en undo/redo-geschiedenis.
//
// Wereldcoördinaten zijn in meters (werkelijke maat). De tekenschaal (doc.scale,
// bijv. 100 voor 1:100) bepaalt hoe dik pennen en hoe groot teksten op papier zijn.

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newLayer(name) {
  return {
    id: uid(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    paper: 0, // dekking van het "trekpapier" onder deze laag (0..0.9)
    items: [],
  };
}

export function newDoc(name = 'Nieuw tuinontwerp') {
  const layer = newLayer('Laag 1');
  return {
    id: uid(),
    name,
    created: Date.now(),
    modified: Date.now(),
    scale: 100,
    grid: 1,
    layers: [layer],
    activeLayer: layer.id,
    assets: {}, // id -> dataURL (afbeeldingen, kaarten)
    view: null,
  };
}

/** Converteer millimeters op papier naar meters in de wereld bij de tekenschaal. */
export function paperToWorld(mm, scale) {
  return (mm / 1000) * scale;
}

const HISTORY_LIMIT = 80;

export class Store {
  constructor(doc) {
    this.listeners = new Set();
    this.load(doc);
  }

  load(doc) {
    this.doc = doc;
    this.undoStack = [];
    this.redoStack = [];
    this.tx = null;
    this.emit({ type: 'load' });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(evt) {
    for (const fn of this.listeners) fn(evt);
  }

  snapshot() {
    const { layers, activeLayer, scale, grid, name, planting } = this.doc;
    return JSON.stringify({ layers, activeLayer, scale, grid, name, planting: planting || null });
  }

  restore(snap) {
    Object.assign(this.doc, JSON.parse(snap));
  }

  /** Voer een wijziging uit als één undo-stap. */
  mutate(fn, label = '') {
    if (this.tx) {
      fn(this.doc);
      this.emit({ type: 'change', label });
      return;
    }
    const before = this.snapshot();
    const result = fn(this.doc);
    this.push(before);
    this.emit({ type: 'change', label });
    return result;
  }

  /** Start een transactie (bijv. tijdens slepen); alle tussenwijzigingen worden één stap. */
  begin() {
    if (!this.tx) this.tx = this.snapshot();
  }

  commit(label = '') {
    if (!this.tx) return;
    const before = this.tx;
    this.tx = null;
    if (before !== this.snapshot()) this.push(before);
    this.emit({ type: 'change', label });
  }

  cancel() {
    if (!this.tx) return;
    this.restore(this.tx);
    this.tx = null;
    this.emit({ type: 'change', label: 'cancel' });
  }

  /** Meld een tussentijdse wijziging (tijdens een transactie). */
  touch() {
    this.emit({ type: 'change', label: 'live' });
  }

  push(before) {
    this.undoStack.push(before);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.doc.modified = Date.now();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    this.restore(this.undoStack.pop());
    this.doc.modified = Date.now();
    this.emit({ type: 'change', label: 'undo' });
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    this.restore(this.redoStack.pop());
    this.doc.modified = Date.now();
    this.emit({ type: 'change', label: 'redo' });
  }

  get activeLayer() {
    const d = this.doc;
    return d.layers.find((l) => l.id === d.activeLayer) || d.layers[d.layers.length - 1];
  }

  layerById(id) {
    return this.doc.layers.find((l) => l.id === id);
  }

  findItem(id) {
    for (const layer of this.doc.layers) {
      const item = layer.items.find((i) => i.id === id);
      if (item) return { layer, item };
    }
    return null;
  }

  addAsset(dataUrl) {
    const id = 'a' + uid();
    this.doc.assets[id] = dataUrl;
    return id;
  }
}
