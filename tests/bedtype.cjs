// Type plantvak voor de ruwe schets: bodembedekkers, laag, middelhoog, hoog, heesters.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    a.openDoc(newDoc('Schets'), true); a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 150; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false;
    a.state.plantMode = 'vak'; a.state.plantShape = 'rechthoek'; a.setTool('plant');
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);

  console.log('Nieuw plantvak met een type');
  assert(await page.locator('#optionsbar select').count() >= 1, 'keuze "Type" in de balk bij Plantvak');
  await page.selectOption('#optionsbar select[title^="Type plantvak"]', 'hoog');
  {
    const [x0, y0] = await S(0, 0), [x1, y1] = await S(4, 3);
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  }
  let bed = await page.evaluate(() => window.app.store.doc.layers[0].items.find((i) => i.bed));
  assert(bed && bed.btype === 'hoog' && !bed.planting.mix.length, 'plantvak getekend als "Hoge beplanting", nog zonder planten');

  console.log('Type wijzigen en overzicht');
  await page.evaluate((id) => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set([id])); }, bed.id);
  await page.selectOption('#selection-bar select[data-k="btype"]', 'bodem');
  bed = await page.evaluate((id) => window.app.store.findItem(id).item, bed.id);
  assert(bed.btype === 'bodem', 'type gewijzigd naar bodembedekkers');
  await page.evaluate(() => { window.app.setSelection(new Set()); window.app.plantPanel.open(); });
  const sk = await page.locator('#plant-panel .sketch').innerText();
  assert(/Bodembedekkers/.test(sk) && /12 m²/.test(sk), `paneel: oppervlakte per soort ("${sk.split('\n')[0]}")`);
  await page.screenshot({ path: path.join(OUT, 'plantvak-type.png') });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle plantvak-type-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
