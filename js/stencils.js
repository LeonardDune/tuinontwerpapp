// Stencils: symbolen op ware grootte (meters). Elk symbool tekent zichzelf
// rond (0, 0) met breedte w en hoogte h. lw is de lijndikte in meters.

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function hexA(color, a) {
  const c = color.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Wolkvormige kroonrand. */
function cloud(g, rx, ry, bumps, depth = 0.12) {
  g.beginPath();
  for (let i = 0; i < bumps; i++) {
    const a0 = (i / bumps) * TAU, a1 = ((i + 1) / bumps) * TAU, am = (a0 + a1) / 2;
    const p0 = [Math.cos(a0) * rx * (1 - depth), Math.sin(a0) * ry * (1 - depth)];
    const p1 = [Math.cos(a1) * rx * (1 - depth), Math.sin(a1) * ry * (1 - depth)];
    const cp = [Math.cos(am) * rx * (1 + depth * 0.9), Math.sin(am) * ry * (1 + depth * 0.9)];
    if (i === 0) g.moveTo(p0[0], p0[1]);
    g.quadraticCurveTo(cp[0], cp[1], p1[0], p1[1]);
  }
  g.closePath();
}

function star(g, rx, ry, spikes, inner) {
  g.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU;
    const r = i % 2 ? inner : 1;
    const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}

function blob(g, rx, ry, seed, n = 9, irr = 0.18) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 - irr + r() * irr * 2;
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) {
      const l = pts[n - 1];
      g.moveTo((l[0] + p[0]) / 2, (l[1] + p[1]) / 2);
    }
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
}

function dot(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

function chair(g, x, y, s, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  g.rect(-s / 2, -s / 2, s, s);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(-s / 2, s / 2 - s * 0.18);
  g.lineTo(s / 2, s / 2 - s * 0.18);
  g.stroke();
  g.restore();
}

export const STENCIL_CATEGORIES = ['Bomen', 'Heesters & planten', 'Meubilair', 'Bouw & water', 'Huis: deuren en ramen', 'Overig'];

export const STENCILS = [
  // --- Bomen (maat = kroondiameter) ---
  {
    id: 'loofboom', name: 'Loofboom', cat: 'Bomen', round: true, w: 6, h: 6, color: '#5a8f3c',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.25);
      cloud(g, w / 2, h / 2, 11);
      g.fill(); g.stroke();
      g.lineWidth = lw * 0.6;
      cloud(g, w * 0.3, h * 0.3, 7, 0.15);
      g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.025, lw * 1.5));
    },
  },
  {
    id: 'solitair', name: 'Solitairboom', cat: 'Bomen', round: true, w: 10, h: 10, color: '#3f7a2e',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.2);
      cloud(g, w / 2, h / 2, 16, 0.08);
      g.fill(); g.stroke();
      g.globalAlpha = 0.45;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * w * 0.38, Math.sin(a) * h * 0.38); g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.025, lw * 1.5));
    },
  },
  {
    id: 'naaldboom', name: 'Naaldboom', cat: 'Bomen', round: true, w: 4, h: 4, color: '#2f6b4f',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.3);
      star(g, w / 2, h / 2, 14, 0.72);
      g.fill(); g.stroke();
      g.globalAlpha = 0.5;
      star(g, w * 0.3, h * 0.3, 9, 0.6); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.03, lw * 1.5));
    },
  },
  {
    id: 'fruitboom', name: 'Fruitboom', cat: 'Bomen', round: true, w: 4, h: 4, color: '#6d9a3a',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.22);
      cloud(g, w / 2, h / 2, 9, 0.14);
      g.fill(); g.stroke();
      const r = rng(7);
      g.fillStyle = '#c0392b';
      for (let i = 0; i < 7; i++) {
        const a = r() * TAU, d = 0.15 + r() * 0.25;
        dot(g, Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.035);
      }
      g.fillStyle = c; dot(g, 0, 0, Math.max(w * 0.03, lw * 1.5));
    },
  },
  {
    id: 'meerstammig', name: 'Meerstammige boom', cat: 'Bomen', round: true, w: 5, h: 5, color: '#628c45',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.22);
      blob(g, w / 2, h / 2, 11, 12, 0.1);
      g.fill(); g.stroke();
      g.fillStyle = c;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.4;
        dot(g, Math.cos(a) * w * 0.08, Math.sin(a) * h * 0.08, Math.max(w * 0.022, lw * 1.2));
      }
    },
  },
  {
    id: 'bestaandeboom', name: 'Bestaande boom', cat: 'Bomen', round: true, w: 8, h: 8, color: '#555555',
    draw(g, w, h, c, lw) {
      g.setLineDash([lw * 4, lw * 3]);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.moveTo(-w * 0.08, 0); g.lineTo(w * 0.08, 0);
      g.moveTo(0, -h * 0.08); g.lineTo(0, h * 0.08);
      g.stroke();
    },
  },

  // --- Heesters & planten ---
  {
    id: 'heester', name: 'Heester', cat: 'Heesters & planten', round: true, w: 1.5, h: 1.5, color: '#7aa64b',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.3);
      blob(g, w / 2, h / 2, 3, 8, 0.2);
      g.fill(); g.stroke();
      g.globalAlpha = 0.5;
      blob(g, w * 0.25, h * 0.25, 5, 6, 0.3); g.stroke();
      g.globalAlpha = 1;
    },
  },
  {
    id: 'bloeiend', name: 'Bloeiende heester', cat: 'Heesters & planten', round: true, w: 1.5, h: 1.5, color: '#b0568f',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.25);
      cloud(g, w / 2, h / 2, 8, 0.18);
      g.fill(); g.stroke();
      const r = rng(31);
      g.fillStyle = c;
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU, d = r() * 0.32;
        dot(g, Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.03);
      }
    },
  },
  {
    id: 'haag', name: 'Haag', cat: 'Heesters & planten', round: false, w: 5, h: 0.8, color: '#4f7f36',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.3);
      const n = Math.max(3, Math.round(w / (h * 0.7)));
      const step = w / n;
      g.beginPath();
      g.moveTo(-w / 2, -h / 2);
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + i * step;
        g.quadraticCurveTo(x + step / 2, -h / 2 - h * 0.25, x + step, -h / 2);
      }
      g.lineTo(w / 2, h / 2);
      for (let i = n; i > 0; i--) {
        const x = -w / 2 + i * step;
        g.quadraticCurveTo(x - step / 2, h / 2 + h * 0.25, x - step, h / 2);
      }
      g.closePath();
      g.fill(); g.stroke();
    },
  },
  {
    id: 'siergras', name: 'Siergras', cat: 'Heesters & planten', round: true, w: 0.8, h: 0.8, color: '#a39a45',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill();
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.moveTo(Math.cos(a) * w * 0.06, Math.sin(a) * h * 0.06);
        g.lineTo(Math.cos(a) * w * 0.5, Math.sin(a) * h * 0.5);
      }
      g.stroke();
    },
  },
  {
    id: 'vasteplant', name: 'Vaste plant', cat: 'Heesters & planten', round: true, w: 0.5, h: 0.5, color: '#8e5bb5',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.3);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        g.beginPath();
        g.ellipse(Math.cos(a) * w * 0.22, Math.sin(a) * h * 0.22, w * 0.2, h * 0.13, a, 0, TAU);
        g.fill(); g.stroke();
      }
      g.fillStyle = '#e1b530'; dot(g, 0, 0, w * 0.09);
    },
  },
  {
    id: 'bodembedekker', name: 'Bodembedekker', cat: 'Heesters & planten', round: true, w: 1, h: 1, color: '#6b9c5a',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.2);
      blob(g, w / 2, h / 2, 19, 10, 0.12);
      g.fill(); g.stroke();
      const r = rng(5);
      g.fillStyle = c;
      for (let i = 0; i < 18; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 0.38;
        dot(g, Math.cos(a) * w * d, Math.sin(a) * h * d, w * 0.02);
      }
    },
  },
  {
    id: 'moestuinbak', name: 'Moestuinbak', cat: 'Heesters & planten', round: false, w: 1.2, h: 2.4, color: '#8a6a3f',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.18);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath(); g.rect(-w / 2 + lw * 3, -h / 2 + lw * 3, w - lw * 6, h - lw * 6); g.stroke();
      g.globalAlpha = 0.5;
      for (let y = -h / 2 + h / 6; y < h / 2; y += h / 6) {
        for (let x = -w / 2 + w / 4; x < w / 2; x += w / 4) { g.fillStyle = '#5a8f3c'; dot(g, x, y, Math.min(w, h) * 0.04); }
      }
      g.globalAlpha = 1;
    },
  },

  // --- Meubilair ---
  {
    id: 'tafelrond', name: 'Ronde tafel (4)', cat: 'Meubilair', round: true, w: 2.4, h: 2.4, color: '#7a6a58',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      const s = w * 0.2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        chair(g, Math.cos(a) * w * 0.36, Math.sin(a) * h * 0.36, s, a + Math.PI / 2);
      }
      g.fillStyle = hexA(c, 0.25);
      g.beginPath(); g.ellipse(0, 0, w * 0.25, h * 0.25, 0, 0, TAU); g.fill(); g.stroke();
    },
  },
  {
    id: 'tafel6', name: 'Tafel (6)', cat: 'Meubilair', round: false, w: 2.6, h: 2.0, color: '#7a6a58',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      const tw = w * 0.7, th = h * 0.45, s = Math.min(0.5, h * 0.22);
      for (let i = 0; i < 3; i++) {
        const x = -tw / 2 + (tw / 3) * (i + 0.5);
        chair(g, x, -th / 2 - s * 0.7, s, Math.PI);
        chair(g, x, th / 2 + s * 0.7, s, 0);
      }
      g.fillStyle = hexA(c, 0.25);
      g.beginPath(); g.rect(-tw / 2, -th / 2, tw, th); g.fill(); g.stroke();
    },
  },
  {
    id: 'loungebank', name: 'Loungebank', cat: 'Meubilair', round: false, w: 2.6, h: 2.0, color: '#6c7a89',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.25);
      const d = Math.min(w, h) * 0.38;
      g.beginPath();
      g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(w / 2, -h / 2 + d);
      g.lineTo(-w / 2 + d, -h / 2 + d); g.lineTo(-w / 2 + d, h / 2); g.lineTo(-w / 2, h / 2);
      g.closePath(); g.fill(); g.stroke();
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo(-w / 2 + d * 0.3, -h / 2 + d * 0.3); g.lineTo(w / 2, -h / 2 + d * 0.3);
      g.moveTo(-w / 2 + d * 0.3, -h / 2 + d * 0.3); g.lineTo(-w / 2 + d * 0.3, h / 2);
      g.stroke();
    },
  },
  {
    id: 'ligbed', name: 'Ligbed', cat: 'Meubilair', round: false, w: 0.7, h: 2.0, color: '#6c7a89',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.25);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-w / 2, -h / 2 + h * 0.3); g.lineTo(w / 2, -h / 2 + h * 0.3); g.stroke();
    },
  },
  {
    id: 'parasol', name: 'Parasol', cat: 'Meubilair', round: true, w: 3, h: 3, color: '#c27c3a',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * TAU;
        const x = Math.cos(a) * w / 2, y = Math.sin(a) * h / 2;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.fill(); g.stroke();
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 8) * TAU;
        g.moveTo(Math.cos(a) * w / 2, Math.sin(a) * h / 2);
        g.lineTo(-Math.cos(a) * w / 2, -Math.sin(a) * h / 2);
      }
      g.stroke();
    },
  },
  {
    id: 'bbq', name: 'Barbecue', cat: 'Meubilair', round: true, w: 0.6, h: 0.6, color: '#333333',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath();
      for (let i = -2; i <= 2; i++) { g.moveTo(-w * 0.35, i * h * 0.12); g.lineTo(w * 0.35, i * h * 0.12); }
      g.stroke();
    },
  },
  {
    id: 'bank', name: 'Tuinbank', cat: 'Meubilair', round: false, w: 1.8, h: 0.6, color: '#7a6a58',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.2);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h * 0.22); g.stroke();
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-w / 2, -h / 2 + h * 0.22 + i * h * 0.195); g.lineTo(w / 2, -h / 2 + h * 0.22 + i * h * 0.195); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1; }
    },
  },

  // --- Huis: deuren, ramen en puien (bovenaanzicht; h = muurdikte, ze klikken in een muur) ---
  {
    id: 'deur', name: 'Binnendeur', cat: 'Huis: deuren en ramen', opening: true, swing: true, w: 0.93, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) { openingMask(g, w, h, lw, paper); doorLeaf(g, -w / 2, h / 2, w, 1, lw); },
  },
  {
    id: 'buitendeur', name: 'Buitendeur', cat: 'Huis: deuren en ramen', opening: true, swing: true, w: 1.0, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      // dorpel
      g.lineWidth = lw * 0.6;
      g.beginPath(); g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, h / 2); g.stroke();
      doorLeaf(g, -w / 2, h / 2, w, 1, lw);
    },
  },
  {
    id: 'dubbeledeur', name: 'Dubbele deur', cat: 'Huis: deuren en ramen', opening: true, swing: true, w: 1.6, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      doorLeaf(g, -w / 2, h / 2, w / 2, 1, lw);
      doorLeaf(g, w / 2, h / 2, w / 2, -1, lw);
    },
  },
  {
    id: 'openslaand', name: 'Openslaande tuindeuren', cat: 'Huis: deuren en ramen', opening: true, swing: true, w: 1.8, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      glass(g, -w / 2, w / 2, 0, h, lw);
      doorLeaf(g, -w / 2, h / 2, w / 2, 1, lw);
      doorLeaf(g, w / 2, h / 2, w / 2, -1, lw);
    },
  },
  {
    id: 'schuifdeur', name: 'Schuifdeur', cat: 'Huis: deuren en ramen', opening: true, w: 1.0, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      g.lineWidth = lw * 1.6;
      g.beginPath();
      g.moveTo(-w / 2, -h * 0.1); g.lineTo(w * 0.08, -h * 0.1);
      g.moveTo(-w * 0.08, h * 0.1); g.lineTo(w / 2, h * 0.1);
      g.stroke();
      arrow(g, -w * 0.3, w * 0.1, h / 2 + Math.min(0.15, w * 0.12), lw);
    },
  },
  {
    id: 'raam', name: 'Raam', cat: 'Huis: deuren en ramen', opening: true, w: 1.2, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2);
      g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, h / 2);
      g.stroke();
      glass(g, -w / 2, w / 2, 0, h, lw);
    },
  },
  {
    id: 'schuifpui', name: 'Schuifpui', cat: 'Huis: deuren en ramen', opening: true, w: 3.0, h: 0.3, color: '#2f2f2f',
    draw(g, w, h, c, lw, paper) {
      openingMask(g, w, h, lw, paper);
      glass(g, -w / 2, w * 0.04, -h * 0.12, h, lw);
      glass(g, -w * 0.04, w / 2, h * 0.12, h, lw);
      arrow(g, w * 0.05, w * 0.35, h / 2 + Math.min(0.18, w * 0.06), lw);
    },
  },

  // --- Bouw & water ---
  {
    id: 'schuur', name: 'Schuur / berging', cat: 'Bouw & water', round: false, w: 3, h: 2.5, color: '#6b4f3a',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.15);
      g.lineWidth = lw * 1.6;
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.lineWidth = lw * 0.6;
      g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, h / 2); g.moveTo(w / 2, -h / 2); g.lineTo(-w / 2, h / 2); g.stroke();
    },
  },
  {
    id: 'overkapping', name: 'Overkapping / pergola', cat: 'Bouw & water', round: false, w: 4, h: 3, color: '#7a6a58',
    draw(g, w, h, c, lw) {
      g.setLineDash([lw * 5, lw * 3]);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.stroke();
      g.setLineDash([]);
      g.fillStyle = c;
      const s = Math.min(0.15, w * 0.05);
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.fillRect(x * (w / 2 - s) - s / 2, y * (h / 2 - s) - s / 2, s, s);
      }
      g.globalAlpha = 0.5;
      for (let x = -w / 2 + w / 8; x < w / 2; x += w / 8) { g.beginPath(); g.moveTo(x, -h / 2); g.lineTo(x, h / 2); g.stroke(); }
      g.globalAlpha = 1;
    },
  },
  {
    id: 'kas', name: 'Kas', cat: 'Bouw & water', round: false, w: 2.5, h: 3, color: '#4a7c8c',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.12);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath();
      for (let x = -w / 2 + w / 4; x < w / 2 - 1e-6; x += w / 4) { g.moveTo(x, -h / 2); g.lineTo(x, h / 2); }
      g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0);
      g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
    },
  },
  {
    id: 'vijver', name: 'Vijver', cat: 'Bouw & water', round: true, w: 3, h: 2, color: '#3d7fb5',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.25);
      blob(g, w / 2, h / 2, 13, 9, 0.15);
      g.fill(); g.stroke();
      g.lineWidth = lw * 0.6;
      g.globalAlpha = 0.6;
      for (let i = -1; i <= 1; i++) {
        const y = i * h * 0.15, x = i * w * 0.05;
        g.beginPath();
        g.moveTo(x - w * 0.15, y);
        g.quadraticCurveTo(x - w * 0.075, y - h * 0.05, x, y);
        g.quadraticCurveTo(x + w * 0.075, y + h * 0.05, x + w * 0.15, y);
        g.stroke();
      }
      g.globalAlpha = 1;
    },
  },
  {
    id: 'trampoline', name: 'Trampoline', cat: 'Bouw & water', round: true, w: 3.66, h: 3.66, color: '#2c3e50',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.12);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, w * 0.42, h * 0.42, 0, 0, TAU); g.stroke();
    },
  },
  {
    id: 'zandbak', name: 'Zandbak', cat: 'Bouw & water', round: false, w: 1.5, h: 1.5, color: '#c9a65a',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.3);
      g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
      g.beginPath(); g.rect(-w / 2 + lw * 4, -h / 2 + lw * 4, w - lw * 8, h - lw * 8); g.stroke();
    },
  },
  {
    id: 'regenton', name: 'Regenton', cat: 'Bouw & water', round: true, w: 0.6, h: 0.6, color: '#3d7fb5',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.3);
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, w * 0.3, h * 0.3, 0, 0, TAU); g.stroke();
    },
  },
  {
    id: 'stapsteen', name: 'Stapsteen', cat: 'Bouw & water', round: true, w: 0.5, h: 0.4, color: '#8c8c8c',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.35);
      blob(g, w / 2, h / 2, 23, 7, 0.12);
      g.fill(); g.stroke();
    },
  },
  {
    id: 'auto', name: 'Auto', cat: 'Bouw & water', round: false, w: 1.8, h: 4.5, color: '#555555',
    draw(g, w, h, c, lw) {
      g.fillStyle = hexA(c, 0.12);
      const r = w * 0.25;
      g.beginPath();
      g.moveTo(-w / 2 + r, -h / 2); g.lineTo(w / 2 - r, -h / 2); g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      g.lineTo(w / 2, h / 2 - r); g.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      g.lineTo(-w / 2 + r, h / 2); g.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      g.lineTo(-w / 2, -h / 2 + r); g.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      g.fill(); g.stroke();
      g.lineWidth = lw * 0.7;
      g.beginPath(); g.rect(-w * 0.38, -h * 0.22, w * 0.76, h * 0.5); g.stroke();
    },
  },

  // --- Overig ---
  {
    id: 'noordpijl', name: 'Noordpijl', cat: 'Overig', round: true, w: 2, h: 2, color: '#222222', fixedPaper: true,
    draw(g, w, h, c, lw) {
      g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); g.stroke();
      g.fillStyle = c;
      g.beginPath(); g.moveTo(0, -h * 0.45); g.lineTo(w * 0.16, h * 0.25); g.lineTo(0, h * 0.12); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, -h * 0.45); g.lineTo(-w * 0.16, h * 0.25); g.lineTo(0, h * 0.12); g.closePath(); g.stroke();
      g.save();
      g.translate(0, -h * 0.62);
      const s = h * 0.003;
      g.scale(s, s);
      g.font = 'bold 60px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('N', 0, 0);
      g.restore();
    },
  },
  {
    id: 'persoon', name: 'Persoon (schaal)', cat: 'Overig', round: true, w: 0.6, h: 0.6, color: '#444444',
    draw(g, w, h, c) {
      g.fillStyle = hexA(c, 0.15);
      g.beginPath(); g.ellipse(0, 0, w / 2, h * 0.3, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, w * 0.2, h * 0.2, 0, 0, TAU); g.fill(); g.stroke();
    },
  },
];

export const STENCIL_MAP = Object.fromEntries(STENCILS.map((s) => [s.id, s]));

// ---- hulpjes voor deuren en ramen

/** Muur ter plekke van de opening wegvlakken (papierkleur) en de dagkanten tekenen. */
function openingMask(g, w, h, lw, paper) {
  g.save();
  g.fillStyle = paper || '#fbfaf6';
  g.fillRect(-w / 2, -h / 2 - lw, w, h + lw * 2);
  g.lineWidth = lw * 1.4;
  g.beginPath();
  g.moveTo(-w / 2, -h / 2); g.lineTo(-w / 2, h / 2);
  g.moveTo(w / 2, -h / 2); g.lineTo(w / 2, h / 2);
  g.stroke();
  g.restore();
}

/** Deurblad met draaicirkel: scharnier (hx, hy), breedte r, dir +1 = draait naar rechts open. */
function doorLeaf(g, hx, hy, r, dir, lw) {
  g.save();
  g.lineWidth = lw * 1.3;
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx, hy + r); g.stroke();
  g.lineWidth = lw * 0.6;
  g.beginPath();
  if (dir > 0) g.arc(hx, hy, r, 0, Math.PI / 2);
  else g.arc(hx, hy, r, Math.PI / 2, Math.PI);
  g.stroke();
  g.restore();
}

/** Glas: dubbele dunne lijn over de opening. */
function glass(g, x0, x1, y, h, lw) {
  const d = Math.min(h * 0.08, 0.025);
  g.save();
  g.lineWidth = lw * 0.6;
  g.beginPath();
  g.moveTo(x0, y - d); g.lineTo(x1, y - d);
  g.moveTo(x0, y + d); g.lineTo(x1, y + d);
  g.stroke();
  g.restore();
}

function arrow(g, x0, x1, y, lw) {
  const k = Math.abs(x1 - x0) * 0.18;
  g.save();
  g.lineWidth = lw * 0.6;
  g.beginPath();
  g.moveTo(x0, y); g.lineTo(x1, y);
  g.moveTo(x1 - k, y - k * 0.6); g.lineTo(x1, y); g.lineTo(x1 - k, y + k * 0.6);
  g.stroke();
  g.restore();
}

/** Teken een stencil-item (wereldcoördinaten). paper: achtergrondkleur (voor openingen in muren). */
export function drawStencil(g, item, lw, paper) {
  const def = STENCIL_MAP[item.symbol];
  if (!def) return;
  g.save();
  g.translate(item.x, item.y);
  g.rotate(item.rot || 0);
  if (item.mirror) g.scale(-1, 1);
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const c = item.color || def.color;
  if (!item.see && !def.opening && !def.fixedPaper) {
    // dichte ondergrond in papierkleur: een stencil ligt bovenop wat eronder getekend is
    g.fillStyle = paper || '#fbfaf6';
    g.beginPath();
    if (def.round) g.ellipse(0, 0, item.w / 2, item.h / 2, 0, 0, Math.PI * 2);
    else g.rect(-item.w / 2, -item.h / 2, item.w, item.h);
    g.fill();
  }
  g.strokeStyle = c;
  g.fillStyle = c;
  def.draw(g, item.w, item.h, c, lw, paper);
  g.restore();
}
