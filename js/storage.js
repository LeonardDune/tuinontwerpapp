// Opslag van tekeningen in IndexedDB (lokaal op het apparaat).

const DB_NAME = 'tuinontwerp';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('index')) db.createObjectStore('index', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/** Verwijder assets die door geen enkel item meer gebruikt worden. */
function pruneAssets(doc) {
  const used = new Set();
  for (const l of doc.layers) for (const i of l.items) if (i.asset) used.add(i.asset);
  const assets = {};
  for (const id of Object.keys(doc.assets)) if (used.has(id)) assets[id] = doc.assets[id];
  return assets;
}

export async function saveDoc(doc, thumb) {
  const data = { ...doc, assets: pruneAssets(doc) };
  await tx('docs', 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(data))));
  await tx('index', 'readwrite', (s) => s.put({
    id: doc.id, name: doc.name, modified: doc.modified, created: doc.created, thumb: thumb || null,
  }));
}

export function loadDoc(id) {
  return tx('docs', 'readonly', (s) => s.get(id));
}

export async function listDocs() {
  const all = await tx('index', 'readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => b.modified - a.modified);
}

export async function deleteDoc(id) {
  await tx('docs', 'readwrite', (s) => s.delete(id));
  await tx('index', 'readwrite', (s) => s.delete(id));
}

const SETTINGS_KEY = 'tuinontwerp.settings';

export function loadSettings(defaults) {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* opslag niet beschikbaar */
  }
}
