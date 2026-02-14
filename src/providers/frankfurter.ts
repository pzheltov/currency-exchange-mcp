import { log } from 'apify';

import { fetchPage } from '../utils/http.js';
import type { FiatRatesResponse, HistoricalRateResponse, TimeSeriesResponse } from './types.js';

const BASE_URL = 'https://api.frankfurter.app';

/**
 * Fetch latest rates from Frankfurter.app (ECB data).
 * Zero-auth, ~33 currencies, daily updates (weekdays only).
 */
export async function getFrankfurterRates(base: string, targets?: string[]): Promise<FiatRatesResponse> {
    let url = `${BASE_URL}/latest?from=${encodeURIComponent(base)}`;
    if (targets && targets.length > 0) {
        url += `&to=${targets.map((t) => encodeURIComponent(t)).join(',')}`;
    }

    const { body, statusCode } = await fetchPage(url, { timeout: 10000 });

    if (statusCode !== 200) {
        throw new Error(`Frankfurter returned HTTP ${statusCode}`);
    }

    let data: { base: string; date: string; rates: Record<string, number> };

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('Frankfurter returned invalid JSON');
    }

    if (!data.rates || typeof data.rates !== 'object') {
        throw new Error('Frankfurter returned no rates');
    }

    log.info(`Frankfurter: fetched ${Object.keys(data.rates).length} rates for ${base}`);

    return {
        base: data.base,
        rates: data.rates,
        timestamp: data.date,
        source: 'frankfurter',
    };
}

/**
 * Fetch a historical rate for a specific date from Frankfurter.
 */
export async function getFrankfurterHistoricalRate(
    base: string,
    target: string,
    date: string,
): Promise<HistoricalRateResponse> {
    const url = `${BASE_URL}/${encodeURIComponent(date)}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(target)}`;

    const { body, statusCode } = await fetchPage(url, { timeout: 10000 });

    if (statusCode !== 200) {
        throw new Error(`Frankfurter historical returned HTTP ${statusCode}`);
    }

    let data: { base: string; date: string; rates: Record<string, number> };

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('Frankfurter historical returned invalid JSON');
    }

    const rate = data.rates?.[target];
    if (typeof rate !== 'number') {
        throw new Error(`Frankfurter: no rate for ${target} on ${date}`);
    }

    return {
        base: data.base,
        target,
        date: data.date,
        rate,
        source: 'frankfurter',
    };
}

/**
 * Fetch time-series rates between two dates from Frankfurter.
 */
export async function getFrankfurterTimeSeries(
    base: string,
    target: string,
    startDate: string,
    endDate: string,
): Promise<TimeSeriesResponse> {
    const url = `${BASE_URL}/${encodeURIComponent(startDate)}..${encodeURIComponent(endDate)}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(target)}`;

    const { body, statusCode } = await fetchPage(url, { timeout: 15000 });

    if (statusCode !== 200) {
        throw new Error(`Frankfurter time-series returned HTTP ${statusCode}`);
    }

    let data: { base: string; start_date: string; end_date: string; rates: Record<string, Record<string, number>> };

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('Frankfurter time-series returned invalid JSON');
    }

    if (!data.rates || typeof data.rates !== 'object') {
        throw new Error('Frankfurter time-series returned no rates');
    }

    const rates = Object.entries(data.rates)
        .map(([d, r]) => ({ date: d, rate: r[target] }))
        .filter((entry) => typeof entry.rate === 'number')
        .sort((a, b) => a.date.localeCompare(b.date));

    log.info(`Frankfurter: fetched ${rates.length} data points for ${base}/${target}`);

    return {
        base: data.base,
        target,
        startDate: data.start_date,
        endDate: data.end_date,
        rates,
        source: 'frankfurter',
    };
}
