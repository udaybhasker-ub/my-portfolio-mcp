import * as Types from '../types.js';

export interface ComputedPosition {
  ticker: string;
  shares: number;
  avgCostPerShare: number;
  totalCostBasis: number;
  realizedGain: number;
  totalDividends: number;
  firstPurchaseDate: string | null;
  lastTransactionDate: string | null;
  status: 'OPEN' | 'CLOSED';
}

const SHARE_EPSILON = 1e-9;

export function computePosition(
  ticker: string,
  transactions: Types.Transaction[]
): ComputedPosition | null {
  const txs = transactions
    .filter((t) => t.ticker === ticker)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  if (txs.length === 0) {
    return null;
  }

  let shares = 0;
  let totalCostBasis = 0;
  let realizedGain = 0;
  let totalDividends = 0;
  let firstPurchaseDate: string | null = null;
  let lastTransactionDate: string | null = null;

  for (const tx of txs) {
    lastTransactionDate = tx.date;

    if (tx.type === 'BUY') {
      if (firstPurchaseDate === null) firstPurchaseDate = tx.date;
      shares += tx.shares;
      totalCostBasis += tx.totalCost;
    } else if (tx.type === 'SELL') {
      const avgCost = shares > 0 ? totalCostBasis / shares : 0;
      const costOfSold = avgCost * tx.shares;
      realizedGain += tx.totalCost - costOfSold;
      totalCostBasis -= costOfSold;
      shares -= tx.shares;

      if (shares < SHARE_EPSILON) {
        shares = 0;
        totalCostBasis = 0;
      }
    } else if (tx.type === 'DIVIDEND') {
      totalDividends += tx.totalCost;
    }
  }

  const avgCostPerShare = shares > 0 ? totalCostBasis / shares : 0;
  const status: 'OPEN' | 'CLOSED' = shares > 0 ? 'OPEN' : 'CLOSED';

  return {
    ticker,
    shares,
    avgCostPerShare,
    totalCostBasis,
    realizedGain,
    totalDividends,
    firstPurchaseDate,
    lastTransactionDate,
    status,
  };
}
