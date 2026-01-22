# CCW-Online ERP — SYSTEM INSTRUCTIONS

> 🚨 THIS FILE IS THE SOURCE OF TRUTH. OBEY IT COMPLETELY.
> Re-read at: conversation start, every 5 messages, when confused

## PRIME DIRECTIVE

You are enhancing CCW-Online ERP, a full-stack Equipment Supplier ERP system. Your job is to:
1. Follow instructions exactly
2. Ask when unclear
3. Never deviate from the plan
4. Preserve existing functionality

**If you find yourself doing something not in this file, STOP and re-read.**

---

## 🚫 ABSOLUTE PROHIBITIONS

These actions are NEVER allowed under ANY circumstances:

| Forbidden Action | Why | Exception |
|-----------------|-----|-----------|
| Modifying database schema (demo_models.py) | Production data risk | Only with explicit approval + migration plan |
| Changing auth code (middleware.ts, demo_auth.py) | Security vulnerabilities | NEVER - these are locked |
| Breaking existing API contracts | Crashes frontend | Only with explicit approval + migration |
| Installing unlisted packages | Dependency hell | Ask first, justify need |
| Coding without /plan | Wasted effort | NEVER - plan is mandatory |
| Assuming user intent | Wrong direction | Always ASK if unclear |
| Creating unauthorized folders | Deployment issues | Follow structure below |
| Modifying .claude/ without permission | System corruption | Only with explicit request |
| Upgrading Next.js, React, FastAPI | Breaking changes | Only with explicit approval |

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
C:\CCW-Online-ERP/
├── .claude/                    # ⛔ READ ONLY (this framework)
│   ├── agents/                 # Agent definitions
│   ├── skills/                 # Skill definitions
│   ├── commands/               # Command definitions
│   └── hooks/                  # Git hooks
├── apps/
│   ├── web/                    # ✅ Next.js 15 Frontend
│   │   ├── app/
│   │   │   ├── (auth)/         # Auth pages
│   │   │   └── (dashboard)/    # Protected routes
│   │   ├── components/         # ✅ React components
│   │   ├── lib/                # ✅ Utilities
│   │   └── middleware.ts       # ⛔ DO NOT MODIFY
│   └── backend/                # ✅ FastAPI Backend
│       ├── src/
│       │   ├── api/routes/     # ✅ API endpoints
│       │   ├── db/
│       │   │   └── demo_models.py  # ⛔ DO NOT MODIFY
│       │   └── services/       # ✅ Business logic
│       └── tests/              # ✅ Pytest tests
├── docs/                       # ✅ Documentation
│   └── specs/                  # Project specifications
├── scripts/                    # ✅ Utility scripts
├── docker-compose.yml          # ✅ PostgreSQL + services
└── package.json                # ⛔ Package changes need approval
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

| Command | Action | Required Before |
|---------|--------|-----------------|
| `/plan` | Create implementation plan | Any coding |
| `/spec` | Read CLAUDE.md + docs/specs/ | When requirements unclear |
| `/test` | Run test suite | Marking task complete |
| `/status` | Report current state | When asked or stuck |
| `/reset` | Re-read all config | When confused |
| `/audit` | Check folder structure | Before deployment |

---

## 🛠 TECH STACK (LOCKED)

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.7
- **UI**: React 19 + Tailwind CSS v4 + shadcn/ui
- **State**: React hooks (no Redux/Zustand)
- **Forms**: React Hook Form + Zod validation
- **API**: apiClient from lib/api/client.ts
- **i18n**: next-intl v3.26.5 (cookie-based)

### Backend
- **Framework**: FastAPI (Python 3.12)
- **ORM**: SQLAlchemy 2.0 (async)
- **Validation**: Pydantic v2
- **Database**: PostgreSQL 15 (Docker)
- **Auth**: JWT tokens (passlib/bcrypt)
- **AI**: Ollama client (for translations)

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
import { apiClient } from "@/lib/api/client";

try {
  const data = await apiClient.get<ResponseType>("/api/endpoint");
  toast({ title: "Success", description: "Action completed" });
} catch (error: any) {
  toast({
    title: "Error",
    description: error.message || "Something went wrong",
    variant: "destructive",
  });
}
```

---

## 🎯 CURRENT PROJECT PHASES

**Phase 1: Multi-Language Foundation (i18n)** - ✅ COMPLETE
- Database schema with 6 tables
- AI-powered translation service
- Translation Management Dashboard
- 10 languages supported
- Cookie-based language switcher

**Phase 2: Google AP2 Integration** - PENDING
- Payment processing with mandate verification
- Voice commerce integration
- Agent-to-agent commerce

**Phase 3: Enhanced Shopify Backend** - PENDING
- Custom metafields
- Real-time inventory sync
- Multi-language product sync

**Phase 4: AI-Powered Search & Recommendations** - PENDING ⭐ Recommended next
- Semantic/vector search (pgvector)
- AI product recommendations
- Voice search optimization

**Phase 5: Autonomous Development Framework** - PENDING
- Self-sustaining development system
- AI agents plan, code, test, deploy

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
