// Tekenhulpmiddelen: super-liniaal, tekendriehoek en gradenboog.
// Ze liggen vast op de tekening (positie en richting in meters), dus bij zoomen, verschuiven en
// draaien blijft de tekenrand exact op dezelfde plek ten opzichte van de tekening:
//   liniaal:    één tekenrand die over het hele scherm doorloopt (oorsprong = nulpunt van de maat);
//   driehoek:   de rechte hoek ligt vast, de rechthoekszijden blijven dus op hun plek;
//   gradenboog: middelpunt en straal in meters.
// Een streek die bij een rand begint, wordt exact langs die rand getrokken.

import { rotate, pointInPolygon, distToSegment, projectOnLine, dist, DEG, normAngle, sideOf } from './geom.js';
import { niceStep, formatTick, formatAngle, formatLength } from './units.js';

export const GUIDE_TYPES = {
  ruler: 'Liniaal',
  tri45: 'Driehoek',
  protractor: 'Gradenboog',
};

const SNAP_PX = 26;
const view = { w: 1200, h: 800 };

/** Afmetingen van het tekenvlak (CSS-px), voor de doorlopende liniaal. */
export function setGuideView(w, h) {
  view.w = w;
  view.h = h;
}
const GRIP_R = 18;

export class Guide {
  constructor(type, x, y, rot = 0, params = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.rot = rot;
    // driehoek: scherpe hoek (graden) en grootte (px); gradenboog: straal in meters
    this.angle = params.angle ?? (type === 'tri30' ? 30 : 45);
    this.size = params.size ?? (type === 'tri45' ? 330 : 380);
    this.worldR = params.worldR ?? null;
    this.zoom = null;
    this.world = null; // { p: [x, y] in meters, rot: hoek t.o.v. de tekening }
    this.last = null;
    this.t0 = -380;
    this.t1 = 380;
    this.build();
  }

  /**
   * Breng de schermpositie in lijn met de camera. Is het hulpmiddel sinds de vorige keer op het
   * scherm verplaatst (slepen, draaien, invoer), dan wordt eerst de plek op de tekening bijgewerkt.
   */
  sync(cam) {
    if (this.type === 'protractor' && this.worldR == null) this.worldR = niceStep(480 / cam.zoom) / 2;
    const l = this.last;
    if (!this.world || !l || l.x !== this.x || l.y !== this.y || l.rot !== this.rot) {
      this.world = { p: cam.toWorld([this.x, this.y]), rot: this.rot - cam.rot };
    }
    const q = cam.toScreen(this.world.p);
    this.x = q[0];
    this.y = q[1];
    this.rot = this.world.rot + cam.rot;
    this.last = { x: this.x, y: this.y, rot: this.rot };
    let rebuild = false;
    if (this.type === 'protractor' && this.zoom !== cam.zoom) {
      this.zoom = cam.zoom;
      rebuild = true;
    }
    if (this.type === 'ruler') {
      const [t0, t1] = this.visibleRange();
      if (Math.abs(t0 - this.t0) > 0.5 || Math.abs(t1 - this.t1) > 0.5) {
        this.t0 = t0;
        this.t1 = t1;
        rebuild = true;
      }
    }
    if (rebuild) this.build();
  }

  /** Deel van de (oneindige) liniaallijn dat in beeld is, als lokale x van/tot. */
  visibleRange() {
    const c = Math.cos(this.rot), sn = Math.sin(this.rot);
    const m = this.H + 40;
    let lo = -Infinity, hi = Infinity;
    const clip = (p0, d, min, max) => {
      if (Math.abs(d) < 1e-9) return p0 >= min && p0 <= max;
      let a = (min - p0) / d, b = (max - p0) / d;
      if (a > b) [a, b] = [b, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
      return true;
    };
    const ok = clip(this.x, c, -m, view.w + m) && clip(this.y, sn, -m, view.h + m);
    if (!ok || hi - lo < 200) return [-380, 380];
    return [lo, hi];
  }

  build() {
    switch (this.type) {
      case 'ruler': {
        // tekenrand op lokale y = 0 (door de oorsprong), het lichaam erboven; loopt door over het scherm
        const H = 68;
        const t0 = this.t0, t1 = this.t1;
        this.H = H;
        this.L = t1 - t0;
        this.poly = [[t0, -H], [t1, -H], [t1, 0], [t0, 0]];
        this.edges = [[[t0, 0], [t1, 0]]];
        // grepen binnen beeld (het zichtbare deel loopt H + 40 px voorbij de schermrand)
        const g0 = Math.min(t0 + H + 90, (t0 + t1) / 2 - 40), g1 = Math.max(t1 - H - 90, (t0 + t1) / 2 + 40);
        this.grips = { rotate: [[g0, -H / 2], [g1, -H / 2]], resize: [] };
        break;
      }
      case 'tri45':
      case 'tri30': {
        // Rechte hoek linksonder, scherpe hoek this.angle rechtsonder.
        const a = Math.min(85, Math.max(5, this.angle)) * DEG;
        const S = this.size;
        const t = Math.tan(a);
        const w = t <= 1 ? S : S / t;
        const h = t <= 1 ? S * t : S;
        // oorsprong = de rechte hoek (ligt vast op de tekening)
        this.poly = [[0, 0], [w, 0], [0, -h]];
        const c = [w / 3, -h / 3];
        this.edges = [[this.poly[0], this.poly[1]], [this.poly[1], this.poly[2]], [this.poly[2], this.poly[0]]];
        const k = 0.45;
        this.hole = Math.min(w, h) > 120 ? this.poly.map((p) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]) : null;
        this.center = c;
        const g = Math.min(34, Math.min(w, h) * 0.18);
        this.grips = {
          rotate: [[this.poly[0][0] + g + 4, this.poly[0][1] - g - 4]],
          resize: [[this.poly[1][0] - 46, this.poly[1][1] - 13]],
          angle: [this.poly[2]], // bovenste punt verslepen = hoek aanpassen
        };
        break;
      }
      case 'protractor': {
        const R = this.worldR != null && this.zoom ? this.worldR * this.zoom : 240;
        this.R = R;
        this.poly = [];
        for (let i = 0; i <= 60; i++) {
          const a = Math.PI * (i / 60);
          this.poly.push([Math.cos(a) * R, -Math.sin(a) * R]);
        }
        this.edges = [[[-R, 0], [R, 0]]];
        this.grips = {
          rotate: [[R < 140 ? -R * 0.45 : 0, R < 140 ? -R * 0.35 : -R * 0.42]],
          resize: [R < 140 ? [R * 0.45, -R * 0.35] : rotate([R - 30, 0], -18 * DEG)],
        };
        break;
      }
    }
  }

  toScreen(p) {
    const q = rotate(p, this.rot);
    return [q[0] + this.x, q[1] + this.y];
  }

  toLocal(p) {
    return rotate([p[0] - this.x, p[1] - this.y], -this.rot);
  }

  /** Ligt (een deel van) het hulpmiddel in beeld? */
  isVisible() {
    const pts = this.screenPoly();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return Math.max(...xs) > 0 && Math.min(...xs) < view.w && Math.max(...ys) > 0 && Math.min(...ys) < view.h;
  }

  screenPoly() {
    return this.poly.map((p) => this.toScreen(p));
  }

  /** Hoek ten opzichte van de tekening (graden tegen de klok in). */
  worldAngle(cam) {
    return -(this.rot - cam.rot);
  }

  /** Alleen de grepen (gaan vóór het tekenen langs een rand). */
  gripAt(p) {
    const l = this.toLocal(p);
    for (const g of this.grips.rotate) if (dist(l, g) <= GRIP_R + 6) return 'rotate';
    for (const g of this.grips.resize) if (dist(l, g) <= GRIP_R + 6) return 'resize';
    for (const g of this.grips.angle || []) if (dist(l, g) <= GRIP_R + 8) return 'angle';
    return null;
  }

  hit(p) {
    const grip = this.gripAt(p);
    if (grip) return grip;
    if (pointInPolygon(this.toLocal(p), this.poly)) return 'move';
    return null;
  }

  /**
   * Zoek een rand om langs te tekenen. Geeft een snap-object of null.
   * anywhereInside: ook bij een begin midden óp het hulpmiddel de dichtstbijzijnde rand kiezen
   * (tekenmodus, waarin hulpmiddelen vastliggen).
   */
  snapAt(p, anywhereInside = false) {
    const l = this.toLocal(p);
    const inside = pointInPolygon(l, this.poly);
    const free = anywhereInside && inside;
    if (this.type === 'protractor') {
      const d = dist(l, [0, 0]);
      const centerD = d, arcD = Math.abs(d - this.R), diamD = Math.abs(l[1]);
      if (free) {
        // dichtstbijzijnde van middelpunt, boog en rechte rand
        if (centerD < Math.min(SNAP_PX * 1.5, arcD, diamD)) return new RaySnap(this);
        return arcD <= diamD ? new ArcSnap(this) : new LineSnap(this, this.edges[0][0], this.edges[0][1]);
      }
      if (centerD < SNAP_PX) return new RaySnap(this);
      if (arcD < SNAP_PX && l[1] < SNAP_PX * 0.5) return new ArcSnap(this);
    }
    let best = null, bestD = free ? Infinity : SNAP_PX;
    for (const [a, b] of this.edges) {
      const dd = distToSegment(l, a, b);
      if (dd < bestD && (free || !inside || dd < 14)) {
        bestD = dd;
        best = [a, b];
      }
    }
    if (best) return new LineSnap(this, best[0], best[1]);
    return null;
  }

  draw(ctx, cam, dpr, active, locked = false) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    // lichaam
    ctx.beginPath();
    this.poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    if (this.hole) {
      [...this.hole].reverse().forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    }
    ctx.fillStyle = active ? 'rgba(214, 233, 245, 0.72)' : 'rgba(225, 238, 246, 0.62)';
    ctx.fill('evenodd');
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(40, 80, 110, 0.75)';
    ctx.stroke();

    ctx.fillStyle = '#1f3d52';
    ctx.strokeStyle = 'rgba(31, 61, 82, 0.85)';
    ctx.font = '11px system-ui, -apple-system, sans-serif';

    if (this.type === 'ruler') this.drawRulerTicks(ctx, cam);
    if (this.type === 'tri45' || this.type === 'tri30') this.drawTriangleTicks(ctx, cam);
    if (this.type === 'protractor') this.drawProtractorTicks(ctx);

    // grepen (alleen in de verplaatsmodus)
    const grips = locked ? { rotate: [], resize: [], angle: [] } : this.grips;
    for (const g of grips.rotate) {
      ctx.beginPath();
      ctx.arc(g[0], g[1], GRIP_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 80, 110, 0.6)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(g[0], g[1], 8, -Math.PI * 0.9, Math.PI * 0.4);
      ctx.stroke();
      const ex = g[0] + Math.cos(Math.PI * 0.4) * 8, ey = g[1] + Math.sin(Math.PI * 0.4) * 8;
      ctx.beginPath();
      ctx.moveTo(ex - 4, ey - 1); ctx.lineTo(ex, ey); ctx.lineTo(ex + 1, ey - 4);
      ctx.stroke();
    }

    for (const g of grips.resize) {
      ctx.beginPath();
      ctx.arc(g[0], g[1], GRIP_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 80, 110, 0.6)';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g[0] - 6, g[1] + 6); ctx.lineTo(g[0] + 6, g[1] - 6);
      ctx.moveTo(g[0] + 1, g[1] - 6); ctx.lineTo(g[0] + 6, g[1] - 6); ctx.lineTo(g[0] + 6, g[1] - 1);
      ctx.moveTo(g[0] - 1, g[1] + 6); ctx.lineTo(g[0] - 6, g[1] + 6); ctx.lineTo(g[0] - 6, g[1] + 1);
      ctx.stroke();
    }

    for (const g of grips.angle || []) {
      ctx.beginPath();
      ctx.arc(g[0], g[1], 9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(40, 80, 110, 0.85)';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g[0], g[1] - 4); ctx.lineTo(g[0], g[1] + 4);
      ctx.moveTo(g[0] - 2.5, g[1] - 1.5); ctx.lineTo(g[0], g[1] - 4); ctx.lineTo(g[0] + 2.5, g[1] - 1.5);
      ctx.moveTo(g[0] - 2.5, g[1] + 1.5); ctx.lineTo(g[0], g[1] + 4); ctx.lineTo(g[0] + 2.5, g[1] + 1.5);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (this.type === 'tri45' || this.type === 'tri30') {
      // scherpe hoek bij het rechter hoekpunt
      const v = this.poly[1];
      ctx.fillStyle = '#1f3d52';
      ctx.font = '600 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${Math.round(this.angle * 10) / 10}°`.replace('.', ','), v[0] - 70, v[1] - 4);
    }

    // hoekaanduiding
    ctx.rotate(-this.rot);
    const label = formatAngle(this.worldAngle(cam));
    let pos = [0, 0];
    if (this.type === 'protractor') {
      pos = rotate([0, -this.R * 0.2], this.rot);
      if (cam && this.worldR) {
        const dpos = rotate([0, this.R < 140 ? -this.R * 0.62 - 6 : -this.R * 0.62], this.rot);
        ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1f3d52';
        ctx.fillText(`Ø ${formatLength(this.worldR * 2, 100)}`, dpos[0], dpos[1]);
      }
    }
    if (this.type === 'tri45' || this.type === 'tri30') pos = rotate(this.center, this.rot);
    if (this.type === 'ruler') pos = rotate([(this.t0 + this.t1) / 2, -this.H + 15], this.rot);
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = 'rgba(31, 61, 82, 0.88)';
    roundRect(ctx, pos[0] - w / 2, pos[1] - 11, w, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, pos[0], pos[1] + 1);
    ctx.restore();
  }

  drawRulerTicks(ctx, cam) {
    // maatverdeling langs de tekenrand, gemeten vanaf de oorsprong (nulpunt) naar beide kanten
    const z = cam.zoom;
    const minor = niceStep(7 / z);
    const labelStep = niceStep(70 / z);
    const i0 = Math.ceil(this.t0 / z / minor), i1 = Math.floor(this.t1 / z / minor);
    if (i1 - i0 > 4000) return;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const m = i * minor;
      const x = m * z;
      const isLabel = Math.abs(m / labelStep - Math.round(m / labelStep)) < 1e-6;
      const isHalf = Math.abs((m * 2) / labelStep - Math.round((m * 2) / labelStep)) < 1e-6;
      const len = i === 0 ? 30 : isLabel ? 16 : isHalf ? 11 : 6;
      ctx.moveTo(x, 0); ctx.lineTo(x, -len);
    }
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const j0 = Math.ceil(this.t0 / z / labelStep), j1 = Math.floor(this.t1 / z / labelStep);
    for (let j = j0; j <= j1; j++) {
      const x = j * labelStep * z;
      if (x < this.t0 + 30 || x > this.t1 - 30) continue;
      ctx.fillText(formatTick(Math.abs(j * labelStep)), x, -19);
    }
  }

  drawTriangleTicks(ctx, cam) {
    const [a, b] = this.edges[0];
    const minor = niceStep(7 / cam.zoom);
    const labelStep = niceStep(70 / cam.zoom);
    const total = (b[0] - a[0]) / cam.zoom;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let m = 0; m <= total + 1e-9; m += minor) {
      const x = a[0] + m * cam.zoom;
      const isLabel = Math.abs(m / labelStep - Math.round(m / labelStep)) < 1e-6;
      ctx.moveTo(x, a[1]); ctx.lineTo(x, a[1] - (isLabel ? 12 : 6));
    }
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let m = labelStep; m <= total - labelStep * 0.5; m += labelStep) {
      ctx.fillText(formatTick(m), a[0] + m * cam.zoom, a[1] - 14);
    }
  }

  drawProtractorTicks(ctx) {
    const R = this.R;
    // verdeling afstemmen op de grootte, zodat cijfers niet overlappen
    const minor = R >= 170 ? 1 : R >= 90 ? 5 : 10;
    const labelStep = R >= 200 ? 10 : R >= 120 ? 30 : R >= 70 ? 90 : 0;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let d = 0; d <= 180; d += minor) {
      const a = d * DEG;
      const len = Math.min(R * 0.12, d % 10 === 0 ? 18 : d % 5 === 0 ? 12 : 6);
      const c = Math.cos(a), s = -Math.sin(a);
      ctx.moveTo(c * R, s * R);
      ctx.lineTo(c * (R - len), s * (R - len));
    }
    ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
    ctx.moveTo(0, 0); ctx.lineTo(0, -12);
    ctx.stroke();
    if (labelStep) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let d = 0; d <= 180; d += labelStep) {
        const a = d * DEG;
        ctx.save();
        ctx.translate(Math.cos(a) * (R - 30), -Math.sin(a) * (R - 30));
        ctx.rotate(Math.PI / 2 - a);
        ctx.fillText(String(d), 0, 0);
        ctx.restore();
      }
    }
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  toJSON() {
    return { type: this.type, x: this.x, y: this.y, rot: this.rot, angle: this.angle, size: this.size, worldR: this.worldR };
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------------------------------------------------- snappers
// Werken in schermcoördinaten. project(p) geeft het geprojecteerde punt.

class LineSnap {
  constructor(guide, a, b) {
    this.kind = 'line';
    this.guide = guide;
    this.la = a;
    this.lb = b;
    this.a = guide.toScreen(a);
    this.b = guide.toScreen(b);
  }

  project(p) {
    return projectOnLine(p, this.a, this.b)[0];
  }

  /** Kant van de lijn waar de liniaal NIET ligt (voor maatlabels). +1/-1 in scherm. */
  freeSide() {
    const c = [this.guide.x, this.guide.y];
    return -sideOf(c, this.a, this.b);
  }
}

class ArcSnap {
  constructor(guide) {
    this.kind = 'arc';
    this.guide = guide;
  }

  project(p) {
    const c = [this.guide.x, this.guide.y];
    const d = dist(p, c) || 1;
    const R = this.guide.R;
    return [c[0] + ((p[0] - c[0]) / d) * R, c[1] + ((p[1] - c[1]) / d) * R];
  }
}

class RaySnap {
  constructor(guide) {
    this.kind = 'ray';
    this.guide = guide;
    this.angle = null;
  }

  get center() {
    return [this.guide.x, this.guide.y];
  }

  project(p) {
    const c = this.center;
    const d = dist(p, c);
    if (this.angle === null) {
      if (d < 18) return c;
      // hoek ten opzichte van de gradenboog, afgerond op hele graden
      const local = normAngle(Math.atan2(p[1] - c[1], p[0] - c[0]) - this.guide.rot);
      this.angle = Math.round(local / DEG) * DEG + this.guide.rot;
    }
    const dir = [Math.cos(this.angle), Math.sin(this.angle)];
    const t = Math.max(0, (p[0] - c[0]) * dir[0] + (p[1] - c[1]) * dir[1]);
    return [c[0] + dir[0] * t, c[1] + dir[1] * t];
  }

  /** Hoek als graden op de gradenboog (0..360). */
  degrees() {
    if (this.angle === null) return null;
    return -(this.angle - this.guide.rot);
  }
}
