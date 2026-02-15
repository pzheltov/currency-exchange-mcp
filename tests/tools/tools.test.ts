import { Actor } from 'apify';
import { beforeEach,describe, expect, it, vi } from 'vitest';

import { convertCurrency, getHistoricalRate,getRatesForBase } from '../../src/providers/index.js';
import { registerConvertCurrency } from '../../src/tools/convert-currency.js';
import { registerGetExchangeRates } from '../../src/tools/get-exchange-rates.js';
import { registerGetHistoricalRate } from '../../src/tools/get-historical-rate.js';
import { registerAllTools } from '../../src/tools/index.js';
import { clearCache } from '../../src/utils/cache.js';

vi.mock('../../src/providers/index.js', () => ({
    convertCurrency: vi.fn(),
    getRatesForBase: vi.fn(),
    getHistoricalRate: vi.fn(),
    getCurrentRate: vi.fn(),
}));

vi.mock('apify', () => ({
    log: { warning: vi.fn(), info: vi.fn(), error: vi.fn() },
    Actor: {
        init: vi.fn(),
        charge: vi.fn().mockResolvedValue({ chargedCount: 1, eventChargeLimitReached: false, chargeableWithinLimit: {} }),
        exit: vi.fn(),
        getChargingManager: vi.fn().mockReturnValue({
            getPricingInfo: vi.fn().mockReturnValue({
                isPayPerEvent: false,
                pricingModel: undefined,
                maxTotalChargeUsd: 0,
                perEventPrices: {},
            }),
        }),
    },
}));

const mockConvert = vi.mocked(convertCurrency);
const mockGetRates = vi.mocked(getRatesForBase);
const mockGetHistorical = vi.mocked(getHistoricalRate);
const mockCharge = vi.mocked(Actor.charge);

// Helper to register tools and capture handlers
function captureTools() {
    const tools: Record<string, { schema: unknown; fn: (args: Record<string, unknown>) => Promise<unknown> }> = {};
    const mockServer = {
        registerTool: (id: string, schema: unknown, fn: (args: Record<string, unknown>) => Promise<unknown>) => {
            tools[id] = { schema, fn };
        },
    };

    registerConvertCurrency(mockServer as never);
    registerGetExchangeRates(mockServer as never);
    registerGetHistoricalRate(mockServer as never);

    return tools;
}

describe('registerAllTools', () => {
    it('registers all 3 tools', () => {
        const toolNames: string[] = [];
        const mockServer = {
            registerTool: (id: string) => { toolNames.push(id); },
        };

        registerAllTools(mockServer as never);

        expect(toolNames).toContain('convert_currency');
        expect(toolNames).toContain('batch_convert');
        expect(toolNames).toContain('get_exchange_rates');
        expect(toolNames).toContain('get_historical_rate');
        expect(toolNames).toHaveLength(4);
    });
});

describe('convert_currency tool', () => {
    const tools = captureTools();

    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('converts and charges on success', async () => {
        mockConvert.mockResolvedValueOnce({
            amount: 100, from: 'USD', to: 'INR', result: 8312, rate: 83.12,
            inverseRate: 0.012031, timestamp: '2026-02-14T00:00:00Z', source: 'exchangerate-api', cached: false,
        });

        const result = await tools.convert_currency.fn({ amount: 100, from: 'USD', to: 'INR' }) as { content: { text: string }[] };
        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.result).toBe(8312);
        expect(parsed.rate).toBe(83.12);
        expect(mockCharge).toHaveBeenCalledWith({ eventName: 'currency-convert' });
    });

    it('handles same-currency conversion without API call', async () => {
        const result = await tools.convert_currency.fn({ amount: 42, from: 'USD', to: 'usd' }) as { content: { text: string }[] };
        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.result).toBe(42);
        expect(parsed.rate).toBe(1);
        expect(mockConvert).not.toHaveBeenCalled();
        expect(mockCharge).not.toHaveBeenCalled();
    });

    it('resolves natural language currency names', async () => {
        mockConvert.mockResolvedValueOnce({
            amount: 1, from: 'BTC', to: 'USD', result: 50000, rate: 50000,
            inverseRate: 0.00002, timestamp: '', source: 'coinbase', cached: false,
        });

        await tools.convert_currency.fn({ amount: 1, from: 'bitcoin', to: 'dollars' });

        expect(mockConvert).toHaveBeenCalledWith(1, 'BTC', 'USD');
    });

    it('returns error on unknown currency', async () => {
        const result = await tools.convert_currency.fn({ amount: 100, from: 'FAKECOIN', to: 'USD' }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unknown currency');
    });

    it('returns error on provider failure', async () => {
        mockConvert.mockRejectedValueOnce(new Error('All providers failed'));

        const result = await tools.convert_currency.fn({ amount: 100, from: 'USD', to: 'EUR' }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('All providers failed');
    });
});

describe('get_exchange_rates tool', () => {
    const tools = captureTools();

    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('fetches rates and charges', async () => {
        mockGetRates.mockResolvedValueOnce({
            base: 'USD', rates: { EUR: 0.92, GBP: 0.79 },
            timestamp: '', source: 'exchangerate-api', cached: false,
        });

        const result = await tools.get_exchange_rates.fn({ base: 'USD' }) as { content: { text: string }[] };
        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.rates.EUR).toBe(0.92);
        expect(mockCharge).toHaveBeenCalledWith({ eventName: 'exchange-rates' });
    });

    it('passes resolved target currencies', async () => {
        mockGetRates.mockResolvedValueOnce({
            base: 'EUR', rates: { USD: 1.08 },
            timestamp: '', source: 'exchangerate-api', cached: false,
        });

        await tools.get_exchange_rates.fn({ base: 'euros', targets: ['dollars'] });

        expect(mockGetRates).toHaveBeenCalledWith('EUR', ['USD']);
    });

    it('returns error on failure', async () => {
        mockGetRates.mockRejectedValueOnce(new Error('Provider down'));

        const result = await tools.get_exchange_rates.fn({ base: 'USD' }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Provider down');
    });
});

describe('get_historical_rate tool', () => {
    const tools = captureTools();

    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('fetches single-date historical rate and charges', async () => {
        mockGetHistorical.mockResolvedValueOnce({
            base: 'USD', target: 'INR', date: '2025-01-15', rate: 86.45,
            source: 'frankfurter', cached: false,
        });

        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'INR', date: '2025-01-15',
        }) as { content: { text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.rate).toBe(86.45);
        expect(mockCharge).toHaveBeenCalledWith({ eventName: 'historical-rate' });
    });

    it('fetches date range with change stats', async () => {
        mockGetHistorical.mockResolvedValueOnce({
            base: 'USD', target: 'INR',
            period: { startDate: '2025-01-01', endDate: '2025-01-10' },
            rates: [{ date: '2025-01-02', rate: 85.5 }, { date: '2025-01-10', rate: 86.3 }],
            change: { high: 86.3, low: 85.5, average: 85.9, changePct: 0.94 },
            source: 'frankfurter', cached: false,
        });

        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'INR', startDate: '2025-01-01', endDate: '2025-01-10',
        }) as { content: { text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.change.changePct).toBe(0.94);
    });

    it('rejects same base and target', async () => {
        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'USD', date: '2025-01-15',
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('must be different');
    });

    it('rejects invalid date format', async () => {
        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'EUR', date: '15-01-2025',
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('invalid date format');
    });

    it('rejects future dates', async () => {
        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'EUR', date: '2099-12-31',
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('future');
    });

    it('rejects date range exceeding 365 days', async () => {
        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'EUR', startDate: '2023-01-01', endDate: '2025-01-01',
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('365 days');
    });

    it('rejects startDate after endDate', async () => {
        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'EUR', startDate: '2025-06-01', endDate: '2025-01-01',
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('startDate must be before');
    });

    it('requires date or startDate+endDate', async () => {
        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'EUR',
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('provide either');
    });

    it('returns error on provider failure', async () => {
        mockGetHistorical.mockRejectedValueOnce(new Error('All providers failed'));

        const result = await tools.get_historical_rate.fn({
            base: 'USD', target: 'EUR', date: '2025-01-15',
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('All providers failed');
    });
});
