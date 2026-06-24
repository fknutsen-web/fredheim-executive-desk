// api/lib/pricing.js
// Single source of truth for Stripe price IDs, tier resolution, and the
// platform's commercial constants. Nothing pricing-related should be hardcoded
// or read from process.env.PRICE_* anywhere else in the codebase.
//
// All getters read process.env at call time (not module load) so the same
// module behaves correctly across serverless cold/warm starts and tests.

// ── STRIPE PRICE IDs ──────────────────────────────────────────────
// Returns the full price-ID map. Values come from Vercel env vars.
function priceIds() {
  return {
    recruiter: {
      standard: process.env.PRICE_RECRUITER_STANDARD, // $199/mo (Phase 1 single tier)
      pro:      process.env.PRICE_RECRUITER_PRO,       // $499/mo
      founding: process.env.PRICE_RECRUITER_FOUNDING,  // $7,500/yr
    },
    candidate: {
      confidential: process.env.PRICE_CANDIDATE_CONFIDENTIAL, // $299/yr
    },
    intern: {
      featured: process.env.PRICE_INTERN_FEATURED, // $49/yr
    },
    introduction: {
      // Legacy flat price ID. The live fed_matches flow charges a
      // compensation-tiered fee ($99–$2,500) via inline price_data, so this is
      // only a fallback for any older flat-fee checkout.
      flat: process.env.PRICE_INTRO_FLAT,
    },
    // Legacy IDs — retained ONLY so in-flight checkouts created before the
    // flat-fee migration still complete. Do not use for new checkouts.
    legacy: {
      engage_fresh:   process.env.PRICE_ENGAGE_FRESH,
      engage_warm:    process.env.PRICE_ENGAGE_WARM,
      engage_aging:   process.env.PRICE_ENGAGE_AGING,
      intro_csuite:   process.env.PRICE_INTRO_CSUITE,
      intro_vp:       process.env.PRICE_INTRO_VP,
      intro_director: process.env.PRICE_INTRO_DIRECTOR,
      intro_manager:  process.env.PRICE_INTRO_MANAGER,
    },
  };
}

// Convenience single-value getters.
const recruiterPriceId    = (tier) => priceIds().recruiter[tier] || null;
const candidatePriceId    = (tier = 'confidential') => priceIds().candidate[tier] || null;
const internPriceId       = (tier = 'featured') => priceIds().intern[tier] || null;
const introductionPriceId = () => priceIds().introduction.flat || null;

// ── TIER RESOLUTION (price ID -> tier) ────────────────────────────
// Behaviour preserved exactly from the original stripe-webhook helpers.
function candidateTierFromPrice(priceId) {
  if (priceId && priceId === process.env.PRICE_CANDIDATE_CONFIDENTIAL) return 'confidential';
  return null;
}

function recruiterTierFromPrice(priceId) {
  if (priceId === process.env.PRICE_RECRUITER_FOUNDING) return 'founding';
  if (priceId === process.env.PRICE_RECRUITER_PRO)      return 'pro';
  if (priceId === process.env.PRICE_RECRUITER_STANDARD) return 'standard';
  return null;
}

function internTierFromPrice(priceId) {
  if (priceId === process.env.PRICE_INTERN_FEATURED) return 'featured';
  return null;
}

// Is this price ID any curated-introduction price (flat or legacy)?
function isIntroductionPrice(priceId) {
  const ids = priceIds();
  return [
    ids.introduction.flat,
    ids.legacy.engage_fresh,
    ids.legacy.engage_warm,
    ids.legacy.engage_aging,
    ids.legacy.intro_csuite,
    ids.legacy.intro_vp,
    ids.legacy.intro_director,
    ids.legacy.intro_manager,
  ].filter(Boolean).includes(priceId);
}

// ── PUBLIC DISPLAY AMOUNTS ────────────────────────────────────────
// Canonical fallbacks for the pricing-config endpoint and UI. These are the
// numbers customers see; the authoritative live values may be overridden in
// fed_pricing_config, but these guarantee sane defaults if the DB is empty.
const PUBLIC_FEES = {
  intro_flat:               99, // curated introduction ENTRY tier; fee is
                                // compensation-tiered $99–$2,500 (see introduction-fees.js)
  intro_min:                99,
  intro_max:              2500,
  candidate_confidential:  299, // /yr
  recruiter_standard:      199, // /mo
  recruiter_pro:           499, // /mo
  recruiter_founding:     7500, // /yr
  intern_featured:          49, // /yr
};

// Human-readable label for the compensation-tiered introduction fee.
const INTRODUCTION_FEE_LABEL  = '$99–$2,500';

// ── COMMERCIAL CONFIG (founding window, placement credit) ─────────
const FOUNDING = {
  cap:      () => parseInt(process.env.FOUNDING_CAP || '25', 10),
  deadline: () => new Date(process.env.FOUNDING_DEADLINE || '2026-12-31T23:59:59Z'),
  isWindowActive() { return new Date() <= this.deadline(); },
};

const placementCreditAmount = () => parseInt(process.env.PLACEMENT_CREDIT_AMOUNT || '250', 10);

// Env vars create-checkout-session.js must have to operate.
const REQUIRED_CHECKOUT_ENV = [
  'STRIPE_SECRET_KEY',
  'PRICE_CANDIDATE_CONFIDENTIAL',
  'PRICE_RECRUITER_STANDARD',
  'PRICE_INTRO_FLAT',
  'PRICE_INTERN_FEATURED',
];

module.exports = {
  priceIds,
  recruiterPriceId,
  candidatePriceId,
  internPriceId,
  introductionPriceId,
  candidateTierFromPrice,
  recruiterTierFromPrice,
  internTierFromPrice,
  isIntroductionPrice,
  PUBLIC_FEES,
  INTRODUCTION_FEE_LABEL,
  FOUNDING,
  placementCreditAmount,
  REQUIRED_CHECKOUT_ENV,
};
