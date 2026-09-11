import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listRoutes, saveRoute, deleteRoute } from '../js/storage.js';
import { restoreSavedRoute } from '../js/route-state.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

test('listRoutes: empty storage returns []', () => {
  assert.deepEqual(listRoutes(memoryStorage()), []);
});

test('listRoutes: corrupt JSON returns []', () => {
  const s = memoryStorage();
  s.setItem('gravel-planner.routes', '{not json');
  assert.deepEqual(listRoutes(s), []);
});

test('saveRoute: persists entry with id and savedAt, listRoutes returns it', () => {
  const s = memoryStorage();
  const entry = saveRoute(
    { name: 'Feierabendrunde', waypoints: [[50, 8]], coords: [[50, 8, 100]], distanceM: 42000, ascendM: 300 },
    s,
  );
  assert.ok(entry.id);
  assert.ok(entry.savedAt);
  const routes = listRoutes(s);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].name, 'Feierabendrunde');
  assert.equal(routes[0].distanceM, 42000);
});

test('deleteRoute: removes only the matching id', () => {
  const s = memoryStorage();
  const a = saveRoute({ name: 'A' }, s);
  const b = saveRoute({ name: 'B' }, s);
  deleteRoute(a.id, s);
  const routes = listRoutes(s);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].id, b.id);
});

test('saved route round trip preserves profile, surfaces, mode and all planning settings', () => {
  const storage = memoryStorage();
  const original = {
    name: 'Südrunde', mode: 'loop', routingProfile: 'gravel-konstant',
    profile: 'ors-gravel-deluxe', waypoints: [[49, 9]], highlights: [[49.1, 9]],
    shapePoints: [[49.05, 9.02]], importedTrack: [[49, 9, 100], [49.1, 9, 120]],
    coords: [[49, 9, 100], [49.1, 9, 120]], surfaceSegments: [[0, 1, 3]],
    distanceM: 11000, ascendM: 20,
    settings: {
      minKm: 10, maxKm: 25, minHm: 0, maxHm: 500, direction: 'S',
      firstClimbMode: 'off', allowMeadowEarth: false, maxSlopePercent: 8,
    },
  };
  saveRoute(original, storage);
  const saved = listRoutes(storage)[0];
  assert.equal(saved.schema, 'graveldeluxe-saved-route/v2');
  const restored = restoreSavedRoute(saved);
  assert.equal(restored.mode, original.mode);
  assert.deepEqual(restored.settings, original.settings);
  assert.deepEqual(restored.highlights, original.highlights);
  assert.deepEqual(restored.shapePoints, original.shapePoints);
  assert.deepEqual(restored.importedTrack, original.importedTrack);
  assert.equal(restored.route.profile, original.profile);
  assert.deepEqual(restored.route.surfaceSegments, original.surfaceSegments);
});

test('listRoutes tolerates valid JSON that is not a route list', () => {
  const storage = memoryStorage();
  storage.setItem('gravel-planner.routes', '{}');
  assert.deepEqual(listRoutes(storage), []);
});
