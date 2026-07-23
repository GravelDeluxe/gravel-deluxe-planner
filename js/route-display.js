import { haversineM } from './geo.js';
import { MEADOW_EARTH_SURFACES } from './route-constraints.js';

const SURFACES = {
  0: ['Unbekannt', '#c2410c'],
  1: ['Befestigt', '#64748b'],
  2: ['Unbefestigt', '#d97706'],
  3: ['Asphalt', '#475569'],
  4: ['Beton', '#78716c'],
  8: ['Verdichteter Schotter', '#ca8a04'],
  10: ['Schotter', '#ea580c'],
  11: ['Erde', '#92400e'],
  12: ['Naturboden/Matsch', '#78350f'],
  14: ['Pflaster', '#71717a'],
  15: ['Sand', '#eab308'],
  17: ['Gras', '#15803d'],
  18: ['Rasengitter', '#16a34a'],
};

function gradeFrom(coords, startIndex, minimumWindowM = 80) {
  let distanceM = 0;
  for (let end = startIndex + 1; end < coords.length; end++) {
    distanceM += haversineM(coords[end - 1], coords[end]);
    if (distanceM < minimumWindowM) continue;
    return Math.max(0, ((coords[end][2] ?? 0) - (coords[startIndex][2] ?? 0)) / distanceM * 100);
  }
  return 0;
}

export function buildRouteDisplaySegments(
  route,
  { allowMeadowEarth = true, maxSlopePercent = 10 } = {},
) {
  const coords = route?.coords ?? [];
  if (coords.length < 2) return [];
  const surfaces = new Array(coords.length - 1).fill(0);
  for (const [from, to, value] of route.surfaceSegments ?? []) {
    for (let index = Math.max(0, from); index < Math.min(to, surfaces.length); index++) {
      surfaces[index] = Number(value);
    }
  }

  const pieces = [];
  for (let index = 0; index < coords.length - 1; index++) {
    const surfaceId = surfaces[index];
    const grade = gradeFrom(coords, index);
    const surfaceViolation = !allowMeadowEarth && MEADOW_EARTH_SURFACES.has(surfaceId);
    const slopeViolation = grade > maxSlopePercent;
    const [surfaceName, surfaceColor] = SURFACES[surfaceId] ?? SURFACES[0];
    const color = surfaceViolation && slopeViolation
      ? '#7e22ce'
      : slopeViolation
        ? '#fb923c'
        : surfaceViolation
          ? '#92400e'
          : surfaceColor;
    const key = `${surfaceId}:${surfaceViolation}:${slopeViolation}`;
    const previous = pieces.at(-1);
    if (previous?.key === key) {
      previous.coords.push(coords[index + 1]);
      previous.maximumGrade = Math.max(previous.maximumGrade, grade);
    } else {
      pieces.push({
        key,
        coords: [coords[index], coords[index + 1]],
        color,
        surfaceId,
        surfaceName,
        surfaceViolation,
        slopeViolation,
        maximumGrade: grade,
      });
    }
  }
  return pieces;
}

export function directionArrowPoints(coords, spacingM = 3000) {
  const arrows = [];
  let distanceM = 0;
  for (let index = 1; index < (coords?.length ?? 0); index++) {
    distanceM += haversineM(coords[index - 1], coords[index]);
    if (distanceM < spacingM) continue;
    const [lat1, lon1] = coords[index - 1];
    const [lat2, lon2] = coords[index];
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
      - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
      * Math.cos((lon2 - lon1) * Math.PI / 180);
    arrows.push({
      point: coords[index],
      bearing: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
    });
    distanceM = 0;
  }
  return arrows;
}
