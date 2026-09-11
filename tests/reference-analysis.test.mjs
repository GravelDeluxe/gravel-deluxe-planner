import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REFERENCE_MODEL_VERSION,
  parseGpx,
  referenceCell,
  uniqueRouteCells,
  analyzeReferenceRoute,
  buildReferenceModel,
  buildReferenceCalibration,
  buildStructureFrame,
  normalizeReferenceMetadata,
  scoreTourStructure,
  validateStructureFrame,
  scoreRouteAgainstReferences,
  feedbackAvoidPolygons,
  scopeReferenceModel,
} from '../js/reference-analysis.js';

test('good reference routes define a robust frame for tour structure', () => {
  const routes = [0.02, 0.03, 0.04, 0.05, 0.4].map((repeatedShare) => ({
    metadata: { rating: 5 }, structure: { repeatedShare },
  }));
  const frame = buildStructureFrame(routes);
  assert.deepEqual(frame.dimensions.repeatedShare, {
    label: 'Doppelbefahrung', weight: 1.2, mode: 'max', sampleSize: 5,
    low: 0.02, median: 0.04, high: 0.05,
  });
  const typical = scoreTourStructure({ repeatedShare: 0.04 }, frame);
  const better = scoreTourStructure({ repeatedShare: 0 }, frame);
  const atypical = scoreTourStructure({ repeatedShare: 0.2 }, frame);
  assert.equal(typical.adjustment, 0);
  assert.equal(better.adjustment, 0);
  assert.ok(atypical.adjustment > 0);
  assert.equal(atypical.dimensions[0].inFrame, false);
});

test('structure learning validates every good route against a frame without itself', () => {
  const routes = [1, 2, 3, 4, 5, 20].map((value, index) => ({
    source: `route-${index}.gpx`, metadata: { rating: 5 },
    structure: { sharpTurnsPer10Km: value },
  }));
  const validation = validateStructureFrame(routes);
  assert.equal(validation.method, 'leave-one-out');
  assert.equal(validation.sampleSize, 6);
  assert.equal(validation.worst[0].source, 'route-5.gpx');
  assert.ok(validation.worst[0].adjustment > 0);
});

test('reference metadata validates ratings and derives route classes', () => {
  assert.deepEqual(normalizeReferenceMetadata(
    { region: 'Kraichgau', season: 'Frühling', rating: 4 },
    { distanceM: 52000, ascendM: 900 },
  ), {
    kind: 'good', region: 'Kraichgau', season: 'Frühling', bikeType: 'Gravelbike',
    rating: 4, notes: '', distanceClass: 'mittel', ascentClass: 'hügelig',
  });
  assert.throws(() => normalizeReferenceMetadata({ rating: 7 }), /zwischen 1 und 5/);
});

test('reference calibration reports robust target ranges and coverage', () => {
  const calibration = buildReferenceCalibration([
    { distanceM: 30000, ascendM: 300, metadata: { region: 'A', season: 'Sommer', bikeType: 'Gravel' } },
    { distanceM: 50000, ascendM: 700, metadata: { region: 'A', season: 'Winter', bikeType: 'Gravel' } },
    { distanceM: 90000, ascendM: 1400, metadata: { region: 'B', season: 'Sommer', bikeType: 'MTB' } },
  ]);
  assert.deepEqual(calibration.distanceKm, { q25: 50, median: 50, q75: 90 });
  assert.deepEqual(calibration.ascentM, { q25: 700, median: 700, q75: 1400 });
  assert.deepEqual(calibration.byRegion, { A: 2, B: 1 });
});

test('parseGpx: reads regular GPX with elevation', () => {
  const parsed = parseGpx(`
    <gpx><trk><name>Wald &amp; Wiese</name><trkseg>
      <trkpt lat="49.1" lon="9.1"><ele>120</ele></trkpt>
      <trkpt lat="49.2" lon="9.2"><ele>130</ele></trkpt>
    </trkseg></trk></gpx>
  `);
  assert.equal(parsed.name, 'Wald & Wiese');
  assert.deepEqual(parsed.coords[0], [49.1, 9.1, 120]);
  assert.equal(parsed.elevationAvailable, true);
});

test('parseGpx: reads namespaced Hammerhead-style self-closing points', () => {
  const parsed = parseGpx(`
    <ns0:gpx><ns0:metadata><ns0:name>Burg</ns0:name></ns0:metadata>
      <ns0:trkpt lat="49.1" lon="9.1" />
      <ns0:trkpt lat="49.2" lon="9.2" />
    </ns0:gpx>
  `);
  assert.equal(parsed.name, 'Burg');
  assert.deepEqual(parsed.coords[1], [49.2, 9.2, 0]);
  assert.equal(parsed.elevationAvailable, false);
});

test('parseGpx: reads named GPX waypoints as highlights', () => {
  const parsed = parseGpx(`
    <gpx><wpt lat="49.15" lon="9.15"><name>Burg &amp; Blick</name></wpt>
      <trkpt lat="49.1" lon="9.1"/><trkpt lat="49.2" lon="9.2"/></gpx>
  `);
  assert.deepEqual(parsed.waypoints, [{ coords: [49.15, 9.15], name: 'Burg & Blick' }]);
});

test('reference cells deduplicate points in the same corridor cell', () => {
  assert.equal(referenceCell([49.1234, 9.5674]), '49.123,9.567');
  assert.deepEqual(
    uniqueRouteCells([[49.1234, 9.5674], [49.12349, 9.56749]]),
    ['49.123,9.567'],
  );
});

test('analyzeReferenceRoute: reports route metrics and closure', () => {
  const route = analyzeReferenceRoute({
    name: 'Runde',
    source: 'runde.gpx',
    coords: [
      [49, 9, 100],
      [49.003, 9, 110],
      [49.006, 9, 120],
      [49.01, 9, 130],
      [49.006, 9, 120],
      [49.003, 9, 110],
      [49, 9, 100],
    ],
  });
  assert.equal(route.closed, true);
  assert.ok(route.distanceM > 2000);
  assert.ok(route.ascendM > 0);
  assert.ok(route.cells.length > 1);
});

test('reference model rewards good corridors and penalizes feedback corridors', () => {
  const goodCoords = [[49, 9, 100], [49.001, 9, 100], [49.002, 9, 100]];
  const badCoords = [[49, 9.01, 100], [49.001, 9.01, 100], [49.002, 9.01, 100]];
  const good = analyzeReferenceRoute({ name: 'gut', source: 'gut.gpx', coords: goodCoords });
  const model = buildReferenceModel(
    [good],
    [{ passages: [{ coords: badCoords }] }],
  );
  assert.equal(model.schema, REFERENCE_MODEL_VERSION);
  assert.ok(scoreRouteAgainstReferences(goodCoords, model).adjustment < 0);
  assert.ok(scoreRouteAgainstReferences(badCoords, model).adjustment > 0);
});

test('matching graph edges replace the coarse positive raster on the same graph version', () => {
  const coords = [[49, 9], [49.001, 9]];
  const route = analyzeReferenceRoute({ name: 'gut', source: 'gut.gpx', coords });
  route.edgeIds = [100, 101];
  const model = buildReferenceModel([route]);
  model.matchingGraphTimestamp = 'graph-1';
  const exact = scoreRouteAgainstReferences(coords, model, {
    edgeIds: [100, 999], graphTimestamp: 'graph-1',
  });
  const stale = scoreRouteAgainstReferences(coords, model, {
    edgeIds: [999], graphTimestamp: 'graph-0',
  });
  assert.equal(exact.matching, 'ors-edge');
  assert.equal(exact.goodAffinity, 0.5 / 3);
  assert.notEqual(stale.matching, 'ors-edge');
});

test('reference model retains bad corridors grouped by problem type', () => {
  const model = buildReferenceModel([], [{
    passages: [
      { problem: 'unnötige Abkürzung', coords: [[49, 9], [49.001, 9]] },
      { problem: 'zu viel Zig-Zag', coords: [[49, 9.01], [49.001, 9.01]] },
    ],
  }]);
  assert.equal(model.summary.problemCounts['unnötige Abkürzung'], 1);
  assert.equal(model.summary.problemCounts['zu viel Zig-Zag'], 1);
  assert.ok(Object.keys(model.badCellsByProblem['unnötige Abkürzung']).length);
  assert.ok(Object.keys(model.badCellsByProblem['zu viel Zig-Zag']).length);
});

test('only explicitly avoided observed passages become narrow avoidance polygons', () => {
  const model = {
    schema: REFERENCE_MODEL_VERSION,
    feedbackCorridors: [
      { effect: 'penalty', confidence: 'observed', coords: [[49, 9], [49.001, 9]] },
      { effect: 'avoid', confidence: 'observed', coords: [[49.1, 9.1], [49.101, 9.1]] },
    ],
  };
  const geometry = feedbackAvoidPolygons(model, [[49, 9]]);
  assert.equal(geometry.type, 'MultiPolygon');
  assert.equal(geometry.coordinates.length, 1);
  assert.ok(geometry.coordinates[0][0][0][0] > 9.09);
});

test('legacy and contextual feedback never creates avoidance polygons', () => {
  assert.equal(feedbackAvoidPolygons({
    schema: REFERENCE_MODEL_VERSION,
    badCells: { '49.000,9.000': 1 },
  }), null);
});

test('feedback matching follows marked geometry and does not hit a nearby parallel way', () => {
  const model = buildReferenceModel([], [{ passages: [{
    problem: 'zu viel Zig-Zag', effect: 'penalty', confidence: 'observed',
    coords: [[49, 9], [49.002, 9]],
  }] }]);
  const sameWay = scoreRouteAgainstReferences([[49, 9], [49.002, 9]], model);
  const parallelWay = scoreRouteAgainstReferences([[49, 9.0004], [49.002, 9.0004]], model);
  assert.ok(sameWay.badCoverage > 0.8);
  assert.equal(parallelWay.badCoverage, 0);
  assert.ok(sameWay.byProblem['zu viel Zig-Zag'] > 100);
});

test('reference model can be scoped to the requested search area', () => {
  const model = buildReferenceModel([], [{ passages: [
    { coords: [[49, 9], [49.001, 9]] },
    { coords: [[50, 10], [50.001, 10]] },
  ] }]);
  model.goodCells = { '49.000,9.000': 1, '50.000,10.000': 1 };
  const scoped = scopeReferenceModel(model, [49, 9], 5000);
  assert.equal(scoped.feedbackCorridors.length, 1);
  assert.deepEqual(Object.keys(scoped.goodCells), ['49.000,9.000']);
});
