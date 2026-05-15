// api/stripe-webhook.js
// Handles all Stripe payment events for Fredheim Executive Desk:
//   - Candidate confidential subscriptions ($299/yr)
//   - Recruiter subscriptions: Pro ($499/mo) | Founding ($7,500/yr annual)
//   - Engagement unlock fees (match-age-tiered: fresh/warm/aging — one-time)
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

// ── ENGAGEMENT TYPE FROM PRICE ID ─────────────────────────────
// All three price IDs represent the same event type (engagement unlock)
// differentiated only by match age bracket at time of purchase
function isEngagementPrice(priceId) {
  return [
    process.env.PRICE_ENGAGE_FRESH,   // 0–30 day match: $500
    process.env.PRICE_ENGAGE_WARM,    // 31–60 day match: $350
    process.env.PRICE_ENGAGE_AGING,   // 61–90 day match: $200
  ].includes(priceId);
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

          await notify(process.env.ZAPIER_TALENT_CANDIDATE_WEBHOOK, {
            type:    'candidate_subscription',
            to_email: email,
            tier:    'confidential',
            subject: 'Your Fredheim confidential executive profile is now active',
            body:    'Your confidential profile is active. Your name, employer, location, and graduation year are hidden from recruiters until you approve a connection. You control every reveal.',
          });
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

          await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
            type:          'recruiter_subscription',
            to_email:      email,
            tier:          recruiterTier,
            fee:           feeLabel,
            is_founding:   recruiterTier === 'founding',
            subject:       `Welcome to Fredheim Talent Match — ${recruiterTier === 'founding' ? 'Founding Partner' : 'Pro'} access active`,
            body:          recruiterTier === 'founding'
              ? `Your Founding Partner access is confirmed at ${feeLabel}. You have priority candidate visibility, enhanced match limits, and early access to new platform features.`
              : `Your Pro access is confirmed at ${feeLabel}. You now have full access to the candidate pool, AI-powered matching, and engagement unlocks.`,
            dashboard_url: 'https://desk.fredheimtech.com?view=recruiter-dash',
          });
          break;
        }

        // ── ENGAGEMENT UNLOCK FEE ─────────────────────────
        // Fired when a recruiter pays to unlock a candidate introduction
        const matchId = meta.match_id;
        if (meta.type === 'engagement' && matchId && isEngagementPrice(priceId)) {
          await handleEngagementPaid(matchId, meta.bracket, meta.fee_amount, custId, email);
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

        break;
      }

      // ── SUBSCRIPTION CANCELLED / PAYMENT FAILED ───────────
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj     = event.data.object;
        const custId  = obj.customer;
        const priceId = obj.lines?.data?.[0]?.price?.id || obj.plan?.id;

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

// ── ENGAGEMENT UNLOCK PAID HANDLER ────────────────────────────
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

  // Send bilateral introduction via Zapier
  await notify(process.env.ZAPIER_TALENT_WEBHOOK, {
    type:                 'engagement_introduction',
    to_recruiter_email:   rEmail,
    to_candidate_email:   cEmail,
    recruiter_name:       rName,
    candidate_first_name: cName,
    candidate_email:      cEmail,
    recruiter_email:      rEmail,
    unlock_bracket:       bracket,
    unlock_fee:           feeAmount,
    subject_recruiter:    `Fredheim Introduction — ${cName} is ready to connect`,
    subject_candidate:    `A search firm wants to connect with you`,
    body_recruiter:       `Your engagement unlock has been processed (${feeAmount || 'complimentary'}). ${cName} has agreed to connect. Their email: ${cEmail}. All further communication is between you directly — Fredheim is not party to subsequent conversations.`,
    body_candidate:       `A retained search firm has expressed interest in your profile and you have accepted. Their contact: ${rEmail}. All further communication is between you directly.`,
    match_id:             matchId,
  });

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
