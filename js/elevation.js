import { haversineM } from './geo.js';

export function profilePoints(coords) {
  if (!coords.length) return [];
  const pts = [{ d: 0, ele: coords[0][2] ?? 0 }];
  let dist = 0;
  for (let i = 1; i < coords.length; i++) {
    dist += haversineM(coords[i - 1], coords[i]);
    pts.push({ d: dist, ele: coords[i][2] ?? 0 });
  }
  return pts;
}

// Summe der positiven Höhen-Deltas (coords: [[lat, lon, ele], ...]).
export function ascentM(coords) {
  let gain = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = (coords[i][2] ?? 0) - (coords[i - 1][2] ?? 0);
    if (d > 0) gain += d;
  }
  return gain;
}

// Höhen mit gleitendem Mittel (Fenster ±window) glätten, lat/lon bleiben.
// Nötig für ORS: dessen SRTM-Höhen haben Spikes (einzelne 300-m-Sprünge, 0-Werte),
// die den roh summierten Anstieg vervielfachen.
export function smoothElevations(coords, window = 8) {
  const ele = coords.map((c) => c[2] ?? 0);
  return coords.map((c, i) => {
    let sum = 0;
    let n = 0;
    for (let k = i - window; k <= i + window; k++) {
      if (k >= 0 && k < ele.length) {
        sum += ele[k];
        n++;
      }
    }
    return [c[0], c[1], sum / n];
  });
}

// SRTM-Höhen von ORS enthalten Voids (0/negativ, fehlende Werte) und Spikes.
// Robuste Kette gegen überhöhte Höhenmeter: fillVoids → medianFilter → elevationGain.

// Voids (<=0 oder nicht endlich) durch den letzten gültigen Wert ersetzen; führende
// Voids rückwärts aus dem ersten gültigen Wert füllen. lat/lon bleiben unangetastet.
export function fillVoids(coords) {
  const valid = (v) => Number.isFinite(v) && v > 0;
  const ele = coords.map((c) => c[2]);
  let last = null;
  for (let i = 0; i < ele.length; i++) {
    if (valid(ele[i])) last = ele[i];
    else if (last != null) ele[i] = last;
  }
  const first = ele.find(valid) ?? 0;
  for (let i = 0; i < ele.length && !valid(ele[i]); i++) ele[i] = first;
  return coords.map((c, i) => [c[0], c[1], ele[i]]);
}

// Median-Filter (±window) entfernt einzelne Ausreißer, statt sie wie ein
// gleitendes Mittel über die Nachbarschaft zu verschmieren.
export function medianFilterElevations(coords, window = 3) {
  const ele = coords.map((c) => c[2]);
  return coords.map((c, i) => {
    const w = [];
    for (let k = i - window; k <= i + window; k++) {
      if (k >= 0 && k < ele.length) w.push(ele[k]);
    }
    w.sort((a, b) => a - b);
    return [c[0], c[1], w[Math.floor(w.length / 2)]];
  });
}

// Anstieg mit Hysterese: eine neue Referenzhöhe zählt erst, wenn sie sich um
// >= threshold von der letzten Referenz unterscheidet. So wird Restrauschen unter
// dem Schwellwert ignoriert, echte Anstiege werden aber voll summiert.
export function elevationGain(coords, threshold = 10) {
  if (coords.length < 2) return 0;
  let gain = 0;
  let ref = coords[0][2] ?? 0;
  for (let i = 1; i < coords.length; i++) {
    const e = coords[i][2] ?? 0;
    const d = e - ref;
    if (Math.abs(d) >= threshold) {
      if (d > 0) gain += d;
      ref = e;
    }
  }
  return gain;
}

export function svgPath(points, width, height, pad = 2) {
  if (points.length < 2) return '';
  const maxD = points[points.length - 1].d || 1;
  let minE = Infinity;
  let maxE = -Infinity;
  for (const p of points) {
    if (p.ele < minE) minE = p.ele;
    if (p.ele > maxE) maxE = p.ele;
  }
  const span = maxE - minE || 1;
  return points
    .map((p, i) => {
      const x = pad + (p.d / maxD) * (width - 2 * pad);
      const y = height - pad - ((p.ele - minE) / span) * (height - 2 * pad);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
