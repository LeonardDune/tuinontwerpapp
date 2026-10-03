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

    // 6) knijpen op de gradenboog vergroot de diameter (op schaal)
    app.toggleGuide('protractor');
    const pr = app.guides.get('protractor');
    pr.x = 600; pr.y = 500; app.render();
    const r0 = pr.worldR;
    fire('pointerdown', 10, 'touch', 560, 420); fire('pointerdown', 11, 'touch', 640, 420);
    for (let i = 1; i <= 5; i++) { fire('pointermove', 10, 'touch', 560 - i * 16, 420); fire('pointermove', 11, 'touch', 640 + i * 16, 420); }
    fire('pointerup', 10, 'touch', 480, 420); fire('pointerup', 11, 'touch', 720, 420);
    out.pinchGrowsProtractor = pr.worldR > r0 * 2.5 && count() === 1;
    // 7) kleine gradenboog: vingers ernaast, midden erop -> toch de gradenboog
    pr.x = 600; pr.y = 500; pr.worldR = 0.5; pr.zoom = null; pr.sync(app.cam);
    const zoomBefore = app.cam.zoom;
    fire('pointerdown', 12, 'touch', 600 - pr.R - 40, 500 - 10); fire('pointerdown', 13, 'touch', 600 + pr.R + 40, 500 - 10);
    for (let i = 1; i <= 4; i++) { fire('pointermove', 12, 'touch', 600 - pr.R - 40 - i * 15, 490); fire('pointermove', 13, 'touch', 600 + pr.R + 40 + i * 15, 490); }
    fire('pointerup', 12, 'touch', 0, 0); fire('pointerup', 13, 'touch', 0, 0);
    out.pinchAroundSmallProtractor = pr.worldR > 0.5 && app.cam.zoom === zoomBefore;
    app.toggleGuide('protractor');
    // 8) bovenste punt van de driehoek slepen = hoek
    app.toggleGuide('tri45');
    const tri = app.guides.get('tri45');
    tri.x = 500; tri.y = 400; tri.build();
    const corner = tri.toScreen(tri.poly[0]);
    const apex = tri.toScreen(tri.poly[2]);
    const w0 = tri.poly[1][0] - tri.poly[0][0];
    const target = [apex[0], corner[1] - w0 * Math.tan(30 * Math.PI / 180) - 0.4];
    fire('pointerdown', 14, 'touch', apex[0], apex[1]);
    fire('pointermove', 14, 'touch', apex[0], (apex[1] + target[1]) / 2);
    fire('pointermove', 14, 'touch', target[0], target[1]);
    fire('pointerup', 14, 'touch', target[0], target[1]);
    const c2 = tri.toScreen(tri.poly[0]);
    out.apexDragSetsAngle = tri.angle === 30 && Math.hypot(c2[0] - corner[0], c2[1] - corner[1]) < 0.01 && count() === 1;
    return out;
  });
  console.log(res);
  const ok = Object.values(res).every(Boolean) && !errors.length;
  console.log(errors.length ? errors : '', ok ? 'Alle touch-tests geslaagd.' : 'MISLUKT');
  await b.close();
  process.exit(ok ? 0 : 1);
})();
