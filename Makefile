SHELL := /bin/sh

COMPOSE := docker compose -f deploy/compose.local.yml
APP_URL ?= http://localhost:8086
SEGMENT_DIR := local-data/segments4
CUSTOM_PROFILE_DIR := local-data/customprofiles
ORS_DATA_DIR := local-data/ors
ORS_PBF := $(ORS_DATA_DIR)/files/baden-wuerttemberg-latest.osm.pbf
ORS_PBF_URL := https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf
SEGMENT_BASE_URL := https://brouter.de/brouter/segments4
SEGMENTS := E5_N45.rd5 E10_N45.rd5 E10_N50.rd5
SEGMENT_FILES := $(addprefix $(SEGMENT_DIR)/,$(SEGMENTS))

.DEFAULT_GOAL := help

.PHONY: help doctor dirs segments ors-data ors-rebuild analyze build up setup smoke smoke-ors test validate logs status down restart

help:
	@echo "Gravel Router – lokale Entwicklungsumgebung"
	@echo ""
	@echo "  make setup     Daten prüfen, Images bauen, Stack starten, Profil testen"
	@echo "  make up        lokalen Stack bauen und starten"
	@echo "  make smoke     echte Route mit gravel-konstant berechnen"
	@echo "  make smoke-ors lokale ORS-Instanz und Rundtour prüfen"
	@echo "  make ors-rebuild GravelDeluxe-Graph mit Oberflächendaten neu bauen"
	@echo "  make analyze   GPX- und Feedbackreferenzen neu analysieren"
	@echo "  make test      JavaScript-Tests ausführen"
	@echo "  make validate  Tests, Compose und Git-Diff prüfen"
	@echo "  make logs      Container-Logs verfolgen"
	@echo "  make status    Containerstatus anzeigen"
	@echo "  make restart   lokalen Stack neu starten"
	@echo "  make down      lokalen Stack stoppen"
	@echo ""
	@echo "App nach dem Start: $(APP_URL)"

doctor:
	@command -v docker >/dev/null || { echo "Fehler: Docker ist nicht installiert."; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "Fehler: Docker-Daemon läuft nicht. Bitte Docker Desktop starten."; exit 1; }
	@command -v curl >/dev/null || { echo "Fehler: curl fehlt."; exit 1; }
	@command -v node >/dev/null || { echo "Fehler: Node.js fehlt."; exit 1; }
	@command -v rg >/dev/null || { echo "Fehler: ripgrep (rg) fehlt."; exit 1; }

dirs:
	@mkdir -p "$(SEGMENT_DIR)" "$(CUSTOM_PROFILE_DIR)" \
		"$(ORS_DATA_DIR)/config" "$(ORS_DATA_DIR)/elevation_cache" \
		"$(ORS_DATA_DIR)/files" "$(ORS_DATA_DIR)/graphs" "$(ORS_DATA_DIR)/logs"

segments: dirs $(SEGMENT_FILES)
	@echo "Kartensegmente sind vollständig vorhanden:"
	@ls -lh $(SEGMENT_FILES)

$(SEGMENT_DIR)/%.rd5:
	@echo "Lade $* für die lokalen Testgebiete ..."
	@curl --fail --location --continue-at - \
		--output "$@.part" "$(SEGMENT_BASE_URL)/$*.rd5"
	@mv "$@.part" "$@"

ors-data: dirs $(ORS_PBF)
	@ls -lh "$(ORS_PBF)"

ors-rebuild: doctor ors-data
	@echo "Stoppe ORS und sichere den bisherigen GravelDeluxe-Graphen ..."
	@$(COMPOSE) stop ors
	@mkdir -p "$(ORS_DATA_DIR)/graph-backups"
	@if [ -d "$(ORS_DATA_DIR)/graphs/gravel-deluxe" ]; then \
		backup="$(ORS_DATA_DIR)/graph-backups/gravel-deluxe-$$(date +%Y%m%d-%H%M%S)"; \
		mv "$(ORS_DATA_DIR)/graphs/gravel-deluxe" "$$backup"; \
		echo "Alter Graph gesichert: $$backup"; \
	fi
	@$(COMPOSE) up -d ors
	@echo "ORS baut GravelDeluxe mit WaySurfaceType neu. Fortschritt: make logs"

$(ORS_PBF):
	@echo "Lade OSM-Extrakt Regierungsbezirk Stuttgart für OpenRouteService ..."
	@curl --fail --location --continue-at - \
		--output "$@.part" "$(ORS_PBF_URL)"
	@mv "$@.part" "$@"

analyze:
	npm run analyze

build: doctor analyze
	$(COMPOSE) build

up: doctor segments ors-data analyze
	$(COMPOSE) up -d --build
	@echo "Stack gestartet: $(APP_URL)"

setup: up smoke smoke-ors
	@echo "Lokales System ist einsatzbereit: $(APP_URL)"

smoke: doctor
	@echo "Warte auf BRouter und validiere gravel-konstant mit einer echten Route ..."
	@curl --fail --silent --show-error \
		--retry 30 --retry-all-errors --retry-delay 2 \
		--output /tmp/gravel-router-smoke.json \
		"$(APP_URL)/brouter?lonlats=7.842100,47.999000%7C7.970000,47.960000&profile=gravel-konstant&alternativeidx=0&format=geojson"
	@rg -q '"features"' /tmp/gravel-router-smoke.json || { \
		echo "Fehler: BRouter-Antwort enthält keine Route."; \
		sed -n '1,40p' /tmp/gravel-router-smoke.json; \
		exit 1; \
	}
	@echo "Profil akzeptiert; Teststrecke wurde erfolgreich berechnet."

smoke-ors: doctor
	@echo "Prüfe lokale OpenRouteService-Instanz und GravelDeluxe-Custom-Model ..."
	@curl --fail --silent --show-error \
		--retry 80 --retry-all-errors --retry-delay 5 \
		"$(APP_URL)/ors/v2/health"
	@echo ""
	@node scripts/smoke-ors.mjs \
		"$(APP_URL)/ors/v2/directions/gravel-deluxe/geojson" \
		"tests/fixtures/ors-gravel-deluxe-request.json" \
		"/tmp/gravel-router-ors-smoke.json"
	@echo "OpenRouteService und GravelDeluxe-Custom-Model sind bereit."

test:
	npm test

validate: analyze test
	@rg -q '"schema": "graveldeluxe-reference-model/v1"' data/reference-analysis.json
	$(COMPOSE) config >/dev/null
	@rg -q 'WaySurfaceType:' deploy/ors-config.yml
	git diff --check
	@echo "Repository-Prüfungen erfolgreich."

logs:
	$(COMPOSE) logs -f --tail=200

status:
	$(COMPOSE) ps

down:
	$(COMPOSE) down

restart: down up
