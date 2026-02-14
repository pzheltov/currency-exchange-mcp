import { log } from 'apify';
import { gotScraping } from 'got-scraping';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;
const TIMEOUT = 10000;
const MAX_RESPONSE_SIZE = 1 * 1024 * 1024; // 1MB — JSON APIs return small payloads
const MIN_DOMAIN_INTERVAL = 1500; // 1.5s between same-domain requests

const lastRequestTimes = new Map<string, number>();

export interface FetchResult {
    body: string;
    statusCode: number;
    headers: Record<string, string>;
}

function getHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return 'unknown';
    }
}

export async function fetchPage(
    url: string,
    options: {
        maxRetries?: number;
        timeout?: number;
        headers?: Record<string, string>;
    } = {},
): Promise<FetchResult> {
    const { maxRetries = MAX_RETRIES, timeout = TIMEOUT, headers = {} } = options;
    const hostname = getHostname(url);

    // Per-domain rate limiting
    const lastTime = lastRequestTimes.get(hostname);
    if (lastTime) {
        const elapsed = Date.now() - lastTime;
        if (elapsed < MIN_DOMAIN_INTERVAL) {
            await new Promise<void>((resolve) => { setTimeout(resolve, MIN_DOMAIN_INTERVAL - elapsed); });
        }
    }
    lastRequestTimes.set(hostname, Date.now());

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await gotScraping({
                url,
                timeout: { request: timeout },
                headers,
                followRedirect: true,
                maxRedirects: 5,
                responseType: 'text',
            });

            const body = response.body as string;

            if (body.length > MAX_RESPONSE_SIZE) {
                throw new Error(`Response too large: ${body.length} bytes (max ${MAX_RESPONSE_SIZE})`);
            }

            const flatHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(response.headers)) {
                if (typeof value === 'string') {
                    flatHeaders[key] = value;
                } else if (Array.isArray(value)) {
                    flatHeaders[key] = value.join(', ');
                }
            }

            return {
                body,
                statusCode: response.statusCode,
                headers: flatHeaders,
            };
        } catch (error) {
            const err = error as Error & { response?: { statusCode?: number } };

            // Non-retryable errors — rethrow immediately
            if (err.message.startsWith('Response too large')) {
                throw err;
            }

            const statusCode = err.response?.statusCode;
            const isRetryable = statusCode === 429
                || (statusCode && statusCode >= 500) || !statusCode;

            if (isRetryable && attempt < maxRetries) {
                const delay = BASE_DELAY * 2 ** attempt;
                log.warning(`Fetch attempt ${attempt + 1} failed for ${hostname}, retrying in ${delay}ms`, {
                    statusCode,
                    error: err.message,
                });
                await new Promise<void>((resolve) => { setTimeout(resolve, delay); });
                continue;
            }

            throw new Error(`Failed to fetch ${hostname}: ${err.message}`);
        }
    }

    throw new Error(`Failed to fetch ${hostname} after ${maxRetries} retries`);
}

/** Reset rate limiter (for testing). */
// eslint-disable-next-line no-underscore-dangle
export function _resetRateLimiter(): void {
    lastRequestTimes.clear();
}
