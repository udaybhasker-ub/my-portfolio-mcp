import * as Client from '../db/client.js';
import { getPositionsWithMarketData } from '../positions/stats.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const positionTools: Tool[] = [
  {
    name: 'list_positions',
    description: 'Get all positions (auto-derived from transaction history), optionally filtered by status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['OPEN', 'CLOSED'],
          description: 'Optional: filter by status',
        },
      },
    },
  },
  {
    name: 'add_position_comment',
    description: 'Add a comment to a position',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        text: {
          type: 'string',
          description: 'Comment text',
        },
      },
      required: ['ticker', 'text'],
    },
  },
  {
    name: 'list_position_comments',
    description: 'Get all comments on a position',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_position_summary',
    description:
      'Get all positions enriched with live prices, market value, and unrealized gain/loss, optionally filtered by status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['OPEN', 'CLOSED'],
          description: 'Optional: filter by status',
        },
      },
    },
  },
];

export async function handlePositionTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'list_positions':
      return Client.listPositions(params.status as 'OPEN' | 'CLOSED' | undefined);

    case 'add_position_comment':
      return Client.addPositionComment(params.ticker as string, params.text as string);

    case 'list_position_comments':
      return Client.listPositionComments(params.ticker as string);

    case 'get_position_summary':
      return getPositionsWithMarketData(params.status as 'OPEN' | 'CLOSED' | undefined);

    default:
      throw new Error(`Unknown position tool: ${name}`);
  }
}
