import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCandidates } from '../js/loop.js';
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
