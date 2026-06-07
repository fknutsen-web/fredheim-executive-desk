-- RLS hardening — Phase 2 (final): fed_references referee questionnaire.
--
-- `Token holder can read reference` (SELECT true) and `Anyone can complete
-- questionnaire` (UPDATE true) let any anon caller read or overwrite ANY
-- reference via the publishable key. The referee flow now goes through the
-- token-validated service-role endpoint /api/reference-questionnaire.

-- Part 1 (ADDITIVE — applied before the client deploy): the candidate's own
-- "my references" view used to read via the always-true SELECT policy; give it a
-- scoped read so it keeps working after the always-true policy is dropped.
DROP POLICY IF EXISTS references_candidate_read ON fed_references;
CREATE POLICY references_candidate_read ON fed_references
  FOR SELECT TO authenticated
  USING (lower(profile_email) = lower(COALESCE(auth.email(), '')));

-- Part 2 (DROPS — applied AFTER the client deploy is live):
DROP POLICY IF EXISTS "Token holder can read reference"   ON fed_references;
DROP POLICY IF EXISTS "Anyone can complete questionnaire" ON fed_references;
-- Kept: "Anyone can create reference request" (INSERT) — candidate-initiated.
