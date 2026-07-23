# Fortschritt

Stand: 2026-07-23

## Erledigt

- Leeres Verzeichnis als Git-Repository auf Basis von
  `DerRemo/gravel-planner` eingerichtet.
- Branch `feature/gravel-konstant` angelegt.
- Produktplan als `IMPLEMENTATION_PLAN.md` übernommen.
- Neues Profil `profiles/gravel-konstant.brf` erstellt.
- Profilauswahl in der Oberfläche ergänzt.
- Fallback `gravel-konstant -> gravel -> trekking` implementiert.
- Drei reproduzierbare DACH-Testanfragen als JSON-Fixture angelegt.
- Phase-1-Parameter und Systemgrenzen dokumentiert.
- Web-App- und BRouter-Containerdefinition erstellt.
- Nginx-Reverse-Proxy für einen gemeinsamen Browser-Ursprung erstellt.
- GitLab-CI für Tests sowie Build/Push beider Images erstellt.
- Portainer-Stack mit Host-Volumes und scoped Watchtower erstellt.
- JavaScript-Teststand: 51 Tests erfolgreich.
- Compose-Datei erfolgreich mit `docker compose config` geprüft.
- Agentenkontext token-sparend in `AGENTS.md` und thematische Dateien unter
  `docs/agents/` aufgeteilt.
- Drei aktuelle BRouter-Segmente für die Phase-1-Testgebiete lokal unter
  `local-data/segments4` abgelegt: `E5_N45`, `E10_N45`, `E10_N50`.
- Reproduzierbaren lokalen Komplettstart über `Makefile` und
  `deploy/compose.local.yml` ergänzt.
- BRouter-Containerbuild an BRouter 1.7.9 angepasst: Das ohne Android-SDK
  ohnehin entfernte Gradle-Modul wird nicht mehr per `-x` referenziert.
- `gravel-konstant.brf` mit dem BRouter-1.7.9-Integritätsprüfer validiert.
- Lokalen App-/BRouter-Stack erfolgreich gebaut und gestartet.
- Reale Teststrecke Freiburg–Schwarzwald erfolgreich mit
  `gravel-konstant` berechnet.
- Profilregel ergänzt: Ein eigenständiger, gut fahrbarer Radweg wird gegenüber
  einem gleichwertigen Gravel-Track bevorzugt.
- Ein BRouter-Rundenprototyp wurde getestet und wegen unzureichender
  Routenqualität anschließend durch den selbst gehosteten ORS ersetzt.
- Selbst gehosteten OpenRouteService 9.7.1 mit persistentem
  `cycling-mountain`-Graph für den Regierungsbezirk Stuttgart integriert.
- Native ORS-Rundtour im Raum Bad Rappenau erfolgreich berechnet
  (34,8 km, 704 Geometriepunkte).
- Home Base offline aus OSM ermittelt und als Standardstart gesetzt:
  `49.2442844, 9.1129218`; Standardmodus „Runde“, Standardauswahl
  „Gravel GravelDeluxe“.

## Noch offen vor Abschluss von Phase 1

- Die drei lokalen Testsegmente auf dem Zielserver bereitstellen; für eine
  vollständige DACH-Abdeckung später weitere Segmente ergänzen.
- Portainer-Stack mit dem tatsächlichen GitLab-Projektpfad abgleichen.
- Beispielstrecken gegen `gravel` und `gravel-konstant` real berechnen und
  Resultate dokumentieren.
- UI einmal visuell im Browser prüfen.

## Phase 2

- globale Bewertung von Oberfläche, Wechseln, Anstiegen und Überlappung;
- Alternative 2/3 und erklärbare Teil-Scores.
