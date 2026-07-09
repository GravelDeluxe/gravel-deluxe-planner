const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

export function haversineM([lat1, lon1], [lat2, lon2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * 1000 * Math.asin(Math.sqrt(a));
}

export function destinationPoint([lat, lon], distanceKm, bearingDeg) {
  const delta = distanceKm / EARTH_RADIUS_KM;
  const theta = toRad(bearingDeg);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );
  return [toDeg(phi2), ((toDeg(lambda2) + 540) % 360) - 180];
}

export function ringWaypoints(center, radiusKm, n = 3, bearingOffsetDeg = 0) {
  return Array.from({ length: n }, (_, i) =>
    destinationPoint(center, radiusKm, bearingOffsetDeg + (i * 360) / n),
  );
}

// Nächsten Punkt der Route (coords: [[lat, lon, ele], ...]) zu `point` finden.
// Damit sitzt ein Wegpunkt-Marker exakt auf der gezeichneten Linie statt am
// Rohklick, den BRouter erst auf den nächsten Weg-Knoten geschoben hat.
export function nearestOnPath([lat, lon], coords) {
  if (!coords || coords.length === 0) return [lat, lon];
  let best = coords[0];
  let bestD = haversineM([lat, lon], [best[0], best[1]]);
  for (let i = 1; i < coords.length; i++) {
    const d = haversineM([lat, lon], [coords[i][0], coords[i][1]]);
    if (d < bestD) {
      bestD = d;
      best = coords[i];
    }
  }
  return [best[0], best[1]];
}
