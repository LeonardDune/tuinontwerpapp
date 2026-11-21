// Bomen per soort: elk een eigen bovenaanzicht, zonder fouten op elke maat, en te vinden in het stencilvenster.
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
    const { STENCILS, drawStencil } = await import('./js/stencils.js');
    const trees = STENCILS.filter((q) => q.cat === 'Bomen' && q.round);
    const c = document.createElement('canvas'); c.width = 120; c.height = 120; const g = c.getContext('2d');
    const sig = {}, variety = {};
    for (const s of trees) {
      for (const size of [0.5, s.w, 25]) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, 120, 120);
        const k = 110 / size; g.setTransform(k, 0, 0, k, 60, 60);
        drawStencil(g, { type: 'stencil', symbol: s.id, x: 0, y: 0, w: size, h: size, rot: 0, color: s.color }, 0.02 * size / 5, '#ffffff');
      }
      const px = g.getImageData(0, 0, 120, 120).data; const set = new Set(); let sr = 0, sg = 0, sb = 0;
      for (let i = 0; i < px.length; i += 4) { set.add((px[i] >> 4) * 256 + (px[i + 1] >> 4) * 16 + (px[i + 2] >> 4)); sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; }
      variety[s.id] = set.size; sig[s.id] = [sr, sg, sb].map((v) => Math.round(v / 1e4)).join(',');
    }
    const dlg = [...document.querySelectorAll('#stencil-grid .stencil-item')].map((x) => x.dataset.id);
    return { ids: trees.map((t) => t.id), variety, distinct: new Set(Object.values(sig)).size, dlg };
  });
  const want = ['lijsterbes', 'populier', 'berk', 'eik', 'beuk', 'linde', 'esdoorn', 'japanseesdoorn', 'sierkers', 'treurwilg', 'kastanje', 'den', 'olijf'];
  assert(want.every((id) => r.ids.includes(id)), `${r.ids.length} bomen, o.a. lijsterbes, zuilpopulier, berk, eik, beuk, linde, esdoorn, sierkers, treurwilg, kastanje, den, olijf`);
  assert(want.every((id) => r.dlg.includes(id)), 'alle nieuwe bomen staan in het stencilvenster');
  const flat = r.ids.filter((id) => want.includes(id) && r.variety[id] < 25);
  assert(!flat.length, 'elke nieuwe boom heeft bladstructuur in meerdere tinten' + (flat.length ? ': ' + flat.join(', ') : ''));
  assert(r.distinct >= r.ids.length - 1, `de bomen zien er allemaal anders uit (${r.distinct} van ${r.ids.length} verschillend)`);
  const hts = await page.evaluate(async () => {
    const S = await import('./js/shadows.js'); const { STENCILS } = await import('./js/stencils.js');
    const h = (id) => S.defaultHeight({ type: 'stencil', symbol: id });
    const zero = STENCILS.filter((s) => ['Bomen', 'Hagen', 'Heesters & planten', 'Vaste planten', 'Regenwater'].includes(s.cat) && s.id !== 'regentank_ondergronds' && !(h(s.id) > 0)).map((s) => s.id);
    // solitair uit de beplanting werpt ook schaduw
    const doc = { layers: [{ visible: true, items: [{ type: 'plant', id: 'p', role: 'r', x: 0, y: 0, d: 4 }] }], planting: { roles: [{ id: 'r', plant: 'lijsterbes', kind: 'boom', height: 'xhoog' }] } };
    return { zero, lijst: h('lijsterbes'), eik: h('eik'), haag: h('haag'), rand: h('haag_laag'), aar: h('vp_aar'), sol: S.collectCasters(doc) };
  });
  assert(!hts.zero.length, 'elke boom, haag, plant en regenton heeft een standaardhoogte' + (hts.zero.length ? ': zonder ' + hts.zero.join(', ') : ''));
  assert(hts.lijst === 8 && hts.eik === 25 && hts.haag === 1.8 && hts.rand === 0.4 && hts.aar === 0.9, `hoogtes uit de plantendatabase: lijsterbes ${hts.lijst} m, eik ${hts.eik} m, liguster ${hts.haag} m, buxusrand ${hts.rand} m, vaste plant (aar) ${hts.aar} m`);
  assert(hts.sol.length === 1 && hts.sol[0].type === 'tree' && hts.sol[0].h === 8, 'solitaire lijsterbes uit de beplanting werpt schaduw als boom van 8 m');
  assert(!errors.length, 'geen JavaScript-fouten (heel klein en heel groot getekend)' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle boom-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
