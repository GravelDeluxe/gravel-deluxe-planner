import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REFERENCE_MODEL_VERSION,
  parseGpx,
  referenceCell,
  uniqueRouteCells,
  analyzeReferenceRoute,
  buildReferenceModel,
  scoreRouteAgainstReferences,
  feedbackAvoidPolygons,
} from '../js/reference-analysis.js';

test('parseGpx: reads regular GPX with elevation', () => {
  const parsed = parseGpx(`
    <gpx><trk><name>Wald &amp; Wiese</name><trkseg>
      <trkpt lat="49.1" lon="9.1"><ele>120</ele></trkpt>
      <trkpt lat="49.2" lon="9.2"><ele>130</ele></trkpt>
    </trkseg></trk></gpx>
  `);
  assert.equal(parsed.name, 'Wald & Wiese');
  assert.deepEqual(parsed.coords[0], [49.1, 9.1, 120]);
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

test('feedbackAvoidPolygons converts bad cells but protects start and highlights', () => {
  const model = {
    schema: REFERENCE_MODEL_VERSION,
    badCells: {
      '49.000,9.000': 1,
      '49.100,9.100': 1,
    },
  };
  const geometry = feedbackAvoidPolygons(model, [[49, 9]]);
  assert.equal(geometry.type, 'MultiPolygon');
  assert.equal(geometry.coordinates.length, 1);
  assert.ok(geometry.coordinates[0][0][0][0] > 9);
});
