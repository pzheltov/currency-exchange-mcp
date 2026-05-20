import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Actor, log } from 'apify';
import { z } from 'zod';

import { convertCurrency } from '../providers/index.js';
import { resolveCurrency } from '../utils/validation.js';

export function registerConvertCurrency(server: McpServer): void {
    server.registerTool(
        'convert_currency',
        {
            description:
                'Convert an amount from one currency to another. '
                + 'Supports 60+ fiat currencies (USD, EUR, GBP, INR, AED, etc.) and 30+ cryptocurrencies (BTC, ETH, SOL, etc.). '
                + 'Accepts ISO 4217 codes, crypto symbols, or natural language (e.g., "dollars", "bitcoin", "rupees").',
            inputSchema: {
                amount: z.number().positive().max(1_000_000_000_000).describe('Amount to convert'),
                from: z.string().min(1).max(20).describe('Source currency code or name (e.g., "USD", "BTC", "dollars")'),
                to: z.string().min(1).max(20).describe('Target currency code or name (e.g., "EUR", "INR", "bitcoin")'),
            },
        },
        async ({ amount, from, to }): Promise<CallToolResult> => {
            try {
                const fromResolved = resolveCurrency(from);
                const toResolved = resolveCurrency(to);

                if (fromResolved.code === toResolved.code) {
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                amount,
                                from: fromResolved.code,
                                to: toResolved.code,
                                result: amount,
                                rate: 1,
                                inverseRate: 1,
                                timestamp: new Date().toISOString(),
                                source: 'identity',
                                cached: false,
                            }, null, 2),
                        }],
                    };
                }

                const result = await convertCurrency(amount, fromResolved.code, toResolved.code);

                if (Actor.isAtHome()) {
                    const chargeResult = await Actor.charge({ eventName: 'currency-convert' });
                    log.info('PPE charge', {
                        event: 'currency-convert',
                        chargedCount: chargeResult.chargedCount,
                        limitReached: chargeResult.eventChargeLimitReached,
                    });
                }

                log.info(`Converted ${amount} ${fromResolved.code} → ${toResolved.code}: ${result.result}`);

                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                log.error('Error in convert_currency:', { error: (error as Error).message });
                return {
                    content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
                    isError: true,
                };
            }
        },
    );
}
