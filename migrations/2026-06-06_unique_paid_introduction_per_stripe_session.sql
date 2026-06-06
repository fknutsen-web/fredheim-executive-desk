-- MED-2 backstop: prevent a duplicate Stripe checkout.session.completed delivery
-- from inserting two paid-introduction rows for the same session. Partial index
-- so the $0 complimentary unlocks (null stripe_session_id) are unaffected.
-- The primary guard is in api/stripe-webhook.js (handleIntroductionPaid checks
-- for an existing row by stripe_session_id before processing).
CREATE UNIQUE INDEX IF NOT EXISTS fed_paid_introductions_stripe_session_uniq
  ON public.fed_paid_introductions (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
