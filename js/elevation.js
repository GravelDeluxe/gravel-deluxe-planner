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
