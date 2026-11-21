// 3D-wandeling in de app: laadt de 3D-bundel pas als je hem opent, bouwt het model uit de tekening en
// biedt twee downloads: het model (.glb, voor Blender of een andere 3D-viewer) en de wandeling als één
// .html-bestand dat op elke computer in de browser opent, zonder de app.

import { buildGarden } from './scene3d.js';
import { downloadBlob, safeFilename } from './export.js';

const BUNDLE = 'js/vendor/tuin3d.js';
let loading = null;

export function loadTuin3D() {
  if (window.Tuin3D) return Promise.resolve(window.Tuin3D);
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = BUNDLE;
    s.onload = () => (window.Tuin3D ? resolve(window.Tuin3D) : reject(new Error('3D-onderdeel niet gevonden')));
    s.onerror = () => { loading = null; reject(new Error('Het 3D-onderdeel kon niet worden geladen.')); };
    document.head.appendChild(s);
  });
  return loading;
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** De wandeling als los .html-bestand: viewer + model in één bestand. */
export async function walkHtml(T3, group, info) {
  const [glb, bundle] = await Promise.all([T3.exportGlb(group), fetch(BUNDLE).then((r) => { if (!r.ok) throw new Error('3D-onderdeel niet gevonden'); return r.text(); })]);
  const safe = (t) => t.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(info.title || 'Tuinontwerp')} – 3D-wandeling</title>
<style>html,body{margin:0;height:100%;background:#bcd7ea;overflow:hidden}#v{position:fixed;inset:0}</style></head>
<body><div id="v"></div>
<script>${safe(bundle)}</script>
<script>Tuin3D.openStandalone({container:document.getElementById('v'),info:${safe(JSON.stringify(info))},glb:"${toBase64(glb)}"}).catch(function(e){document.body.textContent='Openen lukt niet: '+e.message;});</script>
</body></html>`;
}

export async function openWalk(app) {
  if (app.walk) return app.walk;
  app.toast('3D-model wordt gebouwd…', 1500);
  const T3 = await loadTuin3D();
  const doc = app.store.doc;
  const sun = app.sun;
  const geo = sun.geo();
  if (sun.minutes == null) sun.resetTime?.();
  const ymd = sun.ymd, minutes = sun.minutes;
  let built = buildGarden(T3.THREE, doc, { month: Number(ymd.slice(5, 7)) });

  const overlay = document.createElement('div');
  overlay.className = 'walk3d';
  document.body.appendChild(overlay);
  const info = { title: doc.name, box: built.box, start: built.start, lat: geo.lat, lon: geo.lon, northRot: sun.northRot(), ymd, minutes };
  const viewer = T3.createViewer({
    container: overlay, content: built.group, info,
    onDate: (d) => {
      // andere maand: andere bloei- en bladkleuren
      built = buildGarden(T3.THREE, doc, { month: Number(d.slice(5, 7)) });
      viewer.setContent(built.group);
    },
  });
  const name = safeFilename(doc.name || 'tuinontwerp');
  const busy = async (b, label, job) => {
    const old = b.textContent;
    b.disabled = true;
    b.textContent = label;
    try { await job(); } catch (err) { app.toast(`Dat lukte niet: ${err.message || err}`, 5000); } finally { b.disabled = false; b.textContent = old; }
  };
  const bGlb = viewer.addButton('⬇ 3D-model', 'Download het model (.glb) voor Blender, SketchUp of een online 3D-viewer', () => busy(bGlb, 'Bezig…', async () => {
    const buf = await T3.exportGlb(built.group);
    downloadBlob(new Blob([buf], { type: 'model/gltf-binary' }), `${name}.glb`);
  }));
  const bHtml = viewer.addButton('⬇ Wandeling', 'Download de wandeling als één bestand (.html): dubbelklik erop op je laptop en hij opent in de browser', () => busy(bHtml, 'Bezig…', async () => {
    const st = viewer.state;
    const html = await walkHtml(T3, built.group, { ...info, ymd: st.ymd, minutes: st.minutes });
    downloadBlob(new Blob([html], { type: 'text/html' }), `${name} 3D-wandeling.html`);
  }));
  const close = () => {
    window.removeEventListener('keydown', onEsc);
    viewer.dispose();
    overlay.remove();
    app.walk = null;
  };
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', onEsc);
  viewer.addButton('✕ Sluiten', 'Terug naar de tekening (Esc)', close);
  app.walk = { viewer, close, get built() { return built; } };
  return app.walk;
}
