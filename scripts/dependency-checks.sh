#!/usr/bin/env bash
# Ensure package-lock.json matches workspace package.json files (npm).
# Called by .husky/pre-commit when lockfile-related files are staged.

set -euo pipefail

echo "Checking npm lockfile sync..."

LOCK_BAK=$(mktemp)
cp package-lock.json "$LOCK_BAK"

npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null 2>&1

if ! cmp -s package-lock.json "$LOCK_BAK"; then
  cp "$LOCK_BAK" package-lock.json
  rm -f "$LOCK_BAK"
  echo "❌ package-lock.json is out of sync with package.json"
  echo "   Run npm install at the repo root and commit package-lock.json"
  exit 1
fi

rm -f "$LOCK_BAK"
echo "✅ Lockfile in sync"
