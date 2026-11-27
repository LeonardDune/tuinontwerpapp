// Eigenschappen van planten voor functies, filters en eisen per plantvak.
// Bron: de Esveld-catalogus waar die het vastlegt (eetbaar, geur, vruchten, wind, wintergroen, vorm, kenmerken);
// anders afgeleid uit type, maat en geslacht (structuur, klimwijze, leiden). Bij elke eigenschap staat waarom.

const g = (s) => new Set(s.split(/\s+/).filter(Boolean));

// Vaste planten en grassen die als structuur werken: stevig, lang mooi, wintersilhouet
// (o.a. Elisabeth Scholt 'structuurplanten 9 maanden', Studio Ferm 4-seizoenenborder, Oudolf).
const STRUCT = g(`Amsonia Baptisia Brunnera Echinacea Eryngium Echinops Gillenia Lunaria Monarda Perovskia Phlomis Sedum
  Hylotelephium Betonica Verbascum Veronicastrum Eupatorium Eutrochium Sanguisorba Rudbeckia Agastache Thalictrum Actaea
  Cimicifuga Macleaya Angelica Selinum Liatris Silphium Vernonia Helianthus Kniphofia Acanthus Cynara Foeniculum Ligularia
  Calamagrostis Molinia Miscanthus Panicum Pennisetum Cenchrus Schizachyrium Sporobolus Stipa Sesleria Deschampsia
  Andropogon Chasmanthium Spodiopogon Saccharum Cortaderia`);
const STRUCT_SPECIES = g('eurybia-divaricata aster-divaricatus stachys-officinalis salvia-yangii');
// Klimwijze per geslacht
const SELF = g('Hedera Parthenocissus Schizophragma Campsis Pileostegia Decumaria');
const TWINE = g('Wisteria Lonicera Actinidia Akebia Humulus Aristolochia Celastrus Fallopia Trachelospermum Periploca Holboellia Ipomoea Phaseolus Jasminum');
const TENDRIL = g('Clematis Vitis Passiflora Ampelopsis Lathyrus Cobaea Eccremocarpus Cucurbita');
// Te leiden als leiboom, leifruit, dakboom of langs draden
const LEI = g('Malus Pyrus Ficus Vitis Pyracantha Cotoneaster Chaenomeles Cydonia Mespilus Tilia Platanus Carpinus Morus Ribes Photinia Parrotia Wisteria');
// Eetbaar (voor planten zonder Esveld-gegevens)
// Alleen geslachten waarvan (vrijwel) alle soorten eetbaar zijn; bij gemengde geslachten per soort (laurierkers is giftig!)
const EDIBLE = g(`Malus Pyrus Ficus Vitis Ribes Rubus Vaccinium Fragaria Corylus Juglans Mespilus Cydonia Actinidia Morus
  Amelanchier Castanea Olea Thymus Rosmarinus Origanum Mentha Melissa Chamaemelum Levisticum Asparagus Cynara Rheum
  Aronia Hippophae Asimina Diospyros Cornus-mas`);
const EDIBLE_SPECIES = g(`prunus-avium prunus-cerasus prunus-domestica prunus-persica prunus-armeniaca prunus-dulcis prunus-insititia
  prunus-spinosa allium-schoenoprasum allium-ursinum allium-cepa allium-sativum allium-tuberosum lonicera-caerulea
  elaeagnus-umbellata elaeagnus-multiflora elaeagnus-ebbingei sambucus-nigra rosa-rugosa rosa-canina cornus-mas
  salvia-officinalis lavandula-angustifolia humulus-lupulus`);
const BIRDS = g('Sorbus Crataegus Malus Ilex Viburnum Sambucus Cotoneaster Pyracantha Amelanchier Taxus Hedera Prunus Rosa Euonymus Berberis Aronia Cornus Callicarpa');
const SCENT = g(`Lavandula Nepeta Rosa Lonicera Philadelphus Syringa Jasminum Daphne Sarcococca Hamamelis Wisteria Thymus Salvia
  Agastache Phlox Chimonanthus Lilium Hyacinthus Mentha Rosmarinus Origanum Monarda Perovskia Viburnum Osmanthus Choisya
  Trachelospermum Elaeagnus Clethra Matthiola Hesperis Dianthus Convallaria`);
const RUSTLE = g('Fargesia Phyllostachys Sasa Pleioblastus Bambusa Semiarundinaria Populus Miscanthus Calamagrostis Panicum Molinia Cortaderia');
const WEAVE = g('Verbena Knautia Gaura Oenothera Thalictrum Sanguisorba Deschampsia Stipa Allium Gypsophila Briza Molinia Patrinia Succisella Selinum Ammi Orlaya Linaria Nassella');

export const TRAITS = {
  structuur: { name: 'Structuurplant', short: 'structuur', hint: 'geeft vorm en blijft lang staan: skelet, groenblijvend of wintersilhouet' },
  eetbaar: { name: 'Eetbaar (voedsel)', short: 'eetbaar', hint: 'vruchten, blad, bloemen of wortels zijn eetbaar' },
  klimmer: { name: 'Klimt', short: 'klimt', hint: 'klimplant: zelfhechtend, windend, met ranken of aan te binden' },
  leiden: { name: 'Te leiden', short: 'te leiden', hint: 'als leiboom, leifruit of dakvorm langs draden of een muur' },
  wintergroen: { name: 'Wintergroen', short: 'wintergroen', hint: 'houdt (een deel van) het blad in de winter' },
  geur: { name: 'Geurend', short: 'geur', hint: 'geurende bloemen of blad, fijn bij een zitplek' },
  bijen: { name: 'Bijen en vlinders', short: 'bijen', hint: 'goed voor bijen, hommels en vlinders' },
  vogels: { name: 'Vogels (bessen, vruchten)', short: 'vogels', hint: 'opvallende vruchten of bessen in nazomer en winter' },
  inheems: { name: 'Inheems', short: 'inheems', hint: 'van nature in Nederland' },
  windvast: { name: 'Windvast', short: 'windvast', hint: 'niet windgevoelig of bestand tegen zeewind' },
  inkijk: { name: 'Tegen inkijk', short: 'tegen inkijk', hint: 'hoog en dicht genoeg om zicht te ontnemen' },
  schaduw: { name: 'Geeft schaduw', short: 'schaduw', hint: 'boom of grote heester met een kroon' },
  blikvanger: { name: 'Blikvanger', short: 'blikvanger', hint: 'valt op: bijzondere vorm, stam, herfstkleur of groot blad' },
  achtergrond: { name: 'Achtergrond', short: 'achtergrond', hint: 'hoog en rustig, als decor voor bloeiende planten' },
  bodem: { name: 'Bedekt de grond', short: 'bodembedekker', hint: 'laag en spreidend, houdt onkruid tegen' },
  ritselend: { name: 'Ritselt', short: 'ritselt', hint: 'grassen en bamboe die bewegen en geluid maken in de wind' },
  weef: { name: 'Weefplant', short: 'weefplant', hint: 'luchtig, weeft zich tussen andere planten door' },
};

/** Eisen die je voor een heel plantvak kunt stellen (harde filters). */
export const REQUIREMENTS = ['eetbaar', 'klimmer', 'leiden', 'wintergroen', 'inheems', 'bijen', 'windvast', 'geur'];
/** Eigenschappen die je bij een wens kunt vragen (wat de plant moet kunnen). */
export const FUNCTIONS = ['structuur', 'blikvanger', 'achtergrond', 'inkijk', 'schaduw', 'geur', 'bijen', 'vogels', 'eetbaar', 'windvast', 'ritselend', 'bodem', 'weef', 'wintergroen'];

/**
 * Functies van een plantvak in de tuin (Elisabeth Scholt, 'Planten en functie'): wat het vak moet doen.
 * traits: welke plant-eigenschappen daarvoor nodig zijn (minstens één plant met een ervan); all: alle nodig.
 */
export const BED_FUNCTIONS = {
  inkijk: { name: 'Afscherming tegen inkijk', hint: 'hoge, dichte planten, liefst groenblijvend', traits: ['inkijk'] },
  schaduw: { name: 'Schaduw bij terras of zitplek', hint: 'een boom of grote heester met een kroon', traits: ['schaduw'] },
  decor: { name: 'Decor voor de bloeiers ervoor', hint: 'een rustige, hoge achtergrond (backdrop)', traits: ['achtergrond'] },
  zichtlijn: { name: 'Blikvanger in een zichtlijn', hint: 'iets dat opvalt, gezien vanuit huis of terras', traits: ['blikvanger'] },
  geurplek: { name: 'Geurplek bij de zitplek', hint: 'geurende bloemen of blad (ook tegen muggen)', traits: ['geur'] },
  voedsel: { name: 'Voedsel oogsten', hint: 'fruit, noten, kruiden of groente', traits: ['eetbaar'] },
  natuur: { name: 'Natuur: bijen, vlinders, vogels', hint: 'nectar en bessen', traits: ['bijen', 'vogels'] },
  windscherm: { name: 'Windscherm', hint: 'hoog en windvast', traits: ['windvast', 'inkijk'], all: true },
  geluid: { name: 'Tegengeluid', hint: 'ritselende grassen of bamboe tegen verkeersgeluid', traits: ['ritselend'] },
};

const genusOf = (p) => String(p.lat || '').replace(/^[×x]\s+/, '').split(/\s+/)[0];
const speciesKey = (p) => String(p.lat || '').toLowerCase().split(/\s+/).slice(0, 2).join('-').replace(/[^a-z-]/g, '');

let cache = new WeakMap();

/**
 * Eigenschappen van een plant (uit de database of de Esveld-catalogus): Map(sleutel → reden).
 * Ook voor een bouwsteen met een plant (gebruik dan de plant zelf).
 */
export function plantTraits(p) {
  if (!p) return new Map();
  const hit = cache.get(p);
  if (hit) return hit;
  const t = new Map();
  const f = p.facts || {}; // gegevens van Esveld (ook voor gekoppelde planten uit de basislijst)
  const gen = genusOf(p), h = p.h || 0, w = p.w || 0;
  const evergreen = p.evergreen || p.winter === 'groen' || f.hw;
  const climber = p.type === 'klimmer';
  // structuur
  if (p.type === 'boom' || p.type === 'haag') t.set('structuur', 'skelet (boom of haag)');
  else if (p.type === 'heester' && h >= 50) t.set('structuur', evergreen ? 'groenblijvend skelet' : 'skelet (heester)');
  else if (evergreen && h >= 25 && p.type !== 'bol' && !climber) t.set('structuur', 'groenblijvend');
  else if (p.type === 'gras' && (STRUCT.has(gen) || h >= 60)) t.set('structuur', 'wintersilhouet (siergras)');
  else if (STRUCT.has(gen) || STRUCT_SPECIES.has(speciesKey(p))) t.set('structuur', 'stevig, wintersilhouet');
  else if ((f.vm === 'zuil' || f.vm === 'kegel') && h >= 80) t.set('structuur', `vaste vorm (${f.vm})`);
  else if (climber && evergreen) t.set('structuur', 'groenblijvend op muur of hek');
  // eetbaar
  if (f.e) t.set('eetbaar', [...f.e].map((c) => ({ v: 'vruchten', b: 'blad', f: 'bloemen', w: 'wortels' }[c])).join(', '));
  else if (!p.src && !p.facts && (EDIBLE.has(gen) || EDIBLE_SPECIES.has(speciesKey(p)) || p.type === 'kruid')) t.set('eetbaar', p.type === 'kruid' ? 'kruid' : 'eetbaar (afgeleid)');
  // klimmen
  if (climber) t.set('klimmer', SELF.has(gen) ? 'zelfhechtend' : TWINE.has(gen) ? 'windend, steun nodig' : TENDRIL.has(gen) ? 'met ranken, steun nodig' : 'aanbinden aan steun');
  // leiden
  if (f.lei) t.set('leiden', 'te koop als leivorm');
  else if ((LEI.has(gen) || (gen === 'Prunus' && EDIBLE_SPECIES.has(speciesKey(p)))) && (p.type === 'boom' || p.type === 'heester' || p.type === 'klimmer')) t.set('leiden', 'geschikt om te leiden (afgeleid)');
  if (evergreen) t.set('wintergroen', f.hw ? 'halfwintergroen' : 'wintergroen');
  // geur
  if (f.gr) t.set('geur', [f.gr.includes('f') && 'bloemen', f.gr.includes('l') && 'blad', f.gr.includes('v') && 'vruchten'].filter(Boolean).join(' en ') + (f.gr.includes('2') ? ', sterk' : ''));
  else if (!p.src && SCENT.has(gen)) t.set('geur', 'geurend (afgeleid)');
  if (p.bees) t.set('bijen', 'bijen en vlinders');
  if (f.fm && f.fm.some((m) => m >= 8 || m <= 2)) t.set('vogels', `vruchten ${f.fm.length > 1 ? 'in ' : ''}${monthsShort(f.fm)}`);
  else if (!p.src && BIRDS.has(gen) && (p.type === 'boom' || p.type === 'heester' || p.type === 'klimmer')) t.set('vogels', 'bessen of vruchten (afgeleid)');
  if (p.native) t.set('inheems', 'inheems');
  if (p.src === 'esveld' || f.src) {
    if (!f.wi) t.set('windvast', 'niet windgevoelig');
    else if (f.wi === 3) t.set('windvast', 'bestand tegen zeewind');
  }
  // functies uit maat en vorm
  const woody = p.type === 'heester' || p.type === 'boom' || p.type === 'haag' || RUSTLE.has(gen) && p.type !== 'gras';
  if ((woody || climber) && h >= 160) t.set('inkijk', evergreen ? 'het hele jaar' : 'van voorjaar tot herfst');
  if ((p.type === 'boom' && h >= 400) || (p.type === 'heester' && h >= 350 && w >= 250)) t.set('schaduw', p.type === 'boom' ? 'boom' : 'grote heester');
  const big = (f.lz || 0) >= 30 && p.type !== 'gras' && f.lf !== 'lijn';
  if ((f.k || []).includes('stam')) t.set('blikvanger', 'opvallende stam of takken');
  else if (f.vm === 'treur') t.set('blikvanger', 'treurvorm');
  else if (p.autumn === 'rood' && (p.type === 'boom' || p.type === 'heester')) t.set('blikvanger', 'spectaculaire herfstkleur');
  else if (big) t.set('blikvanger', 'groot blad');
  else if ((f.k || []).includes('wk')) t.set('blikvanger', 'bijzondere winterkleur');
  if (h >= 150 && (woody || p.type === 'gras' || evergreen) && !climber) t.set('achtergrond', evergreen ? 'hoog en groenblijvend' : 'hoog en rustig');
  if (p.type === 'bodem' || (p.habit === 'spreidend' && h <= 40)) t.set('bodem', (f.k || []).includes('woek') ? 'woekert, bedekt snel' : 'laag en spreidend');
  if (RUSTLE.has(gen) || (p.type === 'gras' && h >= 80)) t.set('ritselend', p.type === 'gras' ? 'siergras' : 'bamboe of populier');
  if (WEAVE.has(gen) || p.habit === 'ijl') t.set('weef', 'luchtig, tussen andere planten');
  cache.set(p, t);
  return t;
}

function monthsShort(ms) {
  const n = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return ms.length === 1 ? n[ms[0] - 1] : `${n[ms[0] - 1]}–${n[ms[ms.length - 1] - 1]}`;
}

export function hasTrait(p, key) {
  return plantTraits(p).has(key);
}

/** Voldoet een plant aan alle eisen? */
export function meetsAll(p, keys) {
  if (!keys?.length) return true;
  const t = plantTraits(p);
  return keys.every((k) => t.has(k));
}

/** Cache legen (na het laden van de Esveld-catalogus veranderen de gegevens van de basislijst). */
export function resetTraits() {
  cache = new WeakMap();
}
