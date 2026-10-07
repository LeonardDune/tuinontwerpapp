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

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle bestratings-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
