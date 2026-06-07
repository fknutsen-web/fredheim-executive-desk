-- RLS hardening — Phase 2: fed_intern_jobs.
--
-- `intern_jobs_service_all` (ALL true, public) let any anon caller
-- insert/update/DELETE intern jobs AND read every active intern job, which
-- silently bypassed the anon=samples-only / authenticated=live gating added in
-- 2026-06-07_intern_jobs_rls_gate_samples.sql.
--
-- Replace it with a public INSERT only (the "Post an Internship" form, matching
-- the other public submission forms). Reads now correctly fall through to the
-- gating SELECT policies; UPDATE/DELETE become service-role-only. No client code
-- change (insert still works; reads already used the gating policies).
DROP POLICY IF EXISTS intern_jobs_service_all ON fed_intern_jobs;

CREATE POLICY intern_jobs_public_insert ON fed_intern_jobs
  FOR INSERT TO public
  WITH CHECK (true);
