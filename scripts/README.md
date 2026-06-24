# scripts

## `prod-env-check.sh` + `/api/env-check`

Confirms the Stripe billing env vars (`STRIPE_SECRET_KEY` + `PRICE_*`) actually
**resolve in the deployed runtime** — the gap `stripe-verification.sh` can't
close (that script checks a Stripe account from wherever you run it; this checks
the vars Vercel injected into the live serverless function).

`api/env-check.js` is an **admin-gated, read-only** endpoint — the server-side
equivalent of `stripe-verification.sh prices`:

| Query | What it checks |
|---|---|
| `GET /api/env-check` | Presence: each `REQUIRED_CHECKOUT_ENV` var is set and non-empty. |
| `GET /api/env-check?live=1` | Also authenticates `STRIPE_SECRET_KEY` (balance read → real `livemode`) and confirms each known `PRICE_*` resolves in Stripe and matches its published amount/type/interval ($199/mo, $299/yr, $49/yr, $249 one-time). |

Returns `200` when everything resolves, `500` (with `ok:false`) otherwise — so a
CI step can gate on it.

**Safety:** requires admin auth (same Bearer-token / `X-Admin-Secret` as every
other admin endpoint), so the env inventory is never publicly enumerable. It
**never returns a secret value** — `STRIPE_SECRET_KEY` is reported only as
`{ present, keyMode }` (mode parsed from the non-secret `sk_live`/`sk_test`
prefix). Price IDs are not secret (they're already sent to the browser at
checkout), so they're returned. GET only; no writes.

Run it from the Vercel dashboard URL or a CI step via the wrapper:

```bash
BASE_URL=https://trovanttalent.com ADMIN_PASSWORD=… ./scripts/prod-env-check.sh
# or with a pre-minted token:
BASE_URL=https://trovanttalent.com ADMIN_TOKEN=… LIVE=1 ./scripts/prod-env-check.sh
```

The wrapper exchanges `ADMIN_PASSWORD` for a short-lived token (or uses
`ADMIN_TOKEN`), calls the endpoint, pretty-prints the JSON, and exits non-zero
on failure.

## `stripe-verification.sh`

Verifies the Stripe checkout / webhook wiring against a real Stripe account.
Use it to confirm pricing stays aligned with the published website model
(see `migrations/2026-06-07_align_introduction_fees_to_compensation_bands.sql`
and `api/lib/introduction-fees.js`).

### Requirements
- Stripe CLI (`stripe`), logged in via `stripe login`
- `jq`

### Sections
| Command | Mode | What it checks |
|---|---|---|
| `./scripts/stripe-verification.sh prices` | any (read-only) | Each `PRICE_*` ID exists and matches amount + type + interval ($199/mo, $299/yr, $49/yr, $249 one-time). Reads `PRICE_*` env vars if set, else the known live IDs. |
| `./scripts/stripe-verification.sh webhooks` | any (read-only) | A webhook endpoint is `enabled` and subscribes to `checkout.session.completed`. Prints the manual step for the `STRIPE_WEBHOOK_SECRET` comparison (the signing secret can't be read back from the API). |
| `./scripts/stripe-verification.sh sessions` | **test only** | Creates the candidate subscription session + the four compensation-tiered introduction sessions and asserts `amount_total` = 9900 / 49500 / 99500 / 250000 cents. No card entry required. |
| `./scripts/stripe-verification.sh idempotency` | **test only** | `stripe listen` / `trigger` / `events resend` flow to prove a replayed `checkout.session.completed` does not double-write `fed_paid_introductions`. |
| `./scripts/stripe-verification.sh all` | mixed | Runs all of the above. |

### Safety
The script detects the key's mode (`livemode`) and **refuses to run `sessions`
and `idempotency` against a live key** — checkout-session creation and event
replay must be done in test mode, since a replayed live event would hit the
production webhook and mutate production data.

### Notes
- The four introduction tiers are charged via dynamic `price_data` (computed
  from compensation in `api/lib/introduction-fees.js`), so they intentionally
  do **not** exist as Products/Prices in the Stripe catalog.
- The verification cannot be run from the Claude Code sandbox: the Stripe MCP
  does not expose Checkout Sessions / Events / Webhook Endpoints, and the
  production host is network-blocked. Run this script locally instead.
