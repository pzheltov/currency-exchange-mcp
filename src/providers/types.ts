/** Response from a fiat rate provider (single base → multiple targets). */
export interface FiatRatesResponse {
    base: string;
    rates: Record<string, number>;
    timestamp: string;
    source: string;
}

/** Response from a crypto rate provider. */
export interface CryptoRatesResponse {
    base: string;
    rates: Record<string, number>;
    timestamp: string;
    source: string;
}

/** Response for a historical rate lookup. */
export interface HistoricalRateResponse {
    base: string;
    target: string;
    date: string;
    rate: number;
    source: string;
}

/** Response for a time-series rate lookup. */
export interface TimeSeriesResponse {
    base: string;
    target: string;
    startDate: string;
    endDate: string;
    rates: { date: string; rate: number }[];
    source: string;
}

/** Unified conversion result returned to the tool layer. */
export interface ConversionResult {
    amount: number;
    from: string;
    to: string;
    result: number;
    rate: number;
    inverseRate: number;
    timestamp: string;
    source: string;
    cached: boolean;
}

/** Unified rates result returned to the tool layer. */
export interface RatesResult {
    base: string;
    rates: Record<string, number>;
    timestamp: string;
    source: string;
    cached: boolean;
}

/** Unified batch conversion result returned to the tool layer. */
export interface BatchConversionResult {
    amount: number;
    from: string;
    conversions: {
        to: string;
        result: number;
        rate: number;
        inverseRate: number;
        source: string;
        cached: boolean;
    }[];
    timestamp: string;
}

/** Unified historical result returned to the tool layer. */
export interface HistoricalResult {
    base: string;
    target: string;
    date?: string;
    period?: { startDate: string; endDate: string };
    rate?: number;
    rates?: { date: string; rate: number }[];
    change?: {
        high: number;
        low: number;
        average: number;
        changePct: number;
    };
    source: string;
    cached: boolean;
}
