import { log } from 'apify';

import { fetchPage } from '../utils/http.js';
import type { FiatRatesResponse } from './types.js';

const BASE_URL = 'https://open.er-api.com/v6/latest';

/**
 * Fetch latest fiat exchange rates from ExchangeRate-API Open Access.
 * Zero-auth, ~160 currencies, daily updates.
 */
export async function getExchangeRateApiRates(base: string): Promise<FiatRatesResponse> {
    const url = `${BASE_URL}/${encodeURIComponent(base)}`;

    const { body, statusCode } = await fetchPage(url, { timeout: 10000 });

    if (statusCode !== 200) {
        throw new Error(`ExchangeRate-API returned HTTP ${statusCode}`);
    }

    let data: {
        result: string;
        base_code: string;
        time_last_update_utc: string;
        rates: Record<string, number>;
    };

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('ExchangeRate-API returned invalid JSON');
    }

    if (data.result !== 'success') {
        throw new Error(`ExchangeRate-API error: ${data.result}`);
    }

    if (!data.rates || typeof data.rates !== 'object') {
        throw new Error('ExchangeRate-API returned no rates');
    }

    log.info(`ExchangeRate-API: fetched ${Object.keys(data.rates).length} rates for ${base}`);

    return {
        base: data.base_code,
        rates: data.rates,
        timestamp: data.time_last_update_utc,
        source: 'exchangerate-api',
    };
}
