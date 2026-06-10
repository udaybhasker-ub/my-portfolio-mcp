import * as Client from '../db/client.js';
import { getQuotes } from '../finmcp/client.js';
import * as Types from '../types.js';

function enrichPosition(
  position: Types.Position,
  currentPrice: number | undefined
): Types.PositionWithMarketData {
  const price = currentPrice ?? null;
  const marketValue = price !== null ? price * position.shares : null;
  const unrealizedGain = marketValue !== null ? marketValue - position.totalCostBasis : null;
  const unrealizedGainPct =
    unrealizedGain !== null && position.totalCostBasis > 0
      ? (unrealizedGain / position.totalCostBasis) * 100
      : null;

  return {
    ...position,
    currentPrice: price,
    marketValue,
    unrealizedGain,
    unrealizedGainPct,
  };
}

export async function getPositionsWithMarketData(
  status?: 'OPEN' | 'CLOSED'
): Promise<Types.PositionWithMarketData[]> {
  const positions = Client.listPositions(status);
  const openTickers = positions.filter((p) => p.status === 'OPEN').map((p) => p.ticker);
  const prices = await getQuotes(openTickers);

  return positions.map((p) => enrichPosition(p, prices[p.ticker]));
}

export async function getPortfolioStats(): Promise<Types.PortfolioStats> {
  const positions = await getPositionsWithMarketData();

  let openPositions = 0;
  let closedPositions = 0;
  let totalCostBasis = 0;
  let totalMarketValue = 0;
  let totalUnrealizedGain = 0;
  let totalRealizedGain = 0;
  let totalDividends = 0;

  for (const p of positions) {
    totalRealizedGain += p.realizedGain;
    totalDividends += p.totalDividends;

    if (p.status === 'OPEN') {
      openPositions++;
      totalCostBasis += p.totalCostBasis;
      totalMarketValue += p.marketValue ?? 0;
      totalUnrealizedGain += p.unrealizedGain ?? 0;
    } else {
      closedPositions++;
    }
  }

  const totalReturn = totalUnrealizedGain + totalRealizedGain + totalDividends;
  const returnPct = totalCostBasis > 0 ? (totalUnrealizedGain / totalCostBasis) * 100 : 0;

  return {
    openPositions,
    closedPositions,
    totalCostBasis,
    totalMarketValue,
    totalUnrealizedGain,
    totalRealizedGain,
    totalDividends,
    totalReturn,
    returnPct,
    transactionCount: Client.listTransactions().length,
    alertCount: Client.listAlerts().length,
    timestamp: new Date().toISOString(),
  };
}
