// Hekwerk tekenen als lijn, poorten die in het hek klikken, en soort wijzigen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    a.openDoc(newDoc('Hekwerk'), true); a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 100; a.cam.y = 120; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false;
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  const items = () => page.evaluate(() => JSON.parse(JSON.stringify(window.app.store.doc.layers[0].items)));

  console.log('Kiezen in het stencilvenster');
  await page.evaluate(() => { window.app.setTool('stencil'); document.querySelector('#dlg-stencils').showModal(); });
  const cat = await page.evaluate(() => { const h = [...document.querySelectorAll('#stencil-grid h3')].find((x) => x.textContent === 'Hekwerk en poorten'); return h ? [...h.nextElementSibling.querySelectorAll('.stencil-item')].map((x) => x.dataset.id) : []; });
  assert(cat.includes('hek_schutting') && cat.includes('hek_glas') && cat.includes('poort') && cat.includes('poortdubbel') && cat.includes('schuifpoort'), `categorie "Hekwerk en poorten" (${cat.length} items)`);
  await page.click('#stencil-grid .stencil-item[data-id="hek_schutting"]');
  assert(await page.evaluate(() => window.app.state.tool === 'wall' && window.app.state.fenceType === 'schutting'), 'schutting kiezen opent het tekengereedschap voor hekwerk');

  console.log('Tekenen');
  for (const [x, y] of [[0, 0], [8, 0], [8, 6]]) { const [sx, sy] = await S(x, y); await page.mouse.click(sx, sy); await page.waitForTimeout(400); }
  await page.keyboard.press('Enter');
  let f = (await items()).find((i) => i.fence);
  assert(f && f.fence === 'schutting' && f.wall && f.points.length === 3 && Math.abs(f.width - 0.05) < 1e-9 && f.height === 1.8, 'schutting met een hoek getekend (5 cm dik, 1,8 m hoog)');

  console.log('Poort');
  await page.evaluate(() => { const a = window.app; a.setTool('stencil'); a.state.stencil = 'poort'; });
  { const [sx, sy] = await S(3, 0.3); await page.mouse.click(sx, sy); }
  const gate = (await items()).find((i) => i.symbol === 'poort');
  assert(gate && gate.wallId === f.id && Math.abs(gate.y) < 1e-6, 'poort klikt in de schutting');
  await page.evaluate(() => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set()); a.fitView(true); a.render(); });
  await page.screenshot({ path: path.join(OUT, 'hekwerk.png') });

  console.log('Soort wijzigen');
  await page.evaluate((id) => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set([id])); }, f.id);
  await page.selectOption('#selection-bar select[data-k="fence"]', 'glas');
  f = (await items()).find((i) => i.id === f.id);
  assert(f.fence === 'glas' && Math.abs(f.width - 0.03) < 1e-9 && f.height === 1.0, 'omgezet naar glazen windscherm (3 cm, 1 m hoog)');
  const g2 = (await items()).find((i) => i.symbol === 'poort');
  assert(Math.abs(g2.h - 0.03) < 1e-9, 'de poort past zich aan de dikte van het hek aan');

  console.log('Opening van de poort toont de ondergrond (niet wit)');
  const gapPx = await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Poort op gras');
    d.layers[0].items.push({ type: 'shape', id: 'gras', kind: 'polygon', rect: true, points: [[-2, -2], [8, -2], [8, 2], [-2, 2]], color: '#333', width: 0.02, hatch: 'gras' });
    d.layers[0].items.push({ type: 'shape', id: 'hek', kind: 'line', wall: true, fence: 'hekje', color: '#7a6a58', width: 0.04, points: [[0, 0], [6, 0]] });
    d.layers[0].items.push({ type: 'stencil', id: 'gate', symbol: 'hekjeterras', x: 3, y: 0, w: 0.9, h: 0.04, rot: 0, color: '#2b2b2b', wallId: 'hek', wallSeg: 0, wallT: 0.5, wallSide: 1 });
    a.openDoc(d, true); a.cam.zoom = 120; a.cam.rot = 0; a.cam.x = 200; a.cam.y = 300; a.cameraChanged(); a.settings.grid = false; a.setSelection(new Set()); a.render();
    const c = document.querySelector('#canvas'); const g = c.getContext('2d'); const dpr = c.width / a.width;
    const at = (w) => { const p = a.cam.toScreen(w); return [...g.getImageData(Math.round(p[0] * dpr), Math.round(p[1] * dpr), 1, 1).data].slice(0, 3); };
    return { gap: at([3.25, -0.01]), grass: at([3.25, -0.6]) };
  });
  await page.screenshot({ path: path.join(OUT, 'poort-op-gras.png') });
  assert(Math.abs(gapPx.gap[0] - gapPx.grass[0]) + Math.abs(gapPx.gap[1] - gapPx.grass[1]) + Math.abs(gapPx.gap[2] - gapPx.grass[2]) < 40 && gapPx.gap[1] > gapPx.gap[0], `in de poortopening zie je het gras (${gapPx.gap} vs gras ${gapPx.grass})`);

  console.log('Los (niet gekoppeld) hekje op een hek: ook niet wit');
  const loosePx = await page.evaluate(() => {
    const a = window.app;
    a.store.mutate((doc) => { const gt = doc.layers[0].items.find((i) => i.id === 'gate'); delete gt.wallId; delete gt.wallSeg; delete gt.wallT; delete gt.wallSide; });
    a.render();
    const c = document.querySelector('#canvas'); const g = c.getContext('2d'); const dpr = c.width / a.width;
    const at = (w) => { const p = a.cam.toScreen(w); return [...g.getImageData(Math.round(p[0] * dpr), Math.round(p[1] * dpr), 1, 1).data].slice(0, 3); };
    return { gap: at([3.25, -0.01]), grass: at([3.25, -0.6]) };
  });
  assert(Math.abs(loosePx.gap[0] - loosePx.grass[0]) + Math.abs(loosePx.gap[1] - loosePx.grass[1]) + Math.abs(loosePx.gap[2] - loosePx.grass[2]) < 40, `ook zonder koppeling: gras in de opening (${loosePx.gap})`);

  console.log('Alle soorten tekenen');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { FENCES } = await import('./js/fences.js');
    const d = newDoc('Soorten');
    Object.entries(FENCES).forEach(([k, F], i) => d.layers[0].items.push({ type: 'shape', id: k, kind: 'line', wall: true, fence: k, color: F.color, width: F.t, points: [[0, i * 0.8], [5, i * 0.8]] }));
    d.layers[0].items.push({ type: 'shape', id: 'w', kind: 'line', wall: true, color: '#2f2f2f', width: 0.3, points: [[7, 0], [7, 8]] });
    a.openDoc(d, true); a.fitView(true); a.render();
  });
  await page.screenshot({ path: path.join(OUT, 'hekwerk-soorten.png') });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle hekwerk-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
