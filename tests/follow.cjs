// Hulpmiddelen liggen vast op de tekening: bij zoomen, verschuiven en draaien blijft de afstand
// tot de tekening exact gelijk, en de liniaal loopt over het hele scherm door.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1200, height: 860 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Vast op de tekening');
    // muur van 20 m, licht schuin
    d.layers[0].items.push({ type: 'shape', id: 'muur', kind: 'line', points: [[-10, 2], [10, -1]], color: '#1d2b36', width: 0.04 });
    a.openDoc(d, true);
    a.cam.zoom = 40; a.cam.rot = 0; a.cam.x = 600; a.cam.y = 430; a.cameraChanged();
    a.settings.snap = false; a.settings.grid = false; a.settings.pencilOnly = false;
    a.guides.clear(); a.toggleGuide('ruler'); a.setGuidesLocked(true);
    // liniaal evenwijdig aan de muur, tekenrand 1,5 m eronder
    const ang = Math.atan2(-3, 20);
    const n = [-Math.sin(ang), Math.cos(ang)];
    const g = a.guides.get('ruler');
    const p = a.cam.toScreen([n[0] * 1.5 + 0.0, 0.5 + n[1] * 1.5]);
    g.x = p[0]; g.y = p[1]; g.rot = ang; a.render();
    a.setTool('line');
  });
  const box = await page.locator('#canvas').boundingBox();
  const X = (x) => box.x + x, Y = (y) => box.y + y;

  // afstand (m) en hoekverschil van de tekenrand tot de muur, in de tekening gemeten
  const state = () => page.evaluate(() => {
    const a = window.app; const g = a.guides.get('ruler'); g.sync(a.cam);
    const [e0, e1] = g.edges[0].map((p) => a.cam.toWorld(g.toScreen(p)));
    const [p, q] = [[-10, 2], [10, -1]];
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
    const off = (s) => ((s[0] - p[0]) * dy - (s[1] - p[1]) * dx) / L;
    const vis = g.edges[0].map((pt) => g.toScreen(pt));
    return { off0: off(e0), off1: off(e1), lenPx: Math.hypot(vis[1][0] - vis[0][0], vis[1][1] - vis[0][1]), w: a.width };
  });
  const s0 = await state();
  console.log(`    begin: rand op ${s0.off0.toFixed(4)} m van de muur`);
  assert(Math.abs(s0.off0 - s0.off1) < 1e-6, 'liniaal ligt evenwijdig aan de muur');

  console.log('Zoomen (scrollwiel met ctrl, op verschillende plekken)');
  const offs = [];
  for (const [x, y, dy] of [[200, 200, -60], [900, 600, -60], [500, 400, 80], [1000, 150, -100], [300, 700, 120]]) {
    await page.mouse.move(X(x), Y(y));
    await page.keyboard.down('Control');
    for (let k = 0; k < 4; k++) await page.mouse.wheel(0, dy / 4);
    await page.keyboard.up('Control');
    offs.push((await state()).off0);
  }
  const drift = Math.max(...offs.map((o) => Math.abs(o - s0.off0)));
  assert(drift < 1e-6, `afstand tot de muur blijft exact gelijk na 5 keer zoomen (afwijking ${drift.toExponential(1)} m)`);

  console.log('Knijpen, schuiven en draaien met twee vingers');
  const cdp = await ctx.newCDPSession(page);
  const tp = (pts) => pts.map(([x, y], i) => ({ x: X(x), y: Y(y), id: i }));
  await page.evaluate(() => { window.app.settings.rotateGesture = true; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[200, 650], [420, 700]]) });
  for (let k = 1; k <= 10; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[200 + k * 8, 650 - k * 4], [420 - k * 3, 700 + k * 9]]) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  let s = await state();
  assert(Math.abs(s.off0 - s0.off0) < 1e-6 && Math.abs(s.off1 - s0.off0) < 1e-6, `na knijpen/draaien nog evenwijdig op dezelfde afstand (${s.off0.toFixed(4)} m)`);

  console.log('Ver inzoomen: de liniaal blijft lang genoeg');
  await page.evaluate(() => { const a = window.app; a.cam.rot = 0; a.cam.zoom = 40; a.cam.x = 600; a.cam.y = 430; a.cameraChanged(); a.cam.zoomAt(600, 500, 6); a.cameraChanged(); a.render(); });
  s = await state();
  assert(Math.abs(s.off0 - s0.off0) < 1e-6, 'na ver inzoomen nog steeds op dezelfde afstand');
  assert(s.lenPx >= s.w, `tekenrand loopt over de hele breedte van het scherm (${Math.round(s.lenPx)} px ≥ ${Math.round(s.w)} px)`);
  // in één streek over het hele scherm langs de liniaal
  const e = await page.evaluate(() => { const a = window.app; const g = a.guides.get('ruler'); const [p, q] = g.edges[0].map((pt) => g.toScreen(pt)); return { p, q, w: a.width, h: a.height }; });
  const along = (x) => { const t = (x - e.p[0]) / (e.q[0] - e.p[0]); return [x, e.p[1] + (e.q[1] - e.p[1]) * t + 5]; };
  const A = along(30), B = along(e.w - 30);
  await page.mouse.move(X(A[0]), Y(A[1])); await page.mouse.down();
  await page.mouse.move(X(B[0]), Y(B[1]), { steps: 20 }); await page.mouse.up();
  const line = await page.evaluate(() => { const a = window.app; const it = a.store.doc.layers[0].items; const l = it[it.length - 1]; const [p, q] = l.points; return { len: Math.hypot(q[0] - p[0], q[1] - p[1]), ang: Math.atan2(q[1] - p[1], q[0] - p[0]), screen: Math.hypot(...[0, 1].map((k) => a.cam.toScreen(q)[k] - a.cam.toScreen(p)[k])) }; });
  assert(line.screen > e.w - 80 && Math.abs(line.ang - Math.atan2(-3, 20)) < 1e-4, `één lijn over het hele scherm langs de liniaal (${line.len.toFixed(2)} m)`);
  await page.screenshot({ path: path.join(OUT, 'liniaal-ingezoomd.png') });

  console.log('Driehoek');
  const tri = await page.evaluate(() => {
    const a = window.app; a.toggleGuide('tri45'); const g = a.guides.get('tri45'); g.sync(a.cam);
    const c0 = a.cam.toWorld(g.toScreen([0, 0])); const b0 = a.cam.toWorld(g.toScreen(g.poly[1]));
    const dir0 = Math.atan2(b0[1] - c0[1], b0[0] - c0[0]);
    a.cam.zoomAt(200, 300, 0.3); a.cam.rotateAt(500, 500, 0.5); a.cam.x += 40; a.cameraChanged();
    const c1 = a.cam.toWorld(g.toScreen([0, 0])); const b1 = a.cam.toWorld(g.toScreen(g.poly[1]));
    const dir1 = Math.atan2(b1[1] - c1[1], b1[0] - c1[0]);
    return { d: Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), da: Math.abs(dir1 - dir0) };
  });
  assert(tri.d < 1e-9 && tri.da < 1e-9, 'rechte hoek en zijden van de driehoek blijven op hun plek in de tekening');

  console.log('Gradenboog');
  const pr = await page.evaluate(() => {
    const a = window.app; a.toggleGuide('protractor'); const g = a.guides.get('protractor'); a.render();
    const w = a.cam.toWorld([g.x, g.y]); const R = g.worldR;
    a.cam.zoomAt(100, 100, 1.7); a.cam.x += 33; a.cameraChanged(); a.render();
    const w2 = a.cam.toWorld([g.x, g.y]);
    return { d: Math.hypot(w2[0] - w[0], w2[1] - w[1]), R, R2: g.worldR, Rpx: g.R, z: a.cam.zoom };
  });
  assert(pr.d < 1e-9 && pr.R === pr.R2 && Math.abs(pr.Rpx - pr.R * pr.z) < 1e-6, 'middelpunt en straal van de gradenboog blijven op schaal');

  console.log('Buiten beeld');
  const back = await page.evaluate(() => {
    const a = window.app; a.cam.x += 5000; a.cam.y += 5000; a.cameraChanged();
    const g = a.guides.get('tri45'); const off = !g.isVisible();
    a.toggleGuide('tri45');
    return { off, has: a.guides.has('tri45'), vis: a.guides.get('tri45')?.isVisible() };
  });
  assert(back.off && back.has && back.vis, 'driehoek buiten beeld: de knop haalt hem terug in plaats van weg');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle meebeweeg-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
