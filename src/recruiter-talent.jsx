import React from "react"
import * as ReactDOM from "react-dom/client"
import * as supabase from "@supabase/supabase-js"

// Compat: existing inline code references `supabase.createClient` and `window.supabase.createClient`
window.supabase = supabase

// ──────────────────────────────────────────────────────────────────────
// Original inline <script type="text/babel"> body follows unchanged
// ──────────────────────────────────────────────────────────────────────


const { useState, useEffect, useCallback, useMemo } = React;

const SUPABASE_URL = 'https://bizbneqlzacvhekrbrgd.supabase.co';
const SUPABASE_ANON = 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry'; // replace with actual anon key

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { storageKey: 'fredheim-auth' }
});

// ── HELPERS ──────────────────────────────────────────────────────

const INDUSTRY_MAP = { A:'Maritime & Shipping', B:'Commodity Trading', C:'Energy', D:'Logistics & Supply Chain', E:'Ports & Terminals', F:'Offshore' };
const GEO_MAP = { A:'Regional', B:'National', C:'International', D:'Global' };
const SIZE_MAP = { A:'Startup', B:'SMB', C:'Mid-market', D:'Enterprise', E:'Mixed' };
const YEARS_MAP = { A:'<5 yrs', B:'5–10 yrs', C:'11–20 yrs', D:'21–30 yrs', E:'30+ yrs' };
const SENIOR_MAP = { A:'None', B:'1–3 yrs', C:'4–8 yrs', D:'9–15 yrs', E:'15+ yrs' };

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function freshnessInfo(candidate) {
  const days = daysSince(candidate.last_active_at);
  if (candidate.status === 'archived') return { label: 'Archived', dotClass: 'archived-dot', badgeClass: 'badge-red' };
  if (candidate.status === 'paused') return { label: 'Paused', dotClass: 'stale', badgeClass: 'badge-orange' };
  if (days <= 30) return { label: `Active ${days}d ago`, dotClass: 'fresh', badgeClass: 'badge-green' };
  if (days <= 60) return { label: `Passive ${days}d ago`, dotClass: 'passive-dot', badgeClass: 'badge-orange' };
  return { label: `Unconfirmed ${days}d ago`, dotClass: 'stale', badgeClass: 'badge-red' };
}

// SVG score ring
function ScoreRing({ pct }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;
  const color = pct >= 85 ? '#b8922a' : pct >= 70 ? '#d4a93c' : '#8fa0b4';
  return (
    <div className="score-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#eceae4" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round" />
      </svg>
      <div style={{textAlign:'center'}}>
        <div className="score-ring-num" style={{color}}>{pct}</div>
        <span className="score-ring-pct">match</span>
      </div>
    </div>
  );
}

// ── CANDIDATE DRAWER ─────────────────────────────────────────────
function CandidateDrawer({ candidate, match, onClose, onShortlist, onReject }) {
  if (!candidate) return null;
  const fresh = freshnessInfo(candidate);
  const a = candidate.answers || {};

  const QUESTION_LABELS = [
    ['Q1','Decision-making authority'],['Q2','P&L ownership'],['Q3','Strategy role'],
    ['Q4','Board/ownership interface'],['Q5','Team scale'],['Q6','Contract authority'],
    ['Q7','Cross-functional leadership'],['Q8','External representation'],
    ['Q9','Growth/transformation'],['Q10','Risk/crisis management'],
    ['T1','Digital tool adoption'],['T2','Data literacy'],['T3','AI/emerging tech'],['T4','Remote leadership'],
    ['C1','Leading change'],['C2','Industry shift navigation'],['C3','Learning agility'],['C4','Cross-generational leadership'],
    ['B1','Industry'],['B2','Total experience'],['B3','Senior/exec years'],['B4','Education'],['B5','Geographic scope'],['B6','Company size'],
  ];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <button className="drawer-close" onClick={onClose}>✕ Close</button>

        <div style={{marginBottom:'1.5rem'}}>
          <div className="drawer-name">{candidate.first_name}</div>
          <div className="card-badges" style={{marginBottom:'0.75rem'}}>
            {candidate.badge_seasoned_exec && <span className="badge badge-gold">⭐ Seasoned Executive</span>}
            {candidate.badge_tech_forward && <span className="badge badge-green">⚡ Tech Forward</span>}
            {candidate.badge_pivot && <span className="badge badge-blue">↗ Pivot Candidate</span>}
            <span className={`badge ${fresh.badgeClass}`}>{fresh.label}</span>
          </div>
          <div className="drawer-score-big">{match?.match_pct || candidate.score_composite}%</div>
          <span className="drawer-score-label">Composite Match Score</span>
        </div>

        <div className="drawer-section">
          <span className="drawer-section-title">Score Breakdown</span>
          {[
            ['Executive Fit', candidate.score_executive_fit, '40%'],
            ['Technology Fluency', candidate.score_technology, '20%'],
            ['Change & Adaptability', candidate.score_change_mgmt, '20%'],
            ['Background & Experience', candidate.score_background, '20%'],
          ].map(([label, val, weight]) => (
            <div key={label} className="score-bar-row">
              <span className="score-bar-label">{label} <span style={{color:'var(--ink-4)',fontSize:'0.7rem'}}>({weight})</span></span>
              <div className="score-bar-track">
                <div className="score-bar-fill" style={{width:`${val || 0}%`}} />
              </div>
              <span className="score-bar-val">{val || 0}%</span>
            </div>
          ))}
        </div>

        <div className="drawer-section">
          <span className="drawer-section-title">Profile Details</span>
          <div className="answer-row"><span className="answer-q">Industry</span><span className="answer-val">{INDUSTRY_MAP[a.B1] || '—'}</span></div>
          <div className="answer-row"><span className="answer-q">Total experience</span><span className="answer-val">{YEARS_MAP[a.B2] || '—'}</span></div>
          <div className="answer-row"><span className="answer-q">Senior/exec years</span><span className="answer-val">{SENIOR_MAP[a.B3] || '—'}</span></div>
          <div className="answer-row"><span className="answer-q">Geographic scope</span><span className="answer-val">{GEO_MAP[a.B5] || '—'}</span></div>
          <div className="answer-row"><span className="answer-q">Company size exp.</span><span className="answer-val">{SIZE_MAP[a.B6] || '—'}</span></div>
        </div>

        <div className="drawer-section">
          <span className="drawer-section-title">All Answers</span>
          {QUESTION_LABELS.map(([key, label]) => (
            <div key={key} className="answer-row">
              <span className="answer-q">{label}</span>
              <span className="answer-val">{a[key] || '—'}</span>
            </div>
          ))}
        </div>

        <div className="drawer-section">
          <span className="drawer-section-title">Career Intent</span>
          <p style={{fontSize:'0.85rem',color:'var(--ink-2)'}}>
            {candidate.career_intent === 'focused' && 'Focused on their current industry.'}
            {candidate.career_intent === 'open_adjacent' && 'Open to adjacent industries where skills transfer.'}
            {candidate.career_intent === 'full_pivot' && 'Actively seeking a full industry pivot.'}
            {candidate.career_intent === 'cross_industry' && 'Already cross-industry background.'}
            {!candidate.career_intent && '—'}
          </p>
        </div>

        <div className="drawer-action-row">
          <button className="drawer-btn drawer-btn-shortlist" onClick={() => onShortlist(candidate.id)}>⭐ Shortlist</button>
          <button className="drawer-btn drawer-btn-reject" onClick={() => onReject(candidate.id)}>Reject</button>
        </div>
      </div>
    </>
  );
}

// ── NOTIFICATIONS PANEL ──────────────────────────────────────────
function NotificationsPanel({ prefs, onSave }) {
  const [p, setP] = useState(prefs);
  const toggle = key => setP(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="notif-panel">
      <h2 style={{fontFamily:'Playfair Display',fontSize:'1.5rem',marginBottom:'0.5rem'}}>Notification Preferences</h2>
      <p style={{color:'var(--ink-3)',fontSize:'0.875rem',marginBottom:'2rem'}}>
        Control how and when you're notified of new matches. Changes apply to all active searches unless overridden per role.
      </p>

      <div className="notif-section">
        <div className="notif-section-title">Real-Time Alerts</div>
        <div className="notif-section-desc">Immediate email when a candidate scores above your threshold. Best for urgent or hard-to-fill searches.</div>
        <div className="toggle-row">
          <span className="toggle-label">Enable real-time email alerts</span>
          <div className={`toggle ${p.notify_realtime ? 'on' : ''}`} onClick={() => toggle('notify_realtime')} />
        </div>
        {p.notify_realtime && (
          <div className="filter-group" style={{marginTop:'0.875rem'}}>
            <label className="filter-label">Alert threshold — only notify above this score</label>
            <div className="slider-wrap">
              <input type="range" className="slider" min="50" max="98" step="5"
                value={p.notify_realtime_threshold}
                onChange={e => setP(prev => ({ ...prev, notify_realtime_threshold: Number(e.target.value) }))} />
              <span className="slider-val">{p.notify_realtime_threshold}% match</span>
            </div>
          </div>
        )}
        <div className="toggle-row" style={{marginTop:'0.75rem'}}>
          <span className="toggle-label">Enable SMS alerts (90%+ matches)</span>
          <div className={`toggle ${p.notify_sms ? 'on' : ''}`} onClick={() => toggle('notify_sms')} />
        </div>
      </div>

      <div className="notif-section">
        <div className="notif-section-title">Daily Digest</div>
        <div className="notif-section-desc">Morning summary of all new candidates from the prior 24 hours, ranked by match score. No login required to review the list.</div>
        <div className="toggle-row">
          <div className={`toggle ${p.notify_daily ? 'on' : ''}`} onClick={() => toggle('notify_daily')} />
          <span className="toggle-label" style={{marginLeft:'0.75rem'}}>Send daily digest email</span>
        </div>
      </div>

      <div className="notif-section">
        <div className="notif-section-title">Weekly Pipeline Report</div>
        <div className="notif-section-desc">Monday morning report covering total candidates, match tier breakdown, Seasoned Executive count, pivot candidate count, and unreviewed flags.</div>
        <div className="toggle-row">
          <div className={`toggle ${p.notify_weekly ? 'on' : ''}`} onClick={() => toggle('notify_weekly')} />
          <span className="toggle-label" style={{marginLeft:'0.75rem'}}>Send weekly summary every Monday</span>
        </div>
      </div>

      <div className="notif-section">
        <div className="notif-section-title">Candidate Freshness Alerts</div>
        <div className="notif-section-desc">
          These are automatic and cannot be disabled — they protect you from reaching out to stale candidates.
          Candidates are flagged at 30 days, re-engaged at 45/60/85 days, and archived at 90 days.
        </div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginTop:'0.5rem'}}>
          <span className="badge badge-green">🟢 Active ≤30d</span>
          <span className="badge badge-orange">🟡 Passive 31–60d</span>
          <span className="badge badge-red">🟠 Unconfirmed 61–90d</span>
          <span className="badge" style={{color:'var(--ink-4)',borderColor:'var(--rule)',background:'var(--paper)'}}>⬜ Archived 90d+</span>
        </div>
      </div>

      <button
        onClick={() => onSave(p)}
        style={{background:'var(--ink)',color:'var(--white)',border:'none',padding:'0.85rem 2.5rem',fontFamily:'Figtree',fontSize:'0.85rem',fontWeight:'600',cursor:'pointer'}}
      >
        Save Preferences
      </button>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────
function App() {
  const [activeTab, setActiveTab] = useState('candidates'); // candidates | shortlisted | notifications
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState('match_pct');
  const [minPct, setMinPct] = useState(50);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPivot, setShowPivot] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState({
    notify_realtime: true,
    notify_realtime_threshold: 85,
    notify_sms: false,
    notify_daily: true,
    notify_weekly: true,
  });
  const [toast, setToast] = useState(null);

  // Demo data — replace with Supabase fetch in production
  const DEMO_MATCHES = [
    {
      id: '1', match_pct: 94, recruiter_status: 'new',
      talent_candidates: {
        id: 'c1', first_name: 'James', status: 'active', last_active_at: new Date(Date.now() - 2*86400000).toISOString(),
        score_executive_fit: 97, score_technology: 88, score_change_mgmt: 92, score_background: 95, score_composite: 94,
        badge_seasoned_exec: true, badge_tech_forward: true, badge_pivot: false,
        career_intent: 'focused',
        answers: { Q1:'D',Q2:'D',Q3:'D',Q4:'C',Q5:'C',Q6:'D',Q7:'D',Q8:'C',Q9:'D',Q10:'C', T1:'D',T2:'C',T3:'C',T4:'C', C1:'D',C2:'C',C3:'C',C4:'C', B1:'A',B2:'E',B3:'E',B4:'C',B5:'D',B6:'D' }
      }
    },
    {
      id: '2', match_pct: 88, recruiter_status: 'viewed',
      talent_candidates: {
        id: 'c2', first_name: 'Sarah', status: 'active', last_active_at: new Date(Date.now() - 8*86400000).toISOString(),
        score_executive_fit: 90, score_technology: 92, score_change_mgmt: 88, score_background: 80, score_composite: 88,
        badge_seasoned_exec: false, badge_tech_forward: true, badge_pivot: true,
        career_intent: 'open_adjacent',
        answers: { Q1:'C',Q2:'C',Q3:'D',Q4:'C',Q5:'C',Q6:'C',Q7:'D',Q8:'D',Q9:'C',Q10:'C', T1:'D',T2:'D',T3:'D',T4:'C', C1:'C',C2:'D',C3:'D',C4:'C', B1:'C',B2:'D',B3:'D',B4:'D',B5:'C',B6:'C' }
      }
    },
    {
      id: '3', match_pct: 82, recruiter_status: 'new',
      talent_candidates: {
        id: 'c3', first_name: 'Robert', status: 'passive', last_active_at: new Date(Date.now() - 38*86400000).toISOString(),
        score_executive_fit: 85, score_technology: 70, score_change_mgmt: 82, score_background: 90, score_composite: 82,
        badge_seasoned_exec: true, badge_tech_forward: false, badge_pivot: false,
        career_intent: 'focused',
        answers: { Q1:'D',Q2:'D',Q3:'C',Q4:'D',Q5:'D',Q6:'D',Q7:'C',Q8:'D',Q9:'C',Q10:'D', T1:'B',T2:'B',T3:'B',T4:'B', C1:'C',C2:'C',C3:'B',C4:'C', B1:'A',B2:'E',B3:'E',B4:'C',B5:'C',B6:'D' }
      }
    },
    {
      id: '4', match_pct: 76, recruiter_status: 'shortlisted',
      talent_candidates: {
        id: 'c4', first_name: 'Patricia', status: 'active', last_active_at: new Date(Date.now() - 12*86400000).toISOString(),
        score_executive_fit: 78, score_technology: 82, score_change_mgmt: 75, score_background: 70, score_composite: 76,
        badge_seasoned_exec: false, badge_tech_forward: true, badge_pivot: true,
        career_intent: 'full_pivot',
        answers: { Q1:'C',Q2:'B',Q3:'C',Q4:'B',Q5:'C',Q6:'C',Q7:'C',Q8:'C',Q9:'C',Q10:'B', T1:'C',T2:'C',T3:'D',T4:'D', C1:'C',C2:'C',C3:'D',C4:'D', B1:'F',B2:'D',B3:'C',B4:'D',B5:'C',B6:'C' }
      }
    },
    {
      id: '5', match_pct: 65, recruiter_status: 'new',
      talent_candidates: {
        id: 'c5', first_name: 'Michael', status: 'active', last_active_at: new Date(Date.now() - 5*86400000).toISOString(),
        score_executive_fit: 65, score_technology: 60, score_change_mgmt: 68, score_background: 72, score_composite: 65,
        badge_seasoned_exec: false, badge_tech_forward: false, badge_pivot: false,
        career_intent: 'focused',
        answers: { Q1:'B',Q2:'C',Q3:'B',Q4:'B',Q5:'B',Q6:'B',Q7:'C',Q8:'B',Q9:'B',Q10:'B', T1:'B',T2:'B',T3:'B',T4:'B', C1:'B',C2:'B',C3:'C',C4:'B', B1:'B',B2:'C',B3:'C',B4:'C',B5:'B',B6:'B' }
      }
    },
  ];

  useEffect(() => {
    // In production, fetch from Supabase: talent_matches join talent_candidates
    setTimeout(() => { setMatches(DEMO_MATCHES); setLoading(false); }, 600);
  }, []);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filteredMatches = useMemo(() => {
    let list = matches.filter(m => {
      const c = m.talent_candidates;
      if (m.match_pct < minPct) return false;
      if (!showPivot && c.badge_pivot) return false;
      if (statusFilter === 'shortlisted' && m.recruiter_status !== 'shortlisted') return false;
      if (statusFilter === 'new' && m.recruiter_status !== 'new') return false;
      if (statusFilter === 'active' && c.status !== 'active') return false;
      return true;
    });
    if (sort === 'match_pct') list = list.sort((a,b) => b.match_pct - a.match_pct);
    if (sort === 'newest') list = list.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
    if (sort === 'freshest') list = list.sort((a,b) => new Date(b.talent_candidates.last_active_at||0) - new Date(a.talent_candidates.last_active_at||0));
    return list;
  }, [matches, minPct, showPivot, statusFilter, sort]);

  const stats = useMemo(() => ({
    total: matches.length,
    tier90: matches.filter(m => m.match_pct >= 90).length,
    seasoned: matches.filter(m => m.talent_candidates.badge_seasoned_exec).length,
    unreviewed: matches.filter(m => m.recruiter_status === 'new').length,
    pivot: matches.filter(m => m.talent_candidates.badge_pivot).length,
  }), [matches]);

  const handleShortlist = id => {
    setMatches(prev => prev.map(m => m.talent_candidates.id === id ? { ...m, recruiter_status: 'shortlisted' } : m));
    setSelected(null);
    showToast('Candidate shortlisted.');
  };

  const handleReject = id => {
    setMatches(prev => prev.map(m => m.talent_candidates.id === id ? { ...m, recruiter_status: 'rejected' } : m));
    setSelected(null);
    showToast('Candidate rejected.');
  };

  const selectedMatch = selected ? matches.find(m => m.talent_candidates.id === selected) : null;

  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <a href="https://desk.fredheimtech.com" className="nav-brand">
          <div className="nav-mark"><BrandMark /></div>
          <div>
            <div className="nav-name">Fredheim Desk</div>
            <span className="nav-sub">Talent Match · Hiring View</span>
          </div>
        </a>
        <div className="nav-right">
          <button className={`nav-pill ${activeTab === 'candidates' ? 'active' : ''}`} onClick={() => setActiveTab('candidates')}>Candidates</button>
          <button className={`nav-pill ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>Notifications</button>
          <button className="nav-pill" onClick={() => window.location.href = 'https://desk.fredheimtech.com'}>← Main Desk</button>
        </div>
      </nav>

      <div className="layout">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <span className="sidebar-title">Pipeline Summary</span>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-val">{stats.total}</div><span className="stat-label">Total</span></div>
              <div className="stat-card"><div className="stat-val">{stats.tier90}</div><span className="stat-label">90%+</span></div>
              <div className="stat-card"><div className="stat-val">{stats.seasoned}</div><span className="stat-label">Seasoned Exec</span></div>
              <div className="stat-card"><div className="stat-val">{stats.unreviewed}</div><span className="stat-label">Unreviewed</span></div>
            </div>
          </div>

          {activeTab === 'candidates' && (
            <div className="sidebar-section">
              <span className="sidebar-title">Filters</span>

              <div className="filter-group">
                <label className="filter-label">Minimum match score</label>
                <div className="slider-wrap">
                  <input type="range" className="slider" min="40" max="98" step="5"
                    value={minPct} onChange={e => setMinPct(Number(e.target.value))} />
                  <span className="slider-val">{minPct}%+</span>
                </div>
              </div>

              <div className="filter-group">
                <label className="filter-label">Status filter</label>
                <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="all">All candidates</option>
                  <option value="new">New / Unreviewed</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="active">Active candidates only</option>
                </select>
              </div>

              <div className="toggle-row">
                <span className="toggle-label" style={{fontSize:'0.82rem'}}>Show pivot candidates</span>
                <div className={`toggle ${showPivot ? 'on' : ''}`} onClick={() => setShowPivot(p => !p)} />
              </div>

              <div style={{marginTop:'1.25rem',padding:'0.875rem',background:'var(--gold-bg)',border:'1px solid var(--gold-rule)'}}>
                <p style={{fontSize:'0.72rem',color:'var(--ink-3)',lineHeight:1.55}}>
                  <strong style={{color:'var(--gold)'}}>⭐ Seasoned Executive</strong> — 20+ years experience with 9+ years in senior roles. Never filtered by default.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* MAIN PANEL */}
        <div className="panel">

          {activeTab === 'candidates' && (
            <>
              <div className="toolbar">
                <div>
                  <div className="toolbar-title">Candidate Pipeline</div>
                  <div style={{fontFamily:'DM Mono',fontSize:'0.62rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--ink-4)',marginTop:'0.25rem'}}>
                    {loading ? 'Loading…' : `${filteredMatches.length} of ${matches.length} candidates`}
                  </div>
                </div>
                <div className="toolbar-right">
                  <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                    <option value="match_pct">Sort: Match Score</option>
                    <option value="newest">Sort: Newest</option>
                    <option value="freshest">Sort: Most Recent Activity</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
              ) : filteredMatches.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-title">No candidates match your filters.</div>
                  <div className="empty-desc">Try lowering the minimum match score or adjusting status filters.</div>
                </div>
              ) : (
                <div className="candidates-grid">
                  {filteredMatches.map(m => {
                    const c = m.talent_candidates;
                    const fresh = freshnessInfo(c);
                    const daysSinceViewed = m.recruiter_status === 'new' ? daysSince(m.created_at) : 0;
                    return (
                      <div key={m.id}
                        className={`candidate-card ${m.recruiter_status === 'viewed' ? 'viewed' : ''}`}
                        onClick={() => {
                          setSelected(c.id);
                          setMatches(prev => prev.map(x => x.id === m.id ? {...x, recruiter_status: x.recruiter_status === 'new' ? 'viewed' : x.recruiter_status} : x));
                        }}
                      >
                        <ScoreRing pct={m.match_pct} />

                        <div className="card-body">
                          <div className="card-name" style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                            {c.first_name}
                            {daysSinceViewed > 7 && m.recruiter_status === 'new' && <span className="stale-flag">Unreviewed {daysSinceViewed}d</span>}
                          </div>
                          <div className="card-badges">
                            {c.badge_seasoned_exec && <span className="badge badge-gold">⭐ Seasoned Executive</span>}
                            {c.badge_tech_forward && <span className="badge badge-green">⚡ Tech Forward</span>}
                            {c.badge_pivot && <span className="badge badge-blue">↗ Pivot</span>}
                            <span className={`badge ${fresh.badgeClass}`}>
                              <span className="freshness-dot" style={{display:'inline-block',verticalAlign:'middle',marginRight:'4px',width:'6px',height:'6px',borderRadius:'50'}} />
                              {fresh.label}
                            </span>
                            {m.recruiter_status === 'shortlisted' && <span className="badge badge-gold">Shortlisted</span>}
                          </div>
                          <div className="card-scores">
                            <span className="card-score-item">Exec <strong>{c.score_executive_fit}%</strong></span>
                            <span className="card-score-item">Tech <strong>{c.score_technology}%</strong></span>
                            <span className="card-score-item">Change <strong>{c.score_change_mgmt}%</strong></span>
                            <span className="card-score-item">Background <strong>{c.score_background}%</strong></span>
                          </div>
                          <div className="card-meta">
                            {INDUSTRY_MAP[c.answers?.B1] || 'Industry not specified'} · {YEARS_MAP[c.answers?.B2] || '—'} experience · {GEO_MAP[c.answers?.B5] || '—'} scope
                          </div>
                        </div>

                        <div className="card-actions" onClick={e => e.stopPropagation()}>
                          {m.recruiter_status !== 'shortlisted' && (
                            <button className="action-btn action-btn-shortlist" onClick={() => handleShortlist(c.id)}>⭐ Shortlist</button>
                          )}
                          <button className="action-btn action-btn-reject" onClick={() => handleReject(c.id)}>Reject</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'notifications' && (
            <NotificationsPanel
              prefs={notifPrefs}
              onSave={p => { setNotifPrefs(p); showToast('Notification preferences saved.'); }}
            />
          )}

        </div>
      </div>

      {/* CANDIDATE DRAWER */}
      {selected && selectedMatch && (
        <CandidateDrawer
          candidate={selectedMatch.talent_candidates}
          match={selectedMatch}
          onClose={() => setSelected(null)}
          onShortlist={handleShortlist}
          onReject={handleReject}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{position:'fixed',bottom:'2rem',left:'50%',transform:'translateX(-50%)',background:'var(--ink)',color:'var(--white)',padding:'0.75rem 2rem',fontFamily:'DM Mono',fontSize:'0.7rem',letterSpacing:'0.1em',textTransform:'uppercase',zIndex:999}}>
          {toast}
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
