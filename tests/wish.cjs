// Wensvakjes (eerst wensen, dan planten, grote planten eerst) en de plantenlijst (boodschappenlijst).
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { roleFromPlant, plantById } = await import('./js/plantdb.js');
    const d = newDoc('Border');
    const role = (id, pid, code, rl) => ({ id, code, role: rl, ...roleFromPlant(plantById(pid)) });
    d.planting = { roles: [role('r1', 'kattenkruid', 'V1', 'vulling')], scheme: { type: 'vrij' } };
    d.layers[0].items.push({ type: 'shape', id: 'B', name: 'Border', kind: 'polygon', bed: true, btype: 'middel', light: 'zon', moisture: 'normaal', points: [[0, 0], [6, 0], [6, 3], [0, 3]], color: '#3f7a2e', width: 0.03, planting: { mix: [{ role: 'r1', w: 100 }] } });
    a.openDoc(d, true); a.cam.zoom = 90; a.cam.rot = 0; a.cam.x = 150; a.cam.y = 200; a.cameraChanged();
    a.setTool('lasso'); a.setSelection(new Set(['B']));
    a.state.plantStep = 2; a.plantPanel.open();
  });
  const box = await page.locator('#canvas').boundingBox();
  const S = (x, y) => page.evaluate(([x, y]) => window.app.cam.toScreen([x, y]), [x, y]).then(([sx, sy]) => [box.x + sx, box.y + sy]);
  const panel = page.locator('#plant-panel');

  const steps = await panel.locator('.steps button').allInnerTexts();
  assert(/Vak/.test(steps[0]) && /Wensen/.test(steps[1]) && /Planten/.test(steps[2]), `stappen in de volgorde van de werkwijze: ${steps.join(' → ').replace(/\s+/g, ' ')}`);
  assert(await panel.getByText('Wat wil je hier?').isVisible() && !(await panel.locator('[data-act="compose"]').count()), 'stap 2 Wensen: alleen wensen, nog geen planten kiezen');
  // wens: vaste plant, middelhoog, roze, zomer
  // kleurencombinatie per vak: eerst de combinatie, dan kies je bij de wens uit die kleuren
  await panel.locator('[data-k="bedscheme"]').selectOption('complementair');
  const sch = await page.evaluate(() => window.app.store.findItem('B').item.scheme);
  assert(sch && sch.type === 'complementair' && !(await page.evaluate(() => window.app.store.doc.planting.scheme.type !== 'vrij')), 'kleurencombinatie gekozen voor dit vak (het hele ontwerp blijft vrij)');
  const pal = await panel.locator('.scheme .palette i').count();
  const chips = await panel.locator('.wnew .wcolors [data-wcol^="#"]').count();
  assert(pal === 6 && chips === pal, `bij de wens staan de ${chips} kleuren van de combinatie voorop`);
  assert(await panel.locator('.wnew [data-wcol="meer"]').isVisible() && !(await panel.locator('.wnew [data-wc]').isVisible()), 'met "Andere kleur…" om af te wijken (keuzelijst nog verborgen)');
  await panel.locator('.wnew .wcolors [data-wcol^="#"]').first().click();
  const hex = await page.evaluate(() => window.app.state.wish.color);
  assert(/^#[0-9a-f]{6}$/i.test(hex), `een kleur uit de combinatie gekozen (${hex})`);
  const match = await page.evaluate(async (hex) => {
    const { wishCandidates, colorMatches } = await import('./js/wish.js');
    const r = wishCandidates({ layer: 'vaste', height: 'middel', color: hex }, {});
    const top = r.list.slice(0, 5);
    return top.length && top.every((c) => colorMatches(c.p.color, hex));
  }, hex);
  assert(match, 'de voorgestelde planten hebben die kleur');
  await panel.locator('.wnew [data-wcol="meer"]').click();
  assert(await panel.locator('.wnew [data-wc]').isVisible(), '"Andere kleur…" toont alle kleuren');
  await panel.locator('.wnew [data-wc]').selectOption('roze');
  assert(await page.evaluate(() => window.app.state.wish.color) === 'roze', 'afwijken: roze, buiten de combinatie');
  await page.screenshot({ path: path.join(OUT, 'wens-kleuren.png') });
  await panel.locator('[data-k="bedscheme"]').selectOption('');
  assert(!(await page.evaluate(() => window.app.store.findItem('B').item.scheme)), 'terug naar de combinatie van het hele ontwerp');
  await panel.locator('.wnew [data-ws="zomer"]').click();
  await panel.locator('[data-wact="draw"]').click();
  const st = await page.evaluate(() => ({ tool: window.app.state.tool, mode: window.app.state.plantMode, wish: window.app.state.wish }));
  assert(st.tool === 'plant' && st.mode === 'wens' && st.wish.color === 'roze' && st.wish.seasons.includes('zomer'), 'Wensvakjes tekenen zet het gereedschap klaar met de wens');
  assert(/Wensvakje/.test(await page.locator('#optionsbar').innerText()), 'de balk onderin heeft de modus Wensvakje');
  const [x1, y1] = await S(4, 1.5);
  await page.mouse.move(x1, y1);
  await page.mouse.click(x1, y1);
  // tweede vakje: een heester (moet in de piramide vóór de vaste plant komen)
  await page.evaluate(() => { const a = window.app; a.state.wish = { layer: 'heesters', height: 'hoog', color: '', seasons: ['herfst'] }; a.renderOptions(); });
  const [x2, y2] = await S(1.5, 1.5);
  await page.mouse.click(x2, y2);
  const ws = await page.evaluate(async () => {
    const { polygonArea } = await import('./js/geom.js');
    return window.app.store.doc.layers[0].items.filter((i) => i.group).map((i) => ({ id: i.id, wish: i.wish, mix: i.planting.mix.length, area: Math.abs(polygonArea(i.points)), bed: i.bedId }));
  });
  assert(ws.length === 2 && ws.every((w) => w.bed === 'B' && w.mix === 0), 'twee wensvakjes in het vak, nog zonder plant');
  assert(ws.every((w) => w.area > 0.8 && w.area < 1.25), `een tik geeft een vakje van ±1 m² (${ws.map((w) => w.area.toFixed(2)).join(', ')})`);
  await page.evaluate(() => { window.app.setTool('lasso'); window.app.setSelection(new Set()); window.app.plantPanel.focusId = 'B'; window.app.plantPanel.render(); });
  assert(await page.evaluate(() => window.app.state.plantStep) === 2 && await panel.locator('.wlist li').count() === 2, 'de vakjes staan in de lijst van stap 2');
  // bladeren door de wensvakjes bij het aanpassen (stap 2)
  await panel.locator('.wlist li').first().click();
  const sel = () => page.evaluate(() => [...window.app.selection][0]);
  const w1 = await sel();
  assert(await page.evaluate(() => window.app.state.plantStep) === 2 && await panel.locator('.wcard [data-wact="next"]').isVisible() && await panel.locator('.wcard [data-wact="prev"]').isVisible(), 'stap 2, wens aanpassen: knoppen Vorige en Volgende');
  await panel.locator('.wcard [data-wact="next"]').click();
  const w2 = await sel();
  assert(w2 && w2 !== w1 && /vakje 2 van 2/.test(await panel.locator('.wnav').innerText()) && await page.evaluate(() => window.app.state.plantStep) === 2, 'Volgende gaat naar vakje 2 (en blijft in stap 2)');
  await panel.locator('.wcard [data-wact="prev"]').click();
  assert(await sel() === w1, 'Vorige gaat terug naar vakje 1');
  await panel.locator('.steps [data-step="3"]').click();
  assert(await panel.locator('.wcard [data-wact="prev"]').isVisible() && await panel.locator('.wcard [data-wact="next"]').isVisible(), 'ook bij plant kiezen (stap 3): Vorige en Volgende');
  await page.evaluate(() => { window.app.setSelection(new Set()); window.app.plantPanel.wishId = null; window.app.plantPanel.render(); });
  assert(await panel.getByText('Basis van Border').isVisible(), 'stap 3 Planten: eerst de wensvakjes, dan de basis van het vak');
  const list = await panel.locator('.wlist li').allInnerTexts();
  assert(list.length === 2 && /Heester/.test(list[0]) && /Vaste plant/.test(list[1]) && /roze/.test(list[1]), 'de lijst volgt de piramide: eerst de heester, dan de vaste plant');
  await page.screenshot({ path: path.join(OUT, 'wensvakjes.png') });

  // vakje 1 kiezen (de heester): passende planten
  await panel.locator('.wlist li').first().click();
  assert(await page.evaluate(() => window.app.selection.size === 1 && !!window.app.store.findItem([...window.app.selection][0]).item.wish), 'het vakje is geselecteerd in de tekening');
  assert(await page.locator('#selection-bar [data-plan="wishpick"]').count() === 1 && !(await page.locator('#selection-bar [data-act="openbed"]').count()), 'balk bij een wensvakje: alleen "Kies plant" (geen dubbele knop)');
  const cands = await panel.locator('.wcands li.role').allInnerTexts();
  assert(cands.length >= 2, `passende planten voor de heester (${cands.length})`);
  await page.screenshot({ path: path.join(OUT, 'wensvakje-kiezen.png') });
  const types = await page.evaluate(async () => {
    const { wishCandidates } = await import('./js/wish.js'); const { plantLayer } = await import('./js/planting.js');
    const r = wishCandidates({ layer: 'heesters', height: 'hoog', seasons: ['herfst'] }, { light: 'zon', moisture: 'normaal' });
    return { layers: [...new Set(r.list.map((c) => plantLayer(c.p)))], light: r.list.every((c) => c.p.light.includes('zon')) };
  });
  assert(types.layers.length === 1 && types.layers[0] === 'heesters' && types.light, 'alleen heesters, en alleen wat in de zon kan');
  await panel.locator('.wcands li.role').first().click();
  const after1 = await page.evaluate(() => {
    const a = window.app; const gs = a.store.doc.layers[0].items.filter((i) => i.group);
    const heester = gs.find((g) => g.wish.layer === 'heesters');
    return { filled: heester.planting.mix.length, sel: [...a.selection][0], vaste: gs.find((g) => g.wish.layer === 'vaste').id };
  });
  assert(after1.filled === 1, 'een plant kiezen zet hem in het vakje');
  assert(after1.sel === after1.vaste, 'daarna gaat het vanzelf door naar het volgende open vakje');
  const roze = await page.evaluate(async () => {
    const { colorFamily } = await import('./js/plantdb.js');
    const first = document.querySelector('#plant-panel .wcands li.role b')?.textContent;
    const { PLANTS } = await import('./js/plantdb.js');
    const p = [...PLANTS.values()].find((q) => q.nl === first);
    return { name: first, fam: p && colorFamily(p.color), summer: p && p.bloom.some((m) => m >= 6 && m <= 8) };
  });
  assert(roze.fam === 'roze' && roze.summer, `bovenaan voor de roze zomerwens: ${roze.name}`);
  await panel.locator('.wcands li.role').first().click();
  assert(await page.evaluate(() => window.app.store.doc.layers[0].items.filter((i) => i.group && i.planting.mix.length).length === 2), 'alle vakjes hebben een plant');

  // al gekozen planten: voorrang en een eigen overzicht
  const vasteRole = await page.evaluate(() => window.app.store.doc.layers[0].items.find((i) => i.group && i.wish.layer === 'vaste').planting.mix[0].role);
  await page.evaluate(() => { const a = window.app; const g = a.store.doc.layers[0].items.find((i) => i.group && i.wish.layer === 'vaste'); const role = g.planting.mix[0].role; const bed = a.store.findItem('B').item; a.store.mutate(() => { g.planting = { mix: [] }; bed.planting = bed.planting || { mix: [] }; bed.planting.mix.push({ role, w: 30 }); }, 't'); a.setSelection(new Set([g.id])); a.plantPanel.render(); });
  const pri = await page.evaluate(async () => {
    const { wishCandidates } = await import('./js/wish.js');
    const pp = window.app.plantPanel; const g = window.app.store.doc.layers[0].items.find((i) => i.group && i.wish.layer === 'vaste');
    const bed = window.app.store.findItem('B').item;
    const used = pp.usedPlantIds();
    const withU = wishCandidates(g.wish, pp.wishCtx(bed)).list;
    return { used: used.size, firstUsed: used.has(withU[0].p.id), tag: withU[0].good.includes('al gekozen in dit ontwerp') };
  });
  assert(pri.used >= 2 && pri.firstUsed && pri.tag, `een plant die al in het ontwerp staat krijgt voorrang bij de passende planten`);
  await panel.locator('.wcard [data-wact="chosen"]').click();
  const cdlg = page.locator('#dlg-chosen');
  assert(await cdlg.isVisible(), 'knop "Al gekozen planten" opent het overzicht');
  const crow = await cdlg.locator('li.plant').allInnerTexts();
  const unfit = await cdlg.locator('li.plant.unfit').count();
  assert(crow.length === pri.used && unfit === 1 && /staat in/.test(crow[0]) && /geen/.test(crow[crow.length - 1]), `alle planten uit het ontwerp, passend bovenaan (${crow.map((t) => t.split('\n')[0]).join(' | ')})`);
  await page.screenshot({ path: path.join(OUT, 'al-gekozen.png') });
  await cdlg.locator('li.plant').first().click();
  const refill = await page.evaluate(() => window.app.store.doc.layers[0].items.find((i) => i.group && i.wish.layer === 'vaste').planting.mix[0]?.role);
  assert(!(await cdlg.isVisible()) && refill === vasteRole, 'kiezen uit het overzicht zet de plant in het vakje');
  await page.evaluate(() => { window.app.setSelection(new Set()); window.app.plantPanel.wishId = null; window.app.plantPanel.render(); });
  await panel.locator('[data-act="chosen"]').first().click();
  assert(await cdlg.isVisible() && await cdlg.locator('li.plant').count() === pri.used, 'ook vanuit de basis van het vak');
  await cdlg.locator('button[value="close"]').last().click();
  await page.evaluate(() => { const bed = window.app.store.findItem('B').item; window.app.store.mutate(() => { bed.planting.mix.pop(); }, 't'); });

  // lagen als overtrekpapier: alleen bomen en heesters
  await page.click('#btn-planting');
  await page.click('#plant-menu [data-pm="garden"]');
  const gp = page.locator('#garden-panel');
  assert(await gp.isVisible() && !(await panel.isVisible()), 'Beplanting ▸ Hele ontwerp is een apart paneel');
  await gp.locator('[data-layer="1"]').click();
  const lay = await page.evaluate(async () => {
    const { groupLayerIndex } = await import('./js/wish.js'); const { rolesMap } = await import('./js/planting.js');
    const roles = rolesMap(window.app.store.doc);
    return { max: window.app.plantPanel.layerMax, idx: window.app.store.doc.layers[0].items.filter((i) => i.group).map((g) => groupLayerIndex(g, roles)).sort() };
  });
  assert(lay.max === 1 && lay.idx.join() === '1,2', 'Lagen "t/m heester" verbergt de vaste planten (zoals overtrekpapier)');
  await page.screenshot({ path: path.join(OUT, 'wensvakjes-lagen.png') });
  await gp.locator('[data-layer=""]').click();
  assert(await page.evaluate(() => window.app.plantPanel.layerMax == null), 'Alles laat weer alles zien');
  await page.click('#btn-planting');
  await page.click('#plant-menu [data-pm="bed"]');

  // plantenlijst
  await panel.locator('[data-act="plantlist"]').click();
  const dlg = page.locator('#dlg-shoplist');
  assert(await dlg.isVisible(), 'de knop Plantenlijst opent de lijst');
  const rows = await dlg.locator('tbody tr[data-id]').count();
  const grp = await dlg.locator('tbody tr.grp').allInnerTexts();
  assert(rows === 3, `drie soorten in de lijst (${rows})`);
  assert(/Heesters/.test(grp[0]) && /Vaste planten/.test(grp[1]), `in de volgorde van de piramide (${grp.join(' | ')})`);
  const kat = await page.evaluate(async () => {
    const { plantList } = await import('./js/plantlist.js');
    const l = plantList(window.app.store.doc);
    const r = l.rows.find((x) => x.id === 'r1');
    return { count: r.count, perM2: r.perM2, lat: r.lat, light: r.light, total: l.total };
  });
  assert(kat.count >= 55 && kat.count <= 85 && kat.perM2 > 3 && kat.perM2 < 6 && /Nepeta/.test(kat.lat), `kattenkruid: ${kat.count} stuks, ${kat.perM2.toFixed(1)} per m²`);
  // prijs invullen
  const priceIn = dlg.locator('tr[data-id="r1"] [data-f="price"]');
  await priceIn.fill('3,95');
  await priceIn.press('Tab');
  await dlg.locator('tr[data-id="r1"] [data-f="supplier"]').fill('Kwekerij De Hessenhof');
  await dlg.locator('tr[data-id="r1"] [data-f="supplier"]').press('Tab');
  const tot = await dlg.locator('tr[data-id="r1"] .tot').innerText();
  const saved = await page.evaluate(() => { const r = window.app.store.doc.planting.roles.find((x) => x.id === 'r1'); return { price: r.price, sup: r.supplier }; });
  assert(saved.price === 3.95 && saved.sup === 'Kwekerij De Hessenhof', 'prijs en leverancier worden bij de plant bewaard');
  assert(tot.replace(/\s/g, '') === `€${(3.95 * kat.count).toFixed(2).replace('.', ',')}`, `totaal per regel (${tot})`);
  await page.screenshot({ path: path.join(OUT, 'plantenlijst.png') });
  const csv = await page.evaluate(async () => {
    const { plantList, plantListCsv } = await import('./js/plantlist.js');
    return plantListCsv(plantList(window.app.store.doc)).text();
  });
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
  assert(lines.length === 5 && /^Nr;Nederlandse naam;Latijnse naam/.test(lines[0]) && lines.some((l) => /Kattenkruid;Nepeta.*;3,95;/.test(l)), 'CSV voor Excel: kop, drie planten en een totaal, met decimale komma');
  const pdf = await page.evaluate(async () => {
    const { plantList, plantListPdf } = await import('./js/plantlist.js');
    const blob = await plantListPdf(plantList(window.app.store.doc), { title: 'Plantenlijst Border' });
    const t = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    return { start: t.slice(0, 5), pages: (t.match(/\/Type \/Page /g) || []).length, size: blob.size };
  });
  assert(pdf.start === '%PDF-' && pdf.pages === 1 && pdf.size > 20000, `PDF met de lijst (${pdf.pages} blad, ${Math.round(pdf.size / 1024)} kB)`);
  // veel planten: meerdere bladen
  const many = await page.evaluate(async () => {
    const { plantList, plantListPdf } = await import('./js/plantlist.js');
    const l = plantList(window.app.store.doc);
    const rows = Array.from({ length: 60 }, (_, i) => ({ ...l.rows[i % l.rows.length], code: 'X' + i }));
    const blob = await plantListPdf({ ...l, rows, groups: [{ layer: l.groups[0].layer, rows }] }, { title: 'Lang' });
    const t = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    return (t.match(/\/Type \/Page /g) || []).length;
  });
  assert(many >= 2, `een lange lijst loopt door over ${many} bladen`);
  // ook vanuit Exporteren
  await dlg.locator('button.x').click();
  await page.click('#btn-export');
  await page.click('#exp-plantlist');
  assert(await page.locator('#dlg-shoplist').isVisible(), 'Exporteren heeft ook een knop Plantenlijst');
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle wensvak- en plantenlijst-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
