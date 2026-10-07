// Hulpmiddelen bewegen mee met de tekening: na zoomen, verschuiven en draaien ligt de rand
// waarlangs getekend werd nog precies op de getekende lijn.
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
    a.openDoc(newDoc('Meebewegen'), true);
    a.cam.zoom = 40; a.cam.rot = 0; a.cam.x = 600; a.cam.y = 430; a.cameraChanged();
    a.settings.snap = false; a.settings.grid = false; a.settings.pencilOnly = false;
    a.guides.clear(); a.toggleGuide('ruler'); a.setGuidesLocked(true);
    const g = a.guides.get('ruler'); g.x = 600; g.y = 380; g.rot = -0.3; a.render();
    a.setTool('line');
  });
  const box = await page.locator('#canvas').boundingBox();
  const X = (x) => box.x + x, Y = (y) => box.y + y;

  // afstand (px) van een rand van de liniaal tot de getekende lijn, en de hoek ertussen
  const check = () => page.evaluate(() => {
    const a = window.app; const g = a.guides.get('ruler');
    const it = a.store.doc.layers[0].items.find((i) => i.type === 'shape');
    const [p, q] = it.points.map((w) => a.cam.toScreen(w));
    const lineD = (s) => { const dx = q[0] - p[0], dy = q[1] - p[1]; return Math.abs((s[0] - p[0]) * dy - (s[1] - p[1]) * dx) / Math.hypot(dx, dy); };
    let best = Infinity;
    for (const [e0, e1] of g.edges) best = Math.min(best, Math.max(lineD(g.toScreen(e0)), lineD(g.toScreen(e1))));
    const onScreen = g.x > 0 && g.y > 0 && g.x < a.width && g.y < a.height;
    return { d: best, onScreen, L: g.L };
  });

  console.log('Lijn langs de liniaal');
  const e = await page.evaluate(() => { const g = window.app.guides.get('ruler'); return g.edges[1].map((p) => g.toScreen(p)); });
  const at = (t) => [e[0][0] + (e[1][0] - e[0][0]) * t, e[0][1] + (e[1][1] - e[0][1]) * t + 6];
  await page.mouse.move(X(at(0.2)[0]), Y(at(0.2)[1])); await page.mouse.down();
  await page.mouse.move(X(at(0.7)[0]), Y(at(0.7)[1]), { steps: 10 }); await page.mouse.up();
  let c = await check();
  assert(c.d < 0.5, `lijn getekend langs de rand (${c.d.toFixed(3)} px)`);

  console.log('Zoomen met het scrollwiel (ctrl)');
  await page.mouse.move(X(300), Y(600));
  await page.keyboard.down('Control');
  for (let k = 0; k < 6; k++) await page.mouse.wheel(0, -20);
  await page.keyboard.up('Control');
  await page.evaluate(() => { const a = window.app; a.cam.zoomAt(300, 600, 2.5); a.cameraChanged(); });
  c = await check();
  assert(c.d < 0.01 && c.L === 760, `na inzoomen ligt de rand nog op de lijn (${c.d.toFixed(4)} px), liniaal even groot op het scherm`);
  await page.screenshot({ path: path.join(OUT, 'meebewegen-zoom.png') });

  console.log('Verschuiven en draaien met twee vingers');
  const cdp = await ctx.newCDPSession(page);
  const tp = (pts) => pts.map(([x, y], i) => ({ x: X(x), y: Y(y), id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[200, 650], [420, 700]]) });
  for (let k = 1; k <= 10; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[200 + k * 8, 650 - k * 4], [420 - k * 3, 700 + k * 6]]) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  c = await check();
  assert(c.d < 0.01, `na knijpen/schuiven ligt de rand nog op de lijn (${c.d.toFixed(4)} px)`);
  await page.evaluate(() => { const a = window.app; a.cam.rotateAt(600, 430, 0.4); a.cameraChanged(); });
  c = await check();
  assert(c.d < 0.01, `na draaien van de tekening ligt de rand nog op de lijn (${c.d.toFixed(4)} px)`);

  console.log('Liniaal op een bestaande lijn gelegd (niet langs getekend)');
  await page.evaluate(() => {
    const a = window.app; const g = a.guides.get('ruler');
    // zet de liniaal opnieuw neer met de onderrand precies op de lijn
    const it = a.store.doc.layers[0].items.find((i) => i.type === 'shape');
    const [p, q] = it.points.map((w) => a.cam.toScreen(w));
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    g.rot = ang; g.anchor = null;
    // onderrand ligt op lokaal y = +H/2
    g.x = m[0] + Math.sin(ang) * g.H / 2 + Math.cos(ang) * 40; g.y = m[1] - Math.cos(ang) * g.H / 2 + Math.sin(ang) * 40;
  });
  await page.evaluate(() => { const a = window.app; a.cam.zoomAt(500, 300, 0.45); a.cameraChanged(); });

  c = await check();
  assert(c.d < 0.01, `rand op een lijn blijft daar bij uitzoomen (${c.d.toFixed(4)} px)`);

  console.log('Gradenboog');
  const pr = await page.evaluate(() => {
    const a = window.app; a.toggleGuide('protractor'); const g = a.guides.get('protractor'); a.render();
    const w = a.cam.toWorld([g.x, g.y]); const R = g.worldR;
    a.cam.zoomAt(100, 100, 1.7); a.cam.x += 33; a.cameraChanged(); a.render();
    const w2 = a.cam.toWorld([g.x, g.y]);
    return { d: Math.hypot(w2[0] - w[0], w2[1] - w[1]), R, R2: g.worldR };
  });
  assert(pr.d < 1e-9 && pr.R === pr.R2, 'middelpunt van de gradenboog blijft op dezelfde plek in de tekening');

  console.log('Buiten beeld');
  const back = await page.evaluate(() => {
    const a = window.app; a.cam.x += 5000; a.cameraChanged();
    const g = a.guides.get('ruler'); const off = g.x > a.width;
    a.toggleGuide('ruler');
    return { off, has: a.guides.has('ruler'), x: a.guides.get('ruler')?.x, w: a.width };
  });
  assert(back.off && back.has && Math.abs(back.x - back.w / 2) < 1, 'liniaal buiten beeld: knop haalt hem terug in plaats van weg');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle meebeweeg-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
