// api/email-test.js
// Admin-gated one-click email smoke test. Sends a single branded test email
// (default recipient: ADMIN_EMAIL) through the exact same Resend path the app
// uses for every transactional message, and returns the delivery result — so
// you can confirm RESEND_API_KEY + the verified sending domain + FROM_EMAIL are
// all wired without waiting for a real signup or payment.
//
//   GET /api/email-test             -> sends to ADMIN_EMAIL
//   GET /api/email-test?to=a@b.com  -> sends to a specific address
//
// SAFETY:
//   - Admin-gated (same auth as /api/env-check). Not publicly callable.
//   - No DB writes, no Stripe, no event replay — it only sends one email.
//   - NEVER returns a secret. FROM_EMAIL / ADMIN_EMAIL are non-secret display
//     values already used in outbound mail, so they are returned to help debug.

const { isAuthorizedAdmin } = require('./admin-auth');
const { sendEmail, brandedHtml, FROM_EMAIL, ADMIN_EMAIL, APP_URL } = require('./lib/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorizedAdmin(req)) {
    // Don't reveal anything to unauthenticated callers.
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Recipient: ?to=... (validated) or the configured admin address.
  const requested = (req.query?.to || '').trim();
  if (requested && !EMAIL_RE.test(requested)) {
    return res.status(400).json({ error: 'Invalid "to" address.' });
  }
  const to = requested || ADMIN_EMAIL;

  const sentAt  = new Date().toISOString();
  const subject = 'Trovant Talent — email delivery test';
  const body =
    `This is a test from /api/email-test confirming transactional email is wired correctly.\n\n` +
    `From: ${FROM_EMAIL}\n` +
    `To: ${to}\n` +
    `App URL: ${APP_URL}\n` +
    `Sent: ${sentAt}\n\n` +
    `If you received this, RESEND_API_KEY, the verified sending domain, and FROM_EMAIL are all working.`;

  // sendEmail never throws — it returns { ok, id?, skipped?, error? }.
  const result = await sendEmail({
    to,
    subject,
    text: body,
    html: brandedHtml(body, { heading: subject }),
  });

  const ok = result.ok === true;
  return res.status(ok ? 200 : 500).json({
    ok,
    to,
    from:      FROM_EMAIL,
    appUrl:    APP_URL,
    sentAt,
    resend_id: result.id || null,
    skipped:   result.skipped || false,
    error:     result.error || null,
    hint: ok
      ? 'Sent. Check the inbox (and Resend → Emails) to confirm delivery.'
      : result.skipped
        ? 'RESEND_API_KEY is not set in this deployment — add it and redeploy.'
        : 'Resend rejected the send. Most common cause: the FROM_EMAIL domain is not verified in Resend, or the key is invalid. See "error".',
  });
};
