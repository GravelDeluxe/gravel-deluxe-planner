import {
  analyzeTourStructure,
  scoreRouteAgainstReferences,
  scoreTourStructure,
} from './reference-analysis.js';
import { evaluateRouteConstraints } from './route-constraints.js';
import { evaluateRouteFlow } from './route-flow.js';
import { analyzeRouteQuality, firstClimbAssessment } from './route-quality.js';
import { routeOverlap } from './route-geometry.js';

export function inRange(value, min, max) {
  return value >= min && value <= max;
}

export const DIRECTION_BEARINGS = Object.freeze({
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
});

function angularDistance(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// Richtung vom Start zum geometrischen Schwerpunkt der Route. Das ist für
// Rundkurse stabiler als Start-/Endpeilung, weil beide Punkte nahezu gleich sind.
export function routeDirection(coords, start) {
  if (!coords?.length || !start) return { bearing: null, cardinal: null };
  const usable = coords.slice(0, -1).length ? coords.slice(0, -1) : coords;
  const center = usable.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0],
  ).map((sum) => sum / usable.length);
  const lat1 = start[0] * Math.PI / 180;
  const lat2 = center[0] * Math.PI / 180;
  const dLon = (center[1] - start[1]) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const cardinals = Object.keys(DIRECTION_BEARINGS);
  const cardinal = cardinals.reduce(
    (best, value) =>
      angularDistance(bearing, DIRECTION_BEARINGS[value])
        < angularDistance(bearing, DIRECTION_BEARINGS[best]) ? value : best,
    'N',
  );
  return { bearing, cardinal };
}

function relativeDeviation(value, min, max) {
  if (inRange(value, min, max)) return 0;
  const span = Math.max(max - min, max * 0.25, 1);
  return value < min ? (min - value) / span : (value - max) / span;
}

export function rankRoundTripCandidates(
  candidates,
  {
    minKm,
    maxKm,
    minHm,
    maxHm,
    direction = 'any',
    start,
    referenceModel = null,
    allowMeadowEarth = true,
    maxSlopePercent = 10,
    firstClimbMode = 'off',
    limit = 3,
  },
) {
  const kmMid = (minKm + maxKm) / 2;
  const hmMid = (minHm + maxHm) / 2;
  return candidates
    .map((candidate) => {
      const distKm = candidate.route.distanceM / 1000;
      const ascendM = candidate.route.ascendM;
      const distanceInRange = inRange(distKm, minKm, maxKm);
      const ascentInRange = inRange(ascendM, minHm, maxHm);
      const routeHeading = routeDirection(candidate.route.coords, start);
      const directionDeviation = direction === 'any' || routeHeading.bearing === null
        ? 0
        : angularDistance(routeHeading.bearing, DIRECTION_BEARINGS[direction]) / 180;
      const reference = scoreRouteAgainstReferences(
        candidate.route.coords,
        referenceModel,
        {
          edgeIds: candidate.route.edgeIds,
          graphTimestamp: candidate.route.matchingGraphTimestamp,
        },
      );
      const constraints = evaluateRouteConstraints(candidate.route, {
        allowMeadowEarth,
        maxSlopePercent,
      });
      const flow = evaluateRouteFlow(candidate.route.coords);
      const quality = analyzeRouteQuality(candidate.route);
      const structure = analyzeTourStructure(candidate.route);
      const learnedStructure = scoreTourStructure(structure, referenceModel?.structureFrame);
      const firstClimb = firstClimbAssessment(quality.terrain, firstClimbMode);
      const score =
        relativeDeviation(distKm, minKm, maxKm) * 2
        + relativeDeviation(ascendM, minHm, maxHm)
        + directionDeviation * 1.5
        + reference.adjustment
        + learnedStructure.adjustment
        + constraints.adjustment
        + (learnedStructure.available ? 0 : flow.adjustment)
        + firstClimb.adjustment
        + Math.abs(distKm - kmMid) / Math.max(maxKm - minKm, 1) * 0.01
        + Math.abs(ascendM - hmMid) / Math.max(maxHm - minHm, 100) * 0.005;
      return {
        ...candidate,
        distKm,
        distanceInRange,
        ascentInRange,
        direction: routeHeading.cardinal,
        directionDeviation,
        reference,
        constraints,
        flow,
        quality,
        structure,
        learnedStructure,
        firstClimb,
        inRange: distanceInRange && ascentInRange && constraints.allowed && firstClimb.allowed,
        score,
      };
    })
    .sort((a, b) => {
      if (firstClimbMode === 'required' && a.firstClimb.allowed !== b.firstClimb.allowed) {
        return Number(b.firstClimb.allowed) - Number(a.firstClimb.allowed);
      }
      // Eine eingehaltene Maximalsteigung schlägt immer die Distanzvorgabe:
      // lieber zusätzliche Kilometer als eine ungewollt steile Rampe.
      if (a.constraints.slopeAllowed !== b.constraints.slopeAllowed) {
        return Number(b.constraints.slopeAllowed) - Number(a.constraints.slopeAllowed);
      }
      return a.score - b.score;
    })
    .reduce((selected, candidate, _index, ranked) => {
      if (selected.length >= limit) return selected;
      if (!selected.some((other) => routeOverlap(candidate.route.coords, other.route.coords) >= 0.8)) {
        selected.push(candidate);
      }
      // Falls alle Varianten ähnlich sind, trotzdem bis zum Limit auffüllen.
      if (_index === ranked.length - 1 && selected.length < limit) {
        for (const fallback of ranked) {
          if (!selected.includes(fallback)) selected.push(fallback);
          if (selected.length >= limit) break;
        }
      }
      return selected;
    }, []);
}
