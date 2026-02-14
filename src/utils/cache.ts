interface CacheEntry<T> {
    data: T;
    expiresAt: number;
    lastAccessed: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

let hits = 0;
let misses = 0;

function evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of store) {
        if (entry.lastAccessed < oldestTime) {
            oldestTime = entry.lastAccessed;
            oldestKey = key;
        }
    }

    if (oldestKey) {
        store.delete(oldestKey);
    }
}

export function getCached<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) {
        misses++;
        return null;
    }
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        misses++;
        return null;
    }
    entry.lastAccessed = Date.now();
    hits++;
    return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    while (store.size >= MAX_ENTRIES) {
        evictOldest();
    }
    store.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
        lastAccessed: Date.now(),
    });
}

export function clearCache(): void {
    store.clear();
    hits = 0;
    misses = 0;
}

export function cacheStats(): { size: number; hits: number; misses: number } {
    return { size: store.size, hits, misses };
}
