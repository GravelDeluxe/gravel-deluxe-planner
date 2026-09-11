# Fortschritt

Stand: 2026-09-11

## Aktueller Stand

- M5-Import umgesetzt: GPX- und Feedbackdateien lassen sich als editierbare
  Planung laden. Geschlossene Tracks erhalten vier verschiebbare Formpunkte,
  offene Tracks eine editierbare Punktfolge; GPX-Wegpunkte bleiben Highlights.
- GravelDeluxe-Neuberechnungen verwenden importierte Formpunkte und Highlights.
  Speicherung erhält Formpunkte und die ursprüngliche Importgeometrie.
- Referenz-GPX unterstützen optionale Metadaten für Region, Saison,
  Fahrradtyp, Bewertung, Notizen, Klassen und Gegenbeispiele. Das Modell weist
  robuste Distanz-/Höhenmeterbereiche und die Datensatzabdeckung aus.
- 28 der 35 eindeutigen Referenzen sind per ORS-HMM auf 13.924 eindeutige
  Kanten des aktuellen Baden-Württemberg-Graphs gemappt. Sieben Routen in den
  Haßbergen, Tirol, der Toskana und im Trentino bleiben mangels Graphabdeckung
  im geometrischen Rückfallmodell. Der Graph-Zeitstempel verhindert Vergleiche
  mit veralteten internen Kanten-IDs.
- Gute Referenzen definieren jetzt den Rankingrahmen für Höhenmeterdichte,
  Doppelbefahrung, Richtungswechsel, Kehrtwenden, Rundenschluss und Anstiege.
  Das bewertungsgewichtete 20.–80.-Perzentil liefert sinnvolle Band-, Ober-
  oder Untergrenzen; bessere Werte werden nicht bestraft. Abweichungen
  erscheinen je Kennzahl im Routenreport.
- 23 vom Baden-Württemberg-Graph ausreichend tracktreu rekonstruierte
  Referenzen wurden angereichert. Damit lernt der Rahmen jetzt auch
  Oberflächenwechsel, Hauptstraßen- und Gravelanteil aus denselben
  Qualitätsfunktionen wie das Kandidatenranking.
- Eine Leave-one-out-Prüfung berechnet für jede Referenz einen Rahmen ohne
  diese Route. Aktuell: mediane Abweichung 0,27, 80. Perzentil 0,66.
- M3 umgesetzt: Feedback unterscheidet Rankingstrafe und ausdrücklich
  beobachtete Sperrpassage; räumliches Matching verwendet einen schmalen
  Geometriekorridor und das Referenzmodell wird auf das Suchgebiet begrenzt.
- Routenreport ergänzt: Oberflächenanteile/-wechsel, Datenlücken,
  Hauptstraßenanteil, Doppelbefahrung, Anstiege und erster signifikanter
  Anstieg. Erste-Anstieg-Regel ist Aus/Präferenz/Pflicht.
- Nahezu identische Kandidaten werden zugunsten unterschiedlicher Alternativen
  zurückgestellt. Kandidaten zeigen Teilwerte und Gesamtscore.
- Kartenkacheln werden pro Kachel mit Timeout und begrenztem Backoff geladen;
  während Zoomanimationen werden keine noch laufenden Bilder mehr global neu
  gestartet.
- Umsetzungsplan in M1–M5 mit Abhängigkeiten und Abnahmekriterien gegliedert;
  die früheren Phasen bleiben als langfristige Spezifikation erhalten.
- Speicherformat `graveldeluxe-saved-route/v2` erhält Profil, Oberflächen,
  Modus, Highlights und alle Zielparameter. Alte Einträge bleiben lesbar.
- Umkehrung einer Runde passt Oberflächenindizes und Anstieg an; alte
  Vorschläge werden verworfen. Planungsänderungen und Laden entfernen
  ebenfalls veraltete Kandidaten.
- BRouter-Profilwahl nur noch im Streckenmodus. Dev-Server leitet `/brouter`
  und `/ors` an den lokalen Stack weiter; unbekannte Oberflächen sind neutral
  markiert und bestätigen keinen Oberflächenausschluss.
- 135 Node-Tests erfolgreich, einschließlich App-Ereignissen mit
  DOM-/Leaflet-Adaptern. Beide Compose-Dateien und Referenzmodell geprüft.
- Portainer nutzt einen absoluten Host-Pfad für die ORS-Konfiguration;
  CI prüft Compose und das reproduzierbare Referenzmodell.
- Referenzmodell: 35 eindeutige gute Routen aus 37 GPX-Dateien, 4
  Feedbackdateien mit 14 Passagen; 19.085 gute und 162 schlechte Rasterzellen.
- Reale BRouter- und ORS-Smoke-Tests am 10.09.2026 erfolgreich; ORS liefert
  Oberflächendaten. Ein Graph-Neubau ist derzeit keine offene Voraussetzung.

## Bisher umgesetzt (Historie)

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
- JavaScript-Teststand: 96 Tests erfolgreich.
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
- Geometrische Formpunkte und Highlights werden vor dem Via-Routing über den
  ORS-Snap-Endpunkt mit 2,5 km Suchradius auf den GravelDeluxe-Graphen gezogen.
- ORS-Datengrundlage vom Regierungsbezirk Stuttgart auf ganz
  Baden-Württemberg erweitert. Bad Rappenau lag zu nah an der nördlichen
  Extraktgrenze; Rundpunkte Richtung Odenwald fielen aus dem Graphen.
- Startmarker im Rundenmodus stoppt Klick-Propagation und wird beim Anklicken
  nicht mehr entfernt bzw. durch den nachfolgenden Karten-Klick neu gesetzt.
- Gerichtete Runden verwenden jetzt eine tropfenförmige Via-Geometrie vollständig
  im gewählten Sektor. Highlights werden erst in diese gerichtete Grundrunde
  einsortiert; dadurch entstehen keine Nord-Highlights an südlichen Runden mehr.
- Feedbacktypen „unnötige Abkürzung“ und „zu viel Zig-Zag“ ergänzt und im
  Referenzmodell nach Kategorie getrennt. Ein allgemeiner Fahrfluss-Score
  bestraft zusätzlich starke Richtungswechsel, Kehrtwenden und Doppelbefahrung.
- Negative Feedbackzellen wurden zunächst pauschal als ORS-`avoid_polygons`
  ausgeschlossen. M3 hat dieses grobe Verhalten ersetzt: Nur ausdrücklich
  gesperrte, beobachtete Passagen erzeugen einen schmalen Vermeidungskorridor;
  sonstiges und älteres Feedback bleibt eine Rankingstrafe.
- Maximalsteigung ist lexikografisch wichtiger als Distanz: Die
  Kandidatensuche erweitert sich bis 150 % der gewünschten Maximaldistanz und
  sortiert jede steigungsverträgliche Route vor einer kürzeren steilen Route.
- Interne Formpunkte gerichteter ORS-Runden werden nicht mehr als blaue,
  editierbare Kartenmarker angezeigt; sichtbar bleiben Start und Highlights.
- Kartenroute in Bodenabschnitte zerlegt: Tooltip nennt die ORS-Oberfläche,
  Richtungspfeile zeigen die Fahrtrichtung; Rot/Braun/Violett markieren
  Steigung, ausgeschlossene Wiese/Erde bzw. kombinierte Verstöße.
- Feedbackexport enthält `surfaceSegments` und verwendet sekundengenaue,
  eindeutige Zeitstempel im Dateinamen.
- Scrubber dauerhaft in das untere Distanz-/Höhenprofil-Overlay verschoben.
  Er koppelt Kartenpunkt, Kilometer, aktuelle Höhe und Profilcursor; IN/OUT-
  Bereiche erscheinen auf Karte und Höhenprofil gelb, Steigungen hellorange.
- GPX- und Feedbackroute als editierbare Planung laden und über sichtbare
  Formpunkte mit dem GravelDeluxe-Algorithmus neu berechnen.

## Nächste Schritte

1. **M1/M3 visuell abnehmen:** Desktop-/Mobilansicht, Kachel-Zoom,
   Qualitätsreport und erste-Anstieg-Regel prüfen; der verfügbare
   Computerzugang bietet derzeit keinen Browser. DOM-Adaptertests ersetzen
   diese Abnahme nicht.
2. **M2:** begrenzte, abbrechbare Kandidatensuche und reproduzierbare
   Qualitätsvergleiche. Alle drei BRouter-Fixtures mit Original und neuem
   Profil vergleichen; gerichtete ORS-Runden und Highlights separat prüfen.
3. **M3 kalibrieren:** Reportwerte auf festen Teststrecken prüfen und Gewichte
   erst anhand der M2-Vergleichsläufe verändern.
4. **M4:** GitHub-Origin mit GitLab-CI-/Registry-Veröffentlichung abgleichen,
   Zielserver einrichten und Updates/Rollback praktisch prüfen.
5. **M5:** Referenzen um Oberflächen-/Straßenwerte ergänzen, Presets
   kalibrieren, an einer separaten Testsammlung validieren und die
   DACH-Abdeckung vervollständigen.

Details und Abnahmekriterien: `IMPLEMENTATION_PLAN.md`. Fehlender echter
HTTP-Abbruch, Teilfehlerbehandlung und systematische Qualitätsnachweise sind
bewusst noch offen; reine technische Smoke-Tests schließen sie nicht ab.
