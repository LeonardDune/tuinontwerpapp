// PDF/PNG-export: het ontwerp staat op het papier, ook met kadaster en kaart eromheen en een grote tekenschaal.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc, newLayer } = await import('./js/model.js');
    const d = newDoc('Verharding tuin');
    d.scale = 20; // tekenschaal 1:20, zoals in de tekening van de gebruiker
    // ontwerp: tuin van 15 × 25 m met een rood terras
    d.layers[0].items.push({ type: 'shape', id: 'tuin', kind: 'polygon', rect: true, points: [[0, 0], [15, 0], [15, 25], [0, 25]], color: '#333', width: 0.05 });
    d.layers[0].items.push({ type: 'shape', id: 'terras', kind: 'polygon', rect: true, points: [[5, 10], [10, 10], [10, 15], [5, 15]], color: '#333', width: 0.05, fill: '#c03020', fillAlpha: 1 });
    // ondergrond: perceelgrenzen tot ver buiten de tuin
    const perc = newLayer('Perceelgrenzen'); perc.source = 'percelen';
    perc.items.push({ type: 'shape', id: 'p1', kind: 'line', points: [[-120, -40], [200, 300]], color: '#b03a2e', width: 0.1, source: 'brk' });
    d.layers.unshift(perc);
    a.openDoc(d, true);
  });

  console.log('Gebied en schaal');
  const box = await page.evaluate(async () => { const { contentBox } = await import('./js/export.js'); return contentBox(window.app.store.doc); });
  assert(Math.abs(box.minX) < 0.2 && Math.abs(box.maxX - 15) < 0.2 && Math.abs(box.maxY - 25) < 0.2, `"Hele tekening" = het ontwerp, niet de perceelgrenzen (${box.minX.toFixed(1)}…${box.maxX.toFixed(1)} × ${box.minY.toFixed(1)}…${box.maxY.toFixed(1)} m)`);
  await page.click('#btn-export');
  const sc = await page.inputValue('#exp-scale');
  const info = await page.textContent('#exp-info');
  assert(sc === 'fit' && /Past op het papier/.test(info), `tekenschaal 1:20 past niet op A3: export staat op "Passend" (${info.trim()})`);
  await page.selectOption('#exp-scale', '20');
  assert(/past niet/.test(await page.textContent('#exp-info')) && /Passend/.test(await page.textContent('#exp-info')), 'bij 1:20 een duidelijke waarschuwing met de passende schaal');
  await page.selectOption('#exp-scale', 'fit');

  console.log('Export');
  const res = await page.evaluate(async () => {
    const { renderExport } = await import('./js/export.js');
    const a = window.app;
    const opts = { paper: 'A3', orientation: 'portrait', scale: 'fit', area: 'all', titleBlock: true, title: 'Test', subtitle: '', plantView: 'planten', rot: 0, dpi: 60 };
    const { canvas, plan } = await renderExport(a.store.doc, opts, null);
    const g = canvas.getContext('2d');
    const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0, rx = 0, ry = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) { const i = (y * canvas.width + x) * 4; if (d[i] > 170 && d[i + 1] < 90 && d[i + 2] < 80) { red++; rx += x; ry += y; } }
    return { scale: plan.scale, fits: plan.fits, red, cx: rx / red / canvas.width, cy: ry / red / canvas.height, url: canvas.toDataURL('image/png') };
  });
  fs.writeFileSync(path.join(OUT, 'export.png'), Buffer.from(res.url.split(',')[1], 'base64'));
  assert(res.fits && res.scale >= 50 && res.scale <= 200, `passende schaal 1:${res.scale}`);
  assert(res.red > 500 && Math.abs(res.cx - 0.5) < 0.1 && res.cy > 0.3 && res.cy < 0.6, `terras staat midden op het blad (${(res.cx * 100).toFixed(0)}%, ${(res.cy * 100).toFixed(0)}%)`);

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle export-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
