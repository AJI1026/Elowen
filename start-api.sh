#!/usr/bin/env bash
# One-command local API start (no Firebase).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3.10 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3.10)"
  elif command -v python3.11 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3.11)"
  else
    PYTHON_BIN="$(command -v python3)"
  fi
fi

VENV="$ROOT/backend/.venv"
if [[ ! -x "$VENV/bin/python" ]]; then
  echo "Creating venv with $PYTHON_BIN ..."
  "$PYTHON_BIN" -m venv "$VENV"
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
  pip install -r backend/requirements.txt
else
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
fi

export PYTHONPATH="$ROOT/backend:$ROOT/functions"
export ELOWEN_DATA_DIR="${ELOWEN_DATA_DIR:-$ROOT/data}"
export ELOWEN_DB_PATH="${ELOWEN_DB_PATH:-$ELOWEN_DATA_DIR/elowen.sqlite3}"
export ELOWEN_IMAGES_DIR="${ELOWEN_IMAGES_DIR:-$ELOWEN_DATA_DIR/images}"
export ELOWEN_SEED_DIR="${ELOWEN_SEED_DIR:-$ROOT/backend/seed}"

mkdir -p "$ELOWEN_DATA_DIR" "$ELOWEN_IMAGES_DIR"

echo "API → http://127.0.0.1:8000  (Ctrl+C to stop)"
cd "$ROOT/backend"
exec python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
