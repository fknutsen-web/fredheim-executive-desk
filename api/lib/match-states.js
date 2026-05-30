// api/lib/match-states.js
// Canonical match state machine for fed_matches.status — the single source of
// truth for valid states and the transitions between them.
//
// Enforcement points today live inline in api/match-action.js (each action
// checks the current status before transitioning). This module documents the
// full machine and provides validators those handlers can use, so the rules
// live in one place rather than being implied by scattered string literals.

const MATCH_STATES = Object.freeze({
  MATCHED:              'matched',               // engine created the match; no signal yet
  RECRUITER_INTERESTED: 'recruiter_interested',  // recruiter signaled interest
  CANDIDATE_INTERESTED: 'candidate_interested',  // candidate signaled interest
  MUTUAL_INTEREST:      'mutual_interest',        // both signaled — candidate approval required next
  AWAITING_PAYMENT:     'awaiting_payment',       // candidate approved the introduction; payment may now be created
  CANDIDATE_DECLINED:   'candidate_declined',     // candidate declined recruiter interest
  CANDIDATE_WITHDREW:   'candidate_withdrew',     // candidate withdrew before payment — no charge, no reveal
  RECRUITER_WITHDRAWN:  'recruiter_withdrawn',    // recruiter withdrew interest
  CANDIDATE_HIDDEN:     'candidate_hidden',       // candidate hid the match (spec alias: "hidden")
  PAID_UNLOCKED:        'paid_unlocked',          // introduction fee paid — contact unlock
  INTRODUCED:           'introduced',             // identities revealed; introduction delivered
  EXPIRED:              'expired',                // job closed/expired — match removed from matching
  CLOSED:               'closed',                 // terminal close (Phase 3 / lifecycle)
});

// Spec uses the short name "hidden"; the implementation uses "candidate_hidden".
// Both resolve to the same canonical state.
const STATE_ALIASES = Object.freeze({
  hidden: MATCH_STATES.CANDIDATE_HIDDEN,
});

const VALID_MATCH_STATES = Object.freeze(Object.values(MATCH_STATES));

// Allowed forward transitions. Empty array = terminal state.
const MATCH_TRANSITIONS = Object.freeze({
  matched:               ['recruiter_interested', 'candidate_interested', 'candidate_hidden', 'expired', 'closed'],
  recruiter_interested:  ['mutual_interest', 'candidate_declined', 'recruiter_withdrawn', 'candidate_hidden', 'expired', 'closed'],
  candidate_interested:  ['mutual_interest', 'recruiter_withdrawn', 'candidate_hidden', 'expired', 'closed'],
  // Both interested -> candidate must APPROVE the introduction before any payment.
  mutual_interest:       ['awaiting_payment', 'candidate_withdrew', 'recruiter_withdrawn', 'expired', 'closed'],
  // Candidate approved; recruiter may now pay. Candidate can still withdraw.
  awaiting_payment:      ['paid_unlocked', 'candidate_withdrew', 'recruiter_withdrawn', 'expired', 'closed'],
  paid_unlocked:         ['introduced', 'closed'],
  introduced:            ['closed'],
  candidate_declined:    ['closed'],
  candidate_withdrew:    ['closed'],
  recruiter_withdrawn:   ['closed'],
  candidate_hidden:      ['closed'],
  expired:               [],
  closed:                [],
});

// Normalize a possibly-aliased state name to its canonical value.
function normalizeState(state) {
  return STATE_ALIASES[state] || state;
}

function isValidMatchState(state) {
  return VALID_MATCH_STATES.includes(normalizeState(state));
}

// Is `to` a permitted transition from `from`? Unknown `from` returns false.
function canTransition(from, to) {
  const allowed = MATCH_TRANSITIONS[normalizeState(from)];
  return Array.isArray(allowed) && allowed.includes(normalizeState(to));
}

module.exports = {
  MATCH_STATES,
  STATE_ALIASES,
  VALID_MATCH_STATES,
  MATCH_TRANSITIONS,
  normalizeState,
  isValidMatchState,
  canTransition,
};
