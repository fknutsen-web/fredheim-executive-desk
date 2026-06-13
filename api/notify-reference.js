// api/notify-reference.js
// Sends a reference questionnaire email when a candidate adds a reference.
// Called immediately after fed_references INSERT succeeds.
// The questionnaire link routes to ?ref=TOKEN which loads QuestionnairePage.

const { sendEmail, brandedHtml } = require('./lib/email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { ref_name, ref_email, candidate_name, token } = req.body || {};

  if (!ref_email || !token) {
    return res.status(400).json({ error: 'ref_email and token required.' });
  }

  const questionnaireUrl = `https://desk.fredheimtech.com?ref=${encodeURIComponent(token)}`;
  const subject = `${candidate_name || 'A colleague'} listed you as a reference — 5-minute questionnaire`;
  const body = `Hi ${ref_name || 'there'},\n\n${candidate_name || 'A colleague'} has listed you as a professional reference on Fredheim Desk, a confidential talent marketplace.\n\nThey've asked if you'd complete a brief 5-minute questionnaire about your professional experience with them. No login is required.\n\nComplete the questionnaire here:\n${questionnaireUrl}\n\nThis link is unique to you. If you have any questions, contact desk@fredheimtech.com.\n\nFredheim Desk\ndesk@fredheimtech.com`;

  const result = await sendEmail({ to: ref_email, subject, text: body, html: brandedHtml(body, { heading: subject }) });

  if (!result.ok) {
    console.error('Reference notification not delivered:', result.error, '— token:', token, 'url:', questionnaireUrl);
    // Non-fatal: return the URL so the candidate can share it manually.
    return res.status(200).json({ ok: false, sent: false, url: questionnaireUrl, error: result.error });
  }
  return res.status(200).json({ ok: true, sent: true, url: questionnaireUrl });
};
