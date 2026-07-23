import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRouteFlow } from '../js/route-flow.js';

test('route flow strongly penalizes a ridden-out-and-back section', () => {
  const flowing = evaluateRouteFlow([
    [49, 9],
    [49.002, 9],
    [49.002, 9.003],
    [49, 9.003],
    [49, 9],
  ]);
  const outAndBack = evaluateRouteFlow([
    [49, 9],
    [49.002, 9],
    [49.004, 9],
    [49.002, 9],
    [49, 9],
  ]);
  assert.ok(outAndBack.reversals > 0);
  assert.ok(outAndBack.repeatedShare > 0);
  assert.ok(outAndBack.adjustment > flowing.adjustment);
});

test('route flow ignores short routes without enough geometry', () => {
  assert.deepEqual(evaluateRouteFlow([[49, 9]]), {
    sharpTurns: 0,
    reversals: 0,
    repeatedShare: 0,
    adjustment: 0,
  });
});
