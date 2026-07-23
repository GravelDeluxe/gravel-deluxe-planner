import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  directionalLoopWaypoints,
  generateCandidates,
  generateDirectionalCandidates,
} from '../js/loop.js';
import { haversineM } from '../js/geo.js';

// Fake router: circle -> ring circumference * 1.3; oneway -> straight line * 1.3.
const fakeRouteFn = async (waypoints) => {
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];
  const distanceM = closed
    ? 2 * Math.PI * haversineM(first, waypoints[1]) * 1.3
    : haversineM(first, last) * 1.3;
  return { distanceM, coords: [], ascendM: 0 };
};

test('circle: candidates are closed loops within range', async () => {
  const start = [50, 8];
  const cands = await generateCandidates(start, { minKm: 30, maxKm: 50, mode: 'circle' }, fakeRouteFn);
  assert.equal(cands.length, 3);
  for (const c of cands) {
    assert.deepEqual(c.waypoints[0], start);
    assert.deepEqual(c.waypoints[c.waypoints.length - 1], start);
    assert.equal(c.inRange, true);
    assert.ok(c.distKm >= 30 && c.distKm <= 50, `got ${c.distKm} km`);
  }
});

test('oneway: open route within range, distinct bearings give distinct endpoints', async () => {
  const start = [50, 8];
  const cands = await generateCandidates(start, { minKm: 30, maxKm: 50, mode: 'oneway' }, fakeRouteFn);
  assert.equal(cands.length, 3);
  for (const c of cands) {
    assert.notDeepEqual(c.waypoints[c.waypoints.length - 1], start);
    assert.equal(c.inRange, true);
  }
  const ends = new Set(cands.map((c) => c.waypoints[1].join(',')));
  assert.equal(ends.size, 3);
});

test('out-of-range best attempt is flagged, not dropped', async () => {
  const stubbornRouteFn = async () => ({ distanceM: 999999, coords: [], ascendM: 0 });
  const cands = await generateCandidates([50, 8], { minKm: 30, maxKm: 50, mode: 'circle', count: 2 }, stubbornRouteFn);
  assert.equal(cands.length, 2);
  for (const c of cands) assert.equal(c.inRange, false);
});

test('all candidates failing throws German error', async () => {
  const failingRouteFn = async () => { throw new Error('boom'); };
  await assert.rejects(
    generateCandidates([50, 8], { minKm: 30, maxKm: 50, mode: 'circle' }, failingRouteFn),
    /Keine Route gefunden/,
  );
});

test('circle: waypoints are snapped onto the routed line (fixes marker-off-route gap)', async () => {
  const start = [50, 8];
  // Router "snaps" to a node offset from the raw click, like BRouter does.
  const snappedStart = [50.003, 8.003, 100];
  const snappingRouteFn = async (waypoints) => {
    const radiusM = haversineM(waypoints[0], waypoints[1]);
    return {
      distanceM: 2 * Math.PI * radiusM * 1.3,
      ascendM: 0,
      coords: [snappedStart, [50.02, 8.02, 120], snappedStart],
    };
  };
  const cands = await generateCandidates(start, { minKm: 30, maxKm: 50, mode: 'circle' }, snappingRouteFn);
  // The start marker must sit ON the route (the snapped node), not at the raw click.
  assert.deepEqual(cands[0].waypoints[0], [50.003, 8.003]);
  assert.deepEqual(cands[0].waypoints[cands[0].waypoints.length - 1], [50.003, 8.003]);
  assert.notDeepEqual(cands[0].waypoints[0], start);
  // Every waypoint must coincide with a point that lies on the drawn route.
  const onRoute = ([lat, lon]) =>
    snappingRouteFn.length && [[50.003, 8.003], [50.02, 8.02]].some((c) => c[0] === lat && c[1] === lon);
  for (const wp of cands[0].waypoints) assert.ok(onRoute(wp), `off route: ${wp}`);
});

test('mixed candidate set sorts in-range candidates first', async () => {
  // First candidate (calls 0..maxIter-1) never converges: always out of range.
  // Remaining candidates converge immediately to the exact ring circumference.
  let calls = 0;
  const maxIter = 5;
  const mixedRouteFn = async (waypoints) => {
    const i = calls++;
    if (i < maxIter) {
      return { distanceM: 999999, coords: [], ascendM: 0 };
    }
    const first = waypoints[0];
    const distanceM = 2 * Math.PI * haversineM(first, waypoints[1]) * 1.3;
    return { distanceM, coords: [], ascendM: 0 };
  };
  const cands = await generateCandidates(
    [50, 8],
    { minKm: 30, maxKm: 50, mode: 'circle', count: 3, maxIter },
    mixedRouteFn,
  );
  assert.equal(cands.length, 3);
  assert.equal(cands[0].inRange, true);
  assert.equal(cands[cands.length - 1].inRange, false);
});

test('directionalLoopWaypoints: north loop stays north of its start', () => {
  const start = [49, 9];
  const waypoints = directionalLoopWaypoints(start, 40, 0);
  assert.deepEqual(waypoints[0], start);
  assert.deepEqual(waypoints.at(-1), start);
  for (const point of waypoints.slice(1, -1)) {
    assert.ok(point[0] > start[0], `point is not north: ${point}`);
  }
});

test('generateDirectionalCandidates: creates closed candidates in target range', async () => {
  const start = [49, 9];
  const routeFn = async (waypoints) => ({
    distanceM: 40000,
    ascendM: 300,
    coords: waypoints.map(([lat, lon]) => [lat, lon, 100]),
  });
  const candidates = await generateDirectionalCandidates(
    start,
    { minKm: 30, maxKm: 50, bearingDeg: 0, count: 3 },
    routeFn,
  );
  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((candidate) => candidate.inRange));
  assert.ok(candidates.every((candidate) => candidate.waypoints[1][0] > start[0]));
});
