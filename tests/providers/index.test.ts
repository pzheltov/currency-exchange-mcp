import { beforeEach,describe, expect, it, vi } from 'vitest';

import { getCoinbaseRates } from '../../src/providers/coinbase.js';
import { getCoinGeckoPrices } from '../../src/providers/coingecko.js';
import { getExchangeRateApiRates } from '../../src/providers/exchangerate-api.js';
import { getFawazahmed0HistoricalRate,getFawazahmed0Rates } from '../../src/providers/fawazahmed0.js';
import { getFrankfurterHistoricalRate, getFrankfurterTimeSeries } from '../../src/providers/frankfurter.js';
import { convertCurrency, getCurrentRate,getHistoricalRate, getRatesForBase } from '../../src/providers/index.js';
import { clearCache } from '../../src/utils/cache.js';

vi.mock('../../src/providers/exchangerate-api.js', () => ({
    getExchangeRateApiRates: vi.fn(),
}));

vi.mock('../../src/providers/fawazahmed0.js', () => ({
    getFawazahmed0Rates: vi.fn(),
    getFawazahmed0HistoricalRate: vi.fn(),
}));

vi.mock('../../src/providers/frankfurter.js', () => ({
    getFrankfurterRates: vi.fn(),
    getFrankfurterHistoricalRate: vi.fn(),
    getFrankfurterTimeSeries: vi.fn(),
}));

vi.mock('../../src/providers/coinbase.js', () => ({
    getCoinbaseRates: vi.fn(),
}));

vi.mock('../../src/providers/coingecko.js', () => ({
    getCoinGeckoPrices: vi.fn(),
}));

vi.mock('apify', () => ({
    log: { warning: vi.fn(), info: vi.fn(), error: vi.fn() },
    Actor: { init: vi.fn(), charge: vi.fn(), exit: vi.fn() },
}));

const mockExchangeRateApi = vi.mocked(getExchangeRateApiRates);
const mockFawazahmed0 = vi.mocked(getFawazahmed0Rates);
const mockFawazahmed0Historical = vi.mocked(getFawazahmed0HistoricalRate);
const mockFrankfurterHistorical = vi.mocked(getFrankfurterHistoricalRate);
const mockFrankfurterTimeSeries = vi.mocked(getFrankfurterTimeSeries);
const mockCoinbase = vi.mocked(getCoinbaseRates);
const mockCoinGecko = vi.mocked(getCoinGeckoPrices);

describe('getCurrentRate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('returns fiat→fiat rate from primary provider', async () => {
        mockExchangeRateApi.mockResolvedValueOnce({
            base: 'USD', rates: { INR: 83.12 }, timestamp: '2026-02-14', source: 'exchangerate-api',
        });

        const result = await getCurrentRate('USD', 'INR');
        expect(result.rate).toBe(83.12);
        expect(result.source).toBe('exchangerate-api');
    });

    it('falls back to fawazahmed0 when ExchangeRate-API fails', async () => {
        mockExchangeRateApi.mockRejectedValueOnce(new Error('API down'));
        mockFawazahmed0.mockResolvedValueOnce({
            base: 'USD', rates: { INR: 83.10 }, timestamp: '2026-02-14', source: 'fawazahmed0',
        });

        const result = await getCurrentRate('USD', 'INR');
        expect(result.rate).toBe(83.10);
        expect(result.source).toBe('fawazahmed0');
    });

    it('returns crypto→fiat rate from Coinbase', async () => {
        mockCoinbase.mockResolvedValueOnce({
            base: 'BTC', rates: { USD: 51234.56 }, timestamp: '', source: 'coinbase',
        });

        const result = await getCurrentRate('BTC', 'USD');
        expect(result.rate).toBe(51234.56);
        expect(result.source).toBe('coinbase');
    });

    it('falls back to CoinGecko when Coinbase fails', async () => {
        mockCoinbase.mockRejectedValueOnce(new Error('Coinbase down'));
        mockCoinGecko.mockResolvedValueOnce({
            base: 'BITCOIN', rates: { USD: 51200 }, timestamp: '', source: 'coingecko',
        });

        const result = await getCurrentRate('BTC', 'USD');
        expect(result.rate).toBe(51200);
        expect(result.source).toBe('coingecko');
    });

    it('returns fiat→crypto rate (inverted crypto→fiat)', async () => {
        mockCoinbase.mockResolvedValueOnce({
            base: 'BTC', rates: { USD: 50000 }, timestamp: '', source: 'coinbase',
        });

        const result = await getCurrentRate('USD', 'BTC');
        expect(result.rate).toBeCloseTo(1 / 50000, 8);
        expect(result.source).toBe('coinbase');
    });

    it('returns crypto→crypto rate via USD cross-rate', async () => {
        mockCoinbase
            .mockResolvedValueOnce({
                base: 'BTC', rates: { USD: 50000 }, timestamp: '', source: 'coinbase',
            })
            .mockResolvedValueOnce({
                base: 'ETH', rates: { USD: 2500 }, timestamp: '', source: 'coinbase',
            });

        const result = await getCurrentRate('BTC', 'ETH');
        expect(result.rate).toBe(20); // 50000/2500
        expect(result.source).toContain('coinbase');
    });
});

describe('convertCurrency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('converts fiat amount correctly', async () => {
        mockExchangeRateApi.mockResolvedValueOnce({
            base: 'USD', rates: { INR: 83.12 }, timestamp: '2026-02-14', source: 'exchangerate-api',
        });

        const result = await convertCurrency(100, 'USD', 'INR');
        expect(result.amount).toBe(100);
        expect(result.from).toBe('USD');
        expect(result.to).toBe('INR');
        expect(result.result).toBe(8312);
        expect(result.rate).toBe(83.12);
        expect(result.cached).toBe(false);
    });

    it('returns cached result on second call', async () => {
        mockExchangeRateApi.mockResolvedValueOnce({
            base: 'USD', rates: { EUR: 0.92 }, timestamp: '2026-02-14', source: 'exchangerate-api',
        });

        await convertCurrency(100, 'USD', 'EUR');
        const result2 = await convertCurrency(200, 'USD', 'EUR');

        expect(result2.cached).toBe(true);
        expect(result2.result).toBeCloseTo(184, 1);
        expect(mockExchangeRateApi).toHaveBeenCalledTimes(1); // only 1 API call
    });

    it('computes inverse rate', async () => {
        mockExchangeRateApi.mockResolvedValueOnce({
            base: 'USD', rates: { EUR: 0.92 }, timestamp: '2026-02-14', source: 'exchangerate-api',
        });

        const result = await convertCurrency(100, 'USD', 'EUR');
        expect(result.inverseRate).toBeCloseTo(1 / 0.92, 4);
    });
});

describe('getRatesForBase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('returns default top 20 targets when none specified', async () => {
        const rates: Record<string, number> = {
            EUR: 0.92, GBP: 0.79, JPY: 150, INR: 83, AED: 3.67,
            CAD: 1.35, AUD: 1.52, CHF: 0.88, CNY: 7.19, SGD: 1.34,
            HKD: 7.82, KRW: 1325, BRL: 4.95, MXN: 17.12, ZAR: 18.92,
            TRY: 30.57, THB: 35.12, SAR: 3.75,
        };
        mockExchangeRateApi.mockResolvedValueOnce({
            base: 'USD', rates, timestamp: '2026-02-14', source: 'exchangerate-api',
        });

        const result = await getRatesForBase('USD');
        expect(Object.keys(result.rates).length).toBeGreaterThan(10);
        expect(result.base).toBe('USD');
    });

    it('returns only specified targets', async () => {
        mockExchangeRateApi.mockResolvedValueOnce({
            base: 'USD', rates: { EUR: 0.92, GBP: 0.79, INR: 83 }, timestamp: '2026-02-14', source: 'exchangerate-api',
        });

        const result = await getRatesForBase('USD', ['EUR', 'GBP']);
        expect(result.rates.EUR).toBe(0.92);
        expect(result.rates.GBP).toBe(0.79);
    });

    it('handles crypto base currency', async () => {
        mockCoinbase.mockResolvedValueOnce({
            base: 'BTC', rates: { USD: 50000, EUR: 46000, INR: 4100000 }, timestamp: '', source: 'coinbase',
        });

        const result = await getRatesForBase('BTC', ['USD', 'EUR', 'INR']);
        expect(result.rates.USD).toBe(50000);
        expect(result.source).toBe('coinbase');
    });

    it('falls back to fawazahmed0 when ExchangeRate-API fails for fiat', async () => {
        mockExchangeRateApi.mockRejectedValueOnce(new Error('down'));
        mockFawazahmed0.mockResolvedValueOnce({
            base: 'USD', rates: { EUR: 0.92 }, timestamp: '2026-02-14', source: 'fawazahmed0',
        });

        const result = await getRatesForBase('USD', ['EUR']);
        expect(result.rates.EUR).toBe(0.92);
        expect(result.source).toBe('fawazahmed0');
    });
});

describe('getHistoricalRate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('returns single-date historical rate from Frankfurter', async () => {
        mockFrankfurterHistorical.mockResolvedValueOnce({
            base: 'USD', target: 'INR', date: '2025-01-15', rate: 86.45, source: 'frankfurter',
        });

        const result = await getHistoricalRate('USD', 'INR', { date: '2025-01-15' });
        expect(result.date).toBe('2025-01-15');
        expect(result.rate).toBe(86.45);
        expect(result.source).toBe('frankfurter');
        expect(result.cached).toBe(false);
    });

    it('falls back to fawazahmed0 when Frankfurter fails for single date', async () => {
        mockFrankfurterHistorical.mockRejectedValueOnce(new Error('Frankfurter down'));
        mockFawazahmed0Historical.mockResolvedValueOnce({
            base: 'USD', target: 'INR', date: '2025-01-15', rate: 86.40, source: 'fawazahmed0',
        });

        const result = await getHistoricalRate('USD', 'INR', { date: '2025-01-15' });
        expect(result.rate).toBe(86.40);
        expect(result.source).toBe('fawazahmed0');
    });

    it('returns time series with change statistics', async () => {
        mockFrankfurterTimeSeries.mockResolvedValueOnce({
            base: 'USD',
            target: 'INR',
            startDate: '2025-01-01',
            endDate: '2025-01-10',
            rates: [
                { date: '2025-01-02', rate: 85.50 },
                { date: '2025-01-03', rate: 85.80 },
                { date: '2025-01-06', rate: 86.10 },
                { date: '2025-01-07', rate: 85.95 },
                { date: '2025-01-08', rate: 86.20 },
                { date: '2025-01-09', rate: 86.45 },
                { date: '2025-01-10', rate: 86.30 },
            ],
            source: 'frankfurter',
        });

        const result = await getHistoricalRate('USD', 'INR', { startDate: '2025-01-01', endDate: '2025-01-10' });

        expect(result.rates).toHaveLength(7);
        expect(result.change).toBeDefined();
        expect(result.change!.high).toBe(86.45);
        expect(result.change!.low).toBe(85.50);
        expect(result.change!.changePct).toBeCloseTo(0.94, 1);
    });

    it('caches historical results', async () => {
        mockFrankfurterHistorical.mockResolvedValueOnce({
            base: 'USD', target: 'INR', date: '2025-01-15', rate: 86.45, source: 'frankfurter',
        });

        await getHistoricalRate('USD', 'INR', { date: '2025-01-15' });
        const result2 = await getHistoricalRate('USD', 'INR', { date: '2025-01-15' });

        expect(result2.cached).toBe(true);
        expect(mockFrankfurterHistorical).toHaveBeenCalledTimes(1);
    });

    it('throws when neither date nor range provided', async () => {
        await expect(getHistoricalRate('USD', 'INR', {}))
            .rejects.toThrow('Either date or startDate+endDate must be provided');
    });
});
