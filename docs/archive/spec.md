# CCW-Online ERP - Master Specification v2.0

**Last Updated:** 2026-01-22
**Status:** Phase 1 Complete, Phase 2-5 Planned
**Version:** 2.0.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack-locked)
4. [Phase 1: Multi-Language Foundation (COMPLETE)](#4-phase-1-multi-language-foundation--complete)
5. [Phase 2: Google AP2 Integration (PLANNED)](#5-phase-2-google-ap2-integration-planned)
6. [Phase 3: Enhanced Shopify Backend (PLANNED)](#6-phase-3-enhanced-shopify-backend-planned)
7. [Phase 4: AI-Powered Search & Recommendations (PLANNED)](#7-phase-4-ai-powered-search--recommendations-planned--recommended-next)
8. [Phase 5: Autonomous Development Framework (PLANNED)](#8-phase-5-autonomous-development-framework-planned)
9. [API Specifications](#9-api-specifications)
10. [Database Schema](#10-database-schema)
11. [UI/UX Requirements](#11-uiux-requirements)
12. [Testing Requirements](#12-testing-requirements)
13. [Deployment Specifications](#13-deployment-specifications)
14. [Claude Code Framework Integration](#14-claude-code-framework-integration)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Production Roadmap (2026/27)](#16-production-roadmap-202627)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Appendices](#18-appendices)

---

## 1. Executive Summary

### 1.1 What is CCW-Online ERP

CCW-Online ERP is a modern, full-stack Equipment Supplier ERP system designed to replace legacy solutions like Cin7 with:
- **Fast, Modern Workflow**: Eliminates double handling and clunky UX
- **Full Warehouse Coverage**: Multi-location inventory, receiving, pick/pack/ship workflows
- **AI Intelligence**: Product recommendations, demand forecasting, sales insights
- **Multi-Language Support**: Serve international clients in their native language (10 languages)
- **Real-Time Integration**: Shopify, Xero, and custom integrations

### 1.2 Key Capabilities

**Current (Phase 1 Complete):**
- Full CRUD for Products, Customers, Orders, Quotes
- Purchase Order Management
- Multi-store Inventory Management
- Container Tracking & Backorder Management
- Multi-language UI and content (10 languages)
- Translation Management Dashboard
- AI-powered translation service
- Service Requests & Email Management
- Dashboard with AI Insights
- Agent Orchestration System
- Integrations: Xero, Shopify, SendGrid, ElevenLabs
- PRD Generator

**Planned (Phase 2-5):**
- Google AP2 payment processing with voice commerce
- Semantic search with vector embeddings
- AI product recommendations
- Voice search optimization
- Visual search capabilities
- Autonomous development agents
- Enhanced Shopify metafields and theme APIs
- Real-time inventory sync

### 1.3 Current Status

- **Phase 1:** ✅ COMPLETE (Multi-Language Foundation)
- **Phase 2:** 📋 PLANNED (Google AP2 Integration)
- **Phase 3:** 📋 PLANNED (Enhanced Shopify Backend)
- **Phase 4:** 📋 PLANNED (AI-Powered Search & Recommendations) ⭐ RECOMMENDED NEXT
- **Phase 5:** 📋 PLANNED (Autonomous Development Framework)

**Production Readiness:**
- Load tested with 10,000+ scenarios
- Comprehensive test suite (unit, integration, E2E)
- Performance targets: LCP < 2.5s, API p95 < 400ms
- Security: Allowlisted external fetches, no client-side secrets

### 1.4 Technology Choices

**Frontend:**
- Next.js 15 (App Router) - Modern React framework with server components
- React 19 - Latest React features and performance improvements
- TypeScript 5.7 - Type safety and developer experience
- Tailwind CSS v4 - Utility-first styling
- shadcn/ui - High-quality component library

**Backend:**
- FastAPI (Python 3.12) - High-performance async API framework
- SQLAlchemy 2.0 - Modern async ORM
- Pydantic v2 - Data validation and serialization
- LangGraph - AI agent orchestration
- Ollama - Local AI model inference

**Database & Infrastructure:**
- PostgreSQL 15 - Relational database with advanced features
- Supabase - Managed PostgreSQL with real-time capabilities
- Redis - Caching and session management
- Docker - Containerization for local development

### 1.5 Competitive Advantages

1. **Modern Architecture**: Next.js 15 + FastAPI = fast, maintainable, scalable
2. **AI-First Design**: Built-in agent orchestration, translation, recommendations
3. **Multi-Language Native**: Not bolted-on - designed for global markets
4. **Developer Experience**: Claude Code framework ensures quality and consistency
5. **Performance**: Sub-500ms API responses, < 2.5s page loads
6. **Extensibility**: Agent-based architecture allows easy feature additions

---

## 2. System Architecture

### 2.1 Overview

CCW-Online ERP uses a monorepo architecture with clearly separated frontend and backend applications, orchestrated via Turbo and managed with pnpm.

```
┌─────────────────────────────────────────────────────────────┐
│                        CCW-Online ERP                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐            ┌──────────────────┐      │
│  │   Frontend App   │            │   Backend API    │      │
│  │   (Next.js 15)   │◄──────────►│   (FastAPI)      │      │
│  │                  │    REST    │                  │      │
│  │  - Dashboard     │            │  - API Routes    │      │
│  │  - Portal        │            │  - Agents        │      │
│  │  - Admin         │            │  - Services      │      │
│  └──────────────────┘            └──────────────────┘      │
│           │                               │                 │
│           │                               │                 │
│           ▼                               ▼                 │
│  ┌──────────────────────────────────────────────────┐      │
│  │           PostgreSQL 15 (Supabase)               │      │
│  │                                                   │      │
│  │  - Core Tables (products, orders, customers)     │      │
│  │  - i18n Tables (translations)                    │      │
│  │  - Vector Extensions (pgvector) - Phase 4        │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │              External Integrations                │      │
│  │                                                   │      │
│  │  - Shopify (Product Feed)                        │      │
│  │  - Xero (Accounting)                             │      │
│  │  - SendGrid (Email)                              │      │
│  │  - ElevenLabs (Voice)                            │      │
│  │  - Ollama (AI Inference)                         │      │
│  │  - Google AP2 (Payments) - Phase 2              │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Monorepo Structure:**
```
C:\CCW-Online-ERP/
├── .claude/                    # Claude Code Framework
│   ├── agents/                 # Agent definitions
│   ├── skills/                 # Skill definitions
│   ├── commands/               # Command definitions
│   └── hooks/                  # Git hooks
├── apps/
│   ├── web/                    # Next.js 15 Frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   ├── lib/                # Utilities & API clients
│   │   └── middleware.ts       # Auth middleware
│   └── backend/                # FastAPI Backend
│       ├── src/
│       │   ├── ai/             # Agent orchestration
│       │   ├── api/            # API routes
│       │   ├── db/             # Database models
│       │   └── services/       # Business logic
│       └── tests/              # Test suite
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
└── package.json                # Workspace configuration
```

### 2.2 Frontend Architecture

**Framework:** Next.js 15 with App Router

**Key Patterns:**
- Server Components by default (better performance, SEO)
- Client Components only when needed (`"use client"`)
- Server Actions for mutations
- Route Groups for layout organization: `(dashboard)`, `(auth)`, `(portal)`

**Directory Structure:**
```
apps/web/app/
├── (auth)/                     # Authentication pages
│   └── login/page.tsx
├── (dashboard)/                # Protected dashboard
│   ├── layout.tsx              # Dashboard layout with sidebar
│   ├── dashboard/page.tsx      # Main dashboard
│   ├── products/page.tsx       # Products management
│   ├── customers/page.tsx      # Customer management
│   ├── orders/page.tsx         # Order management
│   ├── quotes/page.tsx         # Quote management
│   └── settings/
│       └── translations/       # Translation management
├── portal/                     # Customer-facing portal
│   ├── showroom/page.tsx       # Product showroom
│   ├── walk-in/page.tsx        # Walk-in checkout
│   ├── phone/page.tsx          # Phone orders
│   └── internet/page.tsx       # Online orders
└── api/                        # API routes (Next.js API routes)
    └── agents/                 # Agent endpoints
```

**Component Organization:**
```
apps/web/components/
├── ui/                         # shadcn/ui components
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── form.tsx
│   └── ...
├── layout/                     # Layout components
│   ├── sidebar.tsx
│   └── LanguageSwitcher.tsx
├── dashboard/                  # Dashboard widgets
│   ├── OrderStatusBreakdownWidget.tsx
│   └── RevenueByLocationWidget.tsx
└── portal/                     # Portal components
    ├── ProductSearch.tsx
    └── CustomerLookup.tsx
```

**State Management:**
- React hooks (useState, useReducer)
- Server State via Server Components
- No Redux/Zustand needed (kept simple)

**Form Handling:**
- React Hook Form + Zod validation
- Reference pattern: `apps/web/components/auth/login-form.tsx`

**API Client:**
- Centralized `apiClient` in `apps/web/lib/api/client.ts`
- Automatic JWT token handling
- Type-safe requests with TypeScript

### 2.3 Backend Architecture

**Framework:** FastAPI (Python 3.12)

**Key Patterns:**
- Async/await throughout
- Dependency injection for database sessions
- Pydantic models for request/response validation
- Agent-based architecture for AI features

**Directory Structure:**
```
apps/backend/src/
├── ai/                         # AI & Agent System
│   ├── agents/                 # Agent implementations
│   │   └── specialized/        # Task-specific agents
│   ├── orchestration/          # Agent orchestration
│   │   └── supervisor_agent.py # Routes tasks to agents
│   └── base_agent.py           # Base agent class
├── api/
│   ├── routes/                 # API endpoints
│   │   ├── products.py         # Product CRUD
│   │   ├── customers.py        # Customer CRUD
│   │   ├── orders.py           # Order CRUD
│   │   ├── quotes.py           # Quote CRUD
│   │   ├── translations.py     # i18n endpoints (Phase 1)
│   │   └── ai/                 # AI endpoints
│   ├── deps.py                 # Dependencies (DB sessions, auth)
│   └── main.py                 # FastAPI application
├── db/
│   ├── demo_models.py          # Core database models (LOCKED)
│   ├── i18n_models.py          # i18n models (Phase 1)
│   └── schemas.py              # Pydantic schemas
├── services/                   # Business logic
│   ├── i18n_service.py         # Translation service
│   └── ...
├── config/
│   ├── database.py             # Database connection
│   └── settings.py             # Application settings
└── integrations/               # External integrations
    ├── shopify/                # Shopify integration
    └── xero/                   # Xero integration
```

**Agent Architecture:**
```python
from abc import ABC, abstractmethod

class BaseAgent(ABC):
    """Base class for all agents."""

    def __init__(self, agent_id: str, name: str):
        self.agent_id = agent_id
        self.name = name
        self.capabilities = []

    @abstractmethod
    async def execute(self, task: str, context: dict) -> dict:
        """Execute a task."""
        pass

    async def stream(self, task: str, context: dict):
        """Stream execution results."""
        pass

# Agents auto-register with SupervisorAgent
# SupervisorAgent routes tasks to appropriate agent
```

**API Endpoint Pattern:**
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_async_db

router = APIRouter(prefix="/api", tags=["Products"])

@router.get("/products")
async def list_products(
    db: AsyncSession = Depends(get_async_db),
    page: int = 1,
    page_size: int = 50
) -> PaginatedResponse:
    """List products with pagination."""
    # Implementation
    pass
```

### 2.4 Database Architecture

**Database:** PostgreSQL 15 (Supabase-hosted)

**Key Features:**
- Row Level Security (RLS) for multi-tenancy
- Full-text search (tsvector)
- Vector extensions (pgvector) - Phase 4
- JSONB for flexible data
- UUID primary keys
- Timestamps for audit trails

**Schema Organization:**
- Core tables: Products, Customers, Orders, Quotes
- i18n tables: Translations for multi-language support
- Future tables: AP2, Embeddings, Recommendations

**Migration Strategy:**
- Alembic for schema migrations
- Seed scripts for demo data
- Supabase migration tooling

**Connection Pooling:**
- SQLAlchemy async engine
- Connection pool size: 20
- Max overflow: 10

### 2.5 Integration Architecture

**Pattern:** Dual-mode (demo/live) clients

```python
class IntegrationClient:
    """Base integration client."""

    def __init__(self, mode: Literal["demo", "live"] = "demo"):
        self.mode = mode
        self.client = self._get_client()

    def _get_client(self):
        if self.mode == "demo":
            return DemoClient()
        return LiveClient()
```

**Current Integrations:**

1. **Shopify**
   - Product feed import
   - Order sync
   - Inventory sync
   - Webhook handling
   - Location: `apps/backend/src/integrations/shopify/`

2. **Xero**
   - Invoice export
   - Payment sync
   - OAuth2 authentication
   - Location: `apps/backend/src/integrations/xero/`

3. **SendGrid**
   - Transactional emails
   - Email templates
   - Location: `apps/backend/src/integrations/sendgrid/`

4. **ElevenLabs**
   - Text-to-speech
   - Voice synthesis
   - Location: `apps/backend/src/integrations/elevenlabs/`

5. **Ollama**
   - Local AI inference
   - Translation generation
   - Location: `apps/backend/src/ai/ollama_client.py`

**Future Integrations (Phase 2-5):**
- Google AP2 (Phase 2)
- OpenAI (Phase 4 - embeddings)
- Stripe (optional payment gateway)

---

## 3. Technology Stack (LOCKED)

⚠️ **IMPORTANT:** This technology stack is locked. Any changes require explicit approval and a migration plan.

### 3.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | React framework |
| React | 19.x | UI library |
| TypeScript | 5.7.x | Type safety |
| Tailwind CSS | v4 | Styling |
| shadcn/ui | Latest | Component library |
| React Hook Form | Latest | Form handling |
| Zod | Latest | Validation |
| next-intl | 3.26.5 | Internationalization |

**Package Manager:** pnpm
**Build Tool:** Turbo (monorepo orchestration)

### 3.2 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.12+ | Programming language |
| FastAPI | Latest | Web framework |
| SQLAlchemy | 2.0.x | ORM (async) |
| Pydantic | v2 | Data validation |
| Alembic | Latest | Database migrations |
| LangGraph | Latest | Agent orchestration |
| passlib | Latest | Password hashing |
| python-jose | Latest | JWT tokens |

**Package Manager:** uv
**Testing:** pytest, pytest-asyncio

### 3.3 Database & Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 15.x | Primary database |
| Supabase | Latest | Managed PostgreSQL |
| Redis | Latest | Caching |
| Docker | Latest | Containerization |
| pgvector | Latest | Vector search (Phase 4) |

### 3.4 Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | JavaScript/TypeScript linting |
| Prettier | Code formatting |
| Pyright/mypy | Python type checking |
| Ruff | Python linting |
| Vitest | Frontend testing |
| Playwright | E2E testing |
| Lighthouse | Performance testing |

### 3.5 AI & ML Stack

| Technology | Purpose |
|------------|---------|
| Ollama | Local AI inference |
| LangGraph | Agent orchestration |
| OpenAI API | Embeddings (Phase 4) |
| pgvector | Vector storage (Phase 4) |

---

## 4. Phase 1: Multi-Language Foundation (✅ COMPLETE)

### 4.1 Overview

**Goal:** Build a comprehensive multi-language foundation to serve international clients in their native language.

**Status:** ✅ COMPLETE (100%)

**Languages Supported:**
1. English (en) - Default
2. Chinese Simplified (zh-CN)
3. Chinese Traditional (zh-TW)
4. Spanish (es)
5. Portuguese (pt)
6. Arabic (ar)
7. Vietnamese (vi)
8. Hindi (hi)
9. Tamil (ta)
10. Telugu (te)

**Key Features:**
- Database schema for storing translations
- AI-powered translation service (hybrid AI + human review)
- Translation Management Dashboard
- Cookie-based language switcher
- Multi-language product content
- Multi-language UI strings
- Multi-language email templates

### 4.2 Database Schema

**Tables Created:**

1. **languages**
   ```sql
   CREATE TABLE languages (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       code VARCHAR(10) NOT NULL UNIQUE,  -- e.g., 'en', 'zh-CN'
       name VARCHAR(100) NOT NULL,         -- English name
       native_name VARCHAR(100) NOT NULL,  -- Native name
       is_active BOOLEAN NOT NULL DEFAULT true,
       is_rtl BOOLEAN NOT NULL DEFAULT false,  -- Right-to-left
       sort_order INT NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```

2. **product_translations**
   ```sql
   CREATE TABLE product_translations (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
       language_code VARCHAR(10) NOT NULL REFERENCES languages(code),
       name VARCHAR(255) NOT NULL,
       description TEXT,
       short_description VARCHAR(500),
       specifications JSONB,
       translation_status VARCHAR(50) NOT NULL DEFAULT 'pending',
       translated_by VARCHAR(100),
       translated_at TIMESTAMPTZ,
       reviewed_by VARCHAR(100),
       reviewed_at TIMESTAMPTZ,
       meta_title VARCHAR(255),
       meta_description VARCHAR(500),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE(product_id, language_code)
   );
   ```

3. **category_translations**
4. **ui_translations**
5. **email_template_translations**
6. **translation_queue**

**Location:** `apps/backend/migrations/add_i18n_support.sql`

### 4.3 Backend Services

**I18nService** (`apps/backend/src/services/i18n_service.py`):
```python
class I18nService:
    """Manages translations and language support."""

    async def translate_product(
        self, db: AsyncSession, product_id: UUID, target_language: str
    ) -> dict:
        """Translate product using AI."""
        pass

    async def batch_translate_products(
        self, db: AsyncSession, product_ids: list[UUID], target_languages: list[str]
    ) -> dict:
        """Batch translate multiple products."""
        pass

    async def get_ui_translations(
        self, db: AsyncSession, namespace: str, language: str
    ) -> dict:
        """Get all UI translations for a namespace."""
        pass
```

**AI Translation:**
- Uses Ollama (Claude API) for initial translation
- Marks as `ai_generated` status
- Human review workflow available
- Context-aware translation (maintains technical terms)

### 4.4 Frontend Components

**LanguageSwitcher** (`apps/web/components/layout/LanguageSwitcher.tsx`):
```typescript
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleLanguageChange(newLocale: string) {
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  }

  return (
    <Select value={locale} onValueChange={handleLanguageChange}>
      {/* Language options */}
    </Select>
  );
}
```

**Translation Management Dashboard** (`apps/web/app/(dashboard)/settings/translations/`):
- View translation status for all products
- Bulk translate products
- Review AI-generated translations
- Approve/edit translations
- Export/import translation files

### 4.5 API Endpoints

**Location:** `apps/backend/src/api/routes/translations.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/languages` | GET | List available languages |
| `/api/translations/products/{id}` | GET | Get product translations |
| `/api/translations/products/{id}/{lang}` | POST | Create/update product translation |
| `/api/translations/products/batch` | POST | Batch translate products |
| `/api/translations/ui/{namespace}` | GET | Get UI translations |
| `/api/translations/queue` | GET | Get translation queue status |

**Accept-Language Header Support:**
All API endpoints now support the `Accept-Language` header to return translated content automatically.

### 4.6 Testing Coverage

**Unit Tests:**
- I18nService methods
- Language switching logic
- Translation queue processing

**Integration Tests:**
- API endpoints return correct translations
- Language cookie handling
- Batch translation workflow

**E2E Tests:**
- Language switcher functionality
- Translated product display
- Translation management dashboard

**Location:** `apps/backend/tests/` and `apps/web/__tests__/`

### 4.7 Deployment

**Database Migration:**
```bash
# Applied via Alembic
alembic upgrade head
```

**Environment Variables:**
```bash
# Ollama API for translations
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Default language
DEFAULT_LANGUAGE=en
```

**Demo Data:**
- 10 languages seeded
- Sample product translations (3 languages)
- UI translation files for all languages

### 4.8 Lessons Learned

**What Worked Well:**
- Hybrid AI + human review approach
- Cookie-based language switching (simple, effective)
- Separate translation tables (clean schema)
- Translation queue for async processing

**Challenges:**
- AI translation quality varies by language
- Technical terminology needs special handling
- Right-to-left (RTL) language support requires CSS adjustments

**Recommendations for Future Phases:**
- Add translation memory to reduce duplicate work
- Implement caching for translated content
- Consider professional translation service integration
- Add translation analytics (which languages are most used)


---

## 5. Phase 2: Google AP2 Integration (PLANNED)

### 5.1 Overview

**Goal:** Integrate Google Agent Payments Protocol (AP2) for frictionless payment processing, voice commerce, and agent-to-agent commerce.

**Status:** 📋 PLANNED
**Duration:** 2-3 weeks
**Estimated Tasks:** 35-40
**Dependencies:** Phase 1 (i18n foundation)

**Key Features:**
- Cryptographically-signed purchase mandates
- Voice commerce with Siri/Google Assistant
- Agent-to-agent autonomous commerce
- Webhook handling with audit trails
- Multi-language voice support

### 5.2 Database Schema

**Location:** `apps/backend/src/db/ap2_models.py`

**Tables:** ap2_connections, ap2_mandates, ap2_transactions, ap2_voice_sessions, ap2_agent_interactions, ap2_webhook_logs

### 5.3 Client Architecture

Dual-mode pattern (following Shopify/Xero):
- AP2LiveClient (production) → Google Cloud API
- AP2DemoClient (development) → Mock responses

### 5.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/integrations/ap2/mandates/intent` | POST | Create intent mandate |
| `/api/integrations/ap2/mandates/cart` | POST | Create cart mandate |
| `/api/integrations/ap2/mandates/{id}/verify` | POST | Verify mandate signature |
| `/api/integrations/ap2/payments/initiate` | POST | Initiate payment |
| `/api/integrations/ap2/voice/sessions` | POST | Start voice session |
| `/api/integrations/ap2/webhooks` | POST | Handle AP2 webhooks |

### 5.5 Voice Commerce Integration

**Flow:** User speaks in their language → VoiceCommerceAgent detects language + intent → SearchAgent finds products → Intent mandate created → User confirms → Cart mandate → Payment

---

## 6. Phase 3: Enhanced Shopify Backend (PLANNED)

### 6.1 Overview

**Goal:** Extend existing Shopify integration with custom metafields, theme APIs, real-time sync, and multi-language support.

**Status:** 📋 PLANNED
**Duration:** 1-2 weeks
**Estimated Tasks:** 20-25
**Dependencies:** Phase 1 (i18n)

**Key Features:**
- Custom metafields for CCW-specific product data
- Theme API endpoints for dynamic content
- Bidirectional real-time inventory sync
- Multi-language product sync to Shopify
- Advanced order validation

### 6.2 Database Schema Extensions

**Tables:** shopify_metafields, shopify_inventory_syncs, shopify_theme_endpoints

### 6.3 Theme API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/theme/product-availability/{sku}` | GET | Real-time stock check |
| `/theme/validate-order` | POST | Custom business validation |

---

## 7. Phase 4: AI-Powered Search & Recommendations (PLANNED) ⭐ RECOMMENDED NEXT

### 7.1 Overview

**Goal:** Transform product search and discovery with semantic search, AI recommendations, voice optimization, and visual search.

**Status:** 📋 PLANNED ⭐ RECOMMENDED NEXT
**Duration:** 3-4 weeks
**Estimated Tasks:** 40-45
**Dependencies:** Phase 1 (i18n)

**Key Features:**
- Semantic/vector search with natural language queries
- AI product recommendations
- Voice search optimization
- Visual search
- Real-time search suggestions
- Multi-language support

### 7.2 Database Schema

**Prerequisites:** `CREATE EXTENSION IF NOT EXISTS vector;`

**Tables:** product_embeddings (vector(1536)), product_recommendations, customer_product_interactions, product_co_occurrences, voice_search_sessions

### 7.3 Embedding Generation

- OpenAI `text-embedding-3-small`
- Batch generation
- Multi-language support
- Cost: ~$0.02 per 10K products

### 7.4 API Endpoints

**Search:**
- `/api/search/semantic` - Natural language search
- `/api/search/hybrid` - Vector + keyword
- `/api/search/suggest` - Real-time suggestions
- `/api/search/voice` - Voice input

**Recommendations:**
- `/api/recommendations/similar/{product_id}`
- `/api/recommendations/frequently-bought-together/{product_id}`
- `/api/recommendations/personalized/{customer_id}`
- `/api/recommendations/trending`

### 7.5 Performance Targets

- Semantic search: < 500ms (p95)
- Vector search: < 50ms (p95)
- Recommendations: < 200ms (p95)
- Search relevance: NDCG@10 > 0.7

---

## 8. Phase 5: Autonomous Development Framework (PLANNED)

### 8.1 Overview

**Goal:** Build a self-sustaining development system where AI agents autonomously plan, code, test, and deploy features.

**Status:** 📋 PLANNED
**Duration:** 2-3 weeks
**Estimated Tasks:** 30-35

**Key Features:**
- Autonomous implementation planning
- Production-quality code generation
- Automated testing and validation
- Intelligent error handling and recovery
- Safe deployment with rollback
- Human oversight and escalation

### 8.2 Specialized Development Agents

- DevelopmentAgent - Code generation
- TestingAgent - Test generation
- IntegrationTestAgent - E2E testing
- DeploymentAgent - Migration management
- EnhancementAgent - Code quality
- ProjectOrchestrator - Multi-phase coordination

### 8.3 Execution Loop

```
while project_not_complete:
    1. Get next task (priority + dependencies)
    2. Select agent
    3. Execute with retry (max 3)
    4. Validate
    5. If failure: retry or escalate
    6. If success: mark complete
```

### 8.4 Human Escalation

**When:**
- Critical failures after 3 retries
- Ambiguous requirements
- Schema changes
- Security-sensitive changes

**Notification includes:**
- Task description
- Failure history
- Attempted solutions
- Suggested actions

### 8.5 Safety & Governance

**Requires Human Approval:**
- Database schema changes
- Breaking API changes
- Security-sensitive code
- Production deployments



---

## 9. API Specifications

### 9.1 API Architecture

**Base URL**: `http://localhost:8000` (development) / `https://api.ccw-erp.com` (production)

**Authentication**: JWT Bearer token in Authorization header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Format**: All endpoints return JSON
```json
{
  "data": {...},
  "error": null,
  "timestamp": "2026-01-22T10:30:00Z"
}
```

**Error Format**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {"field": "email", "message": "Invalid email format"}
    ]
  },
  "status_code": 422
}
```

### 9.2 Authentication Endpoints

#### POST /api/auth/login
**Purpose**: Authenticate user and return JWT token

**Request**:
```json
{
  "email": "admin@demo.com",
  "password": "demo123"
}
```

**Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "admin@demo.com",
    "full_name": "Admin User",
    "role": "admin"
  }
}
```

#### POST /api/auth/refresh
**Purpose**: Refresh expired JWT token

**Request**:
```json
{
  "refresh_token": "..."
}
```

**Response** (200):
```json
{
  "access_token": "...",
  "token_type": "bearer"
}
```

### 9.3 Product Endpoints

#### GET /api/products
**Purpose**: List products with pagination and filtering

**Query Parameters**:
- `page` (int, default: 1): Page number
- `page_size` (int, default: 50, max: 100): Items per page
- `search` (string, optional): Search by name or SKU
- `category` (string, optional): Filter by category
- `language` (string, default: "en"): Language for translations

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "sku": "DRL-001",
      "name": "Cordless Drill 18V",
      "description": "Professional cordless drill...",
      "category": "power_tools",
      "price": 299.99,
      "cost": 180.00,
      "stock": 45,
      "warehouse_location": "A-12",
      "is_active": true,
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-20T14:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "page_size": 50,
  "total_pages": 3
}
```

#### POST /api/products
**Purpose**: Create new product

**Request**:
```json
{
  "sku": "SAW-001",
  "name": "Circular Saw 2000W",
  "description": "Heavy-duty circular saw",
  "category": "power_tools",
  "price": 349.99,
  "cost": 210.00,
  "stock": 20,
  "warehouse_location": "B-5"
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "sku": "SAW-001",
  "name": "Circular Saw 2000W",
  ...
}
```

#### PUT /api/products/{id}
**Purpose**: Update existing product

**Request**: Same as POST but all fields optional

**Response** (200): Updated product object

#### DELETE /api/products/{id}
**Purpose**: Delete product (soft delete - sets is_active=false)

**Response** (204): No content

### 9.4 Order Endpoints

#### GET /api/orders
**Purpose**: List orders with filtering

**Query Parameters**:
- `page`, `page_size` (pagination)
- `status` (string, optional): Filter by order status
- `customer_id` (UUID, optional): Filter by customer
- `date_from`, `date_to` (date, optional): Date range filter

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "order_number": "ORD-2026-001",
      "customer_id": "uuid",
      "customer_name": "ABC Construction",
      "order_date": "2026-01-22T09:00:00Z",
      "status": "confirmed",
      "total": 1599.95,
      "items": [
        {
          "id": "uuid",
          "product_id": "uuid",
          "product_name": "Cordless Drill 18V",
          "quantity": 5,
          "unit_price": 299.99,
          "subtotal": 1499.95
        }
      ],
      "notes": "Delivery by Friday",
      "created_at": "2026-01-22T09:00:00Z",
      "updated_at": "2026-01-22T09:15:00Z"
    }
  ],
  "total": 87,
  "page": 1,
  "page_size": 50,
  "total_pages": 2
}
```

#### POST /api/orders
**Purpose**: Create new order

**Request**:
```json
{
  "customer_id": "uuid",
  "status": "draft",
  "notes": "Urgent order",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 5
    }
  ]
}
```

**Response** (201): Order object with auto-calculated totals

#### PUT /api/orders/{id}/status
**Purpose**: Update order status

**Request**:
```json
{
  "status": "shipped",
  "tracking_number": "TRK-12345",
  "carrier": "Australia Post"
}
```

**Response** (200): Updated order object

### 9.5 Translation Endpoints (Phase 1)

#### GET /api/translations/ui/{namespace}
**Purpose**: Get UI translations for a namespace and language

**Query Parameters**:
- `language` (string, required): Language code (e.g., "zh-CN")

**Response** (200):
```json
{
  "namespace": "products",
  "language": "zh-CN",
  "translations": {
    "title": "产品",
    "add": "添加产品",
    "edit": "编辑产品",
    "name": "产品名称",
    "sku": "SKU",
    "price": "价格"
  }
}
```

#### POST /api/translations/products/{id}/translate
**Purpose**: Translate product to target languages

**Request**:
```json
{
  "target_languages": ["zh-CN", "es", "pt"],
  "priority": 5
}
```

**Response** (202):
```json
{
  "message": "Translation queued",
  "queue_entries": [
    {
      "id": "uuid",
      "entity_type": "product",
      "entity_id": "uuid",
      "target_language": "zh-CN",
      "status": "pending"
    }
  ]
}
```

### 9.6 Search & Recommendation Endpoints (Phase 4)

#### POST /api/search/semantic
**Purpose**: Perform semantic search using embeddings

**Request**:
```json
{
  "query": "drill for concrete walls",
  "language": "en",
  "limit": 20,
  "filters": {
    "category": "power_tools",
    "price_max": 500
  }
}
```

**Response** (200):
```json
{
  "results": [
    {
      "product_id": "uuid",
      "score": 0.87,
      "product": {
        "sku": "DRL-002",
        "name": "Hammer Drill 1200W",
        "description": "Perfect for concrete and masonry...",
        "price": 399.99
      }
    }
  ],
  "query_time_ms": 145
}
```

#### GET /api/recommendations/{product_id}
**Purpose**: Get product recommendations

**Query Parameters**:
- `type` (string): "similar" | "complementary" | "frequently_bought_together"
- `limit` (int, default: 10)

**Response** (200):
```json
{
  "recommendations": [
    {
      "product_id": "uuid",
      "score": 0.92,
      "reason": "frequently_bought_together",
      "product": {...}
    }
  ]
}
```

### 9.7 Agent Endpoints

#### POST /api/ai/agents/execute
**Purpose**: Execute a task via AI agent orchestration

**Request**:
```json
{
  "task": "Find low-stock products that need reordering",
  "context": {
    "min_stock_level": 10
  }
}
```

**Response** (200):
```json
{
  "task_id": "uuid",
  "agent_id": "procurement_agent",
  "status": "completed",
  "outputs": [
    {
      "type": "product_list",
      "data": [...]
    }
  ],
  "execution_time_ms": 1234
}
```

#### GET /api/ai/agents/health
**Purpose**: Get health status of all registered agents

**Response** (200):
```json
{
  "agents": [
    {
      "agent_id": "pricing_agent",
      "status": "active",
      "response_time_ms": 45,
      "last_execution": "2026-01-22T10:25:00Z"
    }
  ]
}
```

### 9.8 Rate Limiting

**Global Limits**:
- **Anonymous**: 100 requests/hour
- **Authenticated**: 1000 requests/hour
- **Admin**: 5000 requests/hour

**Headers**:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1674391200
```

**Rate Limit Exceeded** (429):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retry_after": 3600
  }
}
```

### 9.9 API Versioning

**Current Version**: v1 (implicit in routes)
**Future Versioning**: When breaking changes needed, use `/api/v2/...`

**Deprecation Policy**:
- Deprecated endpoints marked in docs
- 6-month warning period before removal
- Support both v1 and v2 during transition

---

## 10. Database Schema Reference

### 10.1 Core Tables

#### users
**Purpose**: User authentication and authorization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | User ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address |
| hashed_password | VARCHAR(255) | NOT NULL | bcrypt hashed password |
| full_name | VARCHAR(255) | NULL | Full name |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'employee' | User role |
| is_admin | BOOLEAN | NOT NULL, DEFAULT false | Admin flag |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active flag |
| organization_id | UUID | FK(organizations) | Organization |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Update timestamp |

**Indexes**:
- `idx_users_email` on email
- `idx_users_organization` on organization_id
- `idx_users_active` on is_active

#### products
**Purpose**: Product catalog

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Product ID |
| sku | VARCHAR(100) | UNIQUE, NOT NULL | Stock keeping unit |
| name | VARCHAR(255) | NOT NULL | Product name |
| description | TEXT | NULL | Product description |
| category | VARCHAR(100) | NOT NULL | Category enum |
| price | DECIMAL(10,2) | NOT NULL, CHECK >= 0 | Selling price |
| cost | DECIMAL(10,2) | NULL, CHECK >= 0 | Cost price |
| stock | INTEGER | NOT NULL, DEFAULT 0 | Stock quantity |
| warehouse_location | VARCHAR(50) | NULL | Location code |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active flag |
| organization_id | UUID | FK(organizations) | Organization |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

**Indexes**:
- `idx_products_sku` on sku
- `idx_products_category` on category
- `idx_products_stock` on stock (for low stock alerts)
- `idx_products_active` on is_active

**Enums**:
```sql
CREATE TYPE product_category AS ENUM (
  'heavy_machinery',
  'hand_tools',
  'power_tools',
  'safety_equipment',
  'building_materials',
  'electrical',
  'plumbing',
  'accessories'
);
```

#### customers
**Purpose**: Customer directory

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Customer ID |
| customer_number | VARCHAR(50) | UNIQUE, NOT NULL | Customer number |
| company_name | VARCHAR(255) | NOT NULL | Company name |
| contact_name | VARCHAR(255) | NULL | Contact person |
| email | VARCHAR(255) | NULL | Email address |
| phone | VARCHAR(50) | NULL | Phone number |
| address | TEXT | NULL | Street address |
| city | VARCHAR(100) | NULL | City |
| state | VARCHAR(50) | NULL | State/province |
| postcode | VARCHAR(20) | NULL | Postal code |
| country | VARCHAR(100) | DEFAULT 'Australia' | Country |
| xero_contact_id | VARCHAR(255) | NULL | Xero integration ID |
| xero_synced_at | TIMESTAMPTZ | NULL | Last Xero sync |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active flag |
| organization_id | UUID | FK(organizations) | Organization |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

**Indexes**:
- `idx_customers_number` on customer_number
- `idx_customers_email` on email
- `idx_customers_company` on company_name
- `idx_customers_xero` on xero_contact_id

#### orders
**Purpose**: Sales orders

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Order ID |
| order_number | VARCHAR(50) | UNIQUE, NOT NULL | Order number (ORD-YYYY-NNN) |
| customer_id | UUID | FK(customers), NOT NULL | Customer |
| order_date | TIMESTAMPTZ | NOT NULL | Order date |
| status | VARCHAR(50) | NOT NULL | Order status enum |
| total | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Total amount |
| notes | TEXT | NULL | Order notes |
| fulfillment_location | VARCHAR(100) | NULL | Fulfillment location |
| tracking_number | VARCHAR(255) | NULL | Shipping tracking |
| carrier_name | VARCHAR(100) | NULL | Carrier name |
| shipped_date | TIMESTAMPTZ | NULL | Ship date |
| delivered_date | TIMESTAMPTZ | NULL | Delivery date |
| organization_id | UUID | FK(organizations) | Organization |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

**Enums**:
```sql
CREATE TYPE order_status AS ENUM (
  'draft',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
);
```

**Indexes**:
- `idx_orders_number` on order_number
- `idx_orders_customer` on customer_id
- `idx_orders_status` on status
- `idx_orders_date` on order_date

#### order_items
**Purpose**: Order line items

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Item ID |
| order_id | UUID | FK(orders) ON DELETE CASCADE | Order |
| product_id | UUID | FK(products) | Product |
| quantity | INTEGER | NOT NULL, CHECK > 0 | Quantity |
| unit_price | DECIMAL(10,2) | NOT NULL, CHECK >= 0 | Unit price |
| subtotal | DECIMAL(10,2) | NOT NULL, CHECK >= 0 | Subtotal (qty × price) |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

**Indexes**:
- `idx_order_items_order` on order_id
- `idx_order_items_product` on product_id

#### quotes
**Purpose**: Customer quotes

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Quote ID |
| quote_number | VARCHAR(50) | UNIQUE, NOT NULL | Quote number (Q-YYYY-NNN) |
| customer_id | UUID | FK(customers), NOT NULL | Customer |
| quote_date | TIMESTAMPTZ | NOT NULL | Quote date |
| valid_until | DATE | NOT NULL | Expiry date |
| status | VARCHAR(50) | NOT NULL | Quote status enum |
| total | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Total amount |
| notes | TEXT | NULL | Quote notes |
| organization_id | UUID | FK(organizations) | Organization |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

**Enums**:
```sql
CREATE TYPE quote_status AS ENUM (
  'draft',
  'pending',
  'sent',
  'accepted',
  'rejected',
  'expired'
);
```

#### quote_items
**Purpose**: Quote line items (same structure as order_items)

### 10.2 i18n Tables (Phase 1)

#### languages
**Purpose**: Language configuration

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Language ID |
| code | VARCHAR(10) | UNIQUE, NOT NULL | ISO code (e.g., 'zh-CN') |
| name | VARCHAR(100) | NOT NULL | English name |
| native_name | VARCHAR(100) | NOT NULL | Native name (e.g., '中文') |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active flag |
| is_rtl | BOOLEAN | NOT NULL, DEFAULT false | Right-to-left |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Display order |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

#### product_translations
**Purpose**: Product translations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Translation ID |
| product_id | UUID | FK(products) ON DELETE CASCADE | Product |
| language_code | VARCHAR(10) | FK(languages.code) | Language |
| name | VARCHAR(255) | NOT NULL | Translated name |
| description | TEXT | NULL | Translated description |
| short_description | VARCHAR(500) | NULL | Short description |
| specifications | JSONB | NULL | Translated specs |
| translation_status | VARCHAR(50) | NOT NULL, DEFAULT 'pending' | Status |
| translated_by | VARCHAR(100) | NULL | Translator (ai/user) |
| translated_at | TIMESTAMPTZ | NULL | Translation timestamp |
| reviewed_by | VARCHAR(100) | NULL | Reviewer |
| reviewed_at | TIMESTAMPTZ | NULL | Review timestamp |
| meta_title | VARCHAR(255) | NULL | SEO title |
| meta_description | VARCHAR(500) | NULL | SEO description |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

**Constraints**:
- UNIQUE(product_id, language_code)

**Indexes**:
- `idx_product_translations_product` on product_id
- `idx_product_translations_lang` on language_code
- `idx_product_translations_status` on translation_status

#### ui_translations
**Purpose**: UI string translations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Translation ID |
| namespace | VARCHAR(100) | NOT NULL | Namespace (e.g., 'products') |
| key | VARCHAR(255) | NOT NULL | Key (e.g., 'button.save') |
| language_code | VARCHAR(10) | FK(languages.code) | Language |
| value | TEXT | NOT NULL | Translated value |
| context | TEXT | NULL | Context for translators |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

**Constraints**:
- UNIQUE(namespace, key, language_code)

**Indexes**:
- `idx_ui_translations_lookup` on (namespace, language_code)

### 10.3 AI Search Tables (Phase 4)

#### product_embeddings
**Purpose**: Vector embeddings for semantic search

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Embedding ID |
| product_id | UUID | FK(products) ON DELETE CASCADE | Product |
| language_code | VARCHAR(10) | FK(languages.code) | Language |
| embedding | vector(1536) | NOT NULL | OpenAI embedding |
| model_version | VARCHAR(50) | NOT NULL | Model version |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Constraints**:
- UNIQUE(product_id, language_code)

**Indexes**:
```sql
-- Vector similarity index (IVFFlat)
CREATE INDEX idx_product_embeddings_vector
ON product_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

#### product_recommendations
**Purpose**: Precomputed recommendations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Recommendation ID |
| source_product_id | UUID | FK(products) | Source product |
| recommended_product_id | UUID | FK(products) | Recommended product |
| recommendation_type | VARCHAR(50) | NOT NULL | Type (similar/complementary/bought_together) |
| score | DECIMAL(5,4) | NOT NULL, CHECK 0-1 | Recommendation score |
| reason | TEXT | NULL | Reason |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Update timestamp |

**Indexes**:
- `idx_recommendations_source` on (source_product_id, recommendation_type)
- `idx_recommendations_score` on score DESC

### 10.4 Relationships

```
organizations
  ├─ users (1:N)
  ├─ products (1:N)
  ├─ customers (1:N)
  ├─ orders (1:N)
  └─ quotes (1:N)

customers
  ├─ orders (1:N)
  └─ quotes (1:N)

orders
  └─ order_items (1:N) CASCADE DELETE
      └─ products (N:1)

quotes
  └─ quote_items (1:N) CASCADE DELETE
      └─ products (N:1)

products
  ├─ product_translations (1:N) CASCADE DELETE
  ├─ product_embeddings (1:N) CASCADE DELETE
  ├─ product_recommendations (1:N source)
  └─ product_recommendations (1:N recommended)

languages
  ├─ product_translations (1:N)
  └─ ui_translations (1:N)
```

---

## 11. UI/UX Requirements

### 11.1 Design System

**Framework**: shadcn/ui + Tailwind CSS v4

**Color Palette**:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}
```

**Typography**:
- **Headings**: Inter (system font fallback)
- **Body**: Inter
- **Monospace**: JetBrains Mono (code/SKUs)

**Spacing Scale**: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64

### 11.2 Responsive Breakpoints

```typescript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablets
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Extra large
}
```

**Mobile-First Approach**: Design for mobile first, then enhance for larger screens

**Grid System**:
```typescript
// 1 column on mobile, 2 on tablet, 3 on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

### 11.3 Component Library

**Core Components** (from shadcn/ui):
- `Button` - Primary, secondary, destructive, ghost variants
- `Input` - Text, number, email, password types
- `Select` - Dropdown select with search
- `Dialog` - Modal dialogs
- `AlertDialog` - Confirmation dialogs for destructive actions
- `Toast` - Notification toasts
- `Form` - Form wrapper with React Hook Form integration
- `Table` - Data tables with sorting
- `Card` - Content cards
- `Badge` - Status badges
- `Tabs` - Tab navigation

**Custom Components**:
- `DataTable` - Enhanced table with pagination, sorting, filtering
- `LanguageSwitcher` - Language selection dropdown
- `Sidebar` - Navigation sidebar
- `ProductCard` - Product display card
- `OrderStatusBadge` - Colored order status badges
- `SemanticSearchBar` - Search bar with voice input

### 11.4 Accessibility Requirements

**WCAG 2.1 Level AA Compliance**:
- ✅ Color contrast ratio ≥ 4.5:1 for normal text
- ✅ Color contrast ratio ≥ 3:1 for large text
- ✅ Keyboard navigation support (Tab, Enter, Escape)
- ✅ Screen reader support (ARIA labels)
- ✅ Focus indicators visible
- ✅ Error messages associated with form fields

**Implementation**:
```typescript
// Proper ARIA labels
<Button aria-label="Delete product" onClick={handleDelete}>
  <TrashIcon />
</Button>

// Form field associations
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" aria-describedby="email-error" />
<p id="email-error" role="alert">Invalid email format</p>
```

### 11.5 Multi-Language UI (Phase 1)

**Language Switcher**:
- Location: Header top-right corner
- Display: Flag emoji + language name (native)
- Behavior: Cookie-based persistence, no page reload

**RTL Support**:
- Automatic layout flip for Arabic
- Text alignment: right-to-left
- Icons: mirrored positions

**Text Expansion**:
- Design allows 30% text expansion for translations
- No truncation of critical information
- Responsive layouts adapt to longer text

### 11.6 Loading States

**Skeleton Loaders**: Use for initial page loads
```typescript
<Skeleton className="h-12 w-full" />
<Skeleton className="h-4 w-3/4" />
```

**Spinners**: Use for button actions
```typescript
<Button disabled={isLoading}>
  {isLoading && <Spinner className="mr-2" />}
  {isLoading ? "Saving..." : "Save"}
</Button>
```

**Progress Bars**: Use for long-running tasks (translations, exports)

### 11.7 Error States

**Inline Validation Errors**: Show below form fields
```typescript
<FormMessage>{errors.email?.message}</FormMessage>
```

**Toast Notifications**: Show for API errors
```typescript
toast({
  title: "Error",
  description: "Failed to save product. Please try again.",
  variant: "destructive"
})
```

**Empty States**: Show when no data available
```typescript
<EmptyState
  icon={<PackageIcon />}
  title="No products found"
  description="Create your first product to get started"
  action={<Button>Add Product</Button>}
/>
```

### 11.8 Confirmation Dialogs

**Delete Confirmations**: Always required for destructive actions
```typescript
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete "{productName}". This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-destructive">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 11.9 Performance Requirements

**Metrics**:
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Cumulative Layout Shift (CLS)**: < 0.1

**Optimization Techniques**:
- Code splitting per route
- Image optimization (Next.js Image component)
- Lazy loading for below-the-fold content
- Debounced search inputs (300ms)
- Virtual scrolling for large lists (100+ items)

---

## 12. Testing Requirements

### 12.1 Test Coverage Targets

**Overall Coverage**: ≥ 80% for critical paths

**By Type**:
- **Unit Tests**: 90% coverage for utilities, services, agents
- **Integration Tests**: 80% coverage for API endpoints
- **E2E Tests**: Critical user flows (login, create order, search)

### 12.2 Frontend Testing

**Framework**: Vitest + React Testing Library + Playwright

**Unit Tests** (`apps/web/__tests__/`):
```typescript
// Example: ProductForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProductForm } from '@/app/(dashboard)/products/components/ProductForm'

describe('ProductForm', () => {
  test('shows validation error for empty SKU', async () => {
    render(<ProductForm mode="create" />)

    const submitButton = screen.getByRole('button', { name: /create/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/sku is required/i)).toBeInTheDocument()
    })
  })

  test('creates product successfully', async () => {
    render(<ProductForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/sku/i), {
      target: { value: 'TEST-001' }
    })
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test Product' }
    })

    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByText(/created successfully/i)).toBeInTheDocument()
    })
  })
})
```

**E2E Tests** (`apps/web/e2e/`):
```typescript
// Example: order-flow.spec.ts
import { test, expect } from '@playwright/test'

test('complete order flow', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.fill('[name="email"]', 'admin@demo.com')
  await page.fill('[name="password"]', 'demo123')
  await page.click('button[type="submit"]')

  // Navigate to orders
  await page.click('text=Orders')
  await expect(page).toHaveURL('/orders')

  // Create new order
  await page.click('text=New Order')
  await page.selectOption('[name="customer_id"]', { index: 1 })
  await page.click('text=Add Item')
  await page.selectOption('[name="items[0].product_id"]', { index: 1 })
  await page.fill('[name="items[0].quantity"]', '5')
  await page.click('button:has-text("Create Order")')

  // Verify success
  await expect(page.locator('text=Order created successfully')).toBeVisible()
  await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+/)
})
```

### 12.3 Backend Testing

**Framework**: pytest + pytest-asyncio

**Unit Tests** (`apps/backend/tests/`):
```python
# Example: test_product_service.py
import pytest
from src.services.product_service import ProductService

@pytest.mark.asyncio
async def test_create_product(async_db_session):
    service = ProductService(async_db_session)

    product_data = {
        "sku": "TEST-001",
        "name": "Test Product",
        "category": "power_tools",
        "price": 99.99,
        "stock": 10
    }

    product = await service.create_product(product_data)

    assert product.sku == "TEST-001"
    assert product.name == "Test Product"
    assert product.price == 99.99

@pytest.mark.asyncio
async def test_create_product_duplicate_sku(async_db_session):
    service = ProductService(async_db_session)

    # Create first product
    await service.create_product({"sku": "DUP-001", ...})

    # Attempt duplicate
    with pytest.raises(IntegrityError):
        await service.create_product({"sku": "DUP-001", ...})
```

**Integration Tests**:
```python
# Example: test_api_products.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_list_products(async_client: AsyncClient, auth_headers):
    response = await async_client.get(
        "/api/products",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data
    assert isinstance(data["data"], list)

@pytest.mark.asyncio
async def test_create_product_unauthorized(async_client: AsyncClient):
    response = await async_client.post(
        "/api/products",
        json={"sku": "TEST-001", ...}
    )

    assert response.status_code == 401
```

### 12.4 AI Agent Testing

**Test Agent Capabilities**:
```python
# Example: test_search_agent.py
@pytest.mark.asyncio
async def test_search_agent_natural_language_query(async_db_session):
    agent = SearchAgent()

    result = await agent.execute(
        task="Find drills suitable for concrete",
        context={"language": "en"}
    )

    assert result["status"] == "completed"
    assert len(result["outputs"]) > 0
    assert all("drill" in p["name"].lower() for p in result["outputs"])

@pytest.mark.asyncio
async def test_search_agent_multi_language(async_db_session):
    agent = SearchAgent()

    # English query
    result_en = await agent.execute(
        task="drill",
        context={"language": "en"}
    )

    # Chinese query
    result_zh = await agent.execute(
        task="钻孔机",
        context={"language": "zh-CN"}
    )

    assert result_en["status"] == "completed"
    assert result_zh["status"] == "completed"
```

### 12.5 Load Testing

**Framework**: Locust

**Target**: 1000 concurrent users

**Scenarios**:
1. **Product Search**: 50% of traffic
   - GET /api/products?search=drill
   - Target: p95 < 500ms

2. **Order Creation**: 30% of traffic
   - POST /api/orders
   - Target: p95 < 1000ms

3. **Semantic Search**: 20% of traffic
   - POST /api/search/semantic
   - Target: p95 < 500ms

**Load Test Script**:
```python
# locustfile.py
from locust import HttpUser, task, between

class ERPUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # Login
        response = self.client.post("/api/auth/login", json={
            "email": "test@demo.com",
            "password": "test123"
        })
        self.token = response.json()["access_token"]

    @task(5)  # 50% weight
    def search_products(self):
        self.client.get(
            "/api/products?search=drill",
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(3)  # 30% weight
    def create_order(self):
        self.client.post(
            "/api/orders",
            json={
                "customer_id": "...",
                "items": [{"product_id": "...", "quantity": 1}]
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(2)  # 20% weight
    def semantic_search(self):
        self.client.post(
            "/api/search/semantic",
            json={"query": "drill for concrete", "language": "en"},
            headers={"Authorization": f"Bearer {self.token}"}
        )
```

**Run Command**:
```bash
locust -f locustfile.py --host=http://localhost:8000 --users=1000 --spawn-rate=50
```

### 12.6 Security Testing

**Tools**: OWASP ZAP, Bandit (Python security linter)

**Test Coverage**:
1. **Authentication**:
   - ✅ Unauthorized access returns 401
   - ✅ Invalid tokens rejected
   - ✅ Expired tokens refreshed properly

2. **Authorization**:
   - ✅ Role-based access control enforced
   - ✅ Users cannot access other organizations' data

3. **Input Validation**:
   - ✅ SQL injection prevention (parameterized queries)
   - ✅ XSS prevention (input sanitization)
   - ✅ CSRF protection (CORS configured)

4. **Data Protection**:
   - ✅ Passwords hashed with bcrypt
   - ✅ Sensitive data not logged
   - ✅ HTTPS enforced in production

**Security Test Example**:
```python
@pytest.mark.asyncio
async def test_sql_injection_prevention(async_client: AsyncClient):
    # Attempt SQL injection in search
    response = await async_client.get(
        "/api/products?search=' OR '1'='1"
    )

    # Should not return all products (should return 0 or error)
    assert response.status_code in [200, 400]
    if response.status_code == 200:
        assert len(response.json()["data"]) == 0
```

### 12.7 Multi-Language Testing (Phase 1)

**Test Coverage**:
1. **UI Translations**:
   - ✅ All namespaces have translations for all 10 languages
   - ✅ No missing translation keys
   - ✅ Text fits in UI elements (no overflow)

2. **Product Translations**:
   - ✅ AI translation generates correct language
   - ✅ Translation status tracked correctly
   - ✅ Fallback to English when translation missing

3. **Search**:
   - ✅ Semantic search works in all languages
   - ✅ Language-specific embeddings used correctly

### 12.8 Test Automation

**CI/CD Pipeline**:
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - name: Install dependencies
        run: cd apps/backend && uv sync
      - name: Run tests
        run: cd apps/backend && uv run pytest --cov
      - name: Type check
        run: cd apps/backend && uv run mypy src/

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test --filter=web
      - run: pnpm type-check --filter=web
```

### 12.9 Test Data Management

**Fixtures**: Use pytest fixtures for reusable test data
```python
@pytest.fixture
async def sample_product(async_db_session):
    product = Product(
        sku="TEST-001",
        name="Test Product",
        category=ProductCategory.POWER_TOOLS,
        price=99.99,
        stock=10
    )
    async_db_session.add(product)
    await async_db_session.commit()
    return product
```

**Database Reset**: Reset database between test runs
```python
@pytest.fixture(scope="function", autouse=True)
async def reset_db(async_db_session):
    # Truncate all tables
    await async_db_session.execute("TRUNCATE TABLE products CASCADE")
    await async_db_session.commit()
```

### 12.10 Acceptance Criteria for Tests

**Before Production Deployment**:
- ✅ All unit tests passing (100%)
- ✅ All integration tests passing (100%)
- ✅ All E2E tests passing (100%)
- ✅ Code coverage ≥ 80% for critical paths
- ✅ Load test passed (1000 concurrent users, all endpoints meet performance targets)
- ✅ Security scan passed (no critical/high vulnerabilities)
- ✅ Manual exploratory testing completed
- ✅ Cross-browser testing completed (Chrome, Safari, Firefox, Edge)
- ✅ Multi-language testing completed (all 10 languages)



---

## 13. Deployment Specifications

### 13.1 Environment Configuration

**Environments**:
1. **Development** (local)
   - Docker Compose for PostgreSQL
   - Local Redis (optional)
   - Environment: `.env.local`

2. **Staging** (Supabase/Vercel)
   - Supabase PostgreSQL
   - Vercel deployment (preview branches)
   - Environment: `.env.staging`

3. **Production** (Supabase/Vercel)
   - Supabase PostgreSQL (production instance)
   - Vercel deployment (main branch)
   - Environment: `.env.production`

### 13.2 Environment Variables

**Backend** (`apps/backend/.env`):
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/ccw_erp
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Authentication
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60

# AI Services
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
OLLAMA_BASE_URL=http://localhost:11434

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
CACHE_ENABLED=true

# Integrations
XERO_CLIENT_ID=xxx
XERO_CLIENT_SECRET=xxx
SHOPIFY_API_KEY=xxx
SHOPIFY_API_SECRET=xxx
GOOGLE_AP2_API_KEY=xxx

# Environment
ENVIRONMENT=development
DEBUG=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Frontend** (`apps/web/.env.local`):
```bash
# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_API_TIMEOUT=30000

# Environment
NEXT_PUBLIC_ENVIRONMENT=development

# Supabase (if using direct client)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### 13.3 Database Migrations

**Tool**: Supabase migrations (SQL files)

**Migration Location**: `apps/backend/migrations/`

**Migration Workflow**:
```bash
# Create new migration
supabase migration new migration_name

# Apply migrations to local database
supabase db push

# Apply migrations to staging/production
supabase db push --linked

# Rollback migration (manual SQL required)
# Create a new migration that reverses the changes
```

**Critical Migrations** (already created):
1. `20240101_initial_schema.sql` - Core tables (users, products, customers, orders, quotes)
2. `add_i18n_support.sql` - Multi-language tables (Phase 1)
3. `add_ai_search.sql` - Vector search tables (Phase 4)
4. `add_ap2_integration.sql` - Google AP2 tables (Phase 2)

### 13.4 CI/CD Pipeline

**Platform**: GitHub Actions

**Workflow**: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install
      - name: Type check
        run: pnpm turbo run type-check
      - name: Lint
        run: pnpm turbo run lint
      - name: Test
        run: pnpm turbo run test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: |
          # Deploy backend to cloud provider
          # (Railway, Fly.io, or AWS Lambda)

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 13.5 Database Backup Strategy

**Supabase Automatic Backups**:
- Daily automatic backups (retained for 7 days)
- Point-in-time recovery (up to 7 days)
- Manual backups before major migrations

**Manual Backup Command**:
```bash
# Backup database
pg_dump "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" < backup_20260122_103000.sql
```

**Backup Schedule**:
- **Daily**: Automated via Supabase (7-day retention)
- **Weekly**: Manual full backup (30-day retention)
- **Pre-migration**: Manual backup before any schema change

### 13.6 Rollback Procedures

**Frontend Rollback** (Vercel):
```bash
# Vercel automatically keeps deployment history
# Rollback via Vercel dashboard: Deployments → [Previous deployment] → Promote to Production

# OR via CLI:
vercel rollback [deployment-url]
```

**Backend Rollback**:
```bash
# If using Docker:
docker-compose down
docker-compose up -d --build [previous-image-tag]

# If using serverless (Vercel, Railway):
# Rollback via platform dashboard to previous deployment
```

**Database Rollback**:
```bash
# Restore from backup
psql "postgresql://..." < backup_pre_migration.sql

# OR apply reverse migration
supabase migration new rollback_[feature]
# Write SQL to undo changes
supabase db push
```

### 13.7 Health Check Endpoints

**Backend Health Check**: `GET /health`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-01-22T10:30:00Z"
}
```

**Frontend Health Check**: `GET /api/health`
```json
{
  "status": "healthy",
  "backend": "reachable",
  "timestamp": "2026-01-22T10:30:00Z"
}
```

**Monitoring Integration**:
- UptimeRobot or similar for endpoint monitoring
- Alert if health check fails 3 times consecutively
- Slack/email notifications

### 13.8 Deployment Checklist

**Pre-Deployment**:
- ✅ All tests passing (CI/CD pipeline green)
- ✅ Type checks passing
- ✅ Linting passing
- ✅ Code review approved
- ✅ Database backup created
- ✅ Environment variables configured
- ✅ Secrets rotated (if necessary)
- ✅ Migration tested on staging

**Deployment**:
- ✅ Apply database migrations
- ✅ Deploy backend
- ✅ Deploy frontend
- ✅ Health checks passing
- ✅ Smoke tests passing

**Post-Deployment**:
- ✅ Monitor error rates (first 1 hour)
- ✅ Monitor performance metrics
- ✅ Verify critical user flows
- ✅ Check logs for anomalies
- ✅ Update deployment documentation

### 13.9 Secrets Management

**Tool**: Vercel Environment Variables + GitHub Secrets

**Secrets Hierarchy**:
1. **Development**: `.env.local` (gitignored)
2. **Staging**: Vercel environment variables (staging environment)
3. **Production**: Vercel environment variables (production environment)

**Secret Rotation Policy**:
- **API Keys**: Rotate every 90 days
- **JWT Secret**: Rotate every 180 days
- **Database Passwords**: Rotate every 90 days
- **OAuth Secrets**: Rotate on security incident

### 13.10 Monitoring & Observability

**Application Logs**:
- **Backend**: Structured logging with `structlog`
- **Frontend**: Next.js logging + client-side error tracking
- **Log Aggregation**: Vercel Logs / Supabase Logs

**Performance Metrics**:
- **Backend**: Response time, error rate, throughput
- **Frontend**: Core Web Vitals (LCP, FID, CLS)
- **Database**: Query time, connection pool usage

**Monitoring Tools**:
- **Vercel Analytics**: Frontend performance
- **Supabase Dashboard**: Database metrics
- **Custom Dashboard**: Grafana (optional)
- **Error Tracking**: Sentry (optional)

**Alert Thresholds**:
- Error rate > 1% → Alert
- API response time p95 > 2s → Warning
- Database CPU > 80% → Warning
- Health check failure → Critical alert

---

## 14. Claude Code Framework Integration

### 14.1 Framework Overview

**Claude Code Framework** is a comprehensive development system with:
- **9-Gate Validation System** - Prevents unauthorized changes
- **Agent Architecture** - Orchestrator, Planner, Coder, Reviewer
- **Commands** - /plan, /spec, /test, /audit, /reset, /ralph
- **Skills** - context-monitor, docker-ops, spec-interview
- **Git Hooks** - Pre-commit validation, context checking

### 14.2 Gate System

**9 Gates** (validation layers):

1. **Schema Gate** - Prevents unauthorized database changes
   - Blocks changes to `demo_models.py`, `models.py`
   - Blocks direct SQL modifications
   - Requires explicit approval for migrations

2. **Auth Gate** - Protects authentication/security code
   - Blocks changes to `middleware.ts`, `demo_auth.py`
   - Blocks JWT secret modifications
   - Requires security review

3. **API Contract Gate** - Prevents breaking changes
   - Detects response structure changes
   - Detects route renames/removals
   - Detects parameter requirement changes

4. **Dependency Gate** - Controls dependency changes
   - Blocks major version upgrades without approval
   - Blocks large dependencies (>5MB)
   - Requires justification

5. **Config Gate** - Protects environment configuration
   - Blocks production config changes
   - Requires approval for CORS/security settings

6. **Test Gate** - Enforces testing requirements
   - Blocks merges if tests fail
   - Requires >80% coverage for critical paths

7. **Type Safety Gate** - Enforces TypeScript/Python type hints
   - Blocks merges if type check fails
   - Requires type annotations

8. **Lint Gate** - Enforces code quality standards
   - Blocks merges if lint fails
   - Enforces style guide

9. **Review Gate** - Requires human verification
   - All changes require approval
   - Critical changes require 2 approvals

### 14.3 Agent Workflows

#### Planning Workflow (`/plan`)
```
User Request → Orchestrator Gate Check → Planner Agent
                                             ↓
                                    Read codebase context
                                             ↓
                                    Create implementation plan
                                             ↓
                                    Present plan to user
                                             ↓
                                    User approval required
```

#### Coding Workflow (Post-Approval)
```
Approved Plan → Orchestrator → Coder Agent
                                    ↓
                            Generate code following patterns
                                    ↓
                            Run type check + lint
                                    ↓
                            Reviewer Agent validates
                                    ↓
                            Tests required to pass
                                    ↓
                            Human verification
                                    ↓
                            Commit (with co-author)
```

### 14.4 Commands

**Available Commands**:

1. **`/plan [task]`** - Enter plan mode
   - Coder reads context (STARTUP.md, CLAUDE.md, spec.md)
   - Creates detailed implementation plan
   - Waits for user approval
   - Tracks task dependencies

2. **`/spec [feature]`** - Create/update specification
   - Interactive interview about feature requirements
   - Generates specification section
   - Adds to spec.md

3. **`/test [pattern]`** - Run tests
   - Runs matching test files
   - Reports coverage
   - Identifies failures

4. **`/audit`** - Security and code quality audit
   - Scans for security vulnerabilities
   - Checks for deprecated patterns
   - Reports technical debt

5. **`/reset`** - Reset framework state
   - Clears execution context
   - Resets agent state
   - Useful for debugging

6. **`/ralph`** - Autonomous development mode (Phase 5)
   - Executes multi-phase projects
   - Handles errors and retries
   - Escalates blockers to human

### 14.5 Skills

**Available Skills** (`.claude/skills/`):

1. **`context-monitor`** - Track context usage
   - Monitors token consumption
   - Warns when approaching limits
   - Suggests optimization

2. **`docker-ops`** - Docker management
   - Start/stop containers
   - View logs
   - Health checks

3. **`spec-interview`** - Specification gathering
   - Ask clarifying questions
   - Structure requirements
   - Generate spec sections

### 14.6 Git Hooks

**Pre-Commit Hook** (`.claude/hooks/pre-commit.sh`):
```bash
#!/bin/bash
# Gate validation before commit

echo "🔒 Running Claude Code gate validation..."

# 1. Schema Gate
if git diff --cached --name-only | grep -q "demo_models.py\|models.py"; then
  echo "❌ Schema Gate: Detected database model changes"
  echo "   Database changes require explicit approval"
  exit 1
fi

# 2. Auth Gate
if git diff --cached --name-only | grep -q "middleware.ts\|demo_auth.py"; then
  echo "❌ Auth Gate: Detected auth/security changes"
  echo "   Security changes require explicit approval"
  exit 1
fi

# 3. Type Check Gate
pnpm turbo run type-check
if [ $? -ne 0 ]; then
  echo "❌ Type Safety Gate: Type check failed"
  exit 1
fi

# 4. Lint Gate
pnpm turbo run lint
if [ $? -ne 0 ]; then
  echo "❌ Lint Gate: Linting failed"
  exit 1
fi

# 5. Test Gate
pnpm turbo run test
if [ $? -ne 0 ]; then
  echo "❌ Test Gate: Tests failed"
  exit 1
fi

echo "✅ All gates passed"
exit 0
```

### 14.7 Startup Sequence

**Every Claude Code session starts with**:
1. Read `.claude/STARTUP.md` - Framework instructions
2. Read `.claude/.execution` - Execution state
3. Read `CLAUDE.md` - Project-specific rules
4. Read `spec.md` - Current specification
5. Check git status - Current branch, uncommitted changes

**Example STARTUP.md**:
```markdown
# Claude Code Framework - Startup Instructions

You are operating within the Claude Code Framework, a development system
designed to ensure safe, high-quality code delivery.

## First Actions (MANDATORY)
1. Read `.claude/.execution` to understand current project state
2. Read `CLAUDE.md` for project-specific rules
3. Read `spec.md` for system specifications
4. Check `git status` to see current changes

## Gate System
You must respect the 9-gate validation system. Changes to protected
files require explicit human approval.

## Commands Available
- /plan - Enter planning mode
- /spec - Update specifications
- /test - Run test suite
- /audit - Security audit
- /reset - Reset state
- /ralph - Autonomous development (Phase 5)

## Critical Rules
- NEVER modify database schema without approval
- ALWAYS run tests before committing
- NEVER bypass gate validation
- ALWAYS use co-authored-by in commits
```

### 14.8 Execution Context

**File**: `.claude/.execution`

```yaml
project: CCW-Online-ERP
framework_version: 2.0
current_phase: Phase 1 Complete, Planning Next Phase
active_task: null
last_activity: 2026-01-22T10:30:00Z
branch: ai-updates
uncommitted_changes: false
gates_enabled: true
autonomous_mode: false

# Task history
completed_tasks:
  - task_id: TASK-001
    description: "Implement i18n foundation"
    completed_at: 2026-01-20T15:00:00Z
    commits: ["2229e32", "e32206d"]

  - task_id: TASK-002
    description: "Create comprehensive spec.md"
    completed_at: 2026-01-22T10:30:00Z
    commits: []

# Phase tracking
phases:
  phase1_i18n:
    status: complete
    completion_date: 2026-01-20T15:00:00Z
  phase2_ap2:
    status: planned
  phase3_shopify:
    status: planned
  phase4_ai_search:
    status: planned
  phase5_autonomous:
    status: planned
```

### 14.9 Autonomous Development (Phase 5)

**Command**: `/ralph [project-name]`

**Project Template Example**:
```yaml
# .claude/projects/phase4-ai-search.yml
project_id: phase4-ai-search
name: "Phase 4: AI-Powered Search & Recommendations"
estimated_duration: 3-4 weeks
estimated_tasks: 40-45

phases:
  - phase: database_setup
    tasks:
      - name: "Create pgvector extension"
        agent: DevelopmentAgent
        dependencies: []
        estimated_time: 30min
        validation:
          - "Extension created successfully"
          - "Test query returns results"

      - name: "Create product_embeddings table"
        agent: DevelopmentAgent
        dependencies: ["Create pgvector extension"]
        estimated_time: 1hr
        validation:
          - "Table created with correct schema"
          - "Indexes created"
          - "Migration file created"

  - phase: embedding_generation
    tasks:
      - name: "Implement ProductEmbeddingService"
        agent: DevelopmentAgent
        dependencies: ["Create product_embeddings table"]
        estimated_time: 2hrs
        validation:
          - "Service implemented"
          - "OpenAI integration working"
          - "Tests passing"

# ... more phases and tasks
```

**Autonomous Execution Flow**:
```
/ralph phase4-ai-search
        ↓
ProjectOrchestrator reads project template
        ↓
For each phase:
  For each task (in dependency order):
    1. Select agent (capability matching + health check)
    2. Execute task with retry (max 3 attempts)
    3. Run validation (tests, type check)
    4. If failure: Attempt fix or escalate
    5. If success: Mark complete, move to next
    6. Update execution context
        ↓
All tasks complete → Phase complete
        ↓
All phases complete → Project complete
```

**Human Escalation Triggers**:
- Task fails 3 times
- Ambiguous requirements detected
- Schema change needed (always requires approval)
- Security-sensitive code detected
- Breaking API change detected

### 14.10 Framework Benefits

**For Developers**:
- ✅ Safe code changes (gate system prevents mistakes)
- ✅ Faster development (agents handle boilerplate)
- ✅ Consistent patterns (framework enforces standards)
- ✅ Comprehensive testing (required by framework)
- ✅ Clear audit trail (all changes tracked)

**For Project**:
- ✅ Reduced bugs (validation at every step)
- ✅ Faster feature delivery (autonomous agents work 24/7)
- ✅ Better documentation (spec.md always up-to-date)
- ✅ Easier onboarding (framework provides structure)
- ✅ Scalable development (add more agents as needed)

---

## 15. Non-Functional Requirements

### 15.1 Performance Requirements

**API Response Time**:
- **p50**: < 200ms (50th percentile)
- **p95**: < 500ms (95th percentile)
- **p99**: < 1000ms (99th percentile)

**Frontend Load Time**:
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Cumulative Layout Shift (CLS)**: < 0.1

**Database Query Performance**:
- **Simple queries** (single table): < 10ms
- **Complex queries** (joins): < 50ms
- **Vector search queries**: < 50ms
- **Aggregations**: < 100ms

**Semantic Search**:
- **Query processing**: < 500ms (including embedding generation)
- **Results relevance**: NDCG@10 > 0.7

**Recommendations**:
- **Generation time**: < 200ms
- **Cache hit rate**: > 80%

### 15.2 Scalability Requirements

**Concurrent Users**:
- **Target**: 1000 concurrent users
- **Peak**: 2000 concurrent users (with graceful degradation)

**Data Volume**:
- **Products**: 100,000+ products
- **Orders**: 1,000,000+ orders
- **Customers**: 50,000+ customers
- **Translations**: 10 languages × 100,000 products = 1,000,000 translations

**Database Scaling**:
- **Vertical scaling**: Supabase Pro plan (8GB RAM, 4 CPU)
- **Horizontal scaling**: Read replicas for read-heavy queries (future)
- **Connection pooling**: PgBouncer (max 100 connections)

**Caching Strategy**:
- **Redis cache**: 80% cache hit rate target
- **CDN caching**: Static assets (images, JS, CSS)
- **API response caching**: 60s TTL for list endpoints

### 15.3 Availability & Reliability

**Uptime Target**: 99.9% (8.76 hours downtime/year)

**Downtime Windows**:
- **Planned maintenance**: Sundays 2:00 AM - 4:00 AM AEST (monthly)
- **Emergency maintenance**: As needed (with 1-hour notice)

**Disaster Recovery**:
- **RTO (Recovery Time Objective)**: < 4 hours
- **RPO (Recovery Point Objective)**: < 1 hour (based on backup frequency)

**Fault Tolerance**:
- **Database**: Automatic failover (Supabase managed)
- **Backend**: Stateless design (horizontal scaling)
- **Frontend**: CDN distribution (Vercel edge network)

**Error Handling**:
- **Retry logic**: Exponential backoff for transient failures
- **Circuit breakers**: Prevent cascading failures
- **Graceful degradation**: Core functionality remains available even if non-critical services fail

### 15.4 Security Requirements

**Authentication**:
- **Method**: JWT Bearer tokens
- **Token expiration**: 60 minutes (access token), 7 days (refresh token)
- **Password policy**: Minimum 8 characters, hashed with bcrypt (cost factor 12)

**Authorization**:
- **Role-Based Access Control (RBAC)**: admin, manager, employee roles
- **Data isolation**: Organization-level isolation (multi-tenancy)

**Data Protection**:
- **Encryption in transit**: TLS 1.3 (HTTPS enforced)
- **Encryption at rest**: Supabase default encryption (AES-256)
- **Sensitive data**: Passwords hashed (bcrypt), API keys encrypted

**API Security**:
- **Rate limiting**: 1000 requests/hour per authenticated user
- **CORS**: Whitelist only trusted origins
- **Input validation**: Pydantic validation on all inputs
- **SQL injection prevention**: Parameterized queries (SQLAlchemy)
- **XSS prevention**: Input sanitization, Content Security Policy headers

**Compliance**:
- **GDPR**: Data export, data deletion, consent management (future)
- **OWASP Top 10**: All vulnerabilities addressed
- **Security audits**: Annual penetration testing (production)

### 15.5 Usability Requirements

**Learning Curve**:
- **New users**: Can complete core tasks (create order, search products) within 10 minutes
- **Training**: 1-hour onboarding session for staff

**Accessibility**:
- **WCAG 2.1 Level AA compliance**
- **Keyboard navigation**: All features accessible via keyboard
- **Screen reader support**: Proper ARIA labels
- **Color contrast**: Minimum 4.5:1 ratio for text

**Multi-Language Support**:
- **Languages**: 10 languages (en, zh-CN, zh-TW, es, pt, ar, vi, hi, ta, te)
- **Language switching**: Instant (cookie-based, no page reload)
- **Fallback**: English if translation missing

**Mobile Responsiveness**:
- **Breakpoints**: Mobile (< 640px), Tablet (640-1024px), Desktop (>1024px)
- **Touch targets**: Minimum 44×44px (iOS guideline)
- **Responsive design**: All pages adapt to screen size

### 15.6 Maintainability Requirements

**Code Quality**:
- **Test coverage**: ≥ 80% for critical paths
- **Type safety**: 100% TypeScript (frontend), type hints (backend)
- **Linting**: ESLint (frontend), Ruff (backend)
- **Code reviews**: All changes require approval

**Documentation**:
- **API documentation**: OpenAPI/Swagger specs
- **Code comments**: For complex business logic
- **Architecture documentation**: spec.md (this document)
- **Runbooks**: Deployment, rollback, troubleshooting

**Dependency Management**:
- **Frontend**: pnpm lockfile
- **Backend**: uv lockfile
- **Dependency updates**: Monthly security patches, quarterly feature updates

**Technical Debt**:
- **Debt tracking**: GitHub Issues with "technical-debt" label
- **Debt reduction**: 20% of sprint capacity dedicated to refactoring
- **Deprecated code**: Remove within 2 release cycles

### 15.7 Compatibility Requirements

**Browser Support**:
- **Chrome**: Last 2 versions (primary)
- **Safari**: Last 2 versions
- **Firefox**: Last 2 versions
- **Edge**: Last 2 versions
- **Mobile Safari**: Last 2 versions (iOS)
- **Chrome Mobile**: Last 2 versions (Android)

**Screen Resolutions**:
- **Mobile**: 375×667 (iPhone SE) to 428×926 (iPhone 14 Pro Max)
- **Tablet**: 768×1024 (iPad) to 1024×1366 (iPad Pro)
- **Desktop**: 1280×720 to 3840×2160 (4K)

**Backend Compatibility**:
- **Python**: 3.12+
- **PostgreSQL**: 15+
- **Redis**: 7+

**Frontend Compatibility**:
- **Node.js**: 20+
- **pnpm**: 8+

### 15.8 Operational Requirements

**Monitoring**:
- **Application logs**: Structured JSON logs
- **Performance metrics**: Response time, error rate, throughput
- **Business metrics**: Orders created, revenue, search queries
- **Infrastructure metrics**: CPU, memory, disk, network

**Alerting**:
- **Critical**: Health check failure, database connection lost
- **Warning**: High error rate, slow response time, low disk space
- **Info**: Deployment completed, backup completed

**Backup & Recovery**:
- **Frequency**: Daily automatic backups (Supabase)
- **Retention**: 7 days (automatic), 30 days (manual weekly backups)
- **Restoration**: Tested quarterly

**Logging**:
- **Log levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Log retention**: 30 days (production), 7 days (development)
- **Sensitive data**: Redacted from logs (passwords, tokens, PII)

### 15.9 Localization Requirements

**Number Formatting**:
- **Currency**: AUD $ format (e.g., $1,234.56)
- **Decimals**: 2 decimal places for prices
- **Thousands separator**: Comma (1,234)

**Date/Time Formatting**:
- **Timezone**: AEST/AEDT (Australia/Sydney)
- **Date format**: DD/MM/YYYY (Australian standard)
- **Time format**: 24-hour (10:30) or 12-hour (10:30 AM) based on locale

**Measurement Units**:
- **Length**: Meters (m), Millimeters (mm)
- **Weight**: Kilograms (kg), Grams (g)
- **Temperature**: Celsius (°C)

### 15.10 Data Retention & Privacy

**Data Retention Policy**:
- **Orders**: Indefinite (business records)
- **Quotes**: 2 years after expiry
- **Users**: Indefinite (or until account deletion request)
- **Logs**: 30 days (production), 7 days (development)
- **Backups**: 30 days

**Data Deletion**:
- **User account deletion**: Soft delete (is_active=false), hard delete after 90 days
- **Customer data deletion**: Soft delete, hard delete after 7 years (legal requirement)
- **Order data**: Cannot be deleted (business records), can be archived

**Privacy**:
- **PII protection**: Encrypted in database, never logged
- **Data access**: Restricted by role (RBAC)
- **Third-party sharing**: No data sharing without explicit consent
- **Data export**: Users can request data export (GDPR compliance)



---

## 16. Production Roadmap

### 16.1 Timeline Overview (2026-2027)

```
Q1 2026 (Jan-Mar): Foundation Complete ✅
├─ Phase 1: Multi-Language Foundation (COMPLETE)
│  ├─ 10 languages supported
│  ├─ AI translation working
│  └─ Language switcher deployed
└─ Comprehensive Specification (COMPLETE)
   └─ spec.md finalized

Q2 2026 (Apr-Jun): Integrations & Search
├─ Phase 2: Google AP2 Integration (Weeks 1-4)
│  ├─ Payment processing
│  ├─ Voice commerce
│  └─ Agent-to-agent commerce
├─ Phase 3: Enhanced Shopify Backend (Weeks 5-6)
│  ├─ Custom metafields
│  ├─ Theme API endpoints
│  └─ Real-time inventory sync
└─ Phase 4 (Start): AI Search Foundation (Weeks 7-12)
   ├─ pgvector setup
   ├─ Embedding generation
   └─ Semantic search MVP

Q3 2026 (Jul-Sep): AI Enhancement & Automation
├─ Phase 4 (Complete): AI Search & Recommendations
│  ├─ Recommendation engine
│  ├─ Voice search optimization
│  └─ Visual search (basic)
└─ Phase 5: Autonomous Development Framework (Weeks 1-12)
   ├─ Development agents
   ├─ Testing agents
   ├─ Orchestration framework
   └─ Progress tracking dashboard

Q4 2026 (Oct-Dec): Testing, Optimization & Launch
├─ Phase 6: Testing & Refinement (Weeks 1-8)
│  ├─ Comprehensive testing (unit, integration, E2E)
│  ├─ Load testing (1000 concurrent users)
│  ├─ Security audit
│  └─ Performance optimization
└─ Phase 7: Production Readiness (Weeks 9-12)
   ├─ Documentation completion
   ├─ Deployment preparation
   ├─ Staff training
   └─ Go-live (December 2026)

Q1 2027 (Jan-Mar): Post-Launch & Iteration
├─ Monitor production metrics
├─ User feedback collection
├─ Bug fixes and optimizations
└─ Feature enhancements based on usage data
```

### 16.2 Q2 2026: Integrations & Search (Apr-Jun)

**Week 1-4: Phase 2 (Google AP2 Integration)**
- Week 1: Database schema, settings, demo client
- Week 2: Live client, OAuth flow, mandate creation
- Week 3: Payment processing, voice commerce integration
- Week 4: Agent-to-agent commerce, testing, documentation

**Week 5-6: Phase 3 (Enhanced Shopify Backend)**
- Week 5: Metafield management, theme API endpoints
- Week 6: Real-time inventory sync, multi-language product sync, testing

**Week 7-12: Phase 4 (AI Search Foundation)**
- Week 7-8: pgvector extension setup, database schema, indexes
- Week 9-10: Embedding generation service, batch processing, OpenAI integration
- Week 11-12: Semantic search service, API endpoints, frontend integration

**Deliverables (End of Q2)**:
- ✅ Google AP2 integration functional (payments, voice, agent commerce)
- ✅ Shopify backend enhanced (metafields, theme APIs, inventory sync)
- ✅ Semantic search MVP working (basic vector search)

### 16.3 Q3 2026: AI Enhancement & Automation (Jul-Sep)

**Week 1-4: Phase 4 (AI Search Completion)**
- Week 1-2: Recommendation engine (collaborative filtering, content-based)
- Week 3: Voice search optimization, multi-language voice queries
- Week 4: Visual search (basic MVP), testing, optimization

**Week 5-12: Phase 5 (Autonomous Development Framework)**
- Week 5-6: Development agents (DevelopmentAgent, TestingAgent)
- Week 7-8: Project orchestrator, task queue, dependency resolution
- Week 9-10: Error handling, retry logic, human escalation
- Week 11: Progress tracking dashboard, monitoring
- Week 12: Pilot project (small test), documentation

**Deliverables (End of Q3)**:
- ✅ AI search fully operational (semantic search, recommendations, voice)
- ✅ Autonomous development framework working
- ✅ Agents can execute multi-phase projects with human oversight

### 16.4 Q4 2026: Testing, Optimization & Launch (Oct-Dec)

**Week 1-8: Phase 6 (Testing & Refinement)**
- Week 1-2: Unit tests (90% coverage for critical services)
- Week 3-4: Integration tests (80% coverage for API endpoints)
- Week 5: E2E tests (critical user flows)
- Week 6: Load testing (1000 concurrent users, performance tuning)
- Week 7: Security audit (penetration testing, OWASP Top 10)
- Week 8: Performance optimization (caching, query optimization, CDN)

**Week 9-12: Phase 7 (Production Readiness)**
- Week 9: Documentation (API docs, user guides, runbooks)
- Week 10: Deployment preparation (environment setup, secrets, monitoring)
- Week 11: Staff training (translation management, monitoring dashboards)
- Week 12: Go-live (final smoke tests, production deployment, post-launch monitoring)

**Deliverables (End of Q4)**:
- ✅ All tests passing (unit, integration, E2E, load, security)
- ✅ Performance targets met (API <500ms p95, search <500ms)
- ✅ Documentation complete
- ✅ Staff trained
- ✅ Production deployment successful
- ✅ Monitoring and alerts configured

### 16.5 Q1 2027: Post-Launch & Iteration (Jan-Mar)

**Week 1-4: Monitoring & Stability**
- Daily monitoring of production metrics
- Bug fixes and critical patches
- Performance tuning based on real usage
- User feedback collection

**Week 5-8: Feature Enhancements**
- Analyze usage data (most-used features, pain points)
- Prioritize feature requests from users
- Quick wins and UX improvements

**Week 9-12: Next Phase Planning**
- Review Phase 1-5 outcomes
- Identify new opportunities (Phase 6, Phase 7)
- Plan next quarter roadmap
- Budget and resource allocation

**Key Metrics to Track**:
- **Multi-Language Adoption**: Target 30% non-English users by March 2027
- **Voice Commerce Usage**: Target 5% of orders via voice by March 2027
- **Search Performance**: NDCG@10 > 0.7, click-through rate > 60%
- **System Uptime**: 99.9% uptime (< 9 hours downtime total)
- **User Satisfaction**: NPS score > 8.0

### 16.6 Milestone Summary

| Milestone | Target Date | Status | Description |
|-----------|-------------|--------|-------------|
| Phase 1: i18n Foundation | Jan 2026 | ✅ COMPLETE | Multi-language support (10 languages) |
| Comprehensive Spec | Jan 2026 | ✅ COMPLETE | Master specification document |
| Phase 2: Google AP2 | Apr 2026 | 📋 PLANNED | Payment processing, voice commerce |
| Phase 3: Shopify Enhanced | May 2026 | 📋 PLANNED | Metafields, theme APIs, inventory sync |
| Phase 4: AI Search (MVP) | Jun 2026 | 📋 PLANNED | Semantic search foundation |
| Phase 4: AI Search (Full) | Jul 2026 | 📋 PLANNED | Recommendations, voice, visual search |
| Phase 5: Autonomous Dev | Sep 2026 | 📋 PLANNED | Self-sustaining development framework |
| Phase 6: Testing & Refinement | Nov 2026 | 📋 PLANNED | Comprehensive testing and optimization |
| Phase 7: Production Launch | Dec 2026 | 📋 PLANNED | Go-live to production |
| Post-Launch Iteration | Q1 2027 | 📋 PLANNED | Monitoring, bug fixes, enhancements |

### 16.7 Risk & Mitigation Strategy

**Key Risks**:
1. **Timeline Delays**
   - Risk: Phases take longer than estimated (especially AI search)
   - Mitigation: Parallel development where possible, MVP-first approach, buffer time
   - Contingency: Reduce scope of non-critical features (e.g., visual search optional)

2. **Performance Issues**
   - Risk: Vector search doesn't meet <500ms target with large dataset
   - Mitigation: Proper indexing (IVFFlat → HNSW), aggressive caching, query optimization
   - Contingency: Hybrid search with more weight on keyword search

3. **Translation Quality**
   - Risk: AI translations inaccurate, cultural nuances missed
   - Mitigation: Hybrid AI+human approach, native speaker review
   - Contingency: Focus on top 3 languages first (English, Chinese, Spanish)

4. **Google AP2 Integration Challenges**
   - Risk: API changes, documentation gaps, complex mandate verification
   - Mitigation: Demo mode first, gradual rollout, fallback to existing payment methods
   - Contingency: Delay AP2 launch until stable, use existing Xero integration

5. **Autonomous Development Reliability**
   - Risk: Agents generate incorrect code, causing production issues
   - Mitigation: Always require human verification, comprehensive testing, easy rollback
   - Contingency: Manual development for critical features, agents for non-critical tasks

### 16.8 Go/No-Go Criteria for Production Launch

**GO Criteria** (all must be met):
- ✅ All tests passing (100% of unit, integration, E2E tests)
- ✅ Code coverage ≥ 80% for critical paths
- ✅ Load test passed (1000 concurrent users, all endpoints meet performance targets)
- ✅ Security audit passed (no critical or high vulnerabilities)
- ✅ Performance targets met (API p95 < 500ms, search < 500ms)
- ✅ Multi-language functionality validated (all 10 languages working)
- ✅ Browser compatibility tested (Chrome, Safari, Firefox, Edge)
- ✅ Backup and rollback procedures tested
- ✅ Monitoring and alerts configured
- ✅ Staff trained on new features
- ✅ Documentation complete (API docs, user guides, runbooks)
- ✅ Production environment configured (secrets, environment variables)
- ✅ Database migrations tested on staging

**NO-GO Triggers**:
- ❌ Critical test failures
- ❌ Security vulnerabilities (high or critical)
- ❌ Performance targets not met (>1s API response time)
- ❌ Database migrations fail on staging
- ❌ Backup/restore procedures not working
- ❌ Staff not adequately trained

### 16.9 Post-Launch Success Metrics

**Technical Metrics** (first 30 days):
- **Uptime**: 99.9% (< 44 minutes downtime)
- **Error Rate**: < 0.1%
- **API Response Time**: p95 < 500ms
- **Search Performance**: p95 < 500ms
- **Database Performance**: Query time < 50ms (simple queries)

**Business Metrics** (first 90 days):
- **Multi-Language Adoption**: 30% of users use non-English
- **Voice Commerce**: 5% of orders via voice
- **Search CTR**: +20% increase
- **Conversion Rate**: +15% increase
- **Average Order Value**: +10% increase (recommendations)

**User Experience Metrics**:
- **User Satisfaction**: NPS score > 8.0
- **Support Tickets**: < 10 critical issues/week
- **Training Effectiveness**: 90% of staff comfortable with new features

---

## 17. Acceptance Criteria

### 17.1 Functional Acceptance Criteria

**Phase 1: Multi-Language Foundation (✅ COMPLETE)**
- ✅ 10 languages supported (en, zh-CN, zh-TW, es, pt, ar, vi, hi, ta, te)
- ✅ Language switcher component working (cookie-based persistence)
- ✅ UI translations complete for all namespaces
- ✅ Product translation workflow functional (AI + human review)
- ✅ API endpoints support Accept-Language header
- ✅ Database schema includes all i18n tables
- ✅ RTL support for Arabic working correctly
- ✅ Fallback to English when translation missing

**Phase 2: Google AP2 Integration**
- ⏳ AP2 database schema created (6 tables)
- ⏳ Demo client working (mock responses)
- ⏳ Live client implemented (Google Cloud API integration)
- ⏳ OAuth flow functional
- ⏳ Intent mandate creation working
- ⏳ Cart mandate creation working
- ⏳ Payment mandate creation and execution working
- ⏳ Mandate signature verification functional
- ⏳ Voice commerce integrated with VoiceCommerceAgent
- ⏳ Agent-to-agent commerce working
- ⏳ Webhook handling implemented
- ⏳ Security: Rate limiting, signature verification

**Phase 3: Enhanced Shopify Backend**
- ⏳ Shopify metafields syncing (ccw_custom namespace)
- ⏳ Theme API endpoints functional
- ⏳ Real-time inventory sync (bidirectional)
- ⏳ Multi-language product sync to Shopify
- ⏳ Custom business logic validation
- ⏳ Webhook handling for inventory updates

**Phase 4: AI-Powered Search & Recommendations**
- ⏳ pgvector extension installed
- ⏳ product_embeddings table created with IVFFlat index
- ⏳ Embedding generation service functional (OpenAI integration)
- ⏳ All products have embeddings for all 10 languages
- ⏳ Semantic search API endpoint working
- ⏳ Search returns relevant results (NDCG@10 > 0.7)
- ⏳ Search performance < 500ms
- ⏳ Recommendation engine functional (3 algorithms)
- ⏳ Recommendation API endpoints working
- ⏳ Voice search optimized for multi-language
- ⏳ Visual search MVP working (basic image-based search)
- ⏳ SearchAgent, RecommendationAgent, VoiceCommerceAgent registered

**Phase 5: Autonomous Development Framework**
- ⏳ All development agents implemented (6 agents)
- ⏳ Project orchestrator working
- ⏳ Task queue with dependency resolution functional
- ⏳ Autonomous execution loop tested
- ⏳ Error handling and retry logic working
- ⏳ Human escalation implemented
- ⏳ Progress tracking dashboard created
- ⏳ Pilot project completed successfully
- ⏳ Documentation complete (skills, commands, workflows)

**Phase 6: Testing & Refinement**
- ⏳ All unit tests passing (100%)
- ⏳ All integration tests passing (100%)
- ⏳ All E2E tests passing (100%)
- ⏳ Test coverage ≥ 80% for critical paths
- ⏳ Load test passed (1000 concurrent users)
- ⏳ Security audit passed (no critical/high vulnerabilities)
- ⏳ Performance targets met (all endpoints < 500ms p95)
- ⏳ Multi-language functionality validated (all 10 languages)
- ⏳ Browser compatibility tested (Chrome, Safari, Firefox, Edge)

**Phase 7: Production Readiness**
- ⏳ API documentation complete (OpenAPI/Swagger)
- ⏳ User guides created (translation management, monitoring)
- ⏳ Developer guides created (extending integrations, adding agents)
- ⏳ Deployment runbooks created
- ⏳ Troubleshooting guides created
- ⏳ Environment configuration complete (production secrets)
- ⏳ Database migrations tested on staging
- ⏳ Backup and restore procedures tested
- ⏳ Rollback plans documented and tested
- ⏳ Health check endpoints functional
- ⏳ Monitoring setup (logs, metrics, alerts)
- ⏳ Staff trained on new features

### 17.2 Non-Functional Acceptance Criteria

**Performance**:
- ⏳ API response time p95 < 500ms
- ⏳ Semantic search query time < 500ms
- ⏳ Recommendation generation < 200ms
- ⏳ Vector search query time < 50ms
- ⏳ Frontend FCP < 1.5s
- ⏳ Frontend LCP < 2.5s
- ⏳ Frontend TTI < 3.5s
- ⏳ Frontend CLS < 0.1

**Scalability**:
- ⏳ System supports 1000 concurrent users
- ⏳ Database handles 100,000+ products
- ⏳ Database handles 1,000,000+ orders
- ⏳ Cache hit rate > 80%

**Availability**:
- ⏳ Uptime 99.9% (first 30 days post-launch)
- ⏳ Health check endpoint responds within 1s
- ⏳ Graceful degradation when non-critical services fail

**Security**:
- ⏳ Authentication via JWT tokens working
- ⏳ Password hashing with bcrypt (cost factor 12)
- ⏳ Rate limiting enforced (1000 req/hour per user)
- ⏳ CORS configured (whitelist only)
- ⏳ Input validation on all endpoints (Pydantic)
- ⏳ SQL injection prevention (parameterized queries)
- ⏳ XSS prevention (input sanitization)
- ⏳ HTTPS enforced in production
- ⏳ Secrets encrypted in database
- ⏳ Security audit passed (no critical vulnerabilities)

**Usability**:
- ⏳ WCAG 2.1 Level AA compliance
- ⏳ Keyboard navigation support
- ⏳ Screen reader support (proper ARIA labels)
- ⏳ Color contrast ratio ≥ 4.5:1
- ⏳ Mobile responsive (all breakpoints)
- ⏳ Multi-language UI (all 10 languages)
- ⏳ RTL support for Arabic

**Maintainability**:
- ⏳ Test coverage ≥ 80% for critical paths
- ⏳ Type safety enforced (TypeScript, Python type hints)
- ⏳ Linting passes (ESLint, Ruff)
- ⏳ Code reviews required for all changes
- ⏳ API documentation up-to-date
- ⏳ Architecture documentation up-to-date (spec.md)

### 17.3 User Story Acceptance Criteria

**US-001: As a user, I want to switch languages so that I can use the system in my native language**
- ✅ User can select language from dropdown in header
- ✅ Language selection persists across sessions (cookie)
- ✅ UI immediately updates to selected language (no page reload)
- ✅ All UI text translated to selected language
- ✅ Product names and descriptions translated (if available)
- ✅ Fallback to English if translation missing
- ✅ RTL layout for Arabic

**US-002: As a user, I want to search for products using natural language so that I can find relevant products easily**
- ⏳ User can enter natural language query (e.g., "drill for concrete walls")
- ⏳ System returns relevant products ranked by relevance
- ⏳ Search works in all 10 languages
- ⏳ Search results show within 500ms
- ⏳ User can filter results by category, price range
- ⏳ Search highlights why each result is relevant

**US-003: As a user, I want product recommendations so that I can discover related products**
- ⏳ User sees "Similar Products" on product detail page
- ⏳ User sees "Frequently Bought Together" on product detail page
- ⏳ Recommendations are relevant (click-through rate > 60%)
- ⏳ Recommendations load within 200ms

**US-004: As an admin, I want to translate products using AI so that I can quickly localize my catalog**
- ⏳ Admin can select products and target languages
- ⏳ Admin clicks "Translate" button
- ⏳ System queues translation jobs
- ⏳ Admin sees translation progress
- ⏳ Admin can review and approve AI-generated translations
- ⏳ Translation quality is high (>95% accuracy)

**US-005: As a customer, I want to place orders via voice (Siri/Google Assistant) so that I can order hands-free**
- ⏳ Customer says "Order 5 drills from CCW" to voice assistant
- ⏳ System understands intent in customer's language
- ⏳ System finds relevant products
- ⏳ System creates intent mandate
- ⏳ Customer confirms order via voice
- ⏳ System creates cart mandate and processes payment
- ⏳ Customer receives order confirmation

**US-006: As a developer, I want autonomous agents to implement features so that I can focus on high-level design**
- ⏳ Developer uses `/ralph [project-name]` command
- ⏳ ProjectOrchestrator reads project template
- ⏳ Agents execute tasks in dependency order
- ⏳ Developer receives progress updates
- ⏳ Developer is notified when human approval needed
- ⏳ Developer can review and approve agent-generated code
- ⏳ All tests pass after agent implementation

### 17.4 Integration Acceptance Criteria

**Xero Integration** (existing):
- ✅ OAuth flow functional
- ✅ Customers sync to Xero
- ✅ Orders sync to Xero as invoices
- ✅ Payments sync to Xero

**Shopify Integration** (existing + enhanced):
- ✅ Products sync from Shopify to ERP
- ✅ Inventory sync (Shopify → ERP)
- ⏳ Inventory sync (ERP → Shopify) - bidirectional
- ⏳ Custom metafields sync (ccw_custom namespace)
- ⏳ Multi-language product descriptions sync
- ✅ Orders import from Shopify
- ✅ Webhook handling for order creation

**Google AP2 Integration** (Phase 2):
- ⏳ OAuth flow functional
- ⏳ Mandate creation working (intent, cart, payment)
- ⏳ Payment processing functional
- ⏳ Voice commerce integrated
- ⏳ Agent-to-agent commerce working
- ⏳ Webhook signature verification

**OpenAI Integration** (Phase 1, 4):
- ✅ AI translation working (Claude API)
- ⏳ Embedding generation working (OpenAI text-embedding-3-small)
- ⏳ Batch embedding processing

---

## 18. Appendices

### 18.1 Glossary

**Terms & Definitions**:

- **Agent**: Autonomous AI entity that performs tasks (e.g., SearchAgent, PricingAgent)
- **AP2**: Agent Payments Protocol 2 - Google's protocol for AI agent commerce
- **AEST/AEDT**: Australian Eastern Standard/Daylight Time
- **Claude Code Framework**: Development system with gate validation and autonomous agents
- **Embedding**: Vector representation of text for semantic search (1536 dimensions)
- **Gate**: Validation checkpoint in Claude Code Framework (9 gates total)
- **i18n**: Internationalization - supporting multiple languages
- **Intent Mandate**: First step in AP2 payment flow (user expresses purchase intent)
- **IVFFlat**: PostgreSQL index type for vector similarity search
- **JWT**: JSON Web Token - authentication token format
- **LangGraph**: Framework for building agent workflows
- **Mandate**: Cryptographically-signed authorization in AP2 protocol
- **NDCG@10**: Normalized Discounted Cumulative Gain at 10 - search relevance metric
- **NPS**: Net Promoter Score - user satisfaction metric
- **OAuth**: Open Authorization - standard for secure API authorization
- **Orchestrator**: Agent that coordinates other agents (e.g., SupervisorAgent)
- **pgvector**: PostgreSQL extension for vector storage and similarity search
- **Pydantic**: Python library for data validation using type annotations
- **RBAC**: Role-Based Access Control - authorization based on user roles
- **RTL**: Right-to-Left - text direction for languages like Arabic
- **Semantic Search**: Search based on meaning rather than exact keyword matching
- **SKU**: Stock Keeping Unit - unique product identifier
- **Supabase**: PostgreSQL hosting platform with authentication
- **Vector Search**: Search using vector similarity (cosine similarity)
- **WCAG**: Web Content Accessibility Guidelines

### 18.2 Technology References

**Frontend Technologies**:
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev)
- [TypeScript 5.7 Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)

**Backend Technologies**:
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/)
- [Pydantic v2 Documentation](https://docs.pydantic.dev/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)

**Database & Infrastructure**:
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Supabase Documentation](https://supabase.com/docs)
- [Redis Documentation](https://redis.io/docs/)

**AI & ML**:
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

**Integrations**:
- [Xero API Documentation](https://developer.xero.com/documentation/)
- [Shopify API Documentation](https://shopify.dev/api)
- [Google Agent Payments Protocol](https://developers.google.com/agent-payments)

### 18.3 Architecture Diagrams

**System Architecture (High-Level)**:
```
┌─────────────────────────────────────────────────────────────┐
│                        CCW-Online ERP                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐            ┌──────────────────┐      │
│  │   Frontend App   │            │   Backend API    │      │
│  │   (Next.js 15)   │◄──────────►│   (FastAPI)      │      │
│  │                  │    REST    │                  │      │
│  │  - Dashboard     │            │  - API Routes    │      │
│  │  - Portal        │            │  - Agents        │      │
│  │  - Admin         │            │  - Services      │      │
│  └──────────────────┘            └──────────────────┘      │
│           │                               │                 │
│           ▼                               ▼                 │
│  ┌──────────────────────────────────────────────────┐      │
│  │           PostgreSQL 15 (Supabase)               │      │
│  │  - Core Tables                                   │      │
│  │  - i18n Tables                                   │      │
│  │  - Vector Extensions (pgvector)                  │      │
│  └──────────────────────────────────────────────────┘      │
│           │                               │                 │
│           ▼                               ▼                 │
│  ┌──────────────┐            ┌──────────────────────┐      │
│  │    Redis     │            │   External APIs      │      │
│  │  (Caching)   │            │  - Xero              │      │
│  └──────────────┘            │  - Shopify           │      │
│                               │  - Google AP2        │      │
│                               │  - OpenAI            │      │
│                               └──────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Agent Architecture (Phase 5)**:
```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Orchestration                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              ProjectOrchestrator                       │  │
│  │  - Reads project templates                            │  │
│  │  - Manages task queue                                 │  │
│  │  - Tracks dependencies (DAG)                          │  │
│  │  - Handles errors and retries                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│                              ▼                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Agent Registry                       │ │
│  │  - Registers agents with capabilities                  │ │
│  │  - Selects agents based on task requirements          │ │
│  │  - Tracks agent health and performance                │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│              ┌───────────────┼───────────────┐              │
│              ▼               ▼               ▼              │
│  ┌──────────────────┐ ┌─────────────┐ ┌──────────────┐    │
│  │ DevelopmentAgent │ │ TestingAgent│ │ ReviewerAgent│    │
│  │  - Code gen      │ │  - Test gen │ │  - Code rev  │    │
│  │  - Patterns      │ │  - Test run │ │  - Quality   │    │
│  │  - Validation    │ │  - Coverage │ │  - Standards │    │
│  └──────────────────┘ └─────────────┘ └──────────────┘    │
│                                                               │
│  ┌──────────────────┐ ┌─────────────┐ ┌──────────────┐    │
│  │ IntegrationTest  │ │ Deployment  │ │ Enhancement  │    │
│  │ Agent            │ │ Agent       │ │ Agent        │    │
│  │  - E2E tests     │ │  - Migrations│ │  - Optimize  │    │
│  │  - API tests     │ │  - Deploy   │ │  - Refactor  │    │
│  └──────────────────┘ └─────────────┘ └──────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Semantic Search Flow (Phase 4)**:
```
┌─────────────────────────────────────────────────────────────┐
│                    Semantic Search Flow                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User Query: "drill for concrete walls"                      │
│                              │                               │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Query Processing                               │  │
│  │  1. Detect language (en)                              │  │
│  │  2. Generate embedding (OpenAI API)                   │  │
│  │     → [0.123, -0.456, 0.789, ... ] (1536 dims)       │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Vector Search (pgvector)                       │  │
│  │  SELECT product_id, embedding <=> query_embedding     │  │
│  │  FROM product_embeddings                              │  │
│  │  WHERE language_code = 'en'                           │  │
│  │  ORDER BY embedding <=> query_embedding               │  │
│  │  LIMIT 20                                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Result Ranking                                 │  │
│  │  1. Apply filters (category, price, stock)           │  │
│  │  2. Boost recent products (+10%)                     │  │
│  │  3. Personalization (user history)                   │  │
│  │  4. Rerank by relevance score                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│                              ▼                               │
│  Ranked Results: [                                           │
│    { product_id: "...", score: 0.87, name: "Hammer Drill"},│
│    { product_id: "...", score: 0.82, name: "Concrete Drill"}│
│  ]                                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 18.4 Code Patterns & Templates

**FastAPI Endpoint Template**:
```python
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_async_db
from src.db.schemas import PaginatedResponse, ProductCreate, Product

router = APIRouter(prefix="/api", tags=["Products"])

@router.get("/products")
async def list_products(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    category: str | None = None,
) -> PaginatedResponse[Product]:
    """List products with pagination and filtering."""
    # Implementation here
    pass

@router.post("/products", status_code=201)
async def create_product(
    data: ProductCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Product:
    """Create a new product."""
    # Implementation here
    pass
```

**Agent Template**:
```python
from src.ai.base_agent import BaseAgent

class CustomAgent(BaseAgent):
    """Custom agent for specific task."""

    def __init__(self):
        super().__init__(
            agent_id="custom_agent",
            name="CustomAgent",
            auto_register=True
        )
        self.capabilities = ["capability1", "capability2"]
        self.description = "Agent description"

    async def execute(self, task: str, context: dict) -> dict:
        """Execute the task."""
        self._log_execution_start(task, context)

        try:
            # Implementation here
            result = {"status": "completed", "outputs": [...]}

            self._log_execution_complete(True)
            return result

        except Exception as e:
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(self, task: str, context: dict):
        """Stream execution results."""
        # Implementation here
        yield "chunk1"
        yield "chunk2"
```

**React Component Template (with form)**:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  field1: z.string().min(1, "Required"),
  field2: z.number().positive("Must be positive"),
});

type FormData = z.infer<typeof formSchema>;

interface ComponentFormProps {
  mode: "create" | "edit";
  initialData?: FormData;
  onSuccess?: () => void;
}

export function ComponentForm({ mode, initialData, onSuccess }: ComponentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || { field1: "", field2: 0 },
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
      toast({
        title: "Error",
        description: error.message || "Operation failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

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
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : mode === "create" ? "Create" : "Update"}
        </Button>
      </form>
    </Form>
  );
}
```

### 18.5 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | CCW Team | Initial specification draft |
| 2.0 | 2026-01-22 | Claude Code Framework | Comprehensive expansion: added Phases 1-5 specifications, API documentation, testing requirements, Claude Code Framework integration, and complete production roadmap |

**Version 2.0 Additions**:
- ✅ Section 1: Executive Summary
- ✅ Section 2: System Architecture
- ✅ Section 3: Technology Stack (LOCKED)
- ✅ Section 4: Phase 1 (i18n Foundation - COMPLETE)
- ✅ Section 5: Phase 2 (Google AP2 Integration - PLANNED)
- ✅ Section 6: Phase 3 (Enhanced Shopify Backend - PLANNED)
- ✅ Section 7: Phase 4 (AI Search & Recommendations - PLANNED)
- ✅ Section 8: Phase 5 (Autonomous Development - PLANNED)
- ✅ Section 9: API Specifications (comprehensive endpoint documentation)
- ✅ Section 10: Database Schema Reference (all tables documented)
- ✅ Section 11: UI/UX Requirements (design system, accessibility)
- ✅ Section 12: Testing Requirements (unit, integration, E2E, load, security)
- ✅ Section 13: Deployment Specifications (CI/CD, environments, monitoring)
- ✅ Section 14: Claude Code Framework Integration (gates, agents, commands)
- ✅ Section 15: Non-Functional Requirements (performance, scalability, security)
- ✅ Section 16: Production Roadmap (Q1 2026 - Q1 2027 timeline)
- ✅ Section 17: Acceptance Criteria (functional and non-functional)
- ✅ Section 18: Appendices (glossary, references, diagrams, templates)

### 18.6 Contributors & Acknowledgments

**Project Team**:
- CCW Equipment Supplier Team - Business requirements and domain expertise
- Claude Code Framework - Development system and autonomous agents
- Anthropic Claude - AI translation and development assistance

**Technologies Used**:
- Next.js, React, TypeScript (Frontend)
- FastAPI, SQLAlchemy, Python (Backend)
- PostgreSQL, Supabase (Database)
- pgvector (Vector search)
- OpenAI (Embeddings and translations)
- Anthropic Claude (AI assistance)
- shadcn/ui, Tailwind CSS (Design system)
- Vitest, Pytest (Testing)
- Vercel (Deployment)

**Special Thanks**:
- Open source community for excellent tools and libraries
- Early testers and beta users for valuable feedback

---

**END OF SPECIFICATION**

**Document Status**: ✅ COMPLETE
**Last Updated**: 2026-01-22
**Version**: 2.0
**Total Sections**: 18
**Total Pages**: ~100+ (when printed)

**Next Steps**:
1. Review and approve this specification
2. Provision resources (API keys, accounts, infrastructure)
3. Begin Phase 2 implementation (Google AP2 Integration)
4. Continue with production roadmap as outlined in Section 16

---

*This specification is a living document and will be updated as the project evolves.*
