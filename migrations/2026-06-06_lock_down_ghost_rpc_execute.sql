-- fed_increment_recruiter_ghost is only invoked server-side (talent-billing
-- cron, service role). Revoke execute from the public client roles so an
-- anonymous caller cannot inflate recruiter ghost counters.
REVOKE EXECUTE ON FUNCTION public.fed_increment_recruiter_ghost(text) FROM PUBLIC, anon, authenticated;
