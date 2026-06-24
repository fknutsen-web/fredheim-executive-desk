// api/compute-matches.js
//
// Computes or refreshes match scores between all active candidates and a
// recruiter's job posts. Called when a recruiter opens their dashboard or
// when a new job is published. Uses service role to read all active profiles.
//
// Scoring philosophy (post-scope migration):
//
//   Trovant's primary matching signal is operational scope and complexity —
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
const { createNotifications } = require('./lib/notifications');

// A candidate is hidden from their current employer and any blocked company.
// Case-insensitive, bidirectional substring match so "ABS" matches "ABS Group"
// and "Cobelfret NV" matches "cobelfret".
function isEmployerBlocked(candidate, firmName) {
  if (!firmName) return false;
  const firm = String(firmName).toLowerCase().trim();
  if (!firm) return false;
  const blockList = [];
  if (candidate.current_company) blockList.push(String(candidate.current_company).toLowerCase().trim());
  if (Array.isArray(candidate.blocked_companies)) {
    for (const c of candidate.blocked_companies) if (c) blockList.push(String(c).toLowerCase().trim());
  }
  return blockList.some(b => b && (firm.includes(b) || b.includes(firm)));
}

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
      .select('id, title, industry, function, location, salary_min, salary_max, firm_email, firm_name, role_scope_requirements, required_leadership_class, required_complexity_class')
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
      .select('email, industry, function, location, salary_min, visibility, privacy_fully_private, current_company, blocked_companies, candidate_scope, scope_score, complexity_score, strategic_score, commercial_score, leadership_class, complexity_class, equivalent_label, industrial_translator')
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

        // CONFIDENTIALITY: a candidate is invisible to their own current
        // employer and to any company on their blocked list. The match is
        // never created, so the candidate simply does not exist to that firm.
        if (isEmployerBlocked(candidate, job.firm_name)) continue;

        const key = `${job.id}::${candidate.email.toLowerCase()}`;
        if (existingSet.has(key)) continue;

        const { score, reasons, dimensions } = computeMatchScore(candidate, job);
        if (score < MIN_SCORE) continue;

        toInsert.push({
          job_id:          job.id,
          candidate_email: candidate.email.toLowerCase(),
          recruiter_email: recruiterEmail,
          match_score:     score,
          // Per-dimension breakdown is carried inside match_reasons under a
          // reserved __dimensions key so the front end can render score bars
          // without a schema migration. getMatchConfidence and the reason-tag
          // UI read named keys only, so the extra array is inert to them.
          match_reasons:   { ...reasons, __dimensions: dimensions },
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
          recipientEmail: recruiterEmail,
          role:           'recruiter',
          type:           'new_candidate_match',
          jobId:          jobId,
          title:          `${count} new candidate match${count > 1 ? 'es' : ''} — ${job?.title || 'role'}`,
          body:           `${count} candidate profile${count > 1 ? 's' : ''} now match your ${job?.title || 'role'} search.`,
        };
      });
      await createNotifications(db, summaryNotifs);
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
  let functionPts = 0;
  if (candidate?.function && job?.function) {
    if (candidate.function.toLowerCase() === job.function.toLowerCase()) {
      functionPts = 15; reasons.function = true;
    } else {
      reasons.function = false;
    }
  } else { functionPts = 7; reasons.function = null; }
  score += functionPts;

  // ── 4. INDUSTRY ADJACENCY (15 pts) — adjacency-tolerant ────────────────
  let industryPts = 0;
  if (candidate?.industry && job?.industry) {
    const cI = candidate.industry.toLowerCase();
    const jI = job.industry.toLowerCase();
    const cW = cI.split(/[\s&,]+/);
    const jW = jI.split(/[\s&,]+/);
    const overlap = cW.some(w => w.length > 3 && jW.some(jw => jw.length > 3 && (jw.includes(w) || w.includes(jw))));
    if (overlap || cI === jI) {
      industryPts = 15; reasons.industry = true;
    } else {
      // Industrial cross-sector adjacency: maritime ↔ logistics ↔ industrial
      // are adjacent. Award partial credit.
      const industrialKeywords = ['maritime','shipping','port','terminal','logistics','industrial','energy','offshore','commodity','trading','supply','chain'];
      const cInd = industrialKeywords.some(k => cI.includes(k));
      const jInd = industrialKeywords.some(k => jI.includes(k));
      if (cInd && jInd) { industryPts = 8; reasons.industry = 'adjacent'; }
      else              {                  reasons.industry = false;       }
    }
  } else { industryPts = 7; reasons.industry = null; }
  score += industryPts;

  // -- 5. COMPENSATION (10 pts) with structured Min/Target/Ceiling framework -
  // Reads the schema-aligned comp_floor / comp_target_low / comp_target_high /
  // comp_exceptional_ceiling / comp_negotiability from job.intake when
  // available, and the candidate's candidate_operating_profile.compensation
  // (minimum_base / target_base / desired_total / flexibility). Emits a
  // qualitative comp_alignment flag in addition to numeric score adjustment.
  //   clear_alignment         - candidate floor inside job target band
  //   candidate_may_stretch    - above target but reachable at ceiling, with
  //                              recruiter or candidate flexibility
  //   possible_gap             - above target, no flexibility
  //   material_mismatch         - above the exceptional ceiling
  //   recruiter_below_market    - ceiling clearly below market for the class
  const _op = candidate?.candidate_operating_profile || {};
  const _comp = _op.compensation || {};
  const _intake = job?.intake || (job?.role_scope_requirements && job.role_scope_requirements.intake) || {};
  function parseUSD(s) {
    if (s == null || s === '') return NaN;
    const str = String(s).toLowerCase().replace(/[\s,]/g,'');
    const n = parseFloat(str.replace(/[^0-9.km]/g,''));
    if (!Number.isFinite(n)) return NaN;
    if (str.includes('m')) return n * 1000000;
    if (str.includes('k')) return n * 1000;
    return n;
  }
  const candFloorMin = parseUSD(_comp.minimum_base) || candidate?.salary_min;
  const candTarget   = parseUSD(_comp.target_base);
  const candTotal    = parseUSD(_comp.desired_total);
  const candFlex     = _comp.flexibility || '';
  const candSoft     = candFlex === 'highly_flexible' || candFlex === 'open_exceptional' || candFlex === 'depends_package';
  const jobFloor       = parseUSD(_intake.comp_floor)              || job?.salary_min;
  const jobTargetLow   = parseUSD(_intake.comp_target_low);
  const jobTargetHigh  = parseUSD(_intake.comp_target_high)         || job?.salary_max;
  const jobCeiling     = parseUSD(_intake.comp_exceptional_ceiling) || jobTargetHigh;
  const jobNeg         = _intake.comp_negotiability || '';
  const recOpen        = jobNeg === 'highly_flexible' || jobNeg === 'open_exceptional' || jobNeg === 'equity_ltip_adjust';

  const _scoreBeforeComp = score;
  if (Number.isFinite(candFloorMin) && Number.isFinite(jobTargetHigh)) {
    if (candFloorMin <= jobTargetHigh) {
      score += 10; reasons.salary = true; reasons.comp_alignment = 'clear_alignment';
    } else if (Number.isFinite(jobCeiling) && candFloorMin <= jobCeiling) {
      if (recOpen || candSoft) {
        score += 7; reasons.salary = 'stretch'; reasons.comp_alignment = 'candidate_may_stretch';
      } else {
        score += 3; reasons.salary = false; reasons.comp_alignment = 'possible_gap';
      }
    } else {
      reasons.salary = false; reasons.comp_alignment = 'material_mismatch';
    }
    // Recruiter-below-market signal (intelligence, not punitive)
    if (job.required_leadership_class === 'c_suite' && Number.isFinite(jobCeiling) && jobCeiling < 250000) {
      reasons.comp_alignment_note = 'recruiter_below_market';
    }
    if (Number.isFinite(candTotal) && Number.isFinite(jobCeiling) && candTotal > jobCeiling * 1.4) {
      reasons.comp_alignment_note = 'recruiter_below_market';
    }
  } else {
    score += 10; reasons.salary = null; reasons.comp_alignment = 'insufficient_data';
  }
  const compPts = score - _scoreBeforeComp;

  // ── 6. LOCATION (5 pts) ────────────────────────────────────────────────
  let locationPts = 0;
  if (job?.location && candidate?.location) {
    const jL = job.location.toLowerCase();
    const cL = candidate.location.toLowerCase();
    if (jL.includes('remote') || jL.includes('global') ||
        cL.includes(jL.split(',')[0].trim().substring(0,5)) ||
        jL.includes(cL.split(',')[0].trim().substring(0,5))) {
      locationPts = 5; reasons.location = true;
    } else { reasons.location = false; }
  } else { locationPts = 5; reasons.location = null; }
  score += locationPts;

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

  // ── 9. SCHEMA-ALIGNED INTAKE OVERLAY (additive, capped at +/- 8 pts) ───
  // When the role was posted through the 8-step IntakeWorkflow the job has
  // an `intake` JSONB with environment_tags, leadership_tags, complexity_tags,
  // and a requirement_priority matrix. Use these to refine the score with
  // direct culture / leadership / complexity overlap signals. Backward-
  // compatible: jobs without an intake skip this entire block.
  const intake = job.intake || (job.role_scope_requirements && job.role_scope_requirements.intake) || null;
  if (intake) {
    const candTags = (() => {
      const s = candidate.candidate_scope || {};
      const tags = new Set();
      // Project candidate strategic/complexity flags into intake-style tags
      // so single-source-of-truth tag comparison works.
      if (s.complexity && s.complexity.multi_site)          tags.add('Multi-site operations');
      if (s.complexity && s.complexity.industrial_24_7)     tags.add('24/7 operations');
      if (s.complexity && s.complexity.regulated)           tags.add('Regulated environment');
      if (s.complexity && s.complexity.union_environment)   tags.add('Union environment');
      if (s.strategic  && s.strategic.greenfield)           tags.add('Greenfield startup');
      if (s.strategic  && s.strategic.turnaround)           tags.add('Turnaround');
      if (s.strategic  && s.strategic.transformation)       tags.add('Operational transformation');
      if (s.strategic  && s.strategic.erp_implementation)   tags.add('ERP implementation');
      return tags;
    })();

    const overlap = (jobList, candSet) => {
      if (!Array.isArray(jobList) || jobList.length === 0) return null;
      const hits = jobList.filter(t => candSet.has(t)).length;
      return hits / jobList.length;
    };

    // Complexity overlap (up to +4 / -2)
    const complexityOverlap = overlap(intake.complexity_tags, candTags);
    if (complexityOverlap !== null) {
      if (complexityOverlap >= 0.6) { score += 4; reasons.complexity_tags = true; }
      else if (complexityOverlap > 0) { score += 2; reasons.complexity_tags = 'partial'; }
      else { score -= 2; reasons.complexity_tags = false; }
    }

    // Requirement priority matrix - must-have items act as a soft floor:
    // when the candidate clearly lacks a must-have, mark a reason; the
    // matcher continues to score but the front end can label the gap.
    const priority = intake.requirement_priority || {};
    const mustHaves = Object.keys(priority).filter(k => priority[k] === 'must_have');
    if (mustHaves.length) {
      const candScope = candidate.candidate_scope || {};
      const lacks = [];
      mustHaves.forEach(k => {
        if (k === 'international_exposure' && !(candScope.complexity && candScope.complexity.international)) lacks.push(k);
        if (k === 'leadership_scope' && job.required_leadership_class && candidate.leadership_class) {
          const cIdx = classIndex(LEADERSHIP_ORDER, candidate.leadership_class);
          const rIdx = classIndex(LEADERSHIP_ORDER, job.required_leadership_class);
          if (cIdx < rIdx) lacks.push(k);
        }
      });
      if (lacks.length) {
        reasons.must_have_gaps = lacks;
        score -= Math.min(8, lacks.length * 3);
      } else {
        reasons.must_have_satisfied = true;
      }
    }
  }

  // -- 10. CANDIDATE OPERATING PROFILE OVERLAY (additive, capped at +/- 10) -
  // When the candidate has filled the schema-driven operating profile, the
  // matcher refines the score using career intent, environment fit, leadership
  // style overlap, avoidance signals, and industry adjacency. Backward-
  // compatible: candidates without an operating profile skip this block.
  const op = candidate.candidate_operating_profile || null;
  const jobIntake = intake; // already resolved above
  if (op) {
    // Leadership-style overlap (recruiter tags vs candidate tags - identical
    // string pools by design, see CANDIDATE_LEADERSHIP_TAGS).
    if (jobIntake && Array.isArray(jobIntake.leadership_tags) && Array.isArray(op.leadership_style)) {
      const candSet = new Set(op.leadership_style);
      const hits = jobIntake.leadership_tags.filter(t => candSet.has(t)).length;
      if (jobIntake.leadership_tags.length > 0) {
        const overlap = hits / jobIntake.leadership_tags.length;
        if (overlap >= 0.6) { score += 4; reasons.leadership_style_fit = true; }
        else if (overlap > 0) { score += 2; reasons.leadership_style_fit = 'partial'; }
        else { reasons.leadership_style_fit = false; }
      }
    }

    // Environment fit - did the candidate flag this role's environment as
    // a place they perform best, or a place they want to avoid?
    if (jobIntake && Array.isArray(jobIntake.environment_tags)) {
      const preferred = new Set(op.environment_preferred || []);
      const avoid     = new Set(op.environment_avoid || []);
      const tagMatch = (recTag, candSet) => {
        // Loose match - "PE-Backed" matches "PE-Backed" exactly in both lists.
        return jobIntake.environment_tags.some(t => candSet.has(t));
      };
      if (tagMatch(null, preferred)) { score += 3; reasons.environment_fit = true; }
      if (tagMatch(null, avoid))     { score -= 4; reasons.environment_avoid = true; }
    }

    // Role avoidance - the candidate's general avoidance list reduces score
    // when the role's intake matches (e.g. "Heavy travel" + travel_pct > 50).
    if (Array.isArray(op.role_avoidance) && op.role_avoidance.length) {
      const avoidSet = new Set(op.role_avoidance);
      const travel = jobIntake ? parseInt(jobIntake.travel_pct, 10) : NaN;
      if (avoidSet.has('Heavy travel') && Number.isFinite(travel) && travel >= 50) {
        score -= 5; reasons.role_avoidance = 'heavy_travel';
      }
      if (avoidSet.has('Relocation') && jobIntake && jobIntake.relocation_required === 'yes') {
        score -= 5; reasons.role_avoidance = 'relocation';
      }
      if (avoidSet.has('Union environment') && Array.isArray(jobIntake?.complexity_tags)
          && jobIntake.complexity_tags.includes('Union environment')) {
        score -= 4; reasons.role_avoidance = 'union';
      }
      if (avoidSet.has('Startup chaos') && Array.isArray(jobIntake?.environment_tags)
          && jobIntake.environment_tags.includes('Startup')) {
        score -= 3; reasons.role_avoidance = 'startup';
      }
    }

    // Industry adjacency - core/adjacent/willing all count, excluded blocks.
    if (job.industry) {
      const jIndustryLower = job.industry.toLowerCase();
      const inSet = (arr) => Array.isArray(arr) && arr.some(t => t.toLowerCase() === jIndustryLower
                                                              || jIndustryLower.includes(t.toLowerCase())
                                                              || t.toLowerCase().includes(jIndustryLower));
      if (inSet(op.excluded_industries)) { score -= 10; reasons.industry_excluded = true; }
      else if (inSet(op.core_industries))     reasons.industry_core = true;
      else if (inSet(op.adjacent_industries)) reasons.industry_adjacent = true;
      else if (inSet(op.willing_industries))  reasons.industry_willing = true;
    }

    // Compensation alignment - structured Min / Target / Exceptional vs.
    // candidate Min / Target / Desired Total + flexibility. Produces a
    // human-readable alignment label that the front end displays.
    const comp = op.compensation || {};
    const parseNum = (s) => {
      if (s == null) return NaN;
      const n = parseInt(String(s).replace(/[^0-9]/g,''), 10);
      return Number.isFinite(n) ? n : NaN;
    };
    const candMin    = parseNum(comp.minimum_base);
    const candTarget = parseNum(comp.target_base);
    const flex       = comp.flexibility || '';
    const jobFloor   = parseNum(job.comp_floor);
    const jobLow     = parseNum(job.comp_target_low);
    const jobHigh    = parseNum(job.comp_target_high);
    const jobCeiling = parseNum(job.comp_exceptional_ceiling);
    const negotiable = ['flexible','highly_flexible','dependent_on_scope','equity_ltip_adjust','open_exceptional'].includes(job.comp_negotiability);

    let compAlignment = null;
    let compBlurb = null;
    if (Number.isFinite(candMin) && (Number.isFinite(jobHigh) || Number.isFinite(jobCeiling))) {
      const effectiveCeiling = Number.isFinite(jobCeiling) ? jobCeiling : jobHigh;
      const candCenter = Number.isFinite(candTarget) ? candTarget : candMin;

      if (Number.isFinite(jobLow) && candCenter >= jobLow && candCenter <= (Number.isFinite(jobHigh) ? jobHigh : effectiveCeiling)) {
        compAlignment = 'aligned';
        compBlurb = 'Clear compensation alignment';
        score += 6;
      } else if (Number.isFinite(jobHigh) && candCenter > jobHigh && candCenter <= effectiveCeiling) {
        compAlignment = 'stretch';
        compBlurb = 'Candidate may stretch for exceptional role';
        score += 3;
      } else if (Number.isFinite(effectiveCeiling) && candMin > effectiveCeiling) {
        const gapPct = ((candMin - effectiveCeiling) / effectiveCeiling) * 100;
        if (gapPct >= 30) {
          compAlignment = 'material_mismatch';
          compBlurb = 'Material compensation mismatch';
          score -= 8;
        } else {
          compAlignment = 'possible_gap';
          compBlurb = negotiable ? 'Possible compensation gap - role is flagged negotiable' : 'Possible compensation gap';
          score -= negotiable ? 2 : 5;
        }
      } else if (Number.isFinite(jobFloor) && candMin < jobFloor) {
        compAlignment = 'below_market';
        compBlurb = 'Recruiter compensation may be below market for required scope';
        score += 1; // candidate benefits but flag to recruiter
      }
      if (['highly_flexible','open_exceptional'].includes(flex) && compAlignment === 'possible_gap') {
        compAlignment = 'aligned';
        compBlurb = 'Compensation gap offset by candidate flexibility';
        score += 4;
      }
    } else if (job.salary_max && Number.isFinite(candMin) && candMin > job.salary_max) {
      // Legacy fallback when only old salary_max is present
      score -= 6; compAlignment = 'possible_gap'; compBlurb = 'Possible compensation gap';
    } else if (Number.isFinite(candMin)) {
      compAlignment = 'aligned'; compBlurb = 'Compensation aligned';
    }
    if (compAlignment) {
      reasons.comp_alignment = compAlignment;
      reasons.comp_alignment_blurb = compBlurb;
      reasons.comp_fit = compAlignment === 'aligned' || compAlignment === 'stretch';
    }

    // Career intent compatibility - a permanent role for a candidate who
    // signaled only Consultant/Advisor intent is a noisy match. Convert to
    // a small negative weight rather than a hard filter.
    if (Array.isArray(op.career_intent) && op.career_intent.length) {
      const wantsPerm = op.career_intent.includes('permanent_executive')
                    || op.career_intent.includes('operational_leader')
                    || op.career_intent.includes('growth_builder');
      if (!wantsPerm && jobIntake) score -= 4;
    }
  }

  // HARD GUARD: Block matches where candidate is more than two leadership
  // tiers below requirement. These introductions destroy recruiter trust
  // more than they create candidate optionality.
  if (job.required_leadership_class && candidate.leadership_class) {
    const cIdx = classIndex(LEADERSHIP_ORDER, candidate.leadership_class);
    const rIdx = classIndex(LEADERSHIP_ORDER, job.required_leadership_class);
    if (cIdx >= 0 && rIdx >= 0 && cIdx < rIdx - 2) {
      return { score: 0, reasons: { ...reasons, scope: false }, dimensions: [] };
    }
  }

  // Per-dimension breakdown for the recruiter score ring + bars. Covers the
  // six fixed-weight dimensions (95 of the 100 base pts); the remaining
  // additive overlays/bonuses live only in the composite match_score.
  const dimensions = [
    { key: 'scope',      label: 'Scope',      earned: Math.round(scopeCredit.pts),      max: 30 },
    { key: 'complexity', label: 'Complexity', earned: Math.round(complexityCredit.pts), max: 20 },
    { key: 'function',   label: 'Function',   earned: Math.round(functionPts),          max: 15 },
    { key: 'industry',   label: 'Industry',   earned: Math.round(industryPts),          max: 15 },
    { key: 'comp',       label: 'Comp',       earned: Math.round(compPts),              max: 10 },
    { key: 'location',   label: 'Location',   earned: Math.round(locationPts),          max: 5  },
  ];

  return { score: Math.min(100, Math.max(0, Math.round(score))), reasons, dimensions };
}
// (scoring helpers above; notifications centralized via ./lib/notifications)
