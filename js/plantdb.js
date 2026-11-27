// Plantendatabase: gangbare tuinplanten en bomen met de eigenschappen die de app gebruikt voor de impressie
// (groeivorm, bloeivorm, kleuren per maand) en voor de keuzehulp (hoogte, licht, grond, bloeitijd).
// Dit is de ingebouwde bron; een externe bron kan later met dezelfde velden worden aangesloten (zie addPlants).
//
// Velden: id, nl, lat, type (vaste | gras | varen | bol | bodem | kruid | heester | haag | boom | klimmer),
// h = hoogte in bloei (cm), w = breedte (cm), habit, form, color (bloeikleur), bloom (maanden 1..12),
// light (zon, half, schaduw), soil (droog, normaal, vochtig), foliage, autumn, winter, en vlaggen:
// native (inheems), bees (goed voor bijen en vlinders), evergreen, stencil (bijbehorend stencil), climb (klimplantsoort).

import { meetsAll, hasTrait } from './traits.js';
import { lightFits } from './site.js';

const LIGHT = { z: 'zon', h: 'half', s: 'schaduw' };
const SOIL = { d: 'droog', n: 'normaal', v: 'vochtig' };

function months(spec) {
  if (!spec) return [];
  const out = [];
  for (const part of String(spec).split(',')) {
    const [a, b] = part.split('-').map(Number);
    if (b == null) { out.push(a); continue; }
    // ook over de jaargrens heen (bijv. 11-2)
    let m = a;
    for (let k = 0; k < 12; k++) { out.push(m); if (m === b) break; m = (m % 12) + 1; }
  }
  return [...new Set(out)].filter((m) => m >= 1 && m <= 12);
}

/** P(id, nl, lat, type, h, w, habit, form, kleur, bloei, licht, grond, extra) */
function P(id, nl, lat, type, h, w, habit, form, color, bloom, light, soil, extra = '') {
  const p = {
    id, nl, lat, type, h, w, habit, form, color, bloom: months(bloom),
    light: [...light].map((c) => LIGHT[c]), soil: [...soil].map((c) => SOIL[c]),
    foliage: 'groen', autumn: 'geen',
    winter: type === 'gras' || type === 'heester' || type === 'boom' || type === 'haag' ? 'silhouet' : 'weg',
  };
  for (const tok of extra.split(/\s+/).filter(Boolean)) {
    const [k, v] = tok.split('=');
    if (k === 'f') p.foliage = v;
    else if (k === 'a') p.autumn = v;
    else if (k === 'w') p.winter = v;
    else if (k === 'st') p.stencil = v;
    else if (k === 'k') p.kind = v;
    else if (k === 'climb') p.climb = v;
    else if (k === 'ev') { p.evergreen = true; p.winter = 'groen'; }
    else if (k === 'n') p.native = true;
    else if (k === 'b') p.bees = true;
  }
  return p;
}

export const PLANT_TYPES = {
  vaste: 'Vaste plant', gras: 'Siergras', varen: 'Varen', bol: 'Bolgewas', bodem: 'Bodembedekker', kruid: 'Kruid',
  heester: 'Heester', haag: 'Haagplant', boom: 'Boom', klimmer: 'Klimplant',
};

const DATA = [
  // ---- vaste planten: aren en kaarsen
  P('kattenkruid', 'Kattenkruid', "Nepeta × faassenii 'Walker's Low'", 'vaste', 50, 60, 'kussen', 'aar', '#7a72c9', '5-9', 'z', 'dn', 'f=zilver b'),
  P('kattenkruid_groot', 'Kattenkruid, groot', "Nepeta 'Six Hills Giant'", 'vaste', 80, 90, 'kussen', 'aar', '#7a72c9', '5-9', 'z', 'dn', 'f=zilver b'),
  P('salvia', 'Salie (steppesalie)', "Salvia nemorosa 'Caradonna'", 'vaste', 50, 40, 'rechtop', 'aar', '#4b3b9a', '6-9', 'z', 'dn', 'b w=silhouet'),
  P('salvia_ost', 'Salie, paarsrood', "Salvia nemorosa 'Ostfriesland'", 'vaste', 40, 40, 'rechtop', 'aar', '#6a3fa0', '6-8', 'z', 'dn', 'b'),
  P('veldsalie', 'Veldsalie', 'Salvia pratensis', 'vaste', 50, 40, 'rechtop', 'aar', '#5a5ad0', '5-7', 'z', 'd', 'n b'),
  P('ereprijs', 'Ereprijs', 'Veronica longifolia', 'vaste', 80, 40, 'rechtop', 'aar', '#6a6fc8', '7-8', 'zh', 'nv', 'b w=silhouet'),
  P('virginische_ereprijs', 'Virginische ereprijs', "Veronicastrum virginicum 'Lavendelturm'", 'vaste', 160, 60, 'rechtop', 'aar', '#b8a6d8', '7-9', 'zh', 'nv', 'b w=silhouet'),
  P('dropplant', 'Dropplant', "Agastache 'Blue Fortune'", 'vaste', 90, 50, 'rechtop', 'aar', '#7b6ac8', '7-9', 'z', 'dn', 'b w=silhouet'),
  P('lavendel', 'Lavendel', "Lavandula angustifolia 'Hidcote'", 'vaste', 50, 50, 'kussen', 'aar', '#6a5ab0', '6-8', 'z', 'd', 'f=zilver ev b'),
  P('reuzenzilverkruid', 'Reuzenzilverkruid', "Perovskia 'Blue Spire'", 'vaste', 110, 70, 'rechtop', 'aar', '#8a8ad8', '8-10', 'z', 'd', 'f=zilver b w=silhouet'),
  P('duizendknoop', 'Duizendknoop', "Persicaria amplexicaulis 'Firetail'", 'vaste', 110, 90, 'bol', 'aar', '#c0283a', '7-10', 'zh', 'nv', 'a=brons b w=silhouet'),
  P('lampenpoetser', 'Lampenpoetser', 'Liatris spicata', 'vaste', 70, 30, 'rechtop', 'aar', '#a04aa8', '7-8', 'z', 'n', 'b'),
  P('kattenstaart', 'Grote kattenstaart', 'Lythrum salicaria', 'vaste', 120, 60, 'rechtop', 'aar', '#c84a9a', '7-9', 'zh', 'v', 'n b w=silhouet'),
  P('betonie', 'Betonie', "Stachys monieri 'Hummelo'", 'vaste', 50, 40, 'kussen', 'aar', '#b04a90', '6-8', 'z', 'dn', 'b'),
  P('vingerhoedskruid', 'Vingerhoedskruid', 'Digitalis purpurea', 'vaste', 140, 50, 'rechtop', 'aar', '#b06aa8', '6-7', 'hs', 'n', 'n b'),
  P('vuurpijl', 'Vuurpijl', "Kniphofia 'Alcazar'", 'vaste', 100, 60, 'overhangend', 'aar', '#e86a2a', '6-8', 'z', 'dn', 'k=zwaard'),
  P('lupine', 'Lupine', "Lupinus 'Gallery Blue'", 'vaste', 70, 50, 'rechtop', 'aar', '#5a6ac8', '5-6', 'z', 'n', 'b'),
  P('ridderspoor', 'Ridderspoor', 'Delphinium elatum', 'vaste', 160, 60, 'rechtop', 'aar', '#4a6ad8', '6-7', 'z', 'n', 'b'),
  P('toorts', 'Toorts', "Verbascum chaixii 'Album'", 'vaste', 90, 40, 'rechtop', 'aar', '#f4f0e0', '6-8', 'z', 'd', 'b w=silhouet'),
  P('zilverkaars', 'Zilverkaars', "Actaea simplex 'Brunette'", 'vaste', 150, 60, 'rechtop', 'aar', '#f2e6ee', '9-10', 'hs', 'nv', 'f=rood b'),
  P('pimpernel_roze', 'Pimpernel, roze', "Sanguisorba tenuifolia 'Pink Elephant'", 'vaste', 150, 60, 'ijl', 'aar', '#e8a0c0', '8-9', 'zh', 'nv', 'b w=silhouet'),
  P('berenklauw_acanthus', 'Akant', 'Acanthus mollis', 'vaste', 120, 90, 'bol', 'aar', '#d8c0d0', '7-8', 'zh', 'dn', 'w=silhouet'),
  P('slangenwortel', 'Duizendknoop, laag', 'Persicaria affinis', 'bodem', 20, 50, 'spreidend', 'aar', '#e090b0', '7-10', 'z', 'nv', 'a=rood'),
  // ---- knoppen en bollen
  P('grote_pimpernel', 'Grote pimpernel', "Sanguisorba officinalis 'Tanna'", 'vaste', 60, 40, 'ijl', 'knop', '#8a1a2a', '7-9', 'z', 'nv', 'n b w=silhouet'),
  P('kogeldistel', 'Kogeldistel', 'Echinops ritro', 'vaste', 100, 60, 'rechtop', 'knop', '#5a7ad0', '7-9', 'z', 'd', 'f=zilver b w=silhouet'),
  P('kruisdistel', 'Kruisdistel', 'Eryngium planum', 'vaste', 80, 50, 'rechtop', 'knop', '#6a8ac8', '7-9', 'z', 'd', 'f=blauw b w=silhouet'),
  P('knautia', 'Beemdkroon, rood', 'Knautia macedonica', 'vaste', 70, 50, 'ijl', 'knop', '#8a1a3a', '6-9', 'z', 'dn', 'b'),
  P('duifkruid', 'Duifkruid', "Scabiosa columbaria 'Butterfly Blue'", 'vaste', 40, 30, 'kussen', 'knop', '#8a9ad8', '6-9', 'z', 'd', 'n b'),
  P('zeeuws_knoopje', 'Zeeuws knoopje', 'Astrantia major', 'vaste', 70, 45, 'bol', 'knop', '#c88aa0', '6-8', 'zh', 'nv', 'b'),
  P('pioen', 'Pioen', 'Paeonia lactiflora', 'vaste', 90, 90, 'bol', 'knop', '#e8a0b8', '5-6', 'z', 'n', ''),
  P('klokjesbloem', 'Klokjesbloem', 'Campanula persicifolia', 'vaste', 80, 40, 'rechtop', 'knop', '#8a90e0', '6-7', 'zh', 'n', 'n b'),
  P('kluwenklokje', 'Kluwenklokje', 'Campanula glomerata', 'vaste', 50, 40, 'rechtop', 'knop', '#5a3ab0', '6-7', 'zh', 'n', 'n b'),
  P('akelei', 'Akelei', 'Aquilegia vulgaris', 'vaste', 60, 40, 'ijl', 'knop', '#7a6ab0', '5-6', 'zh', 'n', 'n b'),
  P('gebroken_hartje', 'Gebroken hartje', 'Lamprocapnos spectabilis', 'vaste', 70, 60, 'overhangend', 'knop', '#e07aa0', '4-5', 'hs', 'nv', ''),
  P('iris', 'Baardiris', 'Iris germanica', 'vaste', 80, 40, 'overhangend', 'knop', '#5a4ab0', '5-6', 'z', 'd', 'k=zwaard'),
  P('siberische_iris', 'Siberische iris', 'Iris sibirica', 'vaste', 90, 40, 'overhangend', 'knop', '#4a5ad0', '5-6', 'zh', 'nv', 'k=zwaard'),
  P('afrikaanse_lelie', 'Afrikaanse lelie', "Agapanthus 'Headbourne'", 'vaste', 80, 50, 'overhangend', 'knop', '#5a7ad8', '7-8', 'z', 'dn', 'k=zwaard'),
  // ---- schijven en margrieten
  P('zonnehoed', 'Rode zonnehoed', "Echinacea purpurea 'Magnus'", 'vaste', 90, 45, 'rechtop', 'schijf', '#c8507a', '7-9', 'z', 'dn', 'b w=silhouet'),
  P('zonnehoed_wit', 'Witte zonnehoed', "Echinacea purpurea 'White Swan'", 'vaste', 70, 45, 'rechtop', 'schijf', '#f2f0e8', '7-9', 'z', 'dn', 'b w=silhouet'),
  P('rudbeckia', 'Zonnehoed, geel', "Rudbeckia fulgida 'Goldsturm'", 'vaste', 60, 50, 'bol', 'schijf', '#f0b020', '7-10', 'z', 'n', 'b w=silhouet'),
  P('zonnekruid', 'Zonnekruid', "Helenium 'Moerheim Beauty'", 'vaste', 100, 60, 'rechtop', 'schijf', '#c0482a', '7-9', 'z', 'nv', 'b w=silhouet'),
  P('meisjesogen', 'Meisjesogen', "Coreopsis verticillata 'Moonbeam'", 'vaste', 40, 40, 'kussen', 'schijf', '#f4e08a', '6-9', 'z', 'dn', 'b'),
  P('margriet', 'Grote margriet', 'Leucanthemum × superbum', 'vaste', 70, 50, 'rechtop', 'schijf', '#fafaf0', '6-8', 'z', 'n', 'b'),
  P('herfstaster', 'Herfstaster', 'Symphyotrichum novae-angliae', 'vaste', 130, 60, 'rechtop', 'schijf', '#8a4ab8', '9-10', 'z', 'nv', 'b w=silhouet'),
  P('aster_monch', 'Aster', "Aster × frikartii 'Mönch'", 'vaste', 70, 50, 'bol', 'schijf', '#8a90d8', '7-10', 'z', 'n', 'b'),
  P('herfstanemoon', 'Herfstanemoon', "Anemone × hybrida 'Honorine Jobert'", 'vaste', 110, 60, 'bol', 'schijf', '#f6f2f0', '8-10', 'zh', 'n', 'b'),
  P('ooievaarsbek_rozanne', 'Ooievaarsbek', "Geranium 'Rozanne'", 'vaste', 50, 70, 'spreidend', 'schijf', '#6a72d0', '6-10', 'zh', 'dn', 'b'),
  P('ooievaarsbek_bodem', 'Ooievaarsbek, bodembedekkend', 'Geranium macrorrhizum', 'bodem', 30, 60, 'spreidend', 'schijf', '#d0609a', '5-6', 'hs', 'dn', 'ev a=rood b'),
  P('bloedooievaarsbek', 'Bloedooievaarsbek', 'Geranium sanguineum', 'vaste', 25, 40, 'spreidend', 'schijf', '#c03a80', '5-8', 'z', 'dn', 'n b'),
  P('donkere_ooievaarsbek', 'Donkere ooievaarsbek', 'Geranium phaeum', 'vaste', 60, 40, 'bol', 'schijf', '#4a2a4a', '5-6', 'hs', 'n', 'n b'),
  P('prachtkaars', 'Prachtkaars', "Gaura lindheimeri 'Whirling Butterflies'", 'vaste', 80, 60, 'ijl', 'schijf', '#f4ece8', '6-10', 'z', 'd', 'b'),
  P('bergkorenbloem', 'Bergkorenbloem', 'Centaurea montana', 'vaste', 50, 50, 'kussen', 'schijf', '#4a5ad0', '5-7', 'z', 'dn', 'b'),
  P('oosterse_papaver', 'Oosterse papaver', 'Papaver orientale', 'vaste', 80, 60, 'kussen', 'schijf', '#e04a2a', '5-6', 'z', 'd', ''),
  P('daglelie', 'Daglelie', "Hemerocallis 'Stella de Oro'", 'vaste', 40, 50, 'overhangend', 'schijf', '#f0b020', '6-9', 'z', 'n', 'k=zwaard'),
  P('montbretia', 'Montbretia', "Crocosmia 'Lucifer'", 'vaste', 100, 40, 'overhangend', 'aar', '#d0282a', '7-8', 'z', 'n', 'k=zwaard'),
  P('kerstroos', 'Kerstroos', 'Helleborus orientalis', 'vaste', 40, 45, 'kussen', 'schijf', '#c8a0b0', '2-4', 'hs', 'n', 'ev'),
  // ---- schermen
  P('vrouwenmantel', 'Vrouwenmantel', 'Alchemilla mollis', 'vaste', 40, 50, 'kussen', 'scherm', '#d4d870', '6-7', 'zh', 'nv', 'b'),
  P('duizendblad', 'Duizendblad', "Achillea 'Terracotta'", 'vaste', 80, 50, 'rechtop', 'scherm', '#d07a3a', '6-9', 'z', 'd', 'b w=silhouet'),
  P('duizendblad_wild', 'Wild duizendblad', 'Achillea millefolium', 'vaste', 60, 40, 'rechtop', 'scherm', '#f0eae0', '6-9', 'z', 'd', 'n b'),
  P('hemelsleutel', 'Hemelsleutel', "Hylotelephium 'Herbstfreude'", 'vaste', 50, 50, 'bol', 'scherm', '#b0405a', '8-10', 'z', 'd', 'f=blauw b w=silhouet'),
  P('hemelsleutel_matrona', 'Hemelsleutel, roze', "Hylotelephium 'Matrona'", 'vaste', 50, 50, 'bol', 'scherm', '#d890a8', '8-10', 'z', 'd', 'f=rood b w=silhouet'),
  P('koninginnekruid', 'Koninginnekruid', "Eutrochium maculatum 'Atropurpureum'", 'vaste', 180, 90, 'rechtop', 'scherm', '#b06a8a', '8-9', 'zh', 'v', 'b w=silhouet'),
  P('vlambloem', 'Vlambloem', 'Phlox paniculata', 'vaste', 100, 60, 'rechtop', 'scherm', '#d870b0', '7-9', 'zh', 'nv', 'b'),
  P('marjolein', 'Wilde marjolein', 'Origanum vulgare', 'kruid', 50, 50, 'bol', 'scherm', '#c88ab0', '7-9', 'z', 'd', 'n b'),
  // ---- pluimen
  P('pluimspirea', 'Pluimspirea', "Astilbe chinensis 'Visions'", 'vaste', 50, 40, 'bol', 'pluim', '#c85090', '7-8', 'hs', 'v', 'b'),
  P('pluimspirea_wit', 'Pluimspirea, wit', "Astilbe 'Deutschland'", 'vaste', 60, 40, 'bol', 'pluim', '#f6f2ea', '6-7', 'hs', 'v', ''),
  P('moerasspirea', 'Moerasspirea, roze', "Filipendula rubra 'Venusta'", 'vaste', 180, 90, 'rechtop', 'pluim', '#e8a0b8', '7-8', 'zh', 'v', 'b'),
  P('geitenbaard', 'Geitenbaard', 'Aruncus dioicus', 'vaste', 150, 100, 'bol', 'pluim', '#f4f0e0', '6', 'hs', 'nv', 'n'),
  P('ruit', 'Ruit', "Thalictrum 'Elin'", 'vaste', 220, 60, 'ijl', 'pluim', '#c8a8d8', '7-8', 'zh', 'nv', ''),
  P('steentijm', 'Steentijm', 'Calamintha nepeta', 'vaste', 40, 50, 'kussen', 'pluim', '#e0e0f4', '7-10', 'z', 'd', 'b'),
  // ---- bladplanten
  P('hosta_blauw', 'Hosta, blauw', "Hosta 'Halcyon'", 'vaste', 40, 70, 'kussen', 'blad', '#b8c0e0', '7-8', 'hs', 'nv', 'f=blauw'),
  P('hosta_groot', 'Hosta, groot', "Hosta sieboldiana 'Elegans'", 'vaste', 70, 100, 'kussen', 'blad', '#f2f0f6', '7', 'hs', 'nv', 'f=blauw'),
  P('schoenlappersplant', 'Schoenlappersplant', 'Bergenia cordifolia', 'vaste', 40, 50, 'kussen', 'blad', '#d06aa0', '3-4', 'zhs', 'dn', 'ev a=rood'),
  P('purperklokje', 'Purperklokje', "Heuchera 'Palace Purple'", 'vaste', 40, 40, 'kussen', 'blad', '#f2e6e0', '6-7', 'hs', 'n', 'f=rood ev'),
  P('kaukasische_vergeetmijniet', 'Kaukasische vergeet-mij-niet', "Brunnera macrophylla 'Jack Frost'", 'vaste', 40, 50, 'kussen', 'blad', '#7a9ae0', '4-5', 'hs', 'nv', 'f=zilver'),
  P('longkruid', 'Longkruid', "Pulmonaria 'Sissinghurst White'", 'vaste', 30, 40, 'kussen', 'blad', '#f4f2f0', '3-4', 'hs', 'nv', ''),
  // ---- bodembedekkers
  P('elfenbloem', 'Elfenbloem', "Epimedium × versicolor 'Sulphureum'", 'bodem', 30, 40, 'spreidend', 'blad', '#f2e08a', '4-5', 'hs', 'dn', 'ev'),
  P('ezelsoor', 'Ezelsoor', "Stachys byzantina 'Silver Carpet'", 'bodem', 20, 50, 'spreidend', 'blad', '#c8b0c8', '6-7', 'z', 'd', 'f=zilver ev'),
  P('klokje_bodem', 'Dalmatiër klokje', 'Campanula portenschlagiana', 'bodem', 15, 40, 'spreidend', 'schijf', '#8a7ad8', '6-8', 'zh', 'dn', ''),
  P('kruipend_zenegroen', 'Kruipend zenegroen', 'Ajuga reptans', 'bodem', 15, 40, 'spreidend', 'aar', '#4a4ab0', '4-5', 'hs', 'nv', 'n ev'),
  P('maagdenpalm', 'Kleine maagdenpalm', 'Vinca minor', 'bodem', 15, 60, 'spreidend', 'schijf', '#6a72d0', '4-5', 'hs', 'n', 'ev'),
  P('goudaardbei', 'Goudaardbei', 'Waldsteinia ternata', 'bodem', 10, 40, 'spreidend', 'schijf', '#f4d040', '4-5', 'hs', 'n', 'ev'),
  P('schaduwkruid', 'Schaduwkruid', 'Pachysandra terminalis', 'bodem', 20, 50, 'spreidend', 'blad', '#f4f2e8', '4', 's', 'n', 'ev'),
  P('klimop_bodem', 'Klimop (als bodembedekker)', 'Hedera helix', 'bodem', 15, 100, 'spreidend', 'blad', '#a0b060', '9-10', 'hs', 'n', 'n ev f=donker'),
  P('dovenetel', 'Gevlekte dovenetel', 'Lamium maculatum', 'bodem', 20, 50, 'spreidend', 'aar', '#d080b0', '5-7', 'hs', 'nv', 'f=zilver b'),
  P('vetkruid', 'Wit vetkruid', 'Sedum album', 'bodem', 10, 30, 'spreidend', 'scherm', '#f4f2e8', '6-7', 'z', 'd', 'ev n b'),
  P('vlambloem_bodem', 'Kruipphlox', 'Phlox subulata', 'bodem', 15, 40, 'spreidend', 'schijf', '#e070b0', '4-5', 'z', 'd', 'ev'),
  P('aubrieta', 'Blauwkussen', 'Aubrieta', 'bodem', 10, 40, 'spreidend', 'schijf', '#8a5ab8', '4-5', 'z', 'd', 'ev b'),
  P('hoornbloem', 'Viltige hoornbloem', 'Cerastium tomentosum', 'bodem', 15, 50, 'spreidend', 'schijf', '#fafaf6', '5-6', 'z', 'd', 'f=zilver ev'),
  P('schuimbloem', 'Schuimbloem', 'Tiarella cordifolia', 'bodem', 25, 40, 'spreidend', 'aar', '#f4ece8', '4-5', 'hs', 'nv', 'ev'),
  P('wilde_tijm', 'Wilde tijm', 'Thymus serpyllum', 'bodem', 8, 40, 'spreidend', 'scherm', '#c070b0', '6-8', 'z', 'd', 'n b ev'),
  P('roomse_kamille', 'Roomse kamille', 'Chamaemelum nobile', 'bodem', 10, 30, 'spreidend', 'schijf', '#fafaf0', '6-8', 'z', 'd', 'ev'),
  P('leliegras', 'Leliegras', 'Liriope muscari', 'vaste', 30, 40, 'overhangend', 'aar', '#8a6ac8', '8-10', 'hs', 'n', 'ev k=gras'),
  P('sneeuwveldbies', 'Sneeuwveldbies', 'Luzula nivea', 'vaste', 50, 40, 'overhangend', 'pluim', '#f4f2e8', '6-7', 'hs', 'n', 'ev k=gras'),
  P('zegge', 'Japanse zegge', "Carex morrowii 'Ice Dance'", 'vaste', 30, 50, 'overhangend', 'blad', '#e8e4c0', '4-5', 'hs', 'nv', 'ev k=gras'),
  // ---- kruiden
  P('salie_kruid', 'Echte salie', 'Salvia officinalis', 'kruid', 50, 60, 'kussen', 'aar', '#8a7ad0', '6-7', 'z', 'd', 'f=zilver ev b'),
  P('rozemarijn', 'Rozemarijn', 'Salvia rosmarinus', 'kruid', 80, 80, 'bol', 'aar', '#8aa0d8', '4-5', 'z', 'd', 'ev f=zilver b'),
  P('bieslook', 'Bieslook', 'Allium schoenoprasum', 'kruid', 30, 25, 'rechtop', 'knop', '#c890c8', '5-7', 'z', 'n', 'b'),
  P('munt', 'Munt', 'Mentha spicata', 'kruid', 50, 60, 'kussen', 'aar', '#c8a8d8', '7-8', 'zh', 'nv', 'b'),
  P('citroenmelisse', 'Citroenmelisse', 'Melissa officinalis', 'kruid', 60, 50, 'kussen', 'blad', '#f4f2e8', '7', 'zh', 'n', 'b'),
  P('venkel', 'Bronzen venkel', "Foeniculum vulgare 'Purpureum'", 'kruid', 150, 60, 'ijl', 'scherm', '#d8c84a', '7-9', 'z', 'dn', 'f=rood b'),
  P('tijm', 'Echte tijm', 'Thymus vulgaris', 'kruid', 25, 30, 'kussen', 'scherm', '#d0b0d8', '5-7', 'z', 'd', 'ev b'),
  // ---- moeilijke plekken: droge schaduw, natte zon
  P('amandelwolfsmelk', 'Amandelwolfsmelk', 'Euphorbia amygdaloides var. robbiae', 'vaste', 50, 50, 'kussen', 'scherm', '#d4dc60', '4-5', 'hs', 'dn', 'ev'),
  P('kussenwolfsmelk', 'Kussenwolfsmelk', 'Euphorbia polychroma', 'vaste', 40, 50, 'bol', 'scherm', '#e8e040', '4-5', 'zh', 'd', 'a=rood'),
  P('stinkende_iris', 'Stinkende lis', 'Iris foetidissima', 'vaste', 50, 50, 'overhangend', 'knop', '#8a7ab0', '6', 'hs', 'dn', 'n ev k=zwaard'),
  P('stinkend_nieskruid', 'Stinkend nieskruid', 'Helleborus foetidus', 'vaste', 50, 50, 'bol', 'knop', '#c8d8a0', '2-4', 'hs', 'd', 'n ev'),
  P('bosaster', 'Bosaster', 'Eurybia divaricata', 'vaste', 60, 50, 'ijl', 'schijf', '#f4f2ec', '8-10', 'hs', 'dn', 'b'),
  P('knopige_ooievaarsbek', 'Knopige ooievaarsbek', 'Geranium nodosum', 'vaste', 40, 50, 'kussen', 'schijf', '#c070b0', '6-10', 'hs', 'dn', 'b'),
  P('ooievaarsbek_biokovo', 'Ooievaarsbek, wit-roze', "Geranium × cantabrigiense 'Biokovo'", 'bodem', 25, 50, 'spreidend', 'schijf', '#f4dce4', '5-7', 'zh', 'dn', 'ev b'),
  P('smeerwortel_bodem', 'Kleine smeerwortel', 'Symphytum grandiflorum', 'bodem', 30, 60, 'spreidend', 'knop', '#f4ecd0', '4-5', 'hs', 'dn', 'b'),
  P('gele_dovenetel', 'Gele dovenetel', 'Lamiastrum galeobdolon', 'bodem', 25, 60, 'spreidend', 'aar', '#e8d040', '4-6', 'hs', 'dn', 'n f=zilver b'),
  P('grote_veldbies', 'Grote veldbies', 'Luzula sylvatica', 'gras', 50, 50, 'overhangend', 'pluim', '#b8a878', '4-6', 'hs', 'dn', 'n ev'),
  P('geschubde_mannetjesvaren', 'Geschubde mannetjesvaren', 'Dryopteris affinis', 'varen', 90, 80, 'overhangend', 'blad', '#4f8a3a', '', 'hs', 'dn', 'n ev'),
  P('bosbingelkruid_aster', 'Grootbladige aster', 'Eurybia macrophylla', 'vaste', 70, 60, 'bol', 'schijf', '#c8b8e8', '8-9', 'hs', 'd', 'b'),
  P('vingerhoedskruid_roest', 'Roestig vingerhoedskruid', 'Digitalis ferruginea', 'vaste', 130, 40, 'rechtop', 'aar', '#c89a4a', '6-7', 'zh', 'd', 'b w=silhouet'),
  P('duizendknoop_wit', 'Witte duizendknoop', 'Persicaria polymorpha', 'vaste', 170, 120, 'bol', 'pluim', '#f6f2e6', '6-9', 'zh', 'dn', 'b'),
  P('adderwortel', 'Adderwortel', "Bistorta officinalis 'Superba'", 'vaste', 70, 50, 'rechtop', 'aar', '#e8a8c0', '5-7', 'zh', 'nv', 'n b'),
  P('penningkruid', 'Penningkruid', 'Lysimachia nummularia', 'bodem', 8, 50, 'spreidend', 'schijf', '#f0d030', '6-8', 'zh', 'v', 'n'),
  P('brunel', 'Gewone brunel', 'Prunella vulgaris', 'bodem', 15, 30, 'spreidend', 'aar', '#7a5ab8', '6-9', 'zh', 'nv', 'n b'),
  P('dotterbloem', 'Dotterbloem', 'Caltha palustris', 'vaste', 30, 40, 'kussen', 'schijf', '#f4d020', '3-5', 'zh', 'v', 'n b'),
  P('moerasvergeetmijniet', 'Moerasvergeet-mij-niet', 'Myosotis scorpioides', 'bodem', 25, 30, 'spreidend', 'schijf', '#7aa0e8', '5-8', 'zh', 'v', 'n b'),
  P('gele_lis', 'Gele lis', 'Iris pseudacorus', 'vaste', 100, 50, 'overhangend', 'knop', '#f0d030', '5-6', 'zh', 'v', 'n k=zwaard'),
  P('kogelbloem', 'Kogelbloem', 'Trollius × cultorum', 'vaste', 60, 40, 'rechtop', 'knop', '#f0a020', '5-6', 'zh', 'v', 'b'),
  P('knikkend_nagelkruid', 'Knikkend nagelkruid', 'Geum rivale', 'vaste', 40, 40, 'kussen', 'knop', '#c86a5a', '5-6', 'zh', 'v', 'n b'),
  P('ligularia', 'Kruiskruid', "Ligularia 'The Rocket'", 'vaste', 160, 80, 'rechtop', 'aar', '#f0c020', '7-8', 'hs', 'v', 'b'),
  P('kattenstaart_laag', 'Rode kattenstaart, compact', "Lythrum virgatum 'Dropmore Purple'", 'vaste', 80, 50, 'rechtop', 'aar', '#b04a9a', '7-9', 'z', 'v', 'b'),
  P('moerasmelkdistel', 'Moerasspirea', 'Filipendula ulmaria', 'vaste', 120, 60, 'rechtop', 'pluim', '#f6f2e4', '6-8', 'zh', 'v', 'n b'),
  // ---- siergrassen
  P('struisriet', 'Struisriet', "Calamagrostis × acutiflora 'Karl Foerster'", 'gras', 160, 50, 'rechtop', 'pluim', '#c8a870', '6-9', 'z', 'n', 'a=geel'),
  P('prachtriet', 'Prachtriet', "Miscanthus sinensis 'Gracillimus'", 'gras', 180, 100, 'overhangend', 'pluim', '#d0b8a0', '9-10', 'z', 'n', 'a=brons'),
  P('prachtriet_klein', 'Prachtriet, klein', "Miscanthus sinensis 'Kleine Fontäne'", 'gras', 150, 80, 'overhangend', 'pluim', '#d0a8a0', '8-10', 'z', 'n', 'a=brons'),
  P('pijpenstrootje', 'Pijpenstrootje', "Molinia caerulea 'Moorhexe'", 'gras', 80, 40, 'rechtop', 'pluim', '#8a7a5a', '8-9', 'z', 'nv', 'n a=geel'),
  P('vingergras', 'Vingergras', "Panicum virgatum 'Heavy Metal'", 'gras', 120, 60, 'rechtop', 'pluim', '#c8a0a0', '8-10', 'z', 'dn', 'f=blauw a=geel'),
  P('lampenpoetsergras', 'Lampenpoetsersgras', "Pennisetum alopecuroides 'Hameln'", 'gras', 70, 70, 'overhangend', 'pluim', '#e0d8c8', '8-10', 'z', 'dn', 'a=geel'),
  P('smele', 'Ruwe smele', "Deschampsia cespitosa 'Goldtau'", 'gras', 70, 50, 'overhangend', 'pluim', '#d8c070', '6-8', 'zh', 'nv', 'n'),
  P('japans_bosgras', 'Japans bosgras', "Hakonechloa macra 'Aureola'", 'gras', 35, 50, 'overhangend', 'blad', '#e0d080', '8-9', 'hs', 'nv', 'f=geel a=oranje'),
  P('blauwgras', 'Herfstblauwgras', 'Sesleria autumnalis', 'gras', 40, 40, 'overhangend', 'pluim', '#e8e8c8', '8-10', 'zh', 'dn', 'ev'),
  P('blauw_schapengras', 'Blauw schapengras', "Festuca glauca 'Elijah Blue'", 'gras', 25, 30, 'kussen', 'pluim', '#c8c8b0', '6-7', 'z', 'd', 'f=blauw ev'),
  P('vedergras', 'Vedergras', 'Stipa tenuissima', 'gras', 60, 40, 'overhangend', 'pluim', '#e8dcb0', '6-9', 'z', 'd', ''),
  P('reuzenvedergras', 'Reuzenvedergras', 'Stipa gigantea', 'gras', 200, 100, 'ijl', 'pluim', '#d8b860', '6-8', 'z', 'd', ''),
  P('fazantengras', 'Fazantengras', 'Anemanthele lessoniana', 'gras', 70, 80, 'overhangend', 'pluim', '#c89060', '7-9', 'zh', 'n', 'ev f=geel'),
  P('prairiedropzaad', 'Prairiedropzaad', 'Sporobolus heterolepis', 'gras', 60, 60, 'overhangend', 'pluim', '#d8d0b0', '8-9', 'z', 'd', 'a=oranje'),
  P('bevertjes', 'Bevertjes', 'Briza media', 'gras', 40, 30, 'ijl', 'pluim', '#c8b880', '5-7', 'z', 'd', 'n'),
  // ---- varens
  P('mannetjesvaren', 'Mannetjesvaren', 'Dryopteris filix-mas', 'varen', 90, 90, 'overhangend', 'blad', '#4f8a3a', '', 'hs', 'nv', 'n a=brons'),
  P('naaldvaren', 'Zachte naaldvaren', 'Polystichum setiferum', 'varen', 60, 80, 'overhangend', 'blad', '#4f8a3a', '', 'hs', 'n', 'ev'),
  P('wijfjesvaren', 'Wijfjesvaren', 'Athyrium filix-femina', 'varen', 80, 70, 'overhangend', 'blad', '#5f9a45', '', 'hs', 'nv', 'n'),
  P('koningsvaren', 'Koningsvaren', 'Osmunda regalis', 'varen', 120, 100, 'overhangend', 'blad', '#5f9a45', '', 'hs', 'v', 'n a=geel'),
  P('struisvaren', 'Struisvaren', 'Matteuccia struthiopteris', 'varen', 100, 80, 'overhangend', 'blad', '#6aa04a', '', 'hs', 'v', ''),
  P('tongvaren', 'Tongvaren', 'Asplenium scolopendrium', 'varen', 40, 50, 'overhangend', 'blad', '#4f8a3a', '', 'hs', 'n', 'n ev'),
  // ---- bolgewassen
  P('tulp_oranje', 'Tulp, oranje', "Tulipa 'Ballerina'", 'bol', 50, 15, 'rechtop', 'knop', '#e8702a', '4-5', 'z', 'dn', ''),
  P('tulp_zwart', 'Tulp, donkerpaars', "Tulipa 'Queen of Night'", 'bol', 60, 15, 'rechtop', 'knop', '#3a1a3a', '5', 'z', 'dn', ''),
  P('narcis', 'Narcis, wit', "Narcissus 'Thalia'", 'bol', 35, 15, 'rechtop', 'schijf', '#fafaf0', '3-4', 'zh', 'n', ''),
  P('narcis_geel', 'Narcis, geel', "Narcissus 'Tête-à-tête'", 'bol', 15, 10, 'rechtop', 'schijf', '#f4d020', '3', 'zh', 'n', ''),
  P('krokus', 'Boerenkrokus', 'Crocus tommasinianus', 'bol', 10, 8, 'rechtop', 'knop', '#b090d8', '2-3', 'zh', 'n', 'b'),
  P('sneeuwklokje', 'Sneeuwklokje', 'Galanthus nivalis', 'bol', 15, 8, 'rechtop', 'knop', '#fafafa', '2', 'hs', 'n', 'n'),
  P('blauwe_druif', 'Blauwe druifjes', 'Muscari armeniacum', 'bol', 15, 8, 'rechtop', 'aar', '#4a5ad0', '4', 'z', 'n', 'b'),
  P('wilde_hyacint', 'Wilde hyacint', 'Hyacinthoides non-scripta', 'bol', 30, 10, 'rechtop', 'aar', '#6a6ad0', '4-5', 's', 'n', 'n'),
  P('prairielelie', 'Prairielelie', "Camassia leichtlinii 'Caerulea'", 'bol', 80, 15, 'rechtop', 'aar', '#6a7ad8', '5', 'zh', 'v', 'b'),
  P('sierui', 'Sierui', "Allium 'Purple Sensation'", 'bol', 80, 15, 'ijl', 'knop', '#8a4ab8', '5-6', 'z', 'dn', 'b'),
  P('sierui_groot', 'Sierui, groot', "Allium 'Globemaster'", 'bol', 90, 20, 'ijl', 'knop', '#8a5ac0', '6', 'z', 'dn', 'b'),
  P('kogellook', 'Kogellook', 'Allium sphaerocephalon', 'bol', 60, 10, 'ijl', 'knop', '#8a2a5a', '7', 'z', 'd', 'b'),
  P('kievitsbloem', 'Kievitsbloem', 'Fritillaria meleagris', 'bol', 25, 8, 'rechtop', 'knop', '#8a4a6a', '4', 'hs', 'v', 'n'),
  P('oosterse_sneeuwroem', 'Sterhyacint', 'Scilla siberica', 'bol', 12, 8, 'rechtop', 'schijf', '#3a5ad0', '3', 'zh', 'n', 'b'),
  P('anemoon_blanda', 'Oosterse anemoon', 'Anemone blanda', 'bol', 10, 10, 'spreidend', 'schijf', '#6a6ad8', '3-4', 'hs', 'n', ''),
  P('koningslelie', 'Koningslelie', 'Lilium regale', 'bol', 120, 25, 'rechtop', 'knop', '#fafaf0', '7', 'z', 'n', ''),
  // ---- heesters
  P('buxus_bol', 'Buxus (bol)', 'Buxus sempervirens', 'heester', 100, 100, 'bol', 'blad', '#e8e8c0', '4', 'zhs', 'n', 'ev f=donker'),
  P('japanse_hulst', 'Japanse hulst (bol)', 'Ilex crenata', 'heester', 100, 100, 'bol', 'blad', '#f4f2e8', '6', 'zhs', 'n', 'ev f=donker'),
  P('taxus_bol', 'Taxus (bol)', 'Taxus baccata', 'heester', 120, 120, 'bol', 'blad', '#e8e8c0', '3', 'zhs', 'dn', 'ev f=donker n'),
  P('hortensia', 'Hortensia', 'Hydrangea macrophylla', 'heester', 120, 120, 'bol', 'scherm', '#8aa0e0', '7-9', 'hs', 'nv', ''),
  P('hortensia_annabelle', 'Bolhortensia', "Hydrangea arborescens 'Annabelle'", 'heester', 120, 120, 'bol', 'scherm', '#f2f2e0', '7-9', 'zh', 'n', ''),
  P('pluimhortensia', 'Pluimhortensia', "Hydrangea paniculata 'Limelight'", 'heester', 180, 150, 'bol', 'pluim', '#e8f0c8', '8-10', 'zh', 'n', ''),
  P('vlinderstruik', 'Vlinderstruik', 'Buddleja davidii', 'heester', 250, 200, 'overhangend', 'pluim', '#8a5ab8', '7-9', 'z', 'dn', 'b'),
  P('roos_fairy', 'Bodembedekkende roos', "Rosa 'The Fairy'", 'heester', 60, 90, 'bol', 'schijf', '#f0b0c8', '6-10', 'z', 'n', 'b'),
  P('roos_bonica', 'Struikroos', "Rosa 'Bonica'", 'heester', 100, 100, 'bol', 'schijf', '#f0a0b8', '6-10', 'z', 'n', 'b'),
  P('rimpelroos', 'Rimpelroos', 'Rosa rugosa', 'heester', 150, 150, 'bol', 'schijf', '#c03a8a', '6-9', 'z', 'd', 'n b a=geel'),
  P('spirea_laag', 'Spirea, laag', "Spiraea japonica 'Little Princess'", 'heester', 60, 80, 'bol', 'scherm', '#e8a0c0', '6-7', 'z', 'n', 'b'),
  P('bruidsbloem', 'Bruidssluier-spirea', 'Spiraea × vanhouttei', 'heester', 200, 200, 'overhangend', 'scherm', '#fafaf0', '5', 'zh', 'n', ''),
  P('weigela', 'Weigela', 'Weigela florida', 'heester', 200, 200, 'bol', 'knop', '#e07aa0', '5-6', 'zh', 'n', 'b'),
  P('deutzia', 'Bruidsbloem', 'Deutzia gracilis', 'heester', 80, 100, 'bol', 'knop', '#fafaf0', '5-6', 'zh', 'n', ''),
  P('boerenjasmijn', 'Boerenjasmijn', 'Philadelphus coronarius', 'heester', 250, 200, 'bol', 'knop', '#fafaf0', '6', 'zh', 'n', 'b'),
  P('forsythia', 'Forsythia', 'Forsythia × intermedia', 'heester', 250, 200, 'overhangend', 'knop', '#f4d020', '3-4', 'zh', 'n', ''),
  P('gelderse_roos', 'Gelderse roos', 'Viburnum opulus', 'heester', 300, 250, 'bol', 'scherm', '#fafaf0', '5-6', 'zh', 'nv', 'n b a=rood'),
  P('sneeuwbal_tinus', 'Sneeuwbal (wintergroen)', 'Viburnum tinus', 'heester', 200, 150, 'bol', 'scherm', '#f4ecec', '2-4', 'zh', 'n', 'ev'),
  P('japanse_sneeuwbal', 'Japanse sneeuwbal', "Viburnum plicatum 'Mariesii'", 'heester', 200, 300, 'spreidend', 'scherm', '#fafaf0', '5-6', 'zh', 'n', 'a=rood'),
  P('rode_kornoelje', 'Rode kornoelje', "Cornus alba 'Sibirica'", 'heester', 200, 200, 'bol', 'scherm', '#f4f2e8', '5-6', 'zh', 'nv', 'a=rood'),
  P('rotsheide', 'Rotsheide', 'Pieris japonica', 'heester', 150, 120, 'bol', 'pluim', '#fafaf0', '3-4', 'hs', 'n', 'ev'),
  P('rododendron', 'Rododendron', 'Rhododendron', 'heester', 150, 150, 'bol', 'knop', '#c05a9a', '5', 'hs', 'n', 'ev'),
  P('azalea', 'Azalea', 'Rhododendron japonicum', 'heester', 80, 100, 'bol', 'knop', '#e07a8a', '5', 'hs', 'n', 'a=oranje'),
  P('skimmia', 'Skimmia', 'Skimmia japonica', 'heester', 100, 100, 'bol', 'scherm', '#f4ece8', '4', 'hs', 'n', 'ev'),
  P('kardinaalsmuts', 'Kardinaalsmuts (bont)', "Euonymus fortunei 'Emerald Gaiety'", 'heester', 50, 100, 'spreidend', 'blad', '#f4f2e8', '6', 'zhs', 'n', 'ev f=zilver'),
  P('laurierkers', 'Laurierkers, laag', "Prunus laurocerasus 'Otto Luyken'", 'heester', 100, 150, 'spreidend', 'blad', '#fafaf0', '4-5', 'zhs', 'n', 'ev f=donker'),
  P('blauwbaard', 'Blauwe spirea', 'Caryopteris × clandonensis', 'heester', 80, 80, 'bol', 'aar', '#6a7ad8', '8-9', 'z', 'd', 'f=zilver b'),
  P('schoonvrucht', 'Schoonvrucht', 'Callicarpa bodinieri', 'heester', 200, 150, 'bol', 'knop', '#c070d0', '9-11', 'zh', 'n', 'a=rood'),
  P('fuchsia', 'Winterharde fuchsia', 'Fuchsia magellanica', 'heester', 120, 100, 'overhangend', 'knop', '#c0284a', '7-10', 'zh', 'n', ''),
  P('altheastruik', 'Altheastruik', 'Hibiscus syriacus', 'heester', 200, 150, 'rechtop', 'schijf', '#a080d0', '8-9', 'z', 'n', 'b'),
  P('vlier', 'Gewone vlier', 'Sambucus nigra', 'heester', 400, 300, 'bol', 'scherm', '#fafaf0', '6', 'zh', 'n', 'n b'),
  P('hazelaar', 'Hazelaar', 'Corylus avellana', 'heester', 500, 400, 'bol', 'blad', '#e8d880', '2-3', 'zh', 'n', 'n a=geel'),
  P('meidoorn', 'Eenstijlige meidoorn', 'Crataegus monogyna', 'heester', 600, 400, 'bol', 'scherm', '#fafaf0', '5', 'z', 'n', 'n b a=rood'),
  P('mahonie', 'Mahonie', 'Mahonia aquifolium', 'heester', 120, 120, 'bol', 'pluim', '#f0d040', '3-4', 'hs', 'dn', 'ev a=rood b'),
  P('hulst', 'Hulst', 'Ilex aquifolium', 'heester', 300, 200, 'bol', 'blad', '#f4f2e8', '5', 'zhs', 'dn', 'n ev f=donker'),
  P('sneeuwbes', 'Sneeuwbes', 'Symphoricarpos albus', 'heester', 150, 150, 'bol', 'knop', '#fafafa', '7-10', 'zhs', 'dn', 'b'),
  P('struikkamperfoelie', 'Struikkamperfoelie', 'Lonicera pileata', 'heester', 60, 120, 'spreidend', 'blad', '#f4f2d8', '5', 'zhs', 'dn', 'ev'),
  P('rode_ribes', 'Rode ribes', 'Ribes sanguineum', 'heester', 200, 150, 'bol', 'aar', '#d0507a', '4', 'zh', 'dn', 'b'),
  P('christusdoorn_struik', 'Vingerstruik', "Potentilla fruticosa 'Goldfinger'", 'heester', 80, 100, 'bol', 'schijf', '#f0c020', '6-10', 'z', 'dn', 'b'),
  P('zonneroosje', 'Zonneroos', 'Cistus × hybridus', 'heester', 80, 100, 'bol', 'schijf', '#fafaf0', '6-7', 'z', 'd', 'ev'),
  P('ceanothus', 'Amerikaanse sering', "Ceanothus 'Concha'", 'heester', 200, 200, 'bol', 'pluim', '#4a6ac8', '5-6', 'z', 'd', 'ev b'),
  P('kardinaalsmuts_wild', 'Wilde kardinaalsmuts', 'Euonymus europaeus', 'heester', 300, 250, 'bol', 'knop', '#e06a8a', '9-11', 'zh', 'n', 'n a=rood'),
  P('appelbes', 'Appelbes', 'Aronia melanocarpa', 'heester', 150, 150, 'bol', 'scherm', '#fafaf0', '5', 'zh', 'nv', 'a=rood b'),
  P('schijnels', 'Schijnels', 'Clethra alnifolia', 'heester', 150, 150, 'bol', 'aar', '#fafaf0', '7-9', 'zh', 'v', 'b a=geel'),
  P('kattenwilg', 'Kattenwilg (dwerg)', "Salix purpurea 'Nana'", 'heester', 150, 150, 'bol', 'blad', '#d8d8a0', '3', 'z', 'nv', 'n'),
  P('blaasspirea', 'Blaasspirea', "Physocarpus opulifolius 'Diabolo'", 'heester', 200, 200, 'bol', 'scherm', '#f4e8e8', '6', 'zh', 'dn', 'f=rood'),
  P('wilde_kornoelje', 'Rode kornoelje (inheems)', 'Cornus sanguinea', 'heester', 300, 250, 'bol', 'scherm', '#fafaf0', '5-6', 'zh', 'nv', 'n b a=rood'),
  P('vuurdoorn', 'Vuurdoorn', 'Pyracantha coccinea', 'heester', 250, 200, 'bol', 'scherm', '#fafaf0', '5-6', 'zh', 'dn', 'ev b'),
  // ---- hagen (bijbehorend haagstencil)
  P('liguster', 'Liguster', 'Ligustrum ovalifolium', 'haag', 180, 60, 'rechtop', 'blad', '#f4f2e8', '7', 'zhs', 'n', 'ev st=haag'),
  P('taxushaag', 'Taxus (haag)', 'Taxus baccata', 'haag', 180, 60, 'rechtop', 'blad', '#e8e8c0', '3', 'zhs', 'dn', 'ev f=donker n st=haag'),
  P('beukenhaag', 'Beuk (haag)', 'Fagus sylvatica', 'haag', 200, 60, 'rechtop', 'blad', '#e8d880', '5', 'zh', 'n', 'n a=brons st=haag_beuk'),
  P('haagbeuk', 'Haagbeuk (haag)', 'Carpinus betulus', 'haag', 200, 60, 'rechtop', 'blad', '#e8d880', '5', 'zhs', 'nv', 'n a=geel st=haag_beuk'),
  P('buxusrand', 'Buxus (lage rand)', 'Buxus sempervirens', 'haag', 40, 30, 'rechtop', 'blad', '#e8e8c0', '4', 'zhs', 'n', 'ev f=donker st=haag_laag'),
  P('ilexrand', 'Japanse hulst (lage rand)', 'Ilex crenata', 'haag', 50, 30, 'rechtop', 'blad', '#f4f2e8', '6', 'zhs', 'n', 'ev f=donker st=haag_laag'),
  P('inheemse_haag', 'Gemengde inheemse haag', 'Crataegus, Corylus, Prunus spinosa', 'haag', 250, 120, 'bol', 'scherm', '#fafaf0', '4-5', 'zh', 'n', 'n b st=haag_inheems'),
  P('rozenhaag', 'Rozenhaag', 'Rosa rugosa', 'haag', 150, 100, 'bol', 'schijf', '#c03a8a', '6-9', 'z', 'd', 'b st=haag_bloei'),
  P('bamboe', 'Bamboe (niet woekerend)', 'Fargesia murielae', 'haag', 300, 100, 'overhangend', 'blad', '#9ab85a', '', 'zh', 'n', 'ev st=bamboe'),
  // ---- bomen (bijbehorend boomstencil)
  P('lijsterbes', 'Lijsterbes', 'Sorbus aucuparia', 'boom', 800, 400, 'bol', 'scherm', '#fafaf0', '5', 'zh', 'n', 'n b a=oranje st=lijsterbes'),
  P('zuilpopulier', 'Zuilpopulier', "Populus nigra 'Italica'", 'boom', 2500, 250, 'rechtop', 'blad', '#a08060', '3', 'z', 'nv', 'a=geel st=populier'),
  P('ruwe_berk', 'Ruwe berk', 'Betula pendula', 'boom', 1500, 500, 'ijl', 'blad', '#c8b070', '4', 'zh', 'dn', 'n a=geel st=berk'),
  P('zomereik', 'Zomereik', 'Quercus robur', 'boom', 2500, 1200, 'bol', 'blad', '#c8c070', '5', 'z', 'n', 'n a=brons st=eik'),
  P('beuk', 'Beuk', 'Fagus sylvatica', 'boom', 2500, 1200, 'bol', 'blad', '#c8c070', '5', 'zh', 'n', 'n a=brons st=beuk'),
  P('rode_beuk', 'Rode beuk', "Fagus sylvatica 'Purpurea'", 'boom', 2000, 1000, 'bol', 'blad', '#c8a070', '5', 'zh', 'n', 'f=rood a=brons st=rodebeuk'),
  P('linde', 'Zomerlinde', 'Tilia platyphyllos', 'boom', 2000, 1000, 'bol', 'scherm', '#f0e8a0', '6-7', 'zh', 'n', 'n b a=geel st=linde'),
  P('noorse_esdoorn', 'Noorse esdoorn', 'Acer platanoides', 'boom', 1800, 900, 'bol', 'scherm', '#d8e070', '4', 'zh', 'n', 'a=geel st=esdoorn'),
  P('japanse_esdoorn', 'Japanse esdoorn', "Acer palmatum 'Atropurpureum'", 'boom', 300, 300, 'bol', 'blad', '#a03040', '5', 'zh', 'n', 'f=rood a=rood st=japanseesdoorn'),
  P('bolesdoorn', 'Bolesdoorn', "Acer platanoides 'Globosum'", 'boom', 500, 400, 'bol', 'blad', '#d8e070', '4', 'zh', 'n', 'a=geel st=bolesdoorn'),
  P('krentenboom', 'Krentenboompje', 'Amelanchier lamarckii', 'boom', 500, 400, 'bol', 'knop', '#fafaf0', '4', 'zh', 'n', 'b a=rood st=krentenboom'),
  P('sierkers', 'Japanse sierkers', "Prunus serrulata 'Kanzan'", 'boom', 700, 600, 'bol', 'knop', '#f4b6c8', '4-5', 'z', 'n', 'b a=oranje st=sierkers'),
  P('magnolia', 'Tulpenboom (magnolia)', 'Magnolia × soulangeana', 'boom', 500, 500, 'bol', 'knop', '#f2c0d4', '4', 'zh', 'n', 'st=magnolia'),
  P('treurwilg', 'Treurwilg', "Salix × sepulcralis 'Chrysocoma'", 'boom', 1500, 1000, 'overhangend', 'blad', '#e8e080', '4', 'z', 'v', 'a=geel st=treurwilg'),
  P('walnoot', 'Walnoot', 'Juglans regia', 'boom', 2000, 1200, 'bol', 'blad', '#c8c070', '5', 'z', 'n', 'a=geel st=walnoot'),
  P('paardenkastanje', 'Paardenkastanje', 'Aesculus hippocastanum', 'boom', 2500, 1200, 'bol', 'aar', '#fafaf0', '5', 'zh', 'n', 'b a=brons st=kastanje'),
  P('grove_den', 'Grove den', 'Pinus sylvestris', 'boom', 2000, 700, 'ijl', 'blad', '#c8c070', '5', 'z', 'd', 'n ev st=den'),
  P('ginkgo', 'Japanse notenboom', 'Ginkgo biloba', 'boom', 1500, 600, 'rechtop', 'blad', '#c8c070', '', 'z', 'n', 'a=geel st=ginkgo'),
  P('amberboom', 'Amberboom', 'Liquidambar styraciflua', 'boom', 1500, 700, 'rechtop', 'blad', '#c8c070', '', 'z', 'nv', 'a=rood st=amberboom'),
  P('valse_christusdoorn', 'Valse christusdoorn', "Gleditsia triacanthos 'Sunburst'", 'boom', 1200, 800, 'ijl', 'blad', '#c8c070', '6', 'z', 'dn', 'f=geel a=geel st=gleditsia'),
  P('olijfboom', 'Olijfboom', 'Olea europaea', 'boom', 300, 300, 'bol', 'blad', '#f4f2e8', '6', 'z', 'd', 'ev f=zilver st=olijf'),
  P('vijgenboom', 'Vijgenboom', 'Ficus carica', 'boom', 400, 400, 'bol', 'blad', '#a0b060', '', 'z', 'dn', 'a=geel st=vijg'),
  P('trompetboom', 'Trompetboom (bolvorm)', 'Catalpa bungei', 'boom', 500, 500, 'bol', 'blad', '#c8c070', '', 'z', 'n', 'st=trompetboom'),
  P('appelboom', 'Appelboom', 'Malus domestica', 'boom', 400, 400, 'bol', 'knop', '#f8e0e8', '4-5', 'z', 'n', 'b a=geel st=appel'),
  P('perenboom', 'Perenboom', 'Pyrus communis', 'boom', 500, 400, 'bol', 'knop', '#fafaf0', '4', 'z', 'n', 'b a=geel st=fruitboom'),
  // ---- klimplanten (bijbehorende begroeiing van pergola's en klimplantstencils)
  P('klimroos', 'Klimroos', "Rosa 'New Dawn'", 'klimmer', 400, 200, 'overhangend', 'schijf', '#f4c8d4', '6-10', 'zh', 'n', 'b climb=roos st=klimplant'),
  P('blauwe_regen', 'Blauweregen', 'Wisteria sinensis', 'klimmer', 1000, 400, 'overhangend', 'pluim', '#9b7fd1', '5-6', 'z', 'n', 'b climb=blauweregen st=klimplant'),
  P('bosrank', 'Bosrank', 'Clematis montana', 'klimmer', 800, 300, 'overhangend', 'schijf', '#f0c0d8', '5-6', 'zh', 'n', 'b climb=clematis st=klimplant'),
  P('kamperfoelie', 'Wilde kamperfoelie', 'Lonicera periclymenum', 'klimmer', 500, 200, 'overhangend', 'knop', '#e8c35a', '6-9', 'zh', 'n', 'n b climb=kamperfoelie st=klimplant'),
  P('klimop', 'Klimop', 'Hedera helix', 'klimmer', 1000, 300, 'overhangend', 'blad', '#a0b060', '9-10', 'zhs', 'n', 'n ev b climb=groen st=klimplant'),
  P('wingerd', 'Wilde wingerd', 'Parthenocissus tricuspidata', 'klimmer', 1500, 500, 'overhangend', 'blad', '#c8c070', '', 'zhs', 'n', 'a=rood climb=herfst st=klimplant'),
  P('druif', 'Druif', 'Vitis vinifera', 'klimmer', 600, 300, 'overhangend', 'blad', '#c8c070', '6', 'z', 'n', 'a=geel climb=druif st=klimplant'),
  P('hop', 'Hop', 'Humulus lupulus', 'klimmer', 600, 200, 'overhangend', 'blad', '#c8d080', '7-9', 'zh', 'nv', 'n climb=groen st=klimplant'),
];

/** Alle planten (ingebouwd plus wat er later uit een externe bron is toegevoegd). */
export const PLANTS = new Map(DATA.map((p) => [p.id, p]));

/** Planten uit een andere bron toevoegen (zelfde velden); bestaande id's worden bijgewerkt. */
export function addPlants(list) {
  for (const p of list) if (p && p.id && p.nl) PLANTS.set(p.id, { ...PLANTS.get(p.id), ...p });
}

export function plantById(id) {
  return PLANTS.get(id) || null;
}

/** Hoogteklasse van de app (bodem, laag, middel, hoog, xhoog) bij een hoogte in cm. */
export function heightClass(p) {
  if (p.type === 'bodem' || p.h <= 30) return 'bodem';
  if (p.h <= 60) return 'laag';
  if (p.h <= 120) return 'middel';
  if (p.h <= 220) return 'hoog';
  return 'xhoog';
}

/** Welke hoogtes passen bij een type plantvak uit de schets. */
export const BEDTYPE_HEIGHTS = {
  beloopbaar: ['bodem'],
  bodem: ['bodem'],
  laag: ['bodem', 'laag'],
  middel: ['laag', 'middel'],
  hoog: ['middel', 'hoog'],
  heesters: ['hoog', 'xhoog'],
};

/** Past deze plant (of bouwsteen met een hoogteklasse) in een plantvak van dit type? */
export function fitsBedType(heightCls, btype, kind) {
  if (!btype || !BEDTYPE_HEIGHTS[btype]) return true;
  if (btype === 'heesters') return kind === 'heester' || ['hoog', 'xhoog'].includes(heightCls);
  if (kind === 'boom' || kind === 'haag') return false;
  if (kind === 'bol') return true; // bolgewassen komen en gaan: ze passen overal tussen
  return BEDTYPE_HEIGHTS[btype].includes(heightCls);
}

/** Rol in het vak die meestal bij deze plant hoort. */
export function defaultRole(p) {
  if (['boom', 'heester', 'haag', 'klimmer'].includes(p.type)) return 'structuur';
  if (p.type !== 'bol' && hasTrait(p, 'structuur')) return 'structuur';
  if (p.type === 'gras' && p.h >= 60) return 'structuur';
  if (p.type === 'bol' || p.habit === 'ijl' || p.form === 'knop') return 'accent';
  if (p.h >= 100 && p.habit === 'rechtop') return 'structuur';
  return 'vulling';
}

/** Eigenschappen voor een bouwsteen (en voor de tekening) bij een plant uit de database. */
export function roleFromPlant(p) {
  const kind = p.kind || { gras: 'gras', varen: 'varen', bol: 'bol', bodem: 'bodem', heester: 'heester', haag: 'haag', boom: 'boom', klimmer: 'klimmer' }[p.type];
  return {
    plant: p.id,
    label: p.nl,
    height: heightClass(p),
    // bij Esveld: de plantafstand volgt uit het aanbevolen aantal per m² (de planten groeien aaneen)
    d: Math.max(0.12, (p.w || 40) / 100, p.esv?.perM2 ? Math.sqrt(1 / (0.866 * p.esv.perM2)) / 0.85 : 0),
    habit: p.habit,
    form: p.form,
    color: p.color,
    bloom: [...p.bloom],
    foliage: p.foliage,
    autumn: p.autumn,
    winter: p.winter,
    light: p.light.map((l) => (l === 'half' ? 'halfschaduw' : l)),
    ...(kind ? { kind } : {}),
    ...(p.stencil ? { stencil: p.stencil } : {}),
  };
}

const COLOR_FAMILIES = {
  wit: [0, 360, 0, 0.25, 0.85, 1.01], geel: [40, 70], oranje: [20, 40], rood: [345, 15], roze: [300, 345], paars: [255, 300], blauw: [200, 255], groen: [70, 170],
};

function hsl(hex) {
  const c = hex.replace('#', ''); const r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Kleurfamilie van een bloeikleur (wit, geel, oranje, rood, roze, paars, blauw, groen). */
export function colorFamily(hex) {
  if (!hex) return null;
  const [h, s, l] = hsl(hex);
  if (l > 0.85 || s < 0.15) return 'wit';
  for (const [k, v] of Object.entries(COLOR_FAMILIES)) {
    if (k === 'wit') continue;
    const [a, b] = v;
    if (a > b ? (h >= a || h < b) : (h >= a && h < b)) return k;
  }
  return 'paars';
}

/**
 * Planten zoeken. f: { q, type, height (klasse), light, soil, color (familie), month, native, bees, evergreen, btype, source ('esveld' | 'eigen') }.
 * Geeft de planten die passen, met wat er niet aan past (voor "past niet bij dit vak").
 */
export function searchPlants(f = {}) {
  const q = (f.q || '').trim().toLowerCase();
  const out = [];
  for (const p of PLANTS.values()) {
    if (q && !q.split(/\s+/).every((w) => `${p.nl} ${p.lat}`.toLowerCase().replace(/[‘’]/g, "'").includes(w))) continue;
    if (f.type && p.type !== f.type) continue;
    if (f.height && heightClass(p) !== f.height) continue;
    if (f.light && !lightFits(p.light, f.light)) continue;
    if (f.soil && !p.soil.includes(f.soil)) continue;
    if (f.color && colorFamily(p.color) !== f.color) continue;
    if (f.month && !p.bloom.includes(Number(f.month))) continue;
    if (f.native && !p.native) continue;
    if (f.bees && !p.bees) continue;
    if (f.evergreen && !p.evergreen) continue;
    if (f.source === 'esveld' && !p.esv) continue;
    if (f.traits?.length && !meetsAll(p, f.traits)) continue;
    if (f.source === 'eigen' && p.src === 'esveld') continue;
    const fits = fitsBedType(heightClass(p), f.btype, p.kind || p.type);
    if (f.onlyFit && !fits) continue;
    out.push({ p, fits });
  }
  // planten die al in het ontwerp staan (f.prefer) eerst
  const pref = (p) => (f.prefer?.has(p.id) ? 1 : 0);
  out.sort((a, b) => (b.fits - a.fits) || pref(b.p) - pref(a.p) || a.p.nl.localeCompare(b.p.nl, 'nl'));
  return out;
}
