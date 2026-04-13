# CCW-Online ERP

Full-stack ERP/CRM for equipment suppliers: **Next.js** (App Router in `src/app/`), **FastAPI** (API in `backend/`), **PostgreSQL** on Supabase. One **npm** package at the repo root (no workspaces).

## Documentation

- **[Documentation index](docs/README.md)** — guides, runbooks, and references

Legacy / scratch notes that used to live at the repository root are under **[docs/project-root/](docs/project-root/)** (including the previous long-form starter README).

## Quick start

```bash
npm install
npm run dev
```

**Environment:** the only committed template is [`.env.example`](.env.example). Copy the relevant sections into `backend/.env` and `.env.local` at the repo root (see banners inside the file).

**Vercel:** leave **Root Directory** at **`.`** (repository root). Add a root `vercel.json` if you need framework settings.

See `docs/README.md` for setup details and backend tests.
