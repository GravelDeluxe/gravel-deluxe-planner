import { elevationGain } from './elevation.js';

// ORS-Segmente beschreiben Kantenintervalle [von, bis) auf der Punktliste.
export function reverseRoute(route) {
  const last = route.coords.length - 1;
  const coords = route.coords.map((point) => [...point]).reverse();
  return {
    ...route,
    coords,
    ascendM: Math.round(elevationGain(coords)),
    surfaceSegments: (route.surfaceSegments ?? [])
      .map(([from, to, surface]) => [last - to, last - from, surface])
      .reverse(),
  };
}

export const DEFAULT_SETTINGS = Object.freeze({
  minKm: 30, maxKm: 50, minHm: 200, maxHm: 800,
  direction: 'any', allowMeadowEarth: true, maxSlopePercent: 10,
});

export function restoreSavedRoute(saved) {
  return {
    mode: saved.mode ?? (saved.waypoints?.length === 1 ? 'loop' : 'manual'),
    routingProfile: saved.routingProfile ?? 'gravel-konstant',
    waypoints: saved.waypoints ?? [],
    highlights: saved.highlights ?? [],
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    route: {
      coords: saved.coords,
      distanceM: saved.distanceM,
      ascendM: saved.ascendM,
      // Bei alten Einträgen lässt sich der tatsächliche Router nicht rekonstruieren.
      profile: saved.profile ?? null,
      surfaceSegments: saved.surfaceSegments ?? [],
    },
  };
}
