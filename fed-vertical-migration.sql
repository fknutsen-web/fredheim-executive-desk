-- ============================================================================
-- Fredheim Desk — industry vertical migration (defensive / idempotent)
-- ----------------------------------------------------------------------------
-- Migrates stored free-text industry values from the legacy taxonomy
-- (operational verticals + 9 standalone technology verticals) to the current
-- six-vertical model:
--
--   Maritime & Shipping · Commodity Trading · Energy ·
--   Logistics & Supply Chain · Ports & Terminals · Offshore
--
-- Mirrors normalizeVertical() / LEGACY_VERTICAL_MAP in src/main.jsx.
--
-- SAFE TO RE-RUN. Every table/column is guarded with to_regclass /
-- information_schema checks, so anything that does not exist in this database
-- (e.g. fed_recruiter_profiles) is silently skipped rather than aborting the
-- whole migration. JSON backfills only run when the source column is json/jsonb.
-- ============================================================================

BEGIN;

-- Shared legacy → current vertical mapping (lives only for this transaction).
CREATE TEMP TABLE _vmap(old text PRIMARY KEY, new text) ON COMMIT DROP;
INSERT INTO _vmap(old, new) VALUES
  ('Industrial Commodities',             'Commodity Trading'),
  ('Industrial Commodities & Logistics', 'Commodity Trading'),
  ('Bulk Commodities',                   'Commodity Trading'),
  ('Trading & Freight',                  'Commodity Trading'),
  ('Supply Chain & Logistics',           'Logistics & Supply Chain'),
  ('Energy & Offshore',                  'Energy'),
  ('Maritime Technology',                'Maritime & Shipping'),
  ('Port Technology',                    'Ports & Terminals'),
  ('Logistics Technology',               'Logistics & Supply Chain'),
  ('Supply Chain Technology',            'Logistics & Supply Chain'),
  ('Industrial SaaS',                    'Maritime & Shipping'),
  ('Fleet Intelligence',                 'Maritime & Shipping'),
  ('Operational AI',                     'Maritime & Shipping'),
  ('Industrial Automation',              'Maritime & Shipping'),
  ('Compliance & Safety Tech',           'Maritime & Shipping'),
  ('Safety & Compliance Technology',     'Maritime & Shipping'),
  ('Commercial Operations',              'Maritime & Shipping');

-- ----------------------------------------------------------------------------
-- 1. Normalise legacy industry labels (only on tables/columns that exist)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.fed_profiles') IS NOT NULL THEN
    UPDATE fed_profiles t SET industry = m.new FROM _vmap m WHERE t.industry = m.old;
    RAISE NOTICE 'fed_profiles.industry normalised';
  ELSE
    RAISE NOTICE 'skip: fed_profiles not found';
  END IF;

  IF to_regclass('public.fed_jobs') IS NOT NULL THEN
    UPDATE fed_jobs t SET industry = m.new FROM _vmap m WHERE t.industry = m.old;
    RAISE NOTICE 'fed_jobs.industry normalised';
  ELSE
    RAISE NOTICE 'skip: fed_jobs not found';
  END IF;

  IF to_regclass('public.fed_recruiter_submissions') IS NOT NULL THEN
    UPDATE fed_recruiter_submissions t SET industry = m.new FROM _vmap m WHERE t.industry = m.old;
    RAISE NOTICE 'fed_recruiter_submissions.industry normalised';
  ELSE
    RAISE NOTICE 'skip: fed_recruiter_submissions not found';
  END IF;

  -- Optional table — present in some deployments only.
  IF to_regclass('public.fed_recruiter_profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'fed_recruiter_profiles' AND column_name = 'industry_focus') THEN
    UPDATE fed_recruiter_profiles t SET industry_focus = m.new FROM _vmap m WHERE t.industry_focus = m.old;
    RAISE NOTICE 'fed_recruiter_profiles.industry_focus normalised';
  ELSE
    RAISE NOTICE 'skip: fed_recruiter_profiles.industry_focus not found';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Add first-class subcategory (specialization) columns where the table exists
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.fed_profiles') IS NOT NULL THEN
    ALTER TABLE fed_profiles ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';
  END IF;
  IF to_regclass('public.fed_jobs') IS NOT NULL THEN
    ALTER TABLE fed_jobs ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';
  END IF;
  IF to_regclass('public.fed_recruiter_submissions') IS NOT NULL THEN
    ALTER TABLE fed_recruiter_submissions ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Backfill specializations from existing JSON (only when source is json/jsonb)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Candidate profiles ← candidate_operating_profile.subcategories
  IF to_regclass('public.fed_profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'fed_profiles'
                   AND column_name = 'candidate_operating_profile'
                   AND data_type IN ('json','jsonb')) THEN
    UPDATE fed_profiles
       SET subcategories = ARRAY(SELECT jsonb_array_elements_text((candidate_operating_profile::jsonb)->'subcategories'))
     WHERE jsonb_typeof(candidate_operating_profile::jsonb) = 'object'
       AND jsonb_typeof((candidate_operating_profile::jsonb)->'subcategories') = 'array'
       AND (subcategories IS NULL OR cardinality(subcategories) = 0);
    RAISE NOTICE 'fed_profiles.subcategories backfilled';
  END IF;

  -- Recruiter submissions ← job_requirements.intake.subcategory
  IF to_regclass('public.fed_recruiter_submissions') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'fed_recruiter_submissions'
                   AND column_name = 'job_requirements'
                   AND data_type IN ('json','jsonb')) THEN
    UPDATE fed_recruiter_submissions
       SET subcategories = ARRAY(SELECT jsonb_array_elements_text((job_requirements::jsonb)->'intake'->'subcategory'))
     WHERE jsonb_typeof(job_requirements::jsonb) = 'object'
       AND jsonb_typeof((job_requirements::jsonb)->'intake'->'subcategory') = 'array'
       AND (subcategories IS NULL OR cardinality(subcategories) = 0);
    RAISE NOTICE 'fed_recruiter_submissions.subcategories backfilled';
  END IF;

  -- Published jobs (fed_jobs) are not backfilled: pre-existing rows carried no
  -- specialization data, and new jobs populate the column via the app.
END $$;

COMMIT;
