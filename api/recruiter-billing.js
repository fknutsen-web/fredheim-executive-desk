// api/recruiter-billing.js
// Manages recruiter billing status.
// Actions:
//   get_status          — return current billing record for the caller
//   request_invoice     — submit invoice billing request for admin review
//   grant_founding      — auto-grants founding_partner status (called on first submission during founding period)
//   check_gate          — returns {allowed: bool, reason: string} for UI gating
//
// The founding_partner status is automatically granted on first search submission
// during the 2026 founding period. After 2027-01-01, billing is required.

const { createClient } = require('@supabase/supabase-js');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';
const db       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FOUNDING_DEADLINE  = new Date(process.env.FOUNDING_DEADLINE || '2026-12-31T23:59:59Z');
const IS_FOUNDING_PERIOD = new Date() <= FOUNDING_DEADLINE;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.method === 'GET' ? req.query : (req.body || {});

  // Auth required for all actions except public check
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required.' });

  const anon = createClient(process.env.SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return res.status(403).json({ error: 'Invalid session.' });

  const email = user.email.toLowerCase();

  try {
    // ── GET CURRENT BILLING STATUS ───────────────────────────────────────────
    if (action === 'get_status' || req.method === 'GET') {
      const { data: billing } = await db
        .from('fed_recruiter_billing').select('*').eq('recruiter_email', email).maybeSingle();

      return res.status(200).json({
        billing: billing || null,
        founding_period_active: IS_FOUNDING_PERIOD,
        founding_deadline: FOUNDING_DEADLINE.toISOString(),
        allowed: billing ? isBillingValid(billing) : IS_FOUNDING_PERIOD,
      });
    }

    // ── GRANT FOUNDING PARTNER (called on first submission during founding period) ──
    if (action === 'grant_founding') {
      if (!IS_FOUNDING_PERIOD) {
        return res.status(400).json({ error: 'Founding period has ended. Billing setup required.' });
      }

      const { data: existing } = await db
        .from('fed_recruiter_billing').select('billing_status').eq('recruiter_email', email).maybeSingle();

      if (!existing) {
        await db.from('fed_recruiter_billing').insert({
          recruiter_email:     email,
          billing_status:      'founding_partner',
          founding_granted_at: new Date().toISOString(),
          founding_expires_at: FOUNDING_DEADLINE.toISOString(),
        });
      }

      return res.status(200).json({ ok: true, billing_status: 'founding_partner', founding_period_active: true });
    }

    // ── CHECK GATE (for client-side UI decisions) ────────────────────────────
    if (action === 'check_gate') {
      const { data: billing } = await db
        .from('fed_recruiter_billing').select('*').eq('recruiter_email', email).maybeSingle();

      const allowed = billing ? isBillingValid(billing) : IS_FOUNDING_PERIOD;
      const reason  = billing ? billingBlockReason(billing) : (
        IS_FOUNDING_PERIOD ? null : 'Billing setup required to post or access candidates.'
      );

      return res.status(200).json({ allowed, reason, billing_status: billing?.billing_status || 'no_billing_setup' });
    }

    // ── REQUEST INVOICE BILLING ──────────────────────────────────────────────
    if (action === 'request_invoice') {
      const {
        invoice_company_name, invoice_company_address,
        invoice_contact_name, invoice_contact_email,
        invoice_po_required, invoice_billing_notes,
      } = req.body;

      if (!invoice_company_name || !invoice_contact_email) {
        return res.status(400).json({ error: 'Company name and billing contact email required.' });
      }

      await db.from('fed_recruiter_billing').upsert({
        recruiter_email:        email,
        billing_status:         'invoice_billing_pending',
        invoice_company_name,
        invoice_company_address,
        invoice_contact_name,
        invoice_contact_email,
        invoice_po_required:    !!invoice_po_required,
        invoice_billing_notes,
        admin_review_status:    'pending',
      }, { onConflict: 'recruiter_email' });

      // Notify admin
      const zapierUrl = process.env.ZAPIER_DESK_WEBHOOK;
      if (zapierUrl) {
        await fetch(zapierUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type:              'invoice_billing_request',
            to_email:          process.env.ADMIN_EMAIL || 'desk@fredheimtech.com',
            subject:           `Invoice billing request — ${invoice_company_name}`,
            recruiter_email:   email,
            company_name:      invoice_company_name,
            contact_email:     invoice_contact_email,
            admin_url:         'https://desk.fredheimtech.com?admin=true',
            body:              `Invoice billing requested.\n\nCompany: ${invoice_company_name}\nRecruiter: ${email}\nContact: ${invoice_contact_name} <${invoice_contact_email}>\n\nAdmin: https://desk.fredheimtech.com?admin=true`,
          }),
        }).catch(() => {});
      }

      return res.status(200).json({ ok: true, status: 'invoice_billing_pending' });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch(e) {
    console.error('recruiter-billing error:', e);
    return res.status(500).json({ error: e.message });
  }
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
function isBillingValid(billing) {
  if (!billing) return false;
  switch (billing.billing_status) {
    case 'founding_partner':
      return !billing.founding_expires_at || new Date() <= new Date(billing.founding_expires_at);
    case 'active_subscription':
    case 'invoice_billing_approved':
    case 'prepaid_package_active':
    case 'payment_method_added':
      return true;
    default:
      return false;
  }
}

function billingBlockReason(billing) {
  switch (billing.billing_status) {
    case 'no_billing_setup':
      return 'Billing setup is required. Add a payment method, select a subscription, or request invoice billing.';
    case 'invoice_billing_pending':
      return 'Invoice billing request is pending admin approval. You will be notified within 24 hours.';
    case 'payment_failed':
      return 'Your last payment failed. Please update your payment method to continue.';
    case 'suspended':
      return 'Your account has been suspended. Contact desk@fredheimtech.com for assistance.';
    case 'founding_partner':
      return 'Founding Partner access has expired. Please set up billing to continue.';
    default:
      return null;
  }
}
