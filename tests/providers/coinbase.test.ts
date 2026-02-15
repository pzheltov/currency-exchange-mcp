import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach,describe, expect, it, vi } from 'vitest';

import { getCoinbaseRates } from '../../src/providers/coinbase.js';
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
const fixture = JSON.parse(readFileSync(`${fixturesDir}/coinbase-exchange-rates.json`, 'utf-8'));

describe('getCoinbaseRates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses rates and converts strings to numbers', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(fixture),
            statusCode: 200,
            headers: {},
        });

        const result = await getCoinbaseRates('BTC');

        expect(result.base).toBe('BTC');
        expect(result.source).toBe('coinbase');
        expect(result.rates.USD).toBe(51234.56);
        expect(result.rates.INR).toBe(4258567.12);
        expect(result.rates.ETH).toBe(20.5678);
        expect(typeof result.rates.USD).toBe('number');
    });

    it('constructs correct URL with currency param', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(fixture),
            statusCode: 200,
            headers: {},
        });

        await getCoinbaseRates('ETH');

        expect(mockFetchPage).toHaveBeenCalledWith(
            expect.stringContaining('currency=ETH'),
            expect.any(Object),
        );
    });

    it('throws on non-200 status', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: 'error',
            statusCode: 403,
            headers: {},
        });

        await expect(getCoinbaseRates('BTC'))
            .rejects.toThrow('Coinbase returned HTTP 403');
    });

    it('throws on invalid JSON', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: 'not json',
            statusCode: 200,
            headers: {},
        });

        await expect(getCoinbaseRates('BTC'))
            .rejects.toThrow('Coinbase returned invalid JSON');
    });

    it('throws when rates are missing', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({ data: { currency: 'BTC' } }),
            statusCode: 200,
            headers: {},
        });

        await expect(getCoinbaseRates('BTC'))
            .rejects.toThrow('Coinbase returned no rates');
    });

    it('filters out invalid rate values', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({
                data: {
                    currency: 'BTC',
                    rates: { USD: '50000', EUR: 'invalid', GBP: '0', JPY: '-100' },
                },
            }),
            statusCode: 200,
            headers: {},
        });

        const result = await getCoinbaseRates('BTC');
        expect(result.rates.USD).toBe(50000);
        expect(result.rates.EUR).toBeUndefined(); // NaN filtered
        expect(result.rates.GBP).toBeUndefined(); // zero filtered
        expect(result.rates.JPY).toBeUndefined(); // negative filtered
    });
});
