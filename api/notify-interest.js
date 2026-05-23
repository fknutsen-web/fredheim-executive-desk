// api/notify-interest.js
// Two notification types:
//   default:        "Interest signal" — notifies recruiter anonymously. No auth required.
//   introduction:   "Forward introduction" — reveals candidate email. Requires X-Admin-Secret header.

const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sendZapier(payload) {
  const url = process.env.ZAPIER_DESK_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  } catch(e) { console.error('Zapier notify failed:', e.message); }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { job_id, candidate_email, type } = req.body || {};
  if (!job_id) return res.status(400).json({ error: 'job_id required.' });

  const isIntro = type === 'introduction';

  // Introduction type exposes candidate PII — require admin authentication
  if (isIntro) {
    const secret = req.headers['x-admin-secret'] || '';
    if (!process.env.ADMIN_PASSWORD || secret !== process.env.ADMIN_PASSWORD) {
      return res.status(403).json({ error: 'Admin authentication required.' });
    }
  }

  const { data: job, error: jobErr } = await admin
    .from('fed_jobs').select('id,title,firm_name,firm_email,industry,location').eq('id', job_id).single();
  if (jobErr || !job) return res.status(404).json({ error: 'Job not found.' });

  const adminEmail = process.env.ADMIN_EMAIL || 'desk@fredheimtech.com';
  const firmEmail  = job.firm_email;
  const dashUrl    = 'https://desk.fredheimtech.com?view=recruiter-dash';
  const adminUrl   = 'https://desk.fredheimtech.com?admin=true';

  if (isIntro) {
    if (firmEmail) {
      await sendZapier({
        type:'candidate_introduction', to_email:firmEmail,
        subject:`Fredheim Introduction — Candidate for ${job.title}`,
        firm_name:job.firm_name, role_title:job.title, candidate_email, dashboard_url:dashUrl,
        body:`We are pleased to facilitate a formal introduction for your search — ${job.title}.\n\nCandidate contact: ${candidate_email}\n\nThis candidate expressed interest in your posting and Fredheim has reviewed and approved this introduction. All further communication is directly between your firm and the candidate.\n\nYour introduction confirmation fee has been applied for this search. All further communication is directly between your firm and the candidate.\n\nQuestions? desk@fredheimtech.com`,
      });
    }
    await sendZapier({ type:'intro_forwarded_admin', to_email:adminEmail,
      subject:`Introduction forwarded — ${candidate_email} → ${job.firm_name}`,
      body:`Introduction sent.\nCandidate: ${candidate_email}\nFirm: ${job.firm_name} (${firmEmail})\nRole: ${job.title}` });
  } else {
    if (firmEmail) {
      await sendZapier({
        type:'new_interest_signal', to_email:firmEmail,
        subject:`New interest signal — ${job.title}`,
        firm_name:job.firm_name, role_title:job.title, industry:job.industry, location:job.location, dashboard_url:dashUrl,
        body:`A qualified executive has registered confidential interest in your search for ${job.title}.\n\nTheir identity is confidential at this stage — Fredheim will review and facilitate a formal introduction if there is a mutual fit.\n\nView your dashboard: ${dashUrl}\n\nQuestions? desk@fredheimtech.com`,
      });
    }
    await sendZapier({
      type:'interest_admin_alert', to_email:adminEmail,
      subject:`Interest signal — ${job.title} (${job.firm_name})`,
      candidate_email: candidate_email || 'anonymous',
      role_title:job.title, firm_name:job.firm_name, firm_email:firmEmail||'not on file', admin_url:adminUrl,
      body:`New interest signal.\n\nCandidate: ${candidate_email}\nRole: ${job.title}\nFirm: ${job.firm_name}\nFirm email: ${firmEmail||'not on file'}\n\nReview in admin: ${adminUrl}`,
    });
    if (candidate_email) {
      await admin.from('fed_interests')
        .update({ status:'notified', notified_at:new Date().toISOString() })
        .eq('job_id', job_id).eq('anon_email', candidate_email).eq('status','pending');
    }
  }

  return res.status(200).json({ ok:true, type:isIntro?'introduction':'signal', firm_notified:!!firmEmail });
};
