// ORS-Custom-Model für Rundkurse. Das cycling-mountain-Basismodell bleibt
// erhalten ("recommended"); diese Regeln schärfen nur die GravelDeluxe-Ziele.
export const GRAVEL_DELUXE_CUSTOM_MODEL = Object.freeze({
  distance_influence: 70,
  priority: Object.freeze([
    { if: 'get_off_bike', multiply_by: 0 },
    { if: 'road_class == STEPS', multiply_by: 0 },
    { if: 'road_class == PRIMARY', multiply_by: 0.2 },
    { if: 'road_class == SECONDARY', multiply_by: 0.45 },
    { if: 'road_class == TERTIARY', multiply_by: 0.75 },
    // Der dedizierte Radweg behält Faktor 1 und gewinnt damit bei einer
    // gleichwertigen parallelen Führung knapp gegen einen TRACK.
    { if: 'road_class == TRACK', multiply_by: 0.92 },
    { if: 'smoothness == VERY_BAD', multiply_by: 0.55 },
    { if: 'smoothness == HORRIBLE', multiply_by: 0.25 },
    { if: 'smoothness == VERY_HORRIBLE', multiply_by: 0.05 },
    { if: 'smoothness == IMPASSABLE', multiply_by: 0 },
  ]),
});
