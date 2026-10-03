// Cache van geladen afbeeldingen (asset-id -> HTMLImageElement).

const images = new Map();
let onLoad = () => {};

export function setAssetLoadHandler(fn) {
  onLoad = fn;
}

export function getImage(doc, assetId) {
  const src = doc.assets[assetId];
  if (!src) return null;
  let entry = images.get(assetId);
  if (!entry || entry.src !== src) {
    const img = new Image();
    entry = { src, img, ready: false };
    images.set(assetId, entry);
    img.onload = () => {
      entry.ready = true;
      onLoad();
    };
    img.src = src;
  }
  return entry.ready ? entry.img : null;
}

/** Wacht tot alle afbeeldingen van een document geladen zijn (voor export). */
export async function preloadAssets(doc) {
  await Promise.all(Object.keys(doc.assets).map((id) => new Promise((resolve) => {
    if (getImage(doc, id)) return resolve();
    const entry = images.get(id);
    if (!entry) return resolve();
    entry.img.addEventListener('load', resolve, { once: true });
    entry.img.addEventListener('error', resolve, { once: true });
  })));
}
