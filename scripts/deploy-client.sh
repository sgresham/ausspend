#!/usr/bin/env bash
#
# Reproducible production client publish for ausspend.
#
# Builds shared+client, validates the built index and every hashed asset it
# references, then publishes client/dist/ to AUSSPEND_DEPLOY_ROOT. The default
# root is /srv/ausspend/client (the nginx static root). No sudo, secrets or
# container restarts are required when the deploy user owns the root.
#
# Usage:
#   bash scripts/deploy-client.sh [--dry-run] [--skip-build]
#   AUSSPEND_DEPLOY_ROOT=/srv/ausspend/client bash scripts/deploy-client.sh
#
# Exit codes: 0 success, 1 build/copy/validation failure, 2 usage error.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-client.sh [options]

Options:
  --dry-run     Print the resolved build/deploy paths and planned commands. No build, copy or write.
  --skip-build  Publish an existing client/dist build instead of running npm builds.
  -h, --help    Show this help.

Environment:
  AUSSPEND_DEPLOY_ROOT  Client static root. Default: /srv/ausspend/client
EOF
}

DRY_RUN=0
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "deploy-client: unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

fail() {
  echo "deploy-client: FAILED: $*" >&2
  exit 1
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$REPO_ROOT/client/dist"
INDEX="$BUILD_DIR/index.html"
DEPLOY_ROOT="${AUSSPEND_DEPLOY_ROOT:-/srv/ausspend/client}"
if [[ "$DEPLOY_ROOT" == "/" ]]; then
  fail "refusing to publish over /"
fi
if [[ -z "$DEPLOY_ROOT" || "$DEPLOY_ROOT" != /* ]]; then
  fail "AUSSPEND_DEPLOY_ROOT must be an absolute path, got '${DEPLOY_ROOT:-<empty>}'"
fi
DEPLOY_ROOT="${DEPLOY_ROOT%/}"
case "$DEPLOY_ROOT" in
  "$REPO_ROOT"|"$REPO_ROOT"/*)
    fail "refusing to publish inside the repository ($DEPLOY_ROOT)"
    ;;
esac

echo "deploy-client: repo=$REPO_ROOT"
echo "deploy-client: build=$BUILD_DIR"
echo "deploy-client: root=$DEPLOY_ROOT"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "deploy-client: --dry-run: no build, copy or write performed"
  if [[ "$SKIP_BUILD" -eq 1 ]]; then
    echo "deploy-client: would require an existing $INDEX"
  else
    echo "deploy-client: would run: npm run build -w shared && npm run build -w client"
  fi
  echo "deploy-client: would run: rsync -a --delete '$BUILD_DIR/' '$DEPLOY_ROOT/'"
  exit 0
fi

command -v npm >/dev/null 2>&1 || fail "npm is required"
command -v rsync >/dev/null 2>&1 || fail "rsync is required"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "deploy-client: building shared and client"
  (cd "$REPO_ROOT" && npm run build -w shared && npm run build -w client)
fi

[[ -f "$INDEX" ]] || fail "built index is missing: $INDEX"
if ! grep -qE '/assets/[A-Za-z0-9._-]+\.js' "$INDEX"; then
  fail "built index does not reference a hashed /assets/*.js file"
fi

mapfile -t ASSET_PATHS < <(grep -oE '/assets/[A-Za-z0-9._-]+' "$INDEX" | sort -u)
[[ "${#ASSET_PATHS[@]}" -gt 0 ]] || fail "built index references no assets"
for asset in "${ASSET_PATHS[@]}"; do
  [[ -f "$BUILD_DIR$asset" ]] || fail "built index references missing asset: $asset"
done

if [[ ! -d "$DEPLOY_ROOT" ]]; then
  mkdir -p "$DEPLOY_ROOT" 2>/dev/null ||
    fail "cannot create $DEPLOY_ROOT; owner-only fallback: sudo install -d -m 755 '$DEPLOY_ROOT'"
fi
if [[ ! -w "$DEPLOY_ROOT" ]]; then
  fail "deploy root is not writable by $(id -un): $DEPLOY_ROOT; owner-only fallback: sudo rsync -a --delete '$BUILD_DIR/' '$DEPLOY_ROOT/'"
fi

echo "deploy-client: publishing ${#ASSET_PATHS[@]} referenced asset(s)"
rsync -a --delete "$BUILD_DIR/" "$DEPLOY_ROOT/"

cmp -s "$INDEX" "$DEPLOY_ROOT/index.html" ||
  fail "published index differs from the built index"
for asset in "${ASSET_PATHS[@]}"; do
  [[ -f "$DEPLOY_ROOT$asset" ]] || fail "published asset is missing: $asset"
  cmp -s "$BUILD_DIR$asset" "$DEPLOY_ROOT$asset" ||
    fail "published asset differs from the built asset: $asset"
done

DEPLOYED_ASSET="$(grep -oE '/assets/[A-Za-z0-9._-]+\.js' "$DEPLOY_ROOT/index.html" | head -n 1)"
echo "deploy-client: OK root=$DEPLOY_ROOT"
echo "deploy-client: index=$DEPLOY_ROOT/index.html asset=$DEPLOYED_ASSET"
echo "deploy-client: next: npm run deploy:verify"
