const KEY = 'gravel-planner.routes';
export const SAVED_ROUTE_SCHEMA = 'graveldeluxe-saved-route/v2';

export function listRoutes(storage = localStorage) {
  try {
    const routes = JSON.parse(storage.getItem(KEY));
    return Array.isArray(routes) ? routes : [];
  } catch {
    return [];
  }
}

export function saveRoute(data, storage = localStorage) {
  const routes = listRoutes(storage);
  const entry = { ...data, schema: SAVED_ROUTE_SCHEMA, id: crypto.randomUUID(), savedAt: new Date().toISOString() };
  routes.push(entry);
  storage.setItem(KEY, JSON.stringify(routes));
  return entry;
}

export function deleteRoute(id, storage = localStorage) {
  const routes = listRoutes(storage).filter((r) => r.id !== id);
  storage.setItem(KEY, JSON.stringify(routes));
}
