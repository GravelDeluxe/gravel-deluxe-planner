import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, toGpx } from '../js/gpx.js';

test('escapeXml escapes &, <, >, "', () => {
  assert.equal(escapeXml('a & <b> "c"'), 'a &amp; &lt;b&gt; &quot;c&quot;');
});

test('toGpx: valid GPX 1.1 skeleton with trackpoints and elevation', () => {
  const gpx = toGpx('Wald & Wiese', [[50.1, 8.6, 120.34], [50.2, 8.7, 140]]);
  assert.match(gpx, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(gpx, /<gpx version="1.1" creator="Gravel Planner" xmlns="http:\/\/www\.topografix\.com\/GPX\/1\/1">/);
  assert.match(gpx, /<name>Wald &amp; Wiese<\/name>/);
  assert.match(gpx, /<trkpt lat="50.100000" lon="8.600000"><ele>120.3<\/ele><\/trkpt>/);
  assert.match(gpx, /<trkpt lat="50.200000" lon="8.700000"><ele>140.0<\/ele><\/trkpt>/);
  assert.match(gpx, /<\/trkseg>\s*<\/trk>\s*<\/gpx>/);
});

test('toGpx: missing elevation defaults to 0.0', () => {
  const gpx = toGpx('x', [[50.1, 8.6]]);
  assert.match(gpx, /<ele>0.0<\/ele>/);
});
