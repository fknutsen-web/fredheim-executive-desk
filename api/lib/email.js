// api/lib/email.js
// Centralized native email delivery for Fredheim Desk.
// Replaces the retired Zapier webhook integration.
//
// Exports:
//   sendEmail({ to, subject, html, text })      -> { ok, id?, error?, skipped? }
//   sendAdminAlert({ subject, html, text })      -> sends to ADMIN_EMAIL
//   brandedHtml(bodyText, { heading })           -> wrap plain text in branded HTML
//
// Design notes:
//   - Never throws. Email is a side effect; a delivery failure returns
//     { ok:false, error } so callers decide whether it is fatal. Callers that
//     are legally/commercially required to deliver (e.g. a paid introduction)
//     can inspect `ok` and surface the failure.
//   - All sends are logged. Failures are logged at error level with context.

const { Resend } = require('resend');

// All platform email originates from the Fredheim Desk domain. Default sender
// is notifications@fredheimtech.com (override via FROM_EMAIL). Brand is always
// "Fredheim Desk — Confidential Talent Marketplace".
const FROM_EMAIL  = process.env.FROM_EMAIL  || 'Fredheim Desk <notifications@fredheimtech.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'desk@fredheimtech.com';
const APP_URL     = process.env.APP_URL     || 'https://desk.fredheimtech.com';
const BRAND_NAME    = 'Fredheim Desk';
const BRAND_TAGLINE = 'Confidential Talent Marketplace';

// Lazy singleton so a missing key never crashes module load.
let _resend = null;
function client() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

// ── HTML HELPERS ──────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escape first, then turn bare URLs into anchors and newlines into <br>.
function textToHtml(text) {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color:#1a2b4a;text-decoration:underline;">${url}</a>`
  );
  return linked.replace(/\n/g, '<br>');
}

// Branded shell — confidential, executive, minimal. No hype, no job-board tone.
function brandedHtml(bodyText, opts = {}) {
  const heading = opts.heading || '';
  const inner = opts.rawHtml ? bodyText : textToHtml(bodyText);
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e2dd;">
          <tr><td style="background:#1a2b4a;padding:20px 32px;">
            <span style="color:#ffffff;font-size:15px;letter-spacing:3px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${BRAND_NAME}</span><br>
            <span style="color:#c9b27a;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${BRAND_TAGLINE}</span>
          </td></tr>
          ${heading ? `<tr><td style="padding:28px 32px 0 32px;"><h1 style="margin:0;font-size:19px;font-weight:normal;color:#1a2b4a;line-height:1.35;">${escapeHtml(heading)}</h1></td></tr>` : ''}
          <tr><td style="padding:20px 32px 28px 32px;font-size:15px;line-height:1.65;color:#2a2a2a;">
            ${inner}
          </td></tr>
          <tr><td style="padding:18px 32px;border-top:1px solid #ececE7;font-size:12px;line-height:1.5;color:#8a8a82;font-family:Arial,Helvetica,sans-serif;">
            ${BRAND_NAME} &middot; ${BRAND_TAGLINE} &middot; Confidential<br>
            <a href="${APP_URL}" style="color:#8a8a82;text-decoration:underline;">${APP_URL.replace(/^https?:\/\//, '')}</a>
            &middot; <a href="mailto:${ADMIN_EMAIL}" style="color:#8a8a82;text-decoration:underline;">${ADMIN_EMAIL}</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// ── SEND ──────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    console.error('[email] send skipped — no recipient. subject:', subject);
    return { ok: false, error: 'No recipient' };
  }

  const resend = client();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — email not sent. to:', to, 'subject:', subject);
    return { ok: false, skipped: true, error: 'RESEND_API_KEY not configured' };
  }

  // Always provide both html and a plain-text fallback.
  const bodyHtml = html || brandedHtml(text || '');
  const bodyText = text || (typeof html === 'string' ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      Array.isArray(to) ? to : [to],
      subject: subject || '(no subject)',
      html:    bodyHtml,
      text:    bodyText,
    });
    if (error) {
      console.error('[email] Resend error. to:', to, 'subject:', subject, '->', error.message || error);
      return { ok: false, error: error.message || String(error) };
    }
    console.log('[email] sent. to:', to, 'subject:', subject, 'id:', data?.id);
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error('[email] send threw. to:', to, 'subject:', subject, '->', e.message);
    return { ok: false, error: e.message };
  }
}

async function sendAdminAlert({ subject, html, text }) {
  return sendEmail({
    to:      ADMIN_EMAIL,
    subject,
    html:    html || brandedHtml(text || '', { heading: subject }),
    text,
  });
}

module.exports = {
  sendEmail,
  sendAdminAlert,
  brandedHtml,
  textToHtml,
  escapeHtml,
  FROM_EMAIL,
  ADMIN_EMAIL,
  APP_URL,
};
