import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRange, rankRoundTripCandidates, routeDirection } from '../js/candidates.js';

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

test('routeDirection: uses route center for closed loops', () => {
  const north = routeDirection(
    [[49, 9], [49.2, 8.9], [49.2, 9.1], [49, 9]],
    [49, 9],
  );
  assert.equal(north.cardinal, 'N');
});

test('rankRoundTripCandidates: requested direction influences ranking', () => {
  const west = {
    ...candidate(40, 500, 'west'),
    route: { distanceM: 40000, ascendM: 500, coords: [[49, 9], [49, 8.8], [49, 9]] },
  };
  const east = {
    ...candidate(40, 500, 'east'),
    route: { distanceM: 40000, ascendM: 500, coords: [[49, 9], [49, 9.2], [49, 9]] },
  };
  const ranked = rankRoundTripCandidates(
    [west, east],
    {
      minKm: 30, maxKm: 50, minHm: 200, maxHm: 800,
      direction: 'W', start: [49, 9],
    },
  );
  assert.equal(ranked[0].id, 'west');
  assert.equal(ranked[0].direction, 'W');
});

test('rankRoundTripCandidates: bad feedback corridor lowers route rank', () => {
  const good = {
    ...candidate(40, 500, 'good'),
    route: {
      distanceM: 40000,
      ascendM: 500,
      coords: [[49, 9], [49.001, 9], [49.002, 9]],
    },
  };
  const bad = {
    ...candidate(40, 500, 'bad'),
    route: {
      distanceM: 40000,
      ascendM: 500,
      coords: [[49, 9.01], [49.001, 9.01], [49.002, 9.01]],
    },
  };
  const referenceModel = {
    schema: 'graveldeluxe-reference-model/v1',
    goodCells: { '49.000,9.000': 2, '49.001,9.000': 2, '49.002,9.000': 2 },
    badCells: { '49.000,9.010': 1, '49.001,9.010': 1, '49.002,9.010': 1 },
  };
  const ranked = rankRoundTripCandidates(
    [bad, good],
    {
      minKm: 30, maxKm: 50, minHm: 200, maxHm: 800,
      direction: 'any', start: [49, 9], referenceModel,
    },
  );
  assert.equal(ranked[0].id, 'good');
  assert.ok(ranked[0].reference.goodAffinity > 0);
  assert.ok(ranked[1].reference.badCoverage > 0);
});
