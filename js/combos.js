// Kant-en-klare plantcombinaties per type plantvak: planten uit de plantendatabase met hun rol en aandeel.
// Eén tik vult een plantvak; daarna is alles aan te passen.

export const COMBOS = [
  // bodembedekkers en beloopbaar groen
  { id: 'bodem_schaduw', name: 'Bodembedekkers voor de schaduw', btype: 'bodem', light: 'schaduw', items: [['ooievaarsbek_bodem', 'vulling', 50], ['elfenbloem', 'vulling', 30], ['schaduwkruid', 'structuur', 10], ['wilde_hyacint', 'accent', 10]] },
  { id: 'bodem_zon', name: 'Bodembedekkers voor zon en droogte', btype: 'bodem', light: 'zon', items: [['wilde_tijm', 'vulling', 40], ['vetkruid', 'vulling', 30], ['ezelsoor', 'vulling', 20], ['krokus', 'accent', 10]] },
  { id: 'beloopbaar_tijm', name: 'Tijm- en kamillepad (beloopbaar)', btype: 'beloopbaar', light: 'zon', items: [['wilde_tijm', 'vulling', 50], ['roomse_kamille', 'vulling', 40], ['krokus', 'accent', 10]] },
  // laag
  { id: 'laag_zon_paars_geel', name: 'Laag, zon: paars en geel', btype: 'laag', light: 'zon', items: [['kattenkruid', 'vulling', 40], ['meisjesogen', 'vulling', 20], ['salvia', 'structuur', 20], ['blauw_schapengras', 'structuur', 10], ['sierui', 'accent', 10]] },
  { id: 'laag_mediterraan', name: 'Laag, droog en zonnig (mediterraan)', btype: 'laag', light: 'zon', items: [['lavendel', 'vulling', 40], ['salie_kruid', 'vulling', 20], ['ezelsoor', 'vulling', 20], ['vedergras', 'structuur', 10], ['kogellook', 'accent', 10]] },
  { id: 'laag_half_fris', name: 'Laag, halfschaduw: fris groen en blauw', btype: 'laag', light: 'half', items: [['vrouwenmantel', 'vulling', 40], ['ooievaarsbek_rozanne', 'vulling', 30], ['japans_bosgras', 'structuur', 20], ['akelei', 'accent', 10]] },
  { id: 'laag_schaduw_blad', name: 'Laag, schaduw: bladplanten', btype: 'laag', light: 'schaduw', items: [['hosta_blauw', 'structuur', 30], ['kaukasische_vergeetmijniet', 'vulling', 30], ['purperklokje', 'vulling', 20], ['longkruid', 'vulling', 10], ['sneeuwklokje', 'accent', 10]] },
  // middelhoog
  { id: 'middel_prairie', name: 'Middelhoog, zon: prairie', btype: 'middel', light: 'zon', items: [['lampenpoetsergras', 'structuur', 25], ['rudbeckia', 'vulling', 25], ['zonnehoed', 'vulling', 20], ['duizendblad', 'vulling', 15], ['hemelsleutel', 'vulling', 10], ['sierui_groot', 'accent', 5]] },
  { id: 'middel_romantisch', name: 'Middelhoog, zon: romantisch roze en blauw', btype: 'middel', light: 'zon', items: [['pioen', 'structuur', 15], ['ooievaarsbek_rozanne', 'vulling', 25], ['klokjesbloem', 'vulling', 20], ['zeeuws_knoopje', 'vulling', 20], ['vrouwenmantel', 'vulling', 10], ['sierui', 'accent', 10]] },
  { id: 'middel_wit', name: 'Middelhoog, halfschaduw: witte tuin', btype: 'middel', light: 'half', items: [['herfstanemoon', 'structuur', 25], ['pluimspirea_wit', 'vulling', 30], ['bosaster', 'vulling', 20], ['blauwgras', 'structuur', 15], ['narcis', 'accent', 10]] },
  { id: 'middel_vochtig', name: 'Middelhoog, halfschaduw en vochtig', btype: 'middel', light: 'half', items: [['pluimspirea', 'vulling', 30], ['siberische_iris', 'structuur', 20], ['ereprijs', 'vulling', 20], ['smele', 'structuur', 20], ['kievitsbloem', 'accent', 10]] },
  // hoog
  { id: 'hoog_oudolf', name: 'Hoog, zon: naturalistisch (Oudolf-stijl)', btype: 'hoog', light: 'zon', items: [['struisriet', 'structuur', 25], ['virginische_ereprijs', 'structuur', 20], ['koninginnekruid', 'structuur', 15], ['pimpernel_roze', 'vulling', 15], ['zonnekruid', 'vulling', 15], ['herfstaster', 'vulling', 10]] },
  { id: 'hoog_schaduw', name: 'Hoog, schaduw: bosrand', btype: 'hoog', light: 'schaduw', items: [['zilverkaars', 'structuur', 25], ['geitenbaard', 'structuur', 25], ['mannetjesvaren', 'vulling', 25], ['koningsvaren', 'vulling', 10], ['vingerhoedskruid', 'accent', 15]] },
  // heesters
  { id: 'heesters_bloei', name: 'Heesterborder: bloei door het jaar', btype: 'heesters', light: 'zon', items: [['sneeuwbal_tinus', 'structuur', 20], ['weigela', 'vulling', 20], ['pluimhortensia', 'vulling', 20], ['vlinderstruik', 'vulling', 15], ['boerenjasmijn', 'vulling', 15], ['schoonvrucht', 'accent', 10]] },
  { id: 'heesters_wintergroen', name: 'Heesters: wintergroen voor de schaduw', btype: 'heesters', light: 'schaduw', items: [['rododendron', 'structuur', 30], ['skimmia', 'vulling', 25], ['rotsheide', 'vulling', 25], ['laurierkers', 'vulling', 20]] },
  { id: 'heesters_inheems', name: 'Heesters: inheems, voor vogels en insecten', btype: 'heesters', light: 'zon', items: [['gelderse_roos', 'structuur', 25], ['vlier', 'structuur', 25], ['hazelaar', 'vulling', 25], ['meidoorn', 'vulling', 25]] },
];

/** Combinaties voor een type plantvak (alle als er geen type is). */
export function combosFor(btype) {
  return COMBOS.filter((c) => !btype || c.btype === btype);
}
