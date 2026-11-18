#!/usr/bin/env bash
# Render deploy/nginx/ausspend.conf.template with the deployment paths.
# Only the two AUSSPEND_* placeholders are substituted; nginx $variables are
# left untouched for nginx itself.
set -euo pipefail

: "${AUSSPEND_DEPLOY_ROOT:?set AUSSPEND_DEPLOY_ROOT (e.g. $HOME/ausspend)}"
: "${AUSSPEND_TLS_DIR:?set AUSSPEND_TLS_DIR (e.g. $HOME/.config/ausspend/tls)}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec envsubst '${AUSSPEND_DEPLOY_ROOT} ${AUSSPEND_TLS_DIR}' < "$script_dir/nginx/ausspend.conf.template"
