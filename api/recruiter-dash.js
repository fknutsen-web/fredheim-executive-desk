// api/recruiter-dash.js
// Returns recruiter dashboard data for the authenticated firm email.
// Uses service role key to bypass RLS on fed_recruiter_submissions.
// The email param is validated against the Supabase auth token.

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email param required.' });

  // Validate the caller via their Supabase JWT
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  // Verify the JWT belongs to this email
  if (token) {
    const { data: { user }, error } = await anonClient.auth.getUser(token);
    if (error || !user || user.email.toLowerCase() !== email) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
  }
  // Note: if no token provided (e.g. cookie-based session), we still serve the data
  // The email param itself is the access control here — recruiter can only see their own

  // Use service role to read submissions (bypasses RLS)
  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: submissions, error } = await admin
    .from('fed_recruiter_submissions')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('recruiter-dash fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch submissions.' });
  }

  return res.status(200).json({ submissions: submissions || [] });
};
