// api/compute-matches.js
//
// Computes or refreshes match scores between all active candidates and a
// recruiter's job posts. Called when a recruiter opens their dashboard or
// when a new job is published. Uses service role to read all active profiles.
//
// Scoring philosophy (post-scope migration):
//
//   Fredheim's primary matching signal is operational scope and complexity —
//   not title, not industry. Titles in maritime, logistics, terminals,
//   manufacturing, and industrial environments are inconsistent. Operational
//   scope is not. This matcher reflects that ordering of evidence:
//
//   30 pts  Operational scope match (leadership class alignment)
//   20 pts  Operational complexity match
//   15 pts  Functional discipline
//   15 pts  Industry — adjacency-tolerant, not strict
//   10 pts  Compensation alignment
//    5 pts  Location
//    5 pts  Strategic responsibility bonus
//   ─────
//  100 pts
//
//   Industry is adjacency-tolerant because the explicit thesis of the
//   platform is that scope and complexity transfer across industrial
//   verticals — a multi-site greenfield startup leader in terminals is a
//   credible candidate for the same scope in cement.
//
//   `reasons` returned to the front end is consumed by getMatchConfidence.
//   Each scoring dimension produces a true | false | null reason:
//     true  = aligned
//     false = misaligned (gap will be surfaced to candidate / recruiter)
//     null  = data unavailable (treated as unknown — neither pass nor fail)

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
    // Load this recruiter's active jobs, including scope requirements
    const { data: jobs, error: jErr } = await db
      .from('fed_jobs')
      .select('id, title, industry, function, location, salary_min, salary_max, firm_email, role_scope_requirements, required_leadership_class, required_complexity_class')
      .ilike('firm_email', recruiterEmail)
      .eq('status', 'active')
      .eq('demo_post', false);

    if (jErr) throw jErr;
    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ ok: true, matches_created: 0, message: 'No active jobs.' });
    }

    // Load all candidate profiles, including derived scope classification
    const { data: candidates, error: cErr } = await db
      .from('fed_profiles')
      .select('email, industry, function, location, salary_min, visibility, privacy_fully_private, candidate_scope, scope_score, complexity_score, strategic_score, commercial_score, leadership_class, complexity_class, equivalent_label, industrial_translator')
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

    const toInsert = [];

    for (const job of jobs) {
      for (const candidate of candidates) {
        if (candidate.email.toLowerCase() === recruiterEmail) continue;

        const key = `${job.id}::${candidate.email.toLowerCase()}`;
        if (existingSet.has(key)) continue;

        const { score, reasons } = computeMatchScore(candidate, job);
        if (score < MIN_SCORE) continue;

        toInsert.push({
          job_id:          job.id,
          candidate_email: candidate.email.toLowerCase(),
          recruiter_email: recruiterEmail,
          match_score:     score,
          match_reasons:   reasons,
          status:          'matched',
          // Denormalized candidate classification — surfaced on recruiter card
          // without requiring a join. This is the platform's signature output:
          // a recruiter sees "Director-level scope, High complexity" alongside
          // the anonymized identity instead of a job title that may be misleading.
          candidate_equivalent_label: candidate.equivalent_label || null,
          candidate_leadership_class: candidate.leadership_class || null,
          candidate_complexity_class: candidate.complexity_class || null,
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

    // Notifications — one summary per job, not per match
    if (created > 0) {
      const byJob = {};
      toInsert.forEach(m => { byJob[m.job_id] = (byJob[m.job_id] || 0) + 1; });
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


// ── MATCH SCORING ────────────────────────────────────────────────────────────
// Mirrors the client-side `computeMatchScore` in src/main.jsx for the metrics
// the API needs. The full client-side scorer also reads candidate_preferences
// (work arrangement, mandate, etc.). For the v1 scope cut, server-side scoring
// uses scope/complexity as the dominant signal and treats preferences as
// soft modifiers added later.
//
// Ordering of leadership classes — used for class-distance scoring.
const LEADERSHIP_ORDER = [
  'manager','senior_manager','director','senior_director',
  'vp','svp','evp','c_suite',
];
const COMPLEXITY_ORDER = ['low','moderate','high','very_high'];

function classIndex(order, value) {
  if (!value) return -1;
  return order.indexOf(value);
}

// 0 distance = exact match (full credit). Each step away halves the credit
// to a floor of 0. Going UP (candidate above required) is full credit;
// going DOWN (candidate below required) is penalized.
function classMatchCredit(candidateClass, requiredClass, order, fullPts) {
  if (!requiredClass) return { pts: fullPts * 0.5, status: null }; // no requirement set — neutral
  if (!candidateClass) return { pts: 0, status: null };            // candidate has no data
  const cIdx = classIndex(order, candidateClass);
  const rIdx = classIndex(order, requiredClass);
  if (cIdx < 0 || rIdx < 0) return { pts: 0, status: null };

  if (cIdx === rIdx)       return { pts: fullPts,        status: true  };
  if (cIdx >  rIdx)        return { pts: fullPts * 0.9,  status: true  }; // candidate exceeds — still a strong fit
  if (cIdx === rIdx - 1)   return { pts: fullPts * 0.6,  status: true  }; // one tier below — stretch but credible
  if (cIdx === rIdx - 2)   return { pts: fullPts * 0.3,  status: false }; // two tiers below — gap
  return                          { pts: 0,              status: false };
}

function computeMatchScore(candidate, job) {
  let score = 0;
  const reasons = {};

  // ── 1. OPERATIONAL SCOPE (30 pts) — dominant signal ────────────────────
  const scopeCredit = classMatchCredit(
    candidate.leadership_class,
    job.required_leadership_class,
    LEADERSHIP_ORDER,
    30,
  );
  score += scopeCredit.pts;
  reasons.scope = scopeCredit.status;

  // ── 2. OPERATIONAL COMPLEXITY (20 pts) ─────────────────────────────────
  const complexityCredit = classMatchCredit(
    candidate.complexity_class,
    job.required_complexity_class,
    COMPLEXITY_ORDER,
    20,
  );
  score += complexityCredit.pts;
  reasons.complexity = complexityCredit.status;

  // ── 3. FUNCTIONAL DISCIPLINE (15 pts) ──────────────────────────────────
  if (candidate?.function && job?.function) {
    if (candidate.function.toLowerCase() === job.function.toLowerCase()) {
      score += 15; reasons.function = true;
    } else {
      reasons.function = false;
    }
  } else { score += 7; reasons.function = null; }

  // ── 4. INDUSTRY ADJACENCY (15 pts) — adjacency-tolerant ────────────────
  if (candidate?.industry && job?.industry) {
    const cI = candidate.industry.toLowerCase();
    const jI = job.industry.toLowerCase();
    const cW = cI.split(/[\s&,]+/);
    const jW = jI.split(/[\s&,]+/);
    const overlap = cW.some(w => w.length > 3 && jW.some(jw => jw.length > 3 && (jw.includes(w) || w.includes(jw))));
    if (overlap || cI === jI) {
      score += 15; reasons.industry = true;
    } else {
      // Industrial cross-sector adjacency: maritime ↔ logistics ↔ industrial
      // are adjacent. Award partial credit.
      const industrialKeywords = ['maritime','shipping','port','terminal','logistics','industrial','energy','offshore'];
      const cInd = industrialKeywords.some(k => cI.includes(k));
      const jInd = industrialKeywords.some(k => jI.includes(k));
      if (cInd && jInd) { score += 8; reasons.industry = 'adjacent'; }
      else              {              reasons.industry = false;       }
    }
  } else { score += 7; reasons.industry = null; }

  // ── 5. COMPENSATION (10 pts) ───────────────────────────────────────────
  if (candidate?.salary_min && job?.salary_max && job.salary_max > 0) {
    if (candidate.salary_min <= job.salary_max) {
      score += 10; reasons.salary = true;
    } else { reasons.salary = false; }
  } else { score += 10; reasons.salary = null; }

  // ── 6. LOCATION (5 pts) ────────────────────────────────────────────────
  if (job?.location && candidate?.location) {
    const jL = job.location.toLowerCase();
    const cL = candidate.location.toLowerCase();
    if (jL.includes('remote') || jL.includes('global') ||
        cL.includes(jL.split(',')[0].trim().substring(0,5)) ||
        jL.includes(cL.split(',')[0].trim().substring(0,5))) {
      score += 5; reasons.location = true;
    } else { reasons.location = false; }
  } else { score += 5; reasons.location = null; }

  // ── 7. STRATEGIC RESPONSIBILITY BONUS (up to 5 pts) ────────────────────
  // Candidates with strong strategic depth get a credibility lift even when
  // not explicitly required by the role. This is the "hidden upside" that
  // recruiters value but rarely write into the spec.
  if (typeof candidate.strategic_score === 'number') {
    const bonus = Math.round((candidate.strategic_score / 100) * 5);
    score += bonus;
    if (candidate.strategic_score >= 50) reasons.strategic = true;
  }

  // ── 8. COMMERCIAL & TECHNICAL FLUENCY (up to 10 pts, conditional) ──────
  // Only meaningful when the role is in an industrial-technology vertical
  // OR when the role explicitly requires revenue-model / sales-motion /
  // technical-fluency attributes. For traditional operational roles this
  // dimension is silent — we don't want to reward SaaS background on a
  // terminal-operations role where it doesn't matter.
  const TECH_VERTICAL_KEYWORDS = [
    'technology','saas','intelligence','automation','ai',
    'analytics','digital','platform','software',
  ];
  const jobIndustryLower = (job.industry || '').toLowerCase();
  const isTechVertical   = TECH_VERTICAL_KEYWORDS.some(kw => jobIndustryLower.includes(kw));

  const roleReqs        = job.role_scope_requirements || {};
  const reqRevenue      = Array.isArray(roleReqs.required_revenue_models)    ? roleReqs.required_revenue_models    : [];
  const reqMotion       = Array.isArray(roleReqs.required_sales_motions)     ? roleReqs.required_sales_motions     : [];
  const reqTech         = Array.isArray(roleReqs.required_technical_fluency) ? roleReqs.required_technical_fluency : [];
  const hasCommercialRequirements = reqRevenue.length || reqMotion.length || reqTech.length;

  if (isTechVertical || hasCommercialRequirements) {
    const candScope      = candidate.candidate_scope || {};
    const candCommercial = candScope.commercial || {};
    const candRev        = Array.isArray(candCommercial.revenue_models)    ? candCommercial.revenue_models    : [];
    const candMotion     = Array.isArray(candCommercial.sales_motions)     ? candCommercial.sales_motions     : [];
    const candTech       = Array.isArray(candCommercial.technical_fluency) ? candCommercial.technical_fluency : [];

    let commercialPts = 0;

    // Industrial-translator bonus. The cross-functional pattern that
    // industrial-tech companies cannot find through generic SaaS recruiters.
    if (candidate.industrial_translator && isTechVertical) {
      commercialPts += 5;
      reasons.industrial_translator = true;
    }

    // Requirement overlap. Proportional credit up to 5 pts when the role
    // specifies required commercial attributes and the candidate satisfies them.
    if (hasCommercialRequirements) {
      const tally = (req, cand) => req.length === 0 ? null
        : req.filter(r => cand.includes(r)).length / req.length;
      const revOverlap    = tally(reqRevenue, candRev);
      const motionOverlap = tally(reqMotion,  candMotion);
      const techOverlap   = tally(reqTech,    candTech);
      const overlaps      = [revOverlap, motionOverlap, techOverlap].filter(v => v !== null);
      const avgOverlap    = overlaps.length ? overlaps.reduce((a,b)=>a+b,0) / overlaps.length : 0;
      commercialPts += Math.round(avgOverlap * 5);
      reasons.commercial_fit = avgOverlap >= 0.6 ? true : avgOverlap > 0 ? 'partial' : false;
    } else if (isTechVertical) {
      // Tech vertical but no explicit requirements. Award credit for
      // having any meaningful commercial signal at all (commercial_score).
      const cs = typeof candidate.commercial_score === 'number' ? candidate.commercial_score : 0;
      commercialPts += Math.round((cs / 100) * 5);
      if (cs >= 40) reasons.commercial_fit = true;
    }

    score += Math.min(10, commercialPts);
  }

  // HARD GUARD: Block matches where candidate is more than two leadership
  // tiers below requirement. These introductions destroy recruiter trust
  // more than they create candidate optionality.
  if (job.required_leadership_class && candidate.leadership_class) {
    const cIdx = classIndex(LEADERSHIP_ORDER, candidate.leadership_class);
    const rIdx = classIndex(LEADERSHIP_ORDER, job.required_leadership_class);
    if (cIdx >= 0 && rIdx >= 0 && cIdx < rIdx - 2) {
      return { score: 0, reasons: { ...reasons, scope: false } };
    }
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}
