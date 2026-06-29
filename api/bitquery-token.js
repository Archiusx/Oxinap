// api/bitquery-token.js — Vercel Serverless (Node 18+)
// Returns a fresh BitQuery OAuth2 access token (24 h lifetime).
// POST /api/bitquery-token  {}          → { access_token, expires_in, obtained_at }
// POST /api/bitquery-token  { force:true } → forces a new token even if cached

export const config = { maxDuration: 15 };

// Module-level cache: survives warm Lambda re-use across requests
let _token       = null;
let _tokenExpiry = 0;   // epoch ms

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const CLIENT_ID     = process.env.BITQUERY_CLIENT_ID;
  const CLIENT_SECRET = process.env.BITQUERY_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({
      error: "BITQUERY_CLIENT_ID / BITQUERY_CLIENT_SECRET not configured in environment variables.",
    });
  }

  const force = req.body?.force === true;
  const now   = Date.now();

  // Return cached token if valid (with 2-min buffer) and not forced
  if (!force && _token && now < _tokenExpiry - 120_000) {
    return res.status(200).json({
      access_token: _token,
      expires_in:   Math.round((_tokenExpiry - now) / 1000),
      obtained_at:  new Date(_tokenExpiry - 86400 * 1000).toISOString(),
      cached:       true,
    });
  }

  try {
    const oauthRes = await fetch("https://oauth2.bitquery.io/oauth2/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope:         "api",
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!oauthRes.ok) {
      const txt = await oauthRes.text().catch(() => "");
      return res.status(502).json({
        error: `BitQuery OAuth failed (${oauthRes.status}): ${txt.slice(0, 300)}`,
      });
    }

    const data = await oauthRes.json();
    _token       = data.access_token;
    // BitQuery issues 24 h tokens by default; fallback to 86400 s
    const expiresIn = data.expires_in ?? 86400;
    _tokenExpiry    = now + expiresIn * 1000;

    return res.status(200).json({
      access_token: _token,
      expires_in:   expiresIn,
      obtained_at:  new Date(now).toISOString(),
      cached:       false,
    });
  } catch (e) {
    return res.status(502).json({ error: `Token request failed: ${e.message}` });
  }
}
