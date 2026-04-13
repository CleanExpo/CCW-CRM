#!/usr/bin/env python3
"""
UserPromptSubmit hook — injects compass check before every user message.
Keeps Orchestrator on course even after compaction.
Output appears as injected context before Claude processes the user's message.
"""
import sys
from pathlib import Path

memory_dir = Path(".claude/memory")
constitution = memory_dir / "CONSTITUTION.md"
current_state = memory_dir / "current-state.md"

output_lines = []

# Always inject the prohibitions from CONSTITUTION (critical, compact)
if constitution.exists():
    lines = constitution.read_text(encoding="utf-8").splitlines()
    prohibition_lines = [line for line in lines if line.strip().startswith(("1.", "2.", "3.", "4.", "5.", "6.", "7.", "8."))]
    output_lines.append("COMPASS CHECK (auto-injected) — PROHIBITIONS ACTIVE:")
    output_lines.extend(prohibition_lines[:8])

# Inject current sprint/task state (first 12 lines only)
if current_state.exists():
    state_text = current_state.read_text(encoding="utf-8")
    output_lines.append("\nCURRENT STATE:")
    state_lines = state_text.splitlines()[:12]
    output_lines.extend(state_lines)

print("\n".join(output_lines))
sys.exit(0)
