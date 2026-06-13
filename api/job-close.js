// api/job-close.js
// Handles the recruiter "Close Job" workflow.
// Validates the caller owns the job, records the certification, writes the audit log,
// notifies admin, and updates job status to 'closed_unfilled'.
// No hard deletes — all data preserved.

const { createClient } = require('@supabase/supabase-js');
const { sendAdminAlert } = require('./lib/email');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';
const db       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CLOSE_REASONS = {
  position_cancelled:       'Position cancelled',
  position_on_hold:         'Position put on hold',
  budget_removed:           'Budget removed',
  no_suitable_candidate:    'No suitable candidate found',
  filled_outside_platform:  'Filled outside the platform',
  other:                    'Other',
};

const CERTIFICATION_TEXT =
  'I certify that this position has not been filled through any candidate introduced, ' +
  'matched, viewed, unlocked, contacted, or engaged through Fredheim Desk.';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  // Auth
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required.' });
  const anon = createClient(process.env.SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return res.status(403).json({ error: 'Invalid session.' });

  const recruiterEmail = user.email.toLowerCase();
  const { job_id, close_reason, certification_confirmed, notes, ip_address } = req.body || {};

  // Validate inputs
  if (!job_id) return res.status(400).json({ error: 'job_id required.' });
  if (!close_reason || !CLOSE_REASONS[close_reason]) {
    return res.status(400).json({ error: 'Valid close_reason required.', valid: Object.keys(CLOSE_REASONS) });
  }
  if (!certification_confirmed) {
    return res.status(400).json({ error: 'Certification must be confirmed.' });
  }

  // Load the job and verify ownership
  const { data: job, error: jErr } = await db
    .from('fed_jobs')
    .select('id, title, status, firm_email, has_introductions')
    .eq('id', job_id)
    .single();

  if (jErr || !job) return res.status(404).json({ error: 'Job not found.' });
  if (job.firm_email?.toLowerCase() !== recruiterEmail) {
    return res.status(403).json({ error: 'You do not own this job posting.' });
  }
  if (['closed_unfilled','filled_platform','filled_external','archived'].includes(job.status)) {
    return res.status(409).json({ error: `Job is already ${job.status}.` });
  }

  const now = new Date().toISOString();

  // Count introductions for this job
  const { count: introCount } = await db
    .from('fed_candidate_introductions')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', job_id);

  const hadIntroductions = (introCount || 0) > 0;
  const shouldFlag = hadIntroductions && close_reason === 'filled_outside_platform';

  // 1. Update job status
  await db.from('fed_jobs').update({
    status:       'closed_unfilled',
    status_reason: close_reason,
    closed_at:    now,
    admin_flagged: shouldFlag,
    admin_flag_reason: shouldFlag
      ? `Closure reason: filled_outside_platform — but ${introCount} candidate introductions recorded.`
      : null,
  }).eq('id', job_id);

  // 2. Write closure certification record
  await db.from('fed_job_closures').upsert({
    job_id,
    recruiter_email:             recruiterEmail,
    close_reason,
    close_reason_display:        CLOSE_REASONS[close_reason],
    certification_text:          CERTIFICATION_TEXT,
    certified_at:                now,
    had_introductions:           hadIntroductions,
    introduced_candidate_count:  introCount || 0,
    admin_review_status:         shouldFlag ? 'pending' : 'pending',
  }, { onConflict: 'job_id' });

  // 3. Audit log
  await db.from('fed_job_status_history').insert({
    job_id,
    previous_status:    job.status,
    new_status:         'closed_unfilled',
    changed_by_email:   recruiterEmail,
    changed_by_role:    'recruiter',
    reason:             close_reason,
    reason_display:     CLOSE_REASONS[close_reason],
    certification_text: CERTIFICATION_TEXT,
    notes:              notes || null,
    ip_address:         ip_address || req.headers['x-forwarded-for'] || null,
    user_agent:         req.headers['user-agent'] || null,
  });

  // 4. Remove from active matching — expire all open match records
  await db.from('fed_matches')
    .update({ status: 'expired' })
    .eq('job_id', job_id)
    .in('status', ['matched', 'recruiter_interested', 'candidate_interested']);

  // 5. Notify admin via native email
  await sendAdminAlert({
    subject: `Job closed — ${job.title} (${CLOSE_REASONS[close_reason]})${shouldFlag ? ' ⚠ FLAGGED' : ''}`,
    text: `Job closed: ${job.title}\nRecruiter: ${recruiterEmail}\nReason: ${CLOSE_REASONS[close_reason]}\nIntroductions on file: ${introCount || 0}\n${shouldFlag ? '\n⚠ FLAGGED FOR REVIEW — filled_outside_platform with introductions on record.\n' : ''}\nReview: https://desk.fredheimtech.com?admin=true`,
  });

  return res.status(200).json({
    ok: true,
    new_status: 'closed_unfilled',
    flagged: shouldFlag,
    introductions_on_record: introCount || 0,
  });
};
