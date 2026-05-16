// api/notify-posting.js
// Fires when a new search posting is submitted.
// BILLING GATE: validates recruiter billing status before accepting.
// During founding period (≤ 2026-12-31): auto-grants founding_partner status.
// After founding period: requires active billing.

const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FOUNDING_DEADLINE = new Date(process.env.FOUNDING_DEADLINE || '2026-12-31T23:59:59Z');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const {
    firm_name, contact_name, email, role_title, role_level,
    industry, location, salary_range, notes,
  } = req.body || {};

  if (!email) return res.status(400).json({ error: 'Submitter email required.' });

  const recruiterEmail = email.toLowerCase();
  const isFounding = new Date() <= FOUNDING_DEADLINE;

  // ── BILLING GATE ───────────────────────────────────────────────────────────
  const { data: billing } = await db
    .from('fed_recruiter_billing')
    .select('billing_status, founding_expires_at, suspended_at')
    .eq('recruiter_email', recruiterEmail)
    .maybeSingle();

  if (billing) {
    // Existing record — check status
    const blocked = isBlocked(billing, isFounding);
    if (blocked) {
      return res.status(402).json({
        error: blocked,
        billing_status: billing.billing_status,
        billing_required: true,
      });
    }
  } else if (isFounding) {
    // No record + founding period = auto-grant founding_partner
    await db.from('fed_recruiter_billing').insert({
      recruiter_email:     recruiterEmail,
      billing_status:      'founding_partner',
      founding_granted_at: new Date().toISOString(),
      founding_expires_at: FOUNDING_DEADLINE.toISOString(),
    });
  } else {
    // No record + after founding = block
    return res.status(402).json({
      error: 'Billing setup is required before publishing a job posting. Please add a payment method, select a plan, or request invoice billing approval.',
      billing_status: 'no_billing_setup',
      billing_required: true,
    });
  }

  // ── SEND NOTIFICATIONS ─────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'desk@fredheimtech.com';
  const zapierUrl  = process.env.ZAPIER_DESK_WEBHOOK;

  async function send(payload) {
    if (!zapierUrl) return;
    try {
      await fetch(zapierUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    } catch(e) { console.error('Zapier notify failed:', e.message); }
  }

  await send({
    type: 'new_posting_admin_alert', to_email: adminEmail,
    subject: `New search posting — ${firm_name || 'Unknown firm'}: ${role_title || 'Untitled'}`,
    firm_name, contact_name, submitter_email: email, role_title, role_level,
    industry, location, salary_range, notes,
    submitted_at: new Date().toISOString(),
    billing_status: billing?.billing_status || 'founding_partner',
    review_url: 'https://desk.fredheimtech.com?admin=true',
  });

  if (email) {
    await send({
      type: 'new_posting_confirmation', to_email: email, subject: 'Fredheim Executive Desk — Submission received',
      firm_name, contact_name, role_title,
      body: `Hi ${contact_name || 'there'},\n\nYour search posting for ${role_title} has been received and is under review. We'll confirm within 24 hours.${isFounding ? '\n\nAs a Founding Partner, this counts as your complimentary posting for the month.' : ''}\n\nQuestions? desk@fredheimtech.com\n\nFredheim Executive Desk`,
    });
  }

  return res.status(200).json({ ok: true, billing_status: billing?.billing_status || 'founding_partner' });
};

function isBlocked(billing, isFounding) {
  switch (billing.billing_status) {
    case 'founding_partner':
      if (isFounding) return null; // founding period still active
      const expires = billing.founding_expires_at ? new Date(billing.founding_expires_at) : FOUNDING_DEADLINE;
      if (new Date() > expires) return 'Founding Partner access has ended. Please set up billing to continue.';
      return null;
    case 'active_subscription':
    case 'invoice_billing_approved':
    case 'prepaid_package_active':
    case 'payment_method_added':
      return null; // valid
    case 'invoice_billing_pending':
      return 'Invoice billing approval is pending. You will be notified once approved.';
    case 'payment_failed':
      return 'Your last payment failed. Please update your payment method.';
    case 'suspended':
      return 'Your account has been suspended. Contact desk@fredheimtech.com.';
    case 'no_billing_setup':
    default:
      return 'Billing setup is required before publishing a job posting. Please add a payment method, select a plan, or request invoice billing approval.';
  }
}
