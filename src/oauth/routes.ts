import express from 'express';
import { config_ } from '../config.js';
import {
  registerClient,
  getClient,
  createAuthCode,
  consumeAuthCode,
  issueTokens,
  refreshAccessToken,
  verifyPkce,
} from './store.js';

export const oauthRouter = express.Router();

function baseUrl(req: express.Request): string {
  return `${req.protocol}://${req.get('host')}`;
}

function protectedResourceMetadata(req: express.Request) {
  const issuer = baseUrl(req);
  return {
    resource: `${issuer}/mcp`,
    authorization_servers: [issuer],
  };
}

oauthRouter.get('/.well-known/oauth-authorization-server', (req, res) => {
  const issuer = baseUrl(req);
  res.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
});

oauthRouter.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json(protectedResourceMetadata(req));
});

oauthRouter.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
  res.json(protectedResourceMetadata(req));
});

oauthRouter.post('/register', (req, res) => {
  const redirectUris = Array.isArray(req.body?.redirect_uris)
    ? req.body.redirect_uris.filter((uri: unknown): uri is string => typeof uri === 'string')
    : [];

  if (redirectUris.length === 0) {
    res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'redirect_uris is required',
    });
    return;
  }

  const clientId = registerClient(redirectUris);

  res.status(201).json({
    client_id: clientId,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  });
});

const AUTHORIZE_PARAMS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'state',
  'code_challenge',
  'code_challenge_method',
  'scope',
] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAuthorizeForm(params: Record<string, string>, error?: string): string {
  const hidden = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtml(value)}">`)
    .join('\n      ');

  return `<!DOCTYPE html>
<html>
  <head>
    <title>Authorize Portfolio MCP</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body style="font-family: sans-serif; max-width: 400px; margin: 80px auto; padding: 0 16px;">
    <h2>Authorize access to Portfolio MCP</h2>
    <p>Enter your MCP access token to allow this client to access your portfolio.</p>
    ${error ? `<p style="color: red;">${escapeHtml(error)}</p>` : ''}
    <form method="POST" action="/authorize">
      ${hidden}
      <label for="token">Access token</label><br>
      <input type="password" id="token" name="token" style="width: 100%; padding: 8px; margin: 8px 0; box-sizing: border-box;" autofocus required>
      <button type="submit" style="padding: 8px 16px;">Authorize</button>
    </form>
  </body>
</html>`;
}

function extractAuthorizeParams(source: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of AUTHORIZE_PARAMS) {
    const value = source[key];
    if (typeof value === 'string') params[key] = value;
  }
  return params;
}

oauthRouter.get('/authorize', (req, res) => {
  const params = extractAuthorizeParams(req.query as Record<string, unknown>);

  const client = getClient(params.client_id ?? '');
  if (!client || !client.redirectUris.includes(params.redirect_uri ?? '')) {
    res.status(400).send('Invalid client_id or redirect_uri');
    return;
  }

  if (
    params.response_type !== 'code' ||
    params.code_challenge_method !== 'S256' ||
    !params.code_challenge
  ) {
    res.status(400).send('Unsupported request: only response_type=code with PKCE (S256) is supported');
    return;
  }

  res.send(renderAuthorizeForm(params));
});

oauthRouter.post('/authorize', (req, res) => {
  const params = extractAuthorizeParams(req.body as Record<string, unknown>);

  const client = getClient(params.client_id ?? '');
  if (!client || !client.redirectUris.includes(params.redirect_uri ?? '')) {
    res.status(400).send('Invalid client_id or redirect_uri');
    return;
  }

  const submittedToken = typeof req.body.token === 'string' ? req.body.token : '';
  if (!config_.mcpAuthToken || submittedToken !== config_.mcpAuthToken) {
    res.status(401).send(renderAuthorizeForm(params, 'Incorrect token. Try again.'));
    return;
  }

  const code = createAuthCode({
    clientId: params.client_id,
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge,
  });

  const redirectUrl = new URL(params.redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (params.state) redirectUrl.searchParams.set('state', params.state);

  res.redirect(redirectUrl.toString());
});

oauthRouter.post('/token', (req, res) => {
  const grantType = req.body.grant_type;

  if (grantType === 'authorization_code') {
    const code = req.body.code;
    const redirectUri = req.body.redirect_uri;
    const clientId = req.body.client_id;
    const codeVerifier = req.body.code_verifier;

    const entry = consumeAuthCode(typeof code === 'string' ? code : '');
    if (!entry || entry.clientId !== clientId || entry.redirectUri !== redirectUri) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    if (typeof codeVerifier !== 'string' || !verifyPkce(codeVerifier, entry.codeChallenge)) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      return;
    }

    const tokens = issueTokens(clientId);
    res.json({
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
    });
    return;
  }

  if (grantType === 'refresh_token') {
    const refreshToken = req.body.refresh_token;
    const refreshed = refreshAccessToken(typeof refreshToken === 'string' ? refreshToken : '');
    if (!refreshed) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    res.json({
      access_token: refreshed.accessToken,
      token_type: 'Bearer',
      expires_in: refreshed.expiresIn,
    });
    return;
  }

  res.status(400).json({ error: 'unsupported_grant_type' });
});
