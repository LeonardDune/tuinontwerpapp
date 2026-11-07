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

  console.log('Afdekken volgt de vorm van het stencil');
  const sil = await page.evaluate(async () => {
    const { drawStencil, STENCIL_MAP } = await import('./js/stencils.js');
    const at = (symbol, lx, ly) => {
      const def = STENCIL_MAP[symbol];
      const c = document.createElement('canvas'); c.width = c.height = 400;
      const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 400, 400);
      g.setTransform(60, 0, 0, 60, 200, 200);
      drawStencil(g, { type: 'stencil', symbol, x: 0, y: 0, w: def.w, h: def.h, rot: 0 }, 0.01, '#ffffff');
      return [...g.getImageData(Math.round(200 + lx * 60), Math.round(200 + ly * 60), 1, 1).data].slice(0, 3);
    };
    return {
      autoHoek: at('auto', 0.86, -2.2), autoMidden: at('auto', 0, 0.9),
      tussenStoelen: at('tafel6', 0, -0.95 + 0.0), tafelblad: at('tafel6', 0.3, 0.1),
      nieuw: ['tuinstoel', 'loungestoel', 'bistrostoel', 'terrastafel', 'terrastafelrecht', 'tafelrondlos', 'bistrotafel', 'bistroset', 'picknicktafel', 'zitbank', 'bankhalfrond', 'boombank'].filter((k) => !STENCIL_MAP[k]),
    };
  });
  assert(sil.autoHoek.every((v) => v < 40) && sil.autoMidden.every((v) => v > 150), `auto: afgeronde hoek laat de ondergrond zien (${sil.autoHoek}), de auto zelf dekt af`);
  assert(sil.tafelblad.every((v) => v > 150), 'tafel met stoelen: het tafelblad dekt af');
  assert(!sil.nieuw.length, 'nieuwe stencils: stoelen, tafels, bistroset, picknicktafel, banken (ook halfrond en boombank)');

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

  console.log('Omtrek van vlakken');
  await page.evaluate(() => window.app.setSelection(new Set(['R'])));
  assert(await page.locator('#selection-bar [data-act="stroke"]').count() === 1, 'rechthoek: knop "Omtrek aan"');
  await slide('strokeAlpha', 30);
  assert((await item('R')).strokeAlpha === 0.3, 'omtrek 30% doorzichtig met het schuifje');
  await page.click('#selection-bar [data-act="stroke"]');
  assert((await item('R')).stroke === false && /Omtrek uit/.test(await page.locator('#selection-bar [data-act="stroke"]').innerText()), 'omtrek uitgezet');
  const edgePx = await page.evaluate(async () => {
    const { drawItem } = await import('./js/items.js');
    const it = JSON.parse(JSON.stringify(window.app.store.findItem('R').item));
    const c = document.createElement('canvas'); c.width = c.height = 200;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 200);
    g.setTransform(20, 0, 0, 20, 20, 20);
    drawItem(g, { ...it, fill: null }, { doc: window.app.store.doc, scale: 100, zoom: 20, dpr: 1, minPx: 0 });
    return [...g.getImageData(20 + 4 * 20, 20, 1, 1).data].slice(0, 3); // midden van de bovenzijde (0..8, y = 0)
  });
  assert(edgePx.every((v) => v > 245), `zonder omtrek staat er geen lijn meer (${edgePx})`);
  await page.click('#selection-bar [data-act="stroke"]');
  assert((await item('R')).stroke === undefined, 'omtrek weer aan');
  await page.evaluate(() => { const a = window.app; a.setSelection(new Set()); a.state.shapeStroke = false; a.state.rectMode = 'axis'; a.setTool('rect'); });
  assert(await page.locator('#optionsbar button.toggle:has-text("Omtrek")').count() === 1, 'optiebalk van de rechthoek: schakelaar "Omtrek"');
  {
    const bx = await page.locator('#canvas').boundingBox();
    await page.mouse.move(bx.x + 700, bx.y + 300); await page.mouse.down();
    await page.mouse.move(bx.x + 820, bx.y + 380, { steps: 6 }); await page.mouse.up();
  }
  const last = await page.evaluate(() => { const it = window.app.store.doc.layers[0].items; return it[it.length - 1]; });
  assert(last.type === 'shape' && last.stroke === false, 'nieuwe rechthoek getekend zonder omtrek');
  await page.evaluate(() => { window.app.state.shapeStroke = true; });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle stijl-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
