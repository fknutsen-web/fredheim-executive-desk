-- RLS hardening — Phase 2, vertical 1/N: comp benchmarks.
--
-- The admin benchmark editor used to UPDATE/INSERT fed_comp_benchmarks directly
-- from the browser (anon key) under the always-true `comp_benchmarks_service_all`
-- policy. Those writes now go through POST /api/admin-actions (service role +
-- isAuthorizedAdmin). This replaces the ALL-true policy with a public SELECT
-- (benchmark data is non-confidential market data the matching UI reads) so
-- reads keep working, while INSERT/UPDATE/DELETE become service-role-only.
DROP POLICY IF EXISTS comp_benchmarks_service_all ON fed_comp_benchmarks;

CREATE POLICY comp_benchmarks_public_read ON fed_comp_benchmarks
  FOR SELECT TO public
  USING (true);

-- Rollback (if the admin editor regresses before the endpoint is confirmed):
--   DROP POLICY comp_benchmarks_public_read ON fed_comp_benchmarks;
--   CREATE POLICY comp_benchmarks_service_all ON fed_comp_benchmarks FOR ALL TO public USING (true);
