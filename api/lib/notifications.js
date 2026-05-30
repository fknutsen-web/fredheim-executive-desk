// api/lib/notifications.js
// Single source of truth for creating in-app notifications (fed_notifications
// rows). match-action.js, compute-matches.js and stripe-webhook.js all create
// notifications; this module is the only place that knows the table's column
// shape.
//
// Every helper takes the Supabase client as its first argument so callers can
// pass whichever client (service-role, anon) they already hold. Helpers never
// throw — a failed insert is logged and returned as { ok:false } so a
// notification problem can't abort the surrounding workflow.

// ── CANONICAL INSERT ──────────────────────────────────────────────
async function createNotification(db, {
  recipientEmail,
  role,
  type,
  matchId = null,
  jobId   = null,
  title,
  body    = null,
}) {
  if (!recipientEmail) {
    console.error('[notifications] skipped — no recipientEmail. type:', type);
    return { ok: false, error: 'recipientEmail required' };
  }
  const { error } = await db.from('fed_notifications').insert({
    recipient_email: recipientEmail.toLowerCase(),
    recipient_role:  role,
    type,
    match_id:        matchId || null,
    job_id:          jobId || null,
    title,
    body:            body || null,
  });
  if (error) {
    console.error('[notifications] insert failed:', error.message || error);
    return { ok: false, error };
  }
  return { ok: true };
}

// ── BATCH INSERT ──────────────────────────────────────────────────
// One DB round-trip for many notifications (e.g. the match engine summarizing
// new matches per recruiter). Items use the same canonical shape as
// createNotification.
async function createNotifications(db, items = []) {
  const rows = (items || [])
    .filter(i => i && i.recipientEmail)
    .map(i => ({
      recipient_email: i.recipientEmail.toLowerCase(),
      recipient_role:  i.role,
      type:            i.type,
      match_id:        i.matchId || null,
      job_id:          i.jobId || null,
      title:           i.title,
      body:            i.body || null,
    }));
  if (rows.length === 0) return { ok: true, count: 0 };
  const { error } = await db.from('fed_notifications').insert(rows);
  if (error) {
    console.error('[notifications] batch insert failed:', error.message || error);
    return { ok: false, error };
  }
  return { ok: true, count: rows.length };
}

// ── INTEREST SIGNAL (one party) ───────────────────────────────────
// type is 'recruiter_interested' or 'candidate_interested'.
async function createInterestNotification(db, {
  recipientEmail, role, type, matchId, jobId, title, body,
}) {
  return createNotification(db, { recipientEmail, role, type, matchId, jobId, title, body });
}

// ── MUTUAL INTEREST (one party) ───────────────────────────────────
// Call once per party. Always uses the 'mutual_interest' type.
async function createMutualInterestNotification(db, {
  recipientEmail, role, matchId, jobId, title, body,
}) {
  return createNotification(db, { recipientEmail, role, type: 'mutual_interest', matchId, jobId, title, body });
}

// ── PAYMENT / UNLOCK ──────────────────────────────────────────────
// Introduction confirmed, paid_unlocked, contact unlocked, etc.
async function createPaymentNotification(db, {
  recipientEmail, role, type = 'payment', matchId, jobId, title, body,
}) {
  return createNotification(db, { recipientEmail, role, type, matchId, jobId, title, body });
}

module.exports = {
  createNotification,
  createNotifications,
  createInterestNotification,
  createMutualInterestNotification,
  createPaymentNotification,
};
