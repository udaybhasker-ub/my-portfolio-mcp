import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { z } from 'zod';

import * as DatabaseClient from './db/client.js';
import { config_ } from './config.js';
import { ensureDatabaseSynced, uploadDatabaseToDrive } from './google-drive/sync.js';
import { scheduleBackups } from './google-drive/backup.js';
import { transactionTools, handleTransactionTool } from './tools/transactions.js';
import { positionTools, handlePositionTool } from './tools/positions.js';
import { alertTools, handleAlertTool } from './tools/alerts.js';
import { dailyPositionTools, handleDailyPositionTool } from './tools/daily-positions.js';
import { utilityTools, handleUtilityTool } from './tools/utils.js';

const allTools = [
  ...transactionTools,
  ...positionTools,
  ...alertTools,
  ...dailyPositionTools,
  ...utilityTools,
];

const ListToolsRequestSchema = z.object({
  method: z.literal('tools/list'),
  params: z.object({}).optional(),
});

const CallToolRequestSchema = z.object({
  method: z.literal('tools/call'),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.unknown()),
  }),
});

class PortfolioServer {
  private server: Server;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.server = new Server(
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

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allTools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: toolParams } = request.params;

      try {
        let result: unknown;

        if (transactionTools.some((t) => t.name === name)) {
          result = await handleTransactionTool(name, toolParams);
        } else if (positionTools.some((t) => t.name === name)) {
          result = await handlePositionTool(name, toolParams);
        } else if (alertTools.some((t) => t.name === name)) {
          result = await handleAlertTool(name, toolParams);
        } else if (dailyPositionTools.some((t) => t.name === name)) {
          result = await handleDailyPositionTool(name, toolParams);
        } else if (utilityTools.some((t) => t.name === name)) {
          result = await handleUtilityTool(name, toolParams);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }

        await this.triggerSync();

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
  }

  private async triggerSync(): Promise<void> {
    try {
      await uploadDatabaseToDrive();
    } catch (error) {
      console.error('Failed to sync to Drive:', error);
    }
  }

  private startSyncInterval(): void {
    const intervalMs = config_.databaseSyncIntervalMinutes * 60 * 1000;

    this.syncInterval = setInterval(async () => {
      try {
        await uploadDatabaseToDrive();
      } catch (error) {
        console.error('Interval sync failed:', error);
      }
    }, intervalMs);
  }

  async initialize(): Promise<void> {
    try {
      DatabaseClient.initializeDatabase();
      await ensureDatabaseSynced();
      await scheduleBackups();
      this.startSyncInterval();

      console.log('Portfolio MCP server initialized');
    } catch (error) {
      console.error('Failed to initialize server:', error);
      throw error;
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Portfolio MCP server running on stdio transport');
  }
}

async function main(): Promise<void> {
  try {
    const server = new PortfolioServer();
    await server.initialize();
    await server.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Uncaught error:', error);
  process.exit(1);
});
