import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Actor, log } from 'apify';
import { z } from 'zod';

import { getHistoricalRate } from '../providers/index.js';
import { isNotFutureDate, isValidDate, resolveCurrency } from '../utils/validation.js';

export function registerGetHistoricalRate(server: McpServer): void {
    server.registerTool(
        'get_historical_rate',
        {
            description:
                'Get historical exchange rates for a currency pair. '
                + 'Provide a single date for a point-in-time rate, or a date range (max 365 days) for a time series with change statistics. '
                + 'Supports ECB currencies (33 pairs) via Frankfurter, with broader coverage via fawazahmed0.',
            inputSchema: {
                base: z.string().min(1).max(20).describe('Base currency code (e.g., "USD", "EUR")'),
                target: z.string().min(1).max(20).describe('Target currency code (e.g., "INR", "GBP")'),
                date: z.string().optional().describe('Single date in YYYY-MM-DD format (e.g., "2025-01-15")'),
                startDate: z.string().optional().describe('Start date for range query in YYYY-MM-DD format'),
                endDate: z.string().optional().describe('End date for range query in YYYY-MM-DD format'),
            },
        },
        async ({ base, target, date, startDate, endDate }): Promise<CallToolResult> => {
            try {
                const baseResolved = resolveCurrency(base);
                const targetResolved = resolveCurrency(target);

                if (baseResolved.code === targetResolved.code) {
                    return {
                        content: [{ type: 'text', text: 'Error: base and target currencies must be different.' }],
                        isError: true,
                    };
                }

                // Validate: must provide date or startDate+endDate
                if (!date && (!startDate || !endDate)) {
                    return {
                        content: [{ type: 'text', text: 'Error: provide either "date" for a single date, or both "startDate" and "endDate" for a range.' }],
                        isError: true,
                    };
                }

                // Validate date formats
                if (date) {
                    if (!isValidDate(date)) {
                        return {
                            content: [{ type: 'text', text: `Error: invalid date format "${date}". Use YYYY-MM-DD.` }],
                            isError: true,
                        };
                    }
                    if (!isNotFutureDate(date)) {
                        return {
                            content: [{ type: 'text', text: `Error: date "${date}" is in the future.` }],
                            isError: true,
                        };
                    }
                }

                if (startDate && endDate) {
                    if (!isValidDate(startDate) || !isValidDate(endDate)) {
                        return {
                            content: [{ type: 'text', text: 'Error: invalid date format. Use YYYY-MM-DD.' }],
                            isError: true,
                        };
                    }
                    if (!isNotFutureDate(endDate)) {
                        return {
                            content: [{ type: 'text', text: `Error: endDate "${endDate}" is in the future.` }],
                            isError: true,
                        };
                    }
                    if (startDate > endDate) {
                        return {
                            content: [{ type: 'text', text: 'Error: startDate must be before endDate.' }],
                            isError: true,
                        };
                    }
                    // Max 365 days
                    const diffDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
                    if (diffDays > 365) {
                        return {
                            content: [{ type: 'text', text: 'Error: date range cannot exceed 365 days.' }],
                            isError: true,
                        };
                    }
                }

                const result = await getHistoricalRate(
                    baseResolved.code,
                    targetResolved.code,
                    { date, startDate, endDate },
                );

                const chargeResult = await Actor.charge({ eventName: 'historical-rate' });
                log.info('PPE charge', {
                    event: 'historical-rate',
                    chargedCount: chargeResult.chargedCount,
                    limitReached: chargeResult.eventChargeLimitReached,
                });

                log.info(`Historical rate fetched: ${baseResolved.code}→${targetResolved.code}`);

                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                log.error('Error in get_historical_rate:', { error: (error as Error).message });
                return {
                    content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
                    isError: true,
                };
            }
        },
    );
}
