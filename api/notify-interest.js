// api/notify-interest.js
// Two notification types:
//   default:        "Interest signal" — notifies recruiter anonymously. No auth required.
//   introduction:   "Forward introduction" — reveals candidate email. Requires X-Admin-Secret header.

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendAdminAlert, brandedHtml } = require('./lib/email');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { job_id, candidate_email, type } = req.body || {};
  if (!job_id) return res.status(400).json({ error: 'job_id required.' });

  const isIntro = type === 'introduction';

  // Introduction type exposes candidate PII — require admin authentication
  if (isIntro) {
    // Accept either the new signed Bearer token (preferred) OR the legacy
    // X-Admin-Secret password header during the transition.
    const { isAuthorizedAdmin } = require('./admin-auth');
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ error: 'Admin authentication required.' });
    }
  }

  const { data: job, error: jobErr } = await admin
    .from('fed_jobs').select('id,title,firm_name,firm_email,industry,location').eq('id', job_id).single();
  if (jobErr || !job) return res.status(404).json({ error: 'Job not found.' });

  const firmEmail  = job.firm_email;
  const dashUrl    = 'https://trovanttalent.com?view=recruiter-dash';
  const adminUrl   = 'https://trovanttalent.com?admin=true';

  let firmResult = null;

  if (isIntro) {
    // Contact reveal — admin-approved (and payment-gated upstream). Revealing
    // the candidate's contact IS the deliverable here, so we surface failures.
    if (firmEmail) {
      const subject = `Trovant Introduction — Candidate for ${job.title}`;
      const body =
`We are pleased to facilitate a formal introduction for your search — ${job.title}.

Candidate contact: ${candidate_email}

This candidate expressed interest in your posting and Trovant has reviewed and approved this introduction. All further communication is directly between your firm and the candidate.

As a reminder, the platform introduction fee applies upon placement confirmation.

Questions? contact@trovanttalent.com`;
      firmResult = await sendEmail({ to: firmEmail, subject, text: body, html: brandedHtml(body, { heading: subject }) });
    }
    await sendAdminAlert({
      subject: `Introduction forwarded — ${candidate_email} → ${job.firm_name}`,
      text: `Introduction sent.\nCandidate: ${candidate_email}\nFirm: ${job.firm_name} (${firmEmail})\nRole: ${job.title}`,
    });
  } else {
    // Confidential interest signal — notify the recruiter that a candidate has
    // expressed interest WITHOUT revealing identity or contact details.
    if (firmEmail) {
      const subject = `New interest signal — ${job.title}`;
      const body =
`A qualified executive has registered confidential interest in your search for ${job.title}.

Their identity is confidential at this stage — Trovant will review and facilitate a formal introduction if there is a mutual fit.

View your dashboard: ${dashUrl}

Questions? contact@trovanttalent.com`;
      firmResult = await sendEmail({ to: firmEmail, subject, text: body, html: brandedHtml(body, { heading: subject }) });
    }
    // Admin alert carries full detail (admin is internal).
    await sendAdminAlert({
      subject: `Interest signal — ${job.title} (${job.firm_name})`,
      text: `New interest signal.\n\nCandidate: ${candidate_email || 'anonymous'}\nRole: ${job.title}\nFirm: ${job.firm_name}\nFirm email: ${firmEmail || 'not on file'}\n\nReview in admin: ${adminUrl}`,
    });
    if (candidate_email) {
      await admin.from('fed_interests')
        .update({ status:'notified', notified_at:new Date().toISOString() })
        .eq('job_id', job_id).eq('anon_email', candidate_email).eq('status','pending');
    }
  }

  return res.status(200).json({
    ok: true,
    type: isIntro ? 'introduction' : 'signal',
    firm_notified: !!(firmResult && firmResult.ok),
  });
};
