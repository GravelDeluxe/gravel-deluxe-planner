# Gravel Planner – Umsetzungsplan

Stand: 2026-09-11. Dieser Plan trennt den überprüften Iststand, die nächste
Arbeitsreihenfolge und das langfristige Produktziel. Die bisherigen Phasen
bleiben unten als fachliche Spezifikation erhalten; sie sind keine Aussage
über den Fertigstellungsgrad.

## Architektur und Grenzen

- Manuelle Strecken: BRouter mit `gravel` (Original) oder dem separaten
  `gravel-konstant`. Das Originalprofil bleibt unverändert.
- Rundtouren: selbst gehosteter ORS mit `gravel-deluxe`, Custom-Model,
  Kandidatenerzeugung und globaler Nachbewertung im Browser.
- Aktuelle ORS-Abdeckung: Baden-Württemberg. DACH bleibt das Releaseziel;
  eine regionale Zwischenversion ist ausdrücklich noch kein DACH-Release.
- Ein Kantenprofil ersetzt keine globale Bewertung von Oberflächenwechseln,
  parallelen Wegen, Anstiegsfolgen oder Rundkursqualität.
- GPX-Referenzen liefern ein geografisches Rastermodell und werden innerhalb
  des aktuellen ORS-Graphs zusätzlich auf OSM-Kanten gemappt. Eine
  regionsübergreifende Kalibrierung aus Oberflächen-/Straßenklassen fehlt noch.

## Überprüfter Iststand

| Bereich | Vorhanden | Noch nicht erfüllt |
| --- | --- | --- |
| Routing | BRouter, ORS, native und gerichtete Runden, Highlights, drei Vorschläge | systematischer Qualitätsnachweis, DACH-Abdeckung |
| Ranking | Distanz, Höhenmeter, Richtung, Steigung, Wiese/Erde, Referenzkorridore, Fahrfluss | Oberflächenkontinuität, Hauptstraßenanteil, kontextabhängige Parallelwege, Anstiegsqualität, erster Anstieg |
| Referenzen | 38 GPX-Dateien, 36 eindeutige Routen, 4 Feedbackdateien mit 14 Passagen, Map-Matching, Qualitätsanreicherung, optionale Metadaten und Gegenbeispiele | regionsübergreifende Graphabdeckung, separate Testsammlung, administrativer Import |
| App | Karte, Qualitätsreport, Feedback, lokale Speicherung, GPX-Export sowie editierbarer GPX-/Feedbackimport | visuelle Desktop-/Mobilabnahme und Kalibrierung der neuen Kennzahlen |
| Betrieb | lokaler Docker-Stack, Smoke-Tests, GitLab-CI, Portainer-Vorlage | bestätigter GitHub→GitLab-Veröffentlichungsweg, Zielserverabnahme, Datenupdates und Monitoring |

Am 10.09.2026 bestanden die realen BRouter-/ORS-Smoke-Tests. ORS lieferte
Oberflächenabschnitte; ein Graph-Neubau ist deshalb nicht mehr pauschal als
offene Voraussetzung zu behandeln. Diese Prüfung belegt die technische
Funktion, noch keine verbesserte Routenqualität.

## M1 – App-Zustand und Entwicklungssetup stabilisieren

Priorität: zuerst. Die unten markierten Reparaturen sind implementiert.

- [x] Versioniertes Speicherformat für tatsächliches Profil, Oberflächen,
  Planungsmodus, Highlights und sämtliche Zielvorgaben; alte Einträge bleiben
  lesbar, nicht gespeicherte Daten bleiben ausdrücklich unbekannt.
- [x] Beim Umkehren einer Runde Oberflächenintervalle umindizieren, Anstieg neu
  berechnen und die bisherige Kandidatenbewertung verwerfen.
- [x] Bei geänderten Rundenparametern oder Highlights alte Route/Vorschläge
  verwerfen; beim Laden einer Route fremde Vorschläge entfernen.
- [x] BRouter-Profilwahl ausschließlich im Streckenmodus anzeigen.
- [x] Fehlende, unbekannte oder lückenhafte Oberflächendaten von bestätigter
  Einhaltung eines Oberflächenausschlusses unterscheiden.
- [x] Dev-Server über denselben lokalen Routing-Stack betreiben; kein
  funktionsloser externer ORS-Standard ohne API-Key-Eingabe.
- [x] Regressionstests für App-Ereignisse, Speicherformat, Umkehrung und
  Oberflächenunsicherheit ergänzen.
- [ ] Browserabnahme auf Desktop und schmalem Mobilbildschirm durchführen:
  Planung → Variante → Speichern/Laden → Umkehren → Feedback → Export.

Abnahme: Metadaten passen nach jeder Aktion zur angezeigten Geometrie;
veraltete Vorschläge lassen sich nicht übernehmen. Automatisierte Prüfungen
bestehen. Die visuelle Abnahme bleibt separat offen, solange kein Browser
für die Prüfung verfügbar ist.

## M2 – Routensuche begrenzen und Qualität reproduzierbar messen

Priorität: unmittelbar nach M1, Voraussetzung für weitere Score-Kalibrierung.

- [ ] Anfrageverwaltung aus `js/app.js` herauslösen: begrenzte Parallelität,
  Gesamtbudget, Timeout, Abbruchsignal und sichtbarer Fortschritt. Ein
  Planungswechsel soll laufende Anfragen tatsächlich abbrechen.
- [ ] Erfolgreiche Kandidaten bei Teilfehlern behalten; native, gerichtete und
  Highlight-Routen mit denselben Fehler- und Budgetregeln behandeln.
- [ ] Feste Seeds und Fixtures für Home Base, gerichtete Runden, Highlights,
  Graphgrenzen sowie Freiburg/Schwarzwald und weitere DACH-Testorte anlegen.
- [ ] BRouter `gravel` und `gravel-konstant` gegen alle vorhandenen
  Phase-1-Fixtures vergleichen; ORS mit identischen Zielvorgaben separat
  benchmarken. Unterschiedliche Router nicht als reinen Profilvergleich werten.
- [ ] Pro Lauf Engine-/Profil-/Modellversion, Datenstand, Laufzeit, Fehlerquote,
  Distanzabweichung, Höhenmeter, Steigung, bekannte/unbekannte Oberfläche,
  Wechsel und Doppelbefahrung als JSON und lesbaren Bericht speichern.
- [ ] Smoke-Test und App dieselben Routingbausteine verwenden lassen;
  derzeit fehlen dem Smoke-Fallback unter anderem die Snap-Schritte der App.

Abnahme: Eine Änderung lässt sich gegen einen gespeicherten Ausgangsstand
vergleichen. Lange/fehlgeschlagene Anfragen blockieren die Bedienung nicht;
Ergebnisse verworfener Planungen tauchen nicht wieder auf. Verbesserungen
brauchen sowohl Messwerte als auch Kartenprüfung.

## M3 – Routenqualität erklären und Feedback präzisieren

Abhängig von M2; Gewichte erst nach Vergleichsmessungen ändern.

- [x] Negatives Feedback nach Bedeutung behandeln: kontextabhängige
  Abstecher-/Zig-Zag-Kritik als Rankingfaktor; echte zu meidende Passagen
  gesondert kennzeichnen. Nicht jede negative Rasterzelle pauschal sperren.
- [x] Feedbackkorridore auf das Suchgebiet begrenzen, nahe Parallelwege durch
  Geometrienähe trennen und Qualitäts-/Vertrauensangaben führen.
- [x] Positive Referenzkorridore ebenfalls weggenau statt im groben Raster
  bewerten; dafür ist das OSM-Map-Matching aus M5 erforderlich.
- [x] Routenreport mit Oberflächen-km/%, Datenlücken, Wechseln pro 10 km,
  Hauptstraßenanteil, Doppelbefahrung und erklärbaren Teil-Scores ergänzen.
- [x] Lange moderate Anstiege (4–8 %), steile Rampen und Abfahrten separat
  bewerten; ersten Anstieg >20 hm und den Zielbereich 5–10 km ausweisen.
- [x] Erster Anstieg: Aus / Präferenz / Pflicht samt nachvollziehbarer
  Meldung bei ungeeignetem Gelände implementieren.
- [x] Ähnliche Kandidaten erkennen, damit drei Vorschläge echte Alternativen
  darstellen. Karte mit vollständiger Oberflächenlegende und Datenunsicherheit.

Abnahme: Nutzer verstehen, warum eine Route vor einer anderen liegt.
Kritisiertes Zig-Zag sperrt nicht automatisch einen guten benachbarten Weg.
Eine fehlende Datengrundlage erscheint niemals als bestätigte Qualität.

## M4 – Serverbetrieb zuverlässig veröffentlichen

Kann nach M1 parallel zur fachlichen Arbeit vorbereitet werden.

- [ ] GitHub-Origin und vorgesehenes GitLab-CI-/Registry-Ziel abgleichen;
  Spiegelung oder tatsächlichen Build-Auslöser und Namespace dokumentieren.
- [x] CI um Referenzmodell-Konsistenz und beide Compose-Prüfungen ergänzen.
- [x] ORS-Konfiguration im Portainer-Stack über einen absoluten persistenten
  Host-Pfad mounten; Bereitstellung in der Betriebsdokumentation festhalten.
- [ ] Zielserver mit Routingdaten und Konfiguration bestücken; Build/Push,
  Registry-Zugang, Start, echte Routen und Neustart prüfen.
- [ ] Automatische Datenaktualisierung mit Versionsnachweis, vorbereitetem
  Graphwechsel und getesteter Rückkehr zum vorherigen Graphen einrichten.
- [ ] Backend-Healthchecks, Anfrage-/Ressourcenlimits und Monitoring ergänzen;
  Update-/Rollback-Verhalten bei getrennten Images prüfen.
- [ ] Persistente GPX-/Feedback-/Analyseablage und Trennung zwischen
  öffentlicher Planung und Administration festlegen.

Abnahme: Ein frischer Zielhost lässt sich anhand der Anleitung einrichten;
Ausfall, Neustart, Datenwechsel und Rollback sind praktisch geprüft.

## M5 – Referenzanalyse und editierbarer Import

Abhängig von M2/M3; keine vorgezogene ML-Implementierung.

- [x] GPX auf Kanten des selbst gehosteten ORS-/OSM-Graphen mappen und den
  positiven Referenzvergleich bei identischem Graphstand weggenau ausführen.
- [x] Die vom aktuellen Graph abgedeckten GPX tracktreu rekonstruieren und
  mit allen Oberflächen-, Straßen- und Anstiegskennzahlen des Kandidatenreports
  analysieren; Ergebnisse unter 70 % Tracktreue verwerfen.
- [x] Geometrie-, Fahrfluss- und Höhenkennzahlen der guten GPX mit derselben
  Auswertung wie Kandidaten bestimmen und daraus robuste Rahmen ableiten.
- [x] Region, Saison, Fahrradtyp, Bewertung, Notizen,
  Distanz-/Höhenmeterklasse sowie Gegenbeispiele über optionale
  `.gpx.meta.json`-Dateien unterstützen.
- [x] Regelbasierte Zielbereiche und Gewichtungen aus den aktuell 36
  eindeutigen guten Referenzrouten ableiten und per Leave-one-out prüfen.
- [x] Sammlung auf 20–50 vielfältige Routen erweitern.
- [ ] Gegen eine separate, bei der Ableitung nicht verwendete Testsammlung
  prüfen.
- [x] Einzelne GPX-/Feedbackroute als editierbare Planung laden: Start, Ende,
  Highlights und geeignete Stützpunkte rekonstruieren; Highlights erhalten.
- [ ] Verständliche Presets für Gravel-Fokus, Komfort/Technik, Anstiege und
  Rundkurspräferenz ergänzen; Expertengewichtungen erklärbar halten.
- [ ] DACH-Datenabdeckung und feldgeprüfte Referenzsammlung vervollständigen.

Abnahme: Referenzanalyse, Routenreport und Ranking verwenden dieselben
Kennzahlen. Importierte Touren lassen sich gezielt bearbeiten und exportieren;
Kalibrierung verbessert auch bisher nicht verwendete Testtouren.

---

# Fachliche Spezifikation und langfristiges Zielbild

## Produktziel

Auf Basis von [DerRemo/gravel-planner](https://github.com/DerRemo/gravel-planner) entsteht ein erweitertes Gravel-Routing mit einem neuen bRouter-Profil. Es soll gleichmäßigere, besser vorhersehbare Gravel-Rundkurse erzeugen und aus bestehenden, als gut bewerteten GPX-Touren messbar lernen.

Der Schwerpunkt liegt auf drei Eigenschaften:

- möglichst zusammenhängende, ruhige Gravel-Abschnitte statt unnötiger Wechsel zwischen Asphalt und Feld-/Schotterwegen;
- längeren, moderaten Anstiegen (idealerweise 4–8 %) statt kurzer, sehr steiler Rampen;
- einer verständlichen Kartenvisualisierung der Wegoberflächen, angelehnt an die Darstellung von CX Berlin.

## Architekturentscheidung

Das vorhandene Profil bleibt unverändert. Es wird ein separates Profil, vorläufig **„Gravel Konstant“**, ergänzt. So bleiben normales Gravel-Routing und das neue, stärker präferenzbasierte Routing vergleichbar und unabhängig nutzbar.

Ein bRouter-Profil bewertet einzelne Kanten im Wegenetz. Anforderungen, die eine gesamte Tour betreffen – beispielsweise ein möglichst später erster Anstieg oder ein geringer Wiederholungsanteil – werden zusätzlich durch eine Kandidatenbewertung außerhalb des Profils umgesetzt.

```text
Nutzereingaben
  │
  ├─> bRouter: mehrere Kandidaten mit „Gravel Konstant“
  │       │
  │       └─> GPX-/Routensegmente mit Oberflächen- und Höhendaten
  │
  ├─> Routenbewertung (globaler Score)
  │       ├─ Oberflächenkontinuität
  │       ├─ Straßen- und Wechselanteil
  │       ├─ Anstiegsqualität
  │       └─ Rundkurs-/Wiederholungsanteil
  │
  └─> beste Route + Karten-Layer + GPX-Export
```

## Spezifikation 0 – Technische Basis

### Aufgaben

1. Fork von `DerRemo/gravel-planner` einrichten und lokal lauffähig machen.
2. Routing-Pipeline dokumentieren: Frontend, Backend, bRouter-Aufruf, Höhenmodell, Karten-Layer und GPX-Export.
3. Prüfen, welche OSM-Tags aktuell zur Oberflächenbewertung verwendet werden:
   - `highway`, `surface`, `tracktype`, `smoothness`;
   - `sac_scale`, `mtb:scale`, `bicycle`, `access`;
   - `maxspeed`, Straßenklasse und gegebenenfalls Verkehrshinweise.
4. Testgebiet und reproduzierbare Beispielanfragen festlegen.

### Ergebnis

Kurze technische Dokumentation sowie eine lauffähige lokale Entwicklungsumgebung.

## Spezifikation 1 – Profil „Gravel Konstant“

### Wegklassen und Oberflächen

Die folgenden Werte sind Startwerte und werden später mit GPX-Referenzrouten kalibriert.

| Kategorie | Beispiele | Profilverhalten |
| --- | --- | --- |
| Bevorzugt | `surface=gravel`, `fine_gravel`, gute `track`-/`path`-Abschnitte | Niedrige Kosten |
| Akzeptabel | ruhige Nebenstraßen, `unpaved`, befestigte Waldwege | Neutrale bis leichte Kosten |
| Nur Verbindung | Asphalt ohne Verkehr, kurze Ortsdurchfahrten | Erhöhte Kosten |
| Stark meiden | `primary`, `secondary`, Bundes-/Landstraßen, unkomfortable Pfade | Hohe Kosten bzw. Ausschluss |

### Kontinuität statt Zickzack

Ein reines Kantenprofil kann nicht zuverlässig erkennen, ob direkt daneben ein paralleler Alternativweg liegt. Die Umsetzung kombiniert deshalb:

1. moderate Strafkosten für asphaltierte Abschnitte und Straßen höherer Klassen;
2. deutliche Strafkosten für Bundes- und Landesstraßen;
3. eine Nachbewertung der fertigen Route anhand von Oberflächenwechseln und eng benachbarten parallelen Segmenten;
4. Auswahl eines besseren Kandidaten, wenn dieser weniger Wechsel bei ähnlicher Länge aufweist.

Ein Wechsel wird nicht pauschal bestraft: ein kurzer Asphaltverbinder kann sinnvoll sein, wenn er zu einem langen hochwertigen Gravel-Abschnitt führt.

### Anstiegspräferenz

Für jedes Steigungssegment werden Distanz, Höhenmeter, Durchschnittssteigung und Spitzensteigung bestimmt.

- Segmente mit 4–8 %: Bonus, der mit Länge und Höhenmetern steigt.
- Segmente oberhalb von 10–12 %: wachsende Strafkosten, besonders bei kurzen Rampen.
- Flache Übergänge und längere, moderate Anstiege: bevorzugt.
- Abfahrten werden separat bewertet, damit technische oder sehr steile Abschnitte nicht versehentlich als Vorteil zählen.

### Ergebnis

Erste Version des bRouter-Profils inklusive dokumentierter Parameter und Teststrecken.

## Spezifikation 2 – Globale Rundkurs- und Kandidatenbewertung

### Mehrere Kandidaten erzeugen

Pro Anfrage werden mehrere plausible Routenvarianten berechnet, beispielsweise mit leicht variierten Profilparametern oder Zwischenpunkten. Diese Varianten werden nach ihrer Gesamtheit verglichen, nicht nur nach bRouter-Kosten.

### Routenscore

Der Score besteht aus gewichteten, nachvollziehbar angezeigten Teilwerten:

| Faktor | Messung | Ziel |
| --- | --- | --- |
| Gravel-Anteil | Distanz auf bevorzugten Oberflächen | Höher ist besser |
| Oberflächenwechsel | Wechsel pro 10 km | Weniger ist besser |
| Hauptstraßenanteil | Distanz/Kontakt zu hohen Straßenklassen | Niedriger ist besser |
| Paralleles Springen | Wechsel zwischen nahen, parallelen Wegen | Niedriger ist besser |
| Anstiegsqualität | lange 4–8-%-Segmente minus steile Rampen | Höher ist besser |
| Erster Anstieg | km bis zu einem Anstieg von mehr als 20 hm | Zielbereich 5–10 km |
| Rundkursqualität | Überlappung, Sackgassen und Rückfahranteil | Weniger ist besser |

Die Regel für den ersten Anstieg ist eine **weiche Präferenz**: In flachem Gelände darf sie die Route nicht unbrauchbar machen.

### Ergebnis

Eine Route wird mit einem verständlichen Qualitätsprofil angezeigt; Nutzer können alternativ auch die zweit- und drittbeste Variante wählen.

## Spezifikation 3 – GPX-Referenzrouten analysieren

### Datenmodell

Gute Touren werden als GPX importiert und mit Metadaten versehen:

- Name, Region, Saison und Fahrradtyp;
- persönliche Bewertung und optionale Notizen;
- gewünschte Distanz-/Höhenmeterklasse;
- Kennzeichnung als „gute Referenz“ oder „Gegenbeispiel“.

### Analyse

Für jede GPX-Datei werden Punkte auf das OSM-Wegenetz gemappt. Daraus entstehen dieselben Kennzahlen wie im Routenscore:

- Oberflächen- und Straßenklassenanteile;
- Wechselhäufigkeit und parallele Wechsel;
- Steigungssegmente;
- erster signifikanter Anstieg;
- Überschneidungen und Rückfahranteil.

Zunächst wird bewusst ein transparentes, regelbasiertes Lernen verwendet: Kennzahlen guter Referenzrouten werden als Zielbereiche und Gewichtungen übernommen. Das ist mit wenigen GPX-Dateien robust, prüfbar und direkt in ein bRouter-Profil übersetzbar.

Ein statistisches oder ML-basiertes Ranking wird erst dann geprüft, wenn ausreichend vielfältige, bewertete Touren vorliegen.

### Ergebnis

Ein Analysebericht je GPX-Datei und eine aggregierte Empfehlung für Profilgewichtungen.

## Spezifikation 4 – Kartenvisualisierung

### Karten-Layer

Die Karte erhält einen optionalen Oberflächen-Layer, optisch inspiriert von CX Berlin, aber ohne dessen Stil kopieren zu müssen:

- Asphalt, fein geschottert, grob geschottert, Feld-/Waldweg und Pfad erhalten klar unterscheidbare Farben;
- unsichere oder fehlende OSM-Oberflächenangaben werden neutral und sichtbar markiert;
- Steigung kann zusätzlich als Segmentfarbe oder über ein Höhenprofil dargestellt werden;
- eine Legende erklärt Kategorien und Datenlücken.

### Routeninspektion

Für die berechnete Route wird angezeigt:

- erwartete Oberfläche in Kilometern und Prozent;
- erkannte Wechsel;
- relevante Anstiege mit Länge, Höhenmetern und Durchschnittssteigung;
- Warnungen zu Hauptstraßen, unklarer Oberfläche oder sehr steilen Segmenten.

### Ergebnis

Nutzer können vor dem GPX-Export nachvollziehen, warum eine Route als gute Gravel-Route eingestuft wird.

## Spezifikation 5 – Einstellungen und Bedienung

Das Profil bietet einfache Regler statt technischer Profilparameter:

- Gravel-Fokus: ausgewogen / viel Gravel / maximaler Gravel-Anteil;
- Komfort: fest/fahrbar / rauer erlaubt / Trails erlaubt;
- Anstiege: gleichmäßig / neutral / steilere Anstiege erlaubt;
- Rundkurs: möglichst abwechslungsreich / neutral;
- Distanz und Höhenmeterziel.

### Route mit editierbaren Wegpunkten laden

Eine vorhandene GPX- oder Feedbackroute wird als editierbare Planung
geladen. Aus der Geometrie werden Start, Ende, vorhandene Highlights und
geeignete Stützpunkte rekonstruiert. Nutzer können diese Wegpunkte verschieben,
ergänzen oder löschen; anschließend erzeugt und bewertet der GravelDeluxe-
Algorithmus optimierte Varianten, ohne zwingende Highlights zu verlieren.

Die erweiterten Gewichtungen bleiben als Experteneinstellungen verfügbar, werden aber mit verständlichen Beschreibungen versehen.

## Spezifikation 6 – Testen und Kalibrieren

1. Feste Testsammlung mit Startorten, Distanzen, Höhenmeterzielen und Referenz-GPX-Dateien erstellen.
2. Für jede Änderung an Profil oder Score automatisch Kennzahlen vergleichen.
3. Manuelle Kartenprüfung für Abschnitte durchführen, die besonders oft problematisch sind:
   - parallele Landesstraße und Feldweg;
   - Waldweg versus Straßenverbindung;
   - kurze steile Rampen;
   - unvollständig gepflegte OSM-Oberflächen.
4. Ergebnisse im Feld testen und mit kurzen Nutzerbewertungen erfassen.
5. Gewichtungen nur verändern, wenn sich Testwerte und Kartenprüfung gemeinsam verbessern.

Feedback zu „unnötiger Abkürzung“ und „zu viel Zig-Zag“ bleibt im
Referenzmodell nach Problemtyp getrennt. Zusätzlich bewertet ein allgemeiner
Fahrfluss-Score starke Richtungswechsel, Kehrtwenden und wiederholte Passagen,
damit flüssiges Fahren bereits ohne manuelles Feedback bevorzugt wird.

## Abnahmekriterien für den vollständigen DACH-Release

- Das normale Gravel-Profil funktioniert unverändert weiter.
- „Gravel Konstant“ erzeugt auf der Testsammlung nachweisbar weniger Oberflächenwechsel oder erklärt begründete Ausnahmen.
- Bundes-/Landstraßen werden nur verwendet, wenn keine sinnvolle Alternative vorhanden ist.
- Der Routenreport erkennt und bewertet Anstiege von mehr als 20 hm sowie den Zielbereich für den ersten Anstieg.
- Gute GPX-Referenzrouten lassen sich importieren, analysieren und in einem Bericht vergleichen.
- Die Karte zeigt Wegoberflächen und Datenunsicherheiten verständlich an.
- Jede berechnete Route bleibt exportierbar und die Kriterien sind für Nutzer nachvollziehbar.

## Festgelegte Produktvorgaben

### 1. Zielgebiet und Datenbasis

Der erste Release richtet sich an die DACH-Region. Die Auswahl eines Umkreises um den Startpunkt begrenzt die jeweilige Routenberechnung und die Datenauswertung.

- Wegenetz und Oberflächeninformationen stammen aus OpenStreetMap.
- Das System muss mit unvollständigen OSM-Tags umgehen: fehlende Angaben werden nicht als hochwertiger Gravel angenommen, sondern als unsicher bewertet.
- Das Höhenmodell und seine Auflösung werden in Phase 0 passend zur gewünschten Serverarchitektur ausgewählt und dokumentiert.

### 2. GPX-Referenzdaten

Es stehen voraussichtlich 20–50 gute Routen als Referenz zur Verfügung. Das ist eine ausreichend große Grundlage für regelbasierte Kalibrierung und erste statistische Auswertungen, aber noch keine belastbare Basis für ein komplexes ML-Modell.

Die Touren werden möglichst über unterschiedliche Regionen, Distanzen und Höhenmeterklassen verteilt importiert. Falls verfügbar, werden später zusätzlich einige schlechte oder weniger passende Routen als Gegenbeispiele markiert.

### 3. Gravel- und Komfortdefinition als Einstellungen

Die Definition von Gravel ist einstellbar, nicht fest im Profil kodiert. Voreinstellungen bilden verständliche Fahrstile ab:

| Einstellung | Wirkung |
| --- | --- |
| Komfort | bevorzugt asphaltierte Feldwege, feste Waldwege und gut fahrbaren Schotter; Pfade nur zurückhaltend |
| Ausgewogen | bevorzugt gute unbefestigte Wege, akzeptiert asphaltierte Verbinder |
| Rau/Abenteuer | erlaubt gröberen Schotter und ausgewählte einfache Pfade stärker |

Zusätzlich lassen sich maximale technische Schwierigkeit, gewünschter Gravel-Anteil und akzeptierte Asphaltquote einstellen.

### 4. Parallele Wegführungen: Qualitäts- und Kontextregel

Ein paralleler Schotterweg soll nicht allein wegen seines Belags gewählt werden. Seine Bewertung richtet sich nach zusammenhängender Qualität und eigenständigem Routenwert:

1. **Kurzer Abstecher:** Ein kurzer Wechsel von einer Straße auf Schotter und zurück ist unerwünscht und erhält eine deutliche Strafbewertung.
2. **Abkürzung:** Ein schlechter oder langsam fahrbarer Schotterweg wird nicht als Abkürzung gewählt, wenn eine passendere Straßen- oder Asphaltfeldwegverbindung besteht.
3. **Eigenständige Wegführung:** Ein Weg mit genügend räumlichem Abstand zur Straße, ausreichender Länge und guter Oberfläche wird als echte Alternative bevorzugt.
4. **Asphaltierte Feldwege:** Diese werden gegenüber normalen Straßen meist bevorzugt, insbesondere bei ruhiger, eigenständiger Führung und guter Qualität.

Die konkrete Erkennung nutzt nachgelagert eine Segmentanalyse. Dabei werden parallele Abschnitte anhand von Distanz, paralleler Richtung, Länge, Oberflächenqualität, Zeit-/Distanzgewinn und Zahl der Wechsel bewertet. Das Ergebnis fließt in die Kandidatenauswahl ein; es ist nicht allein eine bRouter-Kostenregel.

### 5. Erster signifikanter Anstieg

Die Regel „erster Anstieg von mehr als 20 Höhenmetern nach 5–10 km“ ist je Routenanfrage wählbar:

- **Präferenz:** beeinflusst den Routenscore, kann in flachem Terrain übergangen werden.
- **Pflicht:** Kandidaten außerhalb des Zielbereichs werden verworfen, sofern das Höhenprofil im gewählten Umkreis eine passende Alternative zulässt.
- **Aus:** keine Bewertung dieses Kriteriums.

Bei der Pflichtoption zeigt die Oberfläche verständlich an, wenn das Gelände keine realistische Route zulässt.

### 6. Betrieb auf eigenem Server

Die Anwendung wird für den Betrieb auf einem eigenen Server ausgelegt. Phase 0 ergänzt dafür ein Deployment-Konzept mit:

- Containerisierung von Frontend, Routing-/API-Dienst und Datenjobs;
- persistenter Speicherung für GPX-Referenzrouten, Analyseergebnisse und Profile;
- regelmäßigen OpenStreetMap- und Höhendaten-Updates für die DACH-Region;
- Caching, Limits und Monitoring für rechenintensive Rundkursanfragen;
- klarer Trennung zwischen öffentlicher Nutzeroberfläche und administrativem GPX-/Profilbereich.
