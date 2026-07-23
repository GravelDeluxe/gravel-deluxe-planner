# Gravel Router – Agentenhinweise

## Ziel

Dieses Repository erweitert `DerRemo/gravel-planner` um das separate
BRouter-Profil **Gravel Konstant**. Das Originalprofil `gravel` muss
funktionsfähig und unverändert auswählbar bleiben.

## Kontext sparsam laden

Nicht alle Projektdokumente pauschal lesen. Je nach Aufgabe nur die passende
Datei öffnen:

- Architektur, Upstream und Grenzen: `docs/agents/architecture.md`
- Aktueller Fortschritt und nächste Schritte: `docs/agents/progress.md`
- Docker, GitLab CI und Portainer: `docs/agents/deployment.md`
- Tests und Verifikation: `docs/agents/testing.md`
- Produktplan aller Phasen: `IMPLEMENTATION_PLAN.md` (nur bei Produkt-/Scope-Fragen)
- Phase-1-Parameter im Detail: `docs/phase-1-gravel-konstant.md`

## Arbeitsregeln

- Sprache für UI und Projektdokumentation: Deutsch.
- Keine Secrets, API-Keys, `.rd5`-Daten oder lokale Konfiguration committen.
- Änderungen am Routing mit `npm test` prüfen.
- `gravel-konstant` ist ein eigenes Profil; `gravel` nicht überschreiben.
- Globale Routeneigenschaften nicht in das Kantenprofil hineininterpretieren.
  Oberflächenwechsel, Parallelwege und Rundkursqualität gehören in Phase 2.
- Deployment-Ziel ist Docker/Portainer nach dem Muster der GravelDeluxe-Tools:
  GitLab Registry, persistente Host-Pfade und scoped Watchtower.

## Wichtige Einstiegspunkte

- UI: `index.html`, `styles.css`, `js/app.js`
- Routing-Client: `js/routing.js`, `js/config.js`
- Profil: `profiles/gravel-konstant.brf`
- Container: `Dockerfile`, `Dockerfile.brouter`
- Lokaler Komplettstart: `Makefile`, `deploy/compose.local.yml`
- Portainer: `deploy/portainer-stack.yml`
- CI: `.gitlab-ci.yml`
