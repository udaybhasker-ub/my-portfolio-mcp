import Database from 'better-sqlite3';
import { config_ } from '../config.js';

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL', 'DIVIDEND')),
      shares REAL NOT NULL,
      pricePerShare REAL NOT NULL,
      totalCost REAL NOT NULL,
      date TEXT NOT NULL,
      comments TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      shares REAL NOT NULL,
      avgCostPerShare REAL NOT NULL,
      totalCostBasis REAL NOT NULL,
      purchaseDate TEXT NOT NULL,
      closeDate TEXT,
      status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED')),
      comments TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS positionComments (
      id TEXT PRIMARY KEY,
      positionId TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(positionId) REFERENCES positions(id) ON DELETE CASCADE
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
  const currentVersion = result?.version || 0;

  if (currentVersion === 0) {
    db.prepare('INSERT INTO schemaVersion (version, appliedAt) VALUES (?, ?)').run(
      1,
      new Date().toISOString()
    );
  }
}

export function getDatabase(): Database.Database {
  const db = new Database(config_.databasePath);
  db.pragma('journal_mode = WAL');
  return db;
}
