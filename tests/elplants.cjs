// Planten in of bij losse elementen: pot, pergola, haag, leifruit; meerdere soorten en aantallen.
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
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Elementen');
    d.layers[0].items.push(
      { type: 'stencil', id: 'P', symbol: 'pergolagang', x: 3, y: 2, w: 5, h: 2.5, rot: 0, color: '#8a6a45' },
      { type: 'stencil', id: 'H', symbol: 'haag', x: 3, y: 6, w: 6, h: 0.6, rot: 0, color: '#4a6b3a' },
      { type: 'stencil', id: 'F', symbol: 'leifruitrek', x: 3, y: 8, w: 6.6, h: 0.5, rot: 0, color: '#7a6a58' },
      { type: 'stencil', id: 'T', symbol: 'potrond', x: 9, y: 2, w: 0.5, h: 0.5, rot: 0, color: '#b5653a' },
    );
    a.openDoc(d, true); a.setTool('lasso');
  });
  const sel = (id) => page.evaluate((x) => { window.app.setSelection(new Set([x])); window.app.updateSelectionUI(); }, id);
  const pick = async (q) => {
    await page.fill('#dlg-plants [data-f="q"]', q);
    await page.click('#dlg-plants [data-act="search"]').catch(() => {});
    await page.click('#dlg-plants .plant >> nth=0');
  };

  console.log('Pergola');
  await sel('P');
  const btn = page.locator('#selection-bar [data-act="elplants"]');
  assert(/Klimplanten kiezen/.test(await btn.innerText()), 'pergola: knop "Klimplanten kiezen…" in de balk');
  await btn.click();
  const dlg = page.locator('#dlg-elplants');
  assert(await dlg.isVisible(), 'venster met de planten van de pergola');
  await dlg.locator('[data-act="eladd"]').click();
  const types = await page.evaluate(async () => { const D = await import('./js/plantdb.js'); return [...document.querySelectorAll('#dlg-plants .plant b')].slice(0, 40).map((el) => [...D.PLANTS.values()].find((p) => p.nl === el.textContent)?.type); });
  assert(types.length >= 5 && types.every((t) => t === 'klimmer'), `de keuzelijst toont alleen klimplanten (${types.length})`);
  assert(/alleen klimplanten/.test(await page.locator('#dlg-plants .activef').innerText()), 'het filter staat zichtbaar bij de actieve filters');
  await pick('klimroos');
  await dlg.locator('[data-act="eladd"]').click();
  await pick('bosrank');
  let st = await page.evaluate(() => { const a = window.app; const it = a.store.findItem('P').item; const R = Object.fromEntries(a.store.doc.planting.roles.map((r) => [r.id, r])); return { plants: it.plants.map((x) => R[x.role].label), grow: it.growKind, role: it.role === it.plants[0].role }; });
  assert(st.plants.length === 2 && /Klimroos/.test(st.plants[0]) && /Bosrank/.test(st.plants[1]) && st.role, `twee klimplanten op de pergola: ${st.plants.join(' en ')}`);
  assert(st.grow === 'roos', 'de tekening en 3D volgen de eerste klimplant (klimroos)');
  const total = await dlg.locator('.total').innerText();
  assert(/Samen 6 planten/.test(total), `aantal automatisch (één per staander, aan twee kanten): ${total}`);
  await page.screenshot({ path: path.join(OUT, 'element-planten.png') });
  await dlg.locator('.eln').first().fill('3');
  await dlg.locator('.eln').first().press('Tab');
  st = await page.evaluate(() => window.app.store.findItem('P').item.plants.map((x) => x.n || 0));
  assert(st[0] === 3 && st[1] === 0, 'zelf een aantal invullen (3 klimrozen), de rest blijft automatisch');
  await dlg.locator('footer button').click();
  assert(/Planten: Klimroos, Bosrank/.test(await page.locator('#selection-bar [data-act="elplants"]').innerText()), 'de balk toont de gekozen planten');

  console.log('Haag');
  await sel('H');
  await page.locator('#selection-bar [data-act="elplants"]').click();
  await dlg.locator('[data-act="eladd"]').click();
  await pick('haagbeuk');
  await dlg.locator('[data-act="eladd"]').click();
  await pick('liguster');
  const hc = await page.evaluate(async () => { const E = await import('./js/elplants.js'); const a = window.app; const it = a.store.findItem('H').item; const R = Object.fromEntries(a.store.doc.planting.roles.map((r) => [r.id, r])); return E.elementCounts(it, R).map((c) => c.n); });
  assert(hc.length === 2 && hc[0] + hc[1] === 24 && Math.abs(hc[0] - hc[1]) <= 1, `gemengde haag van 6 m: ${hc.join(' + ')} planten (4 per m)`);
  await dlg.locator('footer button').click();

  console.log('Leifruit en pot');
  await sel('F');
  await page.locator('#selection-bar [data-act="elplants"]').click();
  await dlg.locator('[data-act="eladd"]').click();
  const lei = await page.evaluate(async () => { const T = await import('./js/traits.js'); const D = await import('./js/plantdb.js'); return [...document.querySelectorAll('#dlg-plants .plant b')].map((el) => [...D.PLANTS.values()].find((p) => p.nl === el.textContent)).filter(Boolean).every((p) => T.plantTraits(p).has('leiden')); });
  assert(lei, 'leifruit: alleen planten die zich laten leiden');
  await pick('appel');
  await dlg.locator('[data-act="eladd"]').click();
  await pick('perenboom');
  const fr = await page.evaluate(() => window.app.store.findItem('F').item.plants?.length);
  assert(fr === 2, 'leifruit met twee rassen');
  await dlg.locator('footer button').click();
  await sel('T');
  await page.locator('#selection-bar [data-act="elplants"]').click();
  await dlg.locator('[data-act="eladd"]').click();
  await pick('lavendel');
  assert(await page.evaluate(() => window.app.store.findItem('T').item.plants.length === 1), 'pot met lavendel');
  await dlg.locator('footer button').click();

  console.log('Plantenlijst');
  const list = await page.evaluate(async () => {
    const { plantList } = await import('./js/plantlist.js');
    const l = plantList(window.app.store.doc);
    return Object.fromEntries(l.rows.map((r) => [r.nl || r.name || r.label, r.count]));
  });
  const txt = JSON.stringify(list);
  assert(/Klimroos[^,]*":3/.test(txt) && /Bosrank[^,]*":3/.test(txt) && /Lavendel[^,]*":1/.test(txt) && /Appelboom[^,]*":2/.test(txt) && /Liguster[^,]*":12/.test(txt), `de plantenlijst telt de planten van de elementen mee: ${txt}`);
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle element-plant-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
