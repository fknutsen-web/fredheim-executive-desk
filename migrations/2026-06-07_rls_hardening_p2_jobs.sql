-- RLS hardening — Phase 2: fed_jobs moderation + recruiter edit-own + counters.
-- Applied in two parts to avoid any breakage window on this customer-facing table.

-- ── Part 1 (ADDITIVE — applied before the client deploy) ─────────────────────
CREATE OR REPLACE FUNCTION public.fed_increment_job_view(p_job_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE fed_jobs SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_job_id;
$$;
CREATE OR REPLACE FUNCTION public.fed_increment_job_interest(p_job_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE fed_jobs SET interest_count = COALESCE(interest_count, 0) + 1 WHERE id = p_job_id;
$$;
REVOKE EXECUTE ON FUNCTION public.fed_increment_job_view(uuid)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fed_increment_job_interest(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fed_increment_job_view(uuid)     TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fed_increment_job_interest(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS jobs_owner_update ON fed_jobs;
CREATE POLICY jobs_owner_update ON fed_jobs
  FOR UPDATE TO authenticated
  USING (lower(firm_email) = lower(COALESCE(auth.email(), '')))
  WITH CHECK (lower(firm_email) = lower(COALESCE(auth.email(), '')));

-- ── Part 2 (DROPS — applied AFTER the client deploy is live) ─────────────────
-- Admin publish/moderation now goes through /api/admin-actions (job_insert /
-- job_admin_update, service role); admin job reads through
-- /api/admin-oversight?resource=jobs; counters through the RPCs above; recruiter
-- edit-own through jobs_owner_update. So the always-true policies can go:
DROP POLICY IF EXISTS "Admin can update jobs"        ON fed_jobs;
DROP POLICY IF EXISTS "Admin can insert jobs"        ON fed_jobs;
DROP POLICY IF EXISTS "Anyone can increment job views" ON fed_jobs;
-- status-history admin inserts now run server-side (service role); server
-- job-close/job-fill use the service role too.
DROP POLICY IF EXISTS job_history_insert_auth ON fed_job_status_history;
