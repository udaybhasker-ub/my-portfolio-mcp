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
  id: string;
  ticker: string;
  shares: number;
  avgCostPerShare: number;
  totalCostBasis: number;
  purchaseDate: string;
  closeDate: string | null;
  status: 'OPEN' | 'CLOSED';
  comments: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionComment {
  id: string;
  positionId: string;
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

export interface PositionSummary {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalCostBasis: number;
  tickers: string[];
}
