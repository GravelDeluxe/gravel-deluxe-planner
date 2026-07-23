# Gravel Planner

Statischer Gravel-Routenplaner (kein Build, kein Backend). Plant Routen bevorzugt
über Schotter- und Waldwege via [BRouter](https://brouter.de) und erzeugt
manuelle Strecken sowie geschlossene Rundtouren mit dem gewählten Profil.

![Gravel Planner – Strecke von Freiburg in den Schwarzwald mit Distanz, Höhenmetern und Höhenprofil](screenshots/app.jpg)

> **Hinweis:** Das Profil `gravel-konstant` benötigt den mitgelieferten eigenen
> BRouter. Der lokale Komplettstart erfolgt mit `make setup`.

## Herkunft und Dank

Dieses Projekt basiert auf dem Open-Source-Projekt
[DerRemo/gravel-planner](https://github.com/DerRemo/gravel-planner). Vielen Dank
an DerRemo für den ursprünglichen Gravel-Routenplaner, die schlanke
HTML-/CSS-/JavaScript-Basis und die Veröffentlichung unter der MIT-Lizenz.

**GravelDeluxe** führt diese Arbeit als eigene Erweiterung fort. Der
ursprüngliche Planer bleibt als Grundlage erkennbar; hinzu kommen insbesondere:

- ein lokal betriebener BRouter mit eigenem GravelDeluxe-Profil;
- ein selbst gehosteter
  [openrouteservice](https://github.com/GIScience/openrouteservice) ohne
  externen API-Key;
- das ORS-Profil `gravel-deluxe` mit eigenem Custom-Model;
- Rundkursvorgaben für Distanz, Höhenmeter und grobe Himmelsrichtung;
- lokale OSM-/Routingdaten sowie ein reproduzierbarer Komplettstart;
- Docker-Compose-, Portainer- und Watchtower-Konfiguration für den
  Serverbetrieb.

Änderungen des GravelDeluxe-Projekts sind keine offiziellen Änderungen oder
Empfehlungen des ursprünglichen Autors.

## Features

- **Strecke**: Start- und Endpunkt (plus optionale Zwischenpunkte) auf die Karte
  klicken → Routing entlang Gravel-Wegen (BRouter); Marker ziehen/löschen, Zurück, Umkehren.
- **Runde**: einen Startpunkt sowie Distanz- und Höhenmeterbereich wählen →
  die drei bestpassenden geschlossenen Rundtouren über den selbst gehosteten
  ORS erhalten.
- Optionale grobe Himmelsrichtung lenkt die Hauptausdehnung einer Runde und
  hilft, ungünstige Seiten des Startorts zu meiden.
- Erd-/Gras-Wiesenwege lassen sich zulassen oder ausschließen; die maximale
  Steigung ist einstellbar und beträgt standardmäßig 10 %. Diese Vorgaben
  werden nach der Routenantwort bewertet. Die Oberfläche stammt aus dem beim
  ORS-Graphbau aktivierten Speicher `WaySurfaceType`, die Steigung aus den
  Höhenwerten.
- Beliebige Highlights können auf der Karte gesetzt werden und werden als
  verpflichtende Via-Punkte in die Rundtour eingebaut.
- Distanz, Höhenmeter (für Runden robust aus verrauschten SRTM-Höhen berechnet:
  Void-Füllung → Median-Filter → Anstieg per Hysterese), Höhenprofil.
- Ortssuche (Nominatim), Speichern (localStorage), GPX-Export.
- Feedback-Modus: Route scrubben, schlechte Passagen per IN/OUT markieren und
  als JSON einschließlich vollständiger Route und Analysemetadaten exportieren.
- Frei wählbarer Routenname für GPX- und Feedback-Export.
- UI passt sich automatisch an Hell-/Dunkel-Modus des Systems an (Glas-Optik).

## Installation

### Voraussetzungen

- **Python 3** — für den Dev-Server (`serve.py`). Alternativ jeder statische HTTP-Server.
- **Node.js ≥ 18** — nur für die Tests.
- Keine npm-Abhängigkeiten, kein Build-Schritt.

### Starten

    git clone https://github.com/GravelDeluxe/gravel-deluxe-planner.git
    cd gravel-deluxe-planner
    npm run serve        # oder: python3 serve.py 8123
    # http://localhost:8123 im Browser öffnen

Direktes Öffnen per `file://` funktioniert nicht (ES-Module brauchen HTTP).
Der Dev-Server (`serve.py`) sendet No-Cache-Header — sonst liefert der Browser
nach Code-Änderungen veraltete Module aus.

### Komplettes lokales System

Mit laufendem Docker Desktop richtet ein Befehl Web-App, eigenen BRouter,
Kartensegmente und einen echten Profiltest ein:

```sh
make setup
```

Danach ist die App unter <http://localhost:8086> erreichbar. Weitere Befehle
zeigt `make help`. Die lokalen `.rd5`-Daten liegen unter
`local-data/segments4` und werden nicht in Git aufgenommen.

## Gravel GravelDeluxe

Zusätzlich zum unveränderten Originalprofil steht das neue Profil
`gravel-konstant` unter dem Produktnamen **Gravel GravelDeluxe** zur Auswahl.
Es bevorzugt zusammenhängende, gut fahrbare
Gravel-Abschnitte, verteuert Hauptstraßen deutlich und bestraft sehr steile
Rampen. Das Profil benötigt einen eigenen BRouter; auf der öffentlichen Instanz
fällt die App automatisch auf `gravel` zurück.

Die App startet im Modus „Runde“ an der Home Base in Bad Rappenau. Rundtouren
kommen aus dem eigenen ORS-Profil `gravel-deluxe`. Es basiert auf dem
`cycling-mountain`-Encoder und ergänzt ein Custom-Model: Hauptstraßen,
Schiebepassagen, Stufen und unpassierbare Wege werden stark abgewertet; ein
guter paralleler Radweg gewinnt knapp gegen einen Track. Sechs Varianten werden
nach Distanz und Höhenmetern bewertet, die besten drei angezeigt. Manuelle
Strecken verwenden weiterhin das ausgewählte BRouter-Profil.

ORS verwendet den vollständigen Geofabrik-Extrakt Baden-Württemberg. Der
kleinere Extrakt „Regierungsbezirk Stuttgart“ endet zu nah nördlich der Home
Base und kann deshalb keine zuverlässigen Runden Richtung Odenwald erzeugen.

### GPX- und Feedbackanalyse

Die Referenzanalyse verarbeitet alle guten `.gpx`-Dateien und alle mit dem
Feedback-Modus erzeugten `*__feedback.json`-Dateien in `gpx-samples/`:

```sh
make analyze
```

Das reproduzierbare Ergebnis liegt in `data/reference-analysis.json`. Gute
Routen bilden bevorzugte Korridore, markierte schlechte Passagen bilden zu
meidende Korridore. Beim Erzeugen neuer Runden fließt dieses Modell als
zusätzlicher, erklärbarer Faktor in das Kandidatenranking ein:

- Übereinstimmung mit guten Referenzen gibt einen moderaten Bonus;
- Übereinstimmung mit schlechtem Feedback erhält eine deutlich stärkere Strafe;
- Distanz, Höhenmeter und Himmelsrichtung bleiben eigenständige Ziele.

„Unnötige Abkürzung“ und „zu viel Zig-Zag“ stehen als eigene
Feedbackkategorien bereit. Unabhängig vom Feedback bewertet das Ranking den
Fahrfluss jeder Route: starke Richtungswechsel, Kehrtwenden und mehrfach
befahrene Passagen erhalten eine Strafe, flüssige Linien werden bevorzugt.
Die eingestellte Maximalsteigung hat Vorrang vor der Maximaldistanz: Die Suche
wird bei Bedarf bis 150 % der gewünschten Obergrenze erweitert und bevorzugt
immer die längere, weniger steile Variante.
Automatisch erzeugte ORS-Formpunkte bleiben intern; auf der Karte sind nur der
Startpunkt und die vom Nutzer gesetzten gelben Highlights sichtbar.
Die Route zeigt Bodenarten abschnittsweise per Farbe und Tooltip sowie
Richtungspfeile. Steigungen über dem Grenzwert erscheinen hellorange, ausgeschlossene
Wiese-/Erde-Passagen braun und kombinierte Verstöße violett. Der permanente
Scrubber im unteren Overlay koppelt Kartenposition, Distanz, aktuelle Höhe und
eine gelbe Positionsmarke im Höhenprofil; markiertes Feedback erscheint gelb.

Ein Feedback-Export wird nach `gpx-samples/` kopiert und anschließend
`make analyze` ausgeführt. Beim nächsten Laden der App nutzt sie das
aktualisierte Modell.
Feedbackdateien enthalten Bodenabschnitte und einen sekundengenauen Zeitstempel
im Dateinamen, sodass mehrere Exporte derselben benannten Route erhalten bleiben.

Highlights werden zunächst in eine native ORS-Runde einsortiert. Zusätzliche
Stützpunkte erhalten deren Grundform, anschließend routet ORS zwingend durch
jedes Highlight zurück zum Start.

Für den Serverbetrieb stehen zwei Container-Images, eine GitLab-CI-Pipeline und
ein Portainer-Stack mit Watchtower bereit. Einrichtung, Volumes, Parameter und
Teststrecken sind in [docs/phase-1-gravel-konstant.md](docs/phase-1-gravel-konstant.md)
dokumentiert.

## Tests

    npm test   # node --test, Node >= 18

## Hinweise

- BRouter-Public-API und Nominatim haben Rate-Limits — bei Fehlern kurz warten.
- Für intensive Nutzung BRouter selbst hosten: https://github.com/abrensch/brouter
- Runden-Distanz ist immer eine Näherung.
