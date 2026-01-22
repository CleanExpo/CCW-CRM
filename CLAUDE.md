# CCW-Online-ERP - Architecture Guide for Development

> 🚨 **IMPORTANT**: Before reading this file, read `.claude/STARTUP.md` first.
>
> **Claude Framework**: This project uses a comprehensive Claude Code framework located in `.claude/`:
> - `.claude/STARTUP.md` - Read this FIRST every session
> - `.claude/CLAUDE.md` - Full system instructions & workflow
> - `.claude/agents/` - Orchestrator, Planner, Coder, Reviewer agents
> - `.claude/commands/` - /plan, /spec, /test, /audit, /reset commands
> - `.claude/.directives` - Auto-enforced rules
> - `.claude/.execution` - Current state tracking
>
> This file (root CLAUDE.md) is your quick reference. For detailed instructions, see `.claude/CLAUDE.md`.

---

## Project Overview
This is a **full-stack Equipment Supplier ERP** built for CCW's internal business operations, based on the NodeJS-Starter-V1 template.

**Current Status**: Working MVP with read-only views. The task is to add full CRUD operations (Create, Read, Update, Delete) to all modules.

**Tech Stack**:
- **Frontend**: Next.js 15, React 19, TypeScript 5.7, Tailwind CSS v4, shadcn/ui
- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2.0, Pydantic v2
- **Database**: PostgreSQL 15 (via Docker)
- **Package Manager**: pnpm
- **Build Tool**: Turbo (monorepo orchestration)
- **State Management**: React hooks (no Redux/Zustand needed for MVP)
- **Form Validation**: Zod (frontend) + Pydantic (backend)
- **Forms**: React Hook Form

---

## Architecture Overview

### Monorepo Structure
```
C:\CCW-Online-ERP/
├── apps/
│   ├── web/                              # Next.js 15 Frontend
│   │   ├── app/
│   │   │   ├── (auth)/                   # Authentication pages
│   │   │   │   └── login/page.tsx        # Login page
│   │   │   └── (dashboard)/              # Protected dashboard routes
│   │   │       ├── layout.tsx            # Dashboard layout with sidebar
│   │   │       ├── dashboard/page.tsx    # Main dashboard with metrics
│   │   │       ├── products/page.tsx     # Products list (read-only)
│   │   │       ├── customers/page.tsx    # Customers list (read-only)
│   │   │       ├── orders/page.tsx       # Orders list (read-only)
│   │   │       └── quotes/page.tsx       # Quotes list (read-only)
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── login-form.tsx        # ⭐ REFERENCE PATTERN FOR FORMS
│   │   │   ├── layout/
│   │   │   │   └── sidebar.tsx           # Navigation sidebar
│   │   │   └── ui/                       # shadcn/ui components (installed)
│   │   ├── lib/
│   │   │   └── api/
│   │   │       ├── client.ts             # ⭐ API client for all requests
│   │   │       └── auth.ts               # Auth API methods
│   │   └── middleware.ts                 # 🚨 DO NOT MODIFY - JWT auth
│   └── backend/                          # FastAPI Backend
│       ├── src/
│       │   ├── api/routes/
│       │   │   ├── demo_lists.py         # ⭐ Products, Customers, Orders, Quotes list endpoints
│       │   │   ├── demo_dashboard.py     # Dashboard metrics and charts
│       │   │   └── demo_auth.py          # 🚨 DO NOT MODIFY - Authentication endpoints
│       │   ├── db/
│       │   │   ├── demo_models.py        # 🚨 DO NOT MODIFY - SQLAlchemy models
│       │   │   └── seed_demo.py          # Seed data script
│       │   └── config/
│       │       └── database.py           # DB connection
│       └── tests/                        # Pytest tests
├── docker-compose.yml                    # PostgreSQL container
├── package.json                          # Root package.json with scripts
└── pnpm-workspace.yaml                   # pnpm workspace config
```

---

## 🚨 Critical Development Guardrails

### NEVER DO THESE (Breaking Changes):

#### 1. **Database Schema Changes**
- ❌ **DO NOT** modify `apps/backend/src/db/demo_models.py` (SQLAlchemy models)
- ❌ **DO NOT** add, remove, or rename database columns
- ❌ **DO NOT** change table names
- ❌ **DO NOT** create new Alembic migrations
- ❌ **DO NOT** modify enum types (OrderStatus, QuoteStatus, ProductCategory)

**Why**: Database is shared with production-like data. Schema changes require careful planning, approval, and migration strategy. Making schema changes without approval could corrupt data or break the existing system.

**Exception**: Only with explicit user approval and migration strategy.

#### 2. **Authentication & Security**
- ❌ **DO NOT** modify `apps/web/middleware.ts` (JWT auth middleware)
- ❌ **DO NOT** change `apps/backend/src/api/routes/demo_auth.py` (auth endpoints)
- ❌ **DO NOT** modify password hashing logic (passlib/bcrypt)
- ❌ **DO NOT** change token generation or validation
- ❌ **DO NOT** disable authentication checks or bypass security

**Why**: Security-critical code. Any changes could expose vulnerabilities, allow unauthorized access, or leak sensitive user data.

#### 3. **API Contracts (Existing Endpoints)**
- ❌ **DO NOT** change response structure of existing endpoints
- ❌ **DO NOT** rename existing API routes (e.g., `/api/products` → `/api/items`)
- ❌ **DO NOT** change required request parameters to optional or vice versa
- ❌ **DO NOT** remove fields from API responses

**Why**: Frontend depends on specific API contracts. Breaking changes will crash the UI, cause data display errors, or break pagination.

**Exception**: You CAN add optional parameters or new fields to responses. You CAN create entirely new endpoints.

#### 4. **Dependencies & Package Versions**
- ❌ **DO NOT** upgrade Next.js, React, FastAPI, or other major frameworks without approval
- ❌ **DO NOT** add large dependencies (>5MB) without justification
- ❌ **DO NOT** remove existing dependencies that are in use
- ❌ **DO NOT** change Python or Node.js version requirements

**Why**: Version upgrades can introduce breaking changes, require code refactoring, or cause build failures. Large dependencies slow down builds and increase bundle size.

---

### ✅ ENCOURAGED CHANGES (Safe to Make):

1. **Frontend Components**
   - ✅ Add new components in `apps/web/components/`
   - ✅ Add new page components in `apps/web/app/(dashboard)/[module]/components/`
   - ✅ Use existing shadcn/ui components (Button, Dialog, Form, Input, etc.)
   - ✅ Follow existing component patterns (see `login-form.tsx`)

2. **API Calls**
   - ✅ Add new API client methods in `apps/web/lib/api/`
   - ✅ Use `apiClient.get()`, `apiClient.post()`, `apiClient.put()`, `apiClient.delete()` from `client.ts`
   - ✅ Add proper TypeScript types for requests and responses

3. **Styling**
   - ✅ Use Tailwind utility classes
   - ✅ Use CSS variables from design system (e.g., `bg-primary`, `text-muted-foreground`)
   - ✅ Follow spacing scale: `space-y-4`, `gap-6`, `p-4`, etc.
   - ✅ Use responsive breakpoints: `md:grid-cols-2`, `lg:flex-row`, etc.

4. **Testing**
   - ✅ Add Vitest tests for new components in `apps/web/__tests__/`
   - ✅ Add Pytest tests for new backend logic in `apps/backend/tests/`
   - ✅ Test critical paths (form submission, API calls, delete confirmations)

---

## Code Patterns & Conventions

### Frontend Component Pattern

**Location**: `apps/web/app/(dashboard)/[module]/components/[ModuleName]Form.tsx`

**Pattern** (based on `login-form.tsx`):
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

// 1. Define Zod schema for validation
const formSchema = z.object({
  field1: z.string().min(1, "Field is required"),
  field2: z.string().email("Invalid email format"),
  field3: z.number().positive("Must be positive"),
  // ... more fields
});

type FormData = z.infer<typeof formSchema>;

// 2. Component with proper TypeScript types
interface ModuleFormProps {
  mode: "create" | "edit";
  initialData?: FormData;
  onSuccess?: () => void;
}

export function ModuleForm({ mode, initialData, onSuccess }: ModuleFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // 3. React Hook Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      field1: "",
      field2: "",
      field3: 0,
    },
  });

  // 4. Submit handler with error handling
  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      if (mode === "create") {
        await apiClient.post("/api/endpoint", values);
        toast({
          title: "Success",
          description: "Created successfully",
        });
      } else {
        await apiClient.put(`/api/endpoint/${initialData?.id}`, values);
        toast({
          title: "Success",
          description: "Updated successfully",
        });
      }
      onSuccess?.();
      router.refresh(); // Refresh server components to show new data
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Operation failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // 5. Render form with shadcn/ui components
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="field1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Field Label</FormLabel>
              <FormControl>
                <Input placeholder="Enter value" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* More fields... */}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : mode === "create" ? "Create" : "Update"}
        </Button>
      </form>
    </Form>
  );
}
```

### API Client Pattern

**Location**: `apps/web/lib/api/client.ts`

**Usage**:
```typescript
import { apiClient } from "@/lib/api/client";

// GET request
const products = await apiClient.get<Product[]>("/api/products");

// GET with query parameters
const filteredProducts = await apiClient.get<PaginatedResponse>(
  "/api/products?page=1&page_size=50&search=drill"
);

// POST request
const newProduct = await apiClient.post("/api/products", {
  sku: "SKU-001",
  name: "Product Name",
  price: 99.99,
  stock: 100,
});

// PUT request
const updated = await apiClient.put(`/api/products/${id}`, data);

// DELETE request
await apiClient.delete(`/api/products/${id}`);
```

**Important Notes**:
- `apiClient` automatically handles JWT token from cookies
- `apiClient` automatically handles JSON serialization/deserialization
- `apiClient` throws `ApiClientError` on failure (catch it and show user-friendly message)
- Base URL comes from `process.env.NEXT_PUBLIC_BACKEND_URL` (defaults to http://localhost:8000)

### Backend Endpoint Pattern

**Existing Endpoints** (in `apps/backend/src/api/routes/demo_lists.py`):
```python
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_async_db
from src.db.demo_models import Product

router = APIRouter(prefix="/api", tags=["Demo Lists"])

@router.get("/products")
async def list_products(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    category: str | None = None,
) -> PaginatedResponse:
    """List products with pagination and search."""
    query = select(Product)

    # Apply filters
    if search:
        query = query.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
            )
        )

    if category:
        query = query.where(Product.category == category)

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Product.name).limit(page_size).offset((page - 1) * page_size)

    # Execute and return
    result = await db.execute(query)
    products = result.scalars().all()

    return PaginatedResponse(
        data=products,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )

# Similar patterns for POST, PUT, DELETE...
```

**If adding new endpoints** (generally not needed, existing ones should work):
- Use async/await pattern throughout
- Use Pydantic models for request validation and response serialization
- Use SQLAlchemy async session (`get_async_db` dependency)
- Return proper HTTP status codes (201 for create, 204 for delete, 200 for get/update)
- Add comprehensive error handling

---

## Database Schema Reference

**Tables** (in `demo_models.py` - **DO NOT MODIFY**):

1. **organizations** - Organization/tenant data
   - id (UUID, primary key), name, slug, is_active, created_at, updated_at

2. **users** - User accounts
   - id (UUID), email (unique), hashed_password, full_name, organization_id (FK to organizations), is_active, created_at, updated_at

3. **products** - Product catalog
   - id (UUID), sku (unique), name, description, category (enum: ProductCategory), price (decimal), cost (decimal), stock (integer), warehouse_location, is_active, created_at, updated_at

4. **customers** - Customer directory
   - id (UUID), customer_number (unique), company_name, contact_name, email, phone, address, city, state, postal_code, country, is_active, created_at, updated_at

5. **orders** - Sales orders
   - id (UUID), order_number (unique, format: ORD-YYYY-NNN), customer_id (FK to customers), order_date, status (enum: OrderStatus), notes, total (calculated from items), created_at, updated_at

6. **order_items** - Order line items
   - id (UUID), order_id (FK to orders, cascade delete), product_id (FK to products), quantity, unit_price, subtotal (calculated: quantity × unit_price), created_at, updated_at

7. **quotes** - Customer quotes
   - id (UUID), quote_number (unique, format: Q-YYYY-NNN), customer_id (FK to customers), quote_date, valid_until, status (enum: QuoteStatus), notes, total (calculated from items), created_at, updated_at

8. **quote_items** - Quote line items
   - id (UUID), quote_id (FK to quotes, cascade delete), product_id (FK to products), quantity, unit_price, subtotal (calculated: quantity × unit_price), created_at, updated_at

**Enums**:
- **OrderStatus**: draft, pending, confirmed, processing, shipped, delivered, cancelled
- **QuoteStatus**: draft, pending, sent, accepted, rejected, expired
- **ProductCategory**: heavy_machinery, hand_tools, power_tools, safety_equipment, building_materials, electrical, plumbing, accessories

**Key Relationships**:
- Orders → Customer (many-to-one)
- Order Items → Order (many-to-one, cascade delete)
- Order Items → Product (many-to-one)
- Quotes → Customer (many-to-one)
- Quote Items → Quote (many-to-one, cascade delete)
- Quote Items → Product (many-to-one)

---

## Testing Requirements

### When to Run Tests

**Before marking task complete** (MANDATORY):
```bash
# From project root
pnpm turbo run type-check    # MUST PASS - no TypeScript errors
pnpm turbo run lint          # MUST PASS - no ESLint errors
pnpm turbo run test          # MUST PASS - all Vitest + Pytest tests passing
```

**During development** (optional but recommended):
```bash
# Watch mode for frontend tests
pnpm test:watch --filter=web

# Watch mode for backend tests (if you have pytest-watch installed)
cd apps/backend && pytest-watch
```

### Test Coverage Expectations

**Minimum Coverage** (for MVP):
- **Critical paths**: Form submissions work, API calls succeed, Delete confirmations prevent accidental deletion
- **Edge cases**: Validation errors display properly, Network errors show user-friendly messages, Empty states render correctly
- **No need for 100% coverage**, but all user-facing features should be tested

**Test Location**:
- Frontend: `apps/web/__tests__/components/[module]/`
  - Example: `apps/web/__tests__/components/products/ProductForm.test.tsx`
- Backend: `apps/backend/tests/`
  - Example: `apps/backend/tests/api/test_products.py`

**Example Test** (Vitest):
```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProductForm } from "@/app/(dashboard)/products/components/ProductForm";

describe("ProductForm", () => {
  test("shows validation error for empty SKU", async () => {
    render(<ProductForm mode="create" />);

    const submitButton = screen.getByRole("button", { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/sku is required/i)).toBeInTheDocument();
    });
  });

  test("creates product successfully", async () => {
    render(<ProductForm mode="create" />);

    // Fill in form fields
    fireEvent.change(screen.getByLabelText(/sku/i), { target: { value: "TEST-001" } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Test Product" } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
    });
  });
});
```

---

## Common Pitfalls & How to Avoid Them

### 1. Forgetting Loading States
**Problem**: Form submits but no visual feedback, user clicks submit button multiple times, causes duplicate API calls

**Solution**: Always set `isLoading` state, disable button during submission
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

// In JSX:
<Button type="submit" disabled={isLoading}>
  {isLoading ? "Saving..." : "Save"}
</Button>
```

### 2. Not Handling Errors Properly
**Problem**: API error occurs, page crashes or shows cryptic error message, user doesn't know what went wrong

**Solution**: Wrap API calls in try-catch, show user-friendly error messages via toast
```typescript
try {
  await apiClient.post("/api/products", data);
  toast({ title: "Success", description: "Product created" });
} catch (error: any) {
  toast({
    title: "Error",
    description: error.message || "Something went wrong. Please try again.",
    variant: "destructive",
  });
}
```

### 3. Missing Confirmation Dialogs for Delete
**Problem**: User accidentally clicks delete button, data is immediately deleted, no way to undo

**Solution**: Always use AlertDialog for destructive actions
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete {productName}.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 4. Not Refreshing Data After Mutations
**Problem**: Create/Update/Delete succeeds on backend, but list page doesn't update

**Solution**: Use `router.refresh()` or manually re-fetch
```typescript
import { useRouter } from "next/navigation";

const router = useRouter();

async function onSubmit(data) {
  await apiClient.post("/api/products", data);
  router.refresh(); // Re-fetches server components
}
```

### 5. Hardcoding Colors
**Problem**: Inconsistent styling, doesn't respect dark mode

**Solution**: Use design tokens
```typescript
// ❌ Bad
<div className="bg-blue-500 text-white">

// ✅ Good
<div className="bg-primary text-primary-foreground">
```

---

## Environment Setup

### Start Services
```bash
docker compose up -d                    # PostgreSQL
cd apps/backend && uvicorn src.api.main:app --reload
cd apps/web && pnpm dev
# OR: pnpm dev (starts all)
```

### Login Credentials
- **admin@demo.com** / **demo123**
- sales@demo.com / demo123
- warehouse@demo.com / demo123

---

## Success Criteria

Complete when:
1. Products: Full CRUD with validation
2. Customers: Full CRUD
3. Orders: CRUD + line items + status
4. Quotes: CRUD + line items + status + convert-to-order
5. All deletes have confirmations
6. All forms have loading/error states
7. All pages have empty states
8. Type-check passes
9. Lint passes
10. Tests pass
11. Manual testing verified
12. Completion marker added to PROMPT.md

**Focus**: Working MVP, not perfection. Functional CRUD, good UX, code quality.
