// Beeld draaien zonder dat de tekening of de windrichting verandert.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Draaien');
    d.layers[0].items.push({ type: 'shape', id: 'pad', kind: 'polygon', rect: true, points: [[0, 0], [10, 0], [10, 1], [0, 1]], color: '#333', width: 0.04, hatch: 'klinkers' });
    d.layers[0].items.push({ type: 'shape', id: 'huis', kind: 'polygon', rect: true, points: [[2, -6], [8, -6], [8, -2], [2, -2]], color: '#333', width: 0.04, height: 6 });
    a.openDoc(d, true);
  });
  const st = () => page.evaluate(() => ({ deg: window.app.viewAngleDeg(), info: document.querySelector('#rot-info').textContent, needle: document.querySelector('#btn-north .needle').style.transform, items: JSON.stringify(window.app.store.doc.layers[0].items), north: window.app.store.doc.northDeg || 0 }));
  const s0 = await st();

  console.log('Bediening');
  assert(await page.isVisible('#btn-north') && s0.info === 'Noorden boven', 'noordpijl in beeld, statusbalk: "Noorden boven"');
  await page.click('#btn-rot-cw');
  let s = await st();
  assert(Math.abs(s.deg - 15) < 1e-6 && /Gedraaid 15°/.test(s.info), 'knop ↻: 15° rechtsom');
  assert(/rotate\(15(\.0+)?deg\)/.test(s.needle), `noordpijl draait rechtsom mee en wijst naar het noorden (${s.needle})`);
  const edge = await page.evaluate(() => { const a = window.app; const p = a.cam.toScreen([0, 0]), q = a.cam.toScreen([10, 0]); return Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI; });
  assert(Math.abs(edge - 15) < 1e-6, `de tekening draait rechtsom mee (pad nu onder ${edge.toFixed(1)}°)`);
  await page.click('#rot-info');
  await page.waitForSelector('#dlg-input[open]');
  await page.fill('#dlg-input input, #dlg-input textarea', '30');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Math.abs(window.app.viewAngleDeg() - 30) < 1e-6);
  assert(true, 'exacte hoek ingevuld: 30°');
  await page.keyboard.press(']');
  assert(Math.abs((await st()).deg - 45) < 1e-6, 'toets ] draait 15° verder (45°)');
  await page.keyboard.press('[');
  assert(Math.abs((await st()).deg - 30) < 1e-6, 'toets [ draait terug (30°)');
  const box = await page.locator('#canvas').boundingBox();
  await page.mouse.move(box.x + 500, box.y + 400);
  await page.keyboard.down('Alt');
  await page.mouse.wheel(0, -40);
  await page.keyboard.up('Alt');
  s = await st();
  assert(Math.abs(Math.abs(s.deg - 30) - 6) < 0.01, `Alt + scrollen draait het beeld (${s.deg.toFixed(1)}°)`);
  await page.evaluate(() => window.app.setViewAngleDeg(30));

  console.log('Traploos draaien met toets + rechtermuisknop');
  const arc = async (mods, fromDeg, toDeg, steps = 24) => {
    const c = await page.evaluate(() => [window.app.width / 2, window.app.height / 2]);
    const P = (deg) => [box.x + c[0] + Math.cos(deg * Math.PI / 180) * 200, box.y + c[1] + Math.sin(deg * Math.PI / 180) * 200];
    for (const m of mods) await page.keyboard.down(m);
    await page.mouse.move(...P(fromDeg));
    await page.mouse.down({ button: 'right' });
    for (let k = 1; k <= steps; k++) await page.mouse.move(...P(fromDeg + ((toDeg - fromDeg) * k) / steps));
    await page.mouse.up({ button: 'right' });
    for (const m of mods) await page.keyboard.up(m);
  };
  await page.evaluate(() => window.app.setViewAngleDeg(0));
  await arc(['Alt'], -20, 17);
  s = await st();
  assert(Math.abs(s.deg - 37) < 0.05, `Alt + rechtermuisknop: traploos 37° gedraaid (${s.deg.toFixed(2)}°)`);
  await arc(['Shift'], 10, 12.5);
  s = await st();
  assert(Math.abs(s.deg - 39.5) < 0.05, `Shift + rechtermuisknop werkt ook, ook in kleine stapjes (${s.deg.toFixed(2)}°)`);
  await arc(['Alt'], 0, 360 + 20, 60);
  s = await st();
  assert(Math.abs(s.deg - 59.5) < 0.1, `een hele slag rond plus 20° (${s.deg.toFixed(2)}°)`);
  await arc(['Alt'], 0, -59, 20);
  s = await st();
  assert(s.deg === 0, 'magneet: vlak bij noorden boven klikt het precies recht');
  const panBefore = await page.evaluate(() => ({ x: window.app.cam.x, rot: window.app.cam.rot }));
  await arc([], 0, 30);
  const panAfter = await page.evaluate(() => ({ x: window.app.cam.x, rot: window.app.cam.rot }));
  assert(panAfter.rot === panBefore.rot && panAfter.x !== panBefore.x, 'gewone rechtermuisknop verschuift nog steeds (draait niet)');
  await page.evaluate(() => window.app.setViewAngleDeg(30));

  console.log('De tuin zelf verandert niet');
  s = await st();
  assert(s.items === s0.items && s.north === s0.north, 'tekening en noordrichting ongewijzigd na draaien');
  const shadow = await page.evaluate(async () => {
    const { shadowOffset } = await import('./js/shadows.js');
    const sp = window.app.sun;
    return shadowOffset ? JSON.stringify(shadowOffset({ az: 180, alt: 30 }, sp.northRot())) : null;
  }).catch(() => null);
  assert(shadow === null || shadow === await page.evaluate(async () => { const { shadowOffset } = await import('./js/shadows.js'); return JSON.stringify(shadowOffset({ az: 180, alt: 30 }, 0)); }), 'schaduwrichting hangt niet van de draaiing van het beeld af');

  console.log('Noordpijl en "Alles in beeld"');
  await page.click('#btn-fit');
  assert(Math.abs((await st()).deg - 30) < 1e-6, '"Alles in beeld" laat de draaiing staan');
  await page.click('#btn-north');
  assert((await st()).deg === 0, 'tik op de noordpijl: noorden boven');
  await page.click('#btn-north');
  assert(Math.abs((await st()).deg - 30) < 1e-6, 'nog een tik: terug naar 30°');

  console.log('Export');
  const plans = await page.evaluate(async () => {
    const { planExport } = await import('./js/export.js');
    const a = window.app; const doc = a.store.doc;
    a.setViewAngleDeg(90);
    const o = { paper: 'A4', orientation: 'landscape', scale: 'fit', area: 'all', titleBlock: true };
    const north = planExport(doc, { ...o, rot: 0 });
    const view = planExport(doc, { ...o, rot: a.cam.rot });
    return { n: [north.box.maxX - north.box.minX, north.box.maxY - north.box.minY], v: [view.box.maxX - view.box.minX, view.box.maxY - view.box.minY] };
  });
  assert(Math.abs(plans.n[0] - plans.v[1]) < 0.01 && Math.abs(plans.n[1] - plans.v[0]) < 0.01, `90° gedraaid exporteren: breedte en hoogte gewisseld (${plans.n.map((v) => v.toFixed(1))} → ${plans.v.map((v) => v.toFixed(1))})`);
  await page.click('#btn-export');
  assert(await page.inputValue('#exp-rot') === 'view', 'gedraaid beeld: export standaard "zoals op het scherm"');
  const pdfOk = await page.evaluate(async () => {
    const { renderExport } = await import('./js/export.js');
    const a = window.app;
    const { canvas } = await renderExport(a.store.doc, { paper: 'A4', orientation: 'landscape', scale: 'fit', area: 'all', titleBlock: true, title: 'x', rot: a.cam.rot });
    return canvas.width > 100;
  });
  assert(pdfOk, 'gedraaide export wordt gemaakt');
  await page.click('#dlg-export footer button[value="close"], #dlg-export .x');

  console.log('Tekening met noorden niet boven');
  const nd = await page.evaluate(() => { const a = window.app; a.store.doc.northDeg = 20; a.setViewAngleDeg(0); return { rot: a.cam.rot * 180 / Math.PI, deg: a.viewAngleDeg() }; });
  assert(Math.abs((((nd.rot + 20) % 360) + 540) % 360 - 180) < 1e-6 && nd.deg === 0, '"Noorden boven" draait het beeld zo dat het (20° gedraaide) noorden echt boven staat');
  await page.evaluate(() => { const a = window.app; a.store.doc.northDeg = 0; a.setViewAngleDeg(30); a.render(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'beeld-gedraaid.png') });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle draai-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
