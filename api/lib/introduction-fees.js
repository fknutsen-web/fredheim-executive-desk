// api/lib/introduction-fees.js
// Single source of truth for the confidential-introduction fee.
// Compensation-based pricing takes precedence. NOTHING else in the codebase may
// hardcode an introduction price.
//
// Tiers (by the role/candidate target compensation):
//   < $100,000            -> $99
//   $100,000 – $250,000   -> $495
//   $250,000 – $500,000   -> $995
//   > $500,000            -> $2,500

const TIERS = [
  { id: 'tier1', max: 100000,  amount: 99,   label: 'Confidential Introduction' },
  { id: 'tier2', max: 250000,  amount: 495,  label: 'Confidential Introduction' },
  { id: 'tier3', max: 500000,  amount: 995,  label: 'Confidential Introduction' },
  { id: 'tier4', max: Infinity, amount: 2500, label: 'Confidential Introduction' },
];

// Coerce a compensation value (number, "$120,000", "120k") to a number.
function toNumber(comp) {
  if (comp == null) return null;
  if (typeof comp === 'number') return isFinite(comp) ? comp : null;
  let s = String(comp).toLowerCase().replace(/[, $]/g, '').trim();
  let mult = 1;
  if (s.endsWith('k')) { mult = 1000; s = s.slice(0, -1); }
  if (s.endsWith('m')) { mult = 1000000; s = s.slice(0, -1); }
  const n = parseFloat(s);
  return isNaN(n) ? null : n * mult;
}

// Resolve the introduction fee for a given compensation.
// Unknown/missing compensation defaults to tier2 (the most common executive band)
// so a fee is always charged — never zero — for a confidential introduction.
function introductionFee(compensation) {
  const n = toNumber(compensation);
  const tier = (n == null)
    ? TIERS[1]
    : TIERS.find(t => n < t.max) || TIERS[TIERS.length - 1];
  return {
    tier:        tier.id,
    amount:      tier.amount,            // dollars
    amount_cents: tier.amount * 100,     // for Stripe price_data
    currency:    'usd',
    label:       tier.label,
    display:     `$${tier.amount.toLocaleString('en-US')}`,
    compensation_used: n,
  };
}

module.exports = { TIERS, introductionFee, toNumber };
