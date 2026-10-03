// Test: liniaal evenwijdig uitlijnen op een bestaande lijn, met afstand-snap.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc, uid } = await import('./js/model.js');
    const d = newDoc('Evenwijdig');
    const ang = -30 * Math.PI / 180; // lijn schuin omhoog naar rechts
    d.layers[0].items.push({ type: 'shape', id: 'lijn', kind: 'line', points: [[-6, 2], [-6 + Math.cos(ang) * 12, 2 + Math.sin(ang) * 12]], color: '#1d2b36', width: 0.04, dims: true });
    a.openDoc(d, true);
    a.cam.zoom = 40; a.cam.rot = 0; a.cam.x = 600; a.cam.y = 430; a.cameraChanged();
    a.guides.clear(); a.toggleGuide('ruler'); a.setGuidesLocked(false);
    const g = a.guides.get('ruler'); g.x = 600; g.y = 330; g.rot = 0; a.render();
  });
  const box = await page.locator('#canvas').boundingBox();
  const X = (x) => box.x + x, Y = (y) => box.y + y;
  // draai via de greep tot ~-28° (2° naast de lijn)
  const g0 = await page.evaluate(() => { const g = window.app.guides.get('ruler'); return { x: g.x, y: g.y, L: g.L }; });
  const r = g0.L / 2 - 30;
  await page.mouse.move(X(g0.x + r), Y(g0.y));
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) { const a = (-28 * k / 10) * Math.PI / 180; await page.mouse.move(X(g0.x + Math.cos(a) * r), Y(g0.y + Math.sin(a) * r)); }
  const mid = await page.evaluate(() => window.app.guides.get('ruler').rot * 180 / Math.PI);
  await page.screenshot({ path: path.join(OUT, 'parallel-draaien.png') });
  await page.mouse.up();
  assert(Math.abs(mid + 30) < 1e-6, `liniaal klikt evenwijdig op -30° (${mid.toFixed(4)}°)`);
  // verschuif loodrecht op de lijn tot ongeveer 1,5 m: liniaal ligt aan de bovenkant; schuif 'm in stapjes
  const al = await page.evaluate(async () => { const { currentAlignments } = await import('./js/parallel.js'); const a = window.app; return currentAlignments(a.guides.get('ruler'), a.cam, a.segments()).map((x) => x.offset); });
  assert(al.length >= 1, 'evenwijdige lijn wordt herkend');
  const start = await page.evaluate(() => { const g = window.app.guides.get('ruler'); return [g.x, g.y]; });
  // normaal op de lijn in scherm (lijn -30°): n = (sin30, cos30) wijst naar rechtsonder (weg van liniaal richting lijn)
  const n = [Math.sin(30 * Math.PI / 180), Math.cos(30 * Math.PI / 180)];
  await page.mouse.move(X(start[0]), Y(start[1]));
  await page.mouse.down();
  // stapsgewijs bewegen tot de afstand rond 1,5 m ligt
  let best = null;
  for (let t = 0; t <= 200; t += 2) {
    await page.mouse.move(X(start[0] + n[0] * t), Y(start[1] + n[1] * t));
    const off = await page.evaluate(async () => { const { currentAlignments } = await import('./js/parallel.js'); const a = window.app; const l = currentAlignments(a.guides.get('ruler'), a.cam, a.segments()).filter((x) => x.kind === 'parallel'); return l.length ? Math.min(...l.map((x) => Math.abs(x.offset))) : null; });
    if (off != null && Math.abs(off - 1.5) < 0.02) { best = off; break; }
  }
  await page.screenshot({ path: path.join(OUT, 'parallel-afstand.png') });
  await page.mouse.up();
  assert(best != null && Math.abs(best - 1.5) < 1e-6, `afstand klikt op 1,50 m (${best})`);
  // teken langs de rand die het dichtst bij de lijn ligt (tekenmodus)
  await page.evaluate(() => window.app.setGuidesLocked(true));
  const edge = await page.evaluate(async () => {
    const { currentAlignments } = await import('./js/parallel.js'); const a = window.app; const g = a.guides.get('ruler');
    const l = currentAlignments(g, a.cam, a.segments()).filter((x) => x.kind === 'parallel').sort((p, q) => Math.abs(p.offset) - Math.abs(q.offset))[0];
    return g.edges[l.edgeIndex].map((p) => g.toScreen(p));
  });
  const e0 = edge[0], e1 = edge[1];
  const p = (t) => [e0[0] + (e1[0] - e0[0]) * t, e0[1] + (e1[1] - e0[1]) * t];
  await page.mouse.move(X(p(0.25)[0]), Y(p(0.25)[1] + 4));
  await page.mouse.down();
  await page.mouse.move(X(p(0.75)[0]), Y(p(0.75)[1] + 6), { steps: 10 });
  await page.mouse.up();
  const res = await page.evaluate(() => {
    const items = window.app.store.doc.layers[0].items; const s = items[items.length - 1]; const l = items[0];
    const a = s.points[0], bb = s.points[s.points.length - 1];
    const ang = Math.atan2(bb[1] - a[1], bb[0] - a[0]) * 180 / Math.PI;
    const [p0, p1] = l.points; const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy);
    const distA = Math.abs((a[0] - p0[0]) * (-dy / L) + (a[1] - p0[1]) * (dx / L));
    return { ang, distA, dims: s.dims };
  });
  assert(Math.abs(res.ang + 30) < 1e-3 || Math.abs(res.ang - 150) < 1e-3, `nieuwe lijn is evenwijdig (${res.ang.toFixed(3)}°)`);
  assert(Math.abs(res.distA - 1.5) < 1e-3, `op 1,50 m van de bestaande lijn (${res.distA.toFixed(4)} m)`);
  await page.screenshot({ path: path.join(OUT, 'parallel-klaar.png') });
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle evenwijdig-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
