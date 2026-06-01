-- ============================================================================
-- Fredheim Desk — setup / required-table provisioning (idempotent)
-- ----------------------------------------------------------------------------
-- Ensures tables the application depends on exist. Safe to run any time and
-- any number of times (CREATE TABLE IF NOT EXISTS). Run this BEFORE the data
-- migration if you are provisioning a fresh or partially-provisioned database.
-- ============================================================================

-- fed_leaderboard_overrides ---------------------------------------------------
-- Backs the admin "Approved for leaderboard display" / suppress / ineligible
-- controls. The public leaderboard's verification gate reads `approved` from
-- here, and api/leaderboard.js upserts on the recruiter_email conflict key —
-- so recruiter_email must carry a unique/primary-key constraint.
CREATE TABLE IF NOT EXISTS fed_leaderboard_overrides (
  recruiter_email       text PRIMARY KEY,
  approved              boolean NOT NULL DEFAULT false,
  suppressed            boolean NOT NULL DEFAULT false,
  suppression_reason    text,
  ineligible            boolean NOT NULL DEFAULT false,
  ineligibility_reason  text,
  admin_notes           text,
  updated_by            text,
  updated_at            timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now()
);
