# Standards

Patterns that linters can't catch. For canonical examples, see the files referenced.

## Error Handling

### Frontend

Wrap all `apiClient` calls in try-catch. Show toast on failure. Disable submit buttons during API calls.

```typescript
// See: apps/web/components/auth/login-form.tsx (canonical pattern)
try {
  await apiClient.post('/api/endpoint', values);
  toast({ title: 'Success', description: 'Action completed' });
  router.refresh();
} catch (error: any) {
  toast({
    title: 'Error',
    description: error.message || 'Something went wrong',
    variant: 'destructive',
  });
}
```

### Backend

Use FastAPI exception handlers for HTTP errors. Return Pydantic models, never raw dicts.
For integrations (Cin7, Xero, Shopify): wrap `httpx` calls in try-except, log with `structlog`, return graceful fallbacks.

## Naming

| Domain           | Convention                          | Example                |
| ---------------- | ----------------------------------- | ---------------------- |
| React components | PascalCase.tsx                      | `ProductForm.tsx`      |
| Utility files    | kebab-case.ts                       | `backend-url.ts`       |
| Python modules   | snake_case.py                       | `product_sync.py`      |
| API routes       | `/api/kebab-case`                   | `/api/purchase-orders` |
| DB columns       | snake_case                          | `organization_id`      |
| Enums (Python)   | PascalCase class, snake_case values | `OrderStatus.pending`  |
| Skills           | SCREAMING-KEBAB.md                  | `AUTONOMOUS-BUILD.md`  |

## Frontend Patterns

### Component Structure

Page-level components go in `apps/web/app/(dashboard)/[module]/components/`.
Shared components go in `apps/web/components/`.

```
apps/web/app/(dashboard)/products/
├── page.tsx              # Page component (server)
└── components/
    ├── ProductForm.tsx    # Form with RHF + Zod
    └── ProductTable.tsx   # Data table
```

### Form Pattern

Use React Hook Form + Zod. See `apps/web/components/auth/login-form.tsx`:

- `"use client"` directive
- `zodResolver(schema)` for validation
- `isLoading` state to disable submit
- `router.refresh()` after mutations

### Data Fetching

Use `apiClient` from `@/lib/api/client`. It handles JWT tokens from cookies and JSON serialization automatically. Base URL comes from `NEXT_PUBLIC_BACKEND_URL`.

### Delete Actions

Always wrap in `AlertDialog` from shadcn/ui. Never delete without confirmation.

## Backend Patterns

### Endpoint Pattern

See `apps/backend/src/api/routes/demo_lists.py`:

- Async functions with type hints
- `Annotated[AsyncSession, Depends(get_async_db)]` for DB
- Pagination via `page` + `page_size` query params
- Pydantic models for request/response bodies

### Integration Pattern

See `apps/backend/src/integrations/cin7/`:

```
config/settings.py → integrations/[name]/client.py → api/routes/integrations/[name].py
```

- Pydantic `BaseSettings` with `mode: demo|live`
- `httpx.AsyncClient` with async context manager
- Demo mode: `structlog` logging, realistic mock data

### New Models

Extend from `models_base.py`. Use UUID primary keys and `Mapped[]` type hints.
Add to `cin7_models.py` or create a new `[domain]_models.py` — never modify `demo_models.py`.

## Patterns to Avoid

| Anti-pattern                           | Why                           | Do instead                           |
| -------------------------------------- | ----------------------------- | ------------------------------------ |
| `bg-blue-500` (raw Tailwind)           | Breaks design system          | Use `bg-primary` tokens              |
| Global state (Redux/Zustand)           | Over-engineering for this app | React hooks + context                |
| `--reload` in production uvicorn       | Causes crashes                | Only use in local dev                |
| Modifying existing API response shapes | Breaks frontend consumers     | Add optional fields only             |
| Creating top-level directories         | Deployment path issues        | Ask first, follow monorepo structure |
