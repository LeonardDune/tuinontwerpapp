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

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle huis-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
