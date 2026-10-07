// Bestrating en halfverharding: materiaalpatronen, legrichting en cirkelverband.
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
  const keys = await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { HATCHES } = await import('./js/patterns.js');
    const d = newDoc('Bestrating');
    const keys = Object.keys(HATCHES).filter((k) => k !== 'none');
    keys.forEach((k, i) => {
      const x = (i % 6) * 3.4, y = Math.floor(i / 6) * 3.4;
      d.layers[0].items.push({ type: 'shape', id: k, kind: 'polygon', rect: true, points: [[x, y], [x + 3, y], [x + 3, y + 2.6], [x, y + 2.6]], color: '#333', width: 0.03, hatch: k });
    });
    a.openDoc(d, true); a.cam.zoom = 50; a.cam.rot = 0; a.cam.x = 40; a.cam.y = 30; a.cameraChanged(); a.render();
    return keys;
  });
  console.log('Materialen');
  assert(keys.length >= 25, `${keys.length} materialen beschikbaar`);
  for (const k of ['keramiek120', 'houtlook', 'visgraat', 'bredevoeg', 'kinderkopjes', 'flagstones', 'romaans', 'grastegels', 'cirkel', 'split', 'schelpen', 'houtsnippers']) assert(keys.includes(k), `materiaal ${k}`);
  const groups = await page.evaluate(async () => { const { hatchOptions } = await import('./js/patterns.js'); const d = document.createElement('select'); d.innerHTML = hatchOptions('klinkers'); return [...d.querySelectorAll('optgroup')].map((g) => g.label); });
  assert(['Bestrating', 'Halfverharding', 'Hout', 'Groen en water'].every((g) => groups.includes(g)), 'keuzelijst ingedeeld in groepen');
  await page.screenshot({ path: path.join(OUT, 'bestrating.png') });

  console.log('Legrichting');
  const ang = await page.evaluate(async () => {
    const { hatchAngle } = await import('./js/items.js');
    const a = window.app;
    const it = a.store.findItem('keramiek120').item;
    const before = hatchAngle(it);
    a.setTool('lasso'); a.setSelection(new Set(['keramiek120']));
    a.applyProperty('rotby', '30');
    const afterRot = hatchAngle(a.store.findItem('keramiek120').item);
    return { before, afterRot };
  });
  assert(Math.abs(ang.before) < 1e-9 && Math.abs(ang.afterRot + 30 * Math.PI / 180) < 1e-6, 'tegels volgen de richting van de (gedraaide) rechthoek');
  await page.fill('#selection-bar input[data-k="hatchRot"]', '45');
  await page.press('#selection-bar input[data-k="hatchRot"]', 'Enter');
  const hr = await page.evaluate(() => window.app.store.findItem('keramiek120').item.hatchRot);
  assert(Math.abs(hr + Math.PI / 4) < 1e-9, 'legrichting exact in te stellen (45°)');

  console.log('Voegkleur en materiaalkleur');
  await page.evaluate(() => window.app.setSelection(new Set(['bredevoeg'])));
  assert(await page.locator('#selection-bar input[data-k="hatchColor"]').count() === 1 && await page.locator('#selection-bar input[data-k="matColor"]').count() === 1, 'balk heeft Voeg en Materiaal');
  const setColor = (k, v) => page.evaluate(({ k, v }) => { const i = document.querySelector(`#selection-bar input[data-k="${k}"]`); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }, { k, v });
  await setColor('hatchColor', '#e8d9a8');
  await setColor('matColor', '#5a2a1e');
  const it = await page.evaluate(() => JSON.parse(JSON.stringify(window.app.store.findItem('bredevoeg').item)));
  assert(it.hatchColor === '#e8d9a8' && it.matColor === '#5a2a1e', 'zandkleurige voeg en donkere klinkers ingesteld');
  const counts = await page.evaluate(async (it) => {
    const { drawItem } = await import('./js/items.js');
    const c = document.createElement('canvas'); c.width = c.height = 300;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 300, 300);
    const x0 = it.points[0][0], y0 = it.points[0][1];
    g.setTransform(300, 0, 0, 300, -x0 * 300 - 30, -y0 * 300 - 30); // 300 px per meter, stukje van 1 × 1 m
    drawItem(g, it, { doc: window.app.store.doc, scale: 100, zoom: 300, dpr: 1, minPx: 0 });
    const d = g.getImageData(0, 0, 300, 300).data;
    let light = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] > 185 && d[i + 2] > 140 && d[i + 2] < 200) light++;
      if (d[i] < 120 && d[i + 1] < 80) dark++;
    }
    return { light, dark, n: d.length / 4 };
  }, it);
  assert(counts.light > counts.n * 0.05 && counts.dark > counts.n * 0.4, `voeg (licht) en klinkers (donker) beide te zien (${Math.round(counts.light / counts.n * 100)}% voeg, ${Math.round(counts.dark / counts.n * 100)}% klinker)`);
  await page.screenshot({ path: path.join(OUT, 'brede-voeg.png') });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle bestratings-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
