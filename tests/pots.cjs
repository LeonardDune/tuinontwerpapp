// Planten in potten en bakken: stencils, kiezen in het venster, dicht en kleur van de pot.
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
  const ids = ['potrond', 'potvierkant', 'potbol', 'potgras', 'potbloei', 'potboom', 'plantenbak', 'potgroep'];

  console.log('Stencilvenster');
  await page.evaluate(() => window.app.setTool('stencil'));
  await page.evaluate(() => document.querySelector('#dlg-stencils').showModal());
  const inCat = await page.evaluate(() => {
    const h = [...document.querySelectorAll('#stencil-grid h3')].find((x) => x.textContent === 'Potten & bakken');
    return h ? [...h.nextElementSibling.querySelectorAll('.stencil-item')].map((x) => x.dataset.id) : [];
  });
  assert(ids.every((id) => inCat.includes(id)), `categorie "Potten & bakken" met ${inCat.length} stencils`);
  await page.locator('#stencil-grid h3:has-text("Potten & bakken")').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'potten-venster.png') });
  await page.evaluate(() => document.querySelector('#dlg-stencils').close());

  console.log('Tekenen');
  await page.evaluate(async (ids) => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { STENCIL_MAP } = await import('./js/stencils.js');
    const d = newDoc('Potten');
    d.layers[0].items.push({ type: 'shape', id: 'terras', kind: 'polygon', rect: true, points: [[-0.5, -0.5], [9.5, -0.5], [9.5, 2.5], [-0.5, 2.5]], color: '#333', width: 0.03, hatch: 'tegels' });
    ids.forEach((id, k) => { const s = STENCIL_MAP[id]; d.layers[0].items.push({ type: 'stencil', id: 'p' + k, symbol: id, x: 0.6 + k * 1.15, y: 1, w: s.w, h: s.h, rot: 0, color: s.color }); });
    a.openDoc(d, true); a.cam.zoom = 110; a.cam.rot = 0; a.cam.x = 80; a.cam.y = 300; a.cameraChanged(); a.render();
  }, ids);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'potten.png') });
  // de pot is dicht: in het midden van een pot zie je de tegels er niet doorheen
  const covered = await page.evaluate(() => {
    const a = window.app; const c = document.querySelector('#canvas'); const g = c.getContext('2d');
    const p = a.cam.toScreen([0.6 + 0.2, 1]); const dpr = c.width / a.width;
    return [...g.getImageData(Math.round(p[0] * dpr), Math.round(p[1] * dpr), 1, 1).data];
  });
  assert(covered[3] === 255, 'pot dekt de bestrating eronder af');

  console.log('Kleur van de pot');
  await page.evaluate(() => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set(['p0'])); });
  assert(await page.locator('#selection-bar [data-k="color"]').count() === 1, 'lijnkleur (pot) aanpasbaar');
  await page.evaluate(() => { const i = document.querySelector('#selection-bar input[data-k="color"]'); i.value = '#55595e'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  assert(await page.evaluate(() => window.app.store.findItem('p0').item.color) === '#55595e', 'pot antraciet gemaakt');

  console.log('Beplanting');
  const roles = await page.evaluate(async () => {
    const a = window.app; const { STENCIL_MAP } = await import('./js/stencils.js');
    a.setTool('stencil'); a.state.stencil = 'potboom';
    const box = document.querySelector('#canvas').getBoundingClientRect();
    return { box: [box.x, box.y], def: STENCIL_MAP.potboom.w };
  });
  const p = await page.evaluate(() => window.app.cam.toScreen([5, 3.2]));
  await page.mouse.click(roles.box[0] + p[0], roles.box[1] + p[1]);
  const placed = await page.evaluate(() => { const a = window.app; const it = a.store.doc.layers[0].items.at(-1); return { sym: it.symbol, role: it.role, roles: (a.store.doc.planting?.roles || []).map((r) => r.label) }; });
  assert(placed.sym === 'potboom' && placed.role && placed.roles.includes('Pot met boompje (olijf)'), 'boompje in pot komt als bouwsteen in de beplanting');

  console.log('Kliko');
  const bins = await page.evaluate(async () => { const { STENCIL_MAP } = await import('./js/stencils.js'); return ['kliko', 'kliko140', 'kliko3'].map((id) => STENCIL_MAP[id] && [STENCIL_MAP[id].w, STENCIL_MAP[id].h]); });
  assert(bins.every(Boolean) && bins[0][0] === 0.58 && bins[0][1] === 0.74, 'kliko 240 L (58 × 74 cm), 140 L en een rij van drie');

  console.log('Schuur met groen dak');
  const sheds = await page.evaluate(async () => { const { STENCIL_MAP } = await import('./js/stencils.js'); const { HATCHES } = await import('./js/patterns.js'); return [!!STENCIL_MAP.schuurgroen, !!STENCIL_MAP.schuurmos, !!HATCHES.sedum]; });
  assert(sheds.every(Boolean), 'schuur met sedumdak, schuurtje met mosdak en materiaal "Groen dak (sedum)"');

  console.log('Water');
  const water = await page.evaluate(async () => { const { STENCILS } = await import('./js/stencils.js'); return STENCILS.filter((x) => x.cat === 'Water').map((x) => x.id); });
  assert(['waterschaal', 'waterzuil', 'watertafel', 'waterbak', 'waterwand', 'fontein', 'vijverrond', 'vijverrecht', 'vogelbad'].every((id) => water.includes(id)), `categorie Water met ${water.length} ornamenten`);

  console.log('Losse flagstones');
  const fl = await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { STENCILS } = await import('./js/stencils.js');
    const d = newDoc('Flag'); d.layers[0].items.push({ type: 'stencil', id: 'F', symbol: 'flagstone', x: 0, y: 0, w: 0.6, h: 0.45, rot: 0, color: '#c9c0ae', seed: 5 });
    a.openDoc(d, true); a.setTool('lasso'); a.setSelection(new Set(['F']));
    return STENCILS.filter((x) => x.cat === 'Stapstenen').map((x) => x.id);
  });
  assert(['flagstone', 'flagstoneklein', 'flagstonegroot', 'flagstonegeel', 'flagstonepad', 'stapsteen'].every((id) => fl.includes(id)), `categorie Stapstenen (${fl.length})`);
  await page.click('#selection-bar [data-act="reshape"]');
  assert(await page.evaluate(() => window.app.store.findItem('F').item.seed) !== 5, '"Andere vorm" geeft de steen een nieuwe vorm');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle pot-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
