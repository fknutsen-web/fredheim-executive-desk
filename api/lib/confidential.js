// api/lib/confidential.js
// Confidential employer mode + location masking. Jobs are confidential by
// default: the real company name is never shown to candidates, and exact
// locations are generalized to a region.

// ── LOCATION MASKING ──────────────────────────────────────────────
// Exact city -> broad region. Extend as needed.
const LOCATION_MASK = {
  'miami': 'South Florida',
  'fort lauderdale': 'South Florida',
  'houston': 'U.S. Gulf Coast',
  'new orleans': 'U.S. Gulf Coast',
  'galveston': 'U.S. Gulf Coast',
  'antwerp': 'Northwestern Europe',
  'rotterdam': 'Northwestern Europe',
  'hamburg': 'Northwestern Europe',
  'singapore': 'Southeast Asia',
  'kuala lumpur': 'Southeast Asia',
  'jakarta': 'Southeast Asia',
  'new york': 'U.S. Northeast',
  'london': 'United Kingdom',
  'dubai': 'Middle East',
  'shanghai': 'East Asia',
  'hong kong': 'East Asia',
  'piraeus': 'Eastern Mediterranean',
  'athens': 'Eastern Mediterranean',
  'oslo': 'Scandinavia',
  'copenhagen': 'Scandinavia',
};

// Return the masked region for a location string. If no known city matches,
// fall back to the country/region segment (after the last comma) or a generic.
function maskLocation(location) {
  if (!location) return 'Undisclosed Region';
  const lc = String(location).toLowerCase();
  for (const [city, region] of Object.entries(LOCATION_MASK)) {
    if (lc.includes(city)) return region;
  }
  const parts = String(location).split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1]; // country/region
  return 'Undisclosed Region';
}

// ── CONFIDENTIAL EMPLOYER DESCRIPTORS ─────────────────────────────
// Known names -> generic descriptor. Anything not listed becomes a generic
// "Confidential Employer" so the real identity is never leaked by default.
const EMPLOYER_DESCRIPTORS = {
  'cobelfret': 'International Dry Bulk Owner/Operator',
  'oldendorff': 'International Dry Bulk Owner/Operator',
  'berge bulk': 'International Dry Bulk Owner/Operator',
  'pacific basin': 'International Dry Bulk Owner/Operator',
  'abs': 'Global Classification Society',
  'dnv': 'Maritime Technology & Classification Provider',
  'bureau veritas': 'Global Classification Society',
  'lloyd': 'Global Classification Society',
  'maersk': 'Global Container Line',
  'msc': 'Global Container Line',
  'cma cgm': 'Global Container Line',
};

// Resolve the candidate-facing employer label. Prefers an explicit
// recruiter-supplied descriptor; otherwise a known mapping; otherwise generic.
function employerDescriptor(realName, explicitDescriptor) {
  if (explicitDescriptor && String(explicitDescriptor).trim()) return String(explicitDescriptor).trim();
  if (realName) {
    const lc = String(realName).toLowerCase();
    for (const [name, desc] of Object.entries(EMPLOYER_DESCRIPTORS)) {
      if (lc.includes(name)) return desc;
    }
  }
  return 'Confidential Employer';
}

// Build the candidate-facing view of a job: confidential by default.
function candidateFacingJob(job = {}) {
  return {
    id:               job.id,
    title:            job.title,
    industry:         job.industry,
    function:         job.function,
    region:           maskLocation(job.location),
    compensation:     job.salary_display || job.compensation_display || null,
    experience:       job.experience_required || null,
    languages:        job.languages || null,
    travel:           job.travel_requirement || null,
    responsibilities: job.responsibilities || null,
    qualifications:   job.qualifications || null,
    employer:         employerDescriptor(job.firm_name, job.confidential_descriptor),
    // Never includes firm_name, firm_email, exact location, website, contact.
  };
}

module.exports = {
  LOCATION_MASK,
  EMPLOYER_DESCRIPTORS,
  maskLocation,
  employerDescriptor,
  candidateFacingJob,
};
