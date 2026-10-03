// Test Pencil/vinger-logica met gesimuleerde pointer-events.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(() => indexedDB.deleteDatabase('tuinontwerp'));
  const res = await page.evaluate(async () => {
    const app = window.app;
    app.openDoc((await import('./js/model.js')).newDoc(), true);
    const c = app.canvas, r = c.getBoundingClientRect();
    const fire = (type, id, kind, x, y, pressure = 0.5) => c.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: kind, clientX: r.left + x, clientY: r.top + y, pressure, bubbles: true, isPrimary: true, buttons: type === 'pointerup' ? 0 : 1,
    }));
    const count = () => app.store.doc.layers.flatMap((l) => l.items).length;
    const out = {};
    // 1) vinger tekent zolang er geen Pencil is gezien
    fire('pointerdown', 1, 'touch', 100, 100); fire('pointermove', 1, 'touch', 200, 150); fire('pointerup', 1, 'touch', 200, 150);
    out.fingerDrawsBeforePen = count() === 1;
    // 2) twee vingers: knijpen zoomt, geen streek
    const z0 = app.cam.zoom;
    fire('pointerdown', 2, 'touch', 300, 300); fire('pointerdown', 3, 'touch', 400, 300);
    fire('pointermove', 3, 'touch', 500, 300); fire('pointerup', 2, 'touch', 300, 300); fire('pointerup', 3, 'touch', 500, 300);
    out.pinchZooms = app.cam.zoom > z0 * 1.5 && count() === 1;
    // 3) Pencil tekent met druk en zet "alleen Pencil" aan
    fire('pointerdown', 4, 'pen', 100, 300, 0.2); for (let i = 1; i <= 10; i++) fire('pointermove', 4, 'pen', 100 + i * 20, 300, 0.2 + i * 0.07); fire('pointerup', 4, 'pen', 300, 300, 0);
    const s = app.store.doc.layers[0].items[1];
    out.penDraws = count() === 2 && s.points[s.points.length - 1][2] > s.points[0][2];
    out.pencilOnlyOn = app.settings.pencilOnly === true;
    // 4) daarna verschuift één vinger het beeld i.p.v. te tekenen
    const x0 = app.cam.x;
    fire('pointerdown', 5, 'touch', 500, 500); fire('pointermove', 5, 'touch', 600, 500); fire('pointerup', 5, 'touch', 600, 500);
    out.fingerPans = app.cam.x - x0 === 100 && count() === 2;
    // 5) twee vingers tikken = ongedaan maken
    const t = performance.now();
    fire('pointerdown', 6, 'touch', 500, 500); fire('pointerdown', 7, 'touch', 560, 500);
    fire('pointerup', 6, 'touch', 500, 500); fire('pointerup', 7, 'touch', 560, 500);
    out.twoFingerTapUndo = count() === 1;
    return out;
  });
  console.log(res);
  const ok = Object.values(res).every(Boolean) && !errors.length;
  console.log(errors.length ? errors : '', ok ? 'Alle touch-tests geslaagd.' : 'MISLUKT');
  await b.close();
  process.exit(ok ? 0 : 1);
})();
