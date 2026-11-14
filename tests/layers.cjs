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

  console.log('Laag van de selectie in de balk');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc, newLayer } = await import('./js/model.js');
    const d = newDoc('Lagen tonen');
    d.layers[0].name = 'Onder';
    d.layers[0].items.push({ type: 'shape', id: 'x1', kind: 'polygon', rect: true, points: [[0, 0], [1, 0], [1, 1], [0, 1]], color: '#333', width: 0.02 });
    const top = newLayer('Boven');
    top.items.push({ type: 'shape', id: 'x2', kind: 'polygon', rect: true, points: [[2, 0], [3, 0], [3, 1], [2, 1]], color: '#333', width: 0.02 });
    d.layers.push(top);
    a.openDoc(d, true); a.setTool('lasso'); a.setSelection(new Set(['x2']));
  });
  const selName = () => page.evaluate(() => { const s = document.querySelector('#selection-bar select[data-sel="layer"]'); return s.options[s.selectedIndex].text; });
  assert(await selName() === 'Boven', 'balk toont de laag van het element: "Boven"');
  await page.evaluate(() => window.app.setSelection(new Set(['x1', 'x2'])));
  assert(await selName() === 'Meerdere lagen', 'selectie uit twee lagen: "Meerdere lagen"');
  await page.selectOption('#selection-bar select[data-sel="layer"]', { label: 'Onder' });
  const lay = await page.evaluate(() => window.app.store.doc.layers.map((l) => `${l.name}:${l.items.map((i) => i.id).join('+')}`).join(' | '));
  assert(lay === 'Onder:x1+x2 | Boven:' && await selName() === 'Onder', `beide naar "Onder" verplaatst, balk toont nu "Onder" (${lay})`);

  console.log('Zichtbaarheid van een laag doet niets met de lagen eronder');
  const px = await page.evaluate(async () => {
    const a = window.app; const { newDoc, newLayer } = await import('./js/model.js');
    const d = newDoc('Lagen apart');
    d.layers[0].items.push({ type: 'shape', id: 'onder', kind: 'polygon', rect: true, points: [[0, 0], [3, 0], [3, 3], [0, 3]], color: '#333', width: 0.02, hatch: 'klinkers' });
    const top = newLayer('Boven'); top.paper = 0.35; // oude tekening: trekpapier stond aan
    top.items.push({ type: 'shape', id: 'ver', kind: 'polygon', rect: true, points: [[10, 10], [11, 10], [11, 11], [10, 11]], color: '#333', width: 0.02 });
    d.layers.push(top);
    a.openDoc(d, true); a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 200; a.cam.y = 200; a.cameraChanged(); a.settings.grid = false;
    const read = () => { a.render(); const c = document.querySelector('#canvas'); const g = c.getContext('2d'); const dpr = c.width / a.width; const p = a.cam.toScreen([1.5, 1.5]); return [...g.getImageData(Math.round(p[0] * dpr), Math.round(p[1] * dpr), 1, 1).data].slice(0, 3).join(); };
    const on = read();
    a.store.mutate((doc) => { doc.layers[1].visible = false; });
    const off = read();
    return { on, off, slider: document.querySelectorAll('#layer-list input[data-a="paper"]').length };
  });
  assert(px.on === px.off, `laag erboven aan of uit: onderste laag blijft precies gelijk (${px.on})`);
  assert(px.slider === 0, 'geen schuif "Papier" meer in het lagenpaneel');

  console.log('Raster als eigen laag');
  const gr = await page.evaluate(async () => {
    const a = window.app; const { newDoc, newLayer } = await import('./js/model.js');
    const d = newDoc('Raster');
    d.layers[0].name = 'Onder';
    d.layers[0].items.push({ type: 'shape', id: 'vlak', kind: 'polygon', rect: true, points: [[0, 0], [4, 0], [4, 4], [0, 4]], color: '#fff', width: 0.01, fill: '#ffffff', fillAlpha: 1 });
    const top = newLayer('Boven'); d.layers.push(top);
    a.openDoc(d, true); a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 200; a.cam.y = 200; a.cameraChanged();
    a.settings.grid = true; a.renderLayers();
    const $l = () => [...document.querySelectorAll('#layer-list .layer .name')].map((n) => n.textContent.replace(/ \(.*/, ''));
    const sum = () => { a.baseDirty = true; a.render(); const c = document.querySelector('#canvas'); const g = c.getContext('2d'); const dpr = c.width / a.width; const p = a.cam.toScreen([0.2, 0.2]); const q = a.cam.toScreen([3.8, 3.8]); const data = g.getImageData(Math.round(p[0] * dpr), Math.round(p[1] * dpr), Math.round((q[0] - p[0]) * dpr), Math.round((q[1] - p[1]) * dpr)).data; let s = 0; for (let i = 0; i < data.length; i += 4) s += 765 - data[i] - data[i + 1] - data[i + 2]; return s; };
    const r = { order0: $l().join(','), under: sum() };
    document.querySelector('#layer-list .grid-layer button[data-a="up"]').click();
    r.order1 = $l().join(','); r.at1 = a.store.doc.gridAt; r.over = sum();
    const range = document.querySelector('#layer-list .grid-layer input[data-a="opacity"]');
    range.value = '100'; range.dispatchEvent(new Event('input')); range.dispatchEvent(new Event('change'));
    r.strong = sum(); r.op = a.store.doc.gridOpacity;
    document.querySelector('#layer-list .grid-layer button[data-a="vis"]').click();
    r.gridOff = a.settings.grid; r.off = sum();
    a.toggleGrid(true);
    // een laag omhoog schuiven springt over het raster heen
    document.querySelectorAll('#layer-list .layer')[2].querySelector('button[data-a="up"]').click();
    r.order2 = $l().join(','); r.at2 = a.store.doc.gridAt;
    a.store.undo(); r.order3 = $l().join(',');
    return r;
  });
  assert(gr.order0 === 'Boven,Onder,Raster', `raster staat als onderste laag in het paneel (${gr.order0})`);
  assert(gr.under === 0, 'raster onder het witte vlak is niet te zien');
  assert(gr.order1 === 'Boven,Raster,Onder' && gr.at1 === 1, `raster een plek omhoog: tussen de lagen (${gr.order1})`);
  assert(gr.over > 0, `raster boven het vlak is wel te zien (${gr.over})`);
  assert(gr.op === 1 && gr.strong > gr.over * 1.5, `dekking 100%: raster duidelijk sterker (${gr.over} → ${gr.strong})`);
  assert(gr.gridOff === false && gr.off === 0, 'oogje: raster uit');
  assert(gr.order2 === 'Boven,Onder,Raster' && gr.at2 === 0, `laag "Onder" omhoog springt over het raster (${gr.order2})`);
  assert(gr.order3 === 'Boven,Raster,Onder', 'ongedaan maken zet de volgorde terug');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle laag-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
