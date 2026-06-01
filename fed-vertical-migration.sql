-- ============================================================================
-- Fredheim Desk — industry vertical migration
-- ----------------------------------------------------------------------------
-- Migrates stored free-text industry values from the legacy taxonomy
-- (operational verticals + 9 standalone technology verticals) to the current
-- six-vertical model:
--
--   Maritime & Shipping · Commodity Trading · Energy ·
--   Logistics & Supply Chain · Ports & Terminals · Offshore
--
-- This mirrors normalizeVertical() / LEGACY_VERTICAL_MAP in src/main.jsx.
-- It is IDEMPOTENT: it only rewrites legacy values, so re-running is a no-op.
-- The application also normalises on read, so this migration is optional
-- clean-up rather than a correctness requirement.
-- ============================================================================

BEGIN;

-- Reusable mapping applied to every table/column that stores an industry label.
-- Run once per (table, column) pair below.

-- 1. Candidate / executive profiles --------------------------------------------
UPDATE fed_profiles SET industry = CASE industry
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
  ELSE industry
END
WHERE industry IN (
  'Industrial Commodities','Industrial Commodities & Logistics','Bulk Commodities',
  'Trading & Freight','Supply Chain & Logistics','Energy & Offshore',
  'Maritime Technology','Port Technology','Logistics Technology','Supply Chain Technology',
  'Industrial SaaS','Fleet Intelligence','Operational AI','Industrial Automation',
  'Compliance & Safety Tech','Safety & Compliance Technology','Commercial Operations'
);

-- 2. Job / search postings -----------------------------------------------------
UPDATE fed_jobs SET industry = CASE industry
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
  ELSE industry
END
WHERE industry IN (
  'Industrial Commodities','Industrial Commodities & Logistics','Bulk Commodities',
  'Trading & Freight','Supply Chain & Logistics','Energy & Offshore',
  'Maritime Technology','Port Technology','Logistics Technology','Supply Chain Technology',
  'Industrial SaaS','Fleet Intelligence','Operational AI','Industrial Automation',
  'Compliance & Safety Tech','Safety & Compliance Technology','Commercial Operations'
);

-- 3. Recruiter submissions (pre-publish drafts) --------------------------------
UPDATE fed_recruiter_submissions SET industry = CASE industry
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
  ELSE industry
END
WHERE industry IN (
  'Industrial Commodities','Industrial Commodities & Logistics','Bulk Commodities',
  'Trading & Freight','Supply Chain & Logistics','Energy & Offshore',
  'Maritime Technology','Port Technology','Logistics Technology','Supply Chain Technology',
  'Industrial SaaS','Fleet Intelligence','Operational AI','Industrial Automation',
  'Compliance & Safety Tech','Safety & Compliance Technology','Commercial Operations'
);

-- 4. Recruiter profiles (industry_focus) ---------------------------------------
UPDATE fed_recruiter_profiles SET industry_focus = CASE industry_focus
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
  ELSE industry_focus
END
WHERE industry_focus IN (
  'Industrial Commodities','Industrial Commodities & Logistics','Bulk Commodities',
  'Trading & Freight','Supply Chain & Logistics','Energy & Offshore',
  'Maritime Technology','Port Technology','Logistics Technology','Supply Chain Technology',
  'Industrial SaaS','Fleet Intelligence','Operational AI','Industrial Automation',
  'Compliance & Safety Tech','Safety & Compliance Technology','Commercial Operations'
);

-- ============================================================================
-- First-class subcategory (specialization) columns
-- ----------------------------------------------------------------------------
-- The application already stores specializations inside JSON
-- (candidate_operating_profile.subcategories for profiles, job_requirements
-- .intake.subcategory for recruiter submissions, and the tags array for
-- published jobs). These columns promote them to a queryable top-level array
-- so they can be filtered/reported on in SQL. Additive and nullable, so the
-- app works with or without this migration; the app writes them best-effort.
-- ============================================================================

ALTER TABLE fed_profiles             ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';
ALTER TABLE fed_jobs                 ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';
ALTER TABLE fed_recruiter_submissions ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';

-- Backfill candidate profiles from the dedicated JSON key.
UPDATE fed_profiles
   SET subcategories = ARRAY(SELECT jsonb_array_elements_text(candidate_operating_profile->'subcategories'))
 WHERE jsonb_typeof(candidate_operating_profile) = 'object'
   AND jsonb_typeof(candidate_operating_profile->'subcategories') = 'array'
   AND (subcategories IS NULL OR subcategories = '{}');

-- Backfill recruiter submissions from the intake JSON.
UPDATE fed_recruiter_submissions
   SET subcategories = ARRAY(SELECT jsonb_array_elements_text(job_requirements->'intake'->'subcategory'))
 WHERE jsonb_typeof(job_requirements) = 'object'
   AND jsonb_typeof(job_requirements->'intake'->'subcategory') = 'array'
   AND (subcategories IS NULL OR subcategories = '{}');

-- Note: published jobs (fed_jobs) are not backfilled here. Pre-existing rows
-- carried no specialization data (tags was empty), and newly published jobs
-- populate fed_jobs.subcategories via the application's best-effort write.
-- Casting the free-form tags text to jsonb in bulk could abort the migration
-- on any malformed legacy row, so it is intentionally avoided.

COMMIT;
