# Tuinontwerp

Een web-app om tuinen te schetsen en te ontwerpen op schaal, voor de iPad met Apple Pencil en voor de laptop.
De functies zijn gebaseerd op Morpholio Trace (inclusief de Plus-functies), aangevuld met kaarten op schaal en
automatische maatvoering. Alles draait in de browser, werkt offline en bewaart tekeningen op het eigen apparaat.

## Functies

- **Pennen en penselen**: fineliner, inktpen, potlood (met korrel), marker, penseel en aquarel. De Apple Pencil is
  drukgevoelig; met muis of vinger wordt de druk uit de snelheid afgeleid. De dikte stel je in als millimeters op papier.
  Lijnen worden vloeiend: een stabilisator filtert trillingen weg (instelbaar met *Gladheid*) en bochten worden als
  vloeiende krommen getekend.
- **Super-liniaal**: een liniaal met verdeling in werkelijke meters. Teken langs de rand voor een exact rechte lijn die
  automatisch een maat krijgt. Verplaatsen door te slepen, draaien met de ronde greep of twee vingers (snapt per 15°).
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
- **Tekenmodus en verplaatsmodus** voor de hulpmiddelen (slotknop in de werkbalk). In de tekenmodus liggen ze vast en
  teken je er met elk tekengereedschap langs of op (pen, lijn, veelhoek, vlak, maatlijn, gum); verplaatsen gaat dan met
  twee vingers. In de verplaatsmodus sleep je ze en gebruik je de grepen voor draaien, grootte en hoek.
- **Magische lasso**: omcirkel of tik om te selecteren, daarna verplaatsen, schalen, draaien, dupliceren, inkleuren,
  naar voren/achteren, naar een andere laag of verwijderen. Kopiëren en plakken met ⌘C/⌘V.
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
- **Ondergrond importeren**: een foto of PDF. Je geeft de werkelijke breedte op of de schaal van de PDF (bijv. 1:100),
  of je kalibreert achteraf met de Schaal-tool.
- **Lagen als trekpapier**: per laag de zichtbaarheid, vergrendeling, dekking en hoeveel "papier" eronder ligt.
- **Exporteren naar PDF of PNG** op A4 t/m A1 op een echte schaal (of passend), met een titelblok, schaalbalk en noordpijl.
- Ongedaan maken en opnieuw, automatisch opslaan, meerdere tekeningen, een back-up als bestand, en werkt offline (PWA).

## Bediening

| Actie | iPad | Laptop |
| --- | --- | --- |
| Tekenen | Apple Pencil | Linkermuisknop / trackpad |
| Verschuiven | Eén vinger (zodra de Pencil is herkend) | Spatie + slepen, middelste muisknop of twee vingers scrollen |
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
