import { ORS_BASE, ORS_PROFILE } from './config.js';
import { fillVoids, medianFilterElevations, elevationGain } from './elevation.js';

// Body für den ORS-Directions-Aufruf mit round_trip. Start ist [lat, lon],
// ORS erwartet [lon, lat].
export function buildRoundTripBody([lat, lon], { lengthM, seed, points = 5 }) {
  return {
    coordinates: [[lon, lat]],
    options: { round_trip: { length: Math.round(lengthM), points, seed } },
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
  };
}

export async function fetchRoundTrip(start, { lengthM, seed, points, key, fetchImpl = fetch } = {}) {
  if (!key) throw new Error('ORS-API-Key fehlt (einmalig eingeben)');
  const url = `${ORS_BASE}/v2/directions/${ORS_PROFILE}/geojson`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRoundTripBody(start, { lengthM, seed, points })),
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
