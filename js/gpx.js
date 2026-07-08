export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toGpx(name, coords) {
  const pts = coords
    .map(
      ([lat, lon, ele]) =>
        `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${(ele ?? 0).toFixed(1)}</ele></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Gravel Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
