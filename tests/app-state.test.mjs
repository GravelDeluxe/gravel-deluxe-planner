import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listRoutes } from '../js/storage.js';

// Führt die echten App-Ereignisse aus. DOM und Leaflet sind schlanke Adapter;
// diese Tests prüfen Zustandsübergänge, nicht das visuelle Browserlayout.
class Element {
  constructor(value = '') {
    this.value = value;
    this.listeners = new Map();
    this.classList = { remove() {}, toggle() {}, contains: () => false };
    this.innerHTML = '';
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  emit(type, event = {}) { return this.listeners.get(type)?.(event); }
}
class Layer {
  constructor() { this.listeners = new Map(); }
  addTo() { return this; }
  setView() { return this; }
  setLatLng() { return this; }
  setLatLngs() { return this; }
  bindTooltip() { return this; }
  on(type, callback) { this.listeners.set(type, callback); return this; }
  remove() {}
  hasLayer() { return false; }
  getPane() { return null; }
  getBounds() { return {}; }
  fitBounds() {}
}

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const elements = new Map([...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].map(([tag, id]) => {
  const element = new Element(tag.match(/\bvalue="([^"]*)"/)?.[1] ?? '');
  element.checked = /\bchecked\b/.test(tag);
  return [id, element];
}));
elements.get('routingProfile').value = 'gravel-konstant';
elements.get('loopDirection').value = 'any';
elements.get('firstClimbMode').value = 'off';
elements.get('feedbackEffect').value = 'penalty';
const modes = [new Element('loop'), new Element('manual')];
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
globalThis.document = {
  getElementById: (id) => { assert.ok(elements.has(id), `HTML enthält ${id}`); return elements.get(id); },
  querySelectorAll: () => modes,
};
globalThis.L = {
  map: () => new Layer(), tileLayer: () => new Layer(), polyline: () => new Layer(),
  circleMarker: () => new Layer(), marker: () => new Layer(), divIcon: () => ({}),
  control: { zoom: () => new Layer() }, DomEvent: { stopPropagation() {} },
};
globalThis.fetch = async () => ({ ok: false });
const { state, el, clearAll, loadImportedPlan } = await import('../js/app.js');
const route = () => ({
  coords: [[49, 9, 100], [49.001, 9, 120], [49.002, 9, 110]],
  distanceM: 222, ascendM: 20, profile: 'ors-gravel-deluxe',
  surfaceSegments: [[0, 1, 3], [1, 2, 17]],
  waytypeSegments: [],
});
function seedResult() {
  clearAll();
  state.mode = 'loop';
  state.waypoints = [[49, 9]];
  state.route = route();
  state.candidates = [{ route: state.route }];
  el('suggestions').innerHTML = 'Alte Vorschläge';
}

test('app state regressions', async (t) => {
  await t.test('profile selection is visible only for manual planning', async () => {
    assert.equal(el('manualProfileControls').hidden, true);
    await modes[1].emit('change');
    assert.equal(state.mode, 'manual');
    assert.equal(el('manualProfileControls').hidden, false);
    assert.equal(el('loopControls').hidden, true);
    await modes[0].emit('change');
    assert.equal(el('manualProfileControls').hidden, true);
  });

  await t.test('every loop setting invalidates obsolete routes and suggestions', async () => {
    for (const id of ['loopKmMin', 'loopKmMax', 'loopHmMin', 'loopHmMax', 'maxSlopePercent', 'loopDirection', 'firstClimbMode', 'allowMeadowEarth']) {
      seedResult();
      await el(id).emit(['loopDirection', 'firstClimbMode', 'allowMeadowEarth'].includes(id) ? 'change' : 'input');
      assert.equal(state.route, null, id);
      assert.deepEqual(state.candidates, [], id);
      assert.equal(el('suggestions').innerHTML, '', id);
      assert.match(el('status').textContent, /neue Vorschläge/);
    }
  });

  await t.test('loading restores the plan and surfaces and discards unrelated candidates', async () => {
    seedResult();
    state.highlights = [[49.1, 9.1]];
    el('routeName').value = 'Gespeicherte Runde';
    el('loopKmMin').value = 12;
    el('loopDirection').value = 'W';
    await el('saveButton').emit('click');
    const saved = listRoutes()[0];
    await modes[1].emit('change');
    el('loopKmMin').value = 80;
    el('loopDirection').value = 'S';
    state.candidates = [{ route: route() }];
    await el('savedRoutes').emit('click', {
      target: { closest: () => ({ dataset: { id: saved.id } }), classList: { contains: () => false } },
    });
    assert.equal(state.mode, 'loop');
    assert.equal(el('manualProfileControls').hidden, true);
    assert.equal(el('loopKmMin').value, 12);
    assert.equal(el('loopDirection').value, 'W');
    assert.deepEqual(state.route, route());
    assert.deepEqual(state.highlights, [[49.1, 9.1]]);
    assert.deepEqual(state.candidates, []);
  });

  await t.test('reverse action updates surfaces and ascent and removes old ranking', async () => {
    seedResult();
    await el('reverseButton').emit('click');
    assert.equal(state.route.ascendM, 10);
    assert.deepEqual(state.route.surfaceSegments, [[0, 1, 17], [1, 2, 3]]);
    assert.deepEqual(state.candidates, []);
    assert.equal(el('statAscent').textContent, '10 hm');
    assert.equal(el('routeReport').hidden, false);
    assert.match(el('routeReport').innerHTML, /Routenqualität/);
  });

  await t.test('removing a required highlight invalidates the displayed route', async () => {
    seedResult();
    state.highlights = [[49.1, 9.1]];
    await el('highlights').emit('click', {
      target: { closest: () => ({ dataset: { i: '0' } }) },
    });
    assert.deepEqual(state.highlights, []);
    assert.equal(state.route, null);
    assert.deepEqual(state.candidates, []);
  });

  await t.test('an imported loop becomes an editable planning state', () => {
    loadImportedPlan({
      name: 'Importierte Runde', mode: 'loop',
      waypoints: [[49, 9]], shapePoints: [[49.01, 9.01]],
      highlights: [{ coords: [49.02, 9.02], name: 'Burg' }],
      route: route(),
    });
    assert.equal(state.mode, 'loop');
    assert.deepEqual(state.waypoints, [[49, 9]]);
    assert.deepEqual(state.shapePoints, [[49.01, 9.01]]);
    assert.deepEqual(state.highlights, [[49.02, 9.02]]);
    assert.equal(el('routeName').value, 'Importierte Runde');
    assert.match(el('status').textContent, /1 Formpunkten und 1 Highlights/);
  });
});
