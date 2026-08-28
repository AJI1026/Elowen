#!/usr/bin/env bash
# Build Elowen desktop app: frontend → PyInstaller API → Electron installer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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

echo "==> 1/4 Frontend production build"
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then npm install; fi
if [[ ! -f index.html ]]; then cp index.example.html index.html; fi
npm run build:prod
cd "$ROOT"

echo "==> 2/4 Python venv + PyInstaller sidecar"
VENV="$ROOT/backend/.venv"
if [[ ! -x "$VENV/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"
PIP_INDEX=(-i https://pypi.org/simple --trusted-host pypi.org --trusted-host files.pythonhosted.org)
pip install "${PIP_INDEX[@]}" -q -r backend/requirements.txt
pip install "${PIP_INDEX[@]}" -q "pyinstaller>=6.3"

rm -rf "$ROOT/backend/dist/elowen-api" "$ROOT/backend/build"
export PYTHONPATH="$ROOT/backend:$ROOT/functions"
cd "$ROOT/backend"
pyinstaller --noconfirm elowen-api.spec
PYI_STATUS=$?
cd "$ROOT"
if [[ $PYI_STATUS -ne 0 ]]; then
  echo "ERROR: PyInstaller failed with status $PYI_STATUS"
  exit $PYI_STATUS
fi

if [[ ! -x "$ROOT/backend/dist/elowen-api/elowen-api" && ! -f "$ROOT/backend/dist/elowen-api/elowen-api.exe" ]]; then
  echo "ERROR: elowen-api binary missing after PyInstaller"
  exit 1
fi

echo "==> 3/4 Electron dependencies"
cd "$ROOT/desktop"
# Mirrors help in regions where GitHub electron downloads are slow/blocked
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"
if [[ ! -d node_modules/electron ]]; then
  npm install
fi

echo "==> 4/4 Package installer"
TARGET="${1:-}"
case "$(uname -s)" in
  Darwin)
    npm run dist:mac
    ;;
  Linux)
    npm run dist:linux
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    npm run dist:win
    ;;
  *)
    npm run dist
    ;;
esac

echo ""
echo "Done. Installers are under: desktop/release/"
ls -la "$ROOT/desktop/release" || true
