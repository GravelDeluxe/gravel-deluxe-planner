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
- JavaScript-Teststand: 81 Tests erfolgreich.
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
- Eigenes ORS-Profil `gravel-deluxe` auf Basis des Encoders
  `cycling-mountain` eingerichtet; Custom-Models sind beim Graphaufbau aktiv.
- GravelDeluxe-Custom-Model ergänzt: Hauptstraßen, Stufen, Schiebepassagen und
  sehr schlechte Wege werden abgewertet; ein paralleler guter Radweg wird
  gegenüber einem Track bevorzugt.
- Mindest- und Maximalwerte für Höhenmeter in der Rundenoberfläche ergänzt.
  Sechs Varianten werden gemeinsam nach Distanz und Höhenmetern bewertet, die
  drei bestpassenden angezeigt und Zielabweichungen getrennt markiert.
- Automatischer ORS-Smoke-Test prüft jetzt eine echte Runde über
  `/ors/v2/directions/gravel-deluxe/geojson`.
- Grobe Rundenausrichtung mit acht Himmelsrichtungen ergänzt. Gewertet wird
  die Peilung vom Start zum geometrischen Routenschwerpunkt; sie beeinflusst
  das Kandidatenranking, bildet aber bewusst keine harte Sperrzone.
- 18 manuell geplante Referenz-GPX unter `gpx-samples/` übernommen. Der Ordner
  dokumentiert gute GPX-Referenzen und das JSON-Format für problematische
  Routen.
- Interaktiven Feedback-Modus ergänzt: Die vollständige Route lässt sich
  scrubben, ein Kartencursor folgt der Position und mehrere schlechte Passagen
  können per IN/OUT markiert, kategorisiert und rot visualisiert werden.
- Feedback-Exportformat `graveldeluxe-route-feedback/v1` ergänzt. JSON enthält
  die vollständige Route, exakte Teilgeometrien der Passagen, Profil,
  Zielparameter, Notizen und Routenname.
- Gemeinsames Routennamensfeld ergänzt; GPX- und Feedback-Dateiname sowie der
  interne GPX-Name übernehmen den eingegebenen Wert.
- GPX- und Feedbackanalyse als `make analyze` ergänzt. Sie versteht klassische
  GPX-Dateien sowie namensraumpräfixierte, selbstschließende Hammerhead-Punkte.
- 18 GPX-Dateien analysiert: 17 eindeutige gute Routen, eine Dublette und 7.669
  gute Rasterkorridore erkannt. Noch keine Feedbackdatei lag zur Analyse vor.
- Reproduzierbares Modell `data/reference-analysis.json` integriert. Neue
  ORS-Kandidaten erhalten einen moderaten Bonus für gute Referenzkorridore und
  eine deutlich stärkere Strafe für markierte schlechte Passagen.
- Vorschlagsanzeige um Referenzübereinstimmung und Feedbackwarnung ergänzt.
- Rundenoptionen für Erd-/Gras-Wiesenwege und maximale Steigung ergänzt;
  Standardgrenze sind 10 %. Weil der aktuelle ORS-Graph `surface` und
  `average_slope` nicht als Custom-Model-Encoded-Values bereitstellt, wertet das
  Ranking beide Vorgaben nach der Antwort aus. `WaySurfaceType` ist nun explizit
  im Graphbau aktiviert; die Oberfläche kommt über ORS-`extra_info`.
- `make ors-rebuild` ergänzt: Der bestehende GravelDeluxe-Graph wird
  wiederherstellbar in `local-data/ors/graph-backups/` verschoben und mit
  `WaySurfaceType` neu gebaut.
- Karten-Highlights ergänzt. Sie werden anhand der nativen Rundengeometrie
  einsortiert und gemeinsam mit vier Formstützpunkten als verpflichtende
  ORS-Via-Punkte neu geroutet.
- Highlights und neue Routenoptionen werden in gespeicherten Routen sowie im
  Feedback-Export mitgeführt.
- Native ORS-Rundtouren wiederholen den bekannten Fehler „Could not find a
  valid point“ automatisch mit bis zu vier Seeds und wechselnden Formpunktzahlen.
- Der ORS-Smoke-Test verwendet dieselbe Fehlerbehandlung mit acht
  deterministischen Varianten und gibt nicht wiederholbare ORS-Fehler direkt aus.
- Falls ORS keine native Rundtour erzeugen kann, bauen App und Smoke-Test eine
  geschlossene Form aus drei Via-Punkten auf und lassen diese regulär durch das
  GravelDeluxe-Profil routen.
- Spätere Funktion „Route mit editierbaren Wegpunkten laden und durch den
  GravelDeluxe-Algorithmus optimieren“ im Implementierungsplan vorgemerkt.

## Noch offen vor Abschluss von Phase 1

- Die drei lokalen Testsegmente auf dem Zielserver bereitstellen; für eine
  vollständige DACH-Abdeckung später weitere Segmente ergänzen.
- Portainer-Stack mit dem tatsächlichen GitLab-Projektpfad abgleichen.
- Beispielstrecken gegen `gravel` und `gravel-konstant` real berechnen und
  Resultate dokumentieren.
- UI einmal visuell im Browser prüfen.
- Neuen ORS-Graph bei laufendem Docker bauen und `make smoke-ors` ausführen
  (Docker Desktop war bei der Implementierung nicht gestartet).

## Phase 2

- globale Bewertung von Oberfläche, Wechseln, Anstiegen und Überlappung;
- Alternative 2/3 und erklärbare Teil-Scores.
