// Plantendatabase en keuzehulp: planten zoeken en filteren, vakken vullen (passend bij het type uit de schets),
// combinaties, en stencils en bouwstenen die dezelfde plant zijn.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);

  console.log('Database');
  const db = await page.evaluate(async () => {
    const D = await import('./js/plantdb.js'); const C = await import('./js/combos.js'); const { STENCIL_MAP } = await import('./js/stencils.js');
    const all = [...D.PLANTS.values()];
    const missing = C.COMBOS.flatMap((c) => c.items.filter(([id]) => !D.PLANTS.get(id)).map(([id]) => `${c.id}:${id}`));
    const unfit = C.COMBOS.flatMap((c) => c.items.filter(([id]) => { const p = D.PLANTS.get(id); return p && !D.fitsBedType(D.heightClass(p), c.btype, p.kind || p.type); }).map(([id]) => `${c.id}:${id}`));
    const badStencil = all.filter((p) => p.stencil && !STENCIL_MAP[p.stencil]).map((p) => p.id);
    const types = [...new Set(all.map((p) => p.type))];
    return {
      n: all.length, types, missing, unfit, badStencil,
      laagZon: D.searchPlants({ btype: 'laag', onlyFit: true, light: 'zon' }).length,
      lav: D.searchPlants({ q: 'lavand' }).map((r) => r.p.nl),
      blauwJuni: D.searchPlants({ color: 'blauw', month: 6 }).length,
      inheemsBijen: D.searchPlants({ native: true, bees: true }).length,
      trees: all.filter((p) => p.type === 'boom').length,
    };
  });
  assert(db.n >= 200 && db.types.length >= 9, `${db.n} planten in ${db.types.length} soorten (${db.types.join(', ')})`);
  assert(db.trees >= 20 && !db.badStencil.length, `${db.trees} bomen, elk met een bestaand boomstencil` + (db.badStencil.length ? ': fout ' + db.badStencil.join(', ') : ''));
  assert(!db.missing.length && !db.unfit.length, 'alle combinaties bestaan uit planten die passen bij hun type vak' + (db.missing.concat(db.unfit).length ? ': ' + db.missing.concat(db.unfit).join(', ') : ''));
  assert(db.lav.includes('Lavendel') && db.laagZon > 20 && db.blauwJuni > 5 && db.inheemsBijen > 10, `zoeken en filteren werken (laag + zon: ${db.laagZon}, blauw in juni: ${db.blauwJuni}, inheems voor bijen: ${db.inheemsBijen})`);

  console.log('Vak vullen');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Vak');
    d.layers[0].items.push({ type: 'shape', id: 'B', kind: 'polygon', rect: true, bed: true, btype: 'laag', planting: { mix: [] }, points: [[0, 0], [5, 0], [5, 3], [0, 3]], color: '#3f7a2e', width: 0.03 });
    a.openDoc(d, true); a.cam.zoom = 100; a.cam.rot = 0; a.cam.x = 80; a.cam.y = 120; a.cameraChanged(); a.settings.grid = false;
    a.setTool('lasso'); a.setSelection(new Set(['B']));
  });
  await page.click('#btn-planting');
  assert(await page.isVisible('#plant-panel .bedsec [data-act="addplant"]'), 'paneel: blok "Dit vak" bij een geselecteerd plantvak');
  await page.click('#plant-panel [data-act="addplant"]');
  assert(await page.isVisible('#dlg-plants'), 'venster "Plant kiezen"');
  const fitOnly = await page.evaluate(() => [...document.querySelectorAll('#dlg-plants .plant')].every((li) => !li.classList.contains('unfit')));
  assert(fitOnly, 'standaard alleen planten die passen bij een laag vak');
  await page.fill('#dlg-plants [data-f="q"]', 'kattenkruid');
  await page.click('#dlg-plants .plant >> nth=0');
  let st = await page.evaluate(() => { const a = window.app; const bed = a.store.findItem('B').item; const roles = a.store.doc.planting.roles; return { mix: bed.planting.mix.map((m) => roles.find((r) => r.id === m.role)?.label), role: roles[0] }; });
  assert(st.mix.length === 1 && /Kattenkruid/.test(st.mix[0]) && st.role.plant === 'kattenkruid' && st.role.form === 'aar' && st.role.height === 'laag', `kattenkruid als bouwsteen in het vak (vorm ${st.role.form}, hoogte ${st.role.height})`);
  await page.click('#plant-panel [data-act="combos"]');
  await page.click('#plant-panel .combo >> nth=0');
  st = await page.evaluate(() => { const a = window.app; const bed = a.store.findItem('B').item; const roles = a.store.doc.planting.roles; return bed.planting.mix.map((m) => roles.find((r) => r.id === m.role)); });
  assert(st.length >= 4 && st.every((r) => r.plant), `combinatie toegepast: ${st.map((r) => r.label).join(', ')}`);
  await page.screenshot({ path: path.join(OUT, 'plantdb-vak.png') });
  // een hoge plant erbij zetten geeft een waarschuwing
  await page.evaluate(async () => {
    const a = window.app; const D = await import('./js/plantdb.js');
    a.plantPanel.addPlantToBed(a.store.findItem('B').item, D.plantById('struisriet'));
    a.updateSelectionUI();
  });
  assert(await page.isVisible('#plant-panel .mixlist .unfit') && /Past niet bij laag/.test(await page.textContent('#selection-bar')), 'struisriet in een laag vak: gemarkeerd als "past niet"');

  console.log('Route in drie stappen');
  const steps = await page.evaluate(() => [...document.querySelectorAll('#plant-panel .steps [data-step]')].map((b) => b.textContent.trim()));
  assert(steps.length === 3 && /Schetsen/.test(steps[0]) && /Invullen/.test(steps[1]) && /Verfijnen/.test(steps[2]), `stappen: ${steps.join(' → ')}`);
  assert(await page.evaluate(() => window.app.state.plantStep) === 2, 'paneel geopend met een vak geselecteerd: stap 2 Invullen');
  await page.click('#plant-panel .steps [data-step="1"]');
  assert(await page.isVisible('#plant-panel .btypes') && await page.isVisible('#plant-panel .bedlist .bedrow') && !(await page.isVisible('#plant-panel .bedsec [data-act="addplant"]')), 'stap 1: types en de lijst met plantvakken, geen invullen');
  await page.click('#plant-panel .btypes [data-btype="middel"]');
  assert(await page.evaluate(() => window.app.store.findItem('B').item.btype) === 'middel', 'type kiezen in stap 1 geldt voor het geselecteerde vak');
  await page.evaluate(() => window.app.store.undo());
  await page.click('#plant-panel [data-tool="vak"]');
  assert(await page.evaluate(() => window.app.state.tool === 'plant' && window.app.state.plantMode === 'vak'), '"Plantvak tekenen" kiest het juiste gereedschap');
  await page.evaluate(() => { window.app.setTool('lasso'); window.app.setSelection(new Set(['B'])); });
  await page.click('#plant-panel .steps [data-step="3"]');
  assert(await page.isVisible('#plant-panel [data-plan="suggest"]') && await page.isVisible('#plant-panel .year'), 'stap 3: groepen voorstellen, solitairen en het hele jaar');
  await page.click('#plant-panel [data-plan="suggest"]');
  assert(await page.evaluate(() => window.app.store.doc.layers[0].items.some((i) => i.group && i.bedId === 'B')), 'groepen voorgesteld in het vak');
  await page.screenshot({ path: path.join(OUT, 'plantdb-stap3.png') });

  console.log('Stencil en bouwsteen zijn dezelfde plant');
  const tr = await page.evaluate(async () => {
    const P = await import('./js/planting.js');
    const roles = [];
    const r = P.ensureStencilRole(roles, 'lijsterbes', 'Lijsterbes');
    return { plant: r?.plant, stencil: r?.stencil, isPlant: P.isPlantStencil('lijsterbes') };
  });
  assert(tr.isPlant && tr.plant === 'lijsterbes' && tr.stencil === 'lijsterbes', 'stencil lijsterbes = bouwsteen lijsterbes uit de database (zelfde tekening)');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle plantendatabase-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
