import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils/http.js', () => ({
    fetchPage: vi.fn(),
}));

vi.mock('apify', () => ({
    log: { warning: vi.fn(), info: vi.fn(), error: vi.fn() },
    Actor: { init: vi.fn(), charge: vi.fn(), exit: vi.fn() },
}));

import { fetchPage } from '../../src/utils/http.js';
import { getCoinGeckoPrices } from '../../src/providers/coingecko.js';

const mockFetchPage = vi.mocked(fetchPage);

const fixturesDir = path.dirname(fileURLToPath(import.meta.url)) + '/../fixtures';
const fixture = JSON.parse(readFileSync(`${fixturesDir}/coingecko-simple-price.json`, 'utf-8'));

describe('getCoinGeckoPrices', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses prices and normalizes keys to uppercase', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(fixture),
            statusCode: 200,
            headers: {},
        });

        const result = await getCoinGeckoPrices(['bitcoin'], ['usd', 'eur', 'inr']);

        expect(result.source).toBe('coingecko');
        expect(result.rates.USD).toBe(51234.56);
        expect(result.rates.EUR).toBe(47345.12);
        expect(result.rates.INR).toBe(4258567.12);
    });

    it('constructs correct URL', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(fixture),
            statusCode: 200,
            headers: {},
        });

        await getCoinGeckoPrices(['bitcoin', 'ethereum'], ['usd', 'eur']);

        expect(mockFetchPage).toHaveBeenCalledWith(
            expect.stringContaining('ids=bitcoin%2Cethereum'),
            expect.any(Object),
        );
        expect(mockFetchPage).toHaveBeenCalledWith(
            expect.stringContaining('vs_currencies=usd%2Ceur'),
            expect.any(Object),
        );
    });

    it('throws on non-200 status', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: '',
            statusCode: 429,
            headers: {},
        });

        await expect(getCoinGeckoPrices(['bitcoin'], ['usd']))
            .rejects.toThrow('CoinGecko returned HTTP 429');
    });

    it('throws on invalid JSON', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: 'bad json',
            statusCode: 200,
            headers: {},
        });

        await expect(getCoinGeckoPrices(['bitcoin'], ['usd']))
            .rejects.toThrow('CoinGecko returned invalid JSON');
    });

    it('throws on empty response', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: '{}',
            statusCode: 200,
            headers: {},
        });

        await expect(getCoinGeckoPrices(['bitcoin'], ['usd']))
            .rejects.toThrow('CoinGecko returned no price data');
    });

    it('throws when coin not found in response', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({ ethereum: { usd: 3000 } }),
            statusCode: 200,
            headers: {},
        });

        await expect(getCoinGeckoPrices(['bitcoin'], ['usd']))
            .rejects.toThrow('no data for bitcoin');
    });
});
