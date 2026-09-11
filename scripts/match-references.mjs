import fs from 'node:fs/promises';
import path from 'node:path';
import { parseGpx, routeFingerprint } from '../js/reference-analysis.js';

const sourceDir = path.resolve('gpx-samples');
const outputFile = path.resolve('data/reference-matches.json');
const orsBase = process.env.ORS_MATCH_BASE || 'http://localhost:8080/ors';
const names = (await fs.readdir(sourceDir))
  .filter((name) => name.toLowerCase().endsWith('.gpx'))
  .sort((a, b) => a.localeCompare(b, 'de'));
const routes = {};
const fingerprints = new Set();
let graphTimestamp = null;

for (const filename of names) {
  const parsed = parseGpx(await fs.readFile(path.join(sourceDir, filename), 'utf8'), filename);
  const fingerprint = routeFingerprint(parsed.coords);
  if (fingerprints.has(fingerprint)) continue;
  fingerprints.add(fingerprint);
  const response = await fetch(`${orsBase}/v2/match/gravel-deluxe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      features: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: parsed.coords.map(([lat, lon]) => [lon, lat]),
          },
        }],
      },
    }),
  });
  if (!response.ok) throw new Error(`Matching fehlgeschlagen für ${filename}: HTTP ${response.status}`);
  const body = await response.json();
  if (graphTimestamp && graphTimestamp !== body.graph_timestamp) {
    throw new Error('ORS-Graph wurde während des Referenzmatchings gewechselt.');
  }
  graphTimestamp = body.graph_timestamp;
  routes[filename] = body.edge_ids?.[0] ?? [];
  console.log(`${filename}: ${routes[filename].length} Graphkanten`);
}

await fs.writeFile(outputFile, `${JSON.stringify({
  schema: 'graveldeluxe-reference-matches/v1',
  profile: 'gravel-deluxe',
  graphTimestamp,
  routes,
}, null, 2)}\n`);
console.log(`Ausgabe: ${path.relative(process.cwd(), outputFile)}`);
