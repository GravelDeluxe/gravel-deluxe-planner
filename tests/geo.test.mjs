import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineM, destinationPoint, ringWaypoints } from '../js/geo.js';

test('haversineM: 1 degree latitude is ~111.19 km', () => {
  const d = haversineM([50, 8], [51, 8]);
  assert.ok(Math.abs(d - 111195) < 200, `got ${d}`);
});

test('destinationPoint: 1 km north raises latitude by ~0.009 degrees', () => {
  const [lat, lon] = destinationPoint([50, 8], 1, 0);
  assert.ok(Math.abs(lat - 50.008993) < 0.0005, `lat ${lat}`);
  assert.ok(Math.abs(lon - 8) < 0.0001, `lon ${lon}`);
});

test('destinationPoint: 1 km east keeps latitude', () => {
  const [lat, lon] = destinationPoint([50, 8], 1, 90);
  assert.ok(Math.abs(lat - 50) < 0.0005, `lat ${lat}`);
  assert.ok(lon > 8.01 && lon < 8.02, `lon ${lon}`);
});

test('ringWaypoints: n points, all radiusKm from center', () => {
  const ring = ringWaypoints([50, 8], 5, 4, 10);
  assert.equal(ring.length, 4);
  for (const p of ring) {
    const d = haversineM([50, 8], p);
    assert.ok(Math.abs(d - 5000) < 50, `distance ${d}`);
  }
});
