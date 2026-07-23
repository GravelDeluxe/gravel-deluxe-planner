import { ORS_BASE, ORS_PROFILE, ORS_REQUIRES_KEY } from './config.js';
import { fillVoids, medianFilterElevations, elevationGain } from './elevation.js';
import { GRAVEL_DELUXE_CUSTOM_MODEL } from './gravel-deluxe.js';

// Body für den ORS-Directions-Aufruf mit round_trip. Start ist [lat, lon],
// ORS erwartet [lon, lat].
export function buildRoundTripBody(
  [lat, lon],
  { lengthM, seed, points = 5, customModel = GRAVEL_DELUXE_CUSTOM_MODEL },
) {
  return {
    coordinates: [[lon, lat]],
    options: { round_trip: { length: Math.round(lengthM), points, seed } },
    preference: 'recommended',
    custom_model: customModel,
    extra_info: ['surface'],
    elevation: true,
    instructions: false,
  };
}

export function buildWaypointRouteBody(
  waypoints,
  { customModel = GRAVEL_DELUXE_CUSTOM_MODEL } = {},
) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new Error('Mindestens zwei ORS-Wegpunkte erforderlich');
  }
  return {
    coordinates: waypoints.map(([lat, lon]) => [lon, lat]),
    preference: 'recommended',
    custom_model: customModel,
    extra_info: ['surface'],
    elevation: true,
    instructions: false,
  };
}

export function parseRoundTrip(geojson) {
  const feature = geojson?.features?.[0];
  if (!feature) throw new Error('Keine Runde gefunden');
  const raw = feature.geometry.coordinates.map(([lon, lat, ele]) => [lat, lon, ele ?? 0]);
  // ORS-SRTM-Höhen bereinigen: Voids füllen → Median gegen Spikes → Anstieg per
  // Hysterese. props.ascent ist die ungefilterte Rauschsumme und stark überhöht,
  // ein reines gleitendes Mittel verschmiert die 0-Voids nur, statt sie zu entfernen.
  const coords = medianFilterElevations(fillVoids(raw));
  const props = feature.properties ?? {};
  return {
    coords,
    distanceM: props.summary?.distance ?? 0,
    ascendM: Math.round(elevationGain(coords)),
    surfaceSegments: props.extras?.surface?.values ?? [],
  };
}

export async function fetchRoundTrip(
  start,
  {
    lengthM,
    seed,
    points,
    customModel = GRAVEL_DELUXE_CUSTOM_MODEL,
    key,
    requiresKey = ORS_REQUIRES_KEY,
    fetchImpl = fetch,
  } = {},
) {
  if (requiresKey && !key) throw new Error('ORS-API-Key fehlt (einmalig eingeben)');
  const url = `${ORS_BASE}/v2/directions/${ORS_PROFILE}/geojson`;
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = key;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildRoundTripBody(start, { lengthM, seed, points, customModel })),
  });
  if (!res.ok) {
    let reason = '';
    try {
      const j = await res.json();
      reason = j?.error?.message ?? (typeof j?.error === 'string' ? j.error : '');
    } catch {
      /* keine JSON-Fehlerantwort */
    }
    throw new Error(`ORS-Fehler (${res.status})${reason ? `: ${reason}` : ''}`);
  }
  return parseRoundTrip(await res.json());
}

// ORS kann bei nativen Rundtouren einen internen Zufallspunkt in einem Bereich
// ohne routbaren Graphen setzen. Ein anderer Seed bzw. weniger Formpunkte
// erzeugt dann meist sofort eine gültige Runde.
export async function fetchRoundTripWithRetry(
  start,
  options = {},
  {
    attempts = 4,
    initialSeed = Math.floor(Math.random() * 100000),
    fetchRoundTripImpl = fetchRoundTrip,
  } = {},
) {
  let lastError;
  const pointCounts = [3, 4, 5, 3];
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchRoundTripImpl(start, {
        ...options,
        seed: (initialSeed + attempt * 7919) % 100000,
        points: pointCounts[attempt % pointCounts.length],
      });
    } catch (error) {
      lastError = error;
      const retryable = /ORS-Fehler \(500\).*Could not find a valid point/i.test(error.message);
      if (!retryable) throw error;
    }
  }
  throw new Error(
    `${lastError?.message ?? 'ORS-Rundtour fehlgeschlagen'} (nach ${attempts} Varianten)`,
  );
}

export async function fetchRouteThroughWaypoints(
  waypoints,
  {
    customModel = GRAVEL_DELUXE_CUSTOM_MODEL,
    key,
    requiresKey = ORS_REQUIRES_KEY,
    fetchImpl = fetch,
  } = {},
) {
  if (requiresKey && !key) throw new Error('ORS-API-Key fehlt (einmalig eingeben)');
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = key;
  const res = await fetchImpl(`${ORS_BASE}/v2/directions/${ORS_PROFILE}/geojson`, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildWaypointRouteBody(waypoints, { customModel })),
  });
  if (!res.ok) {
    let reason = '';
    try {
      const body = await res.json();
      reason = body?.error?.message ?? '';
    } catch {
      /* keine JSON-Fehlerantwort */
    }
    throw new Error(`ORS-Fehler (${res.status})${reason ? `: ${reason}` : ''}`);
  }
  return parseRoundTrip(await res.json());
}
