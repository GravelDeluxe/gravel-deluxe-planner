import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRouteConstraints,
  maximumSustainedGrade,
  meadowEarthDistanceM,
} from '../js/route-constraints.js';

const coords = [
  [49, 9, 100],
  [49.001, 9, 110],
  [49.002, 9, 112],
];

test('meadowEarthDistanceM counts ORS dirt, ground and grass segments', () => {
  const distance = meadowEarthDistanceM(coords, [[0, 1, 12], [1, 2, 1]]);
  assert.ok(distance > 100 && distance < 120);
});

test('maximumSustainedGrade evaluates elevation over a meaningful window', () => {
  const grade = maximumSustainedGrade(coords);
  assert.ok(grade > 8 && grade < 10);
});

test('route constraints reject forbidden meadow/earth and excessive slope', () => {
  const result = evaluateRouteConstraints(
    { coords, distanceM: 222, surfaceSegments: [[0, 1, 17]] },
    { allowMeadowEarth: false, maxSlopePercent: 8 },
  );
  assert.equal(result.surfaceAllowed, false);
  assert.equal(result.slopeAllowed, false);
  assert.equal(result.allowed, false);
});

test('route constraints tolerate route data without extras', () => {
  const result = evaluateRouteConstraints({ distanceM: 1000 });
  assert.equal(result.allowed, true);
  assert.equal(result.surfaceAvailable, false);
});

test('missing, partial and explicitly unknown surfaces cannot verify a surface exclusion', () => {
  for (const surfaceSegments of [[], [[0, 1, 3]], [[0, 2, 0]]]) {
    const result = evaluateRouteConstraints(
      { coords, distanceM: 222, surfaceSegments },
      { allowMeadowEarth: false },
    );
    assert.equal(result.surfaceStatus, 'unknown');
    assert.equal(result.allowed, false);
  }
  const verified = evaluateRouteConstraints(
    { coords, distanceM: 222, surfaceSegments: [[0, 2, 3]] },
    { allowMeadowEarth: false },
  );
  assert.equal(verified.surfaceStatus, 'verified');
  assert.equal(verified.allowed, true);
});
