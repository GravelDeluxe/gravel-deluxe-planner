import { TILE_URL, TILE_ATTRIBUTION, MAP_START, MAP_START_ZOOM } from './config.js';
import { fetchRouteWithFallback } from './routing.js';
import { profilePoints, svgPath } from './elevation.js';
import { fetchRoundTrip } from './ors.js';
import { rankRoundTripCandidates } from './candidates.js';
import { searchPlace } from './search.js';
import { listRoutes, saveRoute, deleteRoute } from './storage.js';
import { toGpx, escapeXml } from './gpx.js';

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
const routeLayer = L.polyline([], { color: '#c2410c', weight: 4 }).addTo(map);

const el = (id) => document.getElementById(id);
const setStatus = (msg) => { el('status').textContent = msg; };

let requestSeq = 0;
let searchSeq = 0;

const state = {
  mode: 'loop',       // 'manual' | 'loop'
  waypoints: [[...MAP_START]], // Home Base ist der initiale Rundenstart
  route: null,        // { coords, distanceM, ascendM, profile }
  candidates: [],     // geschlossene ORS-Runden
  markers: [],
  busy: false,        // gates nur Map-Klicks; Korrektheit sichert requestSeq
  routingProfile: el('routingProfile').value,
};

function renderStats() {
  const km = state.route ? state.route.distanceM / 1000 : 0;
  el('statDistance').textContent = `${km.toFixed(1)} km`;
  el('statAscent').textContent = `${Math.round(state.route?.ascendM ?? 0)} hm`;
  el('profile').innerHTML = state.route
    ? `<path d="${svgPath(profilePoints(state.route.coords), 400, 80)}" fill="none" stroke="#c2410c" stroke-width="2" />`
    : '';
}

function renderRoute() {
  routeLayer.setLatLngs(state.route ? state.route.coords.map(([lat, lon]) => [lat, lon]) : []);
  renderStats();
}

function renderMarkers() {
  state.markers.forEach((m) => m.remove());
  state.markers = state.waypoints.map((wp, i) => {
    const marker = L.marker(wp, { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      state.waypoints[i] = [lat, lng];
      reroute();
    });
    marker.on('click', () => {
      state.waypoints.splice(i, 1);
      reroute();
    });
    return marker;
  });
}

async function reroute() {
  renderMarkers();
  if (state.waypoints.length < 2) {
    requestSeq++;
    state.busy = false;
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
    state.route = route;
    setStatus(
      state.route.profile === state.routingProfile
        ? ''
        : `Hinweis: Profil „${state.routingProfile}“ nicht verfügbar, „${state.route.profile}“ verwendet.`,
    );
  } catch (err) {
    if (seq !== requestSeq) return;
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
  renderMarkers();
  renderRoute();
  el('suggestions').innerHTML = '';
  setStatus('');
}

map.on('click', (e) => {
  if (state.busy) return;
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

function renderSuggestions(activeIndex = -1) {
  el('suggestions').innerHTML = state.candidates
    .map(
      (c, i) => `<button type="button" class="suggestion${i === activeIndex ? ' active' : ''}" data-i="${i}">
        ${(c.route.distanceM / 1000).toFixed(0)} km · ${Math.round(c.route.ascendM)} hm${c.inRange ? '' : ` (außerhalb: ${[!c.distanceInRange && 'km', !c.ascentInRange && 'hm'].filter(Boolean).join(' + ')})`}
      </button>`,
    )
    .join('');
}

function selectCandidate(i) {
  const c = state.candidates[i];
  if (!c) return;
  requestSeq++; // invalidate any in-flight reroute; this click owns the state now
  state.busy = false;
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
  ].filter(Boolean);
  setStatus(c.inRange ? '' : `Beste verfügbare Runde außerhalb des Zielbereichs: ${misses.join(', ')}.`);
}

el('suggestions').addEventListener('click', (e) => {
  const btn = e.target.closest('.suggestion');
  if (btn) selectCandidate(Number(btn.dataset.i));
});

// Sechs native ORS-Rundtouren erzeugen und nach Distanz UND Höhenmetern
// bewerten. Die drei besten werden angezeigt; die lokale Instanz braucht keinen Key.
async function roundTripCandidates(start, minKm, maxKm, minHm, maxHm) {
  const baseLengths = [minKm, (minKm + maxKm) / 2, maxKm];
  const lengthsKm = [...baseLengths, ...baseLengths];
  let firstError;
  const results = await Promise.all(
    lengthsKm.map(async (km) => {
      try {
        const route = await fetchRoundTrip(start, {
          lengthM: km * 1000,
          seed: Math.floor(Math.random() * 100000),
          points: 5,
        });
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
  const valid = results.filter(Boolean);
  if (!valid.length && firstError) throw firstError;
  return rankRoundTripCandidates(valid, { minKm, maxKm, minHm, maxHm });
}

el('generateLoop').addEventListener('click', async () => {
  if (state.busy) return;
  const start = state.waypoints[0];
  const minKm = Number(el('loopKmMin').value);
  const maxKm = Number(el('loopKmMax').value);
  const minHm = Number(el('loopHmMin').value);
  const maxHm = Number(el('loopHmMax').value);
  if (!start) return setStatus('Zuerst Startpunkt auf die Karte klicken.');
  if (!(minKm >= 5 && maxKm <= 300 && minKm < maxKm)) {
    return setStatus('Ungültiger Distanzbereich (5–300 km, min < max).');
  }
  if (!(minHm >= 0 && maxHm <= 10000 && minHm <= maxHm)) {
    return setStatus('Ungültiger Höhenmeterbereich (0–10.000 hm, min ≤ max).');
  }
  const seq = ++requestSeq;
  state.busy = true;
  setStatus('Vorschläge werden erzeugt …');
  try {
    const candidates = await roundTripCandidates(start, minKm, maxKm, minHm, maxHm);
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
  const name = prompt('Name der Route:', 'Gravel-Runde')?.trim();
  if (!name) return;
  try {
    saveRoute({
      name,
      waypoints: state.waypoints,
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
  state.waypoints = route.waypoints;
  state.route = {
    coords: route.coords,
    distanceM: route.distanceM,
    ascendM: route.ascendM,
    profile: 'gravel',
  };
  renderMarkers();
  renderRoute();
  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
  refreshTilesSoon();
  setStatus('');
});

renderSavedRoutes();
renderMarkers();
setStatus('Home Base gesetzt. Distanz wählen und Runde erzeugen.');

el('reverseButton').addEventListener('click', () => {
  if (state.busy) return;
  if (state.waypoints.length >= 2) {
    state.waypoints.reverse();
    reroute();
  } else if (state.route) {
    // Runde (ein Wegpunkt): Linie umdrehen reicht, kein Neu-Routing nötig.
    state.route = { ...state.route, coords: [...state.route.coords].reverse() };
    renderRoute();
  } else {
    setStatus('Keine Route zum Umkehren.');
  }
});

el('exportButton').addEventListener('click', () => {
  if (!state.route) return setStatus('Keine Route zum Exportieren.');
  const blob = new Blob([toGpx('Gravel-Route', state.route.coords)], {
    type: 'application/gpx+xml',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'route.gpx';
  a.click();
  URL.revokeObjectURL(a.href);
});

export { state, map, routeLayer, el, setStatus, reroute, renderMarkers, renderRoute, clearAll };
