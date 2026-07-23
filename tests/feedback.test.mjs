import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  routeIndexFromProgress,
  distanceToIndex,
  buildBadPassage,
  buildFeedbackPayload,
  feedbackFilename,
} from '../js/feedback.js';

const coords = [
  [49, 9, 100],
  [49.001, 9, 110],
  [49.002, 9, 120],
  [49.003, 9, 115],
];

test('routeIndexFromProgress: maps scrubber boundaries and midpoint', () => {
  assert.equal(routeIndexFromProgress(0, 4), 0);
  assert.equal(routeIndexFromProgress(500, 5), 2);
  assert.equal(routeIndexFromProgress(1000, 4), 3);
  assert.equal(routeIndexFromProgress(2000, 4), 3);
});

test('distanceToIndex: calculates distance along route, not direct shortcut', () => {
  assert.equal(distanceToIndex(coords, 0), 0);
  assert.ok(distanceToIndex(coords, 2) > 200);
});

test('buildBadPassage: normalizes reversed IN/OUT and keeps exact section', () => {
  const passage = buildBadPassage(
    coords,
    3,
    1,
    { problem: 'unnötiger Abstecher', note: 'zum Fluss und zurück' },
  );
  assert.equal(passage.startIndex, 1);
  assert.equal(passage.endIndex, 3);
  assert.deepEqual(passage.coords, coords.slice(1, 4));
  assert.equal(passage.problem, 'unnötiger Abstecher');
  assert.equal(passage.note, 'zum Fluss und zurück');
});

test('buildBadPassage: requires two distinct marks', () => {
  assert.throws(() => buildBadPassage(coords, null, 2), /IN- und OUT/);
  assert.throws(() => buildBadPassage(coords, 2, 2), /verschieden/);
});

test('buildFeedbackPayload: includes full route and marked passages', () => {
  const passage = buildBadPassage(coords, 1, 2, { problem: 'Oberfläche' });
  const payload = buildFeedbackPayload(
    {
      coords,
      profile: 'ors-gravel-deluxe',
      distanceM: 500,
      ascendM: 20,
      surfaceSegments: [[0, 2, 10]],
    },
    [passage],
    { routeName: 'Test-Runde' },
  );
  assert.equal(payload.schema, 'graveldeluxe-route-feedback/v1');
  assert.deepEqual(payload.route.coords, coords);
  assert.equal(payload.route.profile, 'ors-gravel-deluxe');
  assert.equal(payload.passages.length, 1);
  assert.equal(payload.metadata.routeName, 'Test-Runde');
  assert.deepEqual(payload.route.surfaceSegments, [[0, 2, 10]]);
});

test('buildBadPassage: preserves shortcut and zig-zag problem categories', () => {
  assert.equal(
    buildBadPassage(coords, 0, 2, { problem: 'unnötige Abkürzung' }).problem,
    'unnötige Abkürzung',
  );
  assert.equal(
    buildBadPassage(coords, 1, 3, { problem: 'zu viel Zig-Zag' }).problem,
    'zu viel Zig-Zag',
  );
});

test('feedbackFilename: includes a unique local timestamp and safe route name', () => {
  const filename = feedbackFilename(
    'Nord / Runde',
    new Date(2026, 6, 23, 21, 7, 9),
  );
  assert.equal(filename, '20260723-210709__Nord-Runde__feedback.json');
});
