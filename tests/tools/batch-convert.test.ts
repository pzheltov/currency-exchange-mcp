import { Actor } from 'apify';
import { beforeEach,describe, expect, it, vi } from 'vitest';

import { convertCurrency } from '../../src/providers/index.js';
import { registerBatchConvert } from '../../src/tools/batch-convert.js';
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
    },
}));

const mockConvert = vi.mocked(convertCurrency);
const mockCharge = vi.mocked(Actor.charge);

function captureBatchTool() {
    const tools: Record<string, { schema: unknown; fn: (args: Record<string, unknown>) => Promise<unknown> }> = {};
    const mockServer = {
        registerTool: (id: string, schema: unknown, fn: (args: Record<string, unknown>) => Promise<unknown>) => {
            tools[id] = { schema, fn };
        },
    };

    registerBatchConvert(mockServer as never);
    return tools;
}

describe('batch_convert tool', () => {
    const tools = captureBatchTool();

    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('converts to multiple targets and charges once', async () => {
        mockConvert
            .mockResolvedValueOnce({
                amount: 1000, from: 'USD', to: 'EUR', result: 920, rate: 0.92,
                inverseRate: 1.086957, timestamp: '', source: 'exchangerate-api', cached: false,
            })
            .mockResolvedValueOnce({
                amount: 1000, from: 'USD', to: 'GBP', result: 790, rate: 0.79,
                inverseRate: 1.265823, timestamp: '', source: 'exchangerate-api', cached: false,
            })
            .mockResolvedValueOnce({
                amount: 1000, from: 'USD', to: 'INR', result: 83120, rate: 83.12,
                inverseRate: 0.012031, timestamp: '', source: 'exchangerate-api', cached: false,
            });

        const result = await tools.batch_convert.fn({
            amount: 1000, from: 'USD', to: ['EUR', 'GBP', 'INR'],
        }) as { content: { text: string }[] };

        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.amount).toBe(1000);
        expect(parsed.from).toBe('USD');
        expect(parsed.conversions).toHaveLength(3);
        expect(parsed.conversions[0].to).toBe('EUR');
        expect(parsed.conversions[0].result).toBe(920);
        expect(parsed.conversions[1].to).toBe('GBP');
        expect(parsed.conversions[2].to).toBe('INR');
        expect(mockCharge).toHaveBeenCalledTimes(1);
        expect(mockCharge).toHaveBeenCalledWith({ eventName: 'batch-convert' });
    });

    it('works with a single target', async () => {
        mockConvert.mockResolvedValueOnce({
            amount: 50, from: 'EUR', to: 'USD', result: 54, rate: 1.08,
            inverseRate: 0.925926, timestamp: '', source: 'exchangerate-api', cached: false,
        });

        const result = await tools.batch_convert.fn({
            amount: 50, from: 'EUR', to: ['USD'],
        }) as { content: { text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.conversions).toHaveLength(1);
        expect(parsed.conversions[0].to).toBe('USD');
    });

    it('resolves natural language currencies', async () => {
        mockConvert.mockResolvedValueOnce({
            amount: 1, from: 'BTC', to: 'USD', result: 50000, rate: 50000,
            inverseRate: 0.00002, timestamp: '', source: 'coinbase', cached: false,
        });

        await tools.batch_convert.fn({
            amount: 1, from: 'bitcoin', to: ['dollars'],
        });

        expect(mockConvert).toHaveBeenCalledWith(1, 'BTC', 'USD');
    });

    it('deduplicates target currencies', async () => {
        mockConvert.mockResolvedValueOnce({
            amount: 100, from: 'USD', to: 'EUR', result: 92, rate: 0.92,
            inverseRate: 1.086957, timestamp: '', source: 'exchangerate-api', cached: false,
        });

        const result = await tools.batch_convert.fn({
            amount: 100, from: 'USD', to: ['EUR', 'EUR', 'euros'],
        }) as { content: { text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.conversions).toHaveLength(1);
        expect(mockConvert).toHaveBeenCalledTimes(1);
    });

    it('filters out same-currency targets', async () => {
        mockConvert.mockResolvedValueOnce({
            amount: 100, from: 'USD', to: 'EUR', result: 92, rate: 0.92,
            inverseRate: 1.086957, timestamp: '', source: 'exchangerate-api', cached: false,
        });

        const result = await tools.batch_convert.fn({
            amount: 100, from: 'USD', to: ['USD', 'EUR'],
        }) as { content: { text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.conversions).toHaveLength(1);
        expect(parsed.conversions[0].to).toBe('EUR');
    });

    it('returns error when all targets are same as source', async () => {
        const result = await tools.batch_convert.fn({
            amount: 100, from: 'USD', to: ['USD', 'dollars'],
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('same as the source');
        expect(mockConvert).not.toHaveBeenCalled();
        expect(mockCharge).not.toHaveBeenCalled();
    });

    it('returns error on unknown currency in from', async () => {
        const result = await tools.batch_convert.fn({
            amount: 100, from: 'FAKECOIN', to: ['USD'],
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unknown currency');
    });

    it('returns error on unknown currency in targets', async () => {
        const result = await tools.batch_convert.fn({
            amount: 100, from: 'USD', to: ['FAKECOIN'],
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unknown currency');
    });

    it('handles mixed fiat and crypto targets', async () => {
        mockConvert
            .mockResolvedValueOnce({
                amount: 1000, from: 'USD', to: 'EUR', result: 920, rate: 0.92,
                inverseRate: 1.086957, timestamp: '', source: 'exchangerate-api', cached: false,
            })
            .mockResolvedValueOnce({
                amount: 1000, from: 'USD', to: 'BTC', result: 0.02, rate: 0.00002,
                inverseRate: 50000, timestamp: '', source: 'coinbase', cached: false,
            });

        const result = await tools.batch_convert.fn({
            amount: 1000, from: 'USD', to: ['EUR', 'BTC'],
        }) as { content: { text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.conversions).toHaveLength(2);
        expect(parsed.conversions[0].to).toBe('EUR');
        expect(parsed.conversions[1].to).toBe('BTC');
    });

    it('returns error when provider fails for any target', async () => {
        mockConvert.mockRejectedValueOnce(new Error('All providers failed'));

        const result = await tools.batch_convert.fn({
            amount: 100, from: 'USD', to: ['EUR'],
        }) as { isError: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('All providers failed');
    });

    it('includes timestamp in response', async () => {
        mockConvert.mockResolvedValueOnce({
            amount: 100, from: 'USD', to: 'EUR', result: 92, rate: 0.92,
            inverseRate: 1.086957, timestamp: '', source: 'exchangerate-api', cached: false,
        });

        const result = await tools.batch_convert.fn({
            amount: 100, from: 'USD', to: ['EUR'],
        }) as { content: { text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.timestamp).toBeDefined();
        expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });
});
