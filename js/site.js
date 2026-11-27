// Standplaats van een plantvak: zon (4 klassen naar Elisabeth Scholt), vocht, grondsoort, zuurgraad en ligging.
// Eén plek voor de regels, zodat samenstellen, wensen, plant kiezen en de controle hetzelfde zeggen.

/** Zon naar het aantal uren direct zonlicht per dag (Scholt: schaduw ≤ 2, halfschaduw 2–4, halfzon 4–6, zon ≥ 6). */
export const LIGHTS = {
  zon: 'Zon (6 uur of meer)',
  halfzon: 'Halfzon (4 tot 6 uur)',
  half: 'Halfschaduw (2 tot 4 uur)',
  schaduw: 'Schaduw (2 uur of minder)',
};
export const MOISTURES = { droog: 'Droog', normaal: 'Normaal (vochthoudend)', vochtig: 'Vochtig' };
export const SOIL_TYPES = { zand: 'Zand', klei: 'Klei', zavel: 'Zavel (lichte klei)', leem: 'Leem of löss', veen: 'Veen', humus: 'Humusrijke tuingrond' };
export const PH = { zuur: 'Zuur', neutraal: 'Neutraal', kalk: 'Kalkrijk' };
export const EXPOSURE = { beschut: 'Beschut', open: 'Open', winderig: 'Winderig', kust: 'Aan de kust (zeewind)' };

/** Zonklasse bij een aantal zonuren per dag. */
export function lightFromHours(h) {
  return h >= 6 ? 'zon' : h >= 4 ? 'halfzon' : h > 2 ? 'half' : 'schaduw';
}

/** Kan een plant (lichtwensen in de termen van de database: zon, half, schaduw) op deze plek staan? */
export function lightFits(plantLights, bedLight) {
  if (!bedLight || !plantLights?.length) return true;
  if (bedLight === 'halfzon') return plantLights.includes('zon') || plantLights.includes('half');
  return plantLights.includes(bedLight);
}

/**
 * Past een plant bij de grondsoort en zuurgraad van het vak? Alleen als de plant er iets over zegt (Esveld:
 * arme (zand)grond, humusrijke grond, kalkhoudende (klei)grond, zure grond). Geeft null (onbekend of geen bezwaar)
 * of een korte reden waarom niet.
 */
export function groundProblem(p, bed) {
  const g = p?.ground;
  if (!g?.length || (!bed?.soilType && !bed?.ph)) return null;
  const only = (k) => g.every((x) => x === k);
  const acid = bed.ph === 'zuur' || (bed.soilType === 'veen' && bed.ph !== 'kalk');
  if (only('zure') && !acid) return 'wil zure grond';
  if (only('kalkhoudende') && acid) return 'wil kalkhoudende grond';
  if (only('arme') && ['klei', 'veen'].includes(bed.soilType)) return 'wil arme, zanderige grond';
  if (g.includes('zure') && !g.includes('humusrijke') && bed.ph === 'kalk') return 'verdraagt geen kalk';
  return null;
}

/** Past een plant bij de ligging (wind, kust) en hoe beschut het is (winterhardheid)? Reden of null. */
export function exposureProblem(p, bed) {
  if (!p || !bed) return null;
  const wi = p.facts?.wi || 0; // 0 niet, 1 matig, 2 sterk windgevoelig, 3 bestand tegen zeewind
  const hard = p.esv?.hard || '';
  if (bed.exposure === 'kust' && p.facts && wi !== 3 && wi > 0) return 'niet bestand tegen zeewind';
  if ((bed.exposure === 'winderig' || bed.exposure === 'kust') && wi === 2) return 'sterk windgevoelig';
  if (bed.exposure === 'winderig' && wi === 1 && !bed.warmWall) return 'windgevoelig';
  if (/niet winterhard|subtrop/.test(hard) && !(bed.warmWall && bed.exposure === 'beschut')) return hard;
  if (/matig/.test(hard) && (bed.exposure === 'winderig' || bed.exposure === 'kust' || bed.exposure === 'open') && !bed.warmWall) return 'matig winterhard (liever beschut)';
  return null;
}

/** Alle bezwaren van een plant op deze plek (grond en ligging). */
export function siteProblems(p, bed) {
  return [groundProblem(p, bed), exposureProblem(p, bed)].filter(Boolean);
}
