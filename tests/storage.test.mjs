import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listRoutes, saveRoute, deleteRoute } from '../js/storage.js';

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
