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
const { sendEmail, brandedHtml } = require('./lib/email');
const { FOUNDING, placementCreditAmount } = require('./lib/pricing');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── HELPERS ────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// Native email send. Non-critical: a failure is logged but never throws,
// so a single bad address cannot abort a cron sweep.
async function notify(payload) {
  if (!payload || !payload.to_email) return { ok: false, skipped: true };
  const subject = payload.subject || 'Fredheim';
  const body = payload.body || '';
  const result = await sendEmail({
    to: payload.to_email,
    subject,
    text: body,
    html: brandedHtml(body, { heading: subject }),
  });
  if (!result.ok) console.log('Notify failed (non-critical):', result.error);
  return result;
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
    await notify({
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

    { const { error: e } = await supabase.from('talent_matches')
      .update({ cold_checkin_sent_at: new Date().toISOString() })
      .eq('id', eng.id);
      if (e) console.error('cold_checkin update failed:', eng.id, e); }

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
    { const { error: e } = await supabase.from('talent_matches')
      .update({ recruiter_status: 'archived', archived_at: now })
      .eq('id', eng.id);
      if (e) console.error('engagement archive update failed:', eng.id, e); }

    await notify({
      type:           'engagement_archived',
      to_email:       eng.talent_recruiters?.email,
      recruiter_name: eng.talent_recruiters?.contact_name,
      candidate_name: eng.talent_candidates?.first_name,
      subject:        `Fredheim engagement archived — ${eng.talent_candidates?.first_name}`,
      body:           `This engagement has reached its 90-day window and has been archived. If a placement was made, reporting it earns a credit toward a future curated introduction.`,
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

    await notify({
      type:           'recruiter_interest',
      to_email:       m.talent_candidates?.email,
      candidate_name: m.talent_candidates?.first_name,
      role_title:     m.talent_roles?.title,
      subject:        'A search firm has expressed interest in your profile',
      body:           `A retained search firm has expressed interest in your profile for a ${m.talent_roles?.title || 'senior leadership'} role. Do you want to connect? Your identity is only shared after you accept.`,
      accept_url:     acceptUrl,
      decline_url:    declineUrl,
    });

    { const { error: e } = await supabase.from('talent_matches')
      .update({ candidate_notified_at: new Date().toISOString() })
      .eq('id', m.id);
      if (e) console.error('candidate_notified update failed:', m.id, e); }

    sent++;
  }

  return sent;
}

// -- JOB 3b: INTRODUCTION REMINDERS + AUTO-ARCHIVE ---
// 7-day reminder, 14-day reminder, 30-day archive on confirmed introductions
// where neither party has updated status. Ghosting prevention.
async function runIntroductionReminders() {
  let reminders = 0, archived = 0;
  const day7  = new Date(Date.now() -  7 * 86400000).toISOString();
  const day14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const day30 = new Date(Date.now() - 30 * 86400000).toISOString();

  // 30-day archive
  const { data: stale } = await supabase
    .from('talent_matches')
    .select('id, talent_recruiters(email, contact_name), talent_candidates(first_name)')
    .lt('engaged_at', day30)
    .eq('recruiter_status', 'engaged')
    .is('archived_at', null);

  for (const m of stale || []) {
    { const { error: e } = await supabase.from('talent_matches')
      .update({ recruiter_status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', m.id);
      if (e) console.error('stale match archive update failed:', m.id, e); }
    if (m.talent_recruiters?.email) {
      await supabase.rpc('fed_increment_recruiter_ghost', { p_email: m.talent_recruiters.email }).catch(()=>{});
    }
    archived++;
  }

  // 7-day and 14-day reminders
  const buckets = [
    { tag: 'reminder_7',  threshold: day7,  key: 'reminder_7_sent_at' },
    { tag: 'reminder_14', threshold: day14, key: 'reminder_14_sent_at' },
  ];
  for (const bucket of buckets) {
    const { data: due } = await supabase
      .from('talent_matches')
      .select('id, engaged_at, last_activity_at, talent_recruiters(email, contact_name), talent_candidates(first_name)')
      .lt('engaged_at', bucket.threshold)
      .eq('recruiter_status', 'engaged')
      .is(bucket.key, null);

    for (const m of due || []) {
      await notify({
        type:           bucket.tag,
        to_email:       m.talent_recruiters?.email,
        recruiter_name: m.talent_recruiters?.contact_name,
        candidate_name: m.talent_candidates?.first_name,
        match_id:       m.id,
        subject:        `Quick status check on ${m.talent_candidates?.first_name}?`,
        body:           `Light reminder: a one-tap status update on this introduction helps our matching intelligence and keeps the relationship from ghosting.`,
        update_url:     `https://desk.fredheimtech.com?view=recruiter-talent&match=${m.id}`,
      });
      { const { error: e } = await supabase.from('talent_matches').update({ [bucket.key]: new Date().toISOString() }).eq('id', m.id);
        if (e) console.error('reminder timestamp update failed:', m.id, e); }
      reminders++;
    }
  }
  return { reminders_sent: reminders, archived_inactive: archived };
}

// -- JOB 3c: JOB LISTING EXPIRATION SWEEP ---
// Move fed_jobs past expires_at to status='expired' and surface a one-time
// expiration prompt to the recruiter via webhook. Skips listings already
// reposted recently or already marked closed/archived.
async function runJobListingExpiration() {
  let expired = 0, prompted = 0;
  const nowIso = new Date().toISOString();

  const { data: due } = await supabase
    .from('fed_jobs')
    .select('id, title, firm_name, firm_email, status, expires_at, last_expiration_prompt_at')
    .eq('status', 'active')
    .lt('expires_at', nowIso)
    .is('last_expiration_prompt_at', null);

  for (const j of due || []) {
    { const { error: e } = await supabase.from('fed_jobs').update({ status: 'expired', last_expiration_prompt_at: nowIso }).eq('id', j.id);
      if (e) console.error('job expiry update failed:', j.id, e); }
    await notify({
      type:           'job_expired',
      to_email:       j.firm_email,
      subject:        `Search expired: ${j.title}`,
      body:           `Your search for ${j.title} reached its 90-day window. Repost as-is, update, close, or archive from your dashboard.`,
      dashboard_url:  'https://desk.fredheimtech.com?view=recruiter-dash',
    });
    expired++;
    prompted++;
  }
  return { expired_listings: expired, expiration_prompts_sent: prompted };
}

// ── JOB 4: FOUNDING PARTNER CAP MONITORING ────────────────────
// Alerts admin when available Founding Partner spots fall below thresholds.
// Cap and deadline are configurable via env vars.
async function runFoundingCapCheck() {
  const FOUNDING_CAP      = FOUNDING.cap();
  const FOUNDING_DEADLINE = FOUNDING.deadline();
  const now               = new Date();

  const { count } = await supabase
    .from('talent_recruiters')
    .select('id', { count: 'exact', head: true })
    .eq('tier', 'founding');

  const remaining      = FOUNDING_CAP - (count || 0);
  const daysToDeadline = Math.floor((FOUNDING_DEADLINE - now) / 86400000);

  // Alert admin at milestone thresholds
  if ([5, 2, 1].includes(remaining) || (daysToDeadline > 0 && daysToDeadline <= 30)) {
    await notify({
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

  const creditAmount = placementCreditAmount();

  // Record the placement and issue credit
  const { error: placeErr } = await supabase.from('talent_matches').update({
    recruiter_status:        'placed',
    placed_at:               new Date().toISOString(),
    placement_credit_issued: true,
    placement_credit_amount: creditAmount,
  }).eq('id', matchId);
  if (placeErr) {
    console.error('placement credit update failed:', matchId, placeErr);
    return { error: `Failed to record placement: ${placeErr.message}` };
  }

  // Accumulate credit on recruiter record
  const { data: recruiter } = await supabase
    .from('talent_recruiters')
    .select('placement_credits, total_placements')
    .eq('id', recruiterId)
    .single();

  const { error: credErr } = await supabase.from('talent_recruiters').update({
    placement_credits: (recruiter?.placement_credits || 0) + creditAmount,
    total_placements:  (recruiter?.total_placements  || 0) + 1,
  }).eq('id', recruiterId);
  if (credErr) console.error('recruiter credit accumulation failed:', recruiterId, credErr);

  await notify({
    type:           'placement_reported',
    to_email:       match.talent_recruiters?.email,
    recruiter_name: match.talent_recruiters?.contact_name,
    credit_amount:  `$${creditAmount}`,
    subject:        `Placement confirmed — $${creditAmount} credit applied to your account`,
    body:           `Thank you for reporting this placement. A $${creditAmount} credit has been applied to your account and will be applied to a future curated introduction.`,
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
      introReminders,
      jobExpiration,
    ] = await Promise.all([
      runColdEngagementCheckins(),
      runAutoArchive(),
      runCandidateInterestNotifications(),
      runFoundingCapCheck(),
      runIntroductionReminders(),
      runJobListingExpiration(),
    ]);

    const summary = {
      success:                    true,
      ran_at:                     new Date().toISOString(),
      cold_checkins_sent:         coldCheckins,
      engagements_archived:       archived,
      interest_notifications_sent: interestNotifications,
      founding_partner_status:    foundingStatus,
      introduction_reminders:     introReminders,
      job_expiration:             jobExpiration,
    };

    console.log('talent-billing cron complete:', JSON.stringify(summary));
    return res.status(200).json(summary);

  } catch (err) {
    console.error('talent-billing cron error:', err);
    return res.status(500).json({ error: err.message || 'Cron job failed.' });
  }
};
