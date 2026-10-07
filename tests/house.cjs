// Plattegrond van het huis: muren met dikte, deuren, ramen en puien die in de muur klikken.
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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    a.openDoc(newDoc('Huis'), true);
    a.cam.zoom = 60; a.cam.rot = 0; a.cam.x = 300; a.cam.y = 180; a.cameraChanged();
    a.guides.clear(); a.syncGuideButtons(); a.settings.snap = true; a.settings.grid = false; a.settings.angleSnap = true;
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (wx, wy) => [box.x + 300 + wx * 60, box.y + 180 + wy * 60];
  const tap = async (wx, wy) => { const [x, y] = S(wx, wy); await page.mouse.click(x, y); await page.waitForTimeout(400); };
  const items = () => page.evaluate(() => JSON.parse(JSON.stringify(window.app.store.doc.layers[0].items)));

  console.log('Muren');
  await page.click('#toolbar .tool[data-tool="wall"]');
  assert(await page.evaluate(() => window.app.state.tool) === 'wall', 'gereedschap Muur actief');
  assert(await page.isVisible('#optionsbar button[data-t="0.3"].on'), 'standaard dikte 30 cm');
  for (const [x, y] of [[0, 0], [10, 0], [10, 6], [0, 6]]) await tap(x, y);
  await tap(0, 0); // eerste punt: rond sluiten
  let its = await items();
  const house = its.find((i) => i.wall);
  assert(house && house.kind === 'polygon' && house.points.length === 4 && Math.abs(house.width - 0.3) < 1e-9, 'gesloten buitenmuur van 10 × 6 m, 30 cm dik');
  // binnenwand van 10 cm
  await page.click('#optionsbar button[data-t="0.1"]');
  await tap(6, 0); await tap(6, 6);
  await page.keyboard.press('Enter');
  its = await items();
  const inner = its.filter((i) => i.wall).pop();
  assert(inner.kind === 'line' && Math.abs(inner.width - 0.1) < 1e-9 && Math.abs(inner.points[0][0] - 6) < 1e-6, 'binnenwand van 10 cm (Enter stopt)');

  console.log('Deuren en ramen in de muur');
  await page.evaluate(() => { const a = window.app; a.state.stencil = 'buitendeur'; if (a.state.tool !== 'stencil') a.setTool('stencil'); else a.renderOptions(); });
  await tap(3, -0.6); // net buiten de onderste (noord) muur: deur draait naar buiten open
  its = await items();
  let door = its.filter((i) => i.type === 'stencil').pop();
  assert(door && Math.abs(door.y - house.points[0][1]) < 1e-6 && Math.abs(door.x - 3) < 0.05, `deur klikt op de hartlijn van de muur (${door.x.toFixed(2)}, ${door.y.toFixed(2)})`);
  assert(Math.abs(door.h - 0.3) < 1e-9, 'deur neemt de muurdikte over (30 cm)');
  // lokale +y (draaikant) wijst in de tekening naar (-sin rot, cos rot); buiten = negatieve y
  assert(Math.cos(door.rot) < -0.99, 'deur draait open naar de kant waar getikt is (buiten)');
  await page.evaluate(() => { const a = window.app; a.state.stencil = 'raam'; if (a.state.tool !== 'stencil') a.setTool('stencil'); else a.renderOptions(); });
  await tap(10.4, 2.5); // rechter (oost) muur, verticaal
  its = await items();
  const win = its.filter((i) => i.type === 'stencil').pop();
  const ang = ((win.rot % Math.PI) + Math.PI) % Math.PI;
  assert(Math.abs(win.x - house.points[1][0]) < 1e-6 && Math.abs(ang - Math.PI / 2) < 1e-6, 'raam in de verticale muur, gedraaid met de muur mee');
  await page.evaluate(() => { const a = window.app; a.state.stencil = 'schuifpui'; if (a.state.tool !== 'stencil') a.setTool('stencil'); else a.renderOptions(); });
  await tap(2.5, 6.3);
  await page.evaluate(() => { const a = window.app; a.state.stencil = 'deur'; if (a.state.tool !== 'stencil') a.setTool('stencil'); else a.renderOptions(); });
  await tap(6.3, 3);
  its = await items();
  const idoor = its.filter((i) => i.type === 'stencil').pop();
  assert(Math.abs(idoor.x - inner.points[0][0]) < 1e-6 && Math.abs(idoor.h - 0.1) < 1e-9, 'binnendeur in de binnenwand (10 cm)');
  await page.evaluate(() => { const a = window.app; a.state.stencil = 'raam'; if (a.state.tool !== 'stencil') a.setTool('stencil'); else a.renderOptions(); });
  await tap(13, 7.5);
  its = await items();
  const loose = its.filter((i) => i.type === 'stencil').pop();
  assert(Math.abs(loose.x - 13) < 0.1 && Math.abs(loose.y - 7.5) < 0.1, 'ver van een muur: gewoon neerzetten waar getikt is');
  await page.click('#btn-undo');

  console.log('Bewerken');
  await page.evaluate((id) => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set([id])); }, door.id);
  assert(await page.isVisible('#selection-bar [data-act="mirror"]'), 'deur: knop Spiegelen in de balk');
  await page.click('#selection-bar [data-act="mirror"]');
  its = await items();
  assert(its.find((i) => i.id === door.id).mirror === true, 'deur gespiegeld (scharnier aan de andere kant)');
  await page.evaluate((id) => window.app.setSelection(new Set([id])), house.id);
  assert(/Muur/.test(await page.locator('#selection-bar .count').innerText()), 'eigenschappenbalk: Muur');
  assert(!(await page.locator('#selection-bar [data-plan="makebed"]').count()), 'geen "Maak plantvak" voor een muur');
  await page.fill('#selection-bar input[data-k="wallT"]', '0,36');
  await page.press('#selection-bar input[data-k="wallT"]', 'Enter');
  its = await items();
  assert(Math.abs(its.find((i) => i.id === house.id).width - 0.36) < 1e-9, 'muurdikte aangepast naar 36 cm');
  await page.evaluate(() => window.app.setSelection(new Set()));
  await page.screenshot({ path: path.join(OUT, 'huis-plattegrond.png') });

  console.log('Tekenen op de kaart');
  const hit = await page.evaluate(async (id) => { const { hitItem } = await import('./js/items.js'); const it = window.app.store.findItem(id).item; return [hitItem(it, [5, 0.15], 0.01), hitItem(it, [5, 1], 0.01)]; }, house.id);
  assert(hit[0] && !hit[1], 'muur is over zijn hele dikte aan te tikken, het vlak erbinnen niet');

  console.log('Aansluitingen');
  const join = await page.evaluate(async (ids) => {
    const { wallShape } = await import('./js/walls.js');
    const a = window.app; const doc = a.store.doc;
    // twee losse muren die in een hoek op elkaar aansluiten
    a.store.mutate((d) => {
      d.layers[0].items.push({ type: 'shape', id: 'h1', kind: 'line', wall: true, points: [[12, 0], [16, 0]], color: '#2f2f2f', width: 0.3 });
      d.layers[0].items.push({ type: 'shape', id: 'h2', kind: 'line', wall: true, points: [[16, 0], [16, 3]], color: '#2f2f2f', width: 0.3 });
    });
    const walls = doc.layers[0].items.filter((i) => i.wall);
    const inner = walls.find((w) => w.id === ids.inner), outer = walls.find((w) => w.id === ids.house);
    const si = wallShape(inner, walls, 0.03);
    const h1 = wallShape(walls.find((w) => w.id === 'h1'), walls, 0.03);
    return { y0: outer.points[0][1], y1: outer.points[2][1], t: outer.width, ti: si.lines.map((l) => [l[0][1], l[l.length - 1][1]]), caps: si.lines.length, h1: h1.lines.slice(0, 2).map((l) => l[l.length - 1]) };
  }, { inner: inner.id, house: house.id });
  const half = join.t / 2;
  assert(join.caps === 2 && join.ti.every(([a, z]) => Math.abs(a - (join.y0 + half)) < 1e-6 && Math.abs(z - (join.y1 - half)) < 1e-6),
    'binnenwand stopt precies op de binnenkant van de buitenmuur (T-aansluiting, geen kopse lijn)');
  const [l1, r1] = join.h1;
  assert(Math.abs(l1[0] - 15.85) < 1e-6 && Math.abs(l1[1] - 0.15) < 1e-6 && Math.abs(r1[0] - 16.15) < 1e-6 && Math.abs(r1[1] + 0.15) < 1e-6,
    'twee muren in een hoek sluiten met verstek op elkaar aan');
  await page.screenshot({ path: path.join(OUT, 'huis-aansluitingen.png') });

  console.log('Deuren en ramen bewegen mee met hun muur');
  const dPos = () => page.evaluate((id) => { const it = window.app.store.findItem(id)?.item; return it ? { x: it.x, y: it.y, rot: it.rot, h: it.h, wallId: it.wallId } : null; }, door.id);
  let d0 = await dPos();
  assert(d0.wallId === house.id && Math.abs(d0.h - 0.36) < 1e-9, 'deur is gekoppeld aan de buitenmuur en volgt de nieuwe dikte (36 cm)');
  await page.evaluate((id) => { const a = window.app; a.setTool('lasso'); a.setSelection(new Set([id])); }, house.id);
  {
    // muur verslepen aan zijn rechterkant
    const [x0, y0] = S(10, 4), [x1, y1] = S(11, 5);
    await page.mouse.move(x0, y0); await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up();
  }
  let d1 = await dPos();
  const hp = await page.evaluate((id) => window.app.store.findItem(id).item.points[0], house.id);
  assert(Math.abs(d1.x - d0.x - 1) < 0.02 && Math.abs(d1.y - d0.y - 1) < 0.02 && Math.abs(d1.y - hp[1]) < 1e-6, `deur schuift mee met de muur (${(d1.x - d0.x).toFixed(2)}, ${(d1.y - d0.y).toFixed(2)} m)`);
  await page.evaluate(() => window.app.applyProperty('rotby', '90'));
  const d2 = await dPos();
  const onWall = await page.evaluate(async ({ id, did }) => { const { distToSegment } = await import('./js/geom.js'); const w = window.app.store.findItem(id).item; const d = window.app.store.findItem(did).item; return Math.min(...w.points.map((p, i) => distToSegment([d.x, d.y], p, w.points[(i + 1) % w.points.length]))); }, { id: house.id, did: door.id });
  assert(onWall < 1e-3 && Math.abs(Math.abs(Math.cos(d2.rot - d1.rot))) < 1e-6, 'muur 90° gedraaid: deur draait mee en blijft in de muur');
  await page.click('#btn-undo');
  // deur langs de muur verschuiven
  d1 = await dPos();
  await page.evaluate((id) => window.app.setSelection(new Set([id])), door.id);
  {
    const [x0, y0] = S(d1.x, d1.y), [x1, y1] = S(d1.x - 2, d1.y + 0.25);
    await page.mouse.move(x0, y0); await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up();
  }
  const d3 = await dPos();
  assert(Math.abs(d3.x - d1.x + 2) < 0.05 && Math.abs(d3.y - d1.y) < 1e-6 && d3.wallId === house.id, 'deur verslepen: blijft in de muur en schuift erlangs');
  await page.evaluate((id) => window.app.setSelection(new Set([id])), house.id);
  await page.click('#selection-bar [data-sel="delete"]');
  const left = await page.evaluate((hid) => window.app.store.doc.layers[0].items.filter((i) => i.wallId === hid).length, house.id);
  assert(left === 0 && !(await dPos()), 'muur verwijderd: zijn deuren en ramen gaan mee');
  await page.click('#btn-undo');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle huis-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
