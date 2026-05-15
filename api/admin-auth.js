// api/admin-auth.js
// Validates the admin password server-side.
// Basic rate limiting via in-memory attempt counter (resets on cold start).
// For production, replace with Redis-backed rate limiting.

const attempts = {}; // ip → { count, firstAttempt }
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

module.exports = async function handler(req, res) {
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
    // Window expired — reset
    attempts[ip] = { count: 0, firstAttempt: now };
  }
  attempts[ip].count++;
  if (attempts[ip].count > MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
  }

  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD env var not set.');
    return res.status(500).json({ error: 'Admin not configured.' });
  }

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  // Success — reset attempt counter for this IP
  delete attempts[ip];
  return res.status(200).json({ ok: true });
};
