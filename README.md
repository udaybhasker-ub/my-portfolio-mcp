# My Portfolio MCP Server

A Model Context Protocol (MCP) server for managing investment portfolios. Built with Node.js, SQLite, and Google Drive integration.

## Quick Start

👉 **New?** See [QUICKSTART.md](QUICKSTART.md) for setup in 5 minutes

## Features

- **Transaction Management**: Track buys, sells, and dividends
- **Position Tracking**: Manage open and closed positions with cost basis
- **Alerts**: Create and store price/gain-loss alerts
- **Daily Position Snapshots**: Record end-of-day portfolio snapshots
- **Comments with History**: Full comment history on positions and alerts
- **Google Drive Sync**: Automatic sync and daily backups
- **MCP Integration**: Use with Claude for natural language portfolio queries

## Setup

### Prerequisites

- Node.js 18+
- Google account with Drive access
- Railway account (for deployment)

### OAuth Setup

**This project uses OAuth 2.0 for Google Drive access.**

For detailed setup instructions including:
- Creating OAuth credentials in Google Cloud
- Generating authorization tokens
- Creating a Google Drive folder
- Configuring environment variables

👉 **See [OAUTH_SETUP.md](OAUTH_SETUP.md)**

### Local Development

1. Clone and install:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. **Set up OAuth** (see [OAUTH_SETUP.md](OAUTH_SETUP.md)):
   - Create OAuth credentials in Google Cloud Console
   - Authorize locally to generate `tokens.json`
   - Create a Google Drive folder
   - Set `DRIVE_FOLDER_ID` in `.env`

4. Build and run:
```bash
npm run build
npm start
```

The first run will prompt you to authorize with Google (opens browser). On subsequent runs, it uses the saved token.

Or for development with auto-reload:
```bash
npm run dev
```

## Available Tools

### Transactions
- `list_transactions` - Get all transactions with optional filters
- `add_transaction` - Create a new transaction (BUY/SELL/DIVIDEND)
- `update_transaction` - Modify transaction details
- `delete_transaction` - Remove a transaction

### Positions
- `list_positions` - Get all positions (OPEN/CLOSED)
- `add_position` - Create a new position
- `update_position` - Update shares or average cost
- `close_position` - Mark position as closed
- `add_position_comment` - Add comment to position
- `list_position_comments` - Get comment history
- `get_position_summary` - Portfolio stats

### Daily Positions
- `record_daily_position` - Record single EOD snapshot
- `record_daily_positions_batch` - Bulk insert for historical data
- `list_daily_positions` - Query snapshots with filters

### Alerts
- `list_alerts` - Get all alerts
- `add_alert` - Create alert (PRICE_ABOVE/PRICE_BELOW/GAIN_LOSS_PERCENT)
- `update_alert` - Modify alert
- `delete_alert` - Remove alert
- `add_alert_comment` - Add comment to alert
- `list_alert_comments` - Get comment history

### Utilities
- `sync_portfolio_to_drive` - Manual sync trigger
- `get_portfolio_stats` - Portfolio summary

## Deployment to Railway

1. Complete [OAuth setup](OAUTH_SETUP.md) locally first
2. Push code to git repository:
   ```bash
   git add .
   git commit -m "Add portfolio MCP server"
   git push origin main
   ```
3. Connect to [Railway.app](https://railway.app/) and link your GitHub repo
4. Set environment variables in Railway dashboard:
   - `OAUTH_CREDENTIALS_JSON` (base64-encoded, see [OAUTH_SETUP.md](OAUTH_SETUP.md))
   - `OAUTH_TOKEN_JSON` (base64-encoded, see [OAUTH_SETUP.md](OAUTH_SETUP.md))
   - `DRIVE_FOLDER_ID`
   - `DATABASE_SYNC_INTERVAL_MINUTES=1` (optional, default: 1)
   - `BACKUP_TIME_UTC=23:00` (optional, default: 23:00)

5. Railway will auto-build and deploy

**Note**: OAuth credentials and tokens are NOT stored in git (in `.gitignore`). They are provided via Railway environment variables. See [OAUTH_SETUP.md](OAUTH_SETUP.md#deployment-to-railway) for detailed instructions.

## Data Storage

- **Primary**: SQLite database (`portfolio_data.db`)
- **Backup**: Synced to Google Drive every 1 minute
- **Daily Backups**: Timestamped backups retained for 7 days
- **Files**: Not encrypted by default (relies on Drive + file permissions)

## Architecture

```
MCP Server (stdio transport)
    ↓
Tools (Transactions, Positions, Alerts, DailyPositions)
    ↓
SQLite Database (local)
    ↓
Google Drive (sync + backups)
```

## Using with Claude

Connect this MCP server to Claude and query your portfolio:
- "What's my total cost basis?"
- "Add 100 shares of AAPL at $150"
- "Show me all OPEN positions"
- "Create an alert if TSLA goes above $250"

## Configuration

Environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | development |
| `OAUTH_CREDENTIALS_JSON` | OAuth credentials (JSON or base64) | (from file) |
| `OAUTH_TOKEN_JSON` | OAuth token (JSON or base64) | (from file) |
| `DRIVE_FOLDER_ID` | Google Drive folder ID | - |
| `DATABASE_PATH` | SQLite database path | ./portfolio_data.db |
| `DATABASE_SYNC_INTERVAL_MINUTES` | Sync interval | 1 |
| `BACKUP_TIME_UTC` | Daily backup time | 23:00 |

See [OAUTH_SETUP.md](OAUTH_SETUP.md#configure-environment-variables) for details on OAuth variables.

## Security Notes

- OAuth tokens are refresh tokens (not passwords)
- Both credential files are in `.gitignore` (never committed to GitHub)
- Secrets stored as env vars in Railway, encrypted by Railway
- SQLite not encrypted by default (can add SQLCipher for sensitive data)
- Backups inherit Google Drive encryption
- Use parameterized SQL queries (no injection risk)
- You can revoke access anytime in [Google Account](https://myaccount.google.com/permissions)

## Development

Type checking:
```bash
npm run build
```

## License

MIT
