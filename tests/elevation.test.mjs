import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  profilePoints,
  svgPath,
  smoothElevations,
  ascentM,
  fillVoids,
  medianFilterElevations,
  elevationGain,
} from '../js/elevation.js';

test('profilePoints: cumulative distance grows, elevation carried over', () => {
  const pts = profilePoints([[50, 8, 100], [50.009, 8, 120], [50.018, 8, 90]]);
  assert.equal(pts.length, 3);
  assert.equal(pts[0].d, 0);
  assert.equal(pts[0].ele, 100);
  assert.ok(pts[1].d > 900 && pts[1].d < 1100, `d1 ${pts[1].d}`);
  assert.ok(pts[2].d > pts[1].d);
  assert.equal(pts[2].ele, 90);
});

test('svgPath: starts with M, ends within canvas, min ele at bottom', () => {
  const path = svgPath(
    [{ d: 0, ele: 100 }, { d: 500, ele: 200 }, { d: 1000, ele: 100 }],
    400,
    80,
  );
  assert.match(path, /^M2\.0,78\.0 /); // first point: min elevation -> bottom
  assert.match(path, / L200\.0,2\.0 /); // middle: max elevation -> top
  assert.match(path, /L398\.0,78\.0$/); // last: back to bottom right
});

test('svgPath: fewer than two points gives empty string', () => {
  assert.equal(svgPath([], 400, 80), '');
  assert.equal(svgPath([{ d: 0, ele: 1 }], 400, 80), '');
});

test('ascentM: sums only positive elevation deltas', () => {
  assert.equal(ascentM([[0, 0, 100], [0, 0, 130], [0, 0, 110], [0, 0, 150]]), 70);
});

test('smoothElevations: keeps lat/lon, averages out an isolated spike', () => {
  // Flat 100 m with one 400 m spike — raw ascent 300, smoothed must be far less.
  const coords = [];
  for (let i = 0; i < 21; i++) coords.push([50 + i * 0.001, 8, i === 10 ? 400 : 100]);
  const sm = smoothElevations(coords, 5);
  assert.equal(sm.length, coords.length);
  assert.deepEqual([sm[0][0], sm[0][1]], [50, 8]); // lat/lon untouched
  assert.ok(ascentM(coords) >= 300, `raw ${ascentM(coords)}`);
  assert.ok(ascentM(sm) < 120, `smoothed still spiky: ${ascentM(sm)}`);
});

test('smoothElevations: constant elevation stays constant (no phantom gain)', () => {
  const coords = Array.from({ length: 30 }, (_, i) => [50 + i * 0.001, 8, 200]);
  assert.equal(ascentM(smoothElevations(coords, 8)), 0);
});

test('fillVoids: replaces 0/void with previous valid elevation, keeps lat/lon', () => {
  const out = fillVoids([[50, 8, 200], [50.001, 8, 0], [50.002, 8, 210]]);
  assert.equal(out[1][2], 200);
  assert.deepEqual([out[1][0], out[1][1]], [50.001, 8]);
});

test('fillVoids: leading voids are back-filled from first valid value', () => {
  const out = fillVoids([[50, 8, 0], [50, 8, 0], [50, 8, 300]]);
  assert.equal(out[0][2], 300);
  assert.equal(out[1][2], 300);
});

test('medianFilterElevations: removes an isolated spike (not smears it)', () => {
  const coords = Array.from({ length: 11 }, (_, i) => [50, 8, i === 5 ? 400 : 100]);
  const sm = medianFilterElevations(coords, 2);
  assert.equal(sm[5][2], 100);
});

test('elevationGain: counts a sustained climb, ignores sub-threshold noise', () => {
  // 100 m -> ~298 m over 100 points with ±0.8 m jitter; ~198 m of real gain.
  const coords = Array.from({ length: 100 }, (_, i) => [
    50 + i * 0.0005, 8, 100 + i * 2 + (i % 2 ? 0.8 : -0.8),
  ]);
  const g = elevationGain(coords);
  assert.ok(g > 180 && g < 215, `expected ~200, got ${g}`);
});

test('elevation pipeline: flat noisy SRTM with voids + spike -> near-zero gain', () => {
  // Flat 200 m terrain, ±1.5 m jitter, two 0-voids and one 500 m spike.
  const coords = [];
  for (let i = 0; i < 200; i++) {
    let e = 200 + (i % 2 ? 1.5 : -1.5);
    if (i === 50 || i === 120) e = 0; // SRTM voids
    if (i === 80) e = 500; // spike
    coords.push([50 + i * 0.0005, 8, e]);
  }
  const clean = medianFilterElevations(fillVoids(coords));
  assert.ok(ascentM(coords) > 500, `raw noise should be huge, got ${ascentM(coords)}`);
  assert.ok(elevationGain(clean) < 20, `flat terrain ~0 expected, got ${elevationGain(clean)}`);
});
