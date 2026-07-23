# Architekturkontext

## Upstream

- Basis: `https://github.com/DerRemo/gravel-planner`
- Eingebundener Stand beim Start der Arbeiten: Commit `92e5b15`
- Arbeitsbranch: `feature/gravel-konstant`
- Remote `upstream` zeigt auf das Originalprojekt.

Die Upstream-App ist eine statische HTML-/CSS-/JavaScript-Anwendung ohne
Build-Schritt. Manuelle Strecken werden über BRouter, Rundkurse über die eigene
OpenRouteService-Instanz berechnet.

## Routingfluss

```text
Browser -> Nginx -> /brouter -> BRouter -> gemountete .rd5-Segmente
                 -> /ors     -> ORS gravel-deluxe -> OSM-PBF + Graph
```

Lokal zeigt `runtime-config.js` standardmäßig auf den öffentlichen BRouter.
Das Container-Image überschreibt diese Datei mit
`deploy/runtime-config.js`; dort ist der relative Endpunkt `/brouter`
konfiguriert. Nginx proxyfiziert ihn zum Service `brouter:17777`.

Runden gehen relativ über `/ors` an den Container. Das ORS-Profil
`gravel-deluxe` verwendet den Encoder `cycling-mountain` und wird beim
Graphaufbau für request-spezifische Custom-Models freigeschaltet. Der Browser
sendet das versionierte Modell aus `js/gravel-deluxe.js`; die Kandidatenwertung
nach Distanz, Höhenmetern und Routenbedingungen liegt getrennt in
`js/candidates.js`. Die aus dem Höhenprofil ermittelte maximale Steigung wird
nach der Antwort in `js/route-constraints.js` bewertet. `deploy/ors-config.yml`
aktiviert beim Graphbau `WaySurfaceType`; dessen `surface`-Zusatzdaten speisen
die Oberflächenvorgabe.

Die Rundenerzeugung bevorzugt die native ORS-`round_trip`-Funktion. Scheitern
alle Seeds an nicht routbaren internen Zufallspunkten, erzeugt `js/loop.js`
geometrische Via-Punkte; ORS übernimmt weiterhin die vollständige Wegwahl
zwischen diesen Punkten. Vorher zieht der ORS-Snap-Endpunkt die Luftlinienpunkte
auf routbare Kanten; das verhindert 404-Fehler durch Punkte in Wald oder Feld.
Der Graph basiert auf dem vollständigen Baden-Württemberg-PBF, damit die Home
Base nicht an einer künstlichen Extraktgrenze liegt.

Bei gewählter Himmelsrichtung erzeugt `generateDirectionalCandidates` keine
symmetrische Runde um den Start, sondern eine tropfenförmige Grundgeometrie im
gewählten Sektor. Highlights werden danach entlang dieser Grundroute
einsortiert, um lange Hin-und-zurück-Abstecher zu vermeiden.

`scripts/analyze-references.mjs` verarbeitet gute GPX-Dateien und
`graveldeluxe-route-feedback/v1` aus `gpx-samples/`. Das reproduzierbare
Browserartefakt `data/reference-analysis.json` enthält ein Raster aus guten und
schlechten Korridoren. `js/reference-analysis.js` bewertet ORS-Kandidaten gegen
dieses Raster; negatives Feedback wirkt stärker als der positive Referenzbonus.
Die Optimierung verändert nicht den ORS-Graph, sondern die transparente Auswahl
der sechs erzeugten Kandidaten.

## Profile

- `gravel`: unveränderter Standard und erste Rückfallstufe.
- `gravel-konstant`: neues Profil aus `profiles/gravel-konstant.brf`.
- `trekking`: letzte Rückfallstufe bei fehlenden Profilen.
- `gravel-deluxe`: ORS-Profil für geschlossene Rundtouren; kein BRouter-Profil.

`fetchRouteWithFallback` versucht das ausgewählte Profil und danach eindeutige
Fallbacks in dieser Reihenfolge. Andere HTTP- oder Netzwerkfehler werden nicht
verschluckt.

## Bewusste Grenzen von Phase 1

Ein `.brf`-Profil bewertet einzelne Kanten. Es kann Straßenklasse, Oberfläche,
Zugang, technische Schwierigkeit und lokale Steigung gewichten. Es kann nicht
zuverlässig die Zahl der Oberflächenwechsel, parallele Wegsprünge oder die
Qualität einer kompletten Rundtour bewerten. Das folgt in Phase 2 außerhalb
von BRouter.
