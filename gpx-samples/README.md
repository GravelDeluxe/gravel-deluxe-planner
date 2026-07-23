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
BAD__kurzer-name.gpx
BAD__kurzer-name.md
```

Die gleichnamige Markdown-Datei sollte kurz enthalten:

```markdown
# Bewertung

- Start/Datum:
- gewünschte Distanz und Höhenmeter:
- gewünschte Himmelsrichtung:
- Gesamturteil: 1–5
- guter Abschnitt: ungefähr von … bis …
- problematischer Abschnitt: ungefähr von … bis …
- Problem: Hauptstraße | Sackgasse | Schieben | Oberfläche | unnötiger Abstecher | anderes
- gewünschte Alternative:
```

Am hilfreichsten ist immer die tatsächlich erzeugte GPX-Datei zusammen mit
einem Ortsnamen oder Kartenpunkt für den fehlerhaften Abschnitt. Ein Screenshot
allein zeigt den exakten Weg meist nicht zuverlässig.
