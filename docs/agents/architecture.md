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
nach Distanz und Höhenmetern liegt getrennt in `js/candidates.js`.

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
