import fs from 'node:fs/promises';
import path from 'node:path';
import {
  parseGpx,
  analyzeReferenceRoute,
  buildReferenceModel,
} from '../js/reference-analysis.js';

const sourceDir = path.resolve('gpx-samples');
const outputFile = path.resolve('data/reference-analysis.json');
const names = (await fs.readdir(sourceDir)).sort((a, b) => a.localeCompare(b, 'de'));
const analyzed = [];
const feedbackItems = [];
const duplicates = [];
const fingerprints = new Map();

for (const filename of names) {
  const fullPath = path.join(sourceDir, filename);
  if (filename.toLowerCase().endsWith('.gpx')) {
    const xml = await fs.readFile(fullPath, 'utf8');
    const parsed = parseGpx(xml, path.parse(filename).name);
    const route = analyzeReferenceRoute({ ...parsed, source: filename });
    const original = fingerprints.get(route.fingerprint);
    if (original) {
      duplicates.push({ file: filename, duplicateOf: original });
      continue;
    }
    fingerprints.set(route.fingerprint, filename);
    analyzed.push(route);
  } else if (filename.toLowerCase().endsWith('__feedback.json')) {
    const item = JSON.parse(await fs.readFile(fullPath, 'utf8'));
    if (item.schema !== 'graveldeluxe-route-feedback/v1') {
      throw new Error(`Unbekanntes Feedbackformat: ${filename}`);
    }
    feedbackItems.push({ source: filename, passages: item.passages ?? [] });
  }
}

const model = buildReferenceModel(analyzed, feedbackItems);
model.summary.gpxFiles = names.filter((name) => name.toLowerCase().endsWith('.gpx')).length;
model.summary.duplicates = duplicates.length;
model.duplicates = duplicates;

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(model, null, 2)}\n`);

console.log(`Referenzanalyse: ${model.summary.goodRoutes} eindeutige gute Routen`);
console.log(`Dubletten: ${model.summary.duplicates}`);
console.log(`Feedback: ${model.summary.feedbackFiles} Dateien, ${model.summary.badPassages} Passagen`);
console.log(`Korridore: ${model.summary.goodCells} gut, ${model.summary.badCells} schlecht`);
console.log(`Ausgabe: ${path.relative(process.cwd(), outputFile)}`);
