// Groeperen (los maar als één geheel) en samenvoegen (één vlak).
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }
const R = (id, x0, y0, x1, y1, extra = {}) => ({ type: 'shape', id, kind: 'polygon', rect: true, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], color: '#333', width: 0.04, fill: '#7a9a5a', fillAlpha: 0.3, ...extra });

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  const setup = (items, sel) => page.evaluate(async ([items, sel]) => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Groep'); d.layers[0].items.push(...items);
    d.planting = { scheme: { type: 'vrij', base: '#8e5bb5' }, roles: [] };
    a.openDoc(d, true); a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 250; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false;
    a.setTool('lasso'); a.setSelection(new Set(sel));
  }, [items, sel]);
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  const sel = () => page.evaluate(() => [...window.app.selection].sort().join());
  const item = (id) => page.evaluate((id) => { const f = window.app.store.findItem(id); return f ? JSON.parse(JSON.stringify(f.item)) : null; }, id);
  const tap = async (x, y) => { const [sx, sy] = await S(x, y); await page.mouse.click(sx, sy); };

  console.log('Groeperen');
  await setup([R('A', 0, 0, 2, 1), R('B', 2, 0, 4, 1), R('C', 0, 3, 1, 4)], ['A', 'B']);
  await page.click('#selection-bar [data-sel="group"]');
  const gA = (await item('A')).gid;
  assert(gA && gA === (await item('B')).gid && !(await item('C')).gid, 'A en B vormen een groep');
  await page.evaluate(() => window.app.setSelection(new Set()));
  await tap(0.5, 0.5);
  assert(await sel() === 'A,B', 'tik op één vak selecteert de hele groep');
  assert(/Groep van 2/.test(await page.locator('#selection-bar .count').innerText()), 'balk: "Groep van 2"');
  {
    const [x0, y0] = await S(1, 0.5), [x1, y1] = await S(2, 1.5);
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  }
  assert((await item('A')).points[0][0] === 1 && (await item('B')).points[0][0] === 3, 'verschuiven: de hele groep schuift mee');
  await page.click('#btn-undo');

  console.log('Dubbeltik: één element in de groep');
  await page.evaluate(() => window.app.setSelection(new Set()));
  await tap(3, 0.5);
  await page.waitForTimeout(80);
  await tap(3, 0.5);
  assert(await sel() === 'B', `dubbeltik opent de groep: alleen B geselecteerd (${await sel()})`);
  assert(/in groep/.test(await page.locator('#selection-bar .count').innerText()), 'balk: "(in groep)"');
  await page.screenshot({ path: path.join(OUT, 'groep-open.png') });
  await page.fill('#selection-bar input[data-k="w"]', '3');
  await page.press('#selection-bar input[data-k="w"]', 'Enter');
  const bw = await item('B');
  assert(Math.abs(bw.points[1][0] - bw.points[0][0] - 3) < 1e-6 && (await item('A')).points[1][0] === 2, 'alleen B is breder gemaakt');
  await tap(0.5, 3.5);
  assert(await sel() === 'C' && !(await page.evaluate(() => window.app.openGroup)), 'tik ernaast: groep weer dicht');
  await tap(0.5, 0.5);
  assert(await sel() === 'A,B', 'daarna weer de hele groep');

  console.log('Dupliceren en opheffen');
  await page.keyboard.press('Control+d');
  const dup = await page.evaluate(() => [...window.app.selection].map((id) => window.app.store.findItem(id).item.gid));
  assert(dup.length === 2 && dup[0] === dup[1] && dup[0] !== gA, 'kopie van een groep is een eigen groep');
  await page.click('#btn-undo');
  await page.evaluate(() => window.app.setSelection(new Set(['A'])));
  await page.click('#selection-bar [data-sel="ungroup"]');
  assert(!(await item('A')).gid && !(await item('B')).gid, 'groep opgeheven');
  await page.evaluate(() => window.app.setSelection(new Set(['A', 'B', 'C'])));
  await page.keyboard.press('Control+g');
  assert((await item('C')).gid && (await item('C')).gid === (await item('A')).gid, 'Ctrl+G groepeert');

  console.log('Samenvoegen');
  await setup([
    R('P1', 0, 0, 3, 2, { planting: { mix: [] }, bed: true, color: '#3f7a2e' }),
    R('P2', 3, 0, 4, 4, { planting: { mix: [] }, bed: true, hatch: 'gras' }),
    R('G', 3.2, 2.5, 3.8, 3.5, { group: true, bedId: 'P2', planting: { mix: [] } }),
    R('X', 6, 0, 7, 1),
  ], ['P1', 'P2']);
  await page.click('#selection-bar [data-sel="merge"]');
  const m = await item('P1');
  assert(!(await item('P2')) && m.points.length === 6, `L-vormig vak met 6 hoeken (${m.points.length})`);
  assert(m.bed && !m.hatch && m.color === '#3f7a2e', 'instellingen van het grootste vak blijven');
  assert((await item('G')).bedId === 'P1', 'groep uit het kleine vak hoort nu bij het samengevoegde vak');
  await page.screenshot({ path: path.join(OUT, 'samengevoegd.png') });
  await page.click('#btn-undo');
  assert(await item('P2') && (await item('P1')).points.length === 4, 'ongedaan maken: weer twee vakken');
  await page.evaluate(() => window.app.setSelection(new Set(['P1', 'X'])));
  await page.click('#selection-bar [data-sel="merge"]');
  assert(await item('X') && /raken elkaar niet/.test(await page.locator('#toast').innerText()), 'losse vakken: niet samengevoegd, met uitleg');
  await page.evaluate(() => window.app.setSelection(new Set(['P1', 'P2'])));
  await page.evaluate(() => { const a = window.app; const p2 = a.store.findItem('P2').item; a.store.mutate(() => { p2.points = [[3, 0], [5, 0], [5, 2], [3, 2]]; }); a.setSelection(new Set(['P1', 'P2'])); });
  await page.click('#selection-bar [data-sel="merge"]');
  assert((await item('P1')).rect === true && (await item('P1')).points.length === 4, 'twee even hoge rechthoeken worden weer een rechthoek (met maatgrepen)');

  console.log('Veranda om de hoek (stencils samenvoegen)');
  await setup([
    { type: 'stencil', id: 'V1', symbol: 'verandaterras', x: 2.5, y: 1.75, w: 5, h: 3.5, rot: 0, color: '#4a4f55', height: 2.6 },
    { type: 'stencil', id: 'V2', symbol: 'verandaterras', x: 6.5, y: 3.5, w: 3, h: 7, rot: 0, color: '#4a4f55' },
    { type: 'stencil', id: 'T', symbol: 'tafelrond', x: 2, y: 2, w: 2.4, h: 2.4, rot: 0, color: '#7a6a58' },
  ], ['V1', 'V2', 'T']);
  assert(await page.locator('#selection-bar [data-sel="merge"]').count() === 1, 'knop Samenvoegen bij twee veranda-stencils (de tafel doet niet mee)');
  await page.click('#selection-bar [data-sel="merge"]');
  const v = await item('V2');
  assert(v && v.type === 'shape' && v.hatch === 'veranda' && v.points.length === 6 && !(await item('V1')) && await item('T'), `één L-vormige veranda met glazen dak (${v && v.points.length} hoeken), de tafel blijft staan`);
  await page.evaluate(() => { const a = window.app; a.setSelection(new Set()); a.render(); });
  await page.screenshot({ path: path.join(OUT, 'veranda-om-de-hoek.png') });
  await page.click('#btn-undo');
  await page.evaluate(() => window.app.setSelection(new Set(['V1'])));
  await page.click('#selection-bar [data-sel="toshape"]');
  const v1 = await item('V1');
  assert(v1.type === 'shape' && v1.rect && v1.hatch === 'veranda' && v1.height === 2.6, 'los stencil omzetten naar vlak (hoogte blijft)');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle groep-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
