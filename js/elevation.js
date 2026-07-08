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
