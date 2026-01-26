#!/bin/bash
# Simple beads-compatible "ready" command
# Finds tasks that are ready to work on (status: ready, no blocking dependencies)

echo "🔍 Finding ready tasks..."
echo ""

cd "$(dirname "$0")"

for file in tasks/*.jsonl; do
  if [ -f "$file" ]; then
    # Get latest state
    latest=$(tail -1 "$file")

    # Check if status is "ready"
    if echo "$latest" | grep -q '"status":"ready"'; then
      id=$(echo "$latest" | python -c "import sys, json; print(json.loads(sys.stdin.read())['id'])")
      title=$(echo "$latest" | python -c "import sys, json; print(json.loads(sys.stdin.read())['title'])")
      priority=$(echo "$latest" | python -c "import sys, json; print(json.loads(sys.stdin.read()).get('priority', 'N/A'))")

      echo "✅ [$id] P$priority: $title"

      # Show context if available
      if echo "$latest" | grep -q '"context"'; then
        context=$(echo "$latest" | python -c "import sys, json; print(json.loads(sys.stdin.read()).get('context', '')[:100])")
        echo "   Context: $context..."
      fi

      echo ""
    fi
  fi
done

echo "---"
echo "Use: tail -1 .beads/tasks/<id>.jsonl | python -m json.tool"
echo "To see full task details"
