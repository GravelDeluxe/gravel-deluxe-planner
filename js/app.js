import { TILE_URL, TILE_ATTRIBUTION, MAP_START, MAP_START_ZOOM } from './config.js';

export const map = L.map('map').setView(MAP_START, MAP_START_ZOOM);
L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

export const el = (id) => document.getElementById(id);
export function setStatus(msg) {
  el('status').textContent = msg;
}
