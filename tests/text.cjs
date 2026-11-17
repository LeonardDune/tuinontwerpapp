// Tekst: grootte, lettertype, vet en cursief van geplaatste tekst aanpassen.
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
    const d = newDoc('Tekst'); d.scale = 50;
    // 3,5 mm op papier bij 1:50 = 17,5 cm
    d.layers[0].items.push({ type: 'text', id: 'T', x: 0, y: 0, size: 0.175, text: 'Terras', color: '#222222' });
    a.openDoc(d, true); a.cam.zoom = 120; a.cam.rot = 0; a.cam.x = 300; a.cam.y = 300; a.cameraChanged();
    a.setTool('lasso'); a.setSelection(new Set(['T']));
  });
  const T = () => page.evaluate(() => window.app.store.findItem('T').item);
  console.log('Balk');
  assert(await page.inputValue('#selection-bar input[data-k="textSize"]') === '3,5', 'grootte in mm op papier: 3,5');
  await page.fill('#selection-bar input[data-k="textSize"]', '7');
  await page.press('#selection-bar input[data-k="textSize"]', 'Enter');
  let t = await T();
  assert(Math.abs(t.size - 0.35) < 1e-9, `grootte 7 mm: ${t.size} m bij 1:50`);
  const w0 = await page.evaluate(async () => { const { measureText } = await import('./js/items.js'); return measureText(window.app.store.findItem('T').item).w; });
  await page.selectOption('#selection-bar select[data-k="textFont"]', 'schreef');
  await page.click('#selection-bar [data-act="bold"]');
  await page.click('#selection-bar [data-act="italic"]');
  t = await T();
  assert(t.font === 'schreef' && t.bold && t.italic, 'lettertype schreef, vet en cursief');
  const w1 = await page.evaluate(async () => { const { measureText } = await import('./js/items.js'); return measureText(window.app.store.findItem('T').item).w; });
  assert(w0 > 0.5 && Math.abs(w1 - w0) > 0.005, `breedte volgt het lettertype (${w0.toFixed(2)} → ${w1.toFixed(2)} m)`);
  await page.click('#selection-bar [data-act="bold"]');
  t = await T();
  assert(!t.bold, 'vet weer uit');
  await page.evaluate(() => window.app.store.undo());
  assert((await T()).bold, 'ongedaan maken: weer vet');
  await page.screenshot({ path: path.join(OUT, 'tekst.png') });

  console.log('Tekstgereedschap');
  await page.evaluate(() => { const a = window.app; a.setSelection(new Set()); a.setTool('text'); });
  assert(await page.locator('#options select[title="Lettertype"], select[title="Lettertype"]').count() >= 1, 'lettertype vooraf te kiezen');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle tekst-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
