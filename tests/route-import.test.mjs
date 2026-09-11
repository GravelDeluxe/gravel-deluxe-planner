import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImportedFile, reconstructImportedPlan } from '../js/route-import.js';

test('GPX import reconstructs a closed editable plan and preserves waypoints', () => {
  const plan = parseImportedFile(`
    <gpx><trk><name>Meine Runde</name><trkseg>
      <trkpt lat="49" lon="9"><ele>100</ele></trkpt>
      <trkpt lat="49.01" lon="9"><ele>130</ele></trkpt>
      <trkpt lat="49.01" lon="9.01"><ele>120</ele></trkpt>
      <trkpt lat="49" lon="9.01"><ele>110</ele></trkpt>
      <trkpt lat="49" lon="9"><ele>100</ele></trkpt>
    </trkseg></trk>
    <wpt lat="49.01" lon="9.01"><name>Aussicht</name></wpt></gpx>
  `, 'runde.gpx');
  assert.equal(plan.name, 'Meine Runde');
  assert.equal(plan.mode, 'loop');
  assert.equal(plan.waypoints.length, 1);
  assert.ok(plan.shapePoints.length >= 3);
  assert.deepEqual(plan.highlights, [{ coords: [49.01, 9.01], name: 'Aussicht' }]);
  assert.equal(plan.route.profile, 'gpx-import');
  assert.equal(plan.route.elevationAvailable, true);
  assert.ok(plan.route.distanceM > 3000);
  assert.ok(plan.route.ascendM > 0);
});

test('open GPX becomes a manual plan with reconstructed support points', () => {
  const plan = reconstructImportedPlan({
    name: 'Linie', elevationAvailable: false,
    coords: [[49, 9], [49.01, 9], [49.02, 9], [49.03, 9], [49.04, 9]],
  });
  assert.equal(plan.mode, 'manual');
  assert.ok(plan.waypoints.length > 2);
  assert.deepEqual(plan.waypoints[0], [49, 9]);
  assert.deepEqual(plan.waypoints.at(-1), [49.04, 9]);
  assert.equal(plan.route.ascendM, 0);
  assert.equal(plan.route.elevationAvailable, false);
});

test('feedback JSON can be loaded as an editable route', () => {
  const plan = parseImportedFile(JSON.stringify({
    schema: 'graveldeluxe-route-feedback/v1',
    route: { name: 'Feedbackrunde', coords: [[49, 9, 100], [49.01, 9, 110], [49, 9, 100]] },
    context: { highlights: [[49.01, 9]] },
  }), 'feedback.json');
  assert.equal(plan.name, 'Feedbackrunde');
  assert.equal(plan.mode, 'loop');
  assert.deepEqual(plan.highlights[0].coords, [49.01, 9]);
});

test('unknown JSON and tracks with too few points are rejected', () => {
  assert.throws(() => parseImportedFile('{}', 'x.json'), /Unbekanntes JSON-Format/);
  assert.throws(() => parseImportedFile('<gpx/>', 'x.gpx'), /zu wenige Trackpunkte/);
});
