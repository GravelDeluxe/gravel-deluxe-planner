# Deploymentkontext

## Zielbild

Der Betrieb orientiert sich an den bestehenden GravelDeluxe-/`gd-tools`-
Stacks:

- Images aus einer privaten GitLab Registry;
- Portainer als Stack-Verwaltung;
- Watchtower aktualisiert nur den Scope `gravel-router`;
- große Routingdaten bleiben als Host-Volume außerhalb der Images;
- Browserzugriff auf BRouter erfolgt über Nginx, nicht direkt.

## Lokale Entwicklung

`make setup` ist der kanonische Komplettstart. Das Target:

1. prüft Docker, Curl und Node;
2. lädt fehlende Testsegmente;
3. baut Web-App und BRouter lokal;
4. startet `deploy/compose.local.yml`;
5. berechnet eine echte Route mit `gravel-konstant`.

Die lokale App läuft standardmäßig auf Port `8086`, BRouter zusätzlich für
Diagnosen auf `17777`. `make help` listet Betrieb, Logs und Prüfungen.

## Images

| Image | Dockerfile | Zweck |
| --- | --- | --- |
| `.../app:latest` | `Dockerfile` | Nginx und statische Web-App |
| `.../brouter:latest` | `Dockerfile.brouter` | BRouter plus Gravel-Konstant-Profil |
| `openrouteservice:9.7.1` | offizielles Image | `gravel-deluxe`-Rundtouren ohne API-Key |

Die aktuellen Imagepfade in `deploy/portainer-stack.yml` sind
`registry.gitlab.com/graveldeluxe/gravel-router/...`. Vor dem ersten Deployment
mit dem tatsächlichen GitLab-Namespace vergleichen.

## Persistenz und Variablen

- Standard-Segmentpfad: `/mnt/gravel-router/segments4`
- Standardpfad für zusätzliche Profile:
  `/mnt/gravel-router/customprofiles`
- Standard-Port der Web-App: `8086`
- BRouter-Java-Heap: standardmäßig maximal 2 GiB
- ORS-Daten lokal: `local-data/ors`; auf dem Server standardmäßig
  `/mnt/gravel-router/ors`
- ORS-Java-Heap: standardmäßig maximal 4 GiB

ORS baut beim ersten Start den Graph `graphs/gravel-deluxe`. Das Profil nutzt
den Encoder `cycling-mountain` mit `enable_custom_models=true`. Ein vorhandener
alter Ordner `graphs/cycling-mountain` wird dabei weder überschrieben noch
gelöscht. Der erste Start dauert abhängig von Extrakt und Server einige Minuten;
danach wird der persistierte Graph geladen.

Stack-Variablen:

- `GRAVEL_ROUTER_PORT`
- `BROUTER_SEGMENTS_PATH`
- `BROUTER_CUSTOM_PROFILES_PATH`
- `BROUTER_JAVA_OPTS`
- `ORS_DATA_PATH`
- `ORS_XMS`
- `ORS_XMX`

`.rd5`-Dateien sind groß und dürfen nicht in Git oder Container-Images.

## CI

`.gitlab-ci.yml`:

1. führt `npm test` aus;
2. baut auf dem Default-Branch beide Images;
3. taggt mit Commit-SHA und `latest`;
4. pusht in `$CI_REGISTRY_IMAGE/app` und `$CI_REGISTRY_IMAGE/brouter`.

Portainer benötigt Registry-Zugang. Watchtower mountet dafür wie bei den
bestehenden Tools `/root/.docker` read-only.
