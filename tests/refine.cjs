// Beplanting, stap 3 (verfijnen): kies een plant, kies hoeveel, tik in het vak → een groepje op maat.
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
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { roleFromPlant, plantById } = await import('./js/plantdb.js');
    const d = newDoc('Verfijnen');
    const role = (id, pid, code, rl) => ({ id, code, role: rl, ...roleFromPlant(plantById(pid)) });
    d.planting = { roles: [role('r1', 'kattenkruid', 'V1', 'vulling'), role('r2', 'zonnehoed', 'S1', 'structuur'), role('r3', 'lampenpoetsergras', 'S2', 'structuur')], scheme: { type: 'vrij' } };
    d.layers[0].items.push({ type: 'shape', id: 'V', kind: 'polygon', bed: true, btype: 'middel', points: [[0, 0], [6, 0], [6, 3], [0, 3]], color: '#3f7a2e', width: 0.03, planting: { mix: [{ role: 'r1', w: 60 }, { role: 'r2', w: 25 }, { role: 'r3', w: 15 }] } });
    a.openDoc(d, true); a.cam.zoom = 90; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 200; a.cameraChanged();
    a.state.plantShape = 'boog'; // oude instelling die vroeger een halve cirkel gaf
    a.setTool('lasso'); a.setSelection(new Set(['V']));
    a.state.plantStep = 3; a.plantPanel.open();
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);

  const panel = page.locator('#plant-panel');
  assert(await panel.getByText('1. Welke plant?').isVisible() && await panel.getByText('2. Hoeveel?').isVisible() && await panel.getByText('3. Tik in de tekening').isVisible(), 'stap 3 in drie duidelijke keuzes');
  assert(await panel.locator('[data-g3role="r2"]').innerText().then((t) => /Zonnehoed/i.test(t)), 'planten staan er met hun naam (niet met een code)');
  await panel.locator('[data-g3role="r2"]').click();
  await panel.locator('[data-g3n="5"]').click();
  const st = await page.evaluate(() => ({ tool: window.app.state.tool, mode: window.app.state.plantMode, n: window.app.state.groupCount, role: window.app.state.plantRole }));
  assert(st.tool === 'plant' && st.mode === 'groep' && st.n === 5 && st.role === 'r2', 'zonnehoed en "Groepje van 5" kiezen zet het gereedschap klaar');
  // voorbeeld onder de muis
  const [hx, hy] = await S(2, 1.5);
  await page.mouse.move(hx, hy);
  const prev = await page.evaluate(() => { const t = window.app.tool; return !!t.blobAt(t.hoverW || [2, 1.5]); });
  assert(prev, 'je ziet vooraf waar het groepje komt');
  await page.mouse.click(hx, hy);
  const g = await page.evaluate(async () => {
    const a = window.app; const { polygonArea, polygonCentroid, pointInPolygon } = await import('./js/geom.js'); const { layoutPoints, rolesMap, roleSpacing } = await import('./js/planting.js');
    const grp = a.store.doc.layers[0].items.filter((i) => i.group);
    const it = grp[0]; if (!it) return null;
    const roles = rolesMap(a.store.doc);
    const pts = layoutPoints(it.points, it.planting.mix, roles, it.id);
    const sp = roleSpacing(roles.r2);
    return { n: grp.length, arc: !!it.arc, mix: it.planting.mix, area: Math.abs(polygonArea(it.points)), expect: 5 * sp * sp, inBed: pointInPolygon(polygonCentroid(it.points), [[0, 0], [6, 0], [6, 3], [0, 3]]), plants: pts.length, bedId: it.bedId, nPts: it.points.length };
  });
  assert(g && g.n === 1 && !g.arc && g.nPts > 10, 'een tik in het vak legt een groepje met een natuurlijke vorm (geen halve cirkel meer)');
  assert(g.mix.length === 1 && g.mix[0].role === 'r2' && g.bedId === 'V' && g.inBed, 'het groepje bestaat uit zonnehoed en hoort bij dit vak');
  assert(g.area > g.expect * 0.8 && g.area < g.expect * 1.3 && g.plants >= 3 && g.plants <= 8, `zo groot als 5 planten nodig hebben (${g.area.toFixed(2)} m², ${g.plants} planten)`);
  // buiten een vak: niets
  const [ox, oy] = await S(8, 1.5);
  await page.mouse.click(ox, oy);
  assert(await page.evaluate(() => window.app.store.doc.layers[0].items.filter((i) => i.group).length) === 1, 'buiten een plantvak gebeurt niets');
  // zelf een omtrek slepen
  const pts = [[4, 0.6], [5.2, 0.8], [5.4, 2.2], [4.2, 2.4], [3.8, 1.4], [4, 0.6]];
  const s0 = await S(...pts[0]); await page.mouse.move(...s0); await page.mouse.down();
  for (const p of pts.slice(1)) { const q = await S(...p); await page.mouse.move(...q, { steps: 6 }); }
  await page.mouse.up();
  const drawn = await page.evaluate(async () => { const { polygonArea } = await import('./js/geom.js'); const gs = window.app.store.doc.layers[0].items.filter((i) => i.group); const last = gs[gs.length - 1]; return { n: gs.length, area: Math.abs(polygonArea(last.points)), role: last.planting.mix[0].role }; });
  assert(drawn.n === 2 && drawn.area > 1.2 && drawn.role === 'r2', `een omtrek slepen maakt een groepje in die vorm (${drawn.area.toFixed(1)} m²)`);
  await page.screenshot({ path: path.join(OUT, 'verfijnen-groepjes.png') });
  // losse plant
  await panel.locator('[data-g3role="r3"]').click();
  await panel.locator('[data-g3n="1"]').click();
  const [lx, ly] = await S(1, 0.8);
  await page.mouse.click(lx, ly);
  const sol = await page.evaluate(() => window.app.store.doc.layers[0].items.filter((i) => i.type === 'plant').map((i) => i.role));
  assert(sol.length === 1 && sol[0] === 'r3', '"1 losse plant" zet één lampenpoetsergras');
  // optiebalk onderin zegt hetzelfde
  await panel.locator('[data-g3n="7"]').click();
  const bar = await page.locator('#optionsbar').innerText();
  assert(/Groepje/.test(bar) && /7 planten/.test(bar) && /Lampenpoets/i.test(bar) && !/Rechthoek|Boog/.test(bar), 'de balk onderin: groepje, aantal en plant met naam, zonder vormkeuze');
  // het paneel blijft over het vak gaan waarin je werkt, ook nu de selectie weg is (gereedschap Beplanten)
  const focus = await page.evaluate(() => ({ sel: window.app.selection.size, head: document.querySelector('#plant-panel .focus')?.textContent || '', auto: !!document.querySelector('#plant-panel [data-plan="suggest"]') }));
  assert(focus.sel === 0 && /Plantvak/.test(focus.head) && /2 groepjes/.test(focus.head) && focus.auto, `zonder selectie blijft het paneel over dit vak gaan (${focus.head.trim().replace(/\s+/g, ' ')})`);
  await page.evaluate(() => {
    const a = window.app; const d = a.store.doc;
    a.store.mutate(() => d.layers[0].items.push({ type: 'shape', id: 'W', name: 'Voortuin', kind: 'polygon', bed: true, btype: 'laag', points: [[0, 4], [3, 4], [3, 6], [0, 6]], color: '#3f7a2e', width: 0.03, planting: { mix: [] } }));
    a.setTool('lasso'); a.setSelection(new Set(['W']));
  });
  const head2 = await page.locator('#plant-panel .focus').innerText();
  assert(/Voortuin/.test(head2) && /nog leeg/.test(head2), 'een ander vak selecteren: het paneel gaat over dat vak (Voortuin, nog leeg)');
  await page.evaluate(() => { window.app.state.plantStep = 1; window.app.plantPanel.render(); });
  assert(await page.locator('#plant-panel').getByText('Type van Voortuin').isVisible(), 'stap 1 zegt ook over welk vak het gaat');
  await page.locator('#plant-panel [data-act="unfocus"]').click();
  assert(await page.locator('#plant-panel').getByText('Alle plantvakken').isVisible() && !(await page.evaluate(() => window.app.selection.size)), '"Alle vakken" gaat terug naar het overzicht');
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle verfijn-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
