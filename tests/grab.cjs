// Slepen binnen een geselecteerd element verplaatst het; schalen alleen vlak bij een greep.
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
  const box = await page.locator('#canvas').boundingBox();
  // zoom 40: een vak van 1,5 × 1 m is 60 × 40 px op het scherm
  const setup = () => page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Pakken');
    d.layers[0].items.push({ type: 'shape', id: 'R', kind: 'polygon', rect: true, points: [[0, 0], [1.5, 0], [1.5, 1], [0, 1]], color: '#333', width: 0.03 });
    d.layers[0].items.push({ type: 'stencil', id: 'S', symbol: 'bank', x: 5, y: 0.5, w: 1.5, h: 1, rot: 0, color: '#555' });
    a.openDoc(d, true); a.cam.zoom = 40; a.cam.rot = 0; a.cam.x = 300; a.cam.y = 300; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = false; a.settings.grid = false;
    a.setTool('lasso');
  });
  const scr = (wx, wy) => [box.x + 300 + wx * 40, box.y + 300 + wy * 40];
  const drag = async (from, dx, dy) => {
    await page.mouse.move(from[0], from[1]); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(from[0] + (dx * i) / 6, from[1] + (dy * i) / 6);
    await page.mouse.up();
  };
  const size = (id) => page.evaluate((id) => { const it = window.app.store.findItem(id).item; if (it.points) { const xs = it.points.map((p) => p[0]), ys = it.points.map((p) => p[1]); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), x: Math.min(...xs), y: Math.min(...ys) }; } return { w: it.w, h: it.h, x: it.x - it.w / 2, y: it.y - it.h / 2 }; }, id);
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  for (const [id, ox] of [['R', 0], ['S', 4.25]]) {
    const kind = id === 'R' ? 'rechthoek' : 'stencil';
    console.log(`Klein ${kind} (60 × 40 px)`);
    // binnen het element, 12 px van een hoek en 12 px van de bovenrand: verplaatsen
    for (const [lbl, px, py] of [['bij de hoek', 12, 12], ['bij het midden van de rand', 30, 9], ['midden', 30, 20]]) {
      await setup();
      await page.evaluate((id) => window.app.setSelection(new Set([id])), id);
      const [sx, sy] = scr(ox, 0);
      await drag([sx + px, sy + py], 40, 20);
      const s = await size(id);
      assert(near(s.w, 1.5) && near(s.h, 1) && near(s.x, ox + 1) && near(s.y, 0.5), `slepen ${lbl} (binnen): verplaatst, niet geschaald (${s.w.toFixed(2)}×${s.h.toFixed(2)} op ${s.x.toFixed(2)},${s.y.toFixed(2)})`);
    }
    // vlak bij de hoekgreep (binnen of net buiten): schalen
    for (const [lbl, px, py] of [['op de hoekgreep', 2, 2], ['net buiten de hoek', -12, -12]]) {
      await setup();
      await page.evaluate((id) => window.app.setSelection(new Set([id])), id);
      const [sx, sy] = scr(ox, 0);
      await drag([sx + px, sy + py], -20, -20);
      const s = await size(id);
      assert(s.w > 1.6 && s.h > 1.05, `slepen ${lbl}: schaalt (${s.w.toFixed(2)}×${s.h.toFixed(2)})`);
    }
  }

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle pak-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
