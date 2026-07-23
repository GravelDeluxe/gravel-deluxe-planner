# Phase 1: Profil „Gravel GravelDeluxe“

## Umfang

Phase 1 ergänzt das bestehende Profil, ersetzt es aber nicht. In der Oberfläche
kann für manuell gesetzte Strecken zwischen `gravel` und `gravel-konstant`
gewählt werden. Ist das neue Profil am konfigurierten BRouter nicht vorhanden,
fällt die Anwendung kontrolliert auf `gravel` und danach auf `trekking` zurück.

Rundtouren werden über die selbst gehostete OpenRouteService-Instanz mit
`cycling-mountain` erzeugt. Die App fragt drei Ziellängen an und zeigt die
geschlossenen Varianten. Manuelle Strecken nutzen das ausgewählte
BRouter-Profil; eine spätere globale Qualitätsbewertung bleibt Teil von
Phase 2.

## Startgewichtung

Die editierbaren Parameter stehen am Anfang von
`profiles/gravel-konstant.brf`.

| Merkmal | Startwert / Verhalten |
| --- | --- |
| eigenständiger, gut fahrbarer Radweg | 1,00; Vorrang vor gleichwertigem Gravel-Track |
| guter Gravel | Kostenfaktor 1,00–1,10 |
| guter `track` | zusätzlicher Klassenfaktor 1,08 |
| ruhiger Asphaltverbinder | 1,65 plus Straßenklasse |
| unbekannte Oberfläche | 1,80 |
| `tertiary` | 4,50 plus Oberfläche/Verkehr |
| `secondary` | 8,00 plus Oberfläche/Verkehr |
| `primary` | 12,00 plus Oberfläche/Verkehr |
| Anstieg über 8 % | zusätzliche Steigungskosten |
| technische Abfahrt | Strafe ab 6 % |
| technische Pfade / Treppen | ausgeschlossen |

BRouter verlangt einen Kostenfaktor von mindestens 1. Bevorzugung wird deshalb
durch Werte nahe 1 und die relative Verteuerung unerwünschter Kanten erreicht.
Eine echte Belagswechselzählung oder ein Bonus für einen ganzen, langen
4–8-%-Anstieg ist mit dem lokalen Kantenmodell nicht zuverlässig möglich.

### Radweg neben Schotterweg

Ein separat in OSM erfasster, gut fahrbarer `highway=cycleway` erhält Vorrang
vor einem `highway=track`. Das Profil erkennt nicht, ob beide Wege geometrisch
parallel liegen. Wenn sie jedoch dieselben Anschlussmöglichkeiten bieten,
entscheidet die niedrigere Radweggewichtung zugunsten des Radwegs. Raue oder
technische Radwege erhalten diesen Vorrang nicht.

## Docker/Portainer-Betrieb

Der produktive Stack folgt dem Muster der bestehenden GravelDeluxe-Tools:
getrennte Images in der GitLab Registry, persistente Host-Verzeichnisse,
Watchtower mit eigenem Scope und Konfiguration über Stack-Variablen.

1. GitLab-Projektpfad und die beiden `image:`-Werte in
   `deploy/portainer-stack.yml` bei Bedarf anpassen.
2. Auf dem Server `/mnt/gravel-router/segments4` und
   `/mnt/gravel-router/customprofiles` anlegen.
3. Die benötigten DACH-`.rd5`-Dateien nach `segments4` laden.
4. GitLab Registry in Portainer hinterlegen und den Stack aus
   `deploy/portainer-stack.yml` deployen.
5. Optional `GRAVEL_ROUTER_PORT`, `BROUTER_SEGMENTS_PATH`,
   `BROUTER_CUSTOM_PROFILES_PATH` und `BROUTER_JAVA_OPTS` als
   Stack-Umgebungsvariablen setzen.

Nginx veröffentlicht App und BRouter unter demselben Ursprung. Dadurch braucht
der Browser keine CORS-Sonderkonfiguration. Das Profil ist bereits im
BRouter-Image enthalten; `customprofiles` bleibt für Experimente persistent.

## Manuell betriebenen BRouter verbinden

1. `profiles/gravel-konstant.brf` in das `profiles2`-Verzeichnis der
   BRouter-Serverinstallation kopieren oder dieses Verzeichnis als Volume
   einbinden.
2. Die für das Testgebiet benötigten `.rd5`-Segmentdateien im Server
   bereitstellen.
3. In `runtime-config.js` `brouterBase` auf den HTTP-Endpunkt setzen, zum
   Beispiel `http://localhost:17777/brouter`.
4. App über `npm run serve` starten und „Gravel Konstant“ auswählen.

Bei getrennten Hosts muss der BRouter-Endpunkt passende CORS-Header liefern
oder über denselben Reverse Proxy wie die Anwendung veröffentlicht werden.

## Reproduzierbare Testanfragen

Die Fixtures in `tests/fixtures/phase-1-routes.json` decken drei DACH-Szenarien
ab: Schwarzwald, Berliner Umland und Voralpen. Für einen Profilvergleich werden
jeweils dieselben Wegpunkte einmal mit `gravel` und einmal mit
`gravel-konstant` berechnet. In Phase 1 werden Route, Distanz, Höhenmeter und
visuelle Plausibilität verglichen. Automatische Segmentkennzahlen folgen mit
der Kandidatenanalyse.

## Bekannte Grenze

Das Profil bewertet einzelne OSM-Kanten. Oberflächenkontinuität, parallele
Wegsprünge, Wiederholungsanteil und die Lage des ersten signifikanten Anstiegs
benötigen die geplante globale Routenbewertung.
