import { haversineM } from './geo.js';

export function sampleLine(coords, spacingM = 25) {
  if (!coords?.length) return [];
  const samples = [{ point: coords[0], distanceM: 0 }];
  let distanceM = 0;
  let nextM = spacingM;
  for (let index = 1; index < coords.length; index++) {
    const from = coords[index - 1];
    const to = coords[index];
    const lengthM = haversineM(from, to);
    while (lengthM > 0 && nextM <= distanceM + lengthM) {
      const t = (nextM - distanceM) / lengthM;
      samples.push({
        point: from.map((value, axis) => value + ((to[axis] ?? value) - value) * t),
        distanceM: nextM,
      });
      nextM += spacingM;
    }
    distanceM += lengthM;
  }
  if (distanceM > samples.at(-1).distanceM) samples.push({ point: coords.at(-1), distanceM });
  return samples;
}

export function pointSegmentDistanceM(point, a, b) {
  const latScale = 111195;
  const lonScale = latScale * Math.cos(point[0] * Math.PI / 180);
  const ax = (a[1] - point[1]) * lonScale;
  const ay = (a[0] - point[0]) * latScale;
  const bx = (b[1] - point[1]) * lonScale;
  const by = (b[0] - point[0]) * latScale;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

// Geometrischer 12-m-Korridor statt gemeinsamer 70–110-m-Referenzzelle.
// Das ist eine Näheheuristik, kein OSM-Weg-ID-Abgleich.
export function lineIndex(coords) {
  const cells = new Map();
  const samples = sampleLine(coords, 20);
  for (let index = 1; index < samples.length; index++) {
    const edge = [samples[index - 1].point, samples[index].point];
    for (const point of edge) {
      const key = `${Math.floor(point[0] / 0.0005)},${Math.floor(point[1] / 0.0005)}`;
      if (!cells.has(key)) cells.set(key, new Set());
      cells.get(key).add(edge);
    }
  }
  return (point, radiusM = 12) => {
    const y = Math.floor(point[0] / 0.0005);
    const x = Math.floor(point[1] / 0.0005);
    // DACH: eine Zelle ist mindestens rund 30 m breit.
    const reach = Math.ceil(radiusM / 30) + 1;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        for (const edge of cells.get(`${y + dy},${x + dx}`) ?? []) {
          if (pointSegmentDistanceM(point, ...edge) <= radiusM) return true;
        }
      }
    }
    return false;
  };
}

export function routeOverlap(a, b) {
  const sampledA = sampleLine(a, 40);
  const sampledB = sampleLine(b, 40);
  if (sampledA.length < 3 || sampledB.length < 3) return 0;
  const nearA = lineIndex(a);
  const nearB = lineIndex(b);
  const share = (samples, near) => {
    let matched = 0;
    for (let index = 1; index < samples.length; index++) {
      if (near(samples[index].point)) matched += samples[index].distanceM - samples[index - 1].distanceM;
    }
    return matched / (samples.at(-1).distanceM || 1);
  };
  return Math.min(share(sampledA, nearB), share(sampledB, nearA));
}
