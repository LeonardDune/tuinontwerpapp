// Natuurlijke en waterdoorlatende verharding: grasbetontegels, gras- en grindplaten, brede gras- of splitvoeg.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);

  console.log('Bouwstenen');
  const ids = await page.evaluate(async () => {
    const { BOND_PRESETS } = await import('./js/bonds.js');
    return Object.entries(BOND_PRESETS).filter(([, v]) => v.group === 'Natuurlijk').map(([k]) => k);
  });
  assert(ids.length >= 8 && ids.includes('n-grasbeton') && ids.includes('n-grindplaat') && ids.includes('n-grasvoeg-klinker'), `${ids.length} bouwstenen in "Natuurlijk en waterdoorlatend"`);
  await page.click('#btn-paving');
  const pt = await page.locator('#pave-panel').innerText();
  assert(/Natuurlijk en waterdoorlatend/.test(pt) && /Grasbetontegels 60×40 met gras/.test(pt) && /Grindplaten/.test(pt), 'paneel Verharding toont de nieuwe groep');
  await page.click('#pave-panel [data-act="close"]');

  console.log('In de tekening');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { BOND_PRESETS } = await import('./js/bonds.js');
    const d = newDoc('Natuurlijk');
    const mk = (id, pre, x) => ({ type: 'shape', id, kind: 'polygon', rect: true, points: [[x, 0], [x + 2, 0], [x + 2, 2], [x, 2]], color: '#333', width: 0.02, hatch: 'bond', bond: JSON.parse(JSON.stringify(BOND_PRESETS[pre].bond)) });
    d.layers[0].items.push(mk('GB', 'n-grasbeton', 0), mk('KL', 'n-grasvoeg-klinker', 2.5), mk('GP', 'n-grindplaat', 5));
    a.openDoc(d, true); a.cam.zoom = 150; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 150; a.cameraChanged(); a.settings.grid = false;
    a.setTool('lasso');
  });
  const green = (x0) => page.evaluate((x0) => {
    const a = window.app; a.baseDirty = true; a.render();
    const p = a.cam.toScreen([x0 + 0.2, 0.2]), q = a.cam.toScreen([x0 + 1.8, 1.8]);
    const d = a.baseCtx.getImageData(Math.round(p[0] * a.dpr), Math.round(p[1] * a.dpr), Math.round((q[0] - p[0]) * a.dpr), Math.round((q[1] - p[1]) * a.dpr)).data;
    let g = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 15 && d[i + 1] > d[i + 2] + 25) g++;
    return g / (d.length / 4);
  }, x0);
  const g0 = await green(0);
  assert(g0 > 0.12 && g0 < 0.6, `grasbetontegels: beton met groene gaten (${Math.round(g0 * 100)}% groen)`);
  const gk = await green(2.5);
  assert(gk > 0.08 && gk < 0.5, `klinkers met grasvoeg: groene voegen (${Math.round(gk * 100)}% groen)`);
  const gp = await green(5);
  assert(gp < 0.02, `grindplaten met grind: niet groen (${Math.round(gp * 100)}%)`);
  await page.screenshot({ path: path.join(OUT, 'natuurlijk.png') });

  await page.evaluate(() => window.app.setSelection(new Set(['GB'])));
  assert(await page.isVisible('#selection-bar select[data-k="bondFill"]'), 'balk: keuze "Vulling" bij grasbetontegels');
  await page.selectOption('#selection-bar select[data-k="bondFill"]', 'grind');
  const gb = await page.evaluate(() => window.app.store.findItem('GB').item.bond);
  assert(gb.fill === 'grind' && gb.color2 === '#d6caae', 'vulling naar grind (met grindkleur)');
  assert(await green(0) < 0.02, 'gaten nu met grind: geen groen meer');

  await page.evaluate(() => window.app.setSelection(new Set(['KL'])));
  await page.selectOption('#selection-bar select[data-k="jointFill"]', 'split');
  let kl = await page.evaluate(() => window.app.store.findItem('KL').item.bond);
  assert(kl.jointFill === 'split', 'brede voeg naar split');
  await page.selectOption('#selection-bar select[data-k="jointFill"]', '');
  kl = await page.evaluate(() => window.app.store.findItem('KL').item.bond);
  assert(!kl.jointFill, 'voeg weer effen');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle tests natuurlijke verharding geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
