// Selecteren: een klein element boven een grote ondergrond (plattegrond, grind) moet te pakken zijn.
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
    const a = window.app; const { newDoc, newLayer } = await import('./js/model.js');
    const d = newDoc('Selecteren');
    const onder = d.layers[0];
    onder.name = 'Plattegrond';
    // grote ondergrond: afbeelding (plattegrond) en een groot grindvlak
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    d.assets = { plat: png };
    onder.items.push({ type: 'image', id: 'plattegrond', asset: 'plat', x: 5, y: 5, w: 20, h: 16, rot: 0.03 });
    onder.items.push({ type: 'shape', id: 'grind', kind: 'polygon', rect: true, points: [[6, 0], [11, 0], [11, 9], [6, 9]], color: '#333', width: 0.03, hatch: 'grind' });
    onder.items.push({ type: 'shape', id: 'lijn-onder', kind: 'line', points: [[7.6, 2], [7.6, 8]], color: '#333', width: 0.03 });
    const boven = newLayer('Ontwerp');
    boven.items.push({ type: 'shape', id: 'terras', kind: 'polygon', rect: true, points: [[7, 2], [9, 2], [9, 6], [7, 6]], color: '#333', width: 0.03, hatch: 'klinkers' });
    boven.items.push({ type: 'shape', id: 'lijn-boven', kind: 'line', points: [[6.5, 7], [10.5, 7]], color: '#333', width: 0.03 });
    boven.items.push({ type: 'stencil', id: 'boompje', symbol: 'heester', x: 11, y: 4, w: 1.2, h: 1.2, rot: 0, color: '#7aa64b' });
    d.layers.push(boven);
    d.activeLayer = boven.id;
    a.openDoc(d, true);
    a.cam.zoom = 50; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 80; a.cameraChanged();
    a.setTool('lasso');
  });
  const box = await page.locator('#canvas').boundingBox();
  const tap = async (wx, wy) => { const s = await page.evaluate((w) => window.app.cam.toScreen(w), [wx, wy]); await page.mouse.click(box.x + s[0], box.y + s[1]); await page.waitForTimeout(380); };
  const sel = () => page.evaluate(() => [...window.app.selection].join(','));

  console.log('Klein element boven een grote ondergrond');
  await tap(8.2, 4.5);
  assert(await sel() === 'terras', 'tik in de bruine rechthoek selecteert de rechthoek, niet de plattegrond eronder');
  await tap(2, 3);
  assert(await sel() === 'plattegrond', 'tik op een lege plek van de plattegrond selecteert de plattegrond');
  await tap(8.2, 4.5);
  assert(await sel() === 'terras', 'met de plattegrond geselecteerd: tik in de rechthoek selecteert alsnog de rechthoek');
  await tap(10, 1);
  assert(await sel() === 'grind', 'tik in het grind (buiten de rechthoek) selecteert het grind');

  console.log('Lijnen en randen');
  await tap(8, 7.05);
  assert(await sel() === 'lijn-boven', 'lijn bovenop een vlak: de lijn');
  await tap(7.6, 4);
  assert(await sel() === 'terras', 'een lijn die ónder de rechthoek ligt pakt de tik niet af');
  await tap(11, 4.3);
  assert(await sel() === 'boompje', 'stencil op de rand van het grind: het stencil');
  await page.screenshot({ path: path.join(OUT, 'selecteren-klein.png') });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle selecteer-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
