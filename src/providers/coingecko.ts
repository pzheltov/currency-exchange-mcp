import { log } from 'apify';

import { fetchPage } from '../utils/http.js';
import type { CryptoRatesResponse } from './types.js';

const BASE_URL = 'https://api.coingecko.com/api/v3/simple/price';

/**
 * Fetch crypto prices from CoinGecko (keyless endpoint).
 * Supports 10K+ coins, returns prices in multiple fiat currencies.
 *
 * @param coinIds CoinGecko coin IDs (e.g., ['bitcoin', 'ethereum'])
 * @param vsCurrencies Target currencies (e.g., ['usd', 'eur', 'inr'])
 */
export async function getCoinGeckoPrices(
    coinIds: string[],
    vsCurrencies: string[],
): Promise<CryptoRatesResponse> {
    const ids = coinIds.join(',');
    const vs = vsCurrencies.join(',');
    const url = `${BASE_URL}?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`;

    const { body, statusCode } = await fetchPage(url, { timeout: 10000 });

    if (statusCode !== 200) {
        throw new Error(`CoinGecko returned HTTP ${statusCode}`);
    }

    let data: Record<string, Record<string, number>>;

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('CoinGecko returned invalid JSON');
    }

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        throw new Error('CoinGecko returned no price data');
    }

    // Flatten: for a single coin, return its rates keyed by uppercase currency
    const firstCoinId = coinIds[0];
    const coinData = data[firstCoinId];

    if (!coinData || typeof coinData !== 'object') {
        throw new Error(`CoinGecko: no data for ${firstCoinId}`);
    }

    const rates: Record<string, number> = {};
    for (const [key, value] of Object.entries(coinData)) {
        if (typeof value === 'number' && value > 0) {
            rates[key.toUpperCase()] = value;
        }
    }

    log.info(`CoinGecko: fetched ${Object.keys(rates).length} rates for ${firstCoinId}`);

    return {
        base: coinIds[0].toUpperCase(),
        rates,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
    };
}
