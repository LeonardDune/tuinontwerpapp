// Doorzichtigheid per element, en lijn- en vulkleur van stencils en vormen aanpassen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Stijl');
    d.layers[0].items.push({ type: 'shape', id: 'R', kind: 'polygon', rect: true, points: [[0, 0], [8, 0], [8, 5], [0, 5]], color: '#333', width: 0.04, fill: '#2f5d3a', fillAlpha: 0.3 });
    d.layers[0].items.push({ type: 'stencil', id: 'T', symbol: 'loofboom', x: 4, y: 2.5, w: 4, h: 4, rot: 0, color: '#5a8f3c' });
    d.layers[0].items.push({ type: 'shape', id: 'L', kind: 'line', points: [[10, 0], [14, 0]], color: '#333', width: 0.04 });
    a.openDoc(d, true); a.cam.zoom = 50; a.cam.rot = 0; a.cam.x = 200; a.cam.y = 200; a.cameraChanged();
    a.setTool('lasso'); a.setSelection(new Set(['T']));
  });
  const slide = async (k, v) => {
    await page.evaluate(({ k, v }) => {
      const inp = document.querySelector(`#selection-bar input[data-k="${k}"]`);
      for (const x of [Math.round((Number(inp.value) + v) / 2), v]) { inp.value = x; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }, { k, v });
  };
  const item = (id) => page.evaluate((id) => JSON.parse(JSON.stringify(window.app.store.findItem(id).item)), id);

  console.log('Stencil');
  for (const k of ['color', 'fillColor', 'fillAlpha', 'opacity']) assert(await page.locator(`#selection-bar [data-k="${k}"]`).count() === 1, `balk heeft ${{ color: 'lijnkleur', fillColor: 'vulkleur', fillAlpha: 'vulsterkte', opacity: 'dekking' }[k]}`);
  await slide('opacity', 40);
  assert((await item('T')).opacity === 0.4, 'dekking 40% ingesteld met het schuifje');
  await page.evaluate(() => { const i = document.querySelector('#selection-bar input[data-k="fillColor"]'); i.value = '#d35400'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await slide('fillAlpha', 80);
  let t = await item('T');
  assert(t.fillColor === '#d35400' && t.fillAlpha === 0.8 && t.color === '#5a8f3c', 'eigen vulkleur en -sterkte, lijnkleur blijft');
  await page.screenshot({ path: path.join(OUT, 'stijl-stencil.png') });
  await page.click('#btn-undo');
  t = await item('T');
  assert(t.fillAlpha == null && t.fillColor === '#d35400', 'ongedaan maken: het schuifje is één stap');

  console.log('Pixels');
  const px = await page.evaluate(async () => {
    const { drawStencil } = await import('./js/stencils.js');
    const sample = (extra) => {
      const c = document.createElement('canvas'); c.width = c.height = 100;
      const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 100, 100);
      g.setTransform(10, 0, 0, 10, 50, 50);
      g.save();
      g.globalAlpha = extra.opacity ?? 1;
      drawStencil(g, { type: 'stencil', symbol: 'loofboom', x: 0, y: 0, w: 6, h: 6, rot: 0, color: '#5a8f3c', ...extra }, 0.02, '#ffffff');
      g.restore();
      return [...g.getImageData(60, 62, 1, 1).data].slice(0, 3);
    };
    return { red: sample({ fillColor: '#ff0000', fillAlpha: 1 }), half: sample({ opacity: 0.4 }), full: sample({}) };
  });
  assert(px.red[0] > 200 && px.red[1] < 60, `vulkleur rood is te zien (${px.red})`);
  assert(px.half[1] < px.full[1] - 60, `40% dekking laat de zwarte ondergrond door (${px.half} vs ${px.full})`);

  console.log('Vormen en lijnen');
  await page.evaluate(() => window.app.setSelection(new Set(['R'])));
  assert(await page.locator('#selection-bar [data-k="fillColor"]').count() === 1 && await page.locator('#selection-bar [data-k="fillAlpha"]').count() === 1, 'gevulde vorm: vulkleur en vulsterkte');
  await slide('fillAlpha', 70);
  await slide('opacity', 60);
  const r = await item('R');
  assert(r.fillAlpha === 0.7 && r.opacity === 0.6, 'vulsterkte 70% en dekking 60%');
  await page.evaluate(() => window.app.setSelection(new Set(['L'])));
  assert(await page.locator('#selection-bar [data-k="opacity"]').count() === 1, 'lijn: dekking instelbaar');
  await slide('opacity', 100);
  assert((await item('L')).opacity === undefined, '100% = volledig dekkend');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle stijl-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
