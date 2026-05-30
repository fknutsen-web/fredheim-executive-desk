// api/create-checkout-session.js
// Handles checkout for:
//   Candidate tiers:   free (standard profile) | confidential ($299/yr - anonymous executive profile)
//   Recruiter tiers:   standard ($199/mo - Phase 1 single subscription tier)
//                       founding (status, no Stripe charge - waived through founding window)
//   Curated introduction: flat $249 one-time fee at point of confirmed introduction.
//                          Same price for every executive scope. Early Career = free.
//   Intern featured:   $49/yr - Featured Student Profile (Early Careers)

const {
  candidatePriceId,
  recruiterPriceId,
  internPriceId,
  introductionPriceId,
  FOUNDING,
  REQUIRED_CHECKOUT_ENV,
} = require('./lib/pricing');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    for (const key of REQUIRED_CHECKOUT_ENV) {
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

    const isFoundingWindowActive = () => FOUNDING.isWindowActive();
    async function foundingCohortAvailable() {
      const cap = FOUNDING.cap();
      if (!isFoundingWindowActive()) return { eligible: false, reason: 'deadline' };
      const { count } = await supabase
        .from('talent_recruiters')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'founding');
      if ((count || 0) >= cap) return { eligible: false, reason: 'cap', count };
      return { eligible: true, remaining: cap - (count || 0) };
    }

    // -- Flat curated introduction pricing -----------------------------------
    // Every executive scope (Manager through C-Suite) pays the same flat fee.
    // Early-career and individual-contributor candidates are complimentary.
    async function resolveIntroductionPrice(matchId) {
      const { data: match, error } = await supabase
        .from('talent_matches')
        .select('candidate_leadership_class')
        .eq('id', matchId)
        .single();
      if (error || !match) return { error: 'Match not found.' };

      const cls = match.candidate_leadership_class;
      if (cls === 'early_career' || cls === 'individual_contributor') {
        return { priceId: null, bracket: 'complimentary', amount: '$0', leadership_class: cls };
      }
      return {
        priceId: introductionPriceId(),
        bracket: 'flat',
        amount: '$249',
        leadership_class: cls || 'executive',
      };
    }

    // -- CANDIDATE CONFIDENTIAL SUBSCRIPTION ------------------------------
    if (type === 'candidate') {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email || undefined,
        line_items: [{ price: candidatePriceId('confidential'), quantity: 1 }],
        success_url: `${baseUrl}?upgradeSuccess=confidential`,
        cancel_url:  `${baseUrl}?view=pricing&checkout=cancelled`,
        metadata: { type: 'candidate', tier: 'confidential', email: email || '' },
      });
      return res.status(200).json({ url: session.url });
    }

    // -- RECRUITER SUBSCRIPTION (Phase 1: single Standard tier) -----------
    if (type === 'recruiter') {
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
        return res.status(200).json({
          founding: true,
          subscription_required: false,
          message: 'Welcome to the Founding cohort. No subscription fee through ' +
                   (process.env.FOUNDING_DEADLINE || '2026-12-31') + '.',
          remaining: check.remaining,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email || undefined,
        line_items: [{ price: recruiterPriceId('standard'), quantity: 1 }],
        success_url: `${baseUrl}/recruiter-talent.html?checkout=success&tier=standard`,
        cancel_url:  `${baseUrl}?view=pricing&checkout=cancelled`,
        metadata: { type: 'recruiter', tier: 'standard', email: email || '', recruiter_id: recruiter_id || '' },
      });
      return res.status(200).json({ url: session.url });
    }

    // -- CURATED INTRODUCTION FEE (flat $249) -----------------------------
    if (type === 'engagement' || type === 'introduction') {
      if (!match_id) return res.status(400).json({ error: 'match_id is required for curated introduction.' });

      // Founding window override - introductions complimentary for founding recruiters.
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

    if (type === 'intern_featured') {
      if (!email) return res.status(400).json({ error: 'email is required for intern_featured.' });
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email,
        line_items: [{ price: internPriceId('featured'), quantity: 1 }],
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
