// api/admin-auth.js
// Validates the admin password server-side AND issues a short-lived signed
// session token so subsequent admin API calls don't have to echo the
// password back in every request header.
//
// Token format: `<base64url(payload)>.<base64url(hmac_sha256)>`
//   payload = { exp: <unix_seconds>, sub: 'admin', iat: <unix_seconds> }
//   hmac    = HMAC-SHA256(payload_b64, ADMIN_TOKEN_SECRET)
//
// Other admin endpoints (leaderboard, marketplace-activity, notify-interest)
// validate this token via the shared verifyAdminToken() helper.
//
// Basic IP rate limiting on the login endpoint (resets on cold start).
// For production, replace with Redis-backed rate limiting.

const crypto = require('crypto');

const attempts = {}; // ip → { count, firstAttempt }
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_TTL_SECONDS = 8 * 3600; // 8 hours

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function b64urlDecode(str) {
  str = str.replace(/-/g,'+').replace(/_/g,'/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function hmac(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

function timingSafeEqualB(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function tokenSecret() {
  // Prefer ADMIN_TOKEN_SECRET; fall back to ADMIN_PASSWORD so the system
  // still works if the new env var hasn't been set yet (it just means the
  // signing key is the admin password itself, which is weaker but functional).
  return process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || '';
}

function issueAdminToken() {
  try {
    const secret = tokenSecret();
    if (!secret) {
      console.error('issueAdminToken: no signing secret available - set ADMIN_TOKEN_SECRET or ADMIN_PASSWORD');
      return null;
    }
    const now     = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ sub: 'admin', iat: now, exp: now + TOKEN_TTL_SECONDS });
    const payloadB64 = b64url(payload);
    const sig        = b64url(hmac(payloadB64, secret));
    const token      = `${payloadB64}.${sig}`;
    if (!token || token.length < 10) {
      console.error('issueAdminToken: produced empty token');
      return null;
    }
    return token;
  } catch (e) {
    console.error('issueAdminToken threw:', e.message);
    return null;
  }
}

// Exported for other endpoints to share (not part of the HTTP handler).
module.exports.verifyAdminToken = function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expected = hmac(payloadB64, tokenSecret());
  let provided;
  try { provided = b64urlDecode(sigB64); } catch { return null; }
  if (!timingSafeEqualB(expected, provided)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(payloadB64).toString()); } catch { return null; }
  if (!payload || payload.sub !== 'admin') return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
};

// Legacy password-header check (kept as a fallback during the transition).
module.exports.verifyAdminPassword = function verifyAdminPassword(secret) {
  if (!process.env.ADMIN_PASSWORD) return false;
  if (!secret) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(secret),
      Buffer.from(process.env.ADMIN_PASSWORD),
    );
  } catch { return false; }
};

// Convenience: accept either the new Bearer token OR the legacy X-Admin-Secret
// password header. Use this in admin-protected endpoints.
module.exports.isAuthorizedAdmin = function isAuthorizedAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (module.exports.verifyAdminToken(token)) return true;
  }
  const legacy = req.headers['x-admin-secret'] || '';
  if (module.exports.verifyAdminPassword(legacy)) return true;
  return false;
};

module.exports.handler = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  // Rate limiting by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  if (!attempts[ip]) attempts[ip] = { count: 0, firstAttempt: now };
  if (now - attempts[ip].firstAttempt > WINDOW_MS) {
    attempts[ip] = { count: 0, firstAttempt: now };
  }
  attempts[ip].count++;
  if (attempts[ip].count > MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
  }

  const { password } = req.body || {};

  if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD env var not set.');
    return res.status(500).json({ error: 'Admin not configured.' });
  }

  if (!module.exports.verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  // Success - reset attempt counter and issue a signed session token.
  delete attempts[ip];
  const token = issueAdminToken();
  const body = { ok: true, expires_in: TOKEN_TTL_SECONDS };
  if (token) {
    body.token = token;
  } else {
    body.token_issuance_failed = true;
    body.hint = 'Set ADMIN_TOKEN_SECRET in environment vars and redeploy. Auth succeeded but no session token was issued.';
  }
  return res.status(200).json(body);
};

// Vercel's serverless handler expects the function to be the default
// `module.exports`. We export the named helpers above but still default
// to the request handler for the runtime.
module.exports = Object.assign(module.exports.handler, module.exports);
