#!/usr/bin/env bash
# Start API + frontend together for local development.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

"$ROOT/start-api.sh" &
API_PID=$!

# Wait until API is up
for _ in $(seq 1 40); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  npm install
fi
npm run serve
