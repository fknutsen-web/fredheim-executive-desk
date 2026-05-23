import React from "react"
import * as ReactDOM from "react-dom/client"
import * as supabase from "@supabase/supabase-js"

// Compat: existing inline code references `supabase.createClient` and `window.supabase.createClient`
window.supabase = supabase

// ──────────────────────────────────────────────────────────────────────
// Original inline <script type="text/babel"> body follows unchanged
// ──────────────────────────────────────────────────────────────────────


const { useState, useEffect, useMemo, useRef } = React;

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://bizbneqlzacvhekrbrgd.supabase.co';
const SUPABASE_ANON = 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Checkout is created server-side through Vercel API: /api/create-checkout-session.
// Do not load Stripe.js or expose Stripe price IDs in this HTML file.

async function redirectToTierCheckout({ tier, email, showToast }) {
  try {
    const resp = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candidate',   // required by create-checkout-session.js
        tier,
        email,
        origin: window.location.origin,
        path: window.location.pathname,
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.url) {
      console.error('Checkout session failed:', data);
      if (showToast) showToast(data.error || 'Payment redirect failed. Email desk@fredheimtech.com to upgrade.');
      return;
    }

    window.location.href = data.url;
  } catch(e) {
    console.error('Checkout redirect error:', e);
    if (showToast) showToast('Payment redirect failed. Email desk@fredheimtech.com to upgrade.');
  }
}

// ── CONSTANTS ───────────────────────────────────────────────────────────────
// Top-level industry verticals. Operational verticals come first; industrial-
// technology verticals come second. The technology verticals capture the
// growing class of SaaS/IoT/AI companies serving maritime, logistics, and
// industrial operations — a hiring market that generic SaaS recruiters can't
// serve well because they don't understand the operational domain.
const INDUSTRIES  = [
  'All Industries',
  // Operational verticals
  'Maritime & Shipping',
  'Ports & Terminals',
  'Energy & Offshore',
  'Industrial Commodities & Logistics',
  // Industrial-technology verticals
  'Maritime Technology',
  'Port Technology',
  'Logistics Technology',
  'Industrial SaaS',
  'Fleet Intelligence',
  'Operational AI',
  'Industrial Automation',
  'Supply Chain Technology',
  'Compliance & Safety Tech',
];
const FUNCTIONS   = ['All Functions','Commercial','Operations','Chartering','Business Development','Finance','General Management'];
const SALARY_BANDS = [
  { label: 'Any Range', min: 0 },
  { label: '$200K+',    min: 200000 },
  { label: '$300K+',    min: 300000 },
  { label: '$400K+',    min: 400000 },
  { label: '$500K+',    min: 500000 },
];

// ── HELPERS ─────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d} days ago`;
  if (d < 30) return `${Math.floor(d/7)}w ago`;
  return `${Math.floor(d/30)}mo ago`;
}

function parseJson(v) {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v); } catch { return []; }
}

// ── DEMO BANNER ──────────────────────────────────────────────────────────────
// ── LEADERBOARD SECTION ───────────────────────────────────────────────────────
function LeaderboardSection() {
  const [period, setPeriod]         = useState('12m');
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => { fetchLeaderboard(period); }, [period]);

  async function fetchLeaderboard(p) {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/leaderboard?period=${p}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed.');
      setData(json);
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const PERIODS = [['30d','30 Days'],['90d','90 Days'],['12m','12 Months'],['all','All Time']];
  const RANK_LABELS = ['','★','②','③','④','⑤'];

  if (!data && !loading && !error) return null;
  if (data?.leaderboard?.length === 0) return null; // hide if no verified placements yet

  return (
    <div className="leaderboard-section">
      <div className="leaderboard-header">
        <div>
          <div className="leaderboard-title">Top Search Firms</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)',marginTop:'0.25rem'}}>
            Verified platform placements only
          </div>
        </div>
        <div className="leaderboard-filters">
          {PERIODS.map(([v,l]) => (
            <button key={v} className={`leaderboard-filter ${period===v?'active':''}`} onClick={()=>setPeriod(v)}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'2rem',color:'var(--ink-4)'}}><span className="spinner"/></div>
      ) : error ? null : (
        <div className="leaderboard-grid">
          {(data?.leaderboard || []).map((firm, idx) => (
            <div key={idx} className="leaderboard-card">
              <div className={`leaderboard-rank ${idx===0?'gold-rank':''}`}>
                {idx === 0 ? '★' : `${idx+1}`}
              </div>
              <div className="leaderboard-firm">
                <div className="leaderboard-firm-name">{firm.firm_name}</div>
                {firm.industry_focus?.length > 0 && (
                  <div style={{fontSize:'0.75rem',color:'var(--ink-4)'}}>
                    {firm.industry_focus.join(' · ')}
                  </div>
                )}
                <div className="leaderboard-badges">
                  {firm.verified && <span className="trust-badge">Verified Firm</span>}
                  <span className="trust-badge">Platform Placement</span>
                </div>
              </div>
              <div className="leaderboard-count">
                <div className="leaderboard-count-num">{firm.placement_count}</div>
                <div className="leaderboard-count-label">placement{firm.placement_count!==1?'s':''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── COMPENSATION ALIGNMENT ENGINE ────────────────────────────────────────────
// Separate indicator from Role Match Score. Not a "deal score."
// Higher comp request ≠ worse. Lower comp request ≠ better.
// Alignment is driven by value factors, scarcity, and role scope.

const COMP_ALIGN_CATEGORIES = {
  'Below Market':            { css: 'below-market',       label: 'Below Market' },
  'Market Aligned':          { css: 'market-aligned',     label: 'Market Aligned' },
  'Slight Premium':          { css: 'slight-premium',     label: 'Slight Premium' },
  'Premium but Defensible':  { css: 'premium-defensible', label: 'Premium but Defensible' },
  'Out of Range':            { css: 'out-of-range',       label: 'Out of Range' },
  'Insufficient Data':       { css: 'insufficient-data',  label: 'Insufficient Data' },
};

function computeCompAlignment(candidate, job, benchmarks) {
  const prefs = parsePrefs(candidate);
  const reqs  = parseReqs(job);

  // ── DATA AVAILABILITY ─────────────────────────────────────────────────────
  // Primary: candidate target (not just floor), job explicit range
  const candTarget = prefs.comp_target_base || prefs.comp_base_min || candidate?.salary_min || null;
  const jobMin     = reqs.comp_base_min || job?.salary_min || null;
  const jobMax     = reqs.comp_base_max || job?.salary_max || null;

  // Use benchmarks as secondary if job range missing
  let effectiveJobMin = jobMin;
  let effectiveJobMax = jobMax;
  let dataSource      = 'candidate_disclosed';

  if (!jobMin || !jobMax || jobMax < 1000) {
    // Try to match a benchmark
    const bench = findBenchmark(benchmarks, job);
    if (bench) {
      effectiveJobMin = bench.base_p25;
      effectiveJobMax = bench.base_p75;
      dataSource = 'inferred';
    }
  } else {
    dataSource = candidate?.salary_min && !prefs.comp_target_base && !prefs.comp_base_min
      ? 'inferred' : 'candidate_disclosed';
  }

  if (!candTarget || !effectiveJobMin || !effectiveJobMax || effectiveJobMax < 1000) {
    return {
      category:       'Insufficient Data',
      explanation:    'Compensation alignment requires both candidate expectations and job compensation range. Encourage candidates to complete their compensation preferences.',
      position:       'unknown',
      dataSource:     'missing',
      showCandComp:   false,
    };
  }

  // ── VALUE FACTOR SCORING ──────────────────────────────────────────────────
  // Each factor adds "justification points" that increase tolerance for premium positioning.
  let justification = 0;
  const justFactors = [];

  // Industry + function match (up to 20 pts)
  if (candidate?.industry && job?.industry) {
    const iMatch = candidate.industry.toLowerCase().split(/[\s&,]+/)
      .some(w => w.length > 3 && job.industry.toLowerCase().includes(w));
    if (iMatch) { justification += 10; justFactors.push('industry alignment'); }
  }
  if (candidate?.function && job?.function &&
      candidate.function.toLowerCase() === job.function.toLowerCase()) {
    justification += 10; justFactors.push('function alignment');
  }

  // P&L responsibility (15 pts)
  if (prefs.authority_pnl && reqs.pnl_responsibility) {
    justification += 15; justFactors.push('P&L scope');
  }

  // Years of relevant experience vs role level (up to 15 pts)
  const yearsExp = prefs.years_relevant_experience;
  if (yearsExp) {
    const roleLevel = job?.role_level || reqs.reports_to;
    const expectedYears = { executive: 20, senior: 15, director: 12, manager: 8 };
    const expected = Object.entries(expectedYears).find(([k]) => (roleLevel||'').toLowerCase().includes(k))?.[1] || 10;
    if (yearsExp >= expected * 1.3) { justification += 15; justFactors.push('deep experience'); }
    else if (yearsExp >= expected) { justification += 8; }
  }

  // Team size managed (up to 10 pts)
  const teamManaged = prefs.team_size_managed;
  const teamRequired = reqs.direct_reports || reqs.team_size;
  if (teamManaged && teamRequired && teamManaged >= teamRequired * 1.5) {
    justification += 10; justFactors.push('leadership breadth');
  } else if (teamManaged && teamRequired && teamManaged >= teamRequired) {
    justification += 5;
  }

  // Revenue responsibility (10 pts)
  const revManaged  = prefs.revenue_responsibility_usd;
  const revRequired = reqs.revenue_responsibility;
  if (revManaged && revRequired && revManaged >= revRequired) {
    justification += 10; justFactors.push('revenue responsibility');
  }

  // Mandate match (10 pts)
  const candMandates = prefs.mandate_types || [];
  if (candMandates.length > 0 && reqs.mandate && candMandates.includes(reqs.mandate)) {
    justification += 10; justFactors.push('mandate alignment');
  }

  // Geographic / travel flexibility (up to 5 pts)
  if (prefs.relocation_willing) { justification += 3; }
  if (prefs.travel_pct_max != null && reqs.travel_pct != null &&
      prefs.travel_pct_max >= reqs.travel_pct) { justification += 2; }

  // Technical skill scarcity proxy — required skills vs candidate skills (10 pts)
  const reqSkills = reqs.tech_required || [];
  const candTech  = [...(candidate?.technical_skills||[]), ...(candidate?.software_skills||[])];
  if (reqSkills.length > 0) {
    const skillMatch = reqSkills.filter(s => candTech.some(c => c.toLowerCase().includes(s.toLowerCase()))).length / reqSkills.length;
    if (skillMatch >= 0.9) { justification += 10; justFactors.push('rare technical fit'); }
    else if (skillMatch >= 0.6) { justification += 5; }
  }

  // Compensation flexibility signal
  if (prefs.compensation_flexibility === 'high' || prefs.willing_lower_base_higher_upside) {
    justification += 5;
  }

  // ── POSITION CALCULATION ──────────────────────────────────────────────────
  const jobMid     = (effectiveJobMin + effectiveJobMax) / 2;
  const aboveMax   = candTarget > effectiveJobMax;
  const belowMin   = candTarget < effectiveJobMin;
  const premiumPct = aboveMax ? (candTarget - effectiveJobMax) / effectiveJobMax : 0;

  let category;
  let position;
  let explanation;

  if (belowMin) {
    position  = 'below';
    category  = 'Below Market';
    explanation = `Candidate expectations are below the posted range (${fmt$(effectiveJobMin)}–${fmt$(effectiveJobMax)}). ` +
      (prefs.willing_lower_base_higher_upside
        ? 'Candidate has indicated openness to lower base for higher upside.'
        : 'Verify role scope, responsibilities, and total compensation structure before assuming a strong match on compensation.');
  } else if (!aboveMax) {
    position  = 'within';
    category  = 'Market Aligned';
    explanation = `Candidate expectations are within the posted range. ${justification >= 30 ? 'Value factors — ' + justFactors.slice(0,3).join(', ') + ' — further support the alignment.' : ''}`.trim();
  } else if (premiumPct <= 0.10) {
    position  = 'above';
    category  = 'Slight Premium';
    explanation = `Target is modestly above the posted maximum (${Math.round(premiumPct*100)}%). ` +
      (justification >= 20 ? `Supported by ${justFactors.slice(0,2).join(' and ')}.` : 'Negotiate with awareness of range ceiling.');
  } else if (premiumPct <= 0.25 && justification >= 30) {
    position  = 'above';
    category  = 'Premium but Defensible';
    explanation = `Target compensation is ${Math.round(premiumPct*100)}% above the posted maximum, ` +
      `but the profile shows ${justFactors.slice(0,3).join(', ')}. Premium may be justified for this scope.`;
  } else if (premiumPct <= 0.40 && justification >= 50) {
    position  = 'above';
    category  = 'Premium but Defensible';
    explanation = `Target is ${Math.round(premiumPct*100)}% above the posted range. Strong value factors (${justFactors.slice(0,3).join(', ')}) provide partial justification. Full alignment depends on scope negotiation.`;
  } else {
    position  = 'above';
    category  = 'Out of Range';
    explanation = `Target compensation is ${Math.round(premiumPct*100)}% above the posted maximum. ` +
      (justFactors.length > 0
        ? `Some value factors apply (${justFactors.slice(0,2).join(', ')}), but the gap is significant.`
        : 'Insufficient value factors to bridge the gap based on available profile data.');
  }

  return {
    category,
    explanation,
    position,
    dataSource,
    justificationScore: justification,
    justFactors,
    candidateTarget: candTarget,
    jobMin:          effectiveJobMin,
    jobMax:          effectiveJobMax,
    showCandComp:    !candidate?.privacy_hide_salary,
  };
}

function fmt$(n) {
  if (!n) return '—';
  if (n >= 1000000) return `$${(n/1000000).toFixed(1)}M`;
  if (n >= 1000)    return `$${Math.round(n/1000)}K`;
  return `$${n}`;
}

function findBenchmark(benchmarks, job) {
  if (!benchmarks?.length || !job) return null;
  const industry   = job.industry || '';
  const roleLevel  = job.role_level || 'director';
  // Try exact match first
  let bench = benchmarks.find(b => b.industry === industry && b.role_level === roleLevel && b.is_active);
  if (!bench) bench = benchmarks.find(b => b.role_level === roleLevel && b.is_active);
  return bench || null;
}

// ── COMPENSATION ALIGNMENT BADGE ──────────────────────────────────────────────
function CompAlignmentBadge({ alignment, isRecruiter, compact }) {
  if (!alignment || alignment.category === 'Insufficient Data') {
    if (compact) return null;
    return (
      <div className="comp-align-block">
        <div className="comp-align-header">
          <span className="comp-align-label">Compensation Alignment</span>
          <span className="comp-align-badge insufficient-data">Insufficient Data</span>
        </div>
        <div className="comp-align-explanation">Add compensation range to the job posting and encourage candidates to complete compensation preferences to enable this indicator.</div>
      </div>
    );
  }

  const { css } = COMP_ALIGN_CATEGORIES[alignment.category] || {};

  return (
    <div className="comp-align-block">
      <div className="comp-align-header">
        <span className="comp-align-label">Compensation Alignment</span>
        <span className={`comp-align-badge ${css||'insufficient-data'}`}>{alignment.category}</span>
      </div>
      {!compact && (
        <>
          <div className="comp-align-explanation">{alignment.explanation}</div>
          {isRecruiter && alignment.showCandComp && alignment.candidateTarget && (
            <div className="comp-align-position">
              Candidate target: {fmt$(alignment.candidateTarget)} ·
              Range: {fmt$(alignment.jobMin)}–{fmt$(alignment.jobMax)} ·
              {alignment.position === 'within' ? ' Within range' : alignment.position === 'below' ? ' Below range' : ' Above range'}
            </div>
          )}
          {isRecruiter && !alignment.showCandComp && (
            <div className="comp-align-position">Candidate compensation is private — alignment computed without disclosing amount.</div>
          )}
          <div className="comp-align-disclaimer">
            {isRecruiter
              ? 'Decision-support indicator only. Should not be used as the sole basis for candidate selection.'
              : 'Compensation positioning is an estimate based on your profile and available role data. Not a guarantee of market value or interview likelihood.'}
          </div>
        </>
      )}
    </div>
  );
}

// ── INTERN MATCH ENGINE ───────────────────────────────────────────────────────
// Structured fields only. No resume keywords. No penalty for missing resume.
// Points: Industry 25 | Function 20 | Availability 20 | Arrangement 15 | Skills 10 | Auth 10

const INTERN_SEASONS = { summer:'Summer', fall:'Fall', spring:'Spring', year_round:'Year-round' };
const INTERN_HOURS   = { '10_20':'10–20 hrs/wk','20_30':'20–30 hrs/wk','30_40':'30–40 hrs/wk','full_time':'Full-time' };
const INTERN_DEGREE_TYPES = { bachelor:'Bachelor\'s',master:'Master\'s',mba:'MBA',phd:'PhD',associate:'Associate\'s',certificate:'Certificate',pursuing_bachelor:'Pursuing Bachelor\'s',pursuing_master:'Pursuing Master\'s',pursuing_mba:'Pursuing MBA',pursuing_phd:'Pursuing PhD' };
const INTERN_AUTH = { us_citizen:'U.S. Citizen',us_permanent_resident:'Permanent Resident',us_visa_authorized:'Visa Authorized',requires_sponsorship:'Requires Sponsorship',international_student_opt:'International/OPT',other:'Other' };

function computeInternMatchScore(candidate, job) {
  let score = 0;
  const reasons = {}, matched = [], gaps = [];

  // ── HARD FILTER: Work authorization ──────────────────────────────────────
  // If job requires specific authorizations AND candidate needs sponsorship
  // AND job doesn't offer sponsorship → exclude
  if (candidate?.sponsorship_required && !job?.sponsorship_available) {
    return { score: 0, reasons: {}, matched: [], gaps: ['sponsorship not available'],
             blocked: true, explanation: 'This role does not support sponsorship.' };
  }

  // ── Industry interest (25 pts) ──────────────────────────────────────────
  const candIndustries = candidate?.preferred_industries || [];
  if (job?.industry && candIndustries.length > 0) {
    const jI = job.industry.toLowerCase();
    const match = candIndustries.some(ci => {
      const cI = ci.toLowerCase();
      return cI === jI || cI.split(/[\s&,]+/).some(w => w.length > 3 && jI.includes(w)) || jI.split(/[\s&,]+/).some(w => w.length > 3 && cI.includes(w));
    });
    if (match) { score += 25; reasons.industry = true; matched.push('industry interest'); }
    else { reasons.industry = false; gaps.push('industry interest'); }
  } else { score += 12; reasons.industry = null; }

  // ── Function interest (20 pts) ──────────────────────────────────────────
  const candFunctions = candidate?.preferred_functions || [];
  if (job?.function_area && candFunctions.length > 0) {
    if (candFunctions.some(cf => cf.toLowerCase() === job.function_area.toLowerCase())) {
      score += 20; reasons.function = true; matched.push('functional area');
    } else { reasons.function = false; }
  } else { score += 10; reasons.function = null; }

  // ── Availability overlap (20 pts) ──────────────────────────────────────
  const candSeasons = candidate?.internship_seasons || [];
  const jobSeason   = job?.season;
  if (candSeasons.length > 0 && jobSeason) {
    if (candSeasons.includes(jobSeason) || candSeasons.includes('year_round') || jobSeason === 'year_round') {
      score += 20; reasons.availability = true; matched.push('availability season');
    } else { reasons.availability = false; gaps.push('availability season'); }
  } else {
    // Check date overlap
    if (candidate?.availability_start_date && job?.start_date && candidate?.availability_end_date && job?.end_date) {
      const cStart = new Date(candidate.availability_start_date), cEnd = new Date(candidate.availability_end_date);
      const jStart = new Date(job.start_date), jEnd = new Date(job.end_date);
      if (cStart <= jEnd && jStart <= cEnd) { score += 20; reasons.availability = true; matched.push('availability dates'); }
      else { reasons.availability = false; gaps.push('availability dates'); }
    } else { score += 10; reasons.availability = null; }
  }

  // ── Work arrangement (15 pts) ────────────────────────────────────────────
  const candArr = candidate?.work_arrangement_pref;
  const jobArr  = job?.work_arrangement;
  if (candArr && jobArr) {
    if (candArr === jobArr || candArr === 'flexible' || jobArr === 'flexible') {
      score += 15; reasons.arrangement = true; matched.push('work arrangement');
    } else if ((candArr === 'hybrid' && jobArr !== 'onsite') || (jobArr === 'hybrid')) {
      score += 8; reasons.arrangement = 'partial';
    } else { reasons.arrangement = false; }
  } else { score += 8; reasons.arrangement = null; }

  // ── Skills match (10 pts) ────────────────────────────────────────────────
  const candTech = [...(candidate?.technical_skills||[]), ...(candidate?.software_skills||[])];
  const reqSkills = job?.required_skills || [];
  const prefSkills = job?.preferred_skills || [];
  if (reqSkills.length > 0 && candTech.length > 0) {
    const reqMatched  = reqSkills.filter(s => candTech.some(c => c.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(c.toLowerCase())));
    const prefMatched = prefSkills.filter(s => candTech.some(c => c.toLowerCase().includes(s.toLowerCase())));
    const skillScore  = Math.round((reqMatched.length / reqSkills.length) * 7) + (prefMatched.length > 0 ? 3 : 0);
    score += Math.min(10, skillScore);
    reasons.skills = reqMatched.length === reqSkills.length ? true : reqMatched.length > 0 ? 'partial' : false;
    if (reqMatched.length === reqSkills.length) matched.push('required skills');
    else if (reqMatched.length === 0) gaps.push('required skills');
  } else { score += 5; reasons.skills = null; }

  // ── GPA (bonus — never penalized for not disclosing) ──────────────────
  if (job?.gpa_minimum && candidate?.gpa_disclosed && candidate?.gpa) {
    if (candidate.gpa >= job.gpa_minimum) { reasons.gpa = true; }
    else { reasons.gpa = false; gaps.push(`GPA minimum ${job.gpa_minimum}`); }
  } else { reasons.gpa = null; } // no penalty for not disclosing

  const finalScore = Math.min(100, score);

  // Explanation
  let explanation;
  if (finalScore >= 80) explanation = `Strong match — ${matched.slice(0,3).join(', ')} align.`;
  else if (finalScore >= 60) explanation = `Good match — ${matched.length > 0 ? matched.slice(0,2).join(', ')+' align.' : ''}${gaps.length > 0 ? ` Gap: ${gaps[0]}.` : ''}`;
  else if (finalScore >= 40) explanation = gaps.length > 0 ? `Partial match — ${gaps.slice(0,2).join(', ')} may not align.` : 'Partial match — limited preference data available.';
  else explanation = 'Low match based on current profile data.';

  return { score: finalScore, reasons, matched, gaps, explanation, blocked: false };
}

// ── INTERN PROFILE FORM ───────────────────────────────────────────────────────
// 5 steps. No file upload. No resume. Ever.
const INDUSTRY_OPTIONS = ['Maritime & Shipping','Ports & Terminals','Energy & Offshore','Industrial Commodities & Logistics','Supply Chain & Logistics','Commercial Operations','Finance','Other'];
const FUNCTION_OPTIONS = ['Commercial','Operations','Finance','Engineering','Technology','Strategy','Legal','Other'];
const AUTH_OPTIONS     = Object.entries(INTERN_AUTH);

function InternProfileForm({ authUser, showToast, onComplete, requestSignIn }) {
  const [step, setStep]   = useState(1);
  const [loading, setLoading] = useState(false);
  const [tier, setTier]   = useState('free');
  const [isUpdate, setIsUpdate] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(!!authUser?.email);
  const [form, setForm] = useState({
    school_university:'', degree_type:'', major:'', minor:'', graduation_year:'',
    graduation_semester:'spring', gpa:'', gpa_disclosed: false,
    location:'', preferred_work_locations:'', work_authorization_status:'', sponsorship_required: false,
    internship_seasons:[], availability_start_date:'', availability_end_date:'',
    hours_per_week:'full_time', work_arrangement_pref:'hybrid',
    willing_to_relocate: false, willing_to_travel: false,
    preferred_industries:[], preferred_functions:[],
    prior_internship_experience: false, prior_work_experience_summary:'',
    relevant_coursework:'', technical_skills:'', software_skills:'',
    certifications:'', language_skills:'', profile_summary:'',
    portfolio_url:'', linkedin_url:'', project_links:'',
    privacy_hide_name: false, privacy_hide_school: false,
    privacy_anonymous_until_accepted: false,
    project_experience: [],
  });

  // Load existing profile so an authenticated user editing their profile
  // doesn't lose data on save (upsert would otherwise overwrite all fields
  // with the default blanks above).
  useEffect(() => {
    if (!authUser?.email) { setLoadingProfile(false); return; }
    const emailLc = authUser.email.toLowerCase();
    sb.from('fed_intern_profiles').select('*').eq('email', emailLc).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsUpdate(true);
          setTier(data.tier === 'featured' ? 'featured' : 'free');
          setForm(prev => ({
            ...prev,
            ...Object.fromEntries(Object.entries(data).filter(([k]) => k in prev)),
            // Re-stringify arrays that the form edits as comma-separated strings
            technical_skills: Array.isArray(data.technical_skills) ? data.technical_skills.join(', ') : (data.technical_skills || ''),
            software_skills:  Array.isArray(data.software_skills)  ? data.software_skills.join(', ')  : (data.software_skills  || ''),
            certifications:   Array.isArray(data.certifications)   ? data.certifications.join(', ')   : (data.certifications   || ''),
            preferred_work_locations: Array.isArray(data.preferred_work_locations)
              ? data.preferred_work_locations.join(', ')
              : (data.preferred_work_locations || ''),
            project_experience: Array.isArray(data.project_experience) ? data.project_experience : [],
            preferred_industries: Array.isArray(data.preferred_industries) ? data.preferred_industries : [],
            preferred_functions:  Array.isArray(data.preferred_functions)  ? data.preferred_functions  : [],
            internship_seasons:   Array.isArray(data.internship_seasons)   ? data.internship_seasons   : [],
            graduation_year: data.graduation_year ? String(data.graduation_year) : '',
            gpa: data.gpa != null ? String(data.gpa) : '',
          }));
        }
        setLoadingProfile(false);
      })
      .catch(() => setLoadingProfile(false));
  }, [authUser?.email]);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }
  function toggleArr(k, v) { const a = form[k]||[]; set(k, a.includes(v) ? a.filter(x=>x!==v) : [...a,v]); }

  function addProject() {
    set('project_experience', [...(form.project_experience||[]), { title:'', description:'', outcomes:'', technologies:'', url:'' }]);
  }
  function setProject(idx, field, val) {
    const projects = [...(form.project_experience||[])];
    projects[idx] = { ...projects[idx], [field]: val };
    set('project_experience', projects);
  }
  function removeProject(idx) {
    set('project_experience', (form.project_experience||[]).filter((_,i)=>i!==idx));
  }

  function validate() {
    if (step === 1 && (!form.school_university || !form.major || !form.degree_type || !form.graduation_year)) {
      showToast('School, degree type, major, and graduation year are required.'); return false;
    }
    return true;
  }

  function next() { if (validate()) setStep(s => s + 1); }
  function back() { setStep(s => s - 1); }

  async function submit() {
    if (!authUser?.email) { showToast('Please sign in to save your profile.'); return; }
    setLoading(true);
    const emailLc = authUser.email.toLowerCase();
    const profileData = {
      email: emailLc,
      ...form,
      gpa: form.gpa_disclosed && form.gpa ? parseFloat(form.gpa) : null,
      graduation_year: form.graduation_year ? parseInt(form.graduation_year) : null,
      technical_skills: form.technical_skills ? form.technical_skills.split(',').map(s=>s.trim()).filter(Boolean) : [],
      software_skills:  form.software_skills  ? form.software_skills.split(',').map(s=>s.trim()).filter(Boolean) : [],
      certifications:   form.certifications   ? form.certifications.split(',').map(s=>s.trim()).filter(Boolean) : [],
      preferred_work_locations: form.preferred_work_locations
        ? form.preferred_work_locations.split(',').map(s=>s.trim()).filter(Boolean)
        : [],
      // Preserve current tier on update — webhook is the single source of truth
      // for promoting to 'featured' after a successful Stripe checkout.
      tier: isUpdate ? undefined : 'free',
    };
    // Drop undefined tier so it doesn't overwrite an existing 'featured' tier
    if (profileData.tier === undefined) delete profileData.tier;

    const { error } = await sb.from('fed_intern_profiles').upsert(profileData, { onConflict:'email' });
    if (error) { showToast('Error saving profile. Please try again.'); setLoading(false); return; }
    if (tier === 'featured') {
      try {
        const resp = await fetch('/api/create-checkout-session', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ type:'intern_featured', email: emailLc, origin: window.location.origin }),
        });
        const data = await resp.json();
        if (data.url) { window.location.href = data.url; return; }
        showToast(data.error || 'Checkout unavailable. Profile saved — you can upgrade from your profile later.');
      } catch (e) {
        showToast('Checkout request failed. Profile saved — try upgrading again later.');
      }
      if (onComplete) onComplete();
    } else {
      showToast(isUpdate ? '✓ Profile updated.' : '✓ Profile saved. You\'ll be matched as opportunities post.');
      if (onComplete) onComplete();
    }
    setLoading(false);
  }

  const TOTAL_STEPS = 5;
  const yearNow = new Date().getFullYear();
  const GRAD_YEARS = Array.from({length:8}, (_,i) => yearNow + i - 1);

  // Auth gate — saving the profile requires an authenticated email. Without
  // this gate, a user could complete the 5-step form and only discover they
  // need to sign in at submit, losing all entered data.
  if (!authUser?.email) {
    return (
      <div style={{maxWidth:600,margin:'4rem auto',padding:'0 1.5rem',textAlign:'center'}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:'var(--ink)',marginBottom:'0.75rem'}}>
          Sign in to build your Student Profile
        </div>
        <div style={{fontSize:'0.875rem',color:'var(--ink-4)',marginBottom:'1.5rem',lineHeight:'1.6'}}>
          Profiles are tied to your email so we can save your progress, match you to internships, and notify you when an employer is interested. You'll be returned to your profile after signing in.
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            // App's requestSignIn navigates to the SignInPage AND records the
            // return destination so the magic-link emailRedirectTo brings the
            // user back here after authenticating.
            if (requestSignIn) requestSignIn('intern-profile');
          }}
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div style={{maxWidth:640,margin:'4rem auto',padding:'0 1.5rem',textAlign:'center',color:'var(--ink-4)'}}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={{maxWidth:640,margin:'0 auto',padding:'2rem 1.5rem'}}>
      {/* Platform notice */}
      <div className="intern-form-policy">
        <strong>Fredheim Desk does not require resume uploads.</strong> Your structured profile is used for matching.
        If you choose to engage with an employer, you may share additional materials directly — at your discretion.
        {isUpdate && (
          <><br/><br/><strong>Updating your existing profile.</strong> Your current information has been loaded — change only what you need.</>
        )}
      </div>

      {/* Step dots */}
      <div className="intern-step-dots">
        {Array.from({length:TOTAL_STEPS},(_,i)=>(
          <div key={i} className={`intern-step-dot ${i+1<step?'done':i+1===step?'active':''}`}/>
        ))}
      </div>

      {/* Step 1 — Academic Background */}
      {step === 1 && (
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.375rem'}}>
            Step 1 of {TOTAL_STEPS}
          </div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:'var(--ink)',marginBottom:'1.5rem',fontWeight:400}}>Academic Background</h2>
          <div style={{display:'grid',gap:'0.875rem'}}>
            <div className="form-group">
              <label className="form-label">School / University *</label>
              <input className="form-input" placeholder="e.g. University of Houston" value={form.school_university} onChange={e=>set('school_university',e.target.value)} />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
              <div className="form-group">
                <label className="form-label">Degree Type *</label>
                <select className="form-input" value={form.degree_type} onChange={e=>set('degree_type',e.target.value)}>
                  <option value="">Select…</option>
                  {Object.entries(INTERN_DEGREE_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Graduation Year *</label>
                <select className="form-input" value={form.graduation_year} onChange={e=>set('graduation_year',e.target.value)}>
                  <option value="">Select…</option>
                  {GRAD_YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'0.875rem'}}>
              <div className="form-group">
                <label className="form-label">Major *</label>
                <input className="form-input" placeholder="e.g. Supply Chain Management" value={form.major} onChange={e=>set('major',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <select className="form-input" value={form.graduation_semester} onChange={e=>set('graduation_semester',e.target.value)}>
                  {['spring','summer','fall','december'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Minor (optional)</label>
              <input className="form-input" placeholder="e.g. Economics" value={form.minor} onChange={e=>set('minor',e.target.value)} />
            </div>
            <div>
              <label className="prefs-check-item" style={{marginBottom:'0.5rem'}}>
                <input type="checkbox" checked={form.gpa_disclosed} onChange={e=>set('gpa_disclosed',e.target.checked)} />
                <span style={{fontSize:'0.82rem'}}>I choose to disclose my GPA</span>
              </label>
              {form.gpa_disclosed && (
                <div className="form-group">
                  <label className="form-label">GPA (4.0 scale)</label>
                  <input className="form-input" type="number" step="0.01" min="0" max="4.0" placeholder="e.g. 3.7" value={form.gpa} onChange={e=>set('gpa',e.target.value)} style={{maxWidth:120}} />
                </div>
              )}
              <div style={{fontSize:'0.72rem',color:'var(--ink-4)',marginTop:'0.25rem'}}>
                GPA disclosure is always optional. You can add or remove it at any time.
              </div>
            </div>
          </div>
          <div className="workflow-actions" style={{marginTop:'2rem'}}>
            <div/>
            <button className="btn-primary" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 2 — Availability & Location */}
      {step === 2 && (
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.375rem'}}>
            Step 2 of {TOTAL_STEPS}
          </div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:'var(--ink)',marginBottom:'1.5rem',fontWeight:400}}>Availability & Location</h2>
          <div style={{display:'grid',gap:'0.875rem'}}>
            <div>
              <div className="form-label" style={{marginBottom:'0.5rem'}}>Internship Season Availability</div>
              <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                {Object.entries(INTERN_SEASONS).map(([v,l])=>(
                  <button key={v} className={`prefs-toggle ${form.internship_seasons.includes(v)?'selected':''}`}
                    onClick={()=>toggleArr('internship_seasons',v)}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
              <div className="form-group">
                <label className="form-label">Earliest Start Date</label>
                <input className="form-input" type="date" value={form.availability_start_date} onChange={e=>set('availability_start_date',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Latest End Date</label>
                <input className="form-input" type="date" value={form.availability_end_date} onChange={e=>set('availability_end_date',e.target.value)} />
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
              <div className="form-group">
                <label className="form-label">Hours Available Per Week</label>
                <select className="form-input" value={form.hours_per_week} onChange={e=>set('hours_per_week',e.target.value)}>
                  {Object.entries(INTERN_HOURS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Work Arrangement Preference</label>
                <select className="form-input" value={form.work_arrangement_pref} onChange={e=>set('work_arrangement_pref',e.target.value)}>
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Current Location</label>
              <input className="form-input" placeholder="City, State" value={form.location} onChange={e=>set('location',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Work Locations (optional)</label>
              <input className="form-input" placeholder="e.g. Houston, TX · Remote" value={form.preferred_work_locations} onChange={e=>set('preferred_work_locations',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Work Authorization Status</label>
              <select className="form-input" value={form.work_authorization_status} onChange={e=>set('work_authorization_status',e.target.value)}>
                <option value="">Select…</option>
                {AUTH_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <label className="prefs-check-item">
              <input type="checkbox" checked={form.sponsorship_required} onChange={e=>set('sponsorship_required',e.target.checked)} />
              <span style={{fontSize:'0.82rem'}}>I require visa sponsorship</span>
            </label>
            <div style={{display:'flex',gap:'1.5rem'}}>
              <label className="prefs-check-item">
                <input type="checkbox" checked={form.willing_to_relocate} onChange={e=>set('willing_to_relocate',e.target.checked)} />
                <span style={{fontSize:'0.82rem'}}>Willing to relocate</span>
              </label>
              <label className="prefs-check-item">
                <input type="checkbox" checked={form.willing_to_travel} onChange={e=>set('willing_to_travel',e.target.checked)} />
                <span style={{fontSize:'0.82rem'}}>Willing to travel</span>
              </label>
            </div>
          </div>
          <div className="workflow-actions" style={{marginTop:'2rem'}}>
            <button className="workflow-close-btn" onClick={back}>← Back</button>
            <button className="btn-primary" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 3 — Interests */}
      {step === 3 && (
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.375rem'}}>
            Step 3 of {TOTAL_STEPS}
          </div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:'var(--ink)',marginBottom:'1.5rem',fontWeight:400}}>Industry & Function Interests</h2>
          <div style={{display:'grid',gap:'1.25rem'}}>
            <div>
              <div className="form-label" style={{marginBottom:'0.625rem'}}>Industries I'm Interested In</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
                {INDUSTRY_OPTIONS.map(ind=>(
                  <button key={ind} className={`prefs-toggle ${form.preferred_industries.includes(ind)?'selected':''}`}
                    onClick={()=>toggleArr('preferred_industries',ind)}>{ind}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="form-label" style={{marginBottom:'0.625rem'}}>Functions I'm Interested In</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
                {FUNCTION_OPTIONS.map(fn=>(
                  <button key={fn} className={`prefs-toggle ${form.preferred_functions.includes(fn)?'selected':''}`}
                    onClick={()=>toggleArr('preferred_functions',fn)}>{fn}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="workflow-actions" style={{marginTop:'2rem'}}>
            <button className="workflow-close-btn" onClick={back}>← Back</button>
            <button className="btn-primary" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 4 — Experience & Projects (replaces resume) */}
      {step === 4 && (
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.375rem'}}>
            Step 4 of {TOTAL_STEPS}
          </div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:'var(--ink)',marginBottom:'0.5rem',fontWeight:400}}>Experience &amp; Projects</h2>
          <p style={{fontSize:'0.8rem',color:'var(--ink-4)',marginBottom:'1.5rem',lineHeight:'1.6'}}>
            This section replaces a resume for initial matching. Describe your actual work — projects, coursework, and skills tell employers what you can do.
          </p>
          <div style={{display:'grid',gap:'0.875rem'}}>
            <div className="form-group">
              <label className="form-label">Profile Summary (2–4 sentences)</label>
              <textarea className="form-input" rows={3} style={{resize:'vertical'}} placeholder="What makes you a strong candidate for maritime, energy, or logistics internships?"
                value={form.profile_summary} onChange={e=>set('profile_summary',e.target.value)} />
            </div>
            <label className="prefs-check-item">
              <input type="checkbox" checked={form.prior_internship_experience} onChange={e=>set('prior_internship_experience',e.target.checked)} />
              <span style={{fontSize:'0.82rem',fontWeight:500}}>I have prior internship experience</span>
            </label>
            <div className="form-group">
              <label className="form-label">Prior Work / Internship Summary (optional)</label>
              <textarea className="form-input" rows={3} style={{resize:'vertical'}} placeholder="Brief description of any prior work or internship experience — roles, industries, what you did."
                value={form.prior_work_experience_summary} onChange={e=>set('prior_work_experience_summary',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Relevant Coursework</label>
              <textarea className="form-input" rows={2} style={{resize:'vertical'}} placeholder="e.g. Supply Chain Management, Maritime Law, Port Operations, Financial Analysis"
                value={form.relevant_coursework} onChange={e=>set('relevant_coursework',e.target.value)} />
            </div>

            {/* Projects — structured, not a file */}
            <div>
              <div className="form-label" style={{marginBottom:'0.5rem'}}>Projects</div>
              {(form.project_experience||[]).map((p,i)=>(
                <div key={i} style={{border:'1px solid var(--rule)',padding:'1rem',marginBottom:'0.625rem',background:'var(--paper-2)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.625rem'}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',color:'var(--ink-3)',letterSpacing:'0.1em'}}>PROJECT {i+1}</span>
                    <button onClick={()=>removeProject(i)} style={{background:'none',border:'none',color:'var(--ink-4)',cursor:'pointer',fontSize:'0.75rem'}}>Remove</button>
                  </div>
                  {[{k:'title',ph:'Project title',rows:1},{k:'description',ph:'What did you do? What was the problem you solved?',rows:2},{k:'outcomes',ph:'Results, impact, or what you learned',rows:2},{k:'technologies',ph:'Tools, software, or methods used',rows:1},{k:'url',ph:'GitHub, demo link, or project page (optional)',rows:1}].map(f=>(
                    <div key={f.k} className="form-group" style={{marginBottom:'0.5rem'}}>
                      <label className="form-label">{f.k.charAt(0).toUpperCase()+f.k.slice(1)}</label>
                      {f.rows > 1
                        ? <textarea className="form-input" rows={f.rows} style={{resize:'vertical'}} placeholder={f.ph} value={p[f.k]||''} onChange={e=>setProject(i,f.k,e.target.value)} />
                        : <input   className="form-input" placeholder={f.ph} value={p[f.k]||''} onChange={e=>setProject(i,f.k,e.target.value)} />}
                    </div>
                  ))}
                </div>
              ))}
              <button className="admin-action-btn" onClick={addProject} style={{fontSize:'0.72rem'}}>+ Add Project</button>
            </div>

            <div className="form-group">
              <label className="form-label">Technical Skills (comma-separated)</label>
              <input className="form-input" placeholder="e.g. SQL, Python, AutoCAD" value={form.technical_skills} onChange={e=>set('technical_skills',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Software Skills (comma-separated)</label>
              <input className="form-input" placeholder="e.g. Excel, Power BI, SAP, Salesforce" value={form.software_skills} onChange={e=>set('software_skills',e.target.value)} />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
              <div className="form-group">
                <label className="form-label">Certifications (comma-separated)</label>
                <input className="form-input" placeholder="e.g. OSHA 10, PMP Fundamentals" value={form.certifications} onChange={e=>set('certifications',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Languages</label>
                <input className="form-input" placeholder="e.g. Spanish (fluent), French (basic)" value={form.language_skills} onChange={e=>set('language_skills',e.target.value)} />
              </div>
            </div>
          </div>
          <div className="workflow-actions" style={{marginTop:'2rem'}}>
            <button className="workflow-close-btn" onClick={back}>← Back</button>
            <button className="btn-primary" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 5 — Links & Visibility */}
      {step === 5 && (
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.375rem'}}>
            Step 5 of {TOTAL_STEPS}
          </div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:'var(--ink)',marginBottom:'1.5rem',fontWeight:400}}>Links &amp; Visibility</h2>
          <div style={{display:'grid',gap:'0.875rem',marginBottom:'1.5rem'}}>
            <div className="form-group">
              <label className="form-label">Portfolio URL (optional)</label>
              <input className="form-input" placeholder="https://yourportfolio.com" value={form.portfolio_url} onChange={e=>set('portfolio_url',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">LinkedIn (optional)</label>
              <input className="form-input" placeholder="https://linkedin.com/in/yourname" value={form.linkedin_url} onChange={e=>set('linkedin_url',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Project Links (optional — GitHub, demos, etc.)</label>
              <input className="form-input" placeholder="https://github.com/you or comma-separated links" value={form.project_links} onChange={e=>set('project_links',e.target.value)} />
            </div>
          </div>

          {/* Privacy */}
          <div style={{marginBottom:'1.5rem'}}>
            <div className="prefs-section-title">Privacy Settings</div>
            {[{k:'privacy_hide_name',l:'Hide my name until I accept engagement'},{k:'privacy_hide_school',l:'Hide my school name'},{k:'privacy_anonymous_until_accepted',l:'Fully anonymous until I accept engagement'}].map(f=>(
              <label key={f.k} className="prefs-check-item" style={{marginBottom:'0.5rem'}}>
                <input type="checkbox" checked={!!form[f.k]} onChange={e=>set(f.k,e.target.checked)} />
                <span style={{fontSize:'0.82rem'}}>{f.l}</span>
              </label>
            ))}
          </div>

          {/* Tier selection */}
          <div style={{marginBottom:'1.5rem'}}>
            <div className="prefs-section-title">Profile Visibility</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1px',background:'var(--rule)'}}>
              {[
                { v:'free', label:'Free Profile', price:'No cost',
                  features:['Matching with active employers','Appear in relevant results','Full structured profile','Portfolio & project links'] },
                { v:'featured', label:'Featured Student Profile', price:'$49 / yr',
                  features:['Featured badge — higher visibility','Priority placement in matched results','Profile view analytics','Profile completeness checklist','All free features included'] },
              ].map(t => (
                <div key={t.v} className={`tier-card ${tier===t.v?'selected':''}`} onClick={()=>setTier(t.v)}
                  style={{padding:'1.25rem',background:'var(--paper)',cursor:'pointer',border:`2px solid ${tier===t.v?'var(--ink)':'transparent'}`}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1rem',color:'var(--ink)',marginBottom:'0.25rem'}}>{t.label}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.8rem',color:'var(--gold)',marginBottom:'0.875rem'}}>{t.price}</div>
                  {t.features.map(f=><div key={f} style={{fontSize:'0.75rem',color:'var(--ink-3)',marginBottom:'0.2rem'}}>✓ {f}</div>)}
                  {t.v === 'featured' && (
                    <div style={{fontSize:'0.68rem',color:'var(--ink-4)',marginTop:'0.5rem',fontStyle:'italic'}}>
                      Does not include resume upload or parsing — this platform uses structured profiles only.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="workflow-actions">
            <button className="workflow-close-btn" onClick={back}>← Back</button>
            <button className="btn-primary" onClick={submit} disabled={loading}>
              {loading ? 'Saving…' : tier==='featured' ? 'Save & Upgrade to Featured — $49/yr' : 'Complete Matching Profile'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── INTERN JOB CARD ───────────────────────────────────────────────────────────
function InternJobCard({ job, onClick }) {
  const seasonLabel = job.season ? INTERN_SEASONS[job.season] || job.season : null;
  return (
    <div className="intern-job-card" onClick={() => onClick && onClick(job)}>
      <div style={{flex:1}}>
        <div className="intern-job-title">{job.title}</div>
        <div className="intern-job-employer">
          {job.employer_confidential ? 'Confidential Employer' : (job.employer_display || job.employer_name || 'Employer')} · {job.industry}
        </div>
        <div style={{fontSize:'0.78rem',color:'var(--ink-4)',marginBottom:'0.375rem'}}>
          {job.location} · {job.work_arrangement ? (job.work_arrangement.charAt(0).toUpperCase()+job.work_arrangement.slice(1)) : ''} · {INTERN_HOURS[job.hours_per_week] || job.hours_per_week || 'Full-time'}
        </div>
        <div className="intern-job-tags">
          {seasonLabel && <span className="intern-tag season">{seasonLabel}</span>}
          {job.is_paid && <span className="intern-tag paid">Paid</span>}
          {job.sponsorship_available && <span className="intern-tag">Sponsorship Available</span>}
          {(job.required_majors||[]).slice(0,2).map(m=><span key={m} className="intern-tag">{m}</span>)}
        </div>
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        {job.compensation_display && (
          <div className="intern-comp">{job.compensation_display}</div>
        )}
        {!job.is_paid && <div style={{fontSize:'0.75rem',color:'var(--ink-4)'}}>Unpaid</div>}
      </div>
    </div>
  );
}

// ── EARLY CAREERS LANDING PAGE ────────────────────────────────────────────────
function EarlyCareersLanding({ authUser, goToView, showToast, requestSignIn }) {
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [filters, setFilters]       = useState({
    season:'', work_arrangement:'', industry:'', is_paid:'',
    sponsorship_available:'', search:''
  });
  const [showEmployerModal, setShowEmployerModal] = useState(false);
  // Student matching state — used by the Indicate Interest CTA on the job
  // detail modal. We load the student profile (to gate behind profile
  // completion) and existing interests (to disable double-submission).
  const [studentProfile, setStudentProfile] = useState(null);
  const [interestedJobIds, setInterestedJobIds] = useState(new Set());
  const [indicating, setIndicating] = useState(false);

  useEffect(() => {
    sb.from('fed_intern_jobs').select('*').eq('status','active').eq('demo_post',false)
      .order('created_at',{ascending:false}).then(({data})=>{
        setJobs(data||[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!authUser?.email) { setStudentProfile(null); setInterestedJobIds(new Set()); return; }
    const emailLc = authUser.email.toLowerCase();
    Promise.all([
      sb.from('fed_intern_profiles').select('email,school_university,major').eq('email', emailLc).maybeSingle(),
      sb.from('fed_intern_interests').select('job_id').eq('candidate_email', emailLc),
    ]).then(([{data:p},{data:ints}]) => {
      setStudentProfile(p || null);
      setInterestedJobIds(new Set((ints || []).map(r => r.job_id)));
    });
  }, [authUser?.email]);

  async function indicateInterest(job) {
    if (!authUser?.email) {
      if (requestSignIn) requestSignIn('early-careers');
      else goToView('intern-profile');
      return;
    }
    if (!studentProfile) {
      showToast('Complete your student profile first — takes about 3 minutes.');
      goToView('intern-profile');
      return;
    }
    if (interestedJobIds.has(job.id)) {
      showToast('You already expressed interest in this role.');
      return;
    }
    setIndicating(true);
    const emailLc = authUser.email.toLowerCase();
    const { error } = await sb.from('fed_intern_interests').insert({
      candidate_email: emailLc,
      job_id:          job.id,
      status:          'candidate_interested',
    });
    if (error) {
      showToast('Could not record interest. Please try again.');
    } else {
      setInterestedJobIds(prev => new Set([...prev, job.id]));
      showToast('✓ Interest recorded. The employer is notified without your contact details until mutual interest.');
    }
    setIndicating(false);
  }

  const filtered = jobs.filter(j => {
    if (filters.search && !j.title?.toLowerCase().includes(filters.search.toLowerCase()) && !j.role_summary?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.season && j.season !== filters.season) return false;
    if (filters.work_arrangement && j.work_arrangement !== filters.work_arrangement) return false;
    if (filters.industry && j.industry !== filters.industry) return false;
    if (filters.is_paid === 'paid' && !j.is_paid) return false;
    if (filters.is_paid === 'unpaid' && j.is_paid) return false;
    if (filters.sponsorship_available === 'yes' && !j.sponsorship_available) return false;
    return true;
  });

  function setF(k,v) { setFilters(p=>({...p,[k]:v})); }

  const industries = [...new Set(jobs.map(j=>j.industry).filter(Boolean))];

  return (
    <div>
      {/* Hero */}
      <div className="intern-hero">
        <div className="intern-eyebrow">Early Careers</div>
        <h1 className="intern-hero-title">Maritime, Energy &amp; Logistics<br/>Internship Opportunities</h1>
        <div className="intern-hero-sub">
          Structured matching for university students and early-career candidates. No resume required for initial matching.
        </div>
        <div className="intern-hero-ctas">
          <button className="btn-primary" onClick={() => goToView('intern-profile')}>Complete Matching Profile</button>
          <button className="admin-action-btn" style={{padding:'0.75rem 1.5rem',fontSize:'0.82rem'}} onClick={()=>setShowEmployerModal(true)}>Post an Internship</button>
        </div>
        <div className="intern-policy-note">
          <strong>Fredheim Desk does not require resume uploads.</strong> Your structured profile is used for matching.
          If you choose to engage with an employer, you may share a resume or additional materials directly at your discretion.
        </div>
      </div>

      {/* Two-column layout: filters + listings */}
      <div className="intern-board-layout">
        {/* Filters panel */}
        <div>
          <div className="intern-filters-panel">
            <div className="intern-filter-section">
              <div className="intern-filter-title">Search</div>
              <input className="form-input" placeholder="Role or keyword" value={filters.search} onChange={e=>setF('search',e.target.value)} />
            </div>
            <div className="intern-filter-section">
              <div className="intern-filter-title">Season</div>
              {[['','All'],['summer','Summer'],['fall','Fall'],['spring','Spring'],['year_round','Year-round']].map(([v,l])=>(
                <label key={v} style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem',cursor:'pointer',fontSize:'0.82rem'}}>
                  <input type="radio" name="season" checked={filters.season===v} onChange={()=>setF('season',v)} />
                  {l}
                </label>
              ))}
            </div>
            <div className="intern-filter-section">
              <div className="intern-filter-title">Work Arrangement</div>
              {[['','Any'],['onsite','On-site'],['hybrid','Hybrid'],['remote','Remote'],['flexible','Flexible']].map(([v,l])=>(
                <label key={v} style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem',cursor:'pointer',fontSize:'0.82rem'}}>
                  <input type="radio" name="arrangement" checked={filters.work_arrangement===v} onChange={()=>setF('work_arrangement',v)} />
                  {l}
                </label>
              ))}
            </div>
            <div className="intern-filter-section">
              <div className="intern-filter-title">Compensation</div>
              {[['','Any'],['paid','Paid only'],['unpaid','Unpaid']].map(([v,l])=>(
                <label key={v} style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem',cursor:'pointer',fontSize:'0.82rem'}}>
                  <input type="radio" name="paid" checked={filters.is_paid===v} onChange={()=>setF('is_paid',v)} />
                  {l}
                </label>
              ))}
            </div>
            {industries.length > 0 && (
              <div className="intern-filter-section">
                <div className="intern-filter-title">Industry</div>
                <select className="form-input" style={{fontSize:'0.8rem'}} value={filters.industry} onChange={e=>setF('industry',e.target.value)}>
                  <option value="">All industries</option>
                  {industries.map(i=><option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            )}
            <div className="intern-filter-section">
              <div className="intern-filter-title">Sponsorship</div>
              <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',fontSize:'0.82rem'}}>
                <input type="checkbox" checked={filters.sponsorship_available==='yes'} onChange={e=>setF('sponsorship_available',e.target.checked?'yes':'')} />
                Sponsorship available
              </label>
            </div>
          </div>

          {/* Employer notice — no resume filters */}
          <div className="employer-notice" style={{marginTop:'1rem'}}>
            <strong>Employer notice:</strong> Fredheim uses structured candidate profiles for initial matching. Filters are based on profile completeness, academic background, skills, availability, and work authorization — not resume availability.
          </div>
        </div>

        {/* Listings */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap',gap:'0.5rem'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)'}}>
              {loading ? 'Loading…' : `${filtered.length} Internship${filtered.length!==1?'s':''}${filtered.length<jobs.length?` of ${jobs.length}`:''}`}
            </div>
            {authUser && (
              <button className="admin-action-btn" style={{fontSize:'0.72rem'}} onClick={()=>goToView('intern-myprofile')}>
                My Student Profile
              </button>
            )}
          </div>

          {loading ? (
            <div style={{textAlign:'center',padding:'3rem',color:'var(--ink-4)'}}><span className="spinner"/>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'3rem',color:'var(--ink-4)',fontSize:'0.875rem'}}>
              {jobs.length === 0
                ? 'No internship opportunities posted yet — check back soon or post one.'
                : 'No postings match your filters.'}
            </div>
          ) : (
            <div className="intern-job-list">
              {filtered.map(job => <InternJobCard key={job.id} job={job} onClick={setSelectedJob} />)}
            </div>
          )}
        </div>
      </div>

      {/* Job detail modal */}
      {selectedJob && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setSelectedJob(null);}}>
          <div className="workflow-modal" style={{maxWidth:580}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',color:'var(--ink)',marginBottom:'0.25rem'}}>{selectedJob.title}</div>
            <div style={{fontSize:'0.82rem',color:'var(--ink-3)',marginBottom:'1rem'}}>
              {selectedJob.employer_confidential ? 'Confidential Employer' : selectedJob.employer_display||selectedJob.employer_name} · {selectedJob.industry} · {selectedJob.location}
            </div>
            <div className="intern-job-tags" style={{marginBottom:'1rem'}}>
              {selectedJob.season && <span className="intern-tag season">{INTERN_SEASONS[selectedJob.season]}</span>}
              {selectedJob.is_paid && <span className="intern-tag paid">Paid · {selectedJob.compensation_display}</span>}
              {selectedJob.work_arrangement && <span className="intern-tag">{selectedJob.work_arrangement.charAt(0).toUpperCase()+selectedJob.work_arrangement.slice(1)}</span>}
              {INTERN_HOURS[selectedJob.hours_per_week] && <span className="intern-tag">{INTERN_HOURS[selectedJob.hours_per_week]}</span>}
              {selectedJob.sponsorship_available && <span className="intern-tag">Sponsorship Available</span>}
            </div>
            {selectedJob.role_summary && <div style={{fontSize:'0.875rem',color:'var(--ink-2)',lineHeight:'1.6',marginBottom:'1rem'}}>{selectedJob.role_summary}</div>}
            {selectedJob.project_description && (
              <div style={{marginBottom:'1rem'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-3)',marginBottom:'0.375rem'}}>Project / Work Description</div>
                <div style={{fontSize:'0.82rem',color:'var(--ink-2)',lineHeight:'1.6'}}>{selectedJob.project_description}</div>
              </div>
            )}
            {selectedJob.required_skills?.length > 0 && (
              <div style={{marginBottom:'1rem'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-3)',marginBottom:'0.375rem'}}>Skills Required</div>
                <div className="intern-job-tags">{selectedJob.required_skills.map(s=><span key={s} className="intern-tag">{s}</span>)}</div>
              </div>
            )}
            <div style={{fontSize:'0.75rem',color:'var(--ink-4)',background:'var(--paper-2)',border:'1px solid var(--rule)',padding:'0.75rem 1rem',marginBottom:'1.25rem',lineHeight:'1.6'}}>
              Indicate interest below. Employers do not receive your contact details until mutual interest is confirmed.
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={()=>setSelectedJob(null)}>Close</button>
              {interestedJobIds.has(selectedJob.id) ? (
                <button className="btn-outline" disabled style={{opacity:0.6,cursor:'default'}}>
                  ✓ Interest Sent
                </button>
              ) : !authUser ? (
                <button className="btn-primary" onClick={()=>{setSelectedJob(null); if(requestSignIn) requestSignIn('early-careers'); else goToView('intern-profile');}}>
                  Sign In to Indicate Interest
                </button>
              ) : !studentProfile ? (
                <button className="btn-primary" onClick={()=>{setSelectedJob(null); goToView('intern-profile');}}>
                  Complete Profile to Indicate Interest
                </button>
              ) : (
                <button className="btn-primary" disabled={indicating} onClick={()=>indicateInterest(selectedJob)}>
                  {indicating ? 'Recording…' : 'Indicate Interest'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showEmployerModal && (
        <InternEmployerModal onClose={()=>setShowEmployerModal(false)} showToast={showToast} />
      )}
    </div>
  );
}

// ── INTERN EMPLOYER POSTING MODAL ─────────────────────────────────────────────
function InternEmployerModal({ onClose, showToast }) {
  const [step, setStep]   = useState('tos');
  const [loading, setLoading] = useState(false);
  const [done, setDone]   = useState(false);
  const [form, setForm] = useState({
    employer_name:'', employer_email:'', employer_confidential:false,
    title:'', industry:'', function_area:'', role_summary:'', project_description:'',
    location:'', work_arrangement:'hybrid', season:'summer',
    start_date:'', end_date:'', hours_per_week:'full_time',
    is_paid:true, compensation_type:'hourly', compensation_amount:'', compensation_display:'',
    required_majors:'', required_skills:'', preferred_skills:'',
    gpa_minimum:'', sponsorship_available:false,
  });
  function set(k,v) { setForm(p=>({...p,[k]:v})); }

  async function submit() {
    if (!form.employer_email || !form.title) { showToast('Company email and role title required.'); return; }
    setLoading(true);
    await sb.from('fed_intern_submissions').insert({
      employer_name:    form.employer_name,
      employer_email:   form.employer_email,
      title:            form.title,
      season:           form.season,
      location:         form.location,
      industry:         form.industry,
      role_summary:     form.role_summary,
      compensation_display: form.compensation_display,
      is_paid:          form.is_paid,
      required_majors:  form.required_majors ? form.required_majors.split(',').map(s=>s.trim()).filter(Boolean) : [],
      required_skills:  form.required_skills  ? form.required_skills.split(',').map(s=>s.trim()).filter(Boolean) : [],
      work_arrangement: form.work_arrangement,
      sponsorship_available: form.sponsorship_available,
    });
    // Notify admin
    fetch('/api/notify-posting', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...form, role_title: form.title, type:'intern_posting' }),
    }).catch(()=>{});
    setDone(true);
    setLoading(false);
  }

  if (done) return (
    <div className="modal-overlay">
      <div className="workflow-modal" style={{textAlign:'center',padding:'3rem 2rem'}}>
        <div style={{fontSize:'2rem',marginBottom:'1rem'}}>✓</div>
        <div className="workflow-modal-title" style={{marginBottom:'0.5rem'}}>Internship Posting Submitted</div>
        <div style={{fontSize:'0.875rem',color:'var(--ink-4)',marginBottom:'2rem',lineHeight:'1.6'}}>
          Reviewed within 24 hours. Once approved, your internship will be live and candidates will begin matching based on structured profiles.
        </div>
        <div className="employer-notice">
          <strong>Employer reminder:</strong> Fredheim uses structured candidate profiles for initial matching. Resume exchange occurs after mutual interest and is handled directly between the parties.
        </div>
        <button className="btn-primary" style={{marginTop:'1.5rem'}} onClick={onClose}>Close</button>
      </div>
    </div>
  );

  if (step === 'tos') return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="workflow-modal">
        <div className="workflow-modal-title">Post an Internship</div>
        <div className="workflow-modal-sub">Fredheim Early Careers — Founding Employer Program 2026</div>
        <div className="employer-notice">
          <strong>Structured Profile Matching.</strong> Fredheim uses structured candidate profiles for initial matching. Resume exchange occurs after mutual interest and is handled directly between the parties unless a secure document-exchange feature is later enabled. You will not be able to filter candidates by resume availability through this platform.
        </div>
        <div style={{fontSize:'0.82rem',color:'var(--ink-2)',lineHeight:'1.6',marginBottom:'1.25rem'}}>
          By posting on Fredheim Early Careers, you agree to use the platform's structured matching workflow and not solicit candidates to share resumes or personal documents during the initial platform interaction.
        </div>
        <div className="workflow-actions">
          <button className="workflow-close-btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={()=>setStep('form')}>I Agree — Continue</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="workflow-modal" style={{maxWidth:600}}>
        <div className="workflow-modal-title">Internship Details</div>
        <div style={{display:'grid',gap:'0.75rem'}}>
          {[{k:'employer_name',l:'Company Name *',ph:'Your company name'},{k:'employer_email',l:'Contact Email *',ph:'hr@yourcompany.com'},{k:'title',l:'Internship Title *',ph:'e.g. Supply Chain Analyst Intern'}].map(f=>(
            <div key={f.k} className="form-group">
              <label className="form-label">{f.l}</label>
              <input className="form-input" placeholder={f.ph} value={form[f.k]} onChange={e=>set(f.k,e.target.value)} />
            </div>
          ))}
          <label className="prefs-check-item">
            <input type="checkbox" checked={form.employer_confidential} onChange={e=>set('employer_confidential',e.target.checked)} />
            <span style={{fontSize:'0.82rem'}}>Keep company name confidential in listings</span>
          </label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div className="form-group">
              <label className="form-label">Industry</label>
              <select className="form-input" value={form.industry} onChange={e=>set('industry',e.target.value)}>
                <option value="">Select…</option>
                {INDUSTRY_OPTIONS.map(i=><option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Season</label>
              <select className="form-input" value={form.season} onChange={e=>set('season',e.target.value)}>
                {Object.entries(INTERN_SEASONS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" placeholder="City, State or Remote" value={form.location} onChange={e=>set('location',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Work Arrangement</label>
              <select className="form-input" value={form.work_arrangement} onChange={e=>set('work_arrangement',e.target.value)}>
                <option value="onsite">On-site</option><option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option><option value="flexible">Flexible</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hours Per Week</label>
              <select className="form-input" value={form.hours_per_week} onChange={e=>set('hours_per_week',e.target.value)}>
                {Object.entries(INTERN_HOURS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Compensation</label>
              <input className="form-input" placeholder="e.g. $22/hr or $5,000 stipend" value={form.compensation_display} onChange={e=>set('compensation_display',e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Role Summary *</label>
            <textarea className="form-input" rows={3} style={{resize:'vertical'}} placeholder="Describe the internship — what will the intern work on?"
              value={form.role_summary} onChange={e=>set('role_summary',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Preferred Majors (comma-separated)</label>
            <input className="form-input" placeholder="e.g. Supply Chain, Logistics, Engineering" value={form.required_majors} onChange={e=>set('required_majors',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Required Skills (comma-separated)</label>
            <input className="form-input" placeholder="e.g. Excel, SQL, AutoCAD" value={form.required_skills} onChange={e=>set('required_skills',e.target.value)} />
          </div>
          <label className="prefs-check-item">
            <input type="checkbox" checked={form.sponsorship_available} onChange={e=>set('sponsorship_available',e.target.checked)} />
            <span style={{fontSize:'0.82rem'}}>Visa sponsorship available for this role</span>
          </label>
          <label className="prefs-check-item">
            <input type="checkbox" checked={form.is_paid} onChange={e=>set('is_paid',e.target.checked)} />
            <span style={{fontSize:'0.82rem'}}>This is a paid internship</span>
          </label>
        </div>
        <div className="workflow-actions" style={{marginTop:'1.5rem'}}>
          <button className="workflow-close-btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── INTERN CANDIDATE SECTION (dashboard) ──────────────────────────────────────
function InternCandidateSection({ authUser, showToast, goToView }) {
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.email) return;
    const emailLc = authUser.email.toLowerCase();
    Promise.all([
      sb.from('fed_intern_profiles').select('*').eq('email', emailLc).maybeSingle(),
      sb.from('fed_intern_interests').select('*, fed_intern_jobs(*)').eq('candidate_email', emailLc).not('status','in','("candidate_hidden","expired")').order('created_at',{ascending:false}),
    ]).then(([{data:p},{data:m}]) => {
      setProfile(p);
      setMatches(m||[]);
      setLoading(false);
    });
  }, [authUser?.email]);

  if (loading) return <div style={{padding:'2rem',textAlign:'center',color:'var(--ink-4)'}}><span className="spinner"/></div>;

  if (!profile) return (
    <div className="intern-profile-card">
      <div className="intern-profile-card-title">Early Careers — Student Profile</div>
      <div style={{fontSize:'0.875rem',color:'var(--ink-4)',lineHeight:'1.6',marginBottom:'1.25rem'}}>
        You don't have a student profile yet. Complete your matching profile to be considered for internship opportunities in maritime, energy, and logistics.
        <br/><br/>
        <strong>No resume upload required.</strong> Your structured profile is used for all initial matching.
      </div>
      <button className="btn-primary" onClick={()=>goToView('intern-profile')}>Complete Matching Profile</button>
    </div>
  );

  const ARRANGEMENT_LABEL = {onsite:'On-site',hybrid:'Hybrid',remote:'Remote',flexible:'Flexible'};
  const completenessScore = [
    profile.school_university, profile.major, profile.graduation_year,
    profile.preferred_industries?.length, profile.profile_summary,
    profile.work_arrangement_pref, profile.availability_start_date,
    profile.technical_skills?.length||profile.software_skills?.length,
  ].filter(Boolean).length;
  const completePct = Math.round((completenessScore / 8) * 100);

  return (
    <div>
      {/* Profile summary card */}
      <div className="intern-profile-card" style={{marginBottom:'1px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'0.75rem'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:'0.625rem',marginBottom:'0.375rem'}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1rem',color:'var(--ink)'}}>
                {profile.school_university || 'Student Profile'}
              </div>
              {profile.tier === 'featured' && <span className="intern-featured-badge">★ Featured</span>}
            </div>
            <div style={{fontSize:'0.8rem',color:'var(--ink-3)'}}>
              {profile.major}{profile.graduation_year ? ` · Class of ${profile.graduation_year}` : ''}
              {profile.gpa_disclosed && profile.gpa ? ` · GPA ${profile.gpa}` : ''}
            </div>
            {profile.location && <div style={{fontSize:'0.75rem',color:'var(--ink-4)',marginTop:'0.2rem'}}>{profile.location}</div>}
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.58rem',letterSpacing:'0.1em',color:'var(--ink-4)',marginBottom:'0.25rem'}}>PROFILE COMPLETENESS</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:completePct>=75?'var(--green)':'var(--gold)'}}>{completePct}%</div>
            <button className="admin-action-btn" style={{marginTop:'0.375rem',fontSize:'0.65rem'}} onClick={()=>goToView('intern-profile')}>
              Update Profile
            </button>
          </div>
        </div>

        {/* Availability tags */}
        <div className="intern-job-tags" style={{marginTop:'0.875rem'}}>
          {(profile.internship_seasons||[]).map(s=><span key={s} className="intern-tag season">{INTERN_SEASONS[s]}</span>)}
          {profile.work_arrangement_pref && <span className="intern-tag">{ARRANGEMENT_LABEL[profile.work_arrangement_pref]||profile.work_arrangement_pref}</span>}
          {profile.willing_to_relocate && <span className="intern-tag">Open to Relocation</span>}
          {profile.sponsorship_required && <span className="intern-tag">Sponsorship Required</span>}
          {!profile.sponsorship_required && <span className="intern-tag">No Sponsorship Needed</span>}
        </div>

        {/* Profile optimization checklist (featured feature) */}
        {profile.tier === 'featured' && (
          <div style={{marginTop:'1rem',paddingTop:'1rem',borderTop:'1px solid var(--rule)'}}>
            <div className="intern-filter-title" style={{marginBottom:'0.5rem'}}>Profile Optimization</div>
            {[
              {label:'School & academic info', done:!!profile.school_university},
              {label:'Availability & location', done:!!profile.availability_start_date},
              {label:'Industry interests', done:(profile.preferred_industries||[]).length>0},
              {label:'Skills added', done:(profile.technical_skills||[]).length>0||(profile.software_skills||[]).length>0},
              {label:'Project experience', done:(profile.project_experience||[]).length>0},
              {label:'Profile summary', done:!!profile.profile_summary},
              {label:'Portfolio or project links', done:!!profile.portfolio_url||!!profile.linkedin_url||(profile.project_links?.length>0)},
            ].map(item=>(
              <div key={item.label} style={{display:'flex',gap:'0.5rem',alignItems:'center',fontSize:'0.78rem',marginBottom:'0.25rem',color:item.done?'var(--green)':'var(--ink-4)'}}>
                <span>{item.done?'✓':'○'}</span>{item.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upgrade prompt for free users */}
      {profile.tier === 'free' && completePct >= 50 && (
        <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-rule)',borderLeft:'3px solid var(--gold)',padding:'1rem 1.25rem',marginBottom:'1px'}}>
          <div style={{fontSize:'0.875rem',color:'var(--ink-2)',lineHeight:'1.5'}}>
            <strong>Upgrade to Featured Student Profile — $49/yr</strong><br/>
            Higher visibility, profile view analytics, and profile optimization checklist. No resume upload required.
          </div>
          <button className="btn-primary" style={{marginTop:'0.75rem',fontSize:'0.78rem'}} onClick={()=>goToView('intern-profile')}>
            Upgrade to Featured
          </button>
        </div>
      )}

      {/* Active interest / matches */}
      <div className="intern-profile-card">
        <div className="intern-profile-card-title">Your Internship Interests</div>
        {matches.length === 0 ? (
          <div style={{fontSize:'0.82rem',color:'var(--ink-4)',lineHeight:'1.6'}}>
            No active interests yet. Browse internship opportunities and indicate interest — employers are notified without receiving your contact details until mutual interest.
            <div style={{marginTop:'0.875rem'}}>
              <button className="admin-action-btn" onClick={()=>goToView('early-careers')}>Browse Internships →</button>
            </div>
          </div>
        ) : matches.map(m => {
          const job = m.fed_intern_jobs;
          return (
            <div key={m.id} style={{borderBottom:'1px solid var(--rule-lt)',paddingBottom:'0.875rem',marginBottom:'0.875rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'0.75rem',flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:'0.9rem',color:'var(--ink)',fontFamily:"'Playfair Display',serif"}}>{job?.title||'Role'}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--ink-4)'}}>{job?.employer_confidential?'Confidential Employer':job?.employer_display||job?.employer_name} · {job?.industry}</div>
                </div>
                <span className={`match-status-badge ${m.status==='mutual_interest'?'mutual':m.status==='employer_interested'?'recruiter-interested':m.status==='candidate_interested'?'candidate-interested':''}`}>
                  {m.status==='matched'?'Matched':m.status==='candidate_interested'?'Interest Sent':m.status==='employer_interested'?'Employer Interested':m.status==='mutual_interest'?'⬤ Mutual Interest':m.status.replace(/_/g,' ')}
                </span>
              </div>
              {m.match_explanation && <div className="match-explanation" style={{marginTop:'0.375rem'}}>{m.match_explanation}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CANDIDATE COMPENSATION POSITIONING PANEL ─────────────────────────────────
// Dashboard-level advisory. Not per-match — aggregate view across active roles.
// Advisory, not judgmental. Includes required transparency disclaimer.
function CandidateCompPositioning({ profile, matches, jobs }) {
  const prefs = parsePrefs(profile);
  const candTarget = prefs.comp_target_base || prefs.comp_base_min || profile?.salary_min;

  if (!candTarget) {
    return (
      <div className="comp-position-panel">
        <div className="comp-position-title">Compensation Positioning</div>
        <div className="comp-position-advisory">
          Add your target compensation in the Preferences section to enable compensation positioning.
          This helps match you with roles where your expectations align with the posted range.
        </div>
      </div>
    );
  }

  // Compute alignment across all active matched jobs
  const jobsById = {};
  (jobs || []).forEach(j => { jobsById[j.id] = j; });

  const alignments = (matches || [])
    .filter(m => !['expired','candidate_hidden','candidate_declined'].includes(m.status))
    .map(m => {
      const job = jobsById[m.job_id] || m.fed_jobs;
      if (!job) return null;
      return computeCompAlignment(profile, job, []);
    })
    .filter(Boolean);

  const insufficient = alignments.filter(a => a.category === 'Insufficient Data').length;
  const outOfRange   = alignments.filter(a => a.category === 'Out of Range').length;
  const premium      = alignments.filter(a => ['Premium but Defensible','Slight Premium'].includes(a.category)).length;
  const aligned      = alignments.filter(a => ['Market Aligned','Below Market'].includes(a.category)).length;
  const total        = alignments.length - insufficient;

  // Generate advisory
  let advisory;
  if (total === 0) {
    advisory = 'No active role matches with compensation data available yet. As more roles post and you indicate interest, your compensation positioning will be shown here.';
  } else if (outOfRange >= Math.ceil(total * 0.5)) {
    advisory = `Your target compensation (${fmt$(candTarget)} base) is above the posted range for ${outOfRange} of ${total} active role${total!==1?'s':''}. ` +
      'To strengthen positioning, consider targeting roles with higher authority (P&L, board exposure, larger teams), or update your value-factor inputs (years of experience, team size managed, revenue responsibility) so the indicator can better assess your fit.';
  } else if (premium >= Math.ceil(total * 0.4)) {
    advisory = `Your target compensation positions you at a premium relative to some posted ranges. ` +
      (prefs.authority_pnl || prefs.team_size_managed > 10
        ? 'Your P&L scope and leadership experience provide reasonable justification. Ensure your profile reflects your full commercial authority and revenue responsibility.'
        : 'Strengthen your positioning by completing the Authority and Value Factors sections — P&L scope, team size, and revenue responsibility are the strongest justifiers for premium compensation.');
  } else if (aligned >= Math.ceil(total * 0.6)) {
    advisory = `Your target compensation (${fmt$(candTarget)} base) is aligned with the posted ranges for the majority of your active matches. Your compensation profile is competitive for your target roles.`;
  } else {
    advisory = `Your compensation positioning varies across your active matches. Where your target is above range, completing the Authority and Value Factors fields helps the indicator assess whether your premium is justified by scope and experience.`;
  }

  const hasPnlData       = prefs.authority_pnl != null;
  const hasYearsData     = prefs.years_relevant_experience != null;
  const hasTeamData      = prefs.team_size_managed != null;
  const hasRevenueData   = prefs.revenue_responsibility_usd != null;
  const missingFactors   = [!hasPnlData && 'P&L authority', !hasYearsData && 'years of experience', !hasTeamData && 'team size', !hasRevenueData && 'revenue responsibility'].filter(Boolean);

  return (
    <div className="comp-position-panel">
      <div className="comp-position-title">Compensation Positioning</div>
      {total > 0 && (
        <div style={{display:'flex',gap:'0.875rem',flexWrap:'wrap',marginBottom:'0.75rem'}}>
          {aligned  > 0 && <div style={{textAlign:'center'}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',color:'var(--green)'}}>{aligned}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.55rem',color:'var(--ink-4)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Aligned</div></div>}
          {premium  > 0 && <div style={{textAlign:'center'}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',color:'var(--gold)'}}>{premium}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.55rem',color:'var(--ink-4)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Premium</div></div>}
          {outOfRange > 0 && <div style={{textAlign:'center'}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',color:'#c0392b'}}>{outOfRange}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.55rem',color:'var(--ink-4)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Out of Range</div></div>}
          {insufficient > 0 && <div style={{textAlign:'center'}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',color:'var(--ink-4)'}}>{insufficient}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.55rem',color:'var(--ink-4)',letterSpacing:'0.1em',textTransform:'uppercase'}}>No Data</div></div>}
        </div>
      )}
      <div className="comp-position-advisory">{advisory}</div>
      {missingFactors.length > 0 && (
        <div style={{marginTop:'0.625rem',fontSize:'0.72rem',color:'var(--ink-4)',lineHeight:'1.5'}}>
          <strong>Improve accuracy:</strong> Add {missingFactors.join(', ')} to the Compensation tab of your preferences.
        </div>
      )}
      <div className="comp-align-disclaimer" style={{marginTop:'0.75rem'}}>
        Compensation positioning is an estimate based on your profile, stated preferences, and available role data. It is not a guarantee of market value, interview likelihood, or employment outcome.
      </div>
    </div>
  );
}

// ── ADMIN COMPENSATION BENCHMARKS TAB ────────────────────────────────────────
function AdminCompBenchmarksTab({ showToast }) {
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null); // null or row object
  const [saving, setSaving]         = useState(false);

  const ROLE_LEVELS = [
    ['c_suite','C-Suite'],['vp_svp','VP / SVP'],['director','Director'],
    ['senior_manager','Senior Manager'],['manager','Manager'],['individual_contributor','Individual Contributor'],
  ];
  const GEOS = [['national','National'],['gulf_coast','Gulf Coast'],['southeast','Southeast'],['southwest','Southwest'],['northeast','Northeast'],['midwest','Midwest'],['west','West'],['international','International']];

  useEffect(() => {
    sb.from('fed_comp_benchmarks').select('*').order('role_level').order('industry').then(({data})=>{
      setBenchmarks(data||[]);
      setLoading(false);
    });
  }, []);

  function fmt$(n) { if (!n) return '—'; return `$${(n/1000).toFixed(0)}K`; }

  async function save() {
    setSaving(true);
    if (editing.id) {
      await sb.from('fed_comp_benchmarks').update(editing).eq('id', editing.id);
    } else {
      const { data } = await sb.from('fed_comp_benchmarks').insert(editing).select('*').single();
      if (data) setBenchmarks(p => [data, ...p]);
    }
    await sb.from('fed_comp_benchmarks').select('*').order('role_level').order('industry').then(({data})=>setBenchmarks(data||[]));
    setEditing(null);
    setSaving(false);
    showToast('✓ Benchmark saved.');
  }

  async function toggleActive(id, active) {
    await sb.from('fed_comp_benchmarks').update({is_active:!active}).eq('id',id);
    setBenchmarks(p=>p.map(b=>b.id===id?{...b,is_active:!active}:b));
    showToast(active ? 'Benchmark disabled.' : 'Benchmark enabled.');
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',color:'var(--ink)'}}>Compensation Benchmarks</div>
          <div style={{fontSize:'0.75rem',color:'var(--ink-4)',marginTop:'0.2rem'}}>
            Admin-configurable reference ranges. Used as secondary source when job postings lack explicit comp ranges.
            Primary source is always the job posting's comp_base_min/max. Candidates and recruiters cannot view this table directly.
          </div>
        </div>
        <button className="admin-action-btn approve" onClick={()=>setEditing({
          role_level:'director', industry:'Maritime & Shipping', geography:'national',
          base_p25:null, base_p50:null, base_p75:null,
          total_comp_p25:null, total_comp_p50:null, total_comp_p75:null,
          typical_bonus_pct_low:null, typical_bonus_pct_high:null,
          data_source:'admin_configured', is_active:true, admin_notes:'',
        })}>+ Add Benchmark</button>
      </div>

      {loading ? <div className="admin-empty"><span className="spinner"/>Loading…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Role Level</th><th>Industry</th><th>Geography</th>
                <th>Base P25/P50/P75</th><th>Total Comp P50</th><th>Bonus %</th>
                <th>Source</th><th>Active</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map(b=>(
                <tr key={b.id} style={!b.is_active?{opacity:0.5,background:'var(--paper-2)'}:{}}>
                  <td style={{fontSize:'0.78rem'}}>{ROLE_LEVELS.find(([v])=>v===b.role_level)?.[1]||b.role_level}</td>
                  <td style={{fontSize:'0.75rem'}}>{b.industry||'All industries'}</td>
                  <td style={{fontSize:'0.72rem'}}>{b.geography||'national'}</td>
                  <td className="bench-range-cell">{fmt$(b.base_p25)} / {fmt$(b.base_p50)} / {fmt$(b.base_p75)}</td>
                  <td className="bench-range-cell">{fmt$(b.total_comp_p50)}</td>
                  <td style={{fontSize:'0.72rem'}}>{b.typical_bonus_pct_low}–{b.typical_bonus_pct_high}%</td>
                  <td><span className={`admin-pill ${b.data_source==='internal_placements'?'posted':''}`} style={{fontSize:'0.6rem'}}>{b.data_source?.replace(/_/g,' ')}</span></td>
                  <td style={{textAlign:'center'}}>{b.is_active ? '✓' : '—'}</td>
                  <td>
                    <div style={{display:'flex',gap:'0.375rem'}}>
                      <button className="admin-action-btn" style={{fontSize:'0.6rem'}} onClick={()=>setEditing({...b})}>Edit</button>
                      <button className={`admin-action-btn ${b.is_active?'danger':'approve'}`} style={{fontSize:'0.6rem'}} onClick={()=>toggleActive(b.id,b.is_active)}>
                        {b.is_active?'Disable':'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setEditing(null);}}>
          <div className="workflow-modal" style={{maxWidth:600}}>
            <div className="workflow-modal-title">{editing.id ? 'Edit Benchmark' : 'New Benchmark'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem',marginBottom:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Role Level</label>
                <select className="form-input" value={editing.role_level||''} onChange={e=>setEditing(p=>({...p,role_level:e.target.value}))}>
                  {ROLE_LEVELS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Industry (blank = all)</label>
                <input className="form-input" placeholder="Maritime & Shipping" value={editing.industry||''} onChange={e=>setEditing(p=>({...p,industry:e.target.value||null}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Geography</label>
                <select className="form-input" value={editing.geography||'national'} onChange={e=>setEditing(p=>({...p,geography:e.target.value}))}>
                  {GEOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:'0.5rem'}}>Base Salary Percentiles ($)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem',marginBottom:'1rem'}}>
              {[['base_p25','P25'],['base_p50','P50 (Median)'],['base_p75','P75']].map(([k,l])=>(
                <div key={k} className="form-group">
                  <label className="form-label">{l}</label>
                  <input className="form-input" type="number" value={editing[k]||''} onChange={e=>setEditing(p=>({...p,[k]:e.target.value?parseInt(e.target.value):null}))} />
                </div>
              ))}
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:'0.5rem'}}>Total Compensation Percentiles ($)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem',marginBottom:'1rem'}}>
              {[['total_comp_p25','P25'],['total_comp_p50','P50'],['total_comp_p75','P75']].map(([k,l])=>(
                <div key={k} className="form-group">
                  <label className="form-label">{l}</label>
                  <input className="form-input" type="number" value={editing[k]||''} onChange={e=>setEditing(p=>({...p,[k]:e.target.value?parseInt(e.target.value):null}))} />
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem',marginBottom:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Bonus % Low</label>
                <input className="form-input" type="number" value={editing.typical_bonus_pct_low||''} onChange={e=>setEditing(p=>({...p,typical_bonus_pct_low:e.target.value?parseFloat(e.target.value):null}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Bonus % High</label>
                <input className="form-input" type="number" value={editing.typical_bonus_pct_high||''} onChange={e=>setEditing(p=>({...p,typical_bonus_pct_high:e.target.value?parseFloat(e.target.value):null}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Data Source</label>
                <select className="form-input" value={editing.data_source||'admin_configured'} onChange={e=>setEditing(p=>({...p,data_source:e.target.value}))}>
                  <option value="admin_configured">Admin Configured</option>
                  <option value="internal_placements">Internal Placements</option>
                  <option value="external_import">External Import</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Admin Notes</label>
              <textarea className="form-input" rows={2} style={{resize:'vertical'}} value={editing.admin_notes||''} onChange={e=>setEditing(p=>({...p,admin_notes:e.target.value}))} />
            </div>
            <label className="prefs-check-item" style={{marginBottom:'1.25rem'}}>
              <input type="checkbox" checked={!!editing.is_active} onChange={e=>setEditing(p=>({...p,is_active:e.target.checked}))} />
              <span style={{fontSize:'0.82rem'}}>Active — use this benchmark in compensation alignment</span>
            </label>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={()=>setEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save Benchmark'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN INTERN TAB ─────────────────────────────────────────────────────────
function AdminInternTab({ showToast }) {
  const [submissions, setSubmissions] = useState([]);
  const [profiles, setProfiles]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [ctab, setCtab]               = useState('submissions');

  useEffect(() => {
    Promise.all([
      sb.from('fed_intern_submissions').select('*').order('created_at',{ascending:false}),
      sb.from('fed_intern_profiles').select('email,school_university,major,graduation_year,tier,visibility,profile_completeness_pct,internship_seasons,preferred_industries,created_at').order('created_at',{ascending:false}).limit(100),
    ]).then(([{data:s},{data:p}]) => {
      setSubmissions(s||[]);
      setProfiles(p||[]);
      setLoading(false);
    });
  }, []);

  function fmt(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}); }

  async function publishSubmission(sub) {
    const { data: job, error } = await sb.from('fed_intern_jobs').insert({
      employer_name:         sub.employer_name,
      employer_display:      sub.employer_name,
      employer_code:         (sub.employer_name||'XX').slice(0,2).toUpperCase(),
      employer_email:        sub.employer_email,
      title:                 sub.title,
      industry:              sub.industry,
      season:                sub.season,
      location:              sub.location,
      work_arrangement:      sub.work_arrangement,
      role_summary:          sub.role_summary,
      is_paid:               sub.is_paid,
      compensation_display:  sub.compensation_display,
      required_majors:       sub.required_majors||[],
      required_skills:       sub.required_skills||[],
      sponsorship_available: sub.sponsorship_available,
      status:                'active',
    }).select('id').single();
    if (error) { showToast('Publish failed: '+error.message); return; }
    await sb.from('fed_intern_submissions').update({status:'posted'}).eq('id',sub.id);
    setSubmissions(p=>p.map(s=>s.id===sub.id?{...s,status:'posted'}:s));
    showToast('✓ Internship posted.');
  }

  return (
    <div>
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--rule)',marginBottom:'1.5rem'}}>
        {[['submissions','Employer Submissions'],['profiles','Student Profiles']].map(([v,l])=>(
          <button key={v} className={`admin-tab ${ctab===v?'active':''}`} onClick={()=>setCtab(v)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="admin-empty"><span className="spinner"/>Loading…</div> : ctab === 'submissions' ? (
        <div className="admin-table-wrap">
          {submissions.length === 0 ? <div className="admin-empty">No employer submissions yet.</div> : (
            <table className="admin-table">
              <thead>
                <tr><th>Date</th><th>Employer</th><th>Role</th><th>Season</th><th>Paid</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {submissions.map(s=>(
                  <tr key={s.id}>
                    <td>{fmt(s.created_at)}</td>
                    <td style={{fontSize:'0.78rem'}}><strong>{s.employer_name}</strong><br/><span style={{color:'var(--ink-4)'}}>{s.employer_email}</span></td>
                    <td><strong>{s.title}</strong><div style={{fontSize:'0.72rem',color:'var(--ink-4)'}}>{s.industry} · {s.location}</div></td>
                    <td style={{fontSize:'0.75rem'}}>{INTERN_SEASONS[s.season]||s.season}</td>
                    <td>{s.is_paid ? <span style={{color:'var(--green)',fontSize:'0.75rem'}}>Paid</span> : <span style={{color:'var(--ink-4)',fontSize:'0.75rem'}}>Unpaid</span>}</td>
                    <td><span className={`admin-pill ${s.status}`}>{s.status}</span></td>
                    <td>
                      {s.status === 'pending' && (
                        <div style={{display:'flex',gap:'0.375rem'}}>
                          <button className="admin-action-btn approve" onClick={async()=>{
                            await sb.from('fed_intern_submissions').update({status:'approved'}).eq('id',s.id);
                            setSubmissions(p=>p.map(x=>x.id===s.id?{...x,status:'approved'}:x));
                            showToast('Approved.');
                          }}>Approve</button>
                        </div>
                      )}
                      {s.status === 'approved' && (
                        <button className="admin-action-btn publish" onClick={()=>publishSubmission(s)}>Publish</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div>
          <div style={{fontSize:'0.78rem',color:'var(--ink-4)',marginBottom:'1rem'}}>
            {profiles.length} student profiles. No resume data — profiles use structured fields only.
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Email</th><th>School</th><th>Major</th><th>Grad Year</th><th>Seasons</th><th>Tier</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {profiles.map(p=>(
                  <tr key={p.email}>
                    <td style={{fontSize:'0.75rem'}}>{p.email}</td>
                    <td style={{fontSize:'0.78rem'}}>{p.school_university||'—'}</td>
                    <td style={{fontSize:'0.78rem'}}>{p.major||'—'}</td>
                    <td style={{fontSize:'0.78rem',textAlign:'center'}}>{p.graduation_year||'—'}</td>
                    <td style={{fontSize:'0.72rem'}}>{(p.internship_seasons||[]).map(s=>INTERN_SEASONS[s]||s).join(', ')||'—'}</td>
                    <td><span className={`admin-pill ${p.tier==='featured'?'posted':''}`}>{p.tier||'free'}</span></td>
                    <td style={{fontSize:'0.72rem'}}>{fmt(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ACTIVITY FEED ────────────────────────────────────────────────────────────
function ActivityFeed({ location, limit }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/marketplace-activity?location=${location||'landing'}&limit=${limit||5}`)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location, limit]);

  function timeAgo(ts) {
    if (!ts) return '';
    const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
    if (d === 0)  return 'today';
    if (d === 1)  return 'yesterday';
    if (d < 7)   return 'this week';
    if (d < 14)  return 'last week';
    if (d < 30)  return 'this month';
    return `${Math.floor(d/30)}mo ago`;
  }

  if (!loading && items.length === 0) return null;

  return loading ? (
    <div className="activity-empty"><span className="spinner"/></div>
  ) : (
    <div className="activity-list">
      {items.map(item => (
        <div key={item.id} className="activity-item">
          <div className="activity-dot"/>
          <div className="activity-body">
            <div className="activity-summary">{item.public_summary}</div>
            <div className="activity-meta">
              {item.sector     && <span className="activity-tag">{item.sector}</span>}
              {item.region     && <span className="activity-tag">{item.region}</span>}
              {item.role_level && <span className="activity-tag">{item.role_level}</span>}
              <span className="activity-tag verified">✓ Verified</span>
              <span className="activity-time">{timeAgo(item.published_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SOCIAL PROOF SECTION — leaderboard + activity feed, clearly separated ─────
function SocialProofSection() {
  const [lbData, setLbData]       = useState(null);
  const [lbPeriod, setLbPeriod]   = useState('12m');
  const [lbLoading, setLbLoading] = useState(true);

  useEffect(() => {
    setLbLoading(true);
    fetch(`/api/leaderboard?period=${lbPeriod}`)
      .then(r => r.json())
      .then(d => setLbData(d))
      .catch(() => setLbData({ leaderboard: [] }))
      .finally(() => setLbLoading(false));
  }, [lbPeriod]);

  const PERIODS = [['30d','30d'],['90d','90d'],['12m','12m'],['all','All']];
  const hasLb  = lbData?.leaderboard?.length > 0;

  // Don't render the entire section until we know if at least one side has data
  // (avoids empty white space on new deployments)
  const [actHasData, setActHasData] = useState(null); // null=loading, true/false=resolved

  useEffect(() => {
    fetch('/api/marketplace-activity?location=landing&limit=1')
      .then(r => r.json())
      .then(d => setActHasData((d.items||[]).length > 0))
      .catch(() => setActHasData(false));
  }, []);

  if (!lbLoading && !hasLb && actHasData === false) return null; // nothing to show

  return (
    <div className="social-proof-section">
      {/* LEFT — Top Performing Firms */}
      <div className="social-proof-block">
        <div className="social-proof-eyebrow">Verified Placements</div>
        <div className="social-proof-heading">Top Performing Firms</div>
        <div className="social-proof-subhead">
          Ranked by confirmed platform placements only. No self-reported numbers.
        </div>
        <div style={{display:'flex',gap:'0.375rem',marginBottom:'1rem'}}>
          {PERIODS.map(([v,l]) => (
            <button key={v} className={`leaderboard-filter ${lbPeriod===v?'active':''}`}
              onClick={()=>setLbPeriod(v)}>{l}</button>
          ))}
        </div>
        {lbLoading ? (
          <div className="activity-empty"><span className="spinner"/></div>
        ) : !hasLb ? (
          <div className="activity-empty">
            Rankings appear once placements are confirmed on the platform.
          </div>
        ) : (
          <div className="leaderboard-grid">
            {lbData.leaderboard.map((firm, idx) => (
              <div key={idx} className="leaderboard-card" style={{padding:'0.875rem 1.125rem'}}>
                <div className={`leaderboard-rank ${idx===0?'gold-rank':''}`} style={{fontSize:'1.25rem',minWidth:'1.75rem'}}>
                  {idx === 0 ? '★' : idx + 1}
                </div>
                <div className="leaderboard-firm">
                  <div className="leaderboard-firm-name" style={{fontSize:'0.875rem'}}>{firm.firm_name}</div>
                  {firm.industry_focus?.length > 0 && (
                    <div style={{fontSize:'0.68rem',color:'var(--ink-4)'}}>{firm.industry_focus.slice(0,2).join(' · ')}</div>
                  )}
                  {firm.verified && <div className="leaderboard-badges" style={{marginTop:'0.2rem'}}><span className="trust-badge">Verified</span></div>}
                </div>
                <div className="leaderboard-count">
                  <div className="leaderboard-count-num" style={{fontSize:'1.2rem'}}>{firm.placement_count}</div>
                  <div className="leaderboard-count-label">placed</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT — Recent Verified Activity */}
      <div className="social-proof-block">
        <div className="social-proof-eyebrow">Platform Activity</div>
        <div className="social-proof-heading">Recent Verified Activity</div>
        <div className="social-proof-subhead">
          Admin-verified events only. No unconfirmed placements, disputes, or unverified data.
        </div>
        <ActivityFeed location="landing" limit={5} />
      </div>
    </div>
  );
}

// ── PAYMENT GATE MODAL ────────────────────────────────────────────────────────
function PaymentGateModal({ reason, onClose, onRequestInvoice }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="workflow-modal">
        <div className="workflow-modal-title">Billing Required</div>
        <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-rule)',borderLeft:'3px solid var(--gold)',padding:'1rem 1.25rem',marginBottom:'1.5rem',fontSize:'0.875rem',color:'var(--ink-2)',lineHeight:'1.6'}}>
          {reason || 'Billing setup is required before publishing a job posting or accessing candidate matches.'}
        </div>
        <div style={{display:'grid',gap:'0.75rem',marginBottom:'1.5rem'}}>
          {[
            { label:'Select a Subscription', desc:'Monthly or annual plan. Subscriptions open January 2027. Join the waitlist.', action:null },
            { label:'Request Invoice Billing', desc:'Net-30 invoicing for approved firms. Billing contact and company verification required.', action: onRequestInvoice },
            { label:'Prepaid Posting Package', desc:'Purchase a block of job postings at a set rate. Available January 2027.', action:null },
          ].map((opt,i) => (
            <div key={i} className={`billing-option ${opt.action?'':'opacity-50'}`}
              onClick={opt.action || undefined}
              style={{cursor:opt.action?'pointer':'default',opacity:opt.action?1:0.55}}>
              <div className="billing-option-title">{opt.label}</div>
              <div className="billing-option-desc">{opt.desc}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:'0.78rem',color:'var(--ink-4)',marginBottom:'1.5rem',lineHeight:'1.5'}}>
          Questions? <a href="mailto:desk@fredheimtech.com" style={{color:'var(--gold)'}}>desk@fredheimtech.com</a>
        </div>
        <div className="workflow-actions">
          <button className="workflow-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── RECRUITER BILLING SETUP ───────────────────────────────────────────────────
function RecruiterBillingSetup({ onClose, showToast, onSuccess }) {
  const [step, setStep]     = useState('options'); // 'options' | 'invoice' | 'done'
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    invoice_company_name:'', invoice_company_address:'',
    invoice_contact_name:'', invoice_contact_email:'',
    invoice_po_required: false, invoice_billing_notes:'',
  });
  function set(k,v) { setForm(p => ({...p,[k]:v})); }

  async function submitInvoiceRequest() {
    if (!form.invoice_company_name || !form.invoice_contact_email) {
      showToast('Company name and billing email required.');
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch('/api/recruiter-billing', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${session?.access_token||''}` },
        body: JSON.stringify({ action:'request_invoice', ...form }),
      });
      const data = await resp.json();
      if (!resp.ok) { showToast(data.error || 'Submission failed.'); return; }
      setStep('done');
      if (onSuccess) onSuccess('invoice_billing_pending');
    } catch(e) { showToast('Error submitting request.'); }
    setLoading(false);
  }

  if (step === 'done') return (
    <div className="modal-overlay">
      <div className="workflow-modal" style={{textAlign:'center',padding:'3rem 2rem'}}>
        <div style={{fontSize:'2rem',marginBottom:'1rem'}}>✓</div>
        <div className="workflow-modal-title" style={{marginBottom:'0.5rem'}}>Invoice Billing Requested</div>
        <div style={{fontSize:'0.875rem',color:'var(--ink-4)',marginBottom:'2rem',lineHeight:'1.6'}}>
          The Fredheim team will review your request within 24 hours. You'll receive an email confirmation at your billing contact email.
          In the meantime, if you are within the 2026 Founding Partner period, you can continue posting.
        </div>
        <button className="btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="workflow-modal">
        {step === 'options' && (
          <div>
            <div className="workflow-modal-title">Set Up Billing</div>
            <div className="workflow-modal-sub">
              Select how you'd like to handle billing for Fredheim Executive Desk.
              Subscriptions and prepaid packages open January 2027.
            </div>
            <div style={{display:'grid',gap:'0.75rem',marginBottom:'1.5rem'}}>
              <div className="billing-option" onClick={()=>setStep('invoice')} style={{cursor:'pointer'}}>
                <div className="billing-option-title">Invoice Billing (Request Now)</div>
                <div className="billing-option-desc">Net-30 invoicing for approved firms. Provide billing contact and company details. Admin review within 24 hours.</div>
              </div>
              <div className="billing-option" style={{opacity:0.5,cursor:'default'}}>
                <div className="billing-option-title">Subscription — Available Jan 2027</div>
                <div className="billing-option-desc">Monthly and annual plans. Founding partners receive preferred pricing.</div>
              </div>
              <div className="billing-option" style={{opacity:0.5,cursor:'default'}}>
                <div className="billing-option-title">Prepaid Package — Available Jan 2027</div>
                <div className="billing-option-desc">Purchase a posting block in advance.</div>
              </div>
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {step === 'invoice' && (
          <div>
            <div className="workflow-modal-title">Invoice Billing Request</div>
            <div className="workflow-modal-sub">
              Provide your billing details. Admin will review and approve within 24 hours.
            </div>
            <div className="billing-setup-grid" style={{marginBottom:'1rem'}}>
              {[
                { k:'invoice_company_name',    label:'Company Legal Name *',  ph:'Company name as it appears on invoices' },
                { k:'invoice_contact_name',    label:'Billing Contact Name',  ph:'Name for invoices' },
                { k:'invoice_contact_email',   label:'Billing Email *',       ph:'billing@yourfirm.com' },
                { k:'invoice_company_address', label:'Company Address',       ph:'Full billing address' },
              ].map(f => (
                <div key={f.k} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" placeholder={f.ph} value={form[f.k]} onChange={e=>set(f.k,e.target.value)} />
                </div>
              ))}
            </div>
            <label style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',marginBottom:'1rem',cursor:'pointer',fontSize:'0.82rem'}}>
              <input type="checkbox" checked={form.invoice_po_required} onChange={e=>set('invoice_po_required',e.target.checked)} style={{marginTop:'0.15rem'}} />
              A purchase order number is required on invoices
            </label>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={2} value={form.invoice_billing_notes} onChange={e=>set('invoice_billing_notes',e.target.value)} style={{resize:'vertical'}} />
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={()=>setStep('options')}>← Back</button>
              <button className="btn-primary" onClick={submitInvoiceRequest} disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EXECUTIVE MATCH ENGINE ───────────────────────────────────────────────────
// Points budget (total 100):
//   Industry/vertical   20  — what sector they work in
//   Function/discipline 15  — commercial, operations, finance, etc.
//   Compensation        15  — base salary compatibility
//   Work arrangement    15  — on-site/hybrid/remote/travel
//   Authority match     15  — P&L, reports-to, direct reports
//   Mandate type        10  — growth/turnaround/professionalization
//   Location            10  — geography / relocation

const WORK_ARRANGEMENTS = {
  onsite:                  'On-site',
  hybrid_mostly_office:    'Hybrid — mostly office',
  hybrid_5050:             'Hybrid — 50/50',
  hybrid_mostly_remote:    'Hybrid — mostly remote',
  fully_remote:            'Fully remote',
  travel_based:            'Travel-based',
  field_based:             'Field / site / terminal',
  flexible:                'Flexible by agreement',
};

const MANDATE_TYPES = {
  growth:              'Growth',
  turnaround:          'Turnaround',
  professionalization: 'Professionalization',
  succession:          'Succession',
  replacement:         'Replacement hire',
  new_market:          'New market entry',
  greenfield:          'Greenfield / startup build',
  post_acquisition:    'Post-acquisition integration',
  cost_reduction:      'Cost reduction / optimization',
  digital_transformation: 'Digital transformation',
  commercial_expansion:'Commercial expansion',
  restructuring:       'Operational restructuring',
};

const COMPANY_TYPES = {
  family_owned:         'Family-owned',
  private_equity:       'Private equity-backed',
  public:               'Public company',
  founder_led:          'Founder-led',
  subsidiary:           'Subsidiary / division',
  jv:                   'Joint venture',
  startup:              'Startup',
  mature_operator:      'Mature operator',
  distressed:           'Distressed / turnaround',
  high_growth:          'High-growth',
  post_acquisition:     'Post-acquisition',
  pre_sale:             'Pre-sale / exit preparation',
  international_parent: 'International parent company',
};

const TECH_SKILLS = {
  port_terminal:        'Port / terminal operations',
  bulk_logistics:       'Bulk logistics',
  dry_bulk:             'Dry bulk',
  liquid_bulk:          'Liquid bulk',
  breakbulk:            'Breakbulk',
  containers:           'Containers',
  rail:                 'Rail',
  barge:                'Barge',
  ocean_freight:        'Ocean freight',
  chartering:           'Chartering',
  stevedoring:          'Stevedoring',
  warehousing:          'Warehousing',
  industrial_re:        'Industrial real estate',
  greenfield:           'Greenfield development',
  brownfield:           'Brownfield acquisition',
  union:                'Union labor',
  non_union:            'Non-union labor',
  hse:                  'HSE responsibility',
  regulatory:           'Regulatory / permitting',
};

function parsePrefs(profile) {
  const p = profile?.candidate_preferences;
  if (!p) return {};
  return typeof p === 'string' ? JSON.parse(p) : p;
}

function parseReqs(job) {
  const r = job?.job_requirements;
  if (!r) return {};
  return typeof r === 'string' ? JSON.parse(r) : r;
}

function computeMatchScore(candidate, job) {
  const prefs  = parsePrefs(candidate);
  const reqs   = parseReqs(job);
  const nn     = prefs.non_negotiables || {};

  let score = 0;
  const reasons   = {};
  const matched   = [];  // human-readable strong matches
  const gaps      = [];  // human-readable gaps
  let blocked     = false;
  let blockReason = null;

  // ═══ STEP 1: HARD FILTER — NON-NEGOTIABLES ════════════════════════════════
  // Any failure returns score 0 immediately. Recruiter sees score 0, no explanation.

  // Base salary non-negotiable
  if (nn.base_min && reqs.comp_base_max && reqs.comp_base_max < nn.base_min) {
    return { score: 0, reasons: {}, matched: [], gaps: [], blocked: true,
             blockReason: 'Compensation below candidate minimum requirement.',
             explanation: 'Not matched.' };
  }

  // Work arrangement non-negotiable
  if (nn.work_arrangement && reqs.work_arrangement &&
      nn.work_arrangement !== reqs.work_arrangement &&
      nn.work_arrangement !== 'flexible' && reqs.work_arrangement !== 'flexible') {
    // Check if they're close enough (remote-ish arrangements are compatible)
    const remoteGroup  = ['fully_remote','hybrid_mostly_remote'];
    const hybridGroup  = ['hybrid_mostly_office','hybrid_5050'];
    const onsiteGroup  = ['onsite','field_based'];
    const cGroup = [remoteGroup, hybridGroup, onsiteGroup].find(g => g.includes(nn.work_arrangement));
    const jGroup = [remoteGroup, hybridGroup, onsiteGroup].find(g => g.includes(reqs.work_arrangement));
    if (cGroup && jGroup && cGroup !== jGroup) {
      return { score: 0, reasons: {}, matched: [], gaps: [], blocked: true,
               blockReason: 'Work arrangement incompatible with candidate requirement.',
               explanation: 'Not matched.' };
    }
  }

  // Travel percentage non-negotiable
  if (nn.travel_pct_max != null && reqs.travel_pct != null &&
      reqs.travel_pct > nn.travel_pct_max) {
    return { score: 0, reasons: {}, matched: [], gaps: [], blocked: true,
             blockReason: 'Travel requirement exceeds candidate maximum.',
             explanation: 'Not matched.' };
  }

  // Relocation non-negotiable
  if (nn.relocation === false && reqs.relocation_required === true) {
    return { score: 0, reasons: {}, matched: [], gaps: [], blocked: true,
             blockReason: 'Relocation required but candidate is not open to relocation.',
             explanation: 'Not matched.' };
  }

  // P&L authority non-negotiable
  if (nn.pnl_required === true && reqs.pnl_responsibility === false) {
    return { score: 0, reasons: {}, matched: [], gaps: [], blocked: true,
             blockReason: 'Role does not include P&L responsibility — candidate non-negotiable.',
             explanation: 'Not matched.' };
  }

  // Company type exclusions
  if (nn.excluded_company_types?.length && reqs.company_type &&
      nn.excluded_company_types.includes(reqs.company_type)) {
    return { score: 0, reasons: {}, matched: [], gaps: [], blocked: true,
             blockReason: 'Company type excluded by candidate preference.',
             explanation: 'Not matched.' };
  }

  // ═══ STEP 2: SOFT SCORING (100 points total) ══════════════════════════════

  // ── INDUSTRY (20 pts) ────────────────────────────────────────────────────
  if (candidate?.industry && job?.industry) {
    const cI = candidate.industry.toLowerCase(), jI = job.industry.toLowerCase();
    const cW = cI.split(/[\s&,]+/), jW = jI.split(/[\s&,]+/);
    const overlap = cW.some(w => w.length > 3 && jW.some(jw => jw.length > 3 && (jw.includes(w) || w.includes(jw))));
    if (overlap || cI === jI) {
      score += 20; reasons.industry = true;
      matched.push('industry sector');
    } else {
      reasons.industry = false;
      gaps.push('industry sector differs');
    }
  } else {
    score += 10; reasons.industry = null; // partial credit — unknown
  }

  // Technical skills bonus (up to 5 pts from industry budget)
  const candidateTech = prefs.tech_experience || [];
  const requiredTech  = reqs.tech_required   || [];
  const preferredTech = reqs.tech_preferred  || [];
  const techRequired  = requiredTech.filter(t => candidateTech.includes(t)).length;
  const techPreferred = preferredTech.filter(t => candidateTech.includes(t)).length;
  if (requiredTech.length > 0) {
    const techScore = Math.round((techRequired / requiredTech.length) * 5);
    score += techScore;
    reasons.tech = techRequired === requiredTech.length ? true : techRequired > 0 ? 'partial' : false;
    if (techRequired === requiredTech.length) matched.push('technical experience');
    else if (techRequired === 0 && requiredTech.length > 0) gaps.push('required technical experience');
  }

  // ── FUNCTION / DISCIPLINE (15 pts) ──────────────────────────────────────
  if (candidate?.function && job?.function) {
    if (candidate.function.toLowerCase() === job.function.toLowerCase()) {
      score += 15; reasons.function = true;
      matched.push('functional discipline');
    } else {
      reasons.function = false;
      gaps.push('functional area');
    }
  } else { score += 7; reasons.function = null; }

  // ── COMPENSATION (15 pts) ─────────────────────────────────────────────────
  const candBase  = candidate?.salary_min || prefs.comp_base_min || null;
  const jobMaxPay = reqs.comp_base_max || job?.salary_max || null;
  const jobMinPay = reqs.comp_base_min || job?.salary_min || null;

  if (candBase && jobMaxPay && jobMaxPay > 1000) {
    if (candBase <= jobMaxPay) {
      score += 15; reasons.salary = true;
      if (jobMinPay && candBase >= jobMinPay * 0.9) matched.push('compensation range');
    } else {
      reasons.salary = false;
      gaps.push('compensation — candidate floor exceeds role maximum');
    }
  } else { score += 15; reasons.salary = null; }

  // Bonus/equity soft bonus (up to 3 extra pts captured in authority budget)
  if (prefs.comp_equity && reqs.comp_equity) { reasons.equity = true; }
  if (prefs.comp_ltip   && reqs.comp_ltip)   { reasons.ltip   = true; }

  // ── WORK ARRANGEMENT (15 pts) ────────────────────────────────────────────
  const candArrangement = prefs.work_arrangement;
  const jobArrangement  = reqs.work_arrangement;
  if (candArrangement && jobArrangement) {
    if (candArrangement === jobArrangement || candArrangement === 'flexible' || jobArrangement === 'flexible') {
      score += 15; reasons.work_arrangement = true;
      matched.push('work arrangement');
    } else {
      // Partial credit for adjacent arrangements
      const remoteGroup  = new Set(['fully_remote','hybrid_mostly_remote']);
      const hybridGroup  = new Set(['hybrid_mostly_office','hybrid_5050','hybrid_mostly_remote']);
      const onsiteGroup  = new Set(['onsite','field_based','travel_based']);
      const cR = remoteGroup.has(candArrangement), cH = hybridGroup.has(candArrangement), cO = onsiteGroup.has(candArrangement);
      const jR = remoteGroup.has(jobArrangement),  jH = hybridGroup.has(jobArrangement),  jO = onsiteGroup.has(jobArrangement);
      if ((cH && jH) || (cR && jH) || (cH && jR)) { score += 8; reasons.work_arrangement = 'partial'; }
      else { reasons.work_arrangement = false; gaps.push('work arrangement preference'); }
    }
  } else { score += 8; reasons.work_arrangement = null; }

  // Travel tolerance soft check
  if (prefs.travel_pct_max != null && reqs.travel_pct != null) {
    if (reqs.travel_pct <= prefs.travel_pct_max) { reasons.travel = true; }
    else { reasons.travel = false; }
  }

  // ── AUTHORITY & MANDATE (15 pts) ──────────────────────────────────────────
  let authScore = 0; let authMatches = 0;

  // P&L responsibility
  if (prefs.authority_pnl != null && reqs.pnl_responsibility != null) {
    if (prefs.authority_pnl === reqs.pnl_responsibility) {
      authScore += 4; authMatches++;
      if (reqs.pnl_responsibility) { reasons.pnl = true; matched.push('P&L responsibility'); }
    } else { reasons.pnl = false; if (prefs.authority_pnl) gaps.push('P&L responsibility'); }
  } else { authScore += 2; reasons.pnl = null; }

  // Reports-to
  if (prefs.reports_to?.length && reqs.reports_to) {
    const rMatch = prefs.reports_to.some(r => reqs.reports_to.toLowerCase().includes(r.toLowerCase()));
    if (rMatch) { authScore += 3; authMatches++; reasons.reports_to = true; matched.push('reporting line'); }
    else { reasons.reports_to = false; }
  } else { authScore += 2; reasons.reports_to = null; }

  // Budget / hiring authority
  if (prefs.authority_budget && reqs.budget_authority) { authScore += 2; reasons.budget_auth = true; }
  if (prefs.authority_hiring && reqs.hiring_authority) { authScore += 2; reasons.hiring_auth = true; }
  if (prefs.authority_board  && reqs.board_exposure)   { authScore += 2; reasons.board = true; }

  score += Math.min(15, authScore);
  reasons.authority = authMatches > 0 ? true : authMatches === 0 && authScore > 0 ? null : false;

  // Mandate match
  const candMandates = prefs.mandate_types || [];
  const jobMandate   = reqs.mandate;
  if (candMandates.length && jobMandate) {
    if (candMandates.includes(jobMandate)) {
      score += 10; reasons.mandate = true;
      matched.push(`${MANDATE_TYPES[jobMandate] || jobMandate} mandate`);
    } else { reasons.mandate = false; }
  } else { score += 5; reasons.mandate = null; }

  // ── LOCATION / RELOCATION (10 pts) ──────────────────────────────────────
  if (job?.location && candidate?.location) {
    const jL = job.location.toLowerCase(), cL = candidate.location.toLowerCase();
    if (jL.includes('remote') || jL.includes('global') ||
        cL.includes(jL.split(',')[0].trim().slice(0,5)) ||
        jL.includes(cL.split(',')[0].trim().slice(0,5))) {
      score += 10; reasons.location = true;
      matched.push('location');
    } else {
      // Relocation softener
      if (prefs.relocation_willing || reqs.relocation_assistance) {
        score += 5; reasons.location = 'relocation';
      } else {
        reasons.location = false;
        gaps.push('location');
      }
    }
  } else { score += 10; reasons.location = null; }

  // Company type soft match
  if (prefs.company_types?.length && reqs.company_type) {
    if (prefs.company_types.includes(reqs.company_type)) { reasons.company_type = true; }
  }

  // ═══ STEP 3: EXPLANATION ═══════════════════════════════════════════════════
  let explanation;
  const finalScore = Math.min(100, score);

  if (finalScore >= 80) {
    explanation = matched.length > 0
      ? `Strong match — ${matched.slice(0,4).join(', ')} align.`
      : 'Strong overall alignment.';
  } else if (finalScore >= 60) {
    const gapStr = gaps.length > 0 ? ` Gap: ${gaps[0]}.` : '';
    explanation = matched.length > 0
      ? `Good match — ${matched.slice(0,3).join(', ')} align.${gapStr}`
      : `Moderate match.${gapStr}`;
  } else if (finalScore >= 40) {
    explanation = gaps.length > 0
      ? `Partial match — ${gaps.slice(0,2).join(', ')} may not align.`
      : 'Partial profile match — limited preference data available.';
  } else {
    explanation = gaps.length > 0
      ? `Low match — ${gaps.slice(0,2).join(', ')}.`
      : 'Insufficient profile data for strong match.';
  }

  return { score: finalScore, reasons, matched, gaps, explanation, blocked: false };
}


// ── SCOPE-BASED EVALUATION ─────────────────────────────────────────────────
// Implements the platform's core moat: classification of operational scope,
// complexity, and strategic responsibility — independent of job title.
//
// All tier values are stored as stable string keys so the database, the
// matching engine, and the UI can share a single source of truth.

const SCOPE_TIERS = {
  direct_reports: [
    { key:'none',     label:'None / Individual contributor', pts:0  },
    { key:'1_3',      label:'1–3',     pts:4  },
    { key:'4_7',      label:'4–7',     pts:8  },
    { key:'8_15',     label:'8–15',    pts:12 },
    { key:'16_30',    label:'16–30',   pts:16 },
    { key:'31_plus',  label:'31+',     pts:20 },
  ],
  total_team_size: [
    { key:'none',     label:'None',           pts:0  },
    { key:'1_10',     label:'1–10',           pts:3  },
    { key:'11_50',    label:'11–50',          pts:6  },
    { key:'51_200',   label:'51–200',         pts:9  },
    { key:'201_500',  label:'201–500',        pts:12 },
    { key:'500_plus', label:'500+',           pts:15 },
  ],
  budget_responsibility: [
    { key:'none',     label:'None',           pts:0  },
    { key:'lt_5m',    label:'Under $5M',      pts:3  },
    { key:'5_25m',    label:'$5–25M',         pts:6  },
    { key:'25_100m',  label:'$25–100M',       pts:9  },
    { key:'100_500m', label:'$100–500M',      pts:12 },
    { key:'500m_plus',label:'$500M+',         pts:15 },
  ],
  pnl_size: [
    { key:'lt_5m',    label:'Under $5M',      pts:2  },
    { key:'5_25m',    label:'$5–25M',         pts:4  },
    { key:'25_100m',  label:'$25–100M',       pts:6  },
    { key:'100_500m', label:'$100–500M',      pts:8  },
    { key:'500m_plus',label:'$500M+',         pts:10 },
  ],
  capex_authority: [
    { key:'none',     label:'None',           pts:0  },
    { key:'lt_1m',    label:'Under $1M',      pts:2  },
    { key:'1_10m',    label:'$1–10M',         pts:5  },
    { key:'10_50m',   label:'$10–50M',        pts:8  },
    { key:'50m_plus', label:'$50M+',          pts:10 },
  ],
  sites_managed: [
    { key:'one',        label:'1',            pts:0 },
    { key:'two_three',  label:'2–3',          pts:2 },
    { key:'four_ten',   label:'4–10',         pts:4 },
    { key:'ten_plus',   label:'10+',          pts:6 },
  ],
  geographic_scope: [
    { key:'single_site',         label:'Single site',                pts:0  },
    { key:'multi_site_regional', label:'Multi-site — regional',      pts:3  },
    { key:'multi_site_national', label:'Multi-site — national',      pts:6  },
    { key:'multi_country',       label:'Multi-country',              pts:9  },
    { key:'global',              label:'Global',                     pts:12 },
  ],
  operational_scale: [
    { key:'small',      label:'Small',              pts:0 },
    { key:'medium',     label:'Medium',             pts:3 },
    { key:'large',      label:'Large',              pts:5 },
    { key:'very_large', label:'Very large',         pts:7 },
  ],
};

// Binary complexity & strategic flags, each with a point weight.
const COMPLEXITY_FLAGS = {
  greenfield_startup:        { label:'Greenfield startup (built from ground up)', pts:15 },
  turnaround:                { label:'Turnaround / distressed operations',         pts:12 },
  multi_site_ops:            { label:'Multi-site operational responsibility',      pts:10 },
  union_environment:         { label:'Union environment',                          pts:8  },
  erp_implementation:        { label:'ERP / systems implementation lead',          pts:8  },
  twenty_four_seven_ops:     { label:'24/7 continuous operations',                 pts:8  },
  regulated_environment:     { label:'Regulated environment (USCG, EPA, MARAD…)',  pts:10 },
  infrastructure_development:{ label:'Infrastructure development / capex projects',pts:10 },
};

const STRATEGIC_FLAGS = {
  department_built_scratch:  { label:'Built a department or function from scratch', pts:15 },
  ma_integration:            { label:'M&A integration responsibility',               pts:15 },
  board_executive_exposure:  { label:'Board / executive committee exposure',         pts:15 },
  commercial_negotiations:   { label:'Owned commercial negotiations (>$10M)',        pts:12 },
  customer_ownership:        { label:'Direct customer ownership / P&L',              pts:12 },
  transformation_leadership: { label:'Led organizational transformation',            pts:12 },
  procurement_authority:     { label:'Procurement / sourcing authority',             pts:10 },
  strategic_planning:        { label:'Owned strategic planning cycle',               pts:9  },
};

const TRANSPORT_MODES = [
  { key:'vessel',   label:'Vessel / marine' },
  { key:'rail',     label:'Rail' },
  { key:'truck',    label:'Truck / motor carrier' },
  { key:'pipeline', label:'Pipeline / fixed conveyance' },
];

// ── COMMERCIAL & TECHNICAL FLUENCY DIMENSIONS ────────────────────────────────
// These capture the cross-functional fluency that the industrial-technology
// hiring market actually pays for: people who can sell, build, or operate
// software for industrial buyers. A generic SaaS recruiter can't evaluate
// this; a traditional maritime recruiter can't either. Capturing it
// explicitly is the moat against both.

const REVENUE_MODELS = [
  { key:'saas',                 label:'SaaS / subscription' },
  { key:'recurring_revenue',    label:'Recurring revenue (ARR)' },
  { key:'enterprise_licensing', label:'Enterprise licensing' },
  { key:'services_revenue',     label:'Services / consulting revenue' },
  { key:'commodity_trading',    label:'Commodity trading P&L' },
  { key:'asset_based_logistics',label:'Asset-based logistics' },
  { key:'transactional',        label:'Transactional / per-move pricing' },
];

const SALES_MOTIONS = [
  { key:'enterprise',           label:'Enterprise sales (6-figure+ ACV)' },
  { key:'consultative_long_cycle', label:'Long-cycle consultative' },
  { key:'operational_sales',    label:'Operational / industrial sales' },
  { key:'technical_sales',      label:'Technical sales / solutions engineering' },
  { key:'multi_stakeholder',    label:'Multi-stakeholder / committee selling' },
  { key:'channel',              label:'Channel / partner sales' },
  { key:'strategic_accounts',   label:'Strategic / named accounts' },
  { key:'plg',                  label:'Product-led growth' },
];

const TECHNICAL_FLUENCY = [
  { key:'ai_platforms',         label:'AI / ML platforms' },
  { key:'analytics_systems',    label:'Analytics / BI systems' },
  { key:'erp_wms_tms',          label:'ERP / WMS / TMS systems' },
  { key:'industrial_systems',   label:'Industrial control systems' },
  { key:'operational_tech',     label:'Operational technology (OT)' },
  { key:'maritime_systems',     label:'Maritime systems (IMOS, Veson, etc.)' },
  { key:'fleet_management',     label:'Fleet management platforms' },
  { key:'iot',                  label:'Industrial IoT / sensors' },
  { key:'compliance_software',  label:'Compliance / audit software' },
  { key:'port_systems',         label:'Port / terminal operating systems' },
];

const LEADERSHIP_CLASSES = {
  manager:         'Manager',
  senior_manager:  'Senior Manager',
  director:        'Director',
  senior_director: 'Senior Director',
  vp:              'VP',
  svp:             'SVP',
  evp:             'EVP',
  c_suite:         'C-Suite',
};

const COMPLEXITY_CLASSES = {
  low:        'Low',
  moderate:   'Moderate',
  high:       'High',
  very_high:  'Very High',
};

function tierPts(tierKey, dimension) {
  if (!tierKey) return 0;
  const def = SCOPE_TIERS[dimension];
  if (!def) return 0;
  const hit = def.find(t => t.key === tierKey);
  return hit ? hit.pts : 0;
}

// Derive scope_score, complexity_score, strategic_score, commercial_score,
// leadership_class, complexity_class, industrial_translator flag, and
// equivalent_label from a candidate_scope object.
// Used at form save time (client) and on every match recompute (server).
function deriveScopeMetrics(scope) {
  if (!scope || typeof scope !== 'object') {
    return {
      scope_score:0, complexity_score:0, strategic_score:0, commercial_score:0,
      leadership_class:null, complexity_class:null, equivalent_label:null,
      industrial_translator: false,
    };
  }
  const o = scope.org_scope    || {};
  const c = scope.complexity   || {};
  const s = scope.strategic    || {};
  const cm = scope.commercial  || {};

  // Scope score (0–100)
  let scopeScore = 0;
  scopeScore += tierPts(o.direct_reports,        'direct_reports');
  scopeScore += tierPts(o.total_team_size,       'total_team_size');
  scopeScore += tierPts(o.budget_responsibility, 'budget_responsibility');
  if (o.pnl_owned) {
    scopeScore += 5;
    scopeScore += tierPts(o.pnl_size, 'pnl_size');
  }
  scopeScore += tierPts(o.capex_authority,  'capex_authority');
  scopeScore += tierPts(o.sites_managed,    'sites_managed');
  scopeScore += tierPts(o.geographic_scope, 'geographic_scope');
  if (o.international_responsibility) scopeScore += 7;
  scopeScore = Math.min(100, scopeScore);

  // Complexity score (0–100)
  let complexityScore = 0;
  for (const flag of Object.keys(COMPLEXITY_FLAGS)) {
    if (c[flag]) complexityScore += COMPLEXITY_FLAGS[flag].pts;
  }
  const tmCount = Array.isArray(c.transport_modes) ? c.transport_modes.length : 0;
  complexityScore += tmCount === 0 ? 0 : tmCount === 1 ? 4 : tmCount === 2 ? 8 : 12;
  complexityScore += tierPts(c.operational_scale, 'operational_scale');
  complexityScore = Math.min(100, complexityScore);

  // Strategic score (0–100)
  let strategicScore = 0;
  for (const flag of Object.keys(STRATEGIC_FLAGS)) {
    if (s[flag]) strategicScore += STRATEGIC_FLAGS[flag].pts;
  }
  strategicScore = Math.min(100, strategicScore);

  // Leadership classification — derived from scope_score
  let leadership_class;
  if      (scopeScore >= 96) leadership_class = 'c_suite';
  else if (scopeScore >= 90) leadership_class = 'evp';
  else if (scopeScore >= 80) leadership_class = 'svp';
  else if (scopeScore >= 65) leadership_class = 'vp';
  else if (scopeScore >= 50) leadership_class = 'senior_director';
  else if (scopeScore >= 35) leadership_class = 'director';
  else if (scopeScore >= 20) leadership_class = 'senior_manager';
  else                       leadership_class = 'manager';

  // Complexity classification — derived from complexity_score
  let complexity_class;
  if      (complexityScore >= 80) complexity_class = 'very_high';
  else if (complexityScore >= 55) complexity_class = 'high';
  else if (complexityScore >= 30) complexity_class = 'moderate';
  else                            complexity_class = 'low';

  // Commercial & technical fluency score (0–100)
  // Multi-select arrays — each selected item contributes a flat weight.
  // The score reflects breadth of fluency, not depth on any single dimension.
  const revModels   = Array.isArray(cm.revenue_models)    ? cm.revenue_models    : [];
  const salesModels = Array.isArray(cm.sales_motions)     ? cm.sales_motions     : [];
  const techFluency = Array.isArray(cm.technical_fluency) ? cm.technical_fluency : [];

  let commercialScore = 0;
  commercialScore += Math.min(28, revModels.length   * 4);
  commercialScore += Math.min(32, salesModels.length * 4);
  commercialScore += Math.min(40, techFluency.length * 4);
  commercialScore = Math.min(100, commercialScore);

  // Industrial-commercial translator pattern — the cross-functional profile
  // industrial-technology companies actively hunt for. Triggered when a
  // candidate combines a recurring-revenue commercial background with
  // industrial domain technical fluency. This is the moat against generic
  // SaaS recruiters who can't recognize this pattern.
  const SAAS_REVENUE     = new Set(['saas','recurring_revenue','enterprise_licensing']);
  const INDUSTRIAL_TECH  = new Set(['maritime_systems','port_systems','fleet_management','erp_wms_tms','operational_tech','industrial_systems','iot','compliance_software']);
  const hasSaasRevenue   = revModels.some(r => SAAS_REVENUE.has(r));
  const hasIndustrialTech= techFluency.some(t => INDUSTRIAL_TECH.has(t));
  const industrial_translator = hasSaasRevenue && hasIndustrialTech;

  // Equivalent leadership label — the platform's signature output.
  // Format: "Director-level scope · High complexity"
  // When the candidate is an industrial-commercial translator, the label
  // surfaces that pattern explicitly — it is the highest-signal differentiator
  // for industrial-tech hires.
  let equivalent_label =
    `${LEADERSHIP_CLASSES[leadership_class]}-level scope · ${COMPLEXITY_CLASSES[complexity_class]} complexity`;
  if (industrial_translator) {
    equivalent_label += ' · Industrial-commercial translator';
  }

  return {
    scope_score:      scopeScore,
    complexity_score: complexityScore,
    strategic_score:  strategicScore,
    commercial_score: commercialScore,
    leadership_class, complexity_class, equivalent_label,
    industrial_translator,
  };
}

// Empty scope skeleton — used when initializing the form.
function emptyCandidateScope() {
  return {
    org_scope: {
      direct_reports:        null,
      total_team_size:       null,
      budget_responsibility: null,
      pnl_owned:             null,
      pnl_size:              null,
      capex_authority:       null,
      sites_managed:         null,
      geographic_scope:      null,
      international_responsibility: false,
    },
    complexity: {
      greenfield_startup: false, turnaround: false, multi_site_ops: false,
      transport_modes: [], union_environment: false, erp_implementation: false,
      twenty_four_seven_ops: false, regulated_environment: false,
      infrastructure_development: false, operational_scale: null,
    },
    strategic: {
      department_built_scratch: false, ma_integration: false,
      commercial_negotiations: false, board_executive_exposure: false,
      customer_ownership: false, procurement_authority: false,
      transformation_leadership: false, strategic_planning: false,
    },
    // Commercial & technical fluency — multi-select. Captures the
    // industrial-commercial-translation profile that industrial-tech
    // companies hire for and that generic SaaS recruiters can't evaluate.
    commercial: {
      revenue_models:    [],
      sales_motions:     [],
      technical_fluency: [],
    },
  };
}


// ── MATCH CONFIDENCE ENGINE ──────────────────────────────────────────────────
// Categorical fit labels surfaced to both sides of the marketplace. Replaces
// raw percentage as the primary signal. The percentage is retained as a
// secondary anchor — not the headline.
// Guidance is advisory — candidates are warned, never blocked.

const MATCH_CONFIDENCE_LEVELS = {
  high:     { label:'High Compatibility',    level:'high',     threshold: 80 },
  moderate: { label:'Moderate Compatibility',level:'moderate', threshold: 60 },
  stretch:  { label:'Stretch Opportunity',   level:'stretch',  threshold: 40 },
  low:      { label:'Low Alignment',         level:'low',      threshold: 0  },
};

function getMatchConfidence(score, reasons, gaps) {
  const r = reasons || {};

  let level, label;
  if      (score >= 80) { level = 'high';     label = MATCH_CONFIDENCE_LEVELS.high.label; }
  else if (score >= 60) { level = 'moderate'; label = MATCH_CONFIDENCE_LEVELS.moderate.label; }
  else if (score >= 40) { level = 'stretch';  label = MATCH_CONFIDENCE_LEVELS.stretch.label; }
  else                  { level = 'low';      label = MATCH_CONFIDENCE_LEVELS.low.label; }

  // Build specific gap descriptions (human-readable, not raw field names).
  // r.scope, r.complexity etc. are expected to be true | false | null
  // (null = unknown / data not yet collected). Treat null as missing data,
  // not as a fail — this is honest about the system's ignorance and stops
  // the legacy fallback from misleading users.
  const gapDescriptions = [];
  if (r.scope === false)             gapDescriptions.push('Operational scope mismatch');
  if (r.scope === null)              gapDescriptions.push('Operational scope — candidate has not provided data');
  if (r.industry === false)          gapDescriptions.push('Industry adjacency — not direct sector match');
  if (r.salary === false)            gapDescriptions.push('Compensation mismatch');
  if (r.location === false)          gapDescriptions.push('Geographic mismatch');
  if (r.complexity === false)        gapDescriptions.push('Missing operational complexity experience');
  if (r.complexity === null)         gapDescriptions.push('Operational complexity — candidate has not provided data');
  if (r.work_arrangement === false)  gapDescriptions.push('Work arrangement preference differs');

  // Strengths (alignment points)
  const strengths = [];
  if (r.scope === true)       strengths.push('Operational scope');
  if (r.industry === true)    strengths.push('Industry alignment');
  if (r.function === true)    strengths.push('Functional discipline');
  if (r.pnl === true)         strengths.push('P&L experience');
  if (r.complexity === true)  strengths.push('Operational complexity');
  if (r.mandate === true)     strengths.push('Mandate type');

  // Advisory text — soft friction, never a hard gate.
  let advisory = null;
  if (level === 'stretch') {
    advisory = `This is a stretch opportunity. ${gapDescriptions.length > 0 ? gapDescriptions.slice(0,2).join(' and ') + ' detected.' : 'Some compatibility factors are misaligned.'} You can still express interest — but review the role carefully before doing so.`;
  } else if (level === 'low') {
    advisory = `Multiple compatibility factors suggest this role may not be a strong fit at this time. ${gapDescriptions.slice(0,2).join(' and ')}. Expressing interest is permitted, but this match is unlikely to convert.`;
  }

  return { level, label, score, gapDescriptions, strengths, advisory, shouldWarn: level === 'stretch' || level === 'low' };
}

// ── MATCH CONFIDENCE BADGE ───────────────────────────────────────────────────
function MatchConfidenceBadge({ score, reasons, gaps, compact }) {
  const conf = getMatchConfidence(score, reasons, gaps);
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'0.625rem',flexWrap:'wrap'}}>
        <span className={`match-confidence-badge ${conf.level}`}>{conf.label}</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',color:'var(--ink-4)'}}>{score}% fit</span>
      </div>
      {!compact && conf.gapDescriptions.length > 0 && (
        <div className="match-gap-list">
          {conf.gapDescriptions.map(g => <span key={g} className="match-gap-tag">{g}</span>)}
        </div>
      )}
      {!compact && conf.strengths.length > 0 && (
        <div className="match-confidence-detail">
          Aligned on: {conf.strengths.slice(0,4).join(', ')}.
        </div>
      )}
    </div>
  );
}

// ── STRETCH OPPORTUNITY MODAL ────────────────────────────────────────────────
// Shown before a candidate expresses interest in a stretch or low-alignment
// match. Does NOT block — always allows proceeding after review.
function StretchOpportunityModal({ job, confidence, onProceed, onCancel }) {
  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
      <div className="workflow-modal" style={{maxWidth:520}}>
        <div className="stretch-modal-level" style={{color: confidence.level === 'low' ? 'var(--ink-4)' : '#bf360c'}}>
          {confidence.label}
        </div>
        <div className="stretch-modal-header">Review Before Expressing Interest</div>
        <div style={{fontSize:'0.875rem',color:'var(--ink-2)',lineHeight:'1.6',marginBottom:'1.25rem'}}>
          {confidence.advisory}
        </div>

        {confidence.gapDescriptions.length > 0 && (
          <div style={{marginBottom:'1.25rem'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.58rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:'0.5rem'}}>
              Compatibility Gaps Identified
            </div>
            {confidence.gapDescriptions.map(g => (
              <div key={g} style={{display:'flex',gap:'0.5rem',alignItems:'flex-start',marginBottom:'0.375rem',fontSize:'0.8rem',color:'var(--ink-2)'}}>
                <span style={{color:'#c0392b',flexShrink:0,marginTop:'0.1rem'}}>⚠</span>
                <span>{g}</span>
              </div>
            ))}
          </div>
        )}

        {confidence.strengths.length > 0 && (
          <div style={{marginBottom:'1.25rem'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.58rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:'0.5rem'}}>
              Alignment Points
            </div>
            {confidence.strengths.map(s => (
              <div key={s} style={{display:'flex',gap:'0.5rem',alignItems:'center',marginBottom:'0.25rem',fontSize:'0.8rem',color:'var(--green)'}}>
                <span>✓</span><span>{s}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{background:'var(--paper-2)',border:'1px solid var(--rule)',padding:'0.875rem 1rem',marginBottom:'1.25rem',fontSize:'0.75rem',color:'var(--ink-4)',lineHeight:'1.5'}}>
          Fredheim Desk focuses on high-conversion introductions. Expressing interest in misaligned roles reduces your signal quality on the platform. You may proceed — but we recommend reviewing roles where compatibility is stronger.
        </div>

        <div className="workflow-actions">
          <button className="workflow-close-btn" onClick={onCancel}>Return to Matches</button>
          <button className={`match-interest-btn ${confidence.level}`} onClick={onProceed}>
            Express Interest Anyway
          </button>
        </div>
      </div>
    </div>
  );
}


// ── NOTIFICATION BELL ────────────────────────────────────────────────────────
function NotificationBell({ userEmail, userType }) {
  const [notifs, setNotifs]       = useState([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!userEmail) return;
    loadNotifs();
  }, [userEmail]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadNotifs() {
    setLoading(true);
    const { data } = await sb.from('fed_notifications')
      .select('*')
      .eq('recipient_email', userEmail.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifs(data || []);
    setLoading(false);
  }

  async function handleOpen() {
    setOpen(o => !o);
    if (!open) {
      await loadNotifs();
      // Mark all as read after brief delay
      setTimeout(async () => {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;
        await fetch('/api/match-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'mark_notifications_read' }),
        });
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      }, 2000);
    }
  }

  const unread = notifs.filter(n => !n.is_read).length;
  function timeAgoShort(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div ref={ref} style={{position:'relative'}}>
      <button className="notif-bell" onClick={handleOpen} title="Notifications">
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-header-title">Notifications</span>
            {unread > 0 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.55rem',color:'var(--gold)'}}>
              {unread} unread
            </span>}
          </div>
          {loading ? (
            <div className="notif-empty"><span className="spinner"/>Loading…</div>
          ) : notifs.length === 0 ? (
            <div className="notif-empty">No notifications yet.</div>
          ) : (
            <div style={{maxHeight:'360px',overflowY:'auto'}}>
              {notifs.map(n => (
                <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                  <div className="notif-item-title">{n.title}</div>
                  {n.body && <div className="notif-item-body">{n.body}</div>}
                  <div className="notif-item-time">{timeAgoShort(n.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DemoBanner({ onDismiss }) {
  return (
    <div className="demo-banner">
      <div className="demo-dot" />
      <div className="demo-banner-text">
        <strong>Preview Mode</strong> — Sample postings shown for illustration.
        Live searches from retained firms onboarding now.{' '}
        <strong>Founding Partner Program 2026 — one search/month free through December 31.</strong>
      </div>
      <button className="demo-dismiss" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

// ── NAV ──────────────────────────────────────────────────────────────────────
function NavBar({ activeView, setActiveView, goToView, openRecruiterModal, authUser, userType, onSignIn, onSignOut }) {
  // Prefer goToView (scrolls to top after view change) so users actually see
  // the page they just navigated to. setActiveView alone leaves the user at
  // their previous scroll position, which made e.g. clicking "Early Careers"
  // appear to do nothing if the user had scrolled past the Hero.
  const go = goToView || setActiveView;
  return (
    <nav className="nav">
      <div className="nav-brand" onClick={() => go('jobs')}>
        <div className="nav-mark">FE</div>
        <div className="nav-name-wrap">
          <div className="nav-name">Fredheim Executive Desk</div>
          <span className="nav-sub">Maritime · Ports · Energy · Industrial Logistics</span>
        </div>
      </div>
      <div className="nav-links">
        <button className={`nav-link ${activeView==='jobs'?'active':''}`} onClick={() => go('jobs')}>Opportunities</button>
        <button className={`nav-link ${activeView==='early-careers'?'active':''}`} onClick={() => go('early-careers')}>Early Careers</button>
        <button className={`nav-link ${activeView==='consulting'?'active':''}`} onClick={() => go('consulting')}>Consulting</button>
        <button className={`nav-link ${activeView==='pricing'?'active':''}`} onClick={() => go('pricing')}>Pricing</button>
        <div className="nav-divider" />
        {authUser && userType === 'recruiter' && (
          <button className={`nav-link ${activeView==='recruiter-dash'?'active':''}`} onClick={() => go('recruiter-dash')}>Firm Dashboard</button>
        )}
        {!authUser && (
          <button className="nav-link" onClick={() => go('recruiter-signin')}>Recruiter Sign In</button>
        )}
        {authUser && userType !== 'recruiter' ? (
          <button className={`nav-link ${activeView==='myprofile'?'active':''}`} onClick={() => go('myprofile')}>My Profile</button>
        ) : !authUser ? (
          <button className="nav-link" onClick={onSignIn}>Sign In</button>
        ) : null}
        {authUser && (
          <NotificationBell userEmail={authUser.email} userType={userType} />
        )}
        <button className="nav-cta" onClick={openRecruiterModal}>Post a Search</button>
        {authUser && (
          <button className="nav-signout" onClick={onSignOut}>Sign Out</button>
        )}
      </div>
    </nav>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────
function Hero({ jobCount, scrollToJobs, scrollToProfile, authUser, onGoToProfile, onGoToConsulting, minSalary }) {
  return (
    <div className="hero">
      <div className="hero-inner">
        <div>
          <div className="hero-eyebrow">
            <div className="eyebrow-line" />
            <span className="eyebrow-text">Fredheim Executive Desk</span>
          </div>
          <h1 className="hero-title">
            One destination.<br />
            Every <em>executive</em><br />
            opportunity.
          </h1>
          <p className="hero-desc">
            The curated marketplace built exclusively for senior leaders in maritime,
            energy, and industrial logistics. Salary ranges always published.
            Your identity protected until you choose to engage.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={scrollToJobs}>Browse Opportunities</button>
            {authUser ? (
              <button className="btn-outline" onClick={onGoToProfile}>Go to My Profile</button>
            ) : (
              <button className="btn-outline" onClick={scrollToProfile}>Create Executive Profile</button>
            )}
          </div>
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-num">{jobCount || '—'}</div>
            <div className="stat-label">Active Searches</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">4</div>
            <div className="stat-label">Industry Verticals</div>
          </div>
          <div className="stat-item">
            <div className="stat-num stat-gold">
              {minSalary ? `$${minSalary >= 1000000 ? (minSalary/1000000).toFixed(1)+'M' : Math.round(minSalary/1000)+'K'}+` : '$200K+'}
            </div>
            <div className="stat-label">Min. Published Range</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">100%</div>
            <div className="stat-label">Salary Transparency</div>
          </div>
          <div className="hero-stat" style={{cursor:'pointer',borderTop:'1px solid var(--rule)',textAlign:'left',padding:'1rem'}}
            onClick={onGoToConsulting}>
            <div className="stat-value" style={{color:'var(--gold)',fontSize:'1.4rem',fontFamily:"'Playfair Display',serif",fontWeight:600,lineHeight:1,marginBottom:'0.3rem'}}>→</div>
            <div className="stat-label">Consulting</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── JOB CARD ─────────────────────────────────────────────────────────────────
function JobCard({ job, onClick }) {
  const tags = parseJson(job.tags);
  return (
    <div className={`job-card ${job.badge==='featured'?'featured':''} `} onClick={() => onClick(job)}>
      {job.demo_post && <div className="demo-watermark">Example</div>}
      <div>
        <div className="job-header">
          <div className="firm-badge">{job.firm_code}</div>
          <div>
            <div className="job-title">{job.title}</div>
            <div className="job-firm">{job.firm_name} · {job.company_display}</div>
          </div>
        </div>
        <div className="job-meta">
          <div className="meta-item">{job.location}</div>
          <div className="meta-item">{job.type}</div>
          <div className="meta-item">{job.industry}</div>
          <div className="meta-item">{job.function}</div>
        </div>
        <div className="job-tags">
          <span className="tag industry">{job.industry}</span>
          {tags.slice(0,4).map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      </div>
      <div className="job-right">
        <div>
          <div className="salary-range">{job.salary_display}</div>
          <div className="salary-note">{job.salary_note || 'Total Compensation'}</div>
        </div>
        {job.badge && <span className={`badge ${job.badge}`}>{job.badge}</span>}
        <div className="posted-date">{timeAgo(job.created_at)}</div>
      </div>
    </div>
  );
}

// ── JOB MODAL ────────────────────────────────────────────────────────────────
function JobModal({ job, onClose, showToast }) {
  const [expressed, setExpressed] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [email, setEmail]         = useState('');
  const [showEmail, setShowEmail] = useState(false);

  if (!job) return null;
  const responsibilities = parseJson(job.responsibilities);
  const requirements     = parseJson(job.requirements);
  const tags             = parseJson(job.tags);

  async function handleInterest() {
    if (!showEmail) { setShowEmail(true); return; }
    if (!email) { showToast('Please enter your email to register interest.'); return; }
    setLoading(true);
    try {
      const { error } = await sb.from('fed_interests').insert({ job_id: job.id, anon_email: email.toLowerCase().trim() });
      if (error) {
        if (error.code === '23505') {
          showToast('You have already registered interest in this search.');
          setExpressed(true);
        } else {
          showToast('Could not register interest. Please try again.');
        }
      } else {
        // Sync interest_count on fed_jobs non-blocking
        sb.from('fed_jobs').update({ interest_count: (job.interest_count || 0) + 1 }).eq('id', job.id);
        // Notify recruiter (anonymously) and admin — non-blocking
        fetch('/api/notify-interest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id, candidate_email: email.toLowerCase().trim() }),
        }).catch(() => {});
        setExpressed(true);
      }
    } catch(e) {
      showToast('Could not register interest. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-eyebrow">{job.firm_name} · {job.industry}</div>
        <h2 className="modal-title">{job.title}</h2>
        <div className="modal-firm">{job.company_display} · {job.location}</div>
        <div className="modal-salary">{job.salary_display}</div>
        <div className="modal-salary-note">Published Total Compensation Range</div>

        <div className="job-tags" style={{marginBottom:'1.5rem'}}>
          <span className="tag industry">{job.industry}</span>
          {tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>

        {job.demo_post && (
          <div className="demo-notice">
            <strong>Illustrative example.</strong> This sample posting demonstrates platform functionality.
            Live searches from retained firms are being onboarded now.
          </div>
        )}

        <hr className="modal-divider" />
        <div className="modal-section-title">The Opportunity</div>
        <div className="modal-body">{job.description}</div>

        {responsibilities.length > 0 && <>
          <div className="modal-section-title">Key Responsibilities</div>
          <div className="modal-body"><ul>{responsibilities.map((r,i)=><li key={i}>{r}</li>)}</ul></div>
        </>}

        {requirements.length > 0 && <>
          <div className="modal-section-title">What They're Looking For</div>
          <div className="modal-body"><ul>{requirements.map((r,i)=><li key={i}>{r}</li>)}</ul></div>
        </>}

        <hr className="modal-divider" />

        {expressed ? (
          <div className="interest-success">
            <p>✦ Interest registered. The search firm will be notified. Your identity remains confidential until you approve contact.</p>
          </div>
        ) : (
          <>
            {showEmail && (
              <div className="form-group" style={{marginBottom:'0.75rem'}}>
                <label className="form-label">Your Email (confidential)</label>
                <input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} autoFocus />
              </div>
            )}
            <button className="interest-btn" onClick={handleInterest} disabled={loading}>
              {loading ? 'Registering…' : 'Register Confidential Interest'}
            </button>
          </>
        )}
        <div className="interest-note">
          Your identity is not shared until you approve contact.<br />
          Create an executive profile for one-click interest on all searches.
        </div>
      </div>
    </div>
  );
}


// ── ToS MODAL ─────────────────────────────────────────────────────────────────
function TosModal({ onAgree, onCancel }) {
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const canAgree = checked1 && checked2;

  return (
    <div className="tos-overlay">
      <div className="tos-modal">
        <div className="tos-eyebrow">Platform Terms — Search Firms</div>
        <h2 className="tos-title">Introduction Fee Agreement</h2>
        <div className="tos-body">
          <p>Before posting a search, please review and agree to the Fredheim Executive Desk
          platform terms regarding introduction fees. These terms protect both the platform
          and the integrity of the executive community.</p>

          <div className="tos-clause">
            <strong>Introduction Fee.</strong> Any candidate who first expressed interest in a posted
            role through Fredheim Executive Desk and is subsequently hired for that role — or a
            substantially similar role at the same organization — within <strong>12 months</strong> of
            first documented contact on the platform obligates the posting firm to pay a flat
            platform introduction fee of <strong>$3,500 (C-Suite / VP)</strong> or{' '}
            <strong>$1,500 (Director / Senior Manager)</strong>. This fee is invoiced to the search firm
            upon placement confirmation and is due within 30 days of invoice.
          </div>

          <div className="tos-clause">
            <strong>Salary Transparency.</strong> All postings must include a published total
            compensation range. Postings without salary ranges will not be approved.
            Misrepresentation of compensation ranges is grounds for immediate account suspension.
          </div>

          <div className="tos-clause">
            <strong>Confidentiality.</strong> Executive profile information accessed through the
            platform — including candidate identity, compensation expectations, and current
            employer — may not be shared outside the search engagement for which it was accessed,
            or used to solicit candidates for other roles without their express consent.
          </div>
        </div>

        <div className="tos-check-row" onClick={() => setChecked1(!checked1)}>
          <div className={`tos-checkbox ${checked1?'checked':''}`} />
          <div className="tos-check-label">
            I agree to pay the <strong>flat platform introduction fee ($3,500 C-Suite/VP · $1,500 Director level)</strong> for
            any confirmed hire resulting from a Fredheim Executive Desk introduction within 12 months.
          </div>
        </div>

        <div className="tos-check-row" onClick={() => setChecked2(!checked2)}>
          <div className={`tos-checkbox ${checked2?'checked':''}`} />
          <div className="tos-check-label">
            I confirm that all postings submitted will include a <strong>published compensation range</strong> and
            that candidate information will be used solely for the posted search engagement.
          </div>
        </div>

        <div className="tos-actions">
          <button className="tos-cancel" onClick={onCancel}>Cancel</button>
          <button className="tos-agree" onClick={onAgree} disabled={!canAgree}>
            I Agree — Continue to Post
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RECRUITER MODAL ───────────────────────────────────────────────────────────
function RecruiterModal({ onClose, showToast }) {
  const [step, setStep]           = useState('tos');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [billingBlock, setBillingBlock] = useState(null);
  const [showBillingSetup, setShowBillingSetup] = useState(false);
  const [jobReqs, setJobReqs]     = useState({}); // advanced job requirements
  const [form, setForm] = useState({
    firm_name:'', contact_name:'', email:'', role_title:'',
    industry:'', location:'', salary_range:'', role_level:'executive', notes:'',
    role_orientation:'', background_preferred:'', client_interface:'', references_required:'preferred',
  });
  function set(k,v) { setForm(p=>({...p,[k]:v})); }

  async function handleSubmit() {
    if (!form.firm_name || !form.email || !form.role_title) { showToast('Please complete firm name, email, and role title.'); return; }
    if (!form.salary_range) { showToast('Salary range is required — platform standard.'); return; }
    setLoading(true);
    try {
      await sb.from('fed_recruiter_submissions').insert({
        ...form,
        job_requirements: jobReqs,
        tos_agreed: true,
        tos_agreed_at: new Date().toISOString(),
      });
      // Notify admin — billing gate is enforced server-side in notify-posting
      const resp = await fetch('/api/notify-posting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok && data.billing_required) {
        // Billing gate triggered server-side
        setBillingBlock(data.error);
        setLoading(false);
        return;
      }
    } catch(e) {}
    setSubmitted(true);
    setLoading(false);
  }

  if (showBillingSetup) {
    return <RecruiterBillingSetup
      onClose={() => setShowBillingSetup(false)}
      showToast={showToast}
      onSuccess={() => { setShowBillingSetup(false); setBillingBlock(null); }}
    />;
  }

  if (billingBlock) {
    return <PaymentGateModal
      reason={billingBlock}
      onClose={() => setBillingBlock(null)}
      onRequestInvoice={() => setShowBillingSetup(true)}
    />;
  }

  return (
    <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        {step === 'tos' && (
          <TosModal
            onAgree={() => setStep('form')}
            onCancel={onClose}
          />
        )}

        {step === 'form' && (
          <>
            <div className="modal-eyebrow">For Search Firms</div>
            <h2 className="modal-title">Post a Search</h2>
            <p style={{color:'var(--ink-3)',fontSize:'0.875rem',marginBottom:'0.875rem',lineHeight:'1.7'}}>
              Reach qualified senior leaders in maritime, ports and terminals, energy, offshore, and industrial logistics.
              Salary transparency is required on every posting.
            </p>
            <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-rule)',borderLeft:'3px solid var(--gold)',padding:'0.75rem 1rem',marginBottom:'1.5rem',fontSize:'0.78rem',color:'var(--ink-3)'}}>
              ✦ Founding Partner Program 2026 — one search per month, complimentary through December 31, 2026. Introduction fee terms agreed ✓
            </div>

            {submitted ? (
              <div className="success-box">
                <div className="success-title">Submission Received</div>
                <div className="success-desc">We'll be in touch within 24 hours to confirm posting details. As a Founding Partner you receive one complimentary search per month through December 31, 2026.</div>
              </div>
            ) : (
              <>
                <hr className="modal-divider" />
                <div className="modal-section-title">Your Firm</div>
                <div className="form" style={{gap:'0.75rem',marginBottom:'1.5rem'}}>
                  <div className="form-group">
                    <label className="form-label">Search Firm *</label>
                    <input className="form-input" placeholder="Firm name" value={form.firm_name} onChange={e=>set('firm_name',e.target.value)} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Contact Name</label>
                      <input className="form-input" placeholder="Your name" value={form.contact_name} onChange={e=>set('contact_name',e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email *</label>
                      <input className="form-input" type="email" placeholder="you@firm.com" value={form.email} onChange={e=>set('email',e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="modal-section-title">The Role</div>
                <div className="form" style={{gap:'0.75rem'}}>
                  <div className="form-group">
                    <label className="form-label">Role Title *</label>
                    <input className="form-input" placeholder="e.g. Chief Commercial Officer" value={form.role_title} onChange={e=>set('role_title',e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role Level *</label>
                    <div className="visibility-toggle">
                      <button
                        className={`toggle-opt ${form.role_level==='executive'?'active':''}`}
                        onClick={()=>set('role_level','executive')}
                      >
                        Executive — C-Suite / VP
                        <span style={{display:'block',fontSize:'0.55rem',marginTop:'0.1rem',opacity:0.7}}>Intro fee $3,500</span>
                      </button>
                      <button
                        className={`toggle-opt ${form.role_level==='senior'?'active':''}`}
                        onClick={()=>set('role_level','senior')}
                      >
                        Director / Senior Manager
                        <span style={{display:'block',fontSize:'0.55rem',marginTop:'0.1rem',opacity:0.7}}>Intro fee $1,500</span>
                      </button>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Industry</label>
                      <select className="form-select" value={form.industry} onChange={e=>set('industry',e.target.value)}>
                        <option value="">Select</option>
                        <optgroup label="Operational">
                          <option>Maritime &amp; Shipping</option>
                          <option>Ports &amp; Terminals</option>
                          <option>Energy &amp; Offshore</option>
                          <option>Industrial Commodities &amp; Logistics</option>
                        </optgroup>
                        <optgroup label="Industrial Technology">
                          <option>Maritime Technology</option>
                          <option>Port Technology</option>
                          <option>Logistics Technology</option>
                          <option>Industrial SaaS</option>
                          <option>Fleet Intelligence</option>
                          <option>Operational AI</option>
                          <option>Industrial Automation</option>
                          <option>Supply Chain Technology</option>
                          <option>Compliance &amp; Safety Tech</option>
                        </optgroup>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Location</label>
                      <input className="form-input" placeholder="City, Country" value={form.location} onChange={e=>set('location',e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Compensation Range * (required)</label>
                    <input className="form-input" placeholder="e.g. $300K – $400K total compensation" value={form.salary_range} onChange={e=>set('salary_range',e.target.value)} />
                  </div>
                </div>
                
                <div className="modal-section-title" style={{marginTop:'0.5rem'}}>Candidate Preferences</div>
                <div className="form" style={{gap:'0.625rem',marginBottom:'1rem'}}>
                  <div className="form-group">
                    <label className="form-label">Role Orientation</label>
                    <div className="tap-options-row">
                      {[{v:'operational',l:'Operational'},{v:'balanced',l:'Balanced'},{v:'strategic',l:'Strategic'}].map(o=>(
                        <div key={o.v} className={`tap-chip ${form.role_orientation===o.v?'selected':''}`} onClick={()=>set('role_orientation',o.v)}>{o.l}</div>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Background Preferred</label>
                    <div className="tap-options-row">
                      {[{v:'commercial',l:'Commercial'},{v:'operations',l:'Operations'},{v:'finance',l:'Finance'},{v:'open',l:'Open'}].map(o=>(
                        <div key={o.v} className={`tap-chip ${form.background_preferred===o.v?'selected':''}`} onClick={()=>set('background_preferred',o.v)}>{o.l}</div>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client Interface</label>
                    <div className="tap-options-row">
                      {[{v:'must',l:'Must be client-facing'},{v:'mixed',l:'Mixed'},{v:'internal',l:'Primarily internal'}].map(o=>(
                        <div key={o.v} className={`tap-chip ${form.client_interface===o.v?'selected':''}`} onClick={()=>set('client_interface',o.v)}>{o.l}</div>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Verified References</label>
                    <div className="tap-options-row">
                      {[{v:'required',l:'Required'},{v:'preferred',l:'Preferred'},{v:'not_required',l:'Not required'}].map(o=>(
                        <div key={o.v} className={`tap-chip ${form.references_required===o.v?'selected':''}`} onClick={()=>set('references_required',o.v)}>{o.l}</div>
                      ))}
                    </div>
                  </div>
                </div>
<hr className="modal-divider" />
                {/* Advanced job requirements — executive matching */}
                <details style={{marginBottom:'1rem'}}>
                  <summary style={{cursor:'pointer',fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--gold)',padding:'0.5rem 0',userSelect:'none'}}>
                    Advanced Requirements (Work Arrangement, Authority, Compensation Detail, Mandate)
                  </summary>
                  <div style={{paddingTop:'0.5rem'}}>
                    <div style={{fontSize:'0.78rem',color:'var(--ink-4)',lineHeight:'1.5',marginBottom:'0.75rem'}}>
                      These fields improve match quality significantly. They are used only for candidate matching and are not displayed publicly without your approval.
                    </div>
                    <JobRequirementsFields reqs={jobReqs} onChange={setJobReqs} />
                  </div>
                </details>
                <button className="interest-btn" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Submitting…' : 'Submit Search for Review'}
                </button>
                <div className="interest-note">Reviewed within 24 hours. Salary transparency is non-negotiable. Introduction fee terms apply.<br/>Questions? <a href='mailto:desk@fredheimtech.com' style={{color:'var(--gold)'}}>desk@fredheimtech.com</a></div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── PROFILE FORM ──────────────────────────────────────────────────────────────
function ProfileForm({ showToast, onComplete, authUserEmail }) {
  const [step, setStep]           = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [tier, setTier]           = useState('free');
  const [visibility, setVisibility] = useState('discreet');
  const [isUpdate, setIsUpdate]   = useState(false); // true if profile already exists

  // Basic info — pre-fill email from authenticated session
  const [form, setForm] = useState({
    first_name:'', last_name:'', email: authUserEmail || '', current_title:'',
    current_company:'', industry:'', function:'', location:'', salary_min:''
  });
  function set(k,v) {
    // Prevent changing email for authenticated users — it must match their auth account
    if (k === 'email' && authUserEmail) return;
    setForm(p=>({...p,[k]:v}));
  }

  // Check if an existing profile already exists for this email
  useEffect(() => {
    if (!authUserEmail) return;
    sb.from('fed_profiles').select('id').eq('email', authUserEmail).maybeSingle().then(({ data }) => {
      if (data) setIsUpdate(true);
    });
  }, [authUserEmail]);

  // Career timeline — up to 4 entries
  const [career, setCareer] = useState([
    { title:'', company:'', years_from:'', years_to:'', current: false }
  ]);
  function addCareer() {
    if (career.length >= 4) return;
    setCareer(p=>[...p, { title:'', company:'', years_from:'', years_to:'', current:false }]);
  }
  function removeCareer(i) { setCareer(p=>p.filter((_,idx)=>idx!==i)); }
  function setCareerField(i,k,v) { setCareer(p=>p.map((e,idx)=>idx===i?{...e,[k]:v}:e)); }

  // Achievements
  const [achievements, setAchievements] = useState(['','','']);
  function setAch(i,v) { setAchievements(p=>p.map((a,idx)=>idx===i?v:a)); }

  // Big Five
  const [shareBigFive, setShareBigFive] = useState(false);
  const [bigFive, setBigFive] = useState({
    openness: 50, conscientiousness: 50, extraversion: 50,
    agreeableness: 50, emotional_stability: 50
  });
  function setBF(k,v) { setBigFive(p=>({...p,[k]:v})); }

  // Vetting state
  const [vetting, setVetting] = useState({
    availability_status: '',
    notice_period: '',
    relocation: '',
    has_pl_responsibility: null,
    has_client_contact: null,
    largest_contract_signed: '',
    orientation_score: 50,
    background_track: '',
    ownership_comfort: '',
    travel_tolerance: '',
    comp_structure: '',
    market_presence: '',
  });
  function setV(k,v) { setVetting(p=>({...p,[k]:v})); }

  // ── SCOPE & COMPLEXITY STATE ────────────────────────────────────────────
  // Captures what the candidate currently DOES — independent of title. This
  // feeds the platform's core matching signal. Tier keys mirror SCOPE_TIERS;
  // binary flags mirror COMPLEXITY_FLAGS and STRATEGIC_FLAGS.
  const [scope, setScope] = useState(emptyCandidateScope());
  function setOrg(k, v)        { setScope(p => ({ ...p, org_scope:  { ...p.org_scope,  [k]: v } })); }
  function setComplexity(k, v) { setScope(p => ({ ...p, complexity: { ...p.complexity, [k]: v } })); }
  function setStrategic(k, v)  { setScope(p => ({ ...p, strategic:  { ...p.strategic,  [k]: v } })); }
  function toggleTransport(modeKey) {
    setScope(p => {
      const current = new Set(p.complexity.transport_modes || []);
      if (current.has(modeKey)) current.delete(modeKey); else current.add(modeKey);
      return { ...p, complexity: { ...p.complexity, transport_modes: [...current] } };
    });
  }
  // Generic toggle for commercial multi-select arrays (revenue_models,
  // sales_motions, technical_fluency).
  function toggleCommercial(arrayKey, optionKey) {
    setScope(p => {
      const current = new Set((p.commercial && p.commercial[arrayKey]) || []);
      if (current.has(optionKey)) current.delete(optionKey); else current.add(optionKey);
      return { ...p, commercial: { ...(p.commercial || {}), [arrayKey]: [...current] } };
    });
  }
  const scopeMetrics = useMemo(() => deriveScopeMetrics(scope), [scope]);

  // Prefill scope data when an existing profile is loaded
  useEffect(() => {
    if (!authUserEmail) return;
    sb.from('fed_profiles')
      .select('candidate_scope')
      .eq('email', authUserEmail)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.candidate_scope) return;
        const stored = typeof data.candidate_scope === 'string'
          ? JSON.parse(data.candidate_scope) : data.candidate_scope;
        if (stored && (stored.org_scope || stored.complexity || stored.strategic)) {
          // Merge stored values over the empty skeleton so any newly added
          // fields default cleanly rather than coming through as undefined.
          const blank = emptyCandidateScope();
          setScope({
            org_scope:  { ...blank.org_scope,  ...(stored.org_scope  || {}) },
            complexity: { ...blank.complexity, ...(stored.complexity || {}) },
            strategic:  { ...blank.strategic,  ...(stored.strategic  || {}) },
            commercial: { ...blank.commercial, ...(stored.commercial || {}) },
          });
        }
      });
  }, [authUserEmail]);

  // References state
  const [refs, setRefs] = useState([
    { name:'', email:'' },
    { name:'', email:'' },
  ]);
  function setRef(i,k,v) { setRefs(p=>p.map((r,idx)=>idx===i?{...r,[k]:v}:r)); }

  const TRAITS = [
    {
      key: 'openness',
      name: 'Openness to Experience',
      desc: 'Curiosity, creativity, and comfort with new ideas and change.',
      low: 'Conventional', high: 'Imaginative'
    },
    {
      key: 'conscientiousness',
      name: 'Conscientiousness',
      desc: 'Organization, dependability, and goal-directed discipline.',
      low: 'Flexible', high: 'Disciplined'
    },
    {
      key: 'extraversion',
      name: 'Extraversion',
      desc: 'Sociability, assertiveness, and positive engagement with others.',
      low: 'Reserved', high: 'Outgoing'
    },
    {
      key: 'agreeableness',
      name: 'Agreeableness',
      desc: 'Cooperation, trust, and concern for social harmony.',
      low: 'Competitive', high: 'Collaborative'
    },
    {
      key: 'emotional_stability',
      name: 'Neuroticism',
      desc: 'How you respond to stress and negative emotion. Lower scores mean calmer, more resilient. Enter your Neuroticism percentile exactly as shown on Understand Myself.',
      low: 'Calm & Resilient', high: 'Stress-Reactive',
      note: 'Low score = high emotional stability. Enter your exact Neuroticism percentile from Understand Myself.'
    },
  ];

  function scoreLabel(v) {
    if (v <= 20) return 'Very Low';
    if (v <= 38) return 'Low';
    if (v <= 62) return 'Moderate';
    if (v <= 80) return 'High';
    return 'Very High';
  }

  function neuroticismLabel(v) {
    // Neuroticism is inverse — low score = high stability
    if (v <= 10) return 'Exceptionally Calm';
    if (v <= 25) return 'Very Calm & Stable';
    if (v <= 45) return 'Generally Calm';
    if (v <= 60) return 'Moderate Reactivity';
    if (v <= 80) return 'Stress-Prone';
    return 'Highly Reactive';
  }

  function validateStep() {
    if (step === 1) {
      if (!form.first_name || !form.email || !form.current_title) {
        showToast('Please complete name, email, and current title.');
        return false;
      }
    }
    if (step === 3) {
      // Scope step is optional, but warn if candidate completes nothing —
      // we don't block, because partial intake is better than no intake.
      const o = scope.org_scope || {};
      const hasAny = o.direct_reports || o.total_team_size || o.budget_responsibility
                  || o.pnl_owned === true || o.capex_authority || o.sites_managed
                  || o.geographic_scope;
      if (!hasAny) {
        showToast('Scope inputs help recruiters find you — adding even a few improves match quality.');
        // Allow proceeding (return true) — soft nudge only.
      }
    }
    return true;
  }

  async function handleSubmit() {
    setLoading(true);

    // Derive scope metrics fresh from the latest scope state so saved values
    // always match what the candidate saw in the form.
    const metrics = deriveScopeMetrics(scope);

    const profileData = {
      ...form,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      visibility,
      tier,
      career_timeline: JSON.stringify(career.filter(e=>e.title||e.company)),
      achievements: JSON.stringify(achievements.filter(a=>a.trim())),
      big_five: shareBigFive ? JSON.stringify(bigFive) : null,
      big_five_shared: shareBigFive,
      candidate_scope:       scope,
      scope_score:           metrics.scope_score,
      complexity_score:      metrics.complexity_score,
      strategic_score:       metrics.strategic_score,
      commercial_score:      metrics.commercial_score,
      leadership_class:      metrics.leadership_class,
      complexity_class:      metrics.complexity_class,
      equivalent_label:      metrics.equivalent_label,
      industrial_translator: metrics.industrial_translator,
      scope_updated_at:      new Date().toISOString(),
    };

    // C1 FIX: Never downgrade a paid tier via form re-submission.
    // If an existing profile already has a paid tier, preserve it regardless of form state.
    if (isUpdate) {
      try {
        const { data: existing } = await sb
          .from('fed_profiles')
          .select('tier')
          .eq('email', form.email)
          .maybeSingle();
        const paidTiers = ['confidential', 'active', 'active_senior'];
        if (existing && paidTiers.includes(existing.tier)) {
          // Keep their paid tier — do not allow form to overwrite it
          profileData.tier = existing.tier;
        }
      } catch(e) { /* non-critical — proceed with form tier */ }
    }

    try {
      await sb.from('fed_profiles').upsert(profileData, { onConflict: 'email' });
    } catch(e) { console.log('Profile save:', e); }

    // Save references and send questionnaire emails
    const validRefs = refs.filter(r => r.name && r.email);
    if (validRefs.length > 0) {
      try {
        for (const ref of validRefs) {
          const { data: refData } = await sb.from('fed_references').insert({
            profile_email: form.email,
            ref_name: ref.name,
            ref_email: ref.email,
            status: 'pending',
          }).select().single();

          if (refData?.token) {
            // Send questionnaire email to the reference via /api/notify-reference
            fetch('/api/notify-reference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ref_name:       ref.name,
                ref_email:      ref.email,
                candidate_name: form.first_name + (form.last_name ? ' ' + form.last_name : ''),
                token:          refData.token,
              }),
            }).catch(e => console.error('Reference notify failed:', e));
          }
        }
      } catch(e) { console.log('Reference save error:', e); }
    }

    if (tier === 'confidential') {
      await redirectToTierCheckout({ tier, email: form.email, showToast });
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
    // Route to profile dashboard after brief confirmation display
    setTimeout(() => { if (onComplete) onComplete(); }, 2000);
  }

  if (submitted) return (
    <div className="success-box">
      <div className="success-title">Profile Created</div>
      <div className="success-desc" style={{marginTop:'0.5rem'}}>
        Welcome to Fredheim Executive Desk.
        {visibility === 'discreet'
          ? ' Your profile is confidential — you initiate all contact.'
          : ' Your profile is visible to posting search firms.'
        }
        {' '}You'll receive alerts when matching searches are posted.
      </div>
    </div>
  );

  const steps = ['Basics','Career','Scope','Personality','Preferences','Vetting'];

  return (
    <div className="form">
      {/* Step indicator */}
      <div className="step-indicator">
        {steps.map((s,i) => (
          <React.Fragment key={s}>
            <div className="step-item">
              <div className={`step-num ${step===i+1?'active':step>i+1?'done':''}`}>
                {step > i+1 ? '' : i+1}
              </div>
              <div className={`step-label ${step===i+1?'active':''}`}>{s}</div>
            </div>
            {i < steps.length-1 && <div className="step-line" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: BASICS ── */}
      {step === 1 && (
        <>
          {isUpdate && (
            <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-rule)',borderLeft:'3px solid var(--gold)',padding:'0.75rem 1rem',marginBottom:'1.25rem',fontSize:'0.8rem',color:'var(--ink-3)',lineHeight:'1.5'}}>
              ⚠ You already have a profile. Submitting this form will update your existing profile.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Member Tier</label>
            <div className="tiers" style={{gridTemplateColumns:'1fr 1fr'}}>
              <div className={`tier-card ${tier==='free'?'selected':''}`} onClick={()=>setTier('free')}>
                <div className="tier-name">Free</div>
                <div className="tier-price">$0</div>
                <div className="tier-desc">Browse and signal interest. You control all contact.</div>
              </div>
              <div className={`tier-card ${tier==='confidential'?'selected':''}`} onClick={()=>setTier('confidential')}>
                <div className="tier-name">Confidential</div>
                <div className="tier-price">$299 <span style={{fontSize:'0.85rem',fontWeight:400,color:'var(--ink-4)'}}>/ yr</span></div>
                <div className="tier-desc">Identity hidden until you approve each connection. You control every reveal.</div>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" placeholder="First" value={form.first_name} onChange={e=>set('first_name',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" placeholder="Last" value={form.last_name} onChange={e=>set('last_name',e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Current Title *</label><input className="form-input" placeholder="e.g. Chief Commercial Officer" value={form.current_title} onChange={e=>set('current_title',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Current Company (confidential — never displayed)</label><input className="form-input" placeholder="Your employer" value={form.current_company} onChange={e=>set('current_company',e.target.value)} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Industry</label>
              <IndustryMultiSelect
                value={Array.isArray(form.industry) ? form.industry : (form.industry ? [form.industry] : [])}
                onChange={v => set('industry', v)}
                placeholder="Select industries…"
              />
            </div>
            <div className="form-group"><label className="form-label">Function</label>
              <select className="form-select" value={form.function} onChange={e=>set('function',e.target.value)}>
                <option value="">Select</option><option>Commercial</option><option>Operations</option><option>Chartering</option><option>Business Development</option><option>Finance</option><option>General Management</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Location</label><input className="form-input" placeholder="City, Country" value={form.location} onChange={e=>set('location',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Compensation Floor</label>
              <select className="form-select" value={form.salary_min} onChange={e=>set('salary_min',e.target.value)}>
                <option value="">Select minimum</option>
                <option value="100000">$100K+</option>
                <option value="150000">$150K+</option>
                <option value="200000">$200K+</option>
                <option value="300000">$300K+</option>
                <option value="400000">$400K+</option>
                <option value="500000">$500K+</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" placeholder="your@email.com" value={form.email} onChange={e=>set('email',e.target.value)} readOnly={!!authUserEmail} style={authUserEmail ? {background:'var(--paper-2)',color:'var(--ink-3)',cursor:'default'} : {}} /></div>

          <div className="step-nav">
            <button className="step-next" onClick={() => { if(validateStep()) setStep(2); }}>
              Continue — Career History →
            </button>
          </div>
        </>
      )}

      {/* ── STEP 2: CAREER ── */}
      {step === 2 && (
        <>
          <div className="modal-section-title" style={{marginBottom:'0.5rem'}}>Career Timeline</div>
          <p style={{fontSize:'0.82rem',color:'var(--ink-4)',marginBottom:'1.25rem',lineHeight:'1.6'}}>
            Add your last 3–4 roles. This replaces the need for a resume in most initial conversations.
          </p>

          {career.map((entry, i) => (
            <div key={i} className="career-entry">
              <div className="career-entry-header">
                <div className="career-entry-title">Role {i+1}</div>
                {career.length > 1 && (
                  <button className="career-remove" onClick={() => removeCareer(i)}>✕</button>
                )}
              </div>
              <div className="form-row" style={{marginBottom:'0.625rem'}}>
                <div className="form-group"><label className="form-label">Title</label><input className="form-input" placeholder="e.g. Commercial Director" value={entry.title} onChange={e=>setCareerField(i,'title',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Company</label><input className="form-input" placeholder="Company name" value={entry.company} onChange={e=>setCareerField(i,'company',e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">From (year)</label><input className="form-input" placeholder="2018" value={entry.years_from} onChange={e=>setCareerField(i,'years_from',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">To (year)</label><input className="form-input" placeholder={entry.current?'Present':'2023'} value={entry.current?'Present':entry.years_to} onChange={e=>setCareerField(i,'years_to',e.target.value)} disabled={entry.current} /></div>
              </div>
              <div className="big-five-share-toggle" style={{marginTop:'0.625rem'}} onClick={()=>setCareerField(i,'current',!entry.current)}>
                <div className={`toggle-switch ${entry.current?'on':''}`} />
                <div className="toggle-label">This is my current role</div>
              </div>
            </div>
          ))}

          {career.length < 4 && (
            <button className="add-entry-btn" onClick={addCareer}>+ Add Another Role</button>
          )}

          <div style={{marginTop:'1.5rem'}}>
            <div className="modal-section-title" style={{marginBottom:'0.5rem'}}>Key Achievements</div>
            <p style={{fontSize:'0.82rem',color:'var(--ink-4)',marginBottom:'1rem',lineHeight:'1.6'}}>
              3 bullet points. Specific, quantified where possible. This is what recruiters read first.
            </p>
            {achievements.map((a,i) => (
              <div key={i} className="form-group" style={{marginBottom:'0.625rem'}}>
                <label className="form-label">Achievement {i+1}</label>
                <input className="form-input" placeholder={
                  i===0 ? 'e.g. Led acquisition of Port Nickel — $30M, 387 acres, 5,720ft riverfront' :
                  i===1 ? 'e.g. Built SESCO TransAmerica vessel operating entity from concept to execution' :
                  'e.g. Negotiated 45,000 ST/yr fly ash contract at Wingate terminal'
                } value={a} onChange={e=>setAch(i,e.target.value)} />
              </div>
            ))}
          </div>

          <div className="step-nav">
            <button className="step-back" onClick={()=>setStep(1)}>← Back</button>
            <button className="step-next" onClick={()=>setStep(3)}>Continue — Scope &amp; Complexity →</button>
          </div>
        </>
      )}

      {/* ── STEP 3: SCOPE & COMPLEXITY ─────────────────────────────────────── */}
      {/* The platform's core moat: classification of operational scope, not
          title. Three sections (Org Scope, Operational Complexity, Strategic
          Responsibility) populate candidate_scope JSONB. Live derivation of
          Scope Score, Complexity Score, and Equivalent Leadership Mapping is
          displayed as the candidate fills.                                   */}
      {step === 3 && (
        <>
          <div className="modal-section-title" style={{marginBottom:'0.5rem'}}>Scope &amp; Complexity</div>
          <p style={{fontSize:'0.82rem',color:'var(--ink-4)',marginBottom:'1.25rem',lineHeight:'1.6'}}>
            Fredheim matches on what you actually do — not what your business card says.
            Titles in industrial, maritime, and logistics environments are inconsistent.
            Operational scope is not. The data below is the platform's primary matching
            signal and the basis for the Equivalent Leadership Mapping shown on your
            profile.
          </p>

          {/* Live derivation panel — visible from the top so candidate sees the signal forming */}
          <div className="scope-derivation-panel">
            <div className="scope-derivation-eyebrow">Your Equivalent Leadership Mapping</div>
            <div className="scope-derivation-label">
              {scopeMetrics.equivalent_label || 'Complete the inputs below to generate your mapping.'}
            </div>
            {scopeMetrics.industrial_translator && (
              <div className="scope-translator-badge">
                Industrial-commercial translator — recurring-revenue commercial profile
                combined with industrial domain fluency.
              </div>
            )}
            <div className="scope-derivation-meters">
              <div className="scope-meter">
                <div className="scope-meter-label">Scope</div>
                <div className="scope-meter-bar"><div className="scope-meter-fill" style={{width:`${scopeMetrics.scope_score}%`}} /></div>
                <div className="scope-meter-num">{scopeMetrics.scope_score}</div>
              </div>
              <div className="scope-meter">
                <div className="scope-meter-label">Complexity</div>
                <div className="scope-meter-bar"><div className="scope-meter-fill complexity" style={{width:`${scopeMetrics.complexity_score}%`}} /></div>
                <div className="scope-meter-num">{scopeMetrics.complexity_score}</div>
              </div>
              <div className="scope-meter">
                <div className="scope-meter-label">Strategic</div>
                <div className="scope-meter-bar"><div className="scope-meter-fill strategic" style={{width:`${scopeMetrics.strategic_score}%`}} /></div>
                <div className="scope-meter-num">{scopeMetrics.strategic_score}</div>
              </div>
              <div className="scope-meter">
                <div className="scope-meter-label">Commercial</div>
                <div className="scope-meter-bar"><div className="scope-meter-fill commercial" style={{width:`${scopeMetrics.commercial_score}%`}} /></div>
                <div className="scope-meter-num">{scopeMetrics.commercial_score}</div>
              </div>
            </div>
          </div>

          {/* ── ORGANIZATIONAL SCOPE ───────────────────────────────────────── */}
          <div className="scope-section">
            <div className="scope-section-title">Organizational Scope</div>
            <p className="scope-section-desc">
              What you accountably manage today — people, money, and footprint. Choose the
              tier that best reflects your current role; ranges are deliberate so smaller
              firms aren't penalized for not having multi-billion-dollar budgets.
            </p>

            <div className="scope-field">
              <label className="scope-field-label">Direct Reports</label>
              <div className="scope-tier-row">
                {SCOPE_TIERS.direct_reports.map(t => (
                  <div key={t.key}
                       className={`scope-tier-chip ${scope.org_scope.direct_reports===t.key?'selected':''}`}
                       onClick={() => setOrg('direct_reports', t.key)}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">Total Team Size (direct + indirect)</label>
              <div className="scope-tier-row">
                {SCOPE_TIERS.total_team_size.map(t => (
                  <div key={t.key}
                       className={`scope-tier-chip ${scope.org_scope.total_team_size===t.key?'selected':''}`}
                       onClick={() => setOrg('total_team_size', t.key)}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">Operating Budget Managed (annual)</label>
              <div className="scope-tier-row">
                {SCOPE_TIERS.budget_responsibility.map(t => (
                  <div key={t.key}
                       className={`scope-tier-chip ${scope.org_scope.budget_responsibility===t.key?'selected':''}`}
                       onClick={() => setOrg('budget_responsibility', t.key)}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">P&amp;L Ownership</label>
              <div className="scope-tier-row" style={{marginBottom:'0.5rem'}}>
                <div className={`scope-tier-chip ${scope.org_scope.pnl_owned===true?'selected':''}`}
                     onClick={() => setOrg('pnl_owned', true)}>Yes — I own a P&amp;L</div>
                <div className={`scope-tier-chip ${scope.org_scope.pnl_owned===false?'selected':''}`}
                     onClick={() => { setOrg('pnl_owned', false); setOrg('pnl_size', null); }}>No</div>
              </div>
              {scope.org_scope.pnl_owned === true && (
                <>
                  <div className="scope-field-sublabel">P&amp;L Annual Revenue</div>
                  <div className="scope-tier-row">
                    {SCOPE_TIERS.pnl_size.map(t => (
                      <div key={t.key}
                           className={`scope-tier-chip ${scope.org_scope.pnl_size===t.key?'selected':''}`}
                           onClick={() => setOrg('pnl_size', t.key)}>
                        {t.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="scope-field">
              <label className="scope-field-label">Capex Sign-Off Authority (without escalation)</label>
              <div className="scope-tier-row">
                {SCOPE_TIERS.capex_authority.map(t => (
                  <div key={t.key}
                       className={`scope-tier-chip ${scope.org_scope.capex_authority===t.key?'selected':''}`}
                       onClick={() => setOrg('capex_authority', t.key)}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">Sites / Facilities Managed</label>
              <div className="scope-tier-row">
                {SCOPE_TIERS.sites_managed.map(t => (
                  <div key={t.key}
                       className={`scope-tier-chip ${scope.org_scope.sites_managed===t.key?'selected':''}`}
                       onClick={() => setOrg('sites_managed', t.key)}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">Geographic Scope</label>
              <div className="scope-tier-row">
                {SCOPE_TIERS.geographic_scope.map(t => (
                  <div key={t.key}
                       className={`scope-tier-chip ${scope.org_scope.geographic_scope===t.key?'selected':''}`}
                       onClick={() => setOrg('geographic_scope', t.key)}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">International Responsibility</label>
              <div className="scope-tier-row">
                <div className={`scope-tier-chip ${scope.org_scope.international_responsibility===true?'selected':''}`}
                     onClick={() => setOrg('international_responsibility', true)}>Yes — work crosses borders</div>
                <div className={`scope-tier-chip ${scope.org_scope.international_responsibility===false?'selected':''}`}
                     onClick={() => setOrg('international_responsibility', false)}>No — domestic only</div>
              </div>
            </div>
          </div>

          {/* ── OPERATIONAL COMPLEXITY ─────────────────────────────────────── */}
          <div className="scope-section">
            <div className="scope-section-title">Operational Complexity</div>
            <p className="scope-section-desc">
              Specific operating environments and disciplines you've handled. These are the
              experiences that scoring a candidate by title alone misses. Select all that apply.
            </p>

            <div className="scope-flag-grid">
              {Object.entries(COMPLEXITY_FLAGS).map(([key, def]) => (
                <div key={key}
                     className={`scope-flag-card ${scope.complexity[key]?'selected':''}`}
                     onClick={() => setComplexity(key, !scope.complexity[key])}>
                  <div className={`scope-flag-toggle ${scope.complexity[key]?'on':''}`} />
                  <div className="scope-flag-label">{def.label}</div>
                </div>
              ))}
            </div>

            <div className="scope-field" style={{marginTop:'1rem'}}>
              <label className="scope-field-label">Transport Modes Integrated</label>
              <div className="scope-tier-row">
                {TRANSPORT_MODES.map(m => (
                  <div key={m.key}
                       className={`scope-tier-chip ${(scope.complexity.transport_modes||[]).includes(m.key)?'selected':''}`}
                       onClick={() => toggleTransport(m.key)}>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">Operational Scale</label>
              <div className="scope-tier-row">
                {SCOPE_TIERS.operational_scale.map(t => (
                  <div key={t.key}
                       className={`scope-tier-chip ${scope.complexity.operational_scale===t.key?'selected':''}`}
                       onClick={() => setComplexity('operational_scale', t.key)}>
                    {t.label}
                  </div>
                ))}
              </div>
              <p className="scope-field-hint">
                Small = single small operation. Very large = sustained scale across multiple
                large sites or significant national/global throughput.
              </p>
            </div>
          </div>

          {/* ── STRATEGIC RESPONSIBILITY ───────────────────────────────────── */}
          <div className="scope-section">
            <div className="scope-section-title">Strategic Responsibility</div>
            <p className="scope-section-desc">
              Beyond operating the business — what have you built, integrated, or transformed.
              These differentiate candidates with the same operational scope but very different
              strategic depth. Select all that apply.
            </p>

            <div className="scope-flag-grid">
              {Object.entries(STRATEGIC_FLAGS).map(([key, def]) => (
                <div key={key}
                     className={`scope-flag-card ${scope.strategic[key]?'selected':''}`}
                     onClick={() => setStrategic(key, !scope.strategic[key])}>
                  <div className={`scope-flag-toggle ${scope.strategic[key]?'on':''}`} />
                  <div className="scope-flag-label">{def.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── COMMERCIAL & TECHNICAL FLUENCY ──────────────────────────────
              The dimension that matters for industrial-technology and
              maritime-SaaS roles. A profile with both an industrial revenue
              model and industrial technical fluency is the "industrial-
              commercial translator" — the hire that generic SaaS recruiters
              cannot find and traditional maritime recruiters cannot evaluate. */}
          <div className="scope-section">
            <div className="scope-section-title">Commercial &amp; Technical Fluency</div>
            <p className="scope-section-desc">
              How you've made money and what systems you've worked with. Especially relevant for
              industrial-technology, maritime-SaaS, port-tech, and operational-AI roles where
              hires need to translate between commercial and operational worlds. Optional —
              skip if it doesn't apply to your background.
            </p>

            <div className="scope-field">
              <label className="scope-field-label">Revenue Model Experience</label>
              <div className="scope-tier-row">
                {REVENUE_MODELS.map(opt => (
                  <div key={opt.key}
                       className={`scope-tier-chip ${(scope.commercial?.revenue_models||[]).includes(opt.key)?'selected':''}`}
                       onClick={() => toggleCommercial('revenue_models', opt.key)}>
                    {opt.label}
                  </div>
                ))}
              </div>
              <p className="scope-field-hint">
                Select every model you have direct experience driving — not just exposure to.
              </p>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">Sales Motion</label>
              <div className="scope-tier-row">
                {SALES_MOTIONS.map(opt => (
                  <div key={opt.key}
                       className={`scope-tier-chip ${(scope.commercial?.sales_motions||[]).includes(opt.key)?'selected':''}`}
                       onClick={() => toggleCommercial('sales_motions', opt.key)}>
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-field">
              <label className="scope-field-label">Technical Fluency</label>
              <div className="scope-tier-row">
                {TECHNICAL_FLUENCY.map(opt => (
                  <div key={opt.key}
                       className={`scope-tier-chip ${(scope.commercial?.technical_fluency||[]).includes(opt.key)?'selected':''}`}
                       onClick={() => toggleCommercial('technical_fluency', opt.key)}>
                    {opt.label}
                  </div>
                ))}
              </div>
              <p className="scope-field-hint">
                Select systems and categories you've operated, sold, or implemented at a working level.
              </p>
            </div>
          </div>

          {/* Closing note */}
          <div style={{background:'var(--paper-2)',border:'1px solid var(--rule)',padding:'0.875rem 1rem',marginTop:'1rem',fontSize:'0.75rem',color:'var(--ink-4)',lineHeight:'1.55'}}>
            Your inputs here drive matching, ranking, and the Equivalent Leadership Mapping that
            recruiters see. Recruiters never see the raw answers — only your derived classification
            ({scopeMetrics.equivalent_label || 'pending'}) and aligned attributes. You can revisit
            and update these any time.
          </div>

          <div className="step-nav">
            <button className="step-back" onClick={()=>setStep(2)}>← Back</button>
            <button className="step-next" onClick={() => { if(validateStep()) setStep(4); }}>
              Continue — Personality →
            </button>
          </div>
        </>
      )}

      {/* ── STEP 4: PERSONALITY ── */}
      {step === 4 && (
        <>
          <div className="modal-section-title" style={{marginBottom:'0.5rem'}}>Big Five Personality Profile</div>

          <div className="big-five-intro">
            This is <strong>optional</strong> and entirely your choice. The Big Five is the most
            research-validated personality framework in existence — the same model used by
            Heidrick & Struggles, Korn Ferry, and Spencer Stuart in senior-level searches.
            Take the assessment at{' '}
            <a href="https://understandmyself.com" target="_blank" rel="noopener noreferrer">
              understandmyself.com
            </a>{' '}
            ($10), then enter your percentile scores exactly as shown. Note: Understand Myself
            reports <strong>Neuroticism</strong> (not Emotional Stability) — enter that score directly.
            A low Neuroticism score means high emotional stability. You control whether recruiters see this.
          </div>

          <div className="big-five-share-toggle" onClick={()=>setShareBigFive(!shareBigFive)}>
            <div className={`toggle-switch ${shareBigFive?'on':''}`} />
            <div className="toggle-label">
              <strong>{shareBigFive ? 'Sharing with recruiters' : 'Not sharing with recruiters'}</strong>
              {' '}— {shareBigFive
                ? 'Your scores will be visible to recruiting firms when your profile is viewed.'
                : 'Your scores are private. Toggle on to share them with posting search firms.'
              }
            </div>
          </div>

          {TRAITS.map(t => (
            <div key={t.key} className="trait-row">
              <div className="trait-header">
                <div className="trait-name">{t.name}</div>
                <div className="trait-score-display">
                  {t.key === 'emotional_stability'
                    ? `${neuroticismLabel(bigFive[t.key])} — ${bigFive[t.key]}th percentile`
                    : `${scoreLabel(bigFive[t.key])} — ${bigFive[t.key]}th percentile`
                  }
                </div>
              </div>
              <div className="trait-desc">{t.desc}</div>
              {t.key === 'emotional_stability' && (
                <div style={{fontSize:'0.72rem',color:'var(--gold)',marginBottom:'0.375rem',fontFamily:"'DM Mono',monospace",letterSpacing:'0.06em'}}>
                  ↑ Lower percentile = calmer and more emotionally stable
                </div>
              )}
              <input
                type="range"
                className="trait-slider"
                min="1" max="99"
                value={bigFive[t.key]}
                onChange={e=>setBF(t.key, parseInt(e.target.value))}
              />
              <div className="trait-labels">
                <span className="trait-label-text">{t.low}</span>
                <span className="trait-label-text">{t.high}</span>
              </div>
            </div>
          ))}

          <p style={{fontSize:'0.72rem',color:'var(--ink-4)',lineHeight:'1.6',marginTop:'0.5rem'}}>
            Scores are self-reported. Fredheim Executive Desk prohibits use of personality data
            as a screening or disqualification criterion. See our Terms of Service.
          </p>

          <div className="step-nav">
            <button className="step-back" onClick={()=>setStep(3)}>← Back</button>
            <button className="step-next" onClick={()=>setStep(5)}>Continue — Preferences →</button>
          </div>
        </>
      )}

      {/* ── STEP 5: PREFERENCES ── */}
      {step === 5 && (
        <>
          <div className="modal-section-title" style={{marginBottom:'0.5rem'}}>Search Preferences</div>

          <div className="form-group">
            <label className="form-label">Profile Visibility</label>
            <div className="visibility-toggle">
              <button className={`toggle-opt ${visibility==='discreet'?'active':''}`} onClick={()=>setVisibility('discreet')}>
                Discreet — I initiate contact
              </button>
              <button className={`toggle-opt ${visibility==='open'?'active':''}`} onClick={()=>setVisibility('open')}>
                Open — Recruiters can reach me
              </button>
            </div>
            <p style={{fontSize:'0.72rem',color:'var(--ink-4)',marginTop:'0.375rem',lineHeight:'1.5'}}>
              Discreet: only visible when you express interest in a specific search.
              Open: visible to all posting search firms (Confidential tier only).
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Geographic Availability</label>
            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
              {(() => {
                const geos = form.geo_prefs ? JSON.parse(form.geo_prefs) : [];
                const setGeos = (v) => set('geo_prefs', JSON.stringify(v));
                return ['Open to relocation','North America','Europe','Middle East','Asia Pacific','Remote only'].map(geo => {
                  const selected = geos.includes(geo);
                  return (
                    <button
                      key={geo}
                      onClick={() => setGeos(selected ? geos.filter(g=>g!==geo) : [...geos, geo])}
                      style={{
                        background: selected ? 'var(--ink)' : 'var(--paper)',
                        color: selected ? 'var(--white)' : 'var(--ink-3)',
                        border: `1px solid ${selected ? 'var(--ink)' : 'var(--rule)'}`,
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '0.62rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '0.4rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >{geo}</button>
                  );
                });
              })()}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Board Experience</label>
            <div className="visibility-toggle">
              <button className={`toggle-opt ${form.board_experience==='yes'?'active':''}`} onClick={()=>set('board_experience','yes')}>Yes — Board Member or Advisor</button>
              <button className={`toggle-opt ${form.board_experience==='no'?'active':''}`} onClick={()=>set('board_experience','no')}>No board experience</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Languages (optional)</label>
            <input className="form-input" placeholder="e.g. English (native), Norwegian, Arabic" value={form.languages||''} onChange={e=>set('languages',e.target.value)} />
          </div>

          <div style={{background:'var(--paper-2)',border:'1px solid var(--rule)',padding:'1rem 1.25rem',marginBottom:'1rem',fontSize:'0.78rem',color:'var(--ink-3)',lineHeight:'1.65'}}>
            <strong style={{color:'var(--ink)'}}>Profile summary:</strong> {form.current_title || 'Executive'} · {Array.isArray(form.industry) ? form.industry.join(', ') : (form.industry || 'Select industry')} · {form.location || 'Location TBD'} ·{' '}
            {career.filter(e=>e.title).length} career roles · {achievements.filter(a=>a).length} achievements ·{' '}
            {shareBigFive ? 'Big Five shared' : 'Big Five private'} ·{' '}
            {tier === 'free' ? 'Free tier' : 'Confidential $299/yr'}
          </div>

          <div className="step-nav" style={{marginTop:'0'}}>
            <button className="step-back" onClick={()=>setStep(4)}>← Back</button>
            <button className="step-next" onClick={()=>setStep(6)}>Continue — Vetting & References →</button>
          </div>
        </>
      )}

      {/* ── STEP 6: VETTING & REFERENCES ── */}
      {step === 6 && (
        <>
          {/* Availability */}
          <div className="vetting-section">
            <div className="vetting-section-title">Availability</div>
            <div className="form-group" style={{marginBottom:'0.875rem'}}>
              <label className="form-label">Current Status</label>
              <div className="tap-options">
                {[
                  {v:'employed_open', l:'Employed — open to the right opportunity'},
                  {v:'actively_looking', l:'Actively looking'},
                  {v:'available_now', l:'Available immediately'},
                ].map(o => (
                  <div key={o.v} className={`tap-option ${vetting.availability_status===o.v?'selected':''}`} onClick={()=>setV('availability_status',o.v)}>
                    <div className="tap-radio" /><div className="tap-option-text">{o.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Notice Period</label>
                <div className="tap-options-row">
                  {[{v:'immediate',l:'Immediate'},{v:'30_days',l:'30 days'},{v:'60_days',l:'60 days'},{v:'90_plus',l:'90+ days'}].map(o=>(
                    <div key={o.v} className={`tap-chip ${vetting.notice_period===o.v?'selected':''}`} onClick={()=>setV('notice_period',o.v)}>{o.l}</div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Relocation</label>
                <div className="tap-options-row">
                  {[{v:'open',l:'Open'},{v:'same_region',l:'Same region'},{v:'not_relocating',l:'Not relocating'}].map(o=>(
                    <div key={o.v} className={`tap-chip ${vetting.relocation===o.v?'selected':''}`} onClick={()=>setV('relocation',o.v)}>{o.l}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Scope */}
          <div className="vetting-section">
            <div className="vetting-section-title">Scope of Accountability</div>
            <div className="form-row" style={{marginBottom:'0.875rem'}}>
              <div className="form-group">
                <label className="form-label">P&L Responsibility</label>
                <div className="tap-options-row">
                  <div className={`tap-chip ${vetting.has_pl_responsibility===true?'selected':''}`} onClick={()=>setV('has_pl_responsibility',true)}>Yes</div>
                  <div className={`tap-chip ${vetting.has_pl_responsibility===false?'selected':''}`} onClick={()=>setV('has_pl_responsibility',false)}>No</div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Direct Client Contact</label>
                <div className="tap-options-row">
                  <div className={`tap-chip ${vetting.has_client_contact===true?'selected':''}`} onClick={()=>setV('has_client_contact',true)}>Yes</div>
                  <div className={`tap-chip ${vetting.has_client_contact===false?'selected':''}`} onClick={()=>setV('has_client_contact',false)}>No</div>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Largest Contract Signed Independently</label>
              <input className="form-input" placeholder="e.g. $5M, $50M, N/A" value={vetting.largest_contract_signed} onChange={e=>setV('largest_contract_signed',e.target.value)} />
            </div>
          </div>

          {/* Orientation */}
          <div className="vetting-section">
            <div className="vetting-section-title">Role Orientation</div>
            <div className="orientation-slider-wrap">
              <div className="orientation-labels">
                <div className="orientation-label">Operational<br/><span style={{color:'var(--ink-4)',fontSize:'0.55rem'}}>Day-to-day execution</span></div>
                <div className="orientation-label right">Strategic<br/><span style={{color:'var(--ink-4)',fontSize:'0.55rem'}}>Growth, deals, board</span></div>
              </div>
              <input type="range" className="trait-slider" min="0" max="100" value={vetting.orientation_score}
                onChange={e=>setV('orientation_score',parseInt(e.target.value))} />
              <div className="orientation-value">
                {vetting.orientation_score <= 25 ? 'Primarily Operational' :
                 vetting.orientation_score <= 45 ? 'Operational with Strategic elements' :
                 vetting.orientation_score <= 55 ? 'Balanced' :
                 vetting.orientation_score <= 75 ? 'Strategic with Operational grounding' :
                 'Primarily Strategic'}
              </div>
            </div>
          </div>

          {/* Background & Style */}
          <div className="vetting-section">
            <div className="vetting-section-title">Background & Working Style</div>
            <div className="form-group" style={{marginBottom:'0.875rem'}}>
              <label className="form-label">Primary Background</label>
              <div className="tap-options-row">
                {[
                  {v:'commercial',l:'Commercial / Freight / Chartering'},
                  {v:'operations',l:'Operations / Technical'},
                  {v:'finance',l:'Finance / Legal'},
                  {v:'general',l:'General Management'},
                ].map(o=>(
                  <div key={o.v} className={`tap-chip ${vetting.background_track===o.v?'selected':''}`} onClick={()=>setV('background_track',o.v)}>{o.l}</div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Ownership / Board Interface Comfort</label>
              <div className="tap-options">
                {[
                  {v:'direct_ownership',l:'Comfortable reporting directly to ownership or board'},
                  {v:'ceo_layer',l:'Work best with a CEO layer between me and ownership'},
                  {v:'structured_corporate',l:'Prefer a structured corporate environment'},
                ].map(o=>(
                  <div key={o.v} className={`tap-option ${vetting.ownership_comfort===o.v?'selected':''}`} onClick={()=>setV('ownership_comfort',o.v)}>
                    <div className="tap-radio" /><div className="tap-option-text">{o.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Travel & Compensation */}
          <div className="vetting-section">
            <div className="vetting-section-title">Travel & Compensation Preference</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Travel Tolerance</label>
                <div className="tap-options-row">
                  {[{v:'minimal',l:'Minimal'},{v:'25pct',l:'Up to 25%'},{v:'50pct',l:'Up to 50%'},{v:'no_limit',l:'No limit'}].map(o=>(
                    <div key={o.v} className={`tap-chip ${vetting.travel_tolerance===o.v?'selected':''}`} onClick={()=>setV('travel_tolerance',o.v)}>{o.l}</div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Compensation Structure</label>
                <div className="tap-options-row">
                  {[{v:'fixed',l:'Fixed salary'},{v:'bonus',l:'Bonus important'},{v:'equity',l:'Equity critical'}].map(o=>(
                    <div key={o.v} className={`tap-chip ${vetting.comp_structure===o.v?'selected':''}`} onClick={()=>setV('comp_structure',o.v)}>{o.l}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Market Presence */}
          <div className="vetting-section">
            <div className="vetting-section-title">Market Presence</div>
            <div className="form-group">
              <label className="form-label">Companies or organizations where your work would be recognized</label>
              <input className="form-input" placeholder="e.g. Cargill, Trafigura, Port of Houston Authority, Stolt-Nielsen" value={vetting.market_presence} onChange={e=>setV('market_presence',e.target.value)} />
              <p style={{fontSize:'0.7rem',color:'var(--ink-4)',marginTop:'0.375rem'}}>Helps recruiters understand your market standing and network depth.</p>
            </div>
          </div>

          {/* References */}
          <div className="vetting-section">
            <div className="vetting-section-title">Professional References (Optional)</div>
            <p style={{fontSize:'0.82rem',color:'var(--ink-4)',marginBottom:'1rem',lineHeight:'1.65'}}>
              Add up to 2 references. Each receives a 5-minute questionnaire by email — no login required.
              Their responses strengthen your profile and are shared only with your consent.
            </p>
            {refs.map((ref, i) => (
              <div key={i} className="ref-card">
                <div className="ref-num">{i+1}</div>
                <div className="ref-fields">
                  <div className="ref-row">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input className="form-input" placeholder="Reference name" value={ref.name} onChange={e=>setRef(i,'name',e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input className="form-input" type="email" placeholder="their@email.com" value={ref.email} onChange={e=>setRef(i,'email',e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <p style={{fontSize:'0.7rem',color:'var(--ink-4)',lineHeight:'1.55',marginTop:'0.5rem'}}>
              You can skip references now and add them later from your profile dashboard.
            </p>
          </div>

          {/* Summary */}
          <div style={{background:'var(--paper-2)',border:'1px solid var(--rule)',padding:'1rem 1.25rem',marginBottom:'1rem',fontSize:'0.78rem',color:'var(--ink-3)',lineHeight:'1.65'}}>
            <strong style={{color:'var(--ink)'}}>Profile summary:</strong>{' '}
            {form.current_title || 'Executive'} ·{' '}
            {Array.isArray(form.industry) ? form.industry.join(', ') : (form.industry || 'Industry TBD')} ·{' '}
            {form.location || 'Location TBD'} ·{' '}
            {career.filter(e=>e.title).length} career roles ·{' '}
            {refs.filter(r=>r.email).length} reference{refs.filter(r=>r.email).length!==1?'s':''} ·{' '}
            {tier === 'free' ? 'Free' : 'Confidential $299/yr'}
          </div>

          <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating Profile…'
              : tier === 'confidential' ? 'Create Confidential Profile — $299/yr'
              : 'Create Free Profile'}
          </button>
          <p className="form-note">
            {tier==='free'
              ? 'Free access always. Vetting and references optional — add anytime.'
              : 'Billed annually. Cancel anytime. Your employer is never disclosed.'
            }
          </p>
          <div className="step-nav" style={{marginTop:'0.5rem'}}>
            <button className="step-back" onClick={()=>setStep(5)}>← Back</button>
          </div>
        </>
      )}

    </div>
  );
}

// ── PRICING PAGE ─────────────────────────────────────────────────────────────
function PricingPage({ setActiveView, openRecruiterModal, authUser, showToast }) {
  const [audience, setAudience] = useState('recruiters');

  const recruiterPlans = [
    {
      name: 'Boutique',
      price: '400',
      period: 'per month — billed annually',
      desc: 'Ideal for independent search consultants and boutique firms. Free through Dec 2026 under Founding Partner Program. Subscriptions open Jan 2027.',
      features: [
        '3 active postings per month',
        'Standard placement in search feed',
        'Candidate interest signals (aggregate count)',
        'Posting analytics — views and engagement',
        'Email support',
        'Salary transparency required on all posts',
      ],
      muted: [],
      cta: 'Get Started',
      ctaStyle: '',
      recommended: false,
    },
    {
      name: 'Professional',
      price: '1,000',
      period: 'per month — billed annually',
      desc: 'For active search practices running multiple mandates. Includes candidate interest data and featured placement.',
      features: [
        '10 active postings per month',
        'Featured placement — top of search feed',
        'Full candidate interest data — who, when, compensation target',
        'Open executive profile browsing',
        'Priority posting review — 4-hour turnaround',
        'Monthly performance report',
        'Dedicated account contact',
      ],
      muted: [],
      cta: 'Get Started',
      ctaStyle: 'primary',
      recommended: true,
    },
    {
      name: 'Enterprise',
      price: '2,500',
      period: 'per month — billed annually',
      desc: 'For global search firms running high-volume executive mandates across maritime, energy, and logistics.',
      features: [
        'Unlimited active postings',
        'Premium featured placement + firm branding',
        'Full candidate profile access — Open profiles',
        'Custom posting templates',
        'Quarterly strategy review with Fredheim team',
        'API access for ATS integration',
      ],
      muted: [],
      cta: 'Contact Us',
      ctaStyle: '',
      recommended: false,
    },
  ];

  const executivePlans = [
    {
      name: 'Free',
      price: '0',
      period: 'always free',
      desc: 'Full access to browse every search on the platform. Signal interest confidentially. No payment required.',
      features: [
        'Browse all active searches',
        'Filter by industry, function, and salary range',
        'Confidential interest signaling — email only, not your identity',
        'Email alerts for new matching searches',
        'Set compensation floor — hide searches below your range',
        'Complete executive assessment — get matched by talent search firms',
      ],
      muted: [
        'Recruiters cannot find or contact you directly',
        'Profile not visible to search firms',
      ],
      cta: 'Create Free Profile',
      ctaStyle: '',
      recommended: false,
    },
    {
      name: 'Confidential',
      price: '299',
      period: 'per year',
      desc: 'Your name, employer, and location are hidden from all recruiters until you personally approve a connection. You control every reveal.',
      features: [
        'Includes all Free access features',
        'Anonymous executive profile — identity hidden by default',
        'Employer, location, and age-identifying details hidden by default',
        'Recruiter approval workflow — you decide who sees you',
        'Priority placement in relevant search results',
        'Visible to approved search firms running relevant searches',
        'No placement fee charged to you — ever',
      ],
      muted: [],
      cta: 'Create Confidential Profile',
      ctaStyle: 'primary',
      recommended: true,
    },
    {
      name: 'Executive Concierge',
      price: 'By invitation',
      period: '',
      desc: 'For executives who want a controlled, discreet market process with personal oversight at every step.',
      features: [
        'Private consultation before profile activation',
        'Manual review of all recruiter access requests',
        'Controlled introduction workflow',
        'Compensation positioning support',
        'Quarterly market feedback and search activity report',
      ],
      muted: [],
      cta: 'Coming Soon',
      ctaStyle: 'muted',
      recommended: false,
    },
  ];

  const plans = audience === 'recruiters' ? recruiterPlans : executivePlans;

  async function handlePlanCta(plan) {
    if (plan.cta === 'Contact Us' || plan.cta === 'Apply for Concierge' ||
        plan.cta === 'Get Started' || plan.cta === 'Request Concierge Access') {
      openRecruiterModal();
      return;
    }

    if (['Create Free Profile', 'Create Active Profile', 'Create Senior Profile',
         'Create Executive Profile', 'Create Confidential Profile'].includes(plan.cta)) {
      if (!authUser) {
        setActiveView('profile');
        return;
      }

      if (plan.name === 'Confidential') {
        await redirectToTierCheckout({ tier: 'confidential', email: authUser.email, showToast });
        return;
      }

      setActiveView('myprofile');
      return;
    }

    openRecruiterModal();
  }

  return (
    <div className="pricing-page">
      <div className="pricing-hero">
        <div className="hero-eyebrow">
          <div className="eyebrow-line" />
          <span className="eyebrow-text">Transparent Pricing</span>
        </div>
        <h1 className="pricing-hero-title">
          Simple pricing.<br />No placement fees. No surprises.
        </h1>
        <p className="pricing-hero-desc">
          Fredheim Executive Desk charges flat platform fees — not commissions.
          We make introductions. You own the relationship.
        </p>
      </div>

      {/* Audience toggle */}
      <div className="pricing-tabs">
        <button className={`pricing-tab ${audience==='recruiters'?'active':''}`} onClick={()=>setAudience('recruiters')}>
          For Search Firms
        </button>
        <button className={`pricing-tab ${audience==='executives'?'active':''}`} onClick={()=>setAudience('executives')}>
          For Executives
        </button>
      </div>

      {/* Plan cards */}
      <div className="plans-grid">
        {plans.map(plan => (
          <div key={plan.name} className={`plan-card ${plan.recommended?'recommended':''}`}>
            {plan.recommended && <div className="recommended-badge">Most Popular</div>}
            <div className="plan-name">{plan.name}</div>
            <div className="plan-price">
              <sup>$</sup>{plan.price}
            </div>
            <div className="plan-period">{plan.period}</div>
            <div className="plan-desc">{plan.desc}</div>
            <ul className="plan-features">
              {plan.features.map((f,i) => (
                <li key={i} className="plan-feature">{f}</li>
              ))}
              {(plan.muted||[]).map((f,i) => (
                <li key={'m'+i} className="plan-feature muted">{f}</li>
              ))}
            </ul>
            <button
              className={`plan-cta ${plan.ctaStyle}`}
              onClick={() => plan.cta !== 'Coming Soon' && handlePlanCta(plan)}
              disabled={plan.cta === 'Coming Soon'}
              style={plan.cta === 'Coming Soon' ? {opacity:0.45,cursor:'default',pointerEvents:'none'} : {}}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Introduction fee callout */}
      <div className="intro-fee-box">
        <div>
          <div className="intro-fee-eyebrow">Platform Introduction Fee</div>
          <div className="intro-fee-title">When the introduction leads to a hire</div>
          <p className="intro-fee-desc">
            Fredheim Executive Desk charges a flat platform introduction fee when a hire is confirmed
            through the platform — regardless of compensation level. <strong>Candidates are never charged a placement fee.</strong> No percentage. No sliding scale.
            One flat fee, invoiced to the search firm upon placement confirmation.
            We make the introduction. You own the search.
          </p>
        </div>
        <div className="intro-fee-amount">
          <div className="intro-fee-num">$3,500</div>
          <div className="intro-fee-label">C-Suite / VP placement</div>
          <div style={{marginTop:'1rem',paddingTop:'1rem',borderTop:'1px solid var(--gold-rule)'}}>
            <div className="intro-fee-num" style={{fontSize:'2rem'}}>$1,500</div>
            <div className="intro-fee-label">Director / Senior Manager placement</div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="faq-section">
        <div className="faq-title">Common Questions</div>

        {audience === 'recruiters' ? (
          <>
            <div className="faq-item">
              <div className="faq-q">Is salary transparency really required?</div>
              <div className="faq-a">Yes, without exception. Every posting must include a published compensation range. This is the reason executives trust the platform — and why your searches attract higher-quality candidates than generalist job boards.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What counts as a "confirmed placement" for the introduction fee?</div>
              <div className="faq-a">A placement is confirmed when a candidate who first expressed interest via Fredheim Executive Desk accepts an offer for the posted role. The introduction fee ($3,500 for C-Suite/VP, $1,500 for Director level) is invoiced to the search firm at that point. There is no introduction fee on postings where the hire came from outside the platform.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Can I post roles that are already live on other job boards?</div>
              <div className="faq-a">Yes. Most searches run across multiple channels. Fredheim Executive Desk is not exclusive — it's a complementary channel that reaches a pre-qualified senior audience in your specific verticals.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What is the Founding Partner Program?</div>
              <div className="faq-a">Founding partners post one search per month at no charge through December 31, 2026 — no subscription required. This gives you a full year of real engagement data, candidate interest signals, and placement opportunities before any payment is requested. Subscriptions open January 2027. Founding partners receive preferred pricing as a reward for early adoption. Introduction fees apply on confirmed placements throughout the program period.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What happens in January 2027?</div>
              <div className="faq-a">Subscriptions open January 1, 2027. Founding partners will receive a personal outreach from the Fredheim team in November/December 2026 with their engagement data and preferred pricing options. There is no obligation to subscribe — but active searches and profile access require a subscription after the founding period ends.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">How quickly are postings reviewed and published?</div>
              <div className="faq-a">Standard postings are reviewed within 24 hours. Professional plan subscribers receive 4-hour turnaround. Enterprise subscribers receive same-day publishing.</div>
            </div>
          </>
        ) : (
          <>
            <div className="faq-item">
              <div className="faq-q">Will my current employer ever know I'm on the platform?</div>
              <div className="faq-a">No. Your current employer is never displayed — not on your profile, not in search results, not to any recruiter. The platform is designed from the ground up for confidential passive search.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What's the difference between Free and Confidential?</div>
              <div className="faq-a">Free members can browse every search and signal interest anonymously. Confidential members ($299/yr) have an anonymous executive profile — name, employer, location, and graduation year are hidden from all recruiters until you personally approve a connection request.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Who controls when my identity is revealed?</div>
              <div className="faq-a">You do, always. When a search firm expresses interest, you receive a notification and decide whether to accept the connection. Only after you accept is your identity and contact information shared. You can decline any connection without explanation.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Do I pay anything if I get placed through the platform?</div>
              <div className="faq-a">No. The introduction fee is paid by the search firm, not the executive. There are no success fees, commissions, or hidden charges on the executive side — ever.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What industries does the platform cover?</div>
              <div className="faq-a">Maritime, energy, industrial logistics, port & terminal, offshore, bulk commodities, and trading & freight. This focus is intentional — it means every search on the platform is relevant to your background, and every executive profile is relevant to posting search firms.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ── TERMS OF SERVICE PAGE ────────────────────────────────────────────────────
function TermsPage() {
  return (
    <div className="legal-page">
      <div className="legal-eyebrow">Legal</div>
      <h1 className="legal-title">Terms of Service</h1>
      <div className="legal-meta">
        Last Updated: April 22, 2026 &nbsp;·&nbsp; Effective Date: April 22, 2026 &nbsp;·&nbsp;
        Fredheim Technologies LLC &nbsp;·&nbsp; Houston, Texas
      </div>

      <div className="legal-body">
        <p>
          These Terms of Service govern your access to and use of the Fredheim Executive Desk
          platform, operated by Fredheim Technologies LLC. By accessing or using the platform,
          you agree to be bound by these Terms.
        </p>

        <h2>1. The Platform</h2>
        <p>
          Fredheim Executive Desk is an executive opportunity marketplace connecting senior
          professionals in maritime, ports and terminals, energy, offshore, and industrial logistics with retained executive
          search firms. Fredheim Technologies LLC facilitates introductions — we are not a
          licensed placement agency, staffing firm, or recruiter. We do not conduct candidate
          searches, vetting, or placement services on behalf of any party.
        </p>

        <h2>2. Executive Member Terms</h2>

        <h3>2.1 Profile & Confidentiality</h3>
        <p>
          Your current employer is stored confidentially and will never be displayed to any
          search firm or user without your explicit consent. You represent that all profile
          information you provide is accurate and belongs to you.
        </p>

        <h3>2.2 Visibility Settings</h3>
        <p>
          <strong>Discreet:</strong> Your profile is not visible to search firms unless you
          explicitly express interest in a specific posting. <strong>Open:</strong> Your profile
          is visible to all posting search firms (available to paid tier members only).
        </p>

        <h3>2.3 Personality Assessment Data</h3>
        <p>
          Big Five personality scores are entirely optional and self-reported. You control
          whether to share this data. Fredheim makes no representations regarding accuracy
          or completeness of self-reported personality data.
        </p>

        <h3>2.4 Membership Tiers</h3>
        <table className="legal-table">
          <thead>
            <tr><th>Tier</th><th>Price</th><th>Access</th></tr>
          </thead>
          <tbody>
            <tr><td>Free</td><td>$0</td><td>Browse all postings, set alerts, signal interest anonymously</td></tr>
            <tr><td>Confidential</td><td>$299/year</td><td>Anonymous executive profile — identity hidden until you approve each connection</td></tr>
          </tbody>
        </table>
        <p>
          Paid memberships are billed annually via Stripe. Fees are non-refundable except as
          required by applicable law. You may cancel at any time; cancellation takes effect at
          the end of the current billing period.
        </p>

        <h3>2.5 No Fees to Candidates</h3>
        <p>
          Executive Members are never charged placement fees, introduction fees, success fees,
          or commissions of any kind. The Introduction Fee described below is the sole obligation
          of the Search Firm.
        </p>

        <h2>3. Search Firm Terms</h2>

        <h3>3.0 Founding Partner Program — 2026</h3>
        <div className="legal-highlight">
          Search firms participating in the Fredheim Executive Desk Founding Partner Program
          may post <strong>one (1) search per calendar month</strong> at no charge through
          <strong> December 31, 2026</strong>. No subscription is required during this period.
          The Introduction Fee described in Section 3.3 applies to all confirmed placements
          made during the Founding Partner period without exception. Founding Partner status
          does not constitute a waiver of any Introduction Fee obligation.
          Subscriptions open January 1, 2027. Founding partners receive preferred pricing
          as recognition of early adoption. Fredheim reserves the right to modify or
          discontinue the Founding Partner Program with 30 days written notice.
        </div>

        <h3>3.1 Posting Requirements</h3>
        <p>
          All postings must include a published total compensation range. Salary transparency
          is mandatory and non-negotiable. Postings that misrepresent compensation, role scope,
          or firm identity will be removed and the account may be suspended.
        </p>

        <h3>3.2 Subscription Plans</h3>
        <table className="legal-table">
          <thead>
            <tr><th>Plan</th><th>Price</th><th>Postings</th></tr>
          </thead>
          <tbody>
            <tr><td>Boutique</td><td>$400/month (billed annually)</td><td>3 active postings/month</td></tr>
            <tr><td>Professional</td><td>$1,000/month (billed annually)</td><td>10 postings + featured placement + candidate data</td></tr>
            <tr><td>Enterprise</td><td>$2,500/month (billed annually)</td><td>Unlimited postings + full profile access</td></tr>
          </tbody>
        </table>

        <h3>3.3 Introduction Fee — Binding Obligation</h3>
        <div className="legal-clause">
          <strong>Introduction Fee.</strong> A Platform Introduction Fee is due from the Search Firm
          to Fredheim Technologies LLC when: (a) an Executive Member first expressed interest in,
          or was first connected to the Search Firm through, a Posting on the Platform; and (b) that
          Executive Member is hired for the role described in the Posting, or a substantially similar
          role at the same organization, within <strong>twelve (12) months</strong> of the date of
          first documented contact on the Platform.
        </div>
        <table className="legal-table">
          <thead>
            <tr><th>Role Level</th><th>Introduction Fee</th></tr>
          </thead>
          <tbody>
            <tr><td>C-Suite, VP, and equivalent</td><td><strong>$3,500 flat fee</strong></td></tr>
            <tr><td>Director level and Senior Manager</td><td><strong>$1,500 flat fee</strong></td></tr>
          </tbody>
        </table>
        <p>
          The Introduction Fee is invoiced upon confirmation of placement and due within
          30 days. Late payments accrue interest at 1.5% per month. The fee is owed regardless
          of whether the hire resulted from the platform introduction alone or in combination
          with other channels.
        </p>

        <h3>3.4 Candidate Confidentiality</h3>
        <p>
          Executive Member information accessed through the Platform may not be shared outside
          the search engagement for which it was accessed, used to solicit candidates for other
          roles without their consent, or stored in proprietary databases without the candidate's
          knowledge and consent. Violation is grounds for immediate account termination.
        </p>

        <h3>3.5 Personality Data Prohibition</h3>
        <div className="legal-highlight">
          Search Firms expressly agree that Big Five personality data may not be used as a
          primary screening criterion, disqualification basis, or cited as a reason for rejection.
          Use of personality data in violation of applicable employment discrimination law is
          the sole legal responsibility of the Search Firm.
        </div>

        <h2>4. Prohibited Conduct</h2>
        <p>Users may not post false or misleading information, attempt to circumvent the platform
        to avoid Introduction Fees, harvest candidate data for use outside the platform, share
        access credentials with third parties, or use the platform to discriminate on any
        protected basis.</p>

        <h2>5. Disclaimers</h2>
        <p className="legal-caps">
          THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. FREDHEIM TECHNOLOGIES
          LLC DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED OR ERROR-FREE. FREDHEIM
          MAKES NO REPRESENTATIONS REGARDING THE ACCURACY OF POSTINGS, QUALIFICATIONS OF
          CANDIDATES, OR THE OUTCOME OF ANY INTRODUCTION.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p className="legal-caps">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, FREDHEIM TECHNOLOGIES LLC SHALL NOT BE LIABLE
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. FREDHEIM'S
          TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID IN THE TWELVE MONTHS PRECEDING
          THE CLAIM.
        </p>

        <h2>7. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the State of Texas. Any dispute shall be
          resolved by binding arbitration in Houston, Texas, under AAA rules. The prevailing
          party is entitled to recover reasonable attorneys' fees.
        </p>

        <h2>8. Modifications</h2>
        <p>
          Fredheim reserves the right to modify these Terms at any time. Material changes will
          be communicated via email. Continued use after the effective date constitutes acceptance.
        </p>

        <div className="legal-contact-box">
          <h3>Contact</h3>
          <p>Fredheim Technologies LLC</p>
          <p>Houston, Texas</p>
          <p><a href="mailto:desk@fredheimtech.com">desk@fredheimtech.com</a></p>
          <p><a href="https://desk.fredheimtech.com">desk.fredheimtech.com</a></p>
        </div>

        <p className="attorney-note">
          These Terms have been prepared for publication and are pending final review by a
          licensed Texas attorney. Last reviewed April 2026.
        </p>
      </div>
    </div>
  );
}


// ── PRIVACY POLICY PAGE ──────────────────────────────────────────────────────
function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-eyebrow">Legal</div>
      <h1 className="legal-title">Privacy Policy</h1>
      <div className="legal-meta">
        Last Updated: April 22, 2026 &nbsp;·&nbsp; Effective Date: April 22, 2026 &nbsp;·&nbsp;
        Fredheim Technologies LLC &nbsp;·&nbsp; Houston, Texas
      </div>

      <div className="legal-body">
        <div className="legal-highlight">
          We take privacy seriously. The platform is designed for confidential professional search —
          your current employer is <strong>never disclosed</strong> without your explicit consent,
          and you control when and whether your identity is shared with search firms.
          <strong> We do not sell your personal information. We do not use advertising trackers.</strong>
        </div>

        <h2>1. Information We Collect</h2>

        <h3>Executive Members</h3>
        <ul>
          <li>Name, email address, and location</li>
          <li>Current job title (your employer is stored but never displayed publicly)</li>
          <li>Industry, function, and compensation expectations</li>
          <li>Career history — job titles, company names, years of tenure</li>
          <li>Professional achievements (self-authored)</li>
          <li>Big Five personality scores (optional, self-reported)</li>
          <li>Geographic availability, board experience, languages</li>
          <li>Visibility and alert preferences</li>
        </ul>

        <h3>Search Firms</h3>
        <ul>
          <li>Firm name, contact name, and email address</li>
          <li>Role postings including title, description, compensation range, industry, location</li>
          <li>Terms of Service agreement timestamp and IP address at time of agreement</li>
        </ul>

        <h3>Automatically Collected</h3>
        <ul>
          <li>IP address and general geographic location</li>
          <li>Browser type and operating system</li>
          <li>Pages viewed and actions taken</li>
        </ul>
        <p>
          We use Vercel Web Analytics for aggregated, privacy-respecting traffic analysis.
          We do not use advertising trackers or third-party analytics that track users across websites.
        </p>

        <h2>2. How Your Information Is Shared</h2>

        <h3>With Search Firms — Executive Members</h3>
        <table className="legal-table">
          <thead>
            <tr><th>Information</th><th>Shared When</th></tr>
          </thead>
          <tbody>
            <tr><td>Interest signal</td><td>When you click "Register Confidential Interest"</td></tr>
            <tr><td>Email address</td><td>When you express interest — that posting's firm only</td></tr>
            <tr><td>Full profile</td><td>Only if visibility is Open (paid tiers) OR you explicitly approve</td></tr>
            <tr><td><strong>Current employer name</strong></td><td><strong>Never — under any circumstances</strong></td></tr>
            <tr><td>Big Five personality data</td><td>Only if you toggle "Share with recruiters" to ON</td></tr>
          </tbody>
        </table>

        <h3>Service Providers</h3>
        <p>
          We share data with: <strong>Supabase</strong> (database, US-based servers),
          <strong> Vercel</strong> (hosting), <strong>Stripe</strong> (payments),
          <strong> Zapier</strong> (email automation). All providers are contractually required
          to handle your data securely and only for specified purposes.
        </p>

        <h3>We Never</h3>
        <ul>
          <li>Sell your personal information to third parties</li>
          <li>Use your information for advertising purposes</li>
          <li>Share your current employer with anyone</li>
          <li>Share personality data without your explicit opt-in</li>
        </ul>

        <h2>3. Payment Information</h2>
        <p>
          Payment processing is handled entirely by Stripe, Inc. Fredheim does not store
          credit card numbers or sensitive payment information. We retain only transaction
          records for accounting purposes.
        </p>

        <h2>4. Data Security</h2>
        <ul>
          <li>All data transmitted is encrypted via HTTPS/TLS</li>
          <li>Database access protected by Supabase Row Level Security (RLS)</li>
          <li>Passwords hashed — never stored in plain text</li>
          <li>Payment data processed by Stripe — never touches our servers</li>
          <li>Production database access restricted to authorized personnel only</li>
        </ul>

        <h2>5. Your Rights</h2>
        <table className="legal-table">
          <thead>
            <tr><th>Right</th><th>How to Exercise</th></tr>
          </thead>
          <tbody>
            <tr><td>Access your data</td><td>Email desk@fredheimtech.com</td></tr>
            <tr><td>Correct inaccurate data</td><td>Update in your profile settings or email us</td></tr>
            <tr><td>Delete your account</td><td>Email desk@fredheimtech.com — honored within 30 days</td></tr>
            <tr><td>Change visibility</td><td>Toggle in your profile settings anytime</td></tr>
            <tr><td>Stop sharing Big Five data</td><td>Toggle off in your profile settings anytime</td></tr>
            <tr><td>Unsubscribe from alerts</td><td>Reply to any alert email</td></tr>
            <tr><td>Data portability</td><td>Request export via desk@fredheimtech.com</td></tr>
          </tbody>
        </table>

        <h2>6. Cookies</h2>
        <p>
          We use only session cookies (to keep you logged in) and preference cookies
          (to remember your filter settings). No advertising cookies. No cross-site tracking.
        </p>

        <h2>7. California & GDPR Rights</h2>
        <p>
          <strong>California (CCPA):</strong> We do not sell personal information. To exercise
          California privacy rights, email desk@fredheimtech.com.
        </p>
        <p>
          <strong>EEA/UK (GDPR):</strong> Our lawful basis for processing is contract performance
          and legitimate interests. You have rights to access, rectify, erase, and port your data.
          Contact desk@fredheimtech.com to exercise GDPR rights.
        </p>

        <h2>8. Data Retention</h2>
        <p>
          We retain your data as long as your account is active. You may request deletion at
          any time. We retain transaction records and ToS agreement timestamps for up to seven
          years for legal compliance even after account deletion.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          Material changes will be communicated via email at least 30 days before taking effect.
          Continued use constitutes acceptance.
        </p>

        <div className="legal-contact-box">
          <h3>Privacy Questions & Requests</h3>
          <p>Fredheim Technologies LLC</p>
          <p>Houston, Texas</p>
          <p><a href="mailto:desk@fredheimtech.com">desk@fredheimtech.com</a></p>
          <p>We aim to respond to all privacy requests within 10 business days.</p>
        </div>
      </div>
    </div>
  );
}


// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
// Admin password is validated server-side via /api/admin-auth — never exposed in client HTML

// ── CLOSE JOB MODAL ──────────────────────────────────────────────────────────
const CLOSE_REASONS = [
  { value:'position_cancelled',      label:'Position cancelled' },
  { value:'position_on_hold',        label:'Position put on hold' },
  { value:'budget_removed',          label:'Budget removed' },
  { value:'no_suitable_candidate',   label:'No suitable candidate found' },
  { value:'filled_outside_platform', label:'Filled outside the platform' },
  { value:'other',                   label:'Other' },
];

const CLOSE_CERT_TEXT =
  'I certify that this position has not been filled through any candidate introduced, matched, viewed, unlocked, contacted, or engaged through Fredheim Executive Desk.';

function CloseJobModal({ job, onClose, showToast, onJobStatusChange }) {
  const [reason, setReason]   = useState('');
  const [certified, setCert]  = useState(false);
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!reason) { showToast('Please select a close reason.'); return; }
    if (!certified) { showToast('You must confirm the certification to proceed.'); return; }
    setLoading(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch('/api/job-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ job_id: job.id, close_reason: reason, certification_confirmed: true, notes }),
      });
      const data = await resp.json();
      if (!resp.ok) { showToast(data.error || 'Close failed.'); return; }
      showToast(data.flagged
        ? '⚠ Job closed and flagged for admin review — introductions on record.'
        : '✓ Job closed. All candidate activity is preserved.');
      onJobStatusChange(job.id, 'closed_unfilled');
      onClose();
    } catch(e) { showToast('Error submitting closure.'); }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="workflow-modal">
        <div className="workflow-modal-title">Close Job Posting</div>
        <div className="workflow-modal-sub">
          Use this when the position was not filled through the platform.
          All candidate activity, matches, and interactions are preserved.
        </div>

        {job.has_introductions && (
          <div className="warning-box">
            <strong>⚠ Candidate introductions on record</strong>
            This job has had candidate introductions via Fredheim. If you filled this role
            using an introduced candidate, please use "Mark as Filled" instead.
            The 12-month tail period applies to all introduced candidates.
          </div>
        )}

        <div className="workflow-section">
          <div className="workflow-section-title">Close Reason *</div>
          <div className="workflow-radio-group">
            {CLOSE_REASONS.map(r => (
              <label key={r.value} className={`workflow-radio-item ${reason===r.value?'selected':''}`}>
                <input type="radio" name="close_reason" value={r.value}
                  checked={reason===r.value} onChange={()=>setReason(r.value)} />
                <span className="workflow-radio-label">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="workflow-section">
          <div className="workflow-cert-box">
            <div className="workflow-cert-text">{CLOSE_CERT_TEXT}</div>
            <label className="workflow-cert-check">
              <input type="checkbox" checked={certified} onChange={e=>setCert(e.target.checked)} />
              <span className="workflow-cert-check-label">I agree to this certification</span>
            </label>
          </div>
        </div>

        <div className="workflow-section">
          <label style={{fontSize:'0.78rem',color:'var(--ink-3)',display:'block',marginBottom:'0.375rem'}}>Notes (optional)</label>
          <textarea className="form-input" rows={3} value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="Any additional context for the admin team…" style={{resize:'vertical'}} />
        </div>

        <div className="workflow-actions">
          <button className="workflow-close-btn" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={submit} disabled={loading || !reason || !certified}>
            {loading ? 'Submitting…' : 'Close Job Posting'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MARK AS FILLED MODAL ─────────────────────────────────────────────────────
const EXTERNAL_CERT_TEXT =
  'I certify that the selected candidate was not introduced, matched, viewed, unlocked, contacted, shortlisted, messaged, or engaged through Fredheim Executive Desk for this role or a substantially similar role.';

function MarkFilledModal({ job, onClose, showToast, onJobStatusChange }) {
  const [step, setStep]         = useState('source');  // 'source' | 'platform' | 'external' | 'done'
  const [source, setSource]     = useState('');
  const [certified, setCert]    = useState(false);
  const [loading, setLoading]   = useState(false);
  const [stars, setStars]       = useState({});

  // Platform form fields
  const [pf, setPf] = useState({
    candidate_email:'', offer_date:'', start_date:'',
    compensation_amount:'', hiring_company:'',
    invoice_contact:'', invoice_email:'', purchase_order:'', notes:'',
  });
  function setPfField(k,v) { setPf(p => ({...p, [k]:v})); }

  async function submitPlatform() {
    if (!pf.candidate_email) { showToast('Candidate email required.'); return; }
    setLoading(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch('/api/job-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ job_id: job.id, fill_type: 'platform_candidate', ...pf }),
      });
      const data = await resp.json();
      if (!resp.ok) { showToast(data.error || 'Failed.'); return; }
      showToast(`✓ Placement recorded. ${data.fee_amount ? `Estimated fee: $${data.fee_amount.toLocaleString()}.` : ''} Admin will be in touch.`);
      onJobStatusChange(job.id, 'filled_platform');
      setStep('done');
    } catch(e) { showToast('Error.'); }
    setLoading(false);
  }

  async function submitExternal() {
    if (!certified) { showToast('Certification required.'); return; }
    setLoading(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch('/api/job-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ job_id: job.id, fill_type: 'external_candidate', external_certification_confirmed: true }),
      });
      const data = await resp.json();
      if (!resp.ok) { showToast(data.error || 'Failed.'); return; }
      showToast(data.flagged ? '⚠ Submitted for admin review — introductions on record.' : '✓ Recorded. Admin will review.');
      onJobStatusChange(job.id, 'filled_external');
      setStep('done');
    } catch(e) { showToast('Error.'); }
    setLoading(false);
  }

  async function submitPending() {
    setLoading(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      await fetch('/api/job-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ job_id: job.id, fill_type: 'pending_review' }),
      });
      showToast('✓ Submitted for admin review. Posting is paused from matching.');
      onJobStatusChange(job.id, 'pending_fill_review');
      setStep('done');
    } catch(e) { showToast('Error.'); }
    setLoading(false);
  }

  if (step === 'done') {
    return (
      <div className="modal-overlay">
        <div className="workflow-modal" style={{textAlign:'center',padding:'3rem 2rem'}}>
          <div style={{fontSize:'2rem',marginBottom:'1rem'}}>✓</div>
          <div className="workflow-modal-title" style={{marginBottom:'0.5rem'}}>Submitted</div>
          <div style={{fontSize:'0.875rem',color:'var(--ink-4)',marginBottom:'2rem'}}>
            The Fredheim team has been notified and will follow up within 24 hours.
          </div>
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="workflow-modal">
        <div className="workflow-modal-title">Mark as Filled</div>

        {step === 'source' && (
          <div>
            <div className="workflow-modal-sub">
              Was the candidate who filled this role sourced through Fredheim Executive Desk?
            </div>
            <div className="workflow-radio-group" style={{gap:'0.75rem'}}>
              {[
                { v:'platform', label:'Yes — candidate was found or engaged through Fredheim',
                  desc:'You will provide candidate and placement details. An invoice will be issued.' },
                { v:'external', label:'No — candidate was sourced entirely outside the platform',
                  desc:'You will certify that no introduced Fredheim candidate was involved.' },
                { v:'pending', label:'Not sure / still being finalised',
                  desc:'Admin will review and follow up to determine the correct status.' },
              ].map(o => (
                <label key={o.v} className={`workflow-radio-item ${source===o.v?'selected':''}`} style={{flexDirection:'column',alignItems:'flex-start'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:'0.625rem',width:'100%'}}>
                    <input type="radio" name="source" value={o.v} checked={source===o.v} onChange={()=>setSource(o.v)} style={{marginTop:'0.15rem'}} />
                    <div>
                      <div className="workflow-radio-label">{o.label}</div>
                      <div className="workflow-radio-desc">{o.desc}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={() => {
                if (!source) { showToast('Please select an option.'); return; }
                setStep(source === 'platform' ? 'platform' : source === 'external' ? 'external' : 'pending_confirm');
              }}>Continue →</button>
            </div>
          </div>
        )}

        {step === 'platform' && (
          <div>
            <div className="workflow-modal-sub">Provide placement details. These are used to calculate and issue your invoice.</div>
            <div className="placement-form-grid" style={{marginBottom:'1rem'}}>
              {[
                { k:'candidate_email',    label:'Candidate Email *', ph:'candidate@email.com', type:'email' },
                { k:'hiring_company',     label:'Hiring Company',    ph:'Company name', type:'text' },
                { k:'offer_date',         label:'Offer Date',        ph:'', type:'date' },
                { k:'start_date',         label:'Start Date',        ph:'', type:'date' },
                { k:'compensation_amount',label:'Compensation (USD)', ph:'e.g. 250000', type:'number' },
                { k:'invoice_contact',    label:'Invoice Contact',   ph:'Name for invoice', type:'text' },
                { k:'invoice_email',      label:'Invoice Email',     ph:'billing@firm.com', type:'email' },
                { k:'purchase_order',     label:'PO # (optional)',   ph:'', type:'text' },
              ].map(f => (
                <div key={f.k} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type={f.type} placeholder={f.ph}
                    value={pf[f.k]} onChange={e=>setPfField(f.k,e.target.value)} />
                </div>
              ))}
            </div>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={pf.notes} onChange={e=>setPfField('notes',e.target.value)} style={{resize:'vertical'}} />
            </div>
            <div style={{background:'var(--paper-2)',border:'1px solid var(--rule)',padding:'0.875rem 1.25rem',marginTop:'1rem',fontSize:'0.78rem',color:'var(--ink-4)',lineHeight:'1.6'}}>
              The standard Fredheim placement fee applies at the rate confirmed in your terms.
              Placement data is locked after admin approval and cannot be edited by the firm.
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={()=>setStep('source')}>← Back</button>
              <button className="btn-primary" onClick={submitPlatform} disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Placement'}
              </button>
            </div>
          </div>
        )}

        {step === 'external' && (
          <div>
            <div className="workflow-modal-sub">
              Confirm the following before proceeding.
            </div>
            {job.has_introductions && (
              <div className="warning-box">
                <strong>⚠ Introductions on record</strong>
                Fredheim has records of candidate introductions for this job posting.
                If any introduced candidate was involved in this hire, a platform fee may be due.
                This submission will be reviewed by admin before final acceptance.
              </div>
            )}
            <div className="workflow-cert-box">
              <div className="workflow-cert-text">{EXTERNAL_CERT_TEXT}</div>
              <label className="workflow-cert-check">
                <input type="checkbox" checked={certified} onChange={e=>setCert(e.target.checked)} />
                <span className="workflow-cert-check-label">I agree to this certification</span>
              </label>
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={()=>setStep('source')}>← Back</button>
              <button className="btn-danger" onClick={submitExternal} disabled={loading || !certified}>
                {loading ? 'Submitting…' : 'Confirm External Fill'}
              </button>
            </div>
          </div>
        )}

        {step === 'pending_confirm' && (
          <div>
            <div className="workflow-modal-sub">
              This job will be paused from active matching and queued for admin review.
              The Fredheim team will follow up within 24 hours to clarify the sourcing status.
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={()=>setStep('source')}>← Back</button>
              <button className="btn-primary" onClick={submitPending} disabled={loading}>
                {loading ? 'Submitting…' : 'Submit for Review'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── STAR RATING WIDGET ───────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="rating-stars">
      {[1,2,3,4,5].map(n => (
        <span key={n} className={`rating-star ${(hover||value)>=n?'filled':''}`}
          onClick={()=>onChange(n)}
          onMouseEnter={()=>setHover(n)}
          onMouseLeave={()=>setHover(0)}>
          ★
        </span>
      ))}
    </div>
  );
}

// ── FEEDBACK MODAL ───────────────────────────────────────────────────────────
function FeedbackModal({ recruiterEmail, jobId, matchId, trigger, onClose, showToast }) {
  const [ratings, setRatings] = useState({});
  const [flags, setFlags]     = useState({ would_engage_again: null, respected_privacy: null, attempted_bypass: false, misrepresented_role: false });
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  function setRating(k,v) { setRatings(p => ({...p, [k]:v})); }
  function setFlag(k,v)   { setFlags(p => ({...p, [k]:v})); }

  async function submit() {
    setLoading(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch('/api/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          recruiter_email: recruiterEmail, job_id: jobId, match_id: matchId,
          feedback_trigger: trigger || 'manual_report',
          ...ratings, ...flags, comments,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) { showToast(data.error || 'Submission failed.'); return; }
      setDone(true);
    } catch(e) { showToast('Error submitting feedback.'); }
    setLoading(false);
  }

  if (done) return (
    <div className="modal-overlay">
      <div className="workflow-modal" style={{textAlign:'center',padding:'3rem 2rem'}}>
        <div style={{fontSize:'2rem',marginBottom:'1rem'}}>✓</div>
        <div className="workflow-modal-title" style={{marginBottom:'0.5rem'}}>Thank you</div>
        <div style={{fontSize:'0.875rem',color:'var(--ink-4)',marginBottom:'2rem'}}>
          Your feedback helps us maintain a high-quality recruiter network. It is reviewed by the Fredheim team only.
        </div>
        <button className="btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );

  const ratingFields = [
    { k:'rating_professionalism', label:'Professionalism' },
    { k:'rating_responsiveness',  label:'Responsiveness' },
    { k:'rating_accuracy',        label:'Role Accuracy' },
    { k:'rating_transparency',    label:'Transparency' },
    { k:'rating_confidentiality', label:'Confidentiality' },
    { k:'rating_process',         label:'Process Quality' },
    { k:'rating_overall',         label:'Overall Experience' },
  ];

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="workflow-modal">
        <div className="workflow-modal-title">Rate Your Experience</div>
        <div className="workflow-modal-sub">
          Your feedback is confidential and reviewed by Fredheim only. It helps us maintain a high-quality recruiter network.
        </div>

        <div className="workflow-section">
          <div className="rating-grid">
            {ratingFields.map(f => (
              <div key={f.k} className="rating-item">
                <label>{f.label}</label>
                <StarRating value={ratings[f.k]||0} onChange={v=>setRating(f.k,v)} />
              </div>
            ))}
          </div>
        </div>

        <div className="workflow-section">
          <div className="workflow-section-title" style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--ink-3)',marginBottom:'0.75rem'}}>
            Additional Questions
          </div>
          {[
            { k:'would_engage_again', label:'Would you engage with this recruiter again?' },
            { k:'respected_privacy',  label:'Did the recruiter respect your privacy and confidentiality?' },
          ].map(q => (
            <div key={q.k} style={{marginBottom:'0.75rem'}}>
              <div style={{fontSize:'0.82rem',color:'var(--ink)',marginBottom:'0.375rem'}}>{q.label}</div>
              <div style={{display:'flex',gap:'0.5rem'}}>
                {['Yes','No'].map(opt => (
                  <button key={opt} onClick={()=>setFlag(q.k, opt==='Yes')}
                    style={{padding:'0.375rem 1rem',border:'1px solid var(--rule)',background: flags[q.k]===(opt==='Yes')?'var(--ink)':'transparent',color:flags[q.k]===(opt==='Yes')?'#fff':'var(--ink)',cursor:'pointer',fontSize:'0.78rem'}}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="workflow-section">
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--red,#c0392b)',marginBottom:'0.75rem'}}>
            Report Issues (admin review only)
          </div>
          {[
            { k:'attempted_bypass',     label:'Did the recruiter attempt to bypass Fredheim for this engagement?' },
            { k:'misrepresented_role',  label:'Did the recruiter misrepresent the role, compensation, company, or process?' },
          ].map(q => (
            <label key={q.k} style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',marginBottom:'0.625rem',cursor:'pointer'}}>
              <input type="checkbox" checked={!!flags[q.k]} onChange={e=>setFlag(q.k,e.target.checked)} style={{marginTop:'0.15rem'}} />
              <span style={{fontSize:'0.82rem',color:'var(--ink)'}}>{q.label}</span>
            </label>
          ))}
        </div>

        <div className="workflow-section">
          <label style={{fontSize:'0.78rem',color:'var(--ink-3)',display:'block',marginBottom:'0.375rem'}}>Comments (optional, not public)</label>
          <textarea className="form-input" rows={3} value={comments} onChange={e=>setComments(e.target.value)}
            placeholder="Describe your experience…" style={{resize:'vertical'}} />
        </div>

        <div className="workflow-actions">
          <button className="workflow-close-btn" onClick={onClose}>Skip</button>
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ onLogout, showToast, onJobPublished }) {
  const [tab, setTab]           = useState('submissions');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [submissions, setSubmissions] = useState([]);
  const [profiles, setProfiles]       = useState([]);
  const [jobs, setJobs]               = useState([]);
  const [interests, setInterests]     = useState([]);

  async function loadAll() {
    setRefreshing(true);
    try {
      const [s, p, j, i] = await Promise.all([
        sb.from('fed_recruiter_submissions').select('*').order('created_at', {ascending:false}),
        sb.from('fed_profiles').select('*').order('created_at', {ascending:false}),
        sb.from('fed_jobs').select('*').order('created_at', {ascending:false}),
        sb.from('fed_interests').select('*').order('created_at', {ascending:false}),
      ]);
      setSubmissions(s.data || []);
      setProfiles(p.data || []);
      setJobs(j.data || []);
      setInterests(i.data || []);
    } catch(e) {
      showToast('Error loading data — check Supabase connection.');
    }
    setLoading(false);
    setRefreshing(false);
  }

  // Founding Partner Program helpers
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const programActive = currentYear === 2026 && currentMonth <= 11; // through Dec 2026

  // Count postings per firm this month
  function firmMonthlyCount(firmName) {
    return submissions.filter(s => {
      if (s.firm_name !== firmName) return false;
      const d = new Date(s.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
        && ['approved','posted'].includes(s.status);
    }).length;
  }

  // All unique firms that have submitted
  const uniqueFirms = [...new Set(submissions.map(s => s.firm_name))];

  // Firms that have used their monthly slot
  const firmsAtLimit = uniqueFirms.filter(f => firmMonthlyCount(f) >= 1);

  useEffect(() => { loadAll(); }, []);

  // Stats
  const paidProfiles  = profiles.filter(p => p.tier !== 'free').length;
  const pendingSubs   = submissions.filter(s => s.status === 'pending').length;
  const activeJobs    = jobs.filter(j => j.status === 'active').length;
  const totalInterests = interests.length;

  // Calculated ARR
  const arr = profiles.reduce((sum, p) => {
    if (p.tier === 'active') return sum + 199;
    if (p.tier === 'confidential') return sum + 299;
    if (p.tier === 'active_senior') return sum + 99;
    return sum;
  }, 0);

  async function updateSubmissionStatus(id, status) {
    try {
      await sb.from('fed_recruiter_submissions').update({ status }).eq('id', id);
      setSubmissions(prev => prev.map(s => s.id === id ? {...s, status} : s));
      showToast(`Submission ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated'}.`);
    } catch(e) { showToast('Update failed.'); }
  }

  async function publishJob(submission) {
    try {
      // Normalise industry value to current 4-vertical model
      const industryMap = {
        'maritime':                        'Maritime & Shipping',
        'maritime & shipping':             'Maritime & Shipping',
        'ports & terminals':               'Ports & Terminals',
        'port & terminal':                 'Ports & Terminals',
        'energy & offshore':               'Energy & Offshore',
        'energy':                          'Energy & Offshore',
        'offshore':                        'Energy & Offshore',
        'industrial commodities & logistics': 'Industrial Commodities & Logistics',
        'industrial logistics':            'Industrial Commodities & Logistics',
        'bulk commodities':                'Industrial Commodities & Logistics',
        'trading & freight':               'Industrial Commodities & Logistics',
      };
      const rawIndustry = (submission.industry || 'Maritime & Shipping').trim();
      const industry = industryMap[rawIndustry.toLowerCase()] || rawIndustry;

      // Parse salary values from the salary_range string for filter compatibility
      // e.g. "$300K – $400K total compensation" → min=300000, max=400000
      function parseSalary(str) {
        if (!str) return { min: 0, max: 9999999 };
        const nums = (str.match(/\d[\d,]*/g) || [])
          .map(n => parseInt(n.replace(/,/g,'')) * (str.includes('K') ? 1000 : 1))
          .filter(n => n > 0);
        if (nums.length === 0) return { min: 0, max: 9999999 };
        if (nums.length === 1) return { min: nums[0], max: nums[0] };
        return { min: Math.min(...nums), max: Math.max(...nums) };
      }
      const { min: salaryMin, max: salaryMax } = parseSalary(submission.salary_range);

      // Build the job object with only columns that exist in fed_jobs schema
      const jobData = {
        title:            submission.role_title,
        description:      `Search managed by ${submission.firm_name}. Salary range: ${submission.salary_range || 'Competitive'}. Contact the firm for full role details.`,
        responsibilities: JSON.stringify([]),
        requirements:     JSON.stringify([]),
        company_display:  'Confidential',
        company_actual:   null,
        firm_name:        submission.firm_name,
        firm_email:       submission.email,
        firm_code:        (submission.firm_name || 'XX').slice(0,2).toUpperCase(),
        industry,
        function:         submission.role_level === 'senior' ? 'Operations' : 'Commercial',
        tags:             JSON.stringify([]),
        location:         submission.location || 'To Be Confirmed',
        type:             'Full-Time',
        salary_min:       salaryMin,
        salary_max:       salaryMax,
        salary_display:   submission.salary_range || 'Competitive — contact firm',
        salary_note:      'Published range',
        role_level:       submission.role_level || 'executive',
        status:           'active',
        badge:            'new',
        demo_post:        false,
        view_count:       0,
        interest_count:   0,
      };

      const { data, error } = await sb.from('fed_jobs').insert(jobData).select();
      if (error) {
        console.error('Publish error:', error);
        showToast(`Publish failed: ${error.message}`);
        return;
      }
      await updateSubmissionStatus(submission.id, 'posted');
      showToast('✓ Job published to the board.');
      if (onJobPublished) onJobPublished(); // refresh main board
      loadAll();
    } catch(e) {
      console.error('Publish exception:', e);
      showToast(`Publish error: ${e.message}`);
    }
  }

  function fmt(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'2-digit' });
  }

  if (loading) return <div className="admin-loading"><span className="spinner" />Loading admin data…</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.25rem'}}>
            Admin Control Room
          </div>
          <div className="admin-title">Fredheim Executive Desk</div>
        </div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <button className="admin-refresh" onClick={loadAll} disabled={refreshing}>
            {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
          </button>
          <button className="admin-logout" onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat-num gold">${arr.toLocaleString()}</div>
          <div className="admin-stat-label">Annual Run Rate</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-num green">{paidProfiles}</div>
          <div className="admin-stat-label">Paid Members</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-num">{profiles.length}</div>
          <div className="admin-stat-label">Total Profiles</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-num">{activeJobs}</div>
          <div className="admin-stat-label">Active Searches</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-num">{totalInterests}</div>
          <div className="admin-stat-label">Interest Signals</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab==='submissions'?'active':''}`} onClick={()=>setTab('submissions')}>
          Recruiter Submissions <span className="tab-count">{pendingSubs} pending</span>
        </button>
        <button className={`admin-tab ${tab==='founding'?'active':''}`} onClick={()=>setTab('founding')}>
          Founding Partners <span className="tab-count">{uniqueFirms.length} firms</span>
        </button>
        <button className={`admin-tab ${tab==='jobs'?'active':''}`} onClick={()=>setTab('jobs')}>
          Job Board <span className="tab-count">{activeJobs} live</span>
        </button>
        <button className={`admin-tab ${tab==='profiles'?'active':''}`} onClick={()=>setTab('profiles')}>
          Executive Profiles <span className="tab-count">{profiles.length}</span>
        </button>
        <button className={`admin-tab ${tab==='interests'?'active':''}`} onClick={()=>setTab('interests')}>
          Interest Signals <span className="tab-count">{interests.length}</span>
        </button>
        <button className={`admin-tab ${tab==='closures'?'active':''}`} onClick={()=>setTab('closures')}>
          Closures &amp; Fills
        </button>
        <button className={`admin-tab ${tab==='feedback'?'active':''}`} onClick={()=>setTab('feedback')}>
          Recruiter Feedback
        </button>
        <button className={`admin-tab ${tab==='billing'?'active':''}`} onClick={()=>setTab('billing')}>
          Billing Approvals
        </button>
        <button className={`admin-tab ${tab==='leaderboard'?'active':''}`} onClick={()=>setTab('leaderboard')}>
          Leaderboard
        </button>
        <button className={`admin-tab ${tab==='activity'?'active':''}`} onClick={()=>setTab('activity')}>
          Activity Feed
        </button>
        <button className={`admin-tab ${tab==='intern'?'active':''}`} onClick={()=>setTab('intern')}>
          Early Careers
        </button>
        <button className={`admin-tab ${tab==='benchmarks'?'active':''}`} onClick={()=>setTab('benchmarks')}>
          Comp Benchmarks
        </button>
      </div>

      {/* ── SUBMISSIONS TAB ── */}
      {tab === 'submissions' && (
        <div className="admin-table-wrap">
          {submissions.length === 0 ? (
            <div className="admin-empty">No recruiter submissions yet.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Firm</th><th>Contact</th><th>Role</th>
                  <th>Level</th><th>Industry</th><th>Salary Range</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td>{fmt(s.created_at)}</td>
                    <td><strong>{s.firm_name}</strong></td>
                    <td>
                      <div>{s.contact_name || '—'}</div>
                      <div style={{fontSize:'0.72rem',color:'var(--ink-4)'}}>{s.email}</div>
                    </td>
                    <td><strong>{s.role_title}</strong><div style={{fontSize:'0.72rem',color:'var(--ink-4)'}}>{s.location}</div></td>
                    <td><span className={`admin-pill ${s.role_level||'executive'}`}>{s.role_level||'Executive'}</span></td>
                    <td>{s.industry || '—'}</td>
                    <td style={{whiteSpace:'nowrap'}}>{s.salary_range || '—'}</td>
                    <td><span className={`admin-pill ${s.status||'pending'}`}>{s.status||'pending'}</span></td>
                    <td>
                      <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                        {s.status === 'pending' && <>
                          <button className="admin-action-btn approve" onClick={()=>updateSubmissionStatus(s.id,'approved')}>Approve</button>
                          <button className="admin-action-btn danger" onClick={()=>updateSubmissionStatus(s.id,'rejected')}>Reject</button>
                        </>}
                        {s.status === 'approved' && (
                          <button className="admin-action-btn publish" onClick={()=>publishJob(s)}>Publish to Board</button>
                        )}
                        {s.status === 'posted' && <span style={{fontSize:'0.72rem',color:'var(--green)'}}>✓ Live</span>}
                        <a href={`mailto:${s.email}`} style={{textDecoration:'none'}}>
                          <button className="admin-action-btn">Email</button>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── FOUNDING PARTNERS TAB ── */}
      {tab === 'founding' && (
        <div>
          {/* Program status banner */}
          <div style={{background: programActive ? 'var(--gold-bg)' : 'var(--paper-2)', border:'1px solid var(--gold-rule)', borderLeft:'3px solid var(--gold)', padding:'1rem 1.5rem', marginBottom:'1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.25rem'}}>
                Founding Partner Program 2026
              </div>
              <div style={{fontSize:'0.875rem',color:'var(--ink-2)',fontWeight:500}}>
                {programActive
                  ? `Program active — ${12 - currentMonth} month${12 - currentMonth !== 1 ? 's' : ''} remaining. Subscriptions open January 2027.`
                  : 'Program ended December 31, 2026. Subscription period active.'
                }
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.8rem',fontWeight:600,color:'var(--gold)',lineHeight:1}}>{uniqueFirms.length}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.58rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)'}}>Partner Firms</div>
            </div>
          </div>

          {uniqueFirms.length === 0 ? (
            <div className="admin-empty">No founding partners yet. Share your platform with search firms to get started.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Firm</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Total Submissions</th>
                    <th>This Month</th>
                    <th>Monthly Status</th>
                    <th>Last Submission</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uniqueFirms.map(firmName => {
                    const firmSubs = submissions.filter(s => s.firm_name === firmName);
                    const latest   = firmSubs[0];
                    const thisMonth = firmMonthlyCount(firmName);
                    const atLimit   = thisMonth >= 1;
                    const totalPosted = firmSubs.filter(s => s.status === 'posted').length;

                    return (
                      <tr key={firmName}>
                        <td><strong>{firmName}</strong></td>
                        <td>{latest?.contact_name || '—'}</td>
                        <td style={{fontSize:'0.78rem'}}>{latest?.email || '—'}</td>
                        <td style={{textAlign:'center'}}>
                          <strong>{firmSubs.length}</strong>
                          <span style={{color:'var(--ink-4)',fontSize:'0.72rem',marginLeft:'0.375rem'}}>({totalPosted} live)</span>
                        </td>
                        <td style={{textAlign:'center'}}>{thisMonth}</td>
                        <td>
                          {atLimit
                            ? <span className="admin-pill pending">Slot Used</span>
                            : <span className="admin-pill active">Slot Available</span>
                          }
                        </td>
                        <td>{latest ? new Date(latest.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'}</td>
                        <td>
                          <div style={{display:'flex',gap:'0.375rem'}}>
                            <a href={`mailto:${latest?.email}?subject=Fredheim Executive Desk — Founding Partner Update&body=Hi ${latest?.contact_name || 'there'},%0A%0AThank you for participating in the Fredheim Executive Desk Founding Partner Program.%0A%0AYour searches have generated real candidate interest data that I'd love to share with you.%0A%0AAs a reminder, you have ${atLimit ? 'used your' : 'one available'} monthly posting slot for ${now.toLocaleString('default',{month:'long'})} 2026.%0A%0ASubscriptions open January 2027 — founding partners receive preferred pricing.%0A%0ABest,%0AFredheim Technologies LLC%0AFredheim Executive Desk%0Adesk@fredheimtech.com`} style={{textDecoration:'none'}}>
                              <button className="admin-action-btn">Email</button>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Conversion reminder */}
          {programActive && uniqueFirms.length > 0 && (
            <div style={{marginTop:'1.5rem',background:'var(--paper-2)',border:'1px solid var(--rule)',padding:'1.25rem 1.5rem',fontSize:'0.82rem',color:'var(--ink-3)',lineHeight:'1.65'}}>
              <strong style={{color:'var(--ink)'}}>Conversion plan:</strong> Begin subscription conversations in October 2026.
              Share each firm's engagement data (views, interest signals, placements) as the proof point.
              Target: 50% of founding partners convert to Boutique or Professional plan by Feb 2027.
            </div>
          )}
        </div>
      )}

      {/* ── JOBS TAB ── */}
      {tab === 'jobs' && (
        <div className="admin-table-wrap">
          {jobs.length === 0 ? (
            <div className="admin-empty">No job postings yet.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Posted</th><th>Title</th><th>Firm</th><th>Industry</th>
                  <th>Location</th><th>Salary</th><th>Views</th><th>Interests</th>
                  <th>Status</th><th>Demo</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}>
                    <td>{fmt(j.created_at)}</td>
                    <td><strong>{j.title}</strong></td>
                    <td>{j.firm_name}</td>
                    <td>{j.industry}</td>
                    <td>{j.location}</td>
                    <td style={{whiteSpace:'nowrap'}}>{j.salary_display}</td>
                    <td style={{textAlign:'center'}}>{j.view_count||0}</td>
                    <td style={{textAlign:'center'}}>{j.interest_count||0}</td>
                    <td><span className={`admin-pill ${j.status}`}>{j.status?.replace(/_/g,' ')}</span>
                      {j.admin_flagged && <span style={{marginLeft:'0.375rem',fontSize:'0.6rem',color:'#c0392b',fontFamily:"'DM Mono',monospace"}}>⚠ FLAGGED</span>}
                    </td>
                    <td>{j.demo_post ? <span style={{color:'var(--gold)',fontSize:'0.72rem'}}>Demo</span> : '—'}</td>
                    <td>
                      <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                        {j.status === 'active' && (
                          <button className="admin-action-btn danger" onClick={async()=>{
                            // Admin expires — still writes audit log
                            await sb.from('fed_jobs').update({status:'expired'}).eq('id',j.id);
                            await sb.from('fed_job_status_history').insert({
                              job_id: j.id, previous_status:'active', new_status:'expired',
                              changed_by_email: sessionStorage.getItem('fed_admin_email') || 'admin',
                              changed_by_role: 'admin', reason: 'admin_expired',
                            });
                            setJobs(prev=>prev.map(x=>x.id===j.id?{...x,status:'expired'}:x));
                            showToast('Posting expired.');
                          }}>Expire</button>
                        )}
                        {['expired','closed_unfilled','filled_external','pending_fill_review'].includes(j.status) && (
                          <button className="admin-action-btn approve" onClick={async()=>{
                            await sb.from('fed_jobs').update({status:'active',admin_flagged:false}).eq('id',j.id);
                            await sb.from('fed_job_status_history').insert({
                              job_id: j.id, previous_status: j.status, new_status:'active',
                              changed_by_email: sessionStorage.getItem('fed_admin_email') || 'admin',
                              changed_by_role: 'admin', reason: 'admin_reactivated',
                            });
                            setJobs(prev=>prev.map(x=>x.id===j.id?{...x,status:'active',admin_flagged:false}:x));
                            showToast('Posting reactivated.');
                          }}>Reactivate</button>
                        )}
                        {j.admin_flagged && (
                          <button className="admin-action-btn" style={{fontSize:'0.6rem',color:'#c0392b',borderColor:'#c0392b'}}
                            onClick={()=>showToast('View Closures or Placements tab for full audit detail.')}>
                            Review
                          </button>
                        )}
                        {!['archived'].includes(j.status) && (
                          <button className="admin-action-btn" style={{fontSize:'0.6rem'}} onClick={async()=>{
                            await sb.from('fed_jobs').update({status:'archived',archived_at:new Date().toISOString()}).eq('id',j.id);
                            setJobs(prev=>prev.map(x=>x.id===j.id?{...x,status:'archived'}:x));
                            showToast('Archived.');
                          }}>Archive</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── PROFILES TAB ── */}
      {tab === 'profiles' && (
        <div className="admin-table-wrap">
          {profiles.length === 0 ? (
            <div className="admin-empty">No executive profiles yet.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Joined</th><th>Name</th><th>Title</th><th>Industry</th>
                  <th>Location</th><th>Salary Floor</th><th>Tier</th>
                  <th>Visibility</th><th>Big Five</th><th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id}>
                    <td>{fmt(p.created_at)}</td>
                    <td><strong>{p.first_name} {p.last_name}</strong><div style={{fontSize:'0.72rem',color:'var(--ink-4)'}}>{p.email}</div></td>
                    <td>{p.current_title}</td>
                    <td>{p.industry||'—'}</td>
                    <td>{p.location||'—'}</td>
                    <td>{p.salary_min ? `$${(p.salary_min/1000).toFixed(0)}K+` : '—'}</td>
                    <td><span className={`admin-pill ${p.tier||'free'}`}>{p.tier||'free'}</span></td>
                    <td><span className={`admin-pill ${p.visibility||'discreet'}`}>{p.visibility||'discreet'}</span></td>
                    <td>{p.big_five_shared ? <span style={{color:'var(--green)',fontSize:'0.72rem'}}>Shared</span> : <span style={{color:'var(--ink-4)',fontSize:'0.72rem'}}>Private</span>}</td>
                    <td>{fmt(p.tier_expires)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── INTERESTS TAB ── */}
      {tab === 'interests' && (
        <div className="admin-table-wrap">
          {interests.length === 0 ? (
            <div className="admin-empty">No interest signals yet.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Candidate Email</th><th>Role</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {interests.map(i => {
                  const job = jobs.find(j => j.id === i.job_id);
                  return (
                    <tr key={i.id}>
                      <td>{fmt(i.created_at)}</td>
                      <td><strong>{i.anon_email || '—'}</strong></td>
                      <td>
                        {job ? (
                          <div>
                            <strong>{job.title}</strong>
                            <div style={{fontSize:'0.72rem',color:'var(--ink-4)'}}>{job.firm_name}</div>
                          </div>
                        ) : <span style={{color:'var(--ink-4)',fontSize:'0.72rem'}}>{i.job_id?.slice(0,8)}…</span>}
                      </td>
                      <td>
                        <span className={`admin-pill ${i.status||'pending'}`}>
                          {i.status || 'pending'}
                        </span>
                        {i.notified_at && (
                          <div style={{fontSize:'0.62rem',color:'var(--ink-4)',marginTop:'0.2rem'}}>
                            {fmt(i.notified_at)}
                          </div>
                        )}
                      </td>
                      <td style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                        {(i.status === 'pending' || !i.status) && job?.firm_email && (
                          <button
                            className="admin-action-btn"
                            onClick={async () => {
                              try {
                                await fetch('/api/notify-interest', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ job_id: i.job_id, candidate_email: i.anon_email }),
                                });
                                await sb.from('fed_interests').update({ status:'notified', notified_at: new Date().toISOString() }).eq('id', i.id);
                                showToast('✓ Recruiter notified (candidate identity withheld).');
                                loadAll();
                              } catch(e) { showToast('Notification failed. Try again.'); }
                            }}
                          >
                            Notify Firm
                          </button>
                        )}
                        {i.status === 'notified' && (
                          <button
                            className="admin-action-btn publish"
                            onClick={async () => {
                              const firmEmail = job?.firm_email;
                              if (!firmEmail) { showToast('No firm email on record for this job.'); return; }
                              try {
                                // Send full introduction email via Zapier with candidate email revealed
                                await fetch('/api/notify-interest', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + (sessionStorage.getItem('fed_admin_token') || ''),
                                  },
                                  body: JSON.stringify({
                                    job_id: i.job_id,
                                    candidate_email: i.anon_email,
                                    type: 'introduction',
                                  }),
                                });
                                await sb.from('fed_interests').update({ status:'introduced', introduced_at: new Date().toISOString() }).eq('id', i.id);
                                showToast('✓ Introduction forwarded. Candidate email shared with firm.');
                                loadAll();
                              } catch(e) { showToast('Forward failed. Try again.'); }
                            }}
                          >
                            Forward Introduction
                          </button>
                        )}
                        {i.status === 'introduced' && (
                          <span style={{fontSize:'0.72rem',color:'var(--green)'}}>✓ Introduced</span>
                        )}
                        <a
                          href={`mailto:${i.anon_email}?subject=Fredheim Executive Desk — Your interest in ${job?.title || 'a search'}`}
                          style={{textDecoration:'none'}}
                        >
                          <button className="admin-action-btn">Email Candidate</button>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── CLOSURES & FILLS TAB ── */}
      {tab === 'closures' && (
        <AdminClosuresTab jobs={jobs} showToast={showToast} reloadJobs={loadAll} />
      )}

      {/* ── RECRUITER FEEDBACK TAB ── */}
      {tab === 'feedback' && (
        <AdminFeedbackTab showToast={showToast} />
      )}

      {/* ── BILLING APPROVALS TAB ── */}
      {tab === 'billing' && (
        <AdminBillingTab showToast={showToast} />
      )}

      {/* ── LEADERBOARD MANAGEMENT TAB ── */}
      {tab === 'leaderboard' && (
        <AdminLeaderboardTab showToast={showToast} />
      )}

      {tab === 'activity' && (
        <AdminActivityTab showToast={showToast} />
      )}

      {tab === 'intern' && (
        <AdminInternTab showToast={showToast} />
      )}

      {tab === 'benchmarks' && (
        <AdminCompBenchmarksTab showToast={showToast} />
      )}
    </div>
  );
}

// ── ADMIN ACTIVITY TAB ───────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  ['placement_verified',  'Verified Placement Completed'],
  ['role_filled',         'Executive Role Filled'],
  ['role_posted',         'New Role Posted'],
  ['engagement_accepted', 'Candidate Engagement Accepted'],
  ['search_completed',    'Search Completed'],
  ['recruiter_joined',    'Verified Recruiter Joined'],
  ['industry_activity',   'Industry Hiring Activity'],
];

const LOCATION_OPTIONS = ['landing','candidate','recruiter'];

function AdminActivityTab({ showToast }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [editing, setEditing]   = useState(null);  // item being edited or {}
  const [saving, setSaving]     = useState(false);

  const adminToken = () => sessionStorage.getItem('fed_admin_token') || '';

  async function api(action, extra = {}) {
    const r = await fetch('/api/marketplace-activity', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + adminToken() },
      body: JSON.stringify({ action, ...extra }),
    });
    return r.json();
  }

  async function load() {
    setLoading(true);
    const d = await api('get_all');
    setItems(d.items || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function fmt(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}); }

  async function doAction(action, id, extra = {}) {
    const d = await api(action, { id, ...extra });
    if (d.ok) {
      showToast(`✓ ${action.charAt(0).toUpperCase()+action.slice(1)} applied.`);
      load();
    } else {
      showToast(d.error || 'Action failed.');
    }
  }

  async function saveItem() {
    setSaving(true);
    if (!editing.public_summary || !editing.activity_type) {
      showToast('Activity type and public summary are required.');
      setSaving(false);
      return;
    }
    const action = editing.id ? 'update' : 'create';
    const d = await api(action, editing);
    if (d.ok || d.id) {
      showToast(editing.id ? '✓ Item updated.' : '✓ Item created as draft.');
      setEditing(null);
      load();
    } else {
      showToast(d.error || 'Save failed.');
    }
    setSaving(false);
  }

  const filtered = filter === 'all' ? items
    : filter === 'published' ? items.filter(i => i.status === 'published' && !i.suppressed)
    : filter === 'draft' ? items.filter(i => i.status === 'draft' || i.status === 'approved')
    : filter === 'suppressed' ? items.filter(i => i.suppressed)
    : items;

  const STATUS_COLOR = { draft:'', approved:'gold', published:'posted', archived:'', suppressed:'danger' };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',color:'var(--ink)'}}>Marketplace Activity Feed</div>
          <div style={{fontSize:'0.75rem',color:'var(--ink-4)',marginTop:'0.2rem'}}>
            Admin-controlled. Only Published, non-suppressed items appear publicly.
          </div>
        </div>
        <button className="admin-action-btn approve" onClick={() => setEditing({
          activity_type: 'placement_verified', title:'', public_summary:'',
          sector:'', region:'', role_level:'',
          visibility_locations: ['landing','candidate','recruiter'],
          expires_at: '',
        })}>
          + New Activity Item
        </button>
      </div>

      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1.5rem',flexWrap:'wrap'}}>
        {[['all','All'],['draft','Draft / Approved'],['published','Published'],['suppressed','Suppressed']].map(([v,l]) => (
          <button key={v} className={`admin-action-btn ${filter===v?'approve':''}`} onClick={()=>setFilter(v)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="admin-empty"><span className="spinner"/>Loading…</div> :
      filtered.length === 0 ? <div className="admin-empty">No activity items in this filter.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th><th>Public Summary</th><th>Sector / Region</th>
                <th>Locations</th><th>Status</th><th>Published</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}
                    style={item.suppressed ? {background:'#fff8f0'} : item.auto_generated && item.status==='draft' ? {background:'#fffbf0'} : {}}>
                  <td style={{fontSize:'0.72rem',color:'var(--ink-4)',whiteSpace:'nowrap'}}>
                    {item.activity_type?.replace(/_/g,' ')}
                    {item.auto_generated && <div style={{fontSize:'0.6rem',color:'var(--gold)'}}>Auto-draft</div>}
                  </td>
                  <td style={{maxWidth:260}}>
                    <div style={{fontSize:'0.82rem',color:'var(--ink)',lineHeight:'1.4'}}>{item.public_summary}</div>
                    {item.title && <div style={{fontSize:'0.68rem',color:'var(--ink-4)',marginTop:'0.15rem'}}>Internal: {item.title}</div>}
                  </td>
                  <td style={{fontSize:'0.75rem',color:'var(--ink-4)'}}>{[item.sector,item.region].filter(Boolean).join(' · ') || '—'}</td>
                  <td style={{fontSize:'0.68rem'}}>{(item.visibility_locations||[]).join(', ')}</td>
                  <td>
                    <span className={`admin-pill ${item.suppressed?'danger':STATUS_COLOR[item.status]||''}`}>
                      {item.suppressed ? 'suppressed' : item.status}
                    </span>
                  </td>
                  <td style={{fontSize:'0.72rem'}}>{fmt(item.published_at)}</td>
                  <td>
                    <div style={{display:'flex',gap:'0.3rem',flexWrap:'wrap'}}>
                      <button className="admin-action-btn" style={{fontSize:'0.6rem'}}
                        onClick={() => setEditing({...item})}>Edit</button>

                      {item.status === 'draft' && !item.suppressed && (
                        <button className="admin-action-btn approve" style={{fontSize:'0.6rem'}}
                          onClick={() => doAction('approve', item.id)}>Approve</button>
                      )}
                      {(item.status === 'approved' || item.status === 'draft') && !item.suppressed && (
                        <button className="admin-action-btn publish" style={{fontSize:'0.6rem'}}
                          onClick={() => doAction('publish', item.id)}>Publish</button>
                      )}
                      {item.status === 'published' && !item.suppressed && (
                        <button className="admin-action-btn danger" style={{fontSize:'0.6rem'}}
                          onClick={() => doAction('suppress', item.id, {reason:'Admin suppressed'})}>
                          Suppress
                        </button>
                      )}
                      {item.suppressed && (
                        <button className="admin-action-btn approve" style={{fontSize:'0.6rem'}}
                          onClick={() => doAction('unsuppress', item.id)}>Restore</button>
                      )}
                      {item.status !== 'archived' && (
                        <button className="admin-action-btn" style={{fontSize:'0.6rem',color:'var(--ink-4)'}}
                          onClick={() => doAction('archive', item.id)}>Archive</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="workflow-modal" style={{maxWidth:620}}>
            <div className="workflow-modal-title">{editing.id ? 'Edit Activity Item' : 'New Activity Item'}</div>
            {editing.auto_generated && (
              <div className="warning-box" style={{marginBottom:'1rem'}}>
                <strong>Auto-generated draft</strong>
                Review and edit the public summary before approving or publishing.
                The related placement details are stored internally — do not include candidate or recruiter names in the public text.
              </div>
            )}
            <div style={{display:'grid',gap:'0.75rem',marginBottom:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Activity Type *</label>
                <select className="form-input" value={editing.activity_type||''} onChange={e=>setEditing(p=>({...p,activity_type:e.target.value}))}>
                  {ACTIVITY_TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Internal Label (not shown publicly)</label>
                <input className="form-input" placeholder="e.g. Q2 placement — Smith & Co" value={editing.title||''}
                  onChange={e=>setEditing(p=>({...p,title:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Public Summary * — anonymized, no names</label>
                <textarea className="form-input" rows={3} style={{resize:'vertical'}}
                  placeholder="e.g. Senior operations placement completed, Maritime Logistics sector, Gulf Coast."
                  value={editing.public_summary||''} onChange={e=>setEditing(p=>({...p,public_summary:e.target.value}))} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem'}}>
                {[
                  {k:'sector',    label:'Sector',     ph:'Maritime Logistics'},
                  {k:'region',    label:'Region',      ph:'Gulf Coast'},
                  {k:'role_level',label:'Role Level',  ph:'Senior executive'},
                ].map(f => (
                  <div key={f.k} className="form-group">
                    <label className="form-label">{f.label}</label>
                    <input className="form-input" placeholder={f.ph} value={editing[f.k]||''} onChange={e=>setEditing(p=>({...p,[f.k]:e.target.value}))} />
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label" style={{marginBottom:'0.5rem'}}>Show On</label>
                <div style={{display:'flex',gap:'0.75rem'}}>
                  {LOCATION_OPTIONS.map(loc => (
                    <label key={loc} style={{display:'flex',gap:'0.375rem',alignItems:'center',fontSize:'0.82rem',cursor:'pointer'}}>
                      <input type="checkbox"
                        checked={(editing.visibility_locations||[]).includes(loc)}
                        onChange={e => {
                          const locs = editing.visibility_locations || [];
                          setEditing(p => ({...p, visibility_locations: e.target.checked ? [...locs, loc] : locs.filter(l => l !== loc)}));
                        }} />
                      {loc.charAt(0).toUpperCase()+loc.slice(1)} Page
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Expires At (optional)</label>
                <input className="form-input" type="datetime-local" value={editing.expires_at ? editing.expires_at.slice(0,16) : ''}
                  onChange={e=>setEditing(p=>({...p,expires_at:e.target.value?new Date(e.target.value).toISOString():null}))} />
              </div>
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={()=>setEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveItem} disabled={saving}>
                {saving ? 'Saving…' : editing.id ? 'Save Changes' : 'Create Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN BILLING TAB ────────────────────────────────────────────────────────
function AdminBillingTab({ showToast }) {
  const [billings, setBillings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('pending');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await sb.from('fed_recruiter_billing').select('*').order('created_at', {ascending:false});
      setBillings(data || []);
      setLoading(false);
    }
    load();
  }, []);

  function fmt(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}); }

  const filtered = billings.filter(b => {
    if (filter === 'pending') return b.admin_review_status === 'pending';
    if (filter === 'invoice') return b.billing_status.startsWith('invoice');
    if (filter === 'issues') return ['payment_failed','suspended'].includes(b.billing_status);
    return true;
  });

  const pendingCount = billings.filter(b => b.admin_review_status === 'pending').length;

  return (
    <div>
      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1.5rem',flexWrap:'wrap'}}>
        {[['all','All'],['pending',`Pending Review (${pendingCount})`],['invoice','Invoice Billing'],['issues','Issues']].map(([v,l]) => (
          <button key={v} className={`admin-action-btn ${filter===v?'approve':''}`} onClick={()=>setFilter(v)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="admin-empty"><span className="spinner"/>Loading…</div> :
      filtered.length === 0 ? <div className="admin-empty">No billing records matching this filter.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Recruiter</th><th>Status</th><th>Company</th><th>Since</th><th>Admin Review</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.recruiter_email} style={b.admin_review_status==='pending'?{background:'#fffbf0'}:{}}>
                  <td style={{fontSize:'0.78rem'}}>{b.recruiter_email}</td>
                  <td><span className={`admin-pill ${b.billing_status==='founding_partner'?'approved':b.billing_status==='invoice_billing_approved'?'posted':b.billing_status==='payment_failed'||b.billing_status==='suspended'?'danger':''}`}>
                    {b.billing_status?.replace(/_/g,' ')}
                  </span></td>
                  <td style={{fontSize:'0.78rem'}}>{b.invoice_company_name || '—'}</td>
                  <td style={{fontSize:'0.72rem'}}>{fmt(b.created_at)}</td>
                  <td><span className={`admin-pill ${b.admin_review_status}`}>{b.admin_review_status?.replace(/_/g,' ')}</span></td>
                  <td>
                    <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                      {b.billing_status === 'invoice_billing_pending' && b.admin_review_status === 'pending' && (
                        <>
                          <button className="admin-action-btn approve" onClick={async()=>{
                            const now = new Date().toISOString();
                            await sb.from('fed_recruiter_billing').update({
                              billing_status:'invoice_billing_approved',
                              admin_review_status:'approved',
                              admin_reviewed_at: now,
                            }).eq('recruiter_email', b.recruiter_email);
                            setBillings(p=>p.map(x=>x.recruiter_email===b.recruiter_email?{...x,billing_status:'invoice_billing_approved',admin_review_status:'approved'}:x));
                            showToast('Invoice billing approved.');
                          }}>Approve</button>
                          <button className="admin-action-btn danger" onClick={async()=>{
                            await sb.from('fed_recruiter_billing').update({
                              billing_status:'no_billing_setup',
                              admin_review_status:'rejected',
                            }).eq('recruiter_email', b.recruiter_email);
                            setBillings(p=>p.map(x=>x.recruiter_email===b.recruiter_email?{...x,billing_status:'no_billing_setup',admin_review_status:'rejected'}:x));
                            showToast('Invoice billing rejected.');
                          }}>Reject</button>
                        </>
                      )}
                      {b.billing_status === 'payment_failed' && (
                        <button className="admin-action-btn danger" onClick={async()=>{
                          await sb.from('fed_recruiter_billing').update({billing_status:'suspended',suspended_at:new Date().toISOString()}).eq('recruiter_email',b.recruiter_email);
                          setBillings(p=>p.map(x=>x.recruiter_email===b.recruiter_email?{...x,billing_status:'suspended'}:x));
                          showToast('Account suspended.');
                        }}>Suspend</button>
                      )}
                      {b.billing_status === 'suspended' && (
                        <button className="admin-action-btn approve" onClick={async()=>{
                          await sb.from('fed_recruiter_billing').update({billing_status:'payment_method_added',suspended_at:null}).eq('recruiter_email',b.recruiter_email);
                          setBillings(p=>p.map(x=>x.recruiter_email===b.recruiter_email?{...x,billing_status:'payment_method_added'}:x));
                          showToast('Account reinstated.');
                        }}>Reinstate</button>
                      )}
                      {b.invoice_contact_email && (
                        <a href={`mailto:${b.invoice_contact_email}`} style={{textDecoration:'none'}}>
                          <button className="admin-action-btn" style={{fontSize:'0.65rem'}}>Email</button>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── ADMIN LEADERBOARD TAB ────────────────────────────────────────────────────
function AdminLeaderboardTab({ showToast }) {
  const [recruiterEmails, setRecruiterEmails] = useState([]);
  const [overrides, setOverrides]             = useState({});
  const [editEmail, setEditEmail]             = useState('');
  const [editForm, setEditForm]               = useState({ approved:false, suppressed:false, suppression_reason:'', ineligible:false, ineligibility_reason:'', admin_notes:'' });
  const [loading, setLoading]                 = useState(true);
  const [liveData, setLiveData]               = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: bil }, { data: ov }, lbResp] = await Promise.all([
        sb.from('fed_recruiter_billing').select('recruiter_email,billing_status').order('created_at',{ascending:false}),
        sb.from('fed_leaderboard_overrides').select('*'),
        fetch('/api/leaderboard?period=all').then(r=>r.json()).catch(()=>({leaderboard:[]})),
      ]);
      setRecruiterEmails((bil||[]).map(b=>b.recruiter_email));
      const ovMap = {};
      (ov||[]).forEach(o => { ovMap[o.recruiter_email] = o; });
      setOverrides(ovMap);
      setLiveData(lbResp);
      setLoading(false);
    }
    load();
  }, []);

  function startEdit(email) {
    const ov = overrides[email] || {};
    setEditEmail(email);
    setEditForm({ approved:ov.approved||false, suppressed:ov.suppressed||false, suppression_reason:ov.suppression_reason||'', ineligible:ov.ineligible||false, ineligibility_reason:ov.ineligibility_reason||'', admin_notes:ov.admin_notes||'' });
  }

  async function saveOverride() {
    try {
      const adminToken = sessionStorage.getItem('fed_admin_token') || '';
      const resp = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({ action:'override', recruiter_email: editEmail, ...editForm }),
      });
      const data = await resp.json();
      if (!resp.ok) { showToast(data.error||'Override failed.'); return; }
      setOverrides(p => ({...p, [editEmail]: {...editForm, recruiter_email: editEmail}}));
      setEditEmail('');
      showToast('Leaderboard override saved.');
    } catch(e) { showToast('Error saving override.'); }
  }

  async function triggerSnapshot() {
    try {
      const adminToken = sessionStorage.getItem('fed_admin_token') || '';
      const resp = await fetch('/api/leaderboard', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+adminToken},
        body:JSON.stringify({action:'snapshot'}),
      });
      const data = await resp.json();
      if (resp.ok) showToast(`✓ Snapshot saved — ${data.snapshots} records.`);
      else showToast(data.error||'Snapshot failed.');
    } catch(e) { showToast('Snapshot error.'); }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',color:'var(--ink)'}}>Leaderboard Management</div>
          <div style={{fontSize:'0.75rem',color:'var(--ink-4)',marginTop:'0.2rem'}}>Approve or suppress recruiter leaderboard visibility. Only verified, approved recruiters appear publicly.</div>
        </div>
        <button className="admin-action-btn" onClick={triggerSnapshot}>Save Snapshot</button>
      </div>

      {/* Live leaderboard preview */}
      {liveData?.leaderboard?.length > 0 && (
        <div style={{marginBottom:'1.5rem',background:'var(--paper-2)',border:'1px solid var(--rule)',padding:'1rem 1.25rem'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:'0.75rem'}}>
            Current Public Leaderboard (All Time)
          </div>
          {liveData.leaderboard.map((r,i) => (
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'0.375rem 0',borderBottom:'1px solid var(--rule-lt)',fontSize:'0.82rem'}}>
              <span>#{r.rank} {r.firm_name}</span>
              <span style={{color:'var(--gold)',fontWeight:700}}>{r.placement_count} placements</span>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="admin-empty"><span className="spinner"/>Loading…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Recruiter</th><th>Approved</th><th>Suppressed</th><th>Ineligible</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {recruiterEmails.map(email => {
                const ov = overrides[email];
                return (
                  <tr key={email}>
                    <td style={{fontSize:'0.78rem'}}>{email}</td>
                    <td style={{textAlign:'center'}}>{ov?.approved ? '✓' : '—'}</td>
                    <td style={{textAlign:'center',color: ov?.suppressed ? '#c0392b':undefined}}>{ov?.suppressed ? '✗ '+ov.suppression_reason : '—'}</td>
                    <td style={{textAlign:'center',color: ov?.ineligible ? '#c0392b':undefined}}>{ov?.ineligible ? '✗' : '—'}</td>
                    <td>
                      <button className="admin-action-btn" onClick={()=>startEdit(email)}>Edit Override</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editEmail && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setEditEmail('');}}>
          <div className="workflow-modal">
            <div className="workflow-modal-title">Leaderboard Override — {editEmail}</div>
            <div style={{display:'grid',gap:'0.75rem',marginBottom:'1.25rem'}}>
              {[
                { k:'approved', label:'Approved for leaderboard display' },
                { k:'suppressed', label:'Suppress from leaderboard' },
                { k:'ineligible', label:'Mark as ineligible' },
              ].map(f => (
                <label key={f.k} style={{display:'flex',gap:'0.5rem',alignItems:'center',cursor:'pointer',fontSize:'0.875rem'}}>
                  <input type="checkbox" checked={!!editForm[f.k]} onChange={e=>setEditForm(p=>({...p,[f.k]:e.target.checked}))} />
                  {f.label}
                </label>
              ))}
              {editForm.suppressed && (
                <div className="form-group">
                  <label className="form-label">Suppression Reason</label>
                  <input className="form-input" value={editForm.suppression_reason} onChange={e=>setEditForm(p=>({...p,suppression_reason:e.target.value}))} />
                </div>
              )}
              {editForm.ineligible && (
                <div className="form-group">
                  <label className="form-label">Ineligibility Reason</label>
                  <input className="form-input" value={editForm.ineligibility_reason} onChange={e=>setEditForm(p=>({...p,ineligibility_reason:e.target.value}))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Admin Notes</label>
                <textarea className="form-input" rows={2} value={editForm.admin_notes} onChange={e=>setEditForm(p=>({...p,admin_notes:e.target.value}))} style={{resize:'vertical'}} />
              </div>
            </div>
            <div className="workflow-actions">
              <button className="workflow-close-btn" onClick={()=>setEditEmail('')}>Cancel</button>
              <button className="btn-primary" onClick={saveOverride}>Save Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN CLOSURES TAB ───────────────────────────────────────────────────────
function AdminClosuresTab({ jobs, showToast, reloadJobs }) {
  const [closures, setClosures]     = useState([]);
  const [placements, setPlacements] = useState([]);
  const [ctab, setCtab]             = useState('closures');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: cl }, { data: pl }] = await Promise.all([
        sb.from('fed_job_closures').select('*').order('created_at', {ascending:false}),
        sb.from('fed_placements').select('*').order('created_at', {ascending:false}),
      ]);
      setClosures(cl || []);
      setPlacements(pl || []);
      setLoading(false);
    }
    load();
  }, []);

  function fmt(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}); }

  const flaggedJobs = jobs.filter(j => j.admin_flagged);

  return (
    <div>
      {flaggedJobs.length > 0 && (
        <div className="warning-box" style={{marginBottom:'1.5rem'}}>
          <strong>⚠ {flaggedJobs.length} Flagged Job{flaggedJobs.length>1?'s':''} Require Review</strong>
          {flaggedJobs.map(j => (
            <div key={j.id} style={{marginTop:'0.375rem'}}>
              <strong>{j.title}</strong> — {j.admin_flag_reason}
            </div>
          ))}
        </div>
      )}

      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--rule)',marginBottom:'1.5rem'}}>
        {[['closures','Closures'],['placements','Placements']].map(([v,l]) => (
          <button key={v} className={`admin-tab ${ctab===v?'active':''}`} onClick={()=>setCtab(v)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="admin-empty"><span className="spinner"/>Loading…</div> : ctab === 'closures' ? (
        <div className="admin-table-wrap">
          {closures.length === 0 ? <div className="admin-empty">No closures yet.</div> : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Recruiter</th><th>Job</th><th>Reason</th>
                  <th>Introductions</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {closures.map(c => {
                  const job = jobs.find(j => j.id === c.job_id);
                  return (
                    <tr key={c.id} style={c.had_introductions ? {background:'#fff8f0'} : {}}>
                      <td>{fmt(c.created_at)}</td>
                      <td style={{fontSize:'0.78rem'}}>{c.recruiter_email}</td>
                      <td><strong>{job?.title || c.job_id?.slice(0,8)}</strong></td>
                      <td style={{fontSize:'0.78rem'}}>{c.close_reason_display}</td>
                      <td style={{textAlign:'center'}}>
                        {c.had_introductions
                          ? <span style={{color:'#c0392b',fontWeight:700}}>{c.introduced_candidate_count} ⚠</span>
                          : <span style={{color:'var(--ink-4)'}}>0</span>}
                      </td>
                      <td><span className={`admin-pill ${c.admin_review_status}`}>{c.admin_review_status}</span></td>
                      <td>
                        <div style={{display:'flex',gap:'0.375rem'}}>
                          {c.admin_review_status === 'pending' && (
                            <>
                              <button className="admin-action-btn approve" onClick={async()=>{
                                await sb.from('fed_job_closures').update({admin_review_status:'approved',admin_reviewed_at:new Date().toISOString()}).eq('id',c.id);
                                setClosures(p=>p.map(x=>x.id===c.id?{...x,admin_review_status:'approved'}:x));
                                showToast('Closure approved.');
                              }}>Approve</button>
                              <button className="admin-action-btn danger" onClick={async()=>{
                                await sb.from('fed_job_closures').update({admin_review_status:'disputed'}).eq('id',c.id);
                                await sb.from('fed_jobs').update({status:'active',admin_flagged:true}).eq('id',c.job_id);
                                setClosures(p=>p.map(x=>x.id===c.id?{...x,admin_review_status:'disputed'}:x));
                                showToast('Closure disputed. Job reopened for review.');
                              }}>Dispute</button>
                            </>
                          )}
                          {c.admin_review_status !== 'reopened' && (
                            <button className="admin-action-btn" onClick={async()=>{
                              await sb.from('fed_jobs').update({status:'active'}).eq('id',c.job_id);
                              await sb.from('fed_job_closures').update({admin_review_status:'reopened'}).eq('id',c.id);
                              showToast('Job reopened.');
                            }}>Reopen</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="admin-table-wrap">
          {placements.length === 0 ? <div className="admin-empty">No placement records yet.</div> : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Recruiter</th><th>Type</th><th>Candidate</th>
                  <th>Compensation</th><th>Fee</th><th>Invoice</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {placements.map(p => {
                  const job = jobs.find(j => j.id === p.job_id);
                  return (
                    <tr key={p.id} style={p.admin_review_status==='pending'?{background:'#fff8f0'}:{}}>
                      <td>{fmt(p.created_at)}</td>
                      <td style={{fontSize:'0.78rem'}}>{p.recruiter_email}</td>
                      <td><span className={`admin-pill ${p.placement_type==='platform_candidate'?'posted':p.placement_type==='external_candidate'?'pending':''}`}
                        style={{fontSize:'0.6rem'}}>{p.placement_type?.replace(/_/g,' ')}</span></td>
                      <td style={{fontSize:'0.78rem'}}>{p.candidate_email || '—'}</td>
                      <td>{p.compensation_amount ? `$${parseInt(p.compensation_amount).toLocaleString()}` : '—'}</td>
                      <td style={{fontWeight:p.fee_amount?700:'normal',color:p.fee_amount?'var(--green)':'var(--ink-4)'}}>
                        {p.fee_amount ? `$${parseInt(p.fee_amount).toLocaleString()}` : '—'}
                      </td>
                      <td><span className={`admin-pill ${p.invoice_status}`} style={{fontSize:'0.6rem'}}>{p.invoice_status?.replace(/_/g,' ')}</span></td>
                      <td><span className={`admin-pill ${p.admin_review_status}`}>{p.admin_review_status}</span></td>
                      <td>
                        <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                          {p.admin_review_status === 'pending' && (
                            <>
                              <button className="admin-action-btn approve" onClick={async()=>{
                                const now = new Date().toISOString();
                                await sb.from('fed_placements').update({admin_review_status:'approved',admin_reviewed_at:now,locked_at:now}).eq('id',p.id);
                                setPlacements(prev=>prev.map(x=>x.id===p.id?{...x,admin_review_status:'approved'}:x));
                                // Auto-draft activity item for admin review
                                const job = jobs.find(j=>j.id===p.job_id);
                                const adminToken = sessionStorage.getItem('fed_admin_token')||'';
                                fetch('/api/marketplace-activity', {
                                  method:'POST',
                                  headers:{'Content-Type':'application/json','Authorization':'Bearer '+adminToken},
                                  body:JSON.stringify({
                                    action:'auto_draft',
                                    related_placement_id: p.id,
                                    related_job_id: p.job_id,
                                    related_recruiter_email: p.recruiter_email,
                                    related_candidate_email: p.candidate_email,
                                    sector:   job?.industry || null,
                                    region:   job?.location ? job.location.split(',').slice(-1)[0]?.trim() : null,
                                    role_level: job?.role_level || 'Executive-level',
                                    activity_type: 'placement_verified',
                                  }),
                                }).catch(()=>{});
                                showToast('Placement approved and locked. Activity draft created for review.');
                              }}>Approve</button>
                              <button className="admin-action-btn danger" onClick={async()=>{
                                await sb.from('fed_placements').update({admin_review_status:'disputed'}).eq('id',p.id);
                                setPlacements(prev=>prev.map(x=>x.id===p.id?{...x,admin_review_status:'disputed'}:x));
                                // Suppress any published activity item linked to this placement
                                const adminToken = sessionStorage.getItem('fed_admin_token')||'';
                                fetch('/api/marketplace-activity', {
                                  method:'POST',
                                  headers:{'Content-Type':'application/json','Authorization':'Bearer '+adminToken},
                                  body:JSON.stringify({action:'flag_disputed',related_placement_id:p.id}),
                                }).catch(()=>{});
                                showToast('Placement disputed. Any published activity item has been suppressed.');
                              }}>Dispute</button>
                            </>
                          )}
                          {p.placement_type === 'platform_candidate' && p.invoice_status === 'not_sent' && (
                            <button className="admin-action-btn publish" onClick={()=>showToast('Invoice generation — configure your invoicing system and connect here.')}>
                              Send Invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── ADMIN FEEDBACK TAB ───────────────────────────────────────────────────────
function AdminFeedbackTab({ showToast }) {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');  // all | flagged | pending

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await sb.from('fed_recruiter_feedback')
        .select('*').order('created_at', {ascending:false}).limit(200);
      setFeedback(data || []);
      setLoading(false);
    }
    load();
  }, []);

  function fmt(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}); }

  const filtered = feedback.filter(f => {
    if (filter === 'flagged') return f.attempted_bypass || f.misrepresented_role;
    if (filter === 'pending') return f.admin_review_status === 'pending';
    return true;
  });

  const flagCount = feedback.filter(f => f.attempted_bypass || f.misrepresented_role).length;

  return (
    <div>
      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1.5rem',flexWrap:'wrap',alignItems:'center'}}>
        {[['all','All Feedback'],['flagged',`Flagged (${flagCount})`],['pending','Pending Review']].map(([v,l]) => (
          <button key={v} className={`admin-action-btn ${filter===v?'approve':''}`} onClick={()=>setFilter(v)}
            style={v==='flagged'&&flagCount>0?{color:'#c0392b',borderColor:'#c0392b'}:{}}>{l}</button>
        ))}
      </div>

      {loading ? <div className="admin-empty"><span className="spinner"/>Loading…</div> :
      filtered.length === 0 ? <div className="admin-empty">No feedback records.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th><th>Recruiter</th><th>Trigger</th>
                <th>Overall</th><th>Engage Again</th><th>Flags</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} style={(f.attempted_bypass||f.misrepresented_role)?{background:'#fff8f0'}:{}}>
                  <td>{fmt(f.created_at)}</td>
                  <td style={{fontSize:'0.78rem'}}>{f.recruiter_email}</td>
                  <td style={{fontSize:'0.72rem',color:'var(--ink-4)'}}>{f.feedback_trigger?.replace(/_/g,' ')}</td>
                  <td style={{textAlign:'center'}}>
                    {f.rating_overall ? '★'.repeat(f.rating_overall) + '☆'.repeat(5-f.rating_overall) : '—'}
                  </td>
                  <td style={{textAlign:'center',fontSize:'0.78rem'}}>
                    {f.would_engage_again === true ? '✓ Yes' : f.would_engage_again === false ? '✗ No' : '—'}
                  </td>
                  <td>
                    {f.attempted_bypass && <span style={{color:'#c0392b',fontSize:'0.72rem',display:'block'}}>⚠ Bypass attempt</span>}
                    {f.misrepresented_role && <span style={{color:'#c0392b',fontSize:'0.72rem',display:'block'}}>⚠ Misrepresentation</span>}
                    {!f.attempted_bypass && !f.misrepresented_role && <span style={{color:'var(--ink-4)',fontSize:'0.72rem'}}>None</span>}
                  </td>
                  <td><span className={`admin-pill ${f.admin_review_status}`}>{f.admin_review_status}</span></td>
                  <td>
                    <div style={{display:'flex',gap:'0.375rem'}}>
                      {f.admin_review_status !== 'reviewed' && (
                        <button className="admin-action-btn approve" onClick={async()=>{
                          await sb.from('fed_recruiter_feedback').update({admin_review_status:'reviewed',admin_reviewed_at:new Date().toISOString()}).eq('id',f.id);
                          setFeedback(p=>p.map(x=>x.id===f.id?{...x,admin_review_status:'reviewed'}:x));
                          showToast('Feedback marked reviewed.');
                        }}>Mark Reviewed</button>
                      )}
                      {f.admin_review_status !== 'dismissed' && (
                        <button className="admin-action-btn" onClick={async()=>{
                          await sb.from('fed_recruiter_feedback').update({admin_review_status:'dismissed',admin_dismissed_at:new Date().toISOString()}).eq('id',f.id);
                          setFeedback(p=>p.map(x=>x.id===f.id?{...x,admin_review_status:'dismissed'}:x));
                          showToast('Feedback dismissed.');
                        }}>Dismiss</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await resp.json();
      if (resp.ok && data.ok && data.token) {
        sessionStorage.setItem('fed_admin', 'true');
        // Store the signed session token (HMAC-SHA256 + expiry) instead of
        // the raw password. Sent as Authorization: Bearer on subsequent
        // admin API calls. The password itself is never persisted.
        sessionStorage.setItem('fed_admin_token', data.token);
        // Defensive: scrub any legacy password storage left over from older
        // sessions before this refactor.
        sessionStorage.removeItem('fed_admin_pwd');
        onLogin();
      } else {
        setError(data.error || 'Incorrect password.');
        setTimeout(() => setError(''), 2000);
      }
    } catch(e) {
      setError('Auth check failed. Try again.');
    }
    setLoading(false);
  }

  return (
    <div className="admin-login">
      <div className="admin-login-box">
        <div className="admin-login-eyebrow">Admin Access</div>
        <div className="admin-login-title">Control Room</div>
        <div className="form-group" style={{marginBottom:'1rem'}}>
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
        </div>
        {error && <div style={{color:'var(--red)',fontSize:'0.78rem',marginBottom:'0.75rem'}}>{error}</div>}
        <button className="submit-btn" onClick={handleLogin} disabled={loading}>
          {loading ? 'Checking…' : 'Access Control Room'}
        </button>
        <p style={{fontSize:'0.72rem',color:'var(--ink-4)',marginTop:'0.75rem',textAlign:'center'}}>
          Fredheim Technologies LLC — Internal Use Only
        </p>
      </div>
    </div>
  );
}



// ── INDUSTRY MULTI-SELECT COMPONENT ──────────────────────────────────────────
const ALL_INDUSTRY_OPTIONS = [
  // Operational verticals
  'Maritime & Shipping', 'Ports & Terminals', 'Energy & Offshore', 'Industrial Commodities & Logistics',
  // Industrial-technology verticals
  'Maritime Technology', 'Port Technology', 'Logistics Technology', 'Industrial SaaS',
  'Fleet Intelligence', 'Operational AI', 'Industrial Automation', 'Supply Chain Technology',
  'Compliance & Safety Tech',
];

function IndustryMultiSelect({ value, onChange, placeholder }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  // value is array of strings
  const selected = Array.isArray(value) ? value : (value ? [value] : []);

  function toggle(ind) {
    if (selected.includes(ind)) {
      onChange(selected.filter(i => i !== ind));
    } else {
      onChange([...selected, ind]);
    }
  }

  // Close on outside click
  React.useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="industry-select-wrap" ref={ref}>
      <div className="industry-chips" onClick={() => setOpen(o => !o)}>
        {selected.length === 0 ? (
          <span className="industry-chip placeholder">{placeholder || 'Select industries…'}</span>
        ) : (
          selected.map(ind => (
            <span key={ind} className="industry-chip">
              {ind}
              <button className="industry-chip-remove" onClick={e => { e.stopPropagation(); toggle(ind); }}>✕</button>
            </span>
          ))
        )}
      </div>
      {open && (
        <div className="industry-dropdown">
          {ALL_INDUSTRY_OPTIONS.map(ind => (
            <div
              key={ind}
              className={`industry-option ${selected.includes(ind) ? 'selected' : ''}`}
              onClick={() => toggle(ind)}
            >
              <div className="industry-option-check">{selected.includes(ind) ? '✓' : ''}</div>
              {ind}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AUTH HELPERS ──────────────────────────────────────────────────────────────
// Views that the post-auth router (applyRouting in App) knows how to land on.
// Used to validate the optional returnView arg so we don't redirect to a view
// that doesn't exist.
const KNOWN_RETURN_VIEWS = new Set([
  'jobs','early-careers','intern-profile','intern-myprofile','consulting','pricing',
  'profile','myprofile','recruiter-dash','recruiter-signin','signin',
  'about','terms','privacy',
]);

async function sendMagicLink(email, returnView) {
  const view = returnView && KNOWN_RETURN_VIEWS.has(returnView) ? returnView : 'myprofile';
  const redirectUrl = `${window.location.origin}?view=${encodeURIComponent(view)}`;

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    }
  });

  return error;
}

// ── SIGN IN PAGE ──────────────────────────────────────────────────────────────
function SignInPage({ onBack, returnView }) {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSend() {
    if (!email || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    setError('');
    const err = await sendMagicLink(email, returnView);
    if (err) {
      setError('Could not send link. Please try again or email desk@fredheimtech.com.');
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-eyebrow">Executive Access</div>
        <h2 className="auth-title">Access Your Profile</h2>
        <p className="auth-desc">
          Enter your email address and we'll send you a secure sign-in link.
          No password required.
        </p>

        {sent ? (
          <div className="auth-sent-box">
            <div className="auth-sent-title">Check Your Inbox</div>
            <div className="auth-sent-desc">
              A sign-in link has been sent to <strong>{email}</strong>.
              Click the link in your email to access your profile.
              The link expires in 1 hour.
            </div>
          </div>
        ) : (
          <>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                autoFocus
              />
            </div>
            {error && (
              <div style={{color:'var(--red)',fontSize:'0.78rem',marginBottom:'0.75rem',lineHeight:'1.5'}}>{error}</div>
            )}
            <button className="submit-btn" onClick={handleSend} disabled={loading}>
              {loading ? 'Sending…' : 'Send Sign-In Link'}
            </button>
            <p className="form-note" style={{marginTop:'1rem'}}>
              Use the same email you registered with.
              Don't have a profile yet?{' '}
              <span style={{color:'var(--gold)',cursor:'pointer',textDecoration:'underline'}} onClick={onBack}>
                Create one here.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── MY PROFILE DASHBOARD ──────────────────────────────────────────────────────
function MyProfilePage({ user, onSignOut, showToast, onCreateProfile, onUpgrade, onRecruiterRedirect }) {
  const [profile, setProfile]             = useState(null);
  const [talentProfile, setTalentProfile] = useState(null);
  const [interests, setInterests]         = useState([]);
  const [jobs, setJobs]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [editing, setEditing]             = useState(null);
  const [editData, setEditData]           = useState({});
  const [isRecruiter, setIsRecruiter]     = useState(false);

  useEffect(() => { loadProfile(); }, [user]);

  async function loadProfile() {
    setLoading(true);
    try {
      const email = user.email;
      const [pRes, iRes, jRes, tRes] = await Promise.all([
        sb.from('fed_profiles').select('*').eq('email', email).single(),
        sb.from('fed_interests').select('*').eq('anon_email', email).order('created_at', {ascending:false}),
        sb.from('fed_jobs').select('id,title,firm_name,industry,salary_display,created_at').eq('status','active'),
        sb.from('talent_candidates').select(
          'score_composite,score_executive_fit,score_technology,score_change_mgmt,score_background,badge_seasoned_exec,badge_tech_forward,badge_pivot,last_answers_updated,tier,status'
        ).eq('email', email).maybeSingle(),
      ]);

      if (!pRes.data) {
        // No executive profile — check if this email belongs to a recruiter
        const { data: recruiterSub } = await sb
          .from('fed_recruiter_submissions')
          .select('id')
          .ilike('email', email)
          .limit(1);
        if (recruiterSub && recruiterSub.length > 0) {
          setIsRecruiter(true);
          setLoading(false);
          return;
        }
      }

      setProfile(pRes.data);
      setInterests(iRes.data || []);
      setJobs(jRes.data || []);
      setTalentProfile(tRes.data || null);
    } catch(e) {
      showToast('Error loading profile. Try refreshing.');
    }
    setLoading(false);
  }

  async function saveField(fields) {
    try {
      const { error } = await sb.from('fed_profiles').update(fields).eq('email', user.email);
      if (error) throw error;
      setProfile(p => ({...p, ...fields}));
      setEditing(null);
      showToast('✓ Profile updated.');
    } catch(e) {
      showToast('Save failed. Try again.');
    }
  }

  function fmt(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  }

  function tierLabel(tier) {
    if (tier === 'confidential' || tier === 'active' || tier === 'active_senior') return 'Confidential';
    return 'Free';
  }

  function tierColor(tier) {
    if (tier === 'confidential' || tier === 'active' || tier === 'active_senior') return 'gold';
    return '';
  }

  const bigFiveKeys = ['openness','conscientiousness','extraversion','agreeableness','emotional_stability'];
  const bigFiveNames = {
    openness: 'Openness',
    conscientiousness: 'Conscientiousness',
    extraversion: 'Extraversion',
    agreeableness: 'Agreeableness',
    emotional_stability: 'Neuroticism'
  };

  const parsedBigFive = profile?.big_five
    ? (typeof profile.big_five === 'string' ? JSON.parse(profile.big_five) : profile.big_five)
    : null;

  const parsedCareer = profile?.career_timeline
    ? (typeof profile.career_timeline === 'string' ? JSON.parse(profile.career_timeline) : profile.career_timeline)
    : [];

  const parsedAchievements = profile?.achievements
    ? (typeof profile.achievements === 'string' ? JSON.parse(profile.achievements) : profile.achievements)
    : [];

  const defaultBigFive = {
    openness: 50,
    conscientiousness: 50,
    extraversion: 50,
    agreeableness: 50,
    emotional_stability: 50,
  };

  function cleanBigFive(raw) {
    const source = raw || {};
    const clean = {};
    bigFiveKeys.forEach(k => {
      const n = parseInt(source[k]);
      clean[k] = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
    });
    return clean;
  }

  function startBigFiveEdit() {
    setEditing('bigfive');
    setEditData({
      big_five: cleanBigFive(parsedBigFive || defaultBigFive),
      big_five_shared: !!profile.big_five_shared,
    });
  }

  function setBigFiveScore(key, value) {
    const n = Math.max(0, Math.min(100, parseInt(value) || 0));
    setEditData(p => ({
      ...p,
      big_five: {
        ...(p.big_five || defaultBigFive),
        [key]: n,
      }
    }));
  }

  async function saveBigFive() {
    const clean = cleanBigFive(editData.big_five || defaultBigFive);
    await saveField({
      big_five: JSON.stringify(clean),
      big_five_shared: !!editData.big_five_shared,
    });
  }

  function bigFiveScoreLabel(score) {
    const n = parseInt(score) || 0;
    if (n <= 20) return 'Very Low';
    if (n <= 38) return 'Low';
    if (n <= 62) return 'Moderate';
    if (n <= 80) return 'High';
    return 'Very High';
  }

  if (loading) return (
    <div style={{textAlign:'center',padding:'4rem',color:'var(--ink-4)'}}>
      <span className="spinner" />Loading your profile…
    </div>
  );

  if (!profile) return (
    <div style={{textAlign:'center',padding:'4rem'}}>
      {isRecruiter ? (
        <>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.3rem',color:'var(--ink)',marginBottom:'1rem'}}>
            Welcome back, {user.email}
          </div>
          <p style={{color:'var(--ink-4)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>
            Your account is registered as a search firm. Go to your Firm Dashboard to manage postings and view candidate activity.
          </p>
          <button className="btn-primary" onClick={() => onRecruiterRedirect && onRecruiterRedirect()}>
            Go to Firm Dashboard →
          </button>
        </>
      ) : (
        <>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.3rem',color:'var(--ink)',marginBottom:'1rem'}}>
            No profile found for {user.email}
          </div>
          <p style={{color:'var(--ink-4)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>
            This email doesn't have a profile yet. Create one to get started.
          </p>
          <button className="btn-primary" onClick={onCreateProfile}>Create a Profile</button>
        </>
      )}
    </div>
  );

  return (
    <div className="my-profile-page">
      <div className="my-profile-header">
        <div>
          <div className="my-profile-name">{profile.first_name} {profile.last_name}</div>
          <div className="my-profile-title-sub">{profile.current_title}</div>
        </div>
        <div className="my-profile-actions">
          <button className="admin-action-btn" onClick={loadProfile}>↻ Refresh</button>
          <button className="admin-action-btn danger" onClick={onSignOut}>Sign Out</button>
        </div>
      </div>

      {/* Tier & Subscription */}
      <div className="profile-card" style={{marginBottom:'1.5rem'}}>
        <div className="profile-card-header">
          <div className="profile-card-title">Membership</div>
        </div>
        <div className="tier-display">
          <div className={`tier-display-badge ${tierColor(profile.tier)}`}>
            {tierLabel(profile.tier)}
          </div>
          <div className="tier-display-info">
            <div className="tier-display-name">
              {(profile.tier === 'free' || !profile.tier)
                ? 'Free Access — browse all searches, signal interest confidentially'
                : 'Confidential Profile — $299/yr — your name, employer, and location are hidden from recruiters until you approve a connection'
              }
            </div>
            {profile.tier_expires && (
              <div className="tier-display-expiry">Renews {fmt(profile.tier_expires)}</div>
            )}
          </div>
          {profile.tier === 'free' && (
            <button className="btn-primary" style={{fontSize:'0.75rem',padding:'0.5rem 1rem'}}
              onClick={onUpgrade}>
              Upgrade
            </button>
          )}
        </div>
      </div>

      <div className="profile-section-grid">
        {/* Basic Info */}
        <div className="profile-card">
          <div className="profile-card-header">
            <div className="profile-card-title">Basic Information</div>
            {editing === 'basic' ? (
              <button className="profile-edit-btn save" onClick={() => saveField(editData)}>Save</button>
            ) : (
              <button className="profile-edit-btn" onClick={() => { setEditing('basic'); setEditData({
                first_name: profile.first_name,
                last_name: profile.last_name,
                current_title: profile.current_title,
                location: profile.location,
                languages: profile.languages,
              }); }}>Edit</button>
            )}
          </div>
          {editing === 'basic' ? (
            <div className="form" style={{gap:'0.625rem'}}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">First Name</label><input className="form-input" value={editData.first_name||''} onChange={e=>setEditData(p=>({...p,first_name:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" value={editData.last_name||''} onChange={e=>setEditData(p=>({...p,last_name:e.target.value}))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Current Title</label><input className="form-input" value={editData.current_title||''} onChange={e=>setEditData(p=>({...p,current_title:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={editData.location||''} onChange={e=>setEditData(p=>({...p,location:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Languages</label><input className="form-input" value={editData.languages||''} onChange={e=>setEditData(p=>({...p,languages:e.target.value}))} /></div>
              <button className="filter-clear" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          ) : (
            <>
              <div className="profile-field"><div className="profile-field-label">Name</div><div className="profile-field-value">{profile.first_name} {profile.last_name}</div></div>
              <div className="profile-field"><div className="profile-field-label">Title</div><div className="profile-field-value">{profile.current_title || <span className="profile-field-empty">Not set</span>}</div></div>
              <div className="profile-field"><div className="profile-field-label">Location</div><div className="profile-field-value">{profile.location || <span className="profile-field-empty">Not set</span>}</div></div>
              <div className="profile-field"><div className="profile-field-label">Email</div><div className="profile-field-value" style={{color:'var(--ink-3)'}}>{profile.email}</div></div>
              <div className="profile-field"><div className="profile-field-label">Languages</div><div className="profile-field-value">{profile.languages || <span className="profile-field-empty">Not set</span>}</div></div>
            </>
          )}
        </div>

        {/* Professional */}
        <div className="profile-card">
          <div className="profile-card-header">
            <div className="profile-card-title">Professional Focus</div>
            {editing === 'professional' ? (
              <button className="profile-edit-btn save" onClick={() => saveField(editData)}>Save</button>
            ) : (
              <button className="profile-edit-btn" onClick={() => { setEditing('professional'); setEditData({
                industry: profile.industry,
                function: profile.function,
                salary_min: profile.salary_min,
                board_experience: profile.board_experience,
              }); }}>Edit</button>
            )}
          </div>
          {editing === 'professional' ? (
            <div className="form" style={{gap:'0.625rem'}}>
              <div className="form-group">
                <label className="form-label">Industry Focus (select all that apply)</label>
                <IndustryMultiSelect
                  value={Array.isArray(editData.industry) ? editData.industry : (editData.industry ? [editData.industry] : [])}
                  onChange={v => setEditData(p=>({...p, industry: v}))}
                />
              </div>
              <div className="form-group"><label className="form-label">Function</label>
                <select className="form-select" value={editData.function||''} onChange={e=>setEditData(p=>({...p,function:e.target.value}))}>
                  <option value="">Select</option><option>Commercial</option><option>Operations</option><option>Chartering</option><option>Business Development</option><option>Finance</option><option>General Management</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Compensation Floor</label>
                <select className="form-select" value={editData.salary_min||''} onChange={e=>setEditData(p=>({...p,salary_min:parseInt(e.target.value)||null}))}>
                  <option value="">Select</option><option value="100000">$100K+</option><option value="150000">$150K+</option><option value="200000">$200K+</option><option value="300000">$300K+</option><option value="400000">$400K+</option><option value="500000">$500K+</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Board Experience</label>
                <div className="visibility-toggle">
                  <button className={`toggle-opt ${editData.board_experience==='yes'?'active':''}`} onClick={()=>setEditData(p=>({...p,board_experience:'yes'}))}>Yes</button>
                  <button className={`toggle-opt ${editData.board_experience==='no'?'active':''}`} onClick={()=>setEditData(p=>({...p,board_experience:'no'}))}>No</button>
                </div>
              </div>
              <button className="filter-clear" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          ) : (
            <>
              <div className="profile-field">
                <div className="profile-field-label">Industry</div>
                <div className="profile-field-value">
                  {Array.isArray(profile.industry)
                    ? profile.industry.join(' · ')
                    : profile.industry || <span className="profile-field-empty">Not set</span>
                  }
                </div>
              </div>
              <div className="profile-field"><div className="profile-field-label">Function</div><div className="profile-field-value">{profile.function || <span className="profile-field-empty">Not set</span>}</div></div>
              <div className="profile-field"><div className="profile-field-label">Compensation Floor</div><div className="profile-field-value">{profile.salary_min ? `$${(profile.salary_min/1000).toFixed(0)}K+` : <span className="profile-field-empty">Not set</span>}</div></div>
              <div className="profile-field"><div className="profile-field-label">Board Experience</div><div className="profile-field-value">{profile.board_experience || <span className="profile-field-empty">Not set</span>}</div></div>
            </>
          )}
        </div>

        {/* Visibility & Preferences */}
        <div className="profile-card">
          <div className="profile-card-header">
            <div className="profile-card-title">Visibility & Preferences</div>
          </div>
          <div className="profile-visibility-row">
            <div>
              <div className="profile-visibility-label">Available for Consulting</div>
              <div className="profile-visibility-desc">
                {profile.consulting_available
                  ? 'Visible to companies posting consulting briefs'
                  : 'Not visible on the consulting board'
                }
              </div>
            </div>
            <div className={`toggle-switch ${profile.consulting_available?'on':''}`}
              style={{cursor:'pointer'}}
              onClick={() => saveField({consulting_available: !profile.consulting_available})}
            />
          </div>
          <div className="profile-visibility-row">
            <div>
              <div className="profile-visibility-label">Profile Visibility</div>
              <div className="profile-visibility-desc">
                {profile.visibility === 'open'
                  ? 'Open — posting search firms can view your profile'
                  : 'Discreet — only visible when you express interest'
                }
              </div>
            </div>
            <div className={`toggle-switch ${profile.visibility==='open'?'on':''}`}
              style={{cursor:'pointer'}}
              onClick={() => saveField({visibility: profile.visibility==='open'?'discreet':'open'})}
            />
          </div>
          <div className="profile-visibility-row">
            <div>
              <div className="profile-visibility-label">Big Five Personality</div>
              <div className="profile-visibility-desc">
                {profile.big_five_shared
                  ? 'Sharing with recruiters'
                  : 'Private — not shared with recruiters'
                }
              </div>
            </div>
            <div className={`toggle-switch ${profile.big_five_shared?'on':''}`}
              style={{cursor:'pointer'}}
              onClick={() => saveField({big_five_shared: !profile.big_five_shared})}
            />
          </div>
        </div>

        {/* Big Five */}
        <div className="profile-card">
          <div className="profile-card-header">
            <div className="profile-card-title">Big Five Personality</div>
            {editing === 'bigfive' ? (
              <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                <button className="profile-edit-btn" onClick={() => { setEditing(null); setEditData({}); }}>Cancel</button>
                <button className="profile-edit-btn save" onClick={saveBigFive}>Save</button>
              </div>
            ) : (
              <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
                <span style={{fontSize:'0.7rem',color:profile.big_five_shared?'var(--green)':'var(--ink-4)',fontFamily:"'DM Mono',monospace",letterSpacing:'0.08em',textTransform:'uppercase'}}>
                  {profile.big_five_shared ? 'Shared' : 'Private'}
                </span>
                <button className="profile-edit-btn" onClick={startBigFiveEdit}>
                  {parsedBigFive ? 'Edit' : 'Add'}
                </button>
              </div>
            )}
          </div>

          {editing === 'bigfive' ? (
            <div>
              <p style={{fontSize:'0.78rem',color:'var(--ink-3)',lineHeight:'1.6',marginBottom:'1rem'}}>
                Enter the percentile scores from your Big Five assessment. Scores are saved to your profile immediately after you click Save.
              </p>

              {bigFiveKeys.map(k => {
                const value = (editData.big_five && editData.big_five[k] != null)
                  ? editData.big_five[k]
                  : (parsedBigFive && parsedBigFive[k] != null ? parsedBigFive[k] : 50);

                return (
                  <div key={k} className="big-five-profile-row">
                    <div className="big-five-profile-header">
                      <div className="big-five-profile-name">{bigFiveNames[k]}</div>
                      <div className="big-five-profile-score">{value}th percentile, {bigFiveScoreLabel(value)}</div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={value}
                      onChange={e => setBigFiveScore(k, e.target.value)}
                      className="trait-slider"
                    />
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.58rem',fontFamily:"'DM Mono',monospace",color:'var(--ink-4)',letterSpacing:'0.06em',marginTop:'0.25rem'}}>
                      <span>0</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={value}
                        onChange={e => setBigFiveScore(k, e.target.value)}
                        style={{width:'62px',textAlign:'center',border:'1px solid var(--rule)',background:'var(--paper)',color:'var(--ink)',fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',padding:'0.2rem'}}
                      />
                      <span>100</span>
                    </div>
                  </div>
                );
              })}

              <label className="big-five-share-toggle" style={{marginTop:'1rem'}}>
                <div className={`toggle-switch ${editData.big_five_shared ? 'on' : ''}`} />
                <div className="toggle-label">
                  <strong>Share Big Five with recruiters</strong><br />
                  Turn this off to keep the scores private while still saving them to your profile.
                </div>
                <input
                  type="checkbox"
                  checked={!!editData.big_five_shared}
                  onChange={e => setEditData(p => ({...p, big_five_shared: e.target.checked}))}
                  style={{display:'none'}}
                />
              </label>

              <div style={{display:'flex',gap:'0.75rem',marginTop:'1rem'}}>
                <button className="btn-outline" style={{padding:'0.65rem 1rem'}} onClick={() => { setEditing(null); setEditData({}); }}>Cancel</button>
                <button className="btn-primary" style={{padding:'0.65rem 1rem'}} onClick={saveBigFive}>Save Personality Profile</button>
              </div>
            </div>
          ) : parsedBigFive ? (
            <>
              {bigFiveKeys.map(k => (
                <div key={k} className="big-five-profile-row">
                  <div className="big-five-profile-header">
                    <div className="big-five-profile-name">{bigFiveNames[k]}</div>
                    <div className="big-five-profile-score">{parsedBigFive[k]}th percentile</div>
                  </div>
                  <div className="big-five-profile-bar">
                    <div className="big-five-profile-fill" style={{width:`${parsedBigFive[k]}%`}} />
                  </div>
                </div>
              ))}
              <p style={{fontSize:'0.72rem',color:'var(--ink-4)',marginTop:'0.75rem',lineHeight:'1.5'}}>
                Use Edit to update your saved scores or change whether they are shared with recruiters.
              </p>
            </>
          ) : (
            <div className="profile-field-empty" style={{fontSize:'0.85rem',padding:'0.5rem 0'}}>
              No personality data added yet.{' '}
              <a href="https://understandmyself.com" target="_blank" rel="noopener noreferrer" style={{color:'var(--gold)'}}>
                Take the assessment →
              </a>
              <div style={{marginTop:'0.875rem'}}>
                <button className="btn-primary" style={{fontSize:'0.75rem',padding:'0.55rem 1rem'}} onClick={startBigFiveEdit}>
                  Add Personality Scores
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Career Timeline */}
        {parsedCareer.length > 0 && (
          <div className="profile-card full-width">
            <div className="profile-card-header">
              <div className="profile-card-title">Career Timeline</div>
            </div>
            {parsedCareer.filter(e=>e.title||e.company).map((e,i) => (
              <div key={i} style={{display:'flex',gap:'1.5rem',padding:'0.75rem 0',borderBottom:'1px solid var(--rule-lt)'}}>
                <div style={{minWidth:'80px',fontFamily:"'DM Mono',monospace",fontSize:'0.65rem',color:'var(--ink-4)',letterSpacing:'0.06em'}}>
                  {e.years_from}{e.years_from&&'–'}{e.current?'Present':e.years_to}
                </div>
                <div>
                  <div style={{fontWeight:600,color:'var(--ink)',fontSize:'0.875rem'}}>{e.title}</div>
                  <div style={{color:'var(--ink-3)',fontSize:'0.82rem'}}>{e.company}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Achievements */}
        {parsedAchievements.filter(a=>a).length > 0 && (
          <div className="profile-card full-width">
            <div className="profile-card-header">
              <div className="profile-card-title">Key Achievements</div>
            </div>
            {parsedAchievements.filter(a=>a).map((a,i) => (
              <div key={i} style={{padding:'0.625rem 0',borderBottom:'1px solid var(--rule-lt)',fontSize:'0.875rem',color:'var(--ink-3)',paddingLeft:'1.25rem',position:'relative'}}>
                <span style={{position:'absolute',left:0,color:'var(--gold)'}}>—</span>
                {a}
              </div>
            ))}
          </div>
        )}

        {/* Executive Assessment */}
        <div className="profile-card full-width">
          <div className="profile-card-header">
            <div className="profile-card-title">Executive Assessment</div>
            {talentProfile && (talentProfile.score_composite || 0) > 0 && (
              <a href="/talent-match.html" style={{fontFamily:"'DM Mono',monospace",fontSize:'0.58rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--gold)',textDecoration:'none'}}>
                Update Answers →
              </a>
            )}
          </div>

          {(!talentProfile || (talentProfile.score_composite || 0) === 0) ? (
            <div className="assessment-cta">
              <div className="assessment-cta-title">Complete your executive assessment</div>
              <div className="assessment-cta-desc">
                Your profile has no match scores yet. The 24-question assessment covers executive authority,
                technology fluency, change management, and background depth. Completing it surfaces you
                in recruiter match results.
              </div>
              <div style={{display:'flex',gap:'0.875rem',justifyContent:'center',alignItems:'center',flexWrap:'wrap',marginBottom:'1.5rem'}}>
                <a href="/talent-match.html" style={{textDecoration:'none'}}>
                  <button className="btn-primary" style={{fontSize:'0.82rem',padding:'0.75rem 2rem'}}>Start Assessment →</button>
                </a>
                <div style={{fontSize:'0.75rem',color:'var(--ink-4)'}}>Takes ~8 minutes · No resume required</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.875rem'}}>
                {[
                  {label:'Executive Fit',  weight:'40%', desc:'Authority, P&L, strategy'},
                  {label:'Technology',     weight:'20%', desc:'Digital fluency & AI adoption'},
                  {label:'Change Mgmt',    weight:'20%', desc:'Adaptability & crisis leadership'},
                  {label:'Background',     weight:'20%', desc:'Tenure, scope & geography'},
                ].map(s => (
                  <div key={s.label} style={{background:'var(--paper)',border:'1px solid var(--rule)',padding:'0.875rem'}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.58rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--ink-3)',marginBottom:'0.25rem'}}>{s.label}</div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1rem',color:'var(--gold)',marginBottom:'0.2rem'}}>{s.weight}</div>
                    <div style={{fontSize:'0.72rem',color:'var(--ink-4)'}}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="assessment-composite">
                <div className="assessment-composite-score">{talentProfile.score_composite}%</div>
                <div className="assessment-composite-label">Composite Match Score</div>
                {talentProfile.last_answers_updated && (
                  <div style={{fontSize:'0.65rem',color:'var(--ink-4)',marginTop:'0.5rem',fontFamily:"'DM Mono',monospace",letterSpacing:'0.06em'}}>
                    Last updated {fmt(talentProfile.last_answers_updated)}
                  </div>
                )}
              </div>
              <div className="assessment-sub-grid">
                {[
                  {label:'Executive Fit',  key:'score_executive_fit', weight:'40% weight'},
                  {label:'Technology',     key:'score_technology',    weight:'20% weight'},
                  {label:'Change Mgmt',    key:'score_change_mgmt',   weight:'20% weight'},
                  {label:'Background',     key:'score_background',    weight:'20% weight'},
                ].map(s => {
                  const score = talentProfile[s.key] || 0;
                  const fillColor = score >= 80 ? 'var(--gold)' : score >= 60 ? 'var(--ink)' : 'var(--ink-3)';
                  return (
                    <div key={s.key}>
                      <div className="assessment-sub-header">
                        <span className="assessment-sub-name">{s.label}</span>
                        <span className="assessment-sub-score">{score}%</span>
                      </div>
                      <div className="assessment-sub-bar">
                        <div className="assessment-sub-fill" style={{width:`${score}%`,background:fillColor}} />
                      </div>
                      <div className="assessment-sub-weight">{s.weight}</div>
                    </div>
                  );
                })}
              </div>
              {(talentProfile.badge_seasoned_exec || talentProfile.badge_tech_forward || talentProfile.badge_pivot) ? (
                <div className="assessment-badges">
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.58rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--ink-4)',alignSelf:'center',marginRight:'0.25rem'}}>Badges earned</span>
                  {talentProfile.badge_seasoned_exec && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',padding:'0.25rem 0.625rem',border:'1px solid var(--gold-rule)',background:'var(--gold-bg)',color:'var(--gold)'}}>⭐ Seasoned Executive</span>}
                  {talentProfile.badge_tech_forward  && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',padding:'0.25rem 0.625rem',border:'1px solid #b2dfc6',background:'var(--green-bg)',color:'var(--green)'}}>⚡ Tech Forward</span>}
                  {talentProfile.badge_pivot         && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',padding:'0.25rem 0.625rem',border:'1px solid #b0c4d8',background:'#eef2f7',color:'var(--ink-2)'}}>↗ Pivot Candidate</span>}
                </div>
              ) : (
                <div style={{marginTop:'1rem',paddingTop:'1rem',borderTop:'1px solid var(--rule-lt)',fontSize:'0.75rem',color:'var(--ink-4)'}}>
                  No badges earned yet. Badges are awarded for 20+ years total experience with 9+ years in senior roles (Seasoned Executive) and advanced technology adoption scores (Tech Forward).
                </div>
              )}
            </>
          )}
        </div>

        {/* References */}
        <div className="profile-card full-width">
          <div className="profile-card-header">
            <div className="profile-card-title">Professional References</div>
            <span style={{fontSize:'0.7rem',color:'var(--ink-4)',fontFamily:"'DM Mono',monospace",letterSpacing:'0.08em',textTransform:'uppercase'}}>
              Strengthen your profile
            </span>
          </div>
          <ReferenceStatus email={user.email} showToast={showToast} />
        </div>

      {/* Interest History */}
        <div className="profile-card full-width">
          <div className="profile-card-header">
            <div className="profile-card-title">Searches You've Expressed Interest In</div>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',color:'var(--ink-4)',letterSpacing:'0.1em'}}>{interests.length} TOTAL</span>
          </div>
          {interests.length === 0 ? (
            <div className="profile-field-empty">No interest signals yet. Browse opportunities and click "Register Confidential Interest" on any search.</div>
          ) : (
            <div className="interest-list">
              {interests.map(i => {
                const job = jobs.find(j => j.id === i.job_id);
                return (
                  <div key={i.id} className="interest-item">
                    <div>
                      <div className="interest-item-title">{job?.title || 'Search no longer active'}</div>
                      <div className="interest-item-firm">{job?.firm_name || '—'} · {job?.industry || '—'} · {job?.salary_display || '—'}</div>
                    </div>
                    <div className="interest-item-date">{fmt(i.created_at)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Matching Jobs (bidirectional match system) */}
        <CandidateMatchSection
          userEmail={user.email}
          profile={profile}
          showToast={showToast}
        />

        {/* Activity feed — candidate-facing */}
        <div className="profile-card full-width" style={{padding:0,overflow:'hidden'}}>
          <div className="profile-card-header" style={{padding:'1rem 1.5rem 0.75rem'}}>
            <div className="profile-card-title">Platform Activity</div>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',color:'var(--ink-4)',letterSpacing:'0.1em'}}>VERIFIED ONLY</span>
          </div>
          <ActivityFeed location="candidate" limit={4} />
        </div>

        {/* Executive preferences — advanced matching */}
        <CandidatePreferencesSection userEmail={user.email} showToast={showToast} />

      </div>
    </div>
  );
}


// ── CANDIDATE MATCH SECTION ───────────────────────────────────────────────────
function CandidateMatchSection({ userEmail, profile, showToast }) {
  const [matches, setMatches]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [actionLoad, setActLoad] = useState({});
  const [tab, setTab]           = useState('all'); // 'all' | 'interested' | 'mutual'

  useEffect(() => {
    if (!userEmail) return;
    loadMatches();
  }, [userEmail]);

  async function loadMatches() {
    setLoading(true);
    const { data } = await sb.from('fed_matches')
      .select('*, fed_jobs(id,title,firm_name,firm_code,industry,location,salary_display,type,salary_min,salary_max,status)')
      .eq('candidate_email', userEmail.toLowerCase())
      .not('status', 'in', '("candidate_hidden","expired")')
      .order('match_score', { ascending: false });
    setMatches(data || []);
    setLoading(false);
  }

  async function doAction(action, matchId, jobId) {
    const key = matchId || jobId;
    setActLoad(p => ({...p, [key]: true}));
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { showToast('Please sign in.'); return; }
      const resp = await fetch('/api/match-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, match_id: matchId || undefined, job_id: jobId || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) { showToast(data.error || 'Action failed.'); return; }

      if (data.status) {
        const updatedMatchId = data.match_id || matchId;
        setMatches(prev => {
          if (action === 'candidate_interest' && !matchId) {
            // New match record created — reload
            loadMatches();
            return prev;
          }
          return prev.map(m =>
            (m.id === updatedMatchId || (jobId && m.job_id === jobId && m.candidate_email === userEmail.toLowerCase()))
              ? { ...m, status: data.status }
              : m
          );
        });

        const msgs = {
          candidate_interested: '✓ Interest sent. The search firm will be notified.',
          mutual_interest: '✓ Mutual interest! Fredheim will facilitate an introduction.',
          candidate_declined: 'Interest declined.',
          candidate_hidden: 'Match hidden from your view.',
        };
        showToast(msgs[data.status] || '✓ Done.');
      }
    } catch(e) { showToast('Error. Please try again.'); }
    setActLoad(p => ({...p, [key]: false}));
  }

  // ── MATCH CONFIDENCE GATING ───────────────────────────────────────────────
  // Stretch and low-alignment matches present a review modal before the
  // candidate can express interest. The modal does NOT block — it surfaces
  // the gaps and lets the candidate proceed if they choose. Soft friction
  // protects platform signal quality without hard-gating exceptional fits.
  const [stretchModal, setStretchModal] = useState(null); // { match, job, confidence }
  function handleCandidateInterest(match, job) {
    const reasons = typeof match.match_reasons === 'string'
      ? JSON.parse(match.match_reasons) : (match.match_reasons || {});
    const conf = getMatchConfidence(match.match_score, reasons, []);
    if (conf.shouldWarn) {
      setStretchModal({ match, job, confidence: conf });
    } else {
      doAction('candidate_interest', match.id || null, job.id);
    }
  }

  // Filter by tab
  const tabMatches = tab === 'interested'
    ? matches.filter(m => ['candidate_interested', 'mutual_interest'].includes(m.status))
    : tab === 'mutual'
    ? matches.filter(m => m.status === 'mutual_interest')
    : tab === 'received'
    ? matches.filter(m => m.status === 'recruiter_interested')
    : matches;

  const counts = {
    all:       matches.length,
    received:  matches.filter(m => m.status === 'recruiter_interested').length,
    interested: matches.filter(m => ['candidate_interested','mutual_interest'].includes(m.status)).length,
    mutual:    matches.filter(m => m.status === 'mutual_interest').length,
  };

  function scoreColor(s) { return s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--gold)' : 'var(--ink-3)'; }
  function fmt(ts) { if (!ts) return ''; return new Date(ts).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'2-digit'}); }

  return (
    <div className="profile-card full-width">
      <div className="profile-card-header">
        <div className="profile-card-title">Matching Job Posts</div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',color:'var(--ink-4)',letterSpacing:'0.1em'}}>{counts.all} MATCHES</span>
      </div>

      {/* Compensation positioning advisory */}
      <CandidateCompPositioning profile={profile} matches={matches} jobs={jobs} />

      {/* Match stats */}
      {counts.all > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1px',background:'var(--rule)',marginBottom:'1.25rem'}}>
          {[
            { label:'Matching Jobs',       val: counts.all,        tab:'all',        cls:'' },
            { label:'Firm Interest Recv.', val: counts.received,   tab:'received',   cls: counts.received>0 ? 'gold' : '' },
            { label:'Your Interest Sent',  val: counts.interested, tab:'interested', cls: counts.interested>0 ? 'gold' : '' },
            { label:'Mutual Interest',     val: counts.mutual,     tab:'mutual',     cls: counts.mutual>0 ? 'green' : '' },
          ].map(s => (
            <div key={s.tab} className="match-stat" style={{cursor:'pointer',borderBottom: tab===s.tab ? '2px solid var(--ink)' : '2px solid transparent'}}
                 onClick={() => setTab(s.tab)}>
              <div className={`match-stat-num ${s.cls}`} style={{fontSize:'1.25rem'}}>{s.val}</div>
              <div className="match-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:'2rem',color:'var(--ink-4)'}}><span className="spinner"/>Loading matches…</div>
      ) : matches.length === 0 ? (
        <div className="profile-field-empty">
          No matching job posts yet. Matches are computed when search firms post new searches and will appear here automatically.
        </div>
      ) : tabMatches.length === 0 ? (
        <div className="profile-field-empty">No matches in this category yet.</div>
      ) : (
        <div>
          {tabMatches.map(match => {
            const job = match.fed_jobs;
            if (!job || job.status !== 'active') return null;
            const key    = match.id;
            const isBusy = actionLoad[key] || actionLoad[job.id];

            const reasons = typeof match.match_reasons === 'string'
              ? JSON.parse(match.match_reasons) : (match.match_reasons || {});

            const isMutual   = match.status === 'mutual_interest';
            const isReceived = match.status === 'recruiter_interested';

            return (
              <div key={match.id} className={`job-match-card ${isMutual ? 'mutual' : ''} ${isReceived ? 'recruiter-interested' : ''}`}>
                <div className="job-match-left">
                  <div style={{display:'flex',alignItems:'center',gap:'0.625rem',marginBottom:'0.375rem'}}>
                    <div style={{width:28,height:28,background:'var(--ink)',color:'var(--paper)',fontFamily:"'DM Mono',monospace",fontSize:'0.55rem',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {job.firm_code || 'FH'}
                    </div>
                    <div>
                      <div className="job-match-title">{job.title}</div>
                      <div className="job-match-firm">
                        {isMutual ? job.firm_name : 'Confidential Search Firm'} · {job.industry}
                      </div>
                    </div>
                  </div>
                  <div className="job-match-details">
                    {job.location} · {job.type} · {job.salary_display}
                  </div>
                  {/* Match Confidence — replaces raw FIT% badge as primary signal */}
                  <div style={{marginTop:'0.625rem',marginBottom:'0.375rem'}}>
                    <MatchConfidenceBadge
                      score={match.match_score}
                      reasons={reasons}
                      gaps={[]}
                      compact={isMutual || isReceived}
                    />
                  </div>
                  {/* Secondary alignment tags — kept compact, not lead signal */}
                  <div className="match-reason-tags" style={{marginTop:'0.25rem'}}>
                    {reasons.scope    === true && <span className="match-reason-tag match">Scope</span>}
                    {reasons.industry === true && <span className="match-reason-tag match">Industry</span>}
                    {reasons.function === true && <span className="match-reason-tag match">Function</span>}
                    {reasons.salary   === true && <span className="match-reason-tag match">Salary</span>}
                    {reasons.location === true && <span className="match-reason-tag match">Location</span>}
                    {reasons.work_arrangement === true && <span className="match-reason-tag match">Arrangement</span>}
                    {reasons.work_arrangement === 'partial' && <span className="match-reason-tag partial">Arrangement ~</span>}
                    {reasons.pnl     === true && <span className="match-reason-tag match">P&amp;L</span>}
                    {reasons.mandate === true && <span className="match-reason-tag match">Mandate</span>}
                    {reasons.complexity === true && <span className="match-reason-tag match">Complexity</span>}
                    {reasons.commercial_fit === true && <span className="match-reason-tag match">Commercial fit</span>}
                    {reasons.commercial_fit === 'partial' && <span className="match-reason-tag partial">Commercial ~</span>}
                    {reasons.industrial_translator === true && <span className="match-reason-tag match" style={{background:'#e3f2fd',borderColor:'rgba(21,101,192,0.3)',color:'#0d3f7a'}}>Industrial translator</span>}
                    {reasons.tech    === true && <span className="match-reason-tag match">Technical</span>}
                    {reasons.salary  === false && <span className="match-reason-tag" style={{color:'var(--red,#c0392b)'}}>Salary gap</span>}
                  </div>
                  {match.explanation && (
                    <div className="match-explanation">{match.explanation}</div>
                  )}
                  <CompAlignmentBadge
                    alignment={computeCompAlignment({
                      ...profile,
                      candidate_preferences: profile?.candidate_preferences,
                    }, job, [])}
                    isRecruiter={false}
                    compact={true}
                  />
                  {/* Status badge */}
                  {isMutual && <span className="match-status-badge mutual">⬤ Mutual Interest</span>}
                  {isReceived && <span className="match-status-badge recruiter-interested">Firm Interested in You</span>}
                  {match.status === 'candidate_interested' && <span className="match-status-badge candidate-interested">Interest Sent</span>}
                  {match.status === 'candidate_declined' && <span className="match-status-badge declined">Declined</span>}
                  {match.status === 'recruiter_withdrawn' && <span className="match-status-badge declined">Firm Withdrew</span>}

                  {/* Action buttons — gated by match confidence */}
                  {match.status === 'matched' && (() => {
                    const conf = getMatchConfidence(match.match_score, reasons, []);
                    const label =
                      conf.level === 'high'     ? 'Confirm Interest' :
                      conf.level === 'moderate' ? 'Indicate Interest' :
                      conf.level === 'stretch'  ? 'Indicate Interest — Stretch' :
                                                  'Indicate Interest — Low Alignment';
                    return (
                      <button
                        className={`match-interest-btn ${conf.level}`}
                        style={{fontSize:'0.72rem',padding:'0.4rem 1rem',whiteSpace:'nowrap'}}
                        onClick={() => handleCandidateInterest(match, job)}
                        disabled={isBusy}>
                        {isBusy ? '…' : label}
                      </button>
                    );
                  })()}
                  {isReceived && (
                    <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap',justifyContent:'flex-end'}}>
                      <button className="btn-primary" style={{fontSize:'0.72rem',padding:'0.4rem 1rem',whiteSpace:'nowrap'}}
                        onClick={() => doAction('candidate_interest', match.id, job.id)} disabled={isBusy}>
                        {isBusy ? '…' : 'Accept Interest'}
                      </button>
                      <button className="admin-action-btn" style={{fontSize:'0.65rem'}}
                        onClick={() => doAction('candidate_decline', match.id)} disabled={isBusy}>
                        {isBusy ? '…' : 'Decline'}
                      </button>
                    </div>
                  )}
                  {isMutual && (
                    <div style={{fontSize:'0.72rem',color:'var(--ink-4)',textAlign:'right',maxWidth:140}}>
                      Fredheim will facilitate your introduction.
                    </div>
                  )}
                  {/* Hide option */}
                  {!['candidate_hidden','mutual_interest'].includes(match.status) && (
                    <button onClick={() => doAction('candidate_hide', match.id)} disabled={isBusy}
                      style={{background:'none',border:'none',fontSize:'0.65rem',color:'var(--ink-4)',cursor:'pointer',padding:'0',textDecoration:'underline'}}>
                      Hide
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stretch / low-alignment review modal — soft friction before
          expressing interest. Candidate may always proceed. */}
      {stretchModal && (
        <StretchOpportunityModal
          job={stretchModal.job}
          confidence={stretchModal.confidence}
          onCancel={() => setStretchModal(null)}
          onProceed={() => {
            doAction('candidate_interest', stretchModal.match.id || null, stretchModal.job.id);
            setStretchModal(null);
          }}
        />
      )}
    </div>
  );
}

// ── CANDIDATE PREFERENCES SECTION ────────────────────────────────────────────
function CandidatePreferencesSection({ userEmail, showToast }) {
  const [prefs, setPrefs]   = useState({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab]       = useState('work');

  useEffect(() => {
    if (!userEmail) return;
    sb.from('fed_profiles').select('candidate_preferences')
      .eq('email', userEmail).maybeSingle()
      .then(({ data }) => {
        if (data?.candidate_preferences) {
          const p = typeof data.candidate_preferences === 'string'
            ? JSON.parse(data.candidate_preferences) : data.candidate_preferences;
          setPrefs(p || {});
        }
      });
  }, [userEmail]);

  function set(path, value) {
    setPrefs(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...(cur[parts[i]] || {}) };
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }

  function toggleArray(key, val) {
    const arr = prefs[key] || [];
    set(key, arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  async function save() {
    setSaving(true);
    await sb.from('fed_profiles').update({ candidate_preferences: prefs }).eq('email', userEmail);
    showToast('✓ Preferences saved.');
    setSaving(false);
  }

  const WORK_OPTS = Object.entries(WORK_ARRANGEMENTS);
  const MANDATE_OPTS = Object.entries(MANDATE_TYPES);
  const CO_TYPE_OPTS = Object.entries(COMPANY_TYPES);
  const TECH_OPTS = Object.entries(TECH_SKILLS);
  const REPORTS_TO_OPTS = ['CEO','COO','President','Board','EVP','SVP','Division Head'];

  const TABS = [['work','Work & Location'],['comp','Compensation'],['authority','Authority'],['mandate','Mandate & Company'],['tech','Technical'],['nonneg','Non-Negotiables'],['privacy','Privacy']];

  return (
    <div className="profile-card full-width">
      <div className="profile-card-header">
        <div className="profile-card-title">Executive Preferences</div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',color:'var(--ink-4)',letterSpacing:'0.1em'}}>
          Used for matching. Private — never shared without permission.
        </span>
      </div>

      {/* Tab nav */}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--rule)',marginBottom:'1.5rem',flexWrap:'wrap'}}>
        {TABS.map(([v,l]) => (
          <button key={v} className={`match-tab ${tab===v?'active':''}`} onClick={()=>setTab(v)}
            style={{fontSize:'0.58rem',padding:'0.6rem 0.875rem'}}>{l}</button>
        ))}
      </div>

      {/* Work & Location */}
      {tab === 'work' && (
        <div>
          <div className="prefs-section">
            <div className="prefs-section-title">Work Arrangement Preference</div>
            <div className="prefs-toggle-group">
              {WORK_OPTS.map(([v,l]) => (
                <button key={v} className={`prefs-toggle ${prefs.work_arrangement===v?'selected':''}`}
                  onClick={()=>set('work_arrangement', prefs.work_arrangement===v ? null : v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="prefs-section">
            <div className="prefs-grid-3">
              <div className="prefs-field">
                <div className="prefs-label">Preferred office days/week</div>
                <input className="prefs-input" type="number" min={0} max={5} placeholder="e.g. 2"
                  value={prefs.office_days_per_week ?? ''} onChange={e=>set('office_days_per_week',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Max travel %</div>
                <input className="prefs-input" type="number" min={0} max={100} placeholder="e.g. 25"
                  value={prefs.travel_pct_max ?? ''} onChange={e=>set('travel_pct_max',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Open to relocation?</div>
                <div style={{display:'flex',gap:'0.5rem',marginTop:'0.25rem'}}>
                  {['Yes','No','Negotiable'].map(v => (
                    <button key={v} className={`prefs-toggle ${
                      v==='Yes'&&prefs.relocation_willing===true?'selected':
                      v==='No'&&prefs.relocation_willing===false?'selected':
                      v==='Negotiable'&&prefs.relocation_willing===null?'soft-selected':''}`}
                      onClick={()=>set('relocation_willing',v==='Yes'?true:v==='No'?false:null)}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compensation */}
      {tab === 'comp' && (
        <div>
          <div className="prefs-section">
            <div className="prefs-section-title">Base Compensation</div>
            <div className="prefs-grid-2">
              <div className="prefs-field">
                <div className="prefs-label">Minimum base salary ($) — floor</div>
                <input className="prefs-input" type="number" placeholder="e.g. 250000"
                  value={prefs.comp_base_min ?? ''} onChange={e=>set('comp_base_min',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Target base salary ($)</div>
                <input className="prefs-input" type="number" placeholder="e.g. 300000"
                  value={prefs.comp_target_base ?? ''} onChange={e=>set('comp_target_base',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Minimum total comp ($)</div>
                <input className="prefs-input" type="number" placeholder="e.g. 320000"
                  value={prefs.comp_total_min ?? ''} onChange={e=>set('comp_total_min',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Target total comp ($)</div>
                <input className="prefs-input" type="number" placeholder="e.g. 400000"
                  value={prefs.comp_target_total ?? ''} onChange={e=>set('comp_target_total',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Target bonus %</div>
                <input className="prefs-input" type="number" min={0} placeholder="e.g. 20"
                  value={prefs.comp_bonus_pct_target ?? ''} onChange={e=>set('comp_bonus_pct_target',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Min 401k match %</div>
                <input className="prefs-input" type="number" min={0} max={20} placeholder="e.g. 4"
                  value={prefs.comp_401k_match_min ?? ''} onChange={e=>set('comp_401k_match_min',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Min PTO days</div>
                <input className="prefs-input" type="number" min={0} placeholder="e.g. 20"
                  value={prefs.comp_pto_min ?? ''} onChange={e=>set('comp_pto_min',e.target.value?parseInt(e.target.value):null)} />
              </div>
            </div>
          </div>
          <div className="prefs-section">
            <div className="prefs-section-title">Flexibility &amp; Upside</div>
            <div className="prefs-grid-2">
              <div className="prefs-field">
                <div className="prefs-label">Compensation flexibility</div>
                <div className="prefs-toggle-group">
                  {[['low','Low'],['moderate','Moderate'],['high','High']].map(([v,l])=>(
                    <button key={v} className={`prefs-toggle ${prefs.compensation_flexibility===v?'selected':''}`}
                      onClick={()=>set('compensation_flexibility',prefs.compensation_flexibility===v?null:v)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <label className="prefs-check-item" style={{marginTop:'0.75rem'}}>
              <input type="checkbox" checked={!!prefs.willing_lower_base_higher_upside} onChange={e=>set('willing_lower_base_higher_upside',e.target.checked)} />
              <span style={{fontSize:'0.82rem'}}>Willing to accept lower base for higher equity or upside</span>
            </label>
          </div>
          <div className="prefs-section">
            <div className="prefs-section-title">Value Factors (improve alignment accuracy)</div>
            <div className="prefs-grid-2">
              <div className="prefs-field">
                <div className="prefs-label">Years of relevant experience</div>
                <input className="prefs-input" type="number" min={0} placeholder="e.g. 18"
                  value={prefs.years_relevant_experience ?? ''} onChange={e=>set('years_relevant_experience',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Largest team managed (headcount)</div>
                <input className="prefs-input" type="number" min={0} placeholder="e.g. 45"
                  value={prefs.team_size_managed ?? ''} onChange={e=>set('team_size_managed',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Revenue responsibility ($USD)</div>
                <input className="prefs-input" type="number" min={0} placeholder="e.g. 50000000"
                  value={prefs.revenue_responsibility_usd ?? ''} onChange={e=>set('revenue_responsibility_usd',e.target.value?parseInt(e.target.value):null)} />
              </div>
            </div>
            <div style={{fontSize:'0.72rem',color:'var(--ink-4)',marginTop:'0.625rem',lineHeight:'1.5'}}>
              These fields help compute your compensation positioning more accurately. They are not shown to recruiters without your permission and do not affect your match score independently.
            </div>
          </div>
          <div className="prefs-section">
            <div className="prefs-section-title">Benefit Preferences</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'0.375rem'}}>
              {[
                {k:'comp_equity',      l:'Equity / profit participation'},
                {k:'comp_ltip',        l:'Long-term incentive plan'},
                {k:'comp_commission',  l:'Commission component expected'},
                {k:'comp_sign_on',     l:'Sign-on bonus'},
                {k:'comp_car_allowance',l:'Car allowance'},
                {k:'comp_severance_required',l:'Severance / change-of-control protection'},
              ].map(f => (
                <label key={f.k} className="prefs-check-item">
                  <input type="checkbox" checked={!!prefs[f.k]} onChange={e=>set(f.k,e.target.checked)} />
                  <span>{f.l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Authority */}
      {tab === 'authority' && (
        <div>
          <div className="prefs-section">
            <div className="prefs-section-title">Reporting Line</div>
            <div className="prefs-toggle-group">
              {REPORTS_TO_OPTS.map(r => (
                <button key={r}
                  className={`prefs-toggle ${(prefs.reports_to||[]).includes(r)?'selected':''}`}
                  onClick={()=>toggleArray('reports_to',r)}>{r}</button>
              ))}
            </div>
          </div>
          <div className="prefs-section">
            <div className="prefs-section-title">Authority Requirements</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'0.375rem'}}>
              {[
                {k:'authority_pnl',       l:'P&L responsibility'},
                {k:'authority_budget',     l:'Budget authority'},
                {k:'authority_hiring',     l:'Hiring authority'},
                {k:'authority_pricing',    l:'Pricing authority'},
                {k:'authority_contracts',  l:'Contract signing authority'},
                {k:'authority_board',      l:'Board exposure'},
                {k:'authority_exco',       l:'Executive committee seat'},
              ].map(f => (
                <label key={f.k} className="prefs-check-item">
                  <input type="checkbox" checked={!!prefs[f.k]} onChange={e=>set(f.k,e.target.checked)} />
                  <span>{f.l}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="prefs-section">
            <div className="prefs-grid-2">
              <div className="prefs-field">
                <div className="prefs-label">Minimum direct reports</div>
                <input className="prefs-input" type="number" min={0} placeholder="e.g. 5"
                  value={prefs.direct_reports_min ?? ''} onChange={e=>set('direct_reports_min',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Decision-making autonomy</div>
                <select className="prefs-select" value={prefs.autonomy_level||''} onChange={e=>set('autonomy_level',e.target.value||null)}>
                  <option value="">Any</option>
                  <option value="high">High — I run it</option>
                  <option value="medium">Medium — collaborative</option>
                  <option value="low">Lower — structured reporting</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandate & Company */}
      {tab === 'mandate' && (
        <div>
          <div className="prefs-section">
            <div className="prefs-section-title">Role Mandate Types I Prefer</div>
            <div className="prefs-toggle-group">
              {MANDATE_OPTS.map(([v,l]) => (
                <button key={v} className={`prefs-toggle ${(prefs.mandate_types||[]).includes(v)?'selected':''}`}
                  onClick={()=>toggleArray('mandate_types',v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="prefs-section">
            <div className="prefs-section-title">Company Types I'd Consider</div>
            <div className="prefs-toggle-group">
              {CO_TYPE_OPTS.map(([v,l]) => (
                <button key={v} className={`prefs-toggle ${(prefs.company_types||[]).includes(v)?'selected':
                  (prefs.company_types_excluded||[]).includes(v)?'prefs-toggle excluded':''}`}
                  style={(prefs.company_types_excluded||[]).includes(v)?{borderColor:'#c0392b',color:'#c0392b',background:'#fff8f0'}:{}}
                  onClick={()=>toggleArray('company_types',v)}>{l}</button>
              ))}
            </div>
            <div style={{marginTop:'0.75rem'}}>
              <div className="prefs-label" style={{marginBottom:'0.375rem'}}>Company types to exclude (non-negotiable)</div>
              <div className="prefs-toggle-group">
                {CO_TYPE_OPTS.map(([v,l]) => (
                  <button key={v}
                    className={`prefs-toggle ${(prefs.company_types_excluded||[]).includes(v)?'selected':''}`}
                    style={(prefs.company_types_excluded||[]).includes(v)?{background:'#c0392b',color:'#fff',borderColor:'#c0392b'}:{}}
                    onClick={()=>toggleArray('company_types_excluded',v)}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Technical */}
      {tab === 'tech' && (
        <div>
          <div className="prefs-section">
            <div className="prefs-section-title">Technical / Industry Experience</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'0.375rem'}}>
              {TECH_OPTS.map(([v,l]) => (
                <label key={v} className="prefs-check-item">
                  <input type="checkbox"
                    checked={(prefs.tech_experience||[]).includes(v)}
                    onChange={e=>{
                      const cur = prefs.tech_experience||[];
                      set('tech_experience', e.target.checked ? [...cur,v] : cur.filter(x=>x!==v));
                    }} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Non-Negotiables */}
      {tab === 'nonneg' && (
        <div>
          <div className="prefs-non-neg-box" style={{marginBottom:'1.25rem'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.1em',color:'var(--gold)',marginBottom:'0.5rem'}}>
              NON-NEGOTIABLES
            </div>
            <div style={{fontSize:'0.8rem',color:'var(--ink-2)',lineHeight:'1.6'}}>
              These are hard requirements. Any job posting that fails these criteria will be automatically excluded from your matches — even if the score is otherwise high. They are never shown to recruiters.
            </div>
          </div>
          <div className="prefs-section">
            <div className="prefs-grid-2">
              <div className="prefs-field">
                <div className="prefs-label">Minimum base salary ($) — hard floor</div>
                <input className="prefs-input" type="number" placeholder="e.g. 250000"
                  value={prefs.non_negotiables?.base_min ?? ''}
                  onChange={e=>set('non_negotiables.base_min',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Minimum total comp ($)</div>
                <input className="prefs-input" type="number" placeholder="e.g. 320000"
                  value={prefs.non_negotiables?.total_comp_min ?? ''}
                  onChange={e=>set('non_negotiables.total_comp_min',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Maximum travel % I'll accept</div>
                <input className="prefs-input" type="number" min={0} max={100} placeholder="e.g. 30"
                  value={prefs.non_negotiables?.travel_pct_max ?? ''}
                  onChange={e=>set('non_negotiables.travel_pct_max',e.target.value?parseInt(e.target.value):null)} />
              </div>
              <div className="prefs-field">
                <div className="prefs-label">Work arrangement — hard requirement</div>
                <select className="prefs-select"
                  value={prefs.non_negotiables?.work_arrangement || ''}
                  onChange={e=>set('non_negotiables.work_arrangement',e.target.value||null)}>
                  <option value="">No hard requirement</option>
                  {WORK_OPTS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="prefs-section">
            <div className="prefs-section-title">Hard Requirement Flags</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'0.375rem'}}>
              {[
                {k:'pnl_required',         l:'Must include P&L responsibility'},
                {k:'reports_to_ceo_board', l:'Must report to CEO or Board'},
                {k:'relocation',           l:'I will not relocate',
                  val: prefs.non_negotiables?.relocation === false,
                  onClick: ()=>set('non_negotiables.relocation', prefs.non_negotiables?.relocation===false ? null : false)},
              ].map(f => (
                <label key={f.k} className="prefs-check-item non-neg">
                  <input type="checkbox"
                    checked={f.val !== undefined ? f.val : !!prefs.non_negotiables?.[f.k]}
                    onChange={f.onClick ? f.onClick : e=>set(`non_negotiables.${f.k}`,e.target.checked||null)} />
                  <span>{f.l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Privacy */}
      {tab === 'privacy' && (
        <div>
          <div className="prefs-section">
            <div className="prefs-section-title">Profile Visibility Controls</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'0.375rem',marginBottom:'1rem'}}>
              {[
                {k:'privacy.hide_name',              l:'Hide my name from recruiters until I accept engagement'},
                {k:'privacy.hide_employer',           l:'Hide my current employer'},
                {k:'privacy.hide_location',           l:'Hide my exact location'},
                {k:'privacy.show_region_only',        l:'Show region only, not city'},
                {k:'privacy.anonymous_until_accepted',l:'Fully anonymous until I accept engagement'},
              ].map(f => (
                <label key={f.k} className="prefs-check-item">
                  <input type="checkbox"
                    checked={!!prefs.privacy?.[f.k.split('.')[1]]}
                    onChange={e=>set(f.k,e.target.checked)} />
                  <span>{f.l}</span>
                </label>
              ))}
            </div>
            <div style={{fontSize:'0.78rem',color:'var(--ink-4)',lineHeight:'1.6',padding:'0.875rem 1rem',background:'var(--paper-2)',border:'1px solid var(--rule)'}}>
              Privacy settings apply to all recruiter-facing match cards. Your name and employer are always visible to Fredheim admin. Mutual interest does not automatically reveal your identity — you control all disclosure.
            </div>
          </div>
        </div>
      )}

      <div className="prefs-save-strip">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

// ── JOB REQUIREMENTS FIELDS (used inside RecruiterModal) ─────────────────────
function JobRequirementsFields({ reqs, onChange }) {
  function set(k, v) { onChange({ ...reqs, [k]: v }); }
  function toggleArr(k, v) {
    const a = reqs[k] || [];
    set(k, a.includes(v) ? a.filter(x => x !== v) : [...a, v]);
  }
  const WORK_OPTS    = Object.entries(WORK_ARRANGEMENTS);
  const MANDATE_OPTS = Object.entries(MANDATE_TYPES);
  const CO_TYPE_OPTS = Object.entries(COMPANY_TYPES);
  const TECH_OPTS    = Object.entries(TECH_SKILLS);

  return (
    <div>
      {/* Work arrangement */}
      <div className="jreq-section">
        <div className="jreq-section-title">Work Arrangement</div>
        <div className="prefs-toggle-group" style={{marginBottom:'0.875rem'}}>
          {WORK_OPTS.map(([v,l]) => (
            <button key={v} className={`prefs-toggle ${reqs.work_arrangement===v?'selected':''}`}
              onClick={()=>set('work_arrangement', reqs.work_arrangement===v ? null : v)}>{l}</button>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.625rem 1rem'}}>
          <div className="prefs-field">
            <div className="prefs-label">Travel required %</div>
            <input className="prefs-input" type="number" min={0} max={100} placeholder="e.g. 20"
              value={reqs.travel_pct??''} onChange={e=>set('travel_pct',e.target.value?parseInt(e.target.value):null)} />
          </div>
          <div className="prefs-field">
            <div className="prefs-label">Relocation required?</div>
            <div style={{display:'flex',gap:'0.375rem',marginTop:'0.25rem'}}>
              {['Yes','No'].map(v=>(
                <button key={v} className={`prefs-toggle ${
                  v==='Yes'&&reqs.relocation_required?'selected':
                  v==='No'&&reqs.relocation_required===false?'selected':''}`}
                  onClick={()=>set('relocation_required',v==='Yes')}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="prefs-field">
            <div className="prefs-label">Relocation assistance?</div>
            <div style={{display:'flex',gap:'0.375rem',marginTop:'0.25rem'}}>
              {['Yes','No'].map(v=>(
                <button key={v} className={`prefs-toggle ${reqs.relocation_assistance===(v==='Yes')?'selected':''}`}
                  onClick={()=>set('relocation_assistance',v==='Yes')}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compensation detail */}
      <div className="jreq-section">
        <div className="jreq-section-title">Compensation Details</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.625rem 1rem',marginBottom:'0.75rem'}}>
          <div className="prefs-field">
            <div className="prefs-label">Base min ($)</div>
            <input className="prefs-input" type="number" placeholder="220000"
              value={reqs.comp_base_min??''} onChange={e=>set('comp_base_min',e.target.value?parseInt(e.target.value):null)} />
          </div>
          <div className="prefs-field">
            <div className="prefs-label">Base max ($)</div>
            <input className="prefs-input" type="number" placeholder="280000"
              value={reqs.comp_base_max??''} onChange={e=>set('comp_base_max',e.target.value?parseInt(e.target.value):null)} />
          </div>
          <div className="prefs-field">
            <div className="prefs-label">Total comp max ($)</div>
            <input className="prefs-input" type="number" placeholder="400000"
              value={reqs.comp_total_max??''} onChange={e=>set('comp_total_max',e.target.value?parseInt(e.target.value):null)} />
          </div>
          <div className="prefs-field">
            <div className="prefs-label">Target bonus %</div>
            <input className="prefs-input" type="number" placeholder="20"
              value={reqs.comp_bonus_pct??''} onChange={e=>set('comp_bonus_pct',e.target.value?parseInt(e.target.value):null)} />
          </div>
          <div className="prefs-field">
            <div className="prefs-label">401k match %</div>
            <input className="prefs-input" type="number" placeholder="4"
              value={reqs.comp_401k_match_pct??''} onChange={e=>set('comp_401k_match_pct',e.target.value?parseInt(e.target.value):null)} />
          </div>
          <div className="prefs-field">
            <div className="prefs-label">PTO days</div>
            <input className="prefs-input" type="number" placeholder="20"
              value={reqs.comp_pto_days??''} onChange={e=>set('comp_pto_days',e.target.value?parseInt(e.target.value):null)} />
          </div>
          <div className="prefs-field">
            <div className="prefs-label">Revenue responsibility ($)</div>
            <input className="prefs-input" type="number" placeholder="e.g. 50000000"
              value={reqs.revenue_responsibility??''} onChange={e=>set('revenue_responsibility',e.target.value?parseInt(e.target.value):null)} />
          </div>
        </div>
        <div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
          {[{k:'comp_equity',l:'Equity available'},{k:'comp_ltip',l:'LTIP'},{k:'comp_car_allowance',l:'Car allowance'},{k:'comp_sign_on',l:'Sign-on bonus'}].map(f=>(
            <label key={f.k} className="prefs-check-item">
              <input type="checkbox" checked={!!reqs[f.k]} onChange={e=>set(f.k,e.target.checked)} />
              <span style={{fontSize:'0.8rem'}}>{f.l}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Authority */}
      <div className="jreq-section">
        <div className="jreq-section-title">Role Authority</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'0.375rem',marginBottom:'0.75rem'}}>
          {[
            {k:'pnl_responsibility',l:'P&L responsibility'},
            {k:'budget_authority',  l:'Budget authority'},
            {k:'hiring_authority',  l:'Hiring authority'},
            {k:'pricing_authority', l:'Pricing authority'},
            {k:'contract_authority',l:'Contract signing authority'},
            {k:'board_exposure',    l:'Board exposure'},
            {k:'exco_seat',         l:'Executive committee seat'},
          ].map(f=>(
            <label key={f.k} className="prefs-check-item">
              <input type="checkbox" checked={!!reqs[f.k]} onChange={e=>set(f.k,e.target.checked)} />
              <span style={{fontSize:'0.8rem'}}>{f.l}</span>
            </label>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.625rem'}}>
          <div className="prefs-field">
            <div className="prefs-label">Reports to</div>
            <input className="prefs-input" placeholder="e.g. CEO"
              value={reqs.reports_to||''} onChange={e=>set('reports_to',e.target.value||null)} />
          </div>
          <div className="prefs-field">
            <div className="prefs-label">Direct reports</div>
            <input className="prefs-input" type="number" min={0} placeholder="e.g. 8"
              value={reqs.direct_reports??''} onChange={e=>set('direct_reports',e.target.value?parseInt(e.target.value):null)} />
          </div>
        </div>
      </div>

      {/* Mandate & Company */}
      <div className="jreq-section">
        <div className="jreq-section-title">Role Mandate</div>
        <div className="prefs-toggle-group" style={{marginBottom:'0.875rem'}}>
          {MANDATE_OPTS.map(([v,l]) => (
            <button key={v} className={`prefs-toggle ${reqs.mandate===v?'selected':''}`}
              onClick={()=>set('mandate',reqs.mandate===v?null:v)}>{l}</button>
          ))}
        </div>
        <div className="prefs-label" style={{marginBottom:'0.375rem'}}>Company Type</div>
        <div className="prefs-toggle-group">
          {CO_TYPE_OPTS.map(([v,l]) => (
            <button key={v} className={`prefs-toggle ${reqs.company_type===v?'selected':''}`}
              onClick={()=>set('company_type',reqs.company_type===v?null:v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Technical */}
      <div className="jreq-section">
        <div className="jreq-section-title">Technical Experience Required</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'0.375rem',marginBottom:'0.625rem'}}>
          {TECH_OPTS.map(([v,l]) => (
            <label key={v} className="prefs-check-item">
              <input type="checkbox"
                checked={(reqs.tech_required||[]).includes(v)}
                onChange={e=>{
                  const cur=reqs.tech_required||[];
                  set('tech_required',e.target.checked?[...cur,v]:cur.filter(x=>x!==v));
                }} />
              <span style={{fontSize:'0.78rem'}}>{l}</span>
            </label>
          ))}
        </div>
        <div className="prefs-section">
          <div className="jreq-section">
            <div className="jreq-section-title">Search / Posting Quality</div>
            <div style={{display:'flex',gap:'0.625rem',flexWrap:'wrap'}}>
              {[{k:'search_type',opts:['retained','exclusive','contingent']},{k:'decision_maker_involved',l:'Decision-maker involved',bool:true}].map(f=>
                f.bool ? (
                  <label key={f.k} className="prefs-check-item">
                    <input type="checkbox" checked={!!reqs[f.k]} onChange={e=>set(f.k,e.target.checked)} />
                    <span style={{fontSize:'0.8rem'}}>{f.l}</span>
                  </label>
                ) : (
                  <div key={f.k} className="prefs-field" style={{minWidth:180}}>
                    <div className="prefs-label">Search type</div>
                    <select className="prefs-select" value={reqs.search_type||''} onChange={e=>set('search_type',e.target.value||null)}>
                      <option value="">Not specified</option>
                      {f.opts.map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                    </select>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RECRUITER SIGN IN PAGE ────────────────────────────────────────────────────
function RecruiterSignInPage({ onBack }) {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSend() {
    if (!email || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    setError('');
    const redirectUrl = `${window.location.origin}?view=recruiter-dash`;
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl }
    });
    if (err) {
      setError('Could not send link. Please try again or email desk@fredheimtech.com.');
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-eyebrow">Search Firm Access</div>
        <h2 className="auth-title">Recruiter Sign In</h2>
        <p className="auth-desc">
          Access your posting dashboard, view candidate interest data, and manage your searches.
          Use the email address associated with your firm's account.
        </p>

        {sent ? (
          <div className="auth-sent-box">
            <div className="auth-sent-title">Check Your Inbox</div>
            <div className="auth-sent-desc">
              A sign-in link has been sent to <strong>{email}</strong>.
              Click the link to access your recruiter dashboard.
              The link expires in 1 hour.
            </div>
          </div>
        ) : (
          <>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Firm Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@yourfirm.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                autoFocus
              />
            </div>
            {error && <div style={{color:'var(--red)',fontSize:'0.78rem',marginBottom:'0.75rem'}}>{error}</div>}
            <button className="submit-btn" onClick={handleSend} disabled={loading}>
              {loading ? 'Sending…' : 'Send Sign-In Link'}
            </button>
            <p className="form-note" style={{marginTop:'1rem'}}>
              Not yet a posting partner?{' '}
              <span style={{color:'var(--gold)',cursor:'pointer',textDecoration:'underline'}} onClick={onBack}>
                Submit your first search here.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── RECRUITER MATCH TAB ───────────────────────────────────────────────────────
function RecruiterMatchTab({ jobs, matches, userEmail, showToast, onMatchUpdate }) {
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [benchmarks, setBenchmarks]       = useState([]);

  useEffect(() => {
    sb.from('fed_comp_benchmarks').select('*').eq('is_active', true).then(({data})=>setBenchmarks(data||[]));
  }, []);

  async function indicateInterest(matchId) {
    setActionLoading(p => ({...p, [matchId]: true}));
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch('/api/match-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'recruiter_interest', match_id: matchId }),
      });
      const data = await resp.json();
      if (resp.ok) {
        onMatchUpdate(matchId, data.status);
        showToast(data.status === 'mutual_interest' ? '✓ Mutual interest! Fredheim will facilitate the introduction.' : '✓ Interest sent. Candidate will be notified.');
      } else {
        showToast(data.error || 'Could not send interest.');
      }
    } catch(e) { showToast('Error sending interest.'); }
    setActionLoading(p => ({...p, [matchId]: false}));
  }

  async function withdrawInterest(matchId) {
    setActionLoading(p => ({...p, [matchId]: true}));
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch('/api/match-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'recruiter_withdraw', match_id: matchId }),
      });
      const data = await resp.json();
      if (resp.ok) { onMatchUpdate(matchId, 'recruiter_withdrawn'); showToast('Interest withdrawn.'); }
      else showToast(data.error || 'Could not withdraw.');
    } catch(e) { showToast('Error.'); }
    setActionLoading(p => ({...p, [matchId]: false}));
  }

  // Aggregate stats
  const totalMatches      = matches.length;
  const interestSent      = matches.filter(m => ['recruiter_interested','mutual_interest'].includes(m.status)).length;
  const candidateInterest = matches.filter(m => m.status === 'candidate_interested').length;
  const mutualMatches     = matches.filter(m => m.status === 'mutual_interest').length;
  const newMatches        = matches.filter(m => !m.last_recruiter_view_at).length;

  function scoreColor(s) { return s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--gold)' : 'var(--ink-3)'; }

  function privacyLabel(match) {
    // We don't have candidate profile details in match record — show generic label
    // The candidate_email is used internally only; display-facing is anonymized
    return `Executive Candidate #${match.id.slice(-4).toUpperCase()}`;
  }

  return (
    <div>
      {/* Stats */}
      <div className="match-stat-row" style={{marginBottom:'2rem'}}>
        {[
          { label:'Total Matches',      num: totalMatches,      cls:'' },
          { label:'New Since Last View', num: newMatches,        cls: newMatches > 0 ? 'gold' : '' },
          { label:'Interest Sent',       num: interestSent,      cls: interestSent > 0 ? 'gold' : '' },
          { label:'Candidate Interest',  num: candidateInterest, cls: candidateInterest > 0 ? 'green' : '' },
          { label:'Mutual Interest',     num: mutualMatches,     cls: mutualMatches > 0 ? 'green' : '' },
        ].map(s => (
          <div key={s.label} className="match-stat">
            <div className={`match-stat-num ${s.cls}`}>{s.num}</div>
            <div className="match-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'var(--ink-4)',fontSize:'0.875rem'}}>
          No active searches. Post a search to start seeing candidate matches.
        </div>
      ) : jobs.map(job => {
        const jobMatches = matches.filter(m => m.job_id === job.id);
        const jNew       = jobMatches.filter(m => !m.last_recruiter_view_at).length;
        const jSent      = jobMatches.filter(m => ['recruiter_interested','mutual_interest'].includes(m.status)).length;
        const jReceived  = jobMatches.filter(m => m.status === 'candidate_interested').length;
        const jMutual    = jobMatches.filter(m => m.status === 'mutual_interest').length;
        const isOpen     = selectedJobId === job.id;

        return (
          <div key={job.id} className="match-job-row">
            <div className="match-job-header" onClick={() => {
              setSelectedJobId(isOpen ? null : job.id);
              // Mark as viewed (background call)
              if (!isOpen) {
                sb.auth.getSession().then(({ data: { session } }) => {
                  if (!session) return;
                  fetch('/api/match-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                    body: JSON.stringify({ action: 'mark_viewed', job_id: job.id }),
                  });
                });
              }
            }}>
              <div>
                <div className="match-job-title">{job.title}</div>
                <div className="match-job-meta">{job.industry} · {job.location} · {job.salary_display}</div>
              </div>
              <div className="match-job-counts">
                <span className="match-count-pill">{jobMatches.length} matches</span>
                {jNew > 0 && <span className="match-count-pill gold">{jNew} new</span>}
                {jReceived > 0 && <span className="match-count-pill green">{jReceived} interested</span>}
                {jMutual > 0 && <span className="match-count-pill green">⬤ {jMutual} mutual</span>}
                <button className="admin-action-btn" style={{marginLeft:'0.5rem'}}>{isOpen ? '▲ Hide' : '▼ View Candidates'}</button>
              </div>
            </div>

            {isOpen && (
              <div className="match-candidates-grid">
                {jobMatches.length === 0 ? (
                  <div style={{padding:'2rem',color:'var(--ink-4)',fontSize:'0.82rem',gridColumn:'1/-1'}}>
                    No candidate matches yet. Match computation runs when you load this dashboard.
                  </div>
                ) : jobMatches.map(match => {
                  const isBusy      = actionLoading[match.id];
                  const canInterest = match.status === 'matched' || match.status === 'candidate_interested';
                  const canWithdraw = match.status === 'recruiter_interested' || match.status === 'mutual_interest';
                  const isMutual    = match.status === 'mutual_interest';

                  const reasons = typeof match.match_reasons === 'string'
                    ? JSON.parse(match.match_reasons) : (match.match_reasons || {});

                  return (
                    <div key={match.id} className={`match-candidate-card ${isMutual ? 'mutual-border' : ''}`}
                         style={isMutual ? {borderTop:'2px solid var(--green)'} : {}}>
                      {/* Match Confidence — categorical label is the lead signal. */}
                      <div style={{marginBottom:'0.625rem'}}>
                        <MatchConfidenceBadge
                          score={match.match_score}
                          reasons={reasons}
                          gaps={[]}
                          compact={false}
                        />
                      </div>

                      {/* Anonymized identity — surface candidate's equivalent leadership
                          label when available (denormalized onto match record by
                          /api/compute-matches). This is the platform's signature output
                          to recruiters: scope and complexity classification, not title. */}
                      <div>
                        <div className="match-candidate-title">
                          {isMutual ? match.candidate_email : privacyLabel(match)}
                        </div>
                        {match.candidate_equivalent_label && (
                          <div className="match-candidate-equivalent">
                            {match.candidate_equivalent_label}
                          </div>
                        )}
                        <div className="match-candidate-meta">
                          {isMutual
                            ? 'Identity revealed — Fredheim will facilitate introduction.'
                            : 'Identity protected until mutual interest is confirmed.'}
                        </div>
                      </div>

                      {/* Specific alignment signals — kept as secondary detail. */}
                      <div className="match-reason-tags">
                        {reasons.scope    === true && <span className="match-reason-tag match">Scope ✓</span>}
                        {reasons.complexity === true && <span className="match-reason-tag match">Complexity ✓</span>}
                        {reasons.industry === true && <span className="match-reason-tag match">Industry ✓</span>}
                        {reasons.function === true && <span className="match-reason-tag match">Function ✓</span>}
                        {reasons.salary   === true && <span className="match-reason-tag match">Salary ✓</span>}
                        {reasons.location === true && <span className="match-reason-tag match">Location ✓</span>}
                        {reasons.work_arrangement === true && <span className="match-reason-tag match">Arrangement ✓</span>}
                        {reasons.work_arrangement === 'partial' && <span className="match-reason-tag partial">Arrangement ~</span>}
                        {reasons.pnl     === true && <span className="match-reason-tag match">P&amp;L ✓</span>}
                        {reasons.mandate === true && <span className="match-reason-tag match">Mandate ✓</span>}
                        {reasons.commercial_fit === true && <span className="match-reason-tag match">Commercial ✓</span>}
                        {reasons.commercial_fit === 'partial' && <span className="match-reason-tag partial">Commercial ~</span>}
                        {reasons.industrial_translator === true && <span className="match-reason-tag match" style={{background:'#e3f2fd',borderColor:'rgba(21,101,192,0.3)',color:'#0d3f7a'}}>Industrial translator ✓</span>}
                        {reasons.tech    === true && <span className="match-reason-tag match">Technical ✓</span>}
                        {reasons.tech    === 'partial' && <span className="match-reason-tag partial">Technical ~</span>}
                        {reasons.salary  === false && <span className="match-reason-tag" style={{color:'var(--red,#c0392b)'}}>Salary gap</span>}
                      </div>
                      {match.explanation && (
                        <div className="match-explanation">{match.explanation}</div>
                      )}
                      <CompAlignmentBadge
                        alignment={computeCompAlignment({
                          // Derive value-factor signals from stored match reasons
                          candidate_preferences: {
                            authority_pnl:  match.match_reasons?.pnl === true,
                            mandate_types:  match.match_reasons?.mandate === true ? ['growth'] : [],
                            tech_experience: match.match_reasons?.tech === true ? ['port_terminal'] : [],
                          },
                          salary_min: null, // candidate salary not exposed to recruiter by default
                        }, jobs.find(j=>j.id===match.job_id), benchmarks)}
                        isRecruiter={true}
                        compact={match.match_score > 0}
                      />
                      <div className="match-action-row">
                        {match.status === 'matched' && (
                          <button className="btn-primary" style={{fontSize:'0.72rem',padding:'0.4rem 1rem'}}
                            onClick={() => indicateInterest(match.id)} disabled={isBusy}>
                            {isBusy ? '…' : 'Indicate Interest'}
                          </button>
                        )}
                        {match.status === 'candidate_interested' && (
                          <>
                            <span className="match-status-badge candidate-interested">Candidate Interested →</span>
                            <button className="btn-primary" style={{fontSize:'0.72rem',padding:'0.4rem 1rem'}}
                              onClick={() => indicateInterest(match.id)} disabled={isBusy}>
                              {isBusy ? '…' : 'Accept & Match'}
                            </button>
                          </>
                        )}
                        {match.status === 'recruiter_interested' && (
                          <>
                            <span className="match-status-badge recruiter-interested">Interest Sent</span>
                            <button className="admin-action-btn" style={{fontSize:'0.65rem'}}
                              onClick={() => withdrawInterest(match.id)} disabled={isBusy}>
                              {isBusy ? '…' : 'Withdraw'}
                            </button>
                          </>
                        )}
                        {match.status === 'mutual_interest' && (
                          <span className="match-status-badge mutual">⬤ Mutual Interest — Introduction Pending</span>
                        )}
                        {match.status === 'candidate_declined' && (
                          <span className="match-status-badge declined">Candidate Declined</span>
                        )}
                        {match.status === 'recruiter_withdrawn' && (
                          <span className="match-status-badge declined">Withdrawn</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{marginTop:'1.5rem',padding:'1rem 1.5rem',background:'var(--paper-2)',border:'1px solid var(--rule)',fontSize:'0.75rem',color:'var(--ink-4)',lineHeight:'1.6'}}>
        Candidate identities are protected until mutual interest is confirmed. Once mutual, Fredheim facilitates the introduction. Introduction fees apply upon placement.
      </div>
    </div>
  );
}

// ── RECRUITER DASHBOARD ───────────────────────────────────────────────────────
function RecruiterDashboard({ user, onSignOut, showToast, openPostModal }) {
  const [submissions, setSubmissions] = useState([]);
  const [jobs, setJobs]               = useState([]);
  const [interests, setInterests]     = useState([]);
  const [matches, setMatches]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [dashTab, setDashTab]         = useState('overview');
  const [closeModal, setCloseModal]   = useState(null);
  const [fillModal, setFillModal]     = useState(null);

  const userEmail = user.email;

  function handleJobStatusChange(jobId, newStatus) {
    setJobs(prev => prev.map(j => j.id === jobId ? {...j, status: newStatus} : j));
  }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Use API endpoint so service role bypasses RLS on fed_recruiter_submissions
      // Send the Supabase session token so the API can validate the caller
      const { data: { session } } = await sb.auth.getSession();
      const authToken = session?.access_token || '';
      const [dashRes, jRes] = await Promise.all([
        fetch(`/api/recruiter-dash?email=${encodeURIComponent(userEmail)}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        }).then(r => r.json()),
        sb.from('fed_jobs').select('*').ilike('firm_email', userEmail).order('created_at', {ascending:false}),
      ]);
      setSubmissions(dashRes.submissions || []);
      setJobs(jRes.data || []);
      const jobIds = (jRes.data || []).map(j => j.id);
      if (jobIds.length > 0) {
        const { data: iData } = await sb
          .from('fed_interests')
          .select('*')
          .in('job_id', jobIds)
          .order('created_at', {ascending:false});
        setInterests(iData || []);

        // Load bidirectional match data
        const { data: mData } = await sb
          .from('fed_matches')
          .select('*')
          .in('job_id', jobIds)
          .not('status', 'in', '("candidate_hidden")')
          .order('match_score', { ascending: false });
        setMatches(mData || []);

        // Trigger match computation in background (creates new match records for new candidates)
        if (authToken) {
          fetch('/api/compute-matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          }).then(r => r.json()).then(result => {
            if (result.matches_created > 0) {
              // Refresh matches after computation
              sb.from('fed_matches').select('*')
                .in('job_id', jobIds)
                .not('status', 'in', '("candidate_hidden")')
                .order('match_score', { ascending: false })
                .then(({ data }) => { if (data) setMatches(data); });
            }
          }).catch(() => {});
        }
      } else {
        setInterests([]);
        setMatches([]);
      }
    } catch(e) {
      showToast('Error loading dashboard data.');
    }
    setLoading(false);
  }

  function fmt(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  }

  // Match interests to this firm's jobs
  const myJobIds = jobs.map(j => j.id);
  const myInterests = interests.filter(i => myJobIds.includes(i.job_id));

  // Founding partner program status
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const programActive = currentYear === 2026 && currentMonth <= 11;

  const thisMonthPostings = submissions.filter(s => {
    const d = new Date(s.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      && ['approved','posted'].includes(s.status);
  }).length;

  const slotAvailable = thisMonthPostings < 1;
  const firmName = submissions[0]?.firm_name || 'Your Firm';
  // Detect if this user is actually an executive (has profile but no submissions)
  // In that case, redirect them to their executive profile

  if (loading) return (
    <div style={{textAlign:'center',padding:'4rem',color:'var(--ink-4)'}}>
      <span className="spinner"/>Loading your dashboard…
    </div>
  );

  return (
    <div className="recruiter-dash-page">
      <div className="recruiter-dash-header">
        <div>
          <div className="recruiter-dash-firm">{firmName}</div>
          <div className="recruiter-dash-meta">{userEmail} · Founding Partner 2026</div>
        </div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center',flexShrink:0}}>
          <button className="btn-primary" style={{fontSize:'0.78rem',padding:'0.5rem 1.25rem'}} onClick={openPostModal}>
            Post a Search
          </button>
          <button className="admin-action-btn danger" onClick={onSignOut}>Sign Out</button>
        </div>
      </div>

      {/* Founding Partner Status */}
      {programActive && (
        <div style={{
          background: slotAvailable ? 'var(--green-bg)' : 'var(--gold-bg)',
          border: `1px solid ${slotAvailable ? 'rgba(26,122,74,0.2)' : 'var(--gold-rule)'}`,
          borderLeft: `3px solid ${slotAvailable ? 'var(--green)' : 'var(--gold)'}`,
          padding:'1rem 1.5rem',
          marginBottom:'1.5rem',
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center',
          gap:'1rem',
          flexWrap:'wrap'
        }}>
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.15em',textTransform:'uppercase',color: slotAvailable ? 'var(--green)' : 'var(--gold)',marginBottom:'0.25rem'}}>
              Founding Partner Program 2026
            </div>
            <div style={{fontSize:'0.875rem',color:'var(--ink-2)',fontWeight:500}}>
              {slotAvailable
                ? `Your monthly posting slot is available — post one search free this ${now.toLocaleString('default',{month:'long'})}.`
                : `Monthly slot used for ${now.toLocaleString('default',{month:'long'})}. Next slot available ${new Date(currentYear, currentMonth+1, 1).toLocaleString('default',{month:'long', day:'numeric'})}.`
              }
            </div>
            <div style={{fontSize:'0.75rem',color:'var(--ink-4)',marginTop:'0.25rem'}}>
              {12 - currentMonth} month{12-currentMonth!==1?'s':''} remaining · Subscriptions open January 2027
            </div>
          </div>
          {slotAvailable && (
            <button className="btn-primary" style={{fontSize:'0.78rem',padding:'0.5rem 1.25rem',flexShrink:0}} onClick={openPostModal}>
              Post Now — Free
            </button>
          )}
        </div>
      )}

      {/* Dashboard Tabs */}
      <div className="match-tabs">
        <button className={`match-tab ${dashTab==='overview'?'active':''}`} onClick={() => setDashTab('overview')}>
          Overview
        </button>
        <button className={`match-tab ${dashTab==='matches'?'active':''}`} onClick={() => setDashTab('matches')}>
          Candidate Matches {matches.length > 0 && `(${matches.length})`}
        </button>
      </div>

      {dashTab === 'matches' && (
        <RecruiterMatchTab
          jobs={jobs.filter(j=>j.status==='active' && !j.demo_post)}
          matches={matches}
          authToken={null}
          userEmail={userEmail}
          showToast={showToast}
          onMatchUpdate={(matchId, newStatus) => {
            setMatches(prev => prev.map(m => m.id === matchId ? {...m, status: newStatus} : m));
          }}
        />
      )}

      {dashTab === 'overview' && (
      <div>
      {/* Stats */}
      <div className="admin-stats" style={{marginBottom:'2rem'}}>
        <div className="admin-stat">
          <div className="admin-stat-num">{submissions.length}</div>
          <div className="admin-stat-label">Total Submissions</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-num green">{jobs.filter(j=>j.status==='active').length}</div>
          <div className="admin-stat-label">Live Searches</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-num gold">{myInterests.length}</div>
          <div className="admin-stat-label">Interest Signals</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-num">{jobs.reduce((s,j)=>s+(j.view_count||0),0)}</div>
          <div className="admin-stat-label">Total Views</div>
        </div>
      </div>

      {/* Live Searches */}
      <div style={{marginBottom:'2rem'}}>
        <div className="section-header">
          <h2 className="section-title">Your Live Searches</h2>
          <div className="section-count">{jobs.filter(j=>j.status==='active').length} active</div>
        </div>

        {jobs.filter(j=>j.status==='active').length === 0 ? (
          <div className="admin-empty">
            No live searches yet.
            {submissions.some(s=>s.status==='pending')
              ? " You have a submission under review — we'll publish it within 24 hours."
              : submissions.length === 0
              ? ' If you are an executive (not a recruiter), click My Profile in the nav instead.'
              : ' Post your first search using the button above.'
            }
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'1px',background:'var(--rule)'}}>
            {jobs.filter(j=>j.status==='active').map(job => {
              const jobInterests = myInterests.filter(i => i.job_id === job.id);
              return (
                <div key={job.id} className="posting-card">
                  <div className="posting-card-header">
                    <div>
                      <div className="posting-card-title">{job.title}</div>
                      <div className="posting-card-meta">{job.location} · {job.industry} · {job.salary_display}</div>
                    </div>
                    <div style={{display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap'}}>
                      <span className="admin-pill active">Live</span>
                      <button className="admin-action-btn" style={{fontSize:'0.65rem'}}
                        onClick={() => setFillModal(job)}>
                        Mark as Filled
                      </button>
                      <button className="admin-action-btn danger" style={{fontSize:'0.65rem'}}
                        onClick={() => setCloseModal(job)}>
                        Close Job
                      </button>
                    </div>
                  </div>
                  <div className="posting-card-stats">
                    <div className="posting-stat">
                      <div className="posting-stat-num">{job.view_count||0}</div>
                      <div className="posting-stat-label">Views</div>
                    </div>
                    <div className="posting-stat">
                      <div className="posting-stat-num gold" style={{color:'var(--gold)'}}>{jobInterests.length}</div>
                      <div className="posting-stat-label">Interest Signals</div>
                    </div>
                    <div className="posting-stat">
                      <div className="posting-stat-num">{fmt(job.created_at)}</div>
                      <div className="posting-stat-label">Posted</div>
                    </div>
                  </div>
                  {jobInterests.length > 0 && (
                    <div style={{marginTop:'0.875rem',paddingTop:'0.875rem',borderTop:'1px solid var(--rule-lt)'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:'0.5rem'}}>
                        Interest Signals — candidate identities withheld pending introduction
                      </div>
                      {jobInterests.map((interest, idx) => (
                        <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.375rem 0',borderBottom:'1px solid var(--rule-lt)',fontSize:'0.82rem'}}>
                          <span style={{color:'var(--ink-2)'}}>
                            {interest.status === 'introduced'
                              ? interest.anon_email  // reveal only after admin has forwarded intro
                              : `Qualified Executive #${idx + 1} — identity withheld`}
                          </span>
                          <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
                            <span className={`admin-pill ${interest.status || 'pending'}`} style={{fontSize:'0.6rem'}}>
                              {interest.status || 'pending'}
                            </span>
                            <span style={{color:'var(--ink-4)',fontFamily:"'DM Mono',monospace",fontSize:'0.65rem'}}>{fmt(interest.created_at)}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{fontSize:'0.72rem',color:'var(--ink-4)',marginTop:'0.625rem',lineHeight:'1.5'}}>
                        To request an introduction to any of these candidates, contact{' '}
                        <a href="mailto:desk@fredheimtech.com" style={{color:'var(--gold)'}}>desk@fredheimtech.com</a>.
                        Fredheim facilitates all introductions — candidate identities are only shared after platform review.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submission History */}
      {submissions.length > 0 && (
        <div>
          <div className="section-header">
            <h2 className="section-title">Submission History</h2>
            <div className="section-count">{submissions.length} total</div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Role</th><th>Industry</th><th>Salary Range</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td>{fmt(s.created_at)}</td>
                    <td><strong>{s.role_title}</strong><div style={{fontSize:'0.72rem',color:'var(--ink-4)'}}>{s.location}</div></td>
                    <td>{s.industry||'—'}</td>
                    <td>{s.salary_range||'—'}</td>
                    <td><span className={`admin-pill ${s.status||'pending'}`}>{s.status||'pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{marginTop:'2rem',padding:'1rem 1.5rem',background:'var(--paper-2)',border:'1px solid var(--rule)',fontSize:'0.78rem',color:'var(--ink-4)',lineHeight:'1.6'}}>
        Questions about your account or a posting?{' '}
        <a href="mailto:desk@fredheimtech.com" style={{color:'var(--gold)'}}>desk@fredheimtech.com</a>
      </div>
      </div>
      )}

      {closeModal && (
        <CloseJobModal job={closeModal} onClose={()=>setCloseModal(null)}
          showToast={showToast} onJobStatusChange={handleJobStatusChange} />
      )}
      {fillModal && (
        <MarkFilledModal job={fillModal} onClose={()=>setFillModal(null)}
          showToast={showToast} onJobStatusChange={handleJobStatusChange} />
      )}
    </div>
  );
}



// ── REFERENCE STATUS COMPONENT ───────────────────────────────────────────────
function ReferenceStatus({ email, showToast }) {
  const [refs, setRefs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [newRef, setNewRef]   = useState({ name:'', email:'' });

  useEffect(() => { loadRefs(); }, [email]);

  async function loadRefs() {
    try {
      const { data } = await sb.from('fed_references').select('*').eq('profile_email', email).order('created_at');
      setRefs(data || []);
    } catch(e) {}
    setLoading(false);
  }

  async function addRef() {
    if (!newRef.name || !newRef.email) { showToast('Please enter reference name and email.'); return; }
    try {
      const { data, error } = await sb.from('fed_references').insert({
        profile_email: email,
        ref_name: newRef.name,
        ref_email: newRef.email,
        status: 'pending',
      }).select().single();
      if (error) throw error;
      setRefs(p => [...p, data]);
      setNewRef({ name:'', email:'' });
      setAdding(false);
      showToast('✓ Reference added. They will receive a questionnaire link shortly.');
    } catch(e) {
      showToast('Failed to add reference. Try again.');
    }
  }

  const statusLabel = { pending:'Pending', sent:'Questionnaire Sent', completed:'Completed', expired:'Expired' };

  if (loading) return <div style={{color:'var(--ink-4)',fontSize:'0.82rem',padding:'0.5rem 0'}}>Loading references…</div>;

  return (
    <div>
      {refs.length === 0 && !adding && (
        <div className="profile-field-empty" style={{marginBottom:'1rem'}}>
          No references added yet. References significantly strengthen your profile and improve matching.
        </div>
      )}
      {refs.map(r => (
        <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.75rem 0',borderBottom:'1px solid var(--rule-lt)',gap:'1rem'}}>
          <div>
            <div style={{fontWeight:600,color:'var(--ink)',fontSize:'0.875rem'}}>{r.ref_name}</div>
            <div style={{fontSize:'0.75rem',color:'var(--ink-4)'}}>{r.ref_email}</div>
          </div>
          <span className={`ref-status ${r.status}`}>{statusLabel[r.status] || r.status}</span>
        </div>
      ))}

      {adding ? (
        <div style={{marginTop:'1rem',padding:'1rem',background:'var(--paper)',border:'1px solid var(--rule)'}}>
          <div className="ref-row" style={{marginBottom:'0.625rem'}}>
            <div className="form-group">
              <label className="form-label">Reference Name</label>
              <input className="form-input" placeholder="Full name" value={newRef.name} onChange={e=>setNewRef(p=>({...p,name:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="their@email.com" value={newRef.email} onChange={e=>setNewRef(p=>({...p,email:e.target.value}))} />
            </div>
          </div>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="profile-edit-btn save" onClick={addRef}>Add Reference</button>
            <button className="profile-edit-btn" onClick={()=>setAdding(false)}>Cancel</button>
          </div>
        </div>
      ) : refs.length < 3 && (
        <button className="add-entry-btn" style={{marginTop:'0.75rem'}} onClick={()=>setAdding(true)}>
          + Add Reference
        </button>
      )}

      <p style={{fontSize:'0.7rem',color:'var(--ink-4)',marginTop:'0.75rem',lineHeight:'1.55'}}>
        References receive a secure 5-minute questionnaire link by email. No login required.
        Completed references are shown to verified search firms with your consent.
        The questionnaire link: <code style={{fontSize:'0.65rem',background:'var(--paper-2)',padding:'0.1rem 0.3rem'}}>desk.fredheimtech.com?ref=[token]</code>
      </p>
    </div>
  );
}

// ── REFERENCE QUESTIONNAIRE PAGE ─────────────────────────────────────────────
// Accessed via unique token link — no login required
function QuestionnairePage({ token }) {
  const [ref, setRef]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  const [answers, setAnswers] = useState({
    q1_relationship:    '',
    q2_client_facing:   '',
    q3_working_style:   '',
    q4_knowledge:       '',
    q5_market_standing: '',
    q6_pressure_story:  '',
    q7_recommend:       '',
    q7_caveats:         '',
  });

  function set(k, v) { setAnswers(p => ({...p, [k]: v})); }

  useEffect(() => {
    async function loadRef() {
      try {
        const { data, error } = await sb
          .from('fed_references')
          .select('*')
          .eq('token', token)
          .single();
        if (error || !data) { setError('This link is invalid or has expired.'); }
        else if (data.status === 'completed') { setSubmitted(true); }
        else { setRef(data); }
      } catch(e) { setError('Unable to load questionnaire. Please try again.'); }
      setLoading(false);
    }
    if (token) loadRef();
  }, [token]);

  async function handleSubmit() {
    if (!answers.q1_relationship || !answers.q2_client_facing || !answers.q7_recommend) {
      alert('Please answer all required questions (marked with *).');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await sb
        .from('fed_references')
        .update({
          ...answers,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('token', token);
      if (error) throw error;
      setSubmitted(true);
    } catch(e) {
      alert('Submission failed. Please try again or email desk@fredheimtech.com.');
    }
    setSubmitting(false);
  }

  const Q2_OPTIONS = [
    { value: 'exceptional', label: "Absolutely — one of the best I've seen" },
    { value: 'yes_with_context', label: 'Yes, with appropriate context provided' },
    { value: 'selective', label: 'Selectively — depends on the situation' },
    { value: 'not_strength', label: 'This is not their strength' },
  ];

  const Q3_OPTIONS = [
    { value: 'independent', label: 'Highly independent — sets own agenda, drives outcomes with minimal oversight' },
    { value: 'collaborative', label: 'Collaborative — builds consensus, works well in structured teams' },
    { value: 'analytical', label: 'Analytical — methodical, data-driven, careful decision-maker' },
    { value: 'entrepreneurial', label: 'Entrepreneurial — comfortable with ambiguity, builds from scratch' },
  ];

  const Q4_OPTIONS = [
    { value: 'expert', label: 'Expert — recognized by peers in the field' },
    { value: 'strong', label: 'Strong — above average for their level' },
    { value: 'solid', label: 'Solid — competent for the role' },
    { value: 'developing', label: 'Still developing' },
  ];

  const Q5_OPTIONS = [
    { value: 'name_opens_doors', label: 'Yes — their name opens doors' },
    { value: 'solid_reputation', label: 'Yes — solid reputation, well respected' },
    { value: 'known_not_networked', label: 'Known but not particularly networked' },
    { value: 'limited', label: 'Limited market presence' },
  ];

  const Q7_OPTIONS = [
    { value: 'unreservedly', label: "Unreservedly — I'd hire them myself" },
    { value: 'yes_right_role', label: 'Yes, for the right role' },
    { value: 'yes_with_caveats', label: 'Yes, with some caveats' },
    { value: 'not_at_level', label: 'Not at this level' },
  ];

  if (loading) return (
    <div className="questionnaire-page">
      <div className="questionnaire-inner">
        <div style={{textAlign:'center',padding:'3rem',color:'var(--ink-4)'}}>
          <span className="spinner" />Loading…
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="questionnaire-page">
      <div className="questionnaire-inner">
        <div className="questionnaire-header">
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.75rem'}}>
            Fredheim Executive Desk
          </div>
          <div className="questionnaire-title">Link Unavailable</div>
        </div>
        <div style={{background:'var(--paper-2)',border:'1px solid var(--rule)',borderLeft:'3px solid var(--red)',padding:'1.25rem',color:'var(--ink-3)',fontSize:'0.875rem',lineHeight:'1.65'}}>
          {error} If you believe this is an error, please email <a href="mailto:desk@fredheimtech.com" style={{color:'var(--gold)'}}>desk@fredheimtech.com</a>.
        </div>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="questionnaire-page">
      <div className="questionnaire-inner">
        <div className="questionnaire-header">
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.75rem'}}>
            Fredheim Executive Desk
          </div>
          <div className="questionnaire-title">Thank You</div>
        </div>
        <div style={{background:'var(--green-bg)',border:'1px solid rgba(26,122,74,0.2)',borderLeft:'3px solid var(--green)',padding:'1.5rem',color:'var(--ink-3)',fontSize:'0.875rem',lineHeight:'1.75'}}>
          Your reference has been received and will be kept confidential.
          It will be shared only with verified executive search firms, with the candidate's consent.
          You can close this window.
        </div>
      </div>
    </div>
  );

  const candidateName = ref?.ref_name ? `for ${ref.ref_name.split(' ')[0]}` : '';

  return (
    <div className="questionnaire-page">
      <div className="questionnaire-inner">
        <div className="questionnaire-header">
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.75rem'}}>
            Fredheim Executive Desk — Confidential Reference
          </div>
          <div className="questionnaire-title">Professional Reference</div>
          <p className="questionnaire-desc">
            You have been listed as a professional reference on Fredheim Executive Desk —
            a curated executive search platform for maritime, ports and terminals, energy, offshore, and industrial logistics.
            This takes approximately 5 minutes. Your responses are confidential and shared
            only with verified search firms, with the candidate's consent.
          </p>
        </div>

        {/* Q1 */}
        <div className="q-block">
          <div className="q-num">Question 1 of 7 *</div>
          <div className="q-text">How long and in what capacity did you work with this person?</div>
          <textarea
            className="q-textarea"
            placeholder="e.g. I worked with [name] for 4 years at [company] where they reported to me as Commercial Director..."
            value={answers.q1_relationship}
            onChange={e => set('q1_relationship', e.target.value)}
          />
        </div>

        {/* Q2 */}
        <div className="q-block">
          <div className="q-num">Question 2 of 7 *</div>
          <div className="q-text">Can they represent your organization credibly in front of a client or senior counterparty — without preparation or hand-holding?</div>
          <div className="tap-options">
            {Q2_OPTIONS.map(o => (
              <div key={o.value} className={`tap-option ${answers.q2_client_facing===o.value?'selected':''}`}
                onClick={() => set('q2_client_facing', o.value)}>
                <div className="tap-radio" />
                <div className="tap-option-text">{o.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Q3 */}
        <div className="q-block">
          <div className="q-num">Question 3 of 7</div>
          <div className="q-text">How would you describe their working style?</div>
          <div className="tap-options">
            {Q3_OPTIONS.map(o => (
              <div key={o.value} className={`tap-option ${answers.q3_working_style===o.value?'selected':''}`}
                onClick={() => set('q3_working_style', o.value)}>
                <div className="tap-radio" />
                <div className="tap-option-text">{o.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Q4 */}
        <div className="q-block">
          <div className="q-num">Question 4 of 7</div>
          <div className="q-text">How deep is their knowledge of the industry?</div>
          <div className="tap-options">
            {Q4_OPTIONS.map(o => (
              <div key={o.value} className={`tap-option ${answers.q4_knowledge===o.value?'selected':''}`}
                onClick={() => set('q4_knowledge', o.value)}>
                <div className="tap-radio" />
                <div className="tap-option-text">{o.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Q5 */}
        <div className="q-block">
          <div className="q-num">Question 5 of 7</div>
          <div className="q-text">Are they trusted and well-regarded in the market?</div>
          <div className="tap-options">
            {Q5_OPTIONS.map(o => (
              <div key={o.value} className={`tap-option ${answers.q5_market_standing===o.value?'selected':''}`}
                onClick={() => set('q5_market_standing', o.value)}>
                <div className="tap-radio" />
                <div className="tap-option-text">{o.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Q6 */}
        <div className="q-block">
          <div className="q-num">Question 6 of 7</div>
          <div className="q-text">Describe a moment when they performed well under pressure or in a difficult situation.</div>
          <textarea
            className="q-textarea"
            placeholder="2–3 sentences describing a specific situation and how they handled it..."
            value={answers.q6_pressure_story}
            onChange={e => set('q6_pressure_story', e.target.value)}
          />
        </div>

        {/* Q7 */}
        <div className="q-block">
          <div className="q-num">Question 7 of 7 *</div>
          <div className="q-text">Would you recommend them for a senior executive role?</div>
          <div className="tap-options" style={{marginBottom:'1rem'}}>
            {Q7_OPTIONS.map(o => (
              <div key={o.value} className={`tap-option ${answers.q7_recommend===o.value?'selected':''}`}
                onClick={() => set('q7_recommend', o.value)}>
                <div className="tap-radio" />
                <div className="tap-option-text">{o.label}</div>
              </div>
            ))}
          </div>
          {(answers.q7_recommend === 'yes_with_caveats' || answers.q7_recommend === 'not_at_level') && (
            <textarea
              className="q-textarea"
              placeholder="Please share any context or caveats that would be helpful..."
              value={answers.q7_caveats}
              onChange={e => set('q7_caveats', e.target.value)}
            />
          )}
        </div>

        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
          style={{width:'100%'}}
        >
          {submitting ? 'Submitting…' : 'Submit Reference'}
        </button>

        <p style={{fontSize:'0.72rem',color:'var(--ink-4)',textAlign:'center',marginTop:'1rem',lineHeight:'1.6'}}>
          Your responses are confidential. Fredheim Executive Desk · desk@fredheimtech.com
        </p>
      </div>
    </div>
  );
}


// ── CONSULTING BOARD ──────────────────────────────────────────────────────────
const EXPERTISE_AREAS = [
  'Chartering & Freight','Terminal Operations','Port Development','Vessel Management',
  'Commercial Strategy','M&A / Acquisitions','Regulatory & Compliance','Supply Chain',
  'LNG / Gas','Bulk Commodities','Project Cargo','Offshore Operations',
  'Digital Transformation','Finance & Restructuring','HSE & Risk','Expert Witness',
];

const ENGAGEMENT_TYPES = [
  'Advisory','Interim Management','Project-based','Board Observer','Expert Witness','Retainer',
];

function ConsultingBoard({ authUser, userType, onSignIn, openBriefModal, showToast }) {
  const [briefs, setBriefs]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedBrief, setSelectedBrief] = useState(null);
  const [interestSent, setInterestSent]   = useState({});
  const [filters, setFilters]       = useState({ expertise:'', duration:'', urgency:'' });

  useEffect(() => { loadBriefs(); }, []);

  async function loadBriefs() {
    try {
      const { data } = await sb
        .from('fed_consulting_briefs')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setBriefs(data || []);
    } catch(e) { setBriefs([]); }
    setLoading(false);
  }

  async function expressInterest(brief) {
    if (!authUser) { onSignIn(); return; }
    try {
      await sb.from('fed_consulting_interests').insert({
        brief_id: brief.id,
        consultant_email: authUser.email,
        status: 'pending',
      });
      setInterestSent(p => ({...p, [brief.id]: true}));
      showToast('✓ Interest registered. The platform will be in touch.');
    } catch(e) {
      if (e?.code === '23505' || e?.message?.includes('unique')) {
        showToast('You have already registered interest in this brief.');
      } else {
        showToast('Could not register interest. Please try again.');
      }
    }
  }

  const filtered = briefs.filter(b => {
    if (filters.expertise && !b.expertise_tags?.includes(filters.expertise)) return false;
    if (filters.duration && b.duration !== filters.duration) return false;
    if (filters.urgency && b.urgency !== filters.urgency) return false;
    return true;
  });

  const urgencyLabel = { immediate:'Immediate', within_30:'Within 30 days', planning:'Planning ahead' };
  const urgencyClass = { immediate:'immediate', within_30:'soon', planning:'planning' };

  function fmt(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-US', {month:'short', day:'numeric'});
  }

  // Demo briefs for preview
  const demoBriefs = [
    {
      id:'demo-1', demo:true,
      title:'Interim Commercial Director — LNG Terminal',
      company_display:'Confidential — Major LNG Operator',
      description:'Seeking an experienced commercial director to cover a 3-month maternity leave. The role oversees all third-party shipping relationships, tariff negotiations, and vessel scheduling for a 6-MTPA LNG export terminal.',
      expertise_tags:['Chartering & Freight','Terminal Operations','LNG / Gas'],
      duration:'1_3_months', urgency:'immediate',
      rate_min:1500, rate_max:2500, rate_currency:'USD',
      location:'Houston, TX', remote_ok:false,
      engagement_type:'Interim Management',
      created_at: new Date().toISOString(),
    },
    {
      id:'demo-2', demo:true,
      title:'Commercial Strategy Advisory — Bulk Terminal Acquisition',
      company_display:'Private Equity — Infrastructure Fund',
      description:'PE fund evaluating the acquisition of a bulk terminal on the Gulf Coast. Need an experienced terminal commercial advisor for 6 weeks to assess revenue quality, customer concentration, and competitive positioning.',
      expertise_tags:['Terminal Operations','Commercial Strategy','M&A / Acquisitions'],
      duration:'1_3_months', urgency:'within_30',
      rate_min:2000, rate_max:3000, rate_currency:'USD',
      location:'Remote', remote_ok:true,
      engagement_type:'Advisory',
      created_at: new Date().toISOString(),
    },
    {
      id:'demo-3', demo:true,
      title:'Expert Witness — Charter Party Dispute',
      company_display:'International Law Firm',
      description:'Major law firm requires an expert witness with deep knowledge of voyage charter practices for an arbitration proceeding. Matter involves a demurrage dispute on a dry bulk vessel. Expected 20–30 hours total.',
      expertise_tags:['Chartering & Freight','Expert Witness','Bulk Commodities'],
      duration:'short', urgency:'within_30',
      rate_min:500, rate_max:800, rate_currency:'USD',
      location:'London / Remote', remote_ok:true,
      engagement_type:'Expert Witness',
      created_at: new Date().toISOString(),
    },
  ];

  const displayBriefs = briefs.length > 0 ? filtered : demoBriefs;
  const isDemo = briefs.length === 0;

  return (
    <div className="consulting-board">
      {/* Hero */}
      <div className="consulting-hero">
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--gold-lt)',marginBottom:'0.75rem'}}>
            Fredheim Consulting
          </div>
          <div className="consulting-hero-title">
            Senior expertise,<br/><em>on demand.</em>
          </div>
          <p className="consulting-hero-desc">
            The curated marketplace for interim, advisory, and project-based engagements
            in maritime, ports and terminals, energy, offshore, and industrial logistics. Day rates published.
            Identity protected until you choose to engage.
          </p>
          <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>
            {authUser ? (
              <button className="btn-primary" style={{fontSize:'0.78rem'}} onClick={openBriefModal}>
                Post a Brief
              </button>
            ) : (
              <button className="btn-primary" style={{fontSize:'0.78rem'}} onClick={openBriefModal}>
                Post a Consulting Brief
              </button>
            )}
            {!authUser && (
              <button className="btn-outline" style={{fontSize:'0.78rem',borderColor:'rgba(250,250,248,0.2)',color:'rgba(250,250,248,0.7)'}} onClick={onSignIn}>
                Offer Your Expertise
              </button>
            )}
          </div>
        </div>
        <div className="consulting-hero-stats">
          <div className="consulting-stat">
            <div className="consulting-stat-label">Active Briefs</div>
            <div className="consulting-stat-value">{isDemo ? '3' : briefs.length}</div>
          </div>
          <div className="consulting-stat">
            <div className="consulting-stat-label">Engagement Types</div>
            <div className="consulting-stat-value">6</div>
          </div>
          <div className="consulting-stat">
            <div className="consulting-stat-label">Introduction Fee</div>
            <div className="consulting-stat-value">$1,500</div>
          </div>
          <div className="consulting-stat">
            <div className="consulting-stat-label">Founding Partner</div>
            <div className="consulting-stat-value" style={{fontSize:'0.875rem',fontFamily:"'DM Mono',monospace",letterSpacing:'0.06em'}}>Free through Dec 31</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.5rem',flexWrap:'wrap',alignItems:'center'}}>
        <select className="filter-select" value={filters.expertise} onChange={e=>setFilters(p=>({...p,expertise:e.target.value}))}>
          <option value="">All Expertise</option>
          {EXPERTISE_AREAS.map(a=><option key={a}>{a}</option>)}
        </select>
        <select className="filter-select" value={filters.duration} onChange={e=>setFilters(p=>({...p,duration:e.target.value}))}>
          <option value="">Any Duration</option>
          <option value="short">Days to 2 weeks</option>
          <option value="1_3_months">1–3 months</option>
          <option value="3_6_months">3–6 months</option>
          <option value="ongoing">Ongoing retainer</option>
        </select>
        <select className="filter-select" value={filters.urgency} onChange={e=>setFilters(p=>({...p,urgency:e.target.value}))}>
          <option value="">Any Urgency</option>
          <option value="immediate">Immediate</option>
          <option value="within_30">Within 30 days</option>
          <option value="planning">Planning ahead</option>
        </select>
        {(filters.expertise||filters.duration||filters.urgency) && (
          <button className="filter-clear" onClick={()=>setFilters({expertise:'',duration:'',urgency:''})}>Clear</button>
        )}
        <div style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--ink-4)'}}>
          {isDemo ? '3 example briefs' : `${filtered.length} of ${briefs.length} briefs`}
        </div>
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-rule)',borderLeft:'3px solid var(--gold)',padding:'0.75rem 1rem',marginBottom:'1.5rem',fontSize:'0.78rem',color:'var(--ink-3)'}}>
          ✦ Example briefs shown for illustration. Live briefs from companies onboarding now. 
          Founding Partner Program 2026 — post one brief per month, free through December 31.
        </div>
      )}

      {/* Brief cards */}
      {loading ? (
        <div style={{textAlign:'center',padding:'3rem',color:'var(--ink-4)'}}>Loading briefs…</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'1px',background:'var(--rule)'}}>
          {displayBriefs.map(brief => (
            <div key={brief.id} className={`brief-card ${brief.engagement_type==='Advisory'?'featured':''}`}
              onClick={()=>setSelectedBrief(brief)}>
              <div>
                {brief.urgency && (
                  <span className={`urgency-badge ${urgencyClass[brief.urgency]||'planning'}`}>
                    {urgencyLabel[brief.urgency]||brief.urgency}
                  </span>
                )}
                {brief.demo && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.55rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--ink-4)',marginLeft:'0.5rem',border:'1px solid var(--rule)',padding:'0.15rem 0.4rem'}}>Example</span>}
                <div className="brief-card-title">{brief.title}</div>
                <div className="brief-card-company">{brief.company_display}</div>
                <div className="brief-card-meta">
                  <div className="brief-meta-item">
                    <span>Duration:</span>
                    <strong>
                      {brief.duration==='short'?'Days–2 weeks':
                       brief.duration==='1_3_months'?'1–3 months':
                       brief.duration==='3_6_months'?'3–6 months':
                       brief.duration==='ongoing'?'Ongoing retainer':brief.duration}
                    </strong>
                  </div>
                  {brief.engagement_type && (
                    <div className="brief-meta-item"><span>Type:</span><strong>{brief.engagement_type}</strong></div>
                  )}
                  {brief.location && (
                    <div className="brief-meta-item"><span>Location:</span><strong>{brief.location}{brief.remote_ok?' / Remote':''}</strong></div>
                  )}
                  <div className="brief-meta-item">
                    <span>Posted:</span><strong>{fmt(brief.created_at)}</strong>
                  </div>
                </div>
                <div className="brief-tags">
                  {(brief.expertise_tags||[]).slice(0,4).map(t=>(
                    <span key={t} className="brief-tag">{t}</span>
                  ))}
                </div>
              </div>
              <div className="brief-rate">
                {brief.rate_min && (
                  <>
                    <div className="brief-rate-value">
                      ${brief.rate_min.toLocaleString()}
                      {brief.rate_max && brief.rate_max !== brief.rate_min ? `–$${brief.rate_max.toLocaleString()}` : '+'}
                    </div>
                    <div className="brief-rate-label">Day Rate (USD)</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Company CTA */}
      <div className="brief-cta">
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--gold)',marginBottom:'0.375rem'}}>For Companies</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.2rem',fontWeight:500,color:'var(--ink)',marginBottom:'0.375rem'}}>Need specialist expertise?</div>
          <div style={{fontSize:'0.82rem',color:'var(--ink-4)',lineHeight:'1.6'}}>
            Post a brief. Day rate published. Founding Partner Program 2026 — free through December 31.
            $1,500 introduction fee on confirmed engagements.
          </div>
        </div>
        <button className="btn-primary" style={{flexShrink:0,whiteSpace:'nowrap'}} onClick={openBriefModal}>
          Post a Brief
        </button>
      </div>

      {/* Brief detail modal */}
      {selectedBrief && (
        <div className="brief-detail-overlay" onClick={()=>setSelectedBrief(null)}>
          <div className="brief-detail-modal" onClick={e=>e.stopPropagation()}>
            <div className="brief-detail-header">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div className="brief-detail-title">{selectedBrief.title}</div>
                  <div className="brief-detail-company">{selectedBrief.company_display}</div>
                </div>
                <button onClick={()=>setSelectedBrief(null)} style={{background:'none',border:'none',color:'rgba(250,250,248,0.5)',fontSize:'1.2rem',cursor:'pointer',padding:'0',lineHeight:1}}>✕</button>
              </div>
              {selectedBrief.rate_min && (
                <div style={{marginTop:'1rem',padding:'0.875rem',background:'rgba(250,250,248,0.06)',border:'1px solid rgba(250,250,248,0.12)'}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.4rem',fontWeight:600,color:'var(--gold-lt)'}}>
                    ${selectedBrief.rate_min.toLocaleString()}
                    {selectedBrief.rate_max && selectedBrief.rate_max !== selectedBrief.rate_min
                      ? ` – $${selectedBrief.rate_max.toLocaleString()}`
                      : '+'}
                  </div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'0.58rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(250,250,248,0.4)'}}>
                    Day Rate (USD) · {selectedBrief.engagement_type}
                  </div>
                </div>
              )}
            </div>
            <div className="brief-detail-body">
              <div className="brief-detail-section">
                <div className="brief-detail-label">Engagement Overview</div>
                <div className="brief-detail-value">{selectedBrief.description}</div>
              </div>
              <div className="brief-detail-section" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>
                <div>
                  <div className="brief-detail-label">Duration</div>
                  <div className="brief-detail-value">
                    {selectedBrief.duration==='short'?'Days to 2 weeks':
                     selectedBrief.duration==='1_3_months'?'1–3 months':
                     selectedBrief.duration==='3_6_months'?'3–6 months':
                     selectedBrief.duration==='ongoing'?'Ongoing retainer':selectedBrief.duration}
                  </div>
                </div>
                <div>
                  <div className="brief-detail-label">Urgency</div>
                  <div className="brief-detail-value">
                    {selectedBrief.urgency==='immediate'?'Immediate start':
                     selectedBrief.urgency==='within_30'?'Within 30 days':
                     'Planning ahead'}
                  </div>
                </div>
                <div>
                  <div className="brief-detail-label">Location</div>
                  <div className="brief-detail-value">{selectedBrief.location}{selectedBrief.remote_ok?' (Remote OK)':''}</div>
                </div>
                <div>
                  <div className="brief-detail-label">Engagement Type</div>
                  <div className="brief-detail-value">{selectedBrief.engagement_type}</div>
                </div>
              </div>
              <div className="brief-detail-section">
                <div className="brief-detail-label">Expertise Required</div>
                <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap',marginTop:'0.375rem'}}>
                  {(selectedBrief.expertise_tags||[]).map(t=>(
                    <span key={t} className="brief-tag" style={{background:'var(--paper-2)'}}>{t}</span>
                  ))}
                </div>
              </div>

              {selectedBrief.demo ? (
                <div style={{background:'var(--paper)',border:'1px solid var(--rule)',padding:'1.25rem',textAlign:'center',color:'var(--ink-4)',fontSize:'0.82rem'}}>
                  This is an example brief. Live briefs from companies onboarding now.
                </div>
              ) : interestSent[selectedBrief.id] ? (
                <div style={{background:'var(--green-bg)',border:'1px solid rgba(26,122,74,0.2)',borderLeft:'3px solid var(--green)',padding:'1rem 1.25rem',color:'var(--green)',fontSize:'0.875rem'}}>
                  ✓ Interest registered. Fredheim will be in touch to facilitate the introduction.
                </div>
              ) : (
                <button className="submit-btn" onClick={()=>expressInterest(selectedBrief)}>
                  Register Confidential Interest
                </button>
              )}

              <p style={{fontSize:'0.7rem',color:'var(--ink-4)',textAlign:'center',marginTop:'0.75rem',lineHeight:'1.55'}}>
                Your identity is protected until you choose to engage. A $1,500 introduction fee applies on confirmed engagements.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPANY BRIEF MODAL ───────────────────────────────────────────────────────
function BriefModal({ onClose, showToast }) {
  const [step, setStep]     = useState('tos'); // tos | form | done
  const [loading, setLoading] = useState(false);
  const [form, setForm]     = useState({
    company_name:'', contact_name:'', email:'', company_display:'',
    title:'', description:'', expertise_tags:[], engagement_type:'',
    duration:'', urgency:'', rate_min:'', rate_max:'', location:'', remote_ok:false,
  });
  function set(k,v) { setForm(p=>({...p,[k]:v})); }

  function toggleTag(tag) {
    set('expertise_tags', form.expertise_tags.includes(tag)
      ? form.expertise_tags.filter(t=>t!==tag)
      : [...form.expertise_tags, tag]);
  }

  async function handleSubmit() {
    if (!form.email || !form.title || !form.description || !form.rate_min) {
      showToast('Please complete all required fields.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await sb.from('fed_consulting_briefs').insert({
        company_name:    form.company_name,
        contact_name:    form.contact_name,
        email:           form.email,
        company_display: form.company_display || 'Confidential',
        title:           form.title,
        description:     form.description,
        expertise_tags:  form.expertise_tags,
        engagement_type: form.engagement_type,
        duration:        form.duration,
        urgency:         form.urgency,
        rate_min:        parseInt(form.rate_min) || null,
        rate_max:        parseInt(form.rate_max) || null,
        location:        form.location,
        remote_ok:       form.remote_ok,
        status:          'pending',
        demo_brief:      false,
      });
      if (error) throw error;
      // Notify admin and submitter — non-blocking
      fetch('/api/notify-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).catch(() => {});
      setStep('done');
    } catch(e) {
      showToast('Submission failed. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Switched from .modal-box (no CSS — content sat on the dim overlay
          with no visible container) to .workflow-modal which has the proper
          background, padding, border, and max-height + scroll behaviour. */}
      <div className="workflow-modal" style={{maxWidth:'560px'}} onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {step === 'tos' && (
          <>
            <div className="modal-eyebrow">For Companies</div>
            <h2 className="modal-title">Post a Consulting Brief</h2>
            <p style={{color:'var(--ink-3)',fontSize:'0.875rem',lineHeight:'1.7',marginBottom:'1.5rem',fontWeight:300}}>
              Reach senior executives available for interim, advisory, and project-based
              engagements in maritime, ports and terminals, energy, offshore, and industrial logistics.
              Day rate required. Introductions facilitated by Fredheim.
            </p>
            <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-rule)',borderLeft:'3px solid var(--gold)',padding:'0.875rem 1.25rem',marginBottom:'1.5rem',fontSize:'0.82rem',color:'var(--ink-3)',lineHeight:'1.65'}}>
              ✦ Founding Partner Program 2026 — one brief per month, complimentary through December 31.
              $1,500 introduction fee applies on confirmed engagements.
            </div>
            <div style={{background:'var(--paper)',border:'1px solid var(--rule)',padding:'1rem',marginBottom:'1.5rem',fontSize:'0.78rem',color:'var(--ink-4)',lineHeight:'1.65'}}>
              By continuing you agree that: day rate ranges are accurate and will be published,
              a $1,500 introduction fee is payable to Fredheim Technologies LLC on confirmed engagements
              within 12 months of introduction, and consultant contact information will not be shared
              outside this engagement without their consent.
            </div>
            <button className="submit-btn" onClick={()=>setStep('form')}>
              I Agree — Continue to Brief
            </button>
          </>
        )}

        {step === 'form' && (
          <>
            <div className="modal-eyebrow">Consulting Brief</div>
            <h2 className="modal-title">Brief Details</h2>
            <div className="form" style={{gap:'0.75rem'}}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input className="form-input" placeholder="Your company name" value={form.company_name} onChange={e=>set('company_name',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Displayed As</label>
                  <input className="form-input" placeholder="e.g. Confidential, or company name" value={form.company_display} onChange={e=>set('company_display',e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Your Name *</label>
                  <input className="form-input" placeholder="Contact name" value={form.contact_name} onChange={e=>set('contact_name',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input className="form-input" type="email" placeholder="your@company.com" value={form.email} onChange={e=>set('email',e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Brief Title *</label>
                <input className="form-input" placeholder="e.g. Interim Commercial Director — LNG Terminal" value={form.title} onChange={e=>set('title',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-textarea" rows={4} placeholder="Describe the engagement, context, and what expertise is needed..." value={form.description} onChange={e=>set('description',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Expertise Required (select all that apply)</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.375rem',marginTop:'0.375rem'}}>
                  {EXPERTISE_AREAS.map(tag=>(
                    <div key={tag} className={`tap-chip ${form.expertise_tags.includes(tag)?'selected':''}`}
                      style={{fontSize:'0.72rem',padding:'0.375rem 0.625rem'}}
                      onClick={()=>toggleTag(tag)}>{tag}</div>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Engagement Type</label>
                  <select className="form-select" value={form.engagement_type} onChange={e=>set('engagement_type',e.target.value)}>
                    <option value="">Select</option>
                    {ENGAGEMENT_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <select className="form-select" value={form.duration} onChange={e=>set('duration',e.target.value)}>
                    <option value="">Select</option>
                    <option value="short">Days to 2 weeks</option>
                    <option value="1_3_months">1–3 months</option>
                    <option value="3_6_months">3–6 months</option>
                    <option value="ongoing">Ongoing retainer</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Day Rate Min * (USD)</label>
                  <input className="form-input" type="number" placeholder="e.g. 1500" value={form.rate_min} onChange={e=>set('rate_min',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Day Rate Max (USD)</label>
                  <input className="form-input" type="number" placeholder="e.g. 2500" value={form.rate_max} onChange={e=>set('rate_max',e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Urgency</label>
                  <div className="tap-options-row">
                    {[{v:'immediate',l:'Immediate'},{v:'within_30',l:'Within 30 days'},{v:'planning',l:'Planning ahead'}].map(o=>(
                      <div key={o.v} className={`tap-chip ${form.urgency===o.v?'selected':''}`} onClick={()=>set('urgency',o.v)}>{o.l}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" placeholder="e.g. Houston TX, London, Remote" value={form.location} onChange={e=>set('location',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Remote OK</label>
                  <div className="tap-options-row">
                    <div className={`tap-chip ${form.remote_ok===true?'selected':''}`} onClick={()=>set('remote_ok',true)}>Yes</div>
                    <div className={`tap-chip ${form.remote_ok===false?'selected':''}`} onClick={()=>set('remote_ok',false)}>No</div>
                  </div>
                </div>
              </div>
            </div>
            <hr className="modal-divider" />
            <button className="interest-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Brief for Review'}
            </button>
            <div className="interest-note">
              Reviewed within 24 hours. Day rate transparency is required.
              $1,500 introduction fee applies on confirmed engagements.
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{textAlign:'center',padding:'1.5rem 0'}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',fontWeight:500,color:'var(--ink)',marginBottom:'0.75rem'}}>
                Brief Received
              </div>
              <p style={{color:'var(--ink-3)',fontSize:'0.875rem',lineHeight:'1.7',marginBottom:'1.5rem'}}>
                Your brief will be reviewed within 24 hours. Once approved, it will be
                visible to qualified consultants on the platform. You will be notified
                when consultants express interest.
              </p>
              <div style={{background:'var(--gold-bg)',border:'1px solid var(--gold-rule)',borderLeft:'3px solid var(--gold)',padding:'1rem',fontSize:'0.82rem',color:'var(--ink-3)',textAlign:'left',lineHeight:'1.65'}}>
                As a Founding Partner, your brief is complimentary through December 31, 2026.
                The $1,500 introduction fee applies only when an engagement is confirmed.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ── ABOUT PAGE ───────────────────────────────────────────────────────────────
function AboutPage({ setActiveView }) {
  return (
    <div className="legal-page">
      <div className="legal-eyebrow">About</div>
      <h1 className="legal-title">Fredheim Executive Desk</h1>
      <div className="legal-meta">
        A Fredheim Technologies product &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; desk.fredheimtech.com
      </div>

      <div className="legal-body">

        <h2>What We Built</h2>
        <p>
          Fredheim Executive Desk is a curated executive search and consulting marketplace
          built exclusively for maritime, energy, industrial logistics, and commodities.
          We exist because executive search in this industry has always been opaque by design —
          salary ranges hidden, firms unnamed, candidates kept in the dark until the last moment.
        </p>
        <p>
          We built something different. Salary ranges are always published.
          Search firms are named. Your identity is protected until you choose to engage.
          Introductions are facilitated personally — not algorithmically.
        </p>

        <h2>Who We Serve</h2>

        <h3>Senior Executives</h3>
        <p>
          C-suite, VP, and Director-level professionals in maritime, ports and terminals, energy,
          offshore, and industrial logistics who want access to the best opportunities without sacrificing
          confidentiality or wasting time on roles that don't fit. Free to join.
          Upgrade to Confidential ($299/yr) for full identity control and priority visibility.
        </p>

        <h3>Executive Search Firms</h3>
        <p>
          Retained search firms running mandates in our verticals who want access to
          a curated, qualified pool of senior professionals across maritime, ports and terminals,
          energy, offshore, and industrial logistics. Salary transparency is
          non-negotiable — every posting must include a published compensation range.
          Founding Partner Program 2026 — one search per month, complimentary through
          December 31. Subscriptions open January 2027.
        </p>

        <h3>Companies Seeking Expertise</h3>
        <p>
          Companies, funds, and law firms that need senior expertise on an interim,
          advisory, or project basis — without a full hire. Post a brief, publish your
          day rate range, and let the right person come to you. $1,500 introduction fee
          on confirmed engagements. Founding Partner Program terms apply.
        </p>

        <h2>How Introductions Work</h2>
        <p>
          Fredheim is not a job board. When a candidate expresses interest in a search
          or consulting brief, Fredheim facilitates a personal introduction — verifying
          fit on both sides before contact details are shared. This keeps the quality
          of every interaction high and protects both parties from wasted time.
        </p>
        <p>
          Reference-based vetting is built into the platform. Executives can submit
          professional references who complete a short confidential questionnaire.
          Completed references are shared with verified search firms — with the
          executive's consent — and significantly improve matching quality.
        </p>

        <h2>Our Verticals</h2>
        <p style={{fontSize:'0.85rem',color:'var(--ink-3)',lineHeight:'1.7',marginBottom:'0.875rem'}}>
          Operational industries and the industrial-technology companies serving them. We do not
          recruit for generic SaaS or horizontal tech — only for technology built around
          maritime, logistics, terminals, and industrial operations, where domain fluency matters
          as much as commercial chops.
        </p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'1rem'}}>
          {[
            {name:'Maritime & Shipping', desc:'Vessel operators, shipowners, chartering, freight, agency, marine services'},
            {name:'Ports & Terminals', desc:'Terminal operators, stevedoring, storage, infrastructure, intermodal interfaces'},
            {name:'Energy & Offshore', desc:'Offshore services, energy logistics, renewables, marine energy, oil and gas adjacencies'},
            {name:'Industrial Commodities & Logistics', desc:'Bulk commodities, industrial supply chains, trading, project cargo, heavy logistics'},
            {name:'Maritime & Port Technology', desc:'Vessel intelligence, port operating systems, maritime SaaS, fleet optimization, OT for marine and terminal environments'},
            {name:'Logistics & Supply Chain Technology', desc:'TMS, WMS, freight visibility, supply-chain analytics, industrial logistics platforms'},
            {name:'Industrial SaaS & Operational AI', desc:'Operational technology platforms, industrial AI, IoT, automation, and analytics for industrial workflows'},
            {name:'Compliance & Safety Tech', desc:'Regulated-environment compliance software, marine and industrial safety platforms, audit and incident systems'},
          ].map(v => (
            <div key={v.name} style={{
              background:'var(--paper-2)',border:'1px solid var(--rule)',
              padding:'0.875rem 1rem',
            }}>
              <div style={{fontSize:'0.875rem',color:'var(--ink)',fontWeight:600,marginBottom:'0.25rem'}}>{v.name}</div>
              <div style={{fontSize:'0.75rem',color:'var(--ink-4)',lineHeight:'1.5'}}>{v.desc}</div>
            </div>
          ))}
        </div>

        <h2>The Founding Partner Program</h2>
        <div className="legal-highlight">
          Search firms and companies posting consulting briefs may participate in the
          Fredheim Founding Partner Program through December 31, 2026.
          One posting per month, complimentary. No subscription required.
          Introduction fees apply on confirmed placements and engagements.
          Founding partners receive preferred pricing when subscriptions open January 2027.
        </div>

        <h2>Pricing</h2>
        <p>
          Executive profiles are free to create. The Confidential tier ($299/year) hides
          your identity from all recruiters until you personally approve each connection,
          and surfaces your profile in relevant searches.
          Introduction fees are charged to search firms only — executives are never charged
          placement fees of any kind.
        </p>
        <p style={{cursor:'pointer',color:'var(--gold)',textDecoration:'underline'}} onClick={() => setActiveView('pricing')}>
          View full pricing →
        </p>

        <h2>Built By</h2>
        <p>
          Fredheim Executive Desk is a product of Fredheim Technologies LLC —
          a team with 25+ years of combined experience in maritime, energy, and logistics,
          spanning terminal operations, vessel chartering, bulk commodity trade, and
          commercial strategy across the Gulf Coast, Gulf Region, and international markets.
        </p>
        <p>
          The platform is purpose-built for an industry we know from the inside.
          Every design decision reflects how executive search and consulting actually works
          in maritime and energy — not how generic job boards assume it works.
        </p>

        <div className="legal-contact-box">
          <h3>Get in Touch</h3>
          <p>For questions about the platform, partnerships, or founding partner onboarding:</p>
          <p><a href="mailto:desk@fredheimtech.com">desk@fredheimtech.com</a></p>
          <p>Houston, Texas</p>
        </div>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
function App() {
  const [activeView, setActiveView]   = useState('jobs');
  const [briefModal, setBriefModal]   = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(() => sessionStorage.getItem('fed_admin') === 'true');
  const [showAdmin, setShowAdmin]     = useState(() => window.location.search.includes('admin=true'));

  // Auth state
  const [authUser, setAuthUser]       = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userType, setUserType]       = useState(null); // 'executive' | 'recruiter' | null

  // Check for questionnaire token in URL
  const questionnaireToken = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref');
  }, []);
  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [recruiterModal, setRecruiterModal] = useState(false);
  const [showBanner, setShowBanner]   = useState(true);
  const [toast, setToast]             = useState(null);

  const [search, setSearch]     = useState('');
  const [industry, setIndustry] = useState('All Industries');
  const [func, setFunc]         = useState('All Functions');
  const [salaryBand, setSalaryBand] = useState(0);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 4000); }

  async function loadJobs() {
    setLoading(true);
    try {
      const { data } = await sb.from('fed_jobs').select('*').eq('status','active').order('created_at',{ascending:false});
      setJobs(data || []);
    } catch(e) { setJobs([]); }
    setLoading(false);
  }

  // Initial load
  useEffect(() => { loadJobs(); }, []);

  // Reload jobs whenever admin mode is closed so newly published posts appear immediately
  useEffect(() => {
    if (!showAdmin) loadJobs();
  }, [showAdmin]);

  // Admin keyboard shortcut: Ctrl + Shift + A
  useEffect(() => {
    function handleKey(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        setShowAdmin(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Footer vertical filter event — apply industry filter when dispatched
  useEffect(() => {
    function handleFilter(e) {
      setIndustry(e.detail);
    }
    window.addEventListener('filterIndustry', handleFilter);
    return () => window.removeEventListener('filterIndustry', handleFilter);
  }, []);

  // Capture URL params synchronously at render — before any async handler can wipe them
  const initViewRef  = useRef(new URLSearchParams(window.location.search).get('view'));
  const hasRoutedRef = useRef(false);

  // Supabase auth session listener
  useEffect(() => {
    function applyRouting(email) {
      if (hasRoutedRef.current) return; // only route once
      hasRoutedRef.current = true;
      const view = initViewRef.current;
      // Clean the URL now that we've captured the intent
      if (view) window.history.replaceState({}, '', window.location.pathname);

      if (view === 'recruiter-dash') {
        // Always trust the recruiter sign-in intent — don't verify via DB
        setUserType('recruiter');
        setActiveView('recruiter-dash');
      } else if (view === 'myprofile') {
        setActiveView('myprofile');
        detectUserType(email);
      } else if (view === 'pricing') {
        setActiveView('pricing');
        detectUserType(email);
      } else if (view === 'profile') {
        setActiveView('profile');
        detectUserType(email);
      } else if (['jobs','consulting','about','terms','privacy','early-careers','intern-profile','intern-myprofile'].includes(view)) {
        setActiveView(view);
        detectUserType(email);
      } else {
        // Unknown or no view param — default behaviour
        detectUserType(email);
      }
    }

    // Check for existing session (page load / refresh)
    sb.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) applyRouting(session.user.email);
    }).catch(() => {
      // Network/Supabase error — unblock the app rather than hanging
      setAuthLoading(false);
    });

    // Listen for sign-in via magic link
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session?.user) {
        applyRouting(session.user.email);
      }
      if (event === 'SIGNED_OUT') {
        hasRoutedRef.current = false; // reset so next sign-in routes correctly
        initViewRef.current  = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Stripe return handler for logged-in profile upgrades
  useEffect(() => {
    async function applyUpgradeFromReturn() {
      if (!authUser) return;
      const params = new URLSearchParams(window.location.search);
      const tier = params.get('upgradeSuccess');
      if (!tier) return;

      try {
        if (tier === 'intern_featured') {
          const expiry = new Date();
          expiry.setFullYear(expiry.getFullYear() + 1);
          await sb.from('fed_intern_profiles').update({
            tier: 'featured',
            tier_expires_at: expiry.toISOString(),
          }).eq('email', authUser.email.toLowerCase());
          showToast('✓ Featured Student Profile activated!');
          setActiveView('intern-myprofile');
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }

        if (tier !== 'confidential' && tier !== 'active' && tier !== 'active_senior') return;

        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        await sb.from('fed_profiles').update({
          tier: tier === 'active_senior' ? 'confidential' : tier,
          tier_expires: expiry.toISOString(),
        }).eq('email', authUser.email.toLowerCase());
        showToast('✓ Confidential profile activated.');
        setActiveView('myprofile');
      } catch(e) {
        showToast('Payment succeeded. If your tier does not update, email desk@fredheimtech.com.');
      }

      window.history.replaceState({}, '', window.location.pathname);
    }

    applyUpgradeFromReturn();
  }, [authUser]);

  function scrollToSection(view, id) {
    // scrollToSection('profile') from hero — if signed in, go to profile FORM (not myprofile)
    // so users without a profile can create one, and existing users can update
    setActiveView(view);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({behavior:'smooth'}), 50);
  }

  function goToView(view) {
    // 'profile' view shows the ProfileForm — accessible to all users whether authed or not
    // Authenticated users with an existing profile are informed via the isUpdate flag in the form
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSignOut() {
    try {
      await sb.auth.signOut();
      setAuthUser(null);
      setUserType(null);
      setActiveView('jobs');
      window.history.replaceState({}, '', window.location.origin);
      showToast('Signed out.');
    } catch (e) {
      console.error('Sign out failed:', e);
      showToast('Sign out failed. Please refresh the page.');
    }
  }

  async function detectUserType(email) {
    try {
      const emailLower = email.toLowerCase();
      // Check if this email has an executive profile
      const { data: profile } = await sb
        .from('fed_profiles')
        .select('id')
        .eq('email', emailLower)
        .maybeSingle();
      if (profile) { setUserType('executive'); return 'executive'; }

      // Check if this email submitted a search posting (case-insensitive)
      const { data: subs } = await sb
        .from('fed_recruiter_submissions')
        .select('id')
        .ilike('email', emailLower)
        .limit(1);
      if (subs && subs.length > 0) { setUserType('recruiter'); return 'recruiter'; }

      // Default to executive
      setUserType('executive');
      return 'executive';
    } catch(e) {
      setUserType('executive');
      return 'executive';
    }
  }

  function clearFilters() { setSearch(''); setIndustry('All Industries'); setFunc('All Functions'); setSalaryBand(0); }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter(j => {
      const tags = parseJson(j.tags).join(' ').toLowerCase();
      if (q && ![j.title,j.firm_name,j.company_display,tags].some(f=>f?.toLowerCase().includes(q))) return false;
      if (industry !== 'All Industries' && j.industry !== industry) return false;
      if (func !== 'All Functions' && j.function !== func) return false;
      if (salaryBand > 0 && j.salary_max < salaryBand) return false;
      return true;
    });
  }, [jobs, search, industry, func, salaryBand]);

  // Reference questionnaire — standalone page, no nav needed
  if (questionnaireToken) {
    return <QuestionnairePage token={questionnaireToken} />;
  }

  // Auth loading — brief gate prevents nav flash and incorrect role rendering
  if (authLoading) {
    return (
      <div style={{minHeight:'100vh',background:'var(--paper)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span className="spinner" />
      </div>
    );
  }

  // Admin view
  if (showAdmin) {
    if (!adminAuthed) {
      return (
        <div style={{minHeight:'100vh',background:'var(--paper)'}}>
          <div style={{background:'var(--ink)',padding:'0.75rem 2rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1rem',color:'var(--white)',fontWeight:600}}>Fredheim Executive Desk — Admin</div>
            <button onClick={()=>setShowAdmin(false)} style={{background:'none',border:'1px solid rgba(250,250,248,0.2)',color:'rgba(250,250,248,0.6)',fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.1em',textTransform:'uppercase',padding:'0.3rem 0.75rem',cursor:'pointer'}}>← Back to Site</button>
          </div>
          <AdminLogin onLogin={() => setAdminAuthed(true)} />
        </div>
      );
    }
    return (
      <div style={{minHeight:'100vh',background:'var(--paper)'}}>
        <div style={{background:'var(--ink)',padding:'0.75rem 2rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1rem',color:'var(--white)',fontWeight:600}}>Fredheim Executive Desk — Admin</div>
          <button onClick={()=>setShowAdmin(false)} style={{background:'none',border:'1px solid rgba(250,250,248,0.2)',color:'rgba(250,250,248,0.6)',fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.1em',textTransform:'uppercase',padding:'0.3rem 0.75rem',cursor:'pointer'}}>← Back to Site</button>
        </div>
        <div style={{maxWidth:'1280px',margin:'0 auto',padding:'2rem'}}>
          <AdminDashboard
            onLogout={() => { sessionStorage.removeItem('fed_admin'); sessionStorage.removeItem('fed_admin_pwd'); setAdminAuthed(false); setShowAdmin(false); }}
            showToast={showToast}
            onJobPublished={loadJobs}
          />
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <>
      {showBanner && !(authUser && activeView === 'recruiter-dash') && <DemoBanner onDismiss={() => setShowBanner(false)} />}

      <NavBar
          activeView={activeView}
          setActiveView={setActiveView}
          openRecruiterModal={() => setRecruiterModal(true)}
          authUser={authUser}
          userType={userType}
          onSignIn={() => setActiveView('signin')}
          onSignOut={handleSignOut}
        />

      {/* Hero and manifesto only on public views */}
      {!['signin','myprofile','recruiter-signin','recruiter-dash','terms','privacy','consulting','about','pricing'].includes(activeView) && (
        <>
          <Hero
            jobCount={jobs.length}
            scrollToJobs={() => scrollToSection('jobs','jobs-anchor')}
            scrollToProfile={() => scrollToSection('profile','profile-anchor')}
            authUser={authUser}
            onGoToProfile={() => goToView('myprofile')}
            onGoToConsulting={() => goToView('consulting')}
            minSalary={jobs.filter(j=>j.salary_min > 50000).reduce((min,j)=>Math.min(min,j.salary_min), Infinity) || 0}
          />
          <div className="manifesto">
            <p className="manifesto-text">
              Executive search has always been opaque by design.{' '}
              <strong>Fredheim Executive Desk is built differently</strong> —
              salary ranges published, search firms named, your identity protected until you choose to move.{' '}
              <span className="gold">Founding Partner Program 2026 — one search per month, free through December 31.</span>
            </p>
          </div>
        </>
      )}


      {/* ── CONSULTING STRIP ── */}
      {!['signin','myprofile','recruiter-signin','recruiter-dash','terms','privacy','consulting','profile','pricing'].includes(activeView) && (
        <div style={{
          background: 'var(--white)',
          borderTop: '1px solid var(--rule)',
          borderBottom: '1px solid var(--rule)',
          padding: '2.5rem 3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2rem',
          flexWrap: 'wrap',
        }}>
          <div style={{display:'flex',gap:'2rem',alignItems:'flex-start',flex:1}}>
            {/* Icon */}
            <div style={{
              width:'48px',height:'48px',background:'var(--ink)',
              display:'flex',alignItems:'center',justifyContent:'center',
              flexShrink:0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(250,250,248,0.8)" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div style={{
                fontFamily:"'DM Mono',monospace",
                fontSize:'0.6rem',
                letterSpacing:'0.18em',
                textTransform:'uppercase',
                color:'var(--gold)',
                marginBottom:'0.375rem',
              }}>
                Fredheim Consulting
              </div>
              <div style={{
                fontFamily:"'Playfair Display',serif",
                fontSize:'1.2rem',
                fontWeight:500,
                color:'var(--ink)',
                marginBottom:'0.375rem',
                lineHeight:1.3,
              }}>
                Senior expertise, on demand.
              </div>
              <p style={{
                fontSize:'0.82rem',
                color:'var(--ink-4)',
                lineHeight:'1.65',
                maxWidth:'520px',
                fontWeight:300,
                margin:0,
              }}>
                Interim, advisory, and project-based engagements in maritime, ports and terminals, energy, offshore, and industrial logistics.
                Day rates published. Identity protected until you choose to engage.
                Founding Partner Program 2026 — post one brief free through December 31.
              </p>
            </div>
          </div>
          <div style={{display:'flex',gap:'0.625rem',flexShrink:0,flexWrap:'wrap'}}>
            <button
              className="btn-outline"
              style={{fontSize:'0.78rem',whiteSpace:'nowrap'}}
              onClick={() => goToView('consulting')}
            >
              Browse Briefs
            </button>
            <button
              className="btn-primary"
              style={{fontSize:'0.78rem',whiteSpace:'nowrap'}}
              onClick={() => setBriefModal(true)}
            >
              Post a Brief
            </button>
          </div>
        </div>
      )}
      <div className="main">
        <div id="jobs-anchor" />

        {activeView === 'early-careers' && (
          <EarlyCareersLanding authUser={authUser} goToView={goToView} showToast={showToast} />
        )}

        {activeView === 'intern-profile' && (
          <div style={{minHeight:'60vh'}}>
            <InternProfileForm
              authUser={authUser}
              showToast={showToast}
              onComplete={() => setActiveView('intern-myprofile')}
            />
          </div>
        )}

        {activeView === 'intern-myprofile' && authUser && (
          <div style={{maxWidth:900,margin:'2rem auto',padding:'0 1.5rem'}}>
            <InternCandidateSection authUser={authUser} showToast={showToast} goToView={goToView} />
          </div>
        )}

        {activeView === 'intern-myprofile' && !authUser && (
          <div style={{maxWidth:600,margin:'4rem auto',padding:'0 1.5rem',textAlign:'center'}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',color:'var(--ink)',marginBottom:'1rem'}}>Sign in to view your student profile</div>
            <button className="btn-primary" onClick={() => setActiveView('signin')}>Sign In</button>
          </div>
        )}

        {activeView === 'jobs' && (
          <>
            <div className="section-header">
              <h2 className="section-title">Active Searches</h2>
              <div className="section-count">
                {loading ? 'Loading…' : `${filtered.length} of ${jobs.length} opportunities`}
              </div>
            </div>

            <div className="filters">
              <div className="search-wrap">
                <span className="search-icon">⌕</span>
                <input className="search-input" placeholder="Search by title, firm, or keyword…" value={search} onChange={e=>setSearch(e.target.value)} />
              </div>
              <select className="filter-select" value={industry} onChange={e=>setIndustry(e.target.value)}>
                {INDUSTRIES.map(i=><option key={i}>{i}</option>)}
              </select>
              <select className="filter-select" value={func} onChange={e=>setFunc(e.target.value)}>
                {FUNCTIONS.map(f=><option key={f}>{f}</option>)}
              </select>
              <select className="filter-select" value={salaryBand} onChange={e=>setSalaryBand(Number(e.target.value))}>
                {SALARY_BANDS.map(b=><option key={b.min} value={b.min}>{b.label}</option>)}
              </select>
              <button className="filter-clear" onClick={clearFilters}>Clear</button>
            </div>

            {loading ? (
              <div className="loading-state"><span className="spinner" />Loading searches…</div>
            ) : filtered.length === 0 ? (
              <div className="no-results">
                {jobs.length === 0
                ? 'No active searches posted yet — check back soon or post a search.'
                : 'No searches match your filters. Try broadening your criteria.'}
              </div>
            ) : (
              <div className="jobs-grid">
                {filtered.map(j => <JobCard key={j.id} job={j} onClick={async (job) => {
                setSelectedJob(job);
                sb.from('fed_jobs').update({ view_count: (job.view_count || 0) + 1 }).eq('id', job.id).then(() => {
                  setJobs(prev => prev.map(x => x.id === job.id ? {...x, view_count: (x.view_count||0)+1} : x));
                });
              }} />)}
              </div>
            )}

            {/* Social proof — shown below the job grid; hidden if both sources empty */}
            <SocialProofSection />
          </>
        )}

        <div id="profile-anchor" />

        {activeView === 'profile' && (
          <div className="profile-section">
            <div className="profile-left">
              <div className="profile-eyebrow">Executive Profile</div>
              <h2 className="profile-title">Your next role<br /><em>finds you.</em></h2>
              <p className="profile-desc">
                Create a confidential profile and let the right searches come to you.
                You control when — and if — your identity is shared with a search firm.
                Basic access is always free.
              </p>
              <p style={{fontSize:'0.82rem',color:'rgba(250,250,248,0.5)',marginBottom:'1.5rem'}}>
                Already have a profile?{' '}
                <span
                  style={{color:'var(--gold-lt)',cursor:'pointer',textDecoration:'underline'}}
                  onClick={() => setActiveView('signin')}
                >
                  Sign in here →
                </span>
              </p>
              <ul className="feature-list">
                <li>Confidential by default — your employer never appears</li>
                <li>Set a salary floor — only see searches that match</li>
                <li>One-click interest without revealing your identity</li>
                <li>Email alerts when a matching search is posted</li>
                <li>Confidential Profile ($299/yr) — your name and employer stay hidden until you approve</li>
                <li>Priority matching — surface in recruiter searches ahead of free profiles</li>
                <li>Maritime · Ports · Energy · Industrial Logistics only</li>
              </ul>
            </div>
            <div className="profile-right">
              <ProfileForm showToast={showToast} onComplete={() => setActiveView('myprofile')} authUserEmail={authUser?.email || null} />
            </div>
          </div>
        )}

        {activeView === 'pricing' && (
          <>
            {new URLSearchParams(window.location.search).get('checkout') === 'cancelled' && (
              <div style={{background:'var(--paper-2)',border:'1px solid var(--rule)',borderLeft:'3px solid var(--ink-3)',padding:'0.75rem 1.25rem',marginBottom:'1.5rem',fontSize:'0.82rem',color:'var(--ink-3)'}}>
                Your payment was cancelled — no charge was made. Select a plan below to try again.
              </div>
            )}
            <PricingPage
              setActiveView={setActiveView}
              openRecruiterModal={() => setRecruiterModal(true)}
              authUser={authUser}
              showToast={showToast}
            />
          </>
        )}

        {activeView === 'terms' && <TermsPage setActiveView={goToView} />}
        {activeView === 'privacy' && <PrivacyPage setActiveView={goToView} />}
        {activeView === 'about' && <AboutPage setActiveView={goToView} />}

        {activeView === 'consulting' && (
          <div className="main">
            <ConsultingBoard
              authUser={authUser}
              userType={userType}
              onSignIn={() => goToView('signin')}
              openBriefModal={() => setBriefModal(true)}
              showToast={showToast}
            />
          </div>
        )}

        {activeView === 'signin' && (
          <SignInPage onBack={() => setActiveView('profile')} />
        )}

        {activeView === 'myprofile' && authUser && (
          <MyProfilePage
            user={authUser}
            showToast={showToast}
            onCreateProfile={() => setActiveView('profile')}
            onRecruiterRedirect={() => { setUserType('recruiter'); setActiveView('recruiter-dash'); }}
            onUpgrade={() => goToView('pricing')}
            onSignOut={handleSignOut}
          />
        )}

        {activeView === 'myprofile' && !authUser && (
          <SignInPage onBack={() => setActiveView('profile')} />
        )}

        {activeView === 'recruiter-signin' && (
          <RecruiterSignInPage onBack={() => setRecruiterModal(true)} />
        )}

        {activeView === 'recruiter-dash' && authUser && (
          <RecruiterDashboard
            user={authUser}
            showToast={showToast}
            openPostModal={() => setRecruiterModal(true)}
            onSignOut={handleSignOut}
          />
        )}

        {activeView === 'recruiter-dash' && !authUser && (
          <RecruiterSignInPage onBack={() => setRecruiterModal(true)} />
        )}

        {!['signin','myprofile','recruiter-signin','recruiter-dash','terms','privacy','consulting','about','pricing','profile'].includes(activeView) && <div className="recruiter-cta">
          <div>
            <div className="recruiter-eyebrow">For Search Firms</div>
            <div className="recruiter-title">Reach the right executives.</div>
            <div className="recruiter-desc">
              The only curated platform where retained search firms reach qualified senior leaders
              in maritime, ports and terminals, energy, offshore, and industrial logistics. No noise. Salary transparency required.
              Founding Partner Program 2026 — one search per month, complimentary through December 31.
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.625rem',flexShrink:0}}>
            <button className="btn-primary" style={{whiteSpace:'nowrap'}} onClick={() => setRecruiterModal(true)}>Post a Search</button>
            <button className="btn-outline" style={{whiteSpace:'nowrap',fontSize:'0.75rem',padding:'0.5rem 1.25rem'}} onClick={() => setActiveView('recruiter-signin')}>Firm Sign In</button>
          </div>
        </div>}
      </div>

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand-name">Fredheim Executive Desk</div>
            <div className="footer-brand-sub">A Fredheim Technologies Product</div>
            <p className="footer-desc">
              The curated executive opportunity platform for maritime, ports and terminals, energy, offshore, bulk commodities, freight, and industrial logistics. Built with and for the professionals who move global trade.
            </p>
            <p style={{marginTop:'1rem',fontSize:'0.78rem',color:'rgba(250,250,248,0.4)'}}>
              <a href="mailto:desk@fredheimtech.com" style={{color:'var(--gold-lt)',textDecoration:'none'}}>
                desk@fredheimtech.com
              </a>
            </p>
          </div>
          <div>
            <div className="footer-col-title">Platform</div>
            <ul className="footer-links">
              <li onClick={()=>goToView('jobs')}>Browse Searches</li>
              <li onClick={()=>goToView('profile')}>Executive Profile</li>
              <li onClick={()=>{setRecruiterModal(true);window.scrollTo({top:0,behavior:'smooth'});}}>Post a Search</li>
              <li onClick={()=>goToView('pricing')}>Pricing</li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Verticals</div>
            <ul className="footer-links">
              {['Maritime & Shipping','Ports & Terminals','Energy & Offshore','Industrial Commodities & Logistics'].map(v => (
              <li key={v} style={{cursor:'pointer'}} onClick={()=>{
                goToView('jobs');
                setTimeout(()=>window.dispatchEvent(new CustomEvent('filterIndustry',{detail:v})),100);
              }}>{v}</li>
            ))}
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Company</div>
            <ul className="footer-links">
              <li onClick={()=>goToView('about')} style={{cursor:'pointer'}}>About Fredheim</li><li onClick={()=>goToView('terms')} style={{cursor:'pointer'}}>Terms of Service</li><li onClick={()=>goToView('privacy')} style={{cursor:'pointer'}}>Privacy Policy</li><li><a href='mailto:desk@fredheimtech.com' style={{color:'inherit',textDecoration:'none'}}>Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© 2026 Fredheim Technologies LLC. All rights reserved. <span className="footer-gold">·</span> desk.fredheimtech.com <span className="footer-gold">·</span> desk@fredheimtech.com</div>
          <div className="footer-copy">Houston, TX <span className="footer-gold">·</span> Maritime · Ports · Energy · Industrial Logistics</div>
        </div>
      </footer>

      {selectedJob && <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} showToast={showToast} />}
      {recruiterModal && <RecruiterModal onClose={() => setRecruiterModal(false)} showToast={showToast} />}
      {briefModal && <BriefModal onClose={() => setBriefModal(false)} showToast={showToast} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
