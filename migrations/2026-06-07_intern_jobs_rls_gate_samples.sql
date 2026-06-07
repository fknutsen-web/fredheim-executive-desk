-- Gate live internship postings behind sign-in, mirroring fed_jobs.
--
-- Before: fed_intern_jobs had a single `intern_jobs_public_read` policy
--   (status = 'active') readable by everyone — so logged-out visitors saw
--   every real internship. The main board (fed_jobs) instead shows anon users
--   only the demo_post=true samples and reserves live postings for signed-in
--   users. This aligns fed_intern_jobs with that model.
--
-- After:
--   * anon            -> active AND demo_post = true   (per-vertical samples only)
--   * authenticated   -> active, plus the employer's own postings (any status)
--   * service role     -> unchanged (intern_jobs_service_all bypasses via service key)
--
-- Safe/idempotent: drops the old policy and recreates the new ones.

DROP POLICY IF EXISTS intern_jobs_public_read   ON fed_intern_jobs;
DROP POLICY IF EXISTS intern_jobs_anon_samples   ON fed_intern_jobs;
DROP POLICY IF EXISTS intern_jobs_auth_read       ON fed_intern_jobs;

CREATE POLICY intern_jobs_anon_samples ON fed_intern_jobs
  FOR SELECT TO anon
  USING (status = 'active' AND demo_post = true);

CREATE POLICY intern_jobs_auth_read ON fed_intern_jobs
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR lower(employer_email) = lower(COALESCE(auth.email(), ''))
  );
