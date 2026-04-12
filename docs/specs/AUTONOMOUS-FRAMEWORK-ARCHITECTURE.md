# Autonomous Development Framework - Architecture Documentation

**Version**: 1.0.0
**Date**: February 5, 2026
**Status**: Implemented
**Part of**: Phase 5

---

## Executive Summary

The Autonomous Development Framework is a self-sustaining, AI-driven software development system that coordinates specialized agents through a 5-phase pipeline to deliver production-ready code from a simple task description.

**Key Capabilities:**

- **Autonomous Execution**: Complete features from analysis to deployment
- **Quality Assurance**: Continuous validation at every step
- **Pattern Following**: Automatically matches existing code patterns
- **Safety**: Built-in constraints prevent forbidden changes
- **Transparency**: Full audit trail and state tracking
- **Resumption**: Interrupt and resume at any phase

---

## System Architecture

### High-Level Overview

```
User Request
    ↓
/autonomous command
    ↓
Lead Agent (Orchestrator)
    ↓
┌─────────────5-Phase Pipeline─────────────┐
│                                           │
│  Phase 1: Discovery → Validator          │
│      ↓                                    │
│  Phase 2: Architecture → Validator       │
│      ↓                                    │
│  Phase 3: Build → Validator (continuous) │
│      ↓                                    │
│  Phase 4: Build Final → Validator (gate) │
│      ↓                                    │
│  Phase 5: Finalize → Validator           │
│                                           │
└───────────────────────────────────────────┘
    ↓
Completion Report → User
```

---

## Component Architecture

### 1. Lead Agent (Orchestrator)

**Role**: Coordinates all subagents and manages execution flow

**Responsibilities:**

- Parse user task
- Initialize execution state
- Route to appropriate subagents
- Handle phase transitions
- Manage approvals
- Report progress
- Handle errors

**Location**: `.claude/agents/lead-agent.md`

---

### 2. Discovery Agent (Phase 1)

**Role**: Codebase explorer and pattern analyzer

**Responsibilities:**

- Analyze relevant code areas
- Identify existing patterns
- Document constraints
- Recommend files to change
- Assess complexity and risk
- Produce discovery report

**Inputs:**

- User task description
- Access to codebase (Glob, Read, Grep tools)

**Outputs:**

- Discovery report (JSON)
- Pattern documentation
- Constraint list
- File recommendations

**Location**: `.claude/agents/discovery-agent.md`

---

### 3. Architect Agent (Phase 2)

**Role**: Solution designer and specification writer

**Responsibilities:**

- Design complete solution
- Specify each component in detail
- Create implementation plan
- Identify breaking changes
- Flag approvals needed
- Estimate time and complexity

**Inputs:**

- Discovery report from Phase 1
- User task description

**Outputs:**

- Architecture document (JSON)
- Component specifications
- File-by-file implementation plan
- Approval requirements

**Location**: `.claude/agents/architect-agent.md`

---

### 4. Builder Agent (Phases 3-4)

**Role**: Code implementer

**Responsibilities:**

- Implement code exactly as specified
- Follow patterns precisely
- Write tests continuously
- Report progress
- Handle blockers
- Achieve 100% test pass rate

**Inputs:**

- Architecture document from Phase 2
- Pattern reference files

**Outputs:**

- Implemented code files
- Test files
- Build progress reports
- Final build handoff

**Location**: `.claude/agents/builder-agent.md`

---

### 5. Validator Agent (All Phases)

**Role**: Quality assurance guardian

**Responsibilities:**

- Validate outputs at each phase
- Check constraint compliance
- Verify code quality
- Enforce test coverage
- Block forbidden changes
- Recommend proceed/retry/escalate

**Inputs:**

- Phase outputs (handoffs)
- Validation criteria (phase-specific)

**Outputs:**

- Validation reports (JSON)
- Pass/fail/warning status
- Recommendations
- Blocking issues

**Location**: `.claude/agents/validator-agent.md`

---

### 6. Finalizer Agent (Phase 5)

**Role**: Completion verifier and documenter

**Responsibilities:**

- Verify completion criteria
- Assess deployment readiness
- Create rollback plan
- Document file changes
- Identify next steps
- Produce completion report

**Inputs:**

- Build final handoff from Phase 4
- User task description

**Outputs:**

- Completion report (JSON)
- File change manifest
- Deployment assessment
- Rollback plan
- Next steps

**Location**: `.claude/agents/finalizer-agent.md`

---

## Data Flow Architecture

### State Management

**Execution State Directory**: `.claude/.execution/`

```
.execution/
├── README.md                      # Documentation
├── .gitignore                     # Runtime files excluded
├── current-task.json              # Active task metadata
├── execution-log.jsonl            # Audit trail (append-only)
├── schemas/                       # JSON schemas
│   ├── task-state.schema.json
│   ├── handoff.schema.json
│   ├── validation-report.schema.json
│   ├── discovery-report.schema.json
│   ├── architecture-doc.schema.json
│   ├── build-progress.schema.json
│   └── completion-report.schema.json
├── phase-handoffs/                # Inter-phase data
│   ├── phase-1-discovery.json
│   ├── phase-2-architecture.json
│   ├── phase-3-build.json
│   └── phase-4-build-final.json
└── validation-reports/            # Quality checks
    ├── phase-1-validation.json
    ├── phase-2-validation.json
    ├── phase-3-validation.json
    ├── phase-4-validation.json
    └── phase-5-validation.json
```

**State Persistence:**

- All state is filesystem-based (JSON files)
- No database required
- Git-ignored (local machine only)
- Self-contained and portable

---

### Phase Handoffs

Each phase produces a **handoff document** for the next phase:

**Handoff Schema:**

```json
{
  "from_phase": 1,
  "from_agent": "discovery",
  "to_phase": 2,
  "to_agent": "architect",
  "timestamp": "ISO 8601",
  "data": {
    "phase_N_output": {
      /* phase-specific data */
    }
  },
  "validation_passed": false,
  "validator_notes": []
}
```

**Flow:**

```
Phase 1 (Discovery)
    ↓ handoff
Phase 2 (Architect) reads discovery handoff
    ↓ handoff
Phase 3 (Builder) reads architecture handoff
    ↓ handoff
Phase 4 (Builder Final) reads build progress
    ↓ handoff
Phase 5 (Finalizer) reads build final
    ↓
Completion Report → User
```

---

### Validation Reports

After each phase output, Validator produces a **validation report**:

**Report Schema:**

```json
{
  "phase": 2,
  "agent": "validator",
  "timestamp": "ISO 8601",
  "checks_performed": [
    {
      "check_name": "pattern_compliance",
      "status": "pass",
      "message": "Follows existing patterns",
      "details": {}
    }
  ],
  "overall_status": "pass",
  "recommendation": "proceed",
  "blocking_issues": [],
  "warnings": [],
  "suggestions": []
}
```

**Validation Flow:**

```
Agent produces output
    ↓
Validator reviews output
    ↓
Pass? → Continue to next phase
Fail? → Retry current phase (max 3)
Critical? → Escalate to user
```

---

## Execution Flow

### Initialization

```
1. User: /autonomous "task description"
2. Lead Agent parses request
3. Validate prerequisites:
   - Execution directory exists?
   - No active task?
   - Description clear?
4. Create task state (task_YYYYMMDD_HHMMSS)
5. Initialize execution log
6. Announce execution plan to user
```

---

### Phase Execution Loop

```
For each phase (1-5):
    1. Phase Transition
       - Update task state
       - Log phase start
       - Announce to user

    2. Delegate to Subagent
       - Load previous handoff (if phase > 1)
       - Provide context
       - Set expectations

    3. Subagent Executes
       - Performs phase work
       - Reports progress
       - Produces handoff document

    4. Validate Output
       - Validator reviews handoff
       - Checks quality, compliance
       - Produces validation report

    5. Handle Validation Result
       - PASS: Continue to next phase
       - FAIL: Retry (max 3)
       - CRITICAL: Escalate to user

    6. Request Approval (if manual mode)
       - Present phase results
       - Wait for "proceed"
       - Handle cancellation
```

---

### Completion

```
1. Finalizer produces completion report
2. Validator verifies completion
3. Update task state to "completed"
4. Log task completion
5. Present report to user
6. Preserve execution state for reference
```

---

## Safety & Constraints

### Built-in Safety Mechanisms

**Constraint Enforcement:**

- ✅ **Discovery Phase**: Identifies forbidden changes
- ✅ **Architecture Phase**: Blocks designs with forbidden changes
- ✅ **Build Phase**: Continuous validation prevents unauthorized code
- ✅ **Build Final Phase**: Strict deployment gate (100% tests)

**Forbidden Actions** (BLOCKED):

- ❌ Modify database schema (`demo_models.py`)
- ❌ Modify auth code (`middleware.ts`, `demo_auth.py`)
- ❌ Break existing API contracts

**Approval Required**:

- ⚠️ Create new folders
- ⚠️ Install new packages
- ⚠️ Make breaking API changes

**Validation Gates:**

- Phase 1: Completeness, accuracy
- Phase 2: Design quality, constraint compliance (CRITICAL)
- Phase 3: Code quality (continuous)
- Phase 4: Deployment readiness (STRICT - 100% tests)
- Phase 5: Completion criteria

---

### Error Recovery

**Validation Failure:**

```
Attempt 1: Retry with corrections
Attempt 2: Retry with different approach
Attempt 3: Retry with minimal changes
Failure: Escalate to user
```

**Blocker Encountered:**

```
1. Agent reports blocker with context
2. Presents options
3. Waits for user guidance
4. Does NOT guess or skip
```

**State Corruption:**

```
1. Detect corrupted state
2. Attempt reconstruction from logs
3. If fail: Notify user, offer fresh start
4. Preserve corrupted state for debugging
```

---

## Resumption Architecture

### State Preservation

**When task pauses/cancels:**

```
1. Complete current step (safe checkpoint)
2. Save task state to current-task.json
3. Preserve all handoffs and validations
4. Log pause/cancel event
5. Notify user of task ID
```

**Resume protocol:**

```
1. User: /autonomous --resume task_...
2. Load task state from current-task.json
3. Load last handoff from phase-handoffs/
4. Validate state integrity
5. Resume from current_phase
6. Continue execution
```

**Resumption Requirements:**

- `current-task.json` exists and valid
- Last handoff document exists
- Execution log is intact
- No state corruption

---

## Approval Modes

### Manual Approval (Default)

**Behavior:**

- Pause after each phase
- Wait for user "proceed"
- User can inspect outputs
- User can cancel anytime

**Use Cases:**

- First-time users
- Complex/risky changes
- Learning the system
- Maximum control

---

### Auto Approval

**Behavior:**

- Proceed automatically
- Pause ONLY for:
  - Breaking changes
  - New folders
  - New packages
  - Validation failures

**Use Cases:**

- Simple changes
- Trusted patterns
- Speed priority
- Confident users

---

## Monitoring & Observability

### Execution Log

**Format**: JSON Lines (append-only)

**Events Logged:**

- `task_started`
- `phase_started`
- `phase_completed`
- `phase_failed`
- `validation_passed`
- `validation_failed`
- `user_approval_requested`
- `user_approval_granted`
- `user_cancellation`
- `task_completed`

**Usage:**

```powershell
# View all events
Get-Content .claude\.execution\execution-log.jsonl | ConvertFrom-Json

# Filter specific events
Get-Content .claude\.execution\execution-log.jsonl | ConvertFrom-Json | Where-Object { $_.event -eq "validation_failed" }

# View last 10 events
Get-Content .claude\.execution\execution-log.jsonl -Tail 10 | ConvertFrom-Json
```

---

### Progress Tracking

**Real-time Progress:**

- Phase transitions announced
- Validation results displayed
- File completions reported (Phase 3)
- Quality checks shown every 2 files

**State Inspection:**

```powershell
# Current task status
.\scripts\autonomous\validate-state.ps1

# Task details
.\scripts\autonomous\resume-task.ps1

# Phase handoff
Get-Content .claude\.execution\phase-handoffs\phase-2-architecture.json
```

---

## Performance Characteristics

### Time Estimates (Typical)

| Phase                 | Simple     | Medium     | Complex     |
| --------------------- | ---------- | ---------- | ----------- |
| Phase 1: Discovery    | 5 min      | 8 min      | 15 min      |
| Phase 2: Architecture | 10 min     | 15 min     | 25 min      |
| Phase 3: Build        | 15 min     | 30 min     | 60 min      |
| Phase 4: Build Final  | 5 min      | 10 min     | 15 min      |
| Phase 5: Finalize     | 5 min      | 7 min      | 10 min      |
| **Total**             | **40 min** | **70 min** | **125 min** |

**Variables:**

- Task complexity
- Number of files
- Test coverage required
- Validation retries
- User approval delays

---

### Resource Usage

**Disk Space:**

- Execution state: ~1-5 MB per task
- Logs: ~100 KB - 1 MB per task
- Handoffs: ~10-100 KB each
- Total per task: ~2-10 MB

**Cleanup:**

```powershell
# Archive tasks older than 7 days
.\scripts\autonomous\cleanup-execution.ps1 -ArchiveOlderThanDays 7

# Archive all completed tasks
.\scripts\autonomous\cleanup-execution.ps1 -ArchiveAll
```

---

## Integration Points

### With Existing Agent System

```
Orchestrator (gates, safety) - Level 1
    ↓
Lead Agent (multi-phase) - Level 2
    ↓
Subagents (specialized) - Level 3
```

**Responsibilities:**

- **Orchestrator**: Safety gates before execution
- **Lead Agent**: Phase coordination during execution
- **Subagents**: Specialized work within phases

**No conflicts**: Orchestrator approves, Lead coordinates, Subagents execute

---

### With Development Tools

**Code Tools:**

- Glob, Read, Grep (Discovery)
- Read, Edit, Write (Build)
- Bash (Testing, validation)

**Test Tools:**

- `pnpm test` (Frontend tests)
- `pytest` (Backend tests)
- `pnpm type-check` (TypeScript)
- `pnpm lint` (Code quality)

**Git Integration:**

- No automatic commits
- User commits when ready
- Rollback plans provided
- Git-aware (respects .gitignore)

---

## Extensibility

### Adding New Phases

**To add Phase 6 (e.g., Deployment):**

1. Create agent: `.claude/agents/deployer-agent.md`
2. Add to Lead Agent phase list
3. Create handoff schema: `phase-6-deployment.schema.json`
4. Add validation criteria to Validator
5. Update documentation

---

### Adding New Validation Checks

**To add custom validation:**

1. Edit `.claude/agents/validator-agent.md`
2. Add check to phase-specific criteria
3. Implement check logic
4. Update validation report schema (if needed)

---

### Adding New Constraints

**To add forbidden pattern:**

1. Edit `.claude/CLAUDE.md` (add to constraints)
2. Discovery will find it automatically
3. Validator will enforce it
4. No code changes needed

---

## Deployment Considerations

### Requirements

**System:**

- Windows (PowerShell scripts)
- Or: Cross-platform (bash equivalents)

**Development Environment:**

- Git repository
- Node.js + pnpm (frontend)
- Python 3.12+ + uv (backend)
- PostgreSQL 15 (database)

**Disk Space:**

- ~10 MB per active task
- ~100 MB for 10 archived tasks

---

### Installation

```powershell
# Initialize execution system
.\scripts\autonomous\init-execution.ps1

# Verify setup
.\scripts\autonomous\validate-state.ps1

# Ready to use
# /autonomous "your task"
```

---

## Troubleshooting

### Common Issues

**Issue**: "Execution directory not found"
**Solution**: Run `.\scripts\autonomous\init-execution.ps1`

**Issue**: "Task already in progress"
**Solution**: Check with `validate-state.ps1`, resume or cleanup

**Issue**: "Validation keeps failing"
**Solution**: Review validation reports, may need manual intervention

**Issue**: "Agent stuck/no progress"
**Solution**: Check execution log, may need to cancel and resume

---

## Appendix

### File Inventory

**Agent Definitions** (6 files):

- `.claude/agents/lead-agent.md`
- `.claude/agents/discovery-agent.md`
- `.claude/agents/architect-agent.md`
- `.claude/agents/builder-agent.md`
- `.claude/agents/validator-agent.md`
- `.claude/agents/finalizer-agent.md`

**Scripts** (5 files):

- `scripts/autonomous/init-execution.ps1`
- `scripts/autonomous/validate-state.ps1`
- `scripts/autonomous/resume-task.ps1`
- `scripts/autonomous/cleanup-execution.ps1`
- `scripts/autonomous/transition-phase.ps1`

**Schemas** (7 files):

- `.claude/.execution/schemas/task-state.schema.json`
- `.claude/.execution/schemas/handoff.schema.json`
- `.claude/.execution/schemas/validation-report.schema.json`
- `.claude/.execution/schemas/discovery-report.schema.json`
- `.claude/.execution/schemas/architecture-doc.schema.json`
- `.claude/.execution/schemas/build-progress.schema.json`
- `.claude/.execution/schemas/completion-report.schema.json`

**Commands & Skills**:

- `.claude/commands/autonomous.md`
- `.claude/skills/AUTONOMOUS-BUILD.md`

**Documentation** (3 files):

- `docs/specs/AUTONOMOUS-FRAMEWORK-ARCHITECTURE.md` (this file)
- `docs/guides/USING-AUTONOMOUS-MODE.md`
- `.claude/.execution/README.md`

---

**Total Implementation:**

- **18 new files**
- **~8,000 lines of documentation and code**
- **5-phase execution pipeline**
- **6 specialized agents**
- **Complete state management system**
- **Full validation framework**

---

**Created**: February 5, 2026
**Version**: 1.0.0
**Status**: Production Ready
