# Test- und Verifikationskontext

## Schnelle lokale Prüfung

```sh
make validate
```

Aktueller Stand: 81 Node-Tests, BRouter-Profilintegrität und eine reale
Freiburg–Schwarzwald-Route mit `gravel-konstant` erfolgreich geprüft.

## Profilprüfung

Vor Abschluss von Phase 1 muss `profiles/gravel-konstant.brf` vom BRouter-
Expression-Parser akzeptiert werden. Eine reine Text- oder JavaScript-Prüfung
reicht dafür nicht.

`make setup` baut das BRouter-Image und `make smoke` validiert das Profil mit
einer echten Anfrage. Anschließend mindestens eine reale Anfrage je
Fixture aus `tests/fixtures/phase-1-routes.json` mit beiden Profilen ausführen.

Zu protokollieren:

- Profilname;
- Distanz und Höhenmeter;
- HTTP-/Parserfehler;
- auffällige Hauptstraßenabschnitte;
- plausibler Gravelverlauf;
- steile oder technische Problemsegmente.

## UI-Prüfung

- `npm run serve`
- Originalprofil berechnet weiterhin eine Route.
- Gravel Konstant ist auswählbar.
- Beim öffentlichen BRouter erscheint der Fallback-Hinweis.
- Im Container wird `/brouter` verwendet.
- Auswahländerung routet eine bestehende manuelle Strecke neu.
- Rundenmodus erzeugt sechs Varianten über das selbst gehostete ORS-Profil
  `gravel-deluxe`, bewertet Distanz und Höhenmeter und zeigt die besten drei.
- Eine gewählte Himmelsrichtung beeinflusst das Ranking anhand des räumlichen
  Routenschwerpunkts; Tests decken geschlossene Nord- sowie West-/Ost-Runden ab.
- `make smoke-ors` sendet eine echte Rundtour-Anfrage samt Custom-Model; dafür
  ist kein API-Key nötig. Nicht routbare, intern zufällig gesetzte ORS-Punkte
  werden dabei mit bis zu acht Seeds und wechselnden Formpunktzahlen wiederholt.
- Feedbacktests prüfen Scrubber-Index, Streckendistanz, umgekehrte IN-/OUT-
  Reihenfolge, ungültige Markierungen sowie den Export der vollständigen Route.
- Referenztests prüfen normales und Hammerhead-GPX, Rasterbildung,
  Routenkennzahlen, positive Korridore, negative Feedbackpassagen und deren
  Einfluss auf das Kandidatenranking.
- ORS-, Constraint- und Highlighttests prüfen Oberflächen-Zusatzdaten,
  Steigungsberechnung, Koordinatenkonvertierung, Via-Routing sowie die
  räumliche Einsortierung verpflichtender Highlights. Der ORS-Smoke-Test
  verwendet ausschließlich Encoded Values, die das Profil bereitstellt.
