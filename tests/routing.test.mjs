import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteUrl, parseRouteResponse, fetchRouteWithFallback } from '../js/routing.js';

const okGeojson = {
  features: [
    {
      geometry: { coordinates: [[8.6, 50.1, 120], [8.7, 50.2, 140]] },
      properties: { 'track-length': '4200', 'filtered ascend': '55' },
    },
  ],
};

test('buildRouteUrl: lon,lat pairs joined by |, gravel profile, geojson format', () => {
  const url = buildRouteUrl([[50.1, 8.6], [50.2, 8.7]]);
  assert.ok(
    url.startsWith('https://brouter.de/brouter?lonlats=8.600000,50.100000|8.700000,50.200000'),
    url,
  );
  assert.match(url, /profile=gravel/);
  assert.match(url, /alternativeidx=0/);
  assert.match(url, /format=geojson/);
});

test('buildRouteUrl: rejects fewer than two waypoints', () => {
  assert.throws(() => buildRouteUrl([[50.1, 8.6]]), /zwei Wegpunkte/);
});

test('parseRouteResponse: coords become [lat, lon, ele], stats numeric', () => {
  const r = parseRouteResponse(okGeojson);
  assert.deepEqual(r.coords, [[50.1, 8.6, 120], [50.2, 8.7, 140]]);
  assert.equal(r.distanceM, 4200);
  assert.equal(r.ascendM, 55);
});

test('parseRouteResponse: empty response throws', () => {
  assert.throws(() => parseRouteResponse({ features: [] }), /Keine Route/);
});

test('fetchRouteWithFallback: gravel success keeps profile gravel', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => okGeojson });
  const r = await fetchRouteWithFallback([[50.1, 8.6], [50.2, 8.7]], { fetchImpl });
  assert.equal(r.profile, 'gravel');
  assert.equal(r.distanceM, 4200);
});

test('fetchRouteWithFallback: retries trekking when profile missing', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('profile=gravel')) {
      return { ok: false, status: 400, text: async () => 'profile gravel not found' };
    }
    return { ok: true, json: async () => okGeojson };
  };
  const r = await fetchRouteWithFallback([[50.1, 8.6], [50.2, 8.7]], { fetchImpl });
  assert.equal(r.profile, 'trekking');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /profile=trekking/);
});

test('fetchRouteWithFallback: non-profile error is not swallowed', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, text: async () => 'rate limit' });
  await assert.rejects(
    fetchRouteWithFallback([[50.1, 8.6], [50.2, 8.7]], { fetchImpl }),
    /503/,
  );
});

test('fetchRouteWithFallback: propagates a rejected fetch (network error), no trekking retry', async () => {
  const fetchImpl = async () => { throw new Error('Failed to fetch'); };
  await assert.rejects(
    fetchRouteWithFallback([[50.1, 8.6], [50.2, 8.7]], { fetchImpl }),
    /Failed to fetch/,
  );
});
