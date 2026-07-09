import { ringWaypoints, destinationPoint, nearestOnPath } from './geo.js';

const clampFactor = (f) => Math.min(2, Math.max(0.5, f));

// Wegpunkte auf die tatsächlich geroutete Linie ziehen, damit die Marker auf
// der Route sitzen (BRouter snappt Start/Ring auf den nächsten Weg-Knoten).
function snapWaypointsToRoute(best) {
  const coords = best?.route?.coords;
  if (!coords || coords.length === 0) return best;
  return { ...best, waypoints: best.waypoints.map((wp) => nearestOnPath(wp, coords)) };
}

async function fitCircle(start, targetKm, routeFn, { n, maxIter, bearingOffsetDeg, minKm, maxKm }) {
  let radiusKm = targetKm / (2 * Math.PI);
  let best = null;
  for (let i = 0; i < maxIter; i++) {
    const waypoints = [start, ...ringWaypoints(start, radiusKm, n, bearingOffsetDeg), start];
    const route = await routeFn(waypoints);
    const distKm = route.distanceM / 1000;
    const rel = Math.abs(distKm - targetKm) / targetKm;
    if (!best || rel < best.rel) best = { route, waypoints, distKm, rel };
    if (distKm >= minKm && distKm <= maxKm) break;
    // Radius proportional nachziehen, Faktor begrenzen gegen Oszillation.
    radiusKm *= clampFactor(targetKm / distKm);
  }
  return best;
}

async function fitOneWay(start, targetKm, routeFn, { maxIter, bearingDeg, minKm, maxKm }) {
  let legKm = targetKm * 0.7; // Luftlinie ist kürzer als geroutete Distanz
  let best = null;
  for (let i = 0; i < maxIter; i++) {
    const waypoints = [start, destinationPoint(start, legKm, bearingDeg)];
    const route = await routeFn(waypoints);
    const distKm = route.distanceM / 1000;
    const rel = Math.abs(distKm - targetKm) / targetKm;
    if (!best || rel < best.rel) best = { route, waypoints, distKm, rel };
    if (distKm >= minKm && distKm <= maxKm) break;
    legKm *= clampFactor(targetKm / distKm);
  }
  return best;
}

export async function generateCandidates(
  start,
  { minKm, maxKm, mode = 'circle', count = 3, n = 3, maxIter = 5, baseBearingDeg = 0 },
  routeFn,
) {
  const targetKm = (minKm + maxKm) / 2;
  const candidates = [];
  for (let i = 0; i < count; i++) {
    const bearing = baseBearingDeg + (i * 360) / count;
    try {
      const best =
        mode === 'oneway'
          ? await fitOneWay(start, targetKm, routeFn, { maxIter, bearingDeg: bearing, minKm, maxKm })
          : await fitCircle(start, targetKm, routeFn, { n, maxIter, bearingOffsetDeg: bearing, minKm, maxKm });
      const snapped = snapWaypointsToRoute(best);
      candidates.push({ ...snapped, inRange: snapped.distKm >= minKm && snapped.distKm <= maxKm });
    } catch {
      // Kandidat überspringen (z. B. kein Weg in diese Richtung)
    }
  }
  if (!candidates.length) throw new Error('Keine Route gefunden');
  return candidates.sort((a, b) => Number(b.inRange) - Number(a.inRange));
}
