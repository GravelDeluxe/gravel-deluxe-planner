import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reverseRoute, restoreSavedRoute } from '../js/route-state.js';
import { buildRouteDisplaySegments } from '../js/route-display.js';
import { evaluateRouteConstraints } from '../js/route-constraints.js';

test('reverseRoute preserves physical surfaces and recomputes ascent without changing the source', () => {
  const route = {
    coords: [[49, 9, 100], [49.001, 9, 120], [49.002, 9, 130], [49.003, 9, 110]],
    surfaceSegments: [[0, 1, 3], [1, 3, 17]],
    distanceM: 333, ascendM: 30, profile: 'ors-gravel-deluxe',
  };
  const snapshot = structuredClone(route);
  const reversed = reverseRoute(route);
  assert.equal(reversed.ascendM, 20);
  assert.deepEqual(reversed.surfaceSegments, [[0, 2, 17], [2, 3, 3]]);
  const pieces = buildRouteDisplaySegments(reversed, { maxSlopePercent: 30 });
  assert.equal(pieces[0].surfaceName, 'Gras');
  assert.deepEqual(pieces[0].coords, [route.coords[3], route.coords[2], route.coords[1]]);
  assert.deepEqual(reverseRoute(reversed), route);
  assert.deepEqual(route, snapshot);
});

test('reverseRoute recalculates slope violations for the new travel direction', () => {
  const route = { coords: [[49, 9, 100], [49.001, 9, 120]], ascendM: 20 };
  assert.equal(evaluateRouteConstraints(route).slopeAllowed, false);
  assert.equal(evaluateRouteConstraints(reverseRoute(route)).slopeAllowed, true);
});

test('legacy routes retain unknown metadata and get usable planning defaults', () => {
  const restored = restoreSavedRoute({
    waypoints: [[49, 9]], coords: [[49, 9, 100], [49.001, 9, 100]],
    settings: { maxSlopePercent: 8 }, distanceM: 111, ascendM: 0,
  });
  assert.equal(restored.mode, 'loop');
  assert.equal(restored.route.profile, null);
  assert.deepEqual(restored.route.surfaceSegments, []);
  assert.deepEqual(restored.shapePoints, []);
  assert.equal(restored.importedTrack, null);
  assert.equal(restored.settings.maxSlopePercent, 8);
  assert.equal(restored.settings.minKm, 30);
});
