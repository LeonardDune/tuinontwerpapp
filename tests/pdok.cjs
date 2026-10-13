// Perceelgrenzen (BRK) en bestaande situatie (BGT) van PDOK, met nagebootste API-antwoorden.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

const LAT = 52.0, LON = 5.0;
const mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos(LAT * Math.PI / 180));
// rechthoek in meters (oost = +x, noord = +y) → lon/lat-ring
const rect = (x0, y0, x1, y1) => [[[LON + x0 * mLon, LAT + y0 * mLat], [LON + x1 * mLon, LAT + y0 * mLat], [LON + x1 * mLon, LAT + y1 * mLat], [LON + x0 * mLon, LAT + y1 * mLat], [LON + x0 * mLon, LAT + y0 * mLat]]];
const fc = (features, next) => JSON.stringify({ type: 'FeatureCollection', features, links: next ? [{ rel: 'next', href: next }] : [] });
const poly = (coords, properties) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: coords }, properties });

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const seen = [];
  await page.route('https://api.pdok.nl/**', (route) => {
    const url = route.request().url();
    seen.push(url);
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/geo+json', body, headers: { 'access-control-allow-origin': '*' } });
    if (url.includes('brk-kadastrale-kaart/ogc/v1/collections/perceel/items')) {
      if (url.includes('page2')) {
        return json(fc([poly(rect(10, -10, 25, 10), { akr_kadastrale_gemeente_code_waarde: 'TST00', sectie: 'A', perceelnummer: 124, kadastrale_grootte_waarde: 300, status_historie_code: 'G' })]));
      }
      return json(fc([
        poly(rect(-10, -10, 10, 10), { akr_kadastrale_gemeente_code_waarde: 'TST00', sectie: 'A', perceelnummer: 123, kadastrale_grootte_waarde: 400, status_historie_code: 'G' }),
        poly(rect(-12, -12, 12, 12), { akr_kadastrale_gemeente_code_waarde: 'TST00', sectie: 'A', perceelnummer: 99, status_historie_code: 'H' }),
      ], 'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items?page2'));
    }
    const m = /lv\/bgt\/ogc\/v1\/collections\/([a-z]+)\/items/.exec(url);
    if (m) {
      const c = m[1];
      if (c === 'begroeidterreindeel') return json(fc([poly(rect(-8, -8, 0, 0), { fysiek_voorkomen: 'grasland overig' }), poly(rect(-8, 0, 0, 8), { fysiek_voorkomen: 'groenvoorziening', eind_registratie: '2020-01-01' })]));
      if (c === 'onbegroeidterreindeel') return json(fc([poly(rect(0, -8, 8, -2), { bgt_fysiek_voorkomen: 'open verharding' })]));
      if (c === 'wegdeel') return json(fc([poly(rect(-200, -30, 200, -14), { fysiek_voorkomen: 'gesloten verharding', functie: 'rijbaan lokale weg' })]));
      if (c === 'waterdeel') return route.fulfill({ status: 404, body: '{}', headers: { 'access-control-allow-origin': '*' } });
      if (c === 'scheiding') return json(fc([{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[LON - 10 * mLon, LAT - 10 * mLat], [LON - 10 * mLon, LAT + 10 * mLat]] }, properties: { bgt_type: 'muur' } }]));
      return json(fc([]));
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.route('https://service.pdok.nl/lv/bag/wfs/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: fc([poly(rect(-4, 2, 4, 10).map((r) => r.map(([lo, la]) => { const R = 6378137; return [lo * Math.PI * R / 180, R * Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360))]; })), { identificatie: '0001', status: 'Pand in gebruik' })]),
  }));
  await page.route('https://api.3dbag.nl/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ type: 'FeatureCollection', features: [] }) }));

  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async ({ LAT, LON }) => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Mijn tuin');
    d.geo = { lat: LAT, lon: LON, name: 'Teststraat 1', x: 0, y: 0, sizeM: 60 };
    a.openDoc(d, true); a.cam.zoom = 14; a.cam.rot = 0; a.cam.x = 600; a.cam.y = 400; a.cameraChanged();
  }, { LAT, LON });

  console.log('Kaart-venster');
  await page.click('#btn-map');
  assert(await page.isVisible('#map-again') && await page.isVisible('#map-get-brk') && await page.isVisible('#map-get-bgt'), 'bij een geplaatste kaart: knoppen om gegevens alsnog op te halen');
  assert(await page.isVisible('#map-bgt'), 'vinkje "Bestaande situatie (BGT)"');
  await page.click('#dlg-map footer button[value="close"]');

  console.log('Ophalen');
  await page.evaluate(async () => { const a = window.app; await a.loadBgt(); await a.loadBuildings(); await a.loadParcels(); });
  const doc = await page.evaluate(() => JSON.parse(JSON.stringify(window.app.store.doc.layers.map((l) => ({ name: l.name, source: l.source, locked: l.locked, items: l.items })))));
  const L = (src) => doc.find((l) => l.source === src);
  assert(L('bgt') && L('gebouwen') && L('percelen'), 'drie lagen: bestaande situatie, gebouwen en perceelgrenzen');
  const idx = (src) => doc.findIndex((l) => l.source === src);
  assert(idx('bgt') < idx('gebouwen') && idx('gebouwen') < idx('percelen'), 'volgorde: BGT onder, gebouwen, perceelgrenzen bovenop');
  assert(seen.some((u) => u.includes('bbox=4.99')) && seen.some((u) => u.includes('page2')), 'opgevraagd binnen het kaartgebied (bbox), met paginering');

  console.log('Perceelgrenzen');
  const parcels = L('percelen').items.filter((i) => i.type === 'shape');
  assert(parcels.length === 2, '2 percelen (het historische perceel is weggelaten)');
  const own = parcels.find((p) => p.brk.eigen);
  const xs = own.points.map((p) => p[0]), ys = own.points.map((p) => p[1]);
  assert(Math.abs(Math.max(...xs) - Math.min(...xs) - 20) < 0.3 && Math.abs(Math.max(...ys) - Math.min(...ys) - 20) < 0.3, `eigen perceel 20 × 20 m op de juiste maat (${(Math.max(...xs) - Math.min(...xs)).toFixed(2)} m)`);
  assert(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2) < 0.3 && Math.abs((Math.max(...ys) + Math.min(...ys)) / 2) < 0.3, 'eigen perceel ligt rond het adres');
  const nb = parcels.find((p) => !p.brk.eigen);
  assert(own.brk.perceel === 'TST00 A 123' && own.brk.grootte === 400 && !own.dash && nb.dash && own.width > nb.width, 'eigen perceel dik met nummer en grootte, buurperceel dun gestippeld');
  const label = L('percelen').items.find((i) => i.type === 'text');
  assert(label && /TST00 A 123/.test(label.text) && /400 m²/.test(label.text) && /tuin ca\. 336 m²/.test(label.text), `label: "${label && label.text.replace('\n', ' / ')}"`);
  assert(L('percelen').locked && L('bgt').locked, 'lagen met gegevens van buiten zijn vergrendeld');
  assert(/perceel TST00 A 123: 400 m²/i.test(await page.locator('#toast').innerText()), 'melding met perceel, bebouwing en tuinoppervlak');

  console.log('Bestaande situatie (BGT)');
  const bgt = L('bgt').items;
  const kind = (k) => bgt.filter((i) => i.bgt.klasse === k);
  assert(kind('begroeidterreindeel').length === 1 && kind('begroeidterreindeel')[0].hatch === 'gras', 'gras als gras (het beëindigde object is weggelaten)');
  assert(kind('onbegroeidterreindeel')[0].hatch === 'klinkers', 'open verharding als klinkers (ook bij een veldnaam met voorvoegsel)');
  const road = kind('wegdeel')[0];
  assert(road && road.points.every((p) => Math.abs(p[0]) <= 30.001 && Math.abs(p[1]) <= 30.001), 'weg bijgesneden tot het kaartgebied van 60 × 60 m');
  const wall = kind('scheiding')[0];
  assert(wall && wall.kind === 'line' && wall.bgt.type === 'muur', 'muur als lijn');
  assert(bgt.indexOf(road) < bgt.indexOf(kind('begroeidterreindeel')[0]), 'grote vlakken onder, kleine erbovenop');
  await page.evaluate(() => { const a = window.app; a.fitView(true); a.render(); });
  await page.screenshot({ path: path.join(OUT, 'pdok-perceel-bgt.png') });

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle PDOK-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
