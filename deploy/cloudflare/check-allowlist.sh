#!/bin/sh
# Verify the Cloudflare origin allowlist is installed, current and effective.
#
# Usage: sudo [ORIGIN_IP=<public-origin-ip>] /usr/local/sbin/check-cloudflare-allowlist
# The direct-origin check is skipped when ORIGIN_IP is unset (this keeps the
# public IP out of the repository and out of shell history by default).
set -eu

SNIPPET=/etc/nginx/snippets/cloudflare-allow.conf
LIVE=/etc/nginx/sites-enabled/ausspend.conf
SITE=https://ausspend.com.au/
API=https://api.cloudflare.com/client/v4/ips
ORIGIN_IP=${ORIGIN_IP:-}

fail=0
nginx -t || fail=1

[ -f "$SNIPPET" ] || { echo "FAIL: $SNIPPET is missing"; exit 1; }
grep -q '^deny all;$' "$SNIPPET" || { echo "FAIL: snippet has no final deny"; fail=1; }
grep -q 'include /etc/nginx/snippets/cloudflare-allow.conf;' "$LIVE" ||
  { echo "FAIL: include missing from $LIVE"; fail=1; }

tmp=$(mktemp)
tmp_live=$(mktemp)
trap 'rm -f "$tmp" "$tmp_live"' EXIT

curl -fsS --max-time 20 "$API" |
  jq -r '.result.ipv4_cidrs[], .result.ipv6_cidrs[]' |
  sed 's/^/allow /; s/$/;/' >"$tmp"
grep '^allow ' "$SNIPPET" |
  grep -vE 'allow (127\.0\.0\.1|::1);$' >"$tmp_live" || true

if ! diff -u "$tmp" "$tmp_live" >/dev/null; then
  echo "FAIL: snippet is stale vs the Cloudflare API"
  diff -u "$tmp" "$tmp_live" | head -20
  fail=1
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE" || true)
[ "$code" = 200 ] || { echo "FAIL: public site returned $code"; fail=1; }

if [ -n "$ORIGIN_IP" ]; then
  code=$(curl -k -s -o /dev/null -w '%{http_code}' --max-time 10 \
    --resolve "ausspend.com.au:443:$ORIGIN_IP" https://ausspend.com.au/ || true)
  case "$code" in
    403 | 000) : ;;
    *) echo "FAIL: direct origin returned $code; allowlist is not effective"; fail=1 ;;
  esac
fi

[ "$fail" -eq 0 ] && echo "PASS: allowlist present, current, and origin is Cloudflare-only"
exit "$fail"
