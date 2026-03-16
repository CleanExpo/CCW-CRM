# /toolshed — Assemble Task Context Bundle

**Usage**: `/toolshed <task description>`

**Purpose**: Implements the Stripe Minions "context assembly before reasoning" principle.
Run this BEFORE any `/plan` command to inject codebase-specific context.

---

## What This Command Does

1. Calls `POST /api/ai/toolshed/bundle` with your task description
2. Extracts keywords and filters all 6 catalogs for relevant entries
3. Fetches applicable code patterns for the task type
4. Returns a structured preamble with constraints and suggested implementation path

**Agents must run this before any planning step.**

---

## Step-by-Step Execution

### Step 1: Call the Bundle Endpoint

```bash
curl -X POST http://localhost:8000/api/ai/toolshed/bundle \
  -H "Content-Type: application/json" \
  -d '{"task": "<TASK_DESCRIPTION>", "include_patterns": true}'
```

### Step 2: Also Run a Search Check

Before planning, verify the thing you are about to add does not already exist:

```bash
curl "http://localhost:8000/api/ai/toolshed/search?q=<main_keyword>"
```

### Step 3: Fetch Relevant Patterns

For each pattern type listed in the bundle `patterns` field:

```bash
curl "http://localhost:8000/api/ai/toolshed/pattern?type=endpoint"
curl "http://localhost:8000/api/ai/toolshed/pattern?type=component"
```

### Step 4: Output the Formatted Preamble

Format and display the bundle as:

```
## Toolshed Context Bundle
**Task**: <task description>
**Keywords**: <extracted keywords>

### Already Exists (check before adding)
<relevant routes / pages / agents / models from catalogs>

### Applicable Patterns
<pattern types and canonical code snippets>

### Constraints (from CONSTITUTION)
<active constraints list>

### Suggested Implementation Path
<sequence from suggested_path field>
```

---

## Example

**User**: `/toolshed add warehouse location tracking to inventory`

**Expected Output**:

```
## Toolshed Context Bundle
Task: add warehouse location tracking to inventory
Keywords: warehouse, location, tracking, inventory

### Already Exists
Routes: GET /api/inventory, POST /api/inventory/transfer
Pages: /inventory (Inventory Management page)
Models: InventoryLocation (in db/cin7_models.py)

### Applicable Patterns
- endpoint (backend route needed)
- component (frontend UI needed)

### Constraints
- NEVER modify demo_models.py
- Check catalogs before adding
- No new packages without approval

### Suggested Path
Backend-first: create route → register in main.py → frontend API client → page
```

---

## When to Use

**MANDATORY before**:

- Any `/plan` command for a new feature
- Adding any new route, page, agent, model, or package
- Starting any multi-file implementation

**Optional but recommended**:

- Bug investigations (to find where related code lives)
- Before refactoring (to understand scope of impact)

---

## Toolshed Law (9th Governing Law)

> Run `/toolshed <task>` before planning any new feature.
> Context assembly precedes reasoning.

Violations of this law result in agents planning without codebase context,
leading to duplicate routes, wrong patterns, and unnecessary rework.

---

## Related Commands

- `/quality-gate` — Run AFTER implementation to verify correctness
- `/plan` — Run AFTER toolshed to create implementation plan
- `/pi-scan-routes` — Full route scan (heavier, for audits)
- `/pi-cross-ref` — Cross-reference routes with pages (full analysis)
