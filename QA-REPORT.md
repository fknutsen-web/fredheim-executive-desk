# Fredheim Executive Desk — Pre-Launch QA Audit

**Date:** 2026-06-02
**Branch:** `claude/pre-launch-qa-audit-Jhlq2`
**Scope:** Recruiter, candidate, admin, matching, visibility, and payment workflows.

---

## 0. Method & important caveat

This audit was performed at the **code level**, tracing every workflow through the
actual deployed source (`api/*.js` serverless functions + `src/main.jsx`,
`src/recruiter-talent.jsx`, `src/talent-match.jsx`, `index.html`). A true live
end-to-end run was **not possible in this environment** because there are no
Supabase or Stripe credentials and no running database — so Stripe test-mode
clicks, magic-link logins, and DB-backed matching could not be exercised against
a live stack. Findings below are derived from reading the code paths that those
flows execute.

**Critical caveat — primary privacy enforcement is unverifiable from this repo.**
`api/lib/identity.js` states the *primary* PII protection lives in Postgres RLS
(`fed-phase3-secure-views.sql`, `fed-phase3-rls-lockdown.sql`). **Those files are
not in the repository** — only `fed-vertical-migration.sql` is present. The
recruiter dashboard reads candidate match data (including `candidate_email`)
**directly from the browser** (`src/main.jsx:12724`), so the entire anonymity
guarantee rests on RLS that cannot be inspected here. **This must be verified
against the live Supabase project before launch** (see CRIT-2).

A small number of clear, high-confidence, low-risk defects were **fixed** as part
of this audit (payment reliability, privacy, form integrity, raw-error leakage).
They are listed in §"Fixes Applied". Judgment-call items (scoring weights, schema)
are left as recommendations, not changed.

---

## 1. Passed tests

| Area | What was verified | Result |
|---|---|---|
| Auth model | Passwordless magic-link (`signInWithOtp`) for candidates/recruiters; admin password validated server-side with HMAC session token + IP rate-limiting (`api/admin-auth.js`). | ✅ Pass |
| Session expiry | `onAuthStateChange` nulls the user; all protected views (`myprofile`, `recruiter-dash`, `intern-myprofile`) fall back to a sign-in screen rather than breaking (`src/main.jsx:14318+`). | ✅ Pass |
| Empty states | Jobs, matches, interests, recruiter dashboard, admin tables, notifications all render clean empty-state copy (e.g. `src/main.jsx:14708`, `11347`, `12342`). | ✅ Pass |
| Back/forward nav | Hash-routed views handle `popstate`/`hashchange`; payment-return param is stripped via `replaceState` so refresh won't re-fire (`src/main.jsx:14336+`). | ✅ Pass |
| Cancelled checkout | `?checkout=cancelled` shows a clean banner; no state corruption. | ✅ Pass |
| Match state machine | `api/lib/match-states.js` defines a coherent state graph; `match-action.js` guards every transition with `canTransition` and ownership checks (`callerEmail` must equal match's recruiter/candidate). | ✅ Pass |
| Candidate approval gate | A recruiter can only pay from `awaiting_payment`, which requires the candidate to explicitly approve (`match-action.js` `candidate_approve_introduction`; `create-checkout-session.js:69`). | ✅ Pass |
| Server unlock gate | `identity.js isUnlocked()` reveals contact only on `paid_unlocked`/`introduced` or a `paid` introduction record — never on interest alone. | ✅ Pass (server logic) |
| Confidential job masking | `api/lib/confidential.js` masks employer name → descriptor and exact location → region for candidate-facing jobs. | ✅ Pass (where used server-side) |
| Recruiter-dash auth | `api/recruiter-dash.js` verifies the Bearer token's email equals the requested email before returning that recruiter's own submissions. | ✅ Pass |
| Admin endpoints auth | `admin-oversight.js` requires `isAuthorizedAdmin` (token or legacy header). | ✅ Pass |
| Re-engagement lifecycle | 45/60/85/90-day touch + archive + annual-refresh cron logic is internally consistent (`talent-candidates.js`). | ✅ Pass |
| GDPR/CCPA removal | `DELETE ?action=remove` anonymizes name/email/phone/answers (`talent-candidates.js:427`). | ✅ Pass (but incomplete — see DATA-1) |
| Build | `npm run build` succeeds after all fixes; all bundles compile. | ✅ Pass |

---

## 2. Failed tests

| ID | Test | Result |
|---|---|---|
| CRIT-1 | Recruiter pays compensation-tiered introduction → match unlocks | ❌ **FAILED** (webhook never fired the unlock) — **FIXED** |
| CRIT-2 | Candidate email NOT readable by recruiter before payment (browser inspection) | ❌ **LIKELY FAILED / unverifiable** — depends on missing RLS |
| CRIT-3 | Self-granting a paid tier via crafted URL is impossible | ❌ **FAILED** (client wrote tier from URL param) — **FIXED** |
| HIGH-1 | Failed profile/brief/posting save shows an error (not "success") | ❌ **FAILED** (silent success on DB failure) — **FIXED** |
| HIGH-2 | Candidate cannot create a match with a blocked/own employer | ❌ **FAILED** (candidate-interest path skipped the block filter) — **FIXED** |
| HIGH-3 | A paid-but-unprocessed Stripe event is never lost silently | ❌ **FAILED** (handler swallowed errors, returned 200, no alert) — **FIXED** |
| HIGH-4 | "Complimentary" (founding/early-career) introduction actually delivers contact | ❌ **FAILED** (only sets `recruiter_interested`, never unlocks) — open |
| HIGH-5 | Dashboard match counts equal the live (non-terminal) matches shown | ❌ **FAILED** (counts include declined/withdrawn/expired) — open |
| MED-1 | No raw technical errors shown to users | ❌ **FAILED** in 2 spots — **FIXED** |
| MED-2 | Duplicate Stripe webhook delivery cannot double-insert a paid intro | ❌ **FAILED** (no idempotency key) — open |

---

## 3. Critical bugs

### CRIT-1 — Compensation-tiered introductions were never unlocked after payment *(FIXED)*
**Files:** `api/create-checkout-session.js:180-201`, `api/stripe-webhook.js:205`
The primary confidential-introduction flow (`fed_matches`) builds the Stripe line
item with **inline `price_data`** (compensation-tiered: $99/$495/$995/$2,500 from
`api/lib/introduction-fees.js`). Stripe mints an **ad-hoc price ID** for
`price_data`, which never equals any configured `PRICE_INTRO_*` env var. The
webhook gated the unlock on `isIntroductionPrice(priceId)`, which therefore
returned **false**, so `handleIntroductionPaid()` **never ran**: the match stayed
`awaiting_payment`, the candidate was never unlocked, no introduction emails were
sent, and no `fed_paid_introductions` record was written — **the recruiter paid
and received nothing.** This is a catastrophic payment+workflow failure that would
hit every non-legacy paid introduction.
**Fix applied:** the webhook now treats `meta.type === 'introduction' | 'engagement'`
(our own server-set metadata) as authoritative, keeping `isIntroductionPrice()`
only as a legacy fallback.

### CRIT-2 — Candidate PII likely readable by recruiters pre-payment via the browser *(OPEN — verify RLS)*
**Files:** `src/main.jsx:12724-12730`, `api/lib/identity.js`
The recruiter dashboard runs `sb.from('fed_matches').select('*')` **client-side**
(browser, anon key + recruiter session) for all of the recruiter's jobs.
`fed_matches` rows contain the real `candidate_email` (written by both the engine
and `match-action.js`). The UI label says it "doesn't have candidate details," but
**the full row — including `candidate_email` — is in the network response and
visible via dev tools**, regardless of what the UI renders. The server-side
redaction helper (`identity.js redactCandidate`) is **not applied on this path at
all**. Whether this is an actual breach depends entirely on Postgres RLS /
column-level security on `fed_matches` — and the RLS files the code references are
**absent from the repo**. If RLS does not withhold `candidate_email` from the
recruiter role before unlock, **anonymity is completely defeated** (violates spec
#2, #5, #8). **Cannot be confirmed safe from code alone — must be verified live.**
**Recommended fix:** load recruiter matches through a server endpoint that returns
`redactCandidate(...)`-filtered rows (no `candidate_email` until `paid_unlocked`),
and lock down `fed_matches` so the recruiter/anon role cannot `select` PII columns.

### CRIT-3 — Paid tier self-grant from a crafted URL *(FIXED)*
**File:** `src/main.jsx` (payment-return handler, formerly ~14309-14348)
On returning from Stripe, the client wrote the **paid tier directly to
`fed_profiles`/`fed_intern_profiles`** keyed only off the `?upgradeSuccess=` URL
param. Anyone logged in could visit `…/?upgradeSuccess=confidential` and self-grant
a year of the paid confidential tier for free (and the same via the Back button to
the un-stripped return URL). This both bypasses payment and violates "visibility
unlocks only after confirmed payment" (#5). Whether the write actually persisted
depended on RLS (again unverifiable), but relying on RLS to stop a client that is
*trying* to escalate is fragile.
**Fix applied:** the client no longer writes any tier. The Stripe webhook is the
sole source of truth; the return handler now **polls the DB** to confirm the
webhook applied the upgrade and shows a "being activated" message if not yet
processed.

---

## 4. Privacy / security risks

| ID | Risk | Severity | File(s) |
|---|---|---|---|
| CRIT-2 | Candidate `candidate_email` shipped to recruiter browser pre-unlock (RLS-dependent, RLS absent from repo). | **Critical** | `src/main.jsx:12724` |
| SEC-1 | The security-critical RLS migrations referenced by `identity.js` (`fed-phase3-rls-lockdown.sql`, `fed-phase3-secure-views.sql`) are **missing from the repo** — the primary privacy layer is undocumented and unversioned. | **Critical** | `api/lib/identity.js:7` |
| PRIV-1 | Candidate-interest path created matches without the blocked-employer filter — a candidate could be revealed to their **own/blocked** employer via a confidential listing. | High | `api/match-action.js` *(FIXED)* |
| PRIV-2 | Block matching is bidirectional substring (`firm.includes(b) || b.includes(firm)`): a short blocked token (e.g. "trading") over-blocks many firms; legal-entity vs brand name mismatches under-block (leak). No normalization. | Medium | `api/compute-matches.js:50` |
| PRIV-3 | Block list is only evaluated at match-creation. Adding a company to the block list later does **not** hide an already-created match. | Medium | `api/compute-matches.js:123` |
| SEC-2 | Publishable Supabase key hardcoded as a fallback in source (3 files). It is a *publishable* key (not the service role), so low impact, but should be env-only. | Low | `api/recruiter-dash.js:7`, `api/match-action.js:18`, `api/compute-matches.js:53` |
| SEC-3 | Admin token signing falls back to `ADMIN_PASSWORD` as the HMAC secret if `ADMIN_TOKEN_SECRET` is unset — weaker, and rotating the password invalidates tokens. Set `ADMIN_TOKEN_SECRET` in prod. | Low | `api/admin-auth.js:47` |
| SEC-4 | `match-action.js mark_viewed` doesn't verify the caller owns `job_id` (any authed user can stamp `last_recruiter_view_at` for any job). No data leak; integrity-only. | Low | `api/match-action.js` |
| DATA-1 | GDPR removal anonymizes `talent_candidates` only — it does not scrub `fed_profiles`, related `fed_matches`/`talent_matches`, or already-sent notifications. | Medium | `api/talent-candidates.js:427` |

---

## 5. Payment risks

| ID | Risk | Severity | Status |
|---|---|---|---|
| CRIT-1 | Tiered introductions never unlocked after payment (ad-hoc price ID vs `isIntroductionPrice`). | Critical | **FIXED** |
| HIGH-3 | Webhook caught all handler errors and returned 200 with **no alert** → a customer could pay while the DB update failed, lost silently with no Stripe retry. | High | **FIXED** (admin alert added on failure) |
| MED-2 | No idempotency guard: a duplicate Stripe `checkout.session.completed` delivery would insert a **duplicate** `fed_paid_introductions` row and re-send emails/alerts. (Re-charge at *checkout creation* is blocked because `resolveIntroductionPrice` requires `awaiting_payment`.) | Medium | Open |
| HIGH-4 | "Complimentary" introductions (founding recruiter or early-career candidate) only set `recruiter_interested`/`mutual_interest` — they **never reach `paid_unlocked`/`introduced`**, so no contact is exchanged, yet the UI says "introduction confirmed." Also, the founding-complimentary branch returns before the `awaiting_payment` candidate-approval check, **bypassing the approval gate**. | High | Open |
| PAY-1 | Pricing is inconsistent across the codebase: headers/UI say "flat $249" while the live `fed_matches` path charges compensation tiers ($99–$2,500). The *charged* amount is correct (driven by `price_data`/`amount_total`), but copy and the `'$249'` fallback in `handleIntroductionPaid` are misleading. | Low | Open |
| PAY-2 | Declined cards / failed initial payment: Stripe Checkout handles declines on its hosted page (no app code path needed). Renewal failures (`invoice.payment_failed`) correctly alert the desk and downgrade. Verified by reading; **exercise in Stripe test mode before launch** (cards `4000000000000002` decline, `4000000000009995` insufficient funds). | — | Verify live |

---

## 6. Matching logic issues

| ID | Issue | Severity | File(s) |
|---|---|---|---|
| MATCH-1 | **Divergent duplicate engines.** Root `compute-matches.js` and `match-action.js` differ from the deployed `api/` copies and implement *different* scoring; the **root `compute-matches.js` has no blocked-employer filter at all.** Root files also `require('./lib/...')` which doesn't exist at root, so they're dead — but they're a deploy landmine if ever copied over `api/`. (Not deleted in this pass — flagged for owner decision, see Recommendations.) | High | `compute-matches.js`, `match-action.js` (root) |
| MATCH-2 | **Empty/under-specified profiles score high.** Null/unknown fields get partial credit (e.g. `match-action.js:342` unknown industry = +20; `compute-matches.js:212` no requirement = half credit). An essentially empty candidate/job pair can clear the `MIN_SCORE=40` floor, surfacing junk matches (violates "weak matches do not appear"). | Medium | `api/match-action.js:330-369`, `api/compute-matches.js:212` |
| MATCH-3 | **Inconsistent thresholds** across surfaces: engine floor 40; confidence buckets 40/60/80 (`main.jsx:3436`); recruiter color 60/80; talent product 70/85 (`recruiter-talent.jsx:48`); notify tiers 75/90 (`talent-notify.js:194`). "Strong match" has no single definition. | High | multiple |
| MATCH-4 | **Candidate-initiated matches bypass the `MIN_SCORE` floor.** `candidate_interest` inserts a match with no score gate, so a sub-40 "low" match can surface to a recruiter. | Medium | `api/match-action.js:162` |
| MATCH-5 | **Dashboard counts include terminal matches.** Recruiter load filters only `candidate_hidden`, so `totalMatches`, the per-job "X matches" pill, and rendered cards include `candidate_declined`/`recruiter_withdrawn`/`candidate_withdrew`/`expired`. Candidate side filters `candidate_hidden` + `expired` — so counts are asymmetric between the two dashboards. | High | `src/main.jsx:12728`, `12310`, `11231` |
| MATCH-6 | **Hard leadership-tier guard can silently drop strong matches.** `compute-matches.js:625` returns `score:0` (→ never created) when a candidate is >2 tiers below requirement, on noisy/mislabeled title data — the exact problem the platform claims to solve. | High | `api/compute-matches.js:625` |
| MATCH-7 | Comp scored twice with inconsistent parsers (`parseUSD` handles `k/m`, `parseNum` doesn't); the second block overwrites `reasons.comp_alignment`. Comp effectively over-weighted. | Low | `api/compute-matches.js:316`, `606`, `550` |
| MATCH-8 | Location matching compares `substring(0,5)` of the first comma-segment ("Washington DC" vs "Washington State" → false match; "NYC" vs "New York" → never match). | Low | `api/compute-matches.js:342`, `api/match-action.js:362` |

**Score-population:** scores are bounded 0-100 (final `Math.min(100, …)` clamp) and
no divide-by-zero/NaN leaks were found in the main scorer — `match_score` populates
correctly. The issues above are about *which* matches appear and *count accuracy*,
not corrupted score values.

---

## 7. Display / UI issues

| ID | Issue | Severity | File(s) |
|---|---|---|---|
| UI-1 | Long forms (executive profile, recruiter intake) have **no draft/autosave**; navigating away before final submit loses in-memory data. Partial *step* completion is allowed by design, but nothing persists until submit. | Medium | `src/main.jsx` ProfileForm/IntakeWorkflow |
| UI-2 | Email validation is presence + `@` only everywhere (`includes('@')`); accepts `a@`. Inputs use `type="email"` but submit handlers don't enforce native validity. | Low | `main.jsx:10470,12166`, `talent-match.jsx:364` |
| UI-3 | Expired-session fallback shows the normal sign-in with no "your session expired" wording — functional but can confuse a user mid-task. | Low | `src/main.jsx` |
| UI-4 | Responsive layout relies on `flexWrap:'wrap'` inline styles rather than `@media` rules; no fixed-width breakage spotted in JSX, but the multi-column profile/dashboard grids should get a real device check before launch. | Low | global |
| UI-5 | InternJobForm email had no format check (presence only). | Low | `main.jsx:1559` *(FIXED — added `@` check)* |

---

## 8. Recommended fixes

**Before launch (blockers):**
1. **CRIT-2 / SEC-1:** Add the missing RLS migrations to the repo and **verify on
   the live Supabase project** that the recruiter/anon role cannot `select`
   `candidate_email` (or any PII) from `fed_matches`/`fed_profiles` before
   `paid_unlocked`. Move recruiter match loading to a server endpoint that returns
   `identity.redactCandidate()`-filtered rows. *Until proven, treat anonymity as
   broken.*
2. **HIGH-4:** Make "complimentary" introductions actually transition to
   `paid_unlocked`/`introduced` (and route them through the candidate-approval
   `awaiting_payment` gate) so contact is genuinely exchanged — or stop telling
   the user the introduction is "confirmed."
3. **MATCH-1:** Delete (or regenerate from `api/`) the divergent root-level
   `*.js` duplicates so there is one canonical copy of the payment/matching logic.
   *(Left to the owner because the repo's "Add files via upload" history suggests a
   manual sync workflow — do not let the stale root copies ship.)*
4. Run the full **Stripe test-mode matrix** against the live deploy: success,
   decline (`4000…0002`), insufficient funds, 3DS, cancelled checkout, refresh on
   return, duplicate webhook delivery, and confirm the visibility unlock + emails.

**Soon after (should-fix):**
5. **MED-2:** Add webhook idempotency (unique on Stripe `event.id` or
   `stripe_session_id`) before inserting `fed_paid_introductions`.
6. **MATCH-5:** Exclude terminal states from recruiter counts/cards and align the
   candidate/recruiter hidden-state filters.
7. **MATCH-2/3/4/6:** Stop awarding half/partial credit for *missing* required
   fields; apply `MIN_SCORE` to candidate-initiated matches; soften or log the
   hard leadership-tier drop; converge on one "strong match" threshold.
8. **DATA-1:** Extend GDPR removal to `fed_profiles` and related match rows.
9. **PRIV-2/3:** Normalize block matching (token/whole-word, not loose substring)
   and re-evaluate existing matches when the block list changes.
10. **UI-1:** Add autosave/draft for the long profile and intake forms.

---

## 9. Fixes Applied in this audit

All committed on `claude/pre-launch-qa-audit-Jhlq2`; `npm run build` passes.

| File | Change |
|---|---|
| `api/stripe-webhook.js` | **CRIT-1:** unlock now keyed on server-set `meta.type` (not the ad-hoc `price_data` price ID), so compensation-tiered introductions unlock after payment. **HIGH-3:** handler failures now send an admin alert (paid-but-unprocessed events are no longer lost silently). |
| `api/match-action.js` | **PRIV-1:** `candidate_interest` now applies the blocked-employer filter (mirrors the engine) on both new and existing matches; loads `current_company`/`blocked_companies`. |
| `src/main.jsx` | **CRIT-3:** removed client-side tier self-grant; webhook is now the sole source of truth, with DB-poll confirmation on return. **HIGH-1:** profile save, recruiter brief, and intern posting now detect `{ error }` from Supabase and show a clean failure message instead of false "success". **MED-1:** intern publish no longer leaks `error.message`. **UI-5:** intern email format check. |
| `src/talent-match.jsx` | **MED-1:** questionnaire submit no longer surfaces raw network/runtime exception text to candidates. |

---

## 10. Final launch recommendation

> ### 🔴 DO NOT LAUNCH YET — conditional GO after blockers cleared

The two most dangerous defects were a **payment that delivered nothing**
(CRIT-1) and a **paid-tier self-grant** (CRIT-3); both are **fixed** in this
branch. However, launch must **not** proceed until:

1. **CRIT-2 / SEC-1 is resolved and verified live** — the candidate-anonymity
   guarantee currently depends on RLS that is not in the repo and that the
   browser-side query (`fed_matches.select('*')`) would defeat if absent. This is
   the single highest privacy risk and the platform's core promise. **Confirm it
   against the live database, with the recommended server-side redaction in
   place, before any real candidate data is loaded.**
2. **HIGH-4 (complimentary introductions) is fixed** so the unlock workflow is
   complete and honest for founding/early-career flows.
3. **MATCH-1 (divergent duplicate files) is reconciled** so the audited `api/`
   logic is the only logic that can ship.
4. **The Stripe test-mode matrix is run end-to-end on the deployed environment**
   (the one workflow this code-level audit could not exercise).

Once those four are done — and the should-fix matching/count and idempotency
items are scheduled — the platform is in good shape to launch. The payment state
machine, candidate approval gate, server unlock rule, and error/empty-state
handling are otherwise sound.
