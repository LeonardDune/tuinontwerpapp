// Groep (of meerdere elementen) als geheel oprekken: hoeken en zijmiddens, net als bij één element.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);
  const setup = () => page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Groep');
    d.layers[0].items.push({ type: 'shape', id: 'A', kind: 'polygon', rect: true, points: [[0, 0], [2, 0], [2, 1], [0, 1]], color: '#333', width: 0.03, gid: 'G1' });
    d.layers[0].items.push({ type: 'shape', id: 'B', kind: 'polygon', points: [[3, 0], [5, 0], [4, 2]], color: '#333', width: 0.03, gid: 'G1' });
    d.layers[0].items.push({ type: 'stencil', id: 'S', symbol: 'regenton', x: 5.7, y: 1.7, w: 0.6, h: 0.6, rot: 0, color: '#333', gid: 'G1' });
    a.openDoc(d, true); a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 250; a.cam.y = 200; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false;
    a.setTool('lasso'); a.setSelection(new Set(['A']));
  });
  await setup();
  const rect = await page.evaluate(() => { const r = document.querySelector('#canvas').getBoundingClientRect(); return [r.left, r.top]; });
  const handle = (hx, hy) => page.evaluate(([hx, hy]) => window.app.tool.handles().list.find((h) => h.kind === 'box' && h.hx === hx && h.hy === hy)?.s, [hx, hy]);
  const dragBy = async (s, dx, dy) => {
    await page.mouse.move(rect[0] + s[0], rect[1] + s[1]); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(rect[0] + s[0] + (dx * i) / 8, rect[1] + s[1] + (dy * i) / 8);
    await page.mouse.up();
  };
  const items = () => page.evaluate(() => Object.fromEntries(window.app.store.doc.layers[0].items.map((i) => [i.id, JSON.parse(JSON.stringify(i))])));

  console.log('Grepen');
  const kinds = await page.evaluate(() => ({ sel: [...window.app.selection].sort().join(), k: window.app.tool.handles().list.map((h) => h.kind) }));
  assert(kinds.sel === 'A,B,S', 'tik op één onderdeel selecteert de hele groep');
  assert(kinds.k.filter((k) => k === 'box').length === 8 && !kinds.k.includes('vertex') && !kinds.k.includes('insert'), '8 grepen om het geheel (4 hoeken, 4 zijmiddens), geen losse hoekpunten van onderdelen');

  console.log('Zijde verslepen');
  let s = await handle(1, 0.5);
  await dragBy(s, 3 * 80, 0); // groep is 6 m breed (0 … 6): rechterzijde 3 m verder = 50% breder
  let it = await items();
  const near = (a, b2, t = 0.03) => Math.abs(a - b2) < t;
  assert(near(it.B.points[1][0], 7.5) && near(it.A.points[1][0], 3) && near(it.A.points[0][0], 0), `rechterzijde 3 m naar rechts: alles 1,5× breder, linkerkant blijft (B: ${it.B.points[1][0].toFixed(2)}, A: ${it.A.points[1][0].toFixed(2)})`);
  assert(near(it.A.points[2][1], 1) && near(it.B.points[2][1], 2), 'hoogte blijft gelijk');
  assert(it.A.rect === true, 'rechthoek blijft een rechthoek');
  assert(near(it.S.x, 5.7 * 1.5) && near(it.S.w, 0.6, 1e-6) && near(it.S.h, 0.6, 1e-6), 'regenton schuift mee en blijft rond en even groot (alleen in de breedte gerekt)');
  await page.evaluate(() => window.app.store.undo());
  it = await items();
  assert(near(it.B.points[1][0], 5, 1e-6), 'ongedaan maken in één stap');

  console.log('Hoek verslepen');
  s = await handle(1, 1);
  await dragBy(s, 80, 80);
  it = await items();
  assert(it.B.points[2][1] > 2.3 && it.B.points[1][0] > 5.5 && near(it.A.points[0][0], 0) && near(it.A.points[0][1], 0), `hoek: breder en hoger, linksboven blijft (${it.B.points[1][0].toFixed(2)}, ${it.B.points[2][1].toFixed(2)})`);
  await page.screenshot({ path: path.join(OUT, 'groep-oprekken.png') });

  console.log('Open groep');
  await setup();
  await page.evaluate(() => { window.app.openGroup = 'G1'; window.app.setSelection(new Set(['B'])); });
  assert(await page.isVisible('#selection-bar [data-sel="closegroup"]'), 'open groep: knop "Groep sluiten"');
  await page.click('#selection-bar [data-sel="closegroup"]');
  const after = await page.evaluate(() => ({ og: window.app.openGroup, sel: [...window.app.selection].sort().join() }));
  assert(!after.og && after.sel === 'A,B,S', 'Groep sluiten: weer de hele groep geselecteerd');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle groep-oprek-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
