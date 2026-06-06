-- Live postings require an account. Replace the broad "any active job is public"
-- read policies with role-specific ones:
--   anon (logged out)  -> only active SAMPLE postings (demo_post = true)
--   authenticated      -> any active posting, plus their own postings (any status)
-- The service role bypasses RLS (matching engine, admin, recruiter-dash API).
DROP POLICY IF EXISTS "Public can view active jobs" ON public.fed_jobs;
DROP POLICY IF EXISTS jobs_public_read ON public.fed_jobs;

CREATE POLICY jobs_anon_samples ON public.fed_jobs
  FOR SELECT TO anon
  USING (status = 'active' AND demo_post = true);

CREATE POLICY jobs_auth_read ON public.fed_jobs
  FOR SELECT TO authenticated
  USING (status = 'active' OR lower(firm_email) = lower(COALESCE(auth.email(), '')));
