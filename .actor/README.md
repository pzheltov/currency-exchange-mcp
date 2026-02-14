# Currency Exchange & Crypto Rates MCP Server

Convert between 60+ fiat currencies and 30+ cryptocurrencies in real time. This MCP server provides reliable exchange rates with automatic failover across multiple data sources — no API keys required.

## What It Does

Connect this MCP server to any AI agent (Claude, GPT, custom agents) and give it the ability to:

- **Convert currencies** — "Convert 500 USD to EUR" or "How much is 1 bitcoin in rupees?"
- **Get exchange rates** — Current rates for any base currency against up to 50 targets
- **Look up historical rates** — Point-in-time rates or time-series data with change statistics
- **Batch convert** — Convert one amount to multiple currencies in a single call

Works with natural language input — say "dollars", "bitcoin", or "rupees" instead of memorizing currency codes.

## Why This Server

| Feature | This Server | Typical Free APIs |
|---------|-------------|-------------------|
| Multi-source fallback | 5 providers, auto-failover | Single source, fails silently |
| Fiat + crypto | Both in one server | Usually separate services |
| API keys required | None | Most require signup |
| Natural language | "dollars", "bitcoin" | ISO codes only |
| Historical + time-series | Yes, with statistics | Usually current rates only |
| Caching | Smart tiered TTLs | None (hammers upstream) |
| Rate limiting | Built-in per-domain throttle | Your problem |

## Data Sources

Rates are sourced from multiple providers with automatic failover:

- **Fiat (current):** ExchangeRate-API (primary) → fawazahmed0 CDN (fallback)
- **Crypto (current):** Coinbase Public API (primary) → CoinGecko (fallback)
- **Historical:** Frankfurter/ECB (primary) → fawazahmed0 (fallback)

All upstream APIs are public and free. No API keys, no signup, no rate limit surprises.

## Supported Currencies

**Fiat (60+):** USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, INR, AED, SAR, KWD, SGD, HKD, KRW, BRL, MXN, ZAR, and many more covering Major, Gulf/Middle East, Asia-Pacific, Americas, Europe, and Africa regions.

**Crypto (30):** BTC, ETH, SOL, DOGE, ADA, DOT, AVAX, MATIC, LINK, UNI, XRP, LTC, BNB, USDT, USDC, SHIB, NEAR, APT, ARB, OP, and more.

## Tools

### `convert_currency` — $0.005 per call
Convert an amount between any fiat or crypto pair.
```json
{ "amount": 100, "from": "USD", "to": "INR" }
{ "amount": 1, "from": "bitcoin", "to": "rupees" }
```

### `batch_convert` — $0.01 per call
Convert one amount to multiple currencies at once. More cost-effective than multiple single conversions.
```json
{ "amount": 1000, "from": "USD", "to": ["EUR", "GBP", "INR", "JPY", "BTC"] }
```

### `get_exchange_rates` — $0.005 per call
Get rates for a base currency against multiple targets (default: top 20 currencies).
```json
{ "base": "BTC", "targets": ["USD", "EUR", "INR", "GBP"] }
```

### `get_historical_rate` — $0.01 per call
Historical rates for a single date or date range (max 365 days) with change statistics.
```json
{ "base": "USD", "target": "EUR", "startDate": "2025-01-01", "endDate": "2025-06-30" }
```

## Pricing

| Event | Price (USD) | Description |
|-------|-------------|-------------|
| Currency conversion | $0.005 | Single pair conversion |
| Batch conversion | $0.01 | Convert to up to 50 currencies at once |
| Exchange rates | $0.005 | Rates for base against multiple targets |
| Historical rate | $0.01 | Single date or time-series with statistics |

**Example monthly costs:**
- Light usage (100 conversions/month): ~$0.50
- Medium usage (1,000 conversions/month): ~$5.00
- Heavy usage (10,000 conversions/month): ~$50.00

## Use Cases

- **Travel apps** — Show live exchange rates for destination currencies
- **Trading bots** — Get real-time crypto prices with fiat equivalents
- **Financial dashboards** — Historical trends with high/low/average statistics
- **E-commerce** — Display prices in customer's local currency
- **Accounting tools** — Historical rates for specific transaction dates
- **AI agents** — Give your agent real-time financial awareness

## Limitations (Honest)

- **Fiat rates update daily** (not real-time) — sourced from ExchangeRate-API
- **Crypto rates cached for 2 minutes** — to respect upstream API limits
- **No historical crypto rates** — Frankfurter and fawazahmed0 only cover fiat
- **Time-series limited to ECB currencies** (~33 pairs) via Frankfurter
- **Date ranges capped at 365 days**
- Precision: 6 decimal places (standard for display, not for high-frequency trading)

## How to Connect

Use the MCP endpoint URL from your Actor deployment:

```
POST https://<your-actor>.apify.actor/mcp
Authorization: Bearer YOUR_APIFY_API_TOKEN
Content-Type: application/json
```

The server uses the standard MCP JSON-RPC 2.0 protocol — compatible with any MCP client.
