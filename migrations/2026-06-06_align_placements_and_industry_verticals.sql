-- 1. leaderboard.js reads fed_placements.placement_status (lifecycle status
--    distinct from payment_status/invoice_status). Add the column so the
--    leaderboard endpoint stops erroring on an unknown column.
ALTER TABLE public.fed_placements ADD COLUMN IF NOT EXISTS placement_status text;

-- 2. Industry vertical normalisation (mirrors src/main.jsx LEGACY_VERTICAL_MAP).
--    Idempotent: only rewrites known legacy labels. Applied to every column that
--    stores an industry label, including fed_recruiter_profiles.industry_focus.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('fed_profiles','industry'),
      ('fed_jobs','industry'),
      ('fed_recruiter_submissions','industry'),
      ('fed_recruiter_profiles','industry_focus')
    ) AS v(tbl, col)
  LOOP
    EXECUTE format($f$
      UPDATE public.%I SET %I = CASE %I
        WHEN 'Industrial Commodities'             THEN 'Commodity Trading'
        WHEN 'Industrial Commodities & Logistics' THEN 'Commodity Trading'
        WHEN 'Bulk Commodities'                   THEN 'Commodity Trading'
        WHEN 'Trading & Freight'                  THEN 'Commodity Trading'
        WHEN 'Supply Chain & Logistics'           THEN 'Logistics & Supply Chain'
        WHEN 'Energy & Offshore'                  THEN 'Energy'
        WHEN 'Maritime Technology'                THEN 'Maritime & Shipping'
        WHEN 'Port Technology'                    THEN 'Ports & Terminals'
        WHEN 'Logistics Technology'               THEN 'Logistics & Supply Chain'
        WHEN 'Supply Chain Technology'            THEN 'Logistics & Supply Chain'
        WHEN 'Industrial SaaS'                    THEN 'Maritime & Shipping'
        WHEN 'Fleet Intelligence'                 THEN 'Maritime & Shipping'
        WHEN 'Operational AI'                     THEN 'Maritime & Shipping'
        WHEN 'Industrial Automation'              THEN 'Maritime & Shipping'
        WHEN 'Compliance & Safety Tech'           THEN 'Maritime & Shipping'
        WHEN 'Safety & Compliance Technology'     THEN 'Maritime & Shipping'
        WHEN 'Commercial Operations'              THEN 'Maritime & Shipping'
        ELSE %I END
    $f$, t.tbl, t.col, t.col, t.col);
  END LOOP;
END $$;
