import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Actor, log } from 'apify';
import { z } from 'zod';

import { getRatesForBase } from '../providers/index.js';
import { resolveCurrency } from '../utils/validation.js';

export function registerGetExchangeRates(server: McpServer): void {
    server.registerTool(
        'get_exchange_rates',
        {
            description:
                'Get current exchange rates for a base currency against multiple target currencies. '
                + 'If no targets specified, returns top 20 major currencies (USD, EUR, GBP, JPY, INR, AED, etc.). '
                + 'Supports fiat and crypto base currencies.',
            inputSchema: {
                base: z.string().min(1).max(20).describe('Base currency code or name (e.g., "USD", "BTC", "euros")'),
                targets: z.array(z.string().min(1).max(20)).max(50).optional()
                    .describe('Target currency codes (e.g., ["EUR", "GBP", "INR"]). If omitted, returns top 20 currencies.'),
            },
        },
        async ({ base, targets }): Promise<CallToolResult> => {
            try {
                const baseResolved = resolveCurrency(base);

                // Resolve target currencies if provided
                let resolvedTargets: string[] | undefined;
                if (targets && targets.length > 0) {
                    resolvedTargets = targets.map((t) => resolveCurrency(t).code);
                }

                const result = await getRatesForBase(baseResolved.code, resolvedTargets);

                if (Actor.isAtHome()) {
                    const chargeResult = await Actor.charge({ eventName: 'exchange-rates' });
                    log.info('PPE charge', {
                        event: 'exchange-rates',
                        chargedCount: chargeResult.chargedCount,
                        limitReached: chargeResult.eventChargeLimitReached,
                    });
                }

                log.info(`Exchange rates fetched for ${baseResolved.code}: ${Object.keys(result.rates).length} pairs`);

                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                log.error('Error in get_exchange_rates:', { error: (error as Error).message });
                return {
                    content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
                    isError: true,
                };
            }
        },
    );
}
