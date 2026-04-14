<div align="center">

<!-- Hero Section -->
<img src="https://img.icons8.com/fluency/96/artificial-intelligence.png" alt="AI Icon" width="96" height="96"/>

# 🤖 NodeJS-Starter-V1

### 🚀 Self-Contained AI Starter Template

<p align="center">
  <strong>Build AI-powered applications without API keys, cloud accounts, or external dependencies</strong><br/>
  <em>Production-ready • Offline-first • Free forever</em>
</p>

<!-- Badges -->
<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 15"/>
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12"/>
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5.7"/>
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind v4"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/🔓_No_API_Keys-Required-success?style=for-the-badge" alt="No API Keys Required"/>
  <img src="https://img.shields.io/badge/📡_Offline-First-blue?style=for-the-badge" alt="Offline First"/>
  <img src="https://img.shields.io/badge/⚡_Setup-Under_10min-yellow?style=for-the-badge" alt="Setup Under 10min"/>
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License"/>
</p>

<!-- Quick Navigation -->
<p align="center">
  <a href="#-quick-start"><strong>Quick Start</strong></a> •
  <a href="#-what-makes-this-different"><strong>Features</strong></a> •
  <a href="#-architecture"><strong>Architecture</strong></a> •
  <a href="#-documentation"><strong>Docs</strong></a> •
  <a href="#-optional-upgrades"><strong>Upgrades</strong></a>
</p>

---

### ⚡ One-Command Setup

```bash
git clone https://github.com/CleanExpo/NodeJS-Starter-V1.git && cd NodeJS-Starter-V1 && pnpm run setup
```

<p align="center">
  <em>That's it! No API keys. No accounts. No configuration. Just works. 🎉</em>
</p>

</div>

---

## 🎯 What Makes This Different?

<table>
<tr>
<td width="50%">

### 🔓 Zero Barriers to Entry

- **No API Keys** - Start coding immediately
- **No Cloud Accounts** - Everything runs locally
- **No Credit Card** - Completely free
- **No Internet** - Works 100% offline

</td>
<td width="50%">

### 🚀 Production Ready

- **Modern Stack** - Next.js 15, React 19, Python 3.12
- **Best Practices** - TypeScript, testing, CI/CD
- **Real AI** - LangGraph agents with local LLMs
- **Self-Contained** - PostgreSQL + Redis in Docker

</td>
</tr>
</table>

<div align="center">

### 💡 Perfect For

🎓 **Learning AI Development** • 🔧 **Building MVPs** • 🏢 **Internal Tools** • 🧪 **Experimentation**

</div>

---

## 🚀 Quick Start

### Prerequisites

<table>
<tr>
<td align="center"><img src="https://img.icons8.com/color/48/docker.png" alt="Docker"/><br/><strong>Docker</strong><br/><a href="https://docker.com">Download</a></td>
<td align="center"><img src="https://img.icons8.com/color/48/nodejs.png" alt="Node.js"/><br/><strong>Node.js 20+</strong><br/><a href="https://nodejs.org">Download</a></td>
<td align="center"><img src="https://img.icons8.com/color/48/python.png" alt="Python"/><br/><strong>Python 3.12+</strong><br/><a href="https://python.org">Download</a></td>
<td align="center"><img src="https://img.icons8.com/color/48/artificial-intelligence.png" alt="Ollama"/><br/><strong>Ollama</strong><br/><a href="https://ollama.com">Download</a></td>
</tr>
</table>

### Installation (< 10 minutes)

```bash
# 1️⃣ Clone the repository
git clone https://github.com/CleanExpo/NodeJS-Starter-V1.git
cd NodeJS-Starter-V1

# 2️⃣ Run automated setup (installs dependencies, starts Docker, pulls AI models)
pnpm run setup              # macOS/Linux
pnpm run setup:windows      # Windows

# 3️⃣ Start development servers
pnpm dev
```

### 🎉 Success! Your services are running:

| Service            | URL                    | Description            |
| ------------------ | ---------------------- | ---------------------- |
| 🎨 **Frontend**    | http://localhost:3000  | Next.js React app      |
| ⚡ **Backend API** | http://localhost:8000  | FastAPI server         |
| 🐘 **PostgreSQL**  | localhost:5432         | Database with pgvector |
| 🔴 **Redis**       | localhost:6379         | Cache & sessions       |
| 🤖 **Ollama**      | http://localhost:11434 | Local AI models        |

---

## ✨ Features

### 🎨 Modern Frontend

<table>
<tr>
<td width="50%">

**Framework & UI**

- ⚛️ Next.js 15 with App Router
- 🎭 React 19 with Server Components
- 🎨 Tailwind CSS v4 + design tokens
- 🧩 shadcn/ui component library
- 📱 Fully responsive design
- ♿ WCAG 2.1 AA accessible

</td>
<td width="50%">

**Developer Experience**

- 📘 TypeScript for type safety
- 🔥 Hot module replacement
- 🧪 Vitest + React Testing Library
- 🎭 Playwright E2E tests
- 🎯 ESLint + Prettier configured
- 📦 Turborepo for monorepo

</td>
</tr>
</table>

### ⚡ High-Performance Backend

<table>
<tr>
<td width="50%">

**Core Technologies**

- 🚀 FastAPI (async Python)
- 🔐 JWT Authentication (no external auth)
- 🗄️ SQLAlchemy 2.0 ORM
- 📊 Alembic migrations
- 🔍 Structured logging
- ⚡ Redis caching

</td>
<td width="50%">

**AI Capabilities**

- 🤖 LangGraph agent orchestration
- 🧠 Multi-agent workflows
- 🔀 Provider abstraction (Ollama/Claude)
- 🎯 RAG with vector embeddings
- 📝 Streaming responses
- 🛠️ Tool calling & function execution

</td>
</tr>
</table>

### 🗄️ Self-Contained Database

<table>
<tr>
<td width="50%">

**PostgreSQL Features**

- 🐘 PostgreSQL 15 in Docker
- 🔍 pgvector for AI embeddings
- 📊 Full-text search ready
- 🔄 Auto-migrations on startup
- 💾 Persistent volumes
- 🏥 Health checks configured

</td>
<td width="50%">

**What's Included**

- 👤 User authentication schema
- 📄 Document storage
- 🔗 Contractor availability system
- 🎯 Vector similarity search
- 📈 Indexes optimized
- 🌱 Seed data for testing

</td>
</tr>
</table>

### 🤖 AI Integration (No API Keys!)

<table>
<tr>
<td width="50%">

**Local AI (Default - FREE)**

- 🏠 Ollama runtime
- 🦙 Llama 3.1 (8B) model
- 📊 Nomic embeddings
- 💰 Zero cost
- 🔒 100% private
- 📡 Works offline

</td>
<td width="50%">

**Cloud AI (Optional - Paid)**

- ☁️ Claude 4.5 Opus/Sonnet/Haiku
- 🎯 Better reasoning quality
- ⚡ Faster responses
- 🛠️ Tool use support
- 🔄 Easy to switch
- 💵 Pay per use

</td>
</tr>
</table>

### 🧪 Testing & Quality

<div align="center">

✅ **Zero External Dependencies for CI/CD**

</div>

<table>
<tr>
<td width="33%">

**Testing**

- 🧪 Pytest (backend)
- 🃏 Vitest (frontend)
- 🎭 Playwright (E2E)
- 📊 Coverage reports
- 🔄 Watch mode

</td>
<td width="33%">

**Code Quality**

- 🔍 ESLint + Ruff
- 📘 TypeScript + mypy
- 🎨 Prettier formatting
- 🔧 Git hooks
- 📏 Consistent standards

</td>
<td width="33%">

**Security**

- 🔒 NPM Audit
- 🛡️ Trivy scanning
- ⚠️ Optional Snyk
- 🔐 JWT best practices
- 🔑 Secret detection

</td>
</tr>
</table>

---

## 🏗️ Architecture

<div align="center">

```
┌─────────────────────────────────────────────────────────────────┐
│                     🎨 FRONTEND (Next.js 15)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ React 19 │──│Tailwind  │──│shadcn/ui │──│ Server Components││
│  │    +     │  │   v4     │  │Components│  │       (RSC)      ││
│  │TypeScript│  └──────────┘  └──────────┘  └──────────────────┘│
│  └────┬─────┘                                                    │
│       │ JWT Auth (Cookie-based)                                  │
└───────┼──────────────────────────────────────────────────────────┘
        │
        │ REST API (http://localhost:8000)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ⚡ BACKEND (FastAPI + Python)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ FastAPI  │──│LangGraph │──│  Agents  │──│   AI Provider    ││
│  │  Routes  │  │Workflows │  │Orchestra-│  │    Selector      ││
│  │   (API)  │  │  (Async) │  │   tor    │  │ (Ollama/Claude)  ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│
│       │             │              │                  │          │
│  ┌────▼─────────────▼──────────────▼──────────────────▼────────┐│
│  │           SQLAlchemy ORM + Alembic Migrations              │ │
│  └──────────────────────────────┬──────────────────────────────┘│
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  🐳 LOCAL SERVICES (Docker)                      │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  PostgreSQL 15  │  │    Redis 7      │  │   Ollama API    │ │
│  │   + pgvector    │  │   (Caching)     │  │  (Local LLMs)   │ │
│  │  :5432          │  │    :6379        │  │   :11434        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

</div>

### 🔑 Key Principles

<table>
<tr>
<td width="33%" align="center">
<h4>🏠 Local-First</h4>
Everything runs on your machine. No cloud required.
</td>
<td width="33%" align="center">
<h4>🔓 Zero Barriers</h4>
No API keys, accounts, or configuration needed.
</td>
<td width="33%" align="center">
<h4>📈 Production Ready</h4>
Real authentication, testing, CI/CD included.
</td>
</tr>
</table>

---

## 📁 Project Structure

```
📦 NodeJS-Starter-V1/
│
├── 📂 apps/
│   ├── 📂 web/                      # Next.js Frontend
│   │   ├── 📂 app/                  # App Router pages
│   │   │   ├── 📄 page.tsx          # Home page
│   │   │   ├── 📄 layout.tsx        # Root layout
│   │   │   └── 📂 (routes)/         # Route groups
│   │   ├── 📂 components/           # React components
│   │   │   ├── 📂 ui/               # shadcn/ui components
│   │   │   └── 📂 features/         # Feature components
│   │   ├── 📂 lib/
│   │   │   ├── 📂 api/              # API client (replaces Supabase)
│   │   │   │   ├── 📄 client.ts     # Fetch wrapper
│   │   │   │   ├── 📄 auth.ts       # Auth API
│   │   │   │   └── 📄 server.ts     # Server-side client
│   │   │   └── 📂 utils/            # Utility functions
│   │   └── 📄 middleware.ts         # JWT auth middleware
│   │
│   └── 📂 backend/                  # Python Backend
│       ├── 📂 src/
│       │   ├── 📂 agents/           # AI agents
│       │   │   ├── 📄 coordinator.py
│       │   │   └── 📄 specialized.py
│       │   ├── 📂 api/              # FastAPI routes
│       │   │   ├── 📄 main.py       # API entry point
│       │   │   ├── 📄 deps.py       # Dependencies
│       │   │   └── 📂 routes/       # Route handlers
│       │   ├── 📂 auth/             # Authentication
│       │   │   ├── 📄 jwt.py        # JWT tokens
│       │   │   └── 📄 models.py     # User model
│       │   ├── 📂 config/           # Configuration
│       │   │   ├── 📄 database.py   # SQLAlchemy setup
│       │   │   └── 📄 settings.py   # App settings
│       │   ├── 📂 db/               # Database
│       │   │   └── 📄 models.py     # ORM models
│       │   └── 📂 models/           # AI providers
│       │       ├── 📄 base_provider.py
│       │       ├── 📄 ollama_provider.py
│       │       ├── 📄 anthropic.py
│       │       └── 📄 selector.py
│       └── 📂 tests/                # Pytest tests
│
├── 📂 scripts/                      # Setup & utilities
│   ├── 📄 setup.sh                  # Automated setup (Unix/macOS)
│   ├── 📄 setup.ps1                 # Automated setup (Windows)
│   ├── 📄 verify.sh                 # Health check script
│   └── 📄 init-db.sql               # PostgreSQL schema
│
├── 📂 .github/
│   ├── 📂 workflows/                # CI/CD pipelines
│   │   ├── 📄 ci.yml                # Main CI (no secrets!)
│   │   ├── 📄 security.yml          # Security scans
│   │   └── 📂 examples/             # Optional deployment templates
│   └── 📄 SECRETS.md                # Optional secrets guide
│
├── 📂 docs/                         # Documentation
│   ├── 📄 LOCAL_SETUP.md            # Complete setup guide
│   ├── 📄 AI_PROVIDERS.md           # Ollama vs Claude
│   ├── 📄 OPTIONAL_SERVICES.md      # Deployment guides
│   └── 📄 new-project-checklist.md  # Quick start checklist
│
├── 📄 docker-compose.yml            # PostgreSQL + Redis
├── 📄 .env.example                  # Environment template
├── 📄 package.json                  # Root dependencies
├── 📄 turbo.json                    # Turborepo config
└── 📄 README.md                     # This file
```

---

## 🔧 Development

### Start All Services

```bash
# One command to rule them all
pnpm dev
```

This starts:

- ✅ Frontend (Next.js) → http://localhost:3000
- ✅ Backend (FastAPI) → http://localhost:8000
- ✅ PostgreSQL → localhost:5432
- ✅ Redis → localhost:6379
- ✅ Ollama → http://localhost:11434 (if installed)

### Individual Services

<table>
<tr>
<td width="50%">

**Frontend Only**

```bash
pnpm dev --filter=web
```

</td>
<td width="50%">

**Backend Only**

```bash
cd apps/backend
uv run uvicorn src.api.main:app --reload
```

</td>
</tr>
<tr>
<td width="50%">

**Database Only**

```bash
docker compose up postgres redis
```

</td>
<td width="50%">

**Verify Installation**

```bash
pnpm run verify
```

</td>
</tr>
</table>

### Quality Checks

```bash
# Run all checks (linting, type-check, tests)
pnpm turbo run lint type-check test

# Backend checks
cd apps/backend
uv run ruff check src/      # Linting
uv run mypy src/            # Type checking
uv run pytest --cov         # Tests with coverage

# Frontend checks
pnpm lint --filter=web      # Linting
pnpm type-check --filter=web # Type checking
pnpm test --filter=web      # Tests with coverage
```

### Docker Management

```bash
pnpm run docker:up       # Start PostgreSQL + Redis
pnpm run docker:down     # Stop services
pnpm run docker:restart  # Restart services
pnpm run docker:reset    # Reset database (⚠️ destroys data)
pnpm run docker:logs     # View logs
```

---

## 🤖 AI Models

### 🏠 Local (Default - FREE)

<table>
<tr>
<th>Provider</th>
<th>Model</th>
<th>Size</th>
<th>Use Case</th>
<th>Cost</th>
</tr>
<tr>
<td>Ollama</td>
<td>llama3.1:8b</td>
<td>4.7GB</td>
<td>General tasks, chat, reasoning</td>
<td><strong>FREE</strong></td>
</tr>
<tr>
<td>Ollama</td>
<td>nomic-embed-text</td>
<td>274MB</td>
<td>Text embeddings for RAG</td>
<td><strong>FREE</strong></td>
</tr>
</table>

### ☁️ Cloud (Optional - Paid)

<table>
<tr>
<th>Provider</th>
<th>Model</th>
<th>Use Case</th>
<th>Input Cost</th>
<th>Output Cost</th>
</tr>
<tr>
<td>Anthropic</td>
<td>Claude Opus 4.5</td>
<td>Complex reasoning, analysis</td>
<td>$15/1M tokens</td>
<td>$75/1M tokens</td>
</tr>
<tr>
<td>Anthropic</td>
<td>Claude Sonnet 4.5</td>
<td>Balanced quality/speed</td>
<td>$3/1M tokens</td>
<td>$15/1M tokens</td>
</tr>
<tr>
<td>Anthropic</td>
<td>Claude Haiku 4.5</td>
<td>Fast, simple tasks</td>
<td>$0.25/1M tokens</td>
<td>$1.25/1M tokens</td>
</tr>
</table>

### 🔄 Switching Providers

```bash
# Default (Ollama - local, free)
AI_PROVIDER=ollama

# Upgrade to Claude (cloud, paid)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Restart backend
pnpm dev
```

The provider layer automatically handles the switch!

---

## ⚙️ Environment Configuration

### 🟢 Default Config (Works Out of the Box)

```env
# Database (PostgreSQL in Docker)
DATABASE_URL=postgresql://starter_user:local_dev_password@localhost:5432/starter_db

# JWT Authentication
JWT_SECRET_KEY=your-secret-key-change-in-production-use-long-random-string
JWT_EXPIRE_MINUTES=60

# AI Provider (Local by default)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# API Settings
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**✅ This configuration requires ZERO API keys and works completely offline!**

### 🔵 Optional Cloud Upgrades

```env
# Anthropic Claude (Optional)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Other AI Providers (Optional)
OPENAI_API_KEY=sk-xxx
GOOGLE_AI_API_KEY=xxx

# MCP Tools (Optional)
EXA_API_KEY=xxx
BRAVE_SEARCH_API_KEY=xxx
```

---

## 🚢 Optional Upgrades

### Deploy to Production (When Ready)

<table>
<tr>
<td width="50%">

**Frontend Hosting**

- ✅ [Vercel](https://vercel.com) (Recommended)
- ✅ [Netlify](https://netlify.com)
- ✅ [Cloudflare Pages](https://pages.cloudflare.com)
- ✅ [AWS Amplify](https://aws.amazon.com/amplify/)

</td>
<td width="50%">

**Backend Hosting**

- ✅ [DigitalOcean](https://digitalocean.com) App Platform
- ✅ [Railway](https://railway.app)
- ✅ [Fly.io](https://fly.io)
- ✅ [Render](https://render.com)
- ✅ AWS/GCP/Azure

</td>
</tr>
</table>

**Deployment examples** available in `.github/workflows/examples/`

### Upgrade to Cloud AI

```bash
# 1. Get API key
# Visit https://console.anthropic.com/

# 2. Update .env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# 3. Restart
pnpm dev
```

### Add External Services

See [`docs/OPTIONAL_SERVICES.md`](docs/OPTIONAL_SERVICES.md) for guides on:

- 📊 Codecov (coverage tracking)
- 🔒 Snyk (security scanning)
- 🐛 Sentry (error monitoring)
- 📈 PostHog (analytics)
- ✉️ Resend (email)
- 💳 Stripe (payments)

---

## 🧪 Testing

<table>
<tr>
<td width="50%">

### Backend Tests (Pytest)

```bash
cd apps/backend

# Run all tests
uv run pytest

# With coverage
uv run pytest --cov

# Watch mode
uv run pytest-watch

# Specific test
uv run pytest tests/test_auth.py
```

</td>
<td width="50%">

### Frontend Tests (Vitest + Playwright)

```bash
# Unit tests
pnpm test --filter=web

# With coverage
pnpm test:coverage --filter=web

# E2E tests
pnpm test:e2e --filter=web

# Watch mode
pnpm test:watch --filter=web
```

</td>
</tr>
</table>

### View Coverage Reports

```bash
# Backend
open apps/backend/htmlcov/index.html

# Frontend
open apps/web/coverage/index.html
```

**Note:** All tests run locally without external services. CI/CD works out of the box!

---

## 📚 Documentation

<table>
<tr>
<th>Document</th>
<th>Description</th>
</tr>
<tr>
<td><a href="docs/LOCAL_SETUP.md">📖 LOCAL_SETUP.md</a></td>
<td>Complete local development guide with Docker setup & troubleshooting</td>
</tr>
<tr>
<td><a href="docs/AI_PROVIDERS.md">🤖 AI_PROVIDERS.md</a></td>
<td>Comprehensive Ollama vs Claude comparison with setup guides</td>
</tr>
<tr>
<td><a href="docs/OPTIONAL_SERVICES.md">🚀 OPTIONAL_SERVICES.md</a></td>
<td>Deployment guides and cloud service integration</td>
</tr>
<tr>
<td><a href="docs/new-project-checklist.md">✅ new-project-checklist.md</a></td>
<td>Quick 3-step setup checklist</td>
</tr>
<tr>
<td><a href=".github/SECRETS.md">🔐 SECRETS.md</a></td>
<td>Optional GitHub secrets reference (all secrets optional!)</td>
</tr>
</table>

### External Framework Docs

- 📘 [Next.js Documentation](https://nextjs.org/docs) - Frontend framework
- ⚡ [FastAPI Documentation](https://fastapi.tiangolo.com/) - Backend framework
- 🤖 [LangGraph Documentation](https://langchain-ai.github.io/langgraph/) - Agent orchestration
- 🦙 [Ollama Documentation](https://ollama.com/) - Local AI runtime
- 🎨 [shadcn/ui Documentation](https://ui.shadcn.com/) - UI components
- 🐘 [PostgreSQL Documentation](https://www.postgresql.org/docs/) - Database

---

## 🔧 Troubleshooting

<details>
<summary><strong>🤖 Ollama not running</strong></summary>

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh  # Linux/macOS
# Windows: Download from https://ollama.com/

# Pull required models
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# Start Ollama service
ollama serve

# Verify
curl http://localhost:11434/api/tags
```

</details>

<details>
<summary><strong>🐘 Database connection errors</strong></summary>

```bash
# Check if services are running
docker compose ps

# View logs
docker compose logs postgres

# Restart services
docker compose down
docker compose up -d

# Reset database (⚠️ DESTROYS ALL DATA)
docker compose down -v
docker compose up -d
```

</details>

<details>
<summary><strong>🔴 Port already in use</strong></summary>

```bash
# Check what's using the port
# macOS/Linux
lsof -i :3000   # Frontend
lsof -i :8000   # Backend
lsof -i :5432   # PostgreSQL

# Windows
netstat -ano | findstr :3000

# Kill the process or change ports in .env
```

</details>

<details>
<summary><strong>📦 Dependencies not installing</strong></summary>

```bash
# Clear caches and reinstall
rm -rf node_modules apps/*/node_modules
pnpm store prune
pnpm install

# Backend dependencies
cd apps/backend
rm -rf .venv
uv sync
```

</details>

<details>
<summary><strong>🔥 Hot reload not working</strong></summary>

```bash
# Increase file watcher limit (Linux/macOS)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Restart dev server
pnpm dev
```

</details>

**More troubleshooting**: See [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md)

---

## 🤝 Contributing

Contributions are welcome! This is a **template project** designed to help developers start new projects quickly.

### Ways to Contribute

<table>
<tr>
<td align="center" width="25%">
<h4>🍴 Fork It</h4>
Use this template for your own projects
</td>
<td align="center" width="25%">
<h4>🐛 Report Issues</h4>
Found a bug? Let us know!
</td>
<td align="center" width="25%">
<h4>✨ Submit PRs</h4>
Improve the template for everyone
</td>
<td align="center" width="25%">
<h4>📢 Share</h4>
Show off what you built!
</td>
</tr>
</table>

### Contribution Guidelines

- ✅ Keep it self-contained (no required external services)
- ✅ Maintain offline-first capability
- ✅ Document any new dependencies
- ✅ Include tests for new features
- ✅ Follow existing code style
- ✅ Update documentation

---

## 📊 Stats & Benchmarks

<table>
<tr>
<td align="center" width="25%">
<h3>⚡ Setup Time</h3>
<h1>&lt;10 min</h1>
From clone to running app
</td>
<td align="center" width="25%">
<h3>💰 Cost</h3>
<h1>$0</h1>
Completely free locally
</td>
<td align="center" width="25%">
<h3>🔑 API Keys</h3>
<h1>0</h1>
Zero required to start
</td>
<td align="center" width="25%">
<h3>📦 Services</h3>
<h1>5</h1>
All running locally
</td>
</tr>
</table>

### What's Included

- 📁 **39 files** changed from base template
- ➕ **6,276 lines** of new code added
- ✂️ **1,430 lines** removed (simplified)
- 📚 **2,700+ lines** of documentation
- 🧪 **Full test coverage** for critical paths

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**TL;DR:** Use it for anything - commercial, personal, open source, proprietary. No attribution required (but appreciated!).

---

<div align="center">

## 🎯 Ready to Build?

<p>
  <strong>Clone the repo, run the setup script, and start building your AI-powered application!</strong>
</p>

```bash
git clone https://github.com/CleanExpo/NodeJS-Starter-V1.git && cd NodeJS-Starter-V1 && pnpm run setup && pnpm dev
```

<p>
  <sub>No API keys • No accounts • No deployment required • Just works 🎉</sub>
</p>

---

### 💬 Questions or Issues?

[📖 Check the Docs](docs/) • [🐛 Report a Bug](https://github.com/CleanExpo/NodeJS-Starter-V1/issues) • [💡 Request a Feature](https://github.com/CleanExpo/NodeJS-Starter-V1/issues)

---

<p>
  <strong>Built with ❤️ for developers who want to build AI apps without barriers</strong>
</p>

**[⬆ Back to Top](#-nodejs-starter-v1)**

</div>
