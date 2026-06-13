// api/stripe-webhook.js
// Handles all Stripe payment events for Fredheim Desk:
//   - Candidate confidential subscriptions ($299/yr)
//   - Recruiter subscriptions: Pro ($499/mo) | Founding ($7,500/yr annual)
//   - Engagement unlock fees (match-age-tiered: fresh/warm/aging — one-time)
//   - Renewals and cancellations

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendAdminAlert, brandedHtml } = require('./lib/email');
const {
  candidateTierFromPrice,
  recruiterTierFromPrice,
  internTierFromPrice,
  isIntroductionPrice,
} = require('./lib/pricing');
const { createPaymentNotification } = require('./lib/notifications');
const { EVENTS, logEvent } = require('./lib/audit');

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

// Price-ID tier resolution (candidateTierFromPrice, recruiterTierFromPrice,
// internTierFromPrice, isIntroductionPrice) is centralized in ./lib/pricing.
// Back-compat alias - some callers below still reference the old name.
const isEngagementPrice = isIntroductionPrice;

// ── SEND CUSTOMER EMAIL (native, via Resend) ──────────────────
// Replaces the former Zapier webhook. Failures are logged and non-fatal:
// the Stripe webhook must still return 200 so Stripe does not retry an
// event whose database side effects have already been applied.
async function notify(payload) {
  if (!payload || !payload.to_email) return { ok: false, skipped: true };
  const subject = payload.subject || 'Fredheim Desk';
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
          // Update fed_profiles (Fredheim Desk) — this is the table index.html reads
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

        // -- CURATED INTRODUCTION FEE (compensation-tiered $99–$2,500) --------
        // Fired when a recruiter pays for a curated introduction.
        // Accepts both the new meta.type='introduction' and the legacy
        // 'engagement' tag so older checkouts complete cleanly.
        // Updates BOTH fed_matches (executive product) and talent_matches
        // (legacy talent product) so either match record advances.
        const matchId = meta.match_id;
        // Identify a curated-introduction checkout. The compensation-tiered flow
        // uses inline `price_data`, so Stripe mints an ad-hoc price ID that will
        // NOT match any configured PRICE_INTRO_* env var — therefore we must NOT
        // gate on isIntroductionPrice() for those. We trust our own server-set
        // metadata (meta.type), and keep isIntroductionPrice() only as a fallback
        // for legacy price-ID-only checkouts where metadata may be absent.
        const isIntroductionCheckout =
          meta.type === 'introduction' || meta.type === 'engagement' || isIntroductionPrice(priceId);
        if (isIntroductionCheckout && matchId) {
          await handleIntroductionPaid(matchId, meta.bracket, meta.fee_amount, custId, email, session);
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
    // We still return 200 (so Stripe does not retry an event whose Stripe-side
    // state is already final), but a money event was received and our side
    // effects FAILED — e.g. a customer paid but their unlock/tier was never
    // written. That must never be lost silently: alert the desk so it can be
    // reconciled manually. The alert itself is best-effort and never throws.
    try {
      await sendAdminAlert({
        subject: `⚠ Stripe webhook handler error — ${event?.type || 'unknown event'}`,
        text:
          `A Stripe event was received but processing FAILED.\n\n` +
          `Event type: ${event?.type || 'unknown'}\n` +
          `Event ID:   ${event?.id || 'n/a'}\n` +
          `Error:      ${err && err.message ? err.message : String(err)}\n\n` +
          `A customer may have paid without their account/unlock being updated. ` +
          `Reconcile against Stripe immediately.`,
      });
    } catch (alertErr) {
      console.error('Failed to send webhook-failure admin alert:', alertErr);
    }
  }

  return res.status(200).json({ received: true });
};

// -- CURATED INTRODUCTION PAID HANDLER (fed_matches / Phase 1) --
// Updates the executive-product match record after Stripe confirms the
// compensation-tiered curated introduction payment. Flips status to recruiter_interested
// (or mutual_interest if candidate had already signaled), records payment
// completion, and fires the bilateral introduction email.
//
// Safe to call even when the match_id belongs only to the legacy
// talent_matches table - we silently skip if no fed_matches row is found.
async function handleIntroductionPaid(matchId, bracket, feeAmount, custId, recruiterEmail, session) {
  const now = new Date().toISOString();
  // Look up the fed_matches row. If none, this match belongs to the legacy
  // talent_matches table and handleEngagementPaid will handle it.
  const { data: match, error: mErr } = await supabase
    .from('fed_matches')
    .select('*, fed_jobs(title, firm_name, firm_email)')
    .eq('id', matchId)
    .maybeSingle();
  if (mErr || !match) return; // not a fed_matches record

  // Idempotency: Stripe may deliver checkout.session.completed more than once.
  // If this session already produced a paid introduction, do not re-insert the
  // record or re-send notifications/emails. (A unique index on stripe_session_id
  // is the DB-level backstop.)
  if (session?.id) {
    const { data: already } = await supabase
      .from('fed_paid_introductions')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();
    if (already) {
      console.log(`Duplicate checkout.session.completed for session ${session.id} — already processed; skipping.`);
      return;
    }
  }

  // Resolve the amount paid (Stripe is the source of truth; fall back to label).
  let amountNum = null;
  if (session && typeof session.amount_total === 'number') amountNum = session.amount_total / 100;
  else { const n = parseFloat(String(feeAmount || '').replace(/[^0-9.]/g, '')); amountNum = isNaN(n) ? null : n; }
  // Customer-facing fee label: the compensation-tiered amount actually charged
  // (from checkout metadata or the Stripe total) — never a hardcoded flat figure.
  const feeDisplay = feeAmount
    || (amountNum != null ? `$${amountNum.toLocaleString('en-US')}` : 'the introduction fee');

  // Payment confirmed -> the match is UNLOCKED. Contact may now be revealed.
  const wasMutual = match.status === 'candidate_interested' || match.status === 'mutual_interest';
  const update = {
    status:                   'paid_unlocked',
    unlocked_at:              now,
    payment_completed_at:     now,
    recruiter_interested_at:  match.recruiter_interested_at || now,
    introduction_fee_paid:    true,
    introduction_fee_amount:  feeDisplay,
    introduction_fee_bracket: bracket || 'comp_tiered',
  };
  if (wasMutual && !match.mutual_interest_at) update.mutual_interest_at = now;
  await supabase.from('fed_matches').update(update).eq('id', matchId);

  // Record the paid introduction — the durable source of truth for the unlock.
  await supabase.from('fed_paid_introductions').insert({
    match_id:              matchId,
    job_id:                match.job_id,
    candidate_email:       match.candidate_email,
    recruiter_email:       recruiterEmail,
    stripe_session_id:     session?.id || null,
    stripe_payment_intent: session?.payment_intent || null,
    amount_paid:           amountNum,
    currency:              session?.currency || 'usd',
    paid_at:               now,
    status:                'paid',
  });

  const jobTitle = match.fed_jobs?.title || 'a senior search';
  const firmName = match.fed_jobs?.firm_name || 'A search firm';

  // Audit trail.
  await logEvent(supabase, { type: EVENTS.PAYMENT_COMPLETED, actorEmail: recruiterEmail, actorRole: 'recruiter', matchId, jobId: match.job_id, candidateEmail: match.candidate_email, recruiterEmail, amount: amountNum, detail: { bracket: bracket || 'flat', stripe_session: session?.id || null } });
  await logEvent(supabase, { type: EVENTS.PROFILE_UNLOCKED, actorEmail: recruiterEmail, actorRole: 'recruiter', matchId, jobId: match.job_id, candidateEmail: match.candidate_email, recruiterEmail });
  await logEvent(supabase, { type: EVENTS.INTRODUCTION_SENT, actorRole: 'system', matchId, jobId: match.job_id, candidateEmail: match.candidate_email, recruiterEmail });

  // In-app notifications.
  await createPaymentNotification(supabase, {
    recipientEmail: match.candidate_email, role: 'candidate', type: 'paid_unlocked',
    matchId, jobId: match.job_id,
    title: `Curated introduction confirmed — ${jobTitle}`,
    body:  `${firmName} has completed a paid curated introduction for ${jobTitle}. The introduction is now active; Fredheim has shared your contact with the firm and they will reach out directly.`,
  });
  await createPaymentNotification(supabase, {
    recipientEmail: recruiterEmail, role: 'recruiter', type: 'paid_unlocked',
    matchId, jobId: match.job_id,
    title: `Contact unlocked — ${jobTitle}`,
    body:  `Your curated introduction is confirmed (${feeDisplay}). Approved contact details are now available on your dashboard.`,
  });

  // Branded emails — contact is now released (the paid introduction unlock).
  await notify({
    to_email: match.candidate_email,
    subject:  `Curated introduction confirmed — ${jobTitle}`,
    body:     `${firmName} has completed a paid curated introduction for the ${jobTitle} search. The introduction is now active — they have your approved contact details and will be in touch directly.`,
  });
  await notify({
    to_email: recruiterEmail,
    subject:  `Contact unlocked — ${jobTitle}`,
    body:     `Your curated introduction is confirmed (${feeDisplay}). Approved contact details for this candidate are now available on your dashboard. All further communication is directly between you and the candidate.`,
  });

  await revenueAlert(
    `Revenue — introduction fee paid / contact unlocked (${feeDisplay})`,
    `Introduction fee paid and contact unlocked.\n\nRecruiter: ${recruiterEmail}\nCandidate: ${match.candidate_email}\nRole: ${jobTitle}\nFirm: ${firmName}\nAmount: ${feeDisplay}\nMatch: ${matchId}\nStripe session: ${session?.id || 'n/a'}`
  );

  console.log(`Fredheim curated introduction paid: match ${matchId} -> paid_unlocked (${feeDisplay})`);
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
