# Quick Start

## Local Setup (5 min)

```bash
npm install
npm run build
cp .env.example .env
# Edit .env: add DRIVE_FOLDER_ID
npm start
# First run: browser opens for OAuth auth → authorize → token saved
```

## Docker Local (2 min)

```bash
# Encode credentials & token once
CREDS=$(cat oauth-credentials.json | base64 -w0)
TOKEN=$(cat tokens.json | base64 -w0)

docker build -t portfolio-mcp .
docker run -it \
  -e OAUTH_CREDENTIALS_JSON="$CREDS" \
  -e OAUTH_TOKEN_JSON="$TOKEN" \
  -e DRIVE_FOLDER_ID="<folder-id>" \
  portfolio-mcp:latest
```

## Railway Deploy (5 min)

1. Push to GitHub
2. Connect GitHub repo to Railway
3. Set environment variables:
   ```
   OAUTH_CREDENTIALS_JSON=<base64>
   OAUTH_TOKEN_JSON=<base64>
   DRIVE_FOLDER_ID=<folder-id>
   ```
4. Deploy

## OAuth Setup

See [OAUTH_SETUP.md](OAUTH_SETUP.md) for detailed steps:
- Create Google Cloud project & OAuth credentials
- Generate token (authorize locally once)
- Create Google Drive folder

## Files

- `oauth-credentials.json` - OAuth client credentials (in .gitignore)
- `tokens.json` - Refresh token (in .gitignore)
- `.env` - Config (in .gitignore)

## Environment Variables

| Var | Source | Notes |
|-----|--------|-------|
| `OAUTH_CREDENTIALS_JSON` | File or base64 env var | OAuth client credentials |
| `OAUTH_TOKEN_JSON` | File or base64 env var | Refresh token |
| `DRIVE_FOLDER_ID` | Required | Google Drive folder for backups |
| `DATABASE_SYNC_INTERVAL_MINUTES` | Optional, default: 1 | |
| `BACKUP_TIME_UTC` | Optional, default: 23:00 | |

## 18 MCP Tools

**Transactions**: list, add, update, delete  
**Positions**: list, add, update, close, add_comment, list_comments, summary  
**Daily Positions**: record single/batch, list  
**Alerts**: list, add, update, delete, add_comment, list_comments  
**Utilities**: sync_to_drive, get_stats  

## Troubleshooting

- **Auth keeps triggering**: Check OAUTH_TOKEN_JSON is valid base64
- **"Cannot find module"**: Run `npm install`
- **Build fails**: Run `npm run build` again
- **Docker fails**: Ensure env vars are set with `-e FLAG=value`
