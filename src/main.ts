import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Actor, log } from 'apify';
import cors from 'cors';
import type { Request, Response } from 'express';
import express from 'express';

import { registerAllTools } from './tools/index.js';

await Actor.init();

const SERVER_NAME = 'currency-exchange-mcp';
const SERVER_VERSION = '1.0.0';

const getServer = () => {
    const server = new McpServer(
        { name: SERVER_NAME, version: SERVER_VERSION },
        { capabilities: { logging: {} } },
    );
    registerAllTools(server);
    return server;
};

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', exposedHeaders: ['Mcp-Session-Id'] }));

app.get('/', (req: Request, res: Response) => {
    if (req.headers['x-apify-container-server-readiness-probe']) {
        res.end('ok\n');
        return;
    }
    res.json({
        server: SERVER_NAME,
        version: SERVER_VERSION,
        status: 'running',
        tools: ['convert_currency', 'batch_convert', 'get_exchange_rates', 'get_historical_rate'],
    });
});

app.post('/mcp', async (req: Request, res: Response) => {
    const server = getServer();
    try {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => {
            void transport.close();
            void server.close();
        });
    } catch (error) {
        log.error('Error handling MCP request:', { error: (error as Error).message });
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal server error' },
                id: null,
            });
        }
    }
});

app.get('/mcp', (_req: Request, res: Response) => {
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
    }));
});

app.delete('/mcp', (_req: Request, res: Response) => {
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
    }));
});

process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection', { error: String(reason) });
    process.exit(1);
});

const PORT = process.env.APIFY_CONTAINER_PORT ? parseInt(process.env.APIFY_CONTAINER_PORT, 10) : 3000;
app.listen(PORT, () => {
    log.info(`Currency Exchange MCP server listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
    log.info('Shutting down server...');
    await Actor.exit();
    process.exit(0);
});
