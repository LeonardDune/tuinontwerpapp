// Willekeurige bestrating: losse stenen (kinderkopjes, waalklinkers) in het raster van een verband, gestrooid
// met een penseel of in groepjes in een vak met een rafelige rand, met grind ertussen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { BOND_PRESETS } = await import('./js/bonds.js');
    const d = newDoc('Strooien');
    const k = BOND_PRESETS['n-kinderkopjes'];
    d.layers[0].items.push({ type: 'shape', id: 'P', kind: 'polygon', points: [[0, 0], [4, 0], [4, 2.5], [0, 2.5]], color: '#444', width: 0.02, hatch: 'bond', bond: { ...k.bond }, bondName: k.name });
    a.openDoc(d, true); a.cam.zoom = 110; a.cam.rot = 0; a.cam.x = 120; a.cam.y = 120; a.cameraChanged();
    a.setTool('lasso'); a.setSelection(new Set(['P']));
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);

  console.log('Vak met rafelige rand');
  assert(await page.locator('#selection-bar [data-act="scatterize"]').isVisible(), 'knop "Willekeurig strooien" bij een verhardingsvak');
  await page.click('#selection-bar [data-act="scatterize"]');
  const r1 = await page.evaluate(async () => {
    const a = window.app; const { cellRect, stonesFrame } = await import('./js/scatter.js'); const { pointInPolygon } = await import('./js/geom.js');
    const it = [...a.selection].map((id) => a.store.findItem(id).item)[0];
    const P = a.store.findItem('P').item;
    const F = stonesFrame(it);
    const centers = it.cells.map((c) => { const r = cellRect(F, ...c); return [F.o[0] + (r[0] + r[2] / 2) * F.c - (r[1] + r[3] / 2) * F.s, F.o[1] + (r[0] + r[2] / 2) * F.s + (r[1] + r[3] / 2) * F.c]; });
    const inside = centers.every((p) => pointInPolygon(p, [[0, 0], [4, 0], [4, 2.5], [0, 2.5]]));
    // rand (binnen 0,3 m van de rand) is dunner bezet dan het midden
    const edgeN = centers.filter((p) => Math.min(p[0], 4 - p[0], p[1], 2.5 - p[1]) < 0.35).length;
    const midN = centers.length - edgeN;
    const full = Math.round(4 * 2.5 / (0.16 * 0.16));
    return { type: it.type, n: it.cells.length, inside, edgeN, midN, full, under: P.bond.type, underName: P.bondName, w: Math.max(...it.cells.map((c) => cellRect(F, ...c)[2])) };
  });
  assert(r1.type === 'stones' && r1.n > r1.full * 0.3 && r1.n < r1.full * 0.8, `${r1.n} kinderkopjes gestrooid (van ca. ${r1.full} bij een vol vak)`);
  assert(r1.inside, 'alle stenen liggen binnen het vak');
  assert(Math.abs(r1.w - 0.14) < 0.002, 'stenen houden hun maat (14 cm)');
  assert(r1.under === 'halfverharding' && /grind/i.test(r1.underName), 'het vak zelf wordt grind (tussen de stenen)');
  const dens = await page.evaluate(async () => {
    const a = window.app; const it = [...a.selection].map((id) => a.store.findItem(id).item)[0];
    const n0 = it.cells.length; const key = JSON.stringify(it.cells.slice(0, 20));
    a.regenScatter(it, { density: 0.3 }); const nLow = it.cells.length;
    a.regenScatter(it, { density: 1, edge: 0 }); const nFull = it.cells.length;
    a.regenScatter(it, { density: 0.6, edge: 0.5, seed: 4242 }); const key2 = JSON.stringify(it.cells.slice(0, 20));
    return { n0, nLow, nFull, other: key !== key2 };
  });
  assert(dens.nLow < dens.n0 * 0.8 && dens.nFull > dens.n0, `Dichtheid: 30% → ${dens.nLow}, 100% zonder rafelrand → ${dens.nFull} stenen`);
  assert(dens.other, 'Opnieuw geeft een ander patroon');
  // aantikken met het selectiegereedschap: steen of grind ernaast → het steenveld; ver ervan → het grindvak
  const pickTest = await page.evaluate(async () => {
    const a = window.app; const { stonesList } = await import('./js/scatter.js');
    const it = a.store.doc.layers[0].items.find((i) => i.type === 'stones');
    const list = stonesList(it);
    const st = list[Math.floor(list.length / 2)];
    a.setTool('lasso'); a.setSelection(new Set());
    const tool = a.tools.lasso;
    const onStone = tool.pickAt(st.c)?.item.type;
    const beside = tool.pickAt([st.c[0] + 0.09, st.c[1]])?.item.type;
    // een plek in het grind zonder stenen in de buurt
    let far = null;
    for (let x = 0.2; x < 3.8 && !far; x += 0.1) for (let y = 0.2; y < 2.3; y += 0.1) if (!list.some((q) => Math.hypot(q.c[0] - x, q.c[1] - y) < 0.35)) { far = [x, y]; break; }
    const farPick = far ? tool.pickAt(far)?.item.type : 'shape';
    return { onStone, beside, farPick, id: it.id };
  });
  assert(pickTest.onStone === 'stones' && pickTest.beside === 'stones', 'aantikken van een steen (of het grind ernaast) selecteert de gestrooide stenen');
  assert(pickTest.farPick === 'shape', 'een tik ver van de stenen selecteert het grindvak eronder');
  const sp = await page.evaluate(async () => { const { stonesList } = await import('./js/scatter.js'); const a = window.app; const it = a.store.doc.layers[0].items.find((i) => i.type === 'stones'); return stonesList(it)[5].c; });
  const [px, py] = await S(...sp);
  await page.mouse.click(px, py);
  assert(await page.evaluate(() => { const a = window.app; return [...a.selection].map((id) => a.store.findItem(id).item.type).join() === 'stones'; }), 'met de muis/vinger aantikken werkt ook');
  assert(await page.locator('#selection-bar [data-scatter="density"]').isVisible(), 'daarna zijn Dichtheid, Rafelrand en Opnieuw aan te passen');
  await page.screenshot({ path: path.join(OUT, 'strooien-vak.png'), clip: { x: box.x, y: box.y, width: 700, height: 500 } });

  console.log('Penseel');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    a.openDoc(newDoc('Penseel'), true); a.cam.zoom = 110; a.cam.rot = 0; a.cam.x = 120; a.cam.y = 120; a.cameraChanged();
    a.state.paveBlock = 'pre:k-half-waal'; a.state.paveShape = 'strooien'; a.state.scatterSize = 0.5; a.state.scatterDensity = 0.7; a.state.scatterErase = false;
    a.setTool('pave');
  });
  assert(await page.locator('#optionsbar').getByText('Strooien').isVisible(), 'Verharden › Strooien in de optiebalk');
  const stroke = async (pts) => {
    const s0 = await S(...pts[0]);
    await page.mouse.move(...s0); await page.mouse.down();
    for (const p of pts.slice(1)) { const s = await S(...p); await page.mouse.move(...s, { steps: 6 }); }
    await page.mouse.up();
  };
  await stroke([[0.5, 1], [2, 1.2], [3.5, 1]]);
  const s1 = await page.evaluate(async () => {
    const a = window.app; const { stonesFrame, cellRect } = await import('./js/scatter.js');
    const its = a.store.doc.layers.flatMap((l) => l.items).filter((i) => i.type === 'stones');
    const it = its[0]; const F = stonesFrame(it);
    const keys = new Set(it.cells.map((c) => c.join()));
    // stenen overlappen nooit (raster van het verband)
    const rects = it.cells.map((c) => cellRect(F, ...c));
    let overlap = 0;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const p = rects[i], q = rects[j]; if (p[0] < q[0] + q[2] - 1e-6 && q[0] < p[0] + p[2] - 1e-6 && p[1] < q[1] + q[3] - 1e-6 && q[1] < p[1] + p[3] - 1e-6) overlap++; }
    return { count: its.length, n: it.cells.length, uniq: keys.size, overlap, len: Math.max(...rects.map((r) => Math.max(r[2], r[3]))), name: it.bondName };
  });
  assert(s1.count === 1 && s1.n > 15, `één penseelstreek strooit ${s1.n} waalklinkers`);
  assert(s1.uniq === s1.n && s1.overlap === 0, 'de stenen liggen in het raster van het halfsteens verband (geen overlap)');
  assert(Math.abs(s1.len - 0.2) < 0.003, 'waalklinkers houden hun maat (20 cm), met een bredere grindvoeg');
  await stroke([[0.5, 1], [2, 1.2], [3.5, 1]]);
  const n2 = await page.evaluate(() => window.app.store.doc.layers.flatMap((l) => l.items).find((i) => i.type === 'stones').cells.length);
  assert(n2 > s1.n, `nog een keer erover = voller (${s1.n} → ${n2}), in hetzelfde veld`);
  await page.evaluate(() => { window.app.state.scatterErase = true; window.app.renderOptions(); });
  await stroke([[1.6, 0.6], [1.6, 1.6]]);
  const n3 = await page.evaluate(() => window.app.store.doc.layers.flatMap((l) => l.items).find((i) => i.type === 'stones').cells.length);
  assert(n3 < n2, `Weghalen haalt stenen weg (${n2} → ${n3})`);
  await page.evaluate(() => { window.app.undo ? window.app.undo() : window.app.store.undo(); });
  const n4 = await page.evaluate(() => window.app.store.doc.layers.flatMap((l) => l.items).find((i) => i.type === 'stones').cells.length);
  assert(n4 === n2, 'ongedaan maken zet de stenen terug');

  console.log('Selecteren, verplaatsen, overzicht en 3D');
  const sel = await page.evaluate(async () => {
    const a = window.app; const { hitItem, transformItem } = await import('./js/items.js');
    const it = a.store.doc.layers.flatMap((l) => l.items).find((i) => i.type === 'stones');
    const { stonesList } = await import('./js/scatter.js');
    const st = stonesList(it)[0];
    const hit = hitItem(it, st.c, 0.01), miss = hitItem(it, [10, 10], 0.01);
    const o0 = [...it.origin];
    a.store.mutate(() => transformItem(it, [1, 0, 0, 1, 1, 0.5], 1, 0));
    const st2 = stonesList(it)[0];
    a.pavePanel.open();
    const row = [...document.querySelectorAll('#pave-panel .sk li')].map((li) => li.textContent).find((t) => /gestrooid/.test(t)) || '';
    const { buildGarden } = await import('./js/scene3d.js');
    if (!window.Tuin3D) { const w = await import('./js/walk.js'); await w.loadTuin3D(); }
    const g = buildGarden(window.Tuin3D.THREE, a.store.doc, { month: 6 });
    let inst = 0; g.group.traverse((o) => { if (o.isInstancedMesh && o.material?.name === 'stenen') inst += o.count; });
    return { hit, miss, moved: Math.abs(st2.c[0] - st.c[0] - 1) < 1e-6 && Math.abs(st2.c[1] - st.c[1] - 0.5) < 1e-6 && it.origin[0] === o0[0] + 1, row, inst, n: it.cells.length };
  });
  assert(sel.hit && !sel.miss, 'een steen aantikken selecteert het veld (ernaast niet)');
  assert(sel.moved, 'het veld verschuift als geheel, de stenen blijven in hun raster');
  assert(/gestrooid/.test(sel.row) && sel.row.includes(`${sel.n}`), 'overzicht in Verharding: aantal gestrooide stenen');
  assert(sel.inst === sel.n, `in 3D liggen ${sel.inst} losse stenen`);
  await page.evaluate(() => window.app.pavePanel.close());
  await page.screenshot({ path: path.join(OUT, 'strooien-penseel.png'), clip: { x: box.x, y: box.y, width: 700, height: 400 } });
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle strooi-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
