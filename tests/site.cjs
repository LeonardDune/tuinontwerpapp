// Standplaats (zon in 4 klassen, vocht, grondsoort, zuurgraad, ligging), vooraanzicht van een vak en de balans
// van de hele tuin (2/3 groen, de helft hoger dan 90 cm), herhaling en te weinig per soort.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

// verzonnen Esveld-planten met gegevens over grond en wind
const FAKE = {
  source: 'Esveld', url: 'https://esveld.nl/a/product/', date: '2026-11-27', count: 3,
  plants: [
    { id: 'esv:zuur-test', lat: 'Pieris ‘Testzuur’', nl: 'Rotsheide', cv: 'Testzuur', t: 'heester', h: 120, w: 100, ha: 'bol', f: 'knop', c: '#f6f4ee', b: [3, 4], l: 'zh', s: 'n', u: 'zuur-test', p: 1295, ev: 1, g: ['zure'] },
    { id: 'esv:wind-test', lat: 'Hibiscus ‘Testwind’', nl: 'Altheastruik', cv: 'Testwind', t: 'heester', h: 150, w: 100, ha: 'rechtop', f: 'schijf', c: '#c06ad8', b: [8, 9], l: 'z', s: 'n', u: 'wind-test', p: 1495, wi: 2 },
    { id: 'esv:kust-test', lat: 'Hippophae ‘Testkust’', nl: 'Duindoorn', cv: 'Testkust', t: 'heester', h: 200, w: 150, ha: 'rechtop', f: 'blad', c: '#c8c070', b: [], l: 'z', s: 'd', u: 'kust-test', p: 995, wi: 3, e: 'v' },
  ],
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);

  const cls = await page.evaluate(async () => { const { lightFromHours, lightFits } = await import('./js/site.js'); return { h: [1, 3, 5, 7].map(lightFromHours), fit: [lightFits(['zon'], 'halfzon'), lightFits(['half'], 'halfzon'), lightFits(['schaduw'], 'halfzon')] }; });
  assert(cls.h.join() === 'schaduw,half,halfzon,zon', `zon in 4 klassen naar Scholt: 1 u ${cls.h[0]}, 3 u ${cls.h[1]}, 5 u ${cls.h[2]}, 7 u ${cls.h[3]}`);
  assert(cls.fit.join() === 'true,true,false', 'halfzon: planten voor zon én voor halfschaduw kunnen er staan, schaduwplanten niet');

  await page.evaluate(async (fake) => {
    const { useEsveld } = await import('./js/esveld.js'); useEsveld(fake);
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { roleFromPlant, plantById } = await import('./js/plantdb.js');
    const d = newDoc('Standplaats');
    const role = (id, pid, code, rl) => ({ id, code, role: rl, ...roleFromPlant(plantById(pid)) });
    d.planting = { roles: [role('r1', 'esv:zuur-test', 'S1', 'structuur'), role('r2', 'kattenkruid', 'V1', 'vulling'), role('r3', 'virginische_ereprijs', 'S2', 'structuur'), role('r4', 'salvia', 'A1', 'vulling')], scheme: { type: 'vrij', base: '#8e5bb5' } };
    d.layers[0].items.push({ type: 'shape', id: 'B', name: 'Voorborder', kind: 'polygon', bed: true, btype: 'middel', light: 'zon', moisture: 'normaal', points: [[0, 0], [6, 0], [6, 2.5], [0, 2.5]], color: '#3f7a2e', width: 0.03, planting: { mix: [{ role: 'r1', w: 20 }, { role: 'r2', w: 50 }, { role: 'r3', w: 30 }] } });
    d.layers[0].items.push({ type: 'shape', id: 'C', name: 'Zijborder', kind: 'polygon', bed: true, btype: 'laag', points: [[0, 4], [3, 4], [3, 6], [0, 6]], color: '#3f7a2e', width: 0.03, planting: { mix: [{ role: 'r2', w: 100 }] } });
    d.layers[0].items.push({ type: 'plant', id: 'P', role: 'r4', x: 2, y: 5, d: 0.4 });
    d.layers[0].items.push({ type: 'shape', id: 'T', kind: 'polygon', hatch: 'tegels', points: [[8, 0], [14, 0], [14, 4], [8, 4]], color: '#666', width: 0.02 });
    a.openDoc(d, true); a.setTool('lasso'); a.setSelection(new Set(['B'])); a.state.plantStep = 1; a.plantPanel.open();
  }, FAKE);
  const panel = page.locator('#plant-panel');
  const labels = await panel.locator('.bedsec label.row').allInnerTexts();
  assert(['Zon', 'Vocht', 'Grondsoort', 'Ligging'].every((l) => labels.some((x) => x.startsWith(l))) && labels.filter((x) => x.startsWith('Zon')).length === 1, 'stap 1 Standplaats: zon, vocht, grondsoort met zuurgraad en ligging (geen dubbele keuzes)');
  const opts = await panel.locator('[data-k="bedlight"] option').allInnerTexts();
  assert(opts.some((o) => /Halfzon \(4 tot 6 uur\)/.test(o)), 'zon met de klasse halfzon (4 tot 6 uur)');
  await panel.locator('[data-k="bedsoiltype"]').selectOption('klei');
  await panel.locator('[data-k="bedph"]').selectOption('kalk');
  await panel.locator('[data-k="bedexposure"]').selectOption('winderig');
  const bed = await page.evaluate(() => { const it = window.app.store.findItem('B').item; return { s: it.soilType, ph: it.ph, e: it.exposure }; });
  assert(bed.s === 'klei' && bed.ph === 'kalk' && bed.e === 'winderig', 'klei, kalkrijk en winderig bewaard bij het vak');
  const probs = await page.evaluate(async () => {
    const { siteProblems } = await import('./js/site.js'); const { plantById } = await import('./js/plantdb.js'); const { compose } = await import('./js/composer.js');
    const bed = window.app.store.findItem('B').item;
    const ctx = window.app.plantPanel.bedCtx({ ...bed, btype: 'heesters' });
    const pool = compose(ctx, 1).items.map(([id]) => id);
    return { zuur: siteProblems(plantById('esv:zuur-test'), bed), wind: siteProblems(plantById('esv:wind-test'), bed), kust: siteProblems(plantById('esv:kust-test'), { ...bed, exposure: 'kust' }), inPool: pool.includes('esv:zuur-test') || pool.includes('esv:wind-test') };
  });
  assert(probs.zuur.includes('wil zure grond'), 'zuurminnaar op kalkrijke klei: "wil zure grond"');
  assert(probs.wind.includes('sterk windgevoelig') && !probs.kust.length, 'winderig: windgevoelige heester valt af; duindoorn kan aan de kust');
  assert(!probs.inPool, 'samenstellen laat planten die niet bij de plek passen weg');
  await panel.locator('.steps [data-step="3"]').click();
  const checks = await panel.locator('.bedchecks li').allInnerTexts();
  assert(checks.some((c) => /Plek/.test(c) && /zure grond/.test(c)), `controle "Plek": ${checks.find((c) => /Plek/.test(c))?.replace(/\s+/g, ' ')}`);

  // vooraanzicht
  const elev = async () => page.evaluate(() => { const c = document.querySelector('#plant-panel canvas.elevation'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, h = 0; for (let i = 0; i < d.length; i += 4) { if (Math.abs(d[i] - 251) + Math.abs(d[i + 1] - 250) + Math.abs(d[i + 2] - 246) > 30) n++; h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000003; } return { n, h }; });
  const e0 = await elev();
  assert(e0.n > 3000, `vooraanzicht van het vak getekend (${e0.n} pixels)`);
  await panel.locator('[data-elm="2"]').click();
  const e1 = await elev();
  assert(e1.h !== e0.h && e1.n < e0.n, 'in februari ziet het vooraanzicht er anders uit (minder te zien)');
  await panel.locator('[data-act="elevflip"]').click();
  const e2 = await elev();
  assert(e2.h !== e1.h, 'van de andere kant bekeken');
  await page.screenshot({ path: path.join(OUT, 'vooraanzicht.png') });

  // balans, herhaling en te weinig per soort (hele ontwerp)
  await page.evaluate(() => window.app.gardenPanel.open());
  const adv = await page.locator('#garden-panel .advice').innerText();
  assert(/Balans:/.test(adv) && /groen/.test(adv) && /verhard/.test(adv), `balans: ${adv.split('\n').find((l) => /Balans/.test(l))}`);
  assert(/minstens 2\/3 groen/.test(adv), 'te veel verhard: vuistregel minstens 2/3 groen');
  assert(/Herhaling:[^\n]*(Virginische ereprijs|Rotsheide)/.test(adv), 'herhaling: structuurplant staat maar in één vak');
  assert(/Te weinig van een soort:[^\n]*Salie/.test(adv), 'te weinig van een soort: één losse salie');
  await page.screenshot({ path: path.join(OUT, 'balans.png') });
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle standplaats-, vooraanzicht- en balans-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
