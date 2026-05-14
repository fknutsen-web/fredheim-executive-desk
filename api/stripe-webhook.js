// api/stripe-webhook.js
// Handles all Stripe payment events for Fredheim Executive Desk:
//   - Candidate subscriptions (professional / senior / executive)
//   - Recruiter subscriptions (founding / standard / enterprise)
//   - Engagement fees (day 0 introduction charges)
//   - Continuation fees (day 30 / 60 / 90 automated charges)
//   - Renewals and cancellations

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

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
function candidateTierFromPrice(priceId) {
  if (priceId === process.env.PRICE_CANDIDATE_PROFESSIONAL) return 'professional';
  if (priceId === process.env.PRICE_CANDIDATE_SENIOR)       return 'senior';
  if (priceId === process.env.PRICE_CANDIDATE_EXECUTIVE)    return 'executive';
  return null;
}

// ── RECRUITER TIER FROM PRICE ID ──────────────────────────────
function recruiterTierFromPrice(priceId) {
  if (priceId === process.env.PRICE_RECRUITER_FOUNDING)   return 'founding';
  if (priceId === process.env.PRICE_RECRUITER_STANDARD)   return 'standard';
  if (priceId === process.env.PRICE_RECRUITER_ENTERPRISE) return 'enterprise';
  return null;
}

// ── ENGAGEMENT / CONTINUATION TYPE FROM PRICE ID ─────────────
function engagementTypeFromPrice(priceId) {
  const engage = [
    process.env.PRICE_ENGAGE_PROFESSIONAL,
    process.env.PRICE_ENGAGE_SENIOR,
    process.env.PRICE_ENGAGE_EXECUTIVE,
  ];
  const cont30 = [
    process.env.PRICE_CONT30_PROFESSIONAL,
    process.env.PRICE_CONT30_SENIOR,
    process.env.PRICE_CONT30_EXECUTIVE,
  ];
  const cont60 = [
    process.env.PRICE_CONT60_PROFESSIONAL,
    process.env.PRICE_CONT60_SENIOR,
    process.env.PRICE_CONT60_EXECUTIVE,
  ];
  const cont90 = [
    process.env.PRICE_CONT90_PROFESSIONAL,
    process.env.PRICE_CONT90_SENIOR,
    process.env.PRICE_CONT90_EXECUTIVE,
  ];

  if (engage.includes(priceId))  return { type: 'engagement', day: 0 };
  if (cont30.includes(priceId))  return { type: 'continuation', day: 30 };
  if (cont60.includes(priceId))  return { type: 'continuation', day: 60 };
  if (cont90.includes(priceId))  return { type: 'continuation', day: 90 };
  return null;
}

// ── SEND ZAPIER NOTIFICATION ──────────────────────────────────
async function notify(webhookUrl, payload) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log('Zapier notify failed (non-critical):', e.message);
  }
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

        // ── CANDIDATE SUBSCRIPTION ────────────────────────
        const candidateTier = meta.type === 'candidate'
          ? meta.tier
          : candidateTierFromPrice(priceId);

        if (candidateTier && ['professional','senior','executive'].includes(candidateTier)) {
          const { error } = await supabase
            .from('talent_candidates')
            .update({
              tier: candidateTier,
              tier_expires: expiryOneYear(),
              stripe_customer_id: custId,
              stripe_subscription_id: subId,
              status: 'active',
              last_active_at: new Date().toISOString(),
            })
            .eq('email', email);

          if (error) console.error('Candidate tier update failed:', error);
          else console.log(`✓ Candidate upgraded to ${candidateTier}: ${email}`);

          await notify(process.env.ZAPIER_TALENT_CANDIDATE_WEBHOOK, {
            type: 'candidate_subscription',
            to_email: email,
            tier: candidateTier,
            subject: `Welcome to Fredheim Executive Desk — ${candidateTier} profile active`,
            body: `Your ${candidateTier} profile is now active and being matched against open searches.`,
          });
          break;
        }

        // ── RECRUITER SUBSCRIPTION ────────────────────────
        const recruiterTier = meta.type === 'recruiter'
          ? meta.tier
          : recruiterTierFromPrice(priceId);

        if (recruiterTier && ['founding','standard','enterprise'].includes(recruiterTier)) {
          const recruiterId = meta.recruiter_id || null;

          // Upsert recruiter record
          const upsertData = {
            tier: recruiterTier,
            tier_expires: expiryOneMonth(),
            stripe_customer_id: custId,
            stripe_subscription_id: subId,
            email,
            is_founding: recruiterTier === 'founding',
            founding_locked_at: recruiterTier === 'founding' ? new Date().toISOString() : null,
          };

          if (recruiterId) {
            await supabase.from('talent_recruiters').update(upsertData).eq('id', recruiterId);
          } else {
            // Match by email if no recruiter_id in metadata
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

          // Monthly fee labels for welcome email
          const feeLabel = { founding: '$500/mo', standard: '$1,500/mo', enterprise: '$3,500/mo' }[recruiterTier];

          await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
            type: 'recruiter_subscription',
            to_email: email,
            tier: recruiterTier,
            fee: feeLabel,
            is_founding: recruiterTier === 'founding',
            subject: `Welcome to Fredheim Talent Match — ${recruiterTier} access active`,
            dashboard_url: 'https://desk.fredheimtech.com?view=recruiter-talent',
          });
          break;
        }

        // ── ENGAGEMENT FEE PAID ───────────────────────────
        if (meta.type === 'engagement' && meta.match_id) {
          await handleEngagementPaid(meta.match_id, meta.candidate_tier, custId, email, 0);
          break;
        }

        // ── CONTINUATION FEE PAID (via checkout fallback) ─
        if (meta.type === 'continuation' && meta.match_id) {
          await handleContinuationPaid(meta.match_id, meta.candidate_tier, Number(meta.day), email);
          break;
        }

        console.log('checkout.session.completed — unmatched type:', meta.type, priceId);
        break;
      }

      // ── PAYMENT INTENT SUCCEEDED (off-session continuation) ─
      case 'payment_intent.succeeded': {
        const pi   = event.data.object;
        const meta = pi.metadata || {};

        if (meta.type === 'continuation' && meta.match_id) {
          const customer = await stripe.customers.retrieve(pi.customer);
          await handleContinuationPaid(
            meta.match_id,
            meta.candidate_tier,
            Number(meta.day),
            customer.email
          );
        }
        break;
      }

      // ── PAYMENT INTENT FAILED (off-session continuation) ──
      case 'payment_intent.payment_failed': {
        const pi   = event.data.object;
        const meta = pi.metadata || {};

        if (meta.type === 'continuation' && meta.match_id) {
          // Log failed charge — send recruiter a checkout link to pay manually
          await supabase.from('talent_notifications').insert({
            type: 'continuation_payment_failed',
            match_id: meta.match_id,
            subject: `Payment failed — Day ${meta.day} continuation fee`,
            body_preview: `Automatic charge failed. A payment link has been sent to update payment method.`,
          });

          // Get recruiter email from match
          const { data: match } = await supabase
            .from('talent_matches')
            .select('recruiter_id, talent_recruiters(email)')
            .eq('id', meta.match_id)
            .single();

          if (match?.talent_recruiters?.email) {
            await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
              type: 'payment_failed',
              to_email: match.talent_recruiters.email,
              match_id: meta.match_id,
              day: meta.day,
              subject: `Action required — Fredheim continuation fee payment failed`,
              update_url: 'https://desk.fredheimtech.com?view=recruiter-talent&tab=billing',
            });
          }
        }
        break;
      }

      // ── SUBSCRIPTION RENEWED ──────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.billing_reason !== 'subscription_cycle') break;

        const custId  = invoice.customer;
        const priceId = invoice.lines?.data?.[0]?.price?.id;

        // Candidate renewal
        const candidateTier = candidateTierFromPrice(priceId);
        if (candidateTier) {
          await supabase.from('talent_candidates')
            .update({ tier_expires: expiryOneYear() })
            .eq('stripe_customer_id', custId);
          console.log(`✓ Candidate subscription renewed: ${custId}`);
          break;
        }

        // Recruiter renewal — extend by one month
        const recruiterTier = recruiterTierFromPrice(priceId);
        if (recruiterTier) {
          await supabase.from('talent_recruiters')
            .update({ tier_expires: expiryOneMonth() })
            .eq('stripe_customer_id', custId);
          console.log(`✓ Recruiter subscription renewed (${recruiterTier}): ${custId}`);
          break;
        }

        break;
      }

      // ── SUBSCRIPTION CANCELLED / PAYMENT FAILED ───────────
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj    = event.data.object;
        const custId = obj.customer;
        const priceId = obj.lines?.data?.[0]?.price?.id || obj.plan?.id;

        // Downgrade candidate
        const candidateTier = candidateTierFromPrice(priceId);
        if (candidateTier) {
          await supabase.from('talent_candidates').update({
            tier: 'free',
            tier_expires: null,
            stripe_subscription_id: null,
          }).eq('stripe_customer_id', custId);
          console.log(`✓ Candidate downgraded to free: ${custId}`);
          break;
        }

        // Downgrade recruiter — founding tier is NEVER downgraded
        const { data: recruiter } = await supabase
          .from('talent_recruiters')
          .select('tier, is_founding')
          .eq('stripe_customer_id', custId)
          .single();

        if (recruiter && !recruiter.is_founding) {
          await supabase.from('talent_recruiters').update({
            tier: 'inactive',
            tier_expires: null,
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
    // Still return 200 — Stripe retries on non-200
  }

  return res.status(200).json({ received: true });
};

// ── ENGAGEMENT PAID HANDLER ────────────────────────────────────
async function handleEngagementPaid(matchId, candidateTier, custId, recruiterEmail, day) {
  const now = new Date().toISOString();

  // Mark match as engaged and record day-0 payment
  const { error } = await supabase
    .from('talent_matches')
    .update({
      recruiter_status: 'engaged',
      engaged_at: now,
      fee_day0_paid: true,
      fee_day0_paid_at: now,
    })
    .eq('id', matchId);

  if (error) { console.error('Match engagement update failed:', error); return; }

  // Get candidate and recruiter details for introduction email
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

  // Send introduction email to BOTH parties via Zapier
  await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
    type: 'engagement_introduction',
    to_recruiter_email: rEmail,
    to_candidate_email: cEmail,
    recruiter_name: rName,
    candidate_first_name: cName,
    candidate_email: cEmail,
    recruiter_email: rEmail,
    subject_recruiter: `Fredheim Introduction — ${cName} is ready to connect`,
    subject_candidate: `A search firm wants to connect with you`,
    body_recruiter: `Your engagement fee has been processed. ${cName} has agreed to connect. Their email: ${cEmail}. All further communication is between you directly.`,
    body_candidate: `A search firm has expressed interest in your profile and your connection request has been accepted. Their contact: ${rEmail}. All further communication is between you directly. Fredheim will not be party to subsequent conversations.`,
    match_id: matchId,
  });

  // Log introduction sent
  await supabase.from('talent_notifications').insert({
    type: 'engagement_introduction',
    match_id: matchId,
    subject: `Introduction sent — ${cName} ↔ ${rName}`,
    sent_at: now,
    delivered: true,
  });

  console.log(`✓ Engagement fee paid and introduction sent: match ${matchId}`);
}

// ── CONTINUATION PAID HANDLER ─────────────────────────────────
async function handleContinuationPaid(matchId, candidateTier, day, recruiterEmail) {
  const now = new Date().toISOString();
  const field = { 30: 'fee_day30_paid', 60: 'fee_day60_paid', 90: 'fee_day90_paid' }[day];
  const fieldAt = { 30: 'fee_day30_paid_at', 60: 'fee_day60_paid_at', 90: 'fee_day90_paid_at' }[day];

  if (!field) return;

  await supabase.from('talent_matches')
    .update({ [field]: true, [fieldAt]: now })
    .eq('id', matchId);

  // If day 90 paid — auto-archive the engagement after 14 days
  if (day === 90) {
    await supabase.from('talent_matches')
      .update({ auto_archive_at: new Date(Date.now() + 14 * 86400000).toISOString() })
      .eq('id', matchId);
  }

  console.log(`✓ Continuation fee day ${day} paid: match ${matchId}`);
}
