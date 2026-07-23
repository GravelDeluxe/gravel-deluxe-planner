# Gravel Planner

Statischer Gravel-Routenplaner (kein Build, kein Backend). Plant Routen bevorzugt
über Schotter- und Waldwege via [BRouter](https://brouter.de) und erzeugt
manuelle Strecken sowie geschlossene Rundtouren mit dem gewählten Profil.

![Gravel Planner – Strecke von Freiburg in den Schwarzwald mit Distanz, Höhenmetern und Höhenprofil](screenshots/app.jpg)

> **Hinweis:** Das Profil `gravel-konstant` benötigt den mitgelieferten eigenen
> BRouter. Der lokale Komplettstart erfolgt mit `make setup`.

## Features

- **Strecke**: Start- und Endpunkt (plus optionale Zwischenpunkte) auf die Karte
  klicken → Routing entlang Gravel-Wegen (BRouter); Marker ziehen/löschen, Zurück, Umkehren.
- **Runde**: einen Startpunkt sowie Distanz- und Höhenmeterbereich wählen →
  die drei bestpassenden geschlossenen Rundtouren über den selbst gehosteten
  ORS erhalten.
- Distanz, Höhenmeter (für Runden robust aus verrauschten SRTM-Höhen berechnet:
  Void-Füllung → Median-Filter → Anstieg per Hysterese), Höhenprofil.
- Ortssuche (Nominatim), Speichern (localStorage), GPX-Export.
- UI passt sich automatisch an Hell-/Dunkel-Modus des Systems an (Glas-Optik).

## Installation

### Voraussetzungen

- **Python 3** — für den Dev-Server (`serve.py`). Alternativ jeder statische HTTP-Server.
- **Node.js ≥ 18** — nur für die Tests.
- Keine npm-Abhängigkeiten, kein Build-Schritt.

### Starten

    git clone https://github.com/DerRemo/gravel-planner.git
    cd gravel-planner
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
