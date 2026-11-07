// Rechthoeken (plantvakken) netjes tegen elkaar laten aansluiten bij verschuiven en draaien.
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
  const setup = (bPts, aPts = [[0, 0], [4, 0], [4, 2], [0, 2]]) => page.evaluate(async ([bPts, aPts]) => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Aansluiten');
    d.layers[0].items.push({ type: 'shape', id: 'A', kind: 'polygon', rect: true, points: aPts, color: '#333', width: 0.04, fill: '#7a9a5a', fillAlpha: 0.3 });
    d.layers[0].items.push({ type: 'shape', id: 'B', kind: 'polygon', rect: true, points: bPts, color: '#333', width: 0.04, fill: '#b0568f', fillAlpha: 0.3 });
    a.openDoc(d, true); a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 200; a.cam.y = 250; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = true; a.settings.grid = false;
    a.setTool('lasso'); a.setSelection(new Set(['B']));
  }, [bPts, aPts]);
  const box = await page.locator('#canvas').boundingBox();
  const S = (wx, wy) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [wx, wy]).then(([x, y]) => [box.x + x, box.y + y]);
  const B = () => page.evaluate(() => window.app.store.findItem('B').item.points);

  console.log('Verschuiven');
  await setup([[4.5, 0.3], [7, 0.3], [7, 2.3], [4.5, 2.3]]);
  let [x0, y0] = await S(5.5, 1);
  let [x1, y1] = await S(5.5 - 0.45, 1 - 0.27);
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 8 });
  await page.screenshot({ path: path.join(OUT, 'aansluiten-schuiven.png') });
  await page.mouse.up();
  let p = await B();
  assert(Math.abs(p[0][0] - 4) < 1e-9, `linkerzijde precies tegen de rechterzijde van het andere vak (x = ${p[0][0]})`);
  assert(Math.abs(p[0][1]) < 1e-9, `hoeken gelijk getrokken (y = ${p[0][1]})`);

  console.log('Draaien');
  // alles staat 20° gedraaid (geen 15°-stap), B nog 4° extra scheef vlak naast A
  const rot = (pts, deg, c) => pts.map(([x, y]) => { const r = deg * Math.PI / 180, dx = x - c[0], dy = y - c[1]; return [c[0] + dx * Math.cos(r) - dy * Math.sin(r), c[1] + dx * Math.sin(r) + dy * Math.cos(r)]; });
  const A20 = rot([[0, 0], [4, 0], [4, 2], [0, 2]], 20, [0, 0]);
  await setup(rot(rot([[4.12, 0], [6.12, 0], [6.12, 2], [4.12, 2]], 4, [5.12, 1]), 20, [0, 0]), A20);
  const h = await page.evaluate(() => { const g = window.app.tool.handles(); const r = g.list.find((x) => x.kind === 'rotate'); return { r: r.s, c: window.app.cam.toScreen(r.pivot) }; });
  // een klein beetje terugdraaien (3°) is genoeg: hij klikt evenwijdig en schuift ertegenaan
  const ang = Math.atan2(h.r[1] - h.c[1], h.r[0] - h.c[0]) - 3 * Math.PI / 180, R = Math.hypot(h.r[0] - h.c[0], h.r[1] - h.c[1]);
  await page.mouse.move(box.x + h.r[0], box.y + h.r[1]); await page.mouse.down();
  await page.mouse.move(box.x + h.c[0] + Math.cos(ang) * R, box.y + h.c[1] + Math.sin(ang) * R, { steps: 6 });
  const info = await page.evaluate(() => window.app.tool.liveInfo);
  await page.screenshot({ path: path.join(OUT, 'aansluiten-draaien.png') });
  await page.mouse.up();
  p = await B();
  const edgeAng = Math.atan2(p[3][1] - p[0][1], p[3][0] - p[0][0]) * 180 / Math.PI;
  assert(Math.abs(edgeAng - 110) < 1e-6, `zijde evenwijdig aan het andere vak gedraaid (${edgeAng.toFixed(4)}°)`);
  // afstand van de hoeken van B tot de rechterzijde van A
  const [ra, rb] = [A20[1], A20[2]];
  const dl = (q) => Math.abs((rb[0] - ra[0]) * (q[1] - ra[1]) - (rb[1] - ra[1]) * (q[0] - ra[0])) / Math.hypot(rb[0] - ra[0], rb[1] - ra[1]);
  assert(dl(p[0]) < 1e-6 && dl(p[3]) < 1e-6, `en precies tegen het andere vak geschoven (${dl(p[0]).toExponential(1)} m)`);
  assert(/sluit aan/.test(info || ''), `melding tijdens draaien: "${info}"`);

  console.log('Zonder snappen');
  await setup([[4.5, 0.3], [7, 0.3], [7, 2.3], [4.5, 2.3]]);
  await page.evaluate(() => { window.app.settings.snap = false; });
  [x0, y0] = await S(5.5, 1); [x1, y1] = await S(5.5 - 0.45, 1 - 0.27);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up();
  p = await B();
  assert(Math.abs(p[0][0] - 4) > 0.01, 'snappen uit: vrij verschuiven');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle aansluit-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
