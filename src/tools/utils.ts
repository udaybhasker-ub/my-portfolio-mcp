import { uploadDatabaseToDrive } from '../google-drive/sync.js';
import { getPortfolioStats } from '../positions/stats.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const utilityTools: Tool[] = [
  {
    name: 'sync_portfolio_to_drive',
    description: 'Manually trigger a sync of the portfolio database to Google Drive',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_portfolio_stats',
    description: 'Get portfolio statistics and summary, including unrealized gains using live prices',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function handleUtilityTool(
  name: string,
  _params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'sync_portfolio_to_drive':
      try {
        await uploadDatabaseToDrive();
        return { success: true, message: 'Portfolio synced to Google Drive' };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }

    case 'get_portfolio_stats':
      return getPortfolioStats();

    default:
      throw new Error(`Unknown utility tool: ${name}`);
  }
}
