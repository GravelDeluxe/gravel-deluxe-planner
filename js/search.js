import { NOMINATIM_BASE } from './config.js';

export function buildSearchUrl(query) {
  return `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=5`;
}

export function parseSearchResponse(json) {
  return (json ?? []).map((r) => ({
    name: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}

export async function searchPlace(query, fetchImpl = fetch) {
  const res = await fetchImpl(buildSearchUrl(query));
  if (!res.ok) throw new Error(`Suche fehlgeschlagen (${res.status})`);
  return parseSearchResponse(await res.json());
}
