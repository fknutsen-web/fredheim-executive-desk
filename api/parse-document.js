// api/parse-document.js
// Document intake parser. Accepts a base64-encoded PDF, DOCX, plain text, or
// pasted text and returns structured fields aligned to either the recruiter
// INTAKE_SCHEMA or the candidate operating profile.
//
// Each field returns { value, confidence } where confidence is one of:
//   high     - explicit, unambiguous in source
//   medium   - reasonable inference from context
//   low      - guess; UI requires explicit user confirmation
//   missing  - not found; UI leaves field blank
//
// Never invents data. If a field is not in the source, returns missing.
// Never auto-submits. The /review screen on the client side gates everything.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { mode, file_base64, file_mime, pasted_text } = req.body || {};
  if (!['recruiter','candidate'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be "recruiter" or "candidate"' });
  }
  if (!file_base64 && !pasted_text) {
    return res.status(400).json({ error: 'Provide file_base64 or pasted_text' });
  }

  const RECRUITER_FIELDS = `
    role_title, functional_dept, reports_to, base_salary_range, comp_floor,
    comp_target_low, comp_target_high, comp_exceptional_ceiling,
    comp_negotiability, bonus_structure (array), equity_ltip, work_arrangement
    (onsite|hybrid_office|hybrid_remote|remote), travel_pct, relocation_required
    (yes|no|flexible), environment_tags (array), leadership_tags (array),
    complexity_tags (array), commercial_environment_tags (array),
    technical_fluency (deep|working|directional|not_required),
    saas_recurring (yes|no|unsure), enterprise_sales (yes|no|unsure),
    must_have (text), preferred (text), nice_to_have (text), success_12mo
    (text), success_outcomes (text), industry, company_name, urgency_level
    (exploratory|active|urgent|critical), confidential_search
    (yes|partial|no), geographic_footprint`;

  const CANDIDATE_FIELDS = `
    first_name, last_name, current_title, current_company, location, industry,
    function, leadership_class (manager|sr_manager|director|sr_director|vp|svp|c_suite),
    team_size_managed, direct_reports, revenue_responsibility, pl_ownership
    (yes|no|unsure), budget_responsibility, capex_authority,
    geographic_responsibility, multi_site (yes|no|unsure), international (yes|no|unsure),
    core_industries (array), adjacent_industries (array), tech_experience (array),
    leadership_style_tags (array), career_intent (array), achievements
    (array of {prompt, situation, action, result, impact, scope}),
    education, certifications, languages,
    transformation_experience (text), systems_implemented (array)`;

  const fieldList = mode === 'recruiter' ? RECRUITER_FIELDS : CANDIDATE_FIELDS;

  const systemPrompt = `You extract structured data from ${mode === 'recruiter' ? 'search briefs / job descriptions / role scorecards' : 'resumes / CVs / biographies / deal sheets'} for a maritime, ports, energy, logistics, and industrial-technology talent marketplace serving professionals at every career level.

Return ONLY a single valid JSON object - no prose, no markdown code fences. The JSON keys are the requested field names. Each value MUST be an object: {"value": <string|array|null>, "confidence": "high"|"medium"|"low"|"missing"}.

Rules:
- If a field is explicitly present in the source, confidence = "high".
- If you can reasonably infer it from context, confidence = "medium".
- If it is a guess, confidence = "low".
- If not present at all, return {"value": null, "confidence": "missing"}.
- NEVER invent specific numbers, company names, or facts that are not in the source.
- For array fields, return a JSON array of strings. Empty array if none found.
- For comp fields, normalize to USD numeric strings (e.g. "350000") when possible.

Fields to extract:
${fieldList}

Source document follows.`;

  // Build the user message content. Anthropic supports PDF natively via the
  // `document` content block; for DOCX or pasted text we send as plain text.
  let userContent;
  if (file_base64 && file_mime === 'application/pdf') {
    userContent = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } },
      { type: 'text', text: 'Extract the fields per the system prompt.' },
    ];
  } else if (pasted_text) {
    userContent = `${pasted_text.slice(0, 60000)}`;
  } else if (file_base64) {
    // For DOCX/TXT/etc., decode and send as text. We trust the client to send
    // already-extracted text for non-PDF formats; the dropzone does that.
    const text = Buffer.from(file_base64, 'base64').toString('utf-8').slice(0, 60000);
    userContent = text;
  } else {
    return res.status(400).json({ error: 'No source content provided' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('anthropic error', r.status, data);
      return res.status(502).json({ error: 'Parse failed', detail: data });
    }
    const text = (data.content || []).map(c => c.text || '').join('').trim();
    // Strip code fences if present
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch (e) {
      console.error('JSON parse failed:', cleaned.slice(0, 500));
      return res.status(502).json({ error: 'Parser returned non-JSON', raw: cleaned.slice(0, 1000) });
    }
    return res.status(200).json({ mode, fields: parsed });
  } catch (err) {
    console.error('parse-document error:', err);
    return res.status(500).json({ error: err.message || 'Parse failed' });
  }
};
