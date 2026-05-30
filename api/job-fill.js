// api/job-fill.js
// Handles the recruiter "Mark as Filled" workflow.
// Routes to one of three outcomes based on sourcing answer:
//   platform_candidate  → full placement record + fee trigger + invoice workflow
//   external_candidate  → certification + admin review (flagged if introductions exist)
//   pending_review      → admin review queue, job removed from active matching

const { createClient } = require('@supabase/supabase-js');
const { sendAdminAlert } = require('./lib/email');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';
const db       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const EXTERNAL_CERT_TEXT =
  'I certify that the selected candidate was not introduced, matched, viewed, unlocked, ' +
  'contacted, shortlisted, messaged, or engaged through Fredheim Executive Desk for this ' +
  'role or a substantially similar role.';

const PLACEMENT_FEE_RATE = parseFloat(process.env.PLACEMENT_FEE_RATE || '0.25');   // 25% default
const TAIL_MONTHS        = parseInt(process.env.TAIL_PERIOD_MONTHS || '12', 10);

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
  const {
    job_id, fill_type,
    // Platform candidate fields
    candidate_email, offer_date, start_date, compensation_amount,
    hiring_company, invoice_contact, invoice_email, purchase_order, notes,
    // External certification
    external_certification_confirmed,
  } = req.body || {};

  if (!job_id) return res.status(400).json({ error: 'job_id required.' });
  if (!['platform_candidate','external_candidate','pending_review'].includes(fill_type)) {
    return res.status(400).json({ error: 'fill_type must be platform_candidate, external_candidate, or pending_review.' });
  }

  // Load job and verify ownership
  const { data: job } = await db
    .from('fed_jobs').select('id,title,status,firm_email,salary_max').eq('id', job_id).single();
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.firm_email?.toLowerCase() !== recruiterEmail) return res.status(403).json({ error: 'Not authorized.' });
  if (['closed_unfilled','filled_platform','filled_external','archived'].includes(job.status)) {
    return res.status(409).json({ error: `Job is already ${job.status}.` });
  }

  const now = new Date().toISOString();

  // Count introductions
  const { count: introCount } = await db
    .from('fed_candidate_introductions')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', job_id);
  const hadIntroductions = (introCount || 0) > 0;

  // ── PLATFORM CANDIDATE ─────────────────────────────────────────────────────
  if (fill_type === 'platform_candidate') {
    if (!candidate_email) return res.status(400).json({ error: 'candidate_email required for platform fill.' });

    const fee = compensation_amount
      ? Math.round(compensation_amount * PLACEMENT_FEE_RATE)
      : null;

    // Create placement record
    await db.from('fed_placements').upsert({
      job_id, recruiter_email: recruiterEmail, candidate_email,
      placement_type:    'platform_candidate',
      offer_date:        offer_date || null,
      start_date:        start_date || null,
      compensation_amount: compensation_amount ? parseFloat(compensation_amount) : null,
      fee_amount:        fee,
      fee_rate:          PLACEMENT_FEE_RATE,
      hiring_company:    hiring_company || null,
      invoice_contact:   invoice_contact || null,
      invoice_email:     invoice_email || null,
      purchase_order:    purchase_order || null,
      notes:             notes || null,
      payment_status:    'pending',
      invoice_status:    'not_sent',
      admin_review_status: 'pending',
    }, { onConflict: 'job_id' });

    // Update job status
    await db.from('fed_jobs').update({
      status:   'filled_platform',
      filled_at: now,
      status_reason: 'Filled via platform candidate',
    }).eq('id', job_id);

    // Audit log
    await db.from('fed_job_status_history').insert({
      job_id, previous_status: job.status, new_status: 'filled_platform',
      changed_by_email: recruiterEmail, changed_by_role: 'recruiter',
      reason: 'platform_candidate', candidate_email,
      notes: `Offer: ${offer_date}, Start: ${start_date}, Compensation: ${compensation_amount}`,
    });

    // Expire open matches
    await db.from('fed_matches').update({ status: 'expired' }).eq('job_id', job_id)
      .in('status', ['matched','recruiter_interested','candidate_interested']);

    // Notify admin
    await notifyAdmin({
      type:       'job_filled_platform',
      subject:    `Placement — ${job.title}`,
      fee,
      candidate_email,
      job, recruiterEmail,
    });

    return res.status(200).json({
      ok: true, new_status: 'filled_platform',
      fee_amount: fee, fee_rate: PLACEMENT_FEE_RATE,
      message: 'Placement recorded. Admin will generate your invoice.',
    });
  }

  // ── EXTERNAL CANDIDATE ─────────────────────────────────────────────────────
  if (fill_type === 'external_candidate') {
    if (!external_certification_confirmed) {
      return res.status(400).json({ error: 'External certification must be confirmed.' });
    }

    const shouldFlag = hadIntroductions; // flag if there were any platform introductions

    await db.from('fed_placements').upsert({
      job_id, recruiter_email: recruiterEmail,
      placement_type:              'external_candidate',
      external_certification_text: EXTERNAL_CERT_TEXT,
      external_certified_at:       now,
      notes,
      payment_status:    'pending',
      invoice_status:    'not_sent',
      admin_review_status: 'pending',
    }, { onConflict: 'job_id' });

    await db.from('fed_jobs').update({
      status:       'filled_external',
      filled_at:    now,
      status_reason: 'Filled externally (recruiter certified)',
      admin_flagged: shouldFlag,
      admin_flag_reason: shouldFlag
        ? `External fill — ${introCount} candidate introductions recorded within tail period.`
        : null,
    }).eq('id', job_id);

    await db.from('fed_job_status_history').insert({
      job_id, previous_status: job.status, new_status: 'filled_external',
      changed_by_email: recruiterEmail, changed_by_role: 'recruiter',
      reason: 'external_candidate',
      certification_text: EXTERNAL_CERT_TEXT,
    });

    await db.from('fed_matches').update({ status: 'expired' }).eq('job_id', job_id)
      .in('status', ['matched','recruiter_interested','candidate_interested']);

    await notifyAdmin({
      type:    'job_filled_external',
      subject: `External fill — ${job.title}${shouldFlag ? ' ⚠ FLAGGED' : ''}`,
      flagged: shouldFlag, introCount,
      job, recruiterEmail,
    });

    return res.status(200).json({
      ok: true, new_status: 'filled_external',
      flagged: shouldFlag,
      message: shouldFlag
        ? 'Recorded. Flagged for admin review — platform introductions exist on this job.'
        : 'Recorded. Admin will review before final acceptance.',
    });
  }

  // ── PENDING REVIEW (not sure) ──────────────────────────────────────────────
  if (fill_type === 'pending_review') {
    await db.from('fed_jobs').update({
      status:       'pending_fill_review',
      filled_at:    now,
      status_reason: 'Pending fill review — sourcing unclear',
    }).eq('id', job_id);

    await db.from('fed_job_status_history').insert({
      job_id, previous_status: job.status, new_status: 'pending_fill_review',
      changed_by_email: recruiterEmail, changed_by_role: 'recruiter',
      reason: 'pending_review', notes,
    });

    await db.from('fed_matches').update({ status: 'expired' }).eq('job_id', job_id)
      .in('status', ['matched','recruiter_interested','candidate_interested']);

    await notifyAdmin({
      type:    'job_pending_fill_review',
      subject: `Fill review needed — ${job.title}`,
      job, recruiterEmail,
    });

    return res.status(200).json({
      ok: true, new_status: 'pending_fill_review',
      message: 'Submitted for admin review. The posting is paused from active matching.',
    });
  }
};

async function notifyAdmin({ type, subject, job, recruiterEmail, flagged, introCount, fee, candidate_email }) {
  await sendAdminAlert({
    subject,
    text: `${subject}\n\nJob: ${job.title}\nRecruiter: ${recruiterEmail}${fee ? `\nFee: ${fee}` : ''}${candidate_email ? `\nCandidate: ${candidate_email}` : ''}\n${flagged ? `\n⚠ FLAGGED — ${introCount} introductions on record.\n` : ''}\nAdmin: https://desk.fredheimtech.com?admin=true`,
  });
}
