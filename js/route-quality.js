import { haversineM } from './geo.js';
import { SURFACES, segmentValues } from './surfaces.js';
import { sampleLine } from './route-geometry.js';
import { maximumSustainedGrade } from './route-constraints.js';

export function analyzeClimbs(route) {
  const coords = route?.coords ?? [];
  const available = coords.length > 1 && route.elevationAvailable !== false
    && coords.every((point) => Number.isFinite(point[2]));
  if (!available) return { available: false, climbs: [], descents: [], firstClimbKm: null };
  const samples = sampleLine(coords, 40);
  const detect = (sign) => {
    const found = [];
    let valley = 0;
    let summit = 0;
    const height = (index) => samples[index].point[2] * sign;
    const finish = () => {
      const gainM = height(summit) - height(valley);
      const lengthM = samples[summit].distanceM - samples[valley].distanceM;
      if (gainM <= 20 || lengthM < 80) return;
      const section = samples.slice(valley, summit + 1).map(({ point }) => [point[0], point[1], point[2] * sign]);
      const averageGrade = gainM / lengthM * 100;
      const maximumGrade = maximumSustainedGrade(section);
      found.push({
        startKm: samples[valley].distanceM / 1000,
        endKm: samples[summit].distanceM / 1000,
        lengthM, gainM, averageGrade, maximumGrade,
        moderate: lengthM >= 500 && averageGrade >= 4 && averageGrade <= 8 && maximumGrade <= 10,
        steep: maximumGrade > 10,
      });
    };
    for (let index = 1; index < samples.length; index++) {
      if (height(index) > height(summit)) summit = index;
      // Kleine Gegenbewegungen bis 5 m gehören zum selben Anstieg.
      if (height(summit) - height(index) >= 5) {
        finish();
        valley = index;
        summit = index;
      } else if (height(index) <= height(valley)) {
        valley = index;
        summit = index;
      }
    }
    finish();
    return found;
  };
  const climbs = detect(1);
  const descents = detect(-1);
  return { available: true, climbs, descents, firstClimbKm: climbs[0]?.startKm ?? null };
}

export function firstClimbAssessment(terrain, mode = 'off') {
  const km = terrain.firstClimbKm;
  const inRange = terrain.available && km !== null && km >= 5 && km <= 10;
  const status = !terrain.available ? 'unknown' : km === null ? 'absent' : inRange ? 'match' : 'outside';
  const deviation = inRange ? 0 : km === null ? 1 : Math.min(1, Math.max(5 - km, km - 10) / 5);
  return { mode, status, inRange, allowed: mode !== 'required' || inRange,
    adjustment: mode === 'prefer' && terrain.available ? deviation * 0.5 : 0 };
}

export function repeatedDistance(coords) {
  const samples = sampleLine(coords, 25);
  const cells = new Map();
  let repeatedM = 0;
  for (let index = 0; index < samples.length; index++) {
    const { point, distanceM } = samples[index];
    const y = Math.floor(point[0] / 0.0005);
    const x = Math.floor(point[1] / 0.0005);
    let repeated = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const previous of cells.get(`${y + dy},${x + dx}`) ?? []) {
          if (distanceM - previous.distanceM > 100 && haversineM(point, previous.point) <= 14) repeated = true;
        }
      }
    }
    const closesLoop = index === samples.length - 1
      && haversineM(point, samples[0].point) <= 14;
    if (repeated && index > 0 && !closesLoop) {
      repeatedM += distanceM - samples[index - 1].distanceM;
    }
    const key = `${y},${x}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(samples[index]);
  }
  return { distanceM: repeatedM, share: repeatedM / (samples.at(-1)?.distanceM || 1) };
}

export function analyzeRouteQuality(route) {
  const coords = route?.coords ?? [];
  const surfaces = segmentValues(coords, route?.surfaceSegments);
  const waytypes = segmentValues(coords, route?.waytypeSegments);
  const surfaceM = new Map();
  let totalM = 0;
  let changes = 0;
  let mainRoadM = 0;
  let otherRoadM = 0;
  let unknownWayM = 0;
  let previousSurface = 0;
  for (let index = 0; index < coords.length - 1; index++) {
    const distanceM = haversineM(coords[index], coords[index + 1]);
    if (!distanceM) continue;
    totalM += distanceM;
    const surface = SURFACES[surfaces[index]] ? surfaces[index] : 0;
    surfaceM.set(surface, (surfaceM.get(surface) ?? 0) + distanceM);
    // Datenlücken unterbrechen die Folge, sie sind keine bekannten Wechsel.
    if (surface && previousSurface && surface !== previousSurface) changes++;
    previousSurface = surface;
    if (waytypes[index] === 1) mainRoadM += distanceM;
    else if (waytypes[index] === 2) otherRoadM += distanceM;
    else if (!waytypes[index]) unknownWayM += distanceM;
  }
  return {
    distanceM: totalM,
    surfaces: [...surfaceM].map(([id, distanceM]) => ({
      id, name: SURFACES[id][0], color: SURFACES[id][1], distanceM,
      percent: distanceM / (totalM || 1) * 100,
    })).sort((a, b) => b.distanceM - a.distanceM),
    unknownSurfaceM: surfaceM.get(0) ?? 0,
    surfaceChanges: changes,
    changesPer10Km: totalM ? changes / totalM * 10000 : 0,
    mainRoadM, otherRoadM, unknownWayM,
    waytypeAvailable: totalM > 0 && unknownWayM < totalM,
    terrain: analyzeClimbs(route),
    repeated: repeatedDistance(coords),
  };
}
