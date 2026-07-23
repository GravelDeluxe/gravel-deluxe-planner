import { haversineM } from './geo.js';
import { fillVoids, medianFilterElevations, elevationGain } from './elevation.js';

export const REFERENCE_MODEL_VERSION = 'graveldeluxe-reference-model/v1';
export const REFERENCE_CELL_PRECISION = 3;

function xmlText(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseGpx(xml, fallbackName = 'Unbenannte Route') {
  const nameMatch = xml.match(
    /<(?:[\w.-]+:)?name\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?name>/i,
  );
  const coords = [];
  const pointPattern =
    /<(?:[\w.-]+:)?trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?trkpt>)/gi;
  let match;
  while ((match = pointPattern.exec(xml))) {
    const lat = Number(match[1].match(/\blat=["']([^"']+)["']/i)?.[1]);
    const lon = Number(match[1].match(/\blon=["']([^"']+)["']/i)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleMatch = match[2]?.match(
      /<(?:[\w.-]+:)?ele\b[^>]*>([^<]+)<\/(?:[\w.-]+:)?ele>/i,
    );
    const ele = Number(eleMatch?.[1]);
    coords.push([lat, lon, Number.isFinite(ele) ? ele : 0]);
  }
  if (coords.length < 2) throw new Error(`GPX enthält zu wenige Trackpunkte: ${fallbackName}`);
  return {
    name: xmlText(nameMatch?.[1]?.trim() || fallbackName),
    coords,
  };
}

export function referenceCell([lat, lon], precision = REFERENCE_CELL_PRECISION) {
  return `${Number(lat).toFixed(precision)},${Number(lon).toFixed(precision)}`;
}

export function uniqueRouteCells(coords, precision = REFERENCE_CELL_PRECISION) {
  return [...new Set(coords.map((point) => referenceCell(point, precision)))];
}

export function routeFingerprint(coords) {
  const step = Math.max(1, Math.floor(coords.length / 30));
  return coords
    .filter((_point, index) => index % step === 0 || index === coords.length - 1)
    .map((point) => referenceCell(point, 4))
    .join('|');
}

function routeDistanceM(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1], coords[i]);
  return total;
}

export function analyzeReferenceRoute({ name, coords, source }) {
  const cleaned = medianFilterElevations(fillVoids(coords));
  const distanceM = routeDistanceM(cleaned);
  const closureM = haversineM(cleaned[0], cleaned.at(-1));
  const lats = cleaned.map((point) => point[0]);
  const lons = cleaned.map((point) => point[1]);
  return {
    name,
    source,
    pointCount: cleaned.length,
    distanceM: Math.round(distanceM),
    ascendM: Math.round(elevationGain(cleaned)),
    closureM: Math.round(closureM),
    closed: closureM <= Math.max(500, distanceM * 0.02),
    bounds: [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ],
    cells: uniqueRouteCells(cleaned),
    fingerprint: routeFingerprint(cleaned),
  };
}

function incrementCells(target, cells) {
  for (const cell of new Set(cells)) target[cell] = (target[cell] ?? 0) + 1;
}

export function buildReferenceModel(goodRoutes, feedbackItems = []) {
  const goodCells = {};
  const badCells = {};
  const badCellsByProblem = {};
  const problemCounts = {};
  for (const route of goodRoutes) incrementCells(goodCells, route.cells);
  for (const item of feedbackItems) {
    for (const passage of item.passages ?? []) {
      const cells = uniqueRouteCells(passage.coords ?? []);
      const problem = String(passage.problem || 'anderes');
      incrementCells(badCells, cells);
      badCellsByProblem[problem] ??= {};
      incrementCells(badCellsByProblem[problem], cells);
      problemCounts[problem] = (problemCounts[problem] ?? 0) + 1;
    }
  }
  return {
    schema: REFERENCE_MODEL_VERSION,
    summary: {
      goodRoutes: goodRoutes.length,
      feedbackFiles: feedbackItems.length,
      badPassages: feedbackItems.reduce((sum, item) => sum + (item.passages?.length ?? 0), 0),
      goodCells: Object.keys(goodCells).length,
      badCells: Object.keys(badCells).length,
      problemCounts,
    },
    routes: goodRoutes.map(({ fingerprint, cells, ...route }) => ({
      ...route,
      cellCount: cells.length,
    })),
    goodCells,
    badCells,
    badCellsByProblem,
  };
}

export function scoreRouteAgainstReferences(coords, model) {
  if (!coords?.length || model?.schema !== REFERENCE_MODEL_VERSION) {
    return { goodAffinity: 0, badCoverage: 0, adjustment: 0 };
  }
  const cells = uniqueRouteCells(coords);
  let goodWeight = 0;
  let badHits = 0;
  for (const cell of cells) {
    goodWeight += Math.min((model.goodCells?.[cell] ?? 0) / 3, 1);
    if (model.badCells?.[cell]) badHits++;
  }
  const goodAffinity = goodWeight / cells.length;
  const badCoverage = badHits / cells.length;
  return {
    goodAffinity,
    badCoverage,
    // Niedriger Gesamtscore ist besser. Schlechtes Feedback wirkt bewusst
    // deutlich stärker als die weiche Bevorzugung bekannter guter Korridore.
    adjustment: badCoverage * 12 - goodAffinity * 0.6,
  };
}

export function feedbackAvoidPolygons(model, protectedPoints = []) {
  if (model?.schema !== REFERENCE_MODEL_VERSION) return null;
  const polygons = Object.keys(model.badCells ?? {}).flatMap((cell) => {
    const [lat, lon] = cell.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const center = [lat, lon];
    if (protectedPoints.some((point) => haversineM(center, point) < 350)) return [];
    const half = 0.00055;
    return [[[
      [lon - half, lat - half],
      [lon + half, lat - half],
      [lon + half, lat + half],
      [lon - half, lat + half],
      [lon - half, lat - half],
    ]]];
  });
  return polygons.length ? { type: 'MultiPolygon', coordinates: polygons } : null;
}
