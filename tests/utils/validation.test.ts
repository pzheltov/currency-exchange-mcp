import { describe, expect,it } from 'vitest';

import {
    CRYPTO_MAP,
    CURRENCY_ALIASES,
    FIAT_CODES,
    isCrypto,
    isFiat,
    isNotFutureDate,
    isValidDate,
    resolveCurrency,
} from '../../src/utils/validation.js';

describe('resolveCurrency', () => {
    it('resolves ISO 4217 fiat codes', () => {
        expect(resolveCurrency('USD')).toEqual({ code: 'USD', type: 'fiat' });
        expect(resolveCurrency('eur')).toEqual({ code: 'EUR', type: 'fiat' });
        expect(resolveCurrency('Inr')).toEqual({ code: 'INR', type: 'fiat' });
    });

    it('resolves crypto symbols', () => {
        expect(resolveCurrency('BTC')).toEqual({ code: 'BTC', type: 'crypto' });
        expect(resolveCurrency('eth')).toEqual({ code: 'ETH', type: 'crypto' });
        expect(resolveCurrency('Sol')).toEqual({ code: 'SOL', type: 'crypto' });
    });

    it('resolves natural language fiat aliases', () => {
        expect(resolveCurrency('dollars')).toEqual({ code: 'USD', type: 'fiat' });
        expect(resolveCurrency('rupees')).toEqual({ code: 'INR', type: 'fiat' });
        expect(resolveCurrency('yen')).toEqual({ code: 'JPY', type: 'fiat' });
        expect(resolveCurrency('pounds')).toEqual({ code: 'GBP', type: 'fiat' });
        expect(resolveCurrency('euro')).toEqual({ code: 'EUR', type: 'fiat' });
        expect(resolveCurrency('dirham')).toEqual({ code: 'AED', type: 'fiat' });
        expect(resolveCurrency('riyal')).toEqual({ code: 'SAR', type: 'fiat' });
    });

    it('resolves natural language crypto aliases', () => {
        expect(resolveCurrency('bitcoin')).toEqual({ code: 'BTC', type: 'crypto' });
        expect(resolveCurrency('ethereum')).toEqual({ code: 'ETH', type: 'crypto' });
        expect(resolveCurrency('solana')).toEqual({ code: 'SOL', type: 'crypto' });
        expect(resolveCurrency('dogecoin')).toEqual({ code: 'DOGE', type: 'crypto' });
    });

    it('trims whitespace', () => {
        expect(resolveCurrency('  USD  ')).toEqual({ code: 'USD', type: 'fiat' });
        expect(resolveCurrency(' btc ')).toEqual({ code: 'BTC', type: 'crypto' });
    });

    it('throws on empty input', () => {
        expect(() => resolveCurrency('')).toThrow('Currency code cannot be empty');
        expect(() => resolveCurrency('   ')).toThrow('Currency code cannot be empty');
    });

    it('throws on unknown currency', () => {
        expect(() => resolveCurrency('XYZ123')).toThrow('Unknown currency');
        expect(() => resolveCurrency('foobar')).toThrow('Unknown currency');
    });

    it('resolves less common aliases', () => {
        expect(resolveCurrency('bucks')).toEqual({ code: 'USD', type: 'fiat' });
        expect(resolveCurrency('sterling')).toEqual({ code: 'GBP', type: 'fiat' });
        expect(resolveCurrency('renminbi')).toEqual({ code: 'CNY', type: 'fiat' });
        expect(resolveCurrency('rmb')).toEqual({ code: 'CNY', type: 'fiat' });
    });
});

describe('isFiat', () => {
    it('returns true for known fiat codes', () => {
        expect(isFiat('USD')).toBe(true);
        expect(isFiat('EUR')).toBe(true);
        expect(isFiat('INR')).toBe(true);
        expect(isFiat('AED')).toBe(true);
    });

    it('returns false for crypto codes', () => {
        expect(isFiat('BTC')).toBe(false);
        expect(isFiat('ETH')).toBe(false);
    });

    it('returns false for unknown codes', () => {
        expect(isFiat('XYZ')).toBe(false);
    });
});

describe('isCrypto', () => {
    it('returns true for known crypto codes', () => {
        expect(isCrypto('BTC')).toBe(true);
        expect(isCrypto('ETH')).toBe(true);
        expect(isCrypto('SOL')).toBe(true);
    });

    it('returns false for fiat codes', () => {
        expect(isCrypto('USD')).toBe(false);
        expect(isCrypto('EUR')).toBe(false);
    });
});

describe('isValidDate', () => {
    it('accepts valid YYYY-MM-DD dates', () => {
        expect(isValidDate('2025-01-15')).toBe(true);
        expect(isValidDate('2024-12-31')).toBe(true);
        expect(isValidDate('2020-02-29')).toBe(true); // leap year
    });

    it('rejects invalid date formats', () => {
        expect(isValidDate('15-01-2025')).toBe(false);
        expect(isValidDate('2025/01/15')).toBe(false);
        expect(isValidDate('2025-1-5')).toBe(false);
        expect(isValidDate('not-a-date')).toBe(false);
    });

    it('rejects impossible dates', () => {
        expect(isValidDate('2025-02-30')).toBe(false);
        expect(isValidDate('2025-13-01')).toBe(false);
        expect(isValidDate('2023-02-29')).toBe(false); // not leap year
    });
});

describe('isNotFutureDate', () => {
    it('accepts past dates', () => {
        expect(isNotFutureDate('2020-01-01')).toBe(true);
        expect(isNotFutureDate('2025-01-15')).toBe(true);
    });

    it('rejects far future dates', () => {
        expect(isNotFutureDate('2099-12-31')).toBe(false);
    });
});

describe('FIAT_CODES set', () => {
    it('contains major world currencies', () => {
        const majors = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'CNY', 'INR', 'AED', 'SAR'];
        for (const code of majors) {
            expect(FIAT_CODES.has(code)).toBe(true);
        }
    });

    it('contains emerging market currencies', () => {
        const emerging = ['BRL', 'MXN', 'ZAR', 'TRY', 'PKR', 'NGN', 'BDT', 'VND', 'PHP', 'IDR'];
        for (const code of emerging) {
            expect(FIAT_CODES.has(code)).toBe(true);
        }
    });
});

describe('CRYPTO_MAP', () => {
    it('maps major cryptos with correct provider IDs', () => {
        expect(CRYPTO_MAP.BTC).toEqual({ coinbaseId: 'BTC', coingeckoId: 'bitcoin' });
        expect(CRYPTO_MAP.ETH).toEqual({ coinbaseId: 'ETH', coingeckoId: 'ethereum' });
        expect(CRYPTO_MAP.SOL).toEqual({ coinbaseId: 'SOL', coingeckoId: 'solana' });
    });

    it('includes stablecoins', () => {
        expect(CRYPTO_MAP.USDT).toBeDefined();
        expect(CRYPTO_MAP.USDC).toBeDefined();
    });
});

describe('CURRENCY_ALIASES', () => {
    it('maps common English names to codes', () => {
        expect(CURRENCY_ALIASES.dollars).toBe('USD');
        expect(CURRENCY_ALIASES.bitcoin).toBe('BTC');
        expect(CURRENCY_ALIASES.rupees).toBe('INR');
    });
});
