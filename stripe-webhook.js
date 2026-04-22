// api/stripe-webhook.js
// Vercel serverless function — handles Stripe payment events
// Automatically updates fed_profiles tier in Supabase after successful payment

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Supabase admin client — uses service role key for write access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable body parsing — Stripe needs raw body for signature verification
export const config = {
  api: { bodyParser: false }
};

// Read raw body from request
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  // Verify webhook signature — prevents fake events
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log('Stripe event received:', event.type);

  // ── HANDLE EVENTS ──────────────────────────────────────────────────────────

  switch (event.type) {

    // Payment succeeded — subscription created for first time
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const subscriptionId = session.subscription;
      const customerId = session.customer;

      if (!customerEmail) {
        console.error('No customer email in session:', session.id);
        break;
      }

      // Determine tier based on price
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const priceId = lineItems.data[0]?.price?.id;

      // price_1TP6CIJ1BNVQzyrWSXVQxNNh = Executive $199/yr
      // price_1TP8C8J1BNVQzyrWtGy4vMiM = Senior Professional $99/yr
      const tier = priceId === process.env.ACTIVE_PRICE_EXECUTIVE
        ? 'active'
        : priceId === process.env.ACTIVE_PRICE_SENIOR
        ? 'active_senior'
        : 'active'; // default to executive if price unrecognized

      const tierExpires = new Date();
      tierExpires.setFullYear(tierExpires.getFullYear() + 1);

      const { error } = await supabase
        .from('fed_profiles')
        .update({
          tier,
          tier_expires: tierExpires.toISOString(),
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        })
        .eq('email', customerEmail.toLowerCase());

      if (error) {
        console.error('Supabase update failed:', error);
      } else {
        console.log(`✓ Profile upgraded to ${tier} for ${customerEmail}`);
      }

      // Send welcome email via Zapier webhook (optional)
      if (process.env.ZAPIER_WELCOME_WEBHOOK) {
        try {
          await fetch(process.env.ZAPIER_WELCOME_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: customerEmail,
              tier,
              upgraded_at: new Date().toISOString(),
            })
          });
        } catch (e) {
          console.log('Welcome webhook failed (non-critical):', e.message);
        }
      }

      break;
    }

    // Subscription renewed — extend tier for another year
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      if (invoice.billing_reason !== 'subscription_cycle') break;

      const customerId = invoice.customer;

      // Get customer email from Stripe
      const customer = await stripe.customers.retrieve(customerId);
      const customerEmail = customer.email;

      if (!customerEmail) break;

      const tierExpires = new Date();
      tierExpires.setFullYear(tierExpires.getFullYear() + 1);

      const { error } = await supabase
        .from('fed_profiles')
        .update({ tier_expires: tierExpires.toISOString() })
        .eq('stripe_customer_id', customerId);

      if (error) {
        console.error('Renewal update failed:', error);
      } else {
        console.log(`✓ Subscription renewed for ${customerEmail}`);
      }

      break;
    }

    // Subscription cancelled or payment failed — downgrade to free
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const obj = event.data.object;
      const customerId = obj.customer;

      const { error } = await supabase
        .from('fed_profiles')
        .update({
          tier: 'free',
          tier_expires: null,
          stripe_subscription_id: null,
        })
        .eq('stripe_customer_id', customerId);

      if (error) {
        console.error('Downgrade failed:', error);
      } else {
        console.log(`✓ Profile downgraded to free for customer ${customerId}`);
      }

      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  // Always return 200 — Stripe retries if it doesn't get a 200
  res.status(200).json({ received: true });
}
