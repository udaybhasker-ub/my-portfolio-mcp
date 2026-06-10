import * as Client from '../db/client.js';
import * as Types from '../types.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const transactionTools: Tool[] = [
  {
    name: 'list_transactions',
    description: 'Get all transactions, optionally filtered by ticker or date range',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Optional: filter by ticker symbol',
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
  {
    name: 'add_transaction',
    description: 'Create a new transaction',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        type: {
          type: 'string',
          enum: ['BUY', 'SELL', 'DIVIDEND'],
          description: 'Type of transaction',
        },
        shares: {
          type: 'number',
          description: 'Number of shares',
        },
        pricePerShare: {
          type: 'number',
          description: 'Price per share',
        },
        date: {
          type: 'string',
          description: 'Transaction date (ISO8601)',
        },
        comments: {
          type: 'string',
          description: 'Optional comments',
        },
      },
      required: ['ticker', 'type', 'shares', 'pricePerShare', 'date'],
    },
  },
  {
    name: 'update_transaction',
    description: 'Update an existing transaction',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Transaction ID',
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
          description: 'Comments',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_transaction',
    description: 'Delete a transaction',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Transaction ID',
        },
      },
      required: ['id'],
    },
  },
];

export async function handleTransactionTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'list_transactions':
      return Client.listTransactions(
        params.ticker as string | undefined,
        params.startDate as string | undefined,
        params.endDate as string | undefined
      );

    case 'add_transaction':
      return Client.addTransaction(
        params.ticker as string,
        params.type as 'BUY' | 'SELL' | 'DIVIDEND',
        params.shares as number,
        params.pricePerShare as number,
        params.date as string,
        (params.comments as string) || ''
      );

    case 'update_transaction': {
      const updates: Partial<Omit<Types.Transaction, 'id' | 'createdAt'>> = {};
      if (params.shares !== undefined) updates.shares = params.shares as number;
      if (params.pricePerShare !== undefined) updates.pricePerShare = params.pricePerShare as number;
      if (params.comments !== undefined) updates.comments = params.comments as string;
      return Client.updateTransaction(params.id as string, updates);
    }

    case 'delete_transaction':
      Client.deleteTransaction(params.id as string);
      return { success: true };

    default:
      throw new Error(`Unknown transaction tool: ${name}`);
  }
}
