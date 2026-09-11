// ORS 9.7: https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/extra-info/surface
// Alte IDs bleiben für gespeicherte Routen verständlich.
export const SURFACES = Object.freeze({
  0: ['Unbekannt', '#94a3b8'], 1: ['Befestigt', '#64748b'],
  2: ['Unbefestigt', '#d97706'], 3: ['Asphalt', '#475569'],
  4: ['Beton', '#78716c'], 5: ['Kopfsteinpflaster (alt)', '#71717a'],
  6: ['Metall', '#64748b'], 7: ['Holz', '#a16207'],
  8: ['Verdichteter Schotter', '#ca8a04'], 9: ['Feinschotter (alt)', '#ea580c'],
  10: ['Schotter', '#ea580c'], 11: ['Erde', '#92400e'],
  12: ['Naturboden/Matsch', '#78350f'], 13: ['Eis/Schnee', '#38bdf8'],
  14: ['Pflaster', '#71717a'], 15: ['Sand', '#eab308'],
  16: ['Holzhäcksel (alt)', '#a16207'], 17: ['Gras', '#15803d'],
  18: ['Rasengitter', '#16a34a'],
});

export function segmentValues(coords, segments = []) {
  const values = new Array(Math.max(0, (coords?.length ?? 0) - 1)).fill(0);
  for (const [from, to, value] of segments) {
    if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
    for (let index = Math.max(0, from); index < Math.min(to, values.length); index++) {
      values[index] = Number(value) || 0;
    }
  }
  return values;
}
