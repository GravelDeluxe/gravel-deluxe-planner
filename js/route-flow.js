import { haversineM } from './geo.js';

function bearing([lat1, lon1], [lat2, lon2]) {
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(deltaLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2)
    - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angleDifference(a, b) {
  return Math.abs(((b - a + 540) % 360) - 180);
}

function sampleRoute(coords, spacingM = 120) {
  if (!coords?.length) return [];
  const sampled = [coords[0]];
  let accumulatedM = 0;
  for (let index = 1; index < coords.length; index++) {
    accumulatedM += haversineM(coords[index - 1], coords[index]);
    if (accumulatedM >= spacingM) {
      sampled.push(coords[index]);
      accumulatedM = 0;
    }
  }
  if (sampled.at(-1) !== coords.at(-1)) sampled.push(coords.at(-1));
  return sampled;
}

function flowCell([lat, lon]) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export function evaluateRouteFlow(coords) {
  const sampled = sampleRoute(coords);
  if (sampled.length < 3) {
    return { sharpTurns: 0, reversals: 0, repeatedShare: 0, adjustment: 0 };
  }
  let sharpTurns = 0;
  let reversals = 0;
  const headings = [];
  for (let index = 1; index < sampled.length; index++) {
    headings.push(bearing(sampled[index - 1], sampled[index]));
  }
  for (let index = 1; index < headings.length; index++) {
    const turn = angleDifference(headings[index - 1], headings[index]);
    if (turn > 65) sharpTurns += (turn - 65) / 115;
    if (turn > 145) reversals++;
  }

  const lastSeen = new Map();
  let repeated = 0;
  sampled.forEach((point, index) => {
    const cell = flowCell(point);
    const previous = lastSeen.get(cell);
    // Start/Ziel-Schluss sowie direkt benachbarte Samples zählen nicht als
    // Doppelbefahrung. Spätere Wiederkehr in dieselbe 10-m-Zelle schon.
    const isClosingPoint = index === sampled.length - 1 && cell === flowCell(sampled[0]);
    if (!isClosingPoint && previous !== undefined && index - previous > 1) repeated++;
    lastSeen.set(cell, index);
  });
  const repeatedShare = repeated / sampled.length;
  return {
    sharpTurns,
    reversals,
    repeatedShare,
    // Niedriger Kandidatenscore ist besser. Doppelbefahrung und Kehrtwenden
    // wiegen deutlich stärker als einzelne enge Kurven.
    adjustment: sharpTurns * 0.12 + reversals * 1.5 + repeatedShare * 18,
  };
}
