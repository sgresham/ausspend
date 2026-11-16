#!/usr/bin/env bash
set -euo pipefail

# Install the user-level daily backup timer.
#
# The service runs a self-contained snapshot of the backup script under
# ~/.local/share/ausspend-backup (with its own mongodb/dotenv node_modules), so
# the timer does not depend on /opt/ausspend/node_modules or on the Docker stack.
# Re-run this installer after changing scripts/db-backup.mjs or
# scripts/lib/backup-format.mjs.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
runner_dir="${XDG_DATA_HOME:-$HOME/.local/share}/ausspend-backup"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install the backup runner dependencies" >&2
  exit 1
fi

mkdir -p "$runner_dir/lib" "$unit_dir"
install -m 0644 "$script_dir/db-backup.mjs" "$runner_dir/db-backup.mjs"
install -m 0644 "$script_dir/lib/backup-format.mjs" "$runner_dir/lib/backup-format.mjs"
cat > "$runner_dir/package.json" <<'JSON'
{
  "name": "ausspend-db-backup-runner",
  "private": true,
  "type": "module",
  "dependencies": {
    "dotenv": "17.4.2",
    "mongodb": "6.20.0"
  }
}
JSON

(
  cd "$runner_dir"
  npm install --omit=dev --no-audit --no-fund --loglevel=error
)

install -m 0644 "$script_dir/systemd/ausspend-db-backup.service" "$unit_dir/"
install -m 0644 "$script_dir/systemd/ausspend-db-backup.timer" "$unit_dir/"

systemctl --user daemon-reload
systemctl --user enable --now ausspend-db-backup.timer
systemctl --user list-timers ausspend-db-backup.timer --no-pager
