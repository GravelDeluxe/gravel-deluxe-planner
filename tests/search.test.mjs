import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchUrl, parseSearchResponse, searchPlace } from '../js/search.js';

test('buildSearchUrl: encodes query, json format, limit 5', () => {
  const url = buildSearchUrl('Bad Homburg vor der Höhe');
  assert.ok(url.startsWith('https://nominatim.openstreetmap.org/search?q=Bad%20Homburg'), url);
  assert.match(url, /format=json/);
  assert.match(url, /limit=5/);
});

test('parseSearchResponse: maps display_name and numeric coords', () => {
  const results = parseSearchResponse([
    { display_name: 'Taunus, Hessen', lat: '50.22', lon: '8.45' },
  ]);
  assert.deepEqual(results, [{ name: 'Taunus, Hessen', lat: 50.22, lon: 8.45 }]);
});

test('searchPlace: throws German error on HTTP failure', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(searchPlace('x', fetchImpl), /Suche fehlgeschlagen \(429\)/);
});
