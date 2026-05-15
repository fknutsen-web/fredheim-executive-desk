// api/notify-brief.js
// Fires when a consulting brief is submitted via BriefModal.
// Sends admin alert and submitter confirmation via Zapier.

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

  const adminEmail = process.env.ADMIN_EMAIL || 'desk@fredheimtech.com';
  const zapierUrl  = process.env.ZAPIER_DESK_WEBHOOK;

  async function send(payload) {
    if (!zapierUrl) return;
    try {
      await fetch(zapierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch(e) { console.error('Zapier brief notify failed:', e.message); }
  }

  const rateStr = rate_min ? `$${rate_min}${rate_max ? `–$${rate_max}` : '+'}  /day` : 'Not specified';

  // Admin alert
  await send({
    type:         'new_brief_admin_alert',
    to_email:     adminEmail,
    subject:      `New consulting brief — ${company_name || 'Unknown'}: ${title || 'Untitled'}`,
    company_name, contact_name, submitter_email: email,
    title, engagement_type, duration, rate: rateStr, location, urgency,
    submitted_at: new Date().toISOString(),
    review_url:   'https://desk.fredheimtech.com?admin=true',
    body: `New consulting brief submitted.\n\nCompany: ${company_name}\nContact: ${contact_name}\nEmail: ${email}\n\nBrief: ${title}\nType: ${engagement_type}\nRate: ${rateStr}\nLocation: ${location}\n\nReview: https://desk.fredheimtech.com?admin=true`,
  });

  // Submitter confirmation
  if (email) {
    await send({
      type:         'new_brief_confirmation',
      to_email:     email,
      subject:      'Fredheim — Consulting brief received',
      company_name, contact_name, title,
      body: `Hi ${contact_name || 'there'},\n\nYour consulting brief for "${title}" has been received. We'll review it and be in touch within 24 hours.\n\nAs a Founding Partner, this is your complimentary posting for the month.\n\nQuestions? desk@fredheimtech.com\n\nFredheim Executive Desk`,
    });
  }

  return res.status(200).json({ ok: true });
};
