#!/bin/sh
# Regenerate the Cloudflare origin allowlist snippet and reload nginx if changed.
#
# Install as /usr/local/sbin/update-cloudflare-allowlist and run as root
# (systemd unit cloudflare-allowlist.service). Never edits the range list by
# hand: the source is Cloudflare's published origin IP API.
set -eu

SNIPPET=/etc/nginx/snippets/cloudflare-allow.conf
BACKUP="${SNIPPET}.bak"
API=https://api.cloudflare.com/client/v4/ips

[ "$(id -u)" -eq 0 ] || { echo "must run as root" >&2; exit 1; }

tmpjson=$(mktemp)
tmpconf=$(mktemp)
tmpold=$(mktemp)
tmpnew=$(mktemp)
trap 'rm -f "$tmpjson" "$tmpconf" "$tmpold" "$tmpnew"' EXIT

curl -fsS --max-time 20 "$API" -o "$tmpjson"

# Refuse to install a truncated/empty list. Current counts are ~15 IPv4 and
# ~7 IPv6; the lower bounds leave room for Cloudflare to consolidate ranges.
jq -e '(.result.ipv4_cidrs | type == "array" and length >= 10) and
       (.result.ipv6_cidrs | type == "array" and length >= 3)' "$tmpjson" >/dev/null

{
  echo "# Cloudflare edge ranges — generated $(date -u +%FT%TZ)"
  echo "# source: $API"
  jq -r '.result.ipv4_cidrs[], .result.ipv6_cidrs[]' "$tmpjson" |
    sed 's/^/allow /; s/$/;/'
  echo "allow 127.0.0.1;"
  echo "allow ::1;"
  echo "deny all;"
} >"$tmpconf"

# Compare the rules only, not the generated timestamp, so an unchanged list
# does not reload nginx every day.
grep -E '^(allow|deny) ' "$tmpconf" >"$tmpnew" || true
if [ -f "$SNIPPET" ]; then
  grep -E '^(allow|deny) ' "$SNIPPET" >"$tmpold" || true
  if cmp -s "$tmpold" "$tmpnew"; then
    exit 0
  fi
fi

[ -f "$SNIPPET" ] && cp -p "$SNIPPET" "$BACKUP"
install -m 0644 "$tmpconf" "$SNIPPET"

if ! nginx -t; then
  echo "nginx -t failed; restoring the previous allowlist" >&2
  [ -f "$BACKUP" ] && cp -p "$BACKUP" "$SNIPPET"
  nginx -t || true
  exit 1
fi

if ! systemctl reload nginx; then
  echo "nginx reload failed; restoring the previous allowlist" >&2
  [ -f "$BACKUP" ] && cp -p "$BACKUP" "$SNIPPET"
  nginx -t && systemctl reload nginx || true
  exit 1
fi

echo "updated $SNIPPET ($(grep -c '^allow ' "$SNIPPET") allow entries)"
