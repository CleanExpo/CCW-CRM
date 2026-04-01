## Anti-Drift Infrastructure (Read This First)

This project uses automated Claude Code hooks to combat context drift:

- **SessionStart**: Auto-injects CONSTITUTION.md + current-state.md at session start
- **UserPromptSubmit**: Re-injects compass check (6 prohibitions + current state) before EVERY message
- **PreCompact**: Saves state to .claude/memory/context-snapshot.md before compaction occurs
- **PreToolUse (Task)**: Logs all agent dispatches to decisions-log.md

**IF hooks fire**, you will see "COMPASS CHECK (auto-injected)" before the user's message — this is correct.

**IF you missed hook injection** (rare — restart Claude Code), manually run:

```bash
cat .claude/memory/CONSTITUTION.md
cat .claude/memory/current-state.md
```

State files in .claude/memory/ — read these before every major decision:

- `CONSTITUTION.md` — immutable rules (same rules every session)
- `current-state.md` — active sprint, in-progress work
- `decisions-log.md` — architectural decisions audit log
- `handoff.md` — cross-session context handoff

**5 Governing Laws:**

1. **Anti-Drift Law**: State on disk. Hooks re-inject. Orchestrator never compacts.
2. **1:10 Agent:Skill Law**: Every agent has exactly 10 skills. No more, no less.
3. **Catalog Law**: Check docs/catalogs/ before adding anything. Update after adding.
4. **10x Health Check Law**: Run /health-check-10x after every major change.
5. **Smart-Not-Fast Law**: /plan → approve → implement → /test → report. Always.

## Obsidian Vault (Living Documentation)

This project uses an **auto-generated Obsidian knowledge graph** at `.obsidian-vault/` for living documentation:

- **Auto-generated docs**: 225+ entity docs with YAML frontmatter (routes, pages, models, components)
- **Bidirectional links**: Wikilinks connect routes ↔ pages ↔ models ↔ integrations
- **Graph visualization**: Visual impact analysis (see what breaks if you change X)
- **Drift prevention**: Pre-commit hooks block commits with undocumented files
- **Sync command**: `/sync-vault` or `python scripts/vault-generator.py --entity-types all`

**Quick usage:**

```bash
# Sync vault after code changes (incremental, < 5s)
python scripts/vault-generator.py --entity-types routes,pages --incremental

# Detect drift (ghost entries, undocumented files)
python scripts/audit-vault.py

# Query vault (find routes using specific model)
# Open .obsidian-vault/ in Obsidian, run Dataview queries in _index/
```

**Vault structure:**

- `routes/` — 121 route docs (ROUTE-XXX-\*.md)
- `pages/` — 76 page docs (PAGE-XXX-\*.md)
- `models/` — 28 model docs (MODEL-XXX-\*.md)
- `_index/` — Pre-built Dataview queries (stale-docs, orphaned-routes, model-usage)
- `catalogs/` → symlink to `docs/catalogs/` (single source of truth)
- `memory/` → symlink to `.claude/memory/` (state files)

**Before adding routes/pages/models**: Check vault + catalogs. **After adding**: Run `/sync-vault`.

---

# CCW-ERP-CRM - Architecture Guide for Development

> **Claude Framework**: This project uses a comprehensive Claude Code framework located in `.claude/`:
>
> - `.claude/STARTUP.md` - Read this FIRST every session
> - `.claude/CLAUDE.md` - Full system instructions & workflow
> - `.claude/agents/` - Orchestrator, Planner, Coder, Reviewer agents
> - `.claude/commands/` - /plan, /spec, /test, /audit, /reset commands
> - `.claude/rules/` - Auto-enforced rules
>
> This file (root CLAUDE.md) is your quick reference. For detailed instructions, see `.claude/CLAUDE.md`.

---

## Project Overview

This is a **full-stack Equipment Supplier ERP/CRM** built for CCW's internal business operations.

**Current Status**: Deployed production application on Vercel (frontend) + Supabase Cloud (database/auth). Full CRUD operations, Cin7 inventory integration (7 phases), AI agent framework, multi-agent governance protocol, POS system, and real-time sync are all complete. SEO schema layer (JSON-LD), FAQ page, Stripe billing, KPI Reports page, and CSV export on all modules are also complete.

**Tech Stack**:

- **Frontend**: Next.js 15, React 19, TypeScript 5.7, Tailwind CSS v4, shadcn/ui
- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2.0, Pydantic v2
- **Database**: PostgreSQL 15 — Supabase Cloud (production), Docker (local dev)
- **Deployment**: Vercel (frontend), Supabase Cloud (DB + Auth)
- **Package Manager**: pnpm
- **Build Tool**: Turbo (monorepo orchestration)
- **State Management**: React hooks (no Redux/Zustand)
- **Form Validation**: Zod (frontend) + Pydantic (backend)
- **Forms**: React Hook Form
- **HTTP Client**: httpx (async, for integrations)
- **Logging**: structlog (structured logging)

---

## Architecture Overview

### Monorepo Structure

```
D:\CCW-ERP-CRM/
├── apps/
│   ├── web/                              # Next.js 15 Frontend (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/                   # Authentication pages
│   │   │   │   └── login/page.tsx        # Login page
│   │   │   └── (dashboard)/              # Protected dashboard routes
│   │   │       ├── layout.tsx            # Dashboard layout with sidebar
│   │   │       ├── dashboard/page.tsx    # Main dashboard with metrics
│   │   │       ├── products/page.tsx     # Products CRUD
│   │   │       ├── customers/page.tsx    # Customers CRUD
│   │   │       ├── orders/page.tsx       # Orders CRUD + line items
│   │   │       ├── quotes/page.tsx       # Quotes CRUD + line items
│   │   │       ├── pos/page.tsx          # Point of Sale
│   │   │       └── settings/             # Settings & integrations
│   │   │           └── integrations/     # Cin7, Xero, Shopify config
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── login-form.tsx        # REFERENCE PATTERN FOR FORMS
│   │   │   ├── dashboard/               # Dashboard widgets (Cin7 sync, etc.)
│   │   │   ├── layout/
│   │   │   │   └── sidebar.tsx           # Navigation sidebar
│   │   │   └── ui/                       # shadcn/ui components
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── client.ts             # API client for all requests
│   │   │   │   ├── auth.ts               # Auth API methods
│   │   │   │   └── cin7.ts               # Cin7 integration API
│   │   │   └── hooks/                    # Custom hooks (SSE, Cin7 stream)
│   │   └── middleware.ts                 # DO NOT MODIFY - JWT auth
│   └── backend/                          # FastAPI Backend
│       ├── src/
│       │   ├── api/
│       │   │   ├── main.py               # App entry, router registration
│       │   │   └── routes/
│       │   │       ├── demo_lists.py     # Products, Customers, Orders, Quotes
│       │   │       ├── demo_dashboard.py # Dashboard metrics
│       │   │       ├── demo_auth.py      # DO NOT MODIFY - Auth endpoints
│       │   │       ├── integrations/     # Cin7, Xero, Shopify routes
│       │   │       │   ├── cin7.py       # Connection management
│       │   │       │   ├── cin7_sync.py  # Product/inventory sync
│       │   │       │   ├── cin7_crm.py   # Customer/order/quote sync
│       │   │       │   ├── cin7_procurement.py  # Supplier/PO sync
│       │   │       │   ├── cin7_webhooks.py     # Webhook receiver
│       │   │       │   └── cin7_stream.py       # SSE + polling
│       │   │       └── ai/               # AI agent endpoints
│       │   │           ├── cin7_forecast.py
│       │   │           └── cin7_anomaly.py
│       │   ├── integrations/
│       │   │   └── cin7/                 # Cin7 integration (7 phases)
│       │   │       ├── client.py         # Core + Omni API clients
│       │   │       ├── demo_client.py    # Mock data for demo mode
│       │   │       ├── product_sync.py   # Bidirectional product sync
│       │   │       ├── inventory_sync.py # Multi-location stock sync
│       │   │       ├── customer_sync.py  # Customer sync
│       │   │       ├── sales_sync.py     # Order + quote sync
│       │   │       ├── supplier_sync.py  # Supplier sync
│       │   │       ├── purchase_sync.py  # Purchase order sync
│       │   │       ├── change_detector.py # Polling-based change detection
│       │   │       └── event_dispatcher.py # SSE event routing
│       │   ├── ai/
│       │   │   └── agents/specialized/   # AI agents (forecasting, anomaly)
│       │   ├── db/
│       │   │   ├── demo_models.py        # DO NOT MODIFY - Core SQLAlchemy models
│       │   │   ├── cin7_models.py        # Cin7 mapping/sync models
│       │   │   ├── pos_models.py         # POS transaction models
│       │   │   └── webhook_models.py     # Webhook event models
│       │   └── config/
│       │       ├── database.py           # DB connection
│       │       └── cin7_settings.py      # Cin7 integration config
│       └── tests/
│           ├── integration/              # Cin7 integration tests (321 assertions)
│           └── api/                      # API endpoint tests
├── .claude/                              # Claude Code framework (read-only)
├── docs/                                 # Documentation & specs
├── scripts/                              # Utility scripts
├── docker-compose.yml                    # PostgreSQL container (local dev)
├── package.json                          # Root package.json with scripts
└── pnpm-workspace.yaml                   # pnpm workspace config
```

---

## Critical Development Guardrails

### NEVER DO THESE (Breaking Changes):

#### 1. **Database Schema Changes**

- DO NOT modify `apps/backend/src/db/demo_models.py` (core SQLAlchemy models)
- DO NOT add, remove, or rename database columns on core tables
- DO NOT change table names
- DO NOT modify enum types (OrderStatus, QuoteStatus, ProductCategory)

**Exception**: Only with explicit user approval and migration strategy. New integration models (like cin7_models.py) are fine.

#### 2. **Authentication & Security**

- DO NOT modify `apps/web/middleware.ts` (JWT auth middleware)
- DO NOT change `apps/backend/src/api/routes/demo_auth.py` (auth endpoints)
- DO NOT modify password hashing logic (passlib/bcrypt)
- DO NOT change token generation or validation
- DO NOT disable authentication checks or bypass security

#### 3. **API Contracts (Existing Endpoints)**

- DO NOT change response structure of existing endpoints
- DO NOT rename existing API routes
- DO NOT change required request parameters to optional or vice versa
- DO NOT remove fields from API responses

**Exception**: You CAN add optional parameters or new fields to responses. You CAN create entirely new endpoints.

#### 4. **Dependencies & Package Versions**

- DO NOT upgrade Next.js, React, FastAPI, or other major frameworks without approval
- DO NOT add large dependencies (>5MB) without justification
- DO NOT remove existing dependencies that are in use

---

### ENCOURAGED CHANGES (Safe to Make):

1. **Frontend Components** — Add in `apps/web/components/` or page-level `components/`
2. **API Calls** — Add new API client methods in `apps/web/lib/api/`
3. **New Endpoints** — Add in `apps/backend/src/api/routes/`
4. **Integration Modules** — Add in `apps/backend/src/integrations/`
5. **Tests** — Add in `apps/web/__tests__/` or `apps/backend/tests/`
6. **Styling** — Use Tailwind utilities and design system tokens (`bg-primary`, etc.)

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
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  field1: z.string().min(1, "Field is required"),
  field2: z.string().email("Invalid email format"),
});

type FormData = z.infer<typeof formSchema>;

interface ModuleFormProps {
  mode: "create" | "edit";
  initialData?: FormData;
  onSuccess?: () => void;
}

export function ModuleForm({ mode, initialData, onSuccess }: ModuleFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || { field1: "", field2: "" },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      if (mode === "create") {
        await apiClient.post("/api/endpoint", values);
        toast({ title: "Success", description: "Created successfully" });
      } else {
        await apiClient.put(`/api/endpoint/${initialData?.id}`, values);
        toast({ title: "Success", description: "Updated successfully" });
      }
      onSuccess?.();
      router.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Operation failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="field1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Field Label</FormLabel>
              <FormControl><Input placeholder="Enter value" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : mode === "create" ? "Create" : "Update"}
        </Button>
      </form>
    </Form>
  );
}
```

### API Client Pattern

```typescript
import { apiClient } from '@/lib/api/client';

// apiClient automatically handles JWT token from cookies, JSON serialization,
// and throws ApiClientError on failure.
// Base URL: process.env.NEXT_PUBLIC_BACKEND_URL (defaults to http://localhost:8000)

const products = await apiClient.get<Product[]>('/api/products');
const newProduct = await apiClient.post('/api/products', data);
const updated = await apiClient.put(`/api/products/${id}`, data);
await apiClient.delete(`/api/products/${id}`);
```

### Backend Endpoint Pattern

```python
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_async_db

router = APIRouter(prefix="/api", tags=["Module"])

@router.get("/items")
async def list_items(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
) -> PaginatedResponse:
    # async/await, Pydantic models, proper error handling
    ...
```

### Integration Pattern (Cin7 example, reusable for new integrations)

```
config/settings.py -> integrations/[name]/client.py (demo/live) -> api/routes/integrations/[name].py
```

- Settings: Pydantic BaseSettings, `mode: demo|live`, global singleton
- Client: httpx.AsyncClient, async context manager, demo/live routing
- Demo: structlog logging, realistic mock data matching real API shapes
- DB: Base from models_base.py, UUID PKs, Mapped[] type hints

---

## Database Schema Reference

**Core Tables** (in `demo_models.py` - DO NOT MODIFY):

| Table         | Key Fields                                                                         |
| ------------- | ---------------------------------------------------------------------------------- |
| organizations | id (UUID), name, slug, is_active                                                   |
| users         | id (UUID), email (unique), hashed_password, full_name, organization_id (FK)        |
| products      | id (UUID), sku (unique), name, category (ProductCategory enum), price, cost, stock |
| customers     | id (UUID), customer_number (unique), company_name, contact_name, email             |
| orders        | id (UUID), order_number (ORD-YYYY-NNN), customer_id (FK), status (OrderStatus)     |
| order_items   | id (UUID), order_id (FK, cascade), product_id (FK), quantity, unit_price           |
| quotes        | id (UUID), quote_number (Q-YYYY-NNN), customer_id (FK), status (QuoteStatus)       |
| quote_items   | id (UUID), quote_id (FK, cascade), product_id (FK), quantity, unit_price           |

**Enums**: OrderStatus (draft/pending/confirmed/processing/shipped/delivered/cancelled), QuoteStatus (draft/pending/sent/accepted/rejected/expired), ProductCategory (heavy_machinery/hand_tools/power_tools/safety_equipment/building_materials/electrical/plumbing/accessories)

**Integration Models** (cin7_models.py): Cin7Connection, Cin7ProductMapping, Cin7SyncLog, Cin7CustomerMapping, Cin7OrderMapping, Cin7QuoteMapping, Cin7SupplierMapping, Cin7PurchaseOrderMapping

---

## Testing Requirements

**Before marking task complete** (MANDATORY):

```bash
pnpm turbo run type-check    # No TypeScript errors
pnpm turbo run lint          # No ESLint errors
pnpm turbo run test          # All Vitest + Pytest tests passing
```

**Test Location**:

- Frontend: `apps/web/__tests__/`
- Backend: `apps/backend/tests/`
- Integration: `apps/backend/tests/integration/` (321 assertions, all passing)

---

## Environment Setup

### Local Development

```bash
docker compose up -d                    # PostgreSQL
cd apps/backend && uvicorn src.api.main:app --reload
cd apps/web && pnpm dev
# OR: pnpm dev (starts all via Turbo)
```

### Production

- **Frontend**: Vercel (auto-deploys from main branch)
- **Database**: Supabase Cloud (PostgreSQL)
- **Auth**: Supabase Auth (production) / JWT (local dev)

### Login Credentials (local dev)

- **admin@demo.com** / **demo123**
- sales@demo.com / demo123
- warehouse@demo.com / demo123

---

## Common Pitfalls

1. **Loading states** — Always disable submit button during API calls
2. **Error handling** — Wrap API calls in try-catch, show toast on failure
3. **Delete confirmation** — Always use AlertDialog for destructive actions
4. **Data refresh** — Call `router.refresh()` after mutations
5. **Design tokens** — Use `bg-primary` not `bg-blue-500`

---

## Recent Additions (2026-03-30) — CLAUDE.md v4.0

**Completed since last update (2026-03-09 → 2026-03-30):**

- Anti-Drift framework: `.claude/memory/` (6 files), hooks (SessionStart/UserPromptSubmit/PreCompact), 10x health check command, toolshed API
- 6 Catalogs: `docs/catalogs/` — ROUTES.md, PAGES.md, AGENTS.md, PACKAGES.md, MODELS.md, INTEGRATIONS.md
- Cin7 Wave 1 + Wave 2: line items, GRN receiving, write-back, webhooks, shadow/fulfilment/BOM/GL (UNI-1260–1269)
- Workshop management, CRM enhancements, Invoicing, Workflow automation, Inventory (UNI-171–174/1112–1114)
- CI/CD updates, 51 Vitest unit tests, 4 E2E Playwright specs, 823 tests passing (UNI-664/1242)
- **[NEW v4.0]** Superpowers installed — 14 skills at `.claude/skills/superpowers/` (UNI-1689)
- **[NEW v4.0]** gstack installed — 29 commands at `.claude/skills/gstack/`, Bun 1.3.11, Playwright Chromium 145 (UNI-1690)
- **[NEW v4.0]** RLS security Phase 1-3: auth bridge (`auth_id` column), org backfill, org-scoped policies on 13 core tables (UNI-1697)
- **[NEW v4.0]** Fixed localhost fallback in workflow/analytics API routes for Vercel production (UNI-1706)
- **[NEW v4.0]** Disabled stale Xero cron jobs (stopped 96+ failed invocations/day) (UNI-1707)
- **[NEW v4.0]** All 4 monitoring routes return 503 when Prometheus not configured (UNI-1710)

**Active MVP Go-Live Sprint (Days 2-7):**

- UNI-1709: Stripe webhook receiver — `POST /api/webhooks/stripe` (revenue blocker)
- UNI-1708: Xero OAuth unblock — setup guide + env vars on Railway
- UNI-1711: `/settings/billing` dashboard page (subscription + payment methods + invoices)
- UNI-1712: Centralize backend URL (`apps/web/lib/api/backend-url.ts`)
- UNI-1713–1715: Nightly sync verification, smoke test, CCW handoff runbook

**AI Tooling Summary (see `.claude/CLAUDE.md` for full details):**

- **Superpowers** (14 skills): brainstorming, TDD, subagent-driven-development, systematic-debugging, writing-plans, etc.
- **gstack** (29 commands): `/ceo` `/cto` `/cso` `/qa` `/browse` `/retro` `/ship` — run via `bun .claude/skills/gstack/gstack.ts <cmd>`
- **Session sequence**: Updated from 13 → 18 steps (see `.claude/CLAUDE.md` Mandatory Behaviors)

**Blocked:**

- UNI-173 SUB-7: Xero sync (blocked on Xero auth — unblocked by UNI-1708)
- UNI-664 SUBs 2/4/5/6: GitHub Environments, branch protection (require GitHub UI)
- UNI-1235: pgvector semantic search (requires demo_models.py schema change approval)
- UNI-1236: Enhanced Shopify (blocked by Shopify auth prerequisite)
