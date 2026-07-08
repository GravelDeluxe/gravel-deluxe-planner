import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profilePoints, svgPath } from '../js/elevation.js';

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
