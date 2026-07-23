import { haversineM } from './geo.js';

export function routeIndexFromProgress(progress, coordCount) {
  if (coordCount <= 1) return 0;
  const clamped = Math.max(0, Math.min(1000, Number(progress) || 0));
  return Math.round((clamped / 1000) * (coordCount - 1));
}

export function distanceToIndex(coords, index) {
  let distanceM = 0;
  const end = Math.max(0, Math.min(index, coords.length - 1));
  for (let i = 1; i <= end; i++) {
    distanceM += haversineM(coords[i - 1], coords[i]);
  }
  return distanceM;
}

export function buildBadPassage(coords, inIndex, outIndex, { problem, note = '' } = {}) {
  if (!coords?.length) throw new Error('Keine Route vorhanden');
  if (!Number.isInteger(inIndex) || !Number.isInteger(outIndex)) {
    throw new Error('IN- und OUT-Punkt fehlen');
  }
  const startIndex = Math.max(0, Math.min(inIndex, outIndex));
  const endIndex = Math.min(coords.length - 1, Math.max(inIndex, outIndex));
  if (startIndex === endIndex) throw new Error('IN und OUT müssen verschieden sein');
  const passageCoords = coords.slice(startIndex, endIndex + 1);
  return {
    startIndex,
    endIndex,
    start: passageCoords[0].slice(0, 3),
    end: passageCoords.at(-1).slice(0, 3),
    distanceM: Math.round(distanceToIndex(passageCoords, passageCoords.length - 1)),
    problem: problem || 'anderes',
    note: String(note).trim(),
    coords: passageCoords.map((point) => point.slice(0, 3)),
  };
}

export function buildFeedbackPayload(route, passages, metadata = {}) {
  if (!route?.coords?.length) throw new Error('Keine Route vorhanden');
  return {
    schema: 'graveldeluxe-route-feedback/v1',
    createdAt: new Date().toISOString(),
    route: {
      profile: route.profile ?? null,
      distanceM: route.distanceM,
      ascendM: route.ascendM,
      coords: route.coords.map((point) => point.slice(0, 3)),
    },
    passages,
    metadata,
  };
}
