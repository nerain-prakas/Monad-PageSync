/**
 * API client for Monad-PageSync backend
 * Base URL from env (VITE_API_URL) or localhost:3001
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  health:       () => get('/health'),
  benchmark:    () => get('/benchmark'),
  stats:        () => get('/stats'),
  addresses:    () => get('/addresses'),
  orders:       (limit = 50) => get(`/orders?limit=${limit}`),
  trades:       (limit = 50) => get(`/trades?limit=${limit}`),
  kuruActivity: (limit = 50) => get(`/kuru/activity?limit=${limit}`),
  order:        id => get(`/orders/${encodeURIComponent(id)}`),
};

