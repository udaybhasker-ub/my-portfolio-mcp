import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { initializeSchema, getDatabase } from './schema.js';
import { computePosition } from '../positions/engine.js';
import * as Types from '../types.js';

let dbInstance: Database.Database | null = null;

export function initializeDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = getDatabase();
    const { needsPositionBackfill } = initializeSchema(dbInstance);
    if (needsPositionBackfill) {
      backfillPositions();
    }
  }
  return dbInstance;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  return dbInstance;
}

function backfillPositions(): void {
  const db = getDb();
  const tickers = db.prepare('SELECT DISTINCT ticker FROM transactions').all() as { ticker: string }[];
  for (const { ticker } of tickers) {
    rebuildPosition(ticker);
  }
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

  rebuildPosition(ticker);

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

  rebuildPosition(updated.ticker);

  return updated;
}

export function deleteTransaction(id: string): { ticker: string } | null {
  const db = getDb();
  const existing = db.prepare('SELECT ticker FROM transactions WHERE id = ?').get(id) as
    | { ticker: string }
    | undefined;

  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

  if (!existing) {
    return null;
  }

  rebuildPosition(existing.ticker);
  return { ticker: existing.ticker };
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

export function rebuildPosition(ticker: string): Types.Position | null {
  const db = getDb();
  const txs = listTransactions(ticker);
  const computed = computePosition(ticker, txs);

  if (!computed) {
    db.prepare('DELETE FROM positions WHERE ticker = ?').run(ticker);
    return null;
  }

  const existing = db.prepare('SELECT comments, createdAt FROM positions WHERE ticker = ?').get(ticker) as
    | { comments: string; createdAt: string }
    | undefined;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO positions (ticker, shares, avgCostPerShare, totalCostBasis, realizedGain, totalDividends, firstPurchaseDate, lastTransactionDate, status, comments, createdAt, updatedAt)
    VALUES (@ticker, @shares, @avgCostPerShare, @totalCostBasis, @realizedGain, @totalDividends, @firstPurchaseDate, @lastTransactionDate, @status, @comments, @createdAt, @updatedAt)
    ON CONFLICT(ticker) DO UPDATE SET
      shares = excluded.shares,
      avgCostPerShare = excluded.avgCostPerShare,
      totalCostBasis = excluded.totalCostBasis,
      realizedGain = excluded.realizedGain,
      totalDividends = excluded.totalDividends,
      firstPurchaseDate = excluded.firstPurchaseDate,
      lastTransactionDate = excluded.lastTransactionDate,
      status = excluded.status,
      updatedAt = excluded.updatedAt
  `);

  stmt.run({
    ...computed,
    comments: existing?.comments ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  return db.prepare('SELECT * FROM positions WHERE ticker = ?').get(ticker) as Types.Position;
}

export function addPositionComment(ticker: string, text: string): Types.PositionComment {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO positionComments (id, ticker, text, createdAt) VALUES (?, ?, ?, ?)');
  stmt.run(id, ticker, text, now);

  return { id, ticker, text, createdAt: now };
}

export function listPositionComments(ticker: string): Types.PositionComment[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM positionComments WHERE ticker = ? ORDER BY createdAt ASC');
  return stmt.all(ticker) as Types.PositionComment[];
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
