// Nudgen met de pijltjestoetsen: kleine stapjes, ook bij een gedraaid beeld; één stap ongedaan maken.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123/';
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
    const d = newDoc('Nudgen');
    d.layers[0].items.push({ type: 'shape', id: 'R', kind: 'polygon', rect: true, points: [[0, 0], [2, 0], [2, 1], [0, 1]], color: '#333', width: 0.03 });
    d.layers[0].items.push({ type: 'stencil', id: 'S', symbol: 'heester', x: 4, y: 0, w: 1.5, h: 1.5, rot: 0, color: '#7aa64b' });
    a.openDoc(d, true); a.cam.zoom = 80; a.cam.rot = 0; a.cam.x = 300; a.cam.y = 300; a.cameraChanged();
    a.setTool('lasso'); a.setSelection(new Set(['R', 'S']));
  });
  const R = () => page.evaluate(() => window.app.store.findItem('R').item.points[0]);
  const S = () => page.evaluate(() => { const i = window.app.store.findItem('S').item; return [i.x, i.y]; });
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  await page.keyboard.press('ArrowRight');
  let p = await R();
  assert(near(p[0], 0.01) && near(p[1], 0), `pijl rechts: 1 cm naar rechts (${p.map((v) => v.toFixed(3))})`);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+ArrowUp');
  p = await R();
  assert(near(p[0], 0.02) && near(p[1], -0.09), `nog 1 cm rechts, 1 cm omlaag, Shift + pijl omhoog 10 cm (${p.map((v) => v.toFixed(3))})`);
  await page.keyboard.press('Alt+ArrowLeft');
  p = await R();
  assert(near(p[0], 0.019), `Alt + pijl: 1 mm (${p[0].toFixed(4)})`);
  const s = await S();
  assert(near(s[0], 4.019) && near(s[1], -0.09), 'alle geselecteerde elementen schuiven mee');
  await page.waitForTimeout(900);
  await page.click('#btn-undo');
  p = await R();
  assert(near(p[0], 0) && near(p[1], 0), 'één keer ongedaan maken zet alle stapjes terug');

  console.log('Gedraaid beeld');
  await page.evaluate(() => { const a = window.app; a.setViewAngleDeg(90); a.setSelection(new Set(['R'])); });
  await page.keyboard.press('ArrowRight');
  const dir = await page.evaluate(() => { const a = window.app; const p = a.store.findItem('R').item.points[0]; const s0 = a.cam.toScreen([0, 0]), s1 = a.cam.toScreen(p); return [s1[0] - s0[0], s1[1] - s0[1]]; });
  assert(dir[0] > 0.5 && Math.abs(dir[1]) < 1e-6, `bij een gedraaid beeld gaat pijl rechts ook op het scherm naar rechts (${dir.map((v) => v.toFixed(2))} px)`);

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle nudge-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
