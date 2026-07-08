const KEY = 'gravel-planner.routes';

export function listRoutes(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveRoute(data, storage = localStorage) {
  const routes = listRoutes(storage);
  const entry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), ...data };
  routes.push(entry);
  storage.setItem(KEY, JSON.stringify(routes));
  return entry;
}

export function deleteRoute(id, storage = localStorage) {
  const routes = listRoutes(storage).filter((r) => r.id !== id);
  storage.setItem(KEY, JSON.stringify(routes));
}
