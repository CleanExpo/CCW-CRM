# CCW-Online-ERP Development Guide

**Tech Stack**: Next.js 15 + FastAPI + PostgreSQL
**Status**: Working MVP - Adding full CRUD operations

---

## Quick Reference

### Essential Documentation
- **Database Schema**: [SCHEMA.md](SCHEMA.md) - Tables, relationships, enums
- **Code Patterns**: [PATTERNS.md](PATTERNS.md) - Forms, API calls, endpoints
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - If-Then rules
- **Rule Updates**: [CLAUDE_UPDATES.md](CLAUDE_UPDATES.md) - Self-evolution protocol

### Key File Locations
- Frontend: `apps/web/app/(dashboard)/[module]/`
- Components: `apps/web/components/ui/` (shadcn/ui)
- API Client: `apps/web/lib/api/client.ts`
- Backend Routes: `apps/backend/src/api/routes/`
- Database Models: `apps/backend/src/db/erp_models.py`

---

## 🚨 CRITICAL BUSINESS RULES

### NEVER Modify These (Breaking Changes)

1. **Database Schema** (`apps/backend/src/db/erp_models.py`)
   - ❌ No column/table/enum changes
   - ❌ No foreign key relationship changes
   - ❌ No index or constraint modifications
   - **Why**: Can corrupt production data, break API contracts
   - **Exception**: Only with explicit user approval + migration strategy

2. **Authentication & Security**
   - ❌ No changes to `apps/web/middleware.ts` (JWT auth)
   - ❌ No changes to `apps/backend/src/api/routes/demo_auth.py`
   - ❌ No password hashing or token logic changes
   - **Why**: Security-critical, can expose vulnerabilities

3. **API Contracts** (Existing Endpoints)
   - ❌ No breaking response structure changes
   - ❌ No route renaming (e.g., `/api/products` → `/api/items`)
   - ❌ No required parameter changes
   - ✅ CAN add optional parameters or new fields
   - ✅ CAN create entirely new endpoints
   - **Why**: Frontend depends on specific contracts

4. **Dependencies**
   - ❌ No major framework upgrades without approval
   - ❌ No large dependencies (>5MB) without justification
   - **Why**: Can introduce breaking changes, slow builds

---

### ALWAYS Do These (Required Actions)

1. **After Mutations**: Call `router.refresh()` to update server components
   ```typescript
   await apiClient.post("/api/products", data);
   router.refresh(); // ← REQUIRED
   ```

2. **Delete Actions**: Wrap in AlertDialog for confirmation
   - See [PATTERNS.md](PATTERNS.md#delete-confirmation-pattern)

3. **Form Submissions**:
   - Set `isLoading` state
   - Disable button during submission
   - Show toast on success/error

4. **Sequential Numbers** (order_number, quote_number):
   - Use MAX approach, NOT COUNT
   - See [SCHEMA.md](SCHEMA.md#generate-sequential-number)

5. **Before Task Complete**: All checks MUST pass
   ```bash
   pnpm turbo run type-check lint test
   ```

---

## Development Workflow (If-Then Rules)

### Common Scenarios

**IF creating a form** → See [PATTERNS.md#frontend-form-component-pattern](PATTERNS.md#frontend-form-component-pattern)

**IF making API call** → Use `apiClient` from [PATTERNS.md#api-client-usage-patterns](PATTERNS.md#api-client-usage-patterns)

**IF creating backend endpoint** → See [PATTERNS.md#backend-endpoint-patterns](PATTERNS.md#backend-endpoint-patterns)

**IF data doesn't refresh** → Add `router.refresh()` ([TROUBLESHOOTING.md#data-refresh-issues](TROUBLESHOOTING.md#data-refresh-issues))

**IF styling looks wrong** → Use design tokens, not hardcoded colors ([TROUBLESHOOTING.md#styling-issues](TROUBLESHOOTING.md#styling-issues))

**IF validation error** → Check Zod schema matches field types ([TROUBLESHOOTING.md#form-issues](TROUBLESHOOTING.md#form-issues))

**IF foreign key error** → Verify referenced record exists ([TROUBLESHOOTING.md#database-issues](TROUBLESHOOTING.md#database-issues))

**IF unique constraint error** → Check for duplicates, use MAX for sequences ([TROUBLESHOOTING.md#database-issues](TROUBLESHOOTING.md#database-issues))

---

## Self-Evolution Protocol

### When You Detect Recurring Patterns (3+ Times)

1. **DO NOT** modify CLAUDE.md directly
2. **DO** add proposal to [CLAUDE_UPDATES.md](CLAUDE_UPDATES.md) using template
3. **Include**:
   - 3+ documented occurrences with dates
   - Exact error messages and context
   - Proposed rule text (ready to copy-paste)
   - Expected impact (positive/negative)
4. **Wait** for user approval before implementing

**Example Triggers**:
- Same error 3+ times despite documentation
- Gap in rules causing repeated mistakes
- New pattern emerging in codebase

**DO NOT propose** for:
- One-off issues
- Generic best practices (already known)
- User-specific problems
- External factors (API changes, bugs)

---

## Component Conventions

### Frontend (Next.js 15 + React 19)
- Server Components by default
- Add `"use client"` only when needed (useState, useEffect, event handlers)
- Use shadcn/ui components from `@/components/ui/`
- Import with `@/` prefix: `import { Button } from "@/components/ui/button"`
- Design tokens: `bg-primary`, `text-muted-foreground` (NOT hardcoded colors)
- Tailwind spacing: Use scale (4, 6, 8, 12) not arbitrary values

### Backend (FastAPI)
- Async/await everywhere
- Use Pydantic for validation (`ProductCreate`, `ProductUpdate`)
- SQLAlchemy async session: `get_db` dependency
- Return proper status codes (201 create, 200 get/update, 204 delete)
- Raise HTTPException with user-friendly messages

---

## Database Query Rules

### Pagination Pattern
```python
# 1. Build query with filters
query = select(Model).where(filters)

# 2. Get total count
count_query = select(func.count()).select_from(query.subquery())
total = (await db.execute(count_query)).scalar_one()

# 3. Apply pagination
query = query.limit(page_size).offset((page - 1) * page_size)

# 4. Execute and return
items = (await db.execute(query)).scalars().all()
```

### Eager Loading (Avoid N+1)
```python
query = select(Order).options(
    selectinload(Order.items),      # Load all order items
    joinedload(Order.customer),     # Load customer (1:1)
)
```

### Sequential Number Generation
```python
# ✅ CORRECT: Use MAX (handles gaps)
query = select(func.max(Order.order_number)).where(
    Order.order_number.like(f"ORD-{year}-%")
)
max_number = (await db.execute(query)).scalar_one_or_none()
next_number = int(max_number.split("-")[-1]) + 1 if max_number else 1

# ❌ WRONG: COUNT doesn't handle deleted records
```

---

## Testing Requirements

**Before marking complete**, verify:

```bash
# All must pass:
pnpm turbo run type-check    # No TypeScript errors
pnpm turbo run lint          # No ESLint errors
pnpm turbo run test          # All tests passing
```

**Manual Testing Checklist**:
- [ ] Loading states work
- [ ] Success/error toasts show
- [ ] Delete confirmations prevent accidents
- [ ] Data refreshes after mutations
- [ ] Validation errors display properly
- [ ] Mobile responsive
- [ ] Dark mode works

---

## Environment Setup

### Start Services
```bash
docker compose up -d                    # PostgreSQL
pnpm dev                                # All services (or use separate commands)
```

### Login Credentials
- admin@demo.com / demo123
- sales@demo.com / demo123
- warehouse@demo.com / demo123

---

## Success Criteria

**Task complete when**:
1. Full CRUD operations work (create, read, update, delete)
2. All delete actions have confirmations
3. All forms have loading/error states
4. All pages have empty states
5. Type-check + lint + tests pass
6. Manual testing verified
7. Data refreshes after mutations

**Focus**: Working MVP with good UX and code quality. Not perfection.

---

## When to Ask for Help

**Stop and ask user if**:
- Schema changes needed
- Authentication/security changes needed
- Breaking API changes needed
- Major dependency upgrades needed
- Can't resolve error after checking [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

*Version: 2.0 (Refactored January 14, 2026)*
*Previous version backed up to: CLAUDE.md.backup-2026-01-14*
