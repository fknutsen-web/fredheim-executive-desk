-- RLS hardening — Phase 1: lock down write/exec surface the browser never uses.
--
-- Context: the front-end talks to Postgres with the public *publishable* key
-- (anon / authenticated roles). The api/ server uses the SERVICE-ROLE key, which
-- BYPASSES RLS entirely — so removing public-facing grants here affects ONLY the
-- unauthenticated REST surface, never any server write. Each item below was
-- verified to have no client (src/main.jsx) usage before removal.
--
-- This phase intentionally does NOT touch the policies that the browser still
-- depends on (admin moderation of fed_jobs / fed_job_closures / fed_placements /
-- fed_comp_benchmarks, employer fed_intern_jobs posts, recruiter edit-own-job,
-- view/interest counters). Those require moving the writes server-side first and
-- are tracked as Phase 2.

-- 1. app_state — not referenced anywhere in client or server code.
DROP POLICY IF EXISTS fredheim_full_access ON app_state;          -- anon+auth ALL (true)
DROP POLICY IF EXISTS auth_write ON app_state;                    -- authenticated INSERT
DROP POLICY IF EXISTS auth_write_app_state ON app_state;          -- authenticated INSERT
DROP POLICY IF EXISTS "authenticated users can upsert app_state" ON app_state;

-- 2. fed_matches / fed_notifications — rows are only ever INSERTed server-side
--    (compute-matches / notify-*). The client only reads/updates its own rows
--    via scoped policies, which are left intact.
DROP POLICY IF EXISTS matches_service_insert ON fed_matches;
DROP POLICY IF EXISTS notifications_insert_service ON fed_notifications;

-- 3. SECURITY DEFINER infrastructure functions were executable via the public
--    REST API (EXECUTE was granted to PUBLIC). The client never calls them.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_workspaces() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_workspaces() TO service_role;
