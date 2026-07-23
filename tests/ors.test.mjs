import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoundTripBody, parseRoundTrip, fetchRoundTrip } from '../js/ors.js';

const okGeojson = {
  features: [
    {
      geometry: { coordinates: [[8.6, 50.1, 120], [8.7, 50.2, 140], [8.6, 50.1, 120]] },
      properties: { summary: { distance: 41234.5 }, ascent: 512.3 },
    },
  ],
};

test('buildRoundTripBody: single [lon, lat] coordinate + round_trip options', () => {
  const body = buildRoundTripBody([50.1, 8.6], { lengthM: 40000, seed: 7, points: 5 });
  assert.deepEqual(body.coordinates, [[8.6, 50.1]]);
  assert.deepEqual(body.options.round_trip, { length: 40000, points: 5, seed: 7 });
  assert.equal(body.elevation, true);
  assert.equal(body.instructions, false);
});

test('buildRoundTripBody: rounds fractional length to whole meters', () => {
  const body = buildRoundTripBody([50, 8], { lengthM: 40000.7, seed: 1 });
  assert.equal(body.options.round_trip.length, 40001);
});

test('parseRoundTrip: coords swapped to [lat, lon], distance from summary', () => {
  const r = parseRoundTrip(okGeojson);
  assert.deepEqual([r.coords[0][0], r.coords[0][1]], [50.1, 8.6]);
  assert.equal(r.distanceM, 41234.5);
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
  assert.match(seen.url, /\/v2\/directions\/cycling-mountain\/geojson$/);
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.headers.Authorization, 'abc123');
  assert.match(seen.opts.headers['Content-Type'], /application\/json/);
  assert.equal(r.distanceM, 41234.5);
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
