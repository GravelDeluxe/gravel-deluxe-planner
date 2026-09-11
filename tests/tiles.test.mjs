import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTileImage } from '../js/tiles.js';

class FakeImage {
  constructor() { this.listeners = new Map(); this.attributes = new Map(); this.naturalWidth = 0; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  removeEventListener(type) { this.listeners.delete(type); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  set src(value) { this.attributes.set('src', value); }
  emit(type) { this.listeners.get(type)?.(); }
}

test('tile loader retries a failed zoom tile and completes once after success', () => {
  const tile = new FakeImage();
  const scheduled = [];
  const completions = [];
  loadTileImage(tile, 'https://tiles/14/1/2.png', (error) => completions.push(error), {
    schedule: (callback) => { scheduled.push(callback); return callback; },
    cancel: () => {}, random: () => 0,
  });
  tile.emit('error');
  scheduled.at(-1)();
  tile.naturalWidth = 256;
  tile.emit('load');
  tile.emit('load');
  assert.deepEqual(completions, [null]);
});

test('tile loader reports failure only after its bounded attempts', () => {
  const tile = new FakeImage();
  const queue = [];
  const completions = [];
  loadTileImage(tile, 'https://tiles/14/1/2.png', (error) => completions.push(error), {
    maxAttempts: 2,
    schedule: (callback) => { queue.push(callback); return callback; },
    cancel: () => {}, random: () => 0,
  });
  tile.emit('error');
  queue.pop()();
  tile.emit('error');
  assert.equal(completions.length, 1);
  assert.match(completions[0].message, /nicht geladen/);
});
