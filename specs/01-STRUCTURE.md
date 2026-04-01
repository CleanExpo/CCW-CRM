# PHASE 1: STRUCTURAL RECONNAISSANCE

**Date**: 2026-02-05
**Git Commit**: f422237644294b9df14c08e1ea53469658112289
**Duration**: Phase 1 Execution
**Evidence Files**: specs/ directory

---

## Executive Summary

Comprehensive structural analysis of CCW-Online ERP monorepo. System is a full-stack Equipment Supplier ERP built with Next.js 15 (frontend) and FastAPI (backend) using pnpm workspaces and Turbo for build orchestration.

**Key Findings**:
- ✅ Well-structured monorepo with clear separation
- ✅ Modern tech stack (Next.js 15, React 19, FastAPI, Python 3.12)
- ⚠️ Extensive directory structure with many top-level folders (potential organization concern)
- ✅ Turbo build system properly configured
- ✅ TypeScript and Python type checking configured

---

## File Counts

**Evidence**: Terminal output from `find` commands

```
Total TypeScript/TSX files: 874
Total Python files: 917
Total JSON files: 6889
```

### Breakdown by Location

**Frontend (apps/web)**:
- Sample TSX files in `specs/web-tsx-files.txt`
- Total TSX/TS files: ~874 (across app, components, lib)

**Backend (apps/backend)**:
- Sample Python files in `specs/backend-py-files.txt`
- Total Python files: 917
- Key locations:
  - `apps/backend/src/agents/` — AI agent implementations
  - `apps/backend/src/ai/agents/` — Specialized AI agents
  - `apps/backend/src/api/routes/` — API route handlers
  - `apps/backend/src/db/` — Database models
  - `apps/backend/src/services/` — Business logic services

---

## Monorepo Structure

### Top-Level Directories

**Evidence**: `specs/directory-structure-l2.txt`

```
.
├── .beads/                    # Task management (custom framework)
├── .business-consistency/     # Business logic consistency checks
├── .claude/                   # Claude Code framework (⛔ READ ONLY)
├── .content-creation/         # Content creation guidelines
├── .copywriting/              # Copywriting templates
├── .docs/                     # Documentation
├── .git/                      # Git repository
├── .github/                   # GitHub Actions/workflows
├── .husky/                    # Git hooks
├── .journeys/                 # User journey definitions
├── .turbo/                    # Turbo cache
├── .vscode/                   # VS Code settings
├── .zap/                      # ZAP security testing config
├── apps/                      # ✅ Application code (web + backend)
├── audit-reports/             # Security/quality audit reports
├── backup/                    # Backup files
├── data/                      # Data files
├── docs/                      # Project documentation
├── packages/                  # Shared packages (if any)
├── prometheus-data/           # Prometheus metrics data
├── scripts/                   # Utility scripts
├── specs/                     # THIS AUDIT (created during execution)
└── verify/                    # Verification scripts
```

**⚠️ CONCERN**: 20+ top-level directories. Many appear to be custom frameworks or business-specific folders (`.beads/`, `.business-consistency/`, `.content-creation/`, `.copywriting/`, `.journeys/`, `.zap/`). This is atypical for a monorepo and may indicate:
1. Custom organizational structure
2. Legacy folders from previous iterations
3. Need for consolidation

**✅ POSITIVE**: Core application code properly isolated in `apps/` directory.

### Workspace Configuration

**Evidence**: `specs/pnpm-workspace.txt`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Analysis**:
- Standard pnpm workspace structure
- Apps directory for applications (web, backend)
- Packages directory for shared code (currently unused/empty based on directory listing)

---

## Turbo Configuration

**Evidence**: turbo.json (captured above)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env.local", ".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "type-check": {
      "dependsOn": ["^type-check"]
    },
    "test": {
      "dependsOn": ["^test"]
    },
    "test:coverage": {
      "dependsOn": ["^test:coverage"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Analysis**:
- ✅ Proper task dependency configuration (`dependsOn: ["^build"]` ensures dependencies build first)
- ✅ Dev task set to persistent (correct for long-running dev servers)
- ✅ Cache disabled for dev/clean (correct behavior)
- ✅ Global dependencies include .env files (proper invalidation)
- ✅ Outputs correctly defined for build task (.next, dist)

---

## Package Manager Configuration

**Evidence**: package.json (root)

**Package Manager**: pnpm@9.15.0

**Required Engines**:
```json
{
  "node": ">=20.0.0",
  "pnpm": ">=9.0.0"
}
```

**Root Scripts**:
```json
{
  "setup": "bash scripts/setup.sh",
  "setup:windows": "powershell -ExecutionPolicy Bypass -File scripts/setup.ps1",
  "dev": "turbo run dev",
  "build": "turbo run build",
  "lint": "turbo run lint",
  "type-check": "turbo run type-check",
  "test": "turbo run test",
  "test:coverage": "turbo run test:coverage",
  "clean": "turbo run clean && rm -rf node_modules",
  "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
  "docker:up": "docker compose up -d",
  "docker:down": "docker compose down",
  "docker:restart": "docker compose restart",
  "docker:reset": "docker compose down -v && docker compose up -d",
  "docker:logs": "docker compose logs -f",
  "verify": "bash scripts/verify.sh",
  "prepare": "husky"
}
```

**Analysis**:
- ✅ Standard monorepo script pattern (delegates to turbo)
- ✅ Docker commands for database/services
- ✅ Setup scripts for both Unix and Windows
- ✅ Husky integration for git hooks
- ✅ Prettier for code formatting

---

## Frontend Dependencies (apps/web)

**Evidence**: `specs/web-dependencies.json`

### Core Framework
```
next: 15.1.0                    — Next.js (App Router)
react: ^19.0.0                  — React
react-dom: ^19.0.0              — React DOM
typescript: ^5.7.2              — TypeScript
```

### UI Components (Radix UI)
```
@radix-ui/react-alert-dialog: ^1.1.15
@radix-ui/react-avatar: ^1.1.2
@radix-ui/react-checkbox: ^1.3.3
@radix-ui/react-dialog: ^1.1.15
@radix-ui/react-dropdown-menu: ^2.1.4
@radix-ui/react-label: ^2.1.1
@radix-ui/react-popover: ^1.1.15
@radix-ui/react-scroll-area: ^1.2.10
@radix-ui/react-select: ^2.1.4
@radix-ui/react-separator: ^1.1.1
@radix-ui/react-slot: ^1.2.4
@radix-ui/react-switch: ^1.1.2
@radix-ui/react-tabs: ^1.1.2
@radix-ui/react-toast: ^1.2.4
@radix-ui/react-tooltip: ^1.1.6
```

### Form Management
```
react-hook-form: ^7.54.1        — Form state management
@hookform/resolvers: ^3.9.1     — Form validation resolvers
zod: ^3.24.1                    — Schema validation
```

### Styling
```
tailwindcss: ^4.0.0             — CSS framework
@tailwindcss/postcss: ^4.1.18   — PostCSS integration
class-variance-authority: ^0.7.1 — Component variants
tailwind-merge: ^2.6.0          — Tailwind class merging
clsx: ^2.1.1                    — Conditional classes
```

### Internationalization
```
next-intl: ^3.26.5              — i18n for Next.js
```

### UI Libraries
```
lucide-react: ^0.468.0          — Icon library
recharts: ^3.5.1                — Charts
reactflow: ^11.11.4             — Flow diagrams
framer-motion: ^12.25.0         — Animations
cmdk: ^1.1.1                    — Command palette
sonner: ^2.0.7                  — Toast notifications
date-fns: ^4.1.0                — Date utilities
```

### Dev Dependencies
```
vitest: ^2.1.8                  — Testing framework
@testing-library/react: ^16.1.0 — React testing utilities
@testing-library/jest-dom: ^6.6.3 — DOM matchers
@playwright/test: ^1.49.1       — E2E testing
@percy/playwright: ^1.0.10      — Visual regression testing
@lhci/cli: ^0.15.1              — Lighthouse CI
eslint: ^9.17.0                 — Linting
prettier: ^3.4.2                — Code formatting
```

**Analysis**:
- ✅ Modern dependency versions (Next.js 15, React 19, TypeScript 5.7)
- ✅ Comprehensive UI component library (Radix UI)
- ✅ Full testing stack (unit, E2E, visual regression, performance)
- ✅ Form validation with Zod + React Hook Form
- ✅ i18n support with next-intl
- ⚠️ Large number of dependencies (32 production, 29 dev) — potential bundle size concern

---

## Backend Dependencies (apps/backend)

**Evidence**: apps/backend/pyproject.toml

### Core Framework
```python
fastapi>=0.115.0               — Web framework
uvicorn[standard]>=0.32.0      — ASGI server
pydantic>=2.9.0                — Data validation
pydantic-settings>=2.6.0       — Settings management
```

### Database
```python
sqlalchemy>=2.0.0              — ORM (async)
asyncpg>=0.29.0                — Async PostgreSQL driver
psycopg2-binary>=2.9.0         — Sync PostgreSQL driver
pgvector>=0.3.0                — Vector similarity search
alembic>=1.13.0                — Database migrations
```

### Caching & Performance
```python
redis>=5.0.0                   — Redis async client
slowapi>=0.1.9                 — Rate limiting
prometheus-fastapi-instrumentator>=7.0.0  — Metrics
prometheus-client>=0.19.0      — Prometheus client
```

### Authentication
```python
python-jose[cryptography]>=3.3.0  — JWT tokens
passlib[bcrypt]>=1.7.0         — Password hashing
```

### AI/LLM Stack
```python
langchain>=0.1.0               — LangChain framework
langchain-community>=0.0.20    — Community integrations
langchain-core>=0.1.0          — Core abstractions
langgraph>=0.0.20              — Graph-based orchestration
ollama>=0.1.6                  — Ollama client (local LLMs)
anthropic>=0.39.0              — Claude API
```

### Payments & Notifications
```python
stripe>=7.0.0                  — Payment processing
sendgrid>=6.11.0               — Email notifications
fastapi-mail>=1.4.1            — Email system alerts
```

### Utilities
```python
httpx>=0.27.0                  — Async HTTP client
pyyaml>=6.0.0                  — YAML parsing
structlog>=24.4.0              — Structured logging
python-multipart>=0.0.12       — File uploads
apscheduler>=3.10.0            — Job scheduling
```

### Dev Dependencies
```python
pytest>=8.3.0                  — Testing framework
pytest-asyncio>=0.24.0         — Async test support
pytest-cov>=5.0.0              — Coverage reporting
respx>=0.21.0                  — HTTP mocking
mypy>=1.13.0                   — Type checking
ruff>=0.7.0                    — Linting
```

**Analysis**:
- ✅ Modern async-first stack (FastAPI, SQLAlchemy 2.0, asyncpg)
- ✅ Comprehensive AI/LLM integration (LangChain, LangGraph, Anthropic)
- ✅ Production-ready features (Redis caching, rate limiting, metrics)
- ✅ Security components (JWT, bcrypt password hashing)
- ✅ Payment processing (Stripe)
- ✅ Vector search capability (pgvector)
- ⚠️ AI stack adds significant complexity (5 AI-related packages)

---

## Build System Assessment

### Turbo Pipeline

**Evidence**: turbo.json

**Tasks Configured**:
1. `build` — Production build (depends on upstream builds)
2. `dev` — Development server (no cache, persistent)
3. `lint` — Code linting (depends on upstream lint)
4. `type-check` — TypeScript/Python type checking (depends on upstream)
5. `test` — Test suite (depends on upstream tests)
6. `test:coverage` — Coverage reporting (depends on upstream)
7. `clean` — Clean build artifacts (no cache)

**Analysis**:
- ✅ Proper dependency chain (`dependsOn: ["^build"]` ensures dependencies build first)
- ✅ Cache configuration appropriate (cache disabled for dev/clean)
- ✅ Global dependencies tracked (.env files)

### Frontend Build (Next.js)

**Scripts** (from apps/web/package.json):
```json
{
  "dev": "node ./scripts/dev-with-fallback.mjs",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "type-check": "tsc --noEmit"
}
```

**Analysis**:
- ✅ Custom dev script with fallback mechanism
- ✅ Standard Next.js build process
- ✅ Type checking with TypeScript compiler
- ✅ ESLint integration

### Backend Build (FastAPI)

**Evidence**: No explicit build step required for Python

**Development**:
```bash
uvicorn src.api.main:app --reload
```

**Analysis**:
- ✅ No build step needed (Python is interpreted)
- ✅ Hot reload during development
- ⚠️ No explicit production deployment configuration in pyproject.toml

---

## Configuration File Inventory

**Evidence**: Root directory listing

### Configuration Files Present

**Package Management**:
- `package.json` — Root package configuration ✅
- `pnpm-workspace.yaml` — Workspace definition ✅
- `turbo.json` — Build orchestration ✅
- `.npmrc` — npm registry configuration ✅

**Environment**:
- `.env` — Current environment variables ✅
- `.env.example` — Example environment template ✅
- `.env.local` — Local overrides ✅
- `.env.production` — Production environment ✅
- `.env.production.example` — Production template ✅
- `.env.shopify.example` — Shopify integration template ✅

**Git**:
- `.gitignore` — Git ignore rules ✅
- `.husky/` — Git hooks ✅

**Code Quality**:
- `.prettierrc` — Prettier configuration ✅
- `.prettierignore` — Prettier ignore rules ✅
- `eslint.config.js` (presumably in apps/web) ✅

**VS Code**:
- `.vscode/` — Editor settings ✅

**CI/CD**:
- `.github/` — GitHub Actions workflows ✅

**Testing**:
- `.percy.yml` — Visual regression testing ✅

**Security**:
- `.zap/` — ZAP security testing ✅

**Analysis**:
- ✅ Comprehensive configuration coverage
- ✅ Environment templates provided
- ✅ Code quality tools configured
- ⚠️ Multiple environment files (6 total) — potential confusion risk

---

## Structural Violations

### Unauthorized Folders

**Expected Monorepo Structure**:
```
/
├── apps/          — Applications
├── packages/      — Shared packages
├── docs/          — Documentation
├── scripts/       — Utility scripts
└── [config files]
```

**Actual Structure**:
```
/
├── apps/          ✅
├── packages/      ✅
├── docs/          ✅
├── scripts/       ✅
├── .claude/       ✅ (Allowed — Claude Code framework)
├── .github/       ✅ (Standard)
├── .husky/        ✅ (Standard)
├── .vscode/       ✅ (Standard)
├── specs/         ✅ (THIS AUDIT)
└── [20+ other folders] ⚠️
```

**Non-Standard Folders**:
1. `.beads/` — Custom task management framework
2. `.business-consistency/` — Business logic validation
3. `.content-creation/` — Content guidelines
4. `.copywriting/` — Copywriting templates
5. `.docs/` — Additional documentation (duplicate of `docs/`?)
6. `.journeys/` — User journey definitions
7. `.zap/` — Security testing
8. `audit-reports/` — Audit results
9. `backup/` — Backup files
10. `data/` — Data files
11. `prometheus-data/` — Metrics data
12. `verify/` — Verification scripts

**Severity**: ⚠️ **MEDIUM**

**Impact**:
- Organizational complexity
- Potential confusion for new developers
- Possible redundancy (`.docs/` vs `docs/`)
- Deployment risk (may accidentally include non-production files)

**Recommendation**:
1. Consolidate `.docs/` into `docs/`
2. Move `.beads/`, `.business-consistency/`, `.content-creation/`, `.copywriting/`, `.journeys/` into `docs/frameworks/` or similar
3. Move `audit-reports/` into `docs/audits/`
4. Evaluate necessity of `backup/`, `data/`, `prometheus-data/` in version control
5. Document custom folder structure in root README.md

---

## Critical Dependencies

### Frontend Critical Dependencies

| Package | Version | Purpose | Risk Level |
|---------|---------|---------|------------|
| next | 15.1.0 | Core framework | HIGH — Major upgrades break features |
| react | ^19.0.0 | UI library | HIGH — Major version (potential breaking changes) |
| typescript | ^5.7.2 | Type safety | MEDIUM — Breaking changes rare |
| next-intl | ^3.26.5 | i18n | MEDIUM — Core to multi-language support |
| @radix-ui/* | Various | UI primitives | MEDIUM — Multiple packages (upgrade coordination) |

### Backend Critical Dependencies

| Package | Version | Purpose | Risk Level |
|---------|---------|---------|------------|
| fastapi | >=0.115.0 | Core framework | HIGH — API contract changes |
| sqlalchemy | >=2.0.0 | ORM | HIGH — Database interaction layer |
| pydantic | >=2.9.0 | Validation | HIGH — API contracts depend on this |
| langchain | >=0.1.0 | AI orchestration | HIGH — Rapidly evolving, breaking changes common |
| anthropic | >=0.39.0 | Claude API | MEDIUM — Anthropic controls breaking changes |

**Analysis**:
- ⚠️ React 19 is bleeding-edge (released late 2024) — potential ecosystem compatibility issues
- ⚠️ LangChain 0.1.0 is early version — expect breaking changes
- ✅ SQLAlchemy 2.0 is stable
- ✅ FastAPI is stable
- ⚠️ Next.js 15.1.0 is recent (App Router is now stable)

---

## Monorepo Health Check

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Workspace configuration valid | ✅ PASS | pnpm-workspace.yaml exists and valid |
| Turbo pipeline configured | ✅ PASS | turbo.json exists with proper tasks |
| Root package.json present | ✅ PASS | package.json exists with scripts |
| Apps directory exists | ✅ PASS | apps/web and apps/backend present |
| Build scripts defined | ✅ PASS | `pnpm build` runs turbo build |
| Type checking configured | ✅ PASS | TypeScript + mypy configured |
| Linting configured | ✅ PASS | ESLint + ruff configured |
| Testing configured | ✅ PASS | Vitest + Pytest configured |
| Git hooks configured | ✅ PASS | Husky present |
| Environment templates | ✅ PASS | .env.example files exist |
| Consistent folder structure | ⚠️ WARN | 20+ top-level folders (non-standard) |
| No unauthorized build artifacts | ✅ PASS | .gitignore properly configured |

**Overall Health**: ✅ **GOOD** (with organizational improvements recommended)

---

## Phase 1 Completion Checklist

- [x] Directory structure analyzed
- [x] File counts generated
- [x] Dependencies inventoried (frontend & backend)
- [x] Monorepo configuration validated
- [x] Turbo pipeline assessed
- [x] Build system evaluated
- [x] Configuration files cataloged
- [x] Structural violations identified
- [x] Critical dependencies flagged
- [x] Health check completed
- [x] All evidence captured in specs/

---

## Next Phase

**Phase 2: Backend Deep Inspection** can now begin.

**Prerequisites Met**: ✅ specs/01-STRUCTURE.md created

**Phase 2 will examine**:
- API route inventory
- Database schema
- Service layer architecture
- Type checking results
- Security vulnerabilities
- Zero-tolerance violations

---

**END OF PHASE 1 REPORT**
