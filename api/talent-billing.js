// api/talent-billing.js
// Vercel cron job — runs daily at 08:00 UTC
// Handles:
//   1. 30/60/90-day continuation fee triggers
//   2. 14-day cold engagement check-in
//   3. Day-90 auto-archive of completed engagements
//   4. Candidate interest notification (express interest flow)
//   5. Founding Partner cap check and notifications

// vercel.json cron config (add to your vercel.json):
// "crons": [{ "path": "/api/talent-billing", "schedule": "0 8 * * *" }]

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

// Fee amounts by tier and day for notification copy
const FEE_AMOUNTS = {
  professional: { 0: '$200', 30: '$150', 60: '$100', 90: '$75'  },
  senior:       { 0: '$500', 30: '$350', 60: '$250', 90: '$150' },
  executive:    { 0: '$1,000', 30: '$700', 60: '$500', 90: '$300' },
};

const MAX_FEES = {
  professional: '$525',
  senior:       '$1,250',
  executive:    '$2,500',
};

// ── JOB 1: CONTINUATION FEE TRIGGERS ──────────────────────────
async function runContinuationFees() {
  const results = { day30: 0, day60: 0, day90: 0, skipped: 0 };

  // Fetch all active engagements
  const { data: engagements, error } = await supabase
    .from('talent_matches')
    .select(`
      id, engaged_at, candidate_tier,
      fee_day30_paid, fee_day60_paid, fee_day90_paid,
      fee_day30_notified, fee_day60_notified, fee_day90_notified,
      recruiter_id,
      talent_recruiters ( id, email, stripe_customer_id, contact_name, firm_name ),
      talent_candidates ( first_name, score_composite )
    `)
    .eq('recruiter_status', 'engaged')
    .not('engaged_at', 'is', null);

  if (error) { console.error('Continuation fee fetch error:', error); return results; }

  for (const eng of engagements || []) {
    const days = daysSince(eng.engaged_at);
    const tier = eng.candidate_tier || 'senior';
    const rEmail = eng.talent_recruiters?.email;

    // ── DAY 30 ──────────────────────────────────────────────
    if (days >= 30 && !eng.fee_day30_paid && !eng.fee_day30_notified) {
      try {
        // Send advance notice at day 16 (14 days before charge fires at day 30)
        if (days >= 16 && days < 30) {
          await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
            type: 'continuation_advance_notice',
            to_email: rEmail,
            day: 30,
            fee: FEE_AMOUNTS[tier]?.[30],
            candidate_name: eng.talent_candidates?.first_name,
            match_id: eng.id,
            subject: `Fredheim — Day 30 continuation fee notice (${FEE_AMOUNTS[tier]?.[30]})`,
            close_url: `https://desk.fredheimtech.com?view=recruiter-talent&close=${eng.id}`,
          });
          await supabase.from('talent_matches').update({ fee_day30_notified: new Date().toISOString() }).eq('id', eng.id);
        }

        // Trigger actual charge at day 30+
        if (days >= 30) {
          const chargeResp = await fetch(`${process.env.VERCEL_URL}/api/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'continuation',
              match_id: eng.id,
              candidate_tier: tier,
              day: 30,
              recruiter_id: eng.recruiter_id,
              email: rEmail,
            }),
          });
          const chargeData = await chargeResp.json();

          if (chargeData.method === 'checkout') {
            // No saved card — send checkout link
            await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
              type: 'continuation_payment_required',
              to_email: rEmail,
              day: 30,
              fee: FEE_AMOUNTS[tier]?.[30],
              candidate_name: eng.talent_candidates?.first_name,
              checkout_url: chargeData.url,
              subject: `Fredheim — Day 30 continuation fee due (${FEE_AMOUNTS[tier]?.[30]})`,
            });
          }

          results.day30++;
        }
      } catch (e) {
        console.error(`Day 30 fee error for match ${eng.id}:`, e.message);
        results.skipped++;
      }
    }

    // ── DAY 60 ──────────────────────────────────────────────
    if (days >= 60 && !eng.fee_day60_paid && !eng.fee_day60_notified) {
      try {
        if (days >= 46 && days < 60) {
          await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
            type: 'continuation_advance_notice',
            to_email: rEmail,
            day: 60,
            fee: FEE_AMOUNTS[tier]?.[60],
            candidate_name: eng.talent_candidates?.first_name,
            match_id: eng.id,
            subject: `Fredheim — Day 60 continuation fee notice (${FEE_AMOUNTS[tier]?.[60]})`,
            close_url: `https://desk.fredheimtech.com?view=recruiter-talent&close=${eng.id}`,
          });
          await supabase.from('talent_matches').update({ fee_day60_notified: new Date().toISOString() }).eq('id', eng.id);
        }

        if (days >= 60) {
          const chargeResp = await fetch(`${process.env.VERCEL_URL}/api/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'continuation',
              match_id: eng.id,
              candidate_tier: tier,
              day: 60,
              recruiter_id: eng.recruiter_id,
              email: rEmail,
            }),
          });
          const chargeData = await chargeResp.json();

          if (chargeData.method === 'checkout') {
            await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
              type: 'continuation_payment_required',
              to_email: rEmail,
              day: 60,
              fee: FEE_AMOUNTS[tier]?.[60],
              candidate_name: eng.talent_candidates?.first_name,
              checkout_url: chargeData.url,
              subject: `Fredheim — Day 60 continuation fee due (${FEE_AMOUNTS[tier]?.[60]})`,
            });
          }

          results.day60++;
        }
      } catch (e) {
        console.error(`Day 60 fee error for match ${eng.id}:`, e.message);
        results.skipped++;
      }
    }

    // ── DAY 90 ──────────────────────────────────────────────
    if (days >= 90 && !eng.fee_day90_paid && !eng.fee_day90_notified) {
      try {
        if (days >= 76 && days < 90) {
          await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
            type: 'continuation_advance_notice',
            to_email: rEmail,
            day: 90,
            fee: FEE_AMOUNTS[tier]?.[90],
            candidate_name: eng.talent_candidates?.first_name,
            match_id: eng.id,
            subject: `Fredheim — Final continuation fee notice (${FEE_AMOUNTS[tier]?.[90]}) — engagement closing`,
            close_url: `https://desk.fredheimtech.com?view=recruiter-talent&close=${eng.id}`,
          });
          await supabase.from('talent_matches').update({ fee_day90_notified: new Date().toISOString() }).eq('id', eng.id);
        }

        if (days >= 90) {
          const chargeResp = await fetch(`${process.env.VERCEL_URL}/api/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'continuation',
              match_id: eng.id,
              candidate_tier: tier,
              day: 90,
              recruiter_id: eng.recruiter_id,
              email: rEmail,
            }),
          });
          const chargeData = await chargeResp.json();

          if (chargeData.method === 'checkout') {
            await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
              type: 'continuation_payment_required',
              to_email: rEmail,
              day: 90,
              fee: FEE_AMOUNTS[tier]?.[90],
              candidate_name: eng.talent_candidates?.first_name,
              checkout_url: chargeData.url,
              subject: `Fredheim — Final continuation fee due (${FEE_AMOUNTS[tier]?.[90]})`,
            });
          }

          results.day90++;
        }
      } catch (e) {
        console.error(`Day 90 fee error for match ${eng.id}:`, e.message);
        results.skipped++;
      }
    }
  }

  return results;
}

// ── JOB 2: COLD ENGAGEMENT CHECK-IN (14 days no activity) ─────
async function runColdEngagementCheckins() {
  const day14 = new Date(Date.now() - 14 * 86400000).toISOString();
  let sent = 0;

  const { data: coldEngagements } = await supabase
    .from('talent_matches')
    .select(`
      id, engaged_at, candidate_tier,
      last_activity_at,
      talent_recruiters ( email, contact_name ),
      talent_candidates ( first_name )
    `)
    .eq('recruiter_status', 'engaged')
    .lt('last_activity_at', day14)
    .is('cold_checkin_sent_at', null);

  for (const eng of coldEngagements || []) {
    await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
      type: 'cold_engagement_checkin',
      to_email: eng.talent_recruiters?.email,
      candidate_name: eng.talent_candidates?.first_name,
      match_id: eng.id,
      subject: `Is your engagement with ${eng.talent_candidates?.first_name} still active?`,
      body: `We noticed no activity on this engagement in 14 days. If the search has concluded, close it now to stop continuation fees.`,
      close_url: `https://desk.fredheimtech.com?view=recruiter-talent&close=${eng.id}`,
      keep_url: `https://desk.fredheimtech.com?view=recruiter-talent&keep=${eng.id}`,
    });

    await supabase.from('talent_matches')
      .update({ cold_checkin_sent_at: new Date().toISOString() })
      .eq('id', eng.id);

    sent++;
  }

  return sent;
}

// ── JOB 3: AUTO-ARCHIVE COMPLETED ENGAGEMENTS ─────────────────
async function runAutoArchive() {
  const now = new Date().toISOString();
  let archived = 0;

  const { data: toArchive } = await supabase
    .from('talent_matches')
    .select('id, talent_recruiters(email), talent_candidates(first_name)')
    .lt('auto_archive_at', now)
    .eq('recruiter_status', 'engaged');

  for (const eng of toArchive || []) {
    await supabase.from('talent_matches')
      .update({ recruiter_status: 'archived', archived_at: now })
      .eq('id', eng.id);

    await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
      type: 'engagement_archived',
      to_email: eng.talent_recruiters?.email,
      candidate_name: eng.talent_candidates?.first_name,
      subject: `Fredheim engagement archived — ${eng.talent_candidates?.first_name}`,
      body: `This engagement has been archived after 90 days. Report a placement to earn a credit toward your next engagement.`,
      report_url: `https://desk.fredheimtech.com?view=recruiter-talent&report=${eng.id}`,
    });

    archived++;
  }

  return archived;
}

// ── JOB 4: CANDIDATE INTEREST NOTIFICATION ────────────────────
// When a recruiter clicks Express Interest — notify candidate before charging
async function runCandidateInterestNotifications() {
  let sent = 0;

  const { data: pending } = await supabase
    .from('talent_matches')
    .select(`
      id, candidate_tier,
      talent_candidates ( id, first_name, email, status ),
      talent_roles ( title ),
      talent_recruiters ( firm_name )
    `)
    .eq('recruiter_status', 'interest_expressed')
    .is('candidate_notified_at', null);

  for (const m of pending || []) {
    if (m.talent_candidates?.status === 'archived') continue;

    const acceptUrl = `https://desk.fredheimtech.com?view=talent-accept&match=${m.id}`;
    const declineUrl = `https://desk.fredheimtech.com?view=talent-decline&match=${m.id}`;

    await notify(process.env.ZAPIER_TALENT_CANDIDATE_WEBHOOK, {
      type: 'recruiter_interest',
      to_email: m.talent_candidates?.email,
      candidate_name: m.talent_candidates?.first_name,
      role_title: m.talent_roles?.title,
      subject: `A search firm has expressed interest in your profile`,
      body: `A retained search firm has expressed interest in your profile for a ${m.talent_roles?.title || 'senior leadership'} role. Do you want to connect? Your identity will only be shared after you accept.`,
      accept_url: acceptUrl,
      decline_url: declineUrl,
    });

    await supabase.from('talent_matches')
      .update({ candidate_notified_at: new Date().toISOString() })
      .eq('id', m.id);

    sent++;
  }

  return sent;
}

// ── JOB 5: FOUNDING PARTNER CAP MONITORING ────────────────────
async function runFoundingCapCheck() {
  const FOUNDING_CAP = 25;
  const FOUNDING_DEADLINE = new Date('2026-12-31T23:59:59Z');
  const now = new Date();

  const { count } = await supabase
    .from('talent_recruiters')
    .select('id', { count: 'exact', head: true })
    .eq('tier', 'founding');

  const remaining = FOUNDING_CAP - (count || 0);
  const daysToDeadline = Math.floor((FOUNDING_DEADLINE - now) / 86400000);

  // Alert admin at 5 remaining spots and at 2 remaining spots
  if ([5, 2, 1].includes(remaining) || daysToDeadline <= 30) {
    await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
      type: 'founding_cap_alert',
      to_email: process.env.ADMIN_EMAIL || 'desk@fredheimtech.com',
      subject: `Founding Partner Program — ${remaining} spots remaining`,
      body: `${count} of ${FOUNDING_CAP} founding partner spots are filled. ${remaining} remaining. Deadline: December 31, 2026 (${daysToDeadline} days).`,
      remaining,
      days_to_deadline: daysToDeadline,
    });
  }

  return { founding_count: count, remaining, days_to_deadline: daysToDeadline };
}

// ── PLACEMENT CREDIT HANDLER ───────────────────────────────────
// Called when recruiter self-reports a placement
async function handlePlacementReport(matchId, recruiterId) {
  const { data: match } = await supabase
    .from('talent_matches')
    .select('candidate_tier, talent_recruiters(email, contact_name)')
    .eq('id', matchId)
    .single();

  if (!match) return { error: 'Match not found.' };

  const tier = match.candidate_tier || 'senior';
  const creditAmounts = { professional: 100, senior: 250, executive: 500 };
  const creditAmount = creditAmounts[tier] || 250;

  // Record the placement and credit
  await supabase.from('talent_matches').update({
    recruiter_status: 'placed',
    placed_at: new Date().toISOString(),
    placement_credit_issued: true,
    placement_credit_amount: creditAmount,
  }).eq('id', matchId);

  // Log credit in recruiter record
  const { data: recruiter } = await supabase
    .from('talent_recruiters')
    .select('placement_credits')
    .eq('id', recruiterId)
    .single();

  const currentCredits = recruiter?.placement_credits || 0;
  await supabase.from('talent_recruiters').update({
    placement_credits: currentCredits + creditAmount,
    total_placements: supabase.rpc('increment', { row_id: recruiterId, table: 'talent_recruiters', column: 'total_placements' }),
  }).eq('id', recruiterId);

  await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
    type: 'placement_reported',
    to_email: match.talent_recruiters?.email,
    recruiter_name: match.talent_recruiters?.contact_name,
    credit_amount: `$${creditAmount}`,
    subject: `Placement confirmed — $${creditAmount} credit applied to your account`,
    body: `Thank you for reporting this placement. A $${creditAmount} credit has been applied to your account and will be deducted from your next engagement fee.`,
    dashboard_url: 'https://desk.fredheimtech.com?view=recruiter-talent&tab=billing',
  });

  return { success: true, credit_amount: creditAmount };
}

// ── MAIN HANDLER ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Cron auth check
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

  // Daily cron — GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  console.log('talent-billing cron starting:', new Date().toISOString());

  try {
    const [
      continuationResults,
      coldCheckins,
      archived,
      interestNotifications,
      foundingStatus,
    ] = await Promise.all([
      runContinuationFees(),
      runColdEngagementCheckins(),
      runAutoArchive(),
      runCandidateInterestNotifications(),
      runFoundingCapCheck(),
    ]);

    const summary = {
      success: true,
      ran_at: new Date().toISOString(),
      continuation_fees: continuationResults,
      cold_checkins_sent: coldCheckins,
      engagements_archived: archived,
      interest_notifications_sent: interestNotifications,
      founding_partner_status: foundingStatus,
    };

    console.log('talent-billing cron complete:', JSON.stringify(summary));
    return res.status(200).json(summary);

  } catch (err) {
    console.error('talent-billing cron error:', err);
    return res.status(500).json({ error: err.message || 'Cron job failed.' });
  }
};
