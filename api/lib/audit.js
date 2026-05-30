// api/lib/audit.js
// Centralized append-only audit logging to fed_audit_events. Never throws — a
// failed audit write is logged and swallowed so it cannot break a workflow.

const EVENTS = Object.freeze({
  PROFILE_CREATED:    'profile_created',
  JOB_CREATED:        'job_created',
  MATCH_CREATED:      'match_created',
  RECRUITER_INTEREST: 'recruiter_interest',
  CANDIDATE_INTEREST: 'candidate_interest',
  CANDIDATE_DECLINED: 'candidate_declined',
  MUTUAL_INTEREST:    'mutual_interest',
  CHECKOUT_CREATED:   'checkout_created',
  PAYMENT_COMPLETED:  'payment_completed',
  PROFILE_UNLOCKED:   'profile_unlocked',
  INTRODUCTION_SENT:  'introduction_sent',
});

async function logEvent(db, {
  type,
  actorEmail = null,
  actorRole  = 'system',
  matchId    = null,
  jobId      = null,
  candidateEmail = null,
  recruiterEmail = null,
  amount     = null,
  detail     = null,
}) {
  if (!type) { console.error('[audit] missing event type'); return { ok: false }; }
  try {
    const { error } = await db.from('fed_audit_events').insert({
      event_type:      type,
      actor_email:     actorEmail,
      actor_role:      actorRole,
      match_id:        matchId,
      job_id:          jobId,
      candidate_email: candidateEmail,
      recruiter_email: recruiterEmail,
      amount,
      detail,
    });
    if (error) { console.error('[audit] insert failed:', error.message || error); return { ok: false, error }; }
    return { ok: true };
  } catch (e) {
    console.error('[audit] threw:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { EVENTS, logEvent };
