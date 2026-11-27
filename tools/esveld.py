#!/usr/bin/env python3
"""Plantendatabase uit de webshop van Esveld (esveld.nl) maken.

Gebruik:
  python3 tools/esveld.py fetch RAW_DIR              # catalogus ophalen (Store API, 10 s pauze volgens robots.txt)
  python3 tools/esveld.py build RAW_DIR esveld.json  # het bestand maken

Het bestand hoort NIET in de repository (staat in .gitignore): importeer het in de app via
Instellingen > Esveld-catalogus importeren. Het wordt dan alleen op dat apparaat bewaard.

Alleen feitelijke kenmerken (naam, maten, bloei, standplaats, grond, prijs, potmaat) en de link naar de
productpagina worden bewaard; geen omschrijvingen of foto's. Elke cultivar is een eigen plant met zijn eigen
hoogte en breedte.
"""
import datetime
import glob
import html
import json
import os
import re
import sys
import time
import urllib.request

API = 'https://esveld.nl/a/wp-json/wc/store/v1/products?per_page=100&orderby=title&order=asc&page={}'
DELAY = 10  # Crawl-delay uit robots.txt

MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

# Bloemkleur (kenmerk) → kleur in de tekening
COLORS = {
    'blauw': '#5a6ad0', 'bont': '#d878a8', 'bruin': '#8a5a3a', 'creme': '#f2e8c8', 'geel': '#f0d040', 'grijs': '#b4b4ae',
    'groen': '#a8c070', 'lila': '#b49ad8', 'oranje': '#e8853a', 'paars': '#7a4aa8', 'rood': '#c83a3a', 'rose': '#e48ab8',
    'wit': '#f6f4ee', 'zwart': '#3a2a3a',
}
# Fijnere tinten uit de omschrijving ("De bloemkleur is donker lavendelblauw")
TINTS = [
    ('lavendel', '#9a8ad8'), ('violet', '#7a4ab8'), ('purper', '#8a2a7a'), ('wijnrood', '#8a1a3a'), ('karmijn', '#c0204a'),
    ('zalm', '#f0a08a'), ('abrikoos', '#f2b07a'), ('koper', '#c0703a'), ('magenta', '#c0307a'), ('roze', '#e48ab8'),
    ('lichtblauw', '#9ab4e8'), ('hemelsblauw', '#7aa4e8'), ('donkerblauw', '#3a4aa8'), ('zachtgeel', '#f2e08a'),
    ('citroengeel', '#f2e050'), ('goudgeel', '#e8b830'), ('helderrood', '#e0302a'), ('donkerrood', '#8a1a2a'),
    ('zuiver wit', '#fbfaf6'), ('roomwit', '#f4eedc'), ('lichtroze', '#f2c0d4'), ('zachtroze', '#f0c4d4'), ('helderroze', '#e870a8'),
]

FOLIAGE = {'groen': 'groen', 'blauw': 'blauw', 'grijs': 'zilver', 'geel': 'geel', 'bont': 'geel', 'rood': 'rood', 'paars': 'rood',
           'bruin': 'rood', 'zwart': 'rood', 'oranje': 'geel', 'rose': 'rood', 'wit': 'zilver'}

# Bloeivorm per geslacht (Esveld geeft die niet; naar Oudolf & Kingsbury)
FORMS = {
    'aar': 'Salvia Veronica Veronicastrum Agastache Nepeta Lavandula Perovskia Persicaria Liatris Lythrum Stachys Digitalis Kniphofia Lupinus Delphinium Verbascum Actaea Cimicifuga Lysimachia Buddleja Ajuga Teucrium Penstemon Physostegia Polygonum Bistorta Sidalcea Acanthus Heuchera Tiarella Ligularia Epilobium Chamerion Linaria Lobelia Campanula Hyssopus Vitex Clethra Itea Prunella Liriope Ophiopogon Eremurus Hosta Kirengeshoma Bergenia Pulmonaria Aconitum Dictamnus Galega Baptisia Thermopsis Polygonatum Wisteria',
    'scherm': 'Achillea Sedum Hylotelephium Eupatorium Angelica Selinum Foeniculum Anethum Zizia Viburnum Sambucus Cornus Hydrangea Phlox Valeriana Centranthus Ageratina Verbena Lantana Pimpinella Seseli Laserpitium Peucedanum Ferula Daucus Ammi Orlaya Heracleum Sorbus Crataegus Spiraea Cotoneaster Pyracantha Viburnum Aronia Ligustrum Syringa',
    'knop': 'Allium Sanguisorba Echinops Eryngium Knautia Scabiosa Astrantia Phlomis Centaurea Monarda Trifolium Cirsium Gomphrena Armeria Globularia Succisa Succisella Cephalaria Leucojum Galanthus Muscari Fritillaria Tulipa Narcissus Crocus Hyacinthus Camassia Amelanchier Magnolia Malus Prunus Pyrus Cydonia Mespilus Kalmia Pieris Erica Calluna Daphne',
    'pluim': 'Astilbe Thalictrum Gypsophila Aruncus Filipendula Calamagrostis Miscanthus Molinia Panicum Deschampsia Stipa Pennisetum Cenchrus Sesleria Carex Festuca Luzula Hakonechloa Chasmanthium Sporobolus Schizachyrium Andropogon Briza Melica Koeleria Eragrostis Spodiopogon Saccharum Cortaderia Macleaya Rodgersia Sorbaria Holodiscus Tamarix Cotinus Koelreuteria Crambe Limonium Gaura Oenothera',
    'schijf': 'Echinacea Rudbeckia Helenium Aster Symphyotrichum Eurybia Anemone Geranium Coreopsis Leucanthemum Rosa Helianthus Heliopsis Gaillardia Inula Telekia Silphium Doronicum Erigeron Kalimeris Boltonia Chrysanthemum Arnica Osteospermum Potentilla Cistus Hypericum Paeonia Papaver Malva Lavatera Alcea Hibiscus Althaea Iris Hemerocallis Lilium Dahlia Cosmos Zinnia Tagetes Calendula Nigella Primula Viola Helleborus Dianthus Geum Fragaria Waldsteinia Ranunculus Trollius Caltha Oenothera Lychnis Silene Saponaria Convolvulus Ipomoea Passiflora Lonicera Philadelphus Deutzia Weigela Kolkwitzia Abelia Camellia Rhododendron Azalea Exochorda Rubus Chaenomeles Cistus Halimium',
    'blad': 'Hosta Heuchera Brunnera Epimedium Pachysandra Hedera Vinca Asarum Ferns Polystichum Dryopteris Athyrium Asplenium Osmunda Matteuccia Adiantum Blechnum Phyllitis Buxus Ilex Taxus Thuja Chamaecyparis Juniperus Pinus Picea Abies Cedrus Larix Tsuga Sequoia Metasequoia Ginkgo Acer Fagus Carpinus Quercus Tilia Betula Alnus Populus Salix Ulmus Fraxinus Platanus Liquidambar Cercidiphyllum Parrotia Ficus Vitis Parthenocissus Humulus Hakonechloa Bambusa Phyllostachys Fargesia Sasa',
}
FORM_OF = {}
for form, names in FORMS.items():
    for g in names.split():
        FORM_OF.setdefault(g, form)

TYPE_OF = {'Vaste planten': 'vaste', 'Siergrassen': 'gras', 'Varens': 'varen', 'bollen': 'bol', 'Klimplanten': 'klimmer',
           'Bamboe': 'heester', 'Rhododendron en Azalea': 'heester', 'Coniferen': 'heester', 'Bomen en heesters': 'heester'}


def fetch(raw):
    """Alle bladen ophalen; bladen die er al zijn worden overgeslagen (hervatten kan)."""
    os.makedirs(raw, exist_ok=True)

    def get(page):
        req = urllib.request.Request(API.format(page), headers={'User-Agent': 'tuinontwerp-import/1.0'})
        with urllib.request.urlopen(req, timeout=180) as r:
            body = r.read()
            total = int(r.headers.get('X-WP-TotalPages') or 1)
        open(os.path.join(raw, f'p{page}.json'), 'wb').write(body)
        time.sleep(DELAY)
        return total

    pages = get(1)
    for page in range(2, pages + 1):
        path = os.path.join(raw, f'p{page}.json')
        if os.path.exists(path) and os.path.getsize(path) > 10:
            continue
        for attempt in range(3):
            try:
                get(page)
                break
            except Exception as e:  # netwerk: even wachten en opnieuw
                print('blad', page, 'mislukt:', e, flush=True)
                time.sleep(30)
        print('blad', page, 'van', pages, flush=True)


def text(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def attrs(p):
    out = {}
    for a in p.get('attributes', []):
        out[a['taxonomy']] = [html.unescape(t['name']) for t in a['terms']]
    return out


def cm(num, unit):
    v = float(num.replace(',', '.'))
    return v * 100 if unit.startswith('m') else v


def range_mid(terms):
    """'van 30 cm tot 50 cm' → 40 (cm)."""
    for t in terms or []:
        m = re.findall(r'([\d.]+)\s*(cm|m\.?|meter)', t.replace(',', '.'))
        if len(m) >= 2:
            a, b = (float(x) * (1 if u == 'cm' else 100) for x, u in m[:2])
            return round((a + b) / 2)
        m = re.search(r'van ([\d.]+) (cm|m\.?|meter) tot ([\d.]+)', t)
        if m:
            f = 1 if m.group(2) == 'cm' else 100
            return round((float(m.group(1)) * f + float(m.group(3)) * f) / 2)
    return None


def months_of(spec):
    spec = spec.lower().replace('–', '-')
    found = [i + 1 for i, m in enumerate(MONTHS) if m in spec]
    if not found:
        return []
    if '-' in spec and len(found) >= 1:
        parts = [s.strip() for s in spec.split('-')]
        a = next((i + 1 for i, m in enumerate(MONTHS) if m in parts[0]), None)
        b = next((i + 1 for i, m in enumerate(MONTHS) if m in parts[-1]), None)
        if a and b:
            out, m = [], a
            for _ in range(12):
                out.append(m)
                if m == b:
                    break
                m = m % 12 + 1
            return out
    return sorted(set(found))


def build(raw, out):
    items = []
    for f in sorted(glob.glob(os.path.join(raw, 'p*.json')), key=lambda x: int(re.sub(r'\D', '', os.path.basename(x)))):
        items += json.load(open(f))
    plants = []
    seen = set()
    for p in items:
        if p.get('type') == 'external' or p['slug'] in seen:
            continue
        seen.add(p['slug'])
        a = attrs(p)
        d = text(p.get('description'))
        name = text(p['name'])
        ptype = TYPE_OF.get((a.get('pa_planttype') or [''])[0])
        if not ptype:
            continue
        genus = (a.get('pa_geslacht') or [name.split()[0]])[0].split()[0]
        # hoogte: liefst de echte maat uit de omschrijving
        h = None
        m = re.search(r'(?:gemiddelde hoogte|hoogte na \d+ jaar) is ([\d.,]+)\s*(cm|meter|m)\b', d)
        if m:
            h = cm(m.group(1), m.group(2))
        if not h:
            h = range_mid(a.get('pa_hoogte_maximaal') or a.get('pa_hoogte-maximaal'))
        w = range_mid(a.get('pa_breedte_maximaal') or a.get('pa_breedte-maximaal'))
        if not h:
            continue
        if not w:
            w = max(20, min(h, 120)) if ptype in ('vaste', 'gras', 'varen', 'bol') else h * 0.7
        if ptype == 'heester' and h >= 500:
            ptype = 'boom'
        vorm = (a.get('pa_vorm') or [''])[0]
        if ptype == 'vaste' and (h <= 25 or vorm == 'platgroeiend'):
            ptype = 'bodem'
        habit = {'bolvormig': 'bol', 'compact': 'kussen', 'iets breder dan hoog, spreidend': 'spreidend', 'platgroeiend': 'spreidend',
                 'treurvorm': 'overhangend', 'kegelvormig': 'rechtop', 'zuilvormig': 'rechtop', 'opgaand': 'rechtop'}.get(vorm)
        if not habit:
            habit = 'rechtop' if h > w * 1.3 else 'kussen'
        if ptype == 'gras' and habit == 'kussen' and h > 50:
            habit = 'overhangend'
        # bloei
        bloom = []
        b0, b1 = (a.get('pa_bloeiperiode_begin') or [None])[0], (a.get('pa_bloeiperiode_einde') or [None])[0]
        if b0 and b1 and b0.lower() in MONTHS and b1.lower() in MONTHS:
            bloom = months_of(f'{b0} - {b1}')
        if not bloom and a.get('pa_bloeitijd'):
            bloom = months_of(a['pa_bloeitijd'][0])
        if not bloom:
            m = re.search(r'bloeiperiode is ([^.]+)', d)
            if m:
                bloom = months_of(m.group(1))
        fam = (a.get('pa_bloemkleur') or [''])[0]
        color = COLORS.get(fam)
        m = re.search(r'bloemkleur is ([^.]+)', d)
        if m:
            desc = m.group(1).lower()
            for k, v in TINTS:
                if k in desc:
                    color = v
                    break
            else:
                if not color:
                    for k, v in COLORS.items():
                        if k in desc or (k == 'rose' and 'roze' in desc):
                            color = v
                            break
            if color and ('donker' in desc):
                color = shade(color, -0.25)
            elif color and ('licht' in desc or 'zacht' in desc or 'pastel' in desc):
                color = shade(color, 0.3)
        form = FORM_OF.get(genus)
        if ptype == 'gras':
            form = form or 'pluim'
        if ptype == 'varen' or not bloom or not color or fam == 'groen':
            form = 'blad' if ptype != 'gras' else 'pluim'
        form = form or ('schijf' if ptype in ('vaste', 'bodem', 'bol', 'klimmer') else 'knop')
        if not color:
            color = '#c8c070'
        stand = a.get('pa_standplaats') or []
        light = []
        if any('zon' in s for s in stand) or any('Alle' in s for s in stand):
            light.append('z')
        if any('halfschaduw' in s for s in stand) or any('Alle' in s for s in stand):
            light.append('h')
        if any(s == 'schaduw' for s in stand) or any('Alle' in s for s in stand):
            light.append('s')
        if not light:
            light = ['z', 'h']
        water = (a.get('pa_waterbehoefte') or [''])[0]
        soil = {'weinig water': 'd', 'matig water': 'dn', 'normaal water': 'n', 'veel water': 'nv', 'geen bijzondere waterbehoefte': 'dnv'}.get(water, 'n')
        grond = a.get('pa_grondsoort') or []
        groen = (a.get('pa_wintergroen') or [''])[0]
        evergreen = groen in ('wintergroen', 'halfwintergroen')
        kenm = ' '.join(a.get('pa_bijzonder_kenmerk') or [])
        autumn = 'rood' if 'spectaculaire herfst' in kenm else 'oranje' if 'herfstkleuren' in kenm else ''
        foliage = FOLIAGE.get((a.get('pa_bladkleur') or ['groen'])[0], 'groen')
        if foliage == 'groen' and ptype in ('heester', 'boom') and evergreen:
            foliage = 'donker'
        per = None
        m = re.search(r'per vierkante meter\s*:\s*([\d.,]+)', d)
        if m:
            try:
                per = float(m.group(1).replace(',', '.'))
            except ValueError:
                per = None
        nl = ''
        m = re.search(r'Nederlandse naam\s*:\s*([^.]+?)\s*\.', d)
        if m:
            nl = re.split(r'\s+(?:Mogelijk|Deze plant|Let op|Zie ook|Synoniem)', m.group(1))[0].strip()
        cultivar = ''
        m = re.search(r"‘(.+)’", name) or re.search(r"'(.+)'", name)
        if m:
            cultivar = m.group(1)
        pr = p.get('prices') or {}
        price = int(pr['price']) if pr.get('price') else None
        rng = pr.get('price_range') or {}
        price_max = int(rng['max_amount']) if rng.get('max_amount') else None
        sizes = sorted(a.get('pa_maat') or [], key=size_key)
        hard = (a.get('pa_winterhardheid') or [''])[0]
        rec = {
            'id': 'esv:' + p['slug'], 'lat': name, 'nl': nl, 'cv': cultivar, 't': ptype, 'h': round(h), 'w': round(w),
            'ha': habit, 'f': form, 'c': color, 'b': bloom, 'l': ''.join(light), 's': soil,
            'u': p['slug'],
        }
        if foliage != 'groen':
            rec['fo'] = foliage
        if autumn:
            rec['a'] = autumn
        if evergreen:
            rec['ev'] = 1
        if 'vlinder' in kenm:
            rec['bee'] = 1
        if per:
            rec['m2'] = per
        if price:
            rec['p'] = price
        if price_max and price_max != price:
            rec['pm'] = price_max
        if sizes:
            rec['sz'] = sizes
        if hard and hard != 'zeer winterhard' and hard != 'goed winterhard':
            rec['hd'] = hard
        if grond and grond != ['Alle grondsoorten goed']:
            rec['g'] = [x.split(' (')[0].split(' ')[0] for x in grond]
        if 'Opvallende vruchten' in kenm:
            rec['fr'] = 1
        if 'aanwezig op de kwekerij' in d:
            rec['st'] = 1
        plants.append(rec)
    data = {'source': 'Esveld', 'url': 'https://esveld.nl/a/product/', 'date': datetime.date.today().isoformat(), 'count': len(plants), 'plants': plants}
    with open(out, 'w') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(plants)} planten → {out} ({os.path.getsize(out) // 1024} kB)')


def size_key(sz):
    """Maten van klein naar groot: pot 9 cm < pot 2 liter < 60/80 < stam 150 cm (de kleinste hoort bij 'vanaf')."""
    t = sz.lower().replace(',', '.')
    m = re.search(r'pot ([\d.]+) ?cm', t)
    if m:
        return float(m.group(1)) ** 3 / 1000  # liters, ongeveer
    m = re.search(r'([\d.]+) ?l(iter)?\b', t)
    if m:
        return float(m.group(1))
    m = re.search(r'(\d+)\s*/\s*(\d+)', t)
    if m:
        return 50 + float(m.group(1))
    m = re.search(r'(\d+)', t)
    return 500 + float(m.group(1)) if m else 10000


def shade(hexc, f):
    c = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
    if f < 0:
        c = [round(v * (1 + f)) for v in c]
    else:
        c = [round(v + (255 - v) * f) for v in c]
    return '#' + ''.join(f'{v:02x}' for v in c)


if __name__ == '__main__':
    cmd, raw = sys.argv[1], sys.argv[2]
    if cmd == 'fetch':
        fetch(raw)
    else:
        out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), '..', 'data', 'esveld.json')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        build(raw, out)
