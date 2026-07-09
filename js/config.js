export const BROUTER_BASE = 'https://brouter.de/brouter';
export const DEFAULT_PROFILE = 'gravel';
export const FALLBACK_PROFILE = 'trekking';

export const TILE_URL = 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende | Kacheln: <a href="https://www.cyclosm.org">CyclOSM</a>';

export const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

// OpenRouteService: natives round_trip für Auto-Runden. Kein Gravel-Profil,
// cycling-mountain bevorzugt Tracks/Waldwege (bestes Gravel-Proxy bei ORS).
// Der API-Key liegt im localStorage ('ors.key'), nicht hier — kein Secret im Repo.
export const ORS_BASE = 'https://api.openrouteservice.org';
export const ORS_PROFILE = 'cycling-mountain';

export const MAP_START = [51.163, 10.447]; // Mitte Deutschlands
export const MAP_START_ZOOM = 6;
