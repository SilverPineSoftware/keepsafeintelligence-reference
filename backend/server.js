const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const COGNITO_TOKEN_URL = process.env.COGNITO_TOKEN_URL;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;
const KEEPSAFE_ACCESS_URL = process.env.KEEPSAFE_ACCESS_URL;
const KEEPSAFE_USER_ID = process.env.KEEPSAFE_USER_ID;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

let cachedToken = null;
let tokenExpiresAt = 0;

app.use(cors({ origin: ALLOWED_ORIGIN }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/auth', async (_req, res) => {
  try {
    const tokenRes = await fetch(COGNITO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'keepsafe-access/api',
        client_id: COGNITO_CLIENT_ID,
        client_secret: COGNITO_CLIENT_SECRET,
      }),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.access_token) {
      return res.status(401).json({ error: data.error || 'Token request failed' });
    }

    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    res.json({ expires_in: data.expires_in });
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(502).json({ error: 'Authentication failed' });
  }
});

app.get('/feed', async (_req, res) => {
  if (!cachedToken || Date.now() >= tokenExpiresAt) {
    return res.status(401).json({ error: 'Not authenticated. Call POST /auth first.' });
  }

  try {
    const feedRes = await fetch(
      `${KEEPSAFE_ACCESS_URL}/v1/feed/${encodeURIComponent(KEEPSAFE_USER_ID)}`,
      { headers: { Authorization: `Bearer ${cachedToken}` } },
    );

    if (!feedRes.ok) {
      const text = await feedRes.text();
      return res.status(feedRes.status).json({ error: text });
    }

    const feedData = await feedRes.json();
    res.json(feedData);
  } catch (err) {
    console.error('Feed error:', err.message);
    res.status(502).json({ error: 'Failed to fetch feed' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
