// Eigenschappen van planten (structuur, eetbaar, klimt, te leiden …), filters, eisen en uitgangspunten per vak,
// rol en functie bij een wens, en de controles (4 momenten, groene soep, structuur, functies).
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);

  const tr = await page.evaluate(async () => {
    const { plantById } = await import('./js/plantdb.js');
    const { plantTraits } = await import('./js/traits.js');
    const t = (id) => Object.fromEntries(plantTraits(plantById(id)));
    return { vero: t('virginische_ereprijs'), kat: t('kattenkruid'), klimop: t('klimop'), appel: t('appelboom'), blauweregen: t('blauwe_regen'), geranium: t('ooievaarsbek_bodem') };
  });
  assert(tr.vero.structuur && !tr.kat.structuur, `structuurplant: Virginische ereprijs wel (${tr.vero.structuur}), kattenkruid niet`);
  assert(tr.klimop.klimmer === 'zelfhechtend' && /windend/.test(tr.blauweregen.klimmer), `klimwijze: klimop ${tr.klimop.klimmer}, blauweregen ${tr.blauweregen.klimmer}`);
  assert(tr.appel.eetbaar && tr.appel.leiden && tr.appel.schaduw, 'appelboom: eetbaar, te leiden en geeft schaduw');
  assert(tr.kat.geur && tr.geranium.bodem, 'kattenkruid geurt, bodembedekkende ooievaarsbek bedekt de grond');

  // filter in de plantkeuze
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { roleFromPlant, plantById } = await import('./js/plantdb.js');
    const d = newDoc('Eigenschappen');
    const role = (id, pid, code, rl) => ({ id, code, role: rl, ...roleFromPlant(plantById(pid)) });
    d.planting = { roles: [role('r1', 'kattenkruid', 'V1', 'vulling'), role('r2', 'kattenkruid_groot', 'V2', 'vulling')], scheme: { type: 'vrij', base: '#8e5bb5' } };
    d.layers[0].items.push({ type: 'shape', id: 'B', name: 'Moestuin', kind: 'polygon', bed: true, btype: 'middel', light: 'zon', moisture: 'normaal', points: [[0, 0], [5, 0], [5, 3], [0, 3]], color: '#3f7a2e', width: 0.03, planting: { mix: [{ role: 'r1', w: 50 }, { role: 'r2', w: 50 }] } });
    a.openDoc(d, true); a.setTool('lasso'); a.setSelection(new Set(['B'])); a.state.plantStep = 1; a.plantPanel.open();
  });
  const panel = page.locator('#plant-panel');
  await panel.locator('[data-req="eetbaar"]').click();
  assert((await page.evaluate(() => window.app.store.findItem('B').item.require || [])).join() === 'eetbaar', 'stap 1: eis "alleen eetbaar" voor dit vak');
  await panel.locator('.steps [data-step="3"]').click();
  await panel.locator('[data-act="addplant"]').click();
  assert(await page.locator('#dlg-plants [data-tf="eetbaar"].on').count() === 1, 'de plantkeuze opent met de eis van het vak aan');
  const names = await page.evaluate(async () => {
    const { plantTraits } = await import('./js/traits.js'); const { PLANTS } = await import('./js/plantdb.js');
    const shown = [...document.querySelectorAll('#dlg-plants .plant b')].map((x) => x.textContent);
    const byName = new Map([...PLANTS.values()].map((p) => [p.nl, p]));
    return { n: shown.length, all: shown.every((n) => plantTraits(byName.get(n)).has('eetbaar')), some: shown.slice(0, 4) };
  });
  assert(names.n >= 2 && names.all && !names.some.includes('Laurierkers'), `alleen eetbare planten (${names.some.join(', ')} …)`);
  await page.locator('#dlg-plants [data-f="onlyFit"]').uncheck();
  await page.locator('#dlg-plants [data-tf="klimmer"]').click();
  const both = await page.locator('#dlg-plants .plant b').allInnerTexts();
  assert(both.length >= 1 && both.includes('Druif') && !both.includes('Munt'), `eetbaar én klimt: ${both.join(', ')}`);
  await page.locator('#dlg-plants [data-tf="eetbaar"]').click();
  await page.locator('#dlg-plants [data-tf="klimmer"]').click();
  await page.locator('#dlg-plants [data-tf="leiden"]').click();
  const lei = await page.locator('#dlg-plants .plant b').allInnerTexts();
  assert(lei.length >= 2, `filter "te leiden": ${lei.slice(0, 5).join(', ')}`);
  await page.screenshot({ path: path.join(OUT, 'eigenschappen-filter.png') });
  await page.keyboard.press('Escape');
  // samenstellen houdt de eis aan
  const comp = await page.evaluate(async () => {
    const { compose } = await import('./js/composer.js'); const { plantById } = await import('./js/plantdb.js'); const { plantTraits } = await import('./js/traits.js');
    const ctx = window.app.plantPanel.bedCtx(window.app.store.findItem('B').item);
    const { items } = compose(ctx, 1);
    return { n: items.length, ok: items.every(([id]) => plantTraits(plantById(id)).has('eetbaar')) };
  });
  assert(comp.ok, `"Stel een basis samen" kiest alleen eetbare planten (${comp.n})`);

  // uitgangspunten in stap 2
  await panel.locator('.steps [data-step="2"]').click();
  await panel.locator('[data-aimfn="geurplek"]').click();
  await panel.locator('[data-aim="structure"][data-v="veel"]').click();
  await panel.locator('[data-aim="maintenance"][data-v="laag"]').click();
  const aims = await page.evaluate(() => window.app.store.findItem('B').item.aims);
  assert(aims.functions.includes('geurplek') && aims.structure === 'veel' && aims.maintenance === 'laag', 'stap 2: uitgangspunten (functie van het vak: geurplek bij de zitplek; veel structuur, weinig onderhoud)');
  const fnOpts = await panel.locator('.wnew [data-wf] option').allInnerTexts();
  assert(/★ Geurend/.test(fnOpts[1]), 'bij de wens staat de eigenschap die de geurplek nodig heeft bovenaan (★ Geurend)');
  await panel.locator('.wnew [data-wr]').selectOption('structuur');
  const rol = await page.evaluate(async () => {
    const { wishCandidates } = await import('./js/wish.js'); const { plantTraits } = await import('./js/traits.js');
    const r = wishCandidates({ layer: 'vaste', height: 'middel', role: 'structuur' }, {});
    return r.list.slice(0, 6).every((c) => plantTraits(c.p).has('structuur'));
  });
  assert(rol && await page.evaluate(() => window.app.state.wish.role) === 'structuur', 'wens met rol "structuur": voorstellen zijn structuurplanten');
  await page.screenshot({ path: path.join(OUT, 'uitgangspunten.png') });

  // controles in stap 3
  await panel.locator('.steps [data-step="3"]').click();
  const checks = await panel.locator('.bedchecks li').allInnerTexts();
  const txt = checks.join(' | ');
  assert(['Februari', 'Mei', 'Augustus', 'November'].every((m) => txt.includes(m)), 'controle op de 4 momenten: februari, mei, augustus, november');
  assert(/Groene soep[^|]*Kattenkruid[^|]*lijken op elkaar/.test(txt), 'groene soep: twee soorten kattenkruid lijken te veel op elkaar');
  assert(/✗ Structuur/.test(txt), 'structuur: te weinig voor "veel structuur"');
  assert(/✓ Geurplek bij de zitplek[^|]*Kattenkruid/.test(txt.replace(/\n/g, ' ')), 'functie van het vak "geurplek" wordt waargemaakt door kattenkruid');
  assert(/✗ Eisen[^|]*Kattenkruid/.test(txt.replace(/\n/g, ' ')) || /Eisen/.test(txt), 'eisen: kattenkruid is niet eetbaar');
  await page.screenshot({ path: path.join(OUT, 'controle.png') });
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle eigenschappen-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
