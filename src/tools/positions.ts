import * as Client from '../db/client.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const positionTools: Tool[] = [
  {
    name: 'list_positions',
    description: 'Get all positions, optionally filtered by status',
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
    name: 'add_position',
    description: 'Create a new position',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        shares: {
          type: 'number',
          description: 'Number of shares',
        },
        avgCostPerShare: {
          type: 'number',
          description: 'Average cost per share',
        },
        purchaseDate: {
          type: 'string',
          description: 'Purchase date (ISO8601)',
        },
      },
      required: ['ticker', 'shares', 'avgCostPerShare', 'purchaseDate'],
    },
  },
  {
    name: 'update_position',
    description: 'Update position shares or average cost',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Position ID',
        },
        shares: {
          type: 'number',
          description: 'New number of shares',
        },
        avgCostPerShare: {
          type: 'number',
          description: 'New average cost per share',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'close_position',
    description: 'Close a position',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Position ID',
        },
        closeDate: {
          type: 'string',
          description: 'Close date (ISO8601)',
        },
      },
      required: ['id', 'closeDate'],
    },
  },
  {
    name: 'add_position_comment',
    description: 'Add a comment to a position',
    inputSchema: {
      type: 'object',
      properties: {
        positionId: {
          type: 'string',
          description: 'Position ID',
        },
        text: {
          type: 'string',
          description: 'Comment text',
        },
      },
      required: ['positionId', 'text'],
    },
  },
  {
    name: 'list_position_comments',
    description: 'Get all comments on a position',
    inputSchema: {
      type: 'object',
      properties: {
        positionId: {
          type: 'string',
          description: 'Position ID',
        },
      },
      required: ['positionId'],
    },
  },
  {
    name: 'get_position_summary',
    description: 'Get portfolio position summary stats',
    inputSchema: {
      type: 'object',
      properties: {},
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

    case 'add_position':
      return Client.addPosition(
        params.ticker as string,
        params.shares as number,
        params.avgCostPerShare as number,
        params.purchaseDate as string
      );

    case 'update_position':
      return Client.updatePosition(
        params.id as string,
        params.shares as number | undefined,
        params.avgCostPerShare as number | undefined
      );

    case 'close_position':
      return Client.closePosition(params.id as string, params.closeDate as string);

    case 'add_position_comment':
      return Client.addPositionComment(params.positionId as string, params.text as string);

    case 'list_position_comments':
      return Client.listPositionComments(params.positionId as string);

    case 'get_position_summary':
      return Client.getPositionSummary();

    default:
      throw new Error(`Unknown position tool: ${name}`);
  }
}
