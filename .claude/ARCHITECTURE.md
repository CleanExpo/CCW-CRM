# Architecture

## System Overview

CCW-Online ERP is a deployed Equipment Supplier ERP/CRM serving Australian cleaning equipment businesses. The frontend (Next.js 15, React 19, TypeScript) runs on Vercel. The backend (FastAPI, SQLAlchemy 2.0, Python 3.12) runs on Railway. The database is PostgreSQL 15 on Supabase Cloud (project `vwfgksqkajnpfjospbpe`, ap-southeast-2).

The monorepo is managed by pnpm workspaces with Turbo for task orchestration. Authentication uses custom JWT tokens (python-jose) — not Supabase native auth. The backend connects via SQLAlchemy using service_role, bypassing RLS by design.

## Component Map

```
CCW-ERP-CRM/
├── apps/
│   ├── web/                    # Next.js 15 (Vercel)
│   │   ├── app/(auth)/         # Login page
│   │   ├── app/(dashboard)/    # 27+ protected route groups
│   │   ├── components/         # React components + shadcn/ui
│   │   ├── lib/api/            # apiClient, auth, cin7, backend-url
│   │   ├── lib/hooks/          # Custom React hooks (SSE, Cin7 stream)
│   │   └── middleware.ts       # JWT auth — LOCKED
│   └── backend/                # FastAPI (Railway)
│       ├── src/api/routes/     # REST endpoints + integrations/ + ai/
│       ├── src/integrations/   # Cin7 (7 phases), Xero, Shopify
│       ├── src/ai/agents/      # Specialized AI agents
│       ├── src/db/             # SQLAlchemy models (demo, cin7, pos, webhook)
│       └── src/config/         # Settings (database, cin7)
├── video/remotion/             # Remotion 4 video compositions
├── scripts/                    # YouTube upload, audio gen, vault sync
├── docs/catalogs/              # ROUTES.md, PAGES.md, MODELS.md, AGENTS.md
├── .claude/                    # Claude Code framework
│   ├── agents/                 # 25+ agent definitions (boardroom, review, build)
│   ├── skills/                 # superpowers (14), gstack (29), 48+ custom skills
│   ├── memory/                 # Living state files (current-state, constitution)
│   ├── hooks/                  # Anti-drift hooks (compass, compact, dispatch)
│   └── commands/               # /plan, /test, /audit, /sync-vault, etc.
└── .obsidian-vault/            # Auto-generated knowledge graph (225+ docs)
```

## Locked Files (NEVER modify)

| File | Reason |
|------|--------|
| `apps/backend/src/db/demo_models.py` | Core SQLAlchemy models — production data at risk |
| `apps/web/middleware.ts` | JWT auth middleware — security boundary |
| `apps/backend/src/api/routes/demo_auth.py` | Auth endpoints — security boundary |

## Module Boundaries

### Frontend (`apps/web/`)
- **Owns**: UI, routing, client-side state, form validation
- **Depends on**: Backend API via `apiClient` (lib/api/client.ts)
- **Public API**: Pages render at Vercel URLs. No exported library.
- **Key pattern**: React Hook Form + Zod. No global state management.

### Backend (`apps/backend/`)
- **Owns**: Business logic, database access, integration orchestration
- **Depends on**: PostgreSQL (Supabase), Cin7 API, Xero API, Stripe API
- **Public API**: REST endpoints under `/api/`. See `src/api/main.py` for router registration.
- **Key pattern**: Async SQLAlchemy sessions via `get_async_db`. Pydantic models for all I/O.

### Video Pipeline (`video/remotion/`)
- **Owns**: Remotion compositions for training/marketing videos
- **Depends on**: Static assets in `public/`, ElevenLabs audio
- **Public API**: Rendered MP4 files uploaded to YouTube via `scripts/youtube_upload.py`

## Data Model (Core Entities)

| Entity | Table | Key Fields |
|--------|-------|------------|
| Organization | `organizations` | id (UUID), name, slug |
| User | `users` | id, email, hashed_password, organization_id (FK) |
| Product | `products` | id, sku (unique), name, category (enum), price, stock |
| Customer | `customers` | id, customer_number, company_name, email |
| Order | `orders` | id, order_number (ORD-YYYY-NNN), customer_id, status (enum) |
| Quote | `quotes` | id, quote_number (Q-YYYY-NNN), customer_id, status (enum) |
| Supplier | `suppliers` | id, name, organization_id |
| PurchaseOrder | `purchase_orders` | id, po_number, supplier_id, status |

Enums: `OrderStatus` (7 states), `QuoteStatus` (6 states), `ProductCategory` (8 types).

## Third-Party Integrations

| Service | Purpose | Auth |
|---------|---------|------|
| Supabase | PostgreSQL hosting + RLS | Service role key (backend), anon key (frontend) |
| Vercel | Frontend deployment | Git push to main |
| Railway | Backend deployment | Git push to main |
| Stripe | Billing, subscriptions | Webhook at `/api/webhooks/stripe` |
| Cin7 | Inventory sync (7 phases) | API key in Railway env |
| Xero | Accounting sync | OAuth2 (needs setup — UNI-1708) |
| Shopify | E-commerce orders | API key in Railway env |
| YouTube | Video hosting | OAuth2 via `scripts/youtube_upload.py` |
| ElevenLabs | Narration audio | API key (not yet configured) |

## AI Tooling

| Tool | Location | Count |
|------|----------|-------|
| Superpowers | `.claude/skills/superpowers/` | 14 skills |
| gstack | `.claude/skills/gstack/` | 29 commands (Bun runtime) |
| Custom skills | `.claude/skills/` | 48+ skill files |
| Agents | `.claude/agents/` | 25+ agent definitions |
| Commands | `.claude/commands/` | 20+ slash commands |

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Custom JWT over Supabase Auth | Existing demo_auth.py locked; migration deferred | 2026-03 |
| Single-tenant RLS (USING true) on operational tables | Acceptable for MVP; org-scoped on PII tables | 2026-03 |
| pnpm over npm | Workspace support, disk efficiency | 2025-12 |
| Turbo over Nx | Simpler config for this monorepo size | 2025-12 |
| Remotion over After Effects | Programmatic, version-controlled video generation | 2026-03 |
