#!/usr/bin/env python3
"""
PreToolUse hook (matcher: Task) — validates agent dispatch routing.
Receives tool input on stdin as JSON. Logs dispatch for audit trail.
"""
import sys
import json
from pathlib import Path
from datetime import datetime

try:
    data = json.loads(sys.stdin.read())
except Exception:
    data = {}

agent_type = data.get("input", {}).get("subagent_type", "unknown")
description = data.get("input", {}).get("description", "")

# Log dispatch to decisions log
log_path = Path(".claude/memory/decisions-log.md")
if log_path.exists():
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n## Agent Dispatch — {datetime.now().isoformat()}\n")
            f.write(f"- Type: {agent_type}\n")
            f.write(f"- Description: {description}\n")
    except Exception:
        pass

# Always allow (informational hook only)
sys.exit(0)
