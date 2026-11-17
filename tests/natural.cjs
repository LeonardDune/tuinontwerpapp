// Halfverharding en natuurlijke, waterdoorlatende verharding: grasbetontegels, gras- en grindplaten, brede gras- of splitvoeg.
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

  console.log('Halfverharding');
  const hv = await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { BOND_PRESETS } = await import('./js/bonds.js');
    const ids = Object.entries(BOND_PRESETS).filter(([, v]) => v.group === 'Halfverharding').map(([k]) => k);
    const d = newDoc('Halfverharding');
    d.layers[0].items.push({ type: 'shape', id: 'HV', kind: 'polygon', rect: true, points: [[0, 0], [5, 0], [5, 2], [0, 2]], color: '#333', width: 0.02, hatch: 'bond', bond: JSON.parse(JSON.stringify(BOND_PRESETS['h-kalk-geel'].bond)) });
    a.openDoc(d, true); a.cam.zoom = 100; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 150; a.cameraChanged(); a.settings.grid = false;
    a.setTool('lasso'); a.setSelection(new Set(['HV'])); a.baseDirty = true; a.render();
    // vlak zonder voegen: kleur overal dicht bij de gekozen kleur
    const p = a.cam.toScreen([0.3, 0.3]), q = a.cam.toScreen([4.7, 1.7]);
    const px = a.baseCtx.getImageData(Math.round(p[0] * a.dpr), Math.round(p[1] * a.dpr), Math.round((q[0] - p[0]) * a.dpr), Math.round((q[1] - p[1]) * a.dpr)).data;
    let far = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - 0xe3) + Math.abs(px[i + 1] - 0xd3) + Math.abs(px[i + 2] - 0xa6) > 90) far++;
    return { ids, far: far / (px.length / 4), info: document.querySelector('#selection-bar .pinfo')?.textContent, joint: !!document.querySelector('#selection-bar [data-k="bondJoint"]'), grain: !!document.querySelector('#selection-bar [data-k="bondGrain"]') };
  });
  assert(hv.ids.length >= 8 && hv.ids.includes('h-kalk-geel') && hv.ids.includes('h-schelpen'), `${hv.ids.length} bouwstenen halfverharding (o.a. verdicht kalksteen in 4 kleuren, grind, schelpen)`);
  assert(hv.far < 0.03, `verdicht kalksteen: één doorlopend oppervlak zonder voegen (${(hv.far * 100).toFixed(1)}% afwijkend)`);
  assert(/10 m² · ca\. 0,7 m³ \(laag 7 cm\)/.test(hv.info), `hoeveelheid in m³: "${hv.info}"`);
  assert(!hv.joint && hv.grain, 'balk: geen voeg of steenmaat, wel korrel');
  await page.selectOption('#selection-bar select[data-k="bondFill"]', 'schelpen');
  const hb = await page.evaluate(() => window.app.store.findItem('HV').item.bond);
  assert(hb.fill === 'schelpen' && hb.color === '#eee6d6' && !hb.grain, 'materiaal naar schelpen (met schelpkleur)');
  await page.click('#btn-paving');
  assert(/Halfverharding/.test(await page.locator('#pave-panel').innerText()), 'paneel Verharding: groep Halfverharding');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle tests natuurlijke verharding geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
