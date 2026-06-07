-- RLS hardening — Phase 2 cleanup: fed_consulting_briefs.
-- 'Admin can update briefs' (UPDATE true, public) let anyone modify any
-- consulting brief. Nothing in the client or server updates fed_consulting_briefs
-- (only a public read + the public "submit a brief" insert), so it was unused.
-- Public SELECT (active briefs) + the submit INSERT remain (intentional).
DROP POLICY IF EXISTS "Admin can update briefs" ON fed_consulting_briefs;
