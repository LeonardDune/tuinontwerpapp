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

  // stencils krijgen een eigen 3D-model
  const mdl = await page.evaluate(async () => {
    const { buildGarden } = await import('./js/scene3d.js'); const { newDoc } = await import('./js/model.js'); const { STENCILS, STENCIL_MAP: M } = await import('./js/stencils.js');
    const { hasModel } = await import('./js/models3d.js');
    const d = newDoc('Modellen'); const it = d.layers[0].items;
    const st = (id, x, y, extra = {}) => it.push({ type: 'stencil', id: 'm_' + id, symbol: id, x, y, w: M[id].w, h: M[id].h, rot: 0.3, color: M[id].color, ...extra });
    st('tafelrond', 0, 0); st('kruidenspiraal', 4, 0); st('regenton', 7, 0); st('kliko3', 9, 0); st('auto', 12, 0); st('hek_schutting', 0, 4); st('poort', 3, 4);
    it.push({ type: 'shape', id: 'W', kind: 'line', wall: true, points: [[-2, 8], [6, 8]], width: 0.25, color: '#555', height: 2.8 });
    st('buitendeur', 1, 8, { wallId: 'W', wallSeg: 0, rot: 0 });
    it.push({ type: 'shape', id: 'G', kind: 'polygon', points: [[-3, 10], [8, 10], [8, 16], [-3, 16]], hatch: 'gras', color: '#5a8', width: 0.02 });
    it.push({ type: 'shape', id: 'P', kind: 'polygon', points: [[0, 12], [6, 12], [6, 13.2], [0, 13.2]], hatch: 'klinkers', color: '#777', width: 0.02 });
    st('flagstone', 2, 15);
    const g = buildGarden(window.Tuin3D.THREE, d, { month: 7 });
    const kids = (name) => { const o = g.group.children.find((c) => c.name === name); if (!o) return null; let m = 0, plants = 0; o.traverse((q) => { if (q.isMesh) { m++; if (q.material?.name === 'planten') plants++; } }); return { m, plants, h: new window.Tuin3D.THREE.Box3().setFromObject(o).getSize(new window.Tuin3D.THREE.Vector3()).y }; };
    // alles wat geen plat stencil (tegel, stapsteen) of plant is, heeft een model
    const flat = ['Stenen, tegels en klinkers', 'Stapstenen', 'Bomen', 'Hagen', 'Vaste planten'];
    const missing = STENCILS.filter((s) => !flat.includes(s.cat) && !hasModel(s.id) && !/^hek_/.test(s.id) && !['overkapping', 'pergolagang', 'pergolamuur', 'pergolalatten', 'lamellendak', 'veranda', 'verandaterras', 'heester', 'bloeiend', 'siergras', 'bodembedekker', 'deur', 'buitendeur', 'dubbeledeur', 'openslaand', 'schuifdeur', 'raam', 'schuifpui'].includes(s.id)).map((s) => s.id);
    let tuftsOnPath = 0; const M4 = new window.Tuin3D.THREE.Matrix4(), V3 = new window.Tuin3D.THREE.Vector3();
    g.group.traverse((o) => { if (o.isInstancedMesh && o.name === 'gazon') for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M4); V3.setFromMatrixPosition(M4); if (V3.x > 0.05 && V3.x < 5.95 && V3.z > 12.05 && V3.z < 13.15) tuftsOnPath++; } });
    const path = g.group.children.find((c) => /^Klinkers/.test(c.material?.name || ''));
    return { surfaces: g.stats.surfaces, tuftsOnPath, pathTop: path ? new window.Tuin3D.THREE.Box3().setFromObject(path).max.y : 0, tafel: kids('Ronde tafel (4)'), spiraal: kids('Kruidenspiraal met vijvertje'), deur: kids('Buitendeur'), fences: g.stats.fences, models: g.stats.models, missing };
  });
  assert(mdl.tafel && mdl.tafel.m >= 1 && mdl.tafel.h > 0.7 && mdl.tafel.h < 1, `ronde tafel met stoelen (${mdl.tafel?.h.toFixed(2)} m hoog)`);
  assert(mdl.spiraal && mdl.spiraal.plants >= 6 && mdl.spiraal.h > 0.8, `kruidenspiraal: stapelmuur in een spiraal met ${mdl.spiraal?.plants} kruiden`);
  assert(mdl.deur && mdl.deur.h > 2, 'deur in een muur');
  assert(mdl.fences === 1 && mdl.models >= 7, 'losse schutting en poort, regenton, kliko\'s en auto als model');
  assert(mdl.surfaces === 2 && mdl.pathTop > 0.02 && mdl.pathTop < 0.06, `klinkerpad en stapsteen liggen als echte verharding in 3D (pad ${(mdl.pathTop * 100).toFixed(1)} cm hoog)`);
  assert(mdl.tuftsOnPath === 0, 'geen gras dat door het pad heen groeit');
  assert(!mdl.missing.length, 'elk stencil (behalve tegels en planten) heeft een 3D-model' + (mdl.missing.length ? ': zonder ' + mdl.missing.join(', ') : ''));

  // huis met ramen en dak, veranda waar je onder kijkt, pergola met klimplant
  const hv = await page.evaluate(async () => {
    const { buildGarden } = await import('./js/scene3d.js'); const { newDoc } = await import('./js/model.js'); const { STENCIL_MAP: M } = await import('./js/stencils.js');
    const d = newDoc('Huis'); const it = d.layers[0].items;
    it.push({ type: 'shape', id: 'H', kind: 'polygon', points: [[0, -9], [6, -9], [6, 0], [0, 0]], color: '#333', width: 0.1, height: 9, source: '3dbag' });
    it.push({ type: 'shape', id: 'H2', kind: 'polygon', points: [[6, -9], [12, -9], [12, 0], [6, 0]], color: '#333', width: 0.1, height: 9, source: '3dbag' });
    it.push({ type: 'shape', id: 'V', kind: 'polygon', points: [[0.3, 0], [5.7, 0], [5.7, 3.5], [0.3, 3.5]], color: '#333', width: 0.05, hatch: 'veranda', height: 2.6 });
    it.push({ type: 'stencil', id: 'P', symbol: 'overkapping', x: 9, y: 4, w: 4, h: 3, rot: 0, color: M.overkapping.color, grow: 'vol', growKind: 'blauweregen' });
    it.push({ type: 'stencil', id: 'B', symbol: 'berceau', x: 3, y: 9, w: 6, h: 2.2, rot: 0, color: M.berceau.color });
    const T = window.Tuin3D.THREE;
    const g = buildGarden(T, d, { month: 5 });
    const count = (root, fn) => { let n = 0; root.traverse((o) => { if (fn(o)) n++; }); return n; };
    const house = g.group.children.find((c) => c.name === 'huis');
    const roofs = house ? count(house, (o) => o.name === 'dak') : 0;
    const glassPanes = house ? count(house, (o) => o.isMesh && o.material?.name === 'metal') : 0;
    const shared = (() => { const hs = g.group.children.filter((c) => c.name === 'huis'); return hs.length; })();
    const veranda = g.group.children.find((c) => c.name === 'Veranda / glazen dak met profielen');
    const vGlass = veranda ? count(veranda, (o) => o.isMesh && o.material?.transparent) : 0;
    const vSolid = count(g.group, (o) => o.isMesh && o.material?.name === 'Veranda / glazen dak met profielen');
    const climbers = count(g.group, (o) => o.isMesh && o.name === 'klimplant' && o.geometry.attributes.position.count > 100);
    return { roofs, glassPanes, shared, vGlass, vSolid, climbers };
  });
  assert(hv.shared === 2 && hv.roofs === 2 && hv.glassPanes >= 1, 'huis met zadeldak (twee dakvlakken), ramen en pui');
  assert(hv.vGlass >= 1 && hv.vSolid === 0, 'veranda: glazen dak op staanders, geen dicht blok');
  assert(hv.climbers >= 2, `pergola en berceau zijn begroeid met klimplanten (${hv.climbers})`);

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
  const tab = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const p3 = await tab.newPage();
  await p3.goto('file://' + encodeURI(htmlPath) + '?nowind');
  await p3.waitForSelector('.w3d canvas', { timeout: 90000 });
  const vis = await p3.evaluate(() => getComputedStyle(document.querySelector('.w3d-stick')).display);
  assert(vis === 'block', 'op de iPad staat er een joystick om mee te lopen');
  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle 3D-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
