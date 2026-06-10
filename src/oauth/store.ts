import crypto from 'node:crypto';

interface Client {
  redirectUris: string[];
}

interface AuthCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

interface AccessToken {
  clientId: string;
  expiresAt: number;
}

interface RefreshToken {
  clientId: string;
}

const clients = new Map<string, Client>();
const authCodes = new Map<string, AuthCode>();
const accessTokens = new Map<string, AccessToken>();
const refreshTokens = new Map<string, RefreshToken>();

const AUTH_CODE_TTL_MS = 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function registerClient(redirectUris: string[]): string {
  const clientId = generateToken();
  clients.set(clientId, { redirectUris });
  return clientId;
}

export function getClient(clientId: string): Client | undefined {
  return clients.get(clientId);
}

export function createAuthCode(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}): string {
  const code = generateToken();
  authCodes.set(code, { ...params, expiresAt: Date.now() + AUTH_CODE_TTL_MS });
  return code;
}

export function consumeAuthCode(code: string): AuthCode | undefined {
  const entry = authCodes.get(code);
  authCodes.delete(code);
  if (!entry || entry.expiresAt < Date.now()) {
    return undefined;
  }
  return entry;
}

export function issueTokens(clientId: string): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  accessTokens.set(accessToken, { clientId, expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS });
  refreshTokens.set(refreshToken, { clientId });
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_MS / 1000 };
}

export function isValidAccessToken(token: string): boolean {
  const entry = accessTokens.get(token);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    accessTokens.delete(token);
    return false;
  }
  return true;
}

export function refreshAccessToken(
  refreshToken: string
): { accessToken: string; expiresIn: number } | undefined {
  const entry = refreshTokens.get(refreshToken);
  if (!entry) return undefined;

  const accessToken = generateToken();
  accessTokens.set(accessToken, { clientId: entry.clientId, expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS });
  return { accessToken, expiresIn: ACCESS_TOKEN_TTL_MS / 1000 };
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return hash === codeChallenge;
}
