#!/usr/bin/env bash
set -euo pipefail

# Install the user-level daily backup timer.
#
# The service runs a self-contained snapshot of the backup script under
# ~/.local/share/ausspend-backup (with its own mongodb/dotenv node_modules), so
# the timer does not depend on ${AUSSPEND_DEPLOY_ROOT}/node_modules or on the Docker stack.
# Re-run this installer after changing scripts/db-backup.mjs or
# scripts/lib/backup-format.mjs.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
runner_dir="${XDG_DATA_HOME:-$HOME/.local/share}/ausspend-backup"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install the backup runner dependencies" >&2
  exit 1
fi

mkdir -p "$runner_dir/lib" "$unit_dir" "$HOME/.config/ausspend"
install -m 0644 "$script_dir/db-backup.mjs" "$runner_dir/db-backup.mjs"
install -m 0644 "$script_dir/lib/backup-format.mjs" "$runner_dir/lib/backup-format.mjs"
install -m 0644 "$script_dir/lib/env.mjs" "$runner_dir/lib/env.mjs"

# The unit runs this generated wrapper so the user's node path is resolved at
# install time, not hard-coded in the repository or the unit file.
node_bin="$(command -v node)"
cat > "$runner_dir/run-backup.sh" <<RUNNER
#!/usr/bin/env bash
set -euo pipefail
exec "$node_bin" "\$HOME/.local/share/ausspend-backup/db-backup.mjs" \
  --out-root "\${AUSSPEND_BACKUP_ROOT:-\$HOME/ausspend-backups}" --prune 14
RUNNER
chmod 0755 "$runner_dir/run-backup.sh"

# Mode-600 user template. It contains no real host, credential or user path;
# replace MONGO_URL before enabling the timer against a non-local database.
backup_env="$HOME/.config/ausspend/backup.env"
if [ ! -f "$backup_env" ]; then
  umask 077
  cat > "$backup_env" <<'ENV'
# ausspend backup environment (mode 600). Set the database URL for this host.
MONGO_URL=mongodb://localhost:27017/ausspend_dev
ENV
  chmod 600 "$backup_env"
fi
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
