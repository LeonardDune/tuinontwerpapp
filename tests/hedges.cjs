// Hagen: een eigen groep stencils met verschillende soorten hagen, allemaal zonder fouten te tekenen.
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
    const a = window.app; const { newDoc } = await import('./js/model.js'); const { STENCILS } = await import('./js/stencils.js');
    const hedges = STENCILS.filter((q) => q.cat === 'Hagen');
    const d = newDoc('Hagen'); let y = 0;
    for (const s of hedges) {
      // ook heel kort, smal en lang uitgerekt
      for (const [w, h] of [[s.w, s.h], [0.6, 0.25], [14, s.h * 1.5]]) {
        d.layers[0].items.push({ type: 'stencil', id: `${s.id}-${w}`, symbol: s.id, x: w / 2, y: y + h / 2, w, h, rot: 0, color: s.color });
        y += h + 0.3;
      }
    }
    a.openDoc(d, true); a.fitView(true); a.settings.grid = false; a.baseDirty = true; a.render();
    // elke haag levert verschillende kleuren (bladstructuur), niet één vlakke kleur
    const c = document.createElement('canvas'); c.width = 200; c.height = 60; const g = c.getContext('2d');
    const { drawStencil } = await import('./js/stencils.js');
    const variety = {};
    for (const s of hedges) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 60);
      g.setTransform(36, 0, 0, 36, 100, 30);
      drawStencil(g, { type: 'stencil', symbol: s.id, x: 0, y: 0, w: s.w, h: s.h, rot: 0, color: s.color }, 0.02, '#ffffff');
      const px = g.getImageData(0, 0, 200, 60).data; const set = new Set();
      for (let i = 0; i < px.length; i += 4) set.add((px[i] >> 4) * 256 + (px[i + 1] >> 4) * 16 + (px[i + 2] >> 4));
      variety[s.id] = set.size;
    }
    return { ids: hedges.map((h) => h.id), variety };
  });
  assert(r.ids.length >= 8 && r.ids.includes('haag') && r.ids.includes('haag_beuk') && r.ids.includes('haag_wolk'), `${r.ids.length} hagen in de groep "Hagen" (de oude haag blijft werken)`);
  const flat = Object.entries(r.variety).filter(([, v]) => v < 25);
  assert(!flat.length, 'elke haag heeft bladstructuur in meerdere tinten' + (flat.length ? ': ' + flat.map(([k, v]) => `${k} ${v}`).join(', ') : ''));
  await page.screenshot({ path: path.join(OUT, 'hagen.png') });
  assert(!errors.length, 'geen JavaScript-fouten (ook kort, smal en lang uitgerekt)' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle haag-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
