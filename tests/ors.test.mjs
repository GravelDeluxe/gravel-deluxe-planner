import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoundTripBody,
  buildWaypointRouteBody,
  parseRoundTrip,
  fetchRoundTrip,
  fetchRoundTripWithRetry,
  fetchRouteThroughWaypoints,
} from '../js/ors.js';

const okGeojson = {
  features: [
    {
      geometry: { coordinates: [[8.6, 50.1, 120], [8.7, 50.2, 140], [8.6, 50.1, 120]] },
      properties: {
        summary: { distance: 41234.5 },
        ascent: 512.3,
        extras: { surface: { values: [[0, 1, 12], [1, 2, 1]] } },
      },
    },
  ],
};

test('buildRoundTripBody: single [lon, lat] coordinate + round_trip options', () => {
  const body = buildRoundTripBody([50.1, 8.6], { lengthM: 40000, seed: 7, points: 5 });
  assert.deepEqual(body.coordinates, [[8.6, 50.1]]);
  assert.deepEqual(body.options.round_trip, { length: 40000, points: 5, seed: 7 });
  assert.equal(body.preference, 'recommended');
  assert.ok(body.custom_model.priority.length > 0);
  assert.ok(
    body.custom_model.priority.some(
      (rule) => rule.if === 'road_class == TRACK' && rule.multiply_by < 1,
    ),
  );
  assert.equal(body.elevation, true);
  assert.equal(body.instructions, false);
  assert.deepEqual(body.extra_info, ['surface']);
});

test('buildRoundTripBody: rounds fractional length to whole meters', () => {
  const body = buildRoundTripBody([50, 8], { lengthM: 40000.7, seed: 1 });
  assert.equal(body.options.round_trip.length, 40001);
});

test('buildWaypointRouteBody: converts highlights from lat/lon to ORS lon/lat', () => {
  const body = buildWaypointRouteBody(
    [[49.1, 9.1], [49.2, 9.2], [49.1, 9.1]],
    { customModel: { distance_influence: 50 } },
  );
  assert.deepEqual(body.coordinates, [[9.1, 49.1], [9.2, 49.2], [9.1, 49.1]]);
  assert.equal(body.preference, 'recommended');
  assert.equal(body.custom_model.distance_influence, 50);
  assert.deepEqual(body.extra_info, ['surface']);
});

test('parseRoundTrip: coords swapped to [lat, lon], distance from summary', () => {
  const r = parseRoundTrip(okGeojson);
  assert.deepEqual([r.coords[0][0], r.coords[0][1]], [50.1, 8.6]);
  assert.equal(r.distanceM, 41234.5);
  assert.deepEqual(r.surfaceSegments, [[0, 1, 12], [1, 2, 1]]);
});

test('parseRoundTrip: ascent computed from smoothed coords, not the noisy props.ascent', () => {
  const coords = [];
  for (let i = 0; i < 21; i++) coords.push([8 + i * 0.001, 50, i === 10 ? 500 : 100]);
  const r = parseRoundTrip({ features: [{ geometry: { coordinates: coords }, properties: { summary: { distance: 1000 }, ascent: 400 } }] });
  assert.notEqual(r.ascendM, 400); // raw props.ascent (the 400 m spike) is ignored
  assert.ok(r.ascendM < 150, `smoothed ascent too high: ${r.ascendM}`);
});

test('parseRoundTrip: empty response throws', () => {
  assert.throws(() => parseRoundTrip({ features: [] }), /Keine Runde/);
});

test('fetchRoundTrip: POSTs to profile endpoint with Authorization header', async () => {
  let seen;
  const fetchImpl = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, json: async () => okGeojson };
  };
  const r = await fetchRoundTrip([50.1, 8.6], { lengthM: 40000, seed: 3, key: 'abc123', fetchImpl });
  assert.match(seen.url, /\/v2\/directions\/gravel-deluxe\/geojson$/);
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.headers.Authorization, 'abc123');
  assert.match(seen.opts.headers['Content-Type'], /application\/json/);
  assert.equal(r.distanceM, 41234.5);
});

test('fetchRoundTrip: allows overriding the custom model for diagnostics', async () => {
  let body;
  const fetchImpl = async (_url, opts) => {
    body = JSON.parse(opts.body);
    return { ok: true, json: async () => okGeojson };
  };
  const customModel = { distance_influence: 42 };
  await fetchRoundTrip(
    [50.1, 8.6],
    { lengthM: 40000, seed: 3, customModel, requiresKey: false, fetchImpl },
  );
  assert.deepEqual(body.custom_model, customModel);
});

test('fetchRoundTrip: missing key throws before any request', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => okGeojson }; };
  await assert.rejects(fetchRoundTrip([50, 8], { lengthM: 40000, key: '', fetchImpl }), /API-Key fehlt/);
  assert.equal(called, false);
});

test('fetchRoundTrip: self-hosted ORS works without Authorization header', async () => {
  let seen;
  const fetchImpl = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, json: async () => okGeojson };
  };
  const r = await fetchRoundTrip(
    [50.1, 8.6],
    { lengthM: 40000, seed: 3, requiresKey: false, fetchImpl },
  );
  assert.equal(seen.opts.headers.Authorization, undefined);
  assert.equal(r.distanceM, 41234.5);
});

test('fetchRoundTrip: error status surfaces German message with ORS reason', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: { message: 'Could not find routable point' } }),
  });
  await assert.rejects(
    fetchRoundTrip([50, 8], { lengthM: 40000, key: 'k', fetchImpl }),
    /ORS-Fehler \(404\): Could not find routable point/,
  );
});

test('fetchRoundTripWithRetry: changes seed and point count after invalid generated point', async () => {
  const calls = [];
  const fetchRoundTripImpl = async (_start, options) => {
    calls.push({ seed: options.seed, points: options.points });
    if (calls.length < 3) {
      throw new Error(
        'ORS-Fehler (500): Could not find a valid point after 3 tries, for the point:49,9,200',
      );
    }
    return { distanceM: 40000 };
  };
  const result = await fetchRoundTripWithRetry(
    [49, 9],
    { lengthM: 40000 },
    { initialSeed: 100, fetchRoundTripImpl },
  );
  assert.equal(result.distanceM, 40000);
  assert.deepEqual(calls, [
    { seed: 100, points: 3 },
    { seed: 8019, points: 4 },
    { seed: 15938, points: 5 },
  ]);
});

test('fetchRoundTripWithRetry: does not hide non-retryable ORS errors', async () => {
  const fetchRoundTripImpl = async () => {
    throw new Error('ORS-Fehler (500): Cannot compile expression');
  };
  await assert.rejects(
    fetchRoundTripWithRetry(
      [49, 9],
      { lengthM: 40000 },
      { fetchRoundTripImpl },
    ),
    /Cannot compile expression/,
  );
});

test('fetchRouteThroughWaypoints: sends a normal directions request', async () => {
  let body;
  const fetchImpl = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => okGeojson };
  };
  await fetchRouteThroughWaypoints(
    [[49.1, 9.1], [49.2, 9.2], [49.1, 9.1]],
    { requiresKey: false, fetchImpl },
  );
  assert.equal(body.options, undefined);
  assert.equal(body.coordinates.length, 3);
});
