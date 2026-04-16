// Simple localStorage cache for menu data with TTL.
// Allows the customer menu to load instantly (and even fully offline) on
// repeat visits, even when the mobile connection is poor or unavailable.

const PREFIX = 'tcc:menu-cache:';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

interface CacheEntry<T> {
  value: T;
  savedAt: number;
}

export function saveCache<T>(key: string, value: T): void {
  try {
    const entry: CacheEntry<T> = { value, savedAt: Date.now() };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or disabled — silently ignore, cache is best-effort.
  }
}

export function readCache<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.savedAt > ttlMs) return null;
    return entry.value;
  } catch {
    return null;
  }
}

// Read cache ignoring TTL — used as a last-resort fallback when offline so the
// menu still shows even if the cached copy is older than 24h.
export function readCacheStale<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return entry.value;
  } catch {
    return null;
  }
}

export const CACHE_KEYS = {
  mesa: (numero: string | number) => `mesa:${numero}`,
  categorias: 'categorias',
  produtos: 'produtos',
} as const;
