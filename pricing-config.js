// api/pricing-config.js
//
// Returns the current pricing config — pulled from fed_pricing_config and
// fed_introduction_fee_by_class. The front end calls this on mount and
// merges over its hardcoded defaults in src/main.jsx (PRICING_CONFIG).
//
// Phase 2 can adjust any value via SQL or a future admin UI without
// touching application code.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LiDWOkL4YYQfp7b9GWzFHA_ND5Lxgry';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60'); // 60s cache - cheap to refresh
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const { data: rows, error } = await db
      .from('fed_pricing_config')
      .select('key, value_int, value_text, value_decimal, unit, label, category, is_active, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      // Don't break the front end - return an empty config; main.jsx defaults take over.
      console.error('pricing-config load error:', error);
      return res.status(200).json({ ok: false, config: {}, fee_by_class: {} });
    }

    const config = {};
    for (const r of rows || []) {
      // Prefer the populated typed field
      const value = r.value_int !== null && r.value_int !== undefined ? r.value_int
                  : r.value_decimal !== null && r.value_decimal !== undefined ? Number(r.value_decimal)
                  : r.value_text;
      config[r.key] = {
        value,
        unit:     r.unit,
        label:    r.label,
        category: r.category,
      };
    }

    // Build the leadership_class -> fee_amount map for direct lookup
    const { data: feeRows } = await db
      .from('fed_introduction_fee_by_class')
      .select('leadership_class, pricing_key');

    const fee_by_class = {};
    for (const r of feeRows || []) {
      const cfg = config[r.pricing_key];
      if (cfg) fee_by_class[r.leadership_class] = cfg.value;
    }

    return res.status(200).json({ ok: true, config, fee_by_class });
  } catch (e) {
    console.error('pricing-config exception:', e);
    return res.status(200).json({ ok: false, config: {}, fee_by_class: {} });
  }
};
