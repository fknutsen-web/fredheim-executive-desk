// api/compute-matches.js
// Computes or refreshes match scores between all active candidates and a recruiter's job posts.
// Called when a recruiter opens their dashboard or when a new job is published.
// Uses service role to read all active candidate profiles.
// Only creates match records for candidates with active profiles and score >= MIN_SCORE.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';
const MIN_SCORE = 40; // minimum score to create a match record

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  // Validate caller — must be the recruiter whose jobs we're computing
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required.' });

  const anonClient = createClient(process.env.SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return res.status(403).json({ error: 'Invalid session.' });

  const recruiterEmail = user.email.toLowerCase();

  try {
    // Load this recruiter's active jobs
    const { data: jobs, error: jErr } = await db
      .from('fed_jobs')
      .select('id, title, industry, function, location, salary_min, salary_max, firm_email')
      .ilike('firm_email', recruiterEmail)
      .eq('status', 'active')
      .eq('demo_post', false);

    if (jErr) throw jErr;
    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ ok: true, matches_created: 0, message: 'No active jobs.' });
    }

    // Load all active candidate profiles (service role reads all)
    const { data: candidates, error: cErr } = await db
      .from('fed_profiles')
      .select('email, industry, function, location, salary_min, visibility, privacy_fully_private')
      .not('email', 'is', null);

    if (cErr) throw cErr;
    if (!candidates || candidates.length === 0) {
      return res.status(200).json({ ok: true, matches_created: 0, message: 'No candidate profiles.' });
    }

    // Load existing match records for these jobs to avoid re-creating
    const jobIds = jobs.map(j => j.id);
    const { data: existingMatches } = await db
      .from('fed_matches')
      .select('job_id, candidate_email, status')
      .in('job_id', jobIds);

    const existingSet = new Set(
      (existingMatches || []).map(m => `${m.job_id}::${m.candidate_email.toLowerCase()}`)
    );

    // Compute scores and create new match records
    const toInsert = [];

    for (const job of jobs) {
      for (const candidate of candidates) {
        // Skip recruiter's own email if they also have a profile
        if (candidate.email.toLowerCase() === recruiterEmail) continue;

        const key = `${job.id}::${candidate.email.toLowerCase()}`;
        if (existingSet.has(key)) continue; // already have a match record for this pair

        const { score, reasons } = computeMatchScore(candidate, job);
        if (score < MIN_SCORE) continue; // below threshold — don't surface this match

        toInsert.push({
          job_id:          job.id,
          candidate_email: candidate.email.toLowerCase(),
          recruiter_email: recruiterEmail,
          match_score:     score,
          match_reasons:   reasons,
          status:          'matched',
        });
      }
    }

    // Batch insert in chunks of 100
    let created = 0;
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const { error: iErr } = await db
        .from('fed_matches')
        .insert(chunk, { ignoreDuplicates: true });
      if (iErr) console.error('Batch insert error:', iErr.message);
      else created += chunk.length;
    }

    // Also create new_candidate_match notifications for new matches
    if (created > 0) {
      const notifInserts = toInsert.map(m => {
        const job = jobs.find(j => j.id === m.job_id);
        return {
          recipient_email: recruiterEmail,
          recipient_role:  'recruiter',
          type:            'new_candidate_match',
          job_id:          m.job_id,
          title:           `New candidate match — ${job?.title || 'role'}`,
          body:            `A new candidate profile matches your ${job?.title || 'role'} search with a ${m.match_score}% compatibility score.`,
        };
      });
      // Only send a summary notification, not one per match (avoid spam)
      if (notifInserts.length > 0) {
        const byJob = {};
        notifInserts.forEach(n => { byJob[n.job_id] = (byJob[n.job_id] || 0) + 1; });
        const summaryNotifs = Object.entries(byJob).map(([jobId, count]) => {
          const job = jobs.find(j => j.id === jobId);
          return {
            recipient_email: recruiterEmail,
            recipient_role:  'recruiter',
            type:            'new_candidate_match',
            job_id:          jobId,
            title:           `${count} new candidate match${count > 1 ? 'es' : ''} — ${job?.title || 'role'}`,
            body:            `${count} candidate profile${count > 1 ? 's' : ''} now match your ${job?.title || 'role'} search.`,
          };
        });
        await db.from('fed_notifications').insert(summaryNotifs);
      }
    }

    return res.status(200).json({
      ok: true,
      jobs_processed: jobs.length,
      candidates_evaluated: candidates.length,
      matches_created: created,
    });

  } catch(e) {
    console.error('compute-matches error:', e);
    return res.status(500).json({ error: e.message || 'Internal error.' });
  }
};

// ── MATCH SCORING (duplicated from match-action.js for independence) ──────────
function computeMatchScore(candidate, job) {
  let score = 0;
  const reasons = {};

  // Industry (40 pts)
  if (candidate?.industry && job?.industry) {
    const cI = candidate.industry.toLowerCase();
    const jI = job.industry.toLowerCase();
    const cW = cI.split(/[\s&,]+/);
    const jW = jI.split(/[\s&,]+/);
    const overlap = cW.some(w => w.length > 3 && jW.some(jw => jw.length > 3 && (jw.includes(w) || w.includes(jw))));
    if (overlap || cI === jI) { score += 40; reasons.industry = true; }
  } else { score += 20; reasons.industry = null; }

  // Function (30 pts)
  if (candidate?.function && job?.function) {
    if (candidate.function.toLowerCase() === job.function.toLowerCase()) { score += 30; reasons.function = true; }
  } else { score += 15; reasons.function = null; }

  // Salary (20 pts)
  if (candidate?.salary_min && job?.salary_max && job.salary_max > 0) {
    if (candidate.salary_min <= job.salary_max) { score += 20; reasons.salary = true; }
    else { reasons.salary = false; }
  } else { score += 20; reasons.salary = null; }

  // Location (10 pts)
  if (job?.location && candidate?.location) {
    const jL = job.location.toLowerCase();
    const cL = candidate.location.toLowerCase();
    if (jL.includes('remote') || jL.includes('global') ||
        cL.includes(jL.split(',')[0].trim().substring(0,5)) ||
        jL.includes(cL.split(',')[0].trim().substring(0,5))) {
      score += 10; reasons.location = true;
    }
  } else { score += 10; reasons.location = null; }

  return { score: Math.min(100, score), reasons };
}
