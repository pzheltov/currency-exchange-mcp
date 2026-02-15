import { beforeEach,describe, expect, it } from 'vitest';

import { cacheStats,clearCache, getCached, setCache } from '../../src/utils/cache.js';

describe('cache', () => {
    beforeEach(() => {
        clearCache();
    });

    it('stores and retrieves values', () => {
        setCache('key1', { rate: 83.12 });
        expect(getCached('key1')).toEqual({ rate: 83.12 });
    });

    it('returns null for missing keys', () => {
        expect(getCached('nonexistent')).toBeNull();
    });

    it('respects TTL expiration', async () => {
        setCache('short-ttl', 'value', 50); // 50ms TTL
        expect(getCached('short-ttl')).toBe('value');
        await new Promise((resolve) => { setTimeout(resolve, 60); });
        expect(getCached('short-ttl')).toBeNull();
    });

    it('tracks hit and miss stats', () => {
        setCache('tracked', 42);
        getCached('tracked'); // hit
        getCached('missing'); // miss
        const stats = cacheStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.size).toBe(1);
    });

    it('evicts oldest entries when full', () => {
        // Fill cache to max (500 entries)
        for (let i = 0; i < 500; i++) {
            setCache(`entry-${i}`, i);
        }
        expect(cacheStats().size).toBe(500);

        // Adding one more should evict the oldest
        setCache('new-entry', 'fresh');
        expect(cacheStats().size).toBe(500);
        expect(getCached('new-entry')).toBe('fresh');
    });

    it('clears all entries and resets stats', () => {
        setCache('a', 1);
        setCache('b', 2);
        getCached('a');
        clearCache();
        expect(cacheStats()).toEqual({ size: 0, hits: 0, misses: 0 });
        expect(getCached('a')).toBeNull();
    });
});
