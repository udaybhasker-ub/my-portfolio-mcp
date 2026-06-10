import * as Client from '../db/client.js';
import { getQuotes } from '../finmcp/client.js';
import * as Types from '../types.js';

export async function evaluateAlerts(tickerFilter?: string): Promise<Types.AlertEvaluation[]> {
  const alerts = Client.listAlerts(tickerFilter);
  if (alerts.length === 0) {
    return [];
  }

  const tickers = [...new Set(alerts.map((a) => a.ticker))];
  const prices = await getQuotes(tickers);
  const positions = Client.listPositions();
  const positionByTicker = new Map(positions.map((p) => [p.ticker, p]));

  return alerts.map((alert) => evaluateAlert(alert, prices[alert.ticker], positionByTicker.get(alert.ticker)));
}

function evaluateAlert(
  alert: Types.Alert,
  currentPrice: number | undefined,
  position: Types.Position | undefined
): Types.AlertEvaluation {
  if (currentPrice === undefined) {
    return {
      alert,
      currentPrice: null,
      triggered: false,
      details: `No live price available for ${alert.ticker}`,
    };
  }

  switch (alert.alertType) {
    case 'PRICE_ABOVE': {
      const triggered = currentPrice >= alert.threshold;
      return {
        alert,
        currentPrice,
        triggered,
        details: `Current price ${currentPrice} ${triggered ? '>=' : '<'} threshold ${alert.threshold}`,
      };
    }

    case 'PRICE_BELOW': {
      const triggered = currentPrice <= alert.threshold;
      return {
        alert,
        currentPrice,
        triggered,
        details: `Current price ${currentPrice} ${triggered ? '<=' : '>'} threshold ${alert.threshold}`,
      };
    }

    case 'GAIN_LOSS_PERCENT': {
      if (!position || position.status !== 'OPEN' || position.avgCostPerShare === 0) {
        return {
          alert,
          currentPrice,
          triggered: false,
          details: `No open position for ${alert.ticker}; cannot evaluate gain/loss percent`,
        };
      }

      const gainPct = ((currentPrice - position.avgCostPerShare) / position.avgCostPerShare) * 100;
      const triggered = alert.threshold >= 0 ? gainPct >= alert.threshold : gainPct <= alert.threshold;

      return {
        alert,
        currentPrice,
        triggered,
        details: `Position gain/loss is ${gainPct.toFixed(2)}% vs threshold ${alert.threshold}%`,
      };
    }

    default:
      return {
        alert,
        currentPrice,
        triggered: false,
        details: `Unknown alert type: ${alert.alertType}`,
      };
  }
}
