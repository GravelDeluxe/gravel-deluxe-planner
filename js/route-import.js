import { elevationGain, fillVoids, medianFilterElevations, profilePoints } from './elevation.js';
import { haversineM } from './geo.js';
import { parseGpx } from './reference-analysis.js';

function supportPoints(coords, count) {
  const profile = profilePoints(coords);
  const distanceM = profile.at(-1)?.d ?? 0;
  const points = [];
  for (let number = 1; number <= count; number++) {
    const target = distanceM * number / (count + 1);
    const index = profile.findIndex((point) => point.d >= target);
    const point = coords[Math.max(0, index)];
    if (point && !points.some((existing) => haversineM(existing, point) < 50)) {
      points.push(point.slice(0, 2));
    }
  }
  return points;
}

export function reconstructImportedPlan({ name, coords, waypoints = [], elevationAvailable = true }) {
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error('Die Datei enthält keine nutzbare Route.');
  }
  const routeCoords = coords
    .map((point) => point.map(Number))
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (routeCoords.length < 2) throw new Error('Die Datei enthält keine nutzbare Route.');
  const profile = profilePoints(routeCoords);
  const distanceM = profile.at(-1)?.d ?? 0;
  const closed = haversineM(routeCoords[0], routeCoords.at(-1)) <= Math.max(500, distanceM * 0.02);
  const shapePoints = supportPoints(routeCoords, closed ? 4 : 3);
  const highlights = waypoints
    .map((point, index) => ({
      coords: (point.coords ?? point).slice(0, 2).map(Number),
      name: point.name || `Highlight ${index + 1}`,
    }))
    .filter((point) => point.coords.every(Number.isFinite));
  const cleaned = elevationAvailable
    ? medianFilterElevations(fillVoids(routeCoords))
    : routeCoords.map(([lat, lon]) => [lat, lon, 0]);
  return {
    name: String(name || 'Importierte Route'),
    mode: closed ? 'loop' : 'manual',
    waypoints: closed
      ? [routeCoords[0].slice(0, 2)]
      : [routeCoords[0].slice(0, 2), ...shapePoints, routeCoords.at(-1).slice(0, 2)],
    shapePoints: closed ? shapePoints : [],
    highlights,
    route: {
      coords: cleaned,
      distanceM,
      ascendM: elevationAvailable ? Math.round(elevationGain(cleaned)) : 0,
      elevationAvailable,
      surfaceSegments: [],
      waytypeSegments: [],
      profile: 'gpx-import',
    },
  };
}

export function parseImportedFile(text, filename = 'Import') {
  if (/\.json$/i.test(filename)) {
    const payload = JSON.parse(text);
    if (payload.schema !== 'graveldeluxe-route-feedback/v1') {
      throw new Error('Unbekanntes JSON-Format.');
    }
    return reconstructImportedPlan({
      name: payload.route?.name || filename.replace(/\.json$/i, ''),
      coords: payload.route?.coords,
      waypoints: (payload.context?.highlights ?? []).map((coords) => ({ coords })),
      elevationAvailable: payload.route?.elevationAvailable !== false,
    });
  }
  return reconstructImportedPlan(parseGpx(text, filename.replace(/\.gpx$/i, '')));
}
