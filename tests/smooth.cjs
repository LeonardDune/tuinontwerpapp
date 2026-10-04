// Gladheid bij Pencil-invoer (240 Hz met trilling): afwijking van de bedoelde cirkel.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123/';
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1000, height: 800 } });
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  const res = await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    a.openDoc(newDoc('glad'), true); a.cam.zoom = 40; a.cam.rot = 0; a.cam.x = 500; a.cam.y = 400; a.setTool('draw');
    let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
    const run = (hz, smoothing) => {
      a.state.smoothing = smoothing;
      const t = a.tools.draw; const R = 150, cx = 500, cy = 400, dur = 1200; // 1,2 s voor een cirkel
      const n = Math.round(dur / 1000 * hz);
      // handtrilling rond 8-12 Hz (onafhankelijk van de meetfrequentie) plus wat sensorruis
      const ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
      for (let i = 0; i <= n; i++) {
        const time = 1000 + i * 1000 / hz; const ang = (i / n) * Math.PI * 1.8; const ts = i / hz;
        const jx = 1.6 * Math.sin(2 * Math.PI * 9 * ts + ph[0]) + 1.0 * Math.sin(2 * Math.PI * 12 * ts + ph[1]) + rnd() * 0.8;
        const jy = 1.6 * Math.sin(2 * Math.PI * 10 * ts + ph[2]) + 1.0 * Math.sin(2 * Math.PI * 7.5 * ts + ph[3]) + rnd() * 0.8;
        const s = [cx + Math.cos(ang) * R + jx, cy + Math.sin(ang) * R + jy];
        const e = { s, w: a.cam.toWorld(s), pressure: 0.5, pointerType: 'pen', time };
        i === 0 ? t.down(e) : t.move(e);
      }
      t.up({ s: [0, 0], w: [0, 0], time: 1000 + dur, pointerType: 'pen', pressure: 0 });
      const items = a.store.doc.layers[0].items; const pts = items[items.length - 1].points;
      // afwijking van de straal (in px) over het middendeel
      const errs = pts.slice(5, -5).map((p) => { const sc = a.cam.toScreen(p); return Math.hypot(sc[0] - cx, sc[1] - cy) - R; });
      const mean = errs.reduce((s, v) => s + v, 0) / errs.length;
      const sd = Math.sqrt(errs.reduce((s, v) => s + (v - mean) ** 2, 0) / errs.length);
      // wiebel: afwijking t.o.v. het eigen glijdend gemiddelde (± ~20 px langs de lijn)
      const win = Math.max(2, Math.round(errs.length * 20 / (Math.PI * 1.8 * R)));
      const wig = errs.map((v, i) => { let sm = 0, c = 0; for (let j = Math.max(0, i - win); j <= Math.min(errs.length - 1, i + win); j++) { sm += errs[j]; c++; } return v - sm / c; });
      const wsd = Math.sqrt(wig.reduce((s, v) => s + v * v, 0) / wig.length);
      return { hz, smoothing, points: pts.length, wiebel_px: +wsd.toFixed(2), vorm_px: +sd.toFixed(2) };
    };
    const out = [run(60, 0.5), run(240, 0), run(240, 0.5), run(240, 1)];
    return out;
  });
  console.table(res);
  if (process.env.CHECK) {
    const [m60, p0, p50, p100] = res;
    const ok = p50.wiebel_px < 0.4 * p0.wiebel_px && p100.wiebel_px <= p50.wiebel_px && m60.wiebel_px < 0.5 * p0.wiebel_px && p100.vorm_px < 1.5;
    console.log(ok ? 'Gladheid-test geslaagd.' : 'Gladheid-test MISLUKT');
    if (!ok) process.exit(1);
  }
  await b.close();
})();
