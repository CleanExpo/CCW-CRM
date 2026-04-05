# CCW-Online ERP

Full-stack ERP/CRM for equipment suppliers: **Next.js 15** (web), **FastAPI** (API), **PostgreSQL** on Supabase. Monorepo: `pnpm` + Turbo.

## Documentation

- **[Documentation index](docs/README.md)** — guides, runbooks, and references
- **[CLAUDE.md](CLAUDE.md)** — development commands, rules, and architecture pointers for contributors and AI tooling

Legacy / scratch notes that used to live at the repository root are under **[docs/project-root/](docs/project-root/)** (including the previous long-form starter README).

## Quick start

```bash
pnpm install
pnpm dev
```

**Environment:** the only committed template is [`.env.example`](.env.example). Copy the relevant sections into `apps/backend/.env` and `apps/web/.env.local` (see banners inside the file).

See `docs/README.md` and [CLAUDE.md](CLAUDE.md) for setup details and backend tests.
