# Testing

## Quick Reference

```bash
# All tests (monorepo)
pnpm turbo run test

# Frontend only
cd apps/web && npx vitest run

# Frontend single file
cd apps/web && npx vitest run path/to/file.test.ts

# Frontend with coverage
cd apps/web && npx vitest run --coverage

# Backend only
cd apps/backend && uv run pytest

# Backend single file
cd apps/backend && uv run pytest tests/path/to/test_file.py -v

# Backend integration tests (321 assertions)
cd apps/backend && uv run pytest tests/integration/ -v

# Type check (always run)
pnpm turbo run type-check

# Lint
pnpm turbo run lint

# All quality checks
pnpm turbo run type-check lint test
```

## Before You Say You're Done

1. `pnpm turbo run type-check` — zero TypeScript errors
2. `pnpm turbo run test` — all tests pass
3. If you changed backend code: `cd apps/backend && uv run pytest`
4. If you changed frontend code: `cd apps/web && npx vitest run`
5. If you changed API contracts: verify both frontend and backend tests pass
6. If you changed database-adjacent code: run integration tests
7. Report changes using the progress format in PROGRESS.md

## Test Data

### Frontend

Tests use Vitest with React Testing Library. Mock API calls via `vi.mock('@/lib/api/client')`.
Test files go next to source: `ComponentName.test.tsx` or in `__tests__/`.

### Backend

Tests use Pytest with async support. Database tests use a test database (Docker-based).
Test files: `apps/backend/tests/` mirroring `src/` structure.

Login credentials (local dev only):

- `admin@demo.com` / `demo123`
- `sales@demo.com` / `demo123`
- `warehouse@demo.com` / `demo123`

## Mocking Conventions

### Frontend

```typescript
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
```

### Backend

```python
# Use pytest fixtures for DB sessions
@pytest.fixture
async def db_session():
    async with async_session() as session:
        yield session

# Mock external APIs (Cin7, Xero) with httpx mock
from pytest_httpx import HTTPXMock
```

## Regression Areas

After changes to these areas, run the corresponding tests:

| Area             | Test Command                                              |
| ---------------- | --------------------------------------------------------- |
| Auth/Login       | `cd apps/backend && uv run pytest tests/ -k "auth"`       |
| Products CRUD    | `cd apps/web && npx vitest run --reporter=verbose`        |
| Cin7 Integration | `cd apps/backend && uv run pytest tests/integration/ -v`  |
| Order workflow   | `cd apps/backend && uv run pytest tests/ -k "order"`      |
| Remotion scenes  | `cd video/remotion && npx tsc --noEmit` (type-check only) |

## E2E Tests

4 Playwright specs exist in `apps/web/e2e/`. Run with:

```bash
cd apps/web && npx playwright test
```

Requires the dev server running (`pnpm dev`).
