// Schermen en schuttingen (als lijn of los scherm) en regentonnen.
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
  const r = await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { STENCILS } = await import('./js/stencils.js'); const { FENCES } = await import('./js/fences.js');
    const scr = STENCILS.filter((q) => q.cat === 'Schermen en schuttingen'), rain = STENCILS.filter((q) => q.cat === 'Regenwater');
    const d = newDoc('Schermen'); let y = 0;
    for (const s of scr) {
      if (s.fenceTool) d.layers[0].items.push({ type: 'shape', id: s.id, kind: 'line', wall: true, fence: s.fenceTool, color: FENCES[s.fenceTool].color, width: 0.04, points: [[0, y], [5, y], [5, y + 0.4]] });
      else d.layers[0].items.push({ type: 'stencil', id: s.id, symbol: s.id, x: 2, y, w: s.w, h: s.h, rot: 0, color: s.color });
      y += 0.8;
    }
    y = 0;
    for (const s of rain) { d.layers[0].items.push({ type: 'stencil', id: s.id, symbol: s.id, x: 8, y: y + s.h / 2, w: s.w, h: s.h, rot: 0, color: s.color }); y += s.h + 0.3; }
    a.openDoc(d, true); a.fitView(true); a.settings.grid = false; a.baseDirty = true; a.render();
    const { STENCIL_CATEGORIES } = await import('./js/stencils.js');
    return { missing: [...new Set(STENCILS.map((s) => s.cat))].filter((c) => !STENCIL_CATEGORIES.includes(c)), scr: scr.map((s) => s.id), fenceTypes: scr.filter((s) => s.fenceTool).map((s) => s.fenceTool), rain: rain.map((s) => s.id), cats: [...new Set(STENCILS.map((s) => s.cat))] };
  });
  assert(!r.missing.length, 'elke stencilgroep staat in het stencilvenster' + (r.missing.length ? ': ontbreekt ' + r.missing.join(', ') : ''));
  assert(r.cats.includes('Schermen en schuttingen') && r.cats.includes('Regenwater'), 'groepen "Schermen en schuttingen" en "Regenwater" in de stencils');
  assert(r.fenceTypes.length >= 13 && ['corten', 'bamboe', 'riet', 'composiet', 'trellis', 'beton', 'steigerhout', 'schutting'].every((t) => r.fenceTypes.includes(t)), `${r.fenceTypes.length} soorten scherm/schutting (als lijn)`);
  assert(r.scr.includes('scherm_bak'), 'los terrasscherm met plantenbak');
  assert(r.rain.length >= 7 && r.rain.includes('regenton') && r.rain.includes('regentank_ibc'), `${r.rain.length} regentonnen en -tanks (de oude regenton blijft werken)`);
  await page.screenshot({ path: path.join(OUT, 'schermen.png') });

  console.log('Schutting kiezen in de stencils');
  await page.evaluate(() => { const dl = document.querySelector('#dlg-stencils'); if (!dl.open) dl.showModal(); });
  await page.click('#stencil-grid .stencil-item[data-id="hek_corten"]');
  const st = await page.evaluate(() => ({ tool: window.app.state.tool, fence: window.app.state.fenceType }));
  assert(st.tool === 'wall' && st.fence === 'corten', 'cortenstalen scherm kiezen: tekenen als lijn met het juiste type');
  assert(await page.evaluate(() => [...document.querySelectorAll('#wall-fence, select')].some((s) => [...(s.options || [])].some((o) => o.value === 'corten'))), 'ook te kiezen in de opties van het lijngereedschap');

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle scherm- en regenton-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
