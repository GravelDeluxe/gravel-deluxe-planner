import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectReferenceGuides } from '../js/reference-guidance.js';

test('selectReferenceGuides finds and rotates a good loop through the highlights', () => {
  const start = [49, 9];
  const matching = {
    source: 'gut.gpx', closed: true, distanceM: 50000,
    guidePoints: [[49.01, 9], [49.02, 8.9], [49, 8.8], [48.98, 8.9], [49.01, 9]],
  };
  const remote = {
    source: 'fern.gpx', closed: true, distanceM: 50000,
    guidePoints: [[50, 10], [50.1, 10], [50, 10.1], [50, 10]],
  };
  const guides = selectReferenceGuides(
    [remote, matching], start, [[49, 8.8]], { minKm: 30, maxKm: 70 },
  );
  assert.equal(guides.length, 1);
  assert.equal(guides[0].source, 'gut.gpx');
  assert.deepEqual(guides[0].waypoints[0], start);
  assert.deepEqual(guides[0].waypoints.at(-1), start);
});

test('selectReferenceGuides ignores routes that miss a required highlight', () => {
  const guides = selectReferenceGuides([{
    source: 'anderswo.gpx', closed: true, distanceM: 40000,
    guidePoints: [[49, 9], [49.1, 9], [49.1, 9.1], [49, 9]],
  }], [49, 9], [[49, 8]], { minKm: 30, maxKm: 50 });
  assert.deepEqual(guides, []);
});
