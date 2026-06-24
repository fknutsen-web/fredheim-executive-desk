// api/talent-candidates.js
// Candidate CRUD, score computation, status management, re-engagement logic

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';
const { isAuthorizedAdmin } = require('./admin-auth');

// Answer value → raw points (A=1 … E=5, missing=0)
function pts(ans) {
  return { A: 1, B: 2, C: 3, D: 4, E: 5 }[ans] || 0;
}

// Compute all scores from answers object
function computeScores(answers) {
  const a = answers || {};

  // Executive fit Q1-Q10 (max 40 pts → scale to 100)
  const execRaw = ['Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8','Q9','Q10']
    .reduce((s, k) => s + pts(a[k]), 0);
  const execScore = Math.round(Math.min(100, (execRaw / 40) * 100));

  // Technology T1-T4 (max 16 pts → scale to 100)
  const techRaw = ['T1','T2','T3','T4'].reduce((s, k) => s + pts(a[k]), 0);
  const techScore = Math.round(Math.min(100, (techRaw / 16) * 100));

  // Change management C1-C4 (max 16 pts → scale to 100)
  const changeRaw = ['C1','C2','C3','C4'].reduce((s, k) => s + pts(a[k]), 0);
  const changeScore = Math.round(Math.min(100, (changeRaw / 16) * 100));

  // Background B1-B6 (weighted: B2+B3 carry more weight)
  const bgRaw =
    pts(a['B1']) * 4 +
    pts(a['B2']) * 7 +
    pts(a['B3']) * 7 +
    pts(a['B4']) * 3 +
    pts(a['B5']) * 5 +
    pts(a['B6']) * 4;
  const bgScore = Math.round(Math.min(100, bgRaw / 3));

  // Weighted composite
  const composite = Math.round(
    (execScore * 40 + techScore * 20 + changeScore * 20 + bgScore * 20) / 100
  );

  // Badges
  const badgeSeasoned = ['D','E'].includes(a['B3']) && ['D','E'].includes(a['B2']);
  const badgeTech     = ['C','D'].includes(a['T1']) && ['C','D'].includes(a['T3']);

  return {
    score_executive_fit: execScore,
    score_technology:    techScore,
    score_change_mgmt:   changeScore,
    score_background:    bgScore,
    score_composite:     composite,
    badge_seasoned_exec: badgeSeasoned,
    badge_tech_forward:  badgeTech,
  };
}

// Trigger match computation for all active roles
async function computeMatches(candidateId, scores) {
  const { data: roles } = await supabase
    .from('talent_roles')
    .select('id, recruiter_id, min_match_pct, allow_pivot, min_years_senior')
    .eq('status', 'active');

  if (!roles || roles.length === 0) return;

  const { data: candidate } = await supabase
    .from('talent_candidates')
    .select('score_composite, pivot_candidate, answers')
    .eq('id', candidateId)
    .single();

  for (const role of roles) {
    const matchPct = scores.score_composite;
    if (matchPct < role.min_match_pct) continue;
    if (!role.allow_pivot && candidate.pivot_candidate) continue;

    // Check min years senior
    const seniorAns = candidate.answers?.B3;
    const seniorYears = { A: 0, B: 2, C: 6, D: 12, E: 15 }[seniorAns] || 0;
    if (seniorYears < (role.min_years_senior || 0)) continue;

    await supabase.from('talent_matches').upsert({
      candidate_id: candidateId,
      role_id: role.id,
      recruiter_id: role.recruiter_id,
      match_pct: matchPct,
      score_breakdown: {
        executive_fit: scores.score_executive_fit,
        technology:    scores.score_technology,
        change_mgmt:   scores.score_change_mgmt,
        background:    scores.score_background,
      }
    }, { onConflict: 'candidate_id,role_id' });

    // Trigger notification if above realtime threshold
    if (matchPct >= (role.notify_realtime_threshold || 85) && role.notify_realtime) {
      await triggerRealtimeAlert(candidateId, role.id, role.recruiter_id, matchPct);
    }
  }
}

// Queue a realtime alert notification
async function triggerRealtimeAlert(candidateId, roleId, recruiterId, matchPct) {
  await supabase.from('talent_notifications').insert({
    type: 'realtime_alert',
    recruiter_id: recruiterId,
    candidate_id: candidateId,
    role_id: roleId,
    subject: `New ${matchPct}% match found`,
    body_preview: `A new candidate matched at ${matchPct}%. Review now.`,
  });
}

// ── RE-ENGAGEMENT JOB ──────────────────────────────────────────
// Call this from a cron job or scheduled Vercel function daily
async function runReengagementJob() {
  const now = new Date();
  const results = { touch1: 0, touch2: 0, touch3: 0, archived: 0 };

  // Day 45 — Touch 1
  const day45 = new Date(now); day45.setDate(day45.getDate() - 45);
  const { data: touch1Candidates } = await supabase
    .from('talent_candidates')
    .select('id, email, first_name')
    .eq('status', 'active')
    .is('reengagement_touch_1', null)
    .lt('last_active_at', day45.toISOString());

  for (const c of touch1Candidates || []) {
    await supabase.from('talent_notifications').insert({
      type: 'candidate_reengagement_1',
      candidate_id: c.id,
      recipient_email: c.email,
      subject: 'Still exploring opportunities?',
      body_preview: `Hi ${c.first_name} — just checking in. One click to confirm you're still active.`,
    });
    await supabase.from('talent_candidates')
      .update({ reengagement_touch_1: now.toISOString() })
      .eq('id', c.id);
    results.touch1++;
  }

  // Day 60 — Touch 2
  const day60 = new Date(now); day60.setDate(day60.getDate() - 60);
  const { data: touch2Candidates } = await supabase
    .from('talent_candidates')
    .select('id, email, first_name')
    .in('status', ['active', 'passive'])
    .not('reengagement_touch_1', 'is', null)
    .is('reengagement_touch_2', null)
    .lt('last_active_at', day60.toISOString());

  for (const c of touch2Candidates || []) {
    await supabase.from('talent_notifications').insert({
      type: 'candidate_reengagement_2',
      candidate_id: c.id,
      recipient_email: c.email,
      subject: 'Your profile will be paused in 30 days',
      body_preview: `Hi ${c.first_name} — your profile will be paused unless you confirm you're still active.`,
    });
    await supabase.from('talent_candidates')
      .update({ reengagement_touch_2: now.toISOString() })
      .eq('id', c.id);
    results.touch2++;
  }

  // Day 85 — Touch 3 (final notice)
  const day85 = new Date(now); day85.setDate(day85.getDate() - 85);
  const { data: touch3Candidates } = await supabase
    .from('talent_candidates')
    .select('id, email, first_name')
    .in('status', ['active', 'passive'])
    .not('reengagement_touch_2', 'is', null)
    .is('reengagement_touch_3', null)
    .lt('last_active_at', day85.toISOString());

  for (const c of touch3Candidates || []) {
    await supabase.from('talent_notifications').insert({
      type: 'candidate_reengagement_3',
      candidate_id: c.id,
      recipient_email: c.email,
      subject: 'Final notice — profile archiving in 5 days',
      body_preview: `Hi ${c.first_name} — your profile will be archived in 5 days. You can reactivate any time.`,
    });
    await supabase.from('talent_candidates')
      .update({ reengagement_touch_3: now.toISOString() })
      .eq('id', c.id);
    results.touch3++;
  }

  // Day 90+ — Archive
  const day90 = new Date(now); day90.setDate(day90.getDate() - 90);
  const { data: archiveCandidates } = await supabase
    .from('talent_candidates')
    .select('id, email, first_name')
    .in('status', ['active', 'passive'])
    .not('reengagement_touch_3', 'is', null)
    .lt('last_active_at', day90.toISOString());

  for (const c of archiveCandidates || []) {
    await supabase.from('talent_candidates')
      .update({ status: 'archived', status_updated_at: now.toISOString() })
      .eq('id', c.id);
    await supabase.from('talent_notifications').insert({
      type: 'candidate_archived',
      candidate_id: c.id,
      recipient_email: c.email,
      subject: 'Your profile has been archived',
      body_preview: `Hi ${c.first_name} — your profile has been archived. You can reactivate any time with your answers saved.`,
    });
    results.archived++;
  }

  // Annual refresh prompts (365 days since last answers update)
  const day365 = new Date(now); day365.setDate(day365.getDate() - 365);
  const { data: refreshCandidates } = await supabase
    .from('talent_candidates')
    .select('id, email, first_name')
    .eq('status', 'active')
    .lt('last_answers_updated', day365.toISOString())
    .is('last_refresh_prompt', null);

  for (const c of refreshCandidates || []) {
    await supabase.from('talent_notifications').insert({
      type: 'candidate_refresh_prompt',
      candidate_id: c.id,
      recipient_email: c.email,
      subject: 'A lot can change in a year — update your profile',
      body_preview: `Hi ${c.first_name} — take 3 minutes to review your profile and make sure recruiters are seeing the best version of you.`,
    });
    await supabase.from('talent_candidates')
      .update({ last_refresh_prompt: now.toISOString() })
      .eq('id', c.id);
  }

  // Auto-relax role thresholds after 30 days unfilled
  const day30 = new Date(now); day30.setDate(day30.getDate() - 30);
  const { data: staleRoles } = await supabase
    .from('talent_roles')
    .select('id, min_match_pct, notify_realtime_threshold')
    .eq('status', 'active')
    .is('threshold_relaxed_at', null)
    .lt('created_at', day30.toISOString());

  for (const role of staleRoles || []) {
    const newMin = Math.max(50, (role.min_match_pct || 70) - 5);
    await supabase.from('talent_roles').update({
      original_min_match_pct: role.min_match_pct,
      min_match_pct: newMin,
      threshold_relaxed_at: now.toISOString(),
    }).eq('id', role.id);
  }

  return results;
}

// ── MAIN HANDLER ───────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    // ── SUBMIT questionnaire answers ──────────────────────────
    if (req.method === 'POST' && action === 'submit') {
      const { first_name, email, phone, answers, career_intent, pivot_candidate, pivot_notes } = req.body;

      if (!first_name || !email || !answers) {
        return res.status(400).json({ error: 'first_name, email, and answers are required.' });
      }

      const scores = computeScores(answers);

      const { data: existing } = await supabase
        .from('talent_candidates')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      let candidateId;

      if (existing) {
        // Update existing candidate
        const { data, error } = await supabase
          .from('talent_candidates')
          .update({
            first_name,
            phone,
            answers,
            career_intent,
            pivot_candidate: !!pivot_candidate,
            pivot_notes,
            badge_pivot: !!pivot_candidate,
            last_active_at: new Date().toISOString(),
            last_answers_updated: new Date().toISOString(),
            reengagement_touch_1: null,
            reengagement_touch_2: null,
            reengagement_touch_3: null,
            last_refresh_prompt: null,
            ...scores,
          })
          .eq('email', email.toLowerCase())
          .select('id')
          .single();

        if (error) throw error;
        candidateId = data.id;
      } else {
        // Insert new candidate
        const { data, error } = await supabase
          .from('talent_candidates')
          .insert({
            first_name,
            email: email.toLowerCase(),
            phone,
            answers,
            career_intent,
            pivot_candidate: !!pivot_candidate,
            pivot_notes,
            badge_pivot: !!pivot_candidate,
            status: 'active',
            last_active_at: new Date().toISOString(),
            last_answers_updated: new Date().toISOString(),
            ...scores,
          })
          .select('id')
          .single();

        if (error) throw error;
        candidateId = data.id;

        // Send confirmation notification
        await supabase.from('talent_notifications').insert({
          type: 'candidate_confirmation',
          candidate_id: candidateId,
          recipient_email: email.toLowerCase(),
          subject: 'Your Trovant Talent profile is active',
          body_preview: `Hi ${first_name} — your profile is now active and being matched against open searches.`,
        });
      }

      // Run match computation
      await computeMatches(candidateId, scores);

      return res.status(200).json({
        success: true,
        candidate_id: candidateId,
        scores,
        message: existing ? 'Profile updated successfully.' : 'Profile created successfully.',
      });
    }

    // ── CONFIRM still active ──────────────────────────────────
    if (req.method === 'PATCH' && action === 'confirm') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'email required.' });

      const { error } = await supabase
        .from('talent_candidates')
        .update({
          last_active_at: new Date().toISOString(),
          reengagement_touch_1: null,
          reengagement_touch_2: null,
          reengagement_touch_3: null,
          reengagement_confirmed_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('email', email.toLowerCase());

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Profile confirmed as active.' });
    }

    // ── UPDATE status (active/passive/paused) ─────────────────
    if (req.method === 'PATCH' && action === 'status') {
      const { email, status } = req.body;
      const allowed = ['active','passive','paused'];
      if (!email || !allowed.includes(status)) {
        return res.status(400).json({ error: `email and status (${allowed.join('/')}) required.` });
      }

      const { error } = await supabase
        .from('talent_candidates')
        .update({
          status,
          status_updated_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        })
        .eq('email', email.toLowerCase());

      if (error) throw error;
      return res.status(200).json({ success: true, status });
    }

    // ── REACTIVATE from archived ──────────────────────────────
    if (req.method === 'PATCH' && action === 'reactivate') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'email required.' });

      const { error } = await supabase
        .from('talent_candidates')
        .update({
          status: 'active',
          status_updated_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          reengagement_touch_1: null,
          reengagement_touch_2: null,
          reengagement_touch_3: null,
        })
        .eq('email', email.toLowerCase());

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Profile reactivated.' });
    }

    // ── REQUEST removal (GDPR/CCPA) ──────────────────────────
    // Scrubs personal data across BOTH the legacy talent product and the
    // executive (fed) product, plus related match rows and addressed
    // notifications. Caller must be the data subject (a valid Supabase session
    // for that email) or an authorised admin.
    if (req.method === 'DELETE' && action === 'remove') {
      const { email, reason } = req.body || {};
      if (!email) return res.status(400).json({ error: 'email required.' });
      const target = email.toLowerCase();

      // Authorisation — admin token, or a session whose email matches the target.
      let authorised = isAuthorizedAdmin(req);
      if (!authorised) {
        const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
        if (token) {
          const anon = createClient(process.env.SUPABASE_URL, ANON_KEY);
          const { data: { user } } = await anon.auth.getUser(token);
          if (user?.email && user.email.toLowerCase() === target) authorised = true;
        }
      }
      if (!authorised) {
        return res.status(403).json({ error: 'You can only remove your own profile.' });
      }

      const now = new Date().toISOString();
      const tombstone = `removed_${Date.now()}@deleted`;

      // 1. Legacy talent candidate.
      await supabase.from('talent_candidates').update({
        status: 'archived',
        removal_requested_at: now,
        removal_reason: reason || 'User requested removal',
        first_name: '[REMOVED]',
        email: tombstone,
        phone: null,
        answers: {},
      }).eq('email', target);

      // 2. Executive (fed) profile — scrub identity + rich personal content.
      await supabase.from('fed_profiles').update({
        status: 'removed',
        visibility: 'private',
        first_name: '[REMOVED]', last_name: '', email: tombstone,
        linkedin_url: null, current_company: null, current_title: null,
        career_timeline: null, achievements: null, big_five: null,
        candidate_operating_profile: null, candidate_preferences: null,
        candidate_scope: null,
      }).eq('email', target);

      // 3. Related match rows lose the candidate identifier.
      await supabase.from('fed_matches')
        .update({ candidate_email: tombstone, status: 'closed' })
        .eq('candidate_email', target);

      // 4. Notifications addressed to the user (contain personal context).
      await supabase.from('fed_notifications').delete().eq('recipient_email', target);
      await supabase.from('talent_notifications').delete().eq('recipient_email', target);

      return res.status(200).json({ success: true, message: 'Profile and associated personal data removed per your request.' });
    }

    // ── RUN re-engagement job (cron / admin only) ─────────────
    if (req.method === 'POST' && action === 'reengagement-job') {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
      const results = await runReengagementJob();
      return res.status(200).json({ success: true, results });
    }

    return res.status(404).json({ error: 'Unknown action.' });

  } catch (err) {
    console.error('talent-candidates error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
