// Opmaak van maten afhankelijk van de tekenschaal.

export const SCALES = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000, 2000, 2500, 5000];

/** Afrondingsstap (meters) die past bij de tekenschaal. */
export function lengthStep(scale) {
  if (scale <= 20) return 0.001;
  if (scale <= 50) return 0.005;
  if (scale <= 200) return 0.01;
  if (scale <= 500) return 0.05;
  return 0.1;
}

function nl(v, decimals) {
  return v.toLocaleString('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatLength(m, scale = 100) {
  const step = lengthStep(scale);
  const v = Math.round(m / step) * step;
  const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : 1;
  if (Math.abs(v) < 1 && step < 0.1) {
    const cm = v * 100;
    const cmDec = step < 0.01 ? 1 : 0;
    return `${nl(cm, cmDec)} cm`;
  }
  return `${nl(v, decimals)} m`;
}

export function formatArea(m2) {
  if (m2 < 10) return `${nl(m2, 2)} m²`;
  if (m2 < 1000) return `${nl(m2, 1)} m²`;
  return `${nl(m2, 0)} m²`;
}

export function formatAngle(rad) {
  let deg = (rad * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return `${nl(Math.round(deg * 10) / 10, deg % 1 === 0 ? 0 : 1)}°`;
}

/** Een "mooie" waarde (1, 2, 5 × 10^n) groter of gelijk aan v. */
export function niceStep(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  if (f <= 1) return p;
  if (f <= 2) return 2 * p;
  if (f <= 5) return 5 * p;
  return 10 * p;
}

/** Lengte voor labels zonder schaal-afronding (schaalbalk, liniaal). */
export function formatTick(m) {
  if (m === 0) return '0';
  if (m < 1) {
    const cm = m * 100;
    return `${nl(cm, cm < 1 ? 1 : 0)} cm`;
  }
  if (m >= 1000) return `${nl(m / 1000, m % 1000 === 0 ? 0 : 1)} km`;
  return `${nl(m, m % 1 === 0 ? 0 : 1)} m`;
}

/** Leest een door de gebruiker getypte lengte ("3,5", "350 cm", "3.5m"). */
export function parseLength(str) {
  if (str == null) return NaN;
  const s = String(str).trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(-?\d*\.?\d+)\s*(mm|cm|m|km)?$/);
  if (!m) return NaN;
  const v = parseFloat(m[1]);
  switch (m[2]) {
    case 'mm': return v / 1000;
    case 'cm': return v / 100;
    case 'km': return v * 1000;
    default: return v;
  }
}
