// api/create-checkout-session.js
// Handles checkout for:
//   Candidate tiers:   professional ($49) | senior ($99) | executive ($199)
//   Recruiter tiers:   founding ($500/mo) | standard ($1,500/mo) | enterprise ($3,500/mo)
//   Engagement fees:   per-match introduction charges by candidate tier
//   Continuation fees: day-30/60/90 charges triggered by talent-billing cron

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── ENV CHECKS ─────────────────────────────────────────────
    const required = [
      'STRIPE_SECRET_KEY',
      // Candidate subscription price IDs
      'PRICE_CANDIDATE_PROFESSIONAL',   // $49/yr
      'PRICE_CANDIDATE_SENIOR',         // $99/yr
      'PRICE_CANDIDATE_EXECUTIVE',      // $199/yr
      // Recruiter subscription price IDs
      'PRICE_RECRUITER_FOUNDING',       // $500/mo — grandfathered
      'PRICE_RECRUITER_STANDARD',       // $1,500/mo
      'PRICE_RECRUITER_ENTERPRISE',     // $3,500/mo
      // Engagement fee price IDs (one-time charges)
      'PRICE_ENGAGE_PROFESSIONAL',      // $200
      'PRICE_ENGAGE_SENIOR',            // $500
      'PRICE_ENGAGE_EXECUTIVE',         // $1,000
      // Continuation fee price IDs (one-time, triggered by cron)
      'PRICE_CONT30_PROFESSIONAL',      // $150
      'PRICE_CONT30_SENIOR',            // $350
      'PRICE_CONT30_EXECUTIVE',         // $700
      'PRICE_CONT60_PROFESSIONAL',      // $100
      'PRICE_CONT60_SENIOR',            // $250
      'PRICE_CONT60_EXECUTIVE',         // $500
      'PRICE_CONT90_PROFESSIONAL',      // $75
      'PRICE_CONT90_SENIOR',            // $150
      'PRICE_CONT90_EXECUTIVE',         // $300
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

    const { type, tier, email, recruiter_id, match_id, candidate_tier, day } = req.body || {};
    const baseUrl = req.headers.origin || 'https://desk.fredheimtech.com';

    // ── FOUNDING PARTNER ELIGIBILITY CHECK ─────────────────────
    // Closes: Dec 31 2026 OR when 25 founding firms reached — whichever first
    async function foundingEligible() {
      const FOUNDING_DEADLINE = new Date('2026-12-31T23:59:59Z');
      const FOUNDING_CAP = 25;

      if (new Date() > FOUNDING_DEADLINE) return { eligible: false, reason: 'deadline' };

      const { count } = await supabase
        .from('talent_recruiters')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'founding');

      if ((count || 0) >= FOUNDING_CAP) return { eligible: false, reason: 'cap', count };
      return { eligible: true, remaining: FOUNDING_CAP - (count || 0) };
    }

    // ── PRICE ID RESOLVER ──────────────────────────────────────
    function candidatePriceId(t) {
      return {
        professional: process.env.PRICE_CANDIDATE_PROFESSIONAL,
        senior:       process.env.PRICE_CANDIDATE_SENIOR,
        executive:    process.env.PRICE_CANDIDATE_EXECUTIVE,
      }[t] || null;
    }

    function recruiterPriceId(t) {
      return {
        founding:   process.env.PRICE_RECRUITER_FOUNDING,
        standard:   process.env.PRICE_RECRUITER_STANDARD,
        enterprise: process.env.PRICE_RECRUITER_ENTERPRISE,
      }[t] || null;
    }

    function engagePriceId(t) {
      return {
        professional: process.env.PRICE_ENGAGE_PROFESSIONAL,
        senior:       process.env.PRICE_ENGAGE_SENIOR,
        executive:    process.env.PRICE_ENGAGE_EXECUTIVE,
      }[t] || null;
    }

    function continuationPriceId(t, d) {
      const map = {
        professional: { 30: process.env.PRICE_CONT30_PROFESSIONAL, 60: process.env.PRICE_CONT60_PROFESSIONAL, 90: process.env.PRICE_CONT90_PROFESSIONAL },
        senior:       { 30: process.env.PRICE_CONT30_SENIOR,        60: process.env.PRICE_CONT60_SENIOR,        90: process.env.PRICE_CONT90_SENIOR },
        executive:    { 30: process.env.PRICE_CONT30_EXECUTIVE,      60: process.env.PRICE_CONT60_EXECUTIVE,      90: process.env.PRICE_CONT90_EXECUTIVE },
      };
      return map[t]?.[d] || null;
    }

    // ── CANDIDATE SUBSCRIPTION ─────────────────────────────────
    if (type === 'candidate') {
      const rawTier = String(tier || '').trim().toLowerCase();
      const priceId = candidatePriceId(rawTier);
      if (!priceId) return res.status(400).json({ error: `Invalid candidate tier: ${tier}` });

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}?view=talent-match&checkout=success&tier=${rawTier}`,
        cancel_url:  `${baseUrl}?view=pricing&checkout=cancelled`,
        metadata: { type: 'candidate', tier: rawTier, email: email || '' },
      });

      return res.status(200).json({ url: session.url });
    }

    // ── RECRUITER SUBSCRIPTION ─────────────────────────────────
    if (type === 'recruiter') {
      const rawTier = String(tier || '').trim().toLowerCase();

      // Founding partner eligibility gate
      if (rawTier === 'founding') {
        const check = await foundingEligible();
        if (!check.eligible) {
          return res.status(400).json({
            error: check.reason === 'deadline'
              ? 'Founding Partner Program closed December 31, 2026.'
              : `Founding Partner Program full — all ${25} spots claimed.`,
            reason: check.reason,
          });
        }
      }

      const priceId = recruiterPriceId(rawTier);
      if (!priceId) return res.status(400).json({ error: `Invalid recruiter tier: ${tier}` });

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

    // ── ENGAGEMENT FEE (introduction charge) ──────────────────
    // Fired when recruiter clicks Express Interest and candidate accepts
    if (type === 'engagement') {
      if (!match_id || !candidate_tier) {
        return res.status(400).json({ error: 'match_id and candidate_tier required for engagement fee.' });
      }

      const rawTier = String(candidate_tier).trim().toLowerCase();
      const priceId = engagePriceId(rawTier);
      if (!priceId) return res.status(400).json({ error: `Invalid candidate tier for engagement: ${candidate_tier}` });

      // Fee amounts for display
      const feeAmounts = { professional: '$200', senior: '$500', executive: '$1,000' };

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: email || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}?view=recruiter-talent&checkout=engaged&match=${match_id}`,
        cancel_url:  `${baseUrl}?view=recruiter-talent&checkout=cancelled`,
        metadata: {
          type: 'engagement',
          match_id,
          candidate_tier: rawTier,
          day: '0',
          fee_amount: feeAmounts[rawTier] || '',
        },
      });

      return res.status(200).json({ url: session.url });
    }

    // ── CONTINUATION FEE (day 30/60/90 — fired by cron) ──────
    // Called by talent-billing.js cron, not user-initiated
    if (type === 'continuation') {
      if (!match_id || !candidate_tier || !day || !recruiter_id) {
        return res.status(400).json({ error: 'match_id, candidate_tier, day, recruiter_id required.' });
      }

      const rawTier = String(candidate_tier).trim().toLowerCase();
      const dayNum  = Number(day);
      if (![30, 60, 90].includes(dayNum)) {
        return res.status(400).json({ error: 'day must be 30, 60, or 90.' });
      }

      const priceId = continuationPriceId(rawTier, dayNum);
      if (!priceId) return res.status(400).json({ error: `No price found for ${rawTier} day ${dayNum}` });

      // Look up recruiter's Stripe customer ID
      const { data: recruiter } = await supabase
        .from('talent_recruiters')
        .select('stripe_customer_id, email')
        .eq('id', recruiter_id)
        .single();

      if (!recruiter?.stripe_customer_id) {
        return res.status(400).json({ error: 'Recruiter has no Stripe customer ID on file.' });
      }

      // Fee amounts for notification
      const contAmounts = {
        professional: { 30: '$150', 60: '$100', 90: '$75' },
        senior:       { 30: '$350', 60: '$250', 90: '$150' },
        executive:    { 30: '$700', 60: '$500', 90: '$300' },
      };

      // Create off-session payment intent against saved payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: recruiter.stripe_customer_id,
        type: 'card',
      });

      if (!paymentMethods.data.length) {
        // Fall back to checkout session if no saved payment method
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer: recruiter.stripe_customer_id,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${baseUrl}?view=recruiter-talent&cont=paid&match=${match_id}&day=${dayNum}`,
          cancel_url:  `${baseUrl}?view=recruiter-talent&cont=cancelled&match=${match_id}`,
          metadata: {
            type: 'continuation',
            match_id,
            candidate_tier: rawTier,
            day: String(dayNum),
            fee_amount: contAmounts[rawTier]?.[dayNum] || '',
          },
        });
        return res.status(200).json({ url: session.url, method: 'checkout' });
      }

      // Charge saved card automatically
      const paymentIntent = await stripe.paymentIntents.create({
        amount: { professional: { 30: 15000, 60: 10000, 90: 7500 }, senior: { 30: 35000, 60: 25000, 90: 15000 }, executive: { 30: 70000, 60: 50000, 90: 30000 } }[rawTier]?.[dayNum] || 0,
        currency: 'usd',
        customer: recruiter.stripe_customer_id,
        payment_method: paymentMethods.data[0].id,
        confirm: true,
        off_session: true,
        description: `Fredheim Talent Match — Day ${dayNum} continuation fee (${rawTier})`,
        metadata: {
          type: 'continuation',
          match_id,
          candidate_tier: rawTier,
          day: String(dayNum),
        },
      });

      return res.status(200).json({ success: true, payment_intent_id: paymentIntent.id, method: 'automatic' });
    }

    // ── FOUNDING PARTNER AVAILABILITY CHECK ────────────────────
    // Called by pricing page to show remaining spots
    if (type === 'founding-check') {
      const check = await foundingEligible();
      return res.status(200).json(check);
    }

    return res.status(400).json({ error: `Unknown checkout type: ${type}` });

  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: err.message || 'Checkout session failed.' });
  }
};
