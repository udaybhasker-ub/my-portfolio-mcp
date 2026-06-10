# OAuth 2.0 Setup Guide

This guide walks you through obtaining OAuth credentials, generating tokens, and creating a Google Drive folder for the Portfolio MCP server.

## Table of Contents
1. [Create Google Cloud Project](#create-google-cloud-project)
2. [Enable Google Drive API](#enable-google-drive-api)
3. [Create OAuth Credentials](#create-oauth-credentials)
4. [Download Credentials](#download-credentials)
5. [Create Google Drive Folder](#create-google-drive-folder)
6. [Generate OAuth Token](#generate-oauth-token)
7. [Configure Environment Variables](#configure-environment-variables)
8. [Deployment to Railway](#deployment-to-railway)

---

## Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the **Project** dropdown at the top
3. Click **NEW PROJECT**
4. Enter project name: `portfolio-mcp`
5. Click **CREATE** and wait for completion

---

## Enable Google Drive API

1. In the search bar, type `Google Drive API`
2. Click on **Google Drive API** in results
3. Click **ENABLE**
4. Wait for the message: "API enabled"

---

## Create OAuth Credentials

### Step 1: Configure OAuth Consent Screen

1. In the left sidebar, click **APIs & Services** → **OAuth consent screen**
2. Select **User Type**: `External`
3. Click **CREATE**
4. Fill in:
   - **App name**: `Portfolio MCP`
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click **SAVE AND CONTINUE**

### Step 2: Add Scopes

1. On "Scopes" page, click **ADD OR REMOVE SCOPES**
2. Search for: `Google Drive API`
3. Find and check: `https://www.googleapis.com/auth/drive.file`
4. Click **UPDATE**
5. Click **SAVE AND CONTINUE**
6. Skip "Test users" and click **SAVE AND CONTINUE**

### Step 3: Add Yourself as Test User

1. Back on OAuth consent screen, scroll to **Test users**
2. Click **+ ADD USERS**
3. Paste your email: `your-email@gmail.com`
4. Click **ADD**
5. Click **SAVE**

---

## Create OAuth Credentials

1. In left sidebar, click **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. **Application type**: Select `Desktop application`
4. **Name**: Enter `Portfolio MCP`
5. Click **CREATE**

---

## Download Credentials

1. You'll see a dialog with your credentials
2. Click **DOWNLOAD** button
3. File saves as: `client_secret_*.json`
4. **Rename it to**: `oauth-credentials.json`

---

## Create Google Drive Folder

1. Go to [Google Drive](https://drive.google.com/)
2. Click **+ New** → **Folder**
3. Name it: `Portfolio Data`
4. Open the folder and copy the **Folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/FOLDER_ID_HERE
   ```

---

## Generate OAuth Token

This creates the `tokens.json` file needed for Drive access.

### Step 1: Place Credentials File

```bash
# Copy the downloaded oauth-credentials.json to project root
cp ~/Downloads/oauth-credentials.json /Users/udaybhaskerdusharla/Documents/Claude\ Code\ Projects/my-portfolio-mcp/
```

### Step 2: Update .env

```bash
cd /Users/udaybhaskerdusharla/Documents/Claude\ Code\ Projects/my-portfolio-mcp
nano .env
```

Add or update:
```
DRIVE_FOLDER_ID=<your_folder_id_here>
```

### Step 3: Run Server (First Time Authorization)

```bash
npm run build
npm start
```

You'll see:
```
🔐 Authorization required!
Open this URL in your browser:
https://accounts.google.com/o/oauth2/v2/auth?...
```

### Step 4: Authorize

1. **Copy the URL** and open it in your browser
2. Sign in with your Google account
3. Click **Continue** when prompted about app verification
4. Click **Allow** to grant Drive access
5. You'll see a blank localhost page with a code in the URL:
   ```
   http://localhost/?code=4/0AX...
   ```

### Step 5: Paste Code Back

1. Go back to terminal
2. At prompt: `Enter the authorization code:`
3. **Copy the code** from the URL (starts with `4/0AX...`)
4. **Paste it** into terminal
5. Press **Enter**

You should see:
```
✅ Authorization successful! Token saved.

Backup scheduled for 23:00 UTC
Portfolio MCP server initialized
Portfolio MCP server running on stdio transport
```

The `tokens.json` file is now created in your project root.

---

## Configure Environment Variables

### Local Development (Files in Project)

Just keep both files in the project root:
- `oauth-credentials.json` ← Credentials file
- `tokens.json` ← Authorization token
- `.env` ← Has DRIVE_FOLDER_ID

Both are in `.gitignore` (not committed to GitHub).

### Docker Local Testing

Base64 encode both files:

```bash
# Encode credentials
cat oauth-credentials.json | base64 -w0

# Encode token
cat tokens.json | base64 -w0
```

Run Docker with env vars:
```bash
docker build -t portfolio-mcp:latest .

docker run -it \
  -e OAUTH_CREDENTIALS_JSON="<base64-encoded-credentials>" \
  -e OAUTH_TOKEN_JSON="<base64-encoded-token>" \
  -e DRIVE_FOLDER_ID="your_folder_id" \
  portfolio-mcp:latest
```

---

## Deployment to Railway

### Step 1: Prepare Secrets

Base64 encode both files:

```bash
# Get base64 string for credentials
cat oauth-credentials.json | base64 -w0

# Get base64 string for token
cat tokens.json | base64 -w0
```

### Step 2: Push to GitHub

```bash
cd /Users/udaybhaskerdusharla/Documents/Claude\ Code\ Projects/my-portfolio-mcp

git add .
git commit -m "Add portfolio MCP server"
git push origin main
```

### Step 3: Set Railway Environment Variables

1. Go to [Railway.app](https://railway.app/)
2. Create new project and connect GitHub repo
3. In project settings, add environment variables:
   ```
   OAUTH_CREDENTIALS_JSON=<base64-encoded-credentials>
   OAUTH_TOKEN_JSON=<base64-encoded-token>
   DRIVE_FOLDER_ID=<your_folder_id>
   ```

### Step 4: Deploy

Railway automatically builds and deploys. Your server should be running! 🚀

---

## Troubleshooting

### "Access blocked" Error
- Make sure you added yourself as a **Test user** in OAuth consent screen
- Try again with your authorized email

### "Authorization successful" But No Token
- Check that `tokens.json` was created in project root
- Run `npm start` again to verify

### "Cannot read properties of undefined (reading 'method')"
- Rebuild: `npm run build`
- Ensure all dependencies installed: `npm install`

### Token Expired (Railway)
- Tokens are long-lived and refresh automatically
- If issues occur, re-authorize locally and get new `tokens.json`
- Update Railway's `OAUTH_TOKEN_JSON` env var

---

## Security Notes

- ✅ Both files are in `.gitignore` (never committed to GitHub)
- ✅ Tokens are refresh tokens (not passwords)
- ✅ Railway stores them as secrets (encrypted)
- ✅ You can revoke access anytime in [Google Account](https://myaccount.google.com/permissions)

---

## Next Steps

Once setup is complete:
1. [Read the main README](README.md) for usage
2. Test locally: `npm start`
3. Test with Docker: `docker run ...`
4. Deploy to Railway

