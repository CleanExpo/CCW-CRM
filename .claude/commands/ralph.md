# Ralph Command

Run the Ralph Wiggum technique for autonomous task completion.

## Usage

```
/ralph [init|run] [max_iterations]
```

## Arguments

- `init` — Initialise the `plans/` directory with PRD template and progress file
- `run` — Run the autonomous loop (default if no argument)
- `max_iterations` — Maximum loop iterations (default: 1000)

## What This Does

The Ralph Wiggum technique runs Claude Code in a loop:

1. **Read PRD**: Load `plans/prd.json` for user stories with `passes: false`
2. **Find Task**: Select highest priority unpassed task (respecting dependencies)
3. **Load Context**: Read `plans/progress.txt` for learnings from previous iterations
4. **Work**: Implement the task according to acceptance criteria
5. **Verify**: Run full pipeline (type-check, lint, test, build, e2e)
6. **Update State**:
   - If PASS: Set `passes: true` in PRD, commit changes
   - If FAIL: Increment `attempt_count`, record learnings
7. **Loop**: Continue until all tasks pass or max iterations reached

## Initialisation

Before running, initialise the plans directory:

```
/ralph init
```

This creates:

- `plans/prd.json` — Task list template
- `plans/progress.txt` — LLM memory file
- `plans/ralph-prompt.md` — Iteration prompt template

## PRD Format

Edit `plans/prd.json` with your user stories:

```json
{
  "user_stories": [
    {
      "id": "US-001",
      "title": "User can complete checkout flow",
      "priority": "critical",
      "acceptance_criteria": [
        "Form validates all required fields",
        "Payment integration works",
        "Confirmation email sent"
      ],
      "passes": false,
      "attempt_count": 0,
      "depends_on": []
    }
  ]
}
```

### Priority Levels

Order of execution: `critical` > `high` > `medium` > `low`

### Dependencies

Tasks wait for dependencies to pass:

```json
{
  "id": "US-002",
  "depends_on": ["US-001"]
}
```

## Verification Pipeline (CCW Stack)

ALL must pass before marking `passes: true`:

```bash
pnpm turbo run type-check  # TypeScript compilation
pnpm turbo run lint        # ESLint + Ruff
pnpm turbo run test        # Vitest + Pytest unit tests
pnpm turbo run build       # Production build
```

## Execution Steps

When you run `/ralph run`:

### Step 1: Check Prerequisites

- `plans/prd.json` exists
- `plans/progress.txt` exists (creates if missing)

### Step 2: Find Next Task

Select task where:

- `passes === false`
- All `depends_on` tasks have `passes === true`
- Highest priority wins

### Step 3: Load Context

Read both files:

- `plans/prd.json` — Full task details
- `plans/progress.txt` — Previous learnings

### Step 4: Work on Task

For the selected task:

1. Read acceptance criteria
2. Check progress for relevant learnings
3. Implement feature/fix
4. Write/update tests
5. Follow CONSTITUTION.md prohibitions (no demo_models.py, no auth changes)

### Step 5: Verify

Run full verification pipeline. ALL must pass.

### Step 6: Update State

If passed:

- Update PRD: `passes: true`
- Git commit with conventional format
- Append success to progress.txt

If failed:

- Update PRD: increment `attempt_count`
- Append learnings to progress.txt
- Continue to next iteration

### Step 7: Loop or Exit

Continue until:

- All tasks pass
- Max iterations reached
- Manual stop

**Autonomous self-resume:** If iteration completes but open tickets remain in the Linear queue, invoke `ScheduleWakeup` with the same `/ralph run` prompt so the loop continues after any natural pause. The session stays alive until the queue is empty.

## Escalation

If `attempt_count >= 3` on any task:

- Stop working on that task
- Record blocker in progress.txt
- Move to next available task automatically
- Log for later human review (do not halt the loop)

## Best Practices

1. **Small tasks** — Keep user stories focused (1-2 hour scope)
2. **Specific criteria** — Vague acceptance = incomplete implementations
3. **Use dependencies** — Order tasks logically
4. **Read progress** — Learn from past iterations
5. **Commit often** — Each success = checkpoint
6. **Respect CONSTITUTION** — Check prohibitions before every change

## Stopping the Loop

The loop stops when:

- All tasks have `passes: true`
- Max iterations reached (default 1000)
- Ctrl+C / manual interruption

Blocked dependencies no longer halt the loop — blockers are logged and the next available task is picked.
