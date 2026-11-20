// Beplanting als impressie: planten getekend naar groeivorm en bloeivorm, met de maand; symbolen als aparte weergave.
const { chromium } = require('playwright');
const path = require('path');
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
    const a = window.app; const { newDoc } = await import('./js/model.js'); const P = await import('./js/planting.js');
    const d = newDoc('Impressie'); const roles = [];
    const r = P.newRole(roles, 'vulling'); Object.assign(r, { label: 'Kattenkruid', height: 'laag', habit: 'kussen', form: 'aar', color: '#5a4fd8', bloom: [5, 6, 7, 8], foliage: 'groen', winter: 'weg' }); roles.push(r);
    d.planting = { scheme: { type: 'vrij', base: '#8e5bb5' }, roles };
    d.layers[0].items.push({ type: 'shape', id: 'V', kind: 'polygon', rect: true, bed: true, planting: { mix: [{ role: r.id, w: 100 }] }, points: [[0, 0], [4, 0], [4, 3], [0, 3]], color: '#3f7a2e', width: 0.03 });
    d.layers[0].items.push({ type: 'shape', id: 'S', kind: 'polygon', rect: true, bed: true, btype: 'middel', planting: { mix: [] }, points: [[5, 0], [9, 0], [9, 3], [5, 3]], color: '#3f7a2e', width: 0.03 });
    a.openDoc(d, true); a.cam.zoom = 110; a.cam.rot = 0; a.cam.x = 60; a.cam.y = 80; a.cameraChanged(); a.settings.grid = false;
  });
  const sample = (x0, x1) => page.evaluate(([x0, x1]) => {
    const a = window.app; a.baseDirty = true; a.render();
    const p = a.cam.toScreen([x0 + 0.3, 0.3]), q = a.cam.toScreen([x1 - 0.3, 2.7]);
    const d = a.baseCtx.getImageData(Math.round(p[0] * a.dpr), Math.round(p[1] * a.dpr), Math.round((q[0] - p[0]) * a.dpr), Math.round((q[1] - p[1]) * a.dpr)).data;
    let blue = 0, green = 0; const set = new Set();
    for (let i = 0; i < d.length; i += 4) { set.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); if (d[i + 2] > d[i] + 50 && d[i + 2] > d[i + 1] + 40) blue++; if (d[i + 1] > d[i] + 10 && d[i + 1] > d[i + 2] + 10) green++; }
    const n = d.length / 4; return { blue: blue / n, green: green / n, tones: set.size };
  }, [x0, x1]);

  console.log('Weergaven');
  await page.click('#btn-planting');
  const views = await page.evaluate(() => [...document.querySelectorAll('#plant-panel [data-view]')].map((b) => b.dataset.view).join());
  assert(views === 'planten,symbolen,groepen', 'paneel: Impressie, Symbolen en Groepen');
  const imp = await sample(0, 4);
  assert(imp.tones > 120 && imp.green > 0.25, `impressie: blad in veel tinten (${imp.tones} tinten, ${Math.round(imp.green * 100)}% groen)`);
  assert(imp.blue > 0.03, `bloeiende aren in de bloeikleur te zien (${(imp.blue * 100).toFixed(1)}%)`);
  await page.click('#plant-panel [data-view="symbolen"]');
  const sym = await sample(0, 4);
  assert(sym.tones < imp.tones * 0.7, `symbolen: technisch en vlakker (${sym.tones} tinten)`);
  await page.click('#plant-panel [data-view="planten"]');

  console.log('Maanden');
  await page.evaluate(() => window.app.plantPanel.setMonth(1));
  const jan = await sample(0, 4);
  assert(jan.blue < 0.005 && jan.green < 0.05, 'januari: kattenkruid is bovengronds weg');
  await page.evaluate(() => window.app.plantPanel.setMonth(6));
  const jun = await sample(0, 4);
  assert(jun.blue > 0.03, 'juni: in bloei');
  await page.evaluate(() => window.app.plantPanel.setMonth(null));

  console.log('Schets');
  const sk = await sample(5, 9);
  assert(sk.green > 0.35 && sk.tones > 60, `schets "middelhoog": plantmassa's in groentinten (${Math.round(sk.green * 100)}% groen, ${sk.tones} tinten)`);
  await page.screenshot({ path: path.join(OUT, 'impressie.png') });

  console.log('Stencils');
  const st = await page.evaluate(async () => {
    const { drawStencil } = await import('./js/stencils.js');
    const c = document.createElement('canvas'); c.width = 100; c.height = 100; const g = c.getContext('2d');
    const out = {};
    for (const id of ['vp_aar', 'vp_kussen', 'siergras', 'varen', 'heester']) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100); g.setTransform(160, 0, 0, 160, 50, 50);
      drawStencil(g, { type: 'stencil', symbol: id, x: 0, y: 0, w: 0.55, h: 0.55, rot: 0, color: '#7b5ab5' }, 0.004, '#ffffff');
      const d = g.getImageData(0, 0, 100, 100).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
      out[id] = set.size;
    }
    return out;
  });
  assert(Object.values(st).every((v) => v > 30), `plantstencils getekend als dezelfde impressie (${Object.entries(st).map(([k, v]) => `${k} ${v}`).join(', ')} tinten)`);

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle impressie-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
