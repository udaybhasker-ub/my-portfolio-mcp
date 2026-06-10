import 'dotenv/config';
import express from 'express';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import * as DatabaseClient from './db/client.js';
import { config_ } from './config.js';
import { ensureDatabaseSynced, uploadDatabaseToDrive } from './google-drive/sync.js';
import { scheduleBackups } from './google-drive/backup.js';
import { transactionTools, handleTransactionTool } from './tools/transactions.js';
import { positionTools, handlePositionTool } from './tools/positions.js';
import { alertTools, handleAlertTool } from './tools/alerts.js';
import { dailyPositionTools, handleDailyPositionTool } from './tools/daily-positions.js';
import { utilityTools, handleUtilityTool } from './tools/utils.js';
import { oauthRouter } from './oauth/routes.js';
import { isValidAccessToken } from './oauth/store.js';

const allTools = [
  ...transactionTools,
  ...positionTools,
  ...alertTools,
  ...dailyPositionTools,
  ...utilityTools,
];

async function triggerSync(): Promise<void> {
  try {
    await uploadDatabaseToDrive();
  } catch (error) {
    console.error('Failed to sync to Drive:', error);
  }
}

function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'my-portfolio-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolParams } = request.params;
    const params = toolParams ?? {};

    try {
      let result: unknown;

      if (transactionTools.some((t) => t.name === name)) {
        result = await handleTransactionTool(name, params);
      } else if (positionTools.some((t) => t.name === name)) {
        result = await handlePositionTool(name, params);
      } else if (alertTools.some((t) => t.name === name)) {
        result = await handleAlertTool(name, params);
      } else if (dailyPositionTools.some((t) => t.name === name)) {
        result = await handleDailyPositionTool(name, params);
      } else if (utilityTools.some((t) => t.name === name)) {
        result = await handleUtilityTool(name, params);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }

      await triggerSync();

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

function startSyncInterval(): void {
  const intervalMs = config_.databaseSyncIntervalMinutes * 60 * 1000;

  setInterval(async () => {
    try {
      await uploadDatabaseToDrive();
    } catch (error) {
      console.error('Interval sync failed:', error);
    }
  }, intervalMs);
}

function requireBearerAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

  const isStaticToken = !!token && token === config_.mcpAuthToken;
  const isOAuthToken = !!token && isValidAccessToken(token);

  if (!isStaticToken && !isOAuthToken) {
    const issuer = `${req.protocol}://${req.get('host')}`;
    res.set('WWW-Authenticate', `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource"`);
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null,
    });
    return;
  }

  next();
}

function methodNotAllowed(_req: express.Request, res: express.Response): void {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
}

async function startHttpServer(): Promise<void> {
  if (!config_.mcpAuthToken) {
    console.warn('⚠️  MCP_AUTH_TOKEN not set - Streamable HTTP transport disabled');
    return;
  }

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(oauthRouter);

  app.post('/mcp', requireBearerAuth, async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', requireBearerAuth, methodNotAllowed);
  app.delete('/mcp', requireBearerAuth, methodNotAllowed);

  app.listen(config_.port, () => {
    console.log(
      `Portfolio MCP server listening on HTTP port ${config_.port} (Streamable HTTP, bearer auth required)`
    );
  });
}

async function main(): Promise<void> {
  try {
    DatabaseClient.initializeDatabase();
    await ensureDatabaseSynced();
    await scheduleBackups();
    startSyncInterval();

    console.log('Portfolio MCP server initialized');

    const stdioServer = createMcpServer();
    await stdioServer.connect(new StdioServerTransport());
    console.log('Portfolio MCP server running on stdio transport');

    await startHttpServer();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Uncaught error:', error);
  process.exit(1);
});
