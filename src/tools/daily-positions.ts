import * as Client from '../db/client.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const dailyPositionTools: Tool[] = [
  {
    name: 'record_daily_position',
    description: 'Record a single daily position snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        date: {
          type: 'string',
          description: 'Date (ISO8601)',
        },
        shares: {
          type: 'number',
          description: 'Number of shares',
        },
        pricePerShare: {
          type: 'number',
          description: 'Price per share',
        },
        comments: {
          type: 'string',
          description: 'Optional comments',
        },
      },
      required: ['ticker', 'date', 'shares', 'pricePerShare'],
    },
  },
  {
    name: 'record_daily_positions_batch',
    description: 'Record multiple daily positions at once (for retroactive data)',
    inputSchema: {
      type: 'object',
      properties: {
        records: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ticker: {
                type: 'string',
              },
              date: {
                type: 'string',
              },
              shares: {
                type: 'number',
              },
              pricePerShare: {
                type: 'number',
              },
              comments: {
                type: 'string',
              },
            },
            required: ['ticker', 'date', 'shares', 'pricePerShare'],
          },
          description: 'Array of daily position records',
        },
      },
      required: ['records'],
    },
  },
  {
    name: 'list_daily_positions',
    description: 'Get daily position snapshots with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Optional: filter by ticker',
        },
        startDate: {
          type: 'string',
          description: 'Optional: filter by start date (ISO8601)',
        },
        endDate: {
          type: 'string',
          description: 'Optional: filter by end date (ISO8601)',
        },
      },
    },
  },
];

export async function handleDailyPositionTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'record_daily_position':
      return Client.recordDailyPosition(
        params.ticker as string,
        params.date as string,
        params.shares as number,
        params.pricePerShare as number,
        (params.comments as string) || ''
      );

    case 'record_daily_positions_batch': {
      const records = (params.records as Array<{
        ticker: string;
        date: string;
        shares: number;
        pricePerShare: number;
        comments?: string;
      }>).map(r => ({
        ...r,
        comments: r.comments || ''
      }));
      return Client.recordDailyPositionsBatch(records);
    }

    case 'list_daily_positions':
      return Client.listDailyPositions(
        params.ticker as string | undefined,
        params.startDate as string | undefined,
        params.endDate as string | undefined
      );

    default:
      throw new Error(`Unknown daily position tool: ${name}`);
  }
}
