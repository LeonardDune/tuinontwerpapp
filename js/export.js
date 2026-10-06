// Exporteren naar PDF of PNG op een echte schaal, met titelblok, schaalbalk en noordpijl.

import { Camera } from './camera.js';
import { renderScene } from './render.js';
import { itemBBox } from './items.js';
import { unionBox } from './geom.js';
import { SCALES, niceStep, formatTick } from './units.js';
import { preloadAssets } from './assets.js';
import { buildPdf, dataUrlToBytes } from './pdf.js';

export const PAPER = {
  A4: [297, 210],
  A3: [420, 297],
  A2: [594, 420],
  A1: [841, 594],
};

const MARGIN = 10;
const TITLE_H = 24;

export function contentBox(doc) {
  let box = null;
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const item of layer.items) box = unionBox(box, itemBBox(item));
  }
  return box;
}

/** Bereken pagina-indeling en schaal. */
export function planExport(doc, opts, viewBox) {
  const [a, b] = PAPER[opts.paper];
  const pageW = opts.orientation === 'portrait' ? b : a;
  const pageH = opts.orientation === 'portrait' ? a : b;
  const titleH = opts.titleBlock ? TITLE_H : 0;
  const drawW = pageW - MARGIN * 2;
  const drawH = pageH - MARGIN * 2 - titleH;
  const box = opts.area === 'view' && viewBox ? viewBox : contentBox(doc);
  if (!box) return null;
  const bw = Math.max(box.maxX - box.minX, 0.01), bh = Math.max(box.maxY - box.minY, 0.01);
  let scale = opts.scale;
  if (scale === 'fit') {
    const needed = Math.max((bw * 1000) / drawW, (bh * 1000) / drawH) * 1.04;
    scale = SCALES.find((s) => s >= needed) || Math.ceil(needed / 1000) * 1000;
  }
  const fits = (bw * 1000) / scale <= drawW + 0.5 && (bh * 1000) / scale <= drawH + 0.5;
  return { pageW, pageH, drawW, drawH, titleH, box, scale, fits };
}

export async function renderExport(doc, opts, viewBox) {
  const plan = planExport(doc, opts, viewBox);
  if (!plan) throw new Error('De tekening is leeg.');
  await preloadAssets(doc);
  const { pageW, pageH, drawW, drawH, titleH, box, scale } = plan;
  const maxPixels = 15e6;
  const dpi = Math.min(opts.dpi || 200, Math.sqrt(maxPixels / ((pageW / 25.4) * (pageH / 25.4))));
  const pxmm = dpi / 25.4;

  const page = document.createElement('canvas');
  page.width = Math.round(pageW * pxmm);
  page.height = Math.round(pageH * pxmm);
  const g = page.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, page.width, page.height);

  // Tekening
  const dw = Math.round(drawW * pxmm), dh = Math.round(drawH * pxmm);
  const dc = document.createElement('canvas');
  dc.width = dw;
  dc.height = dh;
  const cam = new Camera();
  cam.zoom = (pxmm * 1000) / scale;
  cam.rot = 0;
  cam.x = dw / 2 - ((box.minX + box.maxX) / 2) * cam.zoom;
  cam.y = dh / 2 - ((box.minY + box.maxY) / 2) * cam.zoom;
  const exportDoc = { ...doc, scale: doc.scale };
  renderScene(dc.getContext('2d'), {
    doc: exportDoc, cam, width: dw, height: dh, dpr: 1, background: '#ffffff', paperColor: '#ffffff', plantView: opts.plantView,
  });
  g.drawImage(dc, Math.round(MARGIN * pxmm), Math.round(MARGIN * pxmm));

  // Kader
  g.strokeStyle = '#222';
  g.lineWidth = 0.35 * pxmm;
  g.strokeRect(MARGIN * pxmm, MARGIN * pxmm, drawW * pxmm, (drawH + titleH) * pxmm);

  if (opts.titleBlock) drawTitleBlock(g, pxmm, { ...plan, doc, opts });
  return { canvas: page, plan };
}

function drawTitleBlock(g, k, { drawW, drawH, scale, doc, opts }) {
  const x0 = MARGIN, y0 = MARGIN + drawH, w = drawW, h = TITLE_H;
  const mm = (v) => v * k;
  g.strokeStyle = '#222';
  g.lineWidth = mm(0.35);
  g.beginPath();
  g.moveTo(mm(x0), mm(y0)); g.lineTo(mm(x0 + w), mm(y0));
  const c1 = x0 + w * 0.5, c2 = x0 + w * 0.8;
  g.moveTo(mm(c1), mm(y0)); g.lineTo(mm(c1), mm(y0 + h));
  g.moveTo(mm(c2), mm(y0)); g.lineTo(mm(c2), mm(y0 + h));
  g.stroke();

  g.fillStyle = '#222';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const font = (size, weight = 400) => `${weight} ${mm(size)}px system-ui, -apple-system, Helvetica, Arial, sans-serif`;
  g.font = font(6, 600);
  g.fillText(opts.title || doc.name, mm(x0 + 5), mm(y0 + 10));
  g.font = font(3);
  const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  g.fillText(`${opts.subtitle ? opts.subtitle + ' · ' : ''}${date}`, mm(x0 + 5), mm(y0 + 16.5));
  const attributions = new Set();
  for (const l of doc.layers) if (l.visible) for (const i of l.items) if (i.attribution) attributions.add(i.attribution);
  if (attributions.size) {
    g.font = font(2.2);
    g.fillStyle = '#666';
    g.fillText([...attributions].join(' · '), mm(x0 + 5), mm(y0 + 21));
    g.fillStyle = '#222';
  }

  // Schaal + schaalbalk
  g.font = font(5, 600);
  g.fillText(`Schaal 1:${scale}`, mm(c1 + 5), mm(y0 + 9));
  const maxBarMm = (c2 - c1) - 14;
  const unit = niceStep(((maxBarMm / 5) * scale) / 1000);
  const segMm = (unit * 1000) / scale;
  const n = Math.max(1, Math.min(5, Math.floor(maxBarMm / segMm)));
  const bx = c1 + 5, by = y0 + 14, bh = 2;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#fff' : '#222';
    g.fillRect(mm(bx + i * segMm), mm(by), mm(segMm), mm(bh));
  }
  g.strokeRect(mm(bx), mm(by), mm(segMm * n), mm(bh));
  g.fillStyle = '#222';
  g.font = font(2.4);
  g.textAlign = 'center';
  for (let i = 0; i <= n; i++) g.fillText(formatTick(unit * i), mm(bx + i * segMm), mm(by + bh + 3.4));

  // Noordpijl (meegedraaid als het noorden niet boven is)
  const nx = c2 + (x0 + w - c2) / 2, ny = y0 + h / 2 + 1;
  const r = 7;
  g.save();
  g.translate(mm(nx), mm(ny));
  g.rotate(((doc.northDeg || 0) * Math.PI) / 180);
  g.translate(-mm(nx), -mm(ny));
  g.beginPath();
  g.moveTo(mm(nx), mm(ny - r));
  g.lineTo(mm(nx + r * 0.4), mm(ny + r * 0.7));
  g.lineTo(mm(nx), mm(ny + r * 0.35));
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(mm(nx), mm(ny - r));
  g.lineTo(mm(nx - r * 0.4), mm(ny + r * 0.7));
  g.lineTo(mm(nx), mm(ny + r * 0.35));
  g.closePath();
  g.stroke();
  g.font = font(3.5, 700);
  g.textAlign = 'left';
  g.fillText('N', mm(nx + r * 0.55), mm(ny - r * 0.45));
  g.restore();
}

export async function exportPdf(doc, opts, viewBox) {
  const { canvas, plan } = await renderExport(doc, opts, viewBox);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const blob = buildPdf(dataUrlToBytes(dataUrl), canvas.width, canvas.height, plan.pageW, plan.pageH, {
    title: opts.title || doc.name,
  });
  return { blob, plan };
}

export async function exportPng(doc, opts, viewBox) {
  const { canvas, plan } = await renderExport(doc, opts, viewBox);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { blob, plan };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function safeFilename(name) {
  return (name || 'tuinontwerp').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'tuinontwerp';
}
