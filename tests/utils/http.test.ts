import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('got-scraping', () => ({
    gotScraping: vi.fn(),
}));

vi.mock('apify', () => ({
    log: { warning: vi.fn(), info: vi.fn(), error: vi.fn() },
    Actor: { init: vi.fn(), charge: vi.fn(), exit: vi.fn() },
}));

import { gotScraping } from 'got-scraping';

import { fetchPage, _resetRateLimiter } from '../../src/utils/http.js';

const mockGotScraping = vi.mocked(gotScraping);

describe('fetchPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetRateLimiter();
    });

    it('returns body and headers on success', async () => {
        mockGotScraping.mockResolvedValueOnce({
            body: '{"result":"success"}',
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
        } as never);

        const result = await fetchPage('https://api.example.com/rates');
        expect(result.body).toBe('{"result":"success"}');
        expect(result.statusCode).toBe(200);
        expect(result.headers['content-type']).toBe('application/json');
    });

    it('flattens array headers', async () => {
        mockGotScraping.mockResolvedValueOnce({
            body: '{}',
            statusCode: 200,
            headers: { 'set-cookie': ['a=1', 'b=2'] },
        } as never);

        const result = await fetchPage('https://api.example.com');
        expect(result.headers['set-cookie']).toBe('a=1, b=2');
    });

    it('retries on 429 and succeeds', async () => {
        const error429 = Object.assign(new Error('Too Many Requests'), { response: { statusCode: 429 } });
        mockGotScraping
            .mockRejectedValueOnce(error429 as never)
            .mockResolvedValueOnce({
                body: '{"ok":true}',
                statusCode: 200,
                headers: {},
            } as never);

        const result = await fetchPage('https://api.example.com', { maxRetries: 2 });
        expect(result.body).toBe('{"ok":true}');
        expect(mockGotScraping).toHaveBeenCalledTimes(2);
    });

    it('retries on 500 errors', async () => {
        const error500 = Object.assign(new Error('Internal Server Error'), { response: { statusCode: 500 } });
        mockGotScraping
            .mockRejectedValueOnce(error500 as never)
            .mockResolvedValueOnce({
                body: '{}',
                statusCode: 200,
                headers: {},
            } as never);

        const result = await fetchPage('https://api.example.com', { maxRetries: 2 });
        expect(result.statusCode).toBe(200);
    });

    it('throws on exhausted retries', async () => {
        const error = Object.assign(new Error('Server Error'), { response: { statusCode: 500 } });
        mockGotScraping.mockRejectedValue(error as never);

        await expect(fetchPage('https://api.example.com', { maxRetries: 1 }))
            .rejects.toThrow('Failed to fetch api.example.com');
    });

    it('throws immediately on response too large', async () => {
        const largeBody = 'x'.repeat(2 * 1024 * 1024); // 2MB
        mockGotScraping.mockResolvedValueOnce({
            body: largeBody,
            statusCode: 200,
            headers: {},
        } as never);

        await expect(fetchPage('https://api.example.com'))
            .rejects.toThrow('Response too large');
        expect(mockGotScraping).toHaveBeenCalledTimes(1); // no retry
    });

    it('applies per-domain rate limiting', async () => {
        mockGotScraping.mockResolvedValue({
            body: '{}',
            statusCode: 200,
            headers: {},
        } as never);

        const start = Date.now();
        await fetchPage('https://api.example.com/a');
        await fetchPage('https://api.example.com/b');
        const elapsed = Date.now() - start;

        // Second request should be delayed by ~1500ms
        expect(elapsed).toBeGreaterThanOrEqual(1400);
    });

    it('passes custom headers', async () => {
        mockGotScraping.mockResolvedValueOnce({
            body: '{}',
            statusCode: 200,
            headers: {},
        } as never);

        await fetchPage('https://api.example.com', {
            headers: { 'X-Custom': 'test' },
        });

        expect(mockGotScraping).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: { 'X-Custom': 'test' },
            }),
        );
    });

    it('handles non-retryable HTTP errors', async () => {
        const error404 = Object.assign(new Error('Not Found'), { response: { statusCode: 404 } });
        mockGotScraping.mockRejectedValueOnce(error404 as never);

        await expect(fetchPage('https://api.example.com', { maxRetries: 3 }))
            .rejects.toThrow('Failed to fetch api.example.com');
        expect(mockGotScraping).toHaveBeenCalledTimes(1); // no retry for 404
    });

    it('retries on network errors (no status code)', async () => {
        const networkError = new Error('ECONNREFUSED');
        mockGotScraping
            .mockRejectedValueOnce(networkError as never)
            .mockResolvedValueOnce({
                body: '{}',
                statusCode: 200,
                headers: {},
            } as never);

        const result = await fetchPage('https://api.example.com', { maxRetries: 2 });
        expect(result.statusCode).toBe(200);
        expect(mockGotScraping).toHaveBeenCalledTimes(2);
    });
});
