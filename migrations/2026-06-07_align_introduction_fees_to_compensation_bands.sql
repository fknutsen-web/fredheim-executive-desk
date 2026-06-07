-- ============================================================================
-- Align curated-introduction pricing in fed_pricing_config with the
-- compensation-tiered fee the platform actually charges, and with the deployed
-- application code (PR #10 / PAY-1).
--
-- The fee is compensation-tiered (see api/lib/introduction-fees.js and the
-- public pricing on index.html / src/main.jsx):
--     < $100,000          -> $99
--     $100,000 – $250,000 -> $495
--     $250,000 – $500,000 -> $995
--     > $500,000          -> $2,500
--   (early-career / individual-contributor introductions remain complimentary)
--
-- fed_pricing_config previously held the obsolete title-based amounts
-- ($495 C-Suite / $295 VP-SVP / $149 Director / $79 Consultant). PR #10 updated
-- the application's PRICING_CONFIG_DEFAULTS to the compensation-tiered amounts
-- while KEEPING the original key names, so this migration re-values the same
-- keys in the database — one shared key vocabulary across DB and code.
--
-- Recruiter Standard ($199/mo), Candidate Executive ($299/yr) and Featured
-- Intern ($49/yr) already matched and are left untouched.
-- ============================================================================

begin;

-- 1. Re-value the introduction-fee rows to the compensation-tiered amounts,
--    matching src/main.jsx PRICING_CONFIG_DEFAULTS. Key names are retained.
update public.fed_pricing_config set value_int = 2500, value_decimal = null, value_text = null,
       is_active = true, display_order = 20, category = 'introduction_fee',
       label = 'Curated Introduction — above $500K comp',
       updated_at = now(), updated_by = 'alignment-migration'
 where key = 'introduction_csuite';

update public.fed_pricing_config set value_int = 995, value_decimal = null, value_text = null,
       is_active = true, display_order = 21, category = 'introduction_fee',
       label = 'Curated Introduction — $250K–$500K comp',
       updated_at = now(), updated_by = 'alignment-migration'
 where key = 'introduction_vp_svp';

update public.fed_pricing_config set value_int = 495, value_decimal = null, value_text = null,
       is_active = true, display_order = 22, category = 'introduction_fee',
       label = 'Curated Introduction — $100K–$250K comp',
       updated_at = now(), updated_by = 'alignment-migration'
 where key = 'introduction_director';

update public.fed_pricing_config set value_int = 99, value_decimal = null, value_text = null,
       is_active = true, display_order = 23, category = 'introduction_fee',
       label = 'Curated Introduction — under $100K comp',
       updated_at = now(), updated_by = 'alignment-migration'
 where key = 'introduction_consultant';

update public.fed_pricing_config set value_int = 0, is_active = true, display_order = 24,
       label = 'Curated Introduction — early career (complimentary)',
       updated_at = now(), updated_by = 'alignment-migration'
 where key = 'introduction_early_career';

-- 2. Restore the leadership-class fee map to the retained key names. The fee
--    actually charged is derived from real compensation
--    (api/lib/introduction-fees.js); this map is a display-only fallback, so
--    each class points at its representative compensation tier.
update public.fed_introduction_fee_by_class set pricing_key = 'introduction_csuite'     where leadership_class in ('c_suite', 'evp');
update public.fed_introduction_fee_by_class set pricing_key = 'introduction_vp_svp'      where leadership_class in ('svp', 'vp');
update public.fed_introduction_fee_by_class set pricing_key = 'introduction_director'    where leadership_class in ('senior_director', 'director');
update public.fed_introduction_fee_by_class set pricing_key = 'introduction_consultant'  where leadership_class in ('senior_manager', 'manager');

commit;
