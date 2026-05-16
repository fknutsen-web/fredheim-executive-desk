// api/leaderboard.js
// Returns the recruiter placement leaderboard with eligibility filtering.
// GET ?period=12m|90d|30d|all  — public endpoint (no auth required)
// POST {action: 'snapshot'}    — admin-triggered; requires X-Admin-Secret
// POST {action: 'override'}    — admin override; requires X-Admin-Secret
//
// Leaderboard counts only placement_status IN ('placement_confirmed','invoice_issued','paid')
// Excludes: disputed, cancelled, recruiters with unresolved payment issues,
//           recruiters with serious complaint flags, suppressed/ineligible overrides.

const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const QUALIFYING_STATUSES = ['placement_confirmed', 'invoice_issued', 'paid'];
const TOP_N = 5;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── PUBLIC GET — leaderboard for a period ───────────────────────────────────
  if (req.method === 'GET') {
    const period = req.query.period || '12m';
    const since  = periodToDate(period);

    try {
      // Fetch qualifying placements
      let query = db
        .from('fed_placements')
        .select('id, recruiter_email, placement_status, created_at, admin_review_status')
        .in('placement_status', QUALIFYING_STATUSES)
        .neq('admin_review_status', 'disputed');

      if (since) query = query.gte('created_at', since.toISOString());
      const { data: placements } = await query;

      // Fetch overrides
      const { data: overrides } = await db.from('fed_leaderboard_overrides').select('*');
      const overrideMap = {};
      (overrides || []).forEach(o => { overrideMap[o.recruiter_email.toLowerCase()] = o; });

      // Fetch billing statuses — exclude suspended/payment_failed
      const { data: billings } = await db
        .from('fed_recruiter_billing')
        .select('recruiter_email, billing_status')
        .in('billing_status', ['payment_failed','suspended']);
      const blockedEmails = new Set((billings || []).map(b => b.recruiter_email.toLowerCase()));

      // Fetch quality flags — exclude recruiters with serious unresolved complaints
      const { data: flags } = await db
        .from('fed_recruiter_feedback')
        .select('recruiter_email')
        .or('attempted_bypass.eq.true,misrepresented_role.eq.true')
        .eq('admin_review_status', 'pending'); // unresolved flags only
      const flaggedEmails = new Set((flags || []).map(f => f.recruiter_email.toLowerCase()));

      // Fetch recruiter profiles for display data
      const { data: profiles } = await db
        .from('fed_recruiter_profiles')
        .select('recruiter_email, firm_name, industry_focus, company_verified');
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.recruiter_email.toLowerCase()] = p; });

      // Aggregate counts by recruiter
      const counts = {};
      const recordIds = {};
      (placements || []).forEach(p => {
        const email = p.recruiter_email?.toLowerCase();
        if (!email) return;
        counts[email] = (counts[email] || 0) + 1;
        if (!recordIds[email]) recordIds[email] = [];
        recordIds[email].push(p.id);
      });

      // Build ranked list with eligibility checks
      const ranked = Object.entries(counts)
        .map(([email, count]) => {
          const override = overrideMap[email];
          const profile  = profileMap[email];

          // Eligibility
          let eligible = true;
          let reason   = null;

          if (override?.suppressed)  { eligible = false; reason = 'suppressed'; }
          if (override?.ineligible)  { eligible = false; reason = 'ineligible'; }
          if (blockedEmails.has(email)) { eligible = false; reason = 'payment_issue'; }
          if (flaggedEmails.has(email)) { eligible = false; reason = 'unresolved_complaints'; }
          if (!override?.approved && !profile?.company_verified) {
            // Must have admin approval or company verification to appear publicly
            eligible = false; reason = 'not_verified';
          }

          return { email, count, eligible, reason, override: override || null, profile: profile || null, record_ids: recordIds[email] };
        })
        .filter(r => r.eligible)
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_N)
        .map((r, idx) => ({
          rank:               idx + 1,
          firm_name:          r.profile?.firm_name || 'Verified Search Firm',
          industry_focus:     r.profile?.industry_focus || [],
          verified:           r.profile?.company_verified || false,
          placement_count:    r.count,
          period,
          // Never expose email in public response
        }));

      return res.status(200).json({
        leaderboard: ranked,
        period,
        since:       since?.toISOString() || null,
        computed_at: new Date().toISOString(),
        note: ranked.some(() => true) ? null : 'No verified placements in this period yet.',
      });

    } catch(e) {
      console.error('leaderboard error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── ADMIN POST ──────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const adminSecret = req.headers['x-admin-secret'] || '';
    if (!process.env.ADMIN_PASSWORD || adminSecret !== process.env.ADMIN_PASSWORD) {
      return res.status(403).json({ error: 'Admin authentication required.' });
    }

    const { action, recruiter_email, approved, suppressed, suppression_reason, ineligible, ineligibility_reason, admin_notes, period } = req.body || {};

    // ── ADMIN OVERRIDE ──────────────────────────────────────────────────────
    if (action === 'override') {
      if (!recruiter_email) return res.status(400).json({ error: 'recruiter_email required.' });

      await db.from('fed_leaderboard_overrides').upsert({
        recruiter_email:      recruiter_email.toLowerCase(),
        approved:             !!approved,
        suppressed:           !!suppressed,
        suppression_reason:   suppression_reason || null,
        ineligible:           !!ineligible,
        ineligibility_reason: ineligibility_reason || null,
        admin_notes:          admin_notes || null,
        updated_by:           'admin',
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'recruiter_email' });

      return res.status(200).json({ ok: true });
    }

    // ── SNAPSHOT (saves audit record of current leaderboard) ─────────────────
    if (action === 'snapshot') {
      const periods = ['30d','90d','12m','all'];
      const results = [];

      for (const p of periods) {
        const since = periodToDate(p);
        let query = db.from('fed_placements')
          .select('id, recruiter_email, placement_status')
          .in('placement_status', QUALIFYING_STATUSES)
          .neq('admin_review_status', 'disputed');
        if (since) query = query.gte('created_at', since.toISOString());
        const { data: rows } = await query;

        const counts = {};
        const rids   = {};
        (rows || []).forEach(r => {
          const e = r.recruiter_email?.toLowerCase();
          if (!e) return;
          counts[e] = (counts[e] || 0) + 1;
          if (!rids[e]) rids[e] = [];
          rids[e].push(r.id);
        });

        const { data: overrides } = await db.from('fed_leaderboard_overrides').select('*');
        const overrideMap = {};
        (overrides || []).forEach(o => { overrideMap[o.recruiter_email.toLowerCase()] = o; });

        const ranked = Object.entries(counts)
          .sort(([,a],[,b]) => b - a)
          .map(([email, count], idx) => {
            const override = overrideMap[email];
            return {
              period: p,
              recruiter_email: email,
              rank: idx + 1,
              placement_count: count,
              placement_record_ids: rids[email],
              eligibility_status: override?.ineligible ? 'ineligible' : override?.suppressed ? 'suppressed' : 'eligible',
              admin_override_status: override?.approved ? 'approved' : override?.suppressed ? 'suppressed' : 'none',
            };
          });

        for (const row of ranked) {
          await db.from('fed_leaderboard_snapshots').insert(row);
          results.push(row);
        }
      }

      return res.status(200).json({ ok: true, snapshots: results.length });
    }

    return res.status(400).json({ error: `Unknown admin action: ${action}` });
  }
};

function periodToDate(period) {
  const d = new Date();
  switch (period) {
    case '30d':  d.setDate(d.getDate() - 30); return d;
    case '90d':  d.setDate(d.getDate() - 90); return d;
    case '12m':  d.setFullYear(d.getFullYear() - 1); return d;
    case 'all':  return null;
    default:     d.setFullYear(d.getFullYear() - 1); return d;
  }
}
