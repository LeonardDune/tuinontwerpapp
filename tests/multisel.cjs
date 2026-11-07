// Meerdere elementen selecteren: Shift/Ctrl/Cmd + tik, de knop "Meer selecteren", en omcirkelen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }
const R = (id, x0, y0, x1, y1, extra = {}) => ({ type: 'shape', id, kind: 'polygon', rect: true, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], color: '#333', width: 0.04, fill: '#7a9a5a', fillAlpha: 0.3, ...extra });

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async (items) => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Selecteren'); d.layers[0].items.push(...items);
    a.openDoc(d, true); a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 250; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.state.selAdd = false;
    a.setTool('lasso');
  }, [R('A', 0, 0, 1, 1), R('B', 2, 0, 3, 1), R('C', 4, 0, 5, 1), R('D', 6, 0, 7, 1, { gid: 'g1' }), R('E', 8, 0, 9, 1, { gid: 'g1' })]);
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  const sel = () => page.evaluate(() => [...window.app.selection].sort().join());
  const click = async (x, y, mod) => { const [sx, sy] = await S(x, y); if (mod) await page.keyboard.down(mod); await page.mouse.click(sx, sy); if (mod) await page.keyboard.up(mod); await page.waitForTimeout(400); };

  console.log('Met toetsen');
  await click(0.5, 0.5);
  await click(2.5, 0.5, 'Shift');
  assert(await sel() === 'A,B', 'Shift + tik voegt toe');
  await click(4.5, 0.5, 'Control');
  assert(await sel() === 'A,B,C', 'Ctrl + tik voegt toe');
  await click(2.5, 0.5, 'Meta');
  assert(await sel() === 'A,C', 'Cmd + tik op een geselecteerd element haalt het eruit');
  await click(6.5, 0.5, 'Shift');
  assert(await sel() === 'A,C,D,E', 'groep komt er in zijn geheel bij');
  {
    const [x0, y0] = await S(0.5, 0.5), [x1, y1] = await S(0.5, 1.5);
    await page.keyboard.down('Shift');
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 5 }); await page.mouse.up();
    await page.keyboard.up('Shift');
  }
  const moved = await page.evaluate(() => ['A', 'C', 'D'].map((id) => window.app.store.findItem(id).item.points[0][1]));
  assert(moved.every((y) => Math.abs(y - 1) < 1e-6) && await sel() === 'A,C,D,E', 'met Shift slepen op de selectie verschuift alles samen');
  await page.click('#btn-undo');

  console.log('Knop "Meer selecteren" (iPad)');
  await page.evaluate(() => window.app.setSelection(new Set()));
  await page.click('#optionsbar button:has-text("Meer selecteren")');
  await click(0.5, 0.5); await click(4.5, 0.5);
  assert(await sel() === 'A,C', 'met de knop aan: tikken voegt toe');
  await click(0.5, 0.5);
  assert(await sel() === 'C', 'nog eens tikken haalt eruit');
  await click(3.5, 3);
  assert(await sel() === 'C', 'tik op een lege plek laat de selectie staan');
  await page.click('#optionsbar button:has-text("Meer selecteren")');
  await click(2.5, 0.5);
  assert(await sel() === 'B', 'knop uit: tik selecteert alleen dat element');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle meer-selecteren-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
