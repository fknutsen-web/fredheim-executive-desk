// api/recruiter-dash.js
// Returns recruiter dashboard data using service role to bypass RLS.
// Validates caller via Supabase JWT Bearer token.
// Falls back to published anon key if SUPABASE_ANON_KEY env var is not set.

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email param required.' });

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required.' });

  const anonClient = createClient(process.env.SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user || user.email.toLowerCase() !== email) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: submissions, error } = await adminClient
    .from('fed_recruiter_submissions')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('recruiter-dash error:', error);
    return res.status(500).json({ error: 'Failed to fetch submissions.' });
  }

  return res.status(200).json({ submissions: submissions || [] });
};
