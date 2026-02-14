import { log } from 'apify';

import { fetchPage } from '../utils/http.js';
import type { CryptoRatesResponse } from './types.js';

const BASE_URL = 'https://api.coinbase.com/v2/exchange-rates';

/**
 * Fetch crypto exchange rates from Coinbase Public API.
 * Zero-auth, 200+ cryptos, real-time pricing.
 */
export async function getCoinbaseRates(base: string): Promise<CryptoRatesResponse> {
    const url = `${BASE_URL}?currency=${encodeURIComponent(base)}`;

    const { body, statusCode } = await fetchPage(url, { timeout: 10000 });

    if (statusCode !== 200) {
        throw new Error(`Coinbase returned HTTP ${statusCode}`);
    }

    let data: {
        data: {
            currency: string;
            rates: Record<string, string>;
        };
    };

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('Coinbase returned invalid JSON');
    }

    if (!data.data?.rates || typeof data.data.rates !== 'object') {
        throw new Error('Coinbase returned no rates');
    }

    // Coinbase returns rates as strings — convert to numbers
    const rates: Record<string, number> = {};
    for (const [key, value] of Object.entries(data.data.rates)) {
        const num = parseFloat(value);
        if (!Number.isNaN(num) && num > 0) {
            rates[key] = num;
        }
    }

    log.info(`Coinbase: fetched ${Object.keys(rates).length} rates for ${base}`);

    return {
        base: data.data.currency,
        rates,
        timestamp: new Date().toISOString(),
        source: 'coinbase',
    };
}
