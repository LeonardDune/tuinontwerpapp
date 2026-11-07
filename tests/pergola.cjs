// Pergola's en overkappingen in varianten, begroeid met klimplanten, en losse klimplanten.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  const cat = await page.evaluate(async () => { const { STENCILS } = await import('./js/stencils.js'); return STENCILS.filter((s) => s.cat === 'Pergola\'s & klimplanten').map((s) => s.id); });
  assert(['overkapping', 'pergolagang', 'pergolamuur', 'pergolalatten', 'lamellendak', 'veranda', 'verandaterras', 'rozenboog', 'klimplant'].every((id) => cat.includes(id)), `categorie "Pergola's & klimplanten" (${cat.length} stencils)`);

  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { STENCIL_MAP } = await import('./js/stencils.js');
    const d = newDoc('Pergola'); const L = d.layers[0].items;
    const put = (id, x, y, extra = {}) => { const s = STENCIL_MAP[id]; L.push({ type: 'stencil', id: id + x + y, symbol: id, x, y, w: s.w, h: s.h, rot: 0, color: s.color, ...(s.defaults || {}), ...extra }); };
    put('overkapping', 0, 0); put('pergolamuur', 5, 0); put('pergolalatten', 10, 0); put('lamellendak', 15, 0); put('veranda', 20, 0); put('verandaterras', 25.5, 0);
    put('overkapping', 0, 4.5, { grow: 'vol', growKind: 'blauweregen' }); put('pergolamuur', 5, 4.5, { grow: 'deels', growKind: 'roos' }); put('pergolalatten', 10, 4.5, { grow: 'vol', growKind: 'druif' }); put('pergolagang', 17, 4.5, { grow: 'deels', growKind: 'groen' });
    put('rozenboog', 0, 8); put('klimplant', 4, 8); put('klimplant', 8, 8, { growKind: 'clematis' }); put('klimplant', 12, 8, { growKind: 'herfst' });
    a.openDoc(d, true); a.cam.zoom = 45; a.cam.rot = 0; a.cam.x = 120; a.cam.y = 200; a.cameraChanged(); a.render();
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'pergolas.png') });

  console.log('Begroeiing instellen');
  await page.evaluate(() => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set(['overkapping00'])); });
  assert(await page.locator('#selection-bar select[data-k="grow"]').count() === 1 && await page.locator('#selection-bar select[data-k="growKind"]').count() === 0, 'kale pergola: keuze voor begroeiing, nog geen soort');
  await page.selectOption('#selection-bar select[data-k="grow"]', 'vol');
  await page.selectOption('#selection-bar select[data-k="growKind"]', 'kamperfoelie');
  const it = await page.evaluate(() => window.app.store.findItem('overkapping00').item);
  assert(it.grow === 'vol' && it.growKind === 'kamperfoelie', 'helemaal begroeid met kamperfoelie');
  await page.click('#btn-undo');
  assert(await page.evaluate(() => window.app.store.findItem('overkapping00').item.growKind) === undefined, 'ongedaan maken werkt');
  await page.evaluate(() => { window.app.setSelection(new Set(['lamellendak150'])); });
  assert(await page.locator('#selection-bar select[data-k="grow"]').count() === 0, 'lamellendak: geen begroeiing');
  await page.evaluate(() => { window.app.setSelection(new Set(['klimplant48'])); });
  assert(await page.locator('#selection-bar select[data-k="growKind"]').count() === 1, 'losse klimplant: soort kiezen');

  console.log('Plaatsen');
  const box = await page.locator('#canvas').boundingBox();
  await page.evaluate(() => { const a = window.app; a.setTool('stencil'); a.state.stencil = 'rozenboog'; });
  const p = await page.evaluate(() => window.app.cam.toScreen([16, 8]));
  await page.mouse.click(box.x + p[0], box.y + p[1]);
  const placed = await page.evaluate(() => window.app.store.doc.layers[0].items.at(-1));
  assert(placed.symbol === 'rozenboog' && placed.grow === 'vol' && placed.growKind === 'roos', 'rozenboog komt meteen begroeid met een klimroos');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle pergola-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
