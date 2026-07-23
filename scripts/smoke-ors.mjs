import { readFile, writeFile } from 'node:fs/promises';

const [
  endpoint = 'http://localhost:8086/ors/v2/directions/gravel-deluxe/geojson',
  fixturePath = 'tests/fixtures/ors-gravel-deluxe-request.json',
  outputPath = '/tmp/gravel-router-ors-smoke.json',
] = process.argv.slice(2);

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const attempts = [
  [42, 3],
  [7961, 4],
  [15880, 5],
  [23799, 3],
  [31718, 4],
  [39637, 5],
  [47556, 3],
  [55475, 4],
];

let lastFailure = '';
for (const [seed, points] of attempts) {
  const body = structuredClone(fixture);
  body.options.round_trip.seed = seed;
  body.options.round_trip.points = points;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = null;
  }

  if (response.ok && payload?.features?.length) {
    await writeFile(outputPath, `${JSON.stringify(payload)}\n`);
    console.log(`ORS-Runde erfolgreich (Seed ${seed}, ${points} Formpunkte).`);
    process.exit(0);
  }

  const reason = payload?.error?.message ?? responseText;
  lastFailure = `HTTP ${response.status}: ${reason}`;
  const retryable = response.status === 500
    && /Could not find a valid point/i.test(reason);
  if (!retryable) {
    console.error(`ORS-Smoke-Test fehlgeschlagen: ${lastFailure}`);
    process.exit(1);
  }
  console.warn(`ORS-Rundpunkt nicht routbar; neuer Versuch (Seed ${seed}).`);
}

// Gleicher deterministischer Fallback wie in der App: geschlossene Via-Route
// statt ORS-intern zufällig erzeugter Rundpunkte.
const [startLon, startLat] = fixture.coordinates[0];
const radiusKm = fixture.options.round_trip.length / 1000 / (2 * Math.PI);
const earthRadiusKm = 6371;
const destination = (lat, lon, distanceKm, bearingDeg) => {
  const radians = (degrees) => degrees * Math.PI / 180;
  const degrees = (value) => value * 180 / Math.PI;
  const delta = distanceKm / earthRadiusKm;
  const theta = radians(bearingDeg);
  const phi1 = radians(lat);
  const lambda1 = radians(lon);
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta)
      + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
  );
  return [degrees(lambda2), degrees(phi2)];
};

for (const offset of [0, 60, 120]) {
  const body = structuredClone(fixture);
  delete body.options;
  body.coordinates = [
    [startLon, startLat],
    ...Array.from({ length: 3 }, (_, index) =>
      destination(startLat, startLon, radiusKm, offset + index * 120)),
    [startLon, startLat],
  ];
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = null;
  }
  if (response.ok && payload?.features?.length) {
    await writeFile(outputPath, `${JSON.stringify(payload)}\n`);
    console.log(`ORS-Runde über deterministische Via-Punkte erfolgreich (Ausrichtung ${offset}°).`);
    process.exit(0);
  }
  lastFailure = `HTTP ${response.status}: ${payload?.error?.message ?? responseText}`;
  console.warn(`ORS-Via-Runde mit Ausrichtung ${offset}° fehlgeschlagen.`);
}

console.error(`ORS-Smoke-Test fehlgeschlagen: ${lastFailure}`);
process.exit(1);
