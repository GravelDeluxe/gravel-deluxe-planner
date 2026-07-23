import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRouteDisplaySegments,
  directionArrowPoints,
} from '../js/route-display.js';

test('route display marks forbidden ground and excessive slope', () => {
  const segments = buildRouteDisplaySegments(
    {
      coords: [
        [49, 9, 100],
        [49.001, 9, 125],
        [49.002, 9, 125],
      ],
      surfaceSegments: [[0, 1, 12], [1, 2, 10]],
    },
    { allowMeadowEarth: false, maxSlopePercent: 10 },
  );
  assert.equal(segments[0].surfaceName, 'Naturboden/Matsch');
  assert.equal(segments[0].surfaceViolation, true);
  assert.equal(segments[0].slopeViolation, true);
  assert.equal(segments[0].color, '#7e22ce');
});

test('route display uses light orange for slope-only violations', () => {
  const segments = buildRouteDisplaySegments(
    {
      coords: [[49, 9, 100], [49.001, 9, 125], [49.002, 9, 125]],
      surfaceSegments: [[0, 2, 10]],
    },
    { allowMeadowEarth: true, maxSlopePercent: 10 },
  );
  assert.equal(segments[0].color, '#fb923c');
});

test('directionArrowPoints emits sparse arrows along the route', () => {
  const arrows = directionArrowPoints(
    [[49, 9], [49.01, 9], [49.02, 9], [49.03, 9]],
    1000,
  );
  assert.ok(arrows.length >= 2);
  assert.ok(arrows.every((arrow) => arrow.bearing < 1 || arrow.bearing > 359));
});
