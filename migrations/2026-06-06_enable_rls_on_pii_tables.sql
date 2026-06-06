-- fed_matches: RLS policies already exist (per-user candidate/recruiter reads,
-- service insert) but RLS was never enabled, so the public publishable key could
-- read every row incl. candidate_email. Enable RLS to activate those policies.
ALTER TABLE public.fed_matches ENABLE ROW LEVEL SECURITY;

-- fed_profiles: enable RLS and drop the over-broad "Service can read all
-- profiles" USING(true) read policy. The service role bypasses RLS, so it does
-- not need this policy; removing it stops the anon/publishable key from reading
-- every confidential profile. Own-profile and open-profile reads remain.
ALTER TABLE public.fed_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service can read all profiles" ON public.fed_profiles;
