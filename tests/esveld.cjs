// Esveld als plantenbron en primaire leverancier: cultivars met eigen maten, prijs en link.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

// Kleine verzonnen catalogus in het formaat van tools/esveld.py (de echte staat alleen op het apparaat van de gebruiker).
const FAKE = {
  source: 'Esveld', url: 'https://esveld.nl/a/product/', date: '2026-11-27', count: 7,
  plants: [
    { id: 'esv:geranium-test-blauw', lat: 'Geranium ‘Testblauw’', nl: 'Ooievaarsbek', cv: 'Testblauw', t: 'vaste', h: 45, w: 50, ha: 'kussen', f: 'schijf', c: '#5a6ad0', b: [6, 7, 8, 9], l: 'zh', s: 'dn', u: 'geranium-test-blauw', m2: 5, p: 435, sz: ['pot 9 cm'] },
    { id: 'esv:geranium-test-laag', lat: 'Geranium ‘Testlaag’', nl: 'Ooievaarsbek', cv: 'Testlaag', t: 'vaste', h: 25, w: 40, ha: 'kussen', f: 'schijf', c: '#e48ab8', b: [5, 6], l: 'zh', s: 'n', u: 'geranium-test-laag', m2: 9, p: 395, sz: ['pot 9 cm'] },
    { id: 'esv:salvia-test', lat: 'Salvia nemorosa ‘Testpaars’', nl: 'Salie', cv: 'Testpaars', t: 'vaste', h: 50, w: 40, ha: 'rechtop', f: 'aar', c: '#7a4aa8', b: [6, 7, 8], l: 'z', s: 'd', u: 'salvia-test', m2: 7, p: 375, pm: 900, sz: ['pot 9 cm', 'pot 2 liter'], bee: 1 },
    { id: 'esv:nepeta-walkers-low', lat: 'Nepeta ‘Walker’s Low’', nl: 'Kattenkruid', cv: 'Walker’s Low', t: 'vaste', h: 60, w: 60, ha: 'kussen', f: 'aar', c: '#7a72c9', b: [5, 6, 7, 8, 9], l: 'z', s: 'dn', u: 'nepeta-walkers-low', m2: 5, p: 395, sz: ['pot 9 cm'] },
    { id: 'esv:delphinium-testblauw', lat: 'Delphinium ‘Testblauw’', nl: 'Ridderspoor', cv: 'Testblauw', t: 'vaste', h: 160, w: 60, ha: 'rechtop', f: 'aar', c: '#4a6ad8', b: [6, 7], l: 'z', s: 'n', u: 'delphinium-testblauw', m2: 3, p: 650, sz: ['pot 2 liter'] },
    { id: 'esv:sedum-herbstfreude', lat: 'Sedum ‘Herbstfreude’', nl: 'Hemelsleutel', cv: 'Herbstfreude', t: 'vaste', h: 50, w: 50, ha: 'bol', f: 'scherm', c: '#c06a8a', b: [8, 9, 10], l: 'z', s: 'd', u: 'sedum-herbstfreude', m2: 5, p: 375, sz: ['pot 9 cm'] },
    { id: 'esv:viburnum-test', lat: 'Viburnum ‘Testwit’', nl: 'Sneeuwbal', cv: 'Testwit', t: 'heester', h: 200, w: 150, ha: 'bol', f: 'scherm', c: '#f6f4ee', b: [5], l: 'zh', s: 'n', u: 'viburnum-test', m2: 1, p: 1495, sz: ['pot 3 liter'], a: 'rood' },
  ],
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);
  assert(await page.evaluate(async () => !(await import('./js/esveld.js')).ESVELD.loaded && window.app.plantSource() === null), 'zonder geïmporteerde catalogus: de basislijst, geen Esveld');
  // importeren in Instellingen
  await page.click('#btn-settings');
  assert(/Nog geen Esveld-catalogus/.test(await page.textContent('#set-source-info')), 'Instellingen zegt dat er nog geen catalogus is');
  await page.setInputFiles('#set-esveld-file', { name: 'esveld.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FAKE)) });
  await page.waitForFunction(async () => (await import('./js/esveld.js')).ESVELD.loaded);
  assert(/7 cultivars/.test(await page.textContent('#set-source-info')) && await page.isVisible('#set-esveld-remove'), 'importeren: catalogus geladen (7 cultivars), met knop Verwijderen');
  await page.keyboard.press('Escape');
  // een verkeerd bestand wordt geweigerd
  await page.setInputFiles('#set-esveld-file', { name: 'iets.json', mimeType: 'application/json', buffer: Buffer.from('{"hallo":1}') });
  await page.waitForTimeout(300);
  assert(/geen Esveld-catalogus/.test(await page.textContent('#toast')), 'een ander bestand wordt geweigerd');
  // na herladen nog steeds aanwezig (op dit apparaat bewaard)
  await page.reload();
  await page.waitForFunction(() => window.app && window.app.ready);
  const db = await page.evaluate(async () => {
    const { ESVELD } = await import('./js/esveld.js');
    const { searchPlants } = await import('./js/plantdb.js');
    const ger = searchPlants({ q: 'geranium', source: 'esveld' }).map((r) => r.p);
    return { loaded: ESVELD.loaded, n: ESVELD.count, source: window.app.plantSource(), ger: ger.map((p) => `${p.nl} ${p.h}`) };
  });
  assert(db.loaded && db.n === 7 && db.source === 'esveld', 'na herladen staat de catalogus er nog: Esveld is de standaardbron');
  assert(db.ger.length === 2 && db.ger.includes("Ooievaarsbek 'Testblauw' 45") && db.ger.includes("Ooievaarsbek 'Testlaag' 25"), `cultivars met hun eigen naam en maat (${db.ger.join(', ')})`);

  // planten uit de basislijst krijgen de koppeling, ook als Esveld de naam anders schrijft
  const links = await page.evaluate(async () => {
    const { plantById } = await import('./js/plantdb.js');
    const k = plantById('kattenkruid'), h = plantById('hemelsleutel'), r = plantById('ridderspoor');
    return { k: [k.lat, k.esv?.url], h: [h.lat, h.esv?.url], r: [r.lat, r.esv?.url, r.esvSearch?.url, r.esvSearch?.n] };
  });
  assert(/nepeta-walkers-low/.test(links.k[1]), `${links.k[0]} → het Esveld-artikel (Esveld laat de soortnaam weg)`);
  assert(/sedum-herbstfreude/.test(links.h[1]), `${links.h[0]} → Sedum 'Herbstfreude' (oudere geslachtsnaam bij Esveld)`);
  assert(!links.r[1] && /webshop\/\?q=Delphinium/.test(links.r[2]), `${links.r[0]}: geen kale soort te koop, dus een link naar het Esveld-aanbod (${links.r[3]} cultivar)`);

  // plantafstand volgt het aanbevolen aantal per m²
  const sp = await page.evaluate(async () => {
    const { PLANTS, roleFromPlant } = await import('./js/plantdb.js');
    const { perM2 } = await import('./js/plantlist.js');
    const p = [...PLANTS.values()].find((q) => q.id === 'esv:geranium-test-laag');
    const r = roleFromPlant(p);
    return { want: p.esv.perM2, got: perM2(r), name: p.nl };
  });
  assert(Math.abs(sp.got - sp.want) / sp.want < 0.15, `${sp.name}: ${sp.want} per m² volgens Esveld, de app rekent ${sp.got.toFixed(1)}`);

  // kiezen in een vak, plantenlijst met Esveld als leverancier
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Esveld');
    d.layers[0].items.push({ type: 'shape', id: 'B', name: 'Border', kind: 'polygon', bed: true, btype: 'middel', light: 'zon', moisture: 'normaal', points: [[0, 0], [5, 0], [5, 2], [0, 2]], color: '#3f7a2e', width: 0.03, planting: { mix: [] } });
    a.openDoc(d, true); a.setTool('lasso'); a.setSelection(new Set(['B'])); a.state.plantStep = 3; a.plantPanel.open();
  });
  await page.click('#plant-panel [data-act="addplant"]');
  assert(await page.inputValue('#dlg-plants [data-f="source"]') === 'esveld', 'plant kiezen: standaard uit de Esveld-catalogus');
  await page.fill('#dlg-plants [data-f="q"]', 'testblauw');
  const row = await page.locator('#dlg-plants .plant').first().innerText();
  assert(/Esveld/.test(row) && /€/.test(row) && /per m²|\/m²/.test(row), `met prijs, maat en aantal per m² (${row.replace(/\s+/g, ' ').slice(0, 110)}…)`);
  await page.screenshot({ path: path.join(OUT, 'esveld-kiezen.png') });
  await page.locator('#dlg-plants .plant').first().click();
  assert(await page.locator('#plant-panel .mixlist a.esvlink[href*="esveld.nl"]').count() === 1, 'in de basis van het vak een link naar Esveld bij de plant');
  await page.evaluate(() => window.app.gardenPanel.open());
  await page.evaluate(() => { document.querySelector('#garden-panel details.allroles').open = true; });
  assert(await page.locator('#garden-panel .roles a.esvlink[href*="esveld.nl"]').count() >= 1, 'ook bij Hele ontwerp ▸ Alle planten');
  await page.evaluate(() => window.app.plantPanel.open());
  await page.click('#plant-panel [data-act="plantlist"]');
  const list = await page.evaluate(async () => {
    const { plantList, plantListCsv } = await import('./js/plantlist.js');
    const l = plantList(window.app.store.doc);
    const csv = await plantListCsv(l).text();
    return { r: l.rows[0], csv };
  });
  assert(list.r.supplier === 'Esveld' && list.r.price > 0 && /esveld\.nl/.test(list.r.url), `plantenlijst: Esveld, € ${list.r.price} per stuk (${list.r.pot})`);
  assert(/;Link\r\n/.test(list.csv) && /https:\/\/esveld\.nl\/a\/product\//.test(list.csv), 'CSV met de link naar het artikel');
  assert(await page.locator('#dlg-shoplist a[href*="esveld.nl"]').count() === 1, 'in de lijst een link naar Esveld');
  await page.screenshot({ path: path.join(OUT, 'esveld-lijst.png') });
  // eigen prijs gaat voor
  await page.fill('#dlg-shoplist [data-f="price"]', '2,50');
  await page.press('#dlg-shoplist [data-f="price"]', 'Tab');
  const own = await page.evaluate(async () => (await import('./js/plantlist.js')).plantList(window.app.store.doc).rows[0].price);
  assert(own === 2.5, 'een eigen prijs gaat voor de Esveld-prijs');
  await page.click('#dlg-shoplist button.x');
  // verwijderen van het apparaat
  page.once('dialog', (d) => d.accept());
  await page.click('#btn-settings');
  await page.click('#set-esveld-remove');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForFunction(() => window.app && window.app.ready);
  assert(await page.evaluate(async () => !(await import('./js/esveld.js')).ESVELD.loaded), 'Verwijderen haalt de catalogus van het apparaat');
  // bron uitzetten in Instellingen
  await page.evaluate(() => { window.app.settings.plantSource = 'alle'; });
  assert(await page.evaluate(() => window.app.plantSource()) === null, 'zonder catalogus of met bron "alle planten": geen Esveld-filter');
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle Esveld-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
