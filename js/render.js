// Weergave van het document: lagen (met trekpapier en dekking), raster en schaalbalk.

import { drawItem } from './items.js';
import { rolesMap, bedStats, isBed, isGroup } from './planting.js';
import { niceStep, formatTick } from './units.js';

let layerCanvas = null;

function getLayerCanvas(w, h) {
  if (!layerCanvas) layerCanvas = document.createElement('canvas');
  if (layerCanvas.width !== w || layerCanvas.height !== h) {
    layerCanvas.width = w;
    layerCanvas.height = h;
  }
  return layerCanvas;
}

/**
 * opts: { doc, cam, width, height (CSS px), dpr, background, hideItems:Set, paperColor }
 */
export function renderScene(ctx, opts) {
  const { doc, cam, width, height, dpr } = opts;
  const W = Math.round(width * dpr), H = Math.round(height * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = opts.background || '#fbfaf6';
  ctx.fillRect(0, 0, W, H);

  const rc = { doc, scale: doc.scale, zoom: cam.zoom, dpr, minPx: opts.minLabelPx || 0, month: opts.month || null, plantView: opts.plantView || 'planten', paper: opts.paperColor || opts.background || '#fbfaf6', ...plantContext(doc) };
  const hide = opts.hideItems;

  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    if (layer.paper > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = layer.paper;
      ctx.fillStyle = opts.paperColor || '#fbfaf6';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    const useBuffer = layer.opacity < 1;
    let g = ctx;
    if (useBuffer) {
      const lc = getLayerCanvas(W, H);
      g = lc.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
    }
    cam.apply(g, dpr);
    for (const item of layer.items) {
      if (hide && hide.has(item.id)) continue;
      g.save();
      drawItem(g, item, rc);
      g.restore();
    }
    if (opts.extraForLayer && opts.extraForLayer.layerId === layer.id) {
      g.save();
      opts.extraForLayer.draw(g, rc);
      g.restore();
    }
    if (useBuffer) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(layerCanvas, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

const statsCache = { key: null, value: null };

/** Bouwstenen, plantvakken en groepen voor het tekenen (oppervlakken gecachet per documentversie). */
export function plantContext(doc) {
  const roles = rolesMap(doc);
  const rolesKey = (doc.planting?.roles || []).map((r) => `${r.id}:${r.height}:${r.d || ''}`).join(',');
  const bedsById = {}, groupsByBed = {};
  const walls = [];
  let any = false;
  for (const layer of doc.layers) {
    for (const it of layer.items) {
      if (it.wall && it.type === 'shape' && layer.visible) walls.push(it);
      if (isBed(it)) { bedsById[it.id] = it; any = true; } else if (isGroup(it)) (groupsByBed[it.bedId] ||= []).push(it);
    }
  }
  const ctx = { roles, rolesKey, bedsById, groupsByBed, bedAreas: {}, groupAreas: {}, walls };
  if (!any) return ctx;
  const key = JSON.stringify(doc.layers.map((l) => [l.visible, l.items.filter((it) => isBed(it) || isGroup(it)).map((it) => [it.id, it.points, it.bedId])]));
  if (statsCache.key !== key) {
    statsCache.key = key;
    statsCache.value = bedStats(doc);
  }
  for (const st of statsCache.value) {
    ctx.bedAreas[st.bed.id] = st.baseArea;
    for (const gs of st.groups) ctx.groupAreas[gs.group.id] = gs.area;
  }
  return ctx;
}

/** Zichtbare rasterstap (meters) bij de huidige zoom. */
export function gridStepFor(zoom, gridSize = 1) {
  let step = gridSize;
  while (step * zoom < 10) step *= 5;
  while (step * zoom > 200 && step > 0.01) step /= 5;
  return step;
}

/** Raster in meters, adaptief aan de zoom. */
export function renderGrid(ctx, cam, width, height, dpr, gridSize = 1) {
  const step = gridStepFor(cam.zoom, gridSize);
  const major = step * 5;
  const corners = [[0, 0], [width, 0], [width, height], [0, height]].map((p) => cam.toWorld(p));
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  const minX = Math.floor(Math.min(...xs) / step) * step, maxX = Math.max(...xs);
  const minY = Math.floor(Math.min(...ys) / step) * step, maxY = Math.max(...ys);
  if ((maxX - minX) / step > 600 || (maxY - minY) / step > 600) return;
  cam.apply(ctx, dpr);
  const px = 1 / cam.zoom;
  const drawLines = (isMajor) => {
    ctx.beginPath();
    for (let x = minX; x <= maxX; x += step) {
      const m = Math.abs(x / major - Math.round(x / major)) < 1e-6;
      if (m !== isMajor) continue;
      ctx.moveTo(x, minY); ctx.lineTo(x, maxY);
    }
    for (let y = minY; y <= maxY; y += step) {
      const m = Math.abs(y / major - Math.round(y / major)) < 1e-6;
      if (m !== isMajor) continue;
      ctx.moveTo(minX, y); ctx.lineTo(maxX, y);
    }
    ctx.stroke();
  };
  ctx.lineWidth = px;
  ctx.strokeStyle = 'rgba(70, 110, 140, 0.10)';
  drawLines(false);
  ctx.strokeStyle = 'rgba(70, 110, 140, 0.22)';
  drawLines(true);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Schaalbalk linksonder (schermruimte). */
export function renderScaleBar(ctx, cam, width, height, dpr) {
  const target = 110; // px
  const meters = niceStep(target / cam.zoom);
  const len = meters * cam.zoom;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const x = 16, y = height - 22;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(x - 6, y - 18, len + 12 + 60, 28);
  ctx.strokeStyle = '#223';
  ctx.fillStyle = '#223';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.lineTo(x + len, y - 5);
  ctx.moveTo(x + len / 2, y - 3); ctx.lineTo(x + len / 2, y);
  ctx.stroke();
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(formatTick(meters), x + len + 6, y);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
