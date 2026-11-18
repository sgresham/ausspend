#!/usr/bin/env bash
#
# Read-only verification of the deployed ausspend client.
#
# Fetches the deployed index, the hashed JS asset it references, /api/v1/health,
# and representative SPA routes (/trade, /coverage-limitations). It also compares
# the deployed asset with the local client/dist build when that build exists, so
# a stale publish fails instead of silently passing.
#
# Does not restart nginx, containers, the API or the database.
#
# Usage:
#   bash deploy/verify-client.sh [--dry-run] [--insecure]
#   AUSSPEND_VERIFY_BASE_URL=https://ausspend.com.au \
#   AUSSPEND_VERIFY_RESOLVE=ausspend.com.au:443:127.0.0.1 \
#   AUSSPEND_VERIFY_INSECURE=1 bash deploy/verify-client.sh
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash deploy/verify-client.sh [options]

Options:
  --dry-run   Print the resolved URLs and planned checks. No network request.
  --insecure  Pass -k to curl (needed for the local Cloudflare Origin CA origin).
  -h, --help  Show this help.

Environment:
  AUSSPEND_VERIFY_BASE_URL  Base URL. Default: https://ausspend.com.au
  AUSSPEND_VERIFY_RESOLVE   Optional curl --resolve value, e.g. ausspend.com.au:443:127.0.0.1
  AUSSPEND_VERIFY_INSECURE  Set to 1 to pass -k to curl.
EOF
}

DRY_RUN=0
INSECURE="${AUSSPEND_VERIFY_INSECURE:-0}"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --insecure) INSECURE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "verify-client: unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

fail() {
  echo "verify-client: FAILED: $*" >&2
  exit 1
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${AUSSPEND_VERIFY_BASE_URL:-https://ausspend.com.au}"
BASE_URL="${BASE_URL%/}"
RESOLVE="${AUSSPEND_VERIFY_RESOLVE:-}"
LOCAL_INDEX="$REPO_ROOT/client/dist/index.html"

CURL=(curl -sS --max-time 20)
if [[ "$INSECURE" == "1" ]]; then
  CURL+=(-k)
fi
if [[ -n "$RESOLVE" ]]; then
  CURL+=(--resolve "$RESOLVE")
fi

echo "verify-client: base=$BASE_URL"
if [[ -n "$RESOLVE" ]]; then
  echo "verify-client: resolve=$RESOLVE"
fi
if [[ "$INSECURE" == "1" ]]; then
  echo "verify-client: TLS verification disabled (-k)"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "verify-client: --dry-run: no network requests performed"
  echo "verify-client: would check GET $BASE_URL/"
  echo "verify-client: would check the hashed /assets/*.js referenced by the index"
  echo "verify-client: would check GET $BASE_URL/api/v1/health"
  echo "verify-client: would check GET $BASE_URL/trade"
  echo "verify-client: would check GET $BASE_URL/coverage-limitations"
  if [[ -f "$LOCAL_INDEX" ]]; then
    echo "verify-client: would compare the deployed asset with $LOCAL_INDEX"
  else
    echo "verify-client: no local client/dist/index.html; stale-build comparison would be skipped"
  fi
  exit 0
fi

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v grep >/dev/null 2>&1 || fail "grep is required"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fetch() {
  local url="$1"
  local out="$2"
  "${CURL[@]}" -o "$out" -w '%{http_code}' "$url"
}

INDEX_CODE="$(fetch "$BASE_URL/" "$TMP_DIR/index.html")" ||
  fail "could not fetch $BASE_URL/"
[[ "$INDEX_CODE" == "200" ]] || fail "index returned HTTP $INDEX_CODE from $BASE_URL/"
grep -q '<div id="root">' "$TMP_DIR/index.html" ||
  fail "index does not look like the ausspend SPA (missing #root)"

DEPLOYED_ASSET="$(grep -oE '/assets/[A-Za-z0-9._-]+\.js' "$TMP_DIR/index.html" | head -n 1)"
[[ -n "$DEPLOYED_ASSET" ]] || fail "deployed index references no hashed /assets/*.js asset"

ASSET_CODE="$(fetch "$BASE_URL$DEPLOYED_ASSET" "$TMP_DIR/asset.js")" ||
  fail "could not fetch $BASE_URL$DEPLOYED_ASSET"
[[ "$ASSET_CODE" == "200" ]] || fail "asset $DEPLOYED_ASSET returned HTTP $ASSET_CODE"
[[ -s "$TMP_DIR/asset.js" ]] || fail "asset $DEPLOYED_ASSET is empty"

if [[ -f "$LOCAL_INDEX" ]]; then
  LOCAL_ASSET="$(grep -oE '/assets/[A-Za-z0-9._-]+\.js' "$LOCAL_INDEX" | head -n 1)"
  [[ -n "$LOCAL_ASSET" ]] || fail "local client/dist/index.html references no hashed JS asset"
  if [[ "$LOCAL_ASSET" != "$DEPLOYED_ASSET" ]]; then
    fail "stale deploy: live asset $DEPLOYED_ASSET, local build $LOCAL_ASSET; run npm run deploy:client"
  fi
  echo "verify-client: local build matches deployed asset $DEPLOYED_ASSET"
else
  echo "verify-client: no local client/dist/index.html; skipped stale-build comparison"
fi

HEALTH_CODE="$(fetch "$BASE_URL/api/v1/health" "$TMP_DIR/health.json")" ||
  fail "could not fetch $BASE_URL/api/v1/health"
[[ "$HEALTH_CODE" == "200" ]] || fail "health returned HTTP $HEALTH_CODE"
grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$TMP_DIR/health.json" ||
  fail "health response does not contain ok=true"

for path in /trade /coverage-limitations; do
  code="$(fetch "$BASE_URL$path" "$TMP_DIR/page.html")" ||
    fail "could not fetch $BASE_URL$path"
  [[ "$code" == "200" ]] || fail "$path returned HTTP $code"
  grep -q '<div id="root">' "$TMP_DIR/page.html" ||
    fail "$path did not return the SPA index (missing #root)"
  echo "verify-client: OK $path (200, SPA index)"
done

echo "verify-client: OK index=200 asset=$DEPLOYED_ASSET health=ok trade=200 coverage-limitations=200"
