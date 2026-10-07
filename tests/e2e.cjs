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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, timezoneId: 'Europe/Amsterdam' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // Nep-kaartdiensten (geen internet in de testomgeving)
  const tile = fs.readFileSync(path.join(__dirname, 'fixtures', 'tile.png'));
  await ctx.route(/service\.pdok\.nl|tile\.openstreetmap\.org/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: tile, headers: { 'Access-Control-Allow-Origin': '*' } }));
  const R = 6378137, lat0 = 52.0907, lon0 = 5.1214, k = Math.cos(lat0 * Math.PI / 180);
  const merc = (lat, lon) => [lon * Math.PI * R / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
  const [mx0, my0] = merc(lat0, lon0);
  const sq = (cx, cy, w, h) => { const p = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
    const ring = p.map(([x, y]) => [mx0 + x / k, my0 + y / k]); ring.push(ring[0]); return { type: 'Polygon', coordinates: [ring] }; };
  await ctx.route(/service\.pdok\.nl\/lv\/bag\/wfs/, (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { identificatie: '0344100000000001', status: 'Pand in gebruik', bouwjaar: 1930 }, geometry: sq(0, 15, 10, 8) }, // 15 m ten noorden
      { type: 'Feature', properties: { identificatie: '0344100000000002', status: 'Pand in gebruik', bouwjaar: 1975 }, geometry: sq(20, 0, 6, 6) },
      { type: 'Feature', properties: { identificatie: '0344100000000003', status: 'Pand gesloopt' }, geometry: sq(-20, 0, 5, 5) },
    ] }),
  }));
  await ctx.route(/api\.3dbag\.nl/, (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'CityJSONFeature', id: 'NL.IMBAG.Pand.0344100000000001', CityObjects: {
        'NL.IMBAG.Pand.0344100000000001': { type: 'Building', attributes: { b3_h_dak_70p: 8.3, b3_h_maaiveld: 0.8 } },
        'NL.IMBAG.Pand.0344100000000001-0': { type: 'BuildingPart', geometry: [] } }, vertices: [] },
    ], links: [] }),
  }));
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
  // Teken net onder de tekenrand van de liniaal, scheef: moet recht worden
  const yEdge = guide.y + 8;
  await drag([[guide.x - 200, yEdge - 6], [guide.x - 50, yEdge + 3], [guide.x + 150, yEdge - 8]]);
  it = await items();
  const ruled = it[it.length - 1];
  const ys = ruled.points.map((p) => p[1]);
  assert(Math.max(...ys) - Math.min(...ys) < 1e-6, 'lijn langs liniaal is exact recht');
  assert(!ruled.dims, 'lijn langs liniaal krijgt géén automatische maat');

  // Tekenmodus (standaard): op de liniaal tekenen verplaatst hem niet maar volgt de dichtstbijzijnde rand
  assert(await page.evaluate(() => window.app.settings.guidesLocked) === true, 'tekenmodus staat standaard aan');
  const gBefore = await page.evaluate(() => { const g = window.app.guides.get('ruler'); return [g.x, g.y]; });
  await drag([[guide.x - 150, guide.y - 12], [guide.x, guide.y - 8], [guide.x + 120, guide.y - 16]]);
  const gAfter = await page.evaluate(() => { const g = window.app.guides.get('ruler'); return [g.x, g.y]; });
  it = await items();
  const onRuler = it[it.length - 1];
  const ys2 = onRuler.points.map((p) => p[1]);
  assert(gAfter[0] === gBefore[0] && gAfter[1] === gBefore[1], 'liniaal blijft liggen bij tekenen erop');
  assert(Math.max(...ys2) - Math.min(...ys2) < 1e-6 && Math.abs(ys2[0] - ruled.points[0][1]) < 1e-6, 'streek op de liniaal komt exact op de tekenrand');
  // lijngereedschap langs de rand
  await tool('line');
  const yLow = guide.y + 5;
  await drag([[guide.x - 100, yLow + 4], [guide.x + 100, yLow - 6]]);
  it = await items();
  const lineAlong = it[it.length - 1];
  assert(lineAlong.type === 'shape' && Math.abs(lineAlong.points[0][1] - lineAlong.points[1][1]) < 1e-6, 'lijngereedschap volgt de rand van de liniaal');
  await tool('draw');
  // naar verplaatsmodus
  await page.click('#btn-guide-lock');
  assert(await page.evaluate(() => window.app.settings.guidesLocked) === false, 'slot open: verplaatsmodus');
  // liniaal draaien via greep
  const grip = await page.evaluate(() => { const g = window.app.guides.get('ruler'); return g.toScreen(g.grips.rotate[1]); });
  await drag([grip, [grip[0], grip[1] + 120]], 10);
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
  const triC = await page.evaluate(() => { const g = window.app.guides.get('tri45'); return g.toScreen(g.center); });
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
  // tik-tik: beginpunt en eindpunt aantikken
  await page.mouse.click(X(250), Y(300));
  await page.mouse.click(X(250), Y(380));
  // maatlijn opzij slepen aan het midden
  await drag([[250, 340], [290, 340]]);
  // oppervlakte: tik in de rechthoek
  await page.click('#optionsbar .seg button[data-m="area"]');
  await page.mouse.click(X(500), Y(460));
  await page.click('#optionsbar .seg button[data-m="length"]');
  await tool('line');
  await drag([[650, 600], [800, 680]]);
  it = await items();
  const shapes = it.filter((i) => i.type === 'shape');
  const axisRect = (s) => s.kind === 'polygon' && s.points.length === 4 && Math.abs(s.points[0][1] - s.points[1][1]) < 1e-6 && Math.abs(s.points[1][0] - s.points[2][0]) < 1e-6;
  assert(shapes.some(axisRect), 'rechthoek getekend');
  assert(shapes.some((s) => s.kind === 'circle'), 'cirkel getekend');
  assert(shapes.some((s) => s.kind === 'polygon' && s.points.length === 4 && !axisRect(s)), 'veelhoek gesloten');
  assert(shapes.some((s) => s.hatch === 'gras'), 'vlak met gras-arcering');
  assert(shapes.every((s) => !s.dims && !s.dimEdges), 'vormen krijgen geen automatische maten meer');
  const dims = it.filter((i) => i.type === 'dim' && i.kind !== 'area');
  assert(dims.length === 2, 'twee maatlijnen: slepen en tik-tik');
  const tapDim = dims[1];
  assert(Math.abs(Math.abs(tapDim.a[1] - tapDim.b[1]) * 40 - 80) < 2 || Math.abs(tapDim.a[0] - tapDim.b[0]) < 1e-6, 'tik-tik maatlijn tussen de twee punten');
  assert(Math.abs(tapDim.offset) > 0.5, `maatlijn opzij gesleept (offset ${tapDim.offset} m)`);
  const areaLabel = it.find((i) => i.type === 'dim' && i.kind === 'area');
  const rectItem = shapes.find(axisRect);
  assert(areaLabel && areaLabel.ref === rectItem.id, 'oppervlaktelabel in de rechthoek gezet');

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
  await page.waitForFunction(() => window.app.store.doc.layers.some((l) => l.source === 'gebouwen'), null, { timeout: 15000 });
  const bag = await page.evaluate(() => {
    const d = window.app.store.doc; const l = d.layers.find((x) => x.source === 'gebouwen');
    const c = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    return { idx: d.layers.indexOf(l), items: l.items.map((i) => ({ bag: i.bag, h: i.height, est: !!i.heightEstimated, c: c(i.points) })), anchor: [d.geo.x, d.geo.y] };
  });
  assert(bag.idx === 1 && bag.items.length === 2, 'gebouwenlaag met 2 panden direct boven de kaart');
  const huisA = bag.items.find((b) => b.bag === '0344100000000001'), huisB = bag.items.find((b) => b.bag === '0344100000000002');
  assert(huisA.h === 7.5 && !huisA.est, 'hoogte uit 3D BAG gekoppeld (7,5 m)');
  assert(huisB.h === 6 && huisB.est, 'pand zonder 3D BAG-hoogte krijgt standaard 6 m');
  assert(Math.abs(huisA.c[0] - bag.anchor[0]) < 0.05 && Math.abs(huisA.c[1] - (bag.anchor[1] - 15)) < 0.05, `pand op de juiste plek (15 m ten noorden van het adres)`);
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

  console.log('Zon en schaduw');
  await page.evaluate(async () => {
    const { uid } = await import('./js/model.js');
    const a = window.app;
    a.store.mutate((doc) => {
      doc.geo = { lat: 52.0907, lon: 5.1214, name: 'Utrecht' };
      doc.northDeg = 0;
      const L = doc.layers.find((l) => l.id === doc.activeLayer).items;
      L.push({ type: 'shape', id: 'huis', kind: 'polygon', points: [[100, 100], [110, 100], [110, 108], [100, 108]], color: '#333', width: 0.05, height: 8 });
    });
  });
  await page.click('#btn-sun');
  assert(await page.isVisible('#sun-panel'), 'zonpaneel open');
  await page.selectOption('.sun-preset', '-06-21');
  const sp = await page.evaluate(() => { const s = window.app.sun; s.minutes = 13 * 60 + 40; return s.sun(); });
  assert(Math.abs(sp.altitude - 61.4) < 0.5 && Math.abs(sp.azimuth - 180) < 2, `zonnestand 21 juni 13:40 Utrecht ≈ 61° zuid (${sp.altitude.toFixed(1)}°, az ${sp.azimuth.toFixed(0)}°)`);
  const off = await page.evaluate(async () => { const sh = await import('./js/shadows.js'); const s = window.app.sun; return sh.shadowOffset(s.sun(), 0); });
  assert(off[1] < 0 && Math.abs(off[0]) < 0.05, 'schaduw valt bij zon in het zuiden naar het noorden');
  await page.click('[data-mode="hours"]');
  await page.selectOption('.sun-preset', '-03-21');
  await page.selectOption('.sun-period', 'day');
  await page.waitForFunction(() => window.app.sun.result && !window.app.sun.computing && window.app.sun.period === 'day', null, { timeout: 30000 });
  await page.waitForFunction(() => !window.app.sun.computing, null, { timeout: 30000 });
  const hrs = await page.evaluate(async () => { const sh = await import('./js/shadows.js'); const r = window.app.sun.result; return { north: sh.sunHoursAt(r, [105, 99.5]), south: sh.sunHoursAt(r, [105, 109]) }; });
  assert(hrs.north < 1.5 && hrs.south > 10, `21 maart: noordkant huis schaduw (${hrs.north.toFixed(1)} u), zuidkant zon (${hrs.south.toFixed(1)} u)`);
  // hoogte via selectiebalk
  await page.evaluate(() => { window.app.setTool('lasso'); window.app.setSelection(new Set(['huis'])); });
  await page.fill('#selection-bar input[data-k="height"]', '3');
  await page.press('#selection-bar input[data-k="height"]', 'Enter');
  await page.waitForFunction(() => window.app.store.findItem('huis').item.height === 3);
  assert(true, 'hoogte instellen via selectiebalk');
  await page.click('.sun-close');
  await page.evaluate(() => { window.app.setTool('draw'); });

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
