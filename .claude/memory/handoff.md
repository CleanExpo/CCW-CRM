# Session Handoff Template

## How to Use

At the end of each session, write the following information to this file.
The next session will read this before starting any work.

---

## Last Session: [DATE]

### What Was Completed:

- [Task 1 completed]
- [Task 2 completed]

### What Is In Progress (DO NOT lose this context):

- [Task in progress]: [exact state — e.g., "halfway through creating X, stopped at step 3"]

### Next Session Should Start With:

1. [First thing to do]
2. [Second thing to do]

### Blockers:

- [Any blocking issues the next session needs to resolve]

### Files Changed This Session:

- [file path]: [what was changed]

### Critical Warnings for Next Session:

- [Any gotchas, problems encountered, things to avoid]

---

## CURRENT HANDOFF (2026-03-03):

### What Was Completed:

- Sprint 0 anti-drift infrastructure (memory files, hooks, settings)
- Claude commands: health-check-10x + 10 pi-\* skills
- Project Intelligence Agent (agent.md + backend Python)
- 6 catalog files populated (docs/catalogs/)
- Backend PI agent registered in main.py
- Gap fixes: contractors, service-requests, bank-feeds frontend pages

### What Is In Progress:

- Sprint 1: PI agent testing and validation
- Sprint 4: Agent 1:10 compliance (E3-1 through E3-8)

### Next Session Should Start With:

1. Read .claude/memory/CONSTITUTION.md
2. Read .claude/memory/current-state.md
3. Run /pi-scan-routes to validate catalog freshness
4. Run /health-check-10x to get baseline

### Blockers:

- UNI-1235 (Search Agent): Blocked pending pgvector schema approval
- UNI-1236 (Enhanced Shopify): Blocked by Shopify auth prerequisite

### Critical Warnings:

- NEVER modify demo_models.py without explicit approval
- NEVER modify middleware.ts or demo_auth.py
- catalogs in docs/catalogs/ need manual updates when routes/pages change
