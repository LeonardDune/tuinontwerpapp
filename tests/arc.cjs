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

  console.log('Plantvak als boog');
  await page.evaluate(() => { const a = window.app; a.setSelection(new Set()); a.state.plantMode = 'vak'; a.state.plantShape = 'boog'; a.setTool('plant'); });
  assert(await page.isVisible('.arc-opt'), 'Beplanten → Boog: ook hier breedte en hoek');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle boog-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
