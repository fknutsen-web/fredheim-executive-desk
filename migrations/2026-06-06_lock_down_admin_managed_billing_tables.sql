-- Admin billing/override reads and writes now go through service-role endpoints
-- (admin-oversight.js ?resource=billing|overrides, recruiter-billing.js
-- admin_set_status, leaderboard.js POST override). Remove the permissive public
-- policies added in 2026-06-06_policies_for_new_admin_tables.sql so these tables
-- are service-role only, consistent with fed_recruiter_profiles /
-- fed_leaderboard_snapshots.

-- Column the admin approve flow records (was previously written client-side).
ALTER TABLE public.fed_recruiter_billing ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz;

DROP POLICY IF EXISTS recruiter_billing_read   ON public.fed_recruiter_billing;
DROP POLICY IF EXISTS recruiter_billing_insert ON public.fed_recruiter_billing;
DROP POLICY IF EXISTS recruiter_billing_update ON public.fed_recruiter_billing;

DROP POLICY IF EXISTS leaderboard_overrides_read   ON public.fed_leaderboard_overrides;
DROP POLICY IF EXISTS leaderboard_overrides_insert ON public.fed_leaderboard_overrides;
DROP POLICY IF EXISTS leaderboard_overrides_update ON public.fed_leaderboard_overrides;
