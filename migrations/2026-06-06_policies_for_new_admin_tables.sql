-- fed_recruiter_billing & fed_leaderboard_overrides are admin-managed reference
-- tables. Server code (service role) bypasses RLS; the admin console reads and
-- updates them client-side via the anon client. Mirror the app's existing
-- access pattern with permissive policies so the built UI works.
-- (fed_recruiter_profiles and fed_leaderboard_snapshots have no client access
--  and intentionally keep RLS enabled with no policy = service-role only.)

CREATE POLICY recruiter_billing_read   ON public.fed_recruiter_billing FOR SELECT USING (true);
CREATE POLICY recruiter_billing_insert ON public.fed_recruiter_billing FOR INSERT WITH CHECK (true);
CREATE POLICY recruiter_billing_update ON public.fed_recruiter_billing FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY leaderboard_overrides_read   ON public.fed_leaderboard_overrides FOR SELECT USING (true);
CREATE POLICY leaderboard_overrides_insert ON public.fed_leaderboard_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY leaderboard_overrides_update ON public.fed_leaderboard_overrides FOR UPDATE USING (true) WITH CHECK (true);
