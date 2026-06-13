-- First-party pageview analytics for the admin dashboard.
--
-- Privacy-respecting and additive: no PII is stored. `visitor_id` is a random
-- token the browser generates and keeps in localStorage; it is not linked to any
-- account, email, or IP. Writes go through a SECURITY DEFINER RPC (so the table
-- is never directly writable via the publishable key); reads are aggregated
-- through a service-role summary function used by api/admin-oversight.
--
-- This complements Vercel Web Analytics — it exists so the in-app admin
-- dashboard can show a visitors/pageviews number without leaving the site.

CREATE TABLE IF NOT EXISTS public.fed_visits (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id  text NOT NULL,
  path        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fed_visits_created_at_idx ON public.fed_visits (created_at);
CREATE INDEX IF NOT EXISTS fed_visits_visitor_idx    ON public.fed_visits (visitor_id);

-- RLS on, with NO anon/authenticated policies: the table is neither directly
-- readable nor writable via the publishable key. Writes happen only through the
-- SECURITY DEFINER RPC below; reads happen only via the service role.
ALTER TABLE public.fed_visits ENABLE ROW LEVEL SECURITY;

-- Record a single pageview. Validates input defensively and caps lengths so the
-- anon-callable surface can't be abused to store large blobs.
CREATE OR REPLACE FUNCTION public.fed_record_visit(p_visitor_id text, p_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_visitor_id IS NULL OR length(p_visitor_id) = 0 OR length(p_visitor_id) > 64 THEN
    RETURN;
  END IF;
  INSERT INTO public.fed_visits (visitor_id, path)
  VALUES (left(p_visitor_id, 64), left(COALESCE(p_path, ''), 256));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fed_record_visit(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fed_record_visit(text, text) TO anon, authenticated;

-- Aggregated traffic summary for the admin dashboard. Service-role only; the
-- heavy count(DISTINCT ...) runs in the database rather than pulling rows out.
CREATE OR REPLACE FUNCTION public.fed_traffic_summary()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pageviews_today', (SELECT count(*)                  FROM fed_visits WHERE created_at >= date_trunc('day', now())),
    'visitors_today',  (SELECT count(DISTINCT visitor_id) FROM fed_visits WHERE created_at >= date_trunc('day', now())),
    'pageviews_7d',    (SELECT count(*)                  FROM fed_visits WHERE created_at >= now() - interval '7 days'),
    'visitors_7d',     (SELECT count(DISTINCT visitor_id) FROM fed_visits WHERE created_at >= now() - interval '7 days'),
    'pageviews_30d',   (SELECT count(*)                  FROM fed_visits WHERE created_at >= now() - interval '30 days'),
    'visitors_30d',    (SELECT count(DISTINCT visitor_id) FROM fed_visits WHERE created_at >= now() - interval '30 days'),
    'pageviews_total', (SELECT count(*)                  FROM fed_visits),
    'visitors_total',  (SELECT count(DISTINCT visitor_id) FROM fed_visits)
  );
$$;
-- Supabase grants default EXECUTE to anon/authenticated on public functions, so
-- revoking from PUBLIC is not enough — revoke the role grants explicitly too.
REVOKE EXECUTE ON FUNCTION public.fed_traffic_summary() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fed_traffic_summary() TO service_role;
