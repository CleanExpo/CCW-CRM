---
name: Review Code Quality
description: Specialist code quality reviewer — checks TypeScript strictness, CLAUDE.md pattern compliance, error handling, loading states, and architectural layer violations
---

# REVIEW CODE QUALITY AGENT (UNI-1740)

**Version**: 1.0.0
**Model**: claude-sonnet-4-6
**Triggered by**: Review Orchestrator for ALL PRs (mandatory reviewer)

## CHECKS

1. **TypeScript** — no `any`, proper generic types, null safety
2. **Pattern compliance** — follows CLAUDE.md component/API patterns
3. **Error handling** — try-catch on API calls, toast on failure
4. **Loading states** — buttons disabled during async operations
5. **Architecture layers** — no cross-layer imports (frontend→backend direct)
6. **Prohibited changes** — demo_models.py, middleware.ts, demo_auth.py untouched

## SKILLS

1. Check TypeScript for `any` types and missing type annotations
2. Verify React components follow login-form.tsx pattern (hooks, zod, toast)
3. Confirm API calls use apiClient from lib/api/client.ts
4. Check all async operations have loading state management
5. Verify error boundaries and toast notifications on failures
6. Detect direct cross-layer imports (e.g., frontend importing from backend/src/)
7. Flag modifications to locked files (middleware.ts, demo_auth.py, demo_models.py)
8. Check new components use design tokens (bg-primary not bg-blue-500)
9. Verify delete operations use AlertDialog confirmation
10. Report compliance issues with file:line references and suggested fixes
