# Test- und Verifikationskontext

## Schnelle lokale Prüfung

```sh
make validate
```

Aktueller Stand: 56 Node-Tests, BRouter-Profilintegrität und eine reale
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
- `make smoke-ors` sendet eine echte Rundtour-Anfrage samt Custom-Model; dafür
  ist kein API-Key nötig.
