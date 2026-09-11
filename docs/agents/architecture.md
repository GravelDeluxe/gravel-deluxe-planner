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

Lokal zeigt `runtime-config.js` auf `/brouter` und `/ors`. `npm run serve`
leitet diese Anfragen an den Docker-Stack auf Port 8086 weiter.
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
der erzeugten Kandidaten (zehn native oder bis zu neun gerichtete Varianten).
Feedbackpassagen werden geometrisch mit zwölf Metern Toleranz abgeglichen.
Normales Feedback beeinflusst ausschließlich das Ranking. Nur eine ausdrücklich
als „Passage künftig sperren“ exportierte und beobachtete Passage erzeugt einen
schmalen ORS-Vermeidungskorridor. Ältere Feedbackdateien bleiben reine
Rankinghinweise. Vor der Kandidatensuche wird das Referenzmodell räumlich auf
das Suchgebiet begrenzt.

`scripts/match-references.mjs` ordnet die GPX-Linien per HMM dem lokalen
ORS-/OSM-Graphen zu. Das Modell speichert interne Kanten-IDs und den
Graph-Zeitstempel. Neue Kandidaten werden gesammelt über denselben Endpunkt
gemappt; nur bei passendem Zeitstempel ersetzt der weggenaue Vergleich das
Raster. Interne Kanten-IDs sind an genau diesen Graphbau gebunden.

`scripts/enrich-references.mjs` rekonstruiert eine Referenz mit höchstens 50
Stützpunkten über das GravelDeluxe-Profil. Erst ab 70 % geometrischer
Trackübereinstimmung übernimmt die Analyse Oberfläche, Straßenklasse und das
ORS-Höhenprofil. Damit verwendet der Strukturrahmen dieselbe Auswertung wie
das Kandidatenranking, ohne eine deutlich veränderte Rekonstruktion als
Originaltour auszugeben.

Die Referenzanalyse führt für gute Touren zusätzlich `analyzeTourStructure`
aus. `buildStructureFrame` bildet bewertungsgewichtete 20-/50-/80-Perzentile,
sobald mindestens fünf Referenzen eine Kennzahl liefern. Je Kennzahl gilt eine
Bandbreite, eine Ober- oder eine Untergrenze; bessere Werte auf der offenen
Seite bleiben neutral. Außerhalb berechnet `scoreTourStructure` eine
begrenzte, je Kennzahl ausgewiesene Abweichungsstrafe. Wenn ein gelernter
Rahmen verfügbar ist, ersetzt er die frühere feste Fahrflussstrafe. Harte
Nutzervorgaben und Sicherheitsgrenzen bleiben unabhängig davon bestehen.

Optionale `.gpx.meta.json`-Dateien gewichten Referenzen nach Bewertung und
führen Region, Saison, Fahrradtyp, Notizen sowie automatisch ableitbare Klassen.
Gegenbeispiele gelangen als negative Gesamtkorridore in das Modell. Die App
parst GPX und Feedback-JSON über `js/route-import.js`; geschlossene Tracks
werden zu Start plus Formpunkten, offene Tracks zu einer manuellen Punktfolge.

ORS liefert `surface` und `waytype` als Zusatzdaten. `js/route-quality.js`
erstellt daraus den Routenreport und erkennt Anstiegssegmente sowie den ersten
Anstieg mit mehr als 20 Höhenmetern. `js/route-geometry.js` enthält die
Geometrienähe für Feedback und Kandidatenähnlichkeit.

CyclOSM-Kacheln werden von `js/tiles.js` einzeln mit Timeout und begrenztem
Backoff geladen. Der Layer aktualisiert erst nach Ende einer Zoombewegung;
dadurch werden laufende Kachelanfragen nicht bei jedem Zoomschritt abgebrochen
oder durch globale DOM-Neuladungen zurückgesetzt.

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

## App-Zustand

`js/route-state.js` kapselt die Wiederherstellung gespeicherter Routen und die
Umkehrung von Geometrie samt Oberflächenintervallen und Anstieg. Neue Einträge
in localStorage tragen `graveldeluxe-saved-route/v2`. Änderungen an einer
Rundenplanung verwerfen die bisherige Route und die Kandidaten. `requestSeq`
verhindert die Übernahme veralteter Antworten, bricht HTTP-Anfragen aber noch
nicht ab (Meilenstein M2).
