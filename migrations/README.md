# Database migrations

These SQL files record schema/security changes applied to the Supabase project
`fredheim` (`bizbneqlzacvhekrbrgd`) to bring the database into alignment with the
application code. They are listed in apply order. Each was applied via the
Supabase migration system (`apply_migration`) and is reproducible from here.

| Order | File | Purpose |
|---|---|---|
| 1 | `2026-06-06_add_missing_billing_leaderboard_objects.sql` | Create tables/RPC the code referenced but that were missing: `fed_recruiter_billing`, `fed_recruiter_profiles`, `fed_leaderboard_overrides`, `fed_leaderboard_snapshots`, `fed_increment_recruiter_ghost()`. |
| 2 | `2026-06-06_policies_for_new_admin_tables.sql` | Permissive RLS policies for the admin-managed `fed_recruiter_billing` / `fed_leaderboard_overrides` (read/written by the admin console client-side). |
| 3 | `2026-06-06_align_placements_and_industry_verticals.sql` | Add `fed_placements.placement_status` (read by `leaderboard.js`); run the six-vertical industry normalisation across all industry columns. |
| 4 | `2026-06-06_enable_rls_on_pii_tables.sql` | Enable RLS on `fed_profiles` and `fed_matches` and drop the over-broad public read on `fed_profiles`, so the shipped publishable key can no longer read confidential candidate data. |
| 5 | `2026-06-06_lock_down_ghost_rpc_execute.sql` | Revoke client `EXECUTE` on the ghost-increment RPC (server/cron only). |
| 6 | `2026-06-06_lock_down_admin_managed_billing_tables.sql` | Add `fed_recruiter_billing.admin_reviewed_at`; drop the permissive policies from migration 2 now that admin billing/override reads & writes go through service-role endpoints. Supersedes migration 2. |
| 7 | `2026-06-06_unique_paid_introduction_per_stripe_session.sql` | Unique index on `fed_paid_introductions.stripe_session_id` — DB backstop for the webhook idempotency guard (MED-2). |

`fed-vertical-migration.sql` in the repo root is the original (pre-existing)
vertical migration; migration 3 supersedes/repeats it in an idempotent,
self-contained form that also covers `fed_recruiter_profiles`.
