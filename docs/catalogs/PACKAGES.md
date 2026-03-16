# Packages Catalog — CCW ERP/CRM

# Last Updated: 2026-03-17

# Frontend Total: 30 direct + 25 dev = 55 packages

# Backend Total: 34 direct + 8 dev = 42 packages

# Source: apps/web/package.json + apps/backend/pyproject.toml

---

## Frontend Packages (apps/web/package.json)

### Direct Dependencies (30)

| #   | Package                       | Version  | Category      | Purpose                                               |
| --- | ----------------------------- | -------- | ------------- | ----------------------------------------------------- |
| 1   | next                          | 16.1.6   | Framework     | Next.js App Router — DO NOT UPGRADE without approval  |
| 2   | react                         | ^19.0.0  | Framework     | React 19 UI library — DO NOT UPGRADE without approval |
| 3   | react-dom                     | ^19.0.0  | Framework     | React DOM renderer                                    |
| 4   | @hookform/resolvers           | ^3.9.1   | Forms         | Zod resolver for React Hook Form                      |
| 5   | @radix-ui/react-alert-dialog  | ^1.1.15  | UI (shadcn)   | Alert dialog for delete confirmations                 |
| 6   | @radix-ui/react-avatar        | ^1.1.2   | UI (shadcn)   | Avatar component                                      |
| 7   | @radix-ui/react-checkbox      | ^1.3.3   | UI (shadcn)   | Checkbox primitive                                    |
| 8   | @radix-ui/react-dialog        | ^1.1.15  | UI (shadcn)   | Modal dialog for CRUD forms                           |
| 9   | @radix-ui/react-dropdown-menu | ^2.1.4   | UI (shadcn)   | Dropdown menu                                         |
| 10  | @radix-ui/react-label         | ^2.1.1   | UI (shadcn)   | Form label                                            |
| 11  | @radix-ui/react-popover       | ^1.1.15  | UI (shadcn)   | Popover for date pickers                              |
| 12  | @radix-ui/react-scroll-area   | ^1.2.10  | UI (shadcn)   | Custom scrollbar                                      |
| 13  | @radix-ui/react-select        | ^2.1.4   | UI (shadcn)   | Select/dropdown                                       |
| 14  | @radix-ui/react-separator     | ^1.1.1   | UI (shadcn)   | Divider                                               |
| 15  | @radix-ui/react-slot          | ^1.2.4   | UI (shadcn)   | Slot primitive (asChild)                              |
| 16  | @radix-ui/react-switch        | ^1.1.2   | UI (shadcn)   | Toggle switch                                         |
| 17  | @radix-ui/react-tabs          | ^1.1.2   | UI (shadcn)   | Tabs for settings/reports                             |
| 18  | @radix-ui/react-toast         | ^1.2.4   | UI (shadcn)   | Toast notifications                                   |
| 19  | @radix-ui/react-tooltip       | ^1.1.6   | UI (shadcn)   | Tooltips                                              |
| 20  | @sentry/nextjs                | ^10.38.0 | Monitoring    | Sentry error tracking                                 |
| 21  | @supabase/supabase-js         | ^2.95.3  | Auth/DB       | Supabase client for prod auth                         |
| 22  | class-variance-authority      | ^0.7.1   | Styling       | Type-safe component variants (shadcn)                 |
| 23  | clsx                          | ^2.1.1   | Utility       | Conditional className merging                         |
| 24  | cmdk                          | ^1.1.1   | UI            | Command palette (CMD+K)                               |
| 25  | date-fns                      | ^4.1.0   | Utility       | Date formatting/manipulation                          |
| 26  | framer-motion                 | ^12.25.0 | Animation     | Physics-based animations                              |
| 27  | lucide-react                  | ^0.468.0 | Icons         | Icon library                                          |
| 28  | next-intl                     | ^4.8.2   | i18n          | Internationalization (10 languages)                   |
| 29  | react-hook-form               | ^7.54.1  | Forms         | Form state management — core library                  |
| 30  | react-markdown                | ^10.1.0  | Content       | Markdown rendering                                    |
| 31  | reactflow                     | ^11.11.4 | Visualization | Node-based graph (agent flows)                        |
| 32  | recharts                      | ^3.5.1   | Charts        | Dashboard/KPI charts                                  |
| 33  | sonner                        | ^2.0.7   | Notifications | Toast system                                          |
| 34  | tailwind-merge                | ^2.6.0   | Styling       | Tailwind class merge (cn() utility)                   |
| 35  | zod                           | ^3.24.1  | Validation    | Schema validation — core library                      |

### Dev Dependencies (25)

| #   | Package                          | Version  | Category         | Purpose                                           |
| --- | -------------------------------- | -------- | ---------------- | ------------------------------------------------- |
| 1   | typescript                       | ^5.7.2   | Language         | TypeScript — DO NOT UPGRADE without approval      |
| 2   | tailwindcss                      | ^4.0.0   | Styling          | Tailwind CSS v4 — DO NOT UPGRADE without approval |
| 3   | vitest                           | ^2.1.8   | Testing          | Unit test runner                                  |
| 4   | @playwright/test                 | ^1.49.1  | Testing/E2E      | End-to-end browser testing                        |
| 5   | @testing-library/react           | ^16.1.0  | Testing          | React component testing                           |
| 6   | @testing-library/jest-dom        | ^6.6.3   | Testing          | DOM assertion matchers                            |
| 7   | @testing-library/user-event      | ^14.6.1  | Testing          | User interaction simulation                       |
| 8   | @vitest/coverage-v8              | ^2.1.8   | Testing          | Code coverage                                     |
| 9   | @pact-foundation/pact            | ^16.0.4  | Testing/Contract | Consumer-driven contract testing                  |
| 10  | @percy/playwright                | ^1.0.10  | Testing/Visual   | Visual regression testing                         |
| 11  | @axe-core/playwright             | ^4.11.0  | Testing/A11y     | Accessibility testing                             |
| 12  | axe-core                         | ^4.11.0  | Testing/A11y     | Accessibility engine                              |
| 13  | @lhci/cli                        | ^0.15.1  | Testing/Perf     | Lighthouse CI                                     |
| 14  | eslint                           | ^9.17.0  | Linting          | Code quality enforcement                          |
| 15  | eslint-config-next               | 15.1.0   | Linting          | Next.js ESLint config                             |
| 16  | @eslint/eslintrc                 | ^3.2.0   | Linting          | ESLint config support                             |
| 17  | @eslint/js                       | ^9.17.0  | Linting          | ESLint JS rules                                   |
| 18  | @typescript-eslint/eslint-plugin | ^8.18.0  | Linting          | TS ESLint plugin                                  |
| 19  | @typescript-eslint/parser        | ^8.18.0  | Linting          | TS ESLint parser                                  |
| 20  | prettier                         | ^3.4.2   | Formatting       | Code formatter                                    |
| 21  | prettier-plugin-tailwindcss      | ^0.7.2   | Formatting       | Tailwind class sorting                            |
| 22  | @vitejs/plugin-react             | ^4.3.4   | Build            | Vite React plugin                                 |
| 23  | @tailwindcss/postcss             | ^4.1.18  | Build            | Tailwind PostCSS plugin                           |
| 24  | autoprefixer                     | ^10.4.20 | Build            | CSS autoprefixer                                  |
| 25  | postcss                          | ^8.4.49  | Build            | CSS processor                                     |
| 26  | jsdom                            | ^25.0.1  | Testing          | DOM environment for tests                         |
| 27  | @types/node                      | ^22.10.0 | Types            | Node.js type definitions                          |
| 28  | @types/react                     | ^19.0.1  | Types            | React type definitions                            |
| 29  | @types/react-dom                 | ^19.0.1  | Types            | React DOM type definitions                        |
| 30  | @types/uuid                      | ^10.0.0  | Types            | UUID type definitions                             |

---

## Backend Packages (apps/backend/pyproject.toml)

### Direct Dependencies (34)

| #   | Package                           | Version   | Category         | Purpose                                                |
| --- | --------------------------------- | --------- | ---------------- | ------------------------------------------------------ |
| 1   | fastapi                           | >=0.115.0 | Framework        | FastAPI — DO NOT UPGRADE without approval              |
| 2   | uvicorn[standard]                 | >=0.32.0  | Server           | ASGI server                                            |
| 3   | sqlalchemy                        | >=2.0.0   | ORM              | SQLAlchemy 2.0 async — DO NOT UPGRADE without approval |
| 4   | asyncpg                           | >=0.29.0  | DB Driver        | Async PostgreSQL driver                                |
| 5   | psycopg2-binary                   | >=2.9.0   | DB Driver        | Sync PostgreSQL driver (migrations)                    |
| 6   | pgvector                          | >=0.3.0   | DB/AI            | Vector similarity search                               |
| 7   | alembic                           | >=1.13.0  | Migrations       | Database schema migrations                             |
| 8   | redis                             | >=5.0.0   | Caching          | Redis async client                                     |
| 9   | python-jose[cryptography]         | >=3.3.0   | Auth             | JWT tokens — DO NOT MODIFY                             |
| 10  | passlib[bcrypt]                   | >=1.7.0   | Auth             | Password hashing — DO NOT MODIFY                       |
| 11  | stripe                            | >=7.0.0   | Payments         | Stripe payment processing                              |
| 12  | pydantic                          | >=2.9.0   | Validation       | Pydantic v2 — DO NOT UPGRADE without approval          |
| 13  | pydantic-settings                 | >=2.6.0   | Configuration    | Environment-based settings                             |
| 14  | email-validator                   | >=2.0.0   | Validation       | Email format validation                                |
| 15  | python-dotenv                     | >=1.0.0   | Configuration    | .env file loading                                      |
| 16  | httpx                             | >=0.27.0  | HTTP Client      | Async HTTP for all integrations                        |
| 17  | pyyaml                            | >=6.0.0   | Configuration    | YAML parsing                                           |
| 18  | structlog                         | >=24.4.0  | Logging          | Structured JSON logging                                |
| 19  | python-multipart                  | >=0.0.12  | File Upload      | Multipart form data parsing                            |
| 20  | slowapi                           | >=0.1.9   | Rate Limiting    | Rate limiting middleware                               |
| 21  | sendgrid                          | >=6.11.0  | Email            | SendGrid delivery                                      |
| 22  | fastapi-mail                      | >=1.4.1   | Email            | Email notifications                                    |
| 23  | prometheus-fastapi-instrumentator | >=7.0.0   | Monitoring       | Auto-instrumented Prometheus metrics                   |
| 24  | prometheus-client                 | >=0.19.0  | Monitoring       | Custom Prometheus metrics                              |
| 25  | apscheduler                       | >=3.10.0  | Scheduling       | Background job scheduling                              |
| 26  | langchain                         | >=0.1.0   | AI/LLM           | LangChain agent framework                              |
| 27  | langchain-community               | >=0.0.20  | AI/LLM           | LangChain community integrations                       |
| 28  | langchain-core                    | >=0.1.0   | AI/LLM           | Core LangChain abstractions                            |
| 29  | langgraph                         | >=0.0.20  | AI/Orchestration | Stateful multi-agent graphs                            |
| 30  | ollama                            | >=0.1.6   | AI/LLM           | Local LLM for code generation                          |
| 31  | anthropic                         | >=0.39.0  | AI/LLM           | Claude API                                             |
| 32  | sse-starlette                     | >=3.2.0   | Real-Time        | Server-Sent Events                                     |
| 33  | sentry-sdk[fastapi]               | >=2.52.0  | Monitoring       | Error tracking                                         |
| 34  | supabase                          | >=2.0.0   | DB/Auth          | Supabase client                                        |

### Dev Dependencies (8)

| #   | Package        | Version  | Category      | Purpose                         |
| --- | -------------- | -------- | ------------- | ------------------------------- |
| 1   | pytest         | >=8.3.0  | Testing       | Test runner                     |
| 2   | pytest-asyncio | >=0.24.0 | Testing       | Async test support              |
| 3   | pytest-cov     | >=5.0.0  | Testing       | Code coverage                   |
| 4   | respx          | >=0.21.0 | Testing       | HTTP mocking                    |
| 5   | mypy           | >=1.13.0 | Type Checking | Static type checking            |
| 6   | ruff           | >=0.7.0  | Linting       | Fast Python linter/formatter    |
| 7   | httpx          | >=0.27.0 | Testing       | HTTP client (also direct dep)   |
| 8   | requests       | >=2.31.0 | Testing       | Sync HTTP for integration tests |
| 9   | faker          | >=28.0.0 | Testing       | Fake data for load tests        |
