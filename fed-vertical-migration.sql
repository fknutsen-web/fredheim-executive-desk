-- ============================================================================
-- Trovant Talent — industry vertical migration
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

COMMIT;
