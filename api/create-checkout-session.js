const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { tier, email } = req.body || {};

    const priceId =
      tier === "senior"
        ? process.env.ACTIVE_PRICE_SENIOR
        : tier === "executive"
        ? process.env.ACTIVE_PRICE_EXECUTIVE
        : null;

    if (!priceId) {
      return res.status(400).json({
        error:
          "Missing or invalid tier, or missing ACTIVE_PRICE_SENIOR / ACTIVE_PRICE_EXECUTIVE in Vercel.",
      });
    }

    const baseUrl = req.headers.origin || "https://desk.fredheimtech.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}?view=myprofile&checkout=success&tier=${tier}`,
      cancel_url: `${baseUrl}?view=pricing&checkout=cancelled`,
      metadata: {
        tier,
        email: email || "",
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error:", err);

    return res.status(500).json({
      error: err.message || "Checkout session failed.",
    });
  }
};
