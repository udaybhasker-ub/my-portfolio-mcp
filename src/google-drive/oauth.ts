import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const TOKEN_PATH = './tokens.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let authClient: OAuth2Client | null = null;

function parseJsonOrBase64(input: string): unknown {
  try {
    // Try parsing as JSON directly
    return JSON.parse(input);
  } catch {
    try {
      // Try base64 decoding then parsing as JSON
      const decoded = Buffer.from(input, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      throw new Error('Input is neither valid JSON nor valid base64-encoded JSON');
    }
  }
}

export async function getAuthClient(): Promise<OAuth2Client> {
  if (authClient) {
    return authClient;
  }

  // Load credentials from environment or file
  let credentials: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };

  const credsJson = process.env.OAUTH_CREDENTIALS_JSON;
  if (credsJson) {
    try {
      const parsed = parseJsonOrBase64(credsJson);
      credentials = (parsed as any).installed || (parsed as any).web;
      if (!credentials) {
        throw new Error('Credentials JSON missing installed or web property');
      }
    } catch (e) {
      throw new Error(`Failed to parse OAUTH_CREDENTIALS_JSON: ${e}`);
    }
  } else {
    // Try to load from local file
    try {
      const content = fs.readFileSync('./oauth-credentials.json', 'utf-8');
      const parsed = JSON.parse(content);
      credentials = parsed.installed || parsed.web;
      if (!credentials) {
        throw new Error('Credentials JSON missing installed or web property');
      }
    } catch (e) {
      throw new Error(
        'OAuth credentials not found. Set OAUTH_CREDENTIALS_JSON env var or place oauth-credentials.json in project root'
      );
    }
  }

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0]
  );

  // Try to load token from environment variable first
  const tokenJson = process.env.OAUTH_TOKEN_JSON;
  if (tokenJson) {
    console.log(`DEBUG: OAUTH_TOKEN_JSON length: ${tokenJson.length}`);
    console.log(`DEBUG: OAUTH_TOKEN_JSON first 50 chars: ${tokenJson.substring(0, 50)}`);
    try {
      const token = parseJsonOrBase64(tokenJson) as any;
      console.log(`DEBUG: Parsed token keys: ${Object.keys(token).join(', ')}`);
      oauth2Client.setCredentials(token);
      authClient = oauth2Client;
      console.log('✅ Loaded OAuth token from OAUTH_TOKEN_JSON env var');
      return oauth2Client;
    } catch (e) {
      console.warn(`⚠️  Failed to load token from OAUTH_TOKEN_JSON env var: ${e}`);
      // Fall through to try file
    }
  } else {
    console.log('DEBUG: OAUTH_TOKEN_JSON env var not set');
  }

  // Try to load saved token from file if exists
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      oauth2Client.setCredentials(token);
      authClient = oauth2Client;
      console.log('✅ Loaded OAuth token from tokens.json file');
      return oauth2Client;
    } catch (e) {
      console.warn(`⚠️  Failed to load token from file: ${e}`);
      // Fall through to authorization
    }
  }

  // Need to authorize
  console.log('\n🔐 No OAuth token found. Authorization required!');
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Open this URL in your browser:');
  console.log(authorizeUrl);
  console.log('\nPaste the authorization code here:');

  const code = await promptForCode();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save token for next time
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('✅ Authorization successful! Token saved to tokens.json\n');

    authClient = oauth2Client;
    return oauth2Client;
  } catch (error) {
    throw new Error(`Failed to get authorization token: ${error}`);
  }
}

function promptForCode(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter the authorization code: ', (code: string) => {
      rl.close();
      resolve(code.trim());
    });
  });
}
