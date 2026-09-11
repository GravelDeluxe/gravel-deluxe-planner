import fs from 'node:fs/promises';
import path from 'node:path';
import { parseGpx, routeFingerprint, analyzeTourStructure } from '../js/reference-analysis.js';
import { profilePoints } from '../js/elevation.js';
import { sampleLine, routeOverlap } from '../js/route-geometry.js';
import { parseRoundTrip } from '../js/ors.js';
import { GRAVEL_DELUXE_CUSTOM_MODEL } from '../js/gravel-deluxe.js';

const sourceDir = path.resolve('gpx-samples');
const matchesFile = path.resolve('data/reference-matches.json');
const outputFile = path.resolve('data/reference-enrichment.json');
const orsBase = process.env.ORS_MATCH_BASE || 'http://localhost:8080/ors';
const matches = JSON.parse(await fs.readFile(matchesFile, 'utf8'));
const names = (await fs.readdir(sourceDir))
  .filter((name) => name.toLowerCase().endsWith('.gpx'))
  .sort((a, b) => a.localeCompare(b, 'de'));
const fingerprints = new Set();
const routes = {};

for (const filename of names) {
  const parsed = parseGpx(await fs.readFile(path.join(sourceDir, filename), 'utf8'), filename);
  const fingerprint = routeFingerprint(parsed.coords);
  if (fingerprints.has(fingerprint)) continue;
  fingerprints.add(fingerprint);
  if (!(matches.routes?.[filename]?.length > 0)) {
    routes[filename] = { accepted: false, reason: 'außerhalb des ORS-Graphs' };
    continue;
  }
  const distanceM = profilePoints(parsed.coords).at(-1)?.d ?? 0;
  const sampled = sampleLine(parsed.coords, Math.max(750, distanceM / 45));
  const waypoints = sampled.slice(0, 49).map(({ point }) => [point[1], point[0]]);
  if (waypoints.at(-1)?.[0] !== parsed.coords.at(-1)[1]
    || waypoints.at(-1)?.[1] !== parsed.coords.at(-1)[0]) {
    waypoints.push([parsed.coords.at(-1)[1], parsed.coords.at(-1)[0]]);
  }
  const response = await fetch(`${orsBase}/v2/directions/gravel-deluxe/geojson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: waypoints,
      preference: 'recommended',
      custom_model: GRAVEL_DELUXE_CUSTOM_MODEL,
      extra_info: ['surface', 'waytype'],
      elevation: true,
      instructions: false,
    }),
  });
  if (!response.ok) {
    routes[filename] = { accepted: false, reason: `ORS ${response.status}` };
    continue;
  }
  const route = parseRoundTrip(await response.json());
  const overlap = routeOverlap(parsed.coords, route.coords);
  const accepted = overlap >= 0.7;
  routes[filename] = {
    accepted,
    overlap,
    waypointCount: waypoints.length,
    ...(accepted ? { structure: analyzeTourStructure(route) } : { reason: 'zu geringe Trackübereinstimmung' }),
  };
  console.log(`${filename}: ${(overlap * 100).toFixed(0)} % Tracktreue${accepted ? '' : ' (verworfen)'}`);
}

await fs.writeFile(outputFile, `${JSON.stringify({
  schema: 'graveldeluxe-reference-enrichment/v1',
  graphTimestamp: matches.graphTimestamp,
  routes,
}, null, 2)}\n`);
console.log(`Ausgabe: ${path.relative(process.cwd(), outputFile)}`);
