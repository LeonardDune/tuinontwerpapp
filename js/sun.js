// Zonnestand (NOAA-algoritme). Werkt offline; nauwkeurig tot ruim binnen een graad.

const RAD = Math.PI / 180;

/**
 * Positie van de zon op een tijdstip.
 * @returns {{ azimuth: number, altitude: number }} graden; azimut vanaf het noorden met de klok mee.
 */
export function sunPosition(date, lat, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T)
    + Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime = 4 / RAD * (
    y * Math.sin(2 * L0 * RAD)
    - 2 * e * Math.sin(M * RAD)
    + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD)
    - 1.25 * e * e * Math.sin(2 * M * RAD)
  );
  const minutesUTC = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolar = mod(minutesUTC + eqTime + 4 * lon, 1440);
  const ha = (trueSolar / 4 - 180) * RAD;
  const phi = lat * RAD;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  let altitude = 90 - zenith / RAD;
  altitude += refraction(altitude);
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / RAD + 180;
  return { azimuth: mod(az, 360), altitude };
}

/** Atmosferische breking (graden), zodat op- en ondergang kloppen. */
function refraction(alt) {
  if (alt > 85 || alt < -2) return 0;
  return 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * RAD) / 60;
}

function mod(a, n) {
  return ((a % n) + n) % n;
}

/** Lokaal tijdstip op een dag: ymd = 'JJJJ-MM-DD', minutes vanaf middernacht (tijdzone van het apparaat). */
export function localDate(ymd, minutes) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), Math.round(minutes % 60));
}

/** Zonsopkomst, -ondergang en hoogste stand (minuten lokale tijd). */
export function sunTimes(ymd, lat, lon) {
  let rise = null, set = null, noon = 0, maxAlt = -90;
  let prev = sunPosition(localDate(ymd, 0), lat, lon).altitude;
  for (let m = 5; m <= 1440; m += 5) {
    const alt = sunPosition(localDate(ymd, m), lat, lon).altitude;
    if (prev <= 0 && alt > 0 && rise === null) rise = m - 5 + (5 * -prev) / (alt - prev);
    if (prev > 0 && alt <= 0) set = m - 5 + (5 * prev) / (prev - alt);
    if (alt > maxAlt) { maxAlt = alt; noon = m; }
    prev = alt;
  }
  return { rise, set, noon, maxAlt };
}

/** Zonnebaan over een dag: lijst van { minutes, azimuth, altitude } boven de horizon. */
export function dayPath(ymd, lat, lon, step = 10) {
  const out = [];
  for (let m = 0; m <= 1440; m += step) {
    const p = sunPosition(localDate(ymd, m), lat, lon);
    if (p.altitude > 0) out.push({ minutes: m, ...p });
  }
  return out;
}

const DIRS = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];

export function compassName(azimuth) {
  return DIRS[Math.round(mod(azimuth, 360) / 45) % 8];
}

export function formatClock(minutes) {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
