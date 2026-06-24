#!/usr/bin/env bash
#
# Confirm the Stripe billing env vars (STRIPE_SECRET_KEY + PRICE_*) resolve in
# the DEPLOYED runtime by calling the admin-gated /api/env-check endpoint.
#
# Unlike stripe-verification.sh (which checks a Stripe account from wherever you
# run it), this proves the vars Vercel injected into the live function are
# present AND — with live validation — that they authenticate and match the
# published prices. Safe to run against production: read-only, no writes.
#
# Usage:
#   BASE_URL=https://trovanttalent.com ADMIN_PASSWORD=… ./scripts/prod-env-check.sh
#
# Or, if you already minted an admin Bearer token (POST /api/admin-auth):
#   BASE_URL=https://trovanttalent.com ADMIN_TOKEN=… ./scripts/prod-env-check.sh
#
# Env:
#   BASE_URL         deployment origin (default https://trovanttalent.com)
#   ADMIN_PASSWORD   admin password — exchanged for a short-lived token
#   ADMIN_TOKEN      pre-minted Bearer token (skips the password exchange)
#   LIVE             1 (default) runs live Stripe validation; 0 = presence only
#
# Exit code is non-zero if any required var is missing / any price mismatches,
# so this can gate a CI step.
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need curl
need jq

BASE_URL="${BASE_URL:-https://trovanttalent.com}"
LIVE="${LIVE:-1}"

token="${ADMIN_TOKEN:-}"
if [[ -z "$token" ]]; then
  [[ -n "${ADMIN_PASSWORD:-}" ]] || { echo "Set ADMIN_PASSWORD or ADMIN_TOKEN" >&2; exit 1; }
  token="$(curl -fsS -X POST "$BASE_URL/api/admin-auth" \
            -H 'Content-Type: application/json' \
            -d "{\"password\":\"$ADMIN_PASSWORD\"}" | jq -r '.token // empty')"
  [[ -n "$token" ]] || { echo "Failed to obtain admin token from $BASE_URL/api/admin-auth" >&2; exit 1; }
fi

url="$BASE_URL/api/env-check"
[[ "$LIVE" == "1" ]] && url="$url?live=1"

# Capture body + HTTP status; the endpoint returns 500 on any failure.
resp="$(curl -sS -w $'\n%{http_code}' "$url" -H "Authorization: Bearer $token")"
code="${resp##*$'\n'}"
body="${resp%$'\n'*}"

echo "$body" | jq .
echo "HTTP $code"
[[ "$code" == "200" ]] || { echo "env-check FAILED (see ok:false above)" >&2; exit 1; }
echo "env-check OK — all required vars resolve in $BASE_URL"
