// Snappen aan de tekening: midden, snijpunt, loodrecht op, rand (cirkel, muurvlak),
// richting evenwijdig/loodrecht, en bestrating die meedraait met de vorm.
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
  const A = 20 * Math.PI / 180;
  const u = [Math.cos(A), -Math.sin(A)], n = [Math.sin(A), Math.cos(A)]; // langs de lijn (20° omhoog) en loodrecht erop
  const P = (s, t) => [s * u[0] + t * n[0], s * u[1] + t * n[1]]; // s langs, t loodrecht (in meters)
  await page.evaluate(async ({ L1, L2 }) => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Snappen');
    d.layers[0].items.push({ type: 'shape', id: 'L1', kind: 'line', points: L1, color: '#333', width: 0.04 });
    d.layers[0].items.push({ type: 'shape', id: 'L2', kind: 'line', points: L2, color: '#333', width: 0.04 });
    d.layers[0].items.push({ type: 'shape', id: 'C', kind: 'circle', points: [[12, 0], [14, 0]], color: '#333', width: 0.04 });
    d.layers[0].items.push({ type: 'shape', id: 'W', kind: 'line', wall: true, points: [[0, 6], [8, 6]], color: '#2f2f2f', width: 0.3 });
    d.layers[0].items.push({ type: 'shape', id: 'K', kind: 'polygon', rect: true, points: [[16, 3], [19, 3], [19, 5], [16, 5]], color: '#333', width: 0.03, hatch: 'klinkers' });
    a.openDoc(d, true);
    a.cam.zoom = 50; a.cam.rot = 0; a.cam.x = 200; a.cam.y = 380; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = true; a.settings.grid = false; a.settings.angleSnap = true;
  }, { L1: [P(0, 0), P(6, 0)], L2: [P(4, -1), P(4, 3)] });
  const snap = (w, from = null) => page.evaluate(async ({ w, from }) => { const { snapPoint } = await import('./js/snap.js'); const r = snapPoint(window.app, w, from); return { p: r.p, kind: r.kind }; }, { w, from });
  const near = (p, q, tol = 1e-6) => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol;

  console.log('Punten op bestaande lijnen');
  let r = await snap(P(3.08, 0.06));
  assert(r.kind === 'mid' && near(r.p, P(3, 0)), 'midden van een lijn');
  r = await snap(P(4.07, 0.08));
  assert(r.kind === 'int' && near(r.p, P(4, 0)), 'snijpunt van twee lijnen');
  r = await snap([14.05, 0.1]);
  assert(r.kind === 'edge' && Math.abs(Math.hypot(r.p[0] - 12, r.p[1]) - 2) < 1e-9, 'op de rand van een cirkel');
  r = await snap([3, 6.17]);
  assert(r.kind === 'edge' && Math.abs(r.p[1] - 6.15) < 1e-9, 'op het vlak van een muur (niet alleen de hartlijn)');
  r = await snap(P(1.06, 0.05), P(1, -3));
  assert(r.kind === 'perpfoot' && near(r.p, P(1, 0)), 'loodrecht op een lijn vanaf het vorige punt');

  console.log('Richting evenwijdig en loodrecht');
  // vanaf een punt 2 m naast de lijn, bijna evenwijdig (1,5° ernaast)
  const from = P(0, 2.5);
  const off = Math.tan(1.5 * Math.PI / 180) * 5;
  r = await snap(P(5, 2.5 + off), from);
  const along = (p) => [(p[0] - from[0]) * u[0] + (p[1] - from[1]) * u[1], (p[0] - from[0]) * n[0] + (p[1] - from[1]) * n[1]];
  assert((r.kind === 'parallel' || r.kind === 'perp') && Math.abs(along(r.p)[1]) < 1e-9, 'evenwijdig aan de schuine lijn (20°), ook al liggen de 15°-stappen ernaast');
  r = await snap(P(-0.1, 5), from);
  assert((r.kind === 'perp' || r.kind === 'parallel') && Math.abs(along(r.p)[0]) < 1e-9, 'loodrecht op de schuine lijn');

  console.log('Tekenen met het lijngereedschap');
  await page.click('#toolbar .tool[data-tool="line"]');
  const box = await page.locator('#canvas').boundingBox();
  const S = async (w) => { const s = await page.evaluate((w) => window.app.cam.toScreen(w), w); return [box.x + s[0], box.y + s[1]]; };
  const s0 = await S(from), s1 = await S(P(5, 2.5 + off));
  await page.mouse.move(s0[0], s0[1]); await page.mouse.down();
  await page.mouse.move(s1[0], s1[1], { steps: 12 });
  await page.screenshot({ path: path.join(OUT, 'snappen-evenwijdig.png') });
  await page.mouse.up();
  const line = await page.evaluate(() => { const it = window.app.store.doc.layers[0].items; return it[it.length - 1].points; });
  const ang = Math.atan2(line[1][1] - line[0][1], line[1][0] - line[0][0]);
  assert(Math.abs(ang + A) < 1e-4, `getekende lijn ligt exact evenwijdig (${(-ang * 180 / Math.PI).toFixed(3)}°)`);

  console.log('Bestrating draait mee met de vorm');
  const hb = await page.evaluate(async () => { const { hatchAngle } = await import('./js/items.js'); const a = window.app; a.setTool('lasso'); a.setSelection(new Set(['K'])); return hatchAngle(a.store.findItem('K').item); });
  const rot = await page.evaluate(() => { const g = window.app.tool.handles(); const r = g.list.find((h) => h.kind === 'rotate'); return { r: r.s, c: window.app.cam.toScreen(r.pivot) }; });
  // ronde greep 40° om het midden draaien
  const rad = Math.hypot(rot.r[0] - rot.c[0], rot.r[1] - rot.c[1]), a0 = Math.atan2(rot.r[1] - rot.c[1], rot.r[0] - rot.c[0]);
  await page.mouse.move(box.x + rot.r[0], box.y + rot.r[1]); await page.mouse.down();
  for (let k = 1; k <= 10; k++) { const a = a0 + (40 * k / 10) * Math.PI / 180; await page.mouse.move(box.x + rot.c[0] + Math.cos(a) * rad, box.y + rot.c[1] + Math.sin(a) * rad); }
  await page.mouse.up();
  const ha = await page.evaluate(async () => { const { hatchAngle } = await import('./js/items.js'); const it = window.app.store.findItem('K').item; const [p, q] = it.points; return { h: hatchAngle(it), e: Math.atan2(q[1] - p[1], q[0] - p[0]) }; });
  assert(Math.abs(ha.h - hb) > 0.3 && Math.abs(ha.h - ha.e) < 1e-9, `klinkers draaien mee met de rechthoek (${(ha.h * 180 / Math.PI).toFixed(1)}°)`);
  await page.screenshot({ path: path.join(OUT, 'klinkers-gedraaid.png') });

  console.log('Stencils dekken af');
  const px = await page.evaluate(async () => {
    const { drawStencil } = await import('./js/stencils.js');
    const sample = (see) => {
      const c = document.createElement('canvas'); c.width = c.height = 100;
      const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 100, 100);
      g.setTransform(10, 0, 0, 10, 50, 50);
      drawStencil(g, { type: 'stencil', symbol: 'tafelrond', x: 0, y: 0, w: 6, h: 6, rot: 0, see }, 0.02, '#ffffff');
      // punt binnen het stencil, tussen de lijnen in
      return [...g.getImageData(62, 38, 1, 1).data].slice(0, 3);
    };
    return { dicht: sample(false), door: sample(true) };
  });
  assert(px.dicht.every((v) => v > 150), `stencil is dicht: de zwarte ondergrond is niet te zien (${px.dicht})`);
  assert(px.door.every((v) => v < 120), `met "Doorzichtig" schijnt de ondergrond er wel door (${px.door})`);

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle snap-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
