#!/usr/bin/env bash
# Verify lockfile integrity — ensures pnpm-lock.yaml matches package.json
# Called by .husky/pre-commit when lockfile-related files are staged

set -euo pipefail

echo "Checking pnpm lockfile integrity..."

if ! pnpm install --frozen-lockfile --ignore-scripts > /dev/null 2>&1; then
  echo "❌ Lockfile out of sync with package.json"
  echo "   Run 'pnpm install' and stage the updated pnpm-lock.yaml"
  exit 1
fi

echo "✅ Lockfile integrity verified"
