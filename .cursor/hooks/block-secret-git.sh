#!/usr/bin/env bash
# Cursor hook: block agent git add/commit/push of sensitive paths.
set -euo pipefail
input="$(cat || true)"
command="$(printf '%s' "$input" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("command") or "")' 2>/dev/null || true)"

deny() {
  local msg="$1"
  python3 -c 'import json,sys; print(json.dumps({"permission":"deny","user_message":sys.argv[1],"agent_message":sys.argv[1]}))' "$msg"
  exit 0
}

allow() {
  echo '{"permission":"allow"}'
  exit 0
}

case "$command" in
  *git\ add*|*git\ commit*|*git\ push*)
    ;;
  *)
    allow
    ;;
esac

# Sensitive path names in the command line
if printf '%s' "$command" | grep -Eq \
  '(^|[[:space:]=])(\.?/?)*functions/models/api_config\.py|\.env([.]|$)|credentials\.json|service-account|application_default_credentials|\.pem\b|id_rsa'; then
  deny "Blocked: do not git add/commit/push secrets (api_config.py, .env, credentials). Use ELOWEN_API_KEY instead."
fi

allow
