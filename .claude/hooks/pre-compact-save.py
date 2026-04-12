#!/usr/bin/env python3
"""
PreCompact hook — saves critical context to disk before compaction.
Receives JSON on stdin: {"session_id": "...", "transcript_path": "..."}
"""
import sys
import json
from pathlib import Path
from datetime import datetime

try:
    data = json.loads(sys.stdin.read())
except Exception:
    data = {}

memory_dir = Path(".claude/memory")
memory_dir.mkdir(parents=True, exist_ok=True)
snapshot_path = memory_dir / "context-snapshot.md"

snapshot_content = f"""# Context Snapshot — Pre-Compaction
Generated: {datetime.now().isoformat()}
Session ID: {data.get('session_id', 'unknown')}

## WARNING
Context compaction occurred. On next user message, re-read:
1. .claude/memory/CONSTITUTION.md
2. .claude/memory/current-state.md
3. .claude/memory/handoff.md

## State at Time of Compaction
"""

current_state_path = memory_dir / "current-state.md"
if current_state_path.exists():
    snapshot_content += "\n" + current_state_path.read_text(encoding="utf-8")

snapshot_path.write_text(snapshot_content, encoding="utf-8")
print(f"Pre-compact state saved to {snapshot_path}")
sys.exit(0)
