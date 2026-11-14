// Verbanden als bouwsteen (berekend uit de steenmaat), eigen bouwstenen bewaren, en losse stenen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);

  console.log('Patronen kloppen');
  const geo = await page.evaluate(async () => {
    const { BOND_TYPES, BOND_PRESETS, bondLayout } = await import('./js/bonds.js');
    const bad = [];
    for (const [id, p] of Object.entries(BOND_PRESETS)) {
      for (const size of [[0.2, 0.05], [0.2, 0.067], [0.21, 0.105], [0.6, 0.3]]) {
        const L = bondLayout({ ...p.bond, l: size[0], w: size[1] });
        // elk rastervakje (fijn raster) in één herhaling moet door precies één steen bedekt zijn
        const R = 12, W = Math.round(L.px * R), H = Math.round(L.py * R), cnt = new Uint8Array(W * H);
        for (const [x, y, w, h] of L.list) {
          const x0 = Math.round(x * R), y0 = Math.round(y * R), x1 = Math.round((x + w) * R), y1 = Math.round((y + h) * R);
          const seen = new Set();
          for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const k = (((yy % H) + H) % H) * W + (((xx % W) + W) % W); if (!seen.has(k)) { seen.add(k); cnt[k]++; } }
        }
        // dubbel opgegeven stenen (zelfde plek) tellen als één
        const uniq = new Set(L.list.map(([x, y, w, h]) => [((x % L.px) + L.px) % L.px, ((y % L.py) + L.py) % L.py, w, h].map((v) => Math.round(v * R)).join()));
        let area = 0; for (const u of uniq) { const [, , w, h] = u.split(',').map(Number); area += w * h; }
        const holes = cnt.filter((v) => v === 0).length;
        // verbanden met een vaste verhouding moeten exact sluiten; bij een vrije verspringing mag afronding van het telraster meetellen
        if (L.T.ratio ? (holes || area !== W * H) : (holes > W * H * 0.03 || Math.abs(area - W * H) > W * H * 0.03)) bad.push(`${id} ${size.join('×')}: ${holes} gaten, oppervlak ${area}/${W * H}`);
      }
    }
    return { bad, types: Object.keys(BOND_TYPES).length, presets: Object.keys(BOND_PRESETS).length };
  });
  assert(!geo.bad.length, `alle ${geo.presets} bouwstenen (${geo.types} verbanden) vullen het vlak precies, bij 4 steenmaten` + (geo.bad.length ? ': ' + geo.bad.slice(0, 4).join(' | ') : ''));

  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { BOND_PRESETS } = await import('./js/bonds.js');
    a.settings.bondLibrary = {};
    const d = newDoc('Bouwstenen'); const L = d.layers[0].items;
    Object.entries(BOND_PRESETS).forEach(([k, v], i) => { const x = (i % 6) * 2.3, y = Math.floor(i / 6) * 2.5; L.push({ type: 'shape', id: k, kind: 'polygon', rect: true, points: [[x, y], [x + 2, y], [x + 2, y + 2], [x, y + 2]], color: '#333', width: 0.02, hatch: 'bond', bond: { ...v.bond }, bondName: v.name, ...(v.border ? { border: v.border } : {}) }); });
    L.push({ type: 'shape', id: 'V', kind: 'polygon', rect: true, points: [[0, 8], [3, 8], [3, 10], [0, 10]], color: '#333', width: 0.02 });
    a.openDoc(d, true); a.cam.zoom = 95; a.cam.rot = 0; a.cam.x = 40; a.cam.y = 30; a.cameraChanged(); a.settings.grid = false; a.render();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'bouwstenen-klinkers.png') });

  console.log('Toepassen en aanpassen');
  await page.evaluate(() => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set(['V'])); });
  await page.selectOption('#selection-bar select[data-k="hatch"]', 'bs:pre:k-visgraat-kei');
  let v = await page.evaluate(() => window.app.store.findItem('V').item);
  assert(v.hatch === 'bond' && v.bond.type === 'visgraat' && v.bond.l === 0.2 && v.bond.w === 0.1, 'bouwsteen "visgraat keiformaat" op een vlak gezet');
  await page.selectOption('#selection-bar select[data-k="bondSize"]', 'dik');
  await page.selectOption('#selection-bar select[data-k="bondFinish"]', 'gemeleerd');
  await page.fill('#selection-bar input[data-k="bondJoint"]', '8');
  await page.press('#selection-bar input[data-k="bondJoint"]', 'Enter');
  v = await page.evaluate(() => window.app.store.findItem('V').item);
  assert(Math.abs(v.bond.w - 0.067) < 1e-9 && v.bond.finish === 'gemeleerd' && Math.abs(v.bond.joint - 0.008) < 1e-9, 'steenmaat (dikformaat), afwerking (gemêleerd) en voeg (8 mm) aangepast');
  const filled = await page.evaluate(() => { const a = window.app; a.setSelection(new Set()); a.cam.y = -500; a.cameraChanged(); a.render(); const c = document.querySelector('#canvas'); const g = c.getContext('2d'); const dpr = c.width / a.width; const p = a.cam.toScreen([1.5, 9]); const d = g.getImageData(Math.round(p[0] * dpr) - 20, Math.round(p[1] * dpr) - 20, 40, 40).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add(d[i] >> 4); return set.size; });
  assert(filled >= 3, 'het vlak toont stenen en voegen');

  console.log('Bewaren als eigen bouwsteen');
  await page.evaluate(() => window.app.setSelection(new Set(['V'])));
  await page.click('#selection-bar [data-act="saveBond"]');
  await page.waitForSelector('#dlg-input[open]');
  await page.fill('#dlg-input input, #dlg-input textarea', 'Mijn terras');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Object.values(window.app.settings.bondLibrary || {}).some((x) => x.name === 'Mijn terras'));
  assert(true, 'bouwsteen "Mijn terras" bewaard in de bibliotheek');
  const libId = await page.evaluate(() => Object.keys(window.app.settings.bondLibrary)[0]);
  // in een nieuwe tekening beschikbaar
  await page.evaluate(async () => { const a = window.app; const { newDoc } = await import('./js/model.js'); const d = newDoc('Andere tekening'); d.layers[0].items.push({ type: 'shape', id: 'W', kind: 'polygon', rect: true, points: [[0, 0], [3, 0], [3, 2], [0, 2]], color: '#333', width: 0.02 }); a.openDoc(d, true); a.setTool('lasso'); a.setSelection(new Set(['W'])); });
  await page.selectOption('#selection-bar select[data-k="hatch"]', `bs:my:${libId}`);
  const w = await page.evaluate(() => window.app.store.findItem('W').item);
  assert(w.bond && w.bond.finish === 'gemeleerd' && Math.abs(w.bond.w - 0.067) < 1e-9 && w.bondName === 'Mijn terras', 'eigen bouwsteen te gebruiken in een andere tekening');
  await page.click('#selection-bar [data-act="deleteBond"]');
  assert(await page.evaluate(() => Object.keys(window.app.settings.bondLibrary).length) === 0 && (await page.evaluate(() => window.app.store.findItem('W').item.bond)), 'bouwsteen verwijderen: weg uit de lijst, het vlak blijft zoals het is');
  await page.selectOption('#selection-bar select[data-k="hatch"]', 'gras');
  assert(!(await page.evaluate(() => window.app.store.findItem('W').item.bond)), 'ander materiaal kiezen haalt het verband weg');

  console.log('Gereedschap Verharden en paneel Verharding');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    a.settings.bondLibrary = { mijn1: { name: 'Oprit antraciet', bond: { type: 'keper', l: 0.21, w: 0.105, joint: 0.003, color: '#4a4d52', jointColor: '#6a6a66', finish: 'glad' }, border: 'rollaag' } };
    a.openDoc(newDoc('Verharden'), true); a.cam.zoom = 70; a.cam.rot = 0; a.cam.x = 120; a.cam.y = 150; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false; a.state.paveShape = 'rechthoek'; a.state.paveBlock = null;
  });
  await page.click('#btn-paving');
  assert(await page.isVisible('#pave-panel') && /Oprit antraciet/.test(await page.locator('#pave-panel').innerText()) && /Visgraat/.test(await page.locator('#pave-panel').innerText()), 'paneel Verharding toont mijn bouwstenen en de klinkerverbanden');
  await page.click('#pave-panel [data-list="my"] li.role');
  assert(await page.evaluate(() => window.app.state.tool === 'pave' && window.app.state.paveBlock === 'my:mijn1'), 'bouwsteen kiezen activeert het gereedschap Verharden');
  const box = await page.locator('#canvas').boundingBox();
  const SS = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  { const [x0, y0] = await SS(0, 0), [x1, y1] = await SS(5, 3); await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up(); }
  let vak = await page.evaluate(() => window.app.store.doc.layers[0].items.find((i) => i.bond));
  assert(vak && vak.hatch === 'bond' && vak.bond.type === 'keper' && vak.bondName === 'Oprit antraciet' && vak.border === 'rollaag' && vak.rect, 'verhardingsvak getekend met de gekozen bouwsteen (met rand)');
  await page.evaluate((id) => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set([id])); }, vak.id);
  assert(/Verharding/.test(await page.locator('#selection-bar .count').innerText()) && /15 m²/.test(await page.locator('#selection-bar').innerText()), 'balk: "Verharding" met oppervlakte en aantal stenen');
  await page.fill('#selection-bar input[data-k="vakName"]', 'Oprit');
  await page.press('#selection-bar input[data-k="vakName"]', 'Enter');
  const ov = await page.locator('#pave-panel section').first().innerText();
  assert(/Oprit antraciet/.test(ov) && /Oprit/.test(ov) && /15 m²/.test(ov) && /st\./.test(ov), `overzicht: ${ov.replace(/\n/g, ' ').slice(0, 90)}`);
  await page.evaluate(() => { window.app.setSelection(new Set()); window.app.render(); });
  await page.screenshot({ path: path.join(OUT, 'verharding-paneel.png') });
  await page.evaluate(() => { window.app.pavePanel.close(); window.app.settings.bondLibrary = {}; });

  console.log('Losse stenen');
  const st = await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { STENCILS } = await import('./js/stencils.js');
    const defs = STENCILS.filter((x) => x.cat === 'Stenen, tegels en klinkers');
    const d = newDoc('Stenen'); let x = 0;
    defs.forEach((s2, i) => { ['glad', 'getrommeld', 'structuur', 'gemeleerd'].forEach((f, r) => d.layers[0].items.push({ type: 'stencil', id: s2.id + r, symbol: s2.id, x: x + s2.w / 2, y: r * 1.3, w: s2.w, h: s2.h, rot: 0, color: s2.color, finish: f, seed: i })); x += s2.w + 0.15; });
    a.openDoc(d, true); a.fitView(true); a.settings.grid = false; a.setTool('lasso'); a.setSelection(new Set(['steen_waal0'])); a.render();
    return defs.length;
  });
  assert(st >= 25, `sectie "Stenen, tegels en klinkers" met ${st} standaardmaten`);
  await page.selectOption('#selection-bar select[data-k="stoneSize"]', 't6030');
  await page.selectOption('#selection-bar select[data-k="finish"]', 'structuur');
  const s1 = await page.evaluate(() => window.app.store.findItem('steen_waal0').item);
  assert(s1.w === 0.6 && s1.h === 0.3 && s1.finish === 'structuur', 'losse steen: standaardmaat (60×30) en afwerking (structuur) aangepast');
  await page.evaluate(() => { window.app.setSelection(new Set()); window.app.render(); });
  await page.screenshot({ path: path.join(OUT, 'losse-stenen.png') });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle bouwsteen-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
