import { haversineM } from './geo.js';
import { sampleLine, lineIndex, pointSegmentDistanceM } from './route-geometry.js';
import { fillVoids, medianFilterElevations, elevationGain } from './elevation.js';
import { evaluateRouteFlow } from './route-flow.js';
import { analyzeRouteQuality } from './route-quality.js';

export const REFERENCE_MODEL_VERSION = 'graveldeluxe-reference-model/v1';
export const REFERENCE_CELL_PRECISION = 3;
export const STRUCTURE_DIMENSIONS = Object.freeze({
  ascentPer10Km: { label: 'Höhenmeter / 10 km', weight: 0.2, mode: 'band' },
  repeatedShare: { label: 'Doppelbefahrung', weight: 1.2, mode: 'max' },
  sharpTurnsPer10Km: { label: 'enge Richtungswechsel / 10 km', weight: 0.35, mode: 'max' },
  reversalsPer10Km: { label: 'Kehrtwenden / 10 km', weight: 0.8, mode: 'max' },
  closureShare: { label: 'Schließungslücke', weight: 0.8, mode: 'max' },
  firstClimbKm: { label: 'erster Anstieg', weight: 0.25, mode: 'band' },
  moderateClimbsPer50Km: { label: 'gleichmäßige Anstiege / 50 km', weight: 0.15, mode: 'band' },
  steepClimbsPer50Km: { label: 'steile Anstiege / 50 km', weight: 0.5, mode: 'max' },
  surfaceChangesPer10Km: { label: 'Oberflächenwechsel / 10 km', weight: 0.45, mode: 'max' },
  mainRoadShare: { label: 'Hauptstraßenanteil', weight: 0.8, mode: 'max' },
  gravelShare: { label: 'Gravelanteil', weight: 0.35, mode: 'min' },
});

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
  let elevationAvailable = true;
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
    if (!Number.isFinite(ele)) elevationAvailable = false;
    coords.push([lat, lon, Number.isFinite(ele) ? ele : 0]);
  }
  if (coords.length < 2) throw new Error(`GPX enthält zu wenige Trackpunkte: ${fallbackName}`);
  const waypoints = [];
  const waypointPattern =
    /<(?:[\w.-]+:)?wpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?wpt>)/gi;
  while ((match = waypointPattern.exec(xml))) {
    const lat = Number(match[1].match(/\blat=["']([^"']+)["']/i)?.[1]);
    const lon = Number(match[1].match(/\blon=["']([^"']+)["']/i)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const waypointName = match[2]?.match(
      /<(?:[\w.-]+:)?name\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?name>/i,
    )?.[1];
    waypoints.push({
      coords: [lat, lon],
      name: xmlText(waypointName?.trim() || `Highlight ${waypoints.length + 1}`),
    });
  }
  return {
    name: xmlText(nameMatch?.[1]?.trim() || fallbackName),
    coords,
    elevationAvailable,
    waypoints,
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

export function analyzeReferenceRoute({ name, coords, source, elevationAvailable = true }) {
  const cleaned = medianFilterElevations(fillVoids(coords));
  const distanceM = routeDistanceM(cleaned);
  const closureM = haversineM(cleaned[0], cleaned.at(-1));
  const lats = cleaned.map((point) => point[0]);
  const lons = cleaned.map((point) => point[1]);
  const route = {
    name,
    source,
    pointCount: cleaned.length,
    distanceM: Math.round(distanceM),
    ascendM: Math.round(elevationGain(cleaned)),
    elevationAvailable,
    closureM: Math.round(closureM),
    closed: closureM <= Math.max(500, distanceM * 0.02),
    bounds: [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ],
    // Kompakte, geordnete Form der guten Tour. Sie erlaubt der App, passende
    // Referenzen als echte Kandidatenführung zu verwenden, statt sie erst nach
    // der Routenerzeugung nur zu bewerten.
    guidePoints: sampleLine(cleaned, Math.max(250, distanceM / 32))
      .map(({ point }) => point.slice(0, 2)),
    cells: uniqueRouteCells(cleaned),
    fingerprint: routeFingerprint(cleaned),
  };
  route.structure = analyzeTourStructure({
    coords: cleaned,
    distanceM: route.distanceM,
    ascendM: route.ascendM,
    elevationAvailable,
  });
  return route;
}

function incrementCells(target, cells, weight = 1) {
  for (const cell of new Set(cells)) target[cell] = (target[cell] ?? 0) + weight;
}

function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.round((sorted.length - 1) * fraction)];
}

function finite(value) {
  return Number.isFinite(value) ? value : null;
}

export function analyzeTourStructure(route) {
  const quality = analyzeRouteQuality(route);
  const flow = evaluateRouteFlow(route.coords ?? []);
  const distanceM = route.distanceM || quality.distanceM;
  const distanceKm = distanceM / 1000;
  const closureM = route.coords?.length > 1
    ? haversineM(route.coords[0], route.coords.at(-1)) : 0;
  const knownSurfaceM = Math.max(0, quality.distanceM - quality.unknownSurfaceM);
  const gravelM = quality.surfaces
    .filter((surface) => [2, 8, 10].includes(surface.id))
    .reduce((sum, surface) => sum + surface.distanceM, 0);
  return {
    ascentPer10Km: route.elevationAvailable === false || !distanceKm
      ? null : finite((route.ascendM ?? 0) / distanceKm * 10),
    repeatedShare: finite(quality.repeated.share),
    sharpTurnsPer10Km: distanceKm ? finite(flow.sharpTurns / distanceKm * 10) : null,
    reversalsPer10Km: distanceKm ? finite(flow.reversals / distanceKm * 10) : null,
    closureShare: distanceM ? finite(closureM / distanceM) : null,
    firstClimbKm: quality.terrain.available ? finite(quality.terrain.firstClimbKm) : null,
    moderateClimbsPer50Km: quality.terrain.available && distanceKm
      ? finite(quality.terrain.climbs.filter((climb) => climb.moderate).length / distanceKm * 50) : null,
    steepClimbsPer50Km: quality.terrain.available && distanceKm
      ? finite(quality.terrain.climbs.filter((climb) => climb.steep).length / distanceKm * 50) : null,
    surfaceChangesPer10Km: quality.distanceM && knownSurfaceM / quality.distanceM >= 0.8
      ? finite(quality.changesPer10Km) : null,
    mainRoadShare: quality.waytypeAvailable ? finite(quality.mainRoadM / quality.distanceM) : null,
    gravelShare: quality.distanceM && knownSurfaceM / quality.distanceM >= 0.8
      ? finite(gravelM / quality.distanceM) : null,
  };
}

function weightedQuantile(items, fraction) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  const target = total * fraction;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= target) return item.value;
  }
  return sorted.at(-1).value;
}

export function buildStructureFrame(routes, minimumSamples = 5) {
  const dimensions = {};
  for (const [key, config] of Object.entries(STRUCTURE_DIMENSIONS)) {
    const values = routes
      .map((route) => ({
        value: route.structure?.[key],
        weight: (route.metadata?.rating ?? 5) / 5,
      }))
      .filter((item) => Number.isFinite(item.value) && item.weight > 0);
    if (values.length < minimumSamples) continue;
    dimensions[key] = {
      label: config.label,
      weight: config.weight,
      mode: config.mode,
      sampleSize: values.length,
      low: weightedQuantile(values, 0.2),
      median: weightedQuantile(values, 0.5),
      high: weightedQuantile(values, 0.8),
    };
  }
  return { version: 1, source: 'good-reference-routes', dimensions };
}

export function scoreTourStructure(structure, frame) {
  if (!frame?.dimensions) return { available: false, adjustment: 0, dimensions: [] };
  const dimensions = [];
  let adjustment = 0;
  for (const [key, target] of Object.entries(frame.dimensions)) {
    const value = structure?.[key];
    if (!Number.isFinite(value)) continue;
    const scale = Math.max(target.high - target.low, Math.abs(target.median) * 0.25, 0.01);
    const below = value < target.low && target.mode !== 'max';
    const above = value > target.high && target.mode !== 'min';
    const deviation = below
      ? (target.low - value) / scale
      : above ? (value - target.high) / scale : 0;
    const penalty = Math.min(deviation, 3) * target.weight;
    adjustment += penalty;
    dimensions.push({
      key, label: target.label, mode: target.mode ?? 'band', value, low: target.low, high: target.high,
      inFrame: deviation === 0, penalty,
    });
  }
  return { available: dimensions.length > 0, adjustment, dimensions };
}

export function validateStructureFrame(routes) {
  const results = routes.map((route, index) => {
    const frame = buildStructureFrame(routes.filter((_candidate, candidateIndex) => candidateIndex !== index));
    const score = scoreTourStructure(route.structure, frame);
    return {
      source: route.source,
      adjustment: score.adjustment,
      outsideDimensions: score.dimensions.filter((dimension) => !dimension.inFrame).length,
    };
  });
  const adjustments = results.map((result) => result.adjustment);
  return {
    method: 'leave-one-out',
    sampleSize: routes.length,
    medianAdjustment: quantile(adjustments, 0.5),
    p80Adjustment: quantile(adjustments, 0.8),
    worst: [...results].sort((a, b) => b.adjustment - a.adjustment).slice(0, 5),
  };
}

export function normalizeReferenceMetadata(metadata = {}, route = {}) {
  const rating = Number(metadata.rating ?? 5);
  if (!(rating >= 1 && rating <= 5)) throw new Error('Referenzbewertung muss zwischen 1 und 5 liegen.');
  const distanceM = route.distanceM ?? 0;
  const ascendM = route.ascendM ?? 0;
  return {
    kind: metadata.kind === 'counterexample' ? 'counterexample' : 'good',
    region: String(metadata.region || 'unbekannt'),
    season: String(metadata.season || 'ganzjährig'),
    bikeType: String(metadata.bikeType || 'Gravelbike'),
    rating,
    notes: String(metadata.notes || ''),
    distanceClass: String(metadata.distanceClass
      || (distanceM < 40000 ? 'kurz' : distanceM <= 80000 ? 'mittel' : 'lang')),
    ascentClass: String(metadata.ascentClass
      || (ascendM < 500 ? 'flach' : ascendM < 1200 ? 'hügelig' : 'bergig')),
  };
}

export function buildReferenceCalibration(routes) {
  const values = (key) => routes
    .filter((route) => key !== 'ascendM' || route.elevationAvailable !== false)
    .map((route) => route[key]).filter(Number.isFinite);
  const counts = (key) => Object.fromEntries([...new Set(routes.map((route) => route.metadata?.[key]))]
    .filter(Boolean).map((value) => [value, routes.filter((route) => route.metadata?.[key] === value).length]));
  const distances = values('distanceM');
  const ascents = values('ascendM');
  const distanceQuantile = (fraction) => {
    const value = quantile(distances, fraction);
    return value === null ? null : Math.round(value / 1000);
  };
  return {
    sampleSize: routes.length,
    distanceKm: { q25: distanceQuantile(0.25), median: distanceQuantile(0.5), q75: distanceQuantile(0.75) },
    ascentM: { q25: quantile(ascents, 0.25), median: quantile(ascents, 0.5), q75: quantile(ascents, 0.75) },
    byRegion: counts('region'),
    bySeason: counts('season'),
    byBikeType: counts('bikeType'),
  };
}

export function buildReferenceModel(goodRoutes, feedbackItems = []) {
  const goodCells = {};
  const goodEdges = {};
  const badCells = {};
  const badCellsByProblem = {};
  const problemCounts = {};
  const feedbackCorridors = [];
  for (const route of goodRoutes) {
    const weight = (route.metadata?.rating ?? 5) / 5;
    incrementCells(goodCells, route.cells, weight);
    incrementCells(goodEdges, route.edgeIds ?? [], weight);
  }
  for (const item of feedbackItems) {
    for (const passage of item.passages ?? []) {
      const coords = (passage.coords ?? []).filter((point) =>
        Number.isFinite(point[0]) && Number.isFinite(point[1]));
      const cells = uniqueRouteCells(coords);
      if (coords.length >= 2) feedbackCorridors.push({
        source: item.source ?? null,
        problem: String(passage.problem || 'anderes'),
        effect: passage.effect === 'avoid' ? 'avoid' : 'penalty',
        confidence: ['observed', 'suspected'].includes(passage.confidence) ? passage.confidence : 'legacy',
        coords: coords.map((point) => point.slice(0, 2)),
      });
      const problem = String(passage.problem || 'anderes');
      incrementCells(badCells, cells);
      badCellsByProblem[problem] ??= {};
      incrementCells(badCellsByProblem[problem], cells);
      problemCounts[problem] = (problemCounts[problem] ?? 0) + 1;
    }
  }
  return {
    schema: REFERENCE_MODEL_VERSION,
    feedbackPolicyVersion: 2,
    quality: {
      matching: 'geometry-proximity', toleranceM: 12,
      mapMatched: false,
      legacyPassages: feedbackCorridors.filter((corridor) => corridor.confidence === 'legacy').length,
      explicitAvoidPassages: feedbackCorridors.filter((corridor) => corridor.effect === 'avoid' && corridor.confidence === 'observed').length,
    },
    feedbackCorridors,
    summary: {
      goodRoutes: goodRoutes.length,
      feedbackFiles: feedbackItems.length,
      badPassages: feedbackItems.reduce((sum, item) => sum + (item.passages?.length ?? 0), 0),
      goodCells: Object.keys(goodCells).length,
      badCells: Object.keys(badCells).length,
      problemCounts,
    },
    routes: goodRoutes.map(({ fingerprint, cells, edgeIds, ...route }) => ({
      ...route,
      cellCount: cells.length,
    })),
    calibration: buildReferenceCalibration(goodRoutes),
    structureFrame: buildStructureFrame(goodRoutes),
    structureValidation: validateStructureFrame(goodRoutes),
    goodCells,
    goodEdges,
    badCells,
    badCellsByProblem,
  };
}

const corridorCache = new WeakMap();
function corridorMatchers(model) {
  if (!corridorCache.has(model)) {
    corridorCache.set(model, (model.feedbackCorridors ?? []).map((corridor) => ({
      ...corridor, near: lineIndex(corridor.coords),
    })));
  }
  return corridorCache.get(model);
}

export function scopeReferenceModel(model, start, radiusM) {
  if (!model || !start) return model;
  const within = (cell) => haversineM(start, cell.split(',').map(Number)) <= radiusM + 150;
  return {
    ...model,
    goodCells: Object.fromEntries(Object.entries(model.goodCells ?? {}).filter(([cell]) => within(cell))),
    badCells: Object.fromEntries(Object.entries(model.badCells ?? {}).filter(([cell]) => within(cell))),
    feedbackCorridors: model.feedbackCorridors?.filter((corridor) =>
      corridor.coords.some((point, index) => index > 0
        && pointSegmentDistanceM(start, corridor.coords[index - 1], point) <= radiusM)),
  };
}

export function scoreRouteAgainstReferences(coords, model, match = {}) {
  if (!coords?.length || model?.schema !== REFERENCE_MODEL_VERSION) {
    return { goodAffinity: 0, badCoverage: 0, adjustment: 0, available: false, byProblem: {} };
  }
  const cells = uniqueRouteCells(coords);
  let goodWeight = 0;
  for (const cell of cells) goodWeight += Math.min((model.goodCells?.[cell] ?? 0) / 3, 1);
  const rasterAffinity = goodWeight / cells.length;
  const graphMatches = match.graphTimestamp
    && match.graphTimestamp === model.matchingGraphTimestamp
    && Array.isArray(match.edgeIds) && match.edgeIds.length;
  const uniqueEdges = graphMatches ? [...new Set(match.edgeIds)] : [];
  const edgeWeight = uniqueEdges.reduce(
    (sum, edgeId) => sum + Math.min((model.goodEdges?.[edgeId] ?? 0) / 3, 1),
    0,
  );
  const goodAffinity = graphMatches ? edgeWeight / uniqueEdges.length : rasterAffinity;
  let badCoverage = 0;
  const byProblem = {};
  if (Array.isArray(model.feedbackCorridors)) {
    const samples = sampleLine(coords, 25);
    let badM = 0;
    const matchers = corridorMatchers(model);
    for (let index = 1; index < samples.length; index++) {
      const hits = matchers.filter((corridor) => corridor.near(samples[index].point));
      const distanceM = samples[index].distanceM - samples[index - 1].distanceM;
      if (hits.length) badM += distanceM;
      for (const problem of new Set(hits.map((hit) => hit.problem))) {
        byProblem[problem] = (byProblem[problem] ?? 0) + distanceM;
      }
    }
    badCoverage = badM / (samples.at(-1)?.distanceM || 1);
  } else {
    // Ältere Modelle bleiben als grobe Rankinghinweise lesbar, nie als Sperren.
    badCoverage = cells.filter((cell) => model.badCells?.[cell]).length / cells.length;
  }
  return {
    goodAffinity, badCoverage, byProblem, available: true,
    matching: graphMatches ? 'ors-edge' : Array.isArray(model.feedbackCorridors) ? 'geometry-proximity' : 'legacy-grid',
    adjustment: badCoverage * 12 - goodAffinity * 0.6,
  };
}

export function feedbackAvoidPolygons(model, protectedPoints = []) {
  if (model?.schema !== REFERENCE_MODEL_VERSION) return null;
  const polygons = [];
  for (const corridor of model.feedbackCorridors ?? []) {
    if (corridor.effect !== 'avoid' || corridor.confidence !== 'observed') continue;
    for (let index = 1; index < corridor.coords.length; index++) {
      const a = corridor.coords[index - 1];
      const b = corridor.coords[index];
      if (protectedPoints.some((point) => pointSegmentDistanceM(point, a, b) < 350)) continue;
      const latScale = 111195;
      const lonScale = latScale * Math.cos((a[0] + b[0]) / 2 * Math.PI / 180);
      const dx = (b[1] - a[1]) * lonScale;
      const dy = (b[0] - a[0]) * latScale;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;
      // Schmaler 8-m-Puffer um die markierte Geometrie, keine Rasterfläche.
      const x = -dy / length * 8 / lonScale;
      const y = dx / length * 8 / latScale;
      const ring = [[a[1] + x, a[0] + y], [b[1] + x, b[0] + y],
        [b[1] - x, b[0] - y], [a[1] - x, a[0] - y], [a[1] + x, a[0] + y]];
      polygons.push([ring]);
    }
  }
  return polygons.length ? { type: 'MultiPolygon', coordinates: polygons } : null;
}
