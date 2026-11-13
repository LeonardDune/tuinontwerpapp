// Vaste planten per bloeivorm: stencils, bloemkleur aanpassen en bouwsteen in de beplanting.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  const ids = await page.evaluate(async () => { const { STENCILS } = await import('./js/stencils.js'); return STENCILS.filter((s) => s.cat === 'Vaste planten').map((s) => s.id); });
  assert(['vasteplant', 'vp_aar', 'vp_knop', 'vp_pluim', 'vp_scherm', 'vp_schijf', 'vp_kussen', 'vp_blad', 'varen', 'vp_zwaard', 'bolgewas'].every((id) => ids.includes(id)), `categorie "Vaste planten" met ${ids.length} soorten`);
  await page.evaluate(async (ids) => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { STENCIL_MAP } = await import('./js/stencils.js');
    const d = newDoc('Vaste planten');
    ids.forEach((id, k) => { const s = STENCIL_MAP[id]; d.layers[0].items.push({ type: 'stencil', id: 'v' + k, symbol: id, x: k * 0.9, y: 0, w: s.w, h: s.h, rot: 0, color: s.color }); });
    a.openDoc(d, true); a.cam.zoom = 120; a.cam.rot = 0; a.cam.x = 100; a.cam.y = 300; a.cameraChanged(); a.render();
  }, ids);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'vaste-planten.png') });

  console.log('Bloemkleur');
  await page.evaluate(() => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set(['v5'])); });
  await page.evaluate(() => { const i = document.querySelector('#selection-bar input[data-k="color"]'); i.value = '#c0392b'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  assert(await page.evaluate(() => window.app.store.findItem('v5').item.color) === '#c0392b', 'bloemkleur aangepast via Kleur');

  console.log('Beplanting');
  const box = await page.locator('#canvas').boundingBox();
  await page.evaluate(() => { const a = window.app; a.setTool('stencil'); a.state.stencil = 'vp_aar'; });
  const p = await page.evaluate(() => window.app.cam.toScreen([2, 2]));
  await page.mouse.click(box.x + p[0], box.y + p[1]);
  const r = await page.evaluate(() => { const a = window.app; const it = a.store.doc.layers[0].items.at(-1); const role = a.store.doc.planting.roles.find((x) => x.id === it.role); return role && { form: role.form, role: role.role }; });
  assert(r && r.form === 'aar' && r.role === 'structuur', 'aar wordt een bouwsteen met bloeivorm "aar" (structuur)');

  console.log('Leibomen');
  const lei = await page.evaluate(async () => { const { STENCILS } = await import('./js/stencils.js'); const { isPlantStencil } = await import('./js/planting.js'); return STENCILS.filter((x) => ['leifruitmuur', 'leifruitrek', 'leiboom', 'dakleiboom', 'fruitsnoer'].includes(x.id)).map((x) => x.cat === 'Bomen' && isPlantStencil(x.id)); });
  assert(lei.length === 5 && lei.every(Boolean), 'vijf leibomen bij Bomen, elk een bouwsteen in de beplanting');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle vaste-planten-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
