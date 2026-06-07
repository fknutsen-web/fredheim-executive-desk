// api/admin-actions.js
// Admin WRITE operations, performed server-side with the service-role key and
// gated by isAuthorizedAdmin. These were previously done from the browser via
// the anon key under permissive "always true" RLS policies; moving them here is
// what lets those public write policies be removed (RLS hardening Phase 2).
//
// POST /api/admin-actions   { action, ...payload }
//   Authorization: Bearer <admin token>   OR   X-Admin-Secret
//
// Mirrors the auth + service-role pattern of api/admin-oversight.js. New admin
// mutations (job moderation, closures, placements, …) are added as cases here.

const { createClient } = require('@supabase/supabase-js');
const { isAuthorizedAdmin } = require('./admin-auth');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!isAuthorizedAdmin(req)) return res.status(403).json({ error: 'Admin authentication required.' });

  const body = req.body || {};
  const { action } = body;

  try {
    switch (action) {
      // ── Compensation benchmarks (admin editor) ──────────────────────────
      case 'benchmark_save': {
        const row = body.row || {};
        const q = row.id
          ? db.from('fed_comp_benchmarks').update(row).eq('id', row.id)
          : db.from('fed_comp_benchmarks').insert(row);
        const { data, error } = await q.select('*').single();
        if (error) throw error;
        return res.status(200).json({ ok: true, row: data });
      }
      case 'benchmark_toggle': {
        const { id, is_active } = body;
        if (!id) return res.status(400).json({ error: 'id required.' });
        const { error } = await db.from('fed_comp_benchmarks').update({ is_active: !!is_active }).eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      // ── Recruiter submissions (admin moderation) ────────────────────────
      case 'submission_status': {
        const { id, status } = body;
        if (!id || !status) return res.status(400).json({ error: 'id and status required.' });
        const { error } = await db.from('fed_recruiter_submissions').update({ status }).eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('admin-actions error:', e);
    return res.status(500).json({ error: e.message || 'Internal error.' });
  }
};
