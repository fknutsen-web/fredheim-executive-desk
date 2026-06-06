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
const { sendAdminAlert } = require('./lib/email');
const { FOUNDING } = require('./lib/pricing');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';
const db       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FOUNDING_DEADLINE  = FOUNDING.deadline();
const IS_FOUNDING_PERIOD = FOUNDING.isWindowActive();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.method === 'GET' ? req.query : (req.body || {});

  // ── ADMIN: set a recruiter's billing status (admin console) ────────────────
  // Authenticated via the admin HMAC token, not a Supabase user session. This
  // replaces the previous client-side writes to fed_recruiter_billing so the
  // table no longer needs a public write policy.
  if (action === 'admin_set_status') {
    const { isAuthorizedAdmin } = require('./admin-auth');
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ error: 'Admin authentication required.' });
    }
    const { target_email, billing_status, admin_review_status, clear_suspended } = req.body || {};
    if (!target_email || !billing_status) {
      return res.status(400).json({ error: 'target_email and billing_status required.' });
    }
    const now = new Date().toISOString();
    const patch = { billing_status, updated_at: now };
    if (admin_review_status) { patch.admin_review_status = admin_review_status; patch.admin_reviewed_at = now; }
    if (billing_status === 'suspended') patch.suspended_at = now;
    if (clear_suspended) patch.suspended_at = null;

    const { error } = await db
      .from('fed_recruiter_billing')
      .update(patch)
      .eq('recruiter_email', String(target_email).toLowerCase());
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, billing_status });
  }

  // Auth required for all actions except public check
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required.' });

  const anon = createClient(process.env.SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return res.status(403).json({ error: 'Invalid session.' });

  const email = user.email.toLowerCase();

  try {
    // ── CLOSE ACCOUNT (self-serve, GDPR) ──────────────────────────────────────
    // Authenticated above as `email`. Archives the recruiter's postings, closes
    // their matches, and scrubs firm/contact/billing PII.
    if (action === 'delete_account') {
      const now = new Date().toISOString();
      const tombstone = `removed_${Date.now()}@deleted`;
      // Archive postings + strip firm contact details so they leave the board.
      await db.from('fed_jobs')
        .update({ status: 'archived', archived_at: now, firm_email: tombstone, firm_contact: null })
        .ilike('firm_email', email);
      // Close any matches tied to this recruiter and drop the identifier.
      await db.from('fed_matches')
        .update({ status: 'closed', recruiter_email: tombstone })
        .ilike('recruiter_email', email);
      // Scrub submissions, billing, and profile.
      await db.from('fed_recruiter_submissions')
        .update({ contact_name: '[REMOVED]', email: tombstone, status: 'removed' })
        .ilike('email', email);
      await db.from('fed_recruiter_billing')
        .update({ billing_status: 'closed', invoice_company_name: null, invoice_company_address: null,
                  invoice_contact_name: null, invoice_contact_email: null, invoice_billing_notes: null, updated_at: now })
        .ilike('recruiter_email', email);
      await db.from('fed_recruiter_profiles').delete().ilike('recruiter_email', email);
      await db.from('fed_notifications').delete().ilike('recipient_email', email);
      return res.status(200).json({ ok: true, message: 'Recruiter account closed.' });
    }

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
      await sendAdminAlert({
        subject: `Invoice billing request — ${invoice_company_name}`,
        text: `Invoice billing requested.\n\nCompany: ${invoice_company_name}\nRecruiter: ${email}\nContact: ${invoice_contact_name} <${invoice_contact_email}>\n\nAdmin: https://desk.fredheimtech.com?admin=true`,
      });

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
