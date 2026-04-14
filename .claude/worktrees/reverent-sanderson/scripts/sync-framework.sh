#!/bin/bash
# Framework Sync & Validation Script
set -e

echo "🔄 Claude Framework Validation"
echo "================================="

ERRORS=0

# Check required .claude files
REQUIRED_FILES=(
  ".claude/STARTUP.md"
  ".claude/CLAUDE.md"
  ".claude/.directives"
  ".claude/.execution"
  ".claude/mcp-servers.json"
)

echo "📋 Checking required files..."
for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ MISSING: $file"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check for forbidden folders
echo ""
echo "🚫 Checking for forbidden folders..."
FORBIDDEN=$(find apps -type d \( -name "temp" -o -name "tmp" -o -name "old" -o -name "backup" \) 2>/dev/null | grep -v node_modules || true)
if [ -n "$FORBIDDEN" ]; then
  echo "  ✗ FORBIDDEN: $FORBIDDEN"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No forbidden folders found"
fi

echo ""
echo "================================="

if [ $ERRORS -gt 0 ]; then
  echo "❌ $ERRORS issues found"
  exit 1
else
  echo "✅ Framework structure valid"
fi
