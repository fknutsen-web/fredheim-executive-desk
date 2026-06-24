// api/submit-feedback.js
// Handles candidate feedback submission on recruiter interactions.
// Authenticated via Supabase JWT. One record per candidate-recruiter-job-trigger.
// Negative flags (bypass, misrepresentation) auto-trigger admin review.

const { createClient } = require('@supabase/supabase-js');
const { sendAdminAlert } = require('./lib/email');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';
const db       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_TRIGGERS = [
  'engagement_accepted','communication_received','interview_completed',
  'recruiter_rejected','candidate_withdrew','job_filled','job_closed','manual_report',
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required.' });
  const anon = createClient(process.env.SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return res.status(403).json({ error: 'Invalid session.' });

  const candidateEmail = user.email.toLowerCase();
  const {
    recruiter_email, job_id, match_id, feedback_trigger,
    rating_professionalism, rating_responsiveness, rating_accuracy,
    rating_transparency, rating_confidentiality, rating_process, rating_overall,
    would_engage_again, respected_privacy,
    attempted_bypass, misrepresented_role,
    comments,
  } = req.body || {};

  if (!recruiter_email) return res.status(400).json({ error: 'recruiter_email required.' });
  if (!feedback_trigger || !VALID_TRIGGERS.includes(feedback_trigger)) {
    return res.status(400).json({ error: 'Valid feedback_trigger required.' });
  }

  // Verify the candidate actually interacted with this recruiter
  // (had a match record with them on this job, or an introduction)
  if (job_id) {
    const { data: match } = await db
      .from('fed_matches')
      .select('id, status')
      .eq('job_id', job_id)
      .eq('candidate_email', candidateEmail)
      .ilike('recruiter_email', recruiter_email)
      .maybeSingle();

    const { data: intro } = await db
      .from('fed_candidate_introductions')
      .select('id')
      .eq('job_id', job_id)
      .eq('candidate_email', candidateEmail)
      .ilike('recruiter_email', recruiter_email)
      .maybeSingle();

    if (!match && !intro) {
      return res.status(403).json({ error: 'No qualifying interaction found for this recruiter and job.' });
    }
  }

  const isHighSeverity = attempted_bypass || misrepresented_role;

  // Upsert feedback (allows update within 7-day window)
  const { data: feedback, error: fbErr } = await db
    .from('fed_recruiter_feedback')
    .upsert({
      recruiter_email:        recruiter_email.toLowerCase(),
      candidate_email:        candidateEmail,
      job_id:                 job_id || null,
      match_id:               match_id || null,
      feedback_trigger,
      rating_professionalism: rating_professionalism || null,
      rating_responsiveness:  rating_responsiveness || null,
      rating_accuracy:        rating_accuracy || null,
      rating_transparency:    rating_transparency || null,
      rating_confidentiality: rating_confidentiality || null,
      rating_process:         rating_process || null,
      rating_overall:         rating_overall || null,
      would_engage_again:     would_engage_again ?? null,
      respected_privacy:      respected_privacy ?? null,
      attempted_bypass:       attempted_bypass || false,
      misrepresented_role:    misrepresented_role || false,
      comments:               comments || null,
      admin_review_status:    isHighSeverity ? 'flagged' : 'pending',
      feedback_window_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, {
      onConflict: 'recruiter_email,candidate_email,job_id,feedback_trigger',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();

  if (fbErr) {
    console.error('Feedback upsert error:', fbErr);
    return res.status(500).json({ error: 'Failed to submit feedback.' });
  }

  // Notify admin for high-severity flags
  if (isHighSeverity) {
    const issues = [];
    if (attempted_bypass) issues.push('Bypass attempt reported');
    if (misrepresented_role) issues.push('Role misrepresentation reported');
    await sendAdminAlert({
      subject: `⚠ Recruiter complaint — ${issues.join(', ')}`,
      text: `Recruiter complaint received.\n\nRecruiter: ${recruiter_email}\nCandidate: ${candidateEmail}\nIssues: ${issues.join(', ')}\nComments: ${comments || 'None'}\n\nReview: https://trovanttalent.com?admin=true`,
    });
  }

  return res.status(200).json({ ok: true, feedback_id: feedback?.id });
};
