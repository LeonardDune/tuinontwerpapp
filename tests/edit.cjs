// Bewerken: rechthoek langs liniaal, gedraaide rechthoek, selecteren, draaien, maten, hoekpunten, snappen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }
const close = (a, b, t = 1e-3) => Math.abs(a - b) < t;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    a.openDoc(newDoc('Bewerken'), true);
    a.cam.zoom = 40; a.cam.rot = 0; a.cam.x = 600; a.cam.y = 430; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.state.hatch = 'none'; a.state.fill = false; a.state.rectMode = 'axis'; a.settings.snap = true; a.settings.grid = false; a.settings.angleSnap = true;
  });
  const box = await page.locator('#canvas').boundingBox();
  const X = (x) => box.x + x, Y = (y) => box.y + y;
  const S = (w) => page.evaluate((w) => window.app.cam.toScreen(w), w);
  async function drag(points, steps = 8) {
    await page.mouse.move(X(points[0][0]), Y(points[0][1]));
    await page.mouse.down();
    for (let i = 1; i < points.length; i++) await page.mouse.move(X(points[i][0]), Y(points[i][1]), { steps });
    await page.mouse.up();
  }
  const last = () => page.evaluate(() => { const it = window.app.store.doc.layers[0].items; return it[it.length - 1]; });
  const tool = (t) => page.click(`#toolbar .tool[data-tool="${t}"]`);
  const angDeg = (p0, p1) => { let d = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI; return ((d % 360) + 360) % 360; };

  console.log('Rechthoek langs een liniaal');
  await page.evaluate(() => { const a = window.app; a.toggleGuide('ruler'); const g = a.guides.get('ruler'); g.x = 600; g.y = 250; g.rot = -30 * Math.PI / 180; a.render(); });
  const edge = await page.evaluate(() => { const g = window.app.guides.get('ruler'); return g.edges[1].map((p) => g.toScreen(p)); }); // onderrand
  const m = [(edge[0][0] + edge[1][0]) / 2, (edge[0][1] + edge[1][1]) / 2];
  await tool('rect');
  await drag([[m[0] - 60, m[1] + 30], [m[0] + 80, m[1] + 140]]);
  let it = await last();
  assert(it.kind === 'polygon' && it.rect && it.points.length === 4, 'rechthoek gemaakt (niet weggegooid)');
  assert(close(angDeg(it.points[0], it.points[1]) % 180, 30, 0.01), `eerste zijde ligt langs de liniaal (30°): ${angDeg(it.points[0], it.points[1]).toFixed(3)}°`);
  await page.evaluate(() => { window.app.guides.clear(); window.app.syncGuideButtons(); window.app.render(); });

  console.log('Gedraaide rechthoek (zijde, dan diepte)');
  await page.click('#optionsbar .seg button[data-m="3pt"]');
  const a0 = [300, 600], ang = -20 * Math.PI / 180; // 20° omhoog
  const a1 = [a0[0] + Math.cos(ang) * 200, a0[1] + Math.sin(ang) * 200];
  await drag([a0, a1]);
  await page.mouse.click(X(a1[0] + 30), Y(a1[1] + 90)); // diepte
  it = await last();
  assert(it.rect && close(angDeg(it.points[0], it.points[1]), 20, 0.01), `gedraaide rechthoek onder 20° (${angDeg(it.points[0], it.points[1]).toFixed(2)}°)`);
  await page.click('#optionsbar .seg button[data-m="axis"]');

  console.log('Selecteren door in een lege rechthoek te tikken');
  await page.evaluate(async () => {
    const a = window.app;
    a.store.mutate((d) => {
      d.layers[0].items.push({ type: 'shape', id: 'R', kind: 'polygon', rect: true, points: [[-2, -1], [2, -1], [2, 1], [-2, 1]], color: '#333', width: 0.04 });
      d.layers[0].items.push({ type: 'shape', id: 'P', kind: 'polygon', points: [[5, 3], [8, 3], [7, 6]], color: '#333', width: 0.04 });
      d.layers[0].items.push({ type: 'shape', id: 'C', kind: 'circle', points: [[-10, -6], [-9, -6]], color: '#333', width: 0.04 });
      d.layers[0].items.push({ type: 'shape', id: 'L', kind: 'line', points: [[4, -6], [9, -6]], color: '#333', width: 0.04 });
    });
  });
  await tool('lasso');
  const rc = await S([0, 0]);
  await page.mouse.click(X(rc[0]), Y(rc[1]));
  let sel = await page.evaluate(() => [...window.app.selection]);
  assert(sel.length === 1 && sel[0] === 'R', 'tik midden in lege rechthoek selecteert hem');
  assert(await page.isVisible('#selection-bar input[data-k="w"]'), 'eigenschappenbalk toont breedte');

  console.log('Draaien met de greep (klikt per 15°)');
  const hs = await page.evaluate(() => window.app.tool.handles().list.find((h) => h.kind === 'rotate').s);
  const pc = await S([0, 0]);
  // sleep de greep zodat de rechthoek ~44° draait (tegen de klok in)
  const r0 = Math.hypot(hs[0] - pc[0], hs[1] - pc[1]);
  const target = (-90 - 44) * Math.PI / 180;
  await drag([hs, [pc[0] + Math.cos(target) * r0, pc[1] + Math.sin(target) * r0]], 12);
  it = await page.evaluate(() => window.app.store.findItem('R').item);
  assert(close(angDeg(it.points[0], it.points[1]), 45, 0.01), `draaiing klikt op 45° (${angDeg(it.points[0], it.points[1]).toFixed(2)}°)`);

  console.log('Exacte hoek en maten intypen');
  await page.fill('#selection-bar input[data-k="angle"]', '37,5');
  await page.press('#selection-bar input[data-k="angle"]', 'Enter');
  it = await page.evaluate(() => window.app.store.findItem('R').item);
  assert(close(angDeg(it.points[0], it.points[1]), 37.5, 0.01), 'hoek exact 37,5°');
  await page.click('#selection-bar [data-step="angle:1"]');
  it = await page.evaluate(() => window.app.store.findItem('R').item);
  assert(close(angDeg(it.points[0], it.points[1]), 45, 0.01), '+ knop gaat naar het volgende veelvoud van 15° (45°)');
  await page.fill('#selection-bar input[data-k="w"]', '5,5');
  await page.press('#selection-bar input[data-k="w"]', 'Enter');
  it = await page.evaluate(() => window.app.store.findItem('R').item);
  const w = Math.hypot(it.points[1][0] - it.points[0][0], it.points[1][1] - it.points[0][1]);
  const h = Math.hypot(it.points[3][0] - it.points[0][0], it.points[3][1] - it.points[0][1]);
  const cx = it.points.reduce((s, p) => s + p[0], 0) / 4, cy = it.points.reduce((s, p) => s + p[1], 0) / 4;
  assert(close(w, 5.5) && close(h, 2) && close(cx, 0) && close(cy, 0), `breedte 5,50 m, diepte 2,00 m, midden op zijn plek`);

  console.log('Zijgreep: alleen de diepte');
  const side = await page.evaluate(() => window.app.tool.handles().list.find((h) => h.kind === 'frame' && h.hx === 0.5 && h.hy === 1));
  const before = await page.evaluate(() => JSON.stringify(window.app.store.findItem('R').item.points));
  // naar buiten slepen (loodrecht op de zijde)
  const dir = await page.evaluate(() => { const p = window.app.store.findItem('R').item.points; const n = [p[3][0] - p[0][0], p[3][1] - p[0][1]]; const l = Math.hypot(...n); return [n[0] / l, n[1] / l]; });
  const sd = [dir[0], dir[1]]; // wereldrichting = schermrichting (geen camerarotatie)
  await drag([side.s, [side.s[0] + sd[0] * 40, side.s[1] + sd[1] * 40]]);
  it = await page.evaluate(() => window.app.store.findItem('R').item);
  const w2 = Math.hypot(it.points[1][0] - it.points[0][0], it.points[1][1] - it.points[0][1]);
  const h2 = Math.hypot(it.points[3][0] - it.points[0][0], it.points[3][1] - it.points[0][1]);
  assert(close(w2, 5.5) && close(h2, 3, 0.05) && before !== JSON.stringify(it.points), `diepte 2 → ${h2.toFixed(2)} m, breedte blijft 5,50 m`);

  console.log('Hoekpunten van een vorm');
  const pp = await S([5.5, 3]);
  await page.mouse.click(X(pp[0] + 30), Y(pp[1] + 20)); // tik binnen de driehoek
  sel = await page.evaluate(() => [...window.app.selection]);
  assert(sel[0] === 'P', 'driehoek geselecteerd');
  const v2 = await S([7, 6]);
  await drag([v2, [v2[0] + 40, v2[1] + 40]]);
  it = await page.evaluate(() => window.app.store.findItem('P').item);
  assert(close(it.points[2][0], 8, 0.01) && close(it.points[2][1], 7, 0.01), `hoekpunt versleept naar (8, 7)`);
  const ins = await page.evaluate(() => window.app.tool.handles().list.find((h) => h.kind === 'insert' && h.i === 0));
  await drag([ins.s, [ins.s[0], ins.s[1] - 40]]);
  it = await page.evaluate(() => window.app.store.findItem('P').item);
  assert(it.points.length === 4 && it.points[1][1] < 2.6 && it.points[1][0] > 5.5 && it.points[1][0] < 7.5, 'punt toegevoegd met de +-greep');
  const nv = await S(it.points[1]);
  await page.mouse.click(X(nv[0]), Y(nv[1]));
  await page.mouse.click(X(nv[0]), Y(nv[1]));
  it = await page.evaluate(() => window.app.store.findItem('P').item);
  assert(it.points.length === 3, 'dubbeltik op een hoekpunt verwijdert het');

  console.log('Cirkel en lijn exact');
  const cc = await S([-10, -6]);
  await page.mouse.click(X(cc[0]), Y(cc[1]));
  await page.fill('#selection-bar input[data-k="diam"]', '3');
  await page.press('#selection-bar input[data-k="diam"]', 'Enter');
  it = await page.evaluate(() => window.app.store.findItem('C').item);
  assert(close(Math.hypot(it.points[1][0] - it.points[0][0], it.points[1][1] - it.points[0][1]), 1.5), 'cirkel Ø 3,00 m');
  const lc = await S([6.5, -6]);
  await page.mouse.click(X(lc[0]), Y(lc[1]));
  await page.fill('#selection-bar input[data-k="len"]', '4');
  await page.press('#selection-bar input[data-k="len"]', 'Enter');
  await page.fill('#selection-bar input[data-k="angle"]', '12,5');
  await page.press('#selection-bar input[data-k="angle"]', 'Enter');
  it = await page.evaluate(() => window.app.store.findItem('L').item);
  assert(close(Math.hypot(it.points[1][0] - it.points[0][0], it.points[1][1] - it.points[0][1]), 4) && close(angDeg(it.points[0], it.points[1]), 12.5, 0.01), 'lijn 4,00 m onder 12,5°');

  console.log('Verplaatsen met snappen');
  // cirkel verplaatsen zodat zijn middelpunt bijna op het eerste punt van de lijn komt
  const l0 = await page.evaluate(() => window.app.store.findItem('L').item.points[0]);
  const c0 = await S([-10, -6]);
  await page.mouse.click(X(c0[0]), Y(c0[1]));
  const tgt = await S([l0[0] + 0.12, l0[1] - 0.1]);
  await drag([c0, tgt], 15);
  it = await page.evaluate(() => window.app.store.findItem('C').item);
  assert(close(it.points[0][0], l0[0], 1e-6) && close(it.points[0][1], l0[1], 1e-6), 'middelpunt klikt vast op het eindpunt van de lijn');

  console.log('Meerdere tegelijk exact draaien');
  await page.evaluate(() => window.app.setSelection(new Set(['P', 'L'])));
  await page.fill('#selection-bar input[data-k="rotby"]', '10');
  await page.press('#selection-bar input[data-k="rotby"]', 'Enter');
  it = await page.evaluate(() => window.app.store.findItem('L').item);
  assert(close(angDeg(it.points[0], it.points[1]), 22.5, 0.01), 'selectie 10° gedraaid (lijn 12,5° → 22,5°)');

  await page.screenshot({ path: path.join(OUT, 'bewerken.png') });
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle bewerk-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
