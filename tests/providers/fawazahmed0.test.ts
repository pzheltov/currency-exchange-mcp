import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach,describe, expect, it, vi } from 'vitest';

import { getFawazahmed0HistoricalRate,getFawazahmed0Rates } from '../../src/providers/fawazahmed0.js';
import { fetchPage } from '../../src/utils/http.js';

vi.mock('../../src/utils/http.js', () => ({
    fetchPage: vi.fn(),
}));

vi.mock('apify', () => ({
    log: { warning: vi.fn(), info: vi.fn(), error: vi.fn() },
    Actor: { init: vi.fn(), charge: vi.fn(), exit: vi.fn() },
}));

const mockFetchPage = vi.mocked(fetchPage);

const fixturesDir = `${path.dirname(fileURLToPath(import.meta.url))  }/../fixtures`;
const fixture = JSON.parse(readFileSync(`${fixturesDir}/fawazahmed0-usd.json`, 'utf-8'));

describe('getFawazahmed0Rates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses rates and normalizes keys to uppercase', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(fixture),
            statusCode: 200,
            headers: {},
        });

        const result = await getFawazahmed0Rates('USD');

        expect(result.base).toBe('USD');
        expect(result.source).toBe('fawazahmed0');
        expect(result.rates.EUR).toBe(0.9234);
        expect(result.rates.INR).toBe(83.12);
        expect(result.timestamp).toBe('2026-02-14');
    });

    it('throws on non-200 status', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: '',
            statusCode: 404,
            headers: {},
        });

        await expect(getFawazahmed0Rates('XYZ'))
            .rejects.toThrow('fawazahmed0 API returned HTTP 404');
    });

    it('throws on invalid JSON', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: 'invalid',
            statusCode: 200,
            headers: {},
        });

        await expect(getFawazahmed0Rates('USD'))
            .rejects.toThrow('fawazahmed0 API returned invalid JSON');
    });

    it('throws when base currency not found in response', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({ date: '2026-02-14' }),
            statusCode: 200,
            headers: {},
        });

        await expect(getFawazahmed0Rates('USD'))
            .rejects.toThrow('no rates found for USD');
    });

    it('filters out non-positive rates', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({
                date: '2026-02-14',
                usd: { eur: 0.92, gbp: 0, xxx: -1, yyy: 'invalid' },
            }),
            statusCode: 200,
            headers: {},
        });

        const result = await getFawazahmed0Rates('USD');
        expect(result.rates.EUR).toBe(0.92);
        expect(result.rates.GBP).toBeUndefined(); // zero filtered
        expect(result.rates.XXX).toBeUndefined(); // negative filtered
        expect(result.rates.YYY).toBeUndefined(); // non-number filtered
    });
});

describe('getFawazahmed0HistoricalRate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches historical rate for a specific date', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({
                date: '2025-01-15',
                usd: { inr: 86.45 },
            }),
            statusCode: 200,
            headers: {},
        });

        const result = await getFawazahmed0HistoricalRate('USD', 'INR', '2025-01-15');

        expect(result.base).toBe('USD');
        expect(result.target).toBe('INR');
        expect(result.date).toBe('2025-01-15');
        expect(result.rate).toBe(86.45);
        expect(result.source).toBe('fawazahmed0');
    });

    it('throws when target rate not found', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({
                date: '2025-01-15',
                usd: { eur: 0.92 },
            }),
            statusCode: 200,
            headers: {},
        });

        await expect(getFawazahmed0HistoricalRate('USD', 'INR', '2025-01-15'))
            .rejects.toThrow('no rate for INR');
    });

    it('throws on non-200 status', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: '',
            statusCode: 404,
            headers: {},
        });

        await expect(getFawazahmed0HistoricalRate('USD', 'INR', '2025-01-15'))
            .rejects.toThrow('fawazahmed0 historical API returned HTTP 404');
    });
});
