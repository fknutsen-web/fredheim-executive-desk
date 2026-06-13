import React from "react"
import * as ReactDOM from "react-dom/client"
import * as supabase from "@supabase/supabase-js"

// Compat: existing inline code references `supabase.createClient` and `window.supabase.createClient`
window.supabase = supabase

// ──────────────────────────────────────────────────────────────────────
// Original inline <script type="text/babel"> body follows unchanged
// ──────────────────────────────────────────────────────────────────────


const { useState, useEffect, useCallback } = React;

// Fredheim Desk brand mark — global ring, navigation compass, network
// waypoints (one gold). Matches /public/favicon.svg.
function BrandMark() {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Fredheim Desk" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="20.5" fill="none" stroke="#0f1c2e" strokeWidth="1.5" />
      <path d="M24 10.5 L27 21 L37.5 24 L27 27 L24 37.5 L21 27 L10.5 24 L21 21 Z" fill="#0f1c2e" />
      <circle cx="9.5" cy="9.5" r="2.4" fill="#0f1c2e" />
      <circle cx="38.5" cy="38.5" r="2.4" fill="#0f1c2e" />
      <circle cx="9.5" cy="38.5" r="2.4" fill="#0f1c2e" />
      <circle cx="38.5" cy="9.5" r="2.4" fill="#b8922a" />
    </svg>
  );
}

// ── QUESTION DATA ───────────────────────────────────────────────

const EXECUTIVE_QUESTIONS = [
  {
    id: 'Q1', section: 'executive',
    text: 'In your most recent role, what level of decisions could you make without seeking approval?',
    options: [
      { key: 'A', text: 'Day-to-day operational decisions only' },
      { key: 'B', text: 'Departmental budget and staffing decisions' },
      { key: 'C', text: 'Multi-department or platform-level commitments' },
      { key: 'D', text: 'Enterprise-wide or ownership-level decisions' },
    ]
  },
  {
    id: 'Q2', section: 'executive',
    text: 'Have you held direct profit and loss responsibility?',
    options: [
      { key: 'A', text: 'No P&L responsibility' },
      { key: 'B', text: 'Cost center accountability only' },
      { key: 'C', text: 'P&L responsibility for a single business unit' },
      { key: 'D', text: 'P&L responsibility across multiple units or platforms' },
    ]
  },
  {
    id: 'Q3', section: 'executive',
    text: 'What best describes your role in setting organizational strategy?',
    options: [
      { key: 'A', text: 'I executed strategy set by others' },
      { key: 'B', text: 'I contributed input to strategy but did not set it' },
      { key: 'C', text: 'I co-developed strategy with senior leadership' },
      { key: 'D', text: 'I originated and owned strategy at the business or enterprise level' },
    ]
  },
  {
    id: 'Q4', section: 'executive',
    text: 'How frequently have you interfaced directly with board members, owners, or investors?',
    options: [
      { key: 'A', text: 'Never' },
      { key: 'B', text: 'Occasionally, in a supporting role' },
      { key: 'C', text: 'Regularly, as part of my mandate' },
      { key: 'D', text: 'Primary point of contact for ownership or board on commercial/strategic matters' },
    ]
  },
  {
    id: 'Q5', section: 'executive',
    text: 'What is the largest team you have led directly and indirectly?',
    options: [
      { key: 'A', text: '1–5 people' },
      { key: 'B', text: '6–25 people' },
      { key: 'C', text: '26–100 people' },
      { key: 'D', text: '100+ people' },
    ]
  },
  {
    id: 'Q6', section: 'executive',
    text: 'What is the largest revenue commitment or contract value you have personally authorized or negotiated?',
    options: [
      { key: 'A', text: 'Under $500K' },
      { key: 'B', text: '$500K – $5M' },
      { key: 'C', text: '$5M – $25M' },
      { key: 'D', text: '$25M+' },
    ]
  },
  {
    id: 'Q7', section: 'executive',
    text: 'Have you led initiatives that required coordinating across multiple departments or business functions?',
    options: [
      { key: 'A', text: 'No, my role was within a single function' },
      { key: 'B', text: 'Occasionally, on specific projects' },
      { key: 'C', text: 'Regularly, as a core part of my role' },
      { key: 'D', text: 'Cross-functional coordination was my primary operating mode' },
    ]
  },
  {
    id: 'Q8', section: 'executive',
    text: 'Have you represented your organization externally with clients, partners, regulators, or industry bodies?',
    options: [
      { key: 'A', text: 'No external-facing responsibilities' },
      { key: 'B', text: 'Occasionally, in a supporting capacity' },
      { key: 'C', text: 'Regularly, as a named representative' },
      { key: 'D', text: 'Primary external face of the organization or business unit' },
    ]
  },
  {
    id: 'Q9', section: 'executive',
    text: 'Have you led a significant growth initiative, acquisition, restructuring, or transformation?',
    options: [
      { key: 'A', text: 'No' },
      { key: 'B', text: 'I was part of the team but not leading' },
      { key: 'C', text: 'I led a component of a larger initiative' },
      { key: 'D', text: 'I originated and led the initiative end to end' },
    ]
  },
  {
    id: 'Q10', section: 'executive',
    text: 'How would you describe your experience managing significant organizational risk or crisis?',
    options: [
      { key: 'A', text: 'No direct exposure' },
      { key: 'B', text: 'Supported leadership during a crisis' },
      { key: 'C', text: 'Managed a crisis within my department' },
      { key: 'D', text: 'Owned organizational-level risk or crisis response' },
    ]
  },
];

const TECHNOLOGY_QUESTIONS = [
  {
    id: 'T1', section: 'technology',
    text: 'How would you describe your current use of digital tools in your professional work?',
    options: [
      { key: 'A', text: 'I rely primarily on traditional methods — email, phone, in-person' },
      { key: 'B', text: 'I use standard productivity tools but am not an early adopter' },
      { key: 'C', text: 'I actively use modern platforms — CRM, ERP, data dashboards, collaboration tools' },
      { key: 'D', text: 'I drive technology adoption — I have led or championed digital tool implementation' },
    ]
  },
  {
    id: 'T2', section: 'technology',
    text: 'How comfortable are you using data to make decisions?',
    options: [
      { key: 'A', text: 'I rely on others to interpret data for me' },
      { key: 'B', text: 'I can read reports and dashboards prepared by others' },
      { key: 'C', text: 'I can pull, analyze, and present data independently' },
      { key: 'D', text: 'I build or commission analytical frameworks and use data as a primary decision input' },
    ]
  },
  {
    id: 'T3', section: 'technology',
    text: 'How would you describe your current engagement with AI tools and emerging technology?',
    options: [
      { key: 'A', text: 'I am aware of AI but have not incorporated it into my work' },
      { key: 'B', text: 'I have experimented with AI tools on an occasional basis' },
      { key: 'C', text: 'I use AI tools regularly as part of my workflow' },
      { key: 'D', text: 'I am actively applying AI or emerging technology to improve business outcomes and lead others in doing so' },
    ]
  },
  {
    id: 'T4', section: 'technology',
    text: 'Have you led or managed teams in a remote or hybrid environment?',
    options: [
      { key: 'A', text: 'No — my experience is exclusively in-person' },
      { key: 'B', text: 'Occasionally, but not as a primary operating model' },
      { key: 'C', text: 'Yes — I have managed remote or hybrid teams as a standard part of my role' },
      { key: 'D', text: 'Yes — I built or restructured a team around a remote or distributed model' },
    ]
  },
];

const CHANGE_QUESTIONS = [
  {
    id: 'C1', section: 'change',
    text: 'Have you led an organization or team through a significant structural or operational change?',
    options: [
      { key: 'A', text: 'No direct experience leading change' },
      { key: 'B', text: 'I supported change initiatives led by others' },
      { key: 'C', text: 'I managed change within my department or function' },
      { key: 'D', text: 'I designed and led enterprise-wide change — restructuring, transformation, or integration' },
    ]
  },
  {
    id: 'C2', section: 'change',
    text: 'Have you successfully navigated a significant shift in your industry or business model during your career?',
    options: [
      { key: 'A', text: 'My industry has been relatively stable throughout my career' },
      { key: 'B', text: 'I experienced industry shifts but adapted reactively' },
      { key: 'C', text: 'I anticipated shifts and repositioned my team or business unit proactively' },
      { key: 'D', text: 'I led the strategic response to an industry disruption at an organizational level' },
    ]
  },
  {
    id: 'C3', section: 'change',
    text: 'How do you stay current with developments in your field and in business broadly?',
    options: [
      { key: 'A', text: 'I rely primarily on experience and established knowledge' },
      { key: 'B', text: 'I follow industry news and attend occasional conferences' },
      { key: 'C', text: 'I actively pursue continuing education — courses, certifications, peer networks, reading' },
      { key: 'D', text: 'I systematically invest in learning and bring new knowledge back to my organization in a structured way' },
    ]
  },
  {
    id: 'C4', section: 'change',
    text: 'Have you led or collaborated effectively with teams spanning a wide range of career stages and ages?',
    options: [
      { key: 'A', text: 'My teams have been relatively uniform in career stage' },
      { key: 'B', text: 'Some generational diversity but not a defining feature of my leadership experience' },
      { key: 'C', text: 'Yes — I have led multigenerational teams and adapted my approach accordingly' },
      { key: 'D', text: 'Yes — and I view generational diversity as a deliberate strategic asset and have built teams with that in mind' },
    ]
  },
];

const BACKGROUND_QUESTIONS = [
  {
    id: 'B1', section: 'background',
    text: 'Which industry best describes your primary career experience?',
    options: [
      { key: 'A', text: 'Maritime & Shipping' },
      { key: 'B', text: 'Commodity Trading' },
      { key: 'C', text: 'Energy' },
      { key: 'D', text: 'Logistics & Supply Chain' },
      { key: 'E', text: 'Ports & Terminals' },
      { key: 'F', text: 'Offshore' },
    ]
  },
  {
    id: 'B2', section: 'background',
    text: 'Total years of professional experience:',
    options: [
      { key: 'A', text: 'Under 5 years' },
      { key: 'B', text: '5–10 years' },
      { key: 'C', text: '11–20 years' },
      { key: 'D', text: '21–30 years — Senior Career Professional' },
      { key: 'E', text: '30+ years — Senior Career Professional' },
    ]
  },
  {
    id: 'B3', section: 'background',
    text: 'Years in a senior or executive-level role:',
    options: [
      { key: 'A', text: 'None yet' },
      { key: 'B', text: '1–3 years' },
      { key: 'C', text: '4–8 years' },
      { key: 'D', text: '9–15 years' },
      { key: 'E', text: '15+ years' },
    ]
  },
  {
    id: 'B4', section: 'background',
    text: 'Highest level of formal education:',
    options: [
      { key: 'A', text: 'High school diploma or equivalent' },
      { key: 'B', text: 'Associate degree or vocational certification' },
      { key: 'C', text: 'Bachelor\'s degree' },
      { key: 'D', text: 'Master\'s degree' },
      { key: 'E', text: 'Doctoral degree or professional designation (JD, CPA, etc.)' },
    ]
  },
  {
    id: 'B5', section: 'background',
    text: 'Which best describes the geographic scope of your career experience?',
    options: [
      { key: 'A', text: 'Single city or regional market' },
      { key: 'B', text: 'National (one country)' },
      { key: 'C', text: 'Multi-country or regional international' },
      { key: 'D', text: 'Global operations across multiple continents' },
    ]
  },
  {
    id: 'B6', section: 'background',
    text: 'What size organizations have you primarily worked in?',
    options: [
      { key: 'A', text: 'Startup or early-stage (under 50 employees)' },
      { key: 'B', text: 'Small to mid-size (50–500 employees)' },
      { key: 'C', text: 'Mid-market (500–5,000 employees)' },
      { key: 'D', text: 'Large enterprise (5,000+ employees)' },
      { key: 'E', text: 'Mixed — significant experience across multiple sizes' },
    ]
  },
];

const ALL_QUESTIONS = [...EXECUTIVE_QUESTIONS, ...TECHNOLOGY_QUESTIONS, ...CHANGE_QUESTIONS, ...BACKGROUND_QUESTIONS];
const TOTAL_Q = ALL_QUESTIONS.length;

const SECTIONS = [
  { id: 'identity', label: 'About You', questions: [] },
  { id: 'executive', label: 'Executive Fit', questions: EXECUTIVE_QUESTIONS },
  { id: 'technology', label: 'Technology', questions: TECHNOLOGY_QUESTIONS },
  { id: 'change', label: 'Adaptability', questions: CHANGE_QUESTIONS },
  { id: 'background', label: 'Background', questions: BACKGROUND_QUESTIONS },
  { id: 'intent', label: 'Career Intent', questions: [] },
  { id: 'review', label: 'Submit', questions: [] },
];

const SECTION_ORDER = SECTIONS.map(s => s.id);

const CAREER_INTENT_OPTIONS = [
  { key: 'focused', label: 'A', text: 'No — I am focused on roles within my current industry' },
  { key: 'open_adjacent', label: 'B', text: 'Yes — I am open to adjacent industries where my skills transfer' },
  { key: 'full_pivot', label: 'C', text: 'Yes — I am actively seeking a full industry pivot' },
  { key: 'cross_industry', label: 'D', text: 'My background is already cross-industry' },
];

const STATUS_OPTIONS = [
  { key: 'active', icon: '🟢', label: 'Active', desc: 'Actively looking for my next role' },
  { key: 'passive', icon: '🟡', label: 'Passive', desc: 'Open to the right opportunity' },
  { key: 'paused', icon: '⬜', label: 'Paused', desc: 'Not looking right now — hold my profile' },
];

// ── CONFIRM PAGE ────────────────────────────────────────────────
function ConfirmPage() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const cid = params.get('cid');

  const handleConfirm = async () => {
    setLoading(true);
    // In production: call /api/talent-candidates?action=confirm with the candidate's email
    // Here we simulate success
    await new Promise(r => setTimeout(r, 800));
    setDone(true);
    setLoading(false);
  };

  if (done) return (
    <div className="confirm-wrap">
      <div className="confirm-icon">✅</div>
      <div className="confirm-title">You're confirmed.</div>
      <div className="confirm-desc">Your profile is active and you'll continue to be matched against open searches.</div>
      <button className="confirm-btn" onClick={() => window.location.href = 'https://desk.fredheimtech.com'}>Return to Fredheim Desk</button>
    </div>
  );

  return (
    <div className="confirm-wrap">
      <div className="confirm-icon">👋</div>
      <div className="confirm-title">Still exploring?</div>
      <div className="confirm-desc">Just checking in — confirm you're still active and we'll keep matching you against the right searches. One click and you're done.</div>
      <button className="confirm-btn" onClick={handleConfirm} disabled={loading}>
        {loading ? 'Confirming…' : 'Yes, still looking →'}
      </button>
      <button className="pause-btn" onClick={() => window.location.href = '?view=status'}>Pause my profile instead</button>
    </div>
  );
}

// ── MAIN APP ────────────────────────────────────────────────────
function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');

  const [sectionIdx, setSectionIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [identity, setIdentity] = useState({ first_name: '', email: '', phone: '' });
  const [careerIntent, setCareerIntent] = useState(null);
  const [candidateStatus, setCandidateStatus] = useState('active');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);

  const currentSection = SECTIONS[sectionIdx];
  const answeredCount = Object.keys(answers).length;
  const progressPct = Math.round((answeredCount / TOTAL_Q) * 100);

  // Check if current section is complete
  const sectionComplete = () => {
    if (currentSection.id === 'identity') {
      return identity.first_name.trim() && identity.email.includes('@');
    }
    if (currentSection.id === 'intent') return !!careerIntent;
    if (currentSection.id === 'review') return true;
    return currentSection.questions.every(q => answers[q.id]);
  };

  const handleAnswer = (qId, key) => {
    setAnswers(prev => ({ ...prev, [qId]: key }));
  };

  const handleNext = () => {
    if (sectionIdx < SECTIONS.length - 1) {
      setSectionIdx(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (sectionIdx > 0) {
      setSectionIdx(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch('/api/talent-candidates?action=submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: identity.first_name,
          email: identity.email,
          phone: identity.phone,
          answers,
          career_intent: careerIntent,
          pivot_candidate: ['open_adjacent','full_pivot','cross_industry'].includes(careerIntent),
          status: candidateStatus,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Submission failed.');
      setScores(data.scores);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      // Show app-controlled messages as-is, but never surface raw network/runtime
      // exception text (e.g. "Failed to fetch") to the candidate.
      console.error('Questionnaire submit failed:', e);
      setError(e && e.name !== 'TypeError' && e.message
        ? e.message
        : 'We couldn’t submit your profile right now. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (view === 'talent-confirm') return (
    <>
      <nav className="nav">
        <a href="https://desk.fredheimtech.com" className="nav-brand">
          <div className="nav-mark"><BrandMark /></div>
          <div><div className="nav-name">Fredheim Desk</div><span className="nav-sub">Executive Match</span></div>
        </a>
      </nav>
      <div className="main"><ConfirmPage /></div>
    </>
  );

  if (submitted && scores) return (
    <>
      <nav className="nav">
        <a href="https://desk.fredheimtech.com" className="nav-brand">
          <div className="nav-mark"><BrandMark /></div>
          <div><div className="nav-name">Fredheim Desk</div><span className="nav-sub">Executive Match</span></div>
        </a>
      </nav>
      <div className="main">
        <div className="success-wrap">
          <div className="success-mark">✓</div>
          <div className="success-title">Your profile is active.</div>
          <div className="success-desc">
            You'll receive a confirmation email shortly. Recruiters will see your profile when searches match your answers. You control when — and if — your identity is shared.
          </div>

          <div className="success-detail">
            <div className="score-composite">{scores.score_composite}%</div>
            <div className="score-composite-label">Composite Match Score</div>

            <div className="badge-row">
              {scores.badge_seasoned_exec && <span className="badge badge-gold">⭐ Seasoned Executive</span>}
              {scores.badge_tech_forward && <span className="badge badge-green">⚡ Tech Forward</span>}
              {['open_adjacent','full_pivot','cross_industry'].includes(careerIntent) && <span className="badge badge-blue">↗ Pivot Candidate</span>}
            </div>

            <div className="score-row">
              <span className="score-label">Executive Fit (40%)</span>
              <span className="score-value">{scores.score_executive_fit}%</span>
            </div>
            <div className="score-row">
              <span className="score-label">Technology Fluency (20%)</span>
              <span className="score-value">{scores.score_technology}%</span>
            </div>
            <div className="score-row">
              <span className="score-label">Change & Adaptability (20%)</span>
              <span className="score-value">{scores.score_change_mgmt}%</span>
            </div>
            <div className="score-row">
              <span className="score-label">Background & Experience (20%)</span>
              <span className="score-value">{scores.score_background}%</span>
            </div>
          </div>

          <p style={{fontSize:'0.78rem',color:'var(--ink-4)',lineHeight:1.6}}>
            We'll check in with you every 45 days to confirm you're still active. No action needed until then. You can update your profile at any time by returning to this page.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <a href="https://desk.fredheimtech.com" className="nav-brand">
          <div className="nav-mark"><BrandMark /></div>
          <div>
            <div className="nav-name">Fredheim Desk</div>
            <span className="nav-sub">Executive Match</span>
          </div>
        </a>
        <button className="nav-back" onClick={() => window.location.href = 'https://desk.fredheimtech.com'}>← Back to Desk</button>
      </nav>

      {/* PROGRESS */}
      <div className="progress-wrap">
        <div className="progress-header">
          <span className="progress-label">Profile completion</span>
          <span className="progress-pct">{progressPct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="section-tabs">
          {SECTIONS.map((s, i) => (
            <div key={s.id} className={`section-tab ${i === sectionIdx ? 'active' : i < sectionIdx ? 'done' : ''}`}>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="main">

        {/* ── IDENTITY ── */}
        {currentSection.id === 'identity' && (
          <>
            <div className="section-eyebrow">Step 1 of {SECTIONS.length}</div>
            <h1 className="section-title">Let's start with<br /><em>the basics.</em></h1>
            <p className="section-desc">No resume required. Your identity is kept confidential and never shared with recruiters without your consent.</p>
            <div className="identity-form">
              <div className="field-group">
                <label className="field-label">First Name *</label>
                <input className="field-input" placeholder="Your first name" value={identity.first_name}
                  onChange={e => setIdentity(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Email Address *</label>
                  <input className="field-input" type="email" placeholder="you@example.com" value={identity.email}
                    onChange={e => setIdentity(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label className="field-label">Phone (optional)</label>
                  <input className="field-input" type="tel" placeholder="+1 (000) 000-0000" value={identity.phone}
                    onChange={e => setIdentity(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── QUESTION SECTIONS ── */}
        {['executive','technology','change','background'].includes(currentSection.id) && (
          <>
            <div className="section-eyebrow">
              {currentSection.id === 'executive' && 'Section 1 — Executive Fit'}
              {currentSection.id === 'technology' && 'Section 2 — Technology Fluency'}
              {currentSection.id === 'change' && 'Section 3 — Change & Adaptability'}
              {currentSection.id === 'background' && 'Section 4 — Background & Experience'}
            </div>
            <h1 className="section-title">
              {currentSection.id === 'executive' && <>What does your<br /><em>authority look like?</em></>}
              {currentSection.id === 'technology' && <>How do you work<br /><em>with technology?</em></>}
              {currentSection.id === 'change' && <>How do you lead<br /><em>through change?</em></>}
              {currentSection.id === 'background' && <>Tell us about<br /><em>your background.</em></>}
            </h1>
            <p className="section-desc">
              {currentSection.id === 'executive' && 'Select the answer that best reflects your most senior or recent executive role.'}
              {currentSection.id === 'technology' && 'Honest answers serve you best. Recruiters weight technology fluency for senior roles.'}
              {currentSection.id === 'change' && 'The ability to adapt and lead through change is a defining executive trait.'}
              {currentSection.id === 'background' && 'Experience depth matters — including decades of it. There is no ceiling here.'}
            </p>

            {currentSection.questions.map((q, qi) => (
              <div key={q.id} className={`question-card ${answers[q.id] ? 'answered' : ''}`}>
                <div className="q-number">{q.id} · Question {qi + 1} of {currentSection.questions.length}</div>
                <div className="q-text">{q.text}</div>
                <div className="q-options">
                  {q.options.map(opt => (
                    <div
                      key={opt.key}
                      className={`q-option ${answers[q.id] === opt.key ? 'selected' : ''}`}
                      onClick={() => handleAnswer(q.id, opt.key)}
                    >
                      <span className="q-option-key">{opt.key}</span>
                      <span className="q-option-text">{opt.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── CAREER INTENT ── */}
        {currentSection.id === 'intent' && (
          <>
            <div className="section-eyebrow">Almost done</div>
            <h1 className="section-title">Industry focus<br /><em>and intent.</em></h1>
            <p className="section-desc">This helps recruiters understand whether you're open to opportunities outside your primary industry. Your answer is displayed on your profile.</p>

            <div className="pivot-card">
              <div className="pivot-label">Career Intent</div>
              <div className="pivot-title">Are you open to or actively seeking a role in a different industry than your primary background?</div>
              <div className="pivot-options">
                {CAREER_INTENT_OPTIONS.map(opt => (
                  <div
                    key={opt.key}
                    className={`pivot-option ${careerIntent === opt.key ? 'selected' : ''}`}
                    onClick={() => setCareerIntent(opt.key)}
                  >
                    <span className="pivot-option-key">{opt.label}</span>
                    <span className="pivot-option-text">{opt.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pivot-label" style={{marginBottom:'0.75rem'}}>Your current availability</div>
            <div className="status-cards">
              {STATUS_OPTIONS.map(s => (
                <div
                  key={s.key}
                  className={`status-card ${candidateStatus === s.key ? 'selected' : ''}`}
                  onClick={() => setCandidateStatus(s.key)}
                >
                  <div className="status-icon">{s.icon}</div>
                  <span className="status-label">{s.label}</span>
                  <div className="status-desc">{s.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── REVIEW & SUBMIT ── */}
        {currentSection.id === 'review' && (
          <>
            <div className="section-eyebrow">Final step</div>
            <h1 className="section-title">Review and<br /><em>submit your profile.</em></h1>
            <p className="section-desc">
              You've answered {answeredCount} of {TOTAL_Q} questions. Your profile will be immediately matched against active searches.
              You'll receive a confirmation email and can update your answers at any time.
            </p>

            <div className="success-detail" style={{marginBottom:'1.5rem'}}>
              <div className="score-row"><span className="score-label">Name</span><span className="score-value" style={{color:'var(--ink)'}}>{identity.first_name}</span></div>
              <div className="score-row"><span className="score-label">Email</span><span className="score-value" style={{color:'var(--ink)',fontFamily:'Figtree'}}>{identity.email}</span></div>
              <div className="score-row"><span className="score-label">Questions answered</span><span className="score-value">{answeredCount} / {TOTAL_Q}</span></div>
              <div className="score-row"><span className="score-label">Career intent</span><span className="score-value" style={{color:'var(--ink-2)',fontSize:'0.78rem',fontFamily:'Figtree'}}>{CAREER_INTENT_OPTIONS.find(o => o.key === careerIntent)?.text || '—'}</span></div>
              <div className="score-row"><span className="score-label">Availability</span><span className="score-value" style={{color:'var(--ink-2)',fontFamily:'Figtree'}}>{STATUS_OPTIONS.find(s => s.key === candidateStatus)?.label}</span></div>
            </div>

            <p style={{fontSize:'0.78rem',color:'var(--ink-4)',lineHeight:1.7,marginBottom:'1rem'}}>
              By submitting, you agree to our Terms of Service and Privacy Policy. Your identity is confidential by default.
              We'll check in every 45 days to confirm you're still active — one click to confirm, nothing more.
            </p>

            {error && <p style={{color:'var(--red)',fontSize:'0.85rem',marginBottom:'1rem'}}>⚠ {error}</p>}
          </>
        )}

        {/* ── NAV BUTTONS ── */}
        <div className="nav-buttons">
          {sectionIdx > 0 ? (
            <button className="btn-prev" onClick={handlePrev}>← Back</button>
          ) : <span />}

          <span className="q-counter">
            {currentSection.questions.length > 0 &&
              `${currentSection.questions.filter(q => answers[q.id]).length} / ${currentSection.questions.length} answered`
            }
          </span>

          {currentSection.id !== 'review' ? (
            <button className="btn-next" onClick={handleNext} disabled={!sectionComplete()}>
              Continue →
            </button>
          ) : (
            <button className="btn-submit" onClick={handleSubmit} disabled={submitting || answeredCount < TOTAL_Q}>
              {submitting ? 'Submitting…' : 'Submit Profile →'}
            </button>
          )}
        </div>

      </div>

      <footer style={{borderTop:'1px solid var(--rule)',padding:'2rem 3rem',textAlign:'center'}}>
        <p style={{fontFamily:'DM Mono, monospace',fontSize:'0.6rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--ink-4)'}}>
          Fredheim Desk · desk.fredheimtech.com · Confidential by default
        </p>
      </footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
