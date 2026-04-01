# Workflows

## Branch Naming

```
main              # Production-ready (auto-deploys to Vercel)
feature/<name>    # New features
fix/<name>        # Bug fixes
ai-updates        # AI-driven work branch
```

Current active branch: `fix/railway-cache-auth-500`

## Commit Messages

```
feat(web): add dark mode toggle
fix(backend): resolve agent timeout
chore(git): update .gitignore entries
docs(skills): update orchestrator guide
refactor(api): simplify product endpoint
test(cin7): add integration test for sync
```

Format: `<type>(<scope>): <description>`
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`
Scopes: `web`, `backend`, `api`, `db`, `video`, `git`, `skills`, `cin7`, `billing`

## Task Execution Protocol

```
1. Read PROGRESS.md — understand current state
2. Read relevant source files — understand what exists
3. Plan: identify files to change, steps, risks
4. Get approval if non-trivial (use EnterPlanMode)
5. Implement exactly as planned
6. Run type-check + tests
7. Report changes (update PROGRESS.md)
```

## PR Checklist

- [ ] `pnpm turbo run type-check` — zero errors
- [ ] `pnpm turbo run lint` — zero warnings
- [ ] `pnpm turbo run test` — all pass
- [ ] No locked files modified (demo_models.py, middleware.ts, demo_auth.py)
- [ ] No existing API response shapes broken
- [ ] New routes/pages added to `docs/catalogs/`
- [ ] Commit messages follow convention

## Deployment

### Frontend (Vercel)
Push to `main` triggers auto-deploy. Preview deployments on PRs.
Production URL: `ccw-crm-web.vercel.app`

### Backend (Railway)
Push to `main` triggers auto-deploy.
Environment variables managed in Railway dashboard.

### Database (Supabase)
Migrations via Supabase MCP `apply_migration` tool.
Project ID: `vwfgksqkajnpfjospbpe` (ap-southeast-2)

## Rollback

### Frontend
Vercel dashboard → Deployments → select previous → "Promote to Production"

### Backend
Railway dashboard → Deployments → select previous → "Rollback"

### Database
Migrations are forward-only. For emergencies, apply a corrective migration.
Supabase has point-in-time recovery if needed (Pro plan feature).

## AI Tooling Workflow

| When | Tool |
|------|------|
| Architecture decisions | gstack `/cto` |
| Security changes | gstack `/cso` |
| Post-sprint review | gstack `/retro` |
| Browser QA | gstack `/qa` |
| New feature ideation | Superpowers `brainstorming` |
| Parallel tasks | Superpowers `dispatching-parallel-agents` |
| Pre-PR verification | Superpowers `verification-before-completion` |
