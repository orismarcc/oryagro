/**
 * Simple localStorage-based cache for offline support.
 * Keys are prefixed with 'offline_cache_'.
 */
const CACHE_PREFIX = 'offline_cache_';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      ts: Date.now(),
    }));
  } catch { /* quota exceeded — ignore */ }
}

export function cacheGet(key, maxAgeMs = MAX_AGE_MS) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}

export function cacheClear(key) {
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch {}
}
