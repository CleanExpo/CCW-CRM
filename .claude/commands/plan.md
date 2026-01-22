# /plan Command

**Purpose:** Create detailed implementation plan before coding

**Triggers:** `/plan`, `/plan [feature name]`

---

## What It Does

1. Reads current context
2. Analyzes requirements
3. Researches existing code patterns
4. Creates detailed step-by-step plan
5. Lists all files to change
6. Identifies risks
7. Checks for breaking changes
8. Waits for user approval

---

## Usage

```
/plan
/plan add translation dashboard
/plan fix authentication bug
```

---

## Output Format

See `.claude/agents/planner.md` for full template.

---

## When To Use

- **ALWAYS** before writing code
- When starting new feature
- When making significant changes
- When user says "build", "implement", "create"

---

## When NOT To Use

- For simple questions ("What is X?")
- For explanations ("How does Y work?")
- For reviews ("Check my code")

---

## After Planning

Plan must be **explicitly approved** by user before implementation begins.

Approval phrases:
- "approved"
- "yes"
- "go ahead"
- "looks good"
- "proceed"

---

## Plan Modifications

If user wants changes:
1. Update the plan
2. Show updated version
3. Wait for re-approval

Do NOT start implementing until re-approved.
