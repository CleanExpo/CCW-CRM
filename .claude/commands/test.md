# /test Command

**Purpose:** Run test suites and validate code quality

**Triggers:** `/test`, `/test [scope]`

---

## What It Does

Runs appropriate test suite based on scope:

### `/test` (all)
```bash
# Frontend tests
cd C:\CCW-Online ERP && pnpm turbo run test

# Backend tests
cd C:\CCW-Online ERP\apps\backend && pytest

# Type check
cd C:\CCW-Online ERP && pnpm turbo run type-check

# Lint
cd C:\CCW-Online ERP && pnpm turbo run lint
```

### `/test frontend`
```bash
cd C:\CCW-Online ERP && pnpm turbo run test --filter=web
```

### `/test backend`
```bash
cd C:\CCW-Online ERP\apps\backend && pytest
```

### `/test unit`
```bash
cd C:\CCW-Online ERP\apps\backend && pytest tests/unit
```

### `/test e2e`
```bash
cd C:\CCW-Online ERP\apps\web && pnpm test:e2e
```

---

## When To Use

- **ALWAYS** before saying "done"
- After each file modified
- Before committing
- Before creating PR
- When asked to verify code

---

## Expected Output

```
✅ All Tests Passing

Frontend: 42/42 tests passed
Backend: 38/38 tests passed
Type check: PASS
Lint: PASS

Ready for deployment.
```

```
❌ Tests Failing

Frontend: 40/42 tests passed (2 failed)
- MyComponent.test.tsx: Failed assertion on line 45
- AnotherTest.test.tsx: Timeout waiting for element

Backend: 38/38 tests passed
Type check: PASS
Lint: 3 errors

Action required: Fix failing tests before proceeding.
```

---

## Failure Protocol

If tests fail:
1. **STOP** - do not mark task complete
2. **READ** error messages carefully
3. **FIX** the issues
4. **RE-RUN** tests
5. **REPEAT** until all pass

Do NOT:
- Skip tests
- Ignore failures
- Mark task done with failing tests
- Assume tests are wrong

---

## Performance Tests

```bash
# Backend load tests
cd C:\CCW-Online ERP\apps\backend && pytest tests/load/

# Frontend performance
cd C:\CCW-Online ERP\apps\web && pnpm test:perf
```

---

## Coverage

```bash
# Check test coverage
cd C:\CCW-Online ERP && pnpm turbo run test:coverage
```

Target coverage: 80%+ for critical paths

---

## Related

- `.claude/agents/coder.md` - Testing requirements
- `.claude/agents/reviewer.md` - Test review checklist
