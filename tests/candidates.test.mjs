import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRange, rankRoundTripCandidates } from '../js/candidates.js';

const candidate = (km, hm, id) => ({
  id,
  route: { distanceM: km * 1000, ascendM: hm },
});

test('inRange: boundaries are inclusive', () => {
  assert.equal(inRange(200, 200, 800), true);
  assert.equal(inRange(800, 200, 800), true);
  assert.equal(inRange(801, 200, 800), false);
});

test('rankRoundTripCandidates: candidates matching km and hm rank first', () => {
  const ranked = rankRoundTripCandidates(
    [
      candidate(40, 1000, 'too-high'),
      candidate(55, 500, 'too-long'),
      candidate(42, 500, 'match'),
    ],
    { minKm: 30, maxKm: 50, minHm: 200, maxHm: 800 },
  );
  assert.equal(ranked[0].id, 'match');
  assert.equal(ranked[0].inRange, true);
  assert.equal(ranked[1].inRange, false);
});

test('rankRoundTripCandidates: annotates missed target and limits output', () => {
  const ranked = rankRoundTripCandidates(
    [
      candidate(20, 400, 'short'),
      candidate(40, 900, 'high'),
      candidate(40, 500, 'match'),
      candidate(45, 600, 'also-match'),
    ],
    { minKm: 30, maxKm: 50, minHm: 200, maxHm: 800, limit: 3 },
  );
  assert.equal(ranked.length, 3);
  const high = ranked.find((item) => item.id === 'high');
  assert.equal(high.distanceInRange, true);
  assert.equal(high.ascentInRange, false);
});
