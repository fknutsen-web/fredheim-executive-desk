// api/admin-auth.js
// Validates the admin password server-side so it is never exposed in client HTML.
// Called by AdminLogin component on form submit.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD env var not set.');
    return res.status(500).json({ error: 'Admin not configured.' });
  }

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  return res.status(200).json({ ok: true });
};
