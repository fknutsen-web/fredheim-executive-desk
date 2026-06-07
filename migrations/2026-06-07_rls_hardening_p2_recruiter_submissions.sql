-- RLS hardening — Phase 2: fed_recruiter_submissions.
--
-- `Service can read all submissions` was SELECT USING(true) for the public role:
-- any anon caller could read every recruiter inquiry (firm, contact email,
-- intake) via the publishable key — a confidentiality leak. `Admin can update
-- submissions` (UPDATE true) let anyone change a submission's status.
--
-- Admin read/update now go through the service role (admin-oversight
-- ?resource=submissions / admin-actions submission_status). Recruiters still
-- read their OWN submission via recruiters_read_own_submission; the public
-- "Anyone can submit recruiter inquiry" INSERT is unchanged.
DROP POLICY IF EXISTS "Service can read all submissions" ON fed_recruiter_submissions;
DROP POLICY IF EXISTS "Admin can update submissions" ON fed_recruiter_submissions;
