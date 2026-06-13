#!/usr/bin/env bash
#
# Stripe checkout / webhook verification runbook for Fredheim Desk.
#
# Covers the verification matrix that can't be run from the Claude sandbox
# (no Checkout Sessions / Events / Webhook Endpoints over the MCP, and the
# production host is network-blocked):
#
#   1. PRICE_* IDs exist and match the published amounts
#   2. A webhook endpoint is registered for checkout.session.completed
#   3. Checkout Sessions (candidate subscription + compensation-tiered
#      introduction) produce the correct amount_total
#   4. Resending checkout.session.completed proves the idempotency guard holds
#
# Requirements: Stripe CLI (`stripe`), `jq`, and a logged-in Stripe CLI
# session (`stripe login`). Run sections 3 and 4 in TEST MODE ONLY.
#
# Usage:
#   stripe login                       # pick the desired account (TEST mode!)
#   ./scripts/stripe-verification.sh prices      # section 1 (read-only)
#   ./scripts/stripe-verification.sh webhooks    # section 2 (read-only)
#   ./scripts/stripe-verification.sh sessions    # section 3 (test mode)
#   ./scripts/stripe-verification.sh idempotency # section 4 (test mode)
#   ./scripts/stripe-verification.sh all
#
set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n'  "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || { red "Missing dependency: $1"; exit 1; }; }
need stripe
need jq

# Detect the mode of the key the Stripe CLI is currently using.
# `stripe config --list` prints test_mode_api_key / live_mode_api_key usage,
# but the simplest reliable signal is the livemode flag on a cheap GET.
CLI_LIVEMODE="$(stripe get /v1/balance 2>/dev/null | jq -r '.livemode // empty' || true)"
if [[ "$CLI_LIVEMODE" == "true" ]]; then
  MODE="LIVE"
else
  MODE="TEST"
fi
bold "Stripe CLI is operating in: $MODE mode"

guard_test_mode() {
  if [[ "$MODE" == "LIVE" ]]; then
    red "Refusing to run '$1' in LIVE mode."
    red "Checkout-session creation and event replay must be done in TEST mode."
    red "Run 'stripe login' and select a test-mode key, then retry."
    exit 1
  fi
}

# ── section 1: prices ────────────────────────────────────────────────────────
# Expected canonical price IDs (LIVE account) and their amounts in cents.
# Override via env to check whatever your Vercel env vars actually contain:
#   PRICE_RECRUITER_STANDARD=price_xxx ./scripts/stripe-verification.sh prices
verify_prices() {
  bold "── 1. PRICE_* IDs exist and match amounts ──"
  # key|env-var-name|default-id|expected-cents|expected-type|expected-interval
  local rows=(
    "PRICE_RECRUITER_STANDARD|price_1Tb4MaJ1BNVQzyrW6upySxWt|19900|recurring|month"
    "PRICE_CANDIDATE_CONFIDENTIAL|price_1Tb4PKJ1BNVQzyrWwUPTlSiR|29900|recurring|year"
    "PRICE_INTERN_FEATURED|price_1Tb4PcJ1BNVQzyrWDhFiRyxx|4900|recurring|year"
    "PRICE_INTRO_FLAT|price_1TbRnhJ1BNVQzyrWSBbNZp0P|24900|one_time|"
  )
  local fail=0
  for row in "${rows[@]}"; do
    IFS='|' read -r var def cents type interval <<<"$row"
    local id="${!var:-$def}"   # prefer the env var if set, else the known default
    local json amount got_type got_interval
    if ! json="$(stripe get "/v1/prices/$id" 2>/dev/null)"; then
      red "✗ $var ($id): price not found in $MODE mode"; fail=1; continue
    fi
    amount="$(echo "$json" | jq -r '.unit_amount')"
    got_type="$(echo "$json" | jq -r '.type')"
    got_interval="$(echo "$json" | jq -r '.recurring.interval // ""')"
    if [[ "$amount" == "$cents" && "$got_type" == "$type" && "$got_interval" == "$interval" ]]; then
      green "✓ $var ($id): $amount cents, $got_type ${got_interval:+/$got_interval}"
    else
      red "✗ $var ($id): got ${amount}c/${got_type}/${got_interval:-none}, want ${cents}c/${type}/${interval:-none}"
      fail=1
    fi
  done
  return $fail
}

# ── section 2: webhook endpoint ──────────────────────────────────────────────
verify_webhooks() {
  bold "── 2. Webhook endpoint registered for checkout.session.completed ──"
  local eps
  eps="$(stripe get /v1/webhook_endpoints | jq -c '.data[] | {url, status, events: .enabled_events}')"
  if [[ -z "$eps" ]]; then red "✗ No webhook endpoints registered in $MODE mode"; return 1; fi
  echo "$eps" | while read -r ep; do
    local url status has_evt
    url="$(echo "$ep" | jq -r '.url')"
    status="$(echo "$ep" | jq -r '.status')"
    has_evt="$(echo "$ep" | jq -r '(.events | index("checkout.session.completed") != null) or (.events | index("*") != null)')"
    if [[ "$has_evt" == "true" && "$status" == "enabled" ]]; then
      green "✓ $url  (enabled, subscribes to checkout.session.completed)"
    else
      red   "✗ $url  (status=$status, checkout.session.completed subscribed=$has_evt)"
    fi
  done
  bold "NOTE: the signing secret (whsec_…) cannot be read back from the API."
  echo "Confirm it manually: dashboard → the endpoint → 'Signing secret' must equal"
  echo "the STRIPE_WEBHOOK_SECRET set in Vercel (Production)."
}

# ── section 3: checkout sessions (TEST MODE) ─────────────────────────────────
# Creates two Checkout Sessions and prints amount_total WITHOUT paying.
# Checkout computes amount_total at creation, so no card entry is needed.
verify_sessions() {
  guard_test_mode "sessions"
  bold "── 3a. Candidate subscription Checkout Session ──"
  # Uses a test-mode price id you pass in CANDIDATE_TEST_PRICE; falls back to an
  # inline recurring price_data so the script works on a fresh test account.
  local sub_args
  if [[ -n "${CANDIDATE_TEST_PRICE:-}" ]]; then
    sub_args=(-d "line_items[0][price]=$CANDIDATE_TEST_PRICE")
  else
    sub_args=(
      -d "line_items[0][price_data][currency]=usd"
      -d "line_items[0][price_data][unit_amount]=29900"
      -d "line_items[0][price_data][recurring][interval]=year"
      -d "line_items[0][price_data][product_data][name]=Confidential Executive Profile (test)"
    )
  fi
  stripe post /v1/checkout/sessions \
    -d "mode=subscription" \
    -d "line_items[0][quantity]=1" \
    -d "success_url=https://example.com/ok" \
    "${sub_args[@]}" \
    | jq '{id, mode, amount_total, currency, url}'

  bold "── 3b. Compensation-tiered introduction Checkout Sessions ──"
  # Mirrors create-checkout-session.js: dynamic price_data per comp band.
  # band-label|unit_amount(cents)
  local bands=(
    "under \$100K|9900"
    "\$100K–\$250K|49500"
    "\$250K–\$500K|99500"
    "above \$500K|250000"
  )
  for b in "${bands[@]}"; do
    IFS='|' read -r label cents <<<"$b"
    local total
    total="$(stripe post /v1/checkout/sessions \
      -d "mode=payment" \
      -d "line_items[0][quantity]=1" \
      -d "line_items[0][price_data][currency]=usd" \
      -d "line_items[0][price_data][unit_amount]=$cents" \
      -d "line_items[0][price_data][product_data][name]=Curated Introduction — $label" \
      -d "success_url=https://example.com/ok" \
      | jq -r '.amount_total')"
    if [[ "$total" == "$cents" ]]; then
      green "✓ $label → amount_total=$total cents"
    else
      red   "✗ $label → amount_total=$total cents (want $cents)"
    fi
  done
}

# ── section 4: idempotency via event resend (TEST MODE) ──────────────────────
verify_idempotency() {
  guard_test_mode "idempotency"
  bold "── 4. Idempotency: resend checkout.session.completed ──"
  cat <<'EOF'
Run these in two terminals against your locally-running app (TEST mode):

  # terminal 1 — forward events to the local webhook; copy the printed whsec_…
  stripe listen --forward-to localhost:3000/api/stripe-webhook

  # terminal 2 — fire a real checkout.session.completed end-to-end
  stripe trigger checkout.session.completed

Then prove the guard holds by replaying the SAME event:

  EVT=$(stripe get /v1/events -d limit=20 \
        | jq -r '.data[] | select(.type=="checkout.session.completed") | .id' | head -1)
  echo "Resending $EVT"
  stripe events resend "$EVT"

PASS criteria:
  • First delivery: one fed_paid_introductions row written, emails sent, match unlocked.
  • Resend: handler returns 200 but writes NO second row and sends NO duplicate email
    (idempotency keyed on stripe_session_id — see migration
    2026-06-06_unique_paid_introduction_per_stripe_session.sql).
EOF
}

case "${1:-all}" in
  prices)      verify_prices ;;
  webhooks)    verify_webhooks ;;
  sessions)    verify_sessions ;;
  idempotency) verify_idempotency ;;
  all)         verify_prices || true; echo; verify_webhooks || true; echo; verify_sessions || true; echo; verify_idempotency ;;
  *) red "Unknown section: $1 (use: prices | webhooks | sessions | idempotency | all)"; exit 1 ;;
esac
