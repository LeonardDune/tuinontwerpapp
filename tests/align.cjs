// Uitlijnen en verdelen (zoals in een opmaakprogramma), midden-op-midden bij aansluiten, en het
// selectiekader bij meerdere elementen in de richting van de elementen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }
const R = (id, x0, y0, x1, y1, extra = {}) => ({ type: 'shape', id, kind: 'polygon', rect: true, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], color: '#333', width: 0.03, fill: '#9a9a96', fillAlpha: 0.5, ...extra });

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  const setup = (items, sel, rot = 0) => page.evaluate(async ([items, sel, rot]) => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Uitlijnen'); d.layers[0].items.push(...items);
    a.openDoc(d, true); a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 250; a.cam.y = 250; a.cameraChanged(); a.setViewAngleDeg(rot);
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = true; a.settings.grid = false;
    a.setTool('lasso'); a.setSelection(new Set(sel));
  }, [items, sel, rot]);
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  const pts = (id) => page.evaluate((id) => window.app.store.findItem(id).item.points, id);
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  console.log('Uitlijnknoppen');
  await setup([R('A', 0, 0, 2, 1), R('B', 3, 2, 4, 4), R('C', 6, 1, 9, 2)], ['A', 'B', 'C']);
  assert(await page.locator('#selection-bar [data-align]').count() === 8, 'balk: 6 uitlijnknoppen en 2 verdeelknoppen');
  await page.click('#selection-bar [data-align="left"]');
  assert(near((await pts('B'))[0][0], 0) && near((await pts('C'))[0][0], 0), 'links uitlijnen');
  await page.click('#btn-undo');
  await page.click('#selection-bar [data-align="centerH"]');
  const cx = async (id) => { const p = await pts(id); return (Math.min(...p.map((q) => q[0])) + Math.max(...p.map((q) => q[0]))) / 2; };
  assert(near(await cx('A'), 4.5) && near(await cx('B'), 4.5) && near(await cx('C'), 4.5), 'midden uitlijnen (horizontaal)');
  await page.click('#btn-undo');
  await page.click('#selection-bar [data-align="bottom"]');
  assert(near((await pts('A'))[2][1], 4) && near((await pts('C'))[2][1], 4), 'onder uitlijnen');
  await page.click('#btn-undo');
  await page.click('#selection-bar [data-align="distH"]');
  const a1 = await pts('A'), b1 = await pts('B'), c1 = await pts('C');
  const g1 = b1[0][0] - a1[1][0], g2 = c1[0][0] - b1[1][0];
  assert(near(g1, g2) && near(a1[0][0], 0) && near(c1[1][0], 9), `horizontaal gelijk verdelen (tussenruimte ${g1.toFixed(2)} m)`);
  await page.click('#btn-undo');

  console.log('Vaste onderlinge afstand');
  await setup([R('A', 0, 0, 2, 1), R('B', 2.7, 0.3, 3.7, 1.3), R('C', 6, -0.2, 9, 0.8)], ['A', 'B', 'C']);
  assert(await page.locator('#selection-bar input[data-k="spacing"]').count() === 1, 'veld "Afstand ↔" in de balk');
  await page.fill('#selection-bar input[data-k="spacing"]', '50');
  await page.press('#selection-bar input[data-k="spacing"]', 'Enter');
  const a2 = await pts('A'), b2 = await pts('B'), c2 = await pts('C');
  assert(near(a2[0][0], 0) && near(b2[0][0] - a2[1][0], 0.5) && near(c2[0][0] - b2[1][0], 0.5), 'elk 50 cm uit elkaar, de eerste blijft staan');
  assert(await page.inputValue('#selection-bar input[data-k="spacing"]') === '50', 'veld toont de gelijke afstand: 50');
  await page.click('#btn-undo');
  assert(near((await pts('B'))[0][0], 2.7), 'één keer ongedaan maken zet alles terug');
  await setup([R('A', 0, 0, 2, 1), R('B', 0.3, 1.8, 1.3, 2.8)], ['A', 'B']);
  assert(/↕/.test(await page.locator('#selection-bar').innerText()), 'twee vakken onder elkaar: "Afstand ↕"');
  await page.fill('#selection-bar input[data-k="spacing"]', '0');
  await page.press('#selection-bar input[data-k="spacing"]', 'Enter');
  assert(near((await pts('B'))[0][1], 1), 'afstand 0: precies tegen elkaar aan');

  console.log('Zelfde maat als het eerst geselecteerde');
  await setup([R('A', 0, 0, 3, 1.5), R('B', 4, 0, 5, 2), { type: 'stencil', id: 'S', symbol: 'schuur', x: 8, y: 1, w: 2, h: 2, rot: 0, color: '#6b4f3a' }, { type: 'shape', id: 'L', kind: 'line', points: [[0, 4], [1, 4]], color: '#333', width: 0.03 }], ['A', 'B', 'S', 'L']);
  await page.click('#selection-bar [data-same="w"]');
  const sz = async (id) => page.evaluate(async (id) => { const { itemSize } = await import('./js/edit.js'); return itemSize(window.app.store.findItem(id).item); }, id);
  let sb = await sz('B'), ss = await sz('S'), sl = await sz('L');
  assert(near(sb.w, 3) && near(sb.h, 2) && near(ss.w, 3) && near(sl.len, 3), 'zelfde breedte (3 m) voor vak, stencil en lijn; diepte blijft');
  await page.click('#selection-bar [data-same="h"]');
  sb = await sz('B');
  assert(near(sb.h, 1.5) && near(sb.w, 3), 'zelfde diepte (1,5 m)');
  await page.click('#btn-undo'); await page.click('#btn-undo');
  await page.click('#selection-bar [data-same="both"]');
  ss = await sz('S');
  assert(near(ss.w, 3) && near(ss.h, 1.5), 'zelfde maat (3 × 1,5 m)');
  assert(near((await pts('A'))[1][0], 3), 'het eerst geselecteerde blijft zoals het is');

  console.log('Spiegelen');
  await setup([
    { type: 'shape', id: 'Lv', kind: 'polygon', points: [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]], color: '#333', width: 0.03 },
    { type: 'stencil', id: 'St', symbol: 'bank', x: 2.5, y: 2.5, w: 1, h: 0.5, rot: 0.3, color: '#7a6a58' },
    { type: 'text', id: 'Tx', text: 'Terras', x: 0.5, y: 2, size: 0.3, color: '#222' },
  ], ['Lv', 'St', 'Tx']);
  assert(await page.locator('#selection-bar [data-flip]').count() === 2, 'knoppen horizontaal en verticaal spiegelen');
  await page.click('#selection-bar [data-flip="h"]');
  const lv = await pts('Lv');
  const ex = lv.map((p) => p[0]);
  const st = await page.evaluate(() => window.app.store.findItem('St').item);
  const tx = await page.evaluate(() => window.app.store.findItem('Tx').item);
  // selectie loopt van x = 0 tot ca. 3,05 (bank steekt iets uit); L-vorm: de poot staat nu rechts
  const mx = Math.max(...ex);
  assert(near(lv[4][0], mx - 1) && near(lv[0][0], mx) && near(lv[2][1], 1), 'L-vorm horizontaal gespiegeld (de poot staat nu rechts)');
  assert(st.mirror === true && Math.abs(Math.sin(st.rot - (Math.PI - 0.3) + Math.PI)) < 1e-9 && !tx.rot, 'stencil gespiegeld (en draaiing gespiegeld), tekst blijft leesbaar');
  await page.click('#selection-bar [data-flip="v"]');
  const lv2 = await pts('Lv');
  assert(near(Math.min(...lv2.map((p) => p[1])), Math.min(...lv.map((p) => p[1]))) && near(lv2[2][1], Math.max(...lv.map((p) => p[1])) + Math.min(...lv.map((p) => p[1])) - 1), 'verticaal gespiegeld (boven ↕ onder)');
  await page.click('#btn-undo'); await page.click('#btn-undo');
  assert(JSON.stringify(await pts('Lv')) === JSON.stringify([[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]]), 'ongedaan maken: terug naar het origineel');

  await setup([{ type: 'shape', id: 'W', kind: 'line', wall: true, points: [[0, 0], [5, 0], [5, 4]], color: '#2f2f2f', width: 0.3 }, { type: 'stencil', id: 'D', symbol: 'deur', x: 1.5, y: 0, w: 0.93, h: 0.3, rot: 0, color: '#2f2f2f', wallId: 'W', wallSeg: 0, wallT: 0.3, wallSide: 1 }], ['W']);
  await page.click('#selection-bar [data-flip="h"]');
  const door = await page.evaluate(async () => { const { distToSegment } = await import('./js/geom.js'); const a = window.app; const w = a.store.findItem('W').item, d = a.store.findItem('D').item; return { dist: distToSegment([d.x, d.y], w.points[0], w.points[1]), x: d.x, wx: w.points[0][0] }; });
  assert(door.dist < 1e-6 && near(door.x, 3.5), `deur blijft in de gespiegelde muur (x = ${door.x.toFixed(2)})`);

  console.log('Gedraaide vakken: uitlijnen in hun eigen richting');
  const rot = (ps, deg) => ps.map(([x, y]) => { const r = deg * Math.PI / 180; return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]; });
  const RR = (id, x0, y0, x1, y1) => R(id, 0, 0, 0, 0, { points: rot([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 25) });
  await setup([RR('P', 0, 0, 3, 1), RR('Q', 1, 2, 2, 3)], ['P', 'Q']);
  const hb = await page.evaluate(() => window.app.tool.handles().outline);
  const ang = Math.atan2(hb[1][1] - hb[0][1], hb[1][0] - hb[0][0]) * 180 / Math.PI;
  assert(Math.abs(ang - 25) < 1e-6, `selectiekader in de richting van de vakken (${ang.toFixed(2)}°)`);
  await page.click('#selection-bar [data-align="left"]');
  const q = rot(await pts('Q'), -25);
  assert(near(q[0][0], 0), 'links uitlijnen langs de richting van de vakken');
  await page.screenshot({ path: path.join(OUT, 'uitlijnen-gedraaid.png') });

  console.log('Kader bij gedraaid beeld');
  await setup([R('A', 0, 0, 2, 1), R('B', 0, 2, 4, 3)], ['A', 'B'], 30);
  const hc = await page.evaluate(() => window.app.tool.handles().outline);
  const top = Math.atan2(hc[1][1] - hc[0][1], hc[1][0] - hc[0][0]) * 180 / Math.PI;
  assert(Math.abs(Math.sin(2 * (top - 30) * Math.PI / 180)) < 1e-6, `kader volgt de vakken, ook bij een gedraaid beeld (${top.toFixed(1)}°)`);

  console.log('Midden op midden bij aansluiten');
  await setup([R('T', 0, 0, 6, 2), R('U', 1.3, 3, 5.3, 4.5)], ['U']);
  // U (4 m breed) onder T schuiven, bijna midden: midden van T = 3, U komt op 3,04
  const [x0, y0] = await S(3.3, 3.7), [x1, y1] = await S(3.04, 2.72);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 8 });
  const info = await page.evaluate(() => window.app.tool.liveInfo);
  const gl = await page.evaluate(() => window.app.tool.guides);
  await page.screenshot({ path: path.join(OUT, 'midden-op-midden.png') });
  await page.mouse.up();
  const u = await pts('U');
  assert(near(u[0][1], 2) && near((u[0][0] + u[1][0]) / 2, 3) && /midden op midden/.test(info) && gl?.lines?.length, `sluit aan én midden op midden ("${info}")`);

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle uitlijn-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
