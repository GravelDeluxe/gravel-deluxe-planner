import { BROUTER_BASE, DEFAULT_PROFILE, FALLBACK_PROFILE } from './config.js';

export function buildRouteUrl(waypoints, profile = DEFAULT_PROFILE) {
  if (waypoints.length < 2) throw new Error('Mindestens zwei Wegpunkte nötig');
  const lonlats = waypoints
    .map(([lat, lon]) => `${lon.toFixed(6)},${lat.toFixed(6)}`)
    .join('|');
  return `${BROUTER_BASE}?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;
}

export function parseRouteResponse(geojson) {
  const feature = geojson?.features?.[0];
  if (!feature) throw new Error('Keine Route in der Antwort');
  const coords = feature.geometry.coordinates.map(([lon, lat, ele]) => [lat, lon, ele ?? 0]);
  const props = feature.properties ?? {};
  return {
    coords,
    distanceM: Number(props['track-length'] ?? 0),
    ascendM: Number(props['filtered ascend'] ?? 0),
  };
}

async function fetchRoute(waypoints, profile, fetchImpl) {
  const res = await fetchImpl(buildRouteUrl(waypoints, profile));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BRouter-Fehler (${res.status}): ${text.slice(0, 200)}`);
  }
  return parseRouteResponse(await res.json());
}

export async function fetchRouteWithFallback(waypoints, { fetchImpl = fetch } = {}) {
  try {
    const route = await fetchRoute(waypoints, DEFAULT_PROFILE, fetchImpl);
    return { ...route, profile: DEFAULT_PROFILE };
  } catch (err) {
    if (!/profile/i.test(err.message)) throw err;
    const route = await fetchRoute(waypoints, FALLBACK_PROFILE, fetchImpl);
    return { ...route, profile: FALLBACK_PROFILE };
  }
}
