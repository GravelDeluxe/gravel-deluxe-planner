import { TILE_URL, TILE_ATTRIBUTION, MAP_START, MAP_START_ZOOM } from './config.js';
import { fetchRouteWithFallback } from './routing.js';
import { profilePoints, svgPath } from './elevation.js';
import { generateCandidates } from './loop.js';

const map = L.map('map').setView(MAP_START, MAP_START_ZOOM);
L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
const routeLayer = L.polyline([], { color: '#c2410c', weight: 4 }).addTo(map);

const el = (id) => document.getElementById(id);
const setStatus = (msg) => { el('status').textContent = msg; };

let requestSeq = 0;

const state = {
  mode: 'manual',     // 'manual' | 'loop'
  waypoints: [],      // [[lat, lon], ...]
  route: null,        // { coords, distanceM, ascendM, profile }
  candidates: [],     // Vorschläge aus generateCandidates (Task 11)
  markers: [],
  busy: false,        // gates nur Map-Klicks; Korrektheit sichert requestSeq
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
    const route = await fetchRouteWithFallback(waypoints);
    if (seq !== requestSeq) return;
    state.route = route;
    setStatus(
      state.route.profile === 'gravel'
        ? ''
        : 'Hinweis: Gravel-Profil nicht verfügbar, Trekking-Profil verwendet.',
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
    if (state.mode === 'loop') setStatus('Startpunkt auf die Karte klicken, dann Runde erzeugen.');
  }),
);

function renderSuggestions(activeIndex = -1) {
  el('suggestions').innerHTML = state.candidates
    .map(
      (c, i) => `<button type="button" class="suggestion${i === activeIndex ? ' active' : ''}" data-i="${i}">
        ${(c.route.distanceM / 1000).toFixed(0)} km · ${Math.round(c.route.ascendM)} hm${c.inRange ? '' : ' (außerhalb Bereich)'}
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
  setStatus(c.inRange ? '' : `Außerhalb des Bereichs: ${(c.route.distanceM / 1000).toFixed(1)} km.`);
}

el('suggestions').addEventListener('click', (e) => {
  const btn = e.target.closest('.suggestion');
  if (btn) selectCandidate(Number(btn.dataset.i));
});

el('generateLoop').addEventListener('click', async () => {
  if (state.busy) return;
  const start = state.waypoints[0];
  const minKm = Number(el('loopKmMin').value);
  const maxKm = Number(el('loopKmMax').value);
  const mode = document.querySelector('input[name="tripMode"]:checked').value;
  if (!start) return setStatus('Zuerst Startpunkt auf die Karte klicken.');
  if (!(minKm >= 5 && maxKm <= 300 && minKm < maxKm)) {
    return setStatus('Ungültiger Distanzbereich (5–300 km, min < max).');
  }
  const seq = ++requestSeq;
  state.busy = true;
  setStatus('Vorschläge werden erzeugt … (kann eine Minute dauern)');
  try {
    const candidates = await generateCandidates(
      start,
      { minKm, maxKm, mode, baseBearingDeg: Math.random() * 360 },
      (wps) => fetchRouteWithFallback(wps),
    );
    if (seq !== requestSeq) return;
    state.candidates = candidates;
    selectCandidate(0);
  } catch (err) {
    if (seq !== requestSeq) return;
    setStatus(`Vorschläge fehlgeschlagen: ${err.message}`);
  }
  if (seq !== requestSeq) return;
  state.busy = false;
});

export { state, map, routeLayer, el, setStatus, reroute, renderMarkers, renderRoute, clearAll };
