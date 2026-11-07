// Slimme hulplijnen bij verplaatsen, schalen en draaien.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }
const R = (id, x0, y0, x1, y1, extra = {}) => ({ type: 'shape', id, kind: 'polygon', rect: true, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], color: '#333', width: 0.04, fill: '#7a9a5a', fillAlpha: 0.3, ...extra });
const rot = (pts, deg, c) => pts.map(([x, y]) => { const r = deg * Math.PI / 180, dx = x - c[0], dy = y - c[1]; return [c[0] + dx * Math.cos(r) - dy * Math.sin(r), c[1] + dx * Math.sin(r) + dy * Math.cos(r)]; });

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  const setup = (items, sel) => page.evaluate(async ([items, sel]) => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Hulplijnen'); d.layers[0].items.push(...items);
    a.openDoc(d, true); a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 250; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = true; a.settings.grid = false;
    a.setTool('lasso'); a.setSelection(new Set([sel]));
  }, [items, sel]);
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  const pts = (id) => page.evaluate((id) => window.app.store.findItem(id).item.points, id);
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  console.log('Uitlijnen en gelijke tussenruimte');
  await setup([R('A', 0, 0, 2, 1), R('B', 3, 0, 5, 1), R('C', 6.3, 0.2, 8.3, 1.2)], 'C');
  let [x0, y0] = await S(7.3, 0.7), [x1, y1] = await S(7.05, 0.55);
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 8 });
  const g = await page.evaluate(() => window.app.tool.guides);
  await page.screenshot({ path: path.join(OUT, 'hulplijnen-uitlijnen.png') });
  await page.mouse.up();
  let p = await pts('C');
  assert(near(p[0][1], 0), `bovenkant uitgelijnd met de andere vakken (y = ${p[0][1]})`);
  assert(near(p[0][0], 6), `zelfde tussenruimte als tussen de andere twee (x = ${p[0][0]})`);
  assert(g && g.lines.length >= 1 && g.gaps.length >= 2, `hulplijn en maatstreepjes getoond (${g && g.lines.length} lijn, ${g && g.gaps.length} afstanden)`);

  console.log('Midden uitlijnen');
  await setup([R('A', 0, 0, 2, 1), R('C', 0.6, 2.3, 1.2, 2.9)], 'C');
  [x0, y0] = await S(0.9, 2.6); [x1, y1] = await S(0.95, 2.6);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  p = await pts('C');
  assert(near((p[0][0] + p[1][0]) / 2, 1), `midden boven elkaar (${((p[0][0] + p[1][0]) / 2).toFixed(4)})`);

  console.log('Gelijke maat');
  await setup([R('A', 0, 0, 2, 1), R('D', 0, 2, 1.5, 3)], 'D');
  const hd = await page.evaluate(() => window.app.tool.handles().list.find((h) => h.kind === 'frame' && h.hx === 1 && h.hy === 0.5).s);
  const [tx] = await S(1.95, 2.5);
  await page.mouse.move(box.x + hd[0], box.y + hd[1]); await page.mouse.down();
  await page.mouse.move(tx, box.y + hd[1], { steps: 8 });
  const info = await page.evaluate(() => window.app.tool.liveInfo);
  await page.mouse.up();
  p = await pts('D');
  assert(near(p[1][0] - p[0][0], 2) && /gelijke breedte/.test(info), `breedte klikt op die van het andere vak: 2 m ("${info}")`);

  console.log('Gelijke hoek');
  await setup([R('E', 0, 0, 2, 1, { points: rot([[0, 0], [2, 0], [2, 1], [0, 1]], 33, [1, 0.5]) }), R('F', 4, 0, 6, 1, { points: rot([[4, 0], [6, 0], [6, 1], [4, 1]], 20.5, [5, 0.5]) })], 'F');
  const h = await page.evaluate(() => { const g = window.app.tool.handles(); const r = g.list.find((x) => x.kind === 'rotate'); return { r: r.s, c: window.app.cam.toScreen(r.pivot) }; });
  const a0 = Math.atan2(h.r[1] - h.c[1], h.r[0] - h.c[0]) + 12 * Math.PI / 180, RR = Math.hypot(h.r[0] - h.c[0], h.r[1] - h.c[1]);
  await page.mouse.move(box.x + h.r[0], box.y + h.r[1]); await page.mouse.down();
  await page.mouse.move(box.x + h.c[0] + Math.cos(a0) * RR, box.y + h.c[1] + Math.sin(a0) * RR, { steps: 8 });
  const rinfo = await page.evaluate(() => window.app.tool.liveInfo);
  await page.mouse.up();
  p = await pts('F');
  const ang = Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]) * 180 / Math.PI;
  assert(Math.abs(ang - 33) < 1e-6 && /gelijke hoek/.test(rinfo), `draait naar dezelfde hoek als het andere vak: ${ang.toFixed(3)}° ("${rinfo}")`);

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle hulplijn-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
