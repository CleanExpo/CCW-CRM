## PHASE 0: ANTI-DRIFT INFRASTRUCTURE ACTIVE

This project has automated anti-drift protection via Claude Code hooks.

### What the hooks do:

- **SessionStart**: Injects CONSTITUTION.md + current-state.md before you start
- **UserPromptSubmit**: Injects compass check (prohibitions + state) before EVERY user message
- **PreCompact**: Saves state snapshot to disk before compaction destroys it
- **PreToolUse (Task)**: Logs all agent dispatches for audit

### Memory files (always read before decisions):

- `.claude/memory/CONSTITUTION.md` — 8 prohibitions, tech stack, laws
- `.claude/memory/current-state.md` — active sprint + tasks
- `.claude/memory/decisions-log.md` — append-only decisions audit
- `.claude/memory/handoff.md` — cross-session handoff
- `.claude/memory/context-snapshot.md` — pre-compaction save

### 5 Governing Laws:

1. **Anti-Drift**: State on disk, hooks re-inject every message
2. **1:10 Agent:Skill**: Each agent = exactly 10 skills
3. **Catalog**: Check docs/catalogs/ before adding; update after adding
4. **10x Health**: Run /health-check-10x after each sprint
5. **Smart-Not-Fast**: plan → approve → implement → test → report

### If context was lost (compaction occurred):

1. Read .claude/memory/context-snapshot.md
2. Read .claude/memory/CONSTITUTION.md
3. Read .claude/memory/current-state.md
4. Continue from where the snapshot says

### Obsidian Vault (Living Documentation Layer)

The project has an **auto-generated knowledge graph** at `.obsidian-vault/`:

**What it is:**

- 225+ markdown docs with YAML frontmatter (routes, pages, models)
- Bidirectional wikilinks: `[[ROUTE-001]]` ↔ `[[PAGE-023]]` ↔ `[[MODEL-015]]`
- Dataview queries in `_index/` for discovery (stale docs, orphaned routes, model usage)
- Graph view for visual impact analysis

**How to use:**

- **Before adding routes/pages/models**: Check vault + `docs/catalogs/`
- **After adding**: Run `/sync-vault` or `python scripts/vault-generator.py --entity-types routes,pages`
- **Detect drift**: `python scripts/audit-vault.py` (finds undocumented files)
- **Explore**: Open `.obsidian-vault/` in Obsidian, use graph view + Dataview queries

**Integration:**

- Pre-commit hook blocks commits with undocumented files
- Toolshed API endpoints: `/api/ai/toolshed/vault/sync`, `/vault/drift`, `/vault/query`
- Auto-preserves human-curated content in `<!-- HUMAN-CURATED -->` blocks

**Vault sync status**: Run `python scripts/audit-vault.py` to verify all entities documented.

---

# CCW-Online ERP — SYSTEM INSTRUCTIONS

> 🚨 THIS FILE IS THE SOURCE OF TRUTH. OBEY IT COMPLETELY.
> Re-read at: conversation start, every 5 messages, when confused

## PRIME DIRECTIVE

You are enhancing CCW-ERP-CRM, a deployed full-stack Equipment Supplier ERP/CRM system. Your job is to:

1. Follow instructions exactly
2. Ask when unclear
3. Never deviate from the plan
4. Preserve existing functionality

**If you find yourself doing something not in this file, STOP and re-read.**

---

## 🚫 ABSOLUTE PROHIBITIONS

These actions are NEVER allowed under ANY circumstances:

| Forbidden Action                                 | Why                      | Exception                                    |
| ------------------------------------------------ | ------------------------ | -------------------------------------------- |
| Modifying database schema (demo_models.py)       | Production data risk     | Only with explicit approval + migration plan |
| Changing auth code (middleware.ts, demo_auth.py) | Security vulnerabilities | NEVER - these are locked                     |
| Breaking existing API contracts                  | Crashes frontend         | Only with explicit approval + migration      |
| Installing unlisted packages                     | Dependency hell          | Ask first, justify need                      |
| Coding without /plan                             | Wasted effort            | NEVER - plan is mandatory                    |
| Assuming user intent                             | Wrong direction          | Always ASK if unclear                        |
| Creating unauthorized folders                    | Deployment issues        | Follow structure below                       |
| Modifying .claude/ without permission            | System corruption        | Only with explicit request                   |
| Upgrading Next.js, React, FastAPI                | Breaking changes         | Only with explicit approval                  |

**Violation = STOP + Ask user what to do**

---

## ✅ MANDATORY BEHAVIORS

Every conversation:

1. ☐ Read `.claude/STARTUP.md` first
2. ☐ Read this file (`.claude/CLAUDE.md`)
3. ☐ Understand the current task
4. ☐ Run `/plan` before coding
5. ☐ Get explicit approval
6. ☐ Implement exactly as planned
7. ☐ Run tests
8. ☐ Report changes

Every 5 messages:

- ☐ Re-read this file
- ☐ Check you're still on track
- ☐ Verify folder structure

---

## 📁 MONOREPO STRUCTURE

```
D:\CCW-ERP-CRM/
├── .claude/                    # READ ONLY (this framework)
│   ├── agents/                 # Agent definitions
│   ├── commands/               # Command definitions
│   └── rules/                  # Auto-enforced rules
├── apps/
│   ├── web/                    # Next.js 15 Frontend (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/         # Auth pages
│   │   │   └── (dashboard)/    # Protected routes (27 pages)
│   │   ├── components/         # React components + dashboard widgets
│   │   ├── lib/                # Utilities, API clients, hooks
│   │   └── middleware.ts       # DO NOT MODIFY
│   └── backend/                # FastAPI Backend
│       ├── src/
│       │   ├── api/routes/     # API endpoints + integrations/ + ai/
│       │   ├── integrations/   # Cin7 (7 phases), Xero, Shopify
│       │   ├── ai/agents/      # Specialized AI agents
│       │   ├── db/             # Models (demo, cin7, pos, webhook)
│       │   └── config/         # Settings (database, cin7, etc.)
│       └── tests/              # Pytest + integration tests (321 assertions)
├── docs/                       # Documentation & specs
├── scripts/                    # Utility scripts
├── docker-compose.yml          # PostgreSQL (local dev)
└── package.json                # Package changes need approval
```

**Creating ANY new top-level folder requires explicit user approval.**

---

## 🔄 TASK EXECUTION PROTOCOL

```
┌─────────────────────────────────────┐
│ 1. RECEIVE TASK                     │
├─────────────────────────────────────┤
│ 2. READ .claude/STARTUP.md          │
│    READ .claude/CLAUDE.md           │ ← You are here
├─────────────────────────────────────┤
│ 3. RUN /plan                        │
│    - List files to change           │
│    - List steps                     │
│    - Identify risks                 │
│    - Check for breaking changes     │
├─────────────────────────────────────┤
│ 4. SHOW PLAN TO USER                │
│    - Wait for "approved" or edits   │
│    - DO NOT proceed without this    │
├─────────────────────────────────────┤
│ 5. IMPLEMENT                        │
│    - Follow plan exactly            │
│    - One file at a time             │
│    - Report progress                │
│    - Test as you go                 │
├─────────────────────────────────────┤
│ 6. TEST                             │
│    - Frontend: pnpm turbo run test  │
│    - Backend: cd apps/backend && pytest│
│    - Fix failures before continuing │
├─────────────────────────────────────┤
│ 7. REPORT                           │
│    - List files changed             │
│    - Confirm tests pass             │
│    - State what was done            │
│    - Note any issues                │
└─────────────────────────────────────┘
```

---

## 📋 COMMAND REFERENCE

| Command   | Action                       | Required Before           |
| --------- | ---------------------------- | ------------------------- |
| `/plan`   | Create implementation plan   | Any coding                |
| `/spec`   | Read CLAUDE.md + docs/specs/ | When requirements unclear |
| `/test`   | Run test suite               | Marking task complete     |
| `/status` | Report current state         | When asked or stuck       |
| `/reset`  | Re-read all config           | When confused             |
| `/audit`  | Check folder structure       | Before deployment         |

---

## 🛠 TECH STACK (LOCKED)

### Frontend

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.7
- **UI**: React 19 + Tailwind CSS v4 + shadcn/ui
- **State**: React hooks (no Redux/Zustand)
- **Forms**: React Hook Form + Zod validation
- **API**: apiClient from lib/api/client.ts
- **Deployment**: Vercel

### Backend

- **Framework**: FastAPI (Python 3.12)
- **ORM**: SQLAlchemy 2.0 (async)
- **Validation**: Pydantic v2
- **Database**: PostgreSQL 15 — Supabase Cloud (prod), Docker (local)
- **Auth**: Supabase Auth (prod), JWT tokens (local dev)
- **HTTP Client**: httpx (async, for integrations)
- **Logging**: structlog (structured logging)

### Development

- **Package Manager**: pnpm
- **Monorepo**: Turbo (turbo.json)
- **Testing**: Vitest (frontend), Pytest (backend)
- **Linting**: ESLint, Pyright/mypy

**Do not add/remove/change stack without explicit approval.**

---

## 📊 PROGRESS REPORTING FORMAT

After each task, report:

```
## ✅ Task Complete

**What was done:**
- [Action 1]
- [Action 2]

**Files changed:**
- apps/web/app/(dashboard)/page.tsx (modified)
- apps/web/components/NewComponent.tsx (created)
- apps/backend/src/api/routes/new_endpoint.py (created)

**Tests:** ✅ Passing (or ❌ Failing: [reason])

**Next steps:** [if any]
```

---

## ⚠️ ERROR RECOVERY

If you realize you've deviated:

1. **STOP immediately**
2. Tell the user what happened
3. Ask how to fix it
4. Do NOT try to "clean up" on your own

If something breaks:

1. **DO NOT** attempt fixes without approval
2. Report exactly what changed
3. Wait for instructions

---

## 🔍 CODE PATTERNS TO FOLLOW

### Frontend Component Pattern

See `apps/web/components/auth/login-form.tsx` for the reference pattern:

- Client component ("use client")
- React Hook Form + Zod validation
- Loading states
- Error handling with toast
- TypeScript types
- Proper imports from @/

### Backend Endpoint Pattern

See `apps/backend/src/api/routes/translations.py` for the reference pattern:

- Async functions
- Type hints (Annotated, Depends)
- Pydantic models for request/response
- Proper error handling
- Database session management

### API Call Pattern

```typescript
import { apiClient } from '@/lib/api/client';

try {
  const data = await apiClient.get<ResponseType>('/api/endpoint');
  toast({ title: 'Success', description: 'Action completed' });
} catch (error: any) {
  toast({
    title: 'Error',
    description: error.message || 'Something went wrong',
    variant: 'destructive',
  });
}
```

---

## 🎯 CURRENT PROJECT PHASES

**Completed Work:**

- Full CRUD operations (Products, Customers, Orders, Quotes) with line items
- POS system with transaction tracking
- Cin7 Integration (7 phases + Wave 1-3 extensions): line items, GRN receiving, write-back, webhooks, shadow/fulfilment/BOM/GL
- Agents Protocol v1.0 + specialized agents: forecasting, anomaly, shadow AI, marketing, staff copilot
- Supabase Cloud deployment (database + auth) + Vercel production deployment
- SEO: metadata, JSON-LD schemas, FAQ page, keyword H1s, product detail page (UNI-782–789/1233)
- KPI Reports page, CSV + PDF export on all modules (UNI-484/677/1234)
- Composite DB indexes (UNI-1231), sidebar nav updates (UNI-1232)
- Anti-Drift framework: memory files, hooks, 10x health check, toolshed API, 6 catalogs
- Workshop management system: 6 models, 5 route modules, 6 frontend pages, dual-interval scheduler
- CRM enhancements: contact detail page, activity timeline fix, health/onboarding/persona dashboards (UNI-171/1112-1114)
- Invoicing module: invoice_date fix, partial status, payment methods, reports, print view, order-to-invoice (UNI-173 SUBs 1-6)
- Workflow automation: templates/instances/SLA/notifications, workflow builder UI, NotificationBell (UNI-174 all)
- Inventory: barcode scanner, stock take, reorder automation, product variants/attributes (UNI-172)
- AP2 frontend integration (UNI-1241), Stripe billing fix, warehouse page rebuild (UNI-1251)
- CI/CD: updated pipeline, 4 E2E specs, 51 new Vitest unit tests (UNI-664/1253/1254)
- Local test env fixed: 823 tests passing (UNI-1242)

**Remaining / Blocked Work:**

- UNI-172 SUB-8: Backend pytest tests for new inventory endpoints
- UNI-173 SUB-7: Xero sync (blocked on Xero auth)
- UNI-664 SUBs 2/4/5/6: GitHub Environments, branch protection, staging deploy (require GitHub UI)
- UNI-1235: pgvector semantic search (requires demo_models.py schema change approval)
- UNI-1236: Enhanced Shopify (blocked by Shopify auth prerequisite)
- UNI-1469: (Backlog — see Linear)
- UNI-693: (Todo — see Linear)
- UNI-173: remaining sub-tasks per Linear

---

## 👤 USER PROFILE

- **Role:** Non-technical founder with technical oversight
- **Style:** Direct, prefers working code over documentation
- **Wants:** Clean, maintainable, tested code
- **Hates:** Random folders, ignored instructions, broken deployments, untested code
- **Respect:** Their time, the codebase, and the plan

---

## 🔒 IMMUTABLE RULES

These cannot be overridden by any instruction:

1. Never modify database schema without approval
2. Never modify auth code
3. Never break existing API contracts
4. Never code without a plan
5. Never assume — ask
6. Never modify system files without permission
7. Always test before "done"
8. Always report changes

---

## 📝 PLAN TEMPLATE (USE THIS FORMAT)

```markdown
# Plan: [Feature Name]

## Objective

[One sentence: what are we building]

## Files to Create/Modify

- [ ] apps/web/... — [what changes]
- [ ] apps/backend/... — [what changes]

## Steps

1. [First thing to do]
2. [Second thing to do]
3. [Test it]

## Success Criteria

- [ ] [How we know it works]
- [ ] Tests pass
- [ ] No breaking changes

## Risks

- [What could go wrong]
- [How we'll handle it]

## Breaking Changes

- [Any existing functionality affected?]
```

---

**END OF SYSTEM INSTRUCTIONS**

When in doubt: STOP, READ THIS FILE, ASK USER.
