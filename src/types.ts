export interface Transaction {
  id: string;
  ticker: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  shares: number;
  pricePerShare: number;
  totalCost: number;
  date: string;
  comments: string;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  ticker: string;
  shares: number;
  avgCostPerShare: number;
  totalCostBasis: number;
  realizedGain: number;
  totalDividends: number;
  firstPurchaseDate: string | null;
  lastTransactionDate: string | null;
  status: 'OPEN' | 'CLOSED';
  comments: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionWithMarketData extends Position {
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedGain: number | null;
  unrealizedGainPct: number | null;
}

export interface PositionComment {
  id: string;
  ticker: string;
  text: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  ticker: string;
  alertType: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'GAIN_LOSS_PERCENT';
  threshold: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertComment {
  id: string;
  alertId: string;
  text: string;
  createdAt: string;
}

export interface AlertEvaluation {
  alert: Alert;
  currentPrice: number | null;
  triggered: boolean;
  details: string;
}

export interface DailyPosition {
  id: string;
  date: string;
  ticker: string;
  shares: number;
  pricePerShare: number;
  marketValue: number;
  comments: string;
  createdAt: string;
}

export interface PortfolioStats {
  openPositions: number;
  closedPositions: number;
  totalCostBasis: number;
  totalMarketValue: number;
  totalUnrealizedGain: number;
  totalRealizedGain: number;
  totalDividends: number;
  totalReturn: number;
  returnPct: number;
  transactionCount: number;
  alertCount: number;
  timestamp: string;
}
