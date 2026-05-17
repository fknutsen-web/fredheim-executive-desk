// api/talent-notify.js
// Notification dispatch: real-time alerts, daily digest, weekly summary
// Uses Zapier webhook (same pattern as stripe-webhook.js) for email/SMS delivery

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Send via Zapier webhook — handles email + SMS routing
async function sendViaZapier(webhookUrl, payload) {
  if (!webhookUrl) {
    // CRITICAL: callers used to treat `skipped: true` as success which marked
    // the notification as delivered=true in the DB. That made misconfigured
    // production environments look healthy while no emails actually fired.
    return { ok: false, skipped: true, error: 'Zapier webhook URL not configured' };
  }
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: resp.ok, status: resp.status };
}

// Mark notification as sent in log
async function markSent(notificationId, delivered, error = null) {
  await supabase.from('talent_notifications').update({
    sent_at: new Date().toISOString(),
    delivered,
    error,
  }).eq('id', notificationId);
}

// ── REAL-TIME ALERT ────────────────────────────────────────────
async function dispatchRealtimeAlerts() {
  const { data: pending } = await supabase
    .from('talent_notifications')
    .select(`
      id, candidate_id, role_id, recruiter_id,
      talent_candidates ( first_name, score_composite, badge_seasoned_exec, badge_tech_forward, badge_pivot, score_executive_fit, score_technology, score_change_mgmt, score_background ),
      talent_roles ( title, notify_email, notify_phone, notify_sms ),
      talent_recruiters ( email, phone, firm_name )
    `)
    .eq('type', 'realtime_alert')
    .is('sent_at', null)
    .limit(50);

  let sent = 0;
  for (const n of pending || []) {
    const c = n.talent_candidates;
    const role = n.talent_roles;
    const recruiter = n.talent_recruiters;
    const toEmail = role?.notify_email || recruiter?.email;
    const toPhone = role?.notify_phone || recruiter?.phone;
    const matchUrl = `https://desk.fredheimtech.com?view=recruiter-talent&candidate=${n.candidate_id}&role=${n.role_id}`;

    const payload = {
      type: 'realtime_alert',
      to_email: toEmail,
      to_phone: toPhone,
      send_sms: role?.notify_sms,
      subject: `⭐ New ${c?.score_composite}% match for ${role?.title}`,
      candidate_first_name: c?.first_name,
      match_pct: c?.score_composite,
      role_title: role?.title,
      badge_seasoned: c?.badge_seasoned_exec,
      badge_tech: c?.badge_tech_forward,
      badge_pivot: c?.badge_pivot,
      score_exec: c?.score_executive_fit,
      score_tech: c?.score_technology,
      score_change: c?.score_change_mgmt,
      score_bg: c?.score_background,
      review_url: matchUrl,
      sms_text: `New ${c?.score_composite}% match for ${role?.title} — ${c?.first_name}${c?.badge_seasoned_exec ? ', ⭐ Seasoned Exec' : ''}. Review: ${matchUrl}`,
    };

    try {
      const result = await sendViaZapier(process.env.ZAPIER_TALENT_WEBHOOK, payload);
      await markSent(n.id, result.ok, result.error || (result.ok ? null : `HTTP ${result.status}`));
      if (result.ok) sent++;
    } catch (e) {
      await markSent(n.id, false, e.message);
    }
  }
  return sent;
}

// ── DAILY DIGEST ───────────────────────────────────────────────
async function dispatchDailyDigests() {
  const { data: recruiters } = await supabase
    .from('talent_recruiters')
    .select('id, email, firm_name, contact_name')
    .eq('notify_daily', true);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let sent = 0;

  for (const recruiter of recruiters || []) {
    const { data: matches } = await supabase
      .from('talent_matches')
      .select(`
        match_pct, created_at,
        talent_candidates ( first_name, score_composite, badge_seasoned_exec, badge_tech_forward, badge_pivot, answers ),
        talent_roles ( title, min_match_pct )
      `)
      .eq('recruiter_id', recruiter.id)
      .eq('recruiter_status', 'new')
      .gte('created_at', yesterday.toISOString())
      .order('match_pct', { ascending: false });

    if (!matches || matches.length === 0) continue;

    const candidateRows = matches.map(m => ({
      name: m.talent_candidates?.first_name,
      match_pct: m.match_pct,
      role: m.talent_roles?.title,
      seasoned: m.talent_candidates?.badge_seasoned_exec,
      tech: m.talent_candidates?.badge_tech_forward,
      pivot: m.talent_candidates?.badge_pivot,
      industry: m.talent_candidates?.answers?.B1,
    }));

    const payload = {
      type: 'daily_digest',
      to_email: recruiter.email,
      subject: `Your Fredheim Talent Digest — ${matches.length} new match${matches.length !== 1 ? 'es' : ''}`,
      recruiter_name: recruiter.contact_name || recruiter.firm_name,
      total_new: matches.length,
      candidates: candidateRows,
      dashboard_url: 'https://desk.fredheimtech.com?view=recruiter-talent',
      date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    };

    try {
      const result = await sendViaZapier(process.env.ZAPIER_TALENT_WEBHOOK, payload);
      await supabase.from('talent_notifications').insert({
        type: 'daily_digest',
        recruiter_id: recruiter.id,
        recipient_email: recruiter.email,
        subject: payload.subject,
        body_preview: `${matches.length} new matches`,
        sent_at: new Date().toISOString(),
        delivered: result.ok,
        error: result.error || (result.ok ? null : `HTTP ${result.status}`),
      });
      if (result.ok) sent++;
    } catch (e) {
      console.error('Daily digest error for', recruiter.email, e.message);
    }
  }
  return sent;
}

// ── WEEKLY SUMMARY ─────────────────────────────────────────────
async function dispatchWeeklySummaries() {
  const { data: recruiters } = await supabase
    .from('talent_recruiters')
    .select('id, email, firm_name, contact_name')
    .eq('notify_weekly', true);

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  let sent = 0;

  for (const recruiter of recruiters || []) {
    const { data: allMatches } = await supabase
      .from('talent_matches')
      .select('match_pct, recruiter_status, talent_candidates ( badge_seasoned_exec, badge_pivot )')
      .eq('recruiter_id', recruiter.id)
      .gte('created_at', lastWeek.toISOString());

    const { data: roles } = await supabase
      .from('talent_roles')
      .select('id, title, min_match_pct')
      .eq('recruiter_id', recruiter.id)
      .eq('status', 'active');

    const total = allMatches?.length || 0;
    const tier90 = allMatches?.filter(m => m.match_pct >= 90).length || 0;
    const tier75 = allMatches?.filter(m => m.match_pct >= 75 && m.match_pct < 90).length || 0;
    const tier50 = allMatches?.filter(m => m.match_pct >= 50 && m.match_pct < 75).length || 0;
    const seasonedCount = allMatches?.filter(m => m.talent_candidates?.badge_seasoned_exec).length || 0;
    const pivotCount = allMatches?.filter(m => m.talent_candidates?.badge_pivot).length || 0;
    const unreviewed = allMatches?.filter(m => m.recruiter_status === 'new').length || 0;

    if (total === 0 && unreviewed === 0) continue;

    const payload = {
      type: 'weekly_summary',
      to_email: recruiter.email,
      subject: `Fredheim Weekly Talent Report — Week of ${lastWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      recruiter_name: recruiter.contact_name || recruiter.firm_name,
      total_this_week: total,
      tier_90_plus: tier90,
      tier_75_89: tier75,
      tier_50_74: tier50,
      seasoned_exec_count: seasonedCount,
      pivot_candidate_count: pivotCount,
      unreviewed_count: unreviewed,
      active_roles: roles?.map(r => r.title) || [],
      dashboard_url: 'https://desk.fredheimtech.com?view=recruiter-talent',
    };

    try {
      const result = await sendViaZapier(process.env.ZAPIER_TALENT_WEBHOOK, payload);
      await supabase.from('talent_notifications').insert({
        type: 'weekly_summary',
        recruiter_id: recruiter.id,
        recipient_email: recruiter.email,
        subject: payload.subject,
        body_preview: `${total} matches this week, ${unreviewed} unreviewed`,
        sent_at: new Date().toISOString(),
        delivered: result.ok,
        error: result.error || (result.ok ? null : `HTTP ${result.status}`),
      });
      if (result.ok) sent++;
    } catch (e) {
      console.error('Weekly summary error for', recruiter.email, e.message);
    }
  }
  return sent;
}

// ── CANDIDATE RE-ENGAGEMENT EMAILS ─────────────────────────────
async function dispatchCandidateNotifications() {
  const types = [
    'candidate_reengagement_1',
    'candidate_reengagement_2',
    'candidate_reengagement_3',
    'candidate_confirmation',
    'candidate_refresh_prompt',
    'candidate_archived',
  ];

  const { data: pending } = await supabase
    .from('talent_notifications')
    .select('id, type, recipient_email, subject, body_preview, candidate_id')
    .in('type', types)
    .is('sent_at', null)
    .limit(100);

  let sent = 0;
  for (const n of pending || []) {
    const confirmUrl = `https://desk.fredheimtech.com?view=talent-confirm&cid=${n.candidate_id}`;

    const payload = {
      type: n.type,
      to_email: n.recipient_email,
      subject: n.subject,
      body: n.body_preview,
      confirm_url: confirmUrl,
      reactivate_url: `https://desk.fredheimtech.com?view=talent-reactivate&cid=${n.candidate_id}`,
    };

    try {
      const result = await sendViaZapier(process.env.ZAPIER_TALENT_CANDIDATE_WEBHOOK, payload);
      await markSent(n.id, result.ok, result.error || (result.ok ? null : `HTTP ${result.status}`));
      if (result.ok) sent++;
    } catch (e) {
      await markSent(n.id, false, e.message);
    }
  }
  return sent;
}

// ── MAIN HANDLER ───────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  // Auth check for cron jobs
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { job } = req.query;

  try {
    if (job === 'realtime') {
      const sent = await dispatchRealtimeAlerts();
      return res.status(200).json({ success: true, job: 'realtime', sent });
    }

    if (job === 'daily') {
      const sent = await dispatchDailyDigests();
      return res.status(200).json({ success: true, job: 'daily', sent });
    }

    if (job === 'weekly') {
      const sent = await dispatchWeeklySummaries();
      return res.status(200).json({ success: true, job: 'weekly', sent });
    }

    if (job === 'candidates') {
      const sent = await dispatchCandidateNotifications();
      return res.status(200).json({ success: true, job: 'candidates', sent });
    }

    if (job === 'all') {
      const [rt, daily, weekly, candidates] = await Promise.all([
        dispatchRealtimeAlerts(),
        dispatchDailyDigests(),
        dispatchWeeklySummaries(),
        dispatchCandidateNotifications(),
      ]);
      return res.status(200).json({ success: true, realtime: rt, daily, weekly, candidates });
    }

    return res.status(400).json({ error: 'Unknown job. Use: realtime | daily | weekly | candidates | all' });

  } catch (err) {
    console.error('talent-notify error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
