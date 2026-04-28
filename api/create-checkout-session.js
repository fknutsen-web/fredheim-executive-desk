// Vercel Serverless Function: /api/create-checkout-session
// Required Vercel environment variable:
//   STRIPE_SECRET_KEY = sk_live_... or sk_test_...
// Optional Vercel environment variables:
//   STRIPE_PRICE_SENIOR = price_...
//   STRIPE_PRICE_EXECUTIVE = price_...

const DEFAULT_PRICE_EXECUTIVE = 'price_1TP6CIJ1BNVQzyrWSXVQxNNh';
const DEFAULT_PRICE_SENIOR = 'price_1TP8C8J1BNVQzyrWtGy4vMiM';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function appendForm(params, key, value) {
  if (value !== undefined && value !== null && value !== '') {
    params.append(key, value);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return sendJson(res, 500, { error: 'Stripe secret key is missing in Vercel environment variables.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const tier = body.tier;
    const email = String(body.email || '').trim().toLowerCase();
    const origin = String(body.origin || 'https://desk.fredheimtech.com').replace(/\/$/, '');
    const path = String(body.path || '/');

    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { error: 'Valid email is required.' });
    }

    if (tier !== 'active' && tier !== 'active_senior') {
      return sendJson(res, 400, { error: 'Invalid membership tier.' });
    }

    const price = tier === 'active_senior'
      ? (process.env.STRIPE_PRICE_SENIOR || DEFAULT_PRICE_SENIOR)
      : (process.env.STRIPE_PRICE_EXECUTIVE || DEFAULT_PRICE_EXECUTIVE);

    const params = new URLSearchParams();
    appendForm(params, 'mode', 'subscription');
    appendForm(params, 'customer_email', email);
    appendForm(params, 'line_items[0][price]', price);
    appendForm(params, 'line_items[0][quantity]', '1');
    appendForm(params, 'success_url', `${origin}${path}?view=myprofile&upgradeSuccess=${encodeURIComponent(tier)}&session_id={CHECKOUT_SESSION_ID}`);
    appendForm(params, 'cancel_url', `${origin}${path}?view=myprofile&upgradeCancelled=1`);
    appendForm(params, 'metadata[tier]', tier);
    appendForm(params, 'metadata[email]', email);

    const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await stripeResp.json();

    if (!stripeResp.ok) {
      console.error('Stripe checkout error:', data);
      return sendJson(res, stripeResp.status, {
        error: data?.error?.message || 'Stripe checkout session could not be created.',
        stripe_error: data?.error || null,
      });
    }

    return sendJson(res, 200, { url: data.url, id: data.id });
  } catch (err) {
    console.error('Checkout session handler error:', err);
    return sendJson(res, 500, { error: err.message || 'Checkout session failed.' });
  }
};
