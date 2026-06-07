// api/reference-questionnaire.js
// Token-gated referee questionnaire (service role). The token is the secret,
// emailed to the referee; it authorizes reading + completing exactly ONE
// reference. Previously the browser read/updated fed_references directly under
// `SELECT/UPDATE USING(true)` policies, which let anyone read or overwrite ANY
// reference. Those policies are removed; this endpoint is the only public path.
//
//   GET  /api/reference-questionnaire?token=…        -> { reference }
//   POST /api/reference-questionnaire { token, answers } -> completes it

const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ANSWER_FIELDS = [
  'q1_relationship','q2_client_facing','q3_working_style','q4_knowledge',
  'q5_market_standing','q6_pressure_story','q7_recommend','q7_caveats',
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const token = (req.query.token || '').trim();
      if (!token) return res.status(400).json({ error: 'token required.' });
      const { data, error } = await db.from('fed_references').select('*').eq('token', token).single();
      if (error || !data) return res.status(404).json({ error: 'invalid_token' });
      return res.status(200).json({ ok: true, reference: data });
    }

    if (req.method === 'POST') {
      const { token, answers } = req.body || {};
      if (!token) return res.status(400).json({ error: 'token required.' });
      const { data: ref, error: e1 } = await db.from('fed_references').select('id,status').eq('token', token).single();
      if (e1 || !ref) return res.status(404).json({ error: 'invalid_token' });
      if (ref.status === 'completed') return res.status(409).json({ error: 'already_completed' });

      const patch = { status: 'completed', completed_at: new Date().toISOString() };
      for (const k of ANSWER_FIELDS) if (answers && k in answers) patch[k] = answers[k];

      const { error: e2 } = await db.from('fed_references').update(patch).eq('token', token);
      if (e2) throw e2;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    console.error('reference-questionnaire error:', e);
    return res.status(500).json({ error: e.message || 'Internal error.' });
  }
};
