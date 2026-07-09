# Gravel Planner

Statischer Gravel-Routenplaner (kein Build, kein Backend). Plant Routen bevorzugt
über Schotter- und Waldwege via [BRouter](https://brouter.de) (Profil `gravel`,
Fallback `trekking`).

## Start

    npm run serve
    # http://localhost:8123 öffnen

Direktes Öffnen per file:// funktioniert nicht (ES-Module brauchen HTTP).
Der Dev-Server (`serve.py`) sendet No-Cache-Header — sonst liefert der Browser
nach Code-Änderungen veraltete Module aus.

## Features

- Manuell: Klicken setzt Wegpunkte, Routing entlang Gravel-Wegen; Ziehen/Klicken/Zurück/Löschen.
- Vorschläge: Startpunkt + Distanzbereich → 3 Routen-Vorschläge (Runde oder einfache Strecke), klickbar.
- Distanz, Höhenmeter, Höhenprofil; Ortssuche (Nominatim); Umkehren; Speichern (localStorage); GPX-Export.

## Tests

    npm test   # node --test, Node >= 18

## Hinweise

- BRouter-Public-API und Nominatim haben Rate-Limits — bei Fehlern kurz warten.
- Für intensive Nutzung BRouter selbst hosten: https://github.com/abrensch/brouter
- Runden-Distanz ist immer eine Näherung.
