// api/env-check.js
// Read-only production diagnostic: confirms the Stripe billing env vars
// (STRIPE_SECRET_KEY + PRICE_*) actually RESOLVE in the runtime this code is
// deployed to — closing the gap that scripts/stripe-verification.sh can't:
// that script checks a Stripe account from your laptop, this endpoint checks
// the env vars Vercel injected into the live serverless function.
//
// It is the server-side equivalent of `stripe-verification.sh prices`:
//   • presence  — each required var is set and non-empty (always)
//   • live      — with ?live=1, each known PRICE_* resolves in Stripe and its
//                 amount/type/interval matches the published model, and the
//                 STRIPE_SECRET_KEY actually authenticates (balance read)
//
// SAFETY:
//   • Admin-gated (same auth as every other admin endpoint) so the env
//     inventory is never publicly enumerable.
//   • NEVER returns a secret value. STRIPE_SECRET_KEY is reported only as
//     { present, keyMode } where keyMode is parsed from the non-secret prefix
//     (sk_live / sk_test / rk_live / rk_test). Price IDs are not secret — they
//     are already sent to the browser during checkout — so they are returned.
//   • GET only, no writes, no Checkout Sessions, no event replay.

const { isAuthorizedAdmin } = require('./admin-auth');
const { REQUIRED_CHECKOUT_ENV } = require('./lib/pricing');

// Canonical published amounts, mirroring scripts/stripe-verification.sh §1.
// var -> { cents, type, interval }  (interval null for one_time)
const PRICE_EXPECTATIONS = {
  PRICE_RECRUITER_STANDARD:     { cents: 19900, type: 'recurring', interval: 'month' },
  PRICE_CANDIDATE_CONFIDENTIAL: { cents: 29900, type: 'recurring', interval: 'year'  },
  PRICE_INTERN_FEATURED:        { cents: 4900,  type: 'recurring', interval: 'year'  },
  PRICE_INTRO_FLAT:             { cents: 24900, type: 'one_time',  interval: null    },
};

// Derive the key's mode from its non-secret prefix. Returns the mode only —
// never the key itself.
function keyMode(key) {
  if (!key) return null;
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  return 'unknown';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorizedAdmin(req)) {
    // Don't reveal anything about the environment to unauthenticated callers.
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── presence check (always) ───────────────────────────────────────────────
  const env = {};
  let allPresent = true;
  for (const key of REQUIRED_CHECKOUT_ENV) {
    const present = Boolean(process.env[key]);
    if (!present) allPresent = false;
    const entry = { present };
    if (key === 'STRIPE_SECRET_KEY') entry.keyMode = keyMode(process.env[key]);
    env[key] = entry;
  }

  const out = {
    ok: allPresent,
    checkedAt: new Date().toISOString(),
    presence: { allPresent, env },
  };

  // ── live validation (opt-in via ?live=1) ──────────────────────────────────
  const wantLive = req.query?.live === '1' || req.query?.live === 'true';
  if (wantLive) {
    const live = { keyWorks: false, livemode: null, prices: [] };
    if (!process.env.STRIPE_SECRET_KEY) {
      live.error = 'STRIPE_SECRET_KEY not set; cannot run live validation.';
      out.ok = false;
    } else {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      // Confirm the key actually authenticates and learn the real mode.
      try {
        const balance = await stripe.balance.retrieve();
        live.keyWorks = true;
        live.livemode = balance.livemode;
      } catch (e) {
        live.keyWorks = false;
        live.error = `Stripe auth failed: ${e.message}`;
        out.ok = false;
      }

      if (live.keyWorks) {
        for (const [varName, want] of Object.entries(PRICE_EXPECTATIONS)) {
          const id = process.env[varName];
          const row = { var: varName, id: id || null, present: Boolean(id) };
          if (!id) {
            row.match = false;
            out.ok = false;
            live.prices.push(row);
            continue;
          }
          try {
            const p = await stripe.prices.retrieve(id);
            row.found = true;
            row.active = p.active;
            row.amount = p.unit_amount;
            row.type = p.type;
            row.interval = p.recurring?.interval ?? null;
            row.expected = want;
            row.match =
              p.active === true &&
              p.unit_amount === want.cents &&
              p.type === want.type &&
              (p.recurring?.interval ?? null) === want.interval;
            if (!row.match) out.ok = false;
          } catch (e) {
            row.found = false;
            row.match = false;
            row.error = e.message;
            out.ok = false;
          }
          live.prices.push(row);
        }
      }
    }
    out.live = live;
  }

  return res.status(out.ok ? 200 : 500).json(out);
};
