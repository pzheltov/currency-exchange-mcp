import { log } from 'apify';

import { getCached, setCache } from '../utils/cache.js';
import { CRYPTO_MAP, isCrypto, isFiat } from '../utils/validation.js';
import { getCoinbaseRates } from './coinbase.js';
import { getCoinGeckoPrices } from './coingecko.js';
import { getExchangeRateApiRates } from './exchangerate-api.js';
import { getFawazahmed0HistoricalRate, getFawazahmed0Rates } from './fawazahmed0.js';
import { getFrankfurterHistoricalRate, getFrankfurterTimeSeries } from './frankfurter.js';
import type {
    ConversionResult,
    HistoricalResult,
    RatesResult,
} from './types.js';

const FIAT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CRYPTO_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const HISTORICAL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/** Top 20 default currencies for rate listings. */
const DEFAULT_TARGETS = [
    'USD', 'EUR', 'GBP', 'JPY', 'INR', 'AED', 'CAD', 'AUD', 'CHF', 'CNY',
    'SGD', 'HKD', 'KRW', 'BRL', 'MXN', 'ZAR', 'TRY', 'THB', 'SAR', 'BTC',
];

/**
 * Get the exchange rate between two currencies (fiat or crypto).
 * Uses multi-source fallback chains.
 */
export async function getCurrentRate(from: string, to: string): Promise<{ rate: number; source: string }> {
    // Fiat → Fiat
    if (isFiat(from) && isFiat(to)) {
        return getFiatRate(from, to);
    }

    // Crypto → Fiat
    if (isCrypto(from) && isFiat(to)) {
        return getCryptoToFiatRate(from, to);
    }

    // Fiat → Crypto
    if (isFiat(from) && isCrypto(to)) {
        const { rate, source } = await getCryptoToFiatRate(to, from);
        return { rate: 1 / rate, source };
    }

    // Crypto → Crypto (via USD cross-rate)
    if (isCrypto(from) && isCrypto(to)) {
        const [fromUsd, toUsd] = await Promise.all([
            getCryptoToFiatRate(from, 'USD'),
            getCryptoToFiatRate(to, 'USD'),
        ]);
        return {
            rate: fromUsd.rate / toUsd.rate,
            source: `${fromUsd.source}+${toUsd.source}`,
        };
    }

    throw new Error(`Cannot determine rate for ${from} → ${to}`);
}

/**
 * Get fiat→fiat exchange rate with fallback chain:
 * ExchangeRate-API → fawazahmed0
 */
async function getFiatRate(from: string, to: string): Promise<{ rate: number; source: string }> {
    try {
        const data = await getExchangeRateApiRates(from);
        const rate = data.rates[to];
        if (typeof rate === 'number' && rate > 0) {
            return { rate, source: 'exchangerate-api' };
        }
        throw new Error(`No rate for ${to} in ExchangeRate-API response`);
    } catch (primaryErr) {
        log.warning(`ExchangeRate-API failed for ${from}→${to}, trying fawazahmed0`, {
            error: (primaryErr as Error).message,
        });
    }

    // Fallback
    const data = await getFawazahmed0Rates(from);
    const rate = data.rates[to];
    if (typeof rate === 'number' && rate > 0) {
        return { rate, source: 'fawazahmed0' };
    }
    throw new Error(`No fiat rate available for ${from} → ${to}`);
}

/**
 * Get crypto→fiat rate with fallback chain:
 * Coinbase → CoinGecko
 */
async function getCryptoToFiatRate(crypto: string, fiat: string): Promise<{ rate: number; source: string }> {
    // Try Coinbase first
    try {
        const data = await getCoinbaseRates(crypto);
        const rate = data.rates[fiat];
        if (typeof rate === 'number' && rate > 0) {
            return { rate, source: 'coinbase' };
        }
        throw new Error(`No rate for ${fiat} in Coinbase response`);
    } catch (primaryErr) {
        log.warning(`Coinbase failed for ${crypto}→${fiat}, trying CoinGecko`, {
            error: (primaryErr as Error).message,
        });
    }

    // Fallback: CoinGecko
    const cryptoInfo = CRYPTO_MAP[crypto];
    if (!cryptoInfo) {
        throw new Error(`No CoinGecko mapping for ${crypto}`);
    }

    const data = await getCoinGeckoPrices([cryptoInfo.coingeckoId], [fiat.toLowerCase()]);
    const rate = data.rates[fiat];
    if (typeof rate === 'number' && rate > 0) {
        return { rate, source: 'coingecko' };
    }
    throw new Error(`No crypto rate available for ${crypto} → ${fiat}`);
}

/**
 * Convert an amount from one currency to another.
 * Precision: 6 decimal places via Math.round(x * 1e6) / 1e6.
 * IEEE 754 double-precision is accurate to ~15 significant digits,
 * so results are reliable for amounts up to the 1 trillion max.
 */
export async function convertCurrency(amount: number, from: string, to: string): Promise<ConversionResult> {
    const cacheKey = `convert:${from}:${to}`;
    const cachedRate = getCached<{ rate: number; source: string }>(cacheKey);

    if (cachedRate) {
        return {
            amount,
            from,
            to,
            result: Math.round(amount * cachedRate.rate * 1e6) / 1e6,
            rate: cachedRate.rate,
            inverseRate: Math.round((1 / cachedRate.rate) * 1e6) / 1e6,
            timestamp: new Date().toISOString(),
            source: cachedRate.source,
            cached: true,
        };
    }

    const { rate, source } = await getCurrentRate(from, to);
    const ttl = (isCrypto(from) || isCrypto(to)) ? CRYPTO_CACHE_TTL : FIAT_CACHE_TTL;
    setCache(cacheKey, { rate, source }, ttl);

    return {
        amount,
        from,
        to,
        result: Math.round(amount * rate * 1e6) / 1e6,
        rate,
        inverseRate: Math.round((1 / rate) * 1e6) / 1e6,
        timestamp: new Date().toISOString(),
        source,
        cached: false,
    };
}

/**
 * Get exchange rates for a base currency against multiple targets.
 */
export async function getRatesForBase(base: string, targets?: string[]): Promise<RatesResult> {
    const effectiveTargets = targets && targets.length > 0
        ? targets
        : DEFAULT_TARGETS.filter((t) => t !== base);

    const cacheKey = `rates:${base}:${effectiveTargets.sort().join(',')}`;
    const cached = getCached<RatesResult>(cacheKey);
    if (cached) {
        return { ...cached, cached: true };
    }

    const rates: Record<string, number> = {};
    let source = '';

    if (isFiat(base)) {
        // Fetch all fiat rates at once, then pick targets
        try {
            const data = await getExchangeRateApiRates(base);
            source = 'exchangerate-api';
            for (const t of effectiveTargets) {
                if (isFiat(t) && typeof data.rates[t] === 'number') {
                    rates[t] = data.rates[t];
                }
            }
        } catch (err) {
            log.warning(`ExchangeRate-API failed for rates, trying fawazahmed0`, {
                error: (err as Error).message,
            });
            const data = await getFawazahmed0Rates(base);
            source = 'fawazahmed0';
            for (const t of effectiveTargets) {
                if (isFiat(t) && typeof data.rates[t] === 'number') {
                    rates[t] = data.rates[t];
                }
            }
        }

        // Handle any crypto targets in the list
        const cryptoTargets = effectiveTargets.filter(isCrypto);
        for (const ct of cryptoTargets) {
            try {
                const { rate, source: s } = await getCryptoToFiatRate(ct, base);
                rates[ct] = Math.round((1 / rate) * 1e8) / 1e8;
                if (!source.includes(s)) source += `+${s}`;
            } catch (err) {
                log.warning(`Failed to get crypto rate for ${ct}`, { error: (err as Error).message });
            }
        }
    } else if (isCrypto(base)) {
        // Crypto base: get rates against each fiat target
        try {
            const data = await getCoinbaseRates(base);
            source = 'coinbase';
            for (const t of effectiveTargets) {
                if (typeof data.rates[t] === 'number') {
                    rates[t] = data.rates[t];
                }
            }
        } catch (err) {
            log.warning(`Coinbase failed for rates, trying CoinGecko`, {
                error: (err as Error).message,
            });
            const cryptoInfo = CRYPTO_MAP[base];
            if (cryptoInfo) {
                const fiatTargets = effectiveTargets.filter(isFiat);
                const data = await getCoinGeckoPrices(
                    [cryptoInfo.coingeckoId],
                    fiatTargets.map((t) => t.toLowerCase()),
                );
                source = 'coingecko';
                for (const t of fiatTargets) {
                    if (typeof data.rates[t] === 'number') {
                        rates[t] = data.rates[t];
                    }
                }
            }
        }
    }

    const ttl = isCrypto(base) ? CRYPTO_CACHE_TTL : FIAT_CACHE_TTL;
    const result: RatesResult = {
        base,
        rates,
        timestamp: new Date().toISOString(),
        source,
        cached: false,
    };
    setCache(cacheKey, result, ttl);

    return result;
}

/**
 * Get historical exchange rate(s).
 * Single date or date range.
 */
export async function getHistoricalRate(
    base: string,
    target: string,
    options: { date?: string; startDate?: string; endDate?: string },
): Promise<HistoricalResult> {
    // Single date
    if (options.date) {
        const cacheKey = `historical:${base}:${target}:${options.date}`;
        const cached = getCached<HistoricalResult>(cacheKey);
        if (cached) {
            return { ...cached, cached: true };
        }

        const result = await fetchSingleHistoricalRate(base, target, options.date);
        setCache(cacheKey, result, HISTORICAL_CACHE_TTL);
        return result;
    }

    // Date range
    if (options.startDate && options.endDate) {
        const cacheKey = `historical:${base}:${target}:${options.startDate}:${options.endDate}`;
        const cached = getCached<HistoricalResult>(cacheKey);
        if (cached) {
            return { ...cached, cached: true };
        }

        const result = await fetchTimeSeriesRate(base, target, options.startDate, options.endDate);
        setCache(cacheKey, result, HISTORICAL_CACHE_TTL);
        return result;
    }

    throw new Error('Either date or startDate+endDate must be provided');
}

async function fetchSingleHistoricalRate(
    base: string,
    target: string,
    date: string,
): Promise<HistoricalResult> {
    // Try Frankfurter first (ECB data, fiat only)
    if (isFiat(base) && isFiat(target)) {
        try {
            const data = await getFrankfurterHistoricalRate(base, target, date);
            return {
                base: data.base,
                target: data.target,
                date: data.date,
                rate: data.rate,
                source: data.source,
                cached: false,
            };
        } catch (err) {
            log.warning(`Frankfurter historical failed, trying fawazahmed0`, {
                error: (err as Error).message,
            });
        }
    }

    // Fallback: fawazahmed0 (supports more currencies + crypto)
    const data = await getFawazahmed0HistoricalRate(base, target, date);
    return {
        base: data.base,
        target: data.target,
        date: data.date,
        rate: data.rate,
        source: data.source,
        cached: false,
    };
}

async function fetchTimeSeriesRate(
    base: string,
    target: string,
    startDate: string,
    endDate: string,
): Promise<HistoricalResult> {
    // Try Frankfurter time-series (fiat only)
    if (isFiat(base) && isFiat(target)) {
        try {
            const data = await getFrankfurterTimeSeries(base, target, startDate, endDate);
            const rateValues = data.rates.map((r) => r.rate);
            const high = Math.max(...rateValues);
            const low = Math.min(...rateValues);
            const average = Math.round((rateValues.reduce((a, b) => a + b, 0) / rateValues.length) * 1e6) / 1e6;
            const changePct = rateValues.length >= 2
                ? Math.round(((rateValues[rateValues.length - 1] - rateValues[0]) / rateValues[0]) * 10000) / 100
                : 0;

            return {
                base: data.base,
                target: data.target,
                period: { startDate: data.startDate, endDate: data.endDate },
                rates: data.rates,
                change: { high, low, average, changePct },
                source: data.source,
                cached: false,
            };
        } catch (err) {
            log.warning(`Frankfurter time-series failed`, { error: (err as Error).message });
        }
    }

    // Fallback: no time-series available from other providers for free
    throw new Error(
        `Time-series data not available for ${base}→${target}. `
        + 'Frankfurter supports ~33 ECB currencies for date ranges. '
        + 'Try a single date query instead.',
    );
}
