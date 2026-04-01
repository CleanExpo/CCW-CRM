# Beads Task Tracking System

This directory contains git-backed task tracking for the CCW Online ERP project, inspired by https://github.com/steveyegge/beads

## Structure

Tasks are stored as JSONL (JSON Lines) files in `.beads/tasks/`:
- Each task has a unique hash-based ID (e.g., `bd-a1f8`)
- Each line in a task file is a state update (git-versioned history)
- Tasks form a dependency graph (parent/child, blocks/blocked_by)

## Current Task Hierarchy

```
bd-a1f8 (Epic): Complete Phase 9 Performance Testing [IN PROGRESS]
├── bd-a1f8.1: Fix PostgreSQL ENUM type mismatches [✅ COMPLETED]
├── bd-a1f8.2: Fix Order/Quote schema alignment [✅ COMPLETED]
├── bd-a1f8.3: Investigate remaining 46% test failures [🔄 READY]
├── bd-a1f8.4: Reach 80% smoke test pass rate [⏸ BLOCKED by bd-a1f8.3]
├── bd-a1f8.5: Run full 10,000+ scenario load test [⏸ BLOCKED by bd-a1f8.4]
└── bd-a1f8.6: Document performance baselines [⏸ BLOCKED by bd-a1f8.5]
```

## Helper Commands

Since the beads CLI couldn't be installed on Windows, use these manual commands:

### View Ready Tasks
```bash
# Find tasks with status "ready" (no blocking dependencies)
grep '"status":"ready"' .beads/tasks/*.jsonl | tail -1
```

### View Task Details
```bash
# Get latest state of a task
tail -1 .beads/tasks/bd-a1f8.3.jsonl | python -m json.tool
```

### List All Tasks
```bash
# Show all tasks with their latest status
for file in .beads/tasks/*.jsonl; do
  echo "$(basename $file):"
  tail -1 "$file" | python -m json.tool | grep -E '"id"|"title"|"status"'
  echo "---"
done
```

### Update Task Status
Add a new line to the task's JSONL file with updated fields:
```bash
# Example: Mark bd-a1f8.3 as in_progress
echo '{"id":"bd-a1f8.3","status":"in_progress","updated":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' >> .beads/tasks/bd-a1f8.3.jsonl
```

## Integration with Git

Commit task updates alongside code changes:
```bash
git add .beads/tasks/
git commit -m "feat(testing): completed ENUM fix, pass rate 50%→54%

Task updates:
- bd-a1f8.1: completed (ENUM types fixed)
- bd-a1f8.2: completed (schema alignment fixed)
- bd-a1f8.3: now ready (unblocked)
"
```

## Benefits

1. **Persistent**: Tasks survive across sessions
2. **Versioned**: Full history in git
3. **Structured**: Clear dependencies and blocking relationships
4. **Context-Preserving**: Each task contains notes and results
5. **AI-Friendly**: JSONL format easy to parse and update

## Next Step

The next ready task is **bd-a1f8.3**: Investigate remaining 46% test failures

Run the diagnostic analysis to understand why 46 out of 100 smoke test scenarios are still failing.
