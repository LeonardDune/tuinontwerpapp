// End-to-end rooktest. Start: node tests/e2e.cjs (vereist playwright + een server op :8123)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8123/';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // Nep-kaartdiensten (geen internet in de testomgeving)
  const tile = fs.readFileSync(path.join(__dirname, 'fixtures', 'tile.png'));
  await ctx.route(/service\.pdok\.nl|tile\.openstreetmap\.org/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: tile, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.route(/api\.pdok\.nl\/bzk\/locatieserver/, (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ response: { docs: [{ weergavenaam: 'Dorpsstraat 1, Testdorp', centroide_ll: 'POINT(5.1214 52.0907)', type: 'adres' }] } }),
  }));

  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.store);
  await page.waitForTimeout(300);
  const box = await page.locator('#canvas').boundingBox();
  const X = (x) => box.x + x, Y = (y) => box.y + y;

  async function drag(points, steps = 8) {
    await page.mouse.move(X(points[0][0]), Y(points[0][1]));
    await page.mouse.down();
    for (let i = 1; i < points.length; i++) await page.mouse.move(X(points[i][0]), Y(points[i][1]), { steps });
    await page.mouse.up();
  }
  const items = () => page.evaluate(() => window.app.store.doc.layers.flatMap((l) => l.items));
  const tool = (t) => page.click(`#toolbar .tool[data-tool="${t}"]`);

  console.log('Tekenen met penselen');
  for (const [i, b] of ['fineliner', 'pen', 'pencil', 'marker', 'brush', 'watercolor'].entries()) {
    await page.click(`.brush-btn[data-brush="${b}"]`);
    const y = 60 + i * 34;
    await drag([[60, y], [140, y + 20], [220, y - 10], [300, y + 10]]);
  }
  let it = await items();
  assert(it.filter((i) => i.type === 'stroke').length === 6, '6 penseelstreken getekend');

  console.log('Super-liniaal');
  await page.click('.guide-btn[data-guide="ruler"]');
  const guide = await page.evaluate(() => { const g = window.app.guides.get('ruler'); return { x: g.x, y: g.y, H: g.H }; });
  // Teken net boven de bovenrand van de liniaal, scheef: moet recht worden
  const yEdge = guide.y - guide.H / 2 - 4;
  await drag([[guide.x - 200, yEdge - 6], [guide.x - 50, yEdge + 3], [guide.x + 150, yEdge - 8]]);
  it = await items();
  const ruled = it[it.length - 1];
  const ys = ruled.points.map((p) => p[1]);
  assert(Math.max(...ys) - Math.min(...ys) < 1e-6, 'lijn langs liniaal is exact recht');
  assert(ruled.dims === true, 'lijn langs liniaal krijgt automatisch een maat');
  // liniaal draaien via greep
  await drag([[guide.x + 760 / 2 - 30, guide.y], [guide.x + 760 / 2 - 30, guide.y + 120]], 10);
  const rot = await page.evaluate(() => window.app.guides.get('ruler').rot);
  assert(Math.abs(rot) > 0.1, 'liniaal draait via greep');
  await page.screenshot({ path: path.join(OUT, '01-penselen-liniaal.png') });
  await page.click('.guide-btn[data-guide="ruler"]');

  console.log('Driehoeken en gradenboog tonen');
  await page.click('.guide-btn[data-guide="tri45"]');
  await page.click('.guide-btn[data-guide="protractor"]');
  await page.screenshot({ path: path.join(OUT, '02-driehoek-gradenboog.png') });
  // teken langs schuine zijde driehoek
  const tri = await page.evaluate(() => { const g = window.app.guides.get('tri45'); return g.edges[1].map((p) => g.toScreen(p)); });
  const mid = [(tri[0][0] + tri[1][0]) / 2, (tri[0][1] + tri[1][1]) / 2];
  await page.click('.guide-btn[data-guide="protractor"]');
  await page.waitForTimeout(50);
  await drag([[mid[0] + 8 - 60, mid[1] - 60 + 8], [mid[0] + 8 + 60, mid[1] + 60 + 8]]);
  it = await items();
  const diag = it[it.length - 1];
  const a = diag.points[0], b = diag.points[diag.points.length - 1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  assert(Math.abs(Math.abs(ang) - 45) < 0.5 || Math.abs(Math.abs(ang) - 135) < 0.5, `lijn langs 45°-driehoek is 45° (${ang.toFixed(2)}°)`);

  console.log('Instelbare driehoek en gradenboog');
  const triC = await page.evaluate(() => { const g = window.app.guides.get('tri45'); return [g.x, g.y]; });
  await page.mouse.click(X(triC[0]), Y(triC[1]));
  assert(await page.isVisible('#guide-bar'), 'tik op driehoek opent instellingenbalk');
  await page.fill('#guide-bar input[data-k="angle"]', '60');
  await page.press('#guide-bar input[data-k="angle"]', 'Enter');
  const hyp = await page.evaluate(() => { const g = window.app.guides.get('tri45'); return [g.angle, g.edges[1].map((p) => g.toScreen(p))]; });
  assert(hyp[0] === 60, 'driehoekhoek ingesteld op 60°');
  assert(await page.locator('.guide-btn').count() === 3, 'één driehoek in de werkbalk (liniaal, driehoek, gradenboog)');
  const hm = [(hyp[1][0][0] + hyp[1][1][0]) / 2, (hyp[1][0][1] + hyp[1][1][1]) / 2];
  const hdx = hyp[1][1][0] - hyp[1][0][0], hdy = hyp[1][1][1] - hyp[1][0][1], hl = Math.hypot(hdx, hdy);
  const hn = [hdy / hl * 6, -hdx / hl * 6]; // iets naast de rand, buiten de driehoek
  await drag([[hm[0] - hdx * 0.2 + hn[0], hm[1] - hdy * 0.2 + hn[1]], [hm[0] + hdx * 0.2 + hn[0] + 5, hm[1] + hdy * 0.2 + hn[1] - 5]]);
  it = await items();
  const d60 = it[it.length - 1];
  const p0 = d60.points[0], p1 = d60.points[d60.points.length - 1];
  const a60 = Math.abs(Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI);
  assert(Math.abs(a60 - 60) < 0.5 || Math.abs(a60 - 120) < 0.5, `lijn langs 60°-driehoek is 60° (${a60.toFixed(2)}°)`);
  await page.click('.guide-btn[data-guide="tri45"]');
  assert(await page.isHidden('#guide-bar'), 'balk verdwijnt als driehoek weg is');

  await page.click('.guide-btn[data-guide="protractor"]');
  const pc = await page.evaluate(() => { const g = window.app.guides.get('protractor'); return [g.x, g.y, g.R]; });
  await page.mouse.click(X(pc[0]), Y(pc[1] - pc[2] * 0.75));
  await page.fill('#guide-bar input[data-k="diam"]', '5');
  await page.press('#guide-bar input[data-k="diam"]', 'Enter');
  await page.waitForTimeout(100);
  const pr = await page.evaluate(() => { const g = window.app.guides.get('protractor'); return { R: g.R, worldR: g.worldR, zoom: window.app.cam.zoom, x: g.x, y: g.y }; });
  assert(pr.worldR === 2.5 && Math.abs(pr.R - 2.5 * pr.zoom) < 1e-6, 'gradenboog-diameter ingesteld op 5 m (op schaal)');
  // boog langs de rand trekken (net buiten de gradenboog)
  const arcPts = [];
  for (let d = 30; d <= 150; d += 15) { const a = d * Math.PI / 180; arcPts.push([pr.x + Math.cos(a) * (pr.R + 8), pr.y - Math.sin(a) * (pr.R + 8)]); }
  await drag(arcPts, 4);
  it = await items();
  const arc = it[it.length - 1];
  const cw = await page.evaluate(([x, y]) => window.app.cam.toWorld([x, y]), [pr.x, pr.y]);
  const radii = arc.points.map((p) => Math.hypot(p[0] - cw[0], p[1] - cw[1]));
  assert(radii.every((r) => Math.abs(r - 2.5) < 0.01), 'boog langs gradenboog heeft straal 2,50 m');
  await page.screenshot({ path: path.join(OUT, '02b-gradenboog-instellen.png') });
  await page.click('.guide-btn[data-guide="protractor"]');

  console.log('Vormen met maatvoering');
  await tool('rect');
  await drag([[400, 400], [600, 520]]);
  await tool('circle');
  await drag([[750, 450], [820, 450]]);
  await tool('polygon');
  for (const p of [[900, 380], [1050, 400], [1080, 520], [920, 540]]) await page.mouse.click(X(p[0]), Y(p[1]));
  await page.mouse.click(X(900), Y(380)); // sluiten
  await tool('area');
  await page.selectOption('#optionsbar select', 'gras');
  await drag([[420, 600], [520, 580], [620, 620], [600, 700], [450, 690], [420, 610]]);
  await tool('dim');
  await drag([[400, 560], [600, 560]]);
  await tool('line');
  await drag([[650, 600], [800, 680]]);
  it = await items();
  const shapes = it.filter((i) => i.type === 'shape');
  assert(shapes.some((s) => s.kind === 'polygon' && s.dimEdges && s.dimEdges.length === 2), 'rechthoek getekend');
  assert(shapes.some((s) => s.kind === 'circle'), 'cirkel getekend');
  assert(shapes.some((s) => s.kind === 'polygon' && s.points.length === 4 && !s.dimEdges), 'veelhoek gesloten');
  assert(shapes.some((s) => s.hatch === 'gras'), 'vlak met gras-arcering');
  assert(it.some((i) => i.type === 'dim'), 'maatlijn getekend');
  assert(shapes.filter((s) => s.dims).length >= 4, 'vormen hebben automatische maten');

  console.log('Stencils');
  await tool('stencil');
  await page.mouse.click(X(760), Y(200));
  await page.click('#optionsbar .stencil-current');
  await page.click('.stencil-item[data-id="tafel6"]');
  await drag([[950, 200], [1050, 200]]);
  it = await items();
  assert(it.filter((i) => i.type === 'stencil').length === 2, '2 stencils geplaatst');
  await page.screenshot({ path: path.join(OUT, '03-vormen-stencils.png') });

  console.log('Tekst');
  await tool('text');
  await page.mouse.click(X(420), Y(380));
  await page.fill('#input-text', 'Terras');
  await page.click('#input-ok');
  await page.waitForFunction(() => window.app.store.doc.layers.some((l) => l.items.some((i) => i.type === 'text')), null, { timeout: 3000 }).catch(() => {});
  it = await items();
  assert(it.some((i) => i.type === 'text' && i.text === 'Terras'), 'tekst geplaatst');

  console.log('Magische lasso');
  await tool('lasso');
  await drag([[740, 170], [800, 170], [800, 240], [730, 240], [730, 170]], 4);
  let sel = await page.evaluate(() => [...window.app.selection]);
  assert(sel.length === 1, 'lasso selecteert boom');
  assert(await page.isVisible('#selection-bar'), 'selectiebalk zichtbaar');
  const before = await page.evaluate((id) => { const f = window.app.store.findItem(id); return [f.item.x, f.item.y]; }, sel[0]);
  await drag([[760, 200], [860, 300]]);
  const after = await page.evaluate((id) => { const f = window.app.store.findItem(id); return [f.item.x, f.item.y]; }, sel[0]);
  assert(after[0] > before[0] && after[1] > before[1], 'selectie verplaatst');
  await page.click('[data-sel="duplicate"]');
  it = await items();
  assert(it.filter((i) => i.type === 'stencil').length === 3, 'selectie gedupliceerd');
  await page.click('[data-sel="delete"]');
  it = await items();
  assert(it.filter((i) => i.type === 'stencil').length === 2, 'selectie verwijderd');

  console.log('Gum');
  await tool('eraser');
  const strokesBefore = (await items()).filter((i) => i.type === 'stroke').length;
  await drag([[180, 40], [180, 260]], 20);
  const strokesAfter = (await items()).filter((i) => i.type === 'stroke').length;
  assert(strokesAfter > strokesBefore, `gum knipt streken door (${strokesBefore} → ${strokesAfter})`);

  console.log('Ongedaan maken / opnieuw');
  const n1 = (await items()).length;
  await page.click('#btn-undo');
  const n2 = (await items()).length;
  await page.click('#btn-redo');
  const n3 = (await items()).length;
  assert(n2 !== n1 && n3 === n1, 'undo/redo werkt');

  console.log('Lagen');
  await page.click('#btn-layers');
  await page.click('#btn-layer-add');
  const layers = await page.evaluate(() => window.app.store.doc.layers.length);
  assert(layers === 2, 'nieuwe laag (trekpapier) toegevoegd');
  await page.click('#btn-layers-close');

  console.log('Kaart op schaal');
  await page.click('#btn-map');
  await page.fill('#map-q', 'Dorpsstraat 1');
  await page.click('#map-search');
  await page.waitForSelector('#map-results li');
  await page.selectOption('#map-size', '60');
  await page.click('#map-place');
  await page.waitForFunction(() => window.app.store.doc.layers.some((l) => l.items.some((i) => i.type === 'image')), null, { timeout: 15000 });
  const img = await page.evaluate(() => window.app.store.doc.layers[0].items[0]);
  assert(img.type === 'image' && img.w === 60 && img.h === 60, 'kaart van 60 × 60 m geplaatst in onderste laag');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '04-kaart.png') });

  console.log('Exporteren naar PDF');
  await page.click('#btn-export');
  await page.selectOption('#exp-scale', 'fit');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp-pdf')]);
  const pdfPath = path.join(OUT, 'export.pdf');
  await dl.saveAs(pdfPath);
  const pdf = fs.readFileSync(pdfPath);
  assert(pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 20000, `PDF gemaakt (${Math.round(pdf.length / 1024)} kB)`);
  const [dl2] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#btn-export'); await page.click('#exp-png'); })()]);
  await dl2.saveAs(path.join(OUT, 'export.png'));

  console.log('Opslaan en herladen');
  await page.evaluate(() => window.app.saveNow());
  const countBefore = (await items()).length;
  await page.reload();
  await page.waitForFunction(() => window.app && window.app.store.doc.layers.flatMap((l) => l.items).length > 0, null, { timeout: 5000 });
  const countAfter = (await items()).length;
  assert(countAfter === countBefore, `tekening blijft bewaard na herladen (${countAfter} elementen)`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '05-na-herladen.png') });

  console.log('Telefoonformaat');
  await page.setViewportSize({ width: 420, height: 860 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '06-smal.png') });

  const relevant = errors.filter((e) => !/favicon/.test(e));
  assert(relevant.length === 0, 'geen JavaScript-fouten' + (relevant.length ? ': ' + relevant.join(' | ') : ''));
  await browser.close();
  console.log('\nAlle tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
