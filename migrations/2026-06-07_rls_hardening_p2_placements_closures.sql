-- RLS hardening — Phase 2: fed_placements / fed_job_closures.
--
-- placements_admin_all (ALL true) gave any public caller full read+write on
-- placement/revenue records; closures_admin_update (UPDATE true) let anyone
-- change a closure's review status. Admin review reads/writes now go through the
-- service role (admin-oversight ?resource=placements|closures, admin-actions
-- placement_review|closure_review).
--
-- Kept: scoped recruiter reads (placements_recruiter_read / closures_recruiter_read),
-- recruiter placement insert (placements_recruiter_insert), public closure
-- submission (closures_insert).
DROP POLICY IF EXISTS placements_admin_all ON fed_placements;
DROP POLICY IF EXISTS closures_admin_update ON fed_job_closures;
