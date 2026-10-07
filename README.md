# Tuinontwerp

Een web-app om tuinen te schetsen en te ontwerpen op schaal, voor de iPad met Apple Pencil en voor de laptop.
De functies zijn gebaseerd op Morpholio Trace (inclusief de Plus-functies), aangevuld met kaarten op schaal en
automatische maatvoering. Alles draait in de browser, werkt offline en bewaart tekeningen op het eigen apparaat.

## Functies

- **Pennen en penselen**: fineliner, inktpen, potlood (met korrel), marker, penseel en aquarel. De Apple Pencil is
  drukgevoelig; met muis of vinger wordt de druk uit de snelheid afgeleid. De dikte stel je in als millimeters op papier.
  Lijnen worden vloeiend: een stabilisator filtert trillingen weg (instelbaar met *Gladheid*) en bochten worden als
  vloeiende krommen getekend.
- **Super-liniaal**: een liniaal met verdeling in werkelijke meters. Teken langs (of op) de rand voor een exact rechte
  lijn. Verplaatsen door te slepen, draaien met de ronde greep of twee vingers (snapt per 15°).
  Tik op een hulpmiddel voor een balk waarin je de draaiing exact invoert.
- **Evenwijdig tekenen**: draai je de liniaal of driehoek in de buurt van een bestaande lijn, dan klikt hij precies
  evenwijdig (bij de liniaal ook haaks). De lijnen waarmee hij uitgelijnd is lichten op (∥ / ⊥), met de afstand tot de
  dichtstbijzijnde lijn. Verschuif je hem, dan klikt die afstand op ronde maten (bijv. 0,5 / 1,0 / 1,5 m).
- **Instelbare tekendriehoek**: versleep de bovenste punt om de hoek te veranderen (5°–85°, snapt per graad en blijft
  kleven op 15°, 30°, 45°, 60° en 75°), of tik erop voor de snelknoppen 30°, 45° en 60°. Knijp met twee vingers om hem groter of kleiner te maken. Teken langs elke rand.
- **Gradenboog / passer**: knijp met twee vingers om de diameter te veranderen (in meters, blijft op schaal bij zoomen).
  Een vinger op de gradenboog of het midden tussen je vingers erop is genoeg, dus het werkt ook bij een kleine gradenboog. Een streek langs de
  boog wordt een boog met precies die straal. Vanuit het middelpunt trek je lijnen onder een hele graad. Het middelpunt
  snapt aan eindpunten, zodat je bogen rond een punt kunt tekenen.
- **Hulpmiddelen liggen vast op de tekening**: zoom, verschuif of draai je de tekening, dan blijven liniaal, driehoek
  en gradenboog exact op dezelfde plek ten opzichte van de tekening (een liniaal op 1,5 m van een muur blijft op 1,5 m).
  De liniaal heeft één tekenrand die over het hele scherm doorloopt, dus ook ver ingezoomd teken je een hele muur in één
  streek; de maat loopt vanaf het nulpunt (het streepje "0") naar beide kanten. Bij de driehoek ligt de rechte hoek vast,
  de gradenboog blijft op schaal. Is een hulpmiddel buiten beeld geraakt, dan haalt de knop het terug.
- **Tekenmodus en verplaatsmodus** voor de hulpmiddelen (slotknop in de werkbalk). In de tekenmodus liggen ze vast en
  teken je er met elk tekengereedschap langs of op (pen, lijn, veelhoek, vlak, maatlijn, gum); verplaatsen gaat dan met
  twee vingers. In de verplaatsmodus sleep je ze en gebruik je de grepen voor draaien, grootte en hoek.
- **Plattegrond van het huis**: het gereedschap *Muur* tekent muren met een dikte (10, 20, 30 of 40 cm of zelf
  invullen) als ketting van punten; tik op het eerste punt om rond te sluiten. Muren zijn gearceerd en hebben nette
  verstekhoeken. Bij *Stencils › Huis: deuren en ramen* staan binnendeur, buitendeur, dubbele deur, openslaande
  tuindeuren, schuifdeur, raam en schuifpui, in de gangbare bovenaanzicht-symbolen. Ze klikken in de dichtstbijzijnde
  muur (richting en dikte van de muur) en maken daar een opening; een deur draait open naar de kant waar je tikt.
  *Spiegelen* in de balk zet het scharnier aan de andere kant; de muurdikte pas je aan met *Dikte*.
  Muren sluiten netjes op elkaar aan: een binnenwand stopt op de binnenkant van de buitenmuur (naadloos), twee muren
  die in een hoek samenkomen krijgen verstek. Deuren en ramen zijn aan hun muur gekoppeld: ze gaan mee als je de muur
  verplaatst, draait, een hoekpunt versleept of de dikte wijzigt, en verdwijnen met de muur. Versleep je een deur, dan
  schuift hij langs de muur (of klikt in een andere muur).
- **Selecteren en bewerken**: tik op een element (ook midden in een lege rechthoek) of omcirkel er meerdere.
  - Slepen verplaatst; punten klikken vast op eindpunten van andere elementen.
  - De ronde greep draait; de hoek klikt per 15°, en in de balk typ je een exacte hoek (bijv. 37,5°) of gebruik je −/+.
  - Rechthoeken en stencils: hoekgrepen voor beide maten, zijgrepen voor alleen breedte of diepte.
  - Lijnen, veelhoeken en vlakken: hoekpunten verslepen, met + een punt toevoegen, dubbeltik om een punt te verwijderen.
  - Eigenschappenbalk: exacte breedte × diepte, diameter, lengte, hoek of draaiing, hoogte, kleur, lijndikte, vulling en
    arcering; verder dupliceren, voor/achter, naar een andere laag, verwijderen. Kopiëren en plakken met ⌘C/⌘V.
- **Rechthoeken**: *Recht* (ten opzichte van het scherm) of *Gedraaid* (eerst een zijde in elke richting, dan de diepte).
  Begin je langs een liniaal of driehoek, dan ligt de eerste zijde langs de rand.
- **Stencils**: bomen (kroondiameter), heesters, hagen, grassen, vaste planten, meubilair, schuur, pergola, kas, vijver,
  trampoline, auto en noordpijl, allemaal op ware grootte en met een instelbare maat.
- **Vormen**: lijn, rechthoek, cirkel, veelhoek en vlak (bijvoorbeeld gazon of border) met arceringen op ware grootte:
  gras, grind, tegels, klinkers, vlonder, water en beplanting. Tijdens het tekenen zie je de maat in een tijdelijk label.
- **Maatvoering** (apart gereedschap): *Lengte*: tik begin- en eindpunt aan of sleep; snapt aan eindpunten, randen en het
  raster. Sleep het midden van een maatlijn om hem opzij te leggen. *Oppervlakte*: tik in een vlak of vorm voor de m².
  Afronding en labelgrootte op papier hangen af van de tekenschaal (1:10 tot 1:5000); op het scherm blijven labels leesbaar.
- **Kaarten op schaal**: zoek een adres (PDOK, met OpenStreetMap als terugval voor buiten Nederland) en plaats een
  luchtfoto, topografische kaart of OpenStreetMap-kaart, optioneel met de perceelgrenzen van het Kadaster. De kaart
  krijgt precies de juiste afmeting in meters.
- **Zon en schaduw** (knop *Zon*): de zonnestand wordt berekend uit de locatie van de geïmporteerde kaart; het noorden
  is bij een PDOK-kaart automatisch goed (bij een foto stel je het in). Twee weergaven:
  - *Schaduw*: kies een datum (snelkeuze 21 maart/juni/september/december) en schuif door de dag of speel de dag af;
    schaduwen van huis, schuur, bomen, hagen en schuttingen bewegen mee. Een zonnekompas toont de zonnebaan.
  - *Zonkaart*: per plek het gemiddeld aantal uren direct zon (gekozen dag, groeiseizoen apr–sep of heel jaar),
    ingedeeld als **zon** (≥ 6 u), **halfschaduw** (3–6 u) en **schaduw** (< 3 u), zoals op plantlabels.
  - Gebouwen: bij het importeren van een kaart (of via *Gebouwen ophalen* in het zonpaneel) komen de panden uit de
    BAG (PDOK) in een eigen laag, met hun hoogte uit de 3D BAG (dakhoogte min maaiveld). Zonder bekende hoogte: 6 m.
  - Hoogtes: stencils hebben een standaardhoogte (bijv. loofboom 8 m, haag 1,8 m, schuur 2,5 m), aan te passen bij het
    plaatsen of via de lasso (knop *Hoogte*). Vormen krijgen een hoogte via de optiebalk (huis, schutting, muur).
- **Beplantingsplan (concept)**: ontwerp eerst op kleur, structuur, vorm en hoogte, nog zonder plantnamen.
  - *Bouwstenen*: abstracte planten met rol (structuur, vulling/matrix, accent), hoogte, groeivorm (rechtop, bolvormig,
    kussen, spreidend, overhangend, ijl/doorkijk), bloei- en zaadvorm (aar, knop, pluim, scherm, schijf; naar Oudolf
    & Kingsbury), bloeikleur en -maanden, blad, herfstkleur, wat er in de winter overblijft en standplaats.
  - *Kleurenschema*: monochroom, verwant, complementair, gesplitst complementair, drieklank, warm, koel of wit en zilver;
    bloeikleuren kies je uit het palet, afwijkingen worden gemarkeerd.
  - *Plantvakken*: de contouren waarbinnen beplanting komt. Teken ze vrij (wordt vloeiend afgerond), als rechthoek of
    cirkel, of kies *Tik in ruimte*: tik in een vlak van het ontwerp (bijv. de border tussen pad en gazon) en het vak
    volgt de lijnen eromheen. Een bestaande vorm zet je om met *Maak plantvak* in de eigenschappenbalk. Een vak heeft
    een basismix (de matrix/vulling).
  - *Groepen*: binnen een plantvak, begrensd door het vak, met een eigen bouwsteen of mix. Zelf tekenen (vrij,
    rechthoek, cirkel) of laten voorstellen: *Stel groepen voor* legt structuurplanten (±30%) en accenten (±10%) in
    langgerekte vlekken langs het vak; de vulling wordt de basis. *Opnieuw voorstellen* geeft een andere variant, zelf
    getekende groepen blijven staan. Verplaats je een vak, dan gaan de groepen mee.
  - *Solitairen*: losse bouwstenen op hun uiteindelijke breedte; die mogen overal staan.
  - *Plantstencils* (bomen, heesters, haag, siergras, vaste plant, bodembedekker) horen bij het plan: ze krijgen
    automatisch een bouwsteen, tellen mee in het jaarrond-overzicht en kleuren mee per maand. In de balk kies je een
    andere bouwsteen (of geen).
  - *Weergave*: *Planten* (symbolen in driehoeksverband) of *Groepen* (vlakken met code en geschat aantal planten).
    Selecteer je een plantvak, dan gaat het overzicht in het paneel over dat vak; de balk toont oppervlak en aantal.
  - *Het hele jaar*: balk met per maand hoeveel er te zien is (en in welke kleuren); tik een maand om de hele tekening
    zo te zien. Kleurcirkel per maand. Adviezen over dode periodes, kleuren buiten het schema en afwisseling in rol,
    hoogte, groeivorm en bloeivorm.
- **Ondergrond importeren**: een foto of PDF. Je geeft de werkelijke breedte op of de schaal van de PDF (bijv. 1:100),
  of je kalibreert achteraf met de Schaal-tool.
- **Lagen als trekpapier**: per laag de zichtbaarheid, vergrendeling, dekking en hoeveel "papier" eronder ligt.
  Met *Hele laag selecteren* (of Ctrl/Cmd+A voor de actieve laag) verschuif, draai of schaal je een laag in zijn
  geheel: slepen, de ronde greep of een hoekgreep, of exact met *Draai* (graden) en *Schaal* (procent) in de balk.
- **Exporteren naar PDF of PNG** op A4 t/m A1 op een echte schaal (of passend), met een titelblok, schaalbalk en noordpijl.
- Ongedaan maken en opnieuw, automatisch opslaan, meerdere tekeningen, een back-up als bestand, en werkt offline (PWA).

## Bediening

| Actie | iPad | Laptop |
| --- | --- | --- |
| Tekenen | Apple Pencil | Linkermuisknop / trackpad |
| Verschuiven | Twee vingers slepen, of één vinger zodra de Pencil is herkend; of het handje (bovenaan) | Handje (H), spatie + slepen, rechter- of middelste muisknop slepen, of twee vingers scrollen op het trackpad |
| Zoomen / draaien | Knijpen en draaien met twee vingers | Knijpen op het trackpad, ⌘/Ctrl + scrollen, muiswiel |
| Ongedaan maken / opnieuw | Tik met twee / drie vingers | ⌘Z / ⇧⌘Z |
| Langs een hulpmiddel tekenen | Teken langs of óp de rand, met Pencil of vinger (ook terwijl een vinger het vasthoudt) | Teken langs de rand |
| Hulpmiddel verplaatsen | Tekenmodus: twee vingers (verplaatsen, draaien, knijpen). Verplaatsmodus: slepen en grepen | Slot open, dan slepen |

Sneltoetsen: P pen, E gum, L lasso, M maatlijn, T tekst, S stencil, V vlak, R liniaal, G raster, 0 alles in beeld,
Delete verwijdert de selectie en Esc annuleert.

## Gebruiken

De app is een statische website zonder build-stap. De bestanden moeten via http(s) worden geserveerd, omdat JavaScript-modules
niet werken vanaf `file://`.

- **Lokaal:** `npm start` en open daarna http://localhost:8123.
- **GitHub Pages:** zet in de repository onder *Settings → Pages* de bron op *GitHub Actions*. Elke push naar `main`
  publiceert dan de app. Open de URL op de iPad in Safari, kies *Deel → Zet op beginscherm*, en de app start dan schermvullend
  en werkt ook offline.

Tekeningen worden lokaal in de browser bewaard (IndexedDB). Maak af en toe een back-up via *Tekeningen → Bewaar als bestand*.

## Testen

`npm run lint` en `npm test` (vereist Playwright en een draaiende server op poort 8123). De tests bootsen de kaartdiensten na.

## Bronnen kaartmateriaal

Luchtfoto: Beeldmateriaal Nederland / PDOK · BRT-achtergrondkaart en Kadastrale kaart: Kadaster / PDOK ·
© OpenStreetMap-bijdragers. De bronvermelding komt automatisch in het titelblok van de export.
