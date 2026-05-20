import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Actor, log } from 'apify';
import { z } from 'zod';

import { convertCurrency } from '../providers/index.js';
import type { BatchConversionResult } from '../providers/types.js';
import { resolveCurrency } from '../utils/validation.js';

export function registerBatchConvert(server: McpServer): void {
    server.registerTool(
        'batch_convert',
        {
            description:
                'Convert an amount from one currency to multiple target currencies in a single call. '
                + 'More cost-effective than multiple individual conversions. '
                + 'Supports 60+ fiat currencies and 30+ cryptocurrencies. '
                + 'Accepts ISO 4217 codes, crypto symbols, or natural language (e.g., "dollars", "bitcoin", "rupees").',
            inputSchema: {
                amount: z.number().positive().max(1_000_000_000_000).describe('Amount to convert'),
                from: z.string().min(1).max(20).describe('Source currency code or name (e.g., "USD", "BTC", "dollars")'),
                to: z
                    .array(z.string().min(1).max(20))
                    .min(1)
                    .max(50)
                    .describe('Target currency codes or names (e.g., ["EUR", "GBP", "bitcoin"]). Max 50 targets.'),
            },
        },
        async ({ amount, from, to }): Promise<CallToolResult> => {
            try {
                const fromResolved = resolveCurrency(from);

                const resolvedTargets = to.map((t) => {
                    const resolved = resolveCurrency(t);
                    return resolved.code;
                });

                // Deduplicate targets and filter out same-currency conversions
                const uniqueTargets = [...new Set(resolvedTargets)].filter((t) => t !== fromResolved.code);

                if (uniqueTargets.length === 0) {
                    return {
                        content: [{ type: 'text', text: 'Error: all target currencies are the same as the source currency.' }],
                        isError: true,
                    };
                }

                const results = await Promise.all(
                    uniqueTargets.map(async (target) => {
                        const result = await convertCurrency(amount, fromResolved.code, target);
                        return {
                            to: result.to,
                            result: result.result,
                            rate: result.rate,
                            inverseRate: result.inverseRate,
                            source: result.source,
                            cached: result.cached,
                        };
                    }),
                );

                if (Actor.isAtHome()) {
                    const chargeResult = await Actor.charge({ eventName: 'batch-convert' });
                    log.info('PPE charge', {
                        event: 'batch-convert',
                        chargedCount: chargeResult.chargedCount,
                        limitReached: chargeResult.eventChargeLimitReached,
                    });
                }

                const batchResult: BatchConversionResult = {
                    amount,
                    from: fromResolved.code,
                    conversions: results,
                    timestamp: new Date().toISOString(),
                };

                log.info(`Batch converted ${amount} ${fromResolved.code} → ${uniqueTargets.length} currencies`);

                return {
                    content: [{ type: 'text', text: JSON.stringify(batchResult, null, 2) }],
                };
            } catch (error) {
                log.error('Error in batch_convert:', { error: (error as Error).message });
                return {
                    content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
                    isError: true,
                };
            }
        },
    );
}
