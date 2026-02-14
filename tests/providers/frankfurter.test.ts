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
import {
    getFrankfurterRates,
    getFrankfurterHistoricalRate,
    getFrankfurterTimeSeries,
} from '../../src/providers/frankfurter.js';

const mockFetchPage = vi.mocked(fetchPage);

const fixturesDir = path.dirname(fileURLToPath(import.meta.url)) + '/../fixtures';
const latestFixture = JSON.parse(readFileSync(`${fixturesDir}/frankfurter-latest.json`, 'utf-8'));
const historicalFixture = JSON.parse(readFileSync(`${fixturesDir}/frankfurter-historical.json`, 'utf-8'));
const timeseriesFixture = JSON.parse(readFileSync(`${fixturesDir}/frankfurter-timeseries.json`, 'utf-8'));

describe('getFrankfurterRates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses latest rates response', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(latestFixture),
            statusCode: 200,
            headers: {},
        });

        const result = await getFrankfurterRates('USD');

        expect(result.base).toBe('USD');
        expect(result.source).toBe('frankfurter');
        expect(result.rates.EUR).toBe(0.9234);
        expect(result.rates.INR).toBe(83.12);
        expect(result.timestamp).toBe('2026-02-14');
    });

    it('passes target currencies as query param', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(latestFixture),
            statusCode: 200,
            headers: {},
        });

        await getFrankfurterRates('USD', ['EUR', 'GBP']);

        expect(mockFetchPage).toHaveBeenCalledWith(
            expect.stringContaining('to=EUR,GBP'),
            expect.any(Object),
        );
    });

    it('throws on non-200 status', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: '',
            statusCode: 500,
            headers: {},
        });

        await expect(getFrankfurterRates('USD'))
            .rejects.toThrow('Frankfurter returned HTTP 500');
    });

    it('throws on invalid JSON', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: 'not-json',
            statusCode: 200,
            headers: {},
        });

        await expect(getFrankfurterRates('USD'))
            .rejects.toThrow('Frankfurter returned invalid JSON');
    });
});

describe('getFrankfurterHistoricalRate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses historical rate', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(historicalFixture),
            statusCode: 200,
            headers: {},
        });

        const result = await getFrankfurterHistoricalRate('USD', 'INR', '2025-01-15');

        expect(result.base).toBe('USD');
        expect(result.target).toBe('INR');
        expect(result.date).toBe('2025-01-15');
        expect(result.rate).toBe(86.45);
        expect(result.source).toBe('frankfurter');
    });

    it('throws when target not in response', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({ base: 'USD', date: '2025-01-15', rates: { EUR: 0.92 } }),
            statusCode: 200,
            headers: {},
        });

        await expect(getFrankfurterHistoricalRate('USD', 'INR', '2025-01-15'))
            .rejects.toThrow('no rate for INR');
    });
});

describe('getFrankfurterTimeSeries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses time series with correct date sorting', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify(timeseriesFixture),
            statusCode: 200,
            headers: {},
        });

        const result = await getFrankfurterTimeSeries('USD', 'INR', '2025-01-01', '2025-01-10');

        expect(result.base).toBe('USD');
        expect(result.target).toBe('INR');
        expect(result.source).toBe('frankfurter');
        expect(result.rates).toHaveLength(7);
        expect(result.rates[0].date).toBe('2025-01-02');
        expect(result.rates[0].rate).toBe(85.50);
        expect(result.rates[6].date).toBe('2025-01-10');
        expect(result.rates[6].rate).toBe(86.30);
    });

    it('throws on non-200 status', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: '',
            statusCode: 400,
            headers: {},
        });

        await expect(getFrankfurterTimeSeries('USD', 'INR', '2025-01-01', '2025-01-10'))
            .rejects.toThrow('Frankfurter time-series returned HTTP 400');
    });

    it('throws on empty rates', async () => {
        mockFetchPage.mockResolvedValueOnce({
            body: JSON.stringify({ base: 'USD', start_date: '2025-01-01', end_date: '2025-01-10' }),
            statusCode: 200,
            headers: {},
        });

        await expect(getFrankfurterTimeSeries('USD', 'INR', '2025-01-01', '2025-01-10'))
            .rejects.toThrow('Frankfurter time-series returned no rates');
    });
});
