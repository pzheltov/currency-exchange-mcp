/** ISO 4217 fiat currency codes — major world currencies. */
export const FIAT_CODES = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'AED',
    'SAR', 'KWD', 'QAR', 'BHD', 'OMR', 'SGD', 'HKD', 'KRW', 'BRL', 'MXN',
    'ZAR', 'TRY', 'THB', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
    'RON', 'BGN', 'HRK', 'ISK', 'RUB', 'UAH', 'ILS', 'EGP', 'NGN', 'KES',
    'GHS', 'PKR', 'BDT', 'LKR', 'VND', 'PHP', 'IDR', 'MYR', 'TWD', 'ARS',
    'CLP', 'COP', 'PEN', 'UYU', 'MAD', 'TND', 'JOD', 'LBP', 'IQD', 'IRR',
]);

/** Crypto symbol → provider ID mapping. */
export const CRYPTO_MAP: Record<string, { coinbaseId: string; coingeckoId: string }> = {
    BTC: { coinbaseId: 'BTC', coingeckoId: 'bitcoin' },
    ETH: { coinbaseId: 'ETH', coingeckoId: 'ethereum' },
    SOL: { coinbaseId: 'SOL', coingeckoId: 'solana' },
    DOGE: { coinbaseId: 'DOGE', coingeckoId: 'dogecoin' },
    ADA: { coinbaseId: 'ADA', coingeckoId: 'cardano' },
    DOT: { coinbaseId: 'DOT', coingeckoId: 'polkadot' },
    AVAX: { coinbaseId: 'AVAX', coingeckoId: 'avalanche-2' },
    MATIC: { coinbaseId: 'MATIC', coingeckoId: 'matic-network' },
    LINK: { coinbaseId: 'LINK', coingeckoId: 'chainlink' },
    UNI: { coinbaseId: 'UNI', coingeckoId: 'uniswap' },
    XRP: { coinbaseId: 'XRP', coingeckoId: 'ripple' },
    LTC: { coinbaseId: 'LTC', coingeckoId: 'litecoin' },
    BCH: { coinbaseId: 'BCH', coingeckoId: 'bitcoin-cash' },
    ATOM: { coinbaseId: 'ATOM', coingeckoId: 'cosmos' },
    NEAR: { coinbaseId: 'NEAR', coingeckoId: 'near' },
    APT: { coinbaseId: 'APT', coingeckoId: 'aptos' },
    ARB: { coinbaseId: 'ARB', coingeckoId: 'arbitrum' },
    OP: { coinbaseId: 'OP', coingeckoId: 'optimism' },
    SHIB: { coinbaseId: 'SHIB', coingeckoId: 'shiba-inu' },
    USDT: { coinbaseId: 'USDT', coingeckoId: 'tether' },
    USDC: { coinbaseId: 'USDC', coingeckoId: 'usd-coin' },
    BNB: { coinbaseId: 'BNB', coingeckoId: 'binancecoin' },
    XLM: { coinbaseId: 'XLM', coingeckoId: 'stellar' },
    ALGO: { coinbaseId: 'ALGO', coingeckoId: 'algorand' },
    FIL: { coinbaseId: 'FIL', coingeckoId: 'filecoin' },
    AAVE: { coinbaseId: 'AAVE', coingeckoId: 'aave' },
    CRO: { coinbaseId: 'CRO', coingeckoId: 'crypto-com-chain' },
    PEPE: { coinbaseId: 'PEPE', coingeckoId: 'pepe' },
    SUI: { coinbaseId: 'SUI', coingeckoId: 'sui' },
    TRX: { coinbaseId: 'TRX', coingeckoId: 'tron' },
};

/** Natural language aliases → normalized currency code. */
export const CURRENCY_ALIASES: Record<string, string> = {
    // Fiat aliases
    dollar: 'USD', dollars: 'USD', usd: 'USD', buck: 'USD', bucks: 'USD',
    euro: 'EUR', euros: 'EUR', eur: 'EUR',
    pound: 'GBP', pounds: 'GBP', gbp: 'GBP', sterling: 'GBP',
    yen: 'JPY', jpy: 'JPY',
    rupee: 'INR', rupees: 'INR', inr: 'INR',
    dirham: 'AED', dirhams: 'AED', aed: 'AED',
    riyal: 'SAR', riyals: 'SAR', sar: 'SAR',
    yuan: 'CNY', renminbi: 'CNY', rmb: 'CNY', cny: 'CNY',
    franc: 'CHF', francs: 'CHF', chf: 'CHF',
    won: 'KRW', krw: 'KRW',
    real: 'BRL', reais: 'BRL', brl: 'BRL',
    peso: 'MXN', pesos: 'MXN', mxn: 'MXN',
    rand: 'ZAR', zar: 'ZAR',
    lira: 'TRY', try: 'TRY',
    baht: 'THB', thb: 'THB',
    ringgit: 'MYR', myr: 'MYR',
    dong: 'VND', vnd: 'VND',
    naira: 'NGN', ngn: 'NGN',
    shekel: 'ILS', shekels: 'ILS', ils: 'ILS',
    // Crypto aliases
    bitcoin: 'BTC', btc: 'BTC',
    ethereum: 'ETH', ether: 'ETH', eth: 'ETH',
    solana: 'SOL', sol: 'SOL',
    dogecoin: 'DOGE', doge: 'DOGE',
    ripple: 'XRP', xrp: 'XRP',
    litecoin: 'LTC', ltc: 'LTC',
    cardano: 'ADA', ada: 'ADA',
    polkadot: 'DOT', dot: 'DOT',
    tether: 'USDT', usdt: 'USDT',
    'usd coin': 'USDC', usdc: 'USDC',
};

export interface ResolvedCurrency {
    code: string;
    type: 'fiat' | 'crypto';
}

/**
 * Resolve a user input string to a normalized currency code and type.
 * Accepts ISO 4217 codes, crypto symbols, and natural language aliases.
 */
export function resolveCurrency(input: string): ResolvedCurrency {
    const cleaned = input.trim().toLowerCase();

    if (!cleaned) {
        throw new Error('Currency code cannot be empty');
    }

    // Check aliases first (handles natural language like "dollars", "bitcoin")
    const aliased = CURRENCY_ALIASES[cleaned];
    if (aliased) {
        if (FIAT_CODES.has(aliased)) return { code: aliased, type: 'fiat' };
        if (CRYPTO_MAP[aliased]) return { code: aliased, type: 'crypto' };
    }

    // Check direct uppercase match
    const upper = cleaned.toUpperCase();

    if (FIAT_CODES.has(upper)) {
        return { code: upper, type: 'fiat' };
    }

    if (CRYPTO_MAP[upper]) {
        return { code: upper, type: 'crypto' };
    }

    throw new Error(`Unknown currency: "${input}". Use ISO 4217 codes (USD, EUR) or crypto symbols (BTC, ETH).`);
}

/** Check if a normalized code is a fiat currency. */
export function isFiat(code: string): boolean {
    return FIAT_CODES.has(code);
}

/** Check if a normalized code is a cryptocurrency. */
export function isCrypto(code: string): boolean {
    return code in CRYPTO_MAP;
}

/** Validate a date string in YYYY-MM-DD format. */
export function isValidDate(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;
    // Ensure the date components match (rejects 2024-02-30 etc.)
    const [year, month, day] = dateStr.split('-').map(Number);
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

/** Validate a date is not in the future. */
export function isNotFutureDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date <= today;
}
