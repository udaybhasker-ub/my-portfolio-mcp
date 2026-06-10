import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config_ } from '../config.js';

interface GetQuoteResult {
  results?: Record<string, { data?: { regularMarketPrice?: number } }>;
}

let warnedMissingFinmcpUrl = false;

export async function getQuotes(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) {
    return {};
  }

  if (!config_.finmcpUrl) {
    if (!warnedMissingFinmcpUrl) {
      console.warn('FINMCP_URL is not set; live-price fields will be returned as null.');
      warnedMissingFinmcpUrl = true;
    }
    return {};
  }

  const client = new Client({ name: 'my-portfolio-mcp', version: '0.1.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(config_.finmcpUrl));

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: 'get_quote',
      arguments: { symbols, forceRefresh: true },
    });

    const content = result.content as Array<{ type: string; text?: string }> | undefined;
    const text = content?.find((c) => c.type === 'text')?.text;
    if (!text) return {};

    const parsed = JSON.parse(text) as GetQuoteResult;
    const prices: Record<string, number> = {};

    for (const [symbol, entry] of Object.entries(parsed.results ?? {})) {
      const price = entry?.data?.regularMarketPrice;
      if (typeof price === 'number') {
        prices[symbol] = price;
      }
    }

    return prices;
  } catch (error) {
    console.error('Failed to fetch quotes from FinMCP:', error);
    return {};
  } finally {
    await client.close();
  }
}
