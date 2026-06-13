// api/notify-brief.js
// Fires when a consulting brief is submitted via BriefModal.
// Sends admin alert and submitter confirmation via native email.

const { sendEmail, sendAdminAlert, brandedHtml } = require('./lib/email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const {
    company_name, contact_name, email, title,
    engagement_type, duration, rate_min, rate_max, location, urgency,
  } = req.body || {};

  const rateStr = rate_min ? `$${rate_min}${rate_max ? `–$${rate_max}` : '+'}  /day` : 'Not specified';

  // Admin alert
  await sendAdminAlert({
    subject: `New consulting brief — ${company_name || 'Unknown'}: ${title || 'Untitled'}`,
    text: `New consulting brief submitted.\n\nCompany: ${company_name}\nContact: ${contact_name}\nEmail: ${email}\n\nBrief: ${title}\nType: ${engagement_type}\nRate: ${rateStr}\nLocation: ${location}\n\nReview: https://desk.fredheimtech.com?admin=true`,
  });

  // Submitter confirmation
  if (email) {
    const subject = 'Fredheim — Consulting brief received';
    const body = `Hi ${contact_name || 'there'},\n\nYour consulting brief for "${title}" has been received. We'll review it and be in touch within 24 hours.\n\nAs a Founding Partner, this is your complimentary posting for the month.\n\nQuestions? desk@fredheimtech.com\n\nFredheim Desk`;
    await sendEmail({ to: email, subject, text: body, html: brandedHtml(body, { heading: subject }) });
  }

  return res.status(200).json({ ok: true });
};
