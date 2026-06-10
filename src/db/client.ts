import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { initializeSchema, getDatabase } from './schema.js';
import * as Types from '../types.js';

let dbInstance: Database.Database | null = null;

export function initializeDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = getDatabase();
    initializeSchema(dbInstance);
  }
  return dbInstance;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  return dbInstance;
}

export function addTransaction(
  ticker: string,
  type: 'BUY' | 'SELL' | 'DIVIDEND',
  shares: number,
  pricePerShare: number,
  date: string,
  comments: string
): Types.Transaction {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const totalCost = shares * pricePerShare;

  const stmt = db.prepare(`
    INSERT INTO transactions (id, ticker, type, shares, pricePerShare, totalCost, date, comments, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, ticker, type, shares, pricePerShare, totalCost, date, comments, now, now);

  return {
    id,
    ticker,
    type,
    shares,
    pricePerShare,
    totalCost,
    date,
    comments,
    createdAt: now,
    updatedAt: now,
  };
}

export function listTransactions(
  tickerFilter?: string,
  startDate?: string,
  endDate?: string
): Types.Transaction[] {
  const db = getDb();
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params: unknown[] = [];

  if (tickerFilter) {
    query += ' AND ticker = ?';
    params.push(tickerFilter);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC';
  const stmt = db.prepare(query);
  return stmt.all(...params) as Types.Transaction[];
}

export function updateTransaction(
  id: string,
  updates: Partial<Omit<Types.Transaction, 'id' | 'createdAt'>>
): Types.Transaction {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as
    | Types.Transaction
    | undefined;

  if (!existing) {
    throw new Error(`Transaction ${id} not found`);
  }

  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };

  if ('shares' in updates && 'pricePerShare' in updates) {
    updated.totalCost = updates.shares! * updates.pricePerShare!;
  } else if ('shares' in updates) {
    updated.totalCost = updates.shares! * existing.pricePerShare;
  } else if ('pricePerShare' in updates) {
    updated.totalCost = existing.shares * updates.pricePerShare!;
  }

  const stmt = db.prepare(`
    UPDATE transactions
    SET ticker = ?, type = ?, shares = ?, pricePerShare = ?, totalCost = ?, date = ?, comments = ?, updatedAt = ?
    WHERE id = ?
  `);

  stmt.run(
    updated.ticker,
    updated.type,
    updated.shares,
    updated.pricePerShare,
    updated.totalCost,
    updated.date,
    updated.comments,
    updated.updatedAt,
    id
  );

  return updated;
}

export function deleteTransaction(id: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
  stmt.run(id);
}

export function addPosition(
  ticker: string,
  shares: number,
  avgCostPerShare: number,
  purchaseDate: string
): Types.Position {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const totalCostBasis = shares * avgCostPerShare;

  const stmt = db.prepare(`
    INSERT INTO positions (id, ticker, shares, avgCostPerShare, totalCostBasis, purchaseDate, closeDate, status, comments, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, ticker, shares, avgCostPerShare, totalCostBasis, purchaseDate, null, 'OPEN', '', now, now);

  return {
    id,
    ticker,
    shares,
    avgCostPerShare,
    totalCostBasis,
    purchaseDate,
    closeDate: null,
    status: 'OPEN',
    comments: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function listPositions(status?: 'OPEN' | 'CLOSED'): Types.Position[] {
  const db = getDb();
  let query = 'SELECT * FROM positions WHERE 1=1';
  const params: unknown[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY ticker ASC';
  const stmt = db.prepare(query);
  return stmt.all(...params) as Types.Position[];
}

export function updatePosition(
  id: string,
  shares?: number,
  avgCostPerShare?: number
): Types.Position {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM positions WHERE id = ?').get(id) as
    | Types.Position
    | undefined;

  if (!existing) {
    throw new Error(`Position ${id} not found`);
  }

  const newShares = shares ?? existing.shares;
  const newAvgCost = avgCostPerShare ?? existing.avgCostPerShare;
  const newTotalCostBasis = newShares * newAvgCost;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE positions
    SET shares = ?, avgCostPerShare = ?, totalCostBasis = ?, updatedAt = ?
    WHERE id = ?
  `);

  stmt.run(newShares, newAvgCost, newTotalCostBasis, now, id);

  return {
    ...existing,
    shares: newShares,
    avgCostPerShare: newAvgCost,
    totalCostBasis: newTotalCostBasis,
    updatedAt: now,
  };
}

export function closePosition(id: string, closeDate: string): Types.Position {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM positions WHERE id = ?').get(id) as
    | Types.Position
    | undefined;

  if (!existing) {
    throw new Error(`Position ${id} not found`);
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE positions
    SET status = 'CLOSED', closeDate = ?, updatedAt = ?
    WHERE id = ?
  `);

  stmt.run(closeDate, now, id);

  return { ...existing, status: 'CLOSED', closeDate, updatedAt: now };
}

export function getPositionSummary(): Types.PositionSummary {
  const db = getDb();
  const positions = listPositions();

  const summary: Types.PositionSummary = {
    totalPositions: positions.length,
    openPositions: positions.filter((p) => p.status === 'OPEN').length,
    closedPositions: positions.filter((p) => p.status === 'CLOSED').length,
    totalCostBasis: positions.reduce((sum, p) => sum + p.totalCostBasis, 0),
    tickers: [...new Set(positions.map((p) => p.ticker))],
  };

  return summary;
}

export function addPositionComment(positionId: string, text: string): Types.PositionComment {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO positionComments (id, positionId, text, createdAt) VALUES (?, ?, ?, ?)');
  stmt.run(id, positionId, text, now);

  return { id, positionId, text, createdAt: now };
}

export function listPositionComments(positionId: string): Types.PositionComment[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM positionComments WHERE positionId = ? ORDER BY createdAt ASC');
  return stmt.all(positionId) as Types.PositionComment[];
}

export function addAlert(
  ticker: string,
  alertType: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'GAIN_LOSS_PERCENT',
  threshold: number,
  description: string
): Types.Alert {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO alerts (id, ticker, alertType, threshold, description, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, ticker, alertType, threshold, description, now, now);

  return { id, ticker, alertType, threshold, description, createdAt: now, updatedAt: now };
}

export function listAlerts(tickerFilter?: string): Types.Alert[] {
  const db = getDb();
  let query = 'SELECT * FROM alerts WHERE 1=1';
  const params: unknown[] = [];

  if (tickerFilter) {
    query += ' AND ticker = ?';
    params.push(tickerFilter);
  }

  query += ' ORDER BY ticker ASC';
  const stmt = db.prepare(query);
  return stmt.all(...params) as Types.Alert[];
}

export function updateAlert(
  id: string,
  updates: Partial<Omit<Types.Alert, 'id' | 'createdAt'>>
): Types.Alert {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as Types.Alert | undefined;

  if (!existing) {
    throw new Error(`Alert ${id} not found`);
  }

  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };

  const stmt = db.prepare(`
    UPDATE alerts
    SET ticker = ?, alertType = ?, threshold = ?, description = ?, updatedAt = ?
    WHERE id = ?
  `);

  stmt.run(updated.ticker, updated.alertType, updated.threshold, updated.description, updated.updatedAt, id);

  return updated;
}

export function deleteAlert(id: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM alerts WHERE id = ?');
  stmt.run(id);
}

export function addAlertComment(alertId: string, text: string): Types.AlertComment {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO alertComments (id, alertId, text, createdAt) VALUES (?, ?, ?, ?)');
  stmt.run(id, alertId, text, now);

  return { id, alertId, text, createdAt: now };
}

export function listAlertComments(alertId: string): Types.AlertComment[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM alertComments WHERE alertId = ? ORDER BY createdAt ASC');
  return stmt.all(alertId) as Types.AlertComment[];
}

export function recordDailyPosition(
  ticker: string,
  date: string,
  shares: number,
  pricePerShare: number,
  comments: string
): Types.DailyPosition {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const marketValue = shares * pricePerShare;

  const stmt = db.prepare(`
    INSERT INTO dailyPositions (id, date, ticker, shares, pricePerShare, marketValue, comments, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, ticker) DO UPDATE SET
      shares = excluded.shares,
      pricePerShare = excluded.pricePerShare,
      marketValue = excluded.marketValue,
      comments = excluded.comments
  `);

  stmt.run(id, date, ticker, shares, pricePerShare, marketValue, comments, now);

  return {
    id,
    date,
    ticker,
    shares,
    pricePerShare,
    marketValue,
    comments,
    createdAt: now,
  };
}

export function recordDailyPositionsBatch(
  records: Array<{
    ticker: string;
    date: string;
    shares: number;
    pricePerShare: number;
    comments: string;
  }>
): Types.DailyPosition[] {
  return records.map((r) =>
    recordDailyPosition(r.ticker, r.date, r.shares, r.pricePerShare, r.comments)
  );
}

export function listDailyPositions(
  tickerFilter?: string,
  startDate?: string,
  endDate?: string
): Types.DailyPosition[] {
  const db = getDb();
  let query = 'SELECT * FROM dailyPositions WHERE 1=1';
  const params: unknown[] = [];

  if (tickerFilter) {
    query += ' AND ticker = ?';
    params.push(tickerFilter);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC, ticker ASC';
  const stmt = db.prepare(query);
  return stmt.all(...params) as Types.DailyPosition[];
}
