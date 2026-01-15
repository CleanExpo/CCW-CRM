# Troubleshooting Guide

**Project**: CCW-Online-ERP
**Purpose**: If-Then rules for common issues and their solutions

---

## Table of Contents

1. [Form Issues](#form-issues)
2. [Data Refresh Issues](#data-refresh-issues)
3. [Styling Issues](#styling-issues)
4. [API Issues](#api-issues)
5. [Database Issues](#database-issues)
6. [Build Issues](#build-issues)

---

## Form Issues

### IF: Form submits but no visual feedback
**THEN:**
1. Add `isLoading` state to component
2. Set `isLoading = true` at start of submission
3. Set `isLoading = false` in finally block
4. Disable submit button while `isLoading === true`
5. Change button text to show loading state

**Example:**
```typescript
const [isLoading, setIsLoading] = useState(false);

async function onSubmit(data) {
  setIsLoading(true);
  try {
    await apiClient.post("/api/products", data);
  } finally {
    setIsLoading(false);
  }
}

<Button type="submit" disabled={isLoading}>
  {isLoading ? "Saving..." : "Save"}
</Button>
```

---

### IF: User clicks submit button multiple times
**THEN:**
1. Add loading state as above
2. Disable button during submission with `disabled={isLoading}`
3. This prevents duplicate API calls

---

### IF: Form validation doesn't work
**THEN:**
1. Check Zod schema is properly defined
2. Verify `zodResolver(formSchema)` is passed to `useForm`
3. Ensure field names in schema match field names in form
4. Check `<FormMessage />` is included in each `<FormItem />`
5. Verify `form.handleSubmit(onSubmit)` is used on form element

---

### IF: Form shows validation error but data is valid
**THEN:**
1. Check data type mismatch (e.g., string vs number)
2. For number inputs, use `onChange={(e) => field.onChange(parseFloat(e.target.value))}`
3. For integer inputs, use `onChange={(e) => field.onChange(parseInt(e.target.value))}`
4. Verify Zod schema expects correct type (z.number() vs z.string())

---

### IF: Form default values don't populate in edit mode
**THEN:**
1. Check `initialData` prop is passed to form component
2. Verify `defaultValues` in `useForm` uses initialData
3. Ensure initialData has correct field names matching form schema
4. Check data types match schema expectations

---

## Data Refresh Issues

### IF: Created/updated data doesn't appear after form submission
**THEN:**
1. Add `router.refresh()` after successful API call
2. Import: `import { useRouter } from "next/navigation"`
3. Call: `const router = useRouter()`
4. Use: `router.refresh()` after mutation

**Example:**
```typescript
const router = useRouter();

async function onSubmit(data) {
  await apiClient.post("/api/products", data);
  router.refresh(); // Refreshes server components
}
```

---

### IF: List page doesn't update after delete
**THEN:**
1. Ensure `router.refresh()` is called after delete
2. Check delete API call is actually completing successfully
3. Verify delete endpoint returns success status

---

### IF: Data is stale (shows old values)
**THEN:**
1. Call `router.refresh()` after all mutations (create/update/delete)
2. If using client-side fetching with SWR, call `mutate(key)`
3. Verify server component is using latest data fetch

---

## Styling Issues

### IF: Component doesn't respect dark mode
**THEN:**
1. Use design tokens instead of hardcoded colors
2. Replace `bg-blue-500` with `bg-primary`
3. Replace `text-white` with `text-primary-foreground`
4. Use `dark:` variants if custom styling needed
5. Never hardcode hex colors or RGB values

**Bad:**
```typescript
<div className="bg-blue-500 text-white">
```

**Good:**
```typescript
<div className="bg-primary text-primary-foreground">
```

---

### IF: Spacing looks inconsistent
**THEN:**
1. Use Tailwind spacing scale: `space-y-4`, `gap-6`, `p-4`
2. Don't use arbitrary values like `mt-[13px]`
3. Stick to scale: 0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32
4. Use semantic spacing from design system

---

### IF: Layout breaks on mobile
**THEN:**
1. Add responsive breakpoints: `md:grid-cols-2`, `lg:flex-row`
2. Use mobile-first approach (base styles for mobile, breakpoints for larger)
3. Test at 375px (mobile), 768px (tablet), 1920px (desktop)
4. Use `ResponsiveTable` component for tables

---

### IF: Custom colors look wrong
**THEN:**
1. Don't use custom colors - use design tokens from `globals.css`
2. Available tokens: `brand-primary`, `success`, `warning`, `error`, `info`
3. If truly need custom color, add to design system in `globals.css`
4. Never add inline styles or hardcoded colors

---

## API Issues

### IF: API returns 404 but endpoint exists
**THEN:**
1. Check API base URL is correct: `NEXT_PUBLIC_BACKEND_URL`
2. Verify endpoint path matches backend route
3. Check backend server is running: `cd apps/backend && uvicorn ...`
4. Verify route is registered in `main.py`

---

### IF: API returns 401 Unauthorized
**THEN:**
1. Check user is logged in (JWT token exists in cookies)
2. Verify middleware.ts is not blocking the route
3. Check token hasn't expired (login again)
4. Ensure backend route doesn't require additional permissions

---

### IF: API returns 422 Validation Error
**THEN:**
1. Check request data matches Pydantic schema
2. Verify required fields are provided
3. Check data types match schema (string vs number vs UUID)
4. Review error details in response for specific field errors
5. Ensure enums match allowed values

**Example Error:**
```json
{
  "detail": [
    {
      "loc": ["body", "price"],
      "msg": "ensure this value is greater than 0",
      "type": "value_error.number.not_gt"
    }
  ]
}
```

---

### IF: API returns 500 Internal Server Error
**THEN:**
1. Check backend logs for stack trace
2. Verify database connection is working
3. Check for null/undefined values causing errors
4. Verify foreign key relationships exist
5. Check for SQL syntax errors in queries

---

### IF: API call never completes (hangs)
**THEN:**
1. Check backend server is running and responsive
2. Verify no infinite loops in backend code
3. Check database query isn't timing out
4. Add timeout to API client request
5. Check network connectivity

---

### IF: CORS error in browser console
**THEN:**
1. Verify backend CORS settings in `main.py`
2. Check allowed origins includes frontend URL
3. Ensure credentials are allowed if using cookies
4. Restart backend server after CORS changes

---

## Database Issues

### IF: SQLAlchemy IntegrityError (unique constraint violation)
**THEN:**
1. Check for duplicate SKU, email, or other unique fields
2. Verify data doesn't already exist before insert
3. For sequential numbers (order_number), use MAX approach not COUNT
4. See SCHEMA.md for list of unique constraints

---

### IF: Foreign key constraint violation
**THEN:**
1. Verify referenced record exists before creating relationship
2. Check UUID is valid and points to existing record
3. Ensure parent record hasn't been deleted
4. Review cascade delete rules in SCHEMA.md

---

### IF: Data doesn't persist after commit
**THEN:**
1. Ensure `await db.commit()` is called
2. Check no exceptions are rolled back transaction
3. Verify `db.add(record)` was called before commit
4. Use `await db.refresh(record)` after commit to get updated data

---

### IF: Relationship data not loading (None when expected)
**THEN:**
1. Use `selectinload()` or `joinedload()` for eager loading
2. Example: `select(Order).options(selectinload(Order.items))`
3. Don't access relationships after session is closed
4. Verify relationship is defined in both models

---

### IF: Order number already exists error
**THEN:**
1. Check order number generation function uses MAX not COUNT
2. See `orders.py:24-42` for correct implementation
3. Verify function handles gaps in sequence correctly

**Correct pattern:**
```python
query = select(func.max(Order.order_number)).where(
    Order.order_number.like(f"ORD-{year}-%")
)
```

---

## Build Issues

### IF: Type checking fails with TypeScript errors
**THEN:**
1. Run `pnpm turbo run type-check` to see all errors
2. Check for missing type definitions
3. Verify imports are correct
4. Ensure props match interface definitions
5. Check for `any` types that should be specific

---

### IF: Linting fails
**THEN:**
1. Run `pnpm turbo run lint` to see all errors
2. Fix unused imports/variables
3. Check for console.log statements (remove or use proper logging)
4. Verify consistent code formatting
5. Run `pnpm lint --fix` to auto-fix simple issues

---

### IF: Tests fail
**THEN:**
1. Run `pnpm turbo run test` to see failures
2. Check test expectations match actual output
3. Verify mocks are properly configured
4. Ensure test database is seeded correctly
5. Check for async/await issues (missing await)

---

### IF: Build succeeds but app crashes at runtime
**THEN:**
1. Check browser console for JavaScript errors
2. Verify environment variables are set correctly
3. Check for missing dependencies in package.json
4. Ensure API endpoints match backend routes
5. Review server logs for errors

---

### IF: Development server won't start
**THEN:**
1. Check port 3000 isn't already in use
2. Verify node_modules are installed: `pnpm install`
3. Check for syntax errors in code
4. Clear `.next` directory: `rm -rf apps/web/.next`
5. Restart from project root: `pnpm dev`

---

## Prevention Checklist

Before marking task complete, verify:

### ✅ Code Quality
- [ ] `pnpm turbo run type-check` passes
- [ ] `pnpm turbo run lint` passes
- [ ] `pnpm turbo run test` passes
- [ ] No console.log or console.error statements
- [ ] All imports are used

### ✅ User Experience
- [ ] Loading states on all async operations
- [ ] Success/error toast notifications
- [ ] Disable buttons during submission
- [ ] Delete confirmations with AlertDialog
- [ ] Empty states for lists
- [ ] Error messages are user-friendly

### ✅ Data Handling
- [ ] `router.refresh()` after mutations
- [ ] Form validation with Zod
- [ ] API error handling with try-catch
- [ ] Foreign key references verified
- [ ] Unique constraints checked

### ✅ Styling
- [ ] Design tokens used (no hardcoded colors)
- [ ] Responsive on mobile/tablet/desktop
- [ ] Dark mode works correctly
- [ ] Consistent spacing scale
- [ ] shadcn/ui components used

### ✅ Testing
- [ ] Manual testing of happy path
- [ ] Error scenarios tested
- [ ] Edge cases covered
- [ ] Mobile responsiveness verified
- [ ] Dark mode verified

---

## Quick Reference: Common Commands

```bash
# Start development
pnpm dev                              # All services
pnpm dev --filter=web                 # Frontend only
cd apps/backend && uvicorn src.api.main:app --reload  # Backend only

# Quality checks
pnpm turbo run type-check             # TypeScript
pnpm turbo run lint                   # ESLint
pnpm turbo run test                   # All tests

# Database
docker compose up -d                  # Start PostgreSQL
docker compose down                   # Stop PostgreSQL

# Troubleshooting
rm -rf apps/web/.next                 # Clear Next.js cache
rm -rf node_modules && pnpm install   # Reinstall dependencies
docker compose restart                # Restart database
```

---

## When to Ask for Help

If you encounter any of these, stop and ask the user:

1. **Schema changes needed** - Requires approval and migration strategy
2. **Authentication changes needed** - Security-critical, requires approval
3. **Breaking API changes needed** - Affects frontend contracts
4. **Major dependency upgrades** - Can cause breaking changes
5. **Can't resolve error after trying solutions above** - May need user context

---

*Last Updated: January 14, 2026*
*For code patterns, see [PATTERNS.md](PATTERNS.md)*
*For database schema, see [SCHEMA.md](SCHEMA.md)*
