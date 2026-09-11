import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGravelDeluxeCustomModel } from '../js/gravel-deluxe.js';

test('GravelDeluxe model only uses encoded values available in the ORS profile', () => {
  const model = buildGravelDeluxeCustomModel();
  assert.equal(model.priority.some((rule) => rule.if.includes?.('average_slope')), false);
  assert.equal(model.priority.some((rule) => rule.if.includes?.('surface')), false);
});

test('route constraints do not introduce unsupported custom-model expressions', () => {
  const model = buildGravelDeluxeCustomModel({
    allowMeadowEarth: false,
    maxSlopePercent: 8,
  });
  assert.deepEqual(model, buildGravelDeluxeCustomModel());
});

test('GravelDeluxe penalties keep the routable graph connected', () => {
  const model = buildGravelDeluxeCustomModel();
  assert.equal(model.priority.find((rule) => rule.if === 'get_off_bike').multiply_by, 0.01);
  assert.equal(model.priority.find((rule) => rule.if === 'road_class == STEPS').multiply_by, 0.01);
});
