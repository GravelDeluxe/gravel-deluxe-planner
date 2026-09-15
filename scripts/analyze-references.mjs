import fs from 'node:fs/promises';
import path from 'node:path';
import {
  parseGpx,
  analyzeReferenceRoute,
  buildReferenceModel,
  normalizeReferenceMetadata,
} from '../js/reference-analysis.js';

const sourceDir = path.resolve('gpx-samples');
const outputFile = path.resolve('data/reference-analysis.json');
const matchesFile = path.resolve('data/reference-matches.json');
let referenceMatches = null;
try {
  referenceMatches = JSON.parse(await fs.readFile(matchesFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
let referenceEnrichment = null;
try {
  referenceEnrichment = JSON.parse(await fs.readFile(path.resolve('data/reference-enrichment.json'), 'utf8'));
  if (referenceEnrichment.graphTimestamp !== referenceMatches?.graphTimestamp) referenceEnrichment = null;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const names = (await fs.readdir(sourceDir)).sort((a, b) => a.localeCompare(b, 'de'));
const analyzed = [];
const feedbackItems = [];
const duplicates = [];
const fingerprints = new Map();
let counterexamples = 0;

for (const filename of names) {
  const fullPath = path.join(sourceDir, filename);
  if (filename.toLowerCase().endsWith('.gpx')) {
    const xml = await fs.readFile(fullPath, 'utf8');
    const parsed = parseGpx(xml, path.parse(filename).name);
    let sourceMetadata = {};
    try {
      sourceMetadata = JSON.parse(await fs.readFile(`${fullPath}.meta.json`, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const route = analyzeReferenceRoute({ ...parsed, source: filename });
    const matchingKnown = Object.hasOwn(referenceMatches?.routes ?? {}, filename);
    route.edgeIds = referenceMatches?.routes?.[filename] ?? [];
    route.matchingStatus = !matchingKnown
      ? 'pending' : route.edgeIds.length > 0 ? 'matched' : 'outside-graph';
    const enrichment = referenceEnrichment?.routes?.[filename];
    if (enrichment?.accepted) route.structure = enrichment.structure;
    route.metadata = normalizeReferenceMetadata(sourceMetadata, route);
    if (route.metadata.kind === 'counterexample') {
      counterexamples++;
      feedbackItems.push({
        source: filename,
        passages: [{
          problem: sourceMetadata.problem || 'Gegenbeispiel',
          effect: 'penalty', confidence: 'observed', coords: parsed.coords,
          note: route.metadata.notes,
        }],
      });
      continue;
    }
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
model.matchingGraphTimestamp = referenceMatches?.graphTimestamp ?? null;
model.quality.mapMatched = Boolean(referenceMatches?.graphTimestamp);
model.quality.matching = model.quality.mapMatched ? 'ors-edge+geometry-proximity' : 'geometry-proximity';
model.summary.matchedRoutes = analyzed.filter((route) => route.matchingStatus === 'matched').length;
model.summary.unmatchedRoutes = analyzed.filter((route) => route.matchingStatus === 'outside-graph').length;
model.summary.pendingRoutes = analyzed.filter((route) => route.matchingStatus === 'pending').length;
model.summary.enrichedRoutes = analyzed.filter((route) => referenceEnrichment?.routes?.[route.source]?.accepted).length;
model.summary.gpxFiles = names.filter((name) => name.toLowerCase().endsWith('.gpx')).length;
model.summary.duplicates = duplicates.length;
model.summary.counterexamples = counterexamples;
model.duplicates = duplicates;

const serialized = `${JSON.stringify(model, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (await fs.readFile(outputFile, 'utf8') !== serialized) {
    throw new Error('Referenzmodell ist veraltet. Bitte npm run analyze ausführen und das Ergebnis committen.');
  }
} else {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, serialized);
}

console.log(`Referenzanalyse: ${model.summary.goodRoutes} eindeutige gute Routen`);
console.log(`Dubletten: ${model.summary.duplicates}`);
console.log(`Gegenbeispiele: ${model.summary.counterexamples}`);
console.log(`Feedback: ${model.summary.feedbackFiles} Dateien, ${model.summary.badPassages} Passagen`);
console.log(`Korridore: ${model.summary.goodCells} gut, ${model.summary.badCells} schlecht`);
console.log(`Aufbaurahmen: ${Object.keys(model.structureFrame.dimensions).length} gelernte Kennzahlen`);
console.log(`Leave-one-out: Median ${model.structureValidation.medianAdjustment.toFixed(2)}, P80 ${model.structureValidation.p80Adjustment.toFixed(2)}`);
console.log(`Graphabdeckung: ${model.summary.matchedRoutes} mit ORS-Kanten, ${model.summary.unmatchedRoutes} außerhalb, ${model.summary.pendingRoutes} noch nicht geprüft`);
for (const route of analyzed.filter((candidate) => candidate.matchingStatus === 'outside-graph')) {
  const centerLat = (route.bounds[0][0] + route.bounds[1][0]) / 2;
  const centerLon = (route.bounds[0][1] + route.bounds[1][1]) / 2;
  console.log(`  außerhalb: ${route.source} (${centerLat.toFixed(4)}, ${centerLon.toFixed(4)})`);
}
for (const route of analyzed.filter((candidate) => candidate.matchingStatus === 'pending')) {
  console.log(`  ausstehend: ${route.source}`);
}
console.log(`Angereicherte Referenzen: ${model.summary.enrichedRoutes}`);
console.log(`Ausgabe: ${path.relative(process.cwd(), outputFile)}`);
