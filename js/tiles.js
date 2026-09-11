// Ein Ladezyklus pro Kachel. Leaflet bekommt genau einen Abschluss; keine
// globalen DOM-Scans, die noch laufende Downloads beim Zoomen zurücksetzen.
export function loadTileImage(tile, url, done, {
  timeoutMs = 15000, maxAttempts = 3,
  schedule = setTimeout, cancel = clearTimeout, random = Math.random,
} = {}) {
  let timer;
  let attempts = 0;
  let finished = false;
  let waiting = false;
  const cleanup = () => {
    cancel(timer);
    tile.removeEventListener('load', loaded);
    tile.removeEventListener('error', failed);
  };
  const finish = (error) => {
    if (finished) return;
    finished = true;
    cleanup();
    done(error, tile);
  };
  const loaded = () => {
    // Leaflet setzt beim Abbruch eine transparente Ersatz-URL.
    if (tile.getAttribute('src') !== url || !tile.naturalWidth) return;
    finish(null);
  };
  const failed = () => {
    if (finished || waiting || tile.getAttribute('src') !== url) return;
    cancel(timer);
    if (attempts >= maxAttempts) {
      finish(new Error('Kartenkachel konnte nicht geladen werden.'));
      return;
    }
    waiting = true;
    timer = schedule(start, 1500 * 2 ** (attempts - 1) + random() * 500);
  };
  const start = () => {
    if (finished) return;
    waiting = false;
    attempts++;
    tile.removeAttribute('src');
    tile.src = url;
    timer = schedule(failed, timeoutMs);
  };
  tile.addEventListener('load', loaded);
  tile.addEventListener('error', failed);
  start();
  return () => {
    finished = true;
    cleanup();
  };
}

export function createReliableTileLayer(L, url, options) {
  if (!L.TileLayer?.extend) return L.tileLayer(url, options);
  const cancellations = new Map();
  const ReliableLayer = L.TileLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement('img');
      tile.alt = '';
      cancellations.set(tile, loadTileImage(tile, this.getTileUrl(coords), (error, image) => {
        cancellations.delete(tile);
        done(error, image);
      }));
      return tile;
    },
  });
  const layer = new ReliableLayer(url, {
    ...options, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2,
  });
  const cancelTile = ({ tile }) => {
    cancellations.get(tile)?.();
    cancellations.delete(tile);
  };
  layer.on('tileunload', cancelTile);
  layer.on('tileabort', cancelTile);
  layer.on('remove', () => {
    for (const cancel of cancellations.values()) cancel();
    cancellations.clear();
  });
  return layer;
}
