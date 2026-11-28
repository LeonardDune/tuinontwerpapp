// Planten in of bij losse elementen: potten en bakken, hagen, pergola's, bogen en berceaus, leifruit en bomen.
// Een element kan meerdere soorten hebben (gemengde haag, twee klimplanten op een pergola, een rij leifruit met
// verschillende rassen). Opslag: item.plants = [{ role, n? }] (n leeg = de app rekent het aantal uit);
// item.role blijft de eerste soort, zodat tekenen, 3D en oude ontwerpen gewoon werken.

import { STENCIL_MAP } from './stencils.js';
import { plantById } from './plantdb.js';

/** Soorten elementen en welke planten erbij passen (voor de keuzelijst). */
export const ELEMENT_KINDS = {
  pot: { name: 'Pot of bak', what: 'plant in de pot', types: ['vaste', 'gras', 'varen', 'bol', 'bodem', 'kruid', 'heester', 'boom', 'klimmer'], multi: true, hint: 'Eén plant, of een combinatie in een grote bak (bijvoorbeeld een heestertje met hangers eromheen).' },
  klim: { name: 'Klimelement', what: 'klimplanten', types: ['klimmer'], multi: true, hint: 'Bijvoorbeeld een klimroos met een clematis erdoor, of aan elke staander een andere soort.' },
  haag: { name: 'Haag', what: 'haagplanten', types: ['haag', 'heester'], multi: true, hint: 'Eén soort voor een strakke haag, of meerdere voor een gemengde haag; ze worden om en om geplant.' },
  leifruit: { name: 'Leifruit', what: 'leifruit', types: ['boom', 'heester', 'klimmer'], traits: ['leiden'], multi: true, hint: 'Bijvoorbeeld een rij met verschillende appel- en perenrassen (let op bestuivers).' },
  leiboom: { name: 'Lei- of dakboom', what: 'leibomen', types: ['boom', 'heester'], traits: ['leiden'], multi: true, hint: 'Linde, plataan, haagbeuk of een andere boom die zich laat leiden.' },
  boom: { name: 'Boom', what: 'boom', types: ['boom'], multi: false, hint: '' },
  heester: { name: 'Heester', what: 'heester', types: ['heester'], multi: false, hint: '' },
};

const LEIFRUIT = new Set(['leifruitmuur', 'leifruitrek', 'fruitsnoer']);
const LEIBOOM = new Set(['leiboom', 'dakleiboom']);

/** Wat voor element is dit stencil (voor de plantkeuze), of null als er geen planten bij horen. */
export function elementKind(symbol) {
  const s = STENCIL_MAP[symbol];
  if (!s) return null;
  if (LEIFRUIT.has(symbol)) return 'leifruit';
  if (LEIBOOM.has(symbol)) return 'leiboom';
  if (s.climb || s.climbPlant || symbol === 'hek_trellis') return 'klim';
  if (s.cat === 'Potten & bakken' && !symbol.startsWith('kruidenspiraal')) return 'pot';
  if (s.cat === 'Hagen') return 'haag';
  if (s.cat === 'Bomen') return 'boom';
  if (s.cat === 'Heesters & planten' && /heester|bloeiend/.test(symbol)) return 'heester';
  return null;
}

/** De gekozen soorten van een element: [{ role, n }] (ook voor ontwerpen van vóór deze functie). */
export function elementPlants(item) {
  if (Array.isArray(item.plants) && item.plants.length) return item.plants;
  return item.role ? [{ role: item.role }] : [];
}

/** Lengte van een element in de lengterichting (m). */
const lengthOf = (item) => Math.max(item.w || 0, item.h || 0);

/**
 * Hoeveel planten er in totaal in het element komen als je niets invult:
 * haag ±4 per m (hoge, brede soorten minder), leifruit om de 1,5–2,5 m, klimplanten één per staander of per 2,5 m.
 */
export function autoTotal(item, kind, roles = {}) {
  const L = lengthOf(item);
  const list = elementPlants(item);
  if (kind === 'haag') {
    const ws = list.map((x) => plantById(roles[x.role]?.plant)?.w).filter(Boolean);
    const w = ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 60;
    const perM = w >= 150 ? 2 : w >= 80 ? 3 : 4;
    return Math.max(1, Math.round(L * perM));
  }
  if (kind === 'leifruit') return Math.max(1, Math.round(L / (item.symbol === 'fruitsnoer' ? 1.5 : 2.2)));
  if (kind === 'leiboom') return 1;
  if (kind === 'klim') {
    // één klimplant per staander: staanders om de 3 m, bij een gang of berceau aan twee kanten
    if (item.symbol === 'rozenboog') return Math.max(2, list.length);
    if (item.symbol === 'klimplant' || item.symbol === 'hek_trellis') return Math.max(list.length, Math.round(L / 2.5));
    const perSide = Math.max(2, Math.ceil((L - 0.6) / 3) + 1);
    const sides = /gang|berceau/.test(item.symbol) ? 2 : 1;
    return Math.max(list.length, perSide * sides);
  }
  return list.length || 1;
}

/** Aantal per soort: wat je invulde, anders het automatische totaal eerlijk verdeeld. */
export function elementCounts(item, roles = {}) {
  const kind = elementKind(item.symbol);
  const list = elementPlants(item);
  if (!list.length) return [];
  if (!kind) return list.map((x) => ({ role: x.role, n: x.n || 1, auto: !x.n }));
  const fixed = list.filter((x) => x.n).reduce((s, x) => s + x.n, 0);
  const open = list.filter((x) => !x.n);
  const rest = Math.max(open.length, autoTotal(item, kind, roles) - fixed);
  const base = Math.floor(rest / Math.max(1, open.length)), extra = rest - base * open.length;
  return list.map((x) => {
    if (x.n) return { role: x.role, n: x.n, auto: false };
    const k = open.indexOf(x);
    return { role: x.role, n: base + (k < extra ? 1 : 0), auto: true };
  });
}

/** Bij een klimplant uit de database: welke begroeiing (kleur in de tekening en 3D) erbij hoort. */
export function climbLookFor(p) {
  if (!p) return null;
  if (p.climb) return p.climb;
  const g = (p.lat || '').split(' ')[0];
  const by = { Rosa: 'roos', Wisteria: 'blauweregen', Clematis: 'clematis', Lonicera: 'kamperfoelie', Vitis: 'druif', Parthenocissus: 'herfst', Hedera: 'groen', Humulus: 'groen', Carpinus: 'haagbeuk', Fagus: 'haagbeuk' };
  return by[g] || 'groen';
}

/** Alle bouwstenen in een element (voor tellingen en "al gekozen"). */
export function elementRoleIds(item) {
  return elementPlants(item).map((x) => x.role);
}
