import Database from 'better-sqlite3';
import { config_ } from '../config.js';

const POSITIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS positions (
    ticker TEXT PRIMARY KEY,
    shares REAL NOT NULL,
    avgCostPerShare REAL NOT NULL,
    totalCostBasis REAL NOT NULL,
    realizedGain REAL NOT NULL DEFAULT 0,
    totalDividends REAL NOT NULL DEFAULT 0,
    firstPurchaseDate TEXT,
    lastTransactionDate TEXT,
    status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED')),
    comments TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`;

const POSITION_COMMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS positionComments (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    text TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(ticker) REFERENCES positions(ticker) ON DELETE CASCADE
  )
`;

export function initializeSchema(db: Database.Database): { needsPositionBackfill: boolean } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAWAL')),
      shares REAL NOT NULL,
      pricePerShare REAL NOT NULL,
      totalCost REAL NOT NULL,
      date TEXT NOT NULL,
      comments TEXT,
      linkedTxId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      alertType TEXT NOT NULL CHECK(alertType IN ('PRICE_ABOVE', 'PRICE_BELOW', 'GAIN_LOSS_PERCENT')),
      threshold REAL NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS alertComments (
      id TEXT PRIMARY KEY,
      alertId TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(alertId) REFERENCES alerts(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS dailyPositions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      ticker TEXT NOT NULL,
      shares REAL NOT NULL,
      pricePerShare REAL NOT NULL,
      marketValue REAL NOT NULL,
      comments TEXT,
      createdAt TEXT NOT NULL,
      UNIQUE(date, ticker)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS schemaVersion (
      version INTEGER PRIMARY KEY,
      appliedAt TEXT NOT NULL
    )
  `);

  const versionStmt = db.prepare('SELECT version FROM schemaVersion ORDER BY version DESC LIMIT 1');
  const result = versionStmt.get() as { version: number } | undefined;
  let currentVersion = result?.version || 0;

  if (currentVersion === 0) {
    db.prepare('INSERT INTO schemaVersion (version, appliedAt) VALUES (?, ?)').run(
      1,
      new Date().toISOString()
    );
    currentVersion = 1;
  }

  let needsPositionBackfill = false;

  if (currentVersion < 2) {
    // positions/positionComments are moving from per-lot (id-keyed) to a
    // ticker-keyed materialized view rebuilt from transactions. Both tables
    // are empty at this point, so dropping and recreating is non-destructive.
    db.exec('DROP TABLE IF EXISTS positionComments');
    db.exec('DROP TABLE IF EXISTS positions');
    db.exec(POSITIONS_TABLE);
    db.exec(POSITION_COMMENTS_TABLE);
    db.prepare('INSERT INTO schemaVersion (version, appliedAt) VALUES (?, ?)').run(
      2,
      new Date().toISOString()
    );
    needsPositionBackfill = true;
  } else {
    db.exec(POSITIONS_TABLE);
    db.exec(POSITION_COMMENTS_TABLE);
  }

  if (currentVersion < 3) {
    // Add DEPOSIT/WITHDRAWAL transaction types (for cash funding/spending) and
    // a linkedTxId column (links an auto-generated cash transaction back to the
    // stock BUY/SELL that produced it). SQLite CHECK constraints require a table rebuild.
    db.exec(`
      CREATE TABLE transactions_new (
        id TEXT PRIMARY KEY,
        ticker TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAWAL')),
        shares REAL NOT NULL,
        pricePerShare REAL NOT NULL,
        totalCost REAL NOT NULL,
        date TEXT NOT NULL,
        comments TEXT,
        linkedTxId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    db.exec(`
      INSERT INTO transactions_new (id, ticker, type, shares, pricePerShare, totalCost, date, comments, linkedTxId, createdAt, updatedAt)
      SELECT id, ticker, type, shares, pricePerShare, totalCost, date, comments, NULL, createdAt, updatedAt FROM transactions
    `);
    db.exec('DROP TABLE transactions');
    db.exec('ALTER TABLE transactions_new RENAME TO transactions');
    db.prepare('INSERT INTO schemaVersion (version, appliedAt) VALUES (?, ?)').run(
      3,
      new Date().toISOString()
    );
  }

  return { needsPositionBackfill };
}

export function getDatabase(): Database.Database {
  const db = new Database(config_.databasePath);
  db.pragma('journal_mode = WAL');
  return db;
}
