import { haversineM } from './geo.js';

export const MEADOW_EARTH_SURFACES = new Set([11, 12, 17]); // Dirt, Ground, Grass

function segmentDistance(coords, fromIndex, toIndex) {
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  let distanceM = 0;
  const from = Math.max(0, fromIndex);
  const to = Math.min(coords.length - 1, toIndex);
  for (let index = from + 1; index <= to; index++) {
    distanceM += haversineM(coords[index - 1], coords[index]);
  }
  return distanceM;
}

export function meadowEarthDistanceM(coords, surfaceSegments = []) {
  return surfaceSegments
    .filter((segment) => MEADOW_EARTH_SURFACES.has(Number(segment[2])))
    .reduce(
      (sum, [fromIndex, toIndex]) =>
        sum + segmentDistance(coords, Number(fromIndex), Number(toIndex)),
      0,
    );
}

// Eine Rampe zählt erst über mindestens 80 m, damit einzelne Höhenspikes die
// Vorgabe nicht auslösen.
export function maximumSustainedGrade(coords, minimumWindowM = 80) {
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  let maximum = 0;
  for (let start = 0; start < coords.length - 1; start++) {
    let distanceM = 0;
    for (let end = start + 1; end < coords.length; end++) {
      distanceM += haversineM(coords[end - 1], coords[end]);
      if (distanceM < minimumWindowM) continue;
      const climbM = (coords[end][2] ?? 0) - (coords[start][2] ?? 0);
      maximum = Math.max(maximum, (climbM / distanceM) * 100);
      break;
    }
  }
  return maximum;
}

export function evaluateRouteConstraints(
  route,
  { allowMeadowEarth = true, maxSlopePercent = 10 } = {},
) {
  const coords = route?.coords ?? [];
  const surfaceAvailable = Array.isArray(route?.surfaceSegments)
    && route.surfaceSegments.length > 0;
  const meadowEarthM = meadowEarthDistanceM(coords, route?.surfaceSegments);
  const maximumGrade = maximumSustainedGrade(coords);
  const surfaceAllowed = allowMeadowEarth || meadowEarthM < 20;
  const slopeAllowed = maximumGrade <= maxSlopePercent;
  return {
    meadowEarthM,
    surfaceAvailable,
    maximumGrade,
    surfaceAllowed,
    slopeAllowed,
    allowed: surfaceAllowed && slopeAllowed,
    adjustment:
      (!allowMeadowEarth ? meadowEarthM / Math.max(route?.distanceM ?? 0, 1) * 20 : 0)
      + Math.max(0, maximumGrade - maxSlopePercent) / Math.max(maxSlopePercent, 1) * 4,
  };
}
