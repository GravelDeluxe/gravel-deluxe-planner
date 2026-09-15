import { haversineM } from './geo.js';

function nearestDistance(point, coords) {
  return Math.min(...coords.map((candidate) => haversineM(point, candidate)));
}

function rotateClosedGuide(coords, start) {
  const core = haversineM(coords[0], coords.at(-1)) < 500 ? coords.slice(0, -1) : [...coords];
  let nearestIndex = 0;
  for (let index = 1; index < core.length; index++) {
    if (haversineM(start, core[index]) < haversineM(start, core[nearestIndex])) nearestIndex = index;
  }
  const rotated = [...core.slice(nearestIndex), ...core.slice(0, nearestIndex)];
  return [start.slice(0, 2), ...rotated.filter((point) => haversineM(point, start) > 100), start.slice(0, 2)];
}

export function selectReferenceGuides(
  routes,
  start,
  highlights,
  { minKm, maxKm, limit = 3, maxStartDistanceM = 5000, maxHighlightDistanceM = 2500 },
) {
  return (routes ?? [])
    .filter((route) => route.closed && route.guidePoints?.length >= 4)
    .filter((route) => route.distanceM >= minKm * 800 && route.distanceM <= maxKm * 1200)
    .map((route) => ({
      route,
      startDistanceM: nearestDistance(start, route.guidePoints),
      highlightDistanceM: Math.max(0, ...highlights.map((point) => nearestDistance(point, route.guidePoints))),
    }))
    .filter(({ startDistanceM, highlightDistanceM }) =>
      startDistanceM <= maxStartDistanceM && highlightDistanceM <= maxHighlightDistanceM)
    .sort((a, b) =>
      a.highlightDistanceM - b.highlightDistanceM
      || a.startDistanceM - b.startDistanceM
      || (b.route.metadata?.rating ?? 5) - (a.route.metadata?.rating ?? 5))
    .slice(0, limit)
    .map(({ route }) => ({
      source: route.source,
      waypoints: rotateClosedGuide(route.guidePoints, start),
    }));
}
