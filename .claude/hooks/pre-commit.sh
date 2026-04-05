#!/bin/bash
# Pre-commit hook - validates before any commit

set -e

echo "🔍 Pre-commit validation..."

# 1. Check for forbidden folders
FORBIDDEN=$(find apps -type d \( -name "temp" -o -name "tmp" -o -name "old" -o -name "backup" \) 2>/dev/null | grep -v node_modules || true)
if [ -n "$FORBIDDEN" ]; then
  echo "❌ BLOCKED: Forbidden folders found:"
  echo "$FORBIDDEN"
  exit 1
fi

# 2. Check for console.log in src/
CONSOLELOGS=$(find app/src app/app -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | xargs grep -l "console.log" 2>/dev/null || true)
if [ -n "$CONSOLELOGS" ]; then
  echo "⚠️ WARNING: console.log found:"
  echo "$CONSOLELOGS"
fi

# 3. Run tests
echo "Running tests..."
npm run test || { echo "❌ Tests failed"; exit 1; }

# 4. Run type check
echo "Running type check..."
npm run type-check || { echo "❌ Type check failed"; exit 1; }

echo "✅ All checks passed"
