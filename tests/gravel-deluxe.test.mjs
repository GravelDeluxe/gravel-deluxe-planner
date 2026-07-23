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
