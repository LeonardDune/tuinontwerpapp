// 3D-wandeling: model uit de tekening (hoogtes, hagen, bomen, planten), lopen met toetsen en slepen,
// andere maand, download als .glb en als losse .html die zelf werkt.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app && window.app.ready);
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { roleFromPlant, plantById } = await import('./js/plantdb.js');
    const d = newDoc('Wandeltuin');
    const role = (id, pid) => ({ id, code: id, ...roleFromPlant(plantById(pid)) });
    d.planting = { roles: [role('r1', 'kattenkruid'), role('r2', 'lampenpoetsergras'), role('r3', 'zonnehoed'), role('rb', 'lijsterbes')], scheme: { type: 'vrij' } };
    const it = d.layers[0].items;
    it.push({ type: 'shape', id: 'huis', kind: 'polygon', points: [[0, -8], [10, -8], [10, 0], [0, 0]], color: '#333', width: 0.1, height: 7, source: '3dbag' });
    it.push({ type: 'shape', id: 'terras', kind: 'polygon', points: [[0, 0], [10, 0], [10, 4], [0, 4]], color: '#777', width: 0.02, fill: '#c9b9a3', fillAlpha: 1 });
    it.push({ type: 'shape', id: 'gras', kind: 'polygon', points: [[0, 4], [10, 4], [10, 16], [0, 16]], color: '#5a8', width: 0.02, hatch: 'gras' });
    it.push({ type: 'shape', id: 'vak', kind: 'polygon', bed: true, points: [[1, 5], [6, 5], [6, 8], [1, 8]], color: '#3f7a2e', width: 0.03, planting: { mix: [{ role: 'r1', w: 40 }, { role: 'r2', w: 30 }, { role: 'r3', w: 30 }] } });
    it.push({ type: 'shape', id: 'schets', kind: 'polygon', bed: true, btype: 'hoog', points: [[7, 10], [9.5, 10], [9.5, 15], [7, 15]], color: '#3f7a2e', width: 0.03, planting: { mix: [] } });
    it.push({ type: 'shape', id: 'hek', kind: 'line', wall: true, fence: 'schutting', points: [[0, 16], [10, 16]], color: '#8a6a45', width: 0.05 });
    it.push({ type: 'shape', id: 'muur', kind: 'line', wall: true, points: [[10, 4], [10, 16]], color: '#555', width: 0.2, height: 1 });
    it.push({ type: 'stencil', id: 'boom', symbol: 'lijsterbes', x: 3, y: 12, w: 4, h: 4, rot: 0 });
    it.push({ type: 'stencil', id: 'haag', symbol: 'haag', x: 0.3, y: 10, w: 0.6, h: 11, rot: 0 });
    it.push({ type: 'stencil', id: 'pergola', symbol: 'overkapping', x: 5, y: 2, w: 4, h: 3, rot: 0 });
    it.push({ type: 'plant', id: 'sol', role: 'rb', x: 8, y: 6, d: 3 });
    a.openDoc(d, true);
    a.sun.ymd = '2026-07-15'; a.sun.minutes = 15 * 60;
  });
  await page.click('#btn-3d');
  await page.waitForFunction(() => window.app.walk, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => {
    const w = window.app.walk; const s = w.built.stats;
    let inst = 0, meshes = 0; w.built.group.traverse((o) => { if (o.isInstancedMesh) inst += o.count; else if (o.isMesh) meshes++; });
    return { s, inst, meshes, start: w.built.start, box: w.built.box, overlay: !!document.querySelector('.walk3d canvas'), cam: w.viewer.camera.position.toArray() };
  });
  assert(st.overlay, '3D-weergave opent over de tekening');
  assert(st.s.prisms >= 2 && st.s.walls === 1 && st.s.fences === 1, `huis, haag, muur en schutting staan er in 3D (${st.s.prisms} blokken, ${st.s.walls} muur, ${st.s.fences} schutting)`);
  assert(st.s.trees === 2, 'lijsterbes (stencil) en de solitaire lijsterbes uit de beplanting zijn bomen');
  assert(st.s.frames === 1, 'pergola met palen en balken');
  assert(st.s.plants > 40 && st.inst > 40, `planten in de vakken (${st.s.plants}, ook het schetsvak)`);
  assert(st.start.y > 0 && st.start.y < 3 && st.cam[1] > 1.5 && st.cam[1] < 1.7, `je begint bij het huis, op ooghoogte (${st.start.x.toFixed(1)}, ${st.start.y.toFixed(1)})`);
  await page.screenshot({ path: path.join(OUT, 'walk3d-lopen.png') });
  const px = await page.evaluate(() => {
    const v = window.app.walk.viewer; v.renderer.render(v.scene, v.camera);
    const gl = v.renderer.getContext(); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; const a = new Uint8Array(4 * 64);
    const cols = new Set(); for (let i = 0; i < 8; i++) { gl.readPixels(Math.floor(w * (i + 0.5) / 8), Math.floor(h * 0.35), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, a); cols.add(a.slice(0, 3).join(',')); gl.readPixels(Math.floor(w * (i + 0.5) / 8), Math.floor(h * 0.7), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, a); cols.add(a.slice(0, 3).join(',')); }
    return cols.size;
  });
  assert(px >= 5, `het beeld is getekend (${px} verschillende kleuren in 16 punten)`);

  // lopen met toetsen en rondkijken met slepen
  const before = await page.evaluate(() => window.app.walk.viewer.state.walk);
  await page.locator('.walk3d canvas').click({ position: { x: 640, y: 400 } });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(760, 400, { steps: 5 }); await page.mouse.up();
  const after = await page.evaluate(() => window.app.walk.viewer.state.walk);
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  assert(moved > 0.25 && moved < 5, `W: vooruit gelopen (${moved.toFixed(2)} m)`);
  assert(Math.abs(after.yaw - before.yaw) > 0.3, 'slepen: rondgekeken');
  await page.click('.w3d [data-m="orbit"]');
  await page.waitForTimeout(200);
  const orbitY = await page.evaluate(() => window.app.walk.viewer.camera.position.y);
  assert(orbitY > 8, `vogelvlucht: van bovenaf (${orbitY.toFixed(1)} m hoog)`);
  await page.screenshot({ path: path.join(OUT, 'walk3d-vogelvlucht.png') });

  // andere maand: winter, de lijsterbes is kaal, minder planten
  const win = await page.evaluate(async () => {
    const inp = document.querySelector('.w3d input[type=date]'); inp.value = '2026-01-15'; inp.dispatchEvent(new Event('change'));
    const w = window.app.walk; let bare = 0, crowns = 0; w.built.group.traverse((o) => { if (o.name === 'boom (kaal)') bare++; if (o.name === 'boom') crowns++; });
    return { month: w.built.month, bare, crowns, plants: w.built.stats.plants };
  });
  assert(win.month === 1 && win.crowns === 0 && win.bare === 2, 'januari: bomen kaal, alleen takken');
  assert(win.plants < st.s.plants, `januari: minder te zien van de vaste planten (${win.plants} i.p.v. ${st.s.plants})`);

  // downloads
  const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('.w3d button:has-text("3D-model")')]);
  const glbPath = path.join(OUT, 'walk3d.glb'); await dl1.saveAs(glbPath);
  const glb = fs.readFileSync(glbPath);
  assert(glb.slice(0, 4).toString() === 'glTF' && glb.length > 50000, `.glb (glTF binair, ${(glb.length / 1e6).toFixed(1)} MB) voor Blender en andere viewers`);
  const json = JSON.parse(glb.slice(20, 20 + glb.readUInt32LE(12)).toString());
  assert((json.extensionsUsed || []).every((e) => e === 'EXT_mesh_gpu_instancing') && json.meshes.length > 10 && json.images?.length >= 3, `planten als herhaalde modellen (instancing), met textuur voor grond, blad en haag (${json.images.length} afbeeldingen)`);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('.w3d button:has-text("Wandeling")')]);
  const htmlPath = path.join(OUT, 'walk3d.html'); await dl2.saveAs(htmlPath);
  assert(dl2.suggestedFilename().endsWith('.html'), `wandeling als los bestand: ${dl2.suggestedFilename()}`);

  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => !document.querySelector('.walk3d') && !window.app.walk), 'Esc: terug naar de tekening');

  // het losse bestand werkt zonder de app (bijv. op een laptop, dubbelklikken)
  const p2 = await b.newPage({ viewport: { width: 1200, height: 760 } });
  const err2 = [];
  p2.on('pageerror', (e) => err2.push(e.message));
  await p2.goto('file://' + htmlPath);
  await p2.waitForSelector('.w3d canvas', { timeout: 30000 });
  await p2.waitForTimeout(1500);
  const sa = await p2.evaluate(() => ({ title: document.querySelector('.w3d-title')?.textContent, date: document.querySelector('.w3d input[type=date]').value }));
  assert(sa.title === 'Wandeltuin' && sa.date === '2026-01-15', 'los bestand opent de wandeling met titel en datum');
  await p2.keyboard.down('KeyW'); await p2.waitForTimeout(300); await p2.keyboard.up('KeyW');
  await p2.screenshot({ path: path.join(OUT, 'walk3d-los-bestand.png') });
  assert(!err2.length, 'los bestand zonder fouten' + (err2.length ? ': ' + err2.join(' | ') : ''));

  // aanraken: joystick op een tablet
  const tab = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  const p3 = await tab.newPage();
  await p3.goto('file://' + htmlPath);
  await p3.waitForSelector('.w3d canvas');
  const vis = await p3.evaluate(() => getComputedStyle(document.querySelector('.w3d-stick')).display);
  assert(vis === 'block', 'op de iPad staat er een joystick om mee te lopen');
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle 3D-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
