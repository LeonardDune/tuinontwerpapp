// Stencils plaatsen: aansluiten en evenwijdig aan zijden, daarna meteen geselecteerd; of meerdere achter elkaar.
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
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Plaatsen');
    // terras dat 20° gedraaid ligt
    const r = 20 * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const P = (x, y) => [x * c - y * s, x * s + y * c];
    d.layers[0].items.push({ type: 'shape', id: 'T', kind: 'polygon', rect: true, points: [P(0, 0), P(6, 0), P(6, 4), P(0, 4)], color: '#333', width: 0.03, hatch: 'tegels' });
    a.openDoc(d, true); a.cam.zoom = 70; a.cam.rot = 0; a.cam.x = 300; a.cam.y = 200; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = true; a.settings.grid = false; a.state.stencilRepeat = false;
    a.state.stencil = 'schuur'; a.setTool('stencil');
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);

  console.log('Voorbeeld en aansluiten');
  // een schuur (3 × 2,5 m) vlak naast de rechterzijde van het terras
  const r = 20 * Math.PI / 180;
  const near = [6 * Math.cos(r) - 2 * Math.sin(r) + Math.cos(r) * 1.6, 6 * Math.sin(r) + 2 * Math.cos(r) + Math.sin(r) * 1.6];
  const [sx, sy] = await S(...near);
  await page.mouse.move(sx - 40, sy); await page.mouse.move(sx, sy, { steps: 4 });
  const ghost = await page.evaluate(() => !!window.app.tool.ghost && window.app.tool.liveInfo);
  await page.screenshot({ path: path.join(OUT, 'plaatsen-aansluiten.png') });
  assert(ghost && /Sluit aan/.test(ghost), `met de muis: voorbeeld dat al aansluit ("${ghost}")`);
  await page.mouse.down(); await page.mouse.up();
  const it = await page.evaluate(() => { const a = window.app; const i = a.store.doc.layers[0].items.find((x) => x.symbol === 'schuur'); return i && JSON.parse(JSON.stringify(i)); });
  const deg = ((it.rot * 180 / Math.PI) % 90 + 90) % 90;
  assert(Math.abs(deg - 20) < 1e-6, `schuur evenwijdig aan het terras gedraaid (${deg.toFixed(3)}°)`);
  // afstand van het midden van de schuur tot de rechterzijde van het terras = halve breedte of halve diepte
  const a0 = [6 * Math.cos(r), 6 * Math.sin(r)], a1 = [6 * Math.cos(r) - 4 * Math.sin(r), 6 * Math.sin(r) + 4 * Math.cos(r)];
  const dl = Math.abs((a1[0] - a0[0]) * (it.y - a0[1]) - (a1[1] - a0[1]) * (it.x - a0[0])) / 4;
  assert(Math.abs(dl - 1.5) < 1e-3 || Math.abs(dl - 1.25) < 1e-3, `precies tegen de zijde aan (${dl.toFixed(4)} m van de rand tot het midden)`);

  console.log('Meteen geselecteerd');
  assert(await page.evaluate(() => window.app.state.tool === 'lasso' && [...window.app.selection][0]) === it.id, 'na plaatsen: Selecteren, met het nieuwe element geselecteerd');
  await page.fill('#selection-bar input[data-k="w"]', '4');
  await page.press('#selection-bar input[data-k="w"]', 'Enter');
  assert(Math.abs(await page.evaluate((id) => window.app.store.findItem(id).item.w, it.id) - 4) < 1e-6, 'breedte direct aangepast in de balk');

  console.log('Meerdere plaatsen');
  await page.evaluate(() => { const a = window.app; a.state.stencilRepeat = true; a.state.stencil = 'heester'; a.setTool('stencil'); });
  for (const x of [-0.5, -1.5, -2.5]) { const [px, py] = await S(x, -2.2); await page.mouse.click(px, py); await page.waitForTimeout(80); }
  const n = await page.evaluate(() => window.app.store.doc.layers[0].items.filter((i) => i.symbol === 'heester').length);
  assert(n === 3 && await page.evaluate(() => window.app.state.tool) === 'stencil', '"Meerdere plaatsen" aan: elke tik een nieuwe, gereedschap blijft');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle plaats-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
