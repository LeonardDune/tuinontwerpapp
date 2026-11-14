// Meerdere steenkleuren in een verband: aantal kleuren, verhouding en hoe ze terugkomen.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'out');
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); }

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.app);

  console.log('Verdeling van de kleuren');
  const r = await page.evaluate(async () => {
    const { assignColors, mixSequence, MIX_MODES, bondLayout } = await import('./js/bonds.js');
    const out = {};
    out.seq = mixSequence([0.5, 0.3, 0.2]).join('');
    out.seq2 = mixSequence([2 / 3, 1 / 3]).join('');
    // een vlak van 40 × 40 eenheden halfsteens (n = 2)
    const L = bondLayout({ type: 'halfsteens', l: 0.2, w: 0.1, joint: 0 });
    const stones = [];
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) for (const [x, y, w, h] of L.list) stones.push({ x: x + i * L.px, y: y + j * L.py, w, h });
    const pal = [{ color: 'a', share: 0.6 }, { color: 'b', share: 0.3 }, { color: 'c', share: 0.1 }];
    for (const mode of Object.keys(MIX_MODES)) {
      const a = assignColors(stones, pal, mode, 20 * L.px, 20 * L.py);
      const cnt = [0, 0, 0]; a.forEach((k) => cnt[k]++);
      // buren met dezelfde kleur (horizontaal in dezelfde rij): maat voor "groepjes"
      const key = new Map(stones.map((s, i) => [`${s.x},${s.y}`, i]));
      let same = 0, pairs = 0;
      stones.forEach((s, i) => { const nb = key.get(`${s.x + s.w},${s.y}`); if (nb != null) { pairs++; if (a[nb] === a[i]) same++; } });
      // banen: alle stenen in een rij dezelfde kleur
      const rows = new Map(); stones.forEach((s, i) => { const k = Math.floor(s.y + 0.5); (rows.get(k) || rows.set(k, new Set()).get(k)).add(a[i]); });
      out[mode] = { share: cnt.map((c) => c / stones.length), same: same / pairs, uniformRows: [...rows.values()].every((set) => set.size === 1) };
    }
    return out;
  });
  assert(r.seq.length === 10 && [...r.seq].filter((c) => c === '0').length === 5 && !r.seq.includes('00'), `ritme 50/30/20: ${r.seq} (geen twee hoofdkleuren naast elkaar)`);
  assert(r.seq2 === '010' || r.seq2 === '001' || r.seq2 === '100', `ritme 2:1: ${r.seq2}`);
  for (const mode of ['willekeurig', 'vlekken']) {
    const s = r[mode].share;
    assert(Math.abs(s[0] - 0.6) < 0.01 && Math.abs(s[1] - 0.3) < 0.01 && Math.abs(s[2] - 0.1) < 0.01, `${mode}: verhouding precies 60/30/10 (${s.map((v) => Math.round(v * 100)).join('/')})`);
  }
  for (const mode of ['verspreid', 'diagonaal', 'banen']) {
    const s = r[mode].share;
    assert(Math.abs(s[0] - 0.6) < 0.03 && Math.abs(s[1] - 0.3) < 0.03 && Math.abs(s[2] - 0.1) < 0.03, `${mode}: verhouding ca. 60/30/10 (${s.map((v) => Math.round(v * 100)).join('/')})`);
  }
  assert(r.vlekken.same > r.willekeurig.same + 0.15, `vlekken: veel vaker dezelfde kleur naast elkaar dan willekeurig (${r.vlekken.same.toFixed(2)} vs ${r.willekeurig.same.toFixed(2)})`);
  assert(r.banen.uniformRows && !r.verspreid.uniformRows, 'banen: elke rij één kleur; verspreid niet');

  console.log('In de tekening');
  await page.evaluate(async () => {
    const a = window.app; const { newDoc } = await import('./js/model.js');
    const d = newDoc('Kleurmenging');
    const bond = { type: 'halfsteens', l: 0.2, w: 0.1, joint: 0.003, color: '#a8503c', jointColor: '#8a857c', finish: 'glad' };
    d.layers[0].items.push({ type: 'shape', id: 'V', kind: 'polygon', rect: true, points: [[0, 0], [4, 0], [4, 3], [0, 3]], color: '#333', width: 0.02, hatch: 'bond', bond });
    a.openDoc(d, true); a.cam.zoom = 120; a.cam.rot = 0; a.cam.x = 300; a.cam.y = 200; a.cameraChanged(); a.settings.grid = false;
    a.setTool('lasso'); a.setSelection(new Set(['V']));
  });
  const colors = () => page.evaluate(() => {
    const a = window.app; a.baseDirty = true; a.render();
    const c = a.base; const g = a.baseCtx; const p = a.cam.toScreen([0.3, 0.3]), q = a.cam.toScreen([3.7, 2.7]);
    const data = g.getImageData(Math.round(p[0] * a.dpr), Math.round(p[1] * a.dpr), Math.round((q[0] - p[0]) * a.dpr), Math.round((q[1] - p[1]) * a.dpr)).data;
    let blue = 0, red = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { n++; if (data[i + 2] > data[i] + 40) blue++; if (data[i] > data[i + 2] + 40) red++; }
    return { blue: blue / n, red: red / n, w: c.width };
  });
  const c0 = await colors();
  assert(c0.blue < 0.01, 'één kleur: geen blauwe stenen');
  await page.click('#selection-bar [data-act="mix"]');
  assert(await page.isVisible('#dlg-mix'), 'knop "Kleuren mengen" opent het venster (de tekening blijft zichtbaar)');
  await page.click('#dlg-mix [data-mix="add"]');
  await page.evaluate(() => { const i = document.querySelector('#dlg-mix input[type=color][data-i="1"]'); i.value = '#2050c0'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); });
  let bond = await page.evaluate(() => window.app.store.findItem('V').item.bond);
  assert(bond.mix && bond.mix.colors.length === 2 && bond.mix.colors[1].color === '#2050c0' && bond.mix.colors[0].share === 50, `tweede kleur erbij, 50/50 (${JSON.stringify(bond.mix?.colors)})`);
  let c1 = await colors();
  assert(c1.blue > 0.25 && c1.red > 0.25, `stenen in beide kleuren te zien (blauw ${Math.round(c1.blue * 100)}%, rood ${Math.round(c1.red * 100)}%)`);
  await page.fill('#dlg-mix input[data-share="1"]', '20');
  await page.press('#dlg-mix input[data-share="1"]', 'Enter');
  await page.fill('#dlg-mix input[data-share="0"]', '80');
  await page.press('#dlg-mix input[data-share="0"]', 'Enter');
  c1 = await colors();
  assert(c1.blue > 0.1 && c1.blue < 0.3 && c1.red > 0.5, `80/20: veel minder blauw (blauw ${Math.round(c1.blue * 100)}%, rood ${Math.round(c1.red * 100)}%)`);
  await page.check('#dlg-mix input[name=mixmode][value="banen"]');
  bond = await page.evaluate(() => window.app.store.findItem('V').item.bond);
  assert(bond.mix.mode === 'banen', 'manier "banen" gekozen');
  await page.screenshot({ path: path.join(OUT, 'kleurmenging.png') });
  const barTxt = await page.textContent('#selection-bar [data-act="mix"]');
  assert(/2 kleuren/.test(barTxt), `knop in de balk toont "${barTxt.trim()}"`);
  await page.evaluate(() => window.app.store.undo());
  bond = await page.evaluate(() => window.app.store.findItem('V').item.bond);
  assert(bond.mix.mode === 'willekeurig', 'ongedaan maken: terug naar willekeurig');
  await page.click('#dlg-mix [data-del="1"]');
  bond = await page.evaluate(() => window.app.store.findItem('V').item.bond);
  assert(!bond.mix, 'kleur weghalen: weer één kleur');
  await page.evaluate(() => window.app.setSelection(new Set()));
  assert(!(await page.isVisible('#dlg-mix')), 'venster sluit als de selectie weg is');

  console.log('Bouwstenen met kleurmenging');
  const pre = await page.evaluate(async () => { const { BOND_PRESETS, describeBond } = await import('./js/bonds.js'); return describeBond(BOND_PRESETS['k-bont-waal'].bond); });
  assert(/3 kleuren, willekeurig/.test(pre), `bouwsteen "bont gemengd": ${pre}`);

  assert(!errors.length, 'geen JavaScript-fouten' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log('Alle kleurmeng-tests geslaagd.');
})().catch((e) => { console.error(e); process.exit(1); });
