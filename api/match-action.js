// api/match-action.js
// Handles all interest state transitions in the bidirectional matching workflow.
// Validates the caller's role and enforces state machine rules.
//
// Actions:
//   recruiter_interest   — recruiter expresses interest in a candidate
//   recruiter_withdraw   — recruiter withdraws interest
//   candidate_interest   — candidate expresses interest in a job
//   candidate_decline    — candidate declines recruiter interest
//   candidate_hide       — candidate hides a match from their view
//   mark_viewed          — recruiter marks job matches as viewed (clears new count)

const { createClient } = require('@supabase/supabase-js');
const { createNotification, createPaymentNotification } = require('./lib/notifications');
const { canTransition, isValidMatchState } = require('./lib/match-states');
const { EVENTS, logEvent } = require('./lib/audit');
const { sendEmail, brandedHtml } = require('./lib/email');

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  // ── AUTH ─────────────────────────────────────────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required.' });

  const anonClient = createClient(process.env.SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return res.status(403).json({ error: 'Invalid session.' });

  const callerEmail = user.email.toLowerCase();
  const { action, match_id, job_id, candidate_email } = req.body || {};

  if (!action) return res.status(400).json({ error: 'action required.' });

  // ── HELPER: create a notification ────────────────────────────
  // Delegates to the centralized notifications module (./lib/notifications);
  // the local signature is preserved so all call sites are unchanged.
  async function notify(recipientEmail, role, type, matchId, jobId, title, body) {
    await createNotification(db, { recipientEmail, role, type, matchId, jobId, title, body });
  }

  try {

    // ── RECRUITER: Indicate Interest ──────────────────────────
    if (action === 'recruiter_interest') {
      if (!match_id) return res.status(400).json({ error: 'match_id required.' });

      // Load the match and verify caller is the recruiter
      const { data: match, error: mErr } = await db
        .from('fed_matches')
        .select('*, fed_jobs(title, firm_name)')
        .eq('id', match_id)
        .single();

      if (mErr || !match) return res.status(404).json({ error: 'Match not found.' });
      if (match.recruiter_email.toLowerCase() !== callerEmail) {
        return res.status(403).json({ error: 'Not authorized for this match.' });
      }

      // Valid transitions: matched → recruiter_interested
      //                    candidate_interested → mutual_interest
      const now = new Date().toISOString();
      let newStatus, mutualAt = null;

      if (match.status === 'matched') {
        newStatus = 'recruiter_interested';
      } else if (match.status === 'candidate_interested') {
        newStatus = 'mutual_interest';
        mutualAt  = now;
      } else {
        return res.status(409).json({ error: `Cannot indicate interest from status: ${match.status}` });
      }

      // Canonical state-machine guard (see ./lib/match-states).
      if (!canTransition(match.status, newStatus)) {
        return res.status(409).json({ error: `Illegal transition: ${match.status} -> ${newStatus}` });
      }

      const { error: upErr } = await db
        .from('fed_matches')
        .update({
          status: newStatus,
          recruiter_interested_at: now,
          ...(mutualAt ? { mutual_interest_at: mutualAt } : {}),
        })
        .eq('id', match_id);

      if (upErr) throw upErr;

      await logEvent(db, { type: EVENTS.RECRUITER_INTEREST, actorEmail: callerEmail, actorRole: 'recruiter', matchId: match_id, jobId: match.job_id, candidateEmail: match.candidate_email, recruiterEmail: callerEmail });
      if (newStatus === 'mutual_interest') {
        await logEvent(db, { type: EVENTS.MUTUAL_INTEREST, actorEmail: callerEmail, actorRole: 'recruiter', matchId: match_id, jobId: match.job_id, candidateEmail: match.candidate_email, recruiterEmail: callerEmail });
      }

      // Notify candidate
      const jobTitle = match.fed_jobs?.title || 'a search';
      const firmName = match.fed_jobs?.firm_name || 'A search firm';

      if (newStatus === 'mutual_interest') {
        await notify(match.candidate_email, 'candidate', 'mutual_interest', match_id, match.job_id,
          `Mutual interest — ${jobTitle}`,
          `${firmName} has matched your interest in ${jobTitle}. Both parties have expressed interest. Trovant will be in touch to facilitate next steps.`);
        await notify(callerEmail, 'recruiter', 'mutual_interest', match_id, match.job_id,
          `Mutual interest — ${jobTitle}`,
          `A candidate who had already expressed interest in ${jobTitle} is now a mutual match. Trovant will facilitate the introduction.`);
      } else {
        await notify(match.candidate_email, 'candidate', 'recruiter_interested', match_id, match.job_id,
          `A search firm is interested in you`,
          `${firmName} has expressed interest in your profile for a ${jobTitle} role. You can accept, decline, or ignore this interest.`);
      }

      return res.status(200).json({ ok: true, status: newStatus });
    }

    // ── RECRUITER: Withdraw Interest ──────────────────────────
    if (action === 'recruiter_withdraw') {
      if (!match_id) return res.status(400).json({ error: 'match_id required.' });

      const { data: match } = await db.from('fed_matches').select('*, fed_jobs(title)').eq('id', match_id).single();
      if (!match) return res.status(404).json({ error: 'Match not found.' });
      if (match.recruiter_email.toLowerCase() !== callerEmail) return res.status(403).json({ error: 'Not authorized.' });
      if (!['recruiter_interested', 'mutual_interest'].includes(match.status)) {
        return res.status(409).json({ error: `Cannot withdraw from status: ${match.status}` });
      }

      await db.from('fed_matches').update({ status: 'recruiter_withdrawn' }).eq('id', match_id);

      await notify(match.candidate_email, 'candidate', 'recruiter_withdrawn', match_id, match.job_id,
        'A firm withdrew their interest',
        `A search firm has withdrawn their interest in you for the ${match.fed_jobs?.title || 'role'}.`);

      return res.status(200).json({ ok: true, status: 'recruiter_withdrawn' });
    }

    // ── RECRUITER: Complimentary unlock (founding / early-career — $0) ──
    // For introductions that carry no fee, this performs the SAME side effects
    // as the Stripe webhook's paid unlock. It is gated exactly like a paid
    // unlock: the caller must be the recruiter on the match AND the candidate
    // must already have approved the introduction (status `awaiting_payment`).
    // Eligibility for $0 is decided server-side by /api/create-checkout-session
    // (it returns { complimentary: true } only for founding recruiters or
    // complimentary candidate classes); the client calls this only in that case.
    if (action === 'complimentary_unlock') {
      if (!match_id) return res.status(400).json({ error: 'match_id required.' });

      const { data: match } = await db
        .from('fed_matches')
        .select('*, fed_jobs(title, firm_name, firm_email)')
        .eq('id', match_id)
        .single();
      if (!match) return res.status(404).json({ error: 'Match not found.' });
      if (match.recruiter_email.toLowerCase() !== callerEmail) {
        return res.status(403).json({ error: 'Not authorized for this match.' });
      }
      // Idempotent: already unlocked.
      if (match.status === 'paid_unlocked' || match.status === 'introduced') {
        return res.status(200).json({ ok: true, status: match.status });
      }
      if (!canTransition(match.status, 'paid_unlocked')) {
        return res.status(409).json({ error: 'This introduction is not approved for unlock yet. The candidate must approve it first.' });
      }

      const now = new Date().toISOString();
      const { error: upErr } = await db.from('fed_matches').update({
        status:                   'paid_unlocked',
        unlocked_at:              now,
        payment_completed_at:     now,
        recruiter_interested_at:  match.recruiter_interested_at || now,
        introduction_fee_paid:    true,
        introduction_fee_amount:  '$0',
        introduction_fee_bracket: 'complimentary',
      }).eq('id', match_id);
      if (upErr) throw upErr;

      // Durable source of truth for the unlock (amount 0).
      await db.from('fed_paid_introductions').insert({
        match_id:        match_id,
        job_id:          match.job_id,
        candidate_email: match.candidate_email,
        recruiter_email: callerEmail,
        amount_paid:     0,
        currency:        'usd',
        paid_at:         now,
        status:          'paid',
      });

      const jobTitle = match.fed_jobs?.title || 'a senior search';
      const firmName  = match.fed_jobs?.firm_name || 'A search firm';

      await logEvent(db, { type: EVENTS.PROFILE_UNLOCKED, actorEmail: callerEmail, actorRole: 'recruiter', matchId: match_id, jobId: match.job_id, candidateEmail: match.candidate_email, recruiterEmail: callerEmail, amount: 0, detail: { bracket: 'complimentary' } });
      await logEvent(db, { type: EVENTS.INTRODUCTION_SENT, actorRole: 'system', matchId: match_id, jobId: match.job_id, candidateEmail: match.candidate_email, recruiterEmail: callerEmail });

      await createPaymentNotification(db, {
        recipientEmail: match.candidate_email, role: 'candidate', type: 'paid_unlocked',
        matchId: match_id, jobId: match.job_id,
        title: `Curated introduction confirmed — ${jobTitle}`,
        body:  `${firmName} has completed a complimentary curated introduction for ${jobTitle}. Trovant has shared your approved contact details with the firm and they will reach out directly.`,
      });
      await createPaymentNotification(db, {
        recipientEmail: callerEmail, role: 'recruiter', type: 'paid_unlocked',
        matchId: match_id, jobId: match.job_id,
        title: `Contact unlocked — ${jobTitle}`,
        body:  `Your complimentary curated introduction is confirmed. Approved contact details are now available on your dashboard.`,
      });

      const candBody = `${firmName} has completed a complimentary curated introduction for the ${jobTitle} search. They have your approved contact details and will be in touch directly.`;
      const recBody  = `Your complimentary curated introduction is confirmed. Approved contact details for this candidate are now available on your dashboard.`;
      await sendEmail({ to: match.candidate_email, subject: `Curated introduction confirmed — ${jobTitle}`, text: candBody, html: brandedHtml(candBody, { heading: `Curated introduction confirmed — ${jobTitle}` }) });
      await sendEmail({ to: callerEmail, subject: `Contact unlocked — ${jobTitle}`, text: recBody, html: brandedHtml(recBody, { heading: `Contact unlocked — ${jobTitle}` }) });

      return res.status(200).json({ ok: true, status: 'paid_unlocked' });
    }

    // ── CANDIDATE: Indicate Interest ──────────────────────────
    if (action === 'candidate_interest') {
      if (!job_id) return res.status(400).json({ error: 'job_id required.' });

      // Load or create a match record
      const { data: existing } = await db
        .from('fed_matches')
        .select('*, fed_jobs(title, firm_name, firm_email)')
        .eq('job_id', job_id)
        .eq('candidate_email', callerEmail)
        .maybeSingle();

      const now = new Date().toISOString();
      let matchRecord = existing;
      let newStatus;

      // Load the candidate's confidentiality profile once so we can honor their
      // block list on every interest path below. The matching engine already
      // filters blocked employers when it creates matches, but a candidate
      // expressing interest in a CONFIDENTIAL job (employer name is masked in the
      // listing) could otherwise unknowingly create a match that reveals them to
      // their own employer or a blocked firm. Fail closed on a confirmed block.
      const candidateProfile = await loadCandidateProfile(db, callerEmail);
      const blockedMessage = 'This opportunity is with an employer on your block list, so you can’t be connected to it.';

      if (existing && isEmployerBlocked(candidateProfile, existing.fed_jobs?.firm_name)) {
        return res.status(409).json({ error: blockedMessage });
      }

      if (!existing) {
        // No match record yet — create one and set status
        const { data: job } = await db.from('fed_jobs').select('*').eq('id', job_id).single();
        if (!job) return res.status(404).json({ error: 'Job not found.' });

        if (isEmployerBlocked(candidateProfile, job.firm_name)) {
          return res.status(409).json({ error: blockedMessage });
        }

        const { score, reasons } = computeMatchScore(
          candidateProfile,
          job
        );

        const { data: created, error: cErr } = await db.from('fed_matches').insert({
          job_id,
          candidate_email:       callerEmail,
          recruiter_email:       job.firm_email?.toLowerCase() || '',
          match_score:           score,
          match_reasons:         reasons,
          status:                'candidate_interested',
          candidate_interested_at: now,
        }).select('*, fed_jobs(title, firm_name, firm_email)').single();

        if (cErr) throw cErr;
        matchRecord = created;
        newStatus = 'candidate_interested';

      } else if (existing.status === 'matched') {
        await db.from('fed_matches').update({ status: 'candidate_interested', candidate_interested_at: now }).eq('id', existing.id);
        newStatus = 'candidate_interested';

      } else if (existing.status === 'recruiter_interested') {
        await db.from('fed_matches').update({ status: 'mutual_interest', candidate_interested_at: now, mutual_interest_at: now }).eq('id', existing.id);
        newStatus = 'mutual_interest';

      } else {
        return res.status(409).json({ error: `Cannot express interest from status: ${existing.status}` });
      }

      await logEvent(db, { type: EVENTS.CANDIDATE_INTEREST, actorEmail: callerEmail, actorRole: 'candidate', matchId: matchRecord.id, jobId: job_id, candidateEmail: callerEmail, recruiterEmail: matchRecord.recruiter_email });
      if (newStatus === 'mutual_interest') {
        await logEvent(db, { type: EVENTS.MUTUAL_INTEREST, actorEmail: callerEmail, actorRole: 'candidate', matchId: matchRecord.id, jobId: job_id, candidateEmail: callerEmail, recruiterEmail: matchRecord.recruiter_email });
      }

      const jobTitle = matchRecord.fed_jobs?.title || 'a search';
      const recruiterEmail = matchRecord.recruiter_email || matchRecord.fed_jobs?.firm_email;

      if (newStatus === 'mutual_interest') {
        if (recruiterEmail) {
          await notify(recruiterEmail, 'recruiter', 'mutual_interest', matchRecord.id, job_id,
            `Mutual interest — ${jobTitle}`,
            `A candidate you expressed interest in has reciprocated for ${jobTitle}. This is now a mutual match. Trovant will facilitate the introduction.`);
        }
        await notify(callerEmail, 'candidate', 'mutual_interest', matchRecord.id, job_id,
          `Mutual interest — ${jobTitle}`,
          `You and ${matchRecord.fed_jobs?.firm_name || 'a search firm'} have both expressed interest in ${jobTitle}. Trovant will be in touch.`);
      } else {
        if (recruiterEmail) {
          await notify(recruiterEmail, 'recruiter', 'candidate_interested', matchRecord.id, job_id,
            `Candidate interested in ${jobTitle}`,
            `A candidate has expressed interest in your ${jobTitle} search. View your Firm Dashboard to see candidate details.`);
        }
      }

      return res.status(200).json({ ok: true, status: newStatus, match_id: matchRecord.id });
    }

    // ── CANDIDATE: Decline Recruiter Interest ─────────────────
    if (action === 'candidate_decline') {
      if (!match_id) return res.status(400).json({ error: 'match_id required.' });

      const { data: match } = await db.from('fed_matches').select('*, fed_jobs(title)').eq('id', match_id).single();
      if (!match) return res.status(404).json({ error: 'Match not found.' });
      if (match.candidate_email.toLowerCase() !== callerEmail) return res.status(403).json({ error: 'Not authorized.' });
      if (match.status !== 'recruiter_interested') {
        return res.status(409).json({ error: `Cannot decline from status: ${match.status}` });
      }

      await db.from('fed_matches').update({ status: 'candidate_declined', declined_at: new Date().toISOString() }).eq('id', match_id);

      await logEvent(db, { type: EVENTS.CANDIDATE_DECLINED, actorEmail: callerEmail, actorRole: 'candidate', matchId: match_id, jobId: match.job_id, candidateEmail: callerEmail, recruiterEmail: match.recruiter_email });

      await notify(match.recruiter_email, 'recruiter', 'candidate_declined', match_id, match.job_id,
        `Candidate declined — ${match.fed_jobs?.title || 'role'}`,
        `A candidate has declined your interest for the ${match.fed_jobs?.title || 'role'} search.`);

      return res.status(200).json({ ok: true, status: 'candidate_declined' });
    }

    // ── CANDIDATE: Approve the introduction (gate before payment) ──
    // Only after mutual interest. Moves to awaiting_payment, which is the ONLY
    // status from which a Stripe checkout may be created. No identities revealed.
    if (action === 'candidate_approve_introduction') {
      if (!match_id) return res.status(400).json({ error: 'match_id required.' });

      const { data: match } = await db.from('fed_matches').select('*, fed_jobs(title)').eq('id', match_id).single();
      if (!match) return res.status(404).json({ error: 'Match not found.' });
      if (match.candidate_email.toLowerCase() !== callerEmail) return res.status(403).json({ error: 'Not authorized.' });
      if (!canTransition(match.status, 'awaiting_payment')) {
        return res.status(409).json({ error: `Cannot approve introduction from status: ${match.status}` });
      }

      await db.from('fed_matches').update({ status: 'awaiting_payment', candidate_approved_at: new Date().toISOString() }).eq('id', match_id);

      // Recruiter may now pay — and only now.
      await notify(match.recruiter_email, 'recruiter', 'awaiting_payment', match_id, match.job_id,
        `Mutual interest confirmed — unlock introduction`,
        `The candidate has approved a confidential introduction for the ${match.fed_jobs?.title || 'role'} search. You can now unlock the introduction. Identities are revealed only after payment.`);

      return res.status(200).json({ ok: true, status: 'awaiting_payment' });
    }

    // ── CANDIDATE: Withdraw before payment (no charge, no reveal) ──
    if (action === 'candidate_withdraw') {
      if (!match_id) return res.status(400).json({ error: 'match_id required.' });

      const { data: match } = await db.from('fed_matches').select('*, fed_jobs(title)').eq('id', match_id).single();
      if (!match) return res.status(404).json({ error: 'Match not found.' });
      if (match.candidate_email.toLowerCase() !== callerEmail) return res.status(403).json({ error: 'Not authorized.' });
      if (!['mutual_interest', 'awaiting_payment'].includes(match.status)) {
        return res.status(409).json({ error: `Cannot withdraw from status: ${match.status}` });
      }

      await db.from('fed_matches').update({ status: 'candidate_withdrew', withdrew_at: new Date().toISOString() }).eq('id', match_id);

      await notify(match.recruiter_email, 'recruiter', 'candidate_withdrew', match_id, match.job_id,
        `Introduction withdrawn — ${match.fed_jobs?.title || 'role'}`,
        `The candidate has withdrawn before introduction. No charge was made and no contact details were released.`);

      return res.status(200).json({ ok: true, status: 'candidate_withdrew' });
    }

    // ── CANDIDATE: Hide a match ───────────────────────────────
    if (action === 'candidate_hide') {
      if (!match_id) return res.status(400).json({ error: 'match_id required.' });

      const { data: match } = await db.from('fed_matches').select('candidate_email').eq('id', match_id).single();
      if (!match) return res.status(404).json({ error: 'Match not found.' });
      if (match.candidate_email.toLowerCase() !== callerEmail) return res.status(403).json({ error: 'Not authorized.' });

      await db.from('fed_matches').update({ status: 'candidate_hidden' }).eq('id', match_id);
      return res.status(200).json({ ok: true, status: 'candidate_hidden' });
    }

    // ── RECRUITER: Mark job matches viewed ────────────────────
    if (action === 'mark_viewed') {
      if (!job_id) return res.status(400).json({ error: 'job_id required.' });

      const { error: upErr } = await db
        .from('fed_matches')
        .update({ last_recruiter_view_at: new Date().toISOString() })
        .eq('job_id', job_id)
        .is('last_recruiter_view_at', null);

      if (upErr) throw upErr;
      return res.status(200).json({ ok: true });
    }

    // ── NOTIFICATIONS: Mark read ──────────────────────────────
    if (action === 'mark_notifications_read') {
      await db.from('fed_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_email', callerEmail)
        .eq('is_read', false);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch(e) {
    console.error('match-action error:', e);
    return res.status(500).json({ error: e.message || 'Internal error.' });
  }
};

// ── MATCH SCORING ─────────────────────────────────────────────
function computeMatchScore(candidate, job) {
  let score = 0;
  const reasons = {};

  // Industry match (40 pts)
  if (candidate?.industry && job?.industry) {
    const cI = candidate.industry.toLowerCase();
    const jI = job.industry.toLowerCase();
    const cWords = cI.split(/[\s&,]+/);
    const jWords = jI.split(/[\s&,]+/);
    const overlap = cWords.some(w => w.length > 3 && jWords.some(jw => jw.length > 3 && (jw.includes(w) || w.includes(jw))));
    if (overlap || cI === jI) { score += 40; reasons.industry = true; }
  } else { score += 20; reasons.industry = null; } // unknown = partial credit

  // Function match (30 pts)
  if (candidate?.function && job?.function) {
    if (candidate.function.toLowerCase() === job.function.toLowerCase()) {
      score += 30; reasons.function = true;
    }
  } else { score += 15; reasons.function = null; }

  // Salary compatibility (20 pts) — candidate floor <= job ceiling
  if (candidate?.salary_min && job?.salary_max && job.salary_max > 0) {
    if (candidate.salary_min <= job.salary_max) { score += 20; reasons.salary = true; }
    else { reasons.salary = false; } // over budget
  } else { score += 20; reasons.salary = null; }

  // Location compatibility (10 pts)
  if (job?.location && candidate?.location) {
    const jL = job.location.toLowerCase();
    const cL = candidate.location.toLowerCase();
    if (jL.includes('remote') || jL.includes('global') || jL.includes('anywhere') ||
        cL.includes(jL.split(',')[0].trim().substring(0,5)) ||
        jL.includes(cL.split(',')[0].trim().substring(0,5))) {
      score += 10; reasons.location = true;
    }
  } else { score += 10; reasons.location = null; }

  return { score: Math.min(100, score), reasons };
}

async function loadCandidateProfile(db, email) {
  const { data } = await db.from('fed_profiles')
    .select('industry,function,location,salary_min,current_company,blocked_companies')
    .eq('email', email).maybeSingle();
  return data || {};
}

// Mirror of the matching engine's block check (see api/compute-matches.js).
// A candidate is shielded from any firm matching their current employer or an
// explicitly blocked company (case-insensitive, bidirectional substring).
function isEmployerBlocked(candidate, firmName) {
  if (!firmName || !candidate) return false;
  const firm = String(firmName).toLowerCase().trim();
  if (!firm) return false;
  const blockList = [];
  if (candidate.current_company) blockList.push(String(candidate.current_company).toLowerCase().trim());
  if (Array.isArray(candidate.blocked_companies)) {
    for (const c of candidate.blocked_companies) if (c) blockList.push(String(c).toLowerCase().trim());
  }
  return blockList.some(b => b && (firm.includes(b) || b.includes(firm)));
}
