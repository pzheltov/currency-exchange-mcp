# Currency Exchange & Crypto Rates MCP Server

Real-time currency exchange rates and cryptocurrency prices via the Model Context Protocol. Convert between 60+ fiat currencies and 30+ cryptocurrencies with multi-source fallback, smart currency resolution, and historical rate lookups.

## Tools

### `convert_currency`
Convert an amount between any supported fiat or cryptocurrency pair.

**Input:**
```json
{ "amount": 100, "from": "USD", "to": "INR" }
```

**Output:**
```json
{
  "amount": 100,
  "from": "USD",
  "to": "INR",
  "result": 8312,
  "rate": 83.12,
  "inverseRate": 0.012031,
  "timestamp": "2026-02-14T12:00:00.000Z",
  "source": "exchangerate-api",
  "cached": false
}
```

Natural language works too:
```json
{ "amount": 1, "from": "bitcoin", "to": "rupees" }
```

### `batch_convert`
Convert an amount from one currency to multiple targets in a single call. More cost-effective than multiple individual conversions.

**Input:**
```json
{ "amount": 1000, "from": "USD", "to": ["EUR", "GBP", "INR", "JPY", "BTC"] }
```

**Output:**
```json
{
  "amount": 1000,
  "from": "USD",
  "conversions": [
    { "to": "EUR", "result": 920, "rate": 0.92, "inverseRate": 1.086957, "source": "exchangerate-api", "cached": false },
    { "to": "GBP", "result": 790, "rate": 0.79, "inverseRate": 1.265823, "source": "exchangerate-api", "cached": false },
    { "to": "INR", "result": 83120, "rate": 83.12, "inverseRate": 0.012031, "source": "exchangerate-api", "cached": false },
    { "to": "JPY", "result": 149500, "rate": 149.5, "inverseRate": 0.006689, "source": "exchangerate-api", "cached": false },
    { "to": "BTC", "result": 0.02, "rate": 0.00002, "inverseRate": 50000, "source": "coinbase", "cached": false }
  ],
  "timestamp": "2026-02-14T12:00:00.000Z"
}
```

Supports up to 50 targets per call. Duplicate and same-as-source currencies are automatically filtered.

### `get_exchange_rates`
Get current exchange rates for a base currency against multiple targets.

**Input:**
```json
{ "base": "USD" }
```

Returns rates for the top 20 currencies (USD, EUR, GBP, JPY, INR, AED, CAD, AUD, CHF, CNY, SGD, HKD, KRW, BRL, MXN, ZAR, TRY, THB, SAR, BTC) by default, or specify targets:

```json
{ "base": "BTC", "targets": ["USD", "EUR", "INR", "GBP"] }
```

**Output:**
```json
{
  "base": "BTC",
  "rates": {
    "USD": 51234.56,
    "EUR": 47345.12,
    "INR": 4258567.12,
    "GBP": 40567.89
  },
  "timestamp": "2026-02-14T12:00:00.000Z",
  "source": "coinbase",
  "cached": false
}
```

### `get_historical_rate`
Get historical exchange rates for a single date or a date range (max 365 days).

**Single date:**
```json
{ "base": "USD", "target": "INR", "date": "2025-01-15" }
```

**Output:**
```json
{
  "base": "USD",
  "target": "INR",
  "date": "2025-01-15",
  "rate": 86.45,
  "source": "frankfurter",
  "cached": false
}
```

**Date range:**
```json
{ "base": "USD", "target": "EUR", "startDate": "2025-01-01", "endDate": "2025-01-31" }
```

**Output:**
```json
{
  "base": "USD",
  "target": "EUR",
  "period": { "startDate": "2025-01-01", "endDate": "2025-01-31" },
  "rates": [
    { "date": "2025-01-02", "rate": 0.9234 },
    { "date": "2025-01-03", "rate": 0.9241 }
  ],
  "change": {
    "high": 0.9312,
    "low": 0.9189,
    "average": 0.9248,
    "changePct": 0.94
  },
  "source": "frankfurter",
  "cached": false
}
```

## Supported Currencies

### Fiat (60+ currencies)

| Major | Gulf/Middle East | Asia-Pacific | Americas | Europe | Africa |
|-------|-----------------|--------------|----------|--------|--------|
| USD | AED | INR | BRL | EUR | ZAR |
| EUR | SAR | JPY | MXN | GBP | NGN |
| GBP | KWD | CNY | ARS | CHF | KES |
| JPY | QAR | SGD | CLP | SEK | EGP |
| AUD | BHD | HKD | COP | NOK | GHS |
| CAD | OMR | KRW | PEN | DKK | MAD |
| CHF | JOD | TWD | UYU | PLN | TND |
| CNY | ILS | THB | | CZK | |
| INR | EGP | MYR | | HUF | |
| | IQD | PHP | | RON | |
| | IRR | IDR | | BGN | |
| | LBP | VND | | ISK | |
| | | BDT | | RUB | |
| | | PKR | | UAH | |
| | | LKR | | HRK | |

### Crypto (30 coins)

| Symbol | Name | Symbol | Name |
|--------|------|--------|------|
| BTC | Bitcoin | XRP | Ripple |
| ETH | Ethereum | LTC | Litecoin |
| SOL | Solana | BCH | Bitcoin Cash |
| DOGE | Dogecoin | ATOM | Cosmos |
| ADA | Cardano | NEAR | NEAR Protocol |
| DOT | Polkadot | APT | Aptos |
| AVAX | Avalanche | ARB | Arbitrum |
| MATIC | Polygon | OP | Optimism |
| LINK | Chainlink | SHIB | Shiba Inu |
| UNI | Uniswap | USDT | Tether |
| BNB | BNB | USDC | USD Coin |
| XLM | Stellar | ALGO | Algorand |
| FIL | Filecoin | AAVE | Aave |
| CRO | Cronos | PEPE | Pepe |
| SUI | Sui | TRX | Tron |

### Smart Currency Resolution

Accepts ISO 4217 codes, crypto symbols, and natural language:

| Input | Resolves To |
|-------|-------------|
| `USD`, `dollars`, `bucks` | USD |
| `EUR`, `euro`, `euros` | EUR |
| `GBP`, `pounds`, `sterling` | GBP |
| `INR`, `rupees`, `rupee` | INR |
| `JPY`, `yen` | JPY |
| `CNY`, `yuan`, `renminbi`, `rmb` | CNY |
| `AED`, `dirham`, `dirhams` | AED |
| `SAR`, `riyal`, `riyals` | SAR |
| `BTC`, `bitcoin` | BTC |
| `ETH`, `ethereum`, `ether` | ETH |
| `SOL`, `solana` | SOL |
| `DOGE`, `dogecoin` | DOGE |

## Data Sources

| Data | Primary | Fallback |
|------|---------|----------|
| Fiat rates (current) | ExchangeRate-API (160 currencies, daily) | fawazahmed0/exchange-api (CDN, 150+ currencies) |
| Crypto rates (current) | Coinbase Public API (200+ coins, real-time) | CoinGecko (10K+ coins, keyless) |
| Historical rates | Frankfurter.app (ECB data, 33 currencies, back to 1999) | fawazahmed0 date endpoints |

All upstream APIs are zero-auth (no API keys required).

## Features

- Multi-source fallback — automatic failover between providers
- Fiat-to-fiat, crypto-to-fiat, fiat-to-crypto, and crypto-to-crypto conversions
- Crypto-to-crypto via USD cross-rate (e.g., BTC to ETH)
- Batch conversion — convert to up to 50 currencies in a single call
- Smart currency resolution — natural language, ISO codes, and crypto symbols
- Historical rates with time-series and change statistics (high, low, average, % change)
- LRU cache with tiered TTLs — 30 min fiat, 2 min crypto, 24 hours historical
- Per-domain rate limiting (1.5s between requests to same upstream API)
- Zod schema validation on all tool inputs
- Date validation — rejects future dates, invalid formats, ranges over 365 days

## Pricing

| Event | Description | Price (USD) |
|-------|-------------|-------------|
| `currency-convert` | Single pair conversion | $0.005 |
| `batch-convert` | Convert to up to 50 currencies at once | $0.01 |
| `exchange-rates` | Exchange rates lookup | $0.005 |
| `historical-rate` | Historical rate lookup | $0.01 |

## Limitations

- **Historical crypto rates**: Not supported — Frankfurter and fawazahmed0 only cover fiat
- **Frankfurter coverage**: ~33 ECB currencies only — Gulf currencies (AED, SAR, KWD, QAR) use fawazahmed0 fallback for historical
- **Fiat rate freshness**: ExchangeRate-API updates daily, not real-time
- **Crypto rate freshness**: Cached for 2 minutes to respect upstream API limits
- **Time-series**: Only available for Frankfurter-supported (ECB) currencies
- **Upstream rate limits**: CoinGecko keyless has ~10 req/min; Coinbase ~10 req/sec
- 1MB response size cap per request
- Rate limited to 1 request per 1.5 seconds per upstream domain

## Usage

**MCP Endpoint:** `POST /mcp`

```bash
# Convert 100 USD to INR
curl -X POST https://your-actor.apify.actor/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_APIFY_API_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"convert_currency","arguments":{"amount":100,"from":"USD","to":"INR"}},"id":1}'

# Get BTC exchange rates
curl -X POST https://your-actor.apify.actor/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_APIFY_API_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_exchange_rates","arguments":{"base":"BTC","targets":["USD","EUR","INR"]}},"id":2}'

# Historical rate for a specific date
curl -X POST https://your-actor.apify.actor/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_APIFY_API_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_historical_rate","arguments":{"base":"USD","target":"INR","date":"2025-01-15"}},"id":3}'
```

## Running Locally

```bash
npm install
npm run start:dev
```

Server starts at `http://localhost:3000/mcp`.

## Deployment

```bash
apify login
apify push
```

Configure [standby mode](https://docs.apify.com/platform/actors/development/programming-interface/standby) on the Apify platform after pushing.
