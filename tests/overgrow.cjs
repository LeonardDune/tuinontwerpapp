// Planten in een plantvak groeien over de rand heen; "Binnen de rand" knipt ze weer af.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { newRole } = await import('./js/planting.js');
    const d = newDoc('Over de rand');
    const roles = [];
    const s = newRole(roles, 'structuur'); s.height = 'hoog'; roles.push(s);
    const v = newRole(roles, 'vulling'); roles.push(v);
    d.planting = { scheme: { type: 'vrij', base: '#8e5bb5' }, roles };
    d.layers[0].items.push({ type: 'shape', id: 'V', kind: 'polygon', rect: true, bed: true, points: [[0, 0], [6, 0], [6, 2], [0, 2]], color: '#3f7a2e', width: 0.03, planting: { mix: [{ role: s.id, w: 30 }, { role: v.id, w: 60 }] } });
    d.layers[0].items.push({ type: 'shape', id: 'E', kind: 'polygon', rect: true, bed: true, points: [[0, -1.7], [3, -1.7], [3, -0.6], [0, -0.6]], color: '#3f7a2e', width: 0.03, planting: { mix: [] } });
    d.layers[0].items.push({ type: 'shape', id: 'G', kind: 'polygon', group: true, bedId: 'V', points: [[4, 0.2], [5.8, 0.2], [5.8, 1.8], [4, 1.8]], color: '#3f7a2e', width: 0.02, planting: { mix: [{ role: s.id, w: 100 }] } });
    a.openDoc(d, true); a.cam.zoom = 120; a.cam.rot = 0; a.cam.x = 120; a.cam.y = 250; a.cameraChanged();
    a.settings.grid = false; a.render();
  });
  await page.waitForTimeout(300);
  // hoeveel "planten" (gekleurde pixels) liggen er in een strook net buiten het vak?
  const outside = () => page.evaluate(() => {
    const a = window.app; a.render();
    const c = document.querySelector('#canvas'); const g = c.getContext('2d'); const dpr = c.width / a.width;
    const p0 = a.cam.toScreen([0, -0.25]), p1 = a.cam.toScreen([6, -0.03]);
    const d = g.getImageData(Math.round(p0[0] * dpr), Math.round(p0[1] * dpr), Math.round((p1[0] - p0[0]) * dpr), Math.round((p1[1] - p0[1]) * dpr)).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[i + 1]) + Math.abs(d[i + 1] - d[i + 2]) > 30) n++;
    return n;
  });
  const free = await outside();
  await page.screenshot({ path: path.join(OUT, 'over-de-rand.png') });
  assert(free > 200, `planten groeien over de rand van het vak (${free} pixels buiten het vak)`);
  await page.evaluate(() => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set(['V'])); });
  await page.click('#selection-bar [data-act="clipPlants"]');
  await page.evaluate(() => window.app.setSelection(new Set()));
  const clipped = await outside();
  assert(clipped < free / 10, `"Binnen de rand": strak binnen het vak (${clipped} pixels)`);
  assert(await page.evaluate(() => window.app.store.findItem('V').item.clipPlants) === true, 'instelling bewaard bij het vak');

  console.log('Ondergrond');
  const avg = () => page.evaluate(() => {
    const a = window.app; a.setSelection(new Set()); a.render();
    const c = document.querySelector('#canvas'); const g = c.getContext('2d'); const dpr = c.width / a.width;
    const p0 = a.cam.toScreen([0.5, -1.5]), p1 = a.cam.toScreen([2.5, -0.8]);
    const d = g.getImageData(Math.round(p0[0] * dpr), Math.round(p0[1] * dpr), Math.round((p1[0] - p0[0]) * dpr), Math.round((p1[1] - p0[1]) * dpr)).data;
    let r = 0, gg = 0, bb = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; }
    return [r / n, gg / n, bb / n].map(Math.round);
  });
  const soil = await avg();
  assert(soil[0] > soil[2] + 25 && soil[0] < 215, `leeg plantvak is aardekleurig, niet wit (rgb ${soil})`);
  await page.screenshot({ path: path.join(OUT, 'plantvak-aarde.png') });
  await page.evaluate(() => window.app.setSelection(new Set(['E'])));
  await page.selectOption('#selection-bar select[data-k="soil"]', 'licht');
  const light = await avg();
  assert(light[0] > 225 && await page.evaluate(() => window.app.store.findItem('E').item.soil) === 'licht', `ondergrond "Licht": weer zoals vroeger (rgb ${light})`);
  await page.evaluate(() => window.app.setSelection(new Set(['E'])));
  await page.selectOption('#selection-bar select[data-k="soil"]', 'schors');
  assert(await page.evaluate(() => window.app.store.findItem('E').item.soil) === 'schors', 'ondergrond boomschors');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle over-de-rand-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
