// Voorbeeldschema's: erkende beplantingen opzoeken, schalen naar de maat van het vak, aanpassen aan de plek, toepassen.
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

  console.log('Bibliotheek');
  const lib = await page.evaluate(async () => {
    const B = await import('./js/borders.js');
    const all = B.allBorders();
    const ferm = all.find((x) => x.id === 'ferm_4seizoenen');
    const small = B.borderPlan(all.find((x) => x.id === 'silbersommer'), { area: 2.5, light: 'zon', moisture: 'droog' });
    const big = B.borderPlan(all.find((x) => x.id === 'silbersommer'), { area: 40, light: 'zon', moisture: 'droog' });
    const fermPlan = B.borderPlan(ferm, { area: 3, light: 'halfzon', moisture: 'normaal' });
    const shade = B.borderPlan(all.find((x) => x.id === 'silbersommer'), { area: 10, light: 'schaduw', moisture: 'normaal' });
    const kat = B.findByLat("Nepeta 'Walker's Low'");
    const sources = [...new Set(all.map((x) => x.source))];
    const noShrubsSmall = B.borderPlan(all.find((x) => x.id === 'rhs_wet_and_dry'), { area: 2, light: 'zon', moisture: 'normaal', btype: 'middel' });
    return {
      n: all.length, sources,
      kat: kat.p?.id, katHow: kat.how,
      fermN: fermPlan.items.length, fermStruct: fermPlan.rows.filter((r) => r.role === 'structuur' && r.final).length,
      small: small.items.filter(([id]) => !id.includes('krokus')).length, big: big.items.length, smallDrop: small.dropped.length,
      shadeSwaps: shade.swaps.length, shadeScore: shade.score, sunScore: B.borderPlan(all.find((x) => x.id === 'silbersommer'), { area: 10, light: 'zon', moisture: 'droog' }).score,
      shrubs: noShrubsSmall.items.map(([id]) => (window.app && null, id)).length,
      shrubNote: noShrubsSmall.notes.join(','),
      ranked: B.rankBorders({ area: 3, light: 'zon', moisture: 'droog' }).slice(0, 3).map((x) => x.border.name),
    };
  });
  assert(lib.n >= 60 && lib.sources.includes('RHS') && lib.sources.includes('Studio FERM') && lib.sources.some((s) => /Arbeitskreis/.test(s)), `${lib.n} schema's van ${lib.sources.length} bronnen`);
  assert(lib.kat === 'kattenkruid' && ['exact', 'cultivar'].includes(lib.katHow), 'planten worden op Latijnse naam gevonden (Nepeta \'Walker\'s Low\' = kattenkruid)');
  assert(lib.fermN === 9 && lib.fermStruct === 3, `Studio FERM 1 × 3 m blijft heel in een vak van 3 m² (${lib.fermN} soorten, 3 structuurplanten)`);
  assert(lib.small < lib.big && lib.smallDrop > 0, `kleiner vak, minder soorten (Silbersommer: ${lib.small} bij 2,5 m², ${lib.big} bij 40 m²)`);
  assert(lib.shadeScore < lib.sunScore - 3 && lib.shadeSwaps > 0, 'een schema voor zon past minder in de schaduw: lager en met vervangers');
  assert(/past niet bij dit type vak/.test(lib.shrubNote) || lib.shrubs <= 4, `heesterrijk schema in een klein middelhoog vak: gemarkeerd (${lib.shrubNote || lib.shrubs})`);
  assert(lib.ranked.length === 3, `best passend voor 3 m² droge zon: ${lib.ranked.join(' | ')}`);

  console.log('Venster');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Schema');
    d.layers[0].items.push({ type: 'shape', id: 'B', name: 'Border', kind: 'polygon', rect: true, bed: true, btype: 'middel', light: 'zon', moisture: 'normaal', planting: { mix: [] }, points: [[0, 0], [3, 0], [3, 1], [0, 1]], color: '#3f7a2e', width: 0.03 });
    a.openDoc(d, true); a.setTool('lasso'); a.setSelection(new Set(['B']));
    a.state.plantStep = 3;
  });
  await page.click('#btn-planting');
  await page.click('#plant-menu [data-pm="bed"]');
  await page.click('#plant-panel [data-act="combos"]');
  const dlg = page.locator('#dlg-borders');
  assert(await dlg.isVisible(), 'knop Voorbeeldschema\'s opent de bibliotheek');
  const first = await dlg.locator('li.border').count();
  assert(first >= 5, `${first} passende schema's voor een border van 3 m² in de zon`);
  assert(/3,0 m²/.test(await dlg.locator('.hint').first().innerText()), 'de maat van het vak staat erbij');
  await dlg.locator('[data-f="blight"]').selectOption('');
  const all = await dlg.locator('li.border').count();
  assert(all > first, `met "Alle standplaatsen" ook de minder passende (${all})`);
  await dlg.locator('[data-f="bq"]').fill('vierseizoenen');
  await dlg.locator('[data-f="bq"]').press('Enter');
  assert(await dlg.isVisible() && await dlg.locator('li.border').count() >= 1 && /Studio FERM/.test(await dlg.locator('li.border').first().innerText()), 'zoeken op naam (Enter sluit het venster niet)');
  await dlg.locator('li.border details summary').first().click();
  const det = await dlg.locator('li.border details').first().innerText();
  assert(/structuur/i.test(det) && /ankerpunt/.test(det), 'planten met hun rol en de tips van de bron');
  await page.screenshot({ path: path.join(OUT, 'voorbeeldschemas.png') });
  await dlg.locator('.useborder').first().click();
  const mix = await page.evaluate(() => { const a = window.app; const bed = a.store.findItem('B').item; const roles = a.store.doc.planting.roles; return bed.planting.mix.map((m) => roles.find((r) => r.id === m.role)?.label); });
  assert(!(await dlg.isVisible()) && mix.length >= 7, `schema toegepast op het vak: ${mix.join(', ')}`);
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle voorbeeldschema-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
