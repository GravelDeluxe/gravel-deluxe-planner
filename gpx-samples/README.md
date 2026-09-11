# GPX-Beispiele und Routenfeedback

Die Dateien in diesem Ordner sind Referenzrouten, die von Hand geplant wurden
und als **gute Routen** gelten. Sie dienen zunächst als qualitative
Vergleichsbasis; sie werden nicht automatisch als Trainingsdaten in ORS
importiert.

## Neues Feedback ablegen

Für eine gute Route:

```text
GOOD__kurzer-name.gpx
```

Für eine problematische Route:

```text
kurzer-name__feedback.json
```

Diese Datei wird direkt über den Feedback-Modus der Anwendung erzeugt. Sie
enthält:

- die vollständige Route mit allen Koordinaten und Höhen;
- Profil, Gesamtdistanz und Gesamthöhenmeter;
- den beim Export vergebenen Routennamen;
- gewünschte Distanz, Höhenmeter und Himmelsrichtung;
- jede schlechte Passage mit exaktem IN-/OUT-Punkt, Teilgeometrie,
  Problemauswahl und optionaler Notiz.

Neue Passagen enthalten zusätzlich `effect` und `confidence`. `penalty` ist
der Standard und beeinflusst ausschließlich das Ranking. `avoid` ist für
eindeutig beobachtete, dauerhaft zu meidende Passagen vorgesehen und erzeugt
einen schmalen Sperrkorridor. Dateien ohne diese Felder gelten aus
Kompatibilitätsgründen als ältere Rankinghinweise.

Damit ist kein separates GPX nötig. Für gute Referenzrouten bleibt GPX das
bevorzugte Format.

Zu jeder GPX kann optional eine gleichnamige Metadatendatei mit der Endung
`.gpx.meta.json` liegen. Ein Beispiel steht in
`reference.gpx.meta.json.example`. Unterstützt werden Region, Saison,
Fahrradtyp, Bewertung von 1 bis 5, Notizen sowie Distanz- und
Höhenmeterklasse. Mit `"kind": "counterexample"` wird der gesamte Track als
negatives Beispiel behandelt; `problem` beschreibt den Grund. Ohne Metadaten
gilt eine GPX weiterhin als gute, mit 5 bewertete Gravelbike-Referenz.

Nach neuen GPX- oder Feedbackdateien das Referenzmodell aktualisieren:

```sh
make analyze
```

Nach einem ORS-Graphwechsel oder für vollständige Qualitätswerte zusätzlich:

```sh
make match-references
make enrich-references
```

Die Anreicherung übernimmt Oberflächen-, Straßen- und Höhenwerte nur, wenn die
ORS-Rekonstruktion mindestens 70 % des ursprünglichen GPX-Tracks trifft.

Die Anwendung lädt anschließend `data/reference-analysis.json` und verwendet
gute Korridore als weiche Präferenz sowie schlechte Passagen als starke
Abwertung beim Routenranking. Nur ausdrücklich gesperrte neue Passagen werden
bereits bei der Routensuche vermieden.
