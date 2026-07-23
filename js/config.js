const runtimeConfig = globalThis.GRAVEL_PLANNER_CONFIG ?? {};

export const BROUTER_BASE = runtimeConfig.brouterBase ?? 'https://brouter.de/brouter';
export const DEFAULT_PROFILE = 'gravel';
export const FALLBACK_PROFILE = 'trekking';
export const GRAVEL_CONSTANT_PROFILE = 'gravel-konstant';

export const ROUTING_PROFILES = Object.freeze([
  {
    id: DEFAULT_PROFILE,
    label: 'Gravel (Original)',
    description: 'Bewährtes Standardprofil des öffentlichen BRouter.',
  },
  {
    id: GRAVEL_CONSTANT_PROFILE,
    label: 'Gravel GravelDeluxe',
    description: 'Mehr zusammenhängender Gravel, weniger Hauptstraßen und steile Rampen.',
  },
]);

export const TILE_URL = 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende | Kacheln: <a href="https://www.cyclosm.org">CyclOSM</a>';

export const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

// OpenRouteService: natives round_trip über das selbst gehostete Profil.
// Der API-Key liegt bei externem ORS im localStorage, nie im Repo.
export const ORS_BASE = runtimeConfig.orsBase ?? 'https://api.openrouteservice.org';
export const ORS_REQUIRES_KEY = runtimeConfig.orsRequiresKey ?? true;
export const ORS_PROFILE = 'gravel-deluxe';

export const HOME_BASE = Object.freeze({
  name: 'Home Base',
  address: 'Robert-Koch-Straße 22, Bad Rappenau',
  coords: Object.freeze([49.2442844, 9.1129218]),
});

export const MAP_START = HOME_BASE.coords;
export const MAP_START_ZOOM = 14;
