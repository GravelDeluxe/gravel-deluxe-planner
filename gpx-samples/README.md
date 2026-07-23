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

Damit ist kein separates GPX nötig. Für gute Referenzrouten bleibt GPX das
bevorzugte Format.

Nach neuen GPX- oder Feedbackdateien das Referenzmodell aktualisieren:

```sh
make analyze
```

Die Anwendung lädt anschließend `data/reference-analysis.json` und verwendet
gute Korridore als weiche Präferenz sowie schlechte Passagen als starke
Abwertung beim Routenranking.
