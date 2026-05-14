// api/create-checkout-session.js
// Handles checkout for:
//   Candidate tiers:   free (standard profile) | confidential ($299/yr — anonymous executive profile)
//   Recruiter tiers:   pro ($499/mo) | founding ($7,500/yr — limited intake, annual lock-in)
//   Engagement unlock: one-time fee at point of introduction, amount determined by match age
//                      0–30 days = $500 | 31–60 days = $350 | 61–90 days = $200 | 90+ days = free

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── ENV CHECKS ─────────────────────────────────────────────
    const required = [
      'STRIPE_SECRET_KEY',
      // Candidate confidential subscription
      'PRICE_CANDIDATE_CONFIDENTIAL',   // $299/yr — anonymous executive profile
      // Recruiter subscriptions
      'PRICE_RECRUITER_PRO',            // $499/mo — standard recruiter access
      'PRICE_RECRUITER_FOUNDING',       // $7,500/yr — founding partner (annual, limited intake)
      // Engagement unlock fees (one-time, match-age-tiered)
      'PRICE_ENGAGE_FRESH',             // $500 — match is 0–30 days old
      'PRICE_ENGAGE_WARM',              // $350 — match is 31–60 days old
      'PRICE_ENGAGE_AGING',             // $200 — match is 61–90 days old
      // 90+ days: no charge (complimentary unlock)
    ];

    for (const key of required) {
      if (!process.env[key]) {
        return res.status(500).json({ error: `Missing env var: ${key}` });
      }
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { type, email, recruiter_id, match_id } = req.body || {};
    const baseUrl = req.headers.origin || 'https://desk.fredheimtech.com';

    // ── FOUNDING PARTNER ELIGIBILITY CHECK ─────────────────────
    // Cap is configurable via FOUNDING_CAP env var (default: 25)
    // Deadline is configurable via FOUNDING_DEADLINE env var (default: 2026-12-31)
    async function foundingEligible() {
      const FOUNDING_CAP      = parseInt(process.env.FOUNDING_CAP || '25', 10);
      const FOUNDING_DEADLINE = new Date(process.env.FOUNDING_DEADLINE || '2026-12-31T23:59:59Z');

      if (new Date() > FOUNDING_DEADLINE) return { eligible: false, reason: 'deadline' };

      const { count } = await supabase
        .from('talent_recruiters')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'founding');

      if ((count || 0) >= FOUNDING_CAP) return { eligible: false, reason: 'cap', count };
      return { eligible: true, remaining: FOUNDING_CAP - (count || 0) };
    }

    // ── MATCH AGE BRACKET ──────────────────────────────────────
    // Returns the engagement price ID and display amount based on how many days
    // have elapsed since the match was created.
    async function resolveEngagementPrice(matchId) {
      const { data: match, error } = await supabase
        .from('talent_matches')
        .select('created_at')
        .eq('id', matchId)
        .single();

      if (error || !match) return { error: 'Match not found.' };

      const ageMs   = Date.now() - new Date(match.created_at).getTime();
      const ageDays = Math.floor(ageMs / 86400000);

      if (ageDays <= 30) {
        return { priceId: process.env.PRICE_ENGAGE_FRESH, bracket: 'fresh', amount: '$500', ageDays };
      }
      if (ageDays <= 60) {
        return { priceId: process.env.PRICE_ENGAGE_WARM,  bracket: 'warm',  amount: '$350', ageDays };
      }
      if (ageDays <= 90) {
        return { priceId: process.env.PRICE_ENGAGE_AGING, bracket: 'aging', amount: '$200', ageDays };
      }
      // 90+ days: complimentary unlock — no Stripe charge required
      return { priceId: null, bracket: 'complimentary', amount: '$0', ageDays };
    }

    // ── CANDIDATE CONFIDENTIAL SUBSCRIPTION ───────────────────
    // Free candidates: no checkout needed — profile created via talent-candidates.js
    // Confidential upgrade: anonymous executive profile at $299/yr
    if (type === 'candidate') {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email || undefined,
        line_items: [{ price: process.env.PRICE_CANDIDATE_CONFIDENTIAL, quantity: 1 }],
        success_url: `${baseUrl}?view=talent-match&checkout=success&tier=confidential`,
        cancel_url:  `${baseUrl}?view=pricing&checkout=cancelled`,
        metadata: { type: 'candidate', tier: 'confidential', email: email || '' },
      });

      return res.status(200).json({ url: session.url });
    }

    // ── RECRUITER SUBSCRIPTION ─────────────────────────────────
    if (type === 'recruiter') {
      const rawTier = String(req.body.tier || '').trim().toLowerCase();

      if (!['pro', 'founding'].includes(rawTier)) {
        return res.status(400).json({ error: `Invalid recruiter tier: ${rawTier}. Use 'pro' or 'founding'.` });
      }

      // Founding partner eligibility gate
      if (rawTier === 'founding') {
        const check = await foundingEligible();
        if (!check.eligible) {
          return res.status(400).json({
            error: check.reason === 'deadline'
              ? 'Founding Partner Program is closed.'
              : `Founding Partner Program is full — all spots have been claimed.`,
            reason: check.reason,
          });
        }
      }

      const priceId = rawTier === 'founding'
        ? process.env.PRICE_RECRUITER_FOUNDING
        : process.env.PRICE_RECRUITER_PRO;

      // Founding is annual ($7,500/yr); Pro is monthly ($499/mo)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}?view=recruiter-talent&checkout=success&tier=${rawTier}`,
        cancel_url:  `${baseUrl}?view=pricing&checkout=cancelled`,
        metadata: { type: 'recruiter', tier: rawTier, email: email || '', recruiter_id: recruiter_id || '' },
      });

      return res.status(200).json({ url: session.url });
    }

    // ── ENGAGEMENT UNLOCK FEE ──────────────────────────────────
    // Triggered when a recruiter clicks Express Interest and the candidate accepts.
    // Fee is determined by match age at the moment of unlock — not by candidate tier.
    // 0–30 days: $500 | 31–60 days: $350 | 61–90 days: $200 | 90+ days: complimentary
    if (type === 'engagement') {
      if (!match_id) {
        return res.status(400).json({ error: 'match_id is required for engagement unlock.' });
      }

      const resolved = await resolveEngagementPrice(match_id);
      if (resolved.error) return res.status(400).json({ error: resolved.error });

      // 90+ day matches — no payment required; signal complimentary unlock to caller
      if (resolved.bracket === 'complimentary') {
        return res.status(200).json({
          complimentary: true,
          bracket: 'complimentary',
          age_days: resolved.ageDays,
          message: 'This match is 90+ days old. No unlock fee applies — proceed to introduction.',
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: email || undefined,
        line_items: [{ price: resolved.priceId, quantity: 1 }],
        success_url: `${baseUrl}?view=recruiter-talent&checkout=engaged&match=${match_id}`,
        cancel_url:  `${baseUrl}?view=recruiter-talent&checkout=cancelled`,
        metadata: {
          type:       'engagement',
          match_id,
          bracket:    resolved.bracket,
          age_days:   String(resolved.ageDays),
          fee_amount: resolved.amount,
        },
      });

      return res.status(200).json({
        url:     session.url,
        bracket: resolved.bracket,
        amount:  resolved.amount,
        age_days: resolved.ageDays,
      });
    }

    // ── FOUNDING PARTNER AVAILABILITY CHECK ────────────────────
    // Called by the pricing page to show remaining spots in real time
    if (type === 'founding-check') {
      const check = await foundingEligible();
      return res.status(200).json(check);
    }

    return res.status(400).json({ error: `Unknown checkout type: ${type}. Use: candidate | recruiter | engagement | founding-check` });

  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: err.message || 'Checkout session failed.' });
  }
};
