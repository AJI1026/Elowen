#!/usr/bin/env bash
# Point this repo at .githooks/ so pre-commit secret checks run for everyone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
echo "Git hooksPath → .githooks (pre-commit secret scan enabled)"
