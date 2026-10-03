# Tuinontwerp

Een web-app om tuinen te schetsen en te ontwerpen op schaal, voor de iPad met Apple Pencil en voor de laptop.
De functies zijn gebaseerd op Morpholio Trace (inclusief de Plus-functies), aangevuld met kaarten op schaal en
automatische maatvoering. Alles draait in de browser, werkt offline en bewaart tekeningen op het eigen apparaat.

## Functies

- **Pennen en penselen**: fineliner, inktpen, potlood (met korrel), marker, penseel en aquarel. De Apple Pencil is
  drukgevoelig; met muis of vinger wordt de druk uit de snelheid afgeleid. De dikte stel je in als millimeters op papier.
- **Super-liniaal**: een liniaal met verdeling in werkelijke meters. Teken langs de rand voor een exact rechte lijn die
  automatisch een maat krijgt. Verplaatsen door te slepen, draaien met de ronde greep of twee vingers (snapt per 15°).
  Tik op een hulpmiddel voor een balk waarin je de draaiing exact invoert.
- **Instelbare tekendriehoek**: de scherpe hoek is in te stellen (5°–85°, standaard 45° of 30°/60°) en hij is groter of
  kleiner te maken met de schaalgreep. Teken langs elke rand.
- **Gradenboog / passer**: de diameter stel je in meters in, en die blijft op schaal bij het zoomen. Een streek langs de
  boog wordt een boog met precies die straal. Vanuit het middelpunt trek je lijnen onder een hele graad. Het middelpunt
  snapt aan eindpunten, zodat je bogen rond een punt kunt tekenen.
- **Magische lasso**: omcirkel of tik om te selecteren, daarna verplaatsen, schalen, draaien, dupliceren, inkleuren,
  naar voren/achteren, naar een andere laag of verwijderen. Kopiëren en plakken met ⌘C/⌘V.
- **Stencils**: bomen (kroondiameter), heesters, hagen, grassen, vaste planten, meubilair, schuur, pergola, kas, vijver,
  trampoline, auto en noordpijl, allemaal op ware grootte en met een instelbare maat.
- **Vormen met automatische maten**: lijn, rechthoek, cirkel (diameter en oppervlakte), veelhoek en vlak (bijvoorbeeld
  gazon of border) met arceringen op ware grootte: gras, grind, tegels, klinkers, vlonder, water en beplanting.
- **Maatlijnen** die snappen aan eindpunten en het raster. Afronding en labelgrootte hangen af van de tekenschaal (1:10 tot 1:5000).
- **Kaarten op schaal**: zoek een adres (PDOK, met OpenStreetMap als terugval voor buiten Nederland) en plaats een
  luchtfoto, topografische kaart of OpenStreetMap-kaart, optioneel met de perceelgrenzen van het Kadaster. De kaart
  krijgt precies de juiste afmeting in meters.
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
