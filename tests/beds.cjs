// Beplantingsplan V2.2: plantvakken (tekenen, tik in ruimte, omzetten), groepen (tekenen, voorstellen),
// solitairen en de koppeling van plantstencils aan bouwstenen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app;
    const { newDoc } = await import('./js/model.js');
    const { newRole } = await import('./js/planting.js');
    const doc = newDoc('Vakken');
    const roles = [];
    const s = newRole(roles, 'structuur'); s.height = 'hoog'; roles.push(s);
    const s2 = newRole(roles, 'structuur'); s2.height = 'middel'; s2.habit = 'overhangend'; s2.form = 'pluim'; roles.push(s2);
    const v = newRole(roles, 'vulling'); roles.push(v);
    const acc = newRole(roles, 'accent'); acc.color = '#e8822e'; roles.push(acc);
    doc.planting = { scheme: { type: 'vrij', base: '#8e5bb5' }, roles };
    const L = doc.layers[0];
    // ontwerp: rechthoek 8 × 4 m met een pad (lijn) op x = 5, en los daarvan een cirkel
    L.items.push({ type: 'shape', id: 'border', kind: 'polygon', rect: true, points: [[0, 0], [8, 0], [8, 4], [0, 4]], color: '#1d2b36', width: 0.035 });
    L.items.push({ type: 'shape', id: 'pad', kind: 'line', points: [[5, 0], [5, 4]], color: '#1d2b36', width: 0.035 });
    L.items.push({ type: 'shape', id: 'rond', kind: 'circle', points: [[11, 2], [12.5, 2]], color: '#1d2b36', width: 0.035 });
    a.openDoc(doc, true);
    a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 200; a.cam.y = 250; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false;
    a.state.plantMix = []; a.state.plantMode = 'vak'; a.state.plantShape = 'tik'; a.state.plantView = 'planten';
    a.setTool('plant');
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (wx, wy) => [box.x + 200 + wx * 80, box.y + 250 + wy * 80];
  const click = async (wx, wy) => { const [x, y] = S(wx, wy); await page.mouse.click(x, y); };
  const items = () => page.evaluate(() => JSON.parse(JSON.stringify(window.app.store.doc.layers[0].items)));
  const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };

  console.log('Plantvak: tik in ruimte');
  assert(await page.isVisible('#optionsbar button[data-s="tik"].on'), 'optie "Tik in ruimte" gekozen');
  await click(2, 2);
  let its = await items();
  let beds = its.filter((i) => i.bed);
  assert(beds.length === 1, 'plantvak gevonden links van het pad');
  const A1 = area(beds[0].points);
  assert(Math.abs(A1 - 20) < 0.4, `oppervlak ${A1.toFixed(2)} m² ≈ 20 m² (5 × 4, volgt de lijnen)`);
  assert(beds[0].points.every((p) => p[0] > -0.06 && p[0] < 5.06 && p[1] > -0.06 && p[1] < 4.06), 'rand ligt op de rechthoek en het pad');
  await click(2.5, 1.5);
  assert((await items()).filter((i) => i.bed).length === 1 && /al een plantvak/.test(await page.locator('#toast').innerText()), 'nogmaals tikken in hetzelfde vak: geen dubbel vak');
  await click(6.5, 2);
  its = await items();
  beds = its.filter((i) => i.bed);
  assert(beds.length === 2 && Math.abs(area(beds[1].points) - 12) < 0.4, `tweede vak rechts van het pad ≈ 12 m² (${area(beds[1].points).toFixed(2)})`);
  await click(11, 2.5);
  its = await items();
  const circ = its.filter((i) => i.bed).pop();
  assert(circ.kind === 'circle' && Math.abs(circ.points[1][0] - 12.5) < 1e-6, 'binnen de cirkel: het vak neemt de cirkel exact over');
  const before = its.length;
  await click(9.3, 5.5);
  assert((await items()).length === before, 'buiten een gesloten vlak: geen vak');
  assert(/niet gesloten/.test(await page.locator('#toast').innerText()), 'melding: vlak niet gesloten');

  console.log('Plantvak: rechthoek tekenen');
  await page.click('#optionsbar button[data-s="rechthoek"]');
  {
    const [x0, y0] = S(0, 5), [x1, y1] = S(3, 7);
    await page.mouse.move(x0, y0); await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up();
  }
  its = await items();
  const rb = its.filter((i) => i.bed).pop();
  assert(rb.rect && Math.abs(area(rb.points) - 6) < 0.05, 'rechthoekig plantvak 3 × 2 m');

  console.log('Groepen');
  await page.click('#optionsbar .seg button[data-m="groep"]');
  await page.click('#optionsbar button[data-s="vrij"]');
  await page.click('#optionsbar .chip >> nth=0'); // S1
  const draw = async (pts) => {
    const [sx, sy] = S(...pts[0]);
    await page.mouse.move(sx, sy); await page.mouse.down();
    for (const p of pts.slice(1)) { const [x, y] = S(...p); await page.mouse.move(x, y, { steps: 6 }); }
    await page.mouse.up();
  };
  await draw([[1, 1], [3, 0.8], [3.2, 2], [1.2, 2.4], [1, 1.1]]);
  its = await items();
  const leftBed = its.find((i) => i.bed && Math.abs(area(i.points) - 20) < 0.5);
  const g1 = its.find((i) => i.group);
  assert(g1 && g1.bedId === leftBed.id && g1.planting.mix[0].role === (await page.evaluate(() => window.app.store.doc.planting.roles[0].id)), 'groep getekend in het linker vak, met S1');
  const nBefore = its.length;
  await draw([[9, 6], [10, 6], [10, 7], [9, 7]]);
  assert((await items()).length === nBefore, 'groep buiten een plantvak wordt geweigerd');
  assert(/binnen een plantvak/.test(await page.locator('#toast').innerText()), 'melding: groep hoort binnen een plantvak');

  console.log('Groepen voorstellen');
  await page.evaluate((id) => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set([id])); }, leftBed.id);
  assert(/Plantvak/.test(await page.locator('#selection-bar .count').innerText()), 'eigenschappenbalk: Plantvak');
  await page.click('#selection-bar [data-plan="suggest"]');
  its = await items();
  let auto = its.filter((i) => i.group && i.auto && i.bedId === leftBed.id);
  assert(auto.length >= 3, `${auto.length} groepen voorgesteld`);
  const roleIds = await page.evaluate(() => window.app.store.doc.planting.roles.map((r) => ({ id: r.id, role: r.role })));
  const kinds = new Set(auto.map((g) => roleIds.find((r) => r.id === g.planting.mix[0].role).role));
  assert(kinds.has('structuur') && kinds.has('accent') && !kinds.has('vulling'), 'groepen voor structuur en accent');
  const bedNow = its.find((i) => i.id === leftBed.id);
  assert(bedNow.planting.mix.length === 1 && roleIds.find((r) => r.id === bedNow.planting.mix[0].role).role === 'vulling', 'vulling vormt de basis van het vak');
  assert(its.some((i) => i.id === g1.id), 'zelf getekende groep blijft staan');
  const info = await page.locator('#selection-bar .pinfo').innerText();
  assert(/st\./.test(info), `aantal planten in de balk: ${info}`);
  const firstPts = JSON.stringify(auto[0].points);
  await page.click('#selection-bar [data-plan="suggest"]');
  its = await items();
  auto = its.filter((i) => i.group && i.auto && i.bedId === leftBed.id);
  assert(auto.length >= 3 && JSON.stringify(auto[0].points) !== firstPts, 'opnieuw voorstellen geeft een andere variant (oude vervangen)');
  const counts = await page.evaluate(async (id) => { const { plantCounts, bedStats } = await import('./js/planting.js'); const st = bedStats(window.app.store.doc).find((s) => s.bed.id === id); return { c: plantCounts(window.app.store.doc, id), base: st.baseArea, sum: st.baseArea + st.groups.reduce((s, g) => s + g.area, 0) }; }, leftBed.id);
  assert(Math.abs(counts.sum - 20) < 0.6 && counts.base < 19, `basis ${counts.base.toFixed(1)} m² + groepen = ${counts.sum.toFixed(1)} m²`);
  await page.screenshot({ path: path.join(OUT, 'vakken-planten.png') });

  console.log('Weergave Groepen');
  await page.click('#btn-planting');
  assert(/dit plantvak/.test(await page.locator('#plant-panel .scope').innerText()), 'paneel: overzicht van het geselecteerde vak');
  await page.click('#plant-panel [data-view="groepen"]');
  assert(await page.evaluate(() => window.app.state.plantView) === 'groepen', 'weergave Groepen');
  await page.screenshot({ path: path.join(OUT, 'vakken-groepen.png') });
  await page.click('#plant-panel [data-view="planten"]');
  await page.click('#btn-planting');

  console.log('Verplaatsen en verwijderen');
  const gBefore = (await items()).filter((i) => i.group && i.bedId === leftBed.id).map((g) => g.points[0]);
  await page.evaluate((id) => { const a = window.app; a.setSelection(new Set([id])); }, leftBed.id);
  {
    const [x0, y0] = S(0.4, 3.7), [x1, y1] = S(0.4, 3.2);
    await page.mouse.move(x0, y0); await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  }
  its = await items();
  const gAfter = its.filter((i) => i.group && i.bedId === leftBed.id).map((g) => g.points[0]);
  const dy = gAfter[0][1] - gBefore[0][1];
  assert(Math.abs(dy + 0.5) < 0.05 && gAfter.every((p, k) => Math.abs(p[1] - gBefore[k][1] - dy) < 1e-6), `groepen bewegen mee met het vak (${dy.toFixed(2)} m)`);
  await page.evaluate((id) => window.app.setSelection(new Set([id])), leftBed.id);
  await page.click('#selection-bar [data-sel="delete"]');
  its = await items();
  assert(!its.some((i) => i.id === leftBed.id) && !its.some((i) => i.group && i.bedId === leftBed.id), 'vak verwijderd, met zijn groepen');
  await page.click('#btn-undo');
  assert((await items()).some((i) => i.id === leftBed.id), 'ongedaan maken zet vak en groepen terug');

  console.log('Vorm omzetten naar plantvak');
  await page.evaluate(() => window.app.setSelection(new Set(['rond'])));
  await page.click('#selection-bar [data-plan="makebed"]');
  its = await items();
  const conv = its.find((i) => i.bed && i.kind === 'circle' && i.id !== circ.id);
  assert(conv && its.some((i) => i.id === 'rond'), 'cirkel omgezet naar plantvak (de vorm zelf blijft)');

  console.log('Solitair overal');
  await page.evaluate(() => { const a = window.app; a.setSelection(new Set()); a.state.plantMode = 'plant'; a.setTool('plant'); });
  await click(7, 6);
  assert((await items()).some((i) => i.type === 'plant'), 'solitair buiten een plantvak geplaatst');

  console.log('Plantstencils horen bij het plan');
  await page.evaluate(() => { const a = window.app; a.state.stencil = 'loofboom'; a.setTool('stencil'); });
  await click(9.5, 5.6);
  its = await items();
  const st = its.find((i) => i.type === 'stencil');
  const pr = await page.evaluate(() => window.app.store.doc.planting.roles.find((r) => r.fromStencil === 'loofboom'));
  assert(st && pr && st.role === pr.id && pr.role === 'structuur', `stencil Loofboom gekoppeld aan bouwsteen ${pr && pr.code}`);
  await page.evaluate(() => { const a = window.app; a.state.stencil = 'loofboom'; });
  await click(10.5, 5.6);
  const n2 = await page.evaluate(() => window.app.store.doc.planting.roles.filter((r) => r.fromStencil === 'loofboom').length);
  assert(n2 === 1, 'tweede loofboom gebruikt dezelfde bouwsteen');
  const ra = await page.evaluate(async (id) => { const { roleAreas } = await import('./js/planting.js'); return roleAreas(window.app.store.doc)[id]; }, pr.id);
  assert(ra > 1, `stencils tellen mee in het jaarrond (${ra.toFixed(1)} m²)`);

  console.log('Oudere tekeningen');
  const mig = await page.evaluate(async () => {
    const a = window.app;
    const { newDoc } = await import('./js/model.js');
    const d = newDoc('Oud');
    d.planting = { scheme: { type: 'vrij', base: '#8e5bb5' }, roles: [] };
    d.layers[0].items.push({ type: 'stencil', id: 's1', symbol: 'siergras', x: 1, y: 1, w: 1, h: 1, rot: 0, color: '#000' });
    d.layers[0].items.push({ type: 'stencil', id: 's2', symbol: 'bank', x: 3, y: 1, w: 1, h: 1, rot: 0, color: '#000' });
    d.layers[0].items.push({ type: 'shape', id: 'v1', kind: 'polygon', points: [[0, 0], [2, 0], [2, 2]], color: '#3f7a2e', width: 0.03, planting: { mix: [] } });
    a.openDoc(d);
    const its = a.store.doc.layers[0].items;
    return { s1: its[0].role, s2: its[1].role, bed: its[2].bed, roles: a.store.doc.planting.roles.map((r) => r.fromStencil) };
  });
  assert(mig.s1 && !mig.s2 && mig.roles.join() === 'siergras', 'plantstencils krijgen een bouwsteen, andere stencils niet');
  assert(mig.bed === true, 'plantvak uit V2.1 wordt een plantvak (bed)');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle plantvak-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
