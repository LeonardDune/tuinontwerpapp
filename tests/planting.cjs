// Beplantingsplan V2.1: bouwstenen, kleurenschema, plaatsen, plantvak, jaarrond en adviezen.
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
    const a = window.app; const { newDoc } = await import('./js/model.js');
    a.openDoc(newDoc('Border'), true);
    a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 480; a.cam.y = 420; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false;
    a.state.plantMix = []; a.state.plantMode = 'plant';
  });
  const box = await page.locator('#canvas').boundingBox();
  const X = (x) => box.x + x, Y = (y) => box.y + y;

  console.log('Kleurenschema en bouwstenen');
  await page.click('#btn-planting');
  assert(await page.isVisible('#plant-panel'), 'paneel Beplanting open');
  await page.selectOption('#plant-panel [data-k="scheme"]', 'verwant');
  const pal = await page.locator('#plant-panel .palette i').count();
  assert(pal >= 6, `verwant palet met ${pal} kleuren`);

  async function makeRole(kind, cfg) {
    await page.click(`#plant-panel [data-add="${kind}"]`);
    await page.waitForSelector('#dlg-role[open]');
    for (const [k, v] of Object.entries(cfg.sel || {})) await page.selectOption(`#dlg-role [data-k="${k}"]`, v);
    if (cfg.swatch != null) await page.click(`#dlg-role .sw >> nth=${cfg.swatch}`);
    if (cfg.color) await page.evaluate((c) => { const i = document.querySelector('#dlg-role [data-k="color"]'); i.value = c; i.dispatchEvent(new Event('change', { bubbles: true })); }, cfg.color);
    // bloeimaanden: eerst de standaard (jun-aug) uit, dan de gewenste aan
    for (const m of [6, 7, 8]) await page.click(`#dlg-role [data-month="${m}"]`);
    for (const m of cfg.bloom) await page.click(`#dlg-role [data-month="${m}"]`);
    await page.click('#dlg-role footer button.primary');
    await page.waitForSelector('#dlg-role', { state: 'hidden' });
  }
  await makeRole('structuur', { sel: { height: 'hoog', habit: 'rechtop', form: 'aar', winter: 'silhouet', autumn: 'brons' }, swatch: 1, bloom: [7, 8, 9] });
  await makeRole('vulling', { sel: { height: 'laag', habit: 'kussen', form: 'schijf', foliage: 'zilver', winter: 'weg' }, swatch: 6, bloom: [6, 7] });
  await makeRole('accent', { sel: { height: 'middel', habit: 'bol', form: 'knop', winter: 'weg' }, color: '#e8822e', bloom: [5] });
  const roles = await page.evaluate(() => window.app.store.doc.planting.roles.map((r) => ({ code: r.code, bloom: r.bloom, color: r.color, habit: r.habit, form: r.form })));
  assert(roles.length === 3 && roles.map((r) => r.code).join() === 'S1,V1,A1', `bouwstenen ${roles.map((r) => r.code).join(', ')}`);
  assert(roles[0].bloom.join() === '7,8,9' && roles[0].form === 'aar' && roles[0].habit === 'rechtop', 'S1: hoog, rechtop, aar, bloei jul–sep');
  console.log('    kleuren:', roles.map((r) => r.code + ' ' + r.color).join(', '));
  assert(roles[2].color === '#e8822e', 'A1 heeft de eigen kleur oranje');
  assert(await page.locator('#plant-panel .role em').count() === 1 && /A1/.test(await page.locator('#plant-panel .role:has(em)').innerText()), 'alleen A1 (oranje) gemarkeerd als buiten het schema');

  console.log('Plaatsen');
  await page.click('#plant-panel .role >> nth=0'); // S1 kiezen -> gereedschap Beplanten
  assert(await page.evaluate(() => window.app.state.tool) === 'plant', 'gereedschap Beplanten actief');
  for (const x of [360, 460, 560]) await page.mouse.click(X(x), Y(300));
  await page.click('#optionsbar .seg button[data-m="vak"]');
  await page.click('#optionsbar .chip >> nth=0');
  await page.click('#optionsbar .chip >> nth=1');
  const pts = [[300, 360], [640, 350], [660, 520], [320, 540], [300, 370]];
  await page.mouse.move(X(pts[0][0]), Y(pts[0][1])); await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(X(p[0]), Y(p[1]), { steps: 10 });
  await page.mouse.up();
  await page.click('#optionsbar .seg button[data-m="plant"]');
  await page.click('#optionsbar .chip >> nth=2'); // A1
  await page.mouse.click(X(700), Y(420));
  const items = await page.evaluate(() => window.app.store.doc.layers[0].items.map((i) => ({ type: i.type, mix: i.planting?.mix?.length, role: i.role })));
  assert(items.filter((i) => i.type === 'plant').length === 4, '4 losse bouwstenen geplaatst');
  assert(items.some((i) => i.mix === 2), 'plantvak met mix van S1 en V1');

  console.log('Jaarrond en adviezen');
  const yr = await page.evaluate(async () => { const { yearRound } = await import('./js/planting.js'); return yearRound(window.app.store.doc).months.map((m) => Math.round(m.score * 100)); });
  assert(yr[6] > 80 && yr[0] < 30 && yr[11] > yr[0] - 1, `jul ${yr[6]}%, jan ${yr[0]}%`);
  const advice = await page.locator('#plant-panel .advice').innerText();
  assert(/Weinig te zien in/.test(advice) && /jan/.test(advice), 'advies: weinig te zien in de winter');
  assert(/Buiten het kleurenschema/.test(advice), 'advies: kleur buiten schema');
  await page.screenshot({ path: path.join(OUT, 'beplanting-bloei.png') });

  console.log('Door de maanden');
  await page.click('#plant-panel .ymonth >> nth=6');
  assert(await page.evaluate(() => window.app.plantPanel.month) === 7, 'juli gekozen; tekening toont juli');
  await page.screenshot({ path: path.join(OUT, 'beplanting-juli.png') });
  await page.click('#plant-panel .ymonth >> nth=0');
  assert(await page.evaluate(() => window.app.plantPanel.month) === 1, 'januari gekozen');
  await page.screenshot({ path: path.join(OUT, 'beplanting-januari.png') });

  console.log('Bewerken en ongedaan maken');
  await page.evaluate(() => { const a = window.app; const p = a.store.doc.layers[0].items.find((i) => i.type === 'plant'); a.setTool('lasso'); a.setSelection(new Set([p.id])); });
  const v1 = await page.evaluate(() => window.app.store.doc.planting.roles[1].id);
  await page.selectOption('#selection-bar select[data-k="prole"]', v1);
  assert(await page.evaluate((v) => window.app.store.doc.layers[0].items.filter((i) => i.type === 'plant')[0].role === v, v1), 'bouwsteen van een plant gewisseld via de balk');
  await page.click('#btn-undo'); await page.click('#btn-undo');
  const n = await page.evaluate(() => window.app.store.doc.layers[0].items.filter((i) => i.type === 'plant').length);
  assert(n === 3, 'ongedaan maken werkt ook voor beplanting');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle beplantings-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
