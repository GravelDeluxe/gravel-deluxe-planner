export function inRange(value, min, max) {
  return value >= min && value <= max;
}

export const DIRECTION_BEARINGS = Object.freeze({
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
});

function angularDistance(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// Richtung vom Start zum geometrischen Schwerpunkt der Route. Das ist für
// Rundkurse stabiler als Start-/Endpeilung, weil beide Punkte nahezu gleich sind.
export function routeDirection(coords, start) {
  if (!coords?.length || !start) return { bearing: null, cardinal: null };
  const usable = coords.slice(0, -1).length ? coords.slice(0, -1) : coords;
  const center = usable.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0],
  ).map((sum) => sum / usable.length);
  const lat1 = start[0] * Math.PI / 180;
  const lat2 = center[0] * Math.PI / 180;
  const dLon = (center[1] - start[1]) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const cardinals = Object.keys(DIRECTION_BEARINGS);
  const cardinal = cardinals.reduce(
    (best, value) =>
      angularDistance(bearing, DIRECTION_BEARINGS[value])
        < angularDistance(bearing, DIRECTION_BEARINGS[best]) ? value : best,
    'N',
  );
  return { bearing, cardinal };
}

function relativeDeviation(value, min, max) {
  if (inRange(value, min, max)) return 0;
  const span = Math.max(max - min, max * 0.25, 1);
  return value < min ? (min - value) / span : (value - max) / span;
}

export function rankRoundTripCandidates(
  candidates,
  { minKm, maxKm, minHm, maxHm, direction = 'any', start, limit = 3 },
) {
  const kmMid = (minKm + maxKm) / 2;
  const hmMid = (minHm + maxHm) / 2;
  return candidates
    .map((candidate) => {
      const distKm = candidate.route.distanceM / 1000;
      const ascendM = candidate.route.ascendM;
      const distanceInRange = inRange(distKm, minKm, maxKm);
      const ascentInRange = inRange(ascendM, minHm, maxHm);
      const routeHeading = routeDirection(candidate.route.coords, start);
      const directionDeviation = direction === 'any' || routeHeading.bearing === null
        ? 0
        : angularDistance(routeHeading.bearing, DIRECTION_BEARINGS[direction]) / 180;
      const score =
        relativeDeviation(distKm, minKm, maxKm) * 2
        + relativeDeviation(ascendM, minHm, maxHm)
        + directionDeviation * 1.5
        + Math.abs(distKm - kmMid) / Math.max(maxKm - minKm, 1) * 0.01
        + Math.abs(ascendM - hmMid) / Math.max(maxHm - minHm, 100) * 0.005;
      return {
        ...candidate,
        distKm,
        distanceInRange,
        ascentInRange,
        direction: routeHeading.cardinal,
        directionDeviation,
        inRange: distanceInRange && ascentInRange,
        score,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}
