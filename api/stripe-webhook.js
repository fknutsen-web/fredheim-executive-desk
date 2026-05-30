// api/stripe-webhook.js
// Handles all Stripe payment events for Fredheim Executive Desk:
//   - Candidate confidential subscriptions ($299/yr)
//   - Recruiter subscriptions: Pro ($499/mo) | Founding ($7,500/yr annual)
//   - Engagement unlock fees (match-age-tiered: fresh/warm/aging — one-time)
//   - Renewals and cancellations

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendAdminAlert, brandedHtml } = require('./lib/email');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable body parsing — Stripe needs raw body for signature verification
module.exports.config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── TIER EXPIRY HELPERS ────────────────────────────────────────
function expiryOneYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

function expiryOneMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// ── CANDIDATE TIER FROM PRICE ID ──────────────────────────────
// Only one paid tier: confidential
function candidateTierFromPrice(priceId) {
  if (priceId === process.env.PRICE_CANDIDATE_CONFIDENTIAL) return 'confidential';
  return null;
}

// ── RECRUITER TIER FROM PRICE ID ──────────────────────────────
function recruiterTierFromPrice(priceId) {
  if (priceId === process.env.PRICE_RECRUITER_FOUNDING) return 'founding';
  if (priceId === process.env.PRICE_RECRUITER_PRO)      return 'pro';
  return null;
}

// -- CURATED INTRODUCTION PRICE CHECK -----------------------------
// Phase 1: a single flat $249 introduction fee (PRICE_INTRO_FLAT).
// Legacy: the deprecated age-based engagement-unlock prices remain in the
// allowed set so existing in-flight checkouts complete cleanly.
function isIntroductionPrice(priceId) {
  return [
    process.env.PRICE_INTRO_FLAT,     // Phase 1: $249 flat
    process.env.PRICE_ENGAGE_FRESH,   // legacy: 0-30 day match: $500
    process.env.PRICE_ENGAGE_WARM,    // legacy: 31-60 day match: $350
    process.env.PRICE_ENGAGE_AGING,   // legacy: 61-90 day match: $200
    process.env.PRICE_INTRO_CSUITE,   // legacy tiered C-suite
    process.env.PRICE_INTRO_VP,       // legacy tiered VP
    process.env.PRICE_INTRO_DIRECTOR, // legacy tiered Director
    process.env.PRICE_INTRO_MANAGER,  // legacy tiered Manager
  ].filter(Boolean).includes(priceId);
}
// Back-compat alias - some callers below still reference the old name.
const isEngagementPrice = isIntroductionPrice;

// ── INTERN TIER FROM PRICE ID ─────────────────────────────────
// Only one paid student tier: featured ($49/yr)
function internTierFromPrice(priceId) {
  if (priceId === process.env.PRICE_INTERN_FEATURED) return 'featured';
  return null;
}

// ── SEND CUSTOMER EMAIL (native, via Resend) ──────────────────
// Replaces the former Zapier webhook. Failures are logged and non-fatal:
// the Stripe webhook must still return 200 so Stripe does not retry an
// event whose database side effects have already been applied.
async function notify(payload) {
  if (!payload || !payload.to_email) return { ok: false, skipped: true };
  const subject = payload.subject || 'Fredheim Executive Desk';
  return sendEmail({
    to:      payload.to_email,
    subject,
    text:    payload.body || '',
    html:    brandedHtml(payload.body || '', { heading: subject }),
  });
}

// Internal revenue alert to the desk for every Stripe money event.
async function revenueAlert(subject, lines) {
  return sendAdminAlert({ subject, text: lines });
}

// ── MAIN HANDLER ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log('Stripe event:', event.type);

  try {
    switch (event.type) {

      // ── CHECKOUT COMPLETED ─────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta    = session.metadata || {};
        const email   = (session.customer_email || session.customer_details?.email || '').toLowerCase();
        const custId  = session.customer;
        const subId   = session.subscription;

        // Get price ID from line items
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId   = lineItems.data[0]?.price?.id;

        // ── CANDIDATE CONFIDENTIAL SUBSCRIPTION ───────────
        const candidateTier = meta.type === 'candidate'
          ? meta.tier
          : candidateTierFromPrice(priceId);

        if (candidateTier === 'confidential') {
          // Update fed_profiles (Executive Desk) — this is the table index.html reads
          const expiry = new Date();
          expiry.setFullYear(expiry.getFullYear() + 1);
          const { error } = await supabase
            .from('fed_profiles')
            .update({
              tier:                    'confidential',
              tier_expires:            expiry.toISOString(),
              stripe_customer_id:      custId,
              stripe_subscription_id:  subId,
            })
            .eq('email', email);

          if (error) console.error('fed_profiles tier update failed:', error);
          else console.log(`✓ Candidate upgraded to confidential in fed_profiles: ${email}`);

          await notify({
            to_email: email,
            subject: 'Your Fredheim confidential executive profile is now active',
            body:    'Your confidential profile is active. Your name, employer, location, and graduation year are hidden from recruiters until you approve a connection. You control every reveal.',
          });
          await revenueAlert(
            `Revenue — candidate confidential subscription activated (${email})`,
            `Candidate confidential subscription activated.\n\nEmail: ${email}\nCustomer: ${custId}\nSubscription: ${subId}`
          );
          break;
        }

        // ── RECRUITER SUBSCRIPTION ────────────────────────
        const recruiterTier = meta.type === 'recruiter'
          ? meta.tier
          : recruiterTierFromPrice(priceId);

        if (recruiterTier && ['founding', 'pro'].includes(recruiterTier)) {
          const recruiterId = meta.recruiter_id || null;

          // Founding is annual; Pro is monthly
          const tierExpiry = recruiterTier === 'founding' ? expiryOneYear() : expiryOneMonth();

          const upsertData = {
            tier:                    recruiterTier,
            tier_expires:            tierExpiry,
            stripe_customer_id:      custId,
            stripe_subscription_id:  subId,
            email,
            is_founding:             recruiterTier === 'founding',
            founding_locked_at:      recruiterTier === 'founding' ? new Date().toISOString() : null,
          };

          if (recruiterId) {
            await supabase.from('talent_recruiters').update(upsertData).eq('id', recruiterId);
          } else {
            const { data: existing } = await supabase
              .from('talent_recruiters')
              .select('id')
              .eq('email', email)
              .single();

            if (existing) {
              await supabase.from('talent_recruiters').update(upsertData).eq('email', email);
            } else {
              await supabase.from('talent_recruiters').insert({ ...upsertData, email });
            }
          }

          console.log(`✓ Recruiter subscribed as ${recruiterTier}: ${email}`);

          const feeLabel = recruiterTier === 'founding' ? '$7,500/yr' : '$499/mo';

          await notify({
            to_email:      email,
            subject:       `Welcome to Fredheim Talent Match — ${recruiterTier === 'founding' ? 'Founding Partner' : 'Pro'} access active`,
            body:          (recruiterTier === 'founding'
              ? `Your Founding Partner access is confirmed at ${feeLabel}. You have priority candidate visibility, enhanced match limits, and early access to new platform features.`
              : `Your Pro access is confirmed at ${feeLabel}. You now have full access to the candidate pool, AI-powered matching, and curated introductions.`)
              + `\n\nYour dashboard: https://desk.fredheimtech.com?view=recruiter-dash`,
          });
          await revenueAlert(
            `Revenue — recruiter subscription activated (${recruiterTier}, ${feeLabel})`,
            `Recruiter subscription activated.\n\nEmail: ${email}\nTier: ${recruiterTier}\nFee: ${feeLabel}\nCustomer: ${custId}\nSubscription: ${subId}`
          );
          break;
        }

        // -- CURATED INTRODUCTION FEE (Phase 1: flat $249) --------
        // Fired when a recruiter pays for a curated introduction.
        // Accepts both the new meta.type='introduction' and the legacy
        // 'engagement' tag so older checkouts complete cleanly.
        // Updates BOTH fed_matches (executive product) and talent_matches
        // (legacy talent product) so either match record advances.
        const matchId = meta.match_id;
        if ((meta.type === 'introduction' || meta.type === 'engagement') && matchId && isIntroductionPrice(priceId)) {
          await handleIntroductionPaid(matchId, meta.bracket, meta.fee_amount, custId, email);
          await handleEngagementPaid(matchId, meta.bracket, meta.fee_amount, custId, email);
          break;
        }

        // ── EARLY CAREERS — FEATURED STUDENT PROFILE ─────
        // $49/yr subscription. Profile was written to fed_intern_profiles
        // with tier='free' before redirect; webhook promotes to 'featured'.
        const internTier = meta.type === 'intern_featured'
          ? 'featured'
          : internTierFromPrice(priceId);

        if (internTier === 'featured' && email) {
          const expiry = new Date();
          expiry.setFullYear(expiry.getFullYear() + 1);
          const { error } = await supabase
            .from('fed_intern_profiles')
            .update({
              tier:                    'featured',
              tier_expires_at:         expiry.toISOString(),
              stripe_customer_id:      custId,
              stripe_subscription_id:  subId,
            })
            .eq('email', email);

          if (error) console.error('fed_intern_profiles tier update failed:', error);
          else console.log(`✓ Student profile upgraded to featured: ${email}`);

          await notify({
            to_email: email,
            subject: 'Your Fredheim Featured Student Profile is now active',
            body:    'Your Featured Student Profile is active. You now have priority placement in employer matches, profile analytics, and the optimization checklist. The subscription renews annually at $49/yr until cancelled.',
          });
          await revenueAlert(
            `Revenue — featured student profile activated (${email})`,
            `Featured student profile activated.\n\nEmail: ${email}\nCustomer: ${custId}\nSubscription: ${subId}`
          );
          break;
        }

        console.log('checkout.session.completed — unmatched metadata:', meta);
        break;
      }

      // ── SUBSCRIPTION RENEWED ──────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.billing_reason !== 'subscription_cycle') break;

        const custId  = invoice.customer;
        const priceId = invoice.lines?.data?.[0]?.price?.id;

        // Candidate confidential renewal — extend one year in fed_profiles
        if (candidateTierFromPrice(priceId)) {
          await supabase.from('fed_profiles')
            .update({ tier_expires: expiryOneYear() })
            .eq('stripe_customer_id', custId);
          console.log(`✓ Candidate confidential subscription renewed: ${custId}`);
          break;
        }

        // Recruiter renewal
        const recruiterTier = recruiterTierFromPrice(priceId);
        if (recruiterTier) {
          const tierExpiry = recruiterTier === 'founding' ? expiryOneYear() : expiryOneMonth();
          await supabase.from('talent_recruiters')
            .update({ tier_expires: tierExpiry })
            .eq('stripe_customer_id', custId);
          console.log(`✓ Recruiter subscription renewed (${recruiterTier}): ${custId}`);
          break;
        }

        // Student featured renewal — extend one year in fed_intern_profiles
        if (internTierFromPrice(priceId)) {
          await supabase.from('fed_intern_profiles')
            .update({ tier_expires_at: expiryOneYear() })
            .eq('stripe_customer_id', custId);
          console.log(`✓ Student featured subscription renewed: ${custId}`);
          break;
        }

        break;
      }

      // ── SUBSCRIPTION CANCELLED / PAYMENT FAILED ───────────
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj     = event.data.object;
        const custId  = obj.customer;
        const priceId = obj.lines?.data?.[0]?.price?.id || obj.plan?.id;

        // Admin alert on a failed payment so the desk can follow up before the
        // grace period lapses. Subscription deletions are a normal lifecycle
        // event and do not warrant a revenue alert.
        if (event.type === 'invoice.payment_failed') {
          await revenueAlert(
            `Payment failed — customer ${custId}`,
            `A subscription payment failed.\n\nCustomer: ${custId}\nAmount due: ${obj.amount_due != null ? '$' + (obj.amount_due / 100).toFixed(2) : 'unknown'}\nAttempt: ${obj.attempt_count || 'n/a'}\n\nReview in Stripe and follow up if needed.`
          );
        }

        // Downgrade candidate to free in fed_profiles
        if (candidateTierFromPrice(priceId)) {
          await supabase.from('fed_profiles').update({
            tier:                   'free',
            tier_expires:           null,
            stripe_subscription_id: null,
          }).eq('stripe_customer_id', custId);
          console.log(`✓ Candidate downgraded to free: ${custId}`);
          break;
        }

        // Downgrade student featured to free in fed_intern_profiles
        if (internTierFromPrice(priceId)) {
          await supabase.from('fed_intern_profiles').update({
            tier:                   'free',
            tier_expires_at:        null,
            stripe_subscription_id: null,
          }).eq('stripe_customer_id', custId);
          console.log(`✓ Student featured downgraded to free: ${custId}`);
          break;
        }

        // Downgrade recruiter — founding tier is NEVER auto-downgraded
        const { data: recruiter } = await supabase
          .from('talent_recruiters')
          .select('tier, is_founding')
          .eq('stripe_customer_id', custId)
          .single();

        if (recruiter && !recruiter.is_founding) {
          await supabase.from('talent_recruiters').update({
            tier:                   'inactive',
            tier_expires:           null,
            stripe_subscription_id: null,
          }).eq('stripe_customer_id', custId);
          console.log(`✓ Recruiter downgraded to inactive: ${custId}`);
        } else if (recruiter?.is_founding) {
          console.log(`Founding partner — tier preserved on cancellation: ${custId}`);
        }

        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Return 200 regardless — Stripe retries on non-200
  }

  return res.status(200).json({ received: true });
};

// -- CURATED INTRODUCTION PAID HANDLER (fed_matches / Phase 1) --
// Updates the executive-product match record after Stripe confirms the
// $249 curated introduction payment. Flips status to recruiter_interested
// (or mutual_interest if candidate had already signaled), records payment
// completion, and fires the bilateral introduction email.
//
// Safe to call even when the match_id belongs only to the legacy
// talent_matches table - we silently skip if no fed_matches row is found.
async function handleIntroductionPaid(matchId, bracket, feeAmount, custId, recruiterEmail) {
  const now = new Date().toISOString();
  // Look up the fed_matches row. If none, this match belongs to the legacy
  // talent_matches table and handleEngagementPaid will handle it.
  const { data: match, error: mErr } = await supabase
    .from('fed_matches')
    .select('*, fed_jobs(title, firm_name, firm_email)')
    .eq('id', matchId)
    .maybeSingle();
  if (mErr || !match) return; // not a fed_matches record

  // Decide the new status. If candidate already signaled, this becomes mutual.
  const wasCandidateInterested = match.status === 'candidate_interested';
  const newStatus = wasCandidateInterested ? 'mutual_interest' : 'recruiter_interested';

  const update = {
    status:                  newStatus,
    recruiter_interested_at: now,
    payment_completed_at:    now,
    introduction_fee_paid:   true,
    introduction_fee_amount: feeAmount || '$249',
    introduction_fee_bracket:bracket || 'flat',
  };
  if (wasCandidateInterested) update.mutual_interest_at = now;

  await supabase.from('fed_matches').update(update).eq('id', matchId);

  // Notify candidate of the curated introduction (and pay-confirmed gate).
  const jobTitle = match.fed_jobs?.title || 'a senior search';
  const firmName = match.fed_jobs?.firm_name || 'A search firm';
  await supabase.from('fed_notifications').insert({
    recipient_email: match.candidate_email.toLowerCase(),
    recipient_role:  'candidate',
    type:            newStatus,
    match_id:        matchId,
    job_id:          match.job_id,
    title:           newStatus === 'mutual_interest'
      ? `Mutual interest confirmed - ${jobTitle}`
      : `A search firm has confirmed a curated introduction`,
    body:            newStatus === 'mutual_interest'
      ? `${firmName} has paid for and confirmed the curated introduction. Fredheim will facilitate next steps.`
      : `${firmName} has expressed interest in your profile for a ${jobTitle} role. You can accept, decline, or ignore this introduction.`,
  });
  await supabase.from('fed_notifications').insert({
    recipient_email: recruiterEmail.toLowerCase(),
    recipient_role:  'recruiter',
    type:            'introduction_confirmed',
    match_id:        matchId,
    job_id:          match.job_id,
    title:           `Curated introduction confirmed (${feeAmount || '$249'})`,
    body:            newStatus === 'mutual_interest'
      ? `Mutual interest with the candidate. You can now connect directly via the dashboard.`
      : `Interest signaled to candidate. They will be notified and can accept, decline, or ignore.`,
  });
  // Native emails. Contact details are NOT revealed here — the candidate must
  // still accept before any unlock. Mutual interest means both have signaled,
  // but direct contact is exchanged through the dashboard's unlock step.
  const candidateSubject = newStatus === 'mutual_interest'
    ? `Mutual interest confirmed — ${jobTitle}`
    : `A search firm has confirmed a curated introduction`;
  const candidateBody = newStatus === 'mutual_interest'
    ? `${firmName} has paid for and confirmed the curated introduction for ${jobTitle}. Fredheim will facilitate next steps. Your identity remains confidential until contact is unlocked.`
    : `${firmName} has expressed interest in your profile for a ${jobTitle} role. You can accept, decline, or ignore this introduction from your dashboard. Your identity remains confidential.`;
  await notify({ to_email: match.candidate_email, subject: candidateSubject, body: candidateBody });

  await notify({
    to_email: recruiterEmail,
    subject:  `Curated introduction confirmed (${feeAmount || '$249'})`,
    body:     newStatus === 'mutual_interest'
      ? `Mutual interest with the candidate is confirmed. You can complete the contact unlock from your dashboard to connect directly.`
      : `Your interest has been signaled to the candidate. They will be notified and can accept, decline, or ignore. You will be notified when they respond.`,
  });

  await revenueAlert(
    `Revenue — introduction fee paid (${feeAmount || '$249'})`,
    `Introduction fee paid.\n\nRecruiter: ${recruiterEmail}\nCandidate: ${match.candidate_email}\nRole: ${jobTitle}\nFirm: ${firmName}\nStatus: ${newStatus}\nAmount: ${feeAmount || '$249'}\nCustomer: ${custId}`
  );

  console.log(`Fredheim curated introduction paid: match ${matchId} -> ${newStatus} (${feeAmount || '$249'})`);
}

// ── ENGAGEMENT UNLOCK PAID HANDLER (legacy talent_matches) ─────
// Called when checkout.session.completed fires for an engagement unlock.
// Records the payment, marks the match engaged, and fires the introduction email.
async function handleEngagementPaid(matchId, bracket, feeAmount, custId, recruiterEmail) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('talent_matches')
    .update({
      recruiter_status:      'engaged',
      engaged_at:            now,
      fee_unlock_paid:       true,
      fee_unlock_paid_at:    now,
      fee_unlock_amount:     feeAmount || '',
      fee_unlock_bracket:    bracket   || '',
    })
    .eq('id', matchId);

  if (error) { console.error('Match engagement update failed:', error); return; }

  // Pull candidate and recruiter details for introduction email
  const { data: match } = await supabase
    .from('talent_matches')
    .select(`
      talent_candidates ( first_name, email ),
      talent_recruiters ( email, contact_name, firm_name )
    `)
    .eq('id', matchId)
    .single();

  if (!match) return;

  const cEmail = match.talent_candidates?.email;
  const rEmail = match.talent_recruiters?.email || recruiterEmail;
  const cName  = match.talent_candidates?.first_name;
  const rName  = match.talent_recruiters?.contact_name || match.talent_recruiters?.firm_name;

  // Send bilateral introduction via native email. This is the paid
  // deliverable — it reveals contact details to both parties after the
  // unlock fee is confirmed. Emails are still non-fatal to the webhook
  // (Stripe must get a 200), but each delivery result is logged.
  if (rEmail) {
    const subject = `Curated introduction confirmed — ${cName}`;
    const body = `Your curated introduction has been confirmed (${feeAmount || 'complimentary'}). ${cName} has agreed to connect. Their email: ${cEmail}. All further communication is between you directly — Fredheim is not party to subsequent conversations.`;
    await sendEmail({ to: rEmail, subject, text: body, html: brandedHtml(body, { heading: subject }) });
  }
  if (cEmail) {
    const subject = `A search firm has been introduced to you`;
    const body = `A retained search firm has expressed interest in your profile and you have accepted. Their contact: ${rEmail}. All further communication is between you directly.`;
    await sendEmail({ to: cEmail, subject, text: body, html: brandedHtml(body, { heading: subject }) });
  }

  await revenueAlert(
    `Revenue — introduction/contact unlock completed (${feeAmount || 'complimentary'})`,
    `Contact unlock completed.\n\nRecruiter: ${rEmail}\nCandidate: ${cEmail}\nBracket: ${bracket || 'n/a'}\nFee: ${feeAmount || 'complimentary'}\nMatch: ${matchId}`
  );

  // Log the introduction in the notification table
  await supabase.from('talent_notifications').insert({
    type:      'engagement_introduction',
    match_id:  matchId,
    subject:   `Introduction sent — ${cName} ↔ ${rName}`,
    sent_at:   now,
    delivered: true,
  });

  console.log(`✓ Engagement unlock paid (${bracket}, ${feeAmount}) — introduction sent: match ${matchId}`);
}
