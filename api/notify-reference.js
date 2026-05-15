// api/notify-reference.js
// Sends a reference questionnaire email when a candidate adds a reference.
// Called immediately after fed_references INSERT succeeds.
// The questionnaire link routes to ?ref=TOKEN which loads QuestionnairePage.

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

  const zapierUrl = process.env.ZAPIER_DESK_WEBHOOK;
  const questionnaireUrl = `https://desk.fredheimtech.com?ref=${encodeURIComponent(token)}`;

  if (!zapierUrl) {
    console.log('ZAPIER_DESK_WEBHOOK not set — reference email skipped. Token:', token);
    console.log('Questionnaire URL:', questionnaireUrl);
    return res.status(200).json({ ok: true, skipped: true, url: questionnaireUrl });
  }

  try {
    await fetch(zapierUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:              'reference_questionnaire',
        to_email:          ref_email,
        subject:           `${candidate_name || 'A colleague'} listed you as a reference — 5-minute questionnaire`,
        ref_name:          ref_name,
        candidate_name:    candidate_name,
        questionnaire_url: questionnaireUrl,
        body: `Hi ${ref_name || 'there'},\n\n${candidate_name || 'A colleague'} has listed you as a professional reference on Fredheim Executive Desk, a curated executive opportunity platform.\n\nThey've asked if you'd complete a brief 5-minute questionnaire about your professional experience with them. No login is required.\n\nComplete the questionnaire here:\n${questionnaireUrl}\n\nThis link is unique to you. If you have any questions, contact desk@fredheimtech.com.\n\nFredheim Executive Desk\ndesk@fredheimtech.com`,
      }),
    });
    return res.status(200).json({ ok: true, url: questionnaireUrl });
  } catch(e) {
    console.error('Reference notification failed:', e.message);
    return res.status(500).json({ error: 'Failed to send reference email.' });
  }
};
