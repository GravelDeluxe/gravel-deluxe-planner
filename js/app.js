import { TILE_URL, TILE_ATTRIBUTION, MAP_START, MAP_START_ZOOM } from './config.js';
import { fetchRouteWithFallback } from './routing.js';
import { profilePoints, svgPath } from './elevation.js';
import {
  feedbackAvoidPolygons,
} from './reference-analysis.js';
import {
  fetchRoundTripWithRetry,
  fetchRouteThroughWaypoints,
  snapWaypoints,
} from './ors.js';
import { DIRECTION_BEARINGS, rankRoundTripCandidates } from './candidates.js';
import { buildGravelDeluxeCustomModel } from './gravel-deluxe.js';
import { buildHighlightWaypoints } from './highlights.js';
import { generateCandidates, generateDirectionalCandidates } from './loop.js';
import { searchPlace } from './search.js';
import { listRoutes, saveRoute, deleteRoute } from './storage.js';
import { toGpx, escapeXml } from './gpx.js';
import {
  routeIndexFromProgress,
  distanceToIndex,
  buildBadPassage,
  buildFeedbackPayload,
  feedbackFilename,
} from './feedback.js';
import { buildRouteDisplaySegments, directionArrowPoints } from './route-display.js';

const map = L.map('map', { zoomControl: false }).setView(MAP_START, MAP_START_ZOOM);
const tileLayer = L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);

// CyclOSM (Community-Server) liefert nach großen Sprüngen unzuverlässig: Kacheln
// droppen (429/Timeout) ODER bleiben ohne Fehler-Event hängen. Leaflet lässt sie
// dann grau — bis zur nächsten Interaktion. Zwei Mechanismen holen sie nach.

// 1) Fehlerhafte Kachel mit exponentiellem Backoff + Jitter erneut anfordern,
//    damit die Retries nicht gebündelt wieder auf den gedrosselten Server treffen.
const TILE_MAX_RETRY = 4;
tileLayer.on('tileerror', (e) => {
  const t = e.tile;
  const tries = Number(t.dataset.retry || 0);
  if (tries >= TILE_MAX_RETRY) return;
  t.dataset.retry = tries + 1;
  const src = t.src;
  const delay = 500 * 2 ** tries + Math.random() * 300;
  setTimeout(() => { if (t.parentNode) t.src = src; }, delay);
});

// Genau die grauen (noch nicht geladenen) Kacheln neu anfordern. Kein redraw():
// das würde geladene Kacheln verwerfen (Flackern) und laufende Requests abbrechen.
function nudgeStalledTiles() {
  const pane = map.getPane('tilePane');
  const grey = pane ? pane.querySelectorAll('img.leaflet-tile:not(.leaflet-tile-loaded)') : [];
  grey.forEach((t) => {
    const src = t.src;
    if (src) { t.src = ''; t.src = src; }
  });
  return grey.length;
}

// 2) Nach einem programmatischen Sprung (Suche/fitBounds) nachfassen: hängende
//    Kacheln feuern kein tileerror, darum mit wachsenden Abständen prüfen und
//    nur die verbliebenen grauen neu ziehen, bis keine mehr übrig sind.
function refreshTilesSoon() {
  let pass = 0;
  const check = () => {
    if (nudgeStalledTiles() > 0 && ++pass < 4) setTimeout(check, 1200 + pass * 800);
  };
  setTimeout(check, 1000);
}
const routeLayer = L.polyline([], { color: '#c2410c', weight: 4, opacity: 0 }).addTo(map);
let routeDisplayLayers = [];
let routeDirectionMarkers = [];
const feedbackCursor = L.circleMarker(MAP_START, {
  radius: 7, color: '#ffffff', weight: 2, fillColor: '#ea580c', fillOpacity: 1,
});
const feedbackInMarker = L.circleMarker(MAP_START, {
  radius: 6, color: '#15803d', weight: 3, fillOpacity: 0,
});
let feedbackPassageLayers = [];

const el = (id) => document.getElementById(id);
const setStatus = (msg) => { el('status').textContent = msg; };

let requestSeq = 0;
let searchSeq = 0;
const referenceModelPromise = fetch('./data/reference-analysis.json')
  .then((response) => (response.ok ? response.json() : null))
  .catch(() => null);

const state = {
  mode: 'loop',       // 'manual' | 'loop'
  waypoints: [[...MAP_START]], // Home Base ist der initiale Rundenstart
  route: null,        // { coords, distanceM, ascendM, profile }
  candidates: [],     // geschlossene ORS-Runden
  markers: [],
  highlightMarkers: [],
  highlights: [],
  highlightMode: false,
  busy: false,        // gates nur Map-Klicks; Korrektheit sichert requestSeq
  routingProfile: el('routingProfile').value,
  feedback: {
    active: false,
    index: 0,
    inIndex: null,
    passages: [],
  },
};

function safeFilename(value, fallback = 'route') {
  const name = String(value || '').trim() || fallback;
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function downloadText(content, type, filename) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function clearFeedbackLayers() {
  if (map.hasLayer(feedbackInMarker)) feedbackInMarker.remove();
  feedbackPassageLayers.forEach((layer) => layer.remove());
  feedbackPassageLayers = [];
}

function resetFeedback() {
  state.feedback = { active: false, index: 0, inIndex: null, passages: [] };
  el('feedbackPanel').hidden = true;
  el('feedbackScrubber').value = 0;
  el('feedbackNote').value = '';
  clearFeedbackLayers();
}

function feedbackPoint(index = state.feedback.index) {
  return state.route?.coords?.[index] ?? null;
}

function renderFeedback() {
  clearFeedbackLayers();
  if (!state.route?.coords?.length) {
    if (map.hasLayer(feedbackCursor)) feedbackCursor.remove();
    renderStats();
    return;
  }
  const point = feedbackPoint();
  feedbackCursor.setLatLng([point[0], point[1]]).addTo(map);
  const distanceKm = distanceToIndex(state.route.coords, state.feedback.index) / 1000;
  el('feedbackPosition').textContent =
    `${distanceKm.toFixed(1)} km · ${Math.round(point[2] ?? 0)} m`;
  renderStats();
  if (!state.feedback.active) return;
  if (state.feedback.inIndex !== null) {
    const inPoint = feedbackPoint(state.feedback.inIndex);
    feedbackInMarker.setLatLng([inPoint[0], inPoint[1]]).addTo(map);
  }
  feedbackPassageLayers = state.feedback.passages.map((passage) =>
    L.polyline(
      passage.coords.map(([lat, lon]) => [lat, lon]),
      { color: '#facc15', weight: 8, opacity: 0.9 },
    ).addTo(map),
  );
  el('feedbackPassages').innerHTML = state.feedback.passages
    .map(
      (passage, index) => `<div class="feedback-passage">
        <span>${index + 1}. ${escapeXml(passage.problem)} · ${(passage.distanceM / 1000).toFixed(1)} km</span>
        <button type="button" data-i="${index}" aria-label="Passage entfernen">×</button>
      </div>`,
    )
    .join('');
}

function activateFeedback() {
  if (!state.route?.coords?.length) return setStatus('Zuerst eine Route erzeugen.');
  state.feedback.active = true;
  el('feedbackPanel').hidden = false;
  renderFeedback();
  setStatus('Route scrubben, am Beginn IN und am Ende OUT setzen.');
}

function renderStats() {
  const km = state.route ? state.route.distanceM / 1000 : 0;
  el('statDistance').textContent = `${km.toFixed(1)} km`;
  el('statAscent').textContent = `${Math.round(state.route?.ascendM ?? 0)} hm`;
  el('feedbackScrubber').disabled = !state.route;
  if (!state.route) {
    el('profile').innerHTML = '';
    el('feedbackPosition').textContent = 'Keine Route';
    return;
  }
  const points = profilePoints(state.route.coords);
  const index = Math.min(state.feedback.index, points.length - 1);
  const minElevation = Math.min(...points.map((point) => point.ele));
  const maxElevation = Math.max(...points.map((point) => point.ele));
  const elevationSpan = maxElevation - minElevation || 1;
  const cursorX = 2 + points[index].d / Math.max(points.at(-1).d, 1) * 396;
  const cursorY = 78 - (points[index].ele - minElevation) / elevationSpan * 76;
  const markedRanges = [
    ...state.feedback.passages.map((passage) => [passage.startIndex, passage.endIndex]),
    ...(state.feedback.inIndex === null
      ? []
      : [[state.feedback.inIndex, state.feedback.index]]),
  ].map(([from, to]) => {
    const start = points[Math.min(from, to)]?.d ?? 0;
    const end = points[Math.max(from, to)]?.d ?? start;
    const x = 2 + start / Math.max(points.at(-1).d, 1) * 396;
    const width = Math.max(2, (end - start) / Math.max(points.at(-1).d, 1) * 396);
    return `<rect x="${x}" y="2" width="${width}" height="76" fill="#facc15" opacity="0.3" />`;
  }).join('');
  el('profile').innerHTML = `
    ${markedRanges}
    <path d="${svgPath(points, 400, 80)}" fill="none" stroke="#c2410c" stroke-width="2" />
    <line x1="${cursorX}" y1="2" x2="${cursorX}" y2="78" stroke="#facc15" stroke-width="2" />
    <circle cx="${cursorX}" cy="${cursorY}" r="4" fill="#facc15" stroke="#111827" stroke-width="1.5" />
  `;
}

function renderRoute() {
  routeDisplayLayers.forEach((layer) => layer.remove());
  routeDirectionMarkers.forEach((marker) => marker.remove());
  routeDisplayLayers = [];
  routeDirectionMarkers = [];
  routeLayer.setLatLngs(state.route ? state.route.coords.map(([lat, lon]) => [lat, lon]) : []);
  if (state.route) {
    const displaySegments = buildRouteDisplaySegments(state.route, {
      allowMeadowEarth: el('allowMeadowEarth').checked,
      maxSlopePercent: Number(el('maxSlopePercent').value),
    });
    routeDisplayLayers = displaySegments.map((segment) => {
      const warnings = [
        segment.surfaceViolation && 'Wiese/Erde nicht erlaubt',
        segment.slopeViolation && `Steigung bis ${segment.maximumGrade.toFixed(1)} %`,
      ].filter(Boolean);
      return L.polyline(
        segment.coords.map(([lat, lon]) => [lat, lon]),
        { color: segment.color, weight: warnings.length ? 7 : 5, opacity: 0.9 },
      )
        .bindTooltip(
          `${segment.surfaceName}${warnings.length ? ` · ${warnings.join(' · ')}` : ''}`,
          { sticky: true },
        )
        .addTo(map);
    });
    routeDirectionMarkers = directionArrowPoints(state.route.coords).map(({ point, bearing }) =>
      L.marker([point[0], point[1]], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<div class="route-direction-arrow" style="transform:rotate(${bearing}deg)">▲</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map));
  }
  renderFeedback();
}

function renderMarkers() {
  state.markers.forEach((m) => m.remove());
  state.markers = state.waypoints.map((wp, i) => {
    const marker = L.marker(wp, {
      draggable: true,
      bubblingMouseEvents: false,
    }).addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      state.waypoints[i] = [lat, lng];
      reroute();
    });
    marker.on('click', (event) => {
      if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      // Der einzelne Marker im Rundenmodus ist der Start/Home-Base-Punkt.
      // Ein Klick darauf darf ihn weder löschen noch über den Karten-Klick
      // unmittelbar wieder neu setzen.
      if (state.mode === 'loop') return;
      state.waypoints.splice(i, 1);
      reroute();
    });
    return marker;
  });
}

function renderHighlights() {
  state.highlightMarkers.forEach((marker) => marker.remove());
  state.highlightMarkers = state.highlights.map((point, index) => {
    const marker = L.circleMarker(point, {
      radius: 7,
      color: '#a16207',
      weight: 3,
      fillColor: '#facc15',
      fillOpacity: 0.9,
    }).addTo(map);
    marker.bindTooltip(`Highlight ${index + 1}`);
    return marker;
  });
  el('highlights').innerHTML = state.highlights
    .map(
      (point, index) => `<div class="highlight-row">
        <span>◆ Highlight ${index + 1} · ${point[0].toFixed(4)}, ${point[1].toFixed(4)}</span>
        <button type="button" data-i="${index}" aria-label="Highlight entfernen">×</button>
      </div>`,
    )
    .join('');
}

async function reroute() {
  renderMarkers();
  if (state.waypoints.length < 2) {
    requestSeq++;
    state.busy = false;
    resetFeedback();
    state.route = null;
    renderRoute();
    setStatus('');
    return;
  }
  const seq = ++requestSeq;
  const waypoints = [...state.waypoints];
  setStatus('Route wird berechnet …');
  state.busy = true;
  try {
    const route = await fetchRouteWithFallback(waypoints, { profile: state.routingProfile });
    if (seq !== requestSeq) return;
    resetFeedback();
    state.route = route;
    setStatus(
      state.route.profile === state.routingProfile
        ? ''
        : `Hinweis: Profil „${state.routingProfile}“ nicht verfügbar, „${state.route.profile}“ verwendet.`,
    );
  } catch (err) {
    if (seq !== requestSeq) return;
    resetFeedback();
    state.route = null;
    setStatus(`Routing fehlgeschlagen: ${err.message}`);
  }
  if (seq !== requestSeq) return;
  state.busy = false;
  renderRoute();
}

function clearAll() {
  requestSeq++;
  state.busy = false;
  state.waypoints = [];
  state.route = null;
  state.candidates = [];
  state.highlights = [];
  state.highlightMode = false;
  resetFeedback();
  renderMarkers();
  renderHighlights();
  renderRoute();
  el('suggestions').innerHTML = '';
  setStatus('');
}

map.on('click', (e) => {
  if (state.busy || state.feedback.active) return;
  if (state.highlightMode) {
    state.highlights.push([e.latlng.lat, e.latlng.lng]);
    state.highlightMode = false;
    el('addHighlight').classList.remove('active');
    el('addHighlight').textContent = 'Weiteres Highlight setzen';
    renderHighlights();
    setStatus(`Highlight ${state.highlights.length} gesetzt.`);
    return;
  }
  if (state.mode === 'loop') {
    state.waypoints = [[e.latlng.lat, e.latlng.lng]];
  } else {
    state.waypoints.push([e.latlng.lat, e.latlng.lng]);
  }
  reroute();
});

el('undoButton').addEventListener('click', () => {
  state.waypoints.pop();
  reroute();
});
el('clearButton').addEventListener('click', clearAll);
el('addHighlight').addEventListener('click', () => {
  state.highlightMode = !state.highlightMode;
  el('addHighlight').classList.toggle('active', state.highlightMode);
  el('addHighlight').textContent = state.highlightMode
    ? 'Jetzt Highlight auf Karte anklicken …'
    : state.highlights.length ? 'Weiteres Highlight setzen' : 'Highlight auf Karte setzen';
});
el('highlights').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-i]');
  if (!button) return;
  state.highlights.splice(Number(button.dataset.i), 1);
  renderHighlights();
});

document.querySelectorAll('input[name="mode"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    state.mode = radio.value;
    el('loopControls').hidden = state.mode !== 'loop';
    clearAll();
    setStatus(
      state.mode === 'loop'
        ? 'Startpunkt auf die Karte klicken, dann Runde erzeugen.'
        : 'Start- und Endpunkt auf die Karte klicken.',
    );
  }),
);

el('routingProfile').addEventListener('change', () => {
  state.routingProfile = el('routingProfile').value;
  if (state.mode === 'manual' && state.waypoints.length >= 2) reroute();
  else if (state.mode === 'loop') {
    setStatus('Runden werden mit dem lokalen ORS-Profil „GravelDeluxe“ erzeugt.');
  }
});

el('allowMeadowEarth').addEventListener('change', renderRoute);
el('maxSlopePercent').addEventListener('input', renderRoute);

function renderSuggestions(activeIndex = -1) {
  el('suggestions').innerHTML = state.candidates
    .map(
      (c, i) => `<button type="button" class="suggestion${i === activeIndex ? ' active' : ''}" data-i="${i}">
        ${c.direction ? `${c.direction} · ` : ''}${(c.route.distanceM / 1000).toFixed(0)} km · ${Math.round(c.route.ascendM)} hm${c.reference?.goodAffinity ? ` · Referenz ${Math.round(c.reference.goodAffinity * 100)} %` : ''}${c.reference?.badCoverage ? ` · ⚠ ${Math.round(c.reference.badCoverage * 100)} % Feedback` : ''}${c.flow?.reversals || c.flow?.repeatedShare > 0.02 ? ' · ⚠ Fahrfluss' : ''}${!c.constraints?.surfaceAvailable && !el('allowMeadowEarth').checked ? ' · ⚠ Oberfläche nicht prüfbar' : ''}${c.inRange ? '' : ` (außerhalb: ${[!c.distanceInRange && 'km', !c.ascentInRange && 'hm', !c.constraints?.surfaceAllowed && 'Wiese/Erde', !c.constraints?.slopeAllowed && `Steigung ${c.constraints.maximumGrade.toFixed(1)} %`].filter(Boolean).join(' + ')})`}
      </button>`,
    )
    .join('');
}

function selectCandidate(i) {
  const c = state.candidates[i];
  if (!c) return;
  requestSeq++; // invalidate any in-flight reroute; this click owns the state now
  state.busy = false;
  resetFeedback();
  state.route = c.route;
  state.waypoints = [...c.waypoints];
  renderMarkers();
  renderRoute();
  renderSuggestions(i);
  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
  refreshTilesSoon();
  const misses = [
    !c.distanceInRange && `${(c.route.distanceM / 1000).toFixed(1)} km`,
    !c.ascentInRange && `${Math.round(c.route.ascendM)} hm`,
    !c.constraints?.surfaceAllowed && `${(c.constraints.meadowEarthM / 1000).toFixed(1)} km Wiese/Erde`,
    !c.constraints?.slopeAllowed && `${c.constraints.maximumGrade.toFixed(1)} % maximale Steigung`,
  ].filter(Boolean);
  setStatus(c.inRange ? '' : `Beste verfügbare Runde außerhalb des Zielbereichs: ${misses.join(', ')}.`);
}

el('suggestions').addEventListener('click', (e) => {
  const btn = e.target.closest('.suggestion');
  if (btn) selectCandidate(Number(btn.dataset.i));
});

el('feedbackButton').addEventListener('click', activateFeedback);
el('feedbackClose').addEventListener('click', () => {
  state.feedback.active = false;
  el('feedbackPanel').hidden = true;
  clearFeedbackLayers();
  setStatus('');
});
el('feedbackScrubber').addEventListener('input', () => {
  if (!state.route) return;
  state.feedback.index = routeIndexFromProgress(
    el('feedbackScrubber').value,
    state.route.coords.length,
  );
  renderFeedback();
});
el('feedbackIn').addEventListener('click', () => {
  state.feedback.inIndex = state.feedback.index;
  renderFeedback();
  setStatus(`IN bei Punkt ${state.feedback.index + 1} gesetzt. Jetzt bis zum Ende scrubben.`);
});
el('feedbackOut').addEventListener('click', () => {
  try {
    const passage = buildBadPassage(
      state.route?.coords,
      state.feedback.inIndex,
      state.feedback.index,
      {
        problem: el('feedbackProblem').value,
        note: el('feedbackNote').value,
      },
    );
    state.feedback.passages.push(passage);
    state.feedback.inIndex = null;
    el('feedbackNote').value = '';
    renderFeedback();
    setStatus(`Passage ${state.feedback.passages.length} gespeichert.`);
  } catch (err) {
    setStatus(err.message);
  }
});
el('feedbackPassages').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-i]');
  if (!button) return;
  state.feedback.passages.splice(Number(button.dataset.i), 1);
  renderFeedback();
});
el('feedbackExport').addEventListener('click', () => {
  if (!state.feedback.passages.length) {
    return setStatus('Mindestens eine schlechte Passage mit IN und OUT markieren.');
  }
  const routeName = el('routeName').value.trim() || 'GravelDeluxe-Runde';
  const payload = buildFeedbackPayload(state.route, state.feedback.passages, {
    routeName,
    requestedDistanceKm: {
      min: Number(el('loopKmMin').value),
      max: Number(el('loopKmMax').value),
    },
    requestedAscentM: {
      min: Number(el('loopHmMin').value),
      max: Number(el('loopHmMax').value),
    },
    requestedDirection: el('loopDirection').value,
    allowMeadowEarth: el('allowMeadowEarth').checked,
    maxSlopePercent: Number(el('maxSlopePercent').value),
    highlights: state.highlights.map((point) => point.slice(0, 2)),
  });
  downloadText(
    `${JSON.stringify(payload, null, 2)}\n`,
    'application/json',
    feedbackFilename(routeName),
  );
  setStatus('Feedback mit vollständiger Route und markierten Passagen heruntergeladen.');
});

// Sechs native ORS-Rundtouren erzeugen und nach Distanz UND Höhenmetern
// bewerten. Die drei besten werden angezeigt; die lokale Instanz braucht keinen Key.
async function roundTripCandidates(
  start,
  minKm,
  maxKm,
  minHm,
  maxHm,
  direction,
  { customModel, highlights, allowMeadowEarth, maxSlopePercent },
) {
  const referenceModel = await referenceModelPromise;
  const avoidPolygons = feedbackAvoidPolygons(
    referenceModel,
    [start, ...highlights],
  );
  const routeThroughSnappedWaypoints = async (waypoints) => {
    const snapped = await snapWaypoints(waypoints, { radiusM: 2500 });
    return fetchRouteThroughWaypoints(snapped, { customModel, avoidPolygons });
  };
  const expandedMaxKm = Math.min(300, maxKm * 1.5);
  const baseLengths = [
    minKm,
    (minKm + maxKm) / 2,
    maxKm,
    Math.min(300, maxKm * 1.25),
    expandedMaxKm,
  ];
  const lengthsKm = [...baseLengths, ...baseLengths];
  let firstError;
  const guidedShape = direction !== 'any' || highlights.length > 0;
  const results = guidedShape ? [] : await Promise.all(
    lengthsKm.map(async (km) => {
      try {
        let route = await fetchRoundTripWithRetry(start, {
          lengthM: km * 1000,
          customModel,
          avoidPolygons,
        });
        if (highlights.length) {
          const viaPoints = buildHighlightWaypoints(start, route.coords, highlights);
          route = await routeThroughSnappedWaypoints(viaPoints);
        }
        const snappedStart = route.coords.length
          ? [route.coords[0][0], route.coords[0][1]]
          : start;
        return {
          route: { ...route, profile: 'ors-gravel-deluxe' },
          waypoints: [snappedStart],
        };
      } catch (err) {
        firstError ??= err;
        return null;
      }
    }),
  );
  let valid = results.filter(Boolean);
  if (guidedShape) {
    const bearingDeg = direction === 'any'
      ? 0
      : DIRECTION_BEARINGS[direction];
    try {
      const guided = await generateDirectionalCandidates(
        start,
        {
          minKm,
          maxKm: expandedMaxKm,
          bearingDeg,
          count: 9,
          maxIter: 3,
        },
        routeThroughSnappedWaypoints,
      );
      valid = await Promise.all(
        guided.map(async (candidate) => {
          let route = candidate.route;
          if (highlights.length) {
            const viaPoints = buildHighlightWaypoints(start, route.coords, highlights);
            route = await routeThroughSnappedWaypoints(viaPoints);
          }
          return {
            route: { ...route, profile: 'ors-gravel-deluxe' },
            // Geometrische ORS-Formpunkte sind interne Planungsdetails. In der
            // UI bleibt nur der tatsächliche Startmarker sichtbar/editierbar.
            waypoints: [[route.coords[0][0], route.coords[0][1]]],
          };
        }),
      );
    } catch (guidedError) {
      firstError = guidedError;
    }
  }
  if (guidedShape && !valid.length) {
    throw new Error(
      `Gerichtete Runde konnte nicht erzeugt werden: ${firstError?.message ?? 'unbekannter ORS-Fehler'}`,
    );
  }
  if (!valid.length) {
    // Fallback für Gebiete, in denen der native ORS-Rundtouralgorithmus seine
    // zufälligen internen Punkte nicht auf den Graphen bekommt. Die Geometrie
    // wird hier vorgegeben, die eigentliche Wegwahl bleibt vollständig bei ORS.
    try {
      const fallback = await generateCandidates(
        start,
        {
          minKm,
          maxKm,
          mode: 'circle',
          count: 6,
          n: 3,
          maxIter: 3,
        },
        routeThroughSnappedWaypoints,
      );
      valid = await Promise.all(
        fallback.map(async (candidate) => {
          let route = candidate.route;
          if (highlights.length) {
            const viaPoints = buildHighlightWaypoints(start, route.coords, highlights);
            route = await routeThroughSnappedWaypoints(viaPoints);
          }
          return {
            route: { ...route, profile: 'ors-gravel-deluxe' },
            waypoints: [[route.coords[0][0], route.coords[0][1]]],
          };
        }),
      );
    } catch (fallbackError) {
      throw new Error(
        `ORS konnte weder native noch gestützte Rundtouren erzeugen. `
        + `${fallbackError.message}; letzter nativer Fehler: ${firstError?.message ?? 'unbekannt'}`,
      );
    }
  }
  return rankRoundTripCandidates(
    valid,
    {
      minKm,
      maxKm,
      minHm,
      maxHm,
      direction,
      start,
      referenceModel,
      allowMeadowEarth,
      maxSlopePercent,
    },
  );
}

el('generateLoop').addEventListener('click', async () => {
  if (state.busy) return;
  const start = state.waypoints[0];
  const minKm = Number(el('loopKmMin').value);
  const maxKm = Number(el('loopKmMax').value);
  const minHm = Number(el('loopHmMin').value);
  const maxHm = Number(el('loopHmMax').value);
  const direction = el('loopDirection').value;
  const maxSlopePercent = Number(el('maxSlopePercent').value);
  const allowMeadowEarth = el('allowMeadowEarth').checked;
  if (!start) return setStatus('Zuerst Startpunkt auf die Karte klicken.');
  if (!(minKm >= 5 && maxKm <= 300 && minKm < maxKm)) {
    return setStatus('Ungültiger Distanzbereich (5–300 km, min < max).');
  }
  if (!(minHm >= 0 && maxHm <= 10000 && minHm <= maxHm)) {
    return setStatus('Ungültiger Höhenmeterbereich (0–10.000 hm, min ≤ max).');
  }
  if (!(maxSlopePercent >= 3 && maxSlopePercent <= 30)) {
    return setStatus('Ungültige maximale Steigung (3–30 %).');
  }
  const customModel = buildGravelDeluxeCustomModel({
    allowMeadowEarth,
    maxSlopePercent,
  });
  const seq = ++requestSeq;
  state.busy = true;
  setStatus('Vorschläge werden erzeugt …');
  try {
    const candidates = await roundTripCandidates(
      start,
      minKm,
      maxKm,
      minHm,
      maxHm,
      direction,
      {
        customModel,
        highlights: [...state.highlights],
        allowMeadowEarth,
        maxSlopePercent,
      },
    );
    if (seq !== requestSeq) return;
    if (!candidates.length) throw new Error('Keine Runde gefunden');
    state.candidates = candidates;
    // selectCandidate bumpt requestSeq und setzt busy=false — der Guard unten greift danach bewusst nicht mehr.
    selectCandidate(0);
  } catch (err) {
    if (seq !== requestSeq) return;
    setStatus(`Vorschläge fehlgeschlagen: ${err.message}`);
  }
  if (seq !== requestSeq) return;
  state.busy = false;
});

async function runSearch() {
  const q = el('searchInput').value.trim();
  if (!q) return;
  const seq = ++searchSeq;
  const ul = el('searchResults');
  setStatus('Suche …');
  try {
    const results = await searchPlace(q);
    if (seq !== searchSeq) return;
    if (results.length === 0) {
      ul.hidden = true;
      ul.innerHTML = '';
    } else {
      ul.hidden = false;
      ul.innerHTML = results
        .map((r, i) => `<li><button type="button" data-i="${i}">${escapeXml(r.name)}</button></li>`)
        .join('');
      ul.onclick = (e) => {
        const btn = e.target.closest('button[data-i]');
        if (!btn) return;
        const r = results[Number(btn.dataset.i)];
        map.setView([r.lat, r.lon], 13);
        refreshTilesSoon();
        ul.hidden = true;
      };
    }
    setStatus(results.length ? '' : 'Nichts gefunden.');
  } catch (err) {
    if (seq !== searchSeq) return;
    ul.hidden = true;
    ul.innerHTML = '';
    setStatus(
      err.message.startsWith('Suche fehlgeschlagen')
        ? err.message
        : `Suche fehlgeschlagen: ${err.message}`,
    );
  }
}
el('searchButton').addEventListener('click', runSearch);
el('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});

function renderSavedRoutes() {
  const routes = listRoutes();
  el('savedRoutes').innerHTML = routes
    .map(
      (r) => `<div class="saved-route" data-id="${r.id}">
        <button type="button" class="load">${escapeXml(r.name)} (${(r.distanceM / 1000).toFixed(1)} km)</button>
        <button type="button" class="remove" aria-label="Route löschen">×</button>
      </div>`,
    )
    .join('');
}

el('saveButton').addEventListener('click', () => {
  if (!state.route) return setStatus('Keine Route zum Speichern.');
  const name = el('routeName').value.trim();
  if (!name) return;
  try {
    saveRoute({
      name,
      waypoints: state.waypoints,
      highlights: state.highlights,
      settings: {
        allowMeadowEarth: el('allowMeadowEarth').checked,
        maxSlopePercent: Number(el('maxSlopePercent').value),
      },
      coords: state.route.coords,
      distanceM: state.route.distanceM,
      ascendM: state.route.ascendM,
    });
  } catch {
    setStatus('Speichern fehlgeschlagen (Speicher voll?).');
    return;
  }
  renderSavedRoutes();
  setStatus('Gespeichert.');
});

el('savedRoutes').addEventListener('click', (e) => {
  const row = e.target.closest('.saved-route');
  if (!row) return;
  if (e.target.classList.contains('remove')) {
    deleteRoute(row.dataset.id);
    renderSavedRoutes();
    return;
  }
  const route = listRoutes().find((r) => r.id === row.dataset.id);
  if (!route) return;
  requestSeq++; // invalidate any in-flight reroute/generation; this load owns the state now
  state.busy = false;
  resetFeedback();
  state.waypoints = route.waypoints;
  state.highlights = route.highlights ?? [];
  el('routeName').value = route.name;
  if (route.settings) {
    el('allowMeadowEarth').checked = route.settings.allowMeadowEarth ?? true;
    el('maxSlopePercent').value = route.settings.maxSlopePercent ?? 10;
  }
  state.route = {
    coords: route.coords,
    distanceM: route.distanceM,
    ascendM: route.ascendM,
    profile: 'gravel',
  };
  renderMarkers();
  renderHighlights();
  renderRoute();
  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
  refreshTilesSoon();
  setStatus('');
});

renderSavedRoutes();
renderMarkers();
renderHighlights();
setStatus('Home Base gesetzt. Distanz wählen und Runde erzeugen.');

el('reverseButton').addEventListener('click', () => {
  if (state.busy) return;
  if (state.waypoints.length >= 2) {
    state.waypoints.reverse();
    reroute();
  } else if (state.route) {
    // Runde (ein Wegpunkt): Linie umdrehen reicht, kein Neu-Routing nötig.
    resetFeedback();
    state.route = { ...state.route, coords: [...state.route.coords].reverse() };
    renderRoute();
  } else {
    setStatus('Keine Route zum Umkehren.');
  }
});

el('exportButton').addEventListener('click', () => {
  if (!state.route) return setStatus('Keine Route zum Exportieren.');
  const routeName = el('routeName').value.trim() || 'GravelDeluxe-Runde';
  downloadText(
    toGpx(routeName, state.route.coords),
    'application/gpx+xml',
    `${safeFilename(routeName)}.gpx`,
  );
});

export { state, map, routeLayer, el, setStatus, reroute, renderMarkers, renderRoute, clearAll };
