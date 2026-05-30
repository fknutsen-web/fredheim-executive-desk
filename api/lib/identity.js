// api/lib/identity.js
// Server-side candidate identity protection. The canonical rule for whether a
// candidate's contact/identity may be revealed to a recruiter, plus a redaction
// helper for any server code that returns candidate data.
//
// The PRIMARY enforcement is in Postgres (see fed-phase3-secure-views.sql and
// fed-phase3-rls-lockdown.sql). This module is the matching server-side guard
// so API routes never emit PII before the unlock condition is met.

// Fields that must never be exposed to a recruiter before unlock.
const PROTECTED_FIELDS = [
  'name', 'first_name', 'last_name', 'full_name',
  'email', 'candidate_email', 'phone', 'phone_number',
  'current_company', 'employer', 'company',
  'exact_location',
  'date_of_birth', 'dob', 'age',
  'gender', 'sex',
  'linkedin_url', 'linkedin',
  'resume_url', 'cv_url', 'resume', 'cv',
];

// THE unlock rule. Contact may be revealed only when the match is paid_unlocked
// or introduced, or a valid paid-introduction record exists.
function isUnlocked(match, paidIntro) {
  if (!match) return false;
  if (match.status === 'paid_unlocked' || match.status === 'introduced') return true;
  if (match.unlocked_at) return true;
  if (paidIntro && paidIntro.status === 'paid') return true;
  return false;
}

// Return a copy of a candidate profile with protected fields stripped unless
// unlocked. Always provides a safe display_name honoring confidentiality flags.
function redactCandidate(profile, { unlocked = false } = {}) {
  if (!profile) return profile;
  const displayName = profile.conf_anonymous
    ? 'Confidential Executive'
    : (profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Confidential Candidate');

  if (unlocked) {
    return { ...profile, display_name: displayName };
  }

  const safe = { ...profile };
  for (const f of PROTECTED_FIELDS) {
    if (f in safe) delete safe[f];
  }
  safe.display_name = displayName;
  safe.is_locked = true;
  return safe;
}

module.exports = { PROTECTED_FIELDS, isUnlocked, redactCandidate };
