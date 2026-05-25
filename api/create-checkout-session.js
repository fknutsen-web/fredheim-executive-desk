// api/create-checkout-session.js
// Handles checkout for:
//   Candidate tiers:   free (standard profile) | confidential ($299/yr - anonymous executive profile)
//   Recruiter tiers:   standard ($199/mo - Phase 1 single subscription tier)
//                       founding (status, no Stripe charge - waived through founding window)
//   Curated introduction: one-time fee at point of confirmed introduction, amount
//                          tiered by candidate leadership_class (C-Suite/VP/Director/Manager).
//                          Early Career = free, complimentary.
//   Intern featured:   $49/yr - Featured Student Profile (Early Careers)

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const required = [
      'STRIPE_SECRET_KEY',
      'PRICE_CANDIDATE_CONFIDENTIAL',
      'PRICE_RECRUITER_STANDARD',
      'PRICE_INTRO_CSUITE',
      'PRICE_INTRO_VP',
      'PRICE_INTRO_DIRECTOR',
      'PRICE_INTRO_MANAGER',
      'PRICE_INTERN_FEATURED',
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

    // -- Founding window check ------------------------------------------------
    // During the founding window recruiter subscription and curated introduction
    // fees are waived. Window end is configurable via FOUNDING_DEADLINE env var,
    // defaults to 2026-12-31.
    function isFoundingWindowActive() {
      const FOUNDING_DEADLINE = new Date(process.env.FOUNDING_DEADLINE || '2026-12-31T23:59:59Z');
      return new Date() <= FOUNDING_DEADLINE;
    }
    async function foundingCohortAvailable() {
      const FOUNDING_CAP = parseInt(process.env.FOUNDING_CAP || '25', 10);
      if (!isFoundingWindowActive()) return { eligible: false, reason: 'deadline' };
      const { count } = await supabase
        .from('talent_recruiters')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'founding');
      if ((count || 0) >= FOUNDING_CAP) return { eligible: false, reason: 'cap', count };
      return { eligible: true, remaining: FOUNDING_CAP - (count || 0) };
    }

    // -- Leadership-class introduction pricing --------------------------------
    // Maps candidate leadership_class -> Stripe price ID. Mirrors the
    // INTRODUCTION_FEE_BY_CLASS_DEFAULTS constant in src/main.jsx.
    const INTRO_PRICE_BY_CLASS = {
      c_suite:         process.env.PRICE_INTRO_CSUITE,
      evp:             process.env.PRICE_INTRO_CSUITE,
      svp:             process.env.PRICE_INTRO_VP,
      vp:              process.env.PRICE_INTRO_VP,
      senior_director: process.env.PRICE_INTRO_DIRECTOR,
      director:        process.env.PRICE_INTRO_DIRECTOR,
      senior_manager:  process.env.PRICE_INTRO_MANAGER,
      manager:         process.env.PRICE_INTRO_MANAGER,
    };
    const INTRO_AMOUNT_BY_CLASS = {
      c_suite:'$495', evp:'$495', svp:'$295', vp:'$295',
      senior_director:'$149', director:'$149',
      senior_manager:'$79', manager:'$79',
    };

    async function resolveIntroductionPrice(matchId) {
      // Pull the match record. The matching engine denormalizes
      // candidate_leadership_class onto talent_matches so we don't have to
      // re-join fed_profiles at checkout time.
      const { data: match, error } = await supabase
        .from('talent_matches')
        .select('candidate_leadership_class, candidate_equivalent_label')
        .eq('id', matchId)
        .single();
      if (error || !match) return { error: 'Match not found.' };

      const cls = match.candidate_leadership_class;
      if (!cls || cls === 'early_career' || cls === 'individual_contributor') {
        return { priceId: null, bracket: 'complimentary', amount: '$0', leadership_class: cls };
      }
      const priceId = INTRO_PRICE_BY_CLASS[cls];
      if (!priceId) {
        return { priceId: null, bracket: 'complimentary', amount: '$0', leadership_class: cls };
      }
      return {
        priceId,
        bracket: cls,
        amount: INTRO_AMOUNT_BY_CLASS[cls] || '$0',
        leadership_class: cls,
      };
    }

    // -- CANDIDATE CONFIDENTIAL SUBSCRIPTION ------------------------------
    if (type === 'candidate') {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email || undefined,
        line_items: [{ price: process.env.PRICE_CANDIDATE_CONFIDENTIAL, quantity: 1 }],
        success_url: `${baseUrl}?upgradeSuccess=confidential`,
        cancel_url:  `${baseUrl}?view=pricing&checkout=cancelled`,
        metadata: { type: 'candidate', tier: 'confidential', email: email || '' },
      });
      return res.status(200).json({ url: session.url });
    }

    // -- RECRUITER SUBSCRIPTION (Phase 1: single Standard tier) -----------
    // Founding is positioned as a status, not a SKU. Recruiters who qualify
    // for founding are flagged in talent_recruiters.tier='founding' by the
    // admin workflow; their subscription charge is skipped here.
    if (type === 'recruiter') {
      // Allow caller to request founding eligibility check
      if (req.body.tier === 'founding') {
        const check = await foundingCohortAvailable();
        if (!check.eligible) {
          return res.status(400).json({
            error: check.reason === 'deadline'
              ? 'Founding cohort window has closed.'
              : 'Founding cohort is full - all spots have been claimed.',
            reason: check.reason,
          });
        }
        // Founding cohort recruiters are not charged - flag them and return success.
        return res.status(200).json({
          founding: true,
          subscription_required: false,
          message: 'Welcome to the Founding cohort. No subscription fee through ' +
                   (process.env.FOUNDING_DEADLINE || '2026-12-31') + '.',
          remaining: check.remaining,
        });
      }

      // Standard subscription
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email || undefined,
        line_items: [{ price: process.env.PRICE_RECRUITER_STANDARD, quantity: 1 }],
        // recruiter-talent.html is a separate Vite entry point - the Vercel
        // SPA rewrite excludes *.html so this URL serves the standalone
        // recruiter dashboard, not index.html.
        success_url: `${baseUrl}/recruiter-talent.html?checkout=success&tier=standard`,
        cancel_url:  `${baseUrl}?view=pricing&checkout=cancelled`,
        metadata: { type: 'recruiter', tier: 'standard', email: email || '', recruiter_id: recruiter_id || '' },
      });
      return res.status(200).json({ url: session.url });
    }

    // -- CURATED INTRODUCTION FEE ----------------------------------------
    // One-time payment at the point of confirmed introduction. Amount is
    // tiered by candidate leadership_class. Founding window recruiters pay
    // nothing - the gate below handles that.
    if (type === 'engagement' || type === 'introduction') {
      if (!match_id) return res.status(400).json({ error: 'match_id is required for curated introduction.' });

      // Founding window override - introductions are complimentary for
      // founding-cohort recruiters during the window.
      if (recruiter_id && isFoundingWindowActive()) {
        const { data: rec } = await supabase
          .from('talent_recruiters')
          .select('tier')
          .eq('id', recruiter_id)
          .maybeSingle();
        if (rec && rec.tier === 'founding') {
          return res.status(200).json({
            complimentary: true,
            bracket: 'founding_complimentary',
            message: 'Curated introduction is complimentary during the founding window.',
          });
        }
      }

      const resolved = await resolveIntroductionPrice(match_id);
      if (resolved.error) return res.status(400).json({ error: resolved.error });

      if (resolved.bracket === 'complimentary') {
        return res.status(200).json({
          complimentary: true,
          bracket: 'complimentary',
          leadership_class: resolved.leadership_class,
          message: 'Curated introduction is complimentary for this candidate class.',
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: email || undefined,
        line_items: [{ price: resolved.priceId, quantity: 1 }],
        success_url: `${baseUrl}/recruiter-talent.html?checkout=engaged&match=${match_id}`,
        cancel_url:  `${baseUrl}/recruiter-talent.html?checkout=cancelled`,
        metadata: {
          type:             'introduction',
          match_id,
          bracket:          resolved.bracket,
          leadership_class: resolved.leadership_class,
          fee_amount:       resolved.amount,
        },
      });

      return res.status(200).json({
        url:              session.url,
        bracket:          resolved.bracket,
        amount:           resolved.amount,
        leadership_class: resolved.leadership_class,
      });
    }

    if (type === 'founding-check') {
      const check = await foundingCohortAvailable();
      return res.status(200).json(check);
    }

    // -- EARLY CAREERS - FEATURED STUDENT PROFILE -----------------------
    if (type === 'intern_featured') {
      if (!email) return res.status(400).json({ error: 'email is required for intern_featured.' });
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email,
        line_items: [{ price: process.env.PRICE_INTERN_FEATURED, quantity: 1 }],
        success_url: `${baseUrl}?upgradeSuccess=intern_featured`,
        cancel_url:  `${baseUrl}?view=intern-myprofile&checkout=cancelled`,
        metadata: { type: 'intern_featured', tier: 'featured', email },
      });
      return res.status(200).json({ url: session.url });
    }

    return res.status(400).json({ error: `Unknown checkout type: ${type}. Use: candidate | recruiter | engagement | introduction | founding-check | intern_featured` });

  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: err.message || 'Checkout session failed.' });
  }
};
