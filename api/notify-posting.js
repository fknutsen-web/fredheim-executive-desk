// api/notify-posting.js
// Fires when a new search posting is submitted via the Post a Search modal,
// or when an internship is submitted via the Early Careers InternEmployerModal.
// Sends two notifications via Zapier:
//   1. Admin alert with full submission details
//   2. Confirmation email to the submitting firm/employer

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const body = req.body || {};
  const isIntern = body.type === 'intern_posting';

  // Field-name normalization. The Executive Desk recruiter modal sends
  // {firm_name, contact_name, email, role_title, ...}. The Early Careers
  // InternEmployerModal spreads its own form object which uses
  // {employer_name, employer_email, title, compensation_display, ...} and
  // passes role_title as a convenience alias. Without this mapping the
  // notifications fired with all-undefined fields.
  const firm_name    = body.firm_name    || body.employer_name        || null;
  const contact_name = body.contact_name || body.employer_name        || null;
  const email        = body.email        || body.employer_email       || null;
  const role_title   = body.role_title   || body.title                || null;
  const role_level   = body.role_level   || null;
  const industry     = body.industry     || null;
  const location     = body.location     || null;
  const salary_range = body.salary_range || body.compensation_display || null;
  const notes        = body.notes        || body.role_summary         || null;

  const adminEmail  = process.env.ADMIN_EMAIL  || 'desk@fredheimtech.com';
  const zapierUrl   = process.env.ZAPIER_DESK_WEBHOOK;

  // -- ACTIVE SEARCH LIMIT GUARD --
  // Cap concurrent active searches per firm. Default 5 for standard tier.
  // Skipped entirely for intern postings and when the firm cannot be resolved.
  if (!isIntern && firm_name) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

      // Pull configurable limit from fed_pricing_config (defaults to 5).
      const { data: limitRow } = await sb
        .from('fed_pricing_config')
        .select('value_int')
        .eq('key', 'active_searches_standard')
        .maybeSingle();
      const standardLimit = (limitRow && limitRow.value_int) || 5;

      // Count active, non-expired postings for this firm.
      const nowIso = new Date().toISOString();
      const { count } = await sb
        .from('fed_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('firm_name', firm_name)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

      // Look up the firm's tier - 'enterprise' gets the higher limit.
      const { data: firmRow } = await sb
        .from('talent_recruiters')
        .select('tier')
        .eq('firm_name', firm_name)
        .maybeSingle();
      const tier = (firmRow && firmRow.tier) || 'standard';
      const effectiveLimit = tier === 'enterprise'
        ? ((await sb.from('fed_pricing_config').select('value_int').eq('key','active_searches_enterprise').maybeSingle()).data?.value_int || 25)
        : standardLimit;

      if ((count || 0) >= effectiveLimit) {
        return res.status(429).json({
          error: `Active search limit reached - ${count} of ${effectiveLimit} concurrent searches in use. Close or archive an existing search, or contact desk@fredheimtech.com about enterprise tier.`,
          active_count: count,
          limit: effectiveLimit,
          tier,
        });
      }
    } catch (e) {
      // Limit check is non-blocking on infrastructure failure - log and proceed.
      console.warn('active search limit check failed:', e.message);
    }
  }

  async function send(payload) {
    if (!zapierUrl) {
      // Caller used to silently drop notifications when the env var was
      // missing. Now we surface that in the response so production misconfig
      // is visible rather than hidden behind a green check.
      console.warn('ZAPIER_DESK_WEBHOOK not set — notification skipped:', payload.type);
      return { skipped: true, error: 'ZAPIER_DESK_WEBHOOK not set' };
    }
    try {
      const resp = await fetch(zapierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { ok: resp.ok, status: resp.status };
    } catch(e) {
      console.error('Zapier notify failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // ── 1. Admin alert ────────────────────────────────────────────
  const adminResult = await send({
    type:         isIntern ? 'new_intern_posting_admin_alert' : 'new_posting_admin_alert',
    to_email:     adminEmail,
    subject:      isIntern
      ? `New internship posting — ${firm_name || 'Unknown employer'}: ${role_title || 'Untitled'}`
      : `New search posting — ${firm_name || 'Unknown firm'}: ${role_title || 'Untitled'}`,
    firm_name,
    contact_name,
    submitter_email: email,
    role_title,
    role_level,
    industry,
    location,
    salary_range,
    notes,
    submitted_at: new Date().toISOString(),
    review_url:   'https://desk.fredheimtech.com?admin=true',
  });

  // ── 2. Submitter confirmation ─────────────────────────────────
  let submitterResult = null;
  if (email) {
    submitterResult = await send({
      type:       isIntern ? 'new_intern_posting_confirmation' : 'new_posting_confirmation',
      to_email:   email,
      subject:    isIntern
        ? 'Fredheim Early Careers — Internship submission received'
        : 'Fredheim Executive Desk — Submission received',
      firm_name,
      contact_name,
      role_title,
      body: isIntern
        ? `Hi ${contact_name || 'there'},\n\nYour internship posting for ${role_title} has been received. We'll review it within 24 hours. Once approved, your internship will be live and qualified student candidates will begin matching based on their structured profiles.\n\nReminder: Fredheim Early Careers uses structured candidate profiles — resume exchange occurs after mutual interest and is handled directly between the parties.\n\nQuestions? Reply to this email or reach us at desk@fredheimtech.com.\n\nFredheim Early Careers\ndesk@fredheimtech.com`
        : `Hi ${contact_name || 'there'},\n\nYour search posting for ${role_title} has been received. We'll review it and confirm within 24 hours. As a Founding Partner, this counts as your complimentary posting for the month.\n\nQuestions? Reply to this email or reach us at desk@fredheimtech.com.\n\nFredheim Executive Desk\ndesk@fredheimtech.com`,
    });
  }

  return res.status(200).json({
    ok: true,
    type: isIntern ? 'intern_posting' : 'search_posting',
    admin_notified: !!adminResult?.ok,
    submitter_notified: !!submitterResult?.ok,
    zapier_configured: !!zapierUrl,
  });
};
