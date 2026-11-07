// Verbanden voor bestrating en randen (rollaag, kasseien, opsluitband).
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
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  const ks = ['romaans', 'mandverband', 'achthoek', 'waalformaat', 'waaier', 'flagstones', 'visgraat', 'grootformaat', 'keper', 'oudhollands', 'kasseien', 'molenwiek', 'hardsteen', 'klinkers', 'rustiek', 'tegels30', 'stapel', 'cirkel'];
  const known = await page.evaluate(async (ks) => { const { HATCHES } = await import('./js/patterns.js'); return ks.filter((k) => HATCHES[k]); }, ks);
  assert(known.length === ks.length, `alle ${ks.length} verbanden uit het voorbeeld bestaan`);
  // elk patroon tekent echt iets (de tegel is niet leeg)
  const empty = await page.evaluate(async (ks) => {
    const { hatchPattern } = await import('./js/patterns.js');
    const out = [];
    for (const k of ks) {
      if (k === 'cirkel') continue;
      const c = document.createElement('canvas'); c.width = c.height = 200; const g = c.getContext('2d');
      g.fillStyle = hatchPattern(g, k, '#333333', 0, [0, 0]); g.setTransform(400, 0, 0, 400, 0, 0); g.fillRect(0, 0, 0.5, 0.5);
      const d = g.getImageData(0, 0, 200, 200).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      if (n < 200) out.push(k);
    }
    return out;
  }, ks);
  assert(!empty.length, 'elk verband tekent stenen' + (empty.length ? ': leeg ' + empty.join() : ''));

  await page.evaluate(async (ks) => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Verbanden'); const L = d.layers[0].items;
    ks.forEach((k, i) => { const x = (i % 6) * 2.3, y = Math.floor(i / 6) * 2.6; L.push({ type: 'shape', id: k, kind: 'polygon', rect: true, points: [[x, y], [x + 2, y], [x + 2, y + 2], [x, y + 2]], color: '#333', width: 0.02, hatch: k }); L.push({ type: 'text', id: 't' + k, text: k, x, y: y + 2.35, size: 0.2, color: '#222' }); });
    L.push({ type: 'shape', id: 'B', kind: 'polygon', points: [[0, 8], [4, 8], [4, 9.5], [2, 9.5], [2, 11], [0, 11]], color: '#333', width: 0.02, hatch: 'klinkers' });
    a.openDoc(d, true); a.cam.zoom = 66; a.cam.rot = 0; a.cam.x = 90; a.cam.y = 70; a.cameraChanged();
    a.setTool('lasso'); a.setSelection(new Set(['B']));
  }, ks);

  console.log('Rand');
  assert(await page.locator('#selection-bar select[data-k="border"]').count() === 1, 'keuzelijst "Rand" bij een vlak');
  await page.selectOption('#selection-bar select[data-k="border"]', 'rollaag');
  assert(await page.evaluate(() => window.app.store.findItem('B').item.border) === 'rollaag', 'rollaag ingesteld');
  // de rand ligt binnen het vlak: pixel net binnen de onderrand is rollaagkleur, buiten niet
  const px = await page.evaluate(() => {
    const a = window.app; a.setSelection(new Set()); a.render();
    const c = document.querySelector('#canvas'); const g = c.getContext('2d'); const dpr = c.width / a.width;
    const at = (w) => { const p = a.cam.toScreen(w); return [...g.getImageData(Math.round(p[0] * dpr), Math.round(p[1] * dpr), 1, 1).data]; };
    return { inBorder: at([1, 8.12]), inside: at([1, 8.6]) };
  });
  assert(px.inBorder[0] - px.inBorder[2] > 30 && Math.abs(px.inBorder[0] - px.inside[0]) + Math.abs(px.inBorder[1] - px.inside[1]) > 20, `rollaag zichtbaar langs de binnenkant (${px.inBorder.slice(0, 3)} vs ${px.inside.slice(0, 3)})`);
  await page.screenshot({ path: path.join(OUT, 'verbanden.png') });
  await page.evaluate(() => window.app.setSelection(new Set(['B'])));
  await page.selectOption('#selection-bar select[data-k="border"]', 'geen');
  assert(!(await page.evaluate(() => window.app.store.findItem('B').item.border)), 'rand weer uit');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle verband-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
