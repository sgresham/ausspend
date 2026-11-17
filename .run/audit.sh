#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
source ~/.nvm/nvm.sh >/dev/null 2>&1
nvm use 24.14.1 >/dev/null 2>&1
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev PORT=3102 setsid npm run dev:server >.run/server.log 2>&1 </dev/null &
SERVER_PID=$!
VITE_API_PROXY_TARGET=http://localhost:3102 setsid node_modules/.bin/vite client --port 5175 --strictPort >.run/client.log 2>&1 </dev/null &
CLIENT_PID=$!
cleanup() { kill -- -"$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null; kill -- -"$CLIENT_PID" 2>/dev/null || kill "$CLIENT_PID" 2>/dev/null; }
trap cleanup EXIT
for i in $(seq 1 60); do
  if curl -sf http://localhost:3102/api/health >/dev/null 2>&1 && curl -sf http://localhost:5175/ >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -sf http://localhost:3102/api/health >/dev/null || { echo 'API did not start'; tail -20 .run/server.log; exit 2; }
curl -sf http://localhost:5175/ >/dev/null || { echo 'Web did not start'; tail -20 .run/client.log; exit 2; }
AUDIT_WEB_URL=http://localhost:5175 AUDIT_API_URL=http://localhost:3102 npm run audit
exit $?
