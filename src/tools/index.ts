import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerBatchConvert } from './batch-convert.js';
import { registerConvertCurrency } from './convert-currency.js';
import { registerGetExchangeRates } from './get-exchange-rates.js';
import { registerGetHistoricalRate } from './get-historical-rate.js';

export function registerAllTools(server: McpServer): void {
    registerConvertCurrency(server);
    registerBatchConvert(server);
    registerGetExchangeRates(server);
    registerGetHistoricalRate(server);
}
