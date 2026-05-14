// api/talent-billing.js
// Vercel cron job — runs daily at 08:00 UTC
// Handles:
//   1. 14-day cold engagement check-in (no activity on an active engagement)
//   2. Day-90 auto-archive of completed engagements
//   3. Candidate interest notification (express interest flow)
//   4. Founding Partner cap monitoring and admin alerts
//   5. Placement credit reporting
//
// NOTE: There are no continuation fees in this model.
// The engagement unlock is a single one-time payment at the point of introduction,
// tiered by match age (0–30 = $500, 31–60 = $350, 61–90 = $200, 90+ = complimentary).
// After unlock, the recruiter-candidate relationship is direct and requires no further billing.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── HELPERS ────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

async function notify(webhookUrl, payload) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log('Notify failed (non-critical):', e.message);
  }
}

// ── JOB 1: COLD ENGAGEMENT CHECK-IN (14 days no activity) ─────
// Prompts recruiter to confirm engagement is still active.
// If they close it, the engagement ends cleanly with no further action.
async function runColdEngagementCheckins() {
  const day14 = new Date(Date.now() - 14 * 86400000).toISOString();
  let sent = 0;

  const { data: coldEngagements } = await supabase
    .from('talent_matches')
    .select(`
      id, engaged_at, last_activity_at,
      talent_recruiters ( email, contact_name ),
      talent_candidates ( first_name )
    `)
    .eq('recruiter_status', 'engaged')
    .lt('last_activity_at', day14)
    .is('cold_checkin_sent_at', null);

  for (const eng of coldEngagements || []) {
    await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
      type:           'cold_engagement_checkin',
      to_email:       eng.talent_recruiters?.email,
      recruiter_name: eng.talent_recruiters?.contact_name,
      candidate_name: eng.talent_candidates?.first_name,
      match_id:       eng.id,
      days_engaged:   daysSince(eng.engaged_at),
      subject:        `Is your engagement with ${eng.talent_candidates?.first_name} still active?`,
      body:           `We noticed no activity on this engagement in 14 days. If the search has concluded, let us know — it helps us keep the platform current for all parties.`,
      close_url:      `https://desk.fredheimtech.com?view=recruiter-talent&close=${eng.id}`,
      keep_url:       `https://desk.fredheimtech.com?view=recruiter-talent&keep=${eng.id}`,
    });

    await supabase.from('talent_matches')
      .update({ cold_checkin_sent_at: new Date().toISOString() })
      .eq('id', eng.id);

    sent++;
  }

  return sent;
}

// ── JOB 2: AUTO-ARCHIVE COMPLETED ENGAGEMENTS (day 90+) ───────
// Engagements are archived 90 days after the unlock date.
// Recruiter is prompted to report a placement and earn a credit.
async function runAutoArchive() {
  const now = new Date().toISOString();
  let archived = 0;

  const { data: toArchive } = await supabase
    .from('talent_matches')
    .select('id, talent_recruiters(email, contact_name), talent_candidates(first_name)')
    .lt('auto_archive_at', now)
    .eq('recruiter_status', 'engaged');

  for (const eng of toArchive || []) {
    await supabase.from('talent_matches')
      .update({ recruiter_status: 'archived', archived_at: now })
      .eq('id', eng.id);

    await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
      type:           'engagement_archived',
      to_email:       eng.talent_recruiters?.email,
      recruiter_name: eng.talent_recruiters?.contact_name,
      candidate_name: eng.talent_candidates?.first_name,
      subject:        `Fredheim engagement archived — ${eng.talent_candidates?.first_name}`,
      body:           `This engagement has reached its 90-day window and has been archived. If a placement was made, reporting it earns a credit toward your next engagement unlock.`,
      report_url:     `https://desk.fredheimtech.com?view=recruiter-talent&report=${eng.id}`,
    });

    archived++;
  }

  return archived;
}

// ── JOB 3: CANDIDATE INTEREST NOTIFICATION ────────────────────
// When a recruiter clicks Express Interest, candidate is notified before any payment.
// The recruiter pays the unlock fee only after the candidate accepts.
async function runCandidateInterestNotifications() {
  let sent = 0;

  const { data: pending } = await supabase
    .from('talent_matches')
    .select(`
      id,
      talent_candidates ( id, first_name, email, status ),
      talent_roles ( title ),
      talent_recruiters ( firm_name )
    `)
    .eq('recruiter_status', 'interest_expressed')
    .is('candidate_notified_at', null);

  for (const m of pending || []) {
    if (m.talent_candidates?.status === 'archived') continue;

    const acceptUrl  = `https://desk.fredheimtech.com?view=talent-accept&match=${m.id}`;
    const declineUrl = `https://desk.fredheimtech.com?view=talent-decline&match=${m.id}`;

    await notify(process.env.ZAPIER_TALENT_CANDIDATE_WEBHOOK, {
      type:           'recruiter_interest',
      to_email:       m.talent_candidates?.email,
      candidate_name: m.talent_candidates?.first_name,
      role_title:     m.talent_roles?.title,
      subject:        'A search firm has expressed interest in your profile',
      body:           `A retained search firm has expressed interest in your profile for a ${m.talent_roles?.title || 'senior leadership'} role. Do you want to connect? Your identity is only shared after you accept.`,
      accept_url:     acceptUrl,
      decline_url:    declineUrl,
    });

    await supabase.from('talent_matches')
      .update({ candidate_notified_at: new Date().toISOString() })
      .eq('id', m.id);

    sent++;
  }

  return sent;
}

// ── JOB 4: FOUNDING PARTNER CAP MONITORING ────────────────────
// Alerts admin when available Founding Partner spots fall below thresholds.
// Cap and deadline are configurable via env vars.
async function runFoundingCapCheck() {
  const FOUNDING_CAP      = parseInt(process.env.FOUNDING_CAP || '25', 10);
  const FOUNDING_DEADLINE = new Date(process.env.FOUNDING_DEADLINE || '2026-12-31T23:59:59Z');
  const now               = new Date();

  const { count } = await supabase
    .from('talent_recruiters')
    .select('id', { count: 'exact', head: true })
    .eq('tier', 'founding');

  const remaining      = FOUNDING_CAP - (count || 0);
  const daysToDeadline = Math.floor((FOUNDING_DEADLINE - now) / 86400000);

  // Alert admin at milestone thresholds
  if ([5, 2, 1].includes(remaining) || (daysToDeadline > 0 && daysToDeadline <= 30)) {
    await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
      type:             'founding_cap_alert',
      to_email:         process.env.ADMIN_EMAIL || 'desk@fredheimtech.com',
      subject:          `Founding Partner Program — ${remaining} spots remaining`,
      body:             `${count} of ${FOUNDING_CAP} founding partner spots are filled. ${remaining} remaining. Deadline: ${FOUNDING_DEADLINE.toDateString()} (${daysToDeadline} days).`,
      remaining,
      days_to_deadline: daysToDeadline,
    });
  }

  return { founding_count: count, remaining, days_to_deadline: daysToDeadline };
}

// ── PLACEMENT CREDIT HANDLER ───────────────────────────────────
// Called when a recruiter self-reports a successful placement.
// Issues a flat credit applied against their next engagement unlock.
// Credit amount is configurable via PLACEMENT_CREDIT_AMOUNT env var (default: $250).
async function handlePlacementReport(matchId, recruiterId) {
  const { data: match } = await supabase
    .from('talent_matches')
    .select('fee_unlock_bracket, talent_recruiters(email, contact_name)')
    .eq('id', matchId)
    .single();

  if (!match) return { error: 'Match not found.' };

  const creditAmount = parseInt(process.env.PLACEMENT_CREDIT_AMOUNT || '250', 10);

  // Record the placement and issue credit
  await supabase.from('talent_matches').update({
    recruiter_status:        'placed',
    placed_at:               new Date().toISOString(),
    placement_credit_issued: true,
    placement_credit_amount: creditAmount,
  }).eq('id', matchId);

  // Accumulate credit on recruiter record
  const { data: recruiter } = await supabase
    .from('talent_recruiters')
    .select('placement_credits, total_placements')
    .eq('id', recruiterId)
    .single();

  await supabase.from('talent_recruiters').update({
    placement_credits: (recruiter?.placement_credits || 0) + creditAmount,
    total_placements:  (recruiter?.total_placements  || 0) + 1,
  }).eq('id', recruiterId);

  await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
    type:           'placement_reported',
    to_email:       match.talent_recruiters?.email,
    recruiter_name: match.talent_recruiters?.contact_name,
    credit_amount:  `$${creditAmount}`,
    subject:        `Placement confirmed — $${creditAmount} credit applied to your account`,
    body:           `Thank you for reporting this placement. A $${creditAmount} credit has been applied to your account and will be deducted from your next engagement unlock fee.`,
    dashboard_url:  'https://desk.fredheimtech.com?view=recruiter-talent&tab=billing',
  });

  return { success: true, credit_amount: creditAmount };
}

// ── MAIN HANDLER ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Auth check — Vercel cron passes CRON_SECRET as Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  // Placement report — POST with action=placement
  if (req.method === 'POST') {
    const { action, match_id, recruiter_id } = req.body || {};
    if (action === 'placement' && match_id && recruiter_id) {
      const result = await handlePlacementReport(match_id, recruiter_id);
      return res.status(200).json(result);
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  console.log('talent-billing cron starting:', new Date().toISOString());

  try {
    const [
      coldCheckins,
      archived,
      interestNotifications,
      foundingStatus,
    ] = await Promise.all([
      runColdEngagementCheckins(),
      runAutoArchive(),
      runCandidateInterestNotifications(),
      runFoundingCapCheck(),
    ]);

    const summary = {
      success:                    true,
      ran_at:                     new Date().toISOString(),
      cold_checkins_sent:         coldCheckins,
      engagements_archived:       archived,
      interest_notifications_sent: interestNotifications,
      founding_partner_status:    foundingStatus,
    };

    console.log('talent-billing cron complete:', JSON.stringify(summary));
    return res.status(200).json(summary);

  } catch (err) {
    console.error('talent-billing cron error:', err);
    return res.status(500).json({ error: err.message || 'Cron job failed.' });
  }
};
