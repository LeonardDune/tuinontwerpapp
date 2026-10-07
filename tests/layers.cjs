// Een hele laag selecteren en in zijn geheel verschuiven, draaien en schalen.
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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc, newLayer } = await import('./js/model.js');
    const d = newDoc('Lagen');
    const A = d.layers[0];
    A.name = 'Ontwerp';
    A.items.push({ type: 'shape', id: 'l1', kind: 'line', points: [[0, 0], [4, 0]], color: '#333', width: 0.04 });
    A.items.push({ type: 'shape', id: 'r1', kind: 'polygon', rect: true, points: [[1, 1], [3, 1], [3, 2], [1, 2]], color: '#333', width: 0.04 });
    A.items.push({ type: 'stencil', id: 's1', symbol: 'heester', x: 5, y: 1, w: 1.5, h: 1.5, rot: 0, color: '#7aa64b' });
    A.items.push({ type: 'shape', id: 'w1', kind: 'line', wall: true, points: [[0, 3], [6, 3]], color: '#2f2f2f', width: 0.3 });
    A.items.push({ type: 'stencil', id: 'd1', symbol: 'deur', x: 2, y: 3, w: 0.93, h: 0.3, rot: 0, color: '#2f2f2f' });
    const B = newLayer('Ondergrond');
    B.items.push({ type: 'shape', id: 'b1', kind: 'line', points: [[-2, -2], [-1, -2]], color: '#999', width: 0.04 });
    d.layers.unshift(B);
    d.activeLayer = A.id;
    a.openDoc(d, true);
    a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 300; a.cam.y = 250; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false;
    a.setTool('draw');
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (wx, wy) => [box.x + 300 + wx * 60, box.y + 250 + wy * 60];
  const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(Object.fromEntries(window.app.store.doc.layers.flatMap((l) => l.items).map((i) => [i.id, i])))));

  console.log('Hele laag selecteren');
  const before = await snap();
  assert(before.d1.wallId === 'w1', 'deur hoort bij de muur');
  await page.click('#btn-layers');
  await page.click('#layer-list li:has-text("Ontwerp") button[data-a="select"]');
  let sel = await page.evaluate(() => [...window.app.selection].sort());
  assert(sel.join() === ['d1', 'l1', 'r1', 's1', 'w1'].sort().join(), `alles van "Ontwerp" geselecteerd, niets van "Ondergrond" (${sel.length})`);
  assert(await page.evaluate(() => window.app.state.tool) === 'lasso', 'gereedschap Selecteren actief');
  await page.screenshot({ path: path.join(OUT, 'laag-geselecteerd.png') });
  await page.click('#btn-layers-close');

  console.log('Verschuiven');
  {
    const [x0, y0] = S(2, 0), [x1, y1] = S(4, 1);
    await page.mouse.move(x0, y0); await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up();
  }
  let now = await snap();
  const dx = now.l1.points[0][0] - before.l1.points[0][0], dy = now.l1.points[0][1] - before.l1.points[0][1];
  const same = (id, k) => Math.abs(k(now[id]) - k(before[id]) - 0) < 1e-6;
  assert(Math.abs(dx - 2) < 0.05 && Math.abs(dy - 1) < 0.05, `laag 2 m opzij en 1 m omlaag geschoven (${dx.toFixed(2)}, ${dy.toFixed(2)})`);
  assert(Math.abs(now.s1.x - before.s1.x - dx) < 1e-6 && Math.abs(now.r1.points[2][1] - before.r1.points[2][1] - dy) < 1e-6 && Math.abs(now.d1.x - before.d1.x - dx) < 1e-6, 'alle elementen evenveel verschoven (ook stencil en deur)');
  assert(same('b1', (i) => i.points[0][0]), 'andere laag blijft liggen');

  console.log('Schalen en draaien met exacte waarden');
  const bbox = (o) => { const xs = [], ys = []; for (const id of ['l1', 'r1', 'w1']) for (const p of o[id].points) { xs.push(p[0]); ys.push(p[1]); } return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
  const b0 = bbox(now);
  await page.fill('#selection-bar input[data-k="scaleby"]', '200');
  await page.press('#selection-bar input[data-k="scaleby"]', 'Enter');
  now = await snap();
  const b1 = bbox(now);
  assert(Math.abs(b1.w / b0.w - 2) < 1e-6 && Math.abs(now.s1.w - 3) < 1e-6, `schaal 200%: alles twee keer zo groot (${b0.w.toFixed(2)} → ${b1.w.toFixed(2)} m)`);
  await page.fill('#selection-bar input[data-k="rotby"]', '90');
  await page.press('#selection-bar input[data-k="rotby"]', 'Enter');
  now = await snap();
  const b2 = bbox(now);
  assert(Math.abs(b2.w - b1.h) < 1e-3 && Math.abs(b2.h - b1.w) < 1e-3, 'draai 90°: breedte en hoogte gewisseld');
  const onWall = await page.evaluate(async () => { const { distToSegment } = await import('./js/geom.js'); const a = window.app; const w = a.store.findItem('w1').item, d = a.store.findItem('d1').item; return { d: distToSegment([d.x, d.y], w.points[0], w.points[1]), h: d.h, wt: w.width }; });
  assert(onWall.d < 1e-6 && Math.abs(onWall.h - onWall.wt) < 1e-9, 'deur zit nog in de (meegeschaalde) muur');
  await page.click('#btn-undo'); await page.click('#btn-undo');
  now = await snap();
  assert(Math.abs(bbox(now).w - b0.w) < 1e-6, 'ongedaan maken zet schaal en draaiing terug');

  console.log('Vergrendeld en sneltoets');
  await page.evaluate(() => { const a = window.app; a.setSelection(new Set()); const l = a.store.doc.layers.find((x) => x.name === 'Ondergrond'); a.store.mutate(() => { l.locked = true; }); a.selectLayer(l.id); });
  assert((await page.evaluate(() => window.app.selection.size)) === 0 && /vergrendeld/.test(await page.locator('#toast').innerText()), 'vergrendelde laag: niet te selecteren, met melding');
  await page.keyboard.press('Control+a');
  sel = await page.evaluate(() => [...window.app.selection]);
  assert(sel.length === 5, 'Ctrl/Cmd+A selecteert de hele actieve laag');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle laag-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
