# Architekturkontext

## Upstream

- Basis: `https://github.com/DerRemo/gravel-planner`
- Eingebundener Stand beim Start der Arbeiten: Commit `92e5b15`
- Arbeitsbranch: `feature/gravel-konstant`
- Remote `upstream` zeigt auf das Originalprojekt.

Die Upstream-App ist eine statische HTML-/CSS-/JavaScript-Anwendung ohne
Build-Schritt. Manuelle Strecken und der schnelle Rundkurs-MVP werden über
BRouter berechnet.

## Routingfluss

```text
Browser -> Nginx -> /brouter -> BRouter -> gemountete .rd5-Segmente
```

Lokal zeigt `runtime-config.js` standardmäßig auf den öffentlichen BRouter.
Das Container-Image überschreibt diese Datei mit
`deploy/runtime-config.js`; dort ist der relative Endpunkt `/brouter`
konfiguriert. Nginx proxyfiziert ihn zum Service `brouter:17777`.

## Profile

- `gravel`: unveränderter Standard und erste Rückfallstufe.
- `gravel-konstant`: neues Profil aus `profiles/gravel-konstant.brf`.
- `trekking`: letzte Rückfallstufe bei fehlenden Profilen.

`fetchRouteWithFallback` versucht das ausgewählte Profil und danach eindeutige
Fallbacks in dieser Reihenfolge. Andere HTTP- oder Netzwerkfehler werden nicht
verschluckt.

## Bewusste Grenzen von Phase 1

Ein `.brf`-Profil bewertet einzelne Kanten. Es kann Straßenklasse, Oberfläche,
Zugang, technische Schwierigkeit und lokale Steigung gewichten. Es kann nicht
zuverlässig die Zahl der Oberflächenwechsel, parallele Wegsprünge oder die
Qualität einer kompletten Rundtour bewerten. Das folgt in Phase 2 außerhalb
von BRouter.
