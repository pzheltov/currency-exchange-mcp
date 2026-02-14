import { log } from 'apify';

import { fetchPage } from '../utils/http.js';
import type { FiatRatesResponse, HistoricalRateResponse } from './types.js';

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';

/**
 * Fetch latest rates from fawazahmed0/exchange-api via jsDelivr CDN.
 * Zero-auth, ~150+ currencies, daily updates from GitHub Actions.
 */
export async function getFawazahmed0Rates(base: string): Promise<FiatRatesResponse> {
    const baseLower = base.toLowerCase();
    const url = `${CDN_BASE}/currencies/${encodeURIComponent(baseLower)}.json`;

    const { body, statusCode } = await fetchPage(url, { timeout: 10000 });

    if (statusCode !== 200) {
        throw new Error(`fawazahmed0 API returned HTTP ${statusCode}`);
    }

    let data: { date: string; [key: string]: unknown };

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('fawazahmed0 API returned invalid JSON');
    }

    const ratesObj = data[baseLower];
    if (!ratesObj || typeof ratesObj !== 'object') {
        throw new Error(`fawazahmed0 API: no rates found for ${base}`);
    }

    // Normalize rate keys to uppercase
    const rates: Record<string, number> = {};
    for (const [key, value] of Object.entries(ratesObj as Record<string, number>)) {
        if (typeof value === 'number' && value > 0) {
            rates[key.toUpperCase()] = value;
        }
    }

    log.info(`fawazahmed0: fetched ${Object.keys(rates).length} rates for ${base}`);

    return {
        base: base.toUpperCase(),
        rates,
        timestamp: data.date as string,
        source: 'fawazahmed0',
    };
}

/**
 * Fetch historical rate from fawazahmed0 date-based endpoint.
 */
export async function getFawazahmed0HistoricalRate(
    base: string,
    target: string,
    date: string,
): Promise<HistoricalRateResponse> {
    const baseLower = base.toLowerCase();
    const targetLower = target.toLowerCase();
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${encodeURIComponent(baseLower)}.json`;

    const { body, statusCode } = await fetchPage(url, { timeout: 10000 });

    if (statusCode !== 200) {
        throw new Error(`fawazahmed0 historical API returned HTTP ${statusCode}`);
    }

    let data: { date: string; [key: string]: unknown };

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('fawazahmed0 historical API returned invalid JSON');
    }

    const ratesObj = data[baseLower] as Record<string, number> | undefined;
    if (!ratesObj || typeof ratesObj !== 'object') {
        throw new Error(`fawazahmed0: no historical rates found for ${base} on ${date}`);
    }

    const rate = ratesObj[targetLower];
    if (typeof rate !== 'number' || rate <= 0) {
        throw new Error(`fawazahmed0: no rate for ${target} on ${date}`);
    }

    return {
        base: base.toUpperCase(),
        target: target.toUpperCase(),
        date: data.date as string,
        rate,
        source: 'fawazahmed0',
    };
}
