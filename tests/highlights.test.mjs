import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGuidedWaypoints, buildHighlightWaypoints } from '../js/highlights.js';

test('buildHighlightWaypoints: keeps start/end and inserts every highlight', () => {
  const start = [49, 9];
  const route = [
    [49, 9], [49, 9.1], [49.1, 9.1], [49.1, 9], [49, 9],
  ];
  const highlights = [[49.08, 9.1], [49.1, 9.02]];
  const points = buildHighlightWaypoints(start, route, highlights, 2);
  assert.deepEqual(points[0], start);
  assert.deepEqual(points.at(-1), start);
  assert.ok(points.some((point) => point[0] === highlights[0][0] && point[1] === highlights[0][1]));
  assert.ok(points.some((point) => point[0] === highlights[1][0] && point[1] === highlights[1][1]));
});

test('buildHighlightWaypoints: orders highlights by nearest loop section', () => {
  const start = [49, 9];
  const route = [[49, 9], [49, 9.1], [49.1, 9.1], [49.1, 9], [49, 9]];
  const late = [49.1, 9.01];
  const early = [49.01, 9.1];
  const points = buildHighlightWaypoints(start, route, [late, early], 0);
  assert.deepEqual(points, [start, early, late, start]);
});

test('buildGuidedWaypoints preserves loop anchors when only highlights are set', () => {
  const start = [49, 9];
  const route = [
    [49, 9], [49.01, 9.01], [49.02, 9.02], [49.03, 9.03],
    [49.04, 9.02], [49.03, 9.01], [49.02, 9], [49.01, 8.99], [49, 9],
  ];
  const highlight = [49.025, 9.025];
  const points = buildGuidedWaypoints(start, route, [], [highlight]);
  assert.equal(points.length, 7);
  assert.ok(points.some((point) => point[0] === highlight[0] && point[1] === highlight[1]));
});

test('buildGuidedWaypoints uses explicit shape points instead of generated anchors', () => {
  const start = [49, 9];
  const route = [[49, 9], [49.1, 9.1], [49, 9]];
  const shapePoint = [49.05, 9.08];
  const highlight = [49.08, 9.1];
  const points = buildGuidedWaypoints(start, route, [shapePoint], [highlight]);
  assert.deepEqual(points, [start, shapePoint, highlight, start]);
});
