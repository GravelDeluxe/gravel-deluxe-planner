import { haversineM } from './geo.js';

function nearestRouteIndex(point, coords) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  coords.forEach((coord, index) => {
    const distance = haversineM(point, coord);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

// Stützpunkte halten die Form der nativen ORS-Runde. Highlights werden anhand
// ihres nächsten Abschnitts dazwischen einsortiert und dadurch echte Via-Punkte.
export function buildHighlightWaypoints(start, routeCoords, highlights, anchorCount = 4) {
  if (!highlights?.length) return [start, start];
  const lastIndex = Math.max(1, routeCoords.length - 1);
  const items = [];
  for (let i = 1; i <= anchorCount; i++) {
    const index = Math.round((i / (anchorCount + 1)) * lastIndex);
    items.push({ index, order: 0, point: routeCoords[index].slice(0, 2) });
  }
  highlights.forEach((point, order) => {
    items.push({
      index: nearestRouteIndex(point, routeCoords),
      order: order + 1,
      point: point.slice(0, 2),
    });
  });
  items.sort((a, b) => a.index - b.index || a.order - b.order);
  return [start.slice(0, 2), ...items.map((item) => item.point), start.slice(0, 2)];
}
