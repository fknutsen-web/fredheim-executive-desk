// api/admin-oversight.js
// Admin marketplace oversight. Service-role reads, admin-authenticated.
// Returns the monitoring views the desk needs:
//   - pending mutual interests (awaiting payment)
//   - paid introductions
//   - introductions requiring manual review
//   - failed payments
//   - revenue by recruiter
//   - revenue by candidate tier
//
// GET /api/admin-oversight   (Authorization: Bearer <admin token>  OR  X-Admin-Secret)

const { createClient } = require('@supabase/supabase-js');
const { isAuthorizedAdmin } = require('./admin-auth');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Admin authentication required.' });
  }

  // Admin profile roster. fed_profiles RLS no longer permits a blanket client
  // read (confidential profiles must not be reachable via the publishable key),
  // so the admin console loads the full roster through this service-role route.
  if (req.query.resource === 'profiles') {
    try {
      const { data: profiles, error } = await db
        .from('fed_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, profiles: profiles || [] });
    } catch (e) {
      console.error('admin-oversight profiles error:', e);
      return res.status(500).json({ error: e.message || 'Internal error.' });
    }
  }

  // Recruiter billing roster — fed_recruiter_billing is service-role only, so
  // the admin billing tab loads it through here rather than the anon client.
  if (req.query.resource === 'billing') {
    try {
      const { data, error } = await db
        .from('fed_recruiter_billing')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, billing: data || [] });
    } catch (e) {
      console.error('admin-oversight billing error:', e);
      return res.status(500).json({ error: e.message || 'Internal error.' });
    }
  }

  // Recruiter submissions roster. fed_recruiter_submissions no longer permits a
  // blanket client read (inquiry data must not be reachable via the publishable
  // key), so the admin console loads the full roster through this service-role
  // route. Recruiters still read their OWN submission via a scoped RLS policy.
  if (req.query.resource === 'submissions') {
    try {
      const { data, error } = await db
        .from('fed_recruiter_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, submissions: data || [] });
    } catch (e) {
      console.error('admin-oversight submissions error:', e);
      return res.status(500).json({ error: e.message || 'Internal error.' });
    }
  }

  // Job closures + placements rosters — admin moderation reads (service role).
  // Recruiters still read their OWN rows via scoped RLS policies.
  if (req.query.resource === 'closures') {
    try {
      const { data, error } = await db.from('fed_job_closures').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, closures: data || [] });
    } catch (e) {
      console.error('admin-oversight closures error:', e);
      return res.status(500).json({ error: e.message || 'Internal error.' });
    }
  }
  if (req.query.resource === 'placements') {
    try {
      const { data, error } = await db.from('fed_placements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, placements: data || [] });
    } catch (e) {
      console.error('admin-oversight placements error:', e);
      return res.status(500).json({ error: e.message || 'Internal error.' });
    }
  }

  // Leaderboard overrides — service-role only; read here for the admin tab.
  if (req.query.resource === 'overrides') {
    try {
      const { data, error } = await db
        .from('fed_leaderboard_overrides')
        .select('*');
      if (error) throw error;
      return res.status(200).json({ ok: true, overrides: data || [] });
    } catch (e) {
      console.error('admin-oversight overrides error:', e);
      return res.status(500).json({ error: e.message || 'Internal error.' });
    }
  }

  try {
    // Pending mutual interests — both signaled, awaiting payment/unlock.
    const { data: pendingMutual } = await db
      .from('fed_matches')
      .select('id, job_id, recruiter_email, candidate_email, status, mutual_interest_at, match_score')
      .eq('status', 'mutual_interest')
      .order('mutual_interest_at', { ascending: false })
      .limit(200);

    // Paid introductions.
    const { data: paidIntros } = await db
      .from('fed_paid_introductions')
      .select('id, match_id, job_id, recruiter_email, candidate_email, amount_paid, currency, paid_at, status')
      .order('paid_at', { ascending: false })
      .limit(500);

    // Introductions requiring manual review.
    const { data: review } = await db
      .from('fed_paid_introductions')
      .select('id, match_id, recruiter_email, candidate_email, amount_paid, status, created_at')
      .eq('status', 'review')
      .order('created_at', { ascending: false })
      .limit(200);

    // Failed payments (from the audit log, if recorded) + matches stuck pre-unlock.
    const { data: failed } = await db
      .from('fed_audit_events')
      .select('id, event_type, recruiter_email, candidate_email, amount, detail, created_at')
      .eq('event_type', 'payment_failed')
      .order('created_at', { ascending: false })
      .limit(200);

    // Revenue by recruiter.
    const byRecruiter = {};
    for (const p of paidIntros || []) {
      if (p.status !== 'paid') continue;
      const k = (p.recruiter_email || 'unknown').toLowerCase();
      byRecruiter[k] = byRecruiter[k] || { recruiter_email: k, introductions: 0, revenue: 0 };
      byRecruiter[k].introductions += 1;
      byRecruiter[k].revenue += Number(p.amount_paid || 0);
    }
    const revenueByRecruiter = Object.values(byRecruiter).sort((a, b) => b.revenue - a.revenue);

    // Revenue by candidate tier — subscription revenue split by fed_profiles.tier.
    const { data: subscribers } = await db
      .from('fed_profiles')
      .select('tier')
      .not('tier', 'is', null);
    const tierCounts = {};
    for (const s of subscribers || []) {
      const t = s.tier || 'free';
      tierCounts[t] = (tierCounts[t] || 0) + 1;
    }
    const introRevenueTotal = (paidIntros || [])
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

    return res.status(200).json({
      ok: true,
      generated_at: new Date().toISOString(),
      pending_mutual_interests: pendingMutual || [],
      paid_introductions: paidIntros || [],
      introductions_requiring_review: review || [],
      failed_payments: failed || [],
      revenue_by_recruiter: revenueByRecruiter,
      revenue_by_candidate_tier: tierCounts,
      introduction_revenue_total: introRevenueTotal,
    });
  } catch (e) {
    console.error('admin-oversight error:', e);
    return res.status(500).json({ error: e.message || 'Internal error.' });
  }
};
