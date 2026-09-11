import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRouteQuality, firstClimbAssessment } from '../js/route-quality.js';
import { routeOverlap } from '../js/route-geometry.js';

function climbingRoute() {
  const coords = [];
  for (let index = 0; index <= 80; index++) {
    const elevation = index <= 60 ? 100 : index <= 70 ? 100 + (index - 60) * 5 : 150;
    coords.push([49 + index * 0.0009, 9, elevation]);
  }
  return {
    coords,
    distanceM: 8000,
    surfaceSegments: [[0, 40, 3], [40, 80, 10]],
    waytypeSegments: [[0, 10, 1], [10, 80, 5]],
    elevationAvailable: true,
  };
}

test('route quality reports surfaces, transitions, main roads and a moderate climb', () => {
  const quality = analyzeRouteQuality(climbingRoute());
  assert.equal(quality.surfaceChanges, 1);
  assert.ok(quality.mainRoadM > 900 && quality.mainRoadM < 1100);
  assert.ok(quality.unknownSurfaceM < 1);
  assert.ok(quality.terrain.firstClimbKm >= 5 && quality.terrain.firstClimbKm <= 7);
  assert.equal(quality.terrain.climbs[0].moderate, true);
  assert.equal(firstClimbAssessment(quality.terrain, 'required').allowed, true);
});

test('first climb requirement rejects missing or late climbs', () => {
  assert.equal(firstClimbAssessment({ available: true, firstClimbKm: 12 }, 'required').allowed, false);
  assert.equal(firstClimbAssessment({ available: false, firstClimbKm: null }, 'required').allowed, false);
});

test('route overlap identifies the same line but keeps parallel roads distinct', () => {
  const route = [[49, 9], [49.01, 9], [49.02, 9]];
  assert.ok(routeOverlap(route, [...route].reverse()) > 0.9);
  assert.equal(routeOverlap(route, route.map(([lat, lon]) => [lat, lon + 0.0004])), 0);
});
