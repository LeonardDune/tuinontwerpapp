// Camera: wereld (meters) -> scherm (CSS-pixels).
// scherm = translate(x, y) · rotate(rot) · scale(zoom) · wereld

import { matApply, matMul, matRotate, matScale, matTranslate, clamp } from './geom.js';

export const MIN_ZOOM = 0.5; // px per meter
export const MAX_ZOOM = 20000;

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 40;
    this.rot = 0;
  }

  matrix() {
    return matMul(matTranslate(this.x, this.y), matMul(matRotate(this.rot), matScale(this.zoom)));
  }

  inverse() {
    const c = Math.cos(-this.rot), s = Math.sin(-this.rot);
    const iz = 1 / this.zoom;
    // wereld = (1/zoom) · rotate(-rot) · (scherm - t)
    return [c * iz, s * iz, -s * iz, c * iz,
      -(c * this.x - s * this.y) * iz, -(s * this.x + c * this.y) * iz];
  }

  toScreen(p) {
    return matApply(this.matrix(), p);
  }

  toWorld(p) {
    return matApply(this.inverse(), p);
  }

  /** Zet canvas-transform voor tekenen in wereldcoördinaten. */
  apply(ctx, dpr = 1) {
    const m = this.matrix();
    ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, m[5] * dpr);
  }

  zoomAt(sx, sy, factor) {
    const w = this.toWorld([sx, sy]);
    this.zoom = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const s = this.toScreen(w);
    this.x += sx - s[0];
    this.y += sy - s[1];
  }

  rotateAt(sx, sy, delta) {
    const w = this.toWorld([sx, sy]);
    this.rot += delta;
    const s = this.toScreen(w);
    this.x += sx - s[0];
    this.y += sy - s[1];
  }

  /**
   * Plaats de camera zo dat wereldpunten A en B onder schermpunten a en b liggen
   * (gebruikt voor knijpen/draaien met twee vingers).
   */
  fitTwoPoints(A, B, a, b, allowRotate) {
    const wd = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const sd = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (wd < 1e-9 || sd < 1e-6) return;
    this.zoom = clamp(sd / wd, MIN_ZOOM, MAX_ZOOM);
    if (allowRotate) {
      this.rot = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.atan2(B[1] - A[1], B[0] - A[0]);
    }
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const smid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    this.x = 0;
    this.y = 0;
    const s = this.toScreen(mid);
    this.x = smid[0] - s[0];
    this.y = smid[1] - s[1];
  }

  /** Laat een wereldkader passend in een schermrechthoek zien. */
  fitBox(box, width, height, padding = 40) {
    const bw = Math.max(box.maxX - box.minX, 1e-3);
    const bh = Math.max(box.maxY - box.minY, 1e-3);
    this.rot = 0;
    this.zoom = clamp(Math.min((width - padding * 2) / bw, (height - padding * 2) / bh), MIN_ZOOM, MAX_ZOOM);
    this.x = width / 2 - ((box.minX + box.maxX) / 2) * this.zoom;
    this.y = height / 2 - ((box.minY + box.maxY) / 2) * this.zoom;
  }

  toJSON() {
    return { x: this.x, y: this.y, zoom: this.zoom, rot: this.rot };
  }

  set(v) {
    if (!v) return;
    this.x = v.x;
    this.y = v.y;
    this.zoom = v.zoom;
    this.rot = v.rot || 0;
  }
}
