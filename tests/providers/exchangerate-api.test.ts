import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach,describe, expect, it, vi } from 'vitest';

import { getExchangeRateApiRates } from '../../src/providers/exchangerate-api.js';
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
const fixture = JSON.parse(readFileSync(`${fixturesDir}/exchangerate-api-latest.json`, 'utf-8'));

describe('getExchangeRateApiRates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses successful response with correct base and rates', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(fixture),
            statusCode: 200,
            headers: {},
        });

        const result = await getExchangeRateApiRates('USD');

        expect(result.base).toBe('USD');
        expect(result.source).toBe('exchangerate-api');
        expect(result.rates.EUR).toBe(0.9234);
        expect(result.rates.INR).toBe(83.12);
        expect(result.rates.GBP).toBe(0.7891);
        expect(Object.keys(result.rates).length).toBeGreaterThan(10);
    });

    it('throws on non-200 status', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: 'error',
            statusCode: 404,
            headers: {},
        });

        await expect(getExchangeRateApiRates('XYZ'))
            .rejects.toThrow('ExchangeRate-API returned HTTP 404');
    });

    it('throws on invalid JSON', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: 'not json',
            statusCode: 200,
            headers: {},
        });

        await expect(getExchangeRateApiRates('USD'))
            .rejects.toThrow('ExchangeRate-API returned invalid JSON');
    });

    it('throws on error result', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({ result: 'error', rates: {} }),
            statusCode: 200,
            headers: {},
        });

        await expect(getExchangeRateApiRates('USD'))
            .rejects.toThrow('ExchangeRate-API error');
    });

    it('throws when rates object is missing', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({ result: 'success', base_code: 'USD' }),
            statusCode: 200,
            headers: {},
        });

        await expect(getExchangeRateApiRates('USD'))
            .rejects.toThrow('ExchangeRate-API returned no rates');
    });
});
