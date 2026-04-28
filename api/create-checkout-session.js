module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "Missing STRIPE_SECRET_KEY in Vercel environment variables.",
      });
    }

    if (!process.env.ACTIVE_PRICE_SENIOR) {
      return res.status(500).json({
        error: "Missing ACTIVE_PRICE_SENIOR in Vercel environment variables.",
      });
    }

    if (!process.env.ACTIVE_PRICE_EXECUTIVE) {
      return res.status(500).json({
        error: "Missing ACTIVE_PRICE_EXECUTIVE in Vercel environment variables.",
      });
    }

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const { tier, email } = req.body || {};
    const rawTier = String(tier || "").trim().toLowerCase();

    const seniorAliases = [
      "senior",
      "active_senior",
      "senior professional",
      "senior_professional",
      "senior-professional",
    ];

    const executiveAliases = [
      "executive",
      "active_executive",
      "exec",
      "executive profile",
    ];

    const normalizedTier = seniorAliases.includes(rawTier)
      ? "senior"
      : executiveAliases.includes(rawTier)
      ? "executive"
      : null;

    if (!normalizedTier) {
      return res.status(400).json({
        error: `Invalid tier '${tier}'. Expected 'senior' or 'executive'.`,
      });
    }

    const priceId =
      normalizedTier === "senior"
        ? process.env.ACTIVE_PRICE_SENIOR
        : process.env.ACTIVE_PRICE_EXECUTIVE;

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
      success_url: `${baseUrl}?view=myprofile&checkout=success&tier=${normalizedTier}`,
      cancel_url: `${baseUrl}?view=pricing&checkout=cancelled`,
      metadata: {
        tier: normalizedTier,
        originalTier: rawTier,
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
