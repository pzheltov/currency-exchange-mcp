#!/usr/bin/env node
import { appendFileSync } from 'node:fs';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LoggerText, log } from 'apify';
import type { LogLevel } from 'apify';

import { registerAllTools } from './tools/index.js';

// Stdio MCP uses stdout for JSON-RPC frames. Default Apify logger writes INFO
// to console.log (stdout), which would corrupt the protocol stream — so route
// every level to stderr, or to MCP_LOG_FILE if set.
const logFile = process.env.MCP_LOG_FILE;
class StdioLogger extends LoggerText {
    override _outputWithConsole(_level: LogLevel, line: string): void {
        if (logFile) {
            appendFileSync(logFile, `${line}\n`);
        } else {
            process.stderr.write(`${line}\n`);
        }
    }
}
log.setOptions({ logger: new StdioLogger() });

const SERVER_NAME = 'currency-exchange-mcp';
const SERVER_VERSION = '1.0.0';

const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { logging: {} } },
);
registerAllTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
