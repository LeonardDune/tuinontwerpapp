// Boogvormig vak: een halfrond pad om een rond plantvak, met binnen-Ø, breedte en hoek in de balk.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 850 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Boog');
    // rond plantvak, Ø 2,40 m, middelpunt (0, 0)
    d.layers[0].items.push({ type: 'shape', id: 'BED', kind: 'circle', points: [[0, 0], [1.2, 0]], color: '#3f7a2e', width: 0.03, bed: true, planting: { mix: [] } });
    a.openDoc(d, true); a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 600; a.cam.y = 380; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = true; a.settings.grid = false;
    a.state.paveShape = 'boog'; a.state.arcWidth = 0.8; a.state.arcAngle = 180; a.state.paveBlock = 'pre:h-kalk-geel';
    a.setTool('pave');
  });
  assert(await page.isVisible('#options .arc-opt, .arc-opt'), 'Verharden → Boog: breedte en hoek in de opties');
  const scr = await page.evaluate(() => { const a = window.app; const r = document.querySelector('#canvas').getBoundingClientRect(); const o = a.cam.toScreen([0, 0]); return { x: r.left + o[0], y: r.top + o[1], z: a.cam.zoom }; });
  const S = (x, y) => [scr.x + x * scr.z, scr.y + y * scr.z];

  console.log('Tekenen');
  // vanaf (bijna) het middelpunt naar (bijna) de rand van het ronde vak, naar links: snapt aan middelpunt en rand
  let [x, y] = S(0.05, 0.04); await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { const [mx, my] = S(0.05 - (1.27 * i) / 8, 0.04); await page.mouse.move(mx, my); }
  await page.mouse.up();
  const arcItem = () => page.evaluate(async () => {
    const { arcParams } = await import('./js/arc.js');
    const it = window.app.store.doc.layers[0].items.find((i) => i.arc);
    return it ? { it, p: arcParams(it.points) } : null;
  });
  let r = await arcItem();
  assert(r && r.p, 'boogvak getekend');
  const near = (a, b2, t = 0.02) => Math.abs(a - b2) < t;
  assert(near(r.p.c[0], 0) && near(r.p.c[1], 0), `middelpunt gesnapt aan het middelpunt van het ronde vak (${r.p.c.map((v) => v.toFixed(3))})`);
  assert(near(r.p.r1, 1.2) && near(r.p.r2, 2.0), `binnenrand op de rand van het vak (r ${r.p.r1.toFixed(2)}), breedte 0,80 m`);
  assert(near(r.p.sweep, Math.PI, 1e-3), 'halve cirkel (180°)');
  // de boog ligt aan de kant waar je naartoe sleept (links): alle punten met x ≤ 0
  assert(r.it.points.every((p) => p[0] <= 0.1), 'boog ligt aan de linkerkant (richting van het slepen)');
  assert(r.it.hatch === 'bond' && r.it.bond.fill === 'kalk', 'met de gekozen bouwsteen (halfverharding)');
  await page.screenshot({ path: path.join(OUT, 'boog.png') });

  console.log('Aanpassen in de balk');
  await page.evaluate((id) => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set([id])); }, r.it.id);
  const val = (k) => page.inputValue(`#selection-bar input[data-k="${k}"]`);
  assert(await val('arcD') === '2,4' && await val('arcW') === '0,8' && await val('arcDeg') === '180', 'balk: binnen-Ø 2,4 m, breedte 0,8 m, boog 180°');
  await page.fill('#selection-bar input[data-k="arcW"]', '1,2'); await page.press('#selection-bar input[data-k="arcW"]', 'Enter');
  r = await arcItem();
  assert(near(r.p.r1, 1.2, 1e-3) && near(r.p.r2, 2.4, 1e-3), 'breedte 1,2 m: binnenrand blijft liggen');
  await page.fill('#selection-bar input[data-k="arcDeg"]', '90'); await page.press('#selection-bar input[data-k="arcDeg"]', 'Enter');
  r = await arcItem();
  assert(near(r.p.sweep, Math.PI / 2, 1e-3) && near(Math.cos(r.p.mid), -1, 1e-3), 'boog 90°: zelfde middenrichting');
  await page.fill('#selection-bar input[data-k="arcD"]', '3'); await page.press('#selection-bar input[data-k="arcD"]', 'Enter');
  r = await arcItem();
  assert(near(r.p.r1, 1.5, 1e-3) && near(r.p.r2 - r.p.r1, 1.2, 1e-3) && near(r.p.c[0], 0, 1e-3), 'binnen-Ø 3 m: breedte en middelpunt blijven');
  assert(await page.locator('#selection-bar input[data-k="w"]').count() === 0, 'geen gewone B×D-velden bij een boog');

  console.log('Verschuiven, draaien en spiegelen');
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => window.app.flushNudge?.());
  await page.evaluate(() => { window.app.applyProperty('rotby', '45'); window.app.flipSelection('h'); });
  r = await arcItem();
  assert(r.p && near(r.p.r1, 1.5, 1e-3) && near(r.p.sweep, Math.PI / 2, 1e-3), 'na verschuiven, draaien en spiegelen nog steeds een boog met dezelfde maten');
  assert(await val('arcD') === '3', 'balk blijft de boogmaten tonen');
  const handles = await page.evaluate(() => window.app.tool.handles().list.filter((h) => h.kind === 'vertex').length);
  assert(handles === 0, 'geen tientallen hoekpuntgrepen op de boog');

  console.log('Punten bewerken: boog');
  const rect = await page.evaluate(() => { const r = document.querySelector('#canvas').getBoundingClientRect(); return [r.left, r.top]; });
  const handle = (kind, role) => page.evaluate(([kind, role]) => { const h = window.app.tool.handles().list.find((g) => g.kind === kind && (role == null || g.role === role || g.i === role)); return h ? h.s : null; }, [kind, role]);
  const dragTo = async (from, to) => {
    await page.mouse.move(rect[0] + from[0], rect[1] + from[1]); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(rect[0] + from[0] + ((to[0] - from[0]) * i) / 8, rect[1] + from[1] + ((to[1] - from[1]) * i) / 8);
    await page.mouse.up();
  };
  await page.evaluate(async () => {
    const a = window.app; const { arcParams } = await import('./js/arc.js');
    const it = a.store.doc.layers[0].items.find((i) => i.arc); const p = arcParams(it.points);
    a.settings.snap = false; a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 550 - p.c[0] * 60; a.cam.y = 220 - p.c[1] * 60; a.cameraChanged(); a.render();
  });
  await page.click('#selection-bar [data-act="points"]');
  assert(await page.evaluate(() => window.app.tool.handles().list.filter((h) => h.kind === 'arc').length) === 6, 'boog: 4 hoekgrepen en 2 grepen midden op de randen');
  let before = (await arcItem()).p;
  // middengreep van de buitenrand 0,5 m naar buiten: alleen de buitenstraal verandert
  let hs = await handle('arc', 'om');
  const out = [Math.cos(before.mid), Math.sin(before.mid)];
  await dragTo(hs, [hs[0] + out[0] * 30, hs[1] + out[1] * 30]);
  r = await arcItem();
  assert(r.p && near(r.p.r2, before.r2 + 0.5, 0.03) && near(r.p.r1, before.r1, 1e-3) && near(r.p.sweep, before.sweep, 1e-3), `buitenrand 0,5 m naar buiten (${before.r2.toFixed(2)} → ${r.p.r2.toFixed(2)} m), rest blijft`);
  // hoekpunt van de buitenrand langs de rand verder trekken: de boog wordt langer, de binnenrand blijft
  before = r.p;
  hs = await handle('arc', 'o1');
  const cS = await page.evaluate((c) => window.app.cam.toScreen(c), before.c);
  const a1 = Math.atan2(hs[1] - cS[1], hs[0] - cS[0]) + 0.35, R = Math.hypot(hs[0] - cS[0], hs[1] - cS[1]);
  await dragTo(hs, [cS[0] + Math.cos(a1) * R, cS[1] + Math.sin(a1) * R]);
  r = await arcItem();
  assert(r.p && r.p.sweep > before.sweep + 0.2 && near(r.p.isweep, before.isweep, 1e-3) && near(r.p.r2, before.r2, 0.03), `buitenhoek verder getrokken: buitenrand langer (${Math.round(before.sweep * 57.3)}° → ${Math.round(r.p.sweep * 57.3)}°), binnenrand blijft (schuin uiteinde)`);
  await page.screenshot({ path: path.join(OUT, 'boog-punten.png') });

  console.log('Punten bewerken: rechthoek');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { BOND_PRESETS } = await import('./js/bonds.js');
    const d = newDoc('Hoeken');
    d.layers[0].items.push({ type: 'shape', id: 'T', kind: 'polygon', rect: true, points: [[0, 0], [3, 0], [3, 2], [0, 2]], color: '#333', width: 0.02, hatch: 'bond', bond: JSON.parse(JSON.stringify(BOND_PRESETS['k-half-waal'].bond)) });
    a.openDoc(d, true); a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 400; a.cam.y = 250; a.cameraChanged(); a.settings.snap = false;
    a.setTool('lasso'); a.setSelection(new Set(['T']));
  });
  assert(await page.evaluate(() => window.app.tool.handles().list.filter((h) => h.kind === 'vertex').length) === 0, 'rechthoek: normaal geen losse hoekpunten (wel vergroten/verkleinen)');
  await page.click('#selection-bar [data-act="points"]');
  assert(await page.evaluate(() => window.app.tool.handles().list.filter((h) => h.kind === 'vertex').length) === 4, 'Punten bewerken: 4 hoekpunten');
  hs = await handle('vertex', 2);
  await dragTo(hs, [hs[0] + 80, hs[1] + 40]);
  const T = await page.evaluate(() => window.app.store.findItem('T').item);
  assert(!T.rect && Math.abs(T.points[2][0] - 4) < 0.02 && Math.abs(T.points[2][1] - 2.5) < 0.02 && T.points[1][0] === 3 && T.points[3][1] === 2, `één hoek verschoven naar (${T.points[2].map((v) => v.toFixed(2))}), de rest blijft; nu een vrije vorm`);
  await page.evaluate(() => window.app.setSelection(new Set()));
  assert(await page.evaluate(() => window.app.pointEdit) == null, 'selectie weg: Punten bewerken uit');

  console.log('Plantvak als boog');
  await page.evaluate(() => { const a = window.app; a.setSelection(new Set()); a.state.plantMode = 'vak'; a.state.plantShape = 'boog'; a.setTool('plant'); });
  assert(await page.isVisible('.arc-opt'), 'Beplanten → Boog: ook hier breedte en hoek');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle boog-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
