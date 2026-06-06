-- ============================================================================
-- Create objects the application code references but that were missing from the
-- database: recruiter billing, recruiter profiles, leaderboard overrides &
-- snapshots, and the recruiter-ghost increment RPC.
-- ============================================================================

-- 1. Recruiter billing -------------------------------------------------------
-- Read/written server-side (recruiter-billing.js, leaderboard.js) via service
-- role, and read/updated by the admin console client-side (src/main.jsx).
CREATE TABLE IF NOT EXISTS public.fed_recruiter_billing (
  recruiter_email          text PRIMARY KEY,
  billing_status           text NOT NULL DEFAULT 'no_billing_setup',
  founding_granted_at      timestamptz,
  founding_expires_at      timestamptz,
  invoice_company_name     text,
  invoice_company_address  text,
  invoice_contact_name     text,
  invoice_contact_email    text,
  invoice_po_required      boolean DEFAULT false,
  invoice_billing_notes    text,
  admin_review_status      text,
  suspended_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- 2. Recruiter profiles ------------------------------------------------------
-- Read server-side by leaderboard.js for display; industry_focus is treated as
-- a scalar vertical label (matches normalizeVertical / the vertical migration).
CREATE TABLE IF NOT EXISTS public.fed_recruiter_profiles (
  recruiter_email   text PRIMARY KEY,
  firm_name         text,
  industry_focus    text,
  company_verified  boolean DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 3. Leaderboard overrides ---------------------------------------------------
-- Upserted server-side (POST /api/leaderboard, service role) and read by the
-- admin console client-side.
CREATE TABLE IF NOT EXISTS public.fed_leaderboard_overrides (
  recruiter_email       text PRIMARY KEY,
  approved              boolean DEFAULT false,
  suppressed            boolean DEFAULT false,
  suppression_reason    text,
  ineligible            boolean DEFAULT false,
  ineligibility_reason  text,
  admin_notes           text,
  updated_by            text,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 4. Leaderboard snapshots ---------------------------------------------------
-- Inserted server-side only (snapshot action).
CREATE TABLE IF NOT EXISTS public.fed_leaderboard_snapshots (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  period                 text,
  recruiter_email        text,
  rank                   integer,
  placement_count        integer,
  placement_record_ids   uuid[],
  eligibility_status     text,
  admin_override_status  text
);

-- 5. Recruiter-ghost increment RPC ------------------------------------------
-- Called fire-and-forget from talent-billing.js when a confirmed introduction
-- is auto-archived for inactivity. Increments the recruiter's ghost counter.
CREATE OR REPLACE FUNCTION public.fed_increment_recruiter_ghost(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.fed_recruiter_quality_signals
     SET ghost_count  = COALESCE(ghost_count, 0) + 1,
         last_updated = now()
   WHERE lower(recruiter_email) = lower(p_email);
  IF NOT FOUND THEN
    INSERT INTO public.fed_recruiter_quality_signals (recruiter_email, ghost_count, last_updated)
    VALUES (p_email, 1, now());
  END IF;
END;
$$;
