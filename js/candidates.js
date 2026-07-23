export function inRange(value, min, max) {
  return value >= min && value <= max;
}

function relativeDeviation(value, min, max) {
  if (inRange(value, min, max)) return 0;
  const span = Math.max(max - min, max * 0.25, 1);
  return value < min ? (min - value) / span : (value - max) / span;
}

export function rankRoundTripCandidates(
  candidates,
  { minKm, maxKm, minHm, maxHm, limit = 3 },
) {
  const kmMid = (minKm + maxKm) / 2;
  const hmMid = (minHm + maxHm) / 2;
  return candidates
    .map((candidate) => {
      const distKm = candidate.route.distanceM / 1000;
      const ascendM = candidate.route.ascendM;
      const distanceInRange = inRange(distKm, minKm, maxKm);
      const ascentInRange = inRange(ascendM, minHm, maxHm);
      const score =
        relativeDeviation(distKm, minKm, maxKm) * 2
        + relativeDeviation(ascendM, minHm, maxHm)
        + Math.abs(distKm - kmMid) / Math.max(maxKm - minKm, 1) * 0.01
        + Math.abs(ascendM - hmMid) / Math.max(maxHm - minHm, 100) * 0.005;
      return {
        ...candidate,
        distKm,
        distanceInRange,
        ascentInRange,
        inRange: distanceInRange && ascentInRange,
        score,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}
