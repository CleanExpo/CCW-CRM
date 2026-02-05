# Execution State Directory

**Purpose**: Runtime state management for autonomous multi-agent execution

**Status**: Part of Phase 5 Autonomous Development Framework

---

## Overview

This directory contains runtime state for autonomous task execution. Files in this directory are **gitignored** and represent the current state of ongoing or recently completed autonomous builds.

---

## Directory Structure

```
.execution/
├── README.md                    # This file
├── current-task.json            # Active task metadata
├── execution-log.jsonl          # Audit trail (JSON Lines format)
├── schemas/                     # JSON schemas for validation
│   ├── task-state.schema.json
│   ├── handoff.schema.json
│   ├── validation-report.schema.json
│   ├── discovery-report.schema.json
│   ├── architecture-doc.schema.json
│   ├── build-progress.schema.json
│   └── completion-report.schema.json
├── phase-handoffs/              # Inter-phase data transfers
│   ├── phase-1-discovery.json
│   ├── phase-2-architecture.json
│   ├── phase-3-build.json
│   └── phase-4-build-final.json
└── validation-reports/          # Validator outputs
    ├── phase-1-validation.json
    ├── phase-2-validation.json
    ├── phase-3-validation.json
    ├── phase-4-validation.json
    └── phase-5-validation.json
```

---

## File Descriptions

### current-task.json

**Purpose**: Metadata for the currently active autonomous task

**Schema**: `schemas/task-state.schema.json`

**Example**:
```json
{
  "task_id": "task_20260205_143022",
  "created_at": "2026-02-05T14:30:22Z",
  "user_request": "Add a Recent Quotes widget to the dashboard",
  "current_phase": 2,
  "current_agent": "architect",
  "status": "in_progress",
  "approval_mode": "manual",
  "phases_completed": [1],
  "phases_remaining": [2, 3, 4, 5],
  "metadata": {
    "estimated_total_time_minutes": 45,
    "elapsed_time_minutes": 15,
    "files_to_create": 2,
    "files_to_modify": 1
  }
}
```

---

### execution-log.jsonl

**Purpose**: Append-only audit trail of all execution events

**Format**: JSON Lines (one JSON object per line)

**Example**:
```jsonl
{"timestamp":"2026-02-05T14:30:22Z","event":"task_started","task_id":"task_20260205_143022","agent":"lead","message":"Received task from user"}
{"timestamp":"2026-02-05T14:30:25Z","event":"phase_started","task_id":"task_20260205_143022","phase":1,"agent":"discovery","message":"Beginning discovery phase"}
{"timestamp":"2026-02-05T14:35:10Z","event":"phase_completed","task_id":"task_20260205_143022","phase":1,"agent":"discovery","duration_seconds":285}
{"timestamp":"2026-02-05T14:35:15Z","event":"validation_passed","task_id":"task_20260205_143022","phase":1,"agent":"validator","checks_passed":12,"checks_failed":0}
```

---

### phase-handoffs/

**Purpose**: Data passed between phases

Each phase produces a handoff document for the next phase:

| File | From Agent | To Agent | Contents |
|------|------------|----------|----------|
| `phase-1-discovery.json` | Discovery | Architect | Codebase analysis, patterns found, constraints |
| `phase-2-architecture.json` | Architect | Builder | System design, component specs, file list |
| `phase-3-build.json` | Builder | Builder | Intermediate build state (for resumption) |
| `phase-4-build-final.json` | Builder | Finalizer | Final build output, files changed, test results |

**Schema**: `schemas/handoff.schema.json`

---

### validation-reports/

**Purpose**: Validator agent output for each phase

Each phase is validated before proceeding to the next:

| File | Phase | Validates |
|------|-------|-----------|
| `phase-1-validation.json` | Discovery | Discovery report completeness, accuracy |
| `phase-2-validation.json` | Architecture | Design quality, constraint compliance |
| `phase-3-validation.json` | Build (continuous) | Code quality, tests, implementation progress |
| `phase-4-validation.json` | Build (final) | All code complete, all tests pass |
| `phase-5-validation.json` | Finalization | Deployment readiness, documentation |

**Schema**: `schemas/validation-report.schema.json`

---

## State Lifecycle

### 1. Task Initialization
```
User: /autonomous "Add feature X"
    ↓
Lead Agent creates current-task.json
    ↓
Execution log started
```

### 2. Phase Execution
```
For each phase (1-5):
    ↓
Agent produces handoff document
    ↓
Validator reviews handoff
    ↓
If pass: Next phase
If fail: Retry or escalate to user
```

### 3. Task Completion
```
Finalizer produces completion report
    ↓
Current task archived
    ↓
Execution log closed
```

### 4. Task Resumption (After Interruption)
```
User: /autonomous --resume task_20260205_143022
    ↓
Load current-task.json
    ↓
Load last handoff document
    ↓
Resume from current_phase
```

---

## JSON Schemas

All state files are validated against JSON schemas to ensure consistency and enable tooling.

### task-state.schema.json

Defines structure of `current-task.json`:
- `task_id`: Unique identifier (format: task_YYYYMMDD_HHMMSS)
- `created_at`: ISO 8601 timestamp
- `user_request`: Original user task description
- `current_phase`: Integer 1-5
- `current_agent`: String (discovery|architect|builder|validator|finalizer)
- `status`: Enum (pending|in_progress|paused|completed|failed)
- `approval_mode`: Enum (manual|auto)
- `phases_completed`: Array of integers
- `phases_remaining`: Array of integers
- `metadata`: Object with additional context

### handoff.schema.json

Defines structure of phase handoff documents:
- `from_phase`: Integer 1-5
- `from_agent`: String
- `to_phase`: Integer 1-5
- `to_agent`: String
- `timestamp`: ISO 8601 timestamp
- `data`: Object (phase-specific data)
- `validation_passed`: Boolean
- `validator_notes`: Array of strings

### validation-report.schema.json

Defines structure of validation reports:
- `phase`: Integer 1-5
- `agent`: String (validator)
- `timestamp`: ISO 8601 timestamp
- `checks_performed`: Array of objects
  - `check_name`: String
  - `status`: Enum (pass|fail|warning)
  - `message`: String
  - `details`: Object (optional)
- `overall_status`: Enum (pass|fail|pass_with_warnings)
- `recommendation`: String (proceed|retry|escalate)

---

## Usage

### PowerShell Utilities

```powershell
# Initialize execution directory
.\scripts\autonomous\init-execution.ps1

# Validate current state
.\scripts\autonomous\validate-state.ps1

# Resume interrupted task
.\scripts\autonomous\resume-task.ps1 -TaskId "task_20260205_143022"

# Clean up old execution state (archive tasks older than 7 days)
.\scripts\autonomous\cleanup-execution.ps1 -ArchiveOlderThanDays 7
```

### Manual Inspection

```powershell
# View current task
Get-Content .claude\.execution\current-task.json | ConvertFrom-Json | Format-List

# View execution log (last 10 events)
Get-Content .claude\.execution\execution-log.jsonl -Tail 10 | ForEach-Object { $_ | ConvertFrom-Json }

# Check latest validation report
Get-Content .claude\.execution\validation-reports\phase-2-validation.json | ConvertFrom-Json
```

---

## State Cleanup

**When to clean**:
- Task completed successfully (archive after 24 hours)
- Task failed (archive after 7 days for debugging)
- Disk space concerns (archive older tasks)

**Cleanup script**:
```powershell
.\scripts\autonomous\cleanup-execution.ps1 -ArchiveAll
```

Archives are stored in: `.claude/.execution/archives/YYYY-MM-DD/`

---

## Error Recovery

### Corrupted State

If state becomes corrupted:
```powershell
# Validate state integrity
.\scripts\autonomous\validate-state.ps1

# If repair needed
.\scripts\autonomous\repair-state.ps1
```

### Lost Task State

If `current-task.json` is lost but execution log exists:
```powershell
# Reconstruct from execution log
.\scripts\autonomous\reconstruct-state.ps1 -FromLog
```

---

## Security Notes

**This directory is gitignored** - runtime state should NEVER be committed to version control because:

1. **Contains work-in-progress code** - May have bugs, incomplete features
2. **Local machine specific** - Paths, timestamps, user context
3. **Rapid churn** - Changes frequently during execution
4. **Large file sizes** - Validation reports can be verbose

**What IS versioned**:
- Schemas (`.execution/schemas/`) - Structural definitions
- README (this file) - Documentation
- PowerShell utilities (`scripts/autonomous/`) - Tools

---

## Troubleshooting

### Task stuck at phase transition

**Symptom**: Task shows "in_progress" but no activity

**Check**:
1. View execution log for last event
2. Check if validator is blocking
3. Review validation report for failures

**Fix**:
```powershell
# Retry current phase
.\scripts\autonomous\retry-phase.ps1

# Or skip validation (requires approval)
.\scripts\autonomous\force-transition.ps1 --skip-validation
```

### Multiple current tasks

**Symptom**: `current-task.json` exists but task is actually complete

**Fix**:
```powershell
# Clean up stale task
.\scripts\autonomous\cleanup-execution.ps1 -Force
```

---

**Created**: February 5, 2026
**Version**: 1.0
**Part of**: Phase 5 Autonomous Development Framework
