// Hekwerk en schuttingen: getekend als lijn (net als een muur), met palen op vaste afstand.
// Poorten en hekjes zijn openingen (stencils) die in het hek klikken, zoals deuren in een muur.

const TAU = Math.PI * 2;

/** Soorten hekwerk: dikte t (m), paalafstand, paalmaat, kleuren, hoogte (m). */
export const FENCES = {
  schutting: { name: 'Houten schutting (schermen)', t: 0.05, post: 0.07, every: 1.8, color: '#8a6a45', postColor: '#6b4f33', style: 'planken', height: 1.8, use: 'tuin' },
  houtbeton: { name: 'Hout-betonschutting', t: 0.05, post: 0.1, every: 1.84, color: '#8a6a45', postColor: '#9a968e', style: 'planken', height: 1.8, use: 'tuin' },
  lamellen: { name: 'Lamellenschutting (modern, horizontaal hout)', t: 0.04, post: 0.09, every: 1.8, color: '#a67c52', postColor: '#3c4146', style: 'lamel', height: 1.8, use: 'tuin' },
  dubbelstaaf: { name: 'Dubbelstaafmat / gaashek', t: 0.03, post: 0.06, every: 2.5, color: '#2f4a35', postColor: '#2f4a35', style: 'gaas', height: 1.8, use: 'tuin' },
  vlecht: { name: 'Wilgentenen vlechtscherm', t: 0.05, post: 0.06, every: 1.0, color: '#9b7b4f', postColor: '#6b4f33', style: 'vlecht', height: 1.8, use: 'tuin' },
  groen: { name: 'Groenscherm (klimop, kant-en-klaar)', t: 0.14, post: 0.05, every: 1.2, color: '#4f7f36', postColor: '#2f4a35', style: 'groen', height: 1.8, use: 'tuin' },
  gabion: { name: 'Schanskorf (gabion)', t: 0.3, post: 0, every: 2, color: '#5b5f63', postColor: '#5b5f63', style: 'gabion', height: 1.0, use: 'tuin' },
  spijlen: { name: 'Spijlenhek (staal)', t: 0.04, post: 0.06, every: 2.0, color: '#2b2b2b', postColor: '#2b2b2b', style: 'spijlen', height: 1.0, use: 'terras' },
  glas: { name: 'Glazen windscherm', t: 0.03, post: 0.05, every: 1.0, color: '#5b6066', postColor: '#5b6066', style: 'glas', height: 1.0, use: 'terras' },
  hekje: { name: 'Laag houten hekje (tuinhekje)', t: 0.04, post: 0.07, every: 1.5, color: '#7a6a58', postColor: '#7a6a58', style: 'piket', height: 0.9, use: 'terras' },
  touw: { name: 'Palen met touw (terrasrand)', t: 0.02, post: 0.12, every: 1.5, color: '#9b8a6a', postColor: '#7a5a35', style: 'touw', height: 0.8, use: 'terras' },
};

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function hexA(color, a) {
  const c = color.replace('#', '');
  return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${a})`;
}

/**
 * Teken een hek langs pts (wereld, meters). type: sleutel uit FENCES. color: eigen kleur (optioneel).
 * paper: papierkleur (voor afdekken), lw: lijndikte in meters.
 */
export function drawFence(g, pts, closed, type, lw, color = null, gaps = {}) {
  const F = FENCES[type] || FENCES.schutting;
  const c = color || F.color;
  const t = F.t;
  const segs = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) segs.push([pts[i], pts[(i + 1) % pts.length]]);
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'butt';
  const rnd = rng(7);
  segs.forEach(([A, B], si) => {
    const L0 = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (L0 < 1e-6) return;
    const uu = [(B[0] - A[0]) / L0, (B[1] - A[1]) / L0];
    // stukken tussen de openingen (poorten): daar komt het hek
    const holes = (gaps[si] || []).map(([s0, s1]) => [Math.max(0, s0), Math.min(L0, s1)]).filter(([s0, s1]) => s1 > s0).sort((p, q) => p[0] - q[0]);
    const pieces = [];
    let cur = 0;
    for (const [s0, s1] of holes) { if (s0 > cur + 1e-6) pieces.push([cur, s0]); cur = Math.max(cur, s1); }
    if (cur < L0 - 1e-6) pieces.push([cur, L0]);
    for (const [p0, p1] of pieces) drawPiece([A[0] + uu[0] * p0, A[1] + uu[1] * p0], [A[0] + uu[0] * p1, A[1] + uu[1] * p1], holes.length > 0);
  });
  g.restore();

  function drawPiece(a, b) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) return;
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nn = [-u[1], u[0]];
    const P = (s, o) => [a[0] + u[0] * s + nn[0] * o, a[1] + u[1] * s + nn[1] * o];
    const strip = (o0, o1, s0 = 0, s1 = L) => { g.beginPath(); const q = [P(s0, o0), P(s1, o0), P(s1, o1), P(s0, o1)]; q.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
    g.lineWidth = lw;
    g.strokeStyle = c;
    switch (F.style) {
      case 'planken':
        strip(-t / 2, t / 2); g.fillStyle = hexA(c, 0.75); g.fill(); g.stroke();
        g.save(); g.lineWidth = lw * 0.4; g.strokeStyle = hexA('#3d2b1a', 0.5); g.beginPath();
        for (let s = 0.14; s < L; s += 0.14) { g.moveTo(...P(s, -t / 2)); g.lineTo(...P(s, t / 2)); }
        g.stroke(); g.restore();
        break;
      case 'lamel':
        strip(-t / 2, t / 2); g.fillStyle = hexA(c, 0.8); g.fill(); g.stroke();
        g.save(); g.lineWidth = lw * 0.4; g.strokeStyle = hexA('#3d2b1a', 0.45); g.beginPath(); g.moveTo(...P(0, 0)); g.lineTo(...P(L, 0)); g.stroke(); g.restore();
        break;
      case 'gaas':
        g.save(); g.lineWidth = lw * 0.8;
        g.beginPath(); g.moveTo(...P(0, -t / 3)); g.lineTo(...P(L, -t / 3)); g.moveTo(...P(0, t / 3)); g.lineTo(...P(L, t / 3)); g.stroke();
        g.lineWidth = lw * 0.4; g.beginPath();
        for (let s = 0.05; s < L; s += 0.05) { g.moveTo(...P(s, -t / 3)); g.lineTo(...P(s, t / 3)); }
        g.stroke(); g.restore();
        break;
      case 'vlecht':
        strip(-t / 2, t / 2); g.fillStyle = hexA(c, 0.55); g.fill();
        g.save(); g.lineWidth = lw * 0.7; g.beginPath();
        for (const k of [-1, 1]) {
          for (let s = 0; s <= L + 1e-9; s += 0.05) { const o = k * Math.sin((s / 0.25) * Math.PI) * t * 0.38; const p = P(Math.min(s, L), o); if (s === 0) g.moveTo(...p); else g.lineTo(...p); }
        }
        g.stroke(); g.restore();
        break;
      case 'groen': {
        g.save();
        g.fillStyle = hexA(c, 0.55); g.strokeStyle = hexA(c, 1); g.lineWidth = lw * 0.7;
        g.beginPath();
        const step = t * 0.9;
        for (let s = step / 2; s < L; s += step) {
          const [x, y] = P(s, (rnd() - 0.5) * t * 0.15), r = t * (0.48 + rnd() * 0.12);
          g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
        }
        g.fill(); g.stroke();
        g.restore();
        break;
      }
      case 'gabion': {
        strip(-t / 2, t / 2); g.fillStyle = hexA('#b9b4ab', 0.9); g.fill();
        g.save(); g.clip();
        g.fillStyle = hexA('#8a857c', 0.9); g.strokeStyle = hexA('#5b5f63', 0.7); g.lineWidth = lw * 0.4;
        const k = Math.round(L * t * 260);
        for (let i = 0; i < k; i++) { const [x, y] = P(rnd() * L, (rnd() - 0.5) * t); const r = 0.025 + rnd() * 0.03; g.beginPath(); g.ellipse(x, y, r, r * 0.75, rnd() * 3, 0, TAU); g.fill(); g.stroke(); }
        g.restore();
        strip(-t / 2, t / 2); g.stroke();
        g.save(); g.lineWidth = lw * 0.5; g.beginPath();
        for (let s = 1; s < L; s += 1) { g.moveTo(...P(s, -t / 2)); g.lineTo(...P(s, t / 2)); }
        g.stroke(); g.restore();
        break;
      }
      case 'spijlen':
        g.save(); g.lineWidth = lw * 0.9;
        g.beginPath(); g.moveTo(...P(0, 0)); g.lineTo(...P(L, 0)); g.stroke();
        g.fillStyle = c;
        for (let s = 0.12; s < L; s += 0.12) { const [x, y] = P(s, 0); g.beginPath(); g.arc(x, y, t * 0.35, 0, TAU); g.fill(); }
        g.restore();
        break;
      case 'glas':
        strip(-t / 2, t / 2); g.fillStyle = hexA('#a9cde0', 0.55); g.fill();
        g.save(); g.lineWidth = lw * 0.6; g.stroke();
        g.strokeStyle = hexA('#ffffff', 0.9); g.beginPath();
        for (let s = 0.2; s < L; s += 1.0) { g.moveTo(...P(s, 0)); g.lineTo(...P(Math.min(L, s + 0.25), 0)); }
        g.stroke(); g.restore();
        break;
      case 'piket':
        g.save(); g.lineWidth = lw * 0.6;
        g.beginPath(); g.moveTo(...P(0, -t / 4)); g.lineTo(...P(L, -t / 4)); g.stroke();
        g.fillStyle = hexA(c, 0.85);
        for (let s = 0.05; s < L; s += 0.11) { strip(0, t / 2, s - 0.035, s + 0.035); g.fill(); g.stroke(); }
        g.restore();
        break;
      case 'touw':
        g.save(); g.lineWidth = lw * 0.8; g.setLineDash([lw * 3, lw * 1.5]);
        g.beginPath(); g.moveTo(...P(0, 0)); g.lineTo(...P(L, 0)); g.stroke();
        g.restore();
        break;
    }
    // palen: begin, eind en op gelijke afstand ertussen
    if (F.post > 0) {
      const k = Math.max(1, Math.ceil(L / F.every - 1e-6));
      g.fillStyle = hexA(F.postColor, 0.95);
      g.strokeStyle = hexA('#222222', 0.8);
      g.lineWidth = lw * 0.6;
      for (let i = 0; i <= k; i++) {
        const s = (L * i) / k;
        const [x, y] = P(s, 0), h = F.post / 2;
        g.save(); g.translate(x, y); g.rotate(Math.atan2(u[1], u[0]));
        g.beginPath();
        if (F.style === 'touw') g.arc(0, 0, h, 0, TAU); else g.rect(-h, -h, F.post, F.post);
        g.fill(); g.stroke();
        g.restore();
      }
    }
  }
}
