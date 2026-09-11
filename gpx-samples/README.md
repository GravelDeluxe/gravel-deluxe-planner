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

Nach neuen Feedbackdateien genügt:

```sh
make analyze
```

Nach neuen guten GPX-Dateien sowie nach einem ORS-Graphwechsel:

```sh
make match-references
make enrich-references
```

Ein ORS-Graphwechsel ist ein Neuaufbau des routbaren Wegenetzes, etwa durch
`make ors-rebuild`, eine neue `.osm.pbf`-Datei oder geänderte Eigenschaften des
Routingprofils. Ein normaler Neustart der App ist kein Graphwechsel. Die
internen Kanten-IDs sind an einen konkreten Graphbau gebunden; ein gespeicherter
Zeitstempel verhindert, dass alte IDs mit einem neuen Graph verglichen werden.

Die Anreicherung übernimmt Oberflächen-, Straßen- und Höhenwerte nur, wenn die
ORS-Rekonstruktion mindestens 70 % des ursprünglichen GPX-Tracks trifft.

Die Anwendung lädt anschließend `data/reference-analysis.json` und verwendet
gute Korridore als weiche Präferenz sowie schlechte Passagen als starke
Abwertung beim Routenranking. Nur ausdrücklich gesperrte neue Passagen werden
bereits bei der Routensuche vermieden.
