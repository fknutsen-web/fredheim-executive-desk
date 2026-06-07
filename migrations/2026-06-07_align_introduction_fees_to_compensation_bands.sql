-- ============================================================================
-- Align curated-introduction pricing in fed_pricing_config with the published
-- (website) model and the fee actually charged at checkout.
--
-- The platform charges a COMPENSATION-BAND introduction fee — see
-- api/lib/introduction-fees.js and the public pricing rendered in index.html
-- and src/main.jsx:
--     < $100,000          -> $99
--     $100,000 – $250,000 -> $495
--     $250,000 – $500,000 -> $995
--     > $500,000          -> $2,500
--   (early-career / individual-contributor introductions remain complimentary)
--
-- fed_pricing_config previously encoded an obsolete TITLE-based model
-- ($495 C-Suite / $295 VP-SVP / $149 Director / $79 Consultant) that no longer
-- matched what the site shows or what create-checkout-session.js charges.
--
-- Recruiter Standard ($199/mo), Candidate Executive ($299/yr) and Featured
-- Intern ($49/yr) already matched the site and are left untouched.
-- ============================================================================

begin;

-- 1. Retire the obsolete title-based introduction-fee rows. They are kept
--    (inactive) for historical reference; /api/pricing-config only serves
--    rows where is_active = true.
update public.fed_pricing_config
   set is_active  = false,
       updated_at = now(),
       updated_by = 'alignment-migration'
 where key in ('introduction_csuite', 'introduction_vp_svp',
               'introduction_director', 'introduction_consultant');

-- 2. Upsert the four compensation-band introduction-fee rows that match the
--    published website pricing and api/lib/introduction-fees.js.
insert into public.fed_pricing_config
  (key, value_int, unit, label, category, is_active, display_order, updated_at, updated_by)
values
  ('introduction_comp_under_100k',   99, 'usd', 'Curated Introduction — comp under $100K',  'introduction_fee', true, 20, now(), 'alignment-migration'),
  ('introduction_comp_100k_250k',   495, 'usd', 'Curated Introduction — comp $100K–$250K',  'introduction_fee', true, 21, now(), 'alignment-migration'),
  ('introduction_comp_250k_500k',   995, 'usd', 'Curated Introduction — comp $250K–$500K',  'introduction_fee', true, 22, now(), 'alignment-migration'),
  ('introduction_comp_over_500k',  2500, 'usd', 'Curated Introduction — comp above $500K',  'introduction_fee', true, 23, now(), 'alignment-migration')
on conflict (key) do update
   set value_int     = excluded.value_int,
       value_decimal = null,
       value_text    = null,
       unit          = excluded.unit,
       label         = excluded.label,
       category      = excluded.category,
       is_active     = true,
       display_order = excluded.display_order,
       updated_at    = now(),
       updated_by    = 'alignment-migration';

-- Keep the complimentary early-career tier active and correct.
update public.fed_pricing_config
   set value_int     = 0,
       is_active     = true,
       display_order = 24,
       label         = 'Curated Introduction — early career (complimentary)',
       updated_at    = now(),
       updated_by    = 'alignment-migration'
 where key = 'introduction_early_career';

-- 3. Repoint the leadership-class fee map to the new compensation-band keys.
--    The fee actually charged is derived from real compensation
--    (api/lib/introduction-fees.js); this table is display-only, so each class
--    is pointed at its representative compensation band.
update public.fed_introduction_fee_by_class set pricing_key = 'introduction_comp_over_500k'  where leadership_class in ('c_suite', 'evp');
update public.fed_introduction_fee_by_class set pricing_key = 'introduction_comp_250k_500k'  where leadership_class in ('svp', 'vp');
update public.fed_introduction_fee_by_class set pricing_key = 'introduction_comp_100k_250k'  where leadership_class in ('senior_director', 'director');
update public.fed_introduction_fee_by_class set pricing_key = 'introduction_comp_under_100k' where leadership_class in ('senior_manager', 'manager');

commit;
