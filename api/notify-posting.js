// api/notify-posting.js
// Fires when a new search posting is submitted via the Post a Search modal.
// Sends two notifications via Zapier:
//   1. Admin alert to desk@fredheimtech.com with full submission details
//   2. Confirmation email to the submitting firm

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const {
    firm_name, contact_name, email,
    role_title, role_level, industry, location,
    salary_range, notes,
  } = req.body || {};

  const adminEmail  = process.env.ADMIN_EMAIL  || 'desk@fredheimtech.com';
  const zapierUrl   = process.env.ZAPIER_DESK_WEBHOOK;

  async function send(payload) {
    if (!zapierUrl) return;
    try {
      await fetch(zapierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch(e) {
      console.error('Zapier notify failed:', e.message);
    }
  }

  // ── 1. Admin alert ────────────────────────────────────────────
  await send({
    type:         'new_posting_admin_alert',
    to_email:     adminEmail,
    subject:      `New search posting — ${firm_name || 'Unknown firm'}: ${role_title || 'Untitled'}`,
    firm_name,
    contact_name,
    submitter_email: email,
    role_title,
    role_level,
    industry,
    location,
    salary_range,
    notes,
    submitted_at: new Date().toISOString(),
    review_url:   'https://desk.fredheimtech.com?admin=true',
  });

  // ── 2. Submitter confirmation ─────────────────────────────────
  if (email) {
    await send({
      type:       'new_posting_confirmation',
      to_email:   email,
      subject:    `Fredheim Executive Desk — Submission received`,
      firm_name,
      contact_name,
      role_title,
      body: `Hi ${contact_name || 'there'},\n\nYour search posting for ${role_title} has been received. We'll review it and confirm within 24 hours. As a Founding Partner, this counts as your complimentary posting for the month.\n\nQuestions? Reply to this email or reach us at desk@fredheimtech.com.\n\nFredheim Executive Desk\ndesk@fredheimtech.com`,
    });
  }

  return res.status(200).json({ ok: true });
};
