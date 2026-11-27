// Beplanting samenstellen: hoogte, zon, grond en kleurenschema altijd goed; bloei door het jaar en afwisseling
// in vorm zo goed mogelijk; zonuren per vak uit de zonnestudie; combinaties aangepast aan het vak.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);

  console.log('Samensteller over alle omstandigheden');
  const r = await page.evaluate(async () => {
    const C = await import('./js/composer.js'); const D = await import('./js/plantdb.js');
    const role = (id, rl) => ({ ...D.roleFromPlant(D.plantById(id)), role: rl, code: '' });
    let n = 0, hardFail = [], bloomOk = 0, formsOk = 0, empty = [];
    for (const btype of ['bodem', 'laag', 'middel', 'hoog', 'heesters']) {
      for (const light of ['zon', 'half', 'schaduw']) {
        for (const moisture of ['droog', 'normaal', 'vochtig']) {
          for (const scheme of [{ type: 'vrij' }, { type: 'koel' }, { type: 'warm' }]) {
            const ctx = { btype, light, moisture, scheme };
            for (const seed of [1, 2]) {
              const { items } = C.compose(ctx, seed);
              n++;
              if (!items.length) { empty.push(`${btype}/${light}/${moisture}/${scheme.type}`); continue; }
              const checks = C.checkPlanting(items.map(([id, rl, w]) => ({ role: role(id, rl), w })), ctx);
              const get = (k) => checks.find((c) => c.key === k);
              for (const k of ['hoogte', 'zon', 'grond', 'kleur']) if (get(k) && get(k).ok === false) hardFail.push(`${btype}/${light}/${moisture}/${scheme.type}: ${get(k).text}`);
              if (get('bloei').ok) bloomOk++;
              if (get('vormen').ok) formsOk++;
            }
          }
        }
      }
    }
    return { n, hardFail, bloomOk, formsOk, empty };
  });
  assert(!r.hardFail.length, `${r.n} voorstellen: hoogte, zon, grond en kleurenschema kloppen altijd` + (r.hardFail.length ? ': ' + r.hardFail.slice(0, 3).join(' | ') : ''));
  const filled = r.n - r.empty.length;
  assert(r.empty.length < r.n * 0.1, `bijna altijd een voorstel (${filled} van ${r.n}; zonder: ${r.empty.slice(0, 3).join(', ')}${r.empty.length > 3 ? ' …' : ''})`);
  assert(r.formsOk >= filled * 0.8, `minstens 3 bloeivormen in ${r.formsOk} van ${filled}`);
  assert(r.bloomOk >= filled * 0.5, `bloei van april t/m oktober zonder gat in ${r.bloomOk} van ${filled} (met een kleurenschema, in vochtige schaduw of droogte is er minder keus; de checklist zegt het dan)`);
  const border = await page.evaluate(async () => {
    const C = await import('./js/composer.js'); const D = await import('./js/plantdb.js');
    const role = (id, rl) => ({ ...D.roleFromPlant(D.plantById(id)), role: rl, code: '' });
    let ok = 0, n = 0;
    for (const btype of ['laag', 'middel', 'hoog']) for (const light of ['zon', 'half', 'schaduw']) for (const moisture of ['droog', 'normaal', 'vochtig']) {
      const { items } = C.compose({ btype, light, moisture, scheme: { type: 'vrij' } }, 1); n++;
      if (C.checkPlanting(items.map(([id, rl, w]) => ({ role: role(id, rl), w })), { btype, light, moisture }).find((x) => x.key === 'bloei').ok) ok++;
    }
    return { ok, n };
  });
  assert(border.ok >= border.n * 0.7, `borders zonder kleurenschema: bloei zonder gat in ${border.ok} van ${border.n} situaties`);

  console.log('Combinaties');
  const cb = await page.evaluate(async () => {
    const C = await import('./js/composer.js'); const K = await import('./js/combos.js'); const D = await import('./js/plantdb.js');
    const role = (id, rl) => ({ ...D.roleFromPlant(D.plantById(id)), role: rl, code: '' });
    const ownLight = K.COMBOS.filter((c) => C.checkPlanting(c.items.map(([id, rl, w]) => ({ role: role(id, rl), w })), { btype: c.btype, light: c.light }).find((x) => x.key === 'zon').ok === false).map((c) => c.id);
    // prairie (zon, droog-normaal) in een vochtig vak in de halfschaduw: aangepast
    const prairie = K.COMBOS.find((c) => c.id === 'middel_prairie');
    const ctx = { btype: 'middel', light: 'half', moisture: 'vochtig', scheme: { type: 'vrij' } };
    const a = C.adaptItems(prairie.items, ctx);
    const after = C.checkPlanting(a.items.map(([id, rl, w]) => ({ role: role(id, rl), w })), ctx);
    return { ownLight, swaps: a.swaps.length, zon: after.find((x) => x.key === 'zon').ok, grond: after.find((x) => x.key === 'grond').ok };
  });
  assert(!cb.ownLight.length, 'alle combinaties kunnen tegen hun eigen standplaats' + (cb.ownLight.length ? ': ' + cb.ownLight.join(', ') : ''));
  assert(cb.swaps >= 2 && cb.zon && cb.grond, `prairie in een vochtig vak in de halfschaduw: ${cb.swaps} planten vervangen, daarna klopt zon en grond`);

  console.log('Zonuren uit de zonnestudie');
  const sun = await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Zon');
    d.layers[0].items.push({ type: 'shape', id: 'H', kind: 'polygon', rect: true, points: [[-5, 0], [15, 0], [15, 10], [-5, 10]], color: '#333', width: 0.1, height: 8 });
    d.layers[0].items.push({ type: 'shape', id: 'N', kind: 'polygon', rect: true, bed: true, btype: 'middel', planting: { mix: [] }, points: [[2, -3], [8, -3], [8, 0], [2, 0]], color: '#3f7a2e', width: 0.03 });
    d.layers[0].items.push({ type: 'shape', id: 'V', kind: 'polygon', rect: true, bed: true, planting: { mix: [] }, points: [[2, -40], [8, -40], [8, -37], [2, -37]], color: '#3f7a2e', width: 0.03 });
    a.openDoc(d, true); a.cam.zoom = 40; a.cam.x = 300; a.cam.y = 300; a.cameraChanged();
    await a.plantPanel.measureSun(a.store.findItem('N').item);
    await a.plantPanel.measureSun(a.store.findItem('V').item);
    const N = a.store.findItem('N').item, V = a.store.findItem('V').item;
    return { nh: N.sunHours, nl: N.light, vh: V.sunHours, vl: V.light };
  });
  assert(sun.nl === 'half' && sun.nh >= 3 && sun.nh < 6, `vak pal ten noorden van een huis van 8 m: ${sun.nh} uur, halfschaduw`);
  assert(sun.vl === 'zon' && sun.vh > 12, `vak vrij in de tuin: ${sun.vh} uur, zon`);

  console.log('In het paneel');
  await page.evaluate(() => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set(['N'])); });
  await page.evaluate(() => { window.app.state.plantStep = 1; });
  await page.click('#btn-planting');
  await page.click('#plant-menu [data-pm="bed"]');
  assert(/3|4|5/.test(await page.inputValue('#plant-panel [data-k="bedlight"]').then(() => page.textContent('#plant-panel .sunh'))) && (await page.inputValue('#plant-panel [data-k="bedlight"]')) === 'half', 'standplaats en gemeten zonuren in "Dit vak"');
  await page.selectOption('#plant-panel [data-k="bedmoist"]', 'vochtig');
  await page.click('#plant-panel .steps [data-step="3"]');
  await page.click('#plant-panel [data-act="compose"]');
  const prop = await page.evaluate(() => [...document.querySelectorAll('#plant-panel .proposal .checks li')].map((li) => li.className + ':' + li.textContent.trim()));
  assert(prop.length >= 6 && prop.filter((x) => /^(hoogte|zon|grond)/i.test(x.split(':')[1].replace(/^[✓✗?]\s*/, ''))).every((x) => x.startsWith('ok')), `voorstel met checklist (${prop.map((x) => x.split(':')[1].slice(0, 9)).join(', ')})`);
  const first = await page.textContent('#plant-panel .proposal .prop');
  await page.click('#plant-panel .proposal [data-act="again"]');
  assert(first !== await page.textContent('#plant-panel .proposal .prop'), 'nog een voorstel geeft andere planten');
  await page.click('#plant-panel .proposal [data-act="use"]');
  const mix = await page.evaluate(() => window.app.store.findItem('N').item.planting.mix.length);
  assert(mix >= 4, `voorstel in het vak gezet (${mix} soorten)`);
  assert(await page.locator('#plant-panel .bedchecks li').count() >= 6, 'controle van het vak (standplaats, 4 momenten, groene soep, structuur)');
  await page.screenshot({ path: path.join(OUT, 'samensteller.png') });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle samensteller-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
